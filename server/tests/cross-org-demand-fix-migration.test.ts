import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { db } from '../db';
import { organizations, buildings, residences, demands } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Regression tests for migration 0015_fix_cross_org_demand_residence_ids.sql
 * and the /api/health `crossOrgDemands` drift healthcheck query.
 *
 * These tests write to a real Postgres database and are skipped when only
 * a stub DATABASE_URL is present (e.g. localhost-only Jest runs).
 */

const REAL_DB_AVAILABLE =
  typeof process.env.DATABASE_URL === 'string' &&
  !process.env.DATABASE_URL.includes('localhost');

const describeOrSkip = REAL_DB_AVAILABLE ? describe : describe.skip;

/** Inline SQL that mirrors migration 0015 exactly. */
const MIGRATION_UPDATE_SQL = sql`
  UPDATE demands
  SET    residence_id = NULL
  WHERE  residence_id IS NOT NULL
    AND  building_id <> (
           SELECT r.building_id
           FROM   residences r
           WHERE  r.id = demands.residence_id
         )
`;

/** The same post-condition query used by the migration DO block. */
const CROSS_ORG_COUNT_SQL = sql`
  SELECT count(*)::int AS cross_org_demands
  FROM demands d
  JOIN residences r ON r.id = d.residence_id
  WHERE r.building_id <> d.building_id
`;

function getCrossOrgCount(rows: unknown[]): number {
  return (rows[0] as { cross_org_demands: number }).cross_org_demands;
}

describeOrSkip('migration 0015 – fix cross-org demand residence_ids', () => {
  let org1Id: string;
  let org2Id: string;
  let building1Id: string;
  let building2Id: string;
  let residence2Id: string;
  let demandId: string;

  beforeAll(async () => {
    const [org1] = await db
      .insert(organizations)
      .values({
        name: 'Test Org 1 – 0015-migration',
        type: 'syndicate',
        address: '1 Migration Ave',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A 1A1',
        isActive: true,
      })
      .returning();
    org1Id = org1.id;

    const [org2] = await db
      .insert(organizations)
      .values({
        name: 'Test Org 2 – 0015-migration',
        type: 'syndicate',
        address: '2 Migration Ave',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1B 1B1',
        isActive: true,
      })
      .returning();
    org2Id = org2.id;

    const [building1] = await db
      .insert(buildings)
      .values({
        name: 'Migration Test Building 1',
        address: '1 Building St',
        city: 'Montreal',
        postalCode: 'H1A 1A1',
        organizationId: org1Id,
        totalUnits: 4,
        totalFloors: 1,
        buildingType: 'apartment',
        isActive: true,
      })
      .returning();
    building1Id = building1.id;

    const [building2] = await db
      .insert(buildings)
      .values({
        name: 'Migration Test Building 2',
        address: '2 Building St',
        city: 'Montreal',
        postalCode: 'H1B 1B1',
        organizationId: org2Id,
        totalUnits: 4,
        totalFloors: 1,
        buildingType: 'apartment',
        isActive: true,
      })
      .returning();
    building2Id = building2.id;

    // Residence belongs to building 2 (org 2).
    const [residence2] = await db
      .insert(residences)
      .values({
        buildingId: building2Id,
        unitNumber: 'M-201',
        floor: 2,
        monthlyFees: '1200.00',
        isActive: true,
      })
      .returning();
    residence2Id = residence2.id;

    // Cross-org demand: building_id → org 1, residence_id → org 2.
    // Disable the trigger to reproduce legacy data that pre-dates the
    // 0010 guard (the exact condition migration 0015 is designed to fix).
    await db.execute(
      sql`ALTER TABLE demands DISABLE TRIGGER demands_residence_building_check`,
    );
    try {
      const [demand] = await db
        .insert(demands)
        .values({
          buildingId: building1Id,
          residenceId: residence2Id,
          type: 'other',
          status: 'draft',
          description: 'Cross-org demand seeded for migration-0015 regression test',
        })
        .returning();
      demandId = demand.id;
    } finally {
      await db.execute(
        sql`ALTER TABLE demands ENABLE TRIGGER demands_residence_building_check`,
      );
    }
  }, 30_000);

  afterAll(async () => {
    if (demandId)
      await db.delete(demands).where(eq(demands.id, demandId)).catch(() => undefined);
    if (residence2Id)
      await db.delete(residences).where(eq(residences.id, residence2Id)).catch(() => undefined);
    if (building1Id)
      await db.delete(buildings).where(eq(buildings.id, building1Id)).catch(() => undefined);
    if (building2Id)
      await db.delete(buildings).where(eq(buildings.id, building2Id)).catch(() => undefined);
    if (org1Id)
      await db.delete(organizations).where(eq(organizations.id, org1Id)).catch(() => undefined);
    if (org2Id)
      await db.delete(organizations).where(eq(organizations.id, org2Id)).catch(() => undefined);
  }, 30_000);

  it('seeds a cross-org demand row (pre-condition)', async () => {
    // Confirm the violating row exists before we run the migration SQL.
    const result = await db.execute(CROSS_ORG_COUNT_SQL);
    const count = getCrossOrgCount(result.rows);
    expect(count).toBeGreaterThanOrEqual(1);
  }, 30_000);

  it('NULLs residence_id and preserves building_id on the offending demand', async () => {
    await db.execute(MIGRATION_UPDATE_SQL);

    const [row] = await db
      .select({
        id: demands.id,
        buildingId: demands.buildingId,
        residenceId: demands.residenceId,
      })
      .from(demands)
      .where(eq(demands.id, demandId));

    expect(row).toBeDefined();
    // building_id must be preserved — only the cross-org residence link is removed.
    expect(row.buildingId).toBe(building1Id);
    expect(row.residenceId).toBeNull();
  }, 30_000);

  it('post-condition: zero cross-org demand rows remain after the migration', async () => {
    const result = await db.execute(CROSS_ORG_COUNT_SQL);
    const count = getCrossOrgCount(result.rows);
    expect(count).toBe(0);
  }, 30_000);

  it('is idempotent: re-running the UPDATE on a clean table affects 0 rows', async () => {
    // Running the migration SQL again must not throw and must be a no-op.
    await expect(db.execute(MIGRATION_UPDATE_SQL)).resolves.not.toThrow();

    const result = await db.execute(CROSS_ORG_COUNT_SQL);
    const count = getCrossOrgCount(result.rows);
    expect(count).toBe(0);
  }, 30_000);
});

