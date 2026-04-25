import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { db } from '../db';
import {
  organizations,
  buildings,
  residences,
  demands,
} from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Database-level guard test for migration 0010_demands_residence_building_check.
 *
 * Verifies that the BEFORE INSERT/UPDATE trigger
 * `demands_residence_building_check` rejects any demand row whose
 * `residence_id` points at a residence in a different building than the
 * demand's own `building_id`. This is the production safety net that
 * survives even if the API-layer Q8 validation is bypassed.
 */

const REAL_DB_AVAILABLE =
  typeof process.env.DATABASE_URL === 'string' &&
  !process.env.DATABASE_URL.includes('localhost');

const describeOrSkip = REAL_DB_AVAILABLE ? describe : describe.skip;

describeOrSkip('demands_residence_building_check (DB trigger)', () => {
  let org1Id: string;
  let org2Id: string;
  let building1Id: string;
  let building2Id: string;
  let residence1Id: string;
  let residence2Id: string;
  const insertedDemandIds: string[] = [];

  beforeAll(async () => {
    const [org1] = await db
      .insert(organizations)
      .values({
        name: 'Trigger Test Org 1 – demands cross-org',
        type: 'syndicate',
        address: '10 Trigger Ave',
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
        name: 'Trigger Test Org 2 – demands cross-org',
        type: 'syndicate',
        address: '20 Trigger Ave',
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
        name: 'Trigger Building 1',
        address: '10 Building Way',
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

    const [building2] = await db
      .insert(buildings)
      .values({
        name: 'Trigger Building 2',
        address: '20 Building Way',
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
        unitNumber: 'T-101',
        floor: 1,
        monthlyFees: '1000.00',
        isActive: true,
      })
      .returning();
    residence1Id = residence1.id;

    const [residence2] = await db
      .insert(residences)
      .values({
        buildingId: building2Id,
        unitNumber: 'T-201',
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
    if (residence1Id) await db.delete(residences).where(eq(residences.id, residence1Id));
    if (residence2Id) await db.delete(residences).where(eq(residences.id, residence2Id));
    if (building1Id) await db.delete(buildings).where(eq(buildings.id, building1Id));
    if (building2Id) await db.delete(buildings).where(eq(buildings.id, building2Id));
    if (org1Id) await db.delete(organizations).where(eq(organizations.id, org1Id));
    if (org2Id) await db.delete(organizations).where(eq(organizations.id, org2Id));
  }, 30_000);

  it('allows inserts where residence.building_id matches demand.building_id', async () => {
    const [row] = await db
      .insert(demands)
      .values({
        buildingId: building1Id,
        residenceId: residence1Id,
        type: 'other',
        status: 'draft',
        description: 'Same-building demand should be allowed',
      })
      .returning();
    insertedDemandIds.push(row.id);
    expect(row.residenceId).toBe(residence1Id);
    expect(row.buildingId).toBe(building1Id);
  }, 30_000);

  it('allows inserts where residence_id is NULL (building-only demand)', async () => {
    const [row] = await db
      .insert(demands)
      .values({
        buildingId: building1Id,
        residenceId: null,
        type: 'other',
        status: 'draft',
        description: 'Building-only demand should be allowed',
      })
      .returning();
    insertedDemandIds.push(row.id);
    expect(row.residenceId).toBeNull();
  }, 30_000);

  it('rejects INSERT where residence belongs to a different building', async () => {
    await expect(
      db.insert(demands).values({
        buildingId: building1Id,
        residenceId: residence2Id, // residence2 belongs to building2 (org2)
        type: 'other',
        status: 'draft',
        description: 'Cross-org insert must be blocked by trigger',
      }),
    ).rejects.toThrow(/Cross-organisation demand rejected/i);
  }, 30_000);

  it('rejects UPDATE that changes residence_id to a foreign-building residence', async () => {
    const [row] = await db
      .insert(demands)
      .values({
        buildingId: building1Id,
        residenceId: residence1Id,
        type: 'other',
        status: 'draft',
        description: 'Will attempt to be updated to a cross-org residence',
      })
      .returning();
    insertedDemandIds.push(row.id);

    await expect(
      db
        .update(demands)
        .set({ residenceId: residence2Id })
        .where(eq(demands.id, row.id)),
    ).rejects.toThrow(/Cross-organisation demand rejected/i);

    // Confirm row is unchanged
    const [after] = await db
      .select({ residenceId: demands.residenceId })
      .from(demands)
      .where(eq(demands.id, row.id));
    expect(after.residenceId).toBe(residence1Id);
  }, 30_000);

  it('rejects UPDATE that changes building_id away from the residence building', async () => {
    const [row] = await db
      .insert(demands)
      .values({
        buildingId: building1Id,
        residenceId: residence1Id,
        type: 'other',
        status: 'draft',
        description: 'Will attempt to be updated to a cross-org building',
      })
      .returning();
    insertedDemandIds.push(row.id);

    await expect(
      db
        .update(demands)
        .set({ buildingId: building2Id })
        .where(eq(demands.id, row.id)),
    ).rejects.toThrow(/Cross-organisation demand rejected/i);
  }, 30_000);

  it('reports check_violation (SQLSTATE 23514) on rejection', async () => {
    try {
      await db.insert(demands).values({
        buildingId: building1Id,
        residenceId: residence2Id,
        type: 'other',
        status: 'draft',
        description: 'SQLSTATE check',
      });
      throw new Error('Expected the insert to fail');
    } catch (e: unknown) {
      // node-postgres / Neon serverless surfaces SQLSTATE on `code`. Accept
      // either the explicit code or the descriptive message so this test is
      // resilient to driver wrapping (`cause.code` on the Neon adapter).
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
      expect(code === '23514' || /Cross-organisation demand rejected/i.test(msg)).toBe(
        true,
      );
    }
  }, 30_000);
});
