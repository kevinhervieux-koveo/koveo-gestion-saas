import { db } from '../../db';
import { 
  buildings, 
  organizations, 
  residences, 
  userResidences,
  userOrganizations,
  documents
} from '@shared/schema';
import { eq, and, inArray, sql, isNull } from 'drizzle-orm';

/**
 * Building with organization info.
 */
export interface BuildingWithOrg {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  buildingType: string;
  yearBuilt?: number;
  totalUnits: number;
  totalFloors?: number;
  parkingSpaces?: number;
  storageSpaces?: number;
  amenities?: any;
  managementCompany?: string;
  organizationId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  organizationName: string;
  organizationType: string;
  accessType?: string;
}

/**
 * Building statistics.
 */
export interface BuildingStatistics {
  totalUnits: number;
  occupiedUnits: number;
  occupancyRate: number;
  vacantUnits: number;
}

/**
 * Gets all buildings with organization information.
 */
export async function getAllBuildingsWithOrg(): Promise<BuildingWithOrg[]> {
  return await db
    .select({
      id: buildings.id,
      name: buildings.name,
      address: buildings.address,
      city: buildings.city,
      province: buildings.province,
      postalCode: buildings.postalCode,
      buildingType: buildings.buildingType,
      yearBuilt: buildings.yearBuilt,
      totalUnits: buildings.totalUnits,
      totalFloors: buildings.totalFloors,
      parkingSpaces: buildings.parkingSpaces,
      storageSpaces: buildings.storageSpaces,
      amenities: buildings.amenities,
      managementCompany: buildings.managementCompany,
      organizationId: buildings.organizationId,
      isActive: buildings.isActive,
      createdAt: buildings.createdAt,
      updatedAt: buildings.updatedAt,
      organizationName: organizations.name,
      organizationType: organizations.type
    })
    .from(buildings)
    .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
    .where(eq(buildings.isActive, true))
    .orderBy(organizations.name, buildings.name);
}

/**
 * Gets buildings by organization IDs.
 * @param organizationIds
 */
export async function getBuildingsByOrganizations(organizationIds: string[]): Promise<BuildingWithOrg[]> {
  return await db
    .select({
      id: buildings.id,
      name: buildings.name,
      address: buildings.address,
      city: buildings.city,
      province: buildings.province,
      postalCode: buildings.postalCode,
      buildingType: buildings.buildingType,
      yearBuilt: buildings.yearBuilt,
      totalUnits: buildings.totalUnits,
      totalFloors: buildings.totalFloors,
      parkingSpaces: buildings.parkingSpaces,
      storageSpaces: buildings.storageSpaces,
      amenities: buildings.amenities,
      managementCompany: buildings.managementCompany,
      organizationId: buildings.organizationId,
      isActive: buildings.isActive,
      createdAt: buildings.createdAt,
      updatedAt: buildings.updatedAt,
      organizationName: organizations.name,
      organizationType: organizations.type
    })
    .from(buildings)
    .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
    .where(
      and(
        inArray(buildings.organizationId, organizationIds),
        eq(buildings.isActive, true)
      )
    )
    .orderBy(organizations.name, buildings.name);
}

/**
 * Gets buildings by user residences.
 * @param userId
 */
export async function getBuildingsByUserResidences(userId: string): Promise<BuildingWithOrg[]> {
  return await db
    .select({
      id: buildings.id,
      name: buildings.name,
      address: buildings.address,
      city: buildings.city,
      province: buildings.province,
      postalCode: buildings.postalCode,
      buildingType: buildings.buildingType,
      yearBuilt: buildings.yearBuilt,
      totalUnits: buildings.totalUnits,
      totalFloors: buildings.totalFloors,
      parkingSpaces: buildings.parkingSpaces,
      storageSpaces: buildings.storageSpaces,
      amenities: buildings.amenities,
      managementCompany: buildings.managementCompany,
      organizationId: buildings.organizationId,
      isActive: buildings.isActive,
      createdAt: buildings.createdAt,
      updatedAt: buildings.updatedAt,
      organizationName: organizations.name,
      organizationType: organizations.type
    })
    .from(buildings)
    .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
    .innerJoin(residences, eq(buildings.id, residences.buildingId))
    .innerJoin(userResidences, eq(residences.id, userResidences.residenceId))
    .where(
      and(
        eq(userResidences.userId, userId),
        eq(userResidences.isActive, true),
        eq(buildings.isActive, true)
      )
    )
    .orderBy(organizations.name, buildings.name);
}

/**
 * Gets a specific building by ID with organization information.
 * @param buildingId
 */
export async function getBuildingById(buildingId: string): Promise<BuildingWithOrg | null> {
  const result = await db
    .select({
      id: buildings.id,
      name: buildings.name,
      address: buildings.address,
      city: buildings.city,
      province: buildings.province,
      postalCode: buildings.postalCode,
      buildingType: buildings.buildingType,
      yearBuilt: buildings.yearBuilt,
      totalUnits: buildings.totalUnits,
      totalFloors: buildings.totalFloors,
      parkingSpaces: buildings.parkingSpaces,
      storageSpaces: buildings.storageSpaces,
      amenities: buildings.amenities,
      managementCompany: buildings.managementCompany,
      organizationId: buildings.organizationId,
      isActive: buildings.isActive,
      createdAt: buildings.createdAt,
      updatedAt: buildings.updatedAt,
      organizationName: organizations.name,
      organizationType: organizations.type
    })
    .from(buildings)
    .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
    .where(
      and(
        eq(buildings.id, buildingId),
        eq(buildings.isActive, true)
      )
    )
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * Gets statistics for a building.
 * @param buildingId
 */
export async function getBuildingStatistics(buildingId: string): Promise<BuildingStatistics> {
  // Get residence count
  const residenceCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(residences)
    .where(
      and(
        eq(residences.buildingId, buildingId),
        eq(residences.isActive, true)
      )
    );

  const building = await db
    .select({ totalUnits: buildings.totalUnits })
    .from(buildings)
    .where(eq(buildings.id, buildingId))
    .limit(1);

  const totalUnits = building[0]?.totalUnits || 0;
  const occupiedUnits = residenceCount[0]?.count || 0;
  const occupancyRate = totalUnits > 0 
    ? Math.round((occupiedUnits / totalUnits) * 100) 
    : 0;

  return {
    totalUnits,
    occupiedUnits,
    occupancyRate,
    vacantUnits: totalUnits - occupiedUnits
  };
}

/**
 * Gets deletion impact analysis for a building.
 * @param buildingId
 */
export async function getBuildingDeletionImpact(buildingId: string) {
  // Get building residences
  const buildingResidences = await db
    .select({ id: residences.id })
    .from(residences)
    .where(and(eq(residences.buildingId, buildingId), eq(residences.isActive, true)));

  const residenceIds = buildingResidences.map(r => r.id);

  // Count associated documents (documents table uses boolean flags, not foreign keys)
  const documentsCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(documents)
    .where(
      residenceIds.length > 0 
        ? eq(documents.residence, true)
        : eq(documents.buildings, true)
    );

  // Count users who would become orphaned
  const orphanedUsersCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userResidences)
    .where(
      and(
        inArray(userResidences.residenceId, residenceIds),
        eq(userResidences.isActive, true)
      )
    );

  return {
    residencesCount: buildingResidences.length,
    documentsCount: documentsCount[0]?.count || 0,
    affectedUsersCount: orphanedUsersCount[0]?.count || 0
  };
}