/**
 * @jest-environment node
 *
 * Task #172: Make residence-count adjustments on a building all-or-nothing.
 *
 * The PUT `/api/admin/buildings/:id` handler now wraps the building row
 * update *and* the residence-count adjustment inside a single
 * `db.transaction`. Before this change the two writes were issued
 * back-to-back against the top-level `db`, so a failure in
 * `adjustResidenceCount` (e.g. a constraint violation while inserting
 * new residence rows) would leave `buildings.totalUnits` updated but
 * the residence rows missing.
 *
 * This test mirrors the real-DB pattern used by
 * `tests/integration/multi-table-write-rollback.test.ts`: seed real
 * rows, replay the production-shaped statement sequence inside
 * `db.transaction`, throw mid-sequence, then assert the database is
 * back in its pre-transaction state.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import crypto from 'crypto';
import { eq, inArray, and } from 'drizzle-orm';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import * as schemaImport from '@shared/schema';

type Schema = typeof schemaImport;
type Db = NeonDatabase<Schema>;

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const TEST_TAG = 'task172-bldg-tx';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

describeIfDb('building residence-count rollback — Task #172', () => {
  let db: Db;
  let schema: Schema;

  const created: Record<string, Set<string>> = {
    residences: new Set(),
    buildings: new Set(),
    organizations: new Set(),
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
    if (created.residences.size) {
      await db
        .delete(schema.residences)
        .where(inArray(schema.residences.id, [...created.residences]));
    }
    if (created.buildings.size) {
      await db.delete(schema.buildings).where(inArray(schema.buildings.id, [...created.buildings]));
    }
    if (created.organizations.size) {
      await db
        .delete(schema.organizations)
        .where(inArray(schema.organizations.id, [...created.organizations]));
    }
  }, 60000);

  async function seedBuilding(initialUnits: number) {
    const orgId = crypto.randomUUID();
    const buildingId = crypto.randomUUID();
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
    await db.insert(schema.buildings).values({
      id: buildingId,
      organizationId: orgId,
      name: `${TEST_TAG} bldg`,
      address: '1 T',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
      buildingType: 'condo',
      totalUnits: initialUnits,
      totalFloors: 1,
      isActive: true,
    });
    created.buildings.add(buildingId);

    const seededResidences: string[] = [];
    for (let unit = 1; unit <= initialUnits; unit++) {
      const residenceId = crypto.randomUUID();
      await db.insert(schema.residences).values({
        id: residenceId,
        buildingId,
        unitNumber: `1${unit.toString().padStart(2, '0')}`,
        floor: 1,
        isActive: true,
      });
      created.residences.add(residenceId);
      seededResidences.push(residenceId);
    }
    return { orgId, buildingId, seededResidences };
  }

  it('totalUnits stays at the original value when the residence insert throws mid-flight', async () => {
    const initialUnits = 2;
    const newTotalUnits = 5;
    const { buildingId } = await seedBuilding(initialUnits);

    await expect(
      db.transaction(async (tx) => {
        // Step 1: production-shaped building row update — bumps
        // totalUnits to the requested value first, exactly like the
        // PUT handler does.
        await tx
          .update(schema.buildings)
          .set({ totalUnits: newTotalUnits, updatedAt: new Date() })
          .where(eq(schema.buildings.id, buildingId));

        // Step 2: production-shaped residence inserts (what
        // `addResidencesAutomatically` would issue inside the same
        // transaction).
        await tx.insert(schema.residences).values({
          id: crypto.randomUUID(),
          buildingId,
          unitNumber: '103',
          floor: 1,
          isActive: true,
        });

        // Step 3: simulate a mid-flight failure (e.g. FK violation on
        // a later residence row, or a dropped DB connection).
        throw new Error('injected failure mid residence insert');
      })
    ).rejects.toThrow('injected failure');

    // The transaction must have rolled back: building.totalUnits
    // should still reflect the *original* value, and the residence
    // count must be unchanged.
    const buildingRow = await db
      .select({ totalUnits: schema.buildings.totalUnits })
      .from(schema.buildings)
      .where(eq(schema.buildings.id, buildingId));
    expect(buildingRow[0].totalUnits).toBe(initialUnits);

    const liveResidences = await db
      .select({ id: schema.residences.id })
      .from(schema.residences)
      .where(
        and(eq(schema.residences.buildingId, buildingId), eq(schema.residences.isActive, true))
      );
    expect(liveResidences).toHaveLength(initialUnits);
  }, 30000);

  it('exercises the real `adjustResidenceCount` path: rows it inserts disappear when the surrounding tx aborts', async () => {
    // This is the strongest regression guard: it imports the actual
    // production function (`adjustResidenceCount`) — the same one the
    // PUT `/api/admin/buildings/:id` handler calls — runs it inside a
    // `db.transaction`, then aborts. If the `executor` parameter is
    // ever silently dropped or replaced with the top-level `db`, the
    // residence rows it inserted will leak past the rollback and this
    // test will flag it.
    const initialUnits = 2;
    const newTotalUnits = 5; // forces 3 residence inserts
    const { orgId, buildingId } = await seedBuilding(initialUnits);

    const { adjustResidenceCount } = await import(
      '../../server/api/buildings/operations'
    );

    await expect(
      db.transaction(async (tx) => {
        const result = await adjustResidenceCount(
          buildingId,
          orgId,
          newTotalUnits,
          initialUnits,
          1,
          tx as unknown as typeof db
        );
        // sanity: production function should have decided to add rows
        expect(result.action).toBe('increased');
        throw new Error('injected failure after adjustResidenceCount');
      })
    ).rejects.toThrow('injected failure');

    const liveResidences = await db
      .select({ id: schema.residences.id })
      .from(schema.residences)
      .where(
        and(eq(schema.residences.buildingId, buildingId), eq(schema.residences.isActive, true))
      );
    // The 3 residences `adjustResidenceCount` inserted must have been
    // rolled back together with the surrounding transaction.
    expect(liveResidences).toHaveLength(initialUnits);

    // Track whatever did get persisted so afterAll can clean it up
    // even if the assertion above ever regresses.
    const allRowsForBuilding = await db
      .select({ id: schema.residences.id })
      .from(schema.residences)
      .where(eq(schema.residences.buildingId, buildingId));
    for (const row of allRowsForBuilding) created.residences.add(row.id);
  }, 30000);

  it('residence inserts disappear when the building row update throws after them', async () => {
    const initialUnits = 1;
    const { buildingId } = await seedBuilding(initialUnits);
    const newResidenceId = crypto.randomUUID();

    await expect(
      db.transaction(async (tx) => {
        // First insert a brand-new residence row inside the tx...
        await tx.insert(schema.residences).values({
          id: newResidenceId,
          buildingId,
          unitNumber: '199',
          floor: 1,
          isActive: true,
        });

        // ...then fail before the building row update commits. The
        // newly-inserted residence must not survive.
        throw new Error('injected failure after residence insert');
      })
    ).rejects.toThrow('injected failure');

    const stray = await db
      .select({ id: schema.residences.id })
      .from(schema.residences)
      .where(eq(schema.residences.id, newResidenceId));
    expect(stray).toHaveLength(0);

    const buildingRow = await db
      .select({ totalUnits: schema.buildings.totalUnits })
      .from(schema.buildings)
      .where(eq(schema.buildings.id, buildingId));
    expect(buildingRow[0].totalUnits).toBe(initialUnits);
  }, 30000);
});
