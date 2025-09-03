import { db } from '../../db';
import {
  buildings,
  residences,
  userResidences,
  users,
  userOrganizations,
  documents,
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
  buildingType?: 'apartment' | 'condo' | 'rental';
  yearBuilt?: number;
  totalUnits?: number;
  totalFloors?: number;
  parkingSpaces?: number;
  storageSpaces?: number;
  amenities?: any;
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
 * @param buildingData
 */
/**
 * CreateBuilding function.
 * @param buildingData
 * @returns Function result.
 */
export async function createBuilding(buildingData: BuildingCreateData) {
  const buildingId = crypto.randomUUID();

  const newBuilding = await db
    .insert(buildings)
    .values({
      name: buildingData.name,
      address: buildingData.address || '',
      city: buildingData.city || '',
      province: buildingData.province || 'QC',
      postalCode: buildingData.postalCode || '',
      buildingType: (buildingData.buildingType as 'apartment' | 'condo' | 'rental') || 'condo',
      yearBuilt: buildingData.yearBuilt,
      totalUnits: buildingData.totalUnits || 0,
      totalFloors: buildingData.totalFloors,
      parkingSpaces: buildingData.parkingSpaces,
      storageSpaces: buildingData.storageSpaces,
      amenities: buildingData.amenities,
      managementCompany: buildingData.managementCompany,
      organizationId: buildingData.organizationId,
      isActive: true,
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
          buildingId: newBuilding[0].id,
          unitNumber,
          floor,
          isActive: true,
        });
      }

      // Insert all residences at once
      const createdResidences = await db.insert(residences).values(residencesToCreate).returning();
    } catch (___residenceError) {
      console.error('⚠️ Error auto-generating residences:', ___residenceError);
      // Don't fail the building creation if residence generation fails
    }
  }

  return newBuilding[0];
}

/**
 * Updates a building.
 * @param buildingId
 * @param buildingData
 */
/**
 * UpdateBuilding function.
 * @param buildingId
 * @param buildingData
 * @returns Function result.
 */

/**
 * Adjusts residence count when building totalUnits changes.
 * For increases: Auto-generates residences with names like 'unit 109'
 * For decreases: Returns list of deletable residences for user selection
 */
export async function adjustResidenceCount(
  buildingId: string,
  organizationId: string,
  newTotalUnits: number,
  currentTotalUnits: number,
  totalFloors: number
): Promise<{ 
  action: 'increased' | 'decreased' | 'none',
  residencesToSelect?: { id: string, unitNumber: string, hasDocuments: boolean, hasUsers: boolean }[]
}> {
  // Get current active residence count
  const currentActiveResidences = await db
    .select({ id: residences.id, unitNumber: residences.unitNumber })
    .from(residences)
    .where(and(eq(residences.buildingId, buildingId), eq(residences.isActive, true)));

  const currentActiveCount = currentActiveResidences.length;

  if (newTotalUnits > currentActiveCount) {
    // Need to add residences - do it automatically
    await addResidencesAutomatically(buildingId, newTotalUnits - currentActiveCount, totalFloors, currentActiveResidences);
    return { action: 'increased' };
  } else if (newTotalUnits < currentActiveCount) {
    // Need to reduce residences - return list for user selection
    const deletableResidences = await getResidencesForSelection(buildingId, currentActiveCount - newTotalUnits);
    return { action: 'decreased', residencesToSelect: deletableResidences };
  }

  return { action: 'none' };
}

/**
 * Automatically adds residences when building count increases
 */
