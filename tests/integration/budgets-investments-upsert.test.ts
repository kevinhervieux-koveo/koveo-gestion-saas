/**
 * @jest-environment node
 *
 * Real-database coverage for `PUT /api/budgets/:buildingId/investments`
 * (Task #580).
 *
 * The mock-based focused suite at
 * `tests/unit/api/budgets-focused.test.ts` already pins the diff logic
 * (`Task #558`). What it cannot prove is the actual round-trip through
 * Drizzle and Postgres:
 *   - the `id` column survives across multiple PUTs (so MCP tools can
 *     keep referencing the same row),
 *   - rows whose ids are dropped from the payload are physically
 *     deleted,
 *   - auto-generated investments are NEVER written by the upsert path
 *     even when a payload tries to claim their id,
 *   - foreign-key behaviour: rows really do reference the building and
 *     `type` is enforced by the Postgres enum.
 *
 * Pattern mirrors the other real-DB integration suites
 * (`tests/integration/multi-table-write-rollback.test.ts`,
 *  `tests/integration/cross-organization-isolation.test.ts`):
 *   - gate behind `_INTEGRATION_DB_URL`,
 *   - the global `jest.global-setup.cjs` already runs `drizzle-kit
 *     push --force` against that URL so the schema is fresh,
 *   - skip the suite when no test DB is wired up.
 *
 * The legacy skipped suite lived at `tests/unit/api/budgets.test.ts`
 * with `describeIfDb = describe.skip` and was never executed in CI.
 * The id-preservation, delete-by-omission and refusing-auto-row cases
 * have been migrated here so they actually run.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import crypto from 'crypto';
import { eq, inArray } from 'drizzle-orm';

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const TEST_TAG = 'task580-budget-investments';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

describeIfDb('PUT /:buildingId/investments — real DB upsert (Task #580)', () => {
  let app: express.Application;
  let db: any;
  let schema: any;

  const created: Record<string, Set<string>> = {
    capitalInvestments: new Set(),
    buildings: new Set(),
    organizations: new Set(),
  };

  // One shared building/org per file. Tests scrub the building's
  // capital_investments rows in `beforeEach` so each test starts from
  // a clean slate without paying the org/building setup cost again.
  const orgId = crypto.randomUUID();
  const buildingId = crypto.randomUUID();

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';

    db = require('../../server/db').db;
    schema = require('@shared/schema');

    // Mount the real handler directly. We bypass `requireAuth` on
    // purpose — this suite verifies the diff/upsert against the real
    // database, not the auth middleware (which is exercised by the
    // dedicated cross-org isolation suite). The handler is exported
    // expressly for invocation outside the router (see comment on
    // `investmentsPutHandler`).
    const { investmentsPutHandler, investmentsGetHandler } = require('../../server/api/budgets');
    app = express();
    app.use(express.json());
    app.put('/api/budgets/:buildingId/investments', investmentsPutHandler);
    app.get('/api/budgets/:buildingId/investments', investmentsGetHandler);

    await db.insert(schema.organizations).values({
      id: orgId,
      name: `${TEST_TAG} org ${orgId.slice(0, 8)}`,
      type: 'syndicate',
      address: '1 Test',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
    });
    created.organizations.add(orgId);

    await db.insert(schema.buildings).values({
      id: buildingId,
      organizationId: orgId,
      name: `${TEST_TAG} bldg`,
      address: '1 Test',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
      buildingType: 'condo',
      totalUnits: 1,
      isActive: true,
    });
    created.buildings.add(buildingId);
  }, 60000);

  beforeEach(async () => {
    if (!REAL_DB_URL || !db) return;
    // Wipe every investment row this building accumulated so each test
    // sees a fresh state without re-seeding the building.
    await db
      .delete(schema.capitalInvestments)
      .where(eq(schema.capitalInvestments.buildingId, buildingId));
    created.capitalInvestments.clear();
  });

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;
    await db
      .delete(schema.capitalInvestments)
      .where(eq(schema.capitalInvestments.buildingId, buildingId));
    if (created.buildings.size) {
      await db.delete(schema.buildings).where(inArray(schema.buildings.id, [...created.buildings]));
    }
    if (created.organizations.size) {
      await db
        .delete(schema.organizations)
        .where(inArray(schema.organizations.id, [...created.organizations]));
    }
  }, 60000);

  function sampleEntry(overrides: Record<string, unknown> = {}) {
    return {
      title: 'Roof replacement',
      amount: 12000,
      targetDate: '2026-06-01',
      urgency: 'urgent' as const,
      ownershipType: 'residences' as const,
      description: 'Membrane + flashing',
      category: 'capital_works',
      ...overrides,
    };
  }

  async function listInvestments(): Promise<any[]> {
    return db
      .select()
      .from(schema.capitalInvestments)
      .where(eq(schema.capitalInvestments.buildingId, buildingId));
  }

  it('inserts net-new entries with fresh UUIDs and stamps type=custom', async () => {
    const res = await request(app)
      .put(`/api/budgets/${buildingId}/investments`)
      .send({ investments: [sampleEntry()] });

    expect(res.status).toBe(200);

    const rows = await listInvestments();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toEqual(expect.any(String));
    expect(rows[0].id.length).toBeGreaterThan(0);
    expect(rows[0].type).toBe('custom');
    expect(rows[0].title).toBe('Roof replacement');
    // `amount` is a Postgres `numeric`, returned as a string by the driver.
    expect(rows[0].amount).toBe('12000.00');
    expect(rows[0].buildingId).toBe(buildingId);
  });

  it('preserves the database id across multiple PUTs that reuse the id', async () => {
    // First PUT seeds one custom row, then we read its id back.
    const seed = await request(app)
      .put(`/api/budgets/${buildingId}/investments`)
      .send({ investments: [sampleEntry({ title: 'Seeded' })] });
    expect(seed.status).toBe(200);

    const [seeded] = await listInvestments();
    const seededId = seeded.id;
    expect(seededId).toEqual(expect.any(String));

    // Second PUT carries the existing id with new field values. The
    // handler must UPDATE in place (not delete + insert), so the id
    // stays the same and the title reflects the new payload.
    const update = await request(app)
      .put(`/api/budgets/${buildingId}/investments`)
      .send({ investments: [sampleEntry({ id: seededId, title: 'Updated in place' })] });
    expect(update.status).toBe(200);

    const afterUpdate = await listInvestments();
    expect(afterUpdate).toHaveLength(1);
    expect(afterUpdate[0].id).toBe(seededId);
    expect(afterUpdate[0].title).toBe('Updated in place');

    // Third PUT carries the same id one more time — id must STILL be
    // stable. This catches any subtle "rewrite the id on every save"
    // regression.
    const updateAgain = await request(app)
      .put(`/api/budgets/${buildingId}/investments`)
      .send({ investments: [sampleEntry({ id: seededId, title: 'Updated again' })] });
    expect(updateAgain.status).toBe(200);

    const afterSecondUpdate = await listInvestments();
    expect(afterSecondUpdate).toHaveLength(1);
    expect(afterSecondUpdate[0].id).toBe(seededId);
    expect(afterSecondUpdate[0].title).toBe('Updated again');
  });

  it('deletes by omission: a PUT without an existing id removes that row', async () => {
    // Seed two custom rows.
    const seed = await request(app)
      .put(`/api/budgets/${buildingId}/investments`)
      .send({ investments: [sampleEntry({ title: 'Keeper' }), sampleEntry({ title: 'Doomed' })] });
    expect(seed.status).toBe(200);

    const seeded = await listInvestments();
    expect(seeded).toHaveLength(2);

    const keeper = seeded.find((r) => r.title === 'Keeper')!;
    const doomed = seeded.find((r) => r.title === 'Doomed')!;
    expect(keeper).toBeDefined();
    expect(doomed).toBeDefined();

    // PUT only the keeper id back. The doomed row must be physically
    // deleted from the table.
    const second = await request(app)
      .put(`/api/budgets/${buildingId}/investments`)
      .send({ investments: [sampleEntry({ id: keeper.id, title: 'Keeper' })] });
    expect(second.status).toBe(200);

    const after = await listInvestments();
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(keeper.id);
    expect(after.find((r) => r.id === doomed.id)).toBeUndefined();
  });

  it('refuses to touch auto-generated rows when a payload claims their id', async () => {
    // Seed an auto-generated row directly (the handler never creates
    // these — they come from the forecast engine). Its id is the one
    // a confused caller will try to "edit" via PUT.
    const autoId = crypto.randomUUID();
    await db.insert(schema.capitalInvestments).values({
      id: autoId,
      buildingId,
      title: 'Auto-suggested boiler',
      amount: '99999.00',
      targetDate: '2027-01-01',
      urgency: 'suggested',
      type: 'auto_generated',
      ownershipType: 'residences',
      description: 'Generated by forecast',
      category: 'capital_works',
    });

    // Also seed one custom row so we can prove the handler still
    // updates legitimate matches in the same call.
    const customSeed = await request(app)
      .put(`/api/budgets/${buildingId}/investments`)
      .send({ investments: [sampleEntry({ title: 'Real custom' })] });
    expect(customSeed.status).toBe(200);
    const seededRows = await listInvestments();
    const realCustom = seededRows.find((r) => r.title === 'Real custom')!;
    expect(realCustom).toBeDefined();
    expect(realCustom.type).toBe('custom');

    // Capture the auto row's full state so we can prove it is
    // untouched after the PUT.
    const autoBefore = seededRows.find((r) => r.id === autoId);
    expect(autoBefore).toBeDefined();
    expect(autoBefore!.type).toBe('auto_generated');
    expect(autoBefore!.title).toBe('Auto-suggested boiler');
    const autoUpdatedAtBefore = autoBefore!.updatedAt;

    // Hostile payload: include the auto row's id with new field
    // values. Because the handler's existing-id query is filtered to
    // `type='custom'`, the auto id is NOT in `existingIds` and so
    // falls through to the insert path. The auto row must be left
    // exactly as it was, and a fresh custom row with its own UUID
    // must be inserted.
    const res = await request(app)
      .put(`/api/budgets/${buildingId}/investments`)
      .send({
        investments: [
          sampleEntry({ id: realCustom.id, title: 'Real custom updated' }),
          sampleEntry({ id: autoId, title: 'Tried to hijack the auto row' }),
        ],
      });
    expect(res.status).toBe(200);

    const after = await listInvestments();
    // Three rows: the untouched auto row, the updated custom row, and
    // the freshly-inserted "hijack attempt" row (with a brand new id).
    expect(after).toHaveLength(3);

    const autoAfter = after.find((r) => r.id === autoId);
    expect(autoAfter).toBeDefined();
    expect(autoAfter!.type).toBe('auto_generated');
    expect(autoAfter!.title).toBe('Auto-suggested boiler');
    expect(autoAfter!.amount).toBe('99999.00');
    // `updatedAt` must NOT have advanced — the handler never wrote to
    // this row.
    expect(autoAfter!.updatedAt?.toString()).toBe(autoUpdatedAtBefore?.toString());

    const customAfter = after.find((r) => r.id === realCustom.id);
    expect(customAfter).toBeDefined();
    expect(customAfter!.type).toBe('custom');
    expect(customAfter!.title).toBe('Real custom updated');

    const inserted = after.find(
      (r) => r.id !== autoId && r.id !== realCustom.id,
    );
    expect(inserted).toBeDefined();
    expect(inserted!.type).toBe('custom');
    expect(inserted!.title).toBe('Tried to hijack the auto row');
    // CRITICAL: the inserted row got a brand-new UUID. The caller's
    // attempted id (the auto row's id) was discarded.
    expect(inserted!.id).not.toBe(autoId);
  });

  it('FK enforcement: rows really reference the seeded building', async () => {
    // Seed two custom rows.
    const res = await request(app)
      .put(`/api/budgets/${buildingId}/investments`)
      .send({ investments: [sampleEntry({ title: 'A' }), sampleEntry({ title: 'B' })] });
    expect(res.status).toBe(200);

    // Read back via the `buildingId` column to prove the FK was set
    // correctly on each insert.
    const rows = await listInvestments();
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.buildingId).toBe(buildingId);
      expect(row.type).toBe('custom');
    }
  });

  it('returns 400 when the payload is not an array (no DB writes)', async () => {
    // Seed one row to prove no rows are added or removed by a 400.
    const seed = await request(app)
      .put(`/api/budgets/${buildingId}/investments`)
      .send({ investments: [sampleEntry()] });
    expect(seed.status).toBe(200);
    const before = await listInvestments();
    expect(before).toHaveLength(1);
    const beforeId = before[0].id;

    const res = await request(app)
      .put(`/api/budgets/${buildingId}/investments`)
      .send({ investments: 'not-an-array' });
    expect(res.status).toBe(400);

    const after = await listInvestments();
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(beforeId);
  });

  it('returns 404 when the buildingId does not exist (no rows leak)', async () => {
    const phantomBuildingId = crypto.randomUUID();
    const res = await request(app)
      .put(`/api/budgets/${phantomBuildingId}/investments`)
      .send({ investments: [sampleEntry()] });
    expect(res.status).toBe(404);

    // No rows should have been created for either building.
    const rowsForReal = await listInvestments();
    expect(rowsForReal).toHaveLength(0);
    const rowsForPhantom = await db
      .select()
      .from(schema.capitalInvestments)
      .where(eq(schema.capitalInvestments.buildingId, phantomBuildingId));
    expect(rowsForPhantom).toHaveLength(0);
  });
});