describeOrSkip('/api/health crossOrgDemands drift healthcheck query', () => {
  let org1Id: string;
  let org2Id: string;
  let building1Id: string;
  let building2Id: string;
  let residence2Id: string;
  let demandId: string;

  afterAll(async () => {
    // Re-enable trigger in case a test left it disabled after an error.
    await db
      .execute(sql`ALTER TABLE demands ENABLE TRIGGER demands_residence_building_check`)
      .catch(() => undefined);
    if (demandId)
      await db.delete(demands).where(eq(demands.id, demandId)).catch(() => undefined);
    if (residence2Id)
      await db.delete(residences).where(eq(residences.id, residence2Id)).catch(() => undefined);
    if (building1Id)
      await db.delete(buildings).where(eq(buildings.id, building1Id)).catch(() => undefined);
    if (building2Id)
      await db.delete(buildings).where(eq(buildings.id, building2Id)).catch(() => undefined);
    if (org1Id)
      await db.delete(organizations).where(eq(organizations.id, org1Id)).catch(() => undefined);
    if (org2Id)
      await db.delete(organizations).where(eq(organizations.id, org2Id)).catch(() => undefined);
  }, 30_000);

  it('returns 0 on a clean fixture (no cross-org rows)', async () => {
    const result = await db.execute(CROSS_ORG_COUNT_SQL);
    const count = getCrossOrgCount(result.rows);
    // There must be no cross-org rows in a correctly migrated database.
    expect(count).toBe(0);
  }, 30_000);

  it('returns a non-zero count when a cross-org demand row is force-inserted', async () => {
    // Build the minimum fixture needed for the violation.
    const [org1] = await db
      .insert(organizations)
      .values({
        name: 'HC Test Org 1 – healthcheck',
        type: 'syndicate',
        address: '10 HC Ave',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H2A 2A2',
        isActive: true,
      })
      .returning();
    org1Id = org1.id;

    const [org2] = await db
      .insert(organizations)
      .values({
        name: 'HC Test Org 2 – healthcheck',
        type: 'syndicate',
        address: '20 HC Ave',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H2B 2B2',
        isActive: true,
      })
      .returning();
    org2Id = org2.id;

    const [building1] = await db
      .insert(buildings)
      .values({
        name: 'HC Building 1',
        address: '10 Building Rd',
        city: 'Montreal',
        postalCode: 'H2A 2A2',
        organizationId: org1Id,
        totalUnits: 2,
        totalFloors: 1,
        buildingType: 'apartment',
        isActive: true,
      })
      .returning();
    building1Id = building1.id;

    const [building2] = await db
      .insert(buildings)
      .values({
        name: 'HC Building 2',
        address: '20 Building Rd',
        city: 'Montreal',
        postalCode: 'H2B 2B2',
        organizationId: org2Id,
        totalUnits: 2,
        totalFloors: 1,
        buildingType: 'apartment',
        isActive: true,
      })
      .returning();
    building2Id = building2.id;

    const [residence2] = await db
      .insert(residences)
      .values({
        buildingId: building2Id,
        unitNumber: 'HC-101',
        floor: 1,
        monthlyFees: '900.00',
        isActive: true,
      })
      .returning();
    residence2Id = residence2.id;

    await db.execute(
      sql`ALTER TABLE demands DISABLE TRIGGER demands_residence_building_check`,
    );
    try {
      const [demand] = await db
        .insert(demands)
        .values({
          buildingId: building1Id,
          residenceId: residence2Id,
          type: 'other',
          status: 'draft',
          description: 'HC cross-org demand for healthcheck query test',
        })
        .returning();
      demandId = demand.id;
    } finally {
      await db.execute(
        sql`ALTER TABLE demands ENABLE TRIGGER demands_residence_building_check`,
      );
    }

    const result = await db.execute(CROSS_ORG_COUNT_SQL);
    const count = getCrossOrgCount(result.rows);
    expect(count).toBeGreaterThanOrEqual(1);
  }, 30_000);
});
