import { db } from '../../db';
import { 
  buildings, 
  residences, 
  userResidences,
  users,
  userOrganizations,
  documents
} from '@shared/schema';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Building creation data.
 */
export interface BuildingCreateData {
  name: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  buildingType?: string;
  yearBuilt?: number;
  totalUnits?: number;
  totalFloors?: number;
  parkingSpaces?: number;
  storageSpaces?: number;
  amenities?: string[];
  managementCompany?: string;
  organizationId: string;
}

/**
 * Building update data.
 */
export interface BuildingUpdateData extends Partial<BuildingCreateData> {
  name: string;
  organizationId: string;
}

/**
 * Creates a new building with auto-generated residences.
 */
export async function createBuilding(buildingData: BuildingCreateData) {
  const buildingId = crypto.randomUUID();
  
  const newBuilding = await db
    .insert(buildings)
    .values({
      id: buildingId,
      name: buildingData.name,
      address: buildingData.address || '',
      city: buildingData.city || '',
      province: buildingData.province || 'QC',
      postalCode: buildingData.postalCode || '',
      buildingType: buildingData.buildingType || 'condo',
      yearBuilt: buildingData.yearBuilt,
      totalUnits: buildingData.totalUnits || 0,
      totalFloors: buildingData.totalFloors,
      parkingSpaces: buildingData.parkingSpaces,
      storageSpaces: buildingData.storageSpaces,
      amenities: buildingData.amenities ? JSON.stringify(buildingData.amenities) : null,
      managementCompany: buildingData.managementCompany,
      organizationId: buildingData.organizationId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .returning();

  // Auto-generate residences if totalUnits is specified and <= 300
  if (buildingData.totalUnits && buildingData.totalUnits > 0 && buildingData.totalUnits <= 300) {
    try {
      const totalUnits = buildingData.totalUnits;
      const totalFloors = buildingData.totalFloors || 1;
      const unitsPerFloor = Math.ceil(totalUnits / totalFloors);

      const residencesToCreate = [];
      for (let unit = 1; unit <= totalUnits; unit++) {
        const floor = Math.ceil(unit / unitsPerFloor);
        const unitOnFloor = ((unit - 1) % unitsPerFloor) + 1;
        const unitNumber = `${floor}${unitOnFloor.toString().padStart(2, '0')}`;

        residencesToCreate.push({
          buildingId: buildingId,
          unitNumber,
          floor,
          isActive: true
        });
      }

      // Insert all residences at once
      const createdResidences = await db
        .insert(residences)
        .values(residencesToCreate)
        .returning();

      console.log(`✅ Auto-generated ${createdResidences.length} residences for building ${buildingId}`);
    } catch (residenceError) {
      console.error('⚠️ Error auto-generating residences:', residenceError);
      // Don't fail the building creation if residence generation fails
    }
  }

  return newBuilding[0];
}

/**
 * Updates a building.
 */
export async function updateBuilding(buildingId: string, buildingData: BuildingUpdateData) {
  const updatedBuilding = await db
    .update(buildings)
    .set({
      name: buildingData.name,
      address: buildingData.address || '',
      city: buildingData.city || '',
      province: buildingData.province || 'QC',
      postalCode: buildingData.postalCode || '',
      buildingType: buildingData.buildingType || 'condo',
      yearBuilt: buildingData.yearBuilt,
      totalUnits: buildingData.totalUnits || 0,
      totalFloors: buildingData.totalFloors,
      parkingSpaces: buildingData.parkingSpaces,
      storageSpaces: buildingData.storageSpaces,
      amenities: buildingData.amenities ? JSON.stringify(buildingData.amenities) : null,
      managementCompany: buildingData.managementCompany,
      organizationId: buildingData.organizationId,
      updatedAt: new Date()
    })
    .where(eq(buildings.id, buildingId))
    .returning();

  return updatedBuilding[0];
}

/**
 * Soft deletes a building.
 */
export async function deleteBuilding(buildingId: string) {
  const deletedBuilding = await db
    .update(buildings)
    .set({ 
      isActive: false, 
      updatedAt: new Date() 
    })
    .where(eq(buildings.id, buildingId))
    .returning();

  return deletedBuilding[0];
}

/**
 * Performs cascade delete of a building and all related entities.
 */
export async function cascadeDeleteBuilding(buildingId: string) {
  // Check if building exists
  const building = await db
    .select({ id: buildings.id, name: buildings.name })
    .from(buildings)
    .where(and(eq(buildings.id, buildingId), eq(buildings.isActive, true)))
    .limit(1);

  if (building.length === 0) {
    throw new Error('Building not found');
  }

  // Start transaction for cascading delete
  await db.transaction(async (tx) => {
    // 1. Get all residences in this building
    const buildingResidences = await tx
      .select({ id: residences.id })
      .from(residences)
      .where(and(eq(residences.buildingId, buildingId), eq(residences.isActive, true)));

    const residenceIds = buildingResidences.map(r => r.id);

    if (residenceIds.length > 0) {
      // 2. Delete documents associated with building or its residences
      // Note: Using proper field names based on schema
      await tx.delete(documents)
        .where(inArray(documents.residence, residenceIds));

      // 3. Soft delete user-residence relationships
      await tx.update(userResidences)
        .set({ isActive: false, updatedAt: new Date() })
        .where(inArray(userResidences.residenceId, residenceIds));

      // 4. Find and soft delete orphaned users (users who now have no active relationships)
      const orphanedUsers = await tx
        .select({ id: users.id })
        .from(users)
        .leftJoin(userOrganizations, and(
          eq(users.id, userOrganizations.userId),
          eq(userOrganizations.isActive, true)
        ))
        .leftJoin(userResidences, and(
          eq(users.id, userResidences.userId),
          eq(userResidences.isActive, true)
        ))
        .where(and(
          eq(users.isActive, true),
          isNull(userOrganizations.userId),
          isNull(userResidences.userId)
        ));

      if (orphanedUsers.length > 0) {
        const orphanedUserIds = orphanedUsers.map(u => u.id);
        await tx.update(users)
          .set({ isActive: false, updatedAt: new Date() })
          .where(inArray(users.id, orphanedUserIds));
      }

      // 5. Soft delete residences
      await tx.update(residences)
        .set({ isActive: false, updatedAt: new Date() })
        .where(inArray(residences.id, residenceIds));
    }

    // 6. Finally, soft delete the building
    await tx.update(buildings)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(buildings.id, buildingId));
  });

  return building[0];
}

/**
 * Checks if a building exists and is active.
 */
export async function buildingExists(buildingId: string): Promise<boolean> {
  const result = await db
    .select({ id: buildings.id })
    .from(buildings)
    .where(and(eq(buildings.id, buildingId), eq(buildings.isActive, true)))
    .limit(1);

  return result.length > 0;
}