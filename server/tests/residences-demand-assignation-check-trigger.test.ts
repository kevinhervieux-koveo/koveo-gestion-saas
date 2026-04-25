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
 * 0013_residences_demand_assignation_check.
 *
 * Verifies that the BEFORE UPDATE trigger
 * `residences_demand_assignation_check` rejects any update to
 * `residences.building_id` that would orphan an existing demand
 * row linked via `assignation_residence_id` (i.e. leave a demand
 * whose `assignation_residence_id` points at this residence but
 * whose `assignation_building_id` no longer matches the
 * residence's new building). Mirrors
 * `residences-demand-building-check-trigger.test.ts` but exercises
 * the assignation pair.
 */

const REAL_DB_AVAILABLE =
  typeof process.env.DATABASE_URL === 'string' &&
  !process.env.DATABASE_URL.includes('localhost');

const describeOrSkip = REAL_DB_AVAILABLE ? describe : describe.skip;

describeOrSkip('residences_demand_assignation_check (DB trigger)', () => {
  let org1Id: string;
  let org2Id: string;
  let building1Id: string; // origin building (used as demands.building_id)
  let building1bId: string; // assignation target inside org1
  let building1cId: string; // another org1 building (intra-org move target)
  let building2Id: string; // org2 building
  let assignationResidenceId: string; // residence in building1b, assigned to via assignation
  let unlinkedResidenceId: string;
  const insertedDemandIds: string[] = [];

  beforeAll(async () => {
    const [org1] = await db
      .insert(organizations)
      .values({
        name: 'Trigger Test Org 1 – residences assignation cross-org',
        type: 'syndicate',
        address: '13 Trigger Ave',
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
        name: 'Trigger Test Org 2 – residences assignation cross-org',
        type: 'syndicate',
        address: '23 Trigger Ave',
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
        name: 'Residence-Assignation Building 1',
        address: '13 Building Way',
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
        name: 'Residence-Assignation Building 1B (assignation target)',
        address: '13B Building Way',
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

    const [building1c] = await db
      .insert(buildings)
      .values({
        name: 'Residence-Assignation Building 1C (intra-org move target)',
        address: '13C Building Way',
        city: 'Montreal',
        postalCode: 'H2A 2A2',
        organizationId: org1Id,
        totalUnits: 4,
        totalFloors: 1,
        buildingType: 'apartment',
        isActive: true,
      })
      .returning();
    building1cId = building1c.id;

    const [building2] = await db
      .insert(buildings)
      .values({
        name: 'Residence-Assignation Building 2',
        address: '23 Building Way',
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
        buildingId: building1bId,
        unitNumber: 'RA-101',
        floor: 1,
        monthlyFees: '1000.00',
        isActive: true,
      })
      .returning();
    assignationResidenceId = residence.id;

    const [unlinked] = await db
      .insert(residences)
      .values({
        buildingId: building1bId,
        unitNumber: 'RA-102',
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
    if (assignationResidenceId)
      await db.delete(residences).where(eq(residences.id, assignationResidenceId)).catch(() => undefined);
    if (unlinkedResidenceId)
      await db.delete(residences).where(eq(residences.id, unlinkedResidenceId)).catch(() => undefined);
    if (building1Id) await db.delete(buildings).where(eq(buildings.id, building1Id)).catch(() => undefined);
    if (building1bId) await db.delete(buildings).where(eq(buildings.id, building1bId)).catch(() => undefined);
    if (building1cId) await db.delete(buildings).where(eq(buildings.id, building1cId)).catch(() => undefined);
    if (building2Id) await db.delete(buildings).where(eq(buildings.id, building2Id)).catch(() => undefined);
    if (org1Id) await db.delete(organizations).where(eq(organizations.id, org1Id)).catch(() => undefined);
    if (org2Id) await db.delete(organizations).where(eq(organizations.id, org2Id)).catch(() => undefined);
  }, 30_000);

  it('allows updates that do not change building_id', async () => {
    // Create a same-building assignation demand: building1b is the
    // assignation target, residence belongs to building1b.
    const [demand] = await db
      .insert(demands)
      .values({
        buildingId: building1Id,
        assignationBuildingId: building1bId,
        assignationResidenceId,
        type: 'other',
        status: 'draft',
        description: 'Consistent assignation (no-op residence update should pass)',
      })
      .returning();
    insertedDemandIds.push(demand.id);

    const [after] = await db
      .update(residences)
      .set({ buildingId: building1bId, unitNumber: 'RA-101' })
      .where(eq(residences.id, assignationResidenceId))
      .returning();
    expect(after.buildingId).toBe(building1bId);
  }, 30_000);

  it('allows moving a residence with no demands linked via assignation', async () => {
    const [after] = await db
      .update(residences)
      .set({ buildingId: building1cId })
      .where(eq(residences.id, unlinkedResidenceId))
      .returning();
    expect(after.buildingId).toBe(building1cId);

    // Restore for cleanup simplicity
    await db
      .update(residences)
      .set({ buildingId: building1bId })
      .where(eq(residences.id, unlinkedResidenceId));
  }, 30_000);

  it('rejects UPDATE that changes building_id while a demand is linked via assignation', async () => {
    // Linked demand from prior test still references
    // assignationResidenceId with assignation_building_id = building1b.
    // Moving the residence to building2 (a foreign org) makes that
    // demand's assignation cross-org.
    await expect(
      db
        .update(residences)
        .set({ buildingId: building2Id })
        .where(eq(residences.id, assignationResidenceId)),
    ).rejects.toThrow(/Cross-organisation demand assignation link rejected/i);

    const [after] = await db
      .select({ buildingId: residences.buildingId })
      .from(residences)
      .where(eq(residences.id, assignationResidenceId));
    expect(after.buildingId).toBe(building1bId);
  }, 30_000);

  it('rejects moves when a demand links via assignation_residence_id with NULL assignation_building_id and the new building is in another org', async () => {
    // Seed a *new* residence in building1b (org1) and a building-only
    // demand whose assignation_residence_id points at it but whose
    // assignation_building_id is NULL. The 0012 trigger accepted this
    // because the inferred assignation building (building1b → org1)
    // matched the demand's building1Id (org1). Moving the residence
    // to building2 (org2) would silently introduce a cross-org link
    // that 0012 cannot catch on UPDATE OF residences.building_id, so
    // the residence-side trigger must reject it.
    const [movableResidence] = await db
      .insert(residences)
      .values({
        buildingId: building1bId,
        unitNumber: 'RA-NULL-AB',
        floor: 1,
        monthlyFees: '1000.00',
        isActive: true,
      })
      .returning();

    let demandId: string | undefined;
    try {
      const [demand] = await db
        .insert(demands)
        .values({
          buildingId: building1Id,
          assignationResidenceId: movableResidence.id,
          // assignation_building_id intentionally left NULL
          type: 'other',
          status: 'draft',
          description: 'Implicit cross-org via residence move',
        })
        .returning();
      demandId = demand.id;

      await expect(
        db
          .update(residences)
          .set({ buildingId: building2Id })
          .where(eq(residences.id, movableResidence.id)),
      ).rejects.toThrow(/Cross-organisation demand assignation link rejected/i);

      // Same-org move (building1c is in org1, like building1b) must
      // still be allowed under Case B because no org boundary is
      // crossed — the inferred assignation building stays in org1.
      const [after] = await db
        .update(residences)
        .set({ buildingId: building1cId })
        .where(eq(residences.id, movableResidence.id))
        .returning();
      expect(after.buildingId).toBe(building1cId);
    } finally {
      // Tear down in FK-safe order: drop the demand row (which holds
      // the no-action FK to residences via assignation_residence_id)
      // before deleting the residence itself.
      if (demandId)
        await db.delete(demands).where(eq(demands.id, demandId)).catch(() => undefined);
      await db.delete(residences).where(eq(residences.id, movableResidence.id)).catch(() => undefined);
    }
  }, 30_000);

  it('rejects same-org moves too when a demand has an explicit assignation_building_id (Case A)', async () => {
    // building1c is in the SAME organisation as building1b, but the
    // invariant being protected is residence.building_id ==
    // demand.assignation_building_id, so even an intra-org move
    // must be blocked while a demand still references the old
    // assignation_building_id.
    await expect(
      db
        .update(residences)
        .set({ buildingId: building1cId })
        .where(eq(residences.id, assignationResidenceId)),
    ).rejects.toThrow(/Cross-organisation demand assignation link rejected/i);
  }, 30_000);

  it('allows the move once the linked demand is re-targeted (assignation_residence_id NULLed)', async () => {
    for (const id of insertedDemandIds) {
      await db
        .update(demands)
        .set({ assignationResidenceId: null })
        .where(eq(demands.id, id));
    }

    const [after] = await db
      .update(residences)
      .set({ buildingId: building1cId })
      .where(eq(residences.id, assignationResidenceId))
      .returning();
    expect(after.buildingId).toBe(building1cId);

    // Restore so afterAll cleanup paths stay simple.
    await db
      .update(residences)
      .set({ buildingId: building1bId })
      .where(eq(residences.id, assignationResidenceId));
  }, 30_000);

  it('reports check_violation (SQLSTATE 23514) on rejection', async () => {
    // Re-link a demand to this residence so the move is again unsafe.
    const [demand] = await db
      .insert(demands)
      .values({
        buildingId: building1Id,
        assignationBuildingId: building1bId,
        assignationResidenceId,
        type: 'other',
        status: 'draft',
        description: 'SQLSTATE check (residence-side assignation trigger)',
      })
      .returning();
    insertedDemandIds.push(demand.id);

    try {
      await db
        .update(residences)
        .set({ buildingId: building2Id })
        .where(eq(residences.id, assignationResidenceId));
      throw new Error('Expected the residence update to fail');
    } catch (e: unknown) {
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
        code === '23514' || /Cross-organisation demand assignation link rejected/i.test(msg),
      ).toBe(true);
    }
  }, 30_000);
});
