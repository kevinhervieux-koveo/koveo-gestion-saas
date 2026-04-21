import { eq, and, inArray } from 'drizzle-orm';
import { buildings, organizations, residences, userResidences } from '@shared/schema';
import { db } from '../../db';

const BUILDING_LIST_COLUMNS = {
  id: buildings.id,
  name: buildings.name,
  address: buildings.address,
  city: buildings.city,
  province: buildings.province,
  postalCode: buildings.postalCode,
  buildingType: buildings.buildingType,
  constructionDate: buildings.constructionDate,
  totalUnits: buildings.totalUnits,
  totalFloors: buildings.totalFloors,
  parkingSpaces: buildings.parkingSpaces,
  storageSpaces: buildings.storageSpaces,
  organizationId: buildings.organizationId,
  organizationName: organizations.name,
  isActive: buildings.isActive,
  createdAt: buildings.createdAt,
} as const;

export async function getAllBuildings() {
  return db
    .select(BUILDING_LIST_COLUMNS)
    .from(buildings)
    .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
    .where(eq(buildings.isActive, true))
    .orderBy(organizations.name, buildings.name);
}

export async function getBuildingsByOrganizationIds(orgIds: string[]) {
  if (orgIds.length === 0) return [];
  return db
    .select(BUILDING_LIST_COLUMNS)
    .from(buildings)
    .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
    .where(and(eq(buildings.isActive, true), inArray(buildings.organizationId, orgIds)))
    .orderBy(organizations.name, buildings.name);
}

export async function getBuildingsByIds(buildingIds: string[]) {
  if (buildingIds.length === 0) return [];
  return db
    .select(BUILDING_LIST_COLUMNS)
    .from(buildings)
    .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
    .where(and(eq(buildings.isActive, true), inArray(buildings.id, buildingIds)))
    .orderBy(organizations.name, buildings.name);
}

export async function getBuildingIdsForResident(userId: string): Promise<string[]> {
  const userResidencesList = await db
    .select({ buildingId: residences.buildingId })
    .from(userResidences)
    .innerJoin(residences, eq(userResidences.residenceId, residences.id))
    .where(and(eq(userResidences.userId, userId), eq(userResidences.isActive, true)));

  return [...new Set(userResidencesList.map(ur => ur.buildingId))];
}
