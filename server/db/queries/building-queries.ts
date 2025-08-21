import { eq, and, desc, ilike, inArray, count } from 'drizzle-orm';
import { buildings, organizations, residences, budgets, maintenanceRequests } from '@shared/schema';
import { db } from '../../db';
import { scopeQuery, type UserContext } from './scope-query';

/**
 * Get all buildings accessible to the user based on their role and associations.
 * 
 * @param userContext - User context containing role and entity associations.
 * @returns Promise resolving to array of buildings the user can access.
 */
/**
 * GetBuildingsForUser function.
 * @param userContext
 * @returns Function result.
 */
export async function getBuildingsForUser(userContext: UserContext) {
  const baseQuery = db
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
      // Include organization info
      organizationName: organizations.name,
      organizationType: organizations.type,
    })
    .from(buildings)
    .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
    .where(eq(buildings.isActive, true))
    .orderBy(desc(buildings.createdAt));

  return await scopeQuery(baseQuery, userContext, 'buildings');
}

/**
 * Get a single building by ID with role-based access control.
 * 
 * @param buildingId - The building ID to retrieve.
 * @param userContext - User context for access control.
 * @returns Promise resolving to the building if accessible, undefined otherwise.
 */
/**
 * GetBuildingById function.
 * @param buildingId
 * @param userContext
 * @returns Function result.
 */
export async function getBuildingById(buildingId: string, userContext: UserContext) {
  const baseQuery = db
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
      // Include organization info
      organizationName: organizations.name,
      organizationType: organizations.type,
      organizationEmail: organizations.email,
      organizationPhone: organizations.phone,
    })
    .from(buildings)
    .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
    .where(eq(buildings.id, buildingId));

  const scopedQuery = await scopeQuery(baseQuery, userContext, 'buildings');
  const results = await scopedQuery;
  return results[0];
}

/**
 * Get buildings by organization with role-based filtering.
 * 
 * @param organizationId - Organization ID to filter by.
 * @param userContext - User context for access control.
 * @returns Promise resolving to array of buildings in the organization.
 */
/**
 * GetBuildingsByOrganization function.
 * @param organizationId
 * @param userContext
 * @returns Function result.
 */
export async function getBuildingsByOrganization(organizationId: string, userContext: UserContext) {
  const baseQuery = db
    .select({
      id: buildings.id,
      name: buildings.name,
      address: buildings.address,
      city: buildings.city,
      buildingType: buildings.buildingType,
      totalUnits: buildings.totalUnits,
      totalFloors: buildings.totalFloors,
      isActive: buildings.isActive,
      createdAt: buildings.createdAt,
    })
    .from(buildings)
    .where(
      and(
        eq(buildings.organizationId, organizationId),
        eq(buildings.isActive, true)
      )
    )
    .orderBy(buildings.name);

  return await scopeQuery(baseQuery, userContext, 'buildings');
}

/**
 * Search buildings by name or address with role-based filtering.
 * 
 * @param searchTerm - Search term to look for in name or address.
 * @param userContext - User context for access control.
 * @returns Promise resolving to array of matching buildings.
 */
/**
 * SearchBuildings function.
 * @param searchTerm
 * @param userContext
 * @returns Function result.
 */
export async function searchBuildings(searchTerm: string, userContext: UserContext) {
  const searchPattern = `%${searchTerm}%`;
  
  const baseQuery = db
    .select({
      id: buildings.id,
      name: buildings.name,
      address: buildings.address,
      city: buildings.city,
      province: buildings.province,
      buildingType: buildings.buildingType,
      totalUnits: buildings.totalUnits,
      organizationId: buildings.organizationId,
      // Include organization info
      organizationName: organizations.name,
    })
    .from(buildings)
    .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
    .where(
      and(
        eq(buildings.isActive, true),
        // Search in building name, address, or organization name
        ilike(buildings.name, searchPattern)
      )
    )
    .orderBy(buildings.name);

  return await scopeQuery(baseQuery, userContext, 'buildings');
}

/**
 * Get building statistics with role-based filtering.
 * Includes residence count, maintenance request count, and budget information.
 * 
 * @param buildingId - Building ID to get statistics for.
 * @param userContext - User context for access control.
 * @returns Promise resolving to building statistics if accessible.
 */
/**
 * GetBuildingStatistics function.
 * @param buildingId
 * @param userContext
 * @returns Function result.
 */
export async function getBuildingStatistics(buildingId: string, userContext: UserContext) {
  // First verify user has access to this building
  const buildingAccess = await getBuildingById(buildingId, userContext);
  if (!buildingAccess) {
    return null;
  }

  // Get residence count
  const residenceCountQuery = await db
    .select({ count: count() })
    .from(residences)
    .where(
      and(
        eq(residences.buildingId, buildingId),
        eq(residences.isActive, true)
      )
    );
  
  const residenceCount = residenceCountQuery[0]?.count || 0;

  // Get active maintenance requests count
  const maintenanceCountQuery = await db
    .select({ count: count() })
    .from(maintenanceRequests)
    .innerJoin(residences, eq(maintenanceRequests.residenceId, residences.id))
    .where(
      and(
        eq(residences.buildingId, buildingId),
        inArray(maintenanceRequests.status, ['submitted', 'acknowledged', 'in_progress'])
      )
    );
  
  const activeMaintenanceCount = maintenanceCountQuery[0]?.count || 0;

  // Get current year budget total
  const currentYear = new Date().getFullYear();
  const budgetQuery = await db
    .select({ 
      budgetedAmount: budgets.budgetedAmount,
      actualAmount: budgets.actualAmount 
    })
    .from(budgets)
    .where(
      and(
        eq(budgets.buildingId, buildingId),
        eq(budgets.year, currentYear),
        eq(budgets.isActive, true)
      )
    );

  let totalBudgeted = 0;
  let totalActual = 0;
  
  budgetQuery.forEach((budget: unknown) => {
    totalBudgeted += parseFloat(budget.budgetedAmount || '0');
    totalActual += parseFloat(budget.actualAmount || '0');
  });

  return {
    buildingId,
    residenceCount,
    activeMaintenanceCount,
    currentYearBudget: {
      totalBudgeted: totalBudgeted.toFixed(2),
      totalActual: totalActual.toFixed(2),
      variance: (totalBudgeted - totalActual).toFixed(2),
    },
  };
}