export async function addResidencesAutomatically(
  buildingId: string,
  residencesToAdd: number,
  totalFloors: number,
  existingResidences: { id: string, unitNumber: string }[]
): Promise<void> {
  const existingUnitNumbers = new Set(existingResidences.map(r => r.unitNumber));
  const unitsPerFloor = Math.ceil((existingResidences.length + residencesToAdd) / totalFloors);
  
  const residencesToCreate = [];
  let unitCounter = 1;
  let created = 0;

  // Find available unit numbers and create residences
  while (created < residencesToAdd) {
    const floor = Math.ceil(unitCounter / unitsPerFloor);
    const unitOnFloor = ((unitCounter - 1) % unitsPerFloor) + 1;
    const unitNumber = `${floor}${unitOnFloor.toString().padStart(2, '0')}`;

    if (!existingUnitNumbers.has(unitNumber)) {
      residencesToCreate.push({
        buildingId,
        unitNumber,
        floor,
        isActive: true,
      });
      existingUnitNumbers.add(unitNumber);
      created++;
    }
    unitCounter++;
  }

  if (residencesToCreate.length > 0) {
    await db.insert(residences).values(residencesToCreate);
    console.log(`✅ Auto-created ${residencesToCreate.length} residences for building ${buildingId}`);
  }
}

/**
 * Gets list of residences that can be selected for deletion
 * Returns residences with metadata about documents and users
 */
export async function getResidencesForSelection(
  buildingId: string,
  maxToSelect: number
): Promise<{ id: string, unitNumber: string, hasDocuments: boolean, hasUsers: boolean }[]> {
  const allActiveResidences = await db
    .select({ 
      id: residences.id, 
      unitNumber: residences.unitNumber,
      floor: residences.floor 
    })
    .from(residences)
    .where(and(eq(residences.buildingId, buildingId), eq(residences.isActive, true)))
    .orderBy(residences.unitNumber);

  // Check each residence for documents and user relationships
  const residenceDetails = await Promise.all(
    allActiveResidences.map(async (residence) => {
      // Check for documents
      const docs = await db
        .select({ id: documents.id })
        .from(documents)
        .where(eq(documents.residenceId, residence.id))
        .limit(1);

      // Check for active user relationships
      const userRels = await db
        .select({ id: userResidences.id })
        .from(userResidences)
        .where(and(eq(userResidences.residenceId, residence.id), eq(userResidences.isActive, true)))
        .limit(1);

      return {
        id: residence.id,
        unitNumber: residence.unitNumber,
        hasDocuments: docs.length > 0,
        hasUsers: userRels.length > 0,
      };
    })
  );

  // Prioritize empty residences first (no documents or users)
  return residenceDetails.sort((a, b) => {
    const aScore = (a.hasDocuments ? 1 : 0) + (a.hasUsers ? 1 : 0);
    const bScore = (b.hasDocuments ? 1 : 0) + (b.hasUsers ? 1 : 0);
    return aScore - bScore; // Empty residences first
  });
}

/**
 * Deletes selected residences and their related documents
 * Only admins can call this function
 */
export async function deleteSelectedResidences(
  buildingId: string,
  residenceIds: string[],
  userRole: string
): Promise<{ deletedCount: number, documentsDeleted: number }> {
  if (userRole !== 'admin') {
    throw new Error('Only admins can delete residences');
  }

  // Count documents that will be deleted
  const documentsToDelete = await db
    .select({ id: documents.id })
    .from(documents)
    .where(inArray(documents.residenceId, residenceIds));

  // Delete documents (hard delete since no isActive field)
  await db
    .delete(documents)
    .where(inArray(documents.residenceId, residenceIds));

  // Soft delete user-residence relationships
  await db
    .update(userResidences)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(inArray(userResidences.residenceId, residenceIds), eq(userResidences.isActive, true)));

  // Soft delete residences
  await db
    .update(residences)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(inArray(residences.id, residenceIds), eq(residences.buildingId, buildingId)));

  console.log(`🗑️ Deleted ${residenceIds.length} residences and ${documentsToDelete.length} documents for building ${buildingId}`);
  
  return {
    deletedCount: residenceIds.length,
    documentsDeleted: documentsToDelete.length
  };
}

