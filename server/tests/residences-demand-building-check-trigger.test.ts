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
 * 0011_residences_demand_building_check.
 *
 * Verifies that the BEFORE UPDATE trigger
 * `residences_demand_building_check` rejects any update to
 * `residences.building_id` that would orphan an existing demand row
 * (i.e. leave a demand whose `residence_id` points at this residence
 * but whose `building_id` no longer matches the residence's new
 * building). This is the residence-side counterpart of the
 * demand-side trigger covered by
 * `server/tests/demands-residence-building-check-trigger.test.ts`.
 */

const REAL_DB_AVAILABLE =
  typeof process.env.DATABASE_URL === 'string' &&
  !process.env.DATABASE_URL.includes('localhost');

const describeOrSkip = REAL_DB_AVAILABLE ? describe : describe.skip;

describeOrSkip('residences_demand_building_check (DB trigger)', () => {
  let org1Id: string;
  let org2Id: string;
  let building1Id: string;
  let building2Id: string;
  let building1bId: string; // Second building in org1 (same-org move)
  let residenceId: string;
  let unlinkedResidenceId: string;
  const insertedDemandIds: string[] = [];

  beforeAll(async () => {
    const [org1] = await db
      .insert(organizations)
      .values({
        name: 'Trigger Test Org 1 – residences cross-org',
        type: 'syndicate',
        address: '11 Trigger Ave',
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
        name: 'Trigger Test Org 2 – residences cross-org',
        type: 'syndicate',
        address: '21 Trigger Ave',
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
        name: 'Residence-Trigger Building 1',
        address: '11 Building Way',
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
        name: 'Residence-Trigger Building 1B (same org)',
        address: '11B Building Way',
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
        name: 'Residence-Trigger Building 2',
        address: '21 Building Way',
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

    const [residence] = await db
      .insert(residences)
      .values({
        buildingId: building1Id,
        unitNumber: 'RT-101',
        floor: 1,
        monthlyFees: '1000.00',
        isActive: true,
      })
      .returning();
    residenceId = residence.id;

    const [unlinked] = await db
      .insert(residences)
      .values({
        buildingId: building1Id,
        unitNumber: 'RT-102',
        floor: 1,
        monthlyFees: '1000.00',
        isActive: true,
      })
      .returning();
    unlinkedResidenceId = unlinked.id;
  }, 30_000);

  afterAll(async () => {
    for (const id of insertedDemandIds) {
      await db.delete(demands).where(eq(demands.id, id)).catch(() => undefined);
    }
    if (residenceId) await db.delete(residences).where(eq(residences.id, residenceId)).catch(() => undefined);
    if (unlinkedResidenceId) await db.delete(residences).where(eq(residences.id, unlinkedResidenceId)).catch(() => undefined);
    if (building1Id) await db.delete(buildings).where(eq(buildings.id, building1Id)).catch(() => undefined);
    if (building1bId) await db.delete(buildings).where(eq(buildings.id, building1bId)).catch(() => undefined);
    if (building2Id) await db.delete(buildings).where(eq(buildings.id, building2Id)).catch(() => undefined);
    if (org1Id) await db.delete(organizations).where(eq(organizations.id, org1Id)).catch(() => undefined);
    if (org2Id) await db.delete(organizations).where(eq(organizations.id, org2Id)).catch(() => undefined);
  }, 30_000);

  it('allows updates that do not change building_id', async () => {
    // No-op building_id updates and other column updates must pass even
    // while a same-building demand exists.
    const [demand] = await db
      .insert(demands)
      .values({
        buildingId: building1Id,
        residenceId,
        type: 'other',
        status: 'draft',
        description: 'Same-building demand (allows no-op residence update)',
      })
      .returning();
    insertedDemandIds.push(demand.id);

    const [after] = await db
      .update(residences)
      .set({ buildingId: building1Id, unitNumber: 'RT-101' })
      .where(eq(residences.id, residenceId))
      .returning();
    expect(after.buildingId).toBe(building1Id);
  }, 30_000);

  it('allows moving a residence with no linked demands', async () => {
    const [after] = await db
      .update(residences)
      .set({ buildingId: building2Id })
      .where(eq(residences.id, unlinkedResidenceId))
      .returning();
    expect(after.buildingId).toBe(building2Id);

    // Restore so afterAll cleanup paths stay simple (residence still
    // belongs to a building we will delete).
    await db
      .update(residences)
      .set({ buildingId: building1Id })
      .where(eq(residences.id, unlinkedResidenceId));
  }, 30_000);

  it('rejects UPDATE that changes building_id to a foreign-org building when a demand still links here', async () => {
    // Linked demand from the prior test still references `residenceId`
    // with `building_id = building1Id`. Moving the residence to
    // building2 (a foreign org) would make that demand cross-org.
    await expect(
      db
        .update(residences)
        .set({ buildingId: building2Id })
        .where(eq(residences.id, residenceId)),
    ).rejects.toThrow(/Cross-organisation demand link rejected/i);

    // Residence row must be unchanged after the rejected update.
    const [after] = await db
      .select({ buildingId: residences.buildingId })
      .from(residences)
      .where(eq(residences.id, residenceId));
    expect(after.buildingId).toBe(building1Id);
  }, 30_000);

  it('rejects same-org moves too — invariant is per-building, not per-org', async () => {
    // building1bId is in the SAME organisation as building1Id, but the
    // invariant being protected is residence.building_id == demand.building_id,
    // so even an intra-org move must be blocked while a demand is still
    // linked with the old building_id.
    await expect(
      db
        .update(residences)
        .set({ buildingId: building1bId })
        .where(eq(residences.id, residenceId)),
    ).rejects.toThrow(/Cross-organisation demand link rejected/i);
  }, 30_000);

  it('allows the move once the linked demand is re-targeted (residence_id NULLed)', async () => {
    // NULLing residence_id on every demand for this residence removes
    // the cross-org risk; the trigger should then allow the move.
    for (const id of insertedDemandIds) {
      await db
        .update(demands)
        .set({ residenceId: null })
        .where(eq(demands.id, id));
    }

    const [after] = await db
      .update(residences)
      .set({ buildingId: building2Id })
      .where(eq(residences.id, residenceId))
      .returning();
    expect(after.buildingId).toBe(building2Id);

    // Restore so afterAll cleanup paths stay simple.
    await db
      .update(residences)
      .set({ buildingId: building1Id })
      .where(eq(residences.id, residenceId));
  }, 30_000);

  it('reports check_violation (SQLSTATE 23514) on rejection', async () => {
    // Re-link a demand to this residence so the move is again unsafe.
    const [demand] = await db
      .insert(demands)
      .values({
        buildingId: building1Id,
        residenceId,
        type: 'other',
        status: 'draft',
        description: 'SQLSTATE check (residence-side trigger)',
      })
      .returning();
    insertedDemandIds.push(demand.id);

    try {
      await db
        .update(residences)
        .set({ buildingId: building2Id })
        .where(eq(residences.id, residenceId));
      throw new Error('Expected the residence update to fail');
    } catch (e: unknown) {
      // node-postgres / Neon serverless surfaces SQLSTATE on `code`.
      // Accept either the explicit code or the descriptive message so
      // this test is resilient to driver wrapping (`cause.code` on the
      // Neon adapter).
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
        code === '23514' || /Cross-organisation demand link rejected/i.test(msg),
      ).toBe(true);
    }
  }, 30_000);
});
