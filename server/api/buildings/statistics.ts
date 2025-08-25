import { db } from '../../db';
import { buildings, residences } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Detailed building statistics.
 */
export interface DetailedBuildingStatistics {
  totalUnits: number;
  occupiedUnits: number;
  occupancyRate: number;
  vacantUnits: number;
}

/**
 * Building with statistics.
 */
export interface BuildingWithStatistics {
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
  amenities?: string;
  managementCompany?: string;
  organizationId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  organizationName?: string;
  organizationType?: string;
  accessType?: string;
  statistics: DetailedBuildingStatistics;
}

/**
 * Adds statistics to a single building.
 * @param building
 */
/**
 * AddStatisticsToBuilding function.
 * @param building
 * @returns Function result.
 */
export async function addStatisticsToBuilding(building: unknown): Promise<BuildingWithStatistics> {
  // Get residence count
  const residenceCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(residences)
    .where(and(eq(residences.buildingId, building.id), eq(residences.isActive, true)));

  // Calculate occupancy rate
  const occupiedUnits = residenceCount[0]?.count || 0;
  const occupancyRate =
    building.totalUnits > 0 ? Math.round((occupiedUnits / building.totalUnits) * 100) : 0;

  return {
    ...building,
    statistics: {
      totalUnits: building.totalUnits,
      occupiedUnits,
      occupancyRate,
      vacantUnits: building.totalUnits - occupiedUnits,
    },
  };
}

/**
 * Adds statistics to multiple buildings.
 * @param buildings
 */
/**
 * AddStatisticsToBuildings function.
 * @param buildings
 * @returns Function result.
 */
export async function addStatisticsToBuildings(
  buildings: unknown[]
): Promise<BuildingWithStatistics[]> {
  return await Promise.all(buildings.map((building) => addStatisticsToBuilding(building)));
}

/**
 * Gets aggregated statistics for multiple buildings.
 * @param buildingIds
 */
/**
 * GetAggregatedStatistics function.
 * @param buildingIds
 * @returns Function result.
 */
export async function getAggregatedStatistics(buildingIds: string[]) {
  if (buildingIds.length === 0) {
    return {
      totalBuildings: 0,
      totalUnits: 0,
      totalOccupiedUnits: 0,
      averageOccupancyRate: 0,
    };
  }

  // Get building totals
  const buildingTotals = await db
    .select({
      totalUnits: sql<number>`sum(${buildings.totalUnits})::int`,
      buildingCount: sql<number>`count(*)::int`,
    })
    .from(buildings)
    .where(and(eq(buildings.isActive, true), sql`${buildings.id} = ANY(${buildingIds})`));

  // Get total occupied units across all buildings
  const occupiedTotals = await db
    .select({
      totalOccupied: sql<number>`count(*)::int`,
    })
    .from(residences)
    .where(and(eq(residences.isActive, true), sql`${residences.buildingId} = ANY(${buildingIds})`));

  const totalUnits = buildingTotals[0]?.totalUnits || 0;
  const totalOccupiedUnits = occupiedTotals[0]?.totalOccupied || 0;
  const averageOccupancyRate =
    totalUnits > 0 ? Math.round((totalOccupiedUnits / totalUnits) * 100) : 0;

  return {
    totalBuildings: buildingTotals[0]?.buildingCount || 0,
    totalUnits,
    totalOccupiedUnits,
    averageOccupancyRate,
  };
}
