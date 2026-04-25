import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { db } from '../db';
import {
  organizations,
  buildings,
  residences,
  demands,
} from '../../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Database-level guard test for migration
 * 0012_demands_assignation_check.
 *
 * Verifies that the BEFORE INSERT/UPDATE trigger
 * `demands_assignation_check` rejects any demand row whose
 * `assignation_residence_id` / `assignation_building_id` pair would
 * either disagree with each other or cross organisations relative
 * to the demand's own `building_id`. Mirrors
 * `demands-residence-building-check-trigger.test.ts` but exercises
 * the secondary assignation columns.
 */

const REAL_DB_AVAILABLE =
  typeof process.env.DATABASE_URL === 'string' &&
  !process.env.DATABASE_URL.includes('localhost');

const describeOrSkip = REAL_DB_AVAILABLE ? describe : describe.skip;

describeOrSkip('demands_assignation_check (DB trigger)', () => {
  let org1Id: string;
  let org2Id: string;
  let building1Id: string;
  let building1bId: string; // Same org as building1, different building
  let building2Id: string; // Different org
  let residence1Id: string;
  let residence1bId: string;
  let residence2Id: string;
  const insertedDemandIds: string[] = [];

  beforeAll(async () => {
    const [org1] = await db
      .insert(organizations)
      .values({
        name: 'Trigger Test Org 1 – demands assignation cross-org',
        type: 'syndicate',
        address: '12 Trigger Ave',
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
        name: 'Trigger Test Org 2 – demands assignation cross-org',
        type: 'syndicate',
        address: '22 Trigger Ave',
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
        name: 'Assignation-Trigger Building 1',
        address: '12 Building Way',
        city: 'Montreal',
        postalCode: 'H2A 2A2',
        organizationId: org1Id,
        totalUnits: 4,
        totalFloors: 1,
        buildingType: 'apartment',
        isActive: true,
      })
      .returning();
    building1Id = building1.id;

    const [building1b] = await db
      .insert(buildings)
      .values({
        name: 'Assignation-Trigger Building 1B (same org)',
        address: '12B Building Way',
        city: 'Montreal',
        postalCode: 'H2A 2A2',
        organizationId: org1Id,
        totalUnits: 4,
        totalFloors: 1,
        buildingType: 'apartment',
        isActive: true,
      })
      .returning();
    building1bId = building1b.id;

    const [building2] = await db
      .insert(buildings)
      .values({
        name: 'Assignation-Trigger Building 2',
        address: '22 Building Way',
        city: 'Montreal',
        postalCode: 'H2B 2B2',
        organizationId: org2Id,
        totalUnits: 4,
        totalFloors: 1,
        buildingType: 'apartment',
        isActive: true,
      })
      .returning();
    building2Id = building2.id;

    const [residence1] = await db
      .insert(residences)
      .values({
        buildingId: building1Id,
        unitNumber: 'AT-101',
        floor: 1,
        monthlyFees: '1000.00',
        isActive: true,
      })
      .returning();
    residence1Id = residence1.id;

    const [residence1b] = await db
      .insert(residences)
      .values({
        buildingId: building1bId,
        unitNumber: 'AT-1B-101',
        floor: 1,
        monthlyFees: '1000.00',
        isActive: true,
      })
      .returning();
    residence1bId = residence1b.id;

    const [residence2] = await db
      .insert(residences)
      .values({
        buildingId: building2Id,
        unitNumber: 'AT-201',
        floor: 1,
        monthlyFees: '1000.00',
        isActive: true,
      })
      .returning();
    residence2Id = residence2.id;
  }, 30_000);

  afterAll(async () => {
    for (const id of insertedDemandIds) {
      await db.delete(demands).where(eq(demands.id, id)).catch(() => undefined);
    }
    if (residence1Id) await db.delete(residences).where(eq(residences.id, residence1Id)).catch(() => undefined);
    if (residence1bId) await db.delete(residences).where(eq(residences.id, residence1bId)).catch(() => undefined);
    if (residence2Id) await db.delete(residences).where(eq(residences.id, residence2Id)).catch(() => undefined);
    if (building1Id) await db.delete(buildings).where(eq(buildings.id, building1Id)).catch(() => undefined);
    if (building1bId) await db.delete(buildings).where(eq(buildings.id, building1bId)).catch(() => undefined);
    if (building2Id) await db.delete(buildings).where(eq(buildings.id, building2Id)).catch(() => undefined);
    if (org1Id) await db.delete(organizations).where(eq(organizations.id, org1Id)).catch(() => undefined);
    if (org2Id) await db.delete(organizations).where(eq(organizations.id, org2Id)).catch(() => undefined);
  }, 30_000);

  it('allows inserts with NULL assignation pointers', async () => {
    const [row] = await db
      .insert(demands)
      .values({
        buildingId: building1Id,
        residenceId: residence1Id,
        type: 'other',
        status: 'draft',
        description: 'No assignation set',
      })
      .returning();
    insertedDemandIds.push(row.id);
    expect(row.assignationBuildingId).toBeNull();
    expect(row.assignationResidenceId).toBeNull();
  }, 30_000);

  it('allows inserts where assignation pointers are consistent and same-org', async () => {
    // Assigning to a sibling building/residence inside the same org.
    const [row] = await db
      .insert(demands)
      .values({
        buildingId: building1Id,
        residenceId: residence1Id,
        assignationBuildingId: building1bId,
        assignationResidenceId: residence1bId,
        type: 'other',
        status: 'draft',
        description: 'Same-org assignation should be allowed',
      })
      .returning();
    insertedDemandIds.push(row.id);
    expect(row.assignationBuildingId).toBe(building1bId);
    expect(row.assignationResidenceId).toBe(residence1bId);
  }, 30_000);

  it('allows inserts where only assignation_building_id is set (same org)', async () => {
    const [row] = await db
      .insert(demands)
      .values({
        buildingId: building1Id,
        residenceId: residence1Id,
        assignationBuildingId: building1bId,
        type: 'other',
        status: 'draft',
        description: 'Building-only same-org assignation',
      })
      .returning();
    insertedDemandIds.push(row.id);
    expect(row.assignationBuildingId).toBe(building1bId);
    expect(row.assignationResidenceId).toBeNull();
  }, 30_000);

  it('rejects INSERT where assignation_residence_id and assignation_building_id disagree', async () => {
    // residence1b belongs to building1b, NOT building1.
    await expect(
      db.insert(demands).values({
        buildingId: building1Id,
        residenceId: residence1Id,
        assignationBuildingId: building1Id,
        assignationResidenceId: residence1bId,
        type: 'other',
        status: 'draft',
        description: 'Mismatched assignation pair must be blocked',
      }),
    ).rejects.toThrow(/Cross-organisation demand assignation rejected/i);
  }, 30_000);

  it('rejects INSERT where assignation_building_id crosses organisations', async () => {
    await expect(
      db.insert(demands).values({
        buildingId: building1Id,
        residenceId: residence1Id,
        assignationBuildingId: building2Id, // org2
        type: 'other',
        status: 'draft',
        description: 'Cross-org assignation must be blocked',
      }),
    ).rejects.toThrow(/Cross-organisation demand assignation rejected/i);
  }, 30_000);

  it('rejects INSERT where only assignation_residence_id is set and crosses organisations', async () => {
    // residence2 belongs to building2 (org2). Even with no
    // assignation_building_id, the residence's building's
    // organisation is checked against the demand's building's org.
    await expect(
      db.insert(demands).values({
        buildingId: building1Id,
        residenceId: residence1Id,
        assignationResidenceId: residence2Id,
        type: 'other',
        status: 'draft',
        description: 'Implicit cross-org assignation must be blocked',
      }),
    ).rejects.toThrow(/Cross-organisation demand assignation rejected/i);
  }, 30_000);

  it('rejects UPDATE that sets assignation_building_id to a foreign-org building', async () => {
    const [row] = await db
      .insert(demands)
      .values({
        buildingId: building1Id,
        residenceId: residence1Id,
        type: 'other',
        status: 'draft',
        description: 'Will attempt to be updated to a cross-org assignation',
      })
      .returning();
    insertedDemandIds.push(row.id);

    await expect(
      db
        .update(demands)
        .set({ assignationBuildingId: building2Id })
        .where(eq(demands.id, row.id)),
    ).rejects.toThrow(/Cross-organisation demand assignation rejected/i);

    // Confirm row is unchanged
    const [after] = await db
      .select({ assignationBuildingId: demands.assignationBuildingId })
      .from(demands)
      .where(eq(demands.id, row.id));
    expect(after.assignationBuildingId).toBeNull();
  }, 30_000);

  it('rejects UPDATE that changes building_id away from the assignation building org', async () => {
    // Demand assigned to building1b (org1). Moving the demand's own
    // building_id to building2 (org2) makes the assignation cross-org.
    const [row] = await db
      .insert(demands)
      .values({
        buildingId: building1Id,
        residenceId: residence1Id,
        assignationBuildingId: building1bId,
        type: 'other',
        status: 'draft',
        description: 'Will attempt to flip building_id to a cross-org one',
      })
      .returning();
    insertedDemandIds.push(row.id);

    await expect(
      db
        .update(demands)
        .set({ buildingId: building2Id, residenceId: null })
        .where(eq(demands.id, row.id)),
    ).rejects.toThrow(/Cross-organisation demand assignation rejected/i);
  }, 30_000);

  it('reports check_violation (SQLSTATE 23514) on rejection', async () => {
    try {
      await db.insert(demands).values({
        buildingId: building1Id,
        residenceId: residence1Id,
        assignationBuildingId: building2Id,
        type: 'other',
        status: 'draft',
        description: 'SQLSTATE check (assignation cross-org)',
      });
      throw new Error('Expected the insert to fail');
    } catch (e: unknown) {
      // node-postgres / Neon serverless surfaces SQLSTATE on `code`.
      // Accept either the explicit code or the descriptive message
      // so this test is resilient to driver wrapping
      // (`cause.code` on the Neon adapter).
      const errObj =
        typeof e === 'object' && e !== null
          ? (e as { code?: unknown; cause?: { code?: unknown }; message?: unknown })
          : {};
      const directCode = typeof errObj.code === 'string' ? errObj.code : undefined;
      const causeCode =
        typeof errObj.cause === 'object' &&
        errObj.cause !== null &&
        typeof errObj.cause.code === 'string'
          ? errObj.cause.code
          : undefined;
      const code = directCode ?? causeCode;
      const msg = typeof errObj.message === 'string' ? errObj.message : '';
      expect(
        code === '23514' || /Cross-organisation demand assignation rejected/i.test(msg),
      ).toBe(true);
    }
  }, 30_000);
});