export async function updateBuilding(buildingId: string, buildingData: BuildingUpdateData) {
  // Get current building to check for residence count changes
  const currentBuilding = await db
    .select({ totalUnits: buildings.totalUnits, totalFloors: buildings.totalFloors, organizationId: buildings.organizationId })
    .from(buildings)
    .where(eq(buildings.id, buildingId))
    .limit(1);

  if (currentBuilding.length === 0) {
    throw new Error('Building not found');
  }

  const updatedBuilding = await db
    .update(buildings)
    .set({
      name: buildingData.name,
      address: buildingData.address || '',
      city: buildingData.city || '',
      province: buildingData.province || 'QC',
      postalCode: buildingData.postalCode || '',
      buildingType: (buildingData.buildingType as 'apartment' | 'condo' | 'rental') || 'condo',
      yearBuilt: buildingData.yearBuilt,
      totalUnits: buildingData.totalUnits || 0,
      totalFloors: buildingData.totalFloors,
      parkingSpaces: buildingData.parkingSpaces,
      storageSpaces: buildingData.storageSpaces,
      amenities: buildingData.amenities ? JSON.stringify(buildingData.amenities) : null,
      managementCompany: buildingData.managementCompany,
      organizationId: buildingData.organizationId,
      updatedAt: new Date(),
    })
    .where(eq(buildings.id, buildingId))
    .returning();

  // Handle residence count changes if totalUnits changed
  if (buildingData.totalUnits && buildingData.totalUnits !== currentBuilding[0].totalUnits) {
    await adjustResidenceCount(
      buildingId,
      currentBuilding[0].organizationId,
      buildingData.totalUnits,
      currentBuilding[0].totalUnits,
      buildingData.totalFloors || currentBuilding[0].totalFloors || 1
    );
  }

  return updatedBuilding[0];
}

/**
 * Soft deletes a building.
 * @param buildingId
 */
/**
 * DeleteBuilding function.
 * @param buildingId
 * @returns Function result.
 */
export async function deleteBuilding(buildingId: string) {
  const deletedBuilding = await db
    .update(buildings)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(buildings.id, buildingId))
    .returning();

  return deletedBuilding[0];
}

/**
 * Performs cascade delete of a building and all related entities.
 * @param buildingId
 */
/**
 * CascadeDeleteBuilding function.
 * @param buildingId
 * @returns Function result.
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

    const residenceIds = buildingResidences.map((r) => r.id);

    if (residenceIds.length > 0) {
      // 2. Delete documents associated with building or its residences
      // Note: Document table uses boolean flags, not foreign keys
      await tx.delete(documents).where(inArray(documents.residenceId, residenceIds));

      // 3. Soft delete user-residence relationships
      await tx
        .update(userResidences)
        .set({ isActive: false, updatedAt: new Date() })
        .where(inArray(userResidences.residenceId, residenceIds));

      // 4. Find and soft delete orphaned users (users who now have no active relationships)
      const orphanedUsers = await tx
        .select({ id: users.id })
        .from(users)
        .leftJoin(
          userOrganizations,
          and(eq(users.id, userOrganizations.userId), eq(userOrganizations.isActive, true))
        )
        .leftJoin(
          userResidences,
          and(eq(users.id, userResidences.userId), eq(userResidences.isActive, true))
        )
        .where(
          and(
            eq(users.isActive, true),
            isNull(userOrganizations.userId),
            isNull(userResidences.userId)
          )
        );

      if (orphanedUsers.length > 0) {
        const orphanedUserIds = orphanedUsers.map((u) => u.id);
        await tx
          .update(users)
          .set({ isActive: false, updatedAt: new Date() })
          .where(inArray(users.id, orphanedUserIds));
      }

      // 5. Soft delete residences
      await tx
        .update(residences)
        .set({ isActive: false, updatedAt: new Date() })
        .where(inArray(residences.id, residenceIds));
    }

    // 6. Finally, soft delete the building
    await tx
      .update(buildings)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(buildings.id, buildingId));
  });

  return building[0];
}

/**
 * Checks if a building exists and is active.
 * @param buildingId
 */
/**
 * BuildingExists function.
 * @param buildingId
 * @returns Function result.
 */
export async function buildingExists(buildingId: string): Promise<boolean> {
  const result = await db
    .select({ id: buildings.id })
    .from(buildings)
    .where(and(eq(buildings.id, buildingId), eq(buildings.isActive, true)))
    .limit(1);

  return result.length > 0;
}
