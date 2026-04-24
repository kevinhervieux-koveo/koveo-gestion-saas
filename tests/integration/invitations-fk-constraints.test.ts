/**
 * @jest-environment node
 *
 * Task #391 — database safeguards so invitations can't point to deleted
 * buildings or residences.
 *
 * Migration `0009_invitations_fk_constraints.sql` adds three foreign-key
 * constraints to the `invitations` table:
 *
 *   - organization_id -> organizations(id) ON DELETE CASCADE
 *   - building_id     -> buildings(id)     ON DELETE SET NULL
 *   - residence_id    -> residences(id)    ON DELETE SET NULL
 *
 * Until task #391 the invitations table had no FKs and the MCP cascade
 * sweep was the only safeguard. This test exercises the new structural
 * guarantee directly against Postgres, bypassing the MCP layer entirely:
 *
 *   1. Inserting an invitation that references a non-existent building
 *      or residence is rejected with a 23503 (foreign_key_violation).
 *   2. Deleting the building referenced by an invitation NULLs out
 *      `building_id` on that invitation (status preserved).
 *   3. Deleting the residence referenced by an invitation NULLs out
 *      `residence_id` on that invitation (status preserved).
 *   4. Deleting the organization referenced by an invitation deletes
 *      the invitation row entirely (CASCADE).
 *
 * Skipped when `_INTEGRATION_DB_URL` is not set so unit-tier runs stay
 * lightweight; mirrors the real-DB pattern used by the other invitation
 * integration tests.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import crypto from 'crypto';
import { eq, inArray } from 'drizzle-orm';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import * as schemaImport from '@shared/schema';

type Schema = typeof schemaImport;
type Db = NeonDatabase<Schema>;

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const TEST_TAG = 'task391-fk-constraints';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

/**
 * Walk the .cause chain so we recognize a Postgres FK violation
 * whether it surfaces as a raw pg error (top-level `.code`) or as
 * Drizzle's `DrizzleQueryError` wrapper (which exposes the underlying
 * pg error via `.cause`).
 */
function isFkViolation(err: unknown): boolean {
  let cur: { code?: string; message?: string; cause?: unknown } | null =
    (err as { code?: string; message?: string; cause?: unknown } | null) ?? null;
  for (let depth = 0; cur && depth < 5; depth++) {
    if (cur.code === '23503') return true;
    if (
      typeof cur.message === 'string' &&
      /foreign key constraint|violates foreign key/i.test(cur.message)
    ) {
      return true;
    }
    cur = (cur.cause as typeof cur) ?? null;
  }
  return false;
}

describeIfDb('invitations FK constraints — Task #391', () => {
  let db: Db;
  let schema: Schema;

  // Track every row we insert so afterAll can clean up regardless of
  // which assertion failed first.
  const created = {
    organizationIds: new Set<string>(),
    buildingIds: new Set<string>(),
    residenceIds: new Set<string>(),
    invitationIds: new Set<string>(),
    userIds: new Set<string>(),
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

    // Tear down dependent rows first; the FKs themselves will sweep
    // most of these via CASCADE / SET NULL once parents go away, but
    // explicit deletes keep cleanup deterministic if a test bailed
    // mid-way.
    if (created.invitationIds.size) {
      await db
        .delete(schema.invitations)
        .where(inArray(schema.invitations.id, [...created.invitationIds]));
    }
    if (created.residenceIds.size) {
      await db
        .delete(schema.residences)
        .where(inArray(schema.residences.id, [...created.residenceIds]));
    }
    if (created.buildingIds.size) {
      await db
        .delete(schema.buildings)
        .where(inArray(schema.buildings.id, [...created.buildingIds]));
    }
    if (created.organizationIds.size) {
      await db
        .delete(schema.organizations)
        .where(inArray(schema.organizations.id, [...created.organizationIds]));
    }
    if (created.userIds.size) {
      await db
        .delete(schema.users)
        .where(inArray(schema.users.id, [...created.userIds]));
    }
  }, 60000);

  /**
   * Seed a fresh organization + building + residence + inviter user
   * for a single test case so each test starts from a clean slate.
   */
  async function seedScope(suffix: string) {
    const orgId = crypto.randomUUID();
    await db.insert(schema.organizations).values({
      id: orgId,
      name: `${TEST_TAG}-${suffix}-org`,
      type: 'syndicate',
      address: `${TEST_TAG} ${suffix}`,
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
    });
    created.organizationIds.add(orgId);

    const buildingId = crypto.randomUUID();
    await db.insert(schema.buildings).values({
      id: buildingId,
      organizationId: orgId,
      name: `${TEST_TAG}-${suffix}-bldg`,
      address: '1 FK Lane',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
      buildingType: 'condo',
      totalUnits: 1,
      totalFloors: 1,
      isActive: true,
    });
    created.buildingIds.add(buildingId);

    const residenceId = crypto.randomUUID();
    await db.insert(schema.residences).values({
      id: residenceId,
      buildingId,
      unitNumber: '1',
      floor: 1,
      isActive: true,
    });
    created.residenceIds.add(residenceId);

    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: userId,
      username: `${TEST_TAG}-${suffix}-${userId.slice(0, 8)}`,
      email: `${TEST_TAG}-${suffix}-${userId.slice(0, 8)}@example.test`,
      password: 'x'.repeat(60),
      firstName: 'FK',
      lastName: 'Tester',
      role: 'admin',
      language: 'en',
    });
    created.userIds.add(userId);

    return { orgId, buildingId, residenceId, userId };
  }

  function buildInvitation(opts: {
    organizationId: string | null;
    buildingId: string | null;
    residenceId: string | null;
    userId: string;
    suffix: string;
  }) {
    const id = crypto.randomUUID();
    return {
      id,
      organizationId: opts.organizationId,
      buildingId: opts.buildingId,
      residenceId: opts.residenceId,
      email: `${TEST_TAG}-${opts.suffix}-${id.slice(0, 6)}@example.test`,
      token: `tok-${opts.suffix}-${id}`,
      tokenHash: `hash-${opts.suffix}-${id}`,
      role: 'tenant' as const,
      status: 'pending' as const,
      invitedByUserId: opts.userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
  }

  it('rejects an invitation whose building_id does not exist', async () => {
    const { orgId, userId } = await seedScope('reject-building');
    const ghostBuildingId = crypto.randomUUID();
    const row = buildInvitation({
      organizationId: orgId,
      buildingId: ghostBuildingId,
      residenceId: null,
      userId,
      suffix: 'reject-building',
    });

    let caught: unknown = null;
    try {
      await db.insert(schema.invitations).values(row);
      created.invitationIds.add(row.id);
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    expect(isFkViolation(caught)).toBe(true);
  }, 60000);

  it('rejects an invitation whose residence_id does not exist', async () => {
    const { orgId, userId } = await seedScope('reject-residence');
    const ghostResidenceId = crypto.randomUUID();
    const row = buildInvitation({
      organizationId: orgId,
      buildingId: null,
      residenceId: ghostResidenceId,
      userId,
      suffix: 'reject-residence',
    });

    let caught: unknown = null;
    try {
      await db.insert(schema.invitations).values(row);
      created.invitationIds.add(row.id);
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    expect(isFkViolation(caught)).toBe(true);
  }, 60000);

  it('SET NULLs invitation.building_id when the referenced building is deleted', async () => {
    const { orgId, buildingId, userId } = await seedScope('set-null-building');
    const row = buildInvitation({
      organizationId: orgId,
      buildingId,
      residenceId: null,
      userId,
      suffix: 'set-null-building',
    });
    await db.insert(schema.invitations).values(row);
    created.invitationIds.add(row.id);

    await db.delete(schema.buildings).where(eq(schema.buildings.id, buildingId));
    created.buildingIds.delete(buildingId);

    const after = await db
      .select({
        id: schema.invitations.id,
        buildingId: schema.invitations.buildingId,
        status: schema.invitations.status,
      })
      .from(schema.invitations)
      .where(eq(schema.invitations.id, row.id));
    expect(after).toHaveLength(1);
    expect(after[0].buildingId).toBeNull();
    // Status is preserved — the FK only nulls the dangling pointer.
    // The MCP cascade sweep is what flips status to 'cancelled'; a raw
    // DB delete (this test) leaves the status untouched.
    expect(after[0].status).toBe('pending');
  }, 60000);

  it('SET NULLs invitation.residence_id when the referenced residence is deleted', async () => {
    const { orgId, buildingId, residenceId, userId } = await seedScope('set-null-residence');
    const row = buildInvitation({
      organizationId: orgId,
      buildingId,
      residenceId,
      userId,
      suffix: 'set-null-residence',
    });
    await db.insert(schema.invitations).values(row);
    created.invitationIds.add(row.id);

    await db.delete(schema.residences).where(eq(schema.residences.id, residenceId));
    created.residenceIds.delete(residenceId);

    const after = await db
      .select({
        id: schema.invitations.id,
        buildingId: schema.invitations.buildingId,
        residenceId: schema.invitations.residenceId,
        status: schema.invitations.status,
      })
      .from(schema.invitations)
      .where(eq(schema.invitations.id, row.id));
    expect(after).toHaveLength(1);
    expect(after[0].residenceId).toBeNull();
    // building_id was not the deleted entity, so it stays put.
    expect(after[0].buildingId).toBe(buildingId);
    expect(after[0].status).toBe('pending');
  }, 60000);

  it('CASCADE-deletes the invitation when the referenced organization is deleted', async () => {
    const { orgId, userId } = await seedScope('cascade-org');
    const row = buildInvitation({
      organizationId: orgId,
      buildingId: null,
      residenceId: null,
      userId,
      suffix: 'cascade-org',
    });
    await db.insert(schema.invitations).values(row);
    created.invitationIds.add(row.id);

    // Delete the building and residence first because buildings have
    // their own FK to organizations (also ON DELETE CASCADE), but we
    // still want to be explicit so the cleanup is deterministic.
    const seededBuildings = [...created.buildingIds].filter(async (id) => {
      const b = await db
        .select({ id: schema.buildings.id })
        .from(schema.buildings)
        .where(eq(schema.buildings.id, id));
      return b.length > 0;
    });
    void seededBuildings;

    await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId));
    created.organizationIds.delete(orgId);
    // The buildings/residences inside the org were cascade-deleted by
    // the existing buildings.organization_id FK; remove their bookkeeping
    // entries so afterAll doesn't try to re-delete them.
    for (const id of [...created.buildingIds]) {
      const stillThere = await db
        .select({ id: schema.buildings.id })
        .from(schema.buildings)
        .where(eq(schema.buildings.id, id));
      if (stillThere.length === 0) created.buildingIds.delete(id);
    }
    for (const id of [...created.residenceIds]) {
      const stillThere = await db
        .select({ id: schema.residences.id })
        .from(schema.residences)
        .where(eq(schema.residences.id, id));
      if (stillThere.length === 0) created.residenceIds.delete(id);
    }

    const after = await db
      .select({ id: schema.invitations.id })
      .from(schema.invitations)
      .where(eq(schema.invitations.id, row.id));
    expect(after).toHaveLength(0);
    created.invitationIds.delete(row.id);
  }, 60000);
});
