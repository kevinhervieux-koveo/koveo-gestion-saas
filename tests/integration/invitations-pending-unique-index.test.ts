/**
 * @jest-environment node
 *
 * Task #200 — database-level guard against duplicate pending invitations.
 *
 * Inserts two `status='pending'` rows for the same
 * (organizationId, lower(email), coalesce(residenceId, '')) tuple
 * directly via `db.insert`, bypassing `createInvitationWithSoftReplace`,
 * and verifies the partial unique index
 * `invitations_pending_org_email_residence_unique` rejects the second
 * insert with a Postgres 23505 unique-violation.
 *
 * Skipped when `_INTEGRATION_DB_URL` is not set so unit-tier runs stay
 * lightweight; the real-DB pattern mirrors
 * `tests/integration/multi-table-write-rollback.test.ts`.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import crypto from 'crypto';
import { eq, inArray, sql } from 'drizzle-orm';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import * as schemaImport from '@shared/schema';

type Schema = typeof schemaImport;
type Db = NeonDatabase<Schema>;

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const TEST_TAG = 'task200-pending-unique';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

/**
 * Walk the .cause chain so we recognize a Postgres unique violation
 * whether it surfaces as a raw pg error (top-level `.code`) or as
 * Drizzle's `DrizzleQueryError` wrapper (which exposes the underlying
 * pg error via `.cause`).
 */
function isUniqueViolation(err: unknown): boolean {
  let cur: { code?: string; message?: string; cause?: unknown } | null =
    (err as { code?: string; message?: string; cause?: unknown } | null) ?? null;
  for (let depth = 0; cur && depth < 5; depth++) {
    if (cur.code === '23505') return true;
    if (
      typeof cur.message === 'string' &&
      /unique constraint|duplicate key|invitations_pending_org_email_residence_unique/i.test(
        cur.message,
      )
    ) {
      return true;
    }
    cur = (cur.cause as typeof cur) ?? null;
  }
  return false;
}

describeIfDb('invitations partial unique index — Task #200', () => {
  let db: Db;
  let schema: Schema;

  const created: Record<string, Set<string>> = {
    invitations: new Set(),
    organizations: new Set(),
    users: new Set(),
  };

  beforeAll(() => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    db = require('../../server/db').db as Db;
    schema = require('@shared/schema') as Schema;
  }, 60000);

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;
    if (created.invitations.size) {
      await db
        .delete(schema.invitations)
        .where(inArray(schema.invitations.id, [...created.invitations]));
    }
    if (created.organizations.size) {
      await db
        .delete(schema.organizations)
        .where(inArray(schema.organizations.id, [...created.organizations]));
    }
    if (created.users.size) {
      await db.delete(schema.users).where(inArray(schema.users.id, [...created.users]));
    }
  }, 60000);

  async function seedOrgAndAdmin(): Promise<{ orgId: string; adminUserId: string }> {
    const orgId = crypto.randomUUID();
    await db.insert(schema.organizations).values({
      id: orgId,
      name: `${TEST_TAG} org ${orgId.slice(0, 8)}`,
      type: 'syndicate',
      address: '1 T',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
    });
    created.organizations.add(orgId);

    const adminUserId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: adminUserId,
      username: `${TEST_TAG}-admin-${adminUserId.slice(0, 8)}`,
      email: `${adminUserId}@task200.test`,
      password: 'x',
      firstName: 'A',
      lastName: 'D',
      role: 'admin',
      isActive: true,
    });
    created.users.add(adminUserId);
    return { orgId, adminUserId };
  }

  function basePendingValues(opts: {
    orgId: string;
    adminUserId: string;
    email: string;
    residenceId?: string | null;
  }): typeof schema.invitations.$inferInsert {
    return {
      organizationId: opts.orgId,
      residenceId: opts.residenceId ?? null,
      email: opts.email,
      token: crypto.randomBytes(24).toString('hex'),
      tokenHash: crypto.randomBytes(32).toString('hex'),
      role: 'tenant',
      invitedByUserId: opts.adminUserId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'pending',
    };
  }

  it('rejects a second pending row for the same (org, lower(email), coalesce(residenceId,"")) tuple', async () => {
    const { orgId, adminUserId } = await seedOrgAndAdmin();
    const email = `dup-${crypto.randomUUID().slice(0, 8)}@task200.test`;

    const [first] = await db
      .insert(schema.invitations)
      .values(basePendingValues({ orgId, adminUserId, email }))
      .returning({ id: schema.invitations.id });
    created.invitations.add(first.id);

    let captured: { code?: string; message?: string } | null = null;
    try {
      const [second] = await db
        .insert(schema.invitations)
        .values(basePendingValues({ orgId, adminUserId, email }))
        .returning({ id: schema.invitations.id });
      // If we got here, the index did not enforce the invariant. Track
      // the row for cleanup before failing the assertion.
      if (second?.id) created.invitations.add(second.id);
    } catch (err) {
      captured = err as { code?: string; message?: string };
    }

    expect(captured).not.toBeNull();
    expect(isUniqueViolation(captured)).toBe(true);

    const stillPending = await db
      .select({ id: schema.invitations.id })
      .from(schema.invitations)
      .where(
        sql`${schema.invitations.organizationId} = ${orgId}
            AND lower(${schema.invitations.email}) = lower(${email})
            AND ${schema.invitations.status} = 'pending'`,
      );
    expect(stillPending).toHaveLength(1);
    expect(stillPending[0].id).toBe(first.id);
  }, 30000);

  it('treats casing differences in email as the same dedup tuple', async () => {
    const { orgId, adminUserId } = await seedOrgAndAdmin();
    const lowered = `mixed-${crypto.randomUUID().slice(0, 8)}@task200.test`;
    const mixedCase = lowered
      .split('')
      .map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c))
      .join('');

    const [first] = await db
      .insert(schema.invitations)
      .values(basePendingValues({ orgId, adminUserId, email: lowered }))
      .returning({ id: schema.invitations.id });
    created.invitations.add(first.id);

    let captured: { code?: string; message?: string } | null = null;
    try {
      const [second] = await db
        .insert(schema.invitations)
        .values(basePendingValues({ orgId, adminUserId, email: mixedCase }))
        .returning({ id: schema.invitations.id });
      if (second?.id) created.invitations.add(second.id);
    } catch (err) {
      captured = err as { code?: string; message?: string };
    }

    expect(captured).not.toBeNull();
    expect(isUniqueViolation(captured)).toBe(true);
  }, 30000);

  it('allows a new pending row once the prior one has been moved out of pending', async () => {
    const { orgId, adminUserId } = await seedOrgAndAdmin();
    const email = `replace-${crypto.randomUUID().slice(0, 8)}@task200.test`;

    const [first] = await db
      .insert(schema.invitations)
      .values(basePendingValues({ orgId, adminUserId, email }))
      .returning({ id: schema.invitations.id });
    created.invitations.add(first.id);

    await db
      .update(schema.invitations)
      .set({ status: 'replaced', updatedAt: new Date() })
      .where(eq(schema.invitations.id, first.id));

    const [second] = await db
      .insert(schema.invitations)
      .values(basePendingValues({ orgId, adminUserId, email }))
      .returning({ id: schema.invitations.id });
    created.invitations.add(second.id);

    expect(second.id).toBeTruthy();
    expect(second.id).not.toBe(first.id);
  }, 30000);
});
