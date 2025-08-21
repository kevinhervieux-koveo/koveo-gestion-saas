import { db } from '../../db';
import { 
  buildings, 
  organizations, 
  residences, 
  userResidences,
  userOrganizations
} from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';

/**
 * Access types for buildings.
 */
export type BuildingAccessType = 'koveo-global' | 'organization' | 'residence' | 'both';

/**
 * User access information.
 */
export interface UserAccess {
  hasAccess: boolean;
  accessType: BuildingAccessType | '';
  organizationIds: string[];
  isKoveoUser: boolean;
}

/**
 * Determines if a user has access to buildings based on their role and associations.
 * @param userId
 */
/**
 * GetUserBuildingAccess function.
 * @param userId
 * @returns Function result.
 */
export async function getUserBuildingAccess(userId: string): Promise<UserAccess> {
  // Get user organizations
  const userOrgs = await db
    .select({
      organizationId: userOrganizations.organizationId,
      organizationName: organizations.name,
      canAccessAllOrganizations: userOrganizations.canAccessAllOrganizations
    })
    .from(userOrganizations)
    .innerJoin(organizations, eq(userOrganizations.organizationId, organizations.id))
    .where(
      and(
        eq(userOrganizations.userId, userId),
        eq(userOrganizations.isActive, true)
      )
    );

  const isKoveoUser = userOrgs.some(org => org.organizationName === 'Koveo');
  const organizationIds = userOrgs.map(org => org.organizationId);

  return {
    hasAccess: userOrgs.length > 0 || isKoveoUser,
    accessType: isKoveoUser ? 'koveo-global' : 'organization',
    organizationIds,
    isKoveoUser
  };
}

/**
 * Checks if a user has access to a specific building.
 * @param userId
 * @param buildingId
 * @param userRole
 */
/**
 * CheckBuildingAccess function.
 * @param userId
 * @param buildingId
 * @param userRole
 * @returns Function result.
 */
export async function checkBuildingAccess(
  userId: string, 
  buildingId: string, 
  userRole: string
): Promise<UserAccess> {
  let hasAccess = false;
  let accessType: BuildingAccessType | '' = '';

  // Get user access info
  const userAccess = await getUserBuildingAccess(userId);

  // Check if user is Koveo user (global access)
  if (userAccess.isKoveoUser) {
    return {
      hasAccess: true,
      accessType: 'koveo-global',
      organizationIds: userAccess.organizationIds,
      isKoveoUser: true
    };
  }

  // Check organization-based access for Admin and Manager
  if (userRole === 'admin' || userRole === 'manager') {
    if (userAccess.organizationIds.length > 0) {
      // Check if building belongs to user's organizations
      const buildingOrg = await db
        .select({ id: buildings.id })
        .from(buildings)
        .where(
          and(
            eq(buildings.id, buildingId),
            inArray(buildings.organizationId, userAccess.organizationIds),
            eq(buildings.isActive, true)
          )
        );

      if (buildingOrg.length > 0) {
        hasAccess = true;
        accessType = 'organization';
      }
    }
  }

  // Check residence-based access for all roles
  if (!hasAccess) {
    const userResidenceAccess = await db
      .select({ residenceId: userResidences.residenceId })
      .from(userResidences)
      .innerJoin(residences, eq(userResidences.residenceId, residences.id))
      .where(
        and(
          eq(userResidences.userId, userId),
          eq(residences.buildingId, buildingId),
          eq(userResidences.isActive, true)
        )
      );

    if (userResidenceAccess.length > 0) {
      hasAccess = true;
      accessType = accessType ? 'both' : 'residence';
    }
  }

  return {
    hasAccess,
    accessType,
    organizationIds: userAccess.organizationIds,
    isKoveoUser: false
  };
}

/**
 * Gets all buildings accessible to a user based on their role and associations.
 * @param userId
 * @param userRole
 */
/**
 * GetAccessibleBuildingIds function.
 * @param userId
 * @param userRole
 * @returns Function result.
 */
export async function getAccessibleBuildingIds(
  userId: string, 
  userRole: string
): Promise<{ buildingIds: string[], accessType: BuildingAccessType }> {
  const userAccess = await getUserBuildingAccess(userId);
  
  // Koveo users get access to all buildings
  if (userAccess.isKoveoUser) {
    const allBuildings = await db
      .select({ id: buildings.id })
      .from(buildings)
      .where(eq(buildings.isActive, true));
    
    return {
      buildingIds: allBuildings.map(b => b.id),
      accessType: 'koveo-global'
    };
  }

  const buildingIds = new Set<string>();

  // Organization-based access for Admin and Manager
  if ((userRole === 'admin' || userRole === 'manager') && userAccess.organizationIds.length > 0) {
    const orgBuildings = await db
      .select({ id: buildings.id })
      .from(buildings)
      .where(
        and(
          inArray(buildings.organizationId, userAccess.organizationIds),
          eq(buildings.isActive, true)
        )
      );

    orgBuildings.forEach(building => buildingIds.add(building.id));
  }

  // Residence-based access for all roles
  const userResidenceBuildings = await db
    .select({ buildingId: residences.buildingId })
    .from(userResidences)
    .innerJoin(residences, eq(userResidences.residenceId, residences.id))
    .where(
      and(
        eq(userResidences.userId, userId),
        eq(userResidences.isActive, true)
      )
    );

  userResidenceBuildings.forEach(residence => buildingIds.add(residence.buildingId));

  return {
    buildingIds: Array.from(buildingIds),
    accessType: userAccess.organizationIds.length > 0 ? 'both' : 'residence'
  };
}