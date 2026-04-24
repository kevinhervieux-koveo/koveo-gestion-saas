/**
 * @jest-environment node
 *
 * Task #496 — Lock in the orphaned-invitation sweep behaviour against
 * a real Postgres database.
 *
 * `scripts/sweep-orphaned-invitations.ts` was added as a one-time
 * cleanup for invitations whose `buildingId` or `residenceId` was
 * orphaned BEFORE the task #383 cascade fix shipped. During
 * implementation it only ran in `--dry-run` mode against a clean
 * database (zero orphans found), so its UPDATE + audit-log path was
 * never exercised against real data. This test seeds rows in every
 * shape the sweep is supposed to touch (and a couple it must NOT) and
 * then drives the script's exported core function so any future
 * cascade or schema change that breaks the sweep gets caught.
 *
 * Seeded invitations:
 *
 *   1. pending, building_id is dangling, residence_id is null
 *   2. pending, residence_id is dangling, building_id is null
 *   3. pending, BOTH building_id and residence_id are dangling
 *   4. accepted, both columns dangling — terminal status, must NOT
 *      be touched (negative case)
 *   5. pending, both columns point at LIVE rows — must NOT be
 *      touched (negative case)
 *
 * Assertions after the sweep:
 *
 *   - Rows 1, 2, 3 end up `status='cancelled'` with their dangling FK
 *     column nulled (live FKs would be preserved, but rows 1-3 only
 *     reference ghost ids so both end up null).
 *   - Rows 4 and 5 are unchanged.
 *   - Three matching `invitation_audit_log` entries are written for
 *     the swept invitations (one per swept row), each pointing back at
 *     `scripts/sweep-orphaned-invitations.ts` as the source.
 *   - The function reports `detected=3, cancelled=3, exitCode=0`.
 *
 * Co-located with the other real-Postgres MCP cascade integration
 * tests (`mcp-delete-building-cascade.test.ts`,
 * `mcp-delete-residence-cascade.test.ts`,
 * `invitations-fk-constraints.test.ts`). Skipped cleanly when
 * `_INTEGRATION_DB_URL` is not set, so unit-tier runs stay
 * lightweight.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import crypto from 'crypto';
import { eq, inArray } from 'drizzle-orm';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import * as schemaImport from '@shared/schema';

type Schema = typeof schemaImport;
type Db = NeonDatabase<Schema>;

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const TEST_TAG = 'task496-sweep-orphans';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

describeIfDb('sweep-orphaned-invitations script — real Postgres (Task #496)', () => {
  let db: Db;
  let schema: Schema;
  let sweepOrphanedInvitations: typeof import('../../scripts/sweep-orphaned-invitations').sweepOrphanedInvitations;

  // Track every row we insert so afterAll can clean up regardless of
  // which assertion bailed first. invitation_audit_log rows cascade
  // away with the invitations they point at.
  const created = {
    organizationId: null as string | null,
    buildingId: null as string | null,
    residenceId: null as string | null,
    userId: null as string | null,
    invitationIds: new Set<string>(),
  };

  beforeAll(() => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    db = require('../../server/db').db as Db;
    schema = require('@shared/schema') as Schema;
    ({ sweepOrphanedInvitations } = require('../../scripts/sweep-orphaned-invitations'));
  }, 60000);

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;

    // Dependent-first cleanup. Audit-log rows have ON DELETE CASCADE
    // against invitations.id, so deleting the invitations clears them
    // too — we still delete invitations explicitly so the negative-case
    // rows (which were never touched by the sweep) also get cleaned up.
    if (created.invitationIds.size) {
      await db
        .delete(schema.invitations)
        .where(inArray(schema.invitations.id, [...created.invitationIds]));
    }
    if (created.residenceId) {
      await db.delete(schema.residences).where(eq(schema.residences.id, created.residenceId));
    }
    if (created.buildingId) {
      await db.delete(schema.buildings).where(eq(schema.buildings.id, created.buildingId));
    }
    if (created.organizationId) {
      await db.delete(schema.organizations).where(eq(schema.organizations.id, created.organizationId));
    }
    if (created.userId) {
      await db.delete(schema.users).where(eq(schema.users.id, created.userId));
    }
  }, 60000);

  it('cancels orphan pending invitations, nulls dangling FKs, audit-logs each, and leaves negative cases alone', async () => {
    // 1. Scope: organization + building + residence + inviter user.
    //    The buildings and residence rows are ONLY used by the
    //    "valid pending" negative-case invitation; the orphan rows
    //    point at random UUIDs that never resolve.
    const orgId = crypto.randomUUID();
    await db.insert(schema.organizations).values({
      id: orgId,
      name: `${TEST_TAG}-org-${orgId.slice(0, 6)}`,
      type: 'syndicate',
      address: `${TEST_TAG} 1`,
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
    });
    created.organizationId = orgId;

    const buildingId = crypto.randomUUID();
    await db.insert(schema.buildings).values({
      id: buildingId,
      organizationId: orgId,
      name: `${TEST_TAG}-bldg`,
      address: '1 Sweep Lane',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
      buildingType: 'condo',
      totalUnits: 1,
      totalFloors: 1,
      isActive: true,
    });
    created.buildingId = buildingId;

    const residenceId = crypto.randomUUID();
    await db.insert(schema.residences).values({
      id: residenceId,
      buildingId,
      unitNumber: '1',
      floor: 1,
      isActive: true,
    });
    created.residenceId = residenceId;

    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: userId,
      username: `${TEST_TAG}-${userId.slice(0, 8)}`,
      email: `${TEST_TAG}-${userId.slice(0, 8)}@example.test`,
      password: 'x'.repeat(60),
      firstName: 'Sweep',
      lastName: 'Tester',
      role: 'admin',
      language: 'en',
    });
    created.userId = userId;

    // 2. Five invitations: three orphan-pending shapes the sweep must
    //    cancel, plus two negative cases it must not touch.
    const ghostBuildingA = crypto.randomUUID();
    const ghostResidenceA = crypto.randomUUID();
    const ghostBuildingBoth = crypto.randomUUID();
    const ghostResidenceBoth = crypto.randomUUID();
    const ghostBuildingTerminal = crypto.randomUUID();
    const ghostResidenceTerminal = crypto.randomUUID();

    function makeInvitation(opts: {
      bId: string | null;
      rId: string | null;
      status: 'pending' | 'accepted';
      label: string;
    }) {
      const id = crypto.randomUUID();
      return {
        id,
        organizationId: orgId,
        buildingId: opts.bId,
        residenceId: opts.rId,
        email: `${TEST_TAG}-${opts.label}-${id.slice(0, 6)}@example.test`,
        token: `tok-${TEST_TAG}-${opts.label}-${id}`,
        tokenHash: `hash-${TEST_TAG}-${opts.label}-${id}`,
        role: 'tenant' as const,
        status: opts.status,
        invitedByUserId: userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
    }

    const danglingBuildingOnly = makeInvitation({
      bId: ghostBuildingA,
      rId: null,
      status: 'pending',
      label: 'dangling-bldg',
    });
    const danglingResidenceOnly = makeInvitation({
      bId: null,
      rId: ghostResidenceA,
      status: 'pending',
      label: 'dangling-res',
    });
    const danglingBoth = makeInvitation({
      bId: ghostBuildingBoth,
      rId: ghostResidenceBoth,
      status: 'pending',
      label: 'dangling-both',
    });
    const acceptedTerminal = makeInvitation({
      bId: ghostBuildingTerminal,
      rId: ghostResidenceTerminal,
      status: 'accepted',
      label: 'accepted-terminal',
    });
    const validPending = makeInvitation({
      bId: buildingId,
      rId: residenceId,
      status: 'pending',
      label: 'valid-pending',
    });
    const allInvitations = [
      danglingBuildingOnly,
      danglingResidenceOnly,
      danglingBoth,
      acceptedTerminal,
      validPending,
    ];
    // 3. Capture a pre-sweep baseline via dry-run BEFORE inserting our
    //    fixtures. The integration DB is shared between tests and may
    //    contain transient orphans from other suites; capturing the
    //    baseline first lets us assert that the sweep handled exactly
    //    *our* +3 seeded rows without flapping on the absolute DB-wide
    //    count.
    const baseline = await sweepOrphanedInvitations({ dryRun: true });
    expect(baseline.exitCode).toBe(0);
    expect(baseline.cancelled).toBe(0); // dry-run never writes

    for (const inv of allInvitations) {
      await db.insert(schema.invitations).values(inv);
      created.invitationIds.add(inv.id);
    }

    // 4. Drive the real sweep via the exported core function so we can
    //    inspect the structured result rather than scraping stdout.
    const result = await sweepOrphanedInvitations({ dryRun: false });
    expect(result.exitCode).toBe(0);
    // The sweep is global (the script has no scope filter), so any
    // pre-existing orphans from other tests will also get swept. We
    // only own the +3 delta we just seeded.
    expect(result.detected - baseline.detected).toBe(3);
    expect(result.cancelled).toBe(result.detected);
    expect(result.buildingDangling - baseline.buildingDangling).toBe(2); // dangling-bldg + dangling-both
    expect(result.residenceDangling - baseline.residenceDangling).toBe(2); // dangling-res + dangling-both
    expect(result.bothDangling - baseline.bothDangling).toBe(1); // dangling-both

    // 5. Read every test invitation back and assert state.
    const after = await db
      .select({
        id: schema.invitations.id,
        status: schema.invitations.status,
        buildingId: schema.invitations.buildingId,
        residenceId: schema.invitations.residenceId,
      })
      .from(schema.invitations)
      .where(inArray(schema.invitations.id, allInvitations.map((i) => i.id)));
    const byId = new Map(after.map((r) => [r.id, r]));

    // Orphan rows: cancelled, dangling FK column nulled. Rows 1 and 2
    // started with one column already null, so both end up null. Row 3
    // had two ghost FKs, so both are nulled by the CASE expressions.
    expect(byId.get(danglingBuildingOnly.id)).toMatchObject({
      status: 'cancelled',
      buildingId: null,
      residenceId: null,
    });
    expect(byId.get(danglingResidenceOnly.id)).toMatchObject({
      status: 'cancelled',
      buildingId: null,
      residenceId: null,
    });
    expect(byId.get(danglingBoth.id)).toMatchObject({
      status: 'cancelled',
      buildingId: null,
      residenceId: null,
    });

    // Negative cases: untouched. The terminal-status row keeps its
    // ghost FKs (the script only filters on status='pending'), and the
    // valid pending row keeps its live FKs.
    expect(byId.get(acceptedTerminal.id)).toMatchObject({
      status: 'accepted',
      buildingId: ghostBuildingTerminal,
      residenceId: ghostResidenceTerminal,
    });
    expect(byId.get(validPending.id)).toMatchObject({
      status: 'pending',
      buildingId,
      residenceId,
    });

    // 6. Audit log: exactly one entry per swept invitation, none for
    //    the negative-case rows. Scoped to our seeded invitation ids
    //    so prior orphans (also swept by the global UPDATE) don't
    //    contaminate the count.
    const auditRows = await db
      .select({
        invitationId: schema.invitationAuditLog.invitationId,
        action: schema.invitationAuditLog.action,
        previousStatus: schema.invitationAuditLog.previousStatus,
        newStatus: schema.invitationAuditLog.newStatus,
        details: schema.invitationAuditLog.details,
      })
      .from(schema.invitationAuditLog)
      .where(
        inArray(
          schema.invitationAuditLog.invitationId,
          allInvitations.map((i) => i.id)
        )
      );
    expect(auditRows).toHaveLength(3);
    const auditByInv = new Map(auditRows.map((a) => [a.invitationId, a]));
    for (const orphanId of [danglingBuildingOnly.id, danglingResidenceOnly.id, danglingBoth.id]) {
      const entry = auditByInv.get(orphanId);
      expect(entry).toBeDefined();
      expect(entry).toMatchObject({
        action: 'cancelled',
        previousStatus: 'pending',
        newStatus: 'cancelled',
      });
      expect(entry?.details).toMatchObject({
        source: 'scripts/sweep-orphaned-invitations.ts',
      });
    }
    // No audit row was written for the negative-case invitations.
    expect(auditByInv.has(acceptedTerminal.id)).toBe(false);
    expect(auditByInv.has(validPending.id)).toBe(false);
  }, 90000);
});
