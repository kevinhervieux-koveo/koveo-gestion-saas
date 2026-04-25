import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { db } from '../db';
import { organizations, buildings, residences, demands } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';
import { backfillCrossResidenceDemands } from '../scripts/backfill-cross-residence-demands-lib';

// Integration tests that write to real Postgres — skip when only a stub
// DATABASE_URL is present (e.g. during unit-test Jest runs that override
// DATABASE_URL to localhost via jest.setup.simple.ts).
const REAL_DB_AVAILABLE =
  typeof process.env.DATABASE_URL === 'string' &&
  !process.env.DATABASE_URL.includes('localhost');

const describeOrSkip = REAL_DB_AVAILABLE ? describe : describe.skip;

describeOrSkip('backfillCrossResidenceDemands (integration)', () => {
  let org1Id: string;
  let org2Id: string;
  let building1Id: string;
  let building2Id: string;
  let residence2Id: string;
  let demandId: string;

  beforeAll(async () => {
    // Create two organizations in different orgs
    const [org1] = await db
      .insert(organizations)
      .values({
        name: 'Test Org 1 – backfill-cross-res',
        type: 'syndicate',
        address: '1 Test Ave',
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
        name: 'Test Org 2 – backfill-cross-res',
        type: 'syndicate',
        address: '2 Test Ave',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1B 1B1',
        isActive: true,
      })
      .returning();
    org2Id = org2.id;

    // One building per organization
    const [building1] = await db
      .insert(buildings)
      .values({
        name: 'Building 1 – backfill-cross-res',
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
        name: 'Building 2 – backfill-cross-res',
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

    // Residence belongs to building 2 (org 2)
    const [residence2] = await db
      .insert(residences)
      .values({
        buildingId: building2Id,
        unitNumber: '101',
        floor: 1,
        monthlyFees: '1000.00',
        isActive: true,
      })
      .returning();
    residence2Id = residence2.id;

    // Cross-org demand: building_id → org 1, residence_id → org 2
    const [demand] = await db
      .insert(demands)
      .values({
        buildingId: building1Id,
        residenceId: residence2Id,
        type: 'other',
        status: 'draft',
        description: 'Cross-org test demand for backfill script',
      })
      .returning();
    demandId = demand.id;
  }, 30_000);

  afterAll(async () => {
    // Clean up in reverse dependency order; guard against partial setup
    if (demandId) await db.delete(demands).where(eq(demands.id, demandId));
    if (residence2Id) await db.delete(residences).where(eq(residences.id, residence2Id));
    if (building1Id) await db.delete(buildings).where(eq(buildings.id, building1Id));
    if (building2Id) await db.delete(buildings).where(eq(buildings.id, building2Id));
    if (org1Id) await db.delete(organizations).where(eq(organizations.id, org1Id));
    if (org2Id) await db.delete(organizations).where(eq(organizations.id, org2Id));
  }, 30_000);

  it('should NULL the residence_id on cross-org demand rows and leave building_id intact', async () => {
    const affected = await backfillCrossResidenceDemands();

    // At least 1 row must have been fixed (the one we seeded above)
    expect(affected).toBeGreaterThanOrEqual(1);

    // Fetch the demand row and verify the fix
    const [row] = await db
      .select({
        id: demands.id,
        buildingId: demands.buildingId,
        residenceId: demands.residenceId,
      })
      .from(demands)
      .where(eq(demands.id, demandId));

    expect(row).toBeDefined();
    expect(row.buildingId).toBe(building1Id);
    expect(row.residenceId).toBeNull();
  }, 30_000);

  it('post-condition query returns 0 after the backfill', async () => {
    const result = await db.execute(sql`
      SELECT count(*)::int AS remaining
      FROM demands d
      JOIN residences r ON r.id = d.residence_id
      WHERE r.building_id <> d.building_id
    `);
    const remaining = (result.rows[0] as { remaining: number }).remaining;
    expect(remaining).toBe(0);
  }, 30_000);

  it('is idempotent: re-running the backfill reports 0 affected rows', async () => {
    const secondRun = await backfillCrossResidenceDemands();
    expect(secondRun).toBe(0);
  }, 30_000);
});