/**
 * Get buildings with their occupancy rates and basic statistics.
 * Shows percentage of occupied units and key metrics.
 * 
 * @param userContext - User context for access control.
 * @returns Promise resolving to array of buildings with occupancy information.
 */
/**
 * GetBuildingsWithOccupancy function.
 * @param userContext
 * @returns Function result.
 */
export async function getBuildingsWithOccupancy(userContext: UserContext) {
  const baseQuery = db
    .select({
      id: buildings.id,
      name: buildings.name,
      address: buildings.address,
      city: buildings.city,
      buildingType: buildings.buildingType,
      totalUnits: buildings.totalUnits,
      organizationId: buildings.organizationId,
      organizationName: organizations.name,
    })
    .from(buildings)
    .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
    .where(eq(buildings.isActive, true))
    .orderBy(buildings.name);

  const scopedQuery = await scopeQuery(baseQuery, userContext, 'buildings');
  const buildingsResult = await scopedQuery;

  // For each building, calculate occupancy
  const buildingsWithOccupancy = await Promise.all(
    buildingsResult.map(async (building: unknown) => {
      const occupiedUnitsQuery = await db
        .select({ count: count() })
        .from(residences)
        .where(
          and(
            eq(residences.buildingId, building.id),
            eq(residences.isActive, true)
          )
        );
      
      const occupiedUnits = occupiedUnitsQuery[0]?.count || 0;
      const occupancyRate = building.totalUnits > 0 
        ? Math.round((occupiedUnits / building.totalUnits) * 100) 
        : 0;

      return {
        ...building,
        occupiedUnits,
        occupancyRate,
      };
    })
  );

  return buildingsWithOccupancy;
}

/**
 * Get buildings by type with role-based filtering.
 * 
 * @param buildingType - Building type ('condo' or 'rental').
 * @param userContext - User context for access control.
 * @returns Promise resolving to array of buildings of the specified type.
 */
/**
 * GetBuildingsByType function.
 * @param buildingType
 * @param userContext
 * @returns Function result.
 */
export async function getBuildingsByType(
  buildingType: 'condo' | 'rental', 
  userContext: UserContext
) {
  const baseQuery = db
    .select({
      id: buildings.id,
      name: buildings.name,
      address: buildings.address,
      city: buildings.city,
      province: buildings.province,
      buildingType: buildings.buildingType,
      totalUnits: buildings.totalUnits,
      yearBuilt: buildings.yearBuilt,
      organizationId: buildings.organizationId,
      organizationName: organizations.name,
      createdAt: buildings.createdAt,
    })
    .from(buildings)
    .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
    .where(
      and(
        eq(buildings.buildingType, buildingType),
        eq(buildings.isActive, true)
      )
    )
    .orderBy(buildings.name);

  return await scopeQuery(baseQuery, userContext, 'buildings');
}

/**
 * Get building summary statistics for all accessible buildings.
 * Provides aggregated information about the user's building portfolio.
 * 
 * @param userContext - User context for access control.
 * @returns Promise resolving to building portfolio summary.
 */
/**
 * GetBuildingSummary function.
 * @param userContext
 * @returns Function result.
 */
export async function getBuildingSummary(userContext: UserContext) {
  // Get all accessible buildings
  const accessibleBuildingsQuery = await scopeQuery(
    db.select({ 
      id: buildings.id,
      totalUnits: buildings.totalUnits,
      buildingType: buildings.buildingType
    }).from(buildings).where(eq(buildings.isActive, true)),
    userContext,
    'buildings'
  );
  
  const accessibleBuildings = await accessibleBuildingsQuery;
  
  if (accessibleBuildings.length === 0) {
    return {
      totalBuildings: 0,
      totalUnits: 0,
      condoBuildings: 0,
      rentalBuildings: 0,
      averageUnitsPerBuilding: 0,
    };
  }

  let totalBuildings = 0;
  let totalUnits = 0;
  let condoBuildings = 0;
  let rentalBuildings = 0;

  accessibleBuildings.forEach((building: unknown) => {
    totalBuildings++;
    totalUnits += building.totalUnits || 0;
    
    if (building.buildingType === 'condo') {
      condoBuildings++;
    } else if (building.buildingType === 'rental') {
      rentalBuildings++;
    }
  });

  const averageUnitsPerBuilding = totalBuildings > 0 
    ? Math.round(totalUnits / totalBuildings) 
    : 0;

  return {
    totalBuildings,
    totalUnits,
    condoBuildings,
    rentalBuildings,
    averageUnitsPerBuilding,
  };
}