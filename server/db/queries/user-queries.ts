import { eq, and, desc, ilike, inArray, or } from 'drizzle-orm';
import { users, userResidences, residences, buildings, organizations } from '@shared/schema';
import { db } from '../../db';
import { scopeQuery, type UserContext } from './scope-query';

/**
 * Get users accessible to the current user based on their role and associations.
 * Admins see all users, managers see users in their organizations, 
 * owners see users in their buildings, tenants typically see only themselves.
 * 
 * @param userContext - User context containing role and entity associations.
 * @returns Promise resolving to array of users the current user can access.
 */
export async function getUsersForUser(userContext: UserContext) {
  const baseQuery = db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      language: users.language,
      role: users.role,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.isActive, true))
    .orderBy(users.lastName, users.firstName);

  return await scopeQuery(baseQuery, userContext, 'users');
}

/**
 * Get a single user by ID with role-based access control.
 * 
 * @param userId - The user ID to retrieve.
 * @param userContext - User context for access control.
 * @returns Promise resolving to the user if accessible, undefined otherwise.
 */
export async function getUserById(userId: string, userContext: UserContext) {
  const baseQuery = db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      language: users.language,
      role: users.role,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, userId));

  const scopedQuery = await scopeQuery(baseQuery, userContext, 'users');
  const results = await scopedQuery;
  return results[0];
}

/**
 * Get users by role with role-based filtering.
 * 
 * @param role - User role to filter by.
 * @param userContext - User context for access control.
 * @returns Promise resolving to array of users with the specified role.
 */
export async function getUsersByRole(
  role: 'admin' | 'manager' | 'owner' | 'tenant' | 'board_member',
  userContext: UserContext
) {
  const baseQuery = db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      language: users.language,
      role: users.role,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      and(
        eq(users.role, role),
        eq(users.isActive, true)
      )
    )
    .orderBy(users.lastName, users.firstName);

  return await scopeQuery(baseQuery, userContext, 'users');
}

/**
 * Search users by name or email with role-based filtering.
 * 
 * @param searchTerm - Search term to look for in name or email.
 * @param userContext - User context for access control.
 * @returns Promise resolving to array of matching users.
 */
export async function searchUsers(searchTerm: string, userContext: UserContext) {
  const searchPattern = `%${searchTerm}%`;
  
  const baseQuery = db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      role: users.role,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(
      and(
        eq(users.isActive, true),
        or(
          ilike(users.firstName, searchPattern),
          ilike(users.lastName, searchPattern),
          ilike(users.email, searchPattern)
        )
      )
    )
    .orderBy(users.lastName, users.firstName);

  return await scopeQuery(baseQuery, userContext, 'users');
}

/**
 * Get users associated with a specific residence.
 * Shows all users (owners, tenants, occupants) for a residence.
 * 
 * @param residenceId - Residence ID to get users for.
 * @param userContext - User context for access control.
 * @returns Promise resolving to array of users associated with the residence.
 */
export async function getUsersForResidence(residenceId: string, userContext: UserContext) {
  const baseQuery = db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      role: users.role,
      isActive: users.isActive,
      // Include relationship info
      relationshipType: userResidences.relationshipType,
      startDate: userResidences.startDate,
      endDate: userResidences.endDate,
      residenceActive: userResidences.isActive,
    })
    .from(users)
    .innerJoin(userResidences, eq(users.id, userResidences.userId))
    .where(
      and(
        eq(userResidences.residenceId, residenceId),
        eq(users.isActive, true),
        eq(userResidences.isActive, true)
      )
    )
    .orderBy(userResidences.relationshipType, users.lastName);

  // Since this query involves residences, we need to scope it appropriately
  // First verify the user has access to this residence
  const residenceAccessQuery = await scopeQuery(
    db.select({ id: residences.id }).from(residences).where(eq(residences.id, residenceId)),
    userContext,
    'residences'
  );
  
  const residenceAccess = await residenceAccessQuery;
  if (residenceAccess.length === 0) {
    return []; // No access to this residence
  }

  return await baseQuery;
}

/**
 * Get users associated with a specific building.
 * Shows all users who have residences in the building.
 * 
 * @param buildingId - Building ID to get users for.
 * @param userContext - User context for access control.
 * @returns Promise resolving to array of users associated with the building.
 */
export async function getUsersForBuilding(buildingId: string, userContext: UserContext) {
  // First verify the user has access to this building
  const buildingAccessQuery = await scopeQuery(
    db.select({ id: buildings.id }).from(buildings).where(eq(buildings.id, buildingId)),
    userContext,
    'buildings'
  );
  
  const buildingAccess = await buildingAccessQuery;
  if (buildingAccess.length === 0) {
    return []; // No access to this building
  }

  const baseQuery = db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      role: users.role,
      isActive: users.isActive,
      // Include residence and relationship info
      unitNumber: residences.unitNumber,
      relationshipType: userResidences.relationshipType,
      startDate: userResidences.startDate,
      endDate: userResidences.endDate,
    })
    .from(users)
    .innerJoin(userResidences, eq(users.id, userResidences.userId))
    .innerJoin(residences, eq(userResidences.residenceId, residences.id))
    .where(
      and(
        eq(residences.buildingId, buildingId),
        eq(users.isActive, true),
        eq(userResidences.isActive, true),
        eq(residences.isActive, true)
      )
    )
    .orderBy(residences.unitNumber, userResidences.relationshipType, users.lastName);

  return await baseQuery;
}

/**
 * Get the current user's profile with their residence associations.
 * Shows complete profile information and all associated residences.
 * 
 * @param userContext - User context containing current user info.
 * @returns Promise resolving to user profile with residence associations.
 */
export async function getCurrentUserProfile(userContext: UserContext) {
  // Get user basic info
  const userProfile = await getUserById(userContext.userId, userContext);
  
  if (!userProfile) {
    return null;
  }

  // Get user's residence associations
  const residenceAssociations = await db
    .select({
      residenceId: userResidences.residenceId,
      relationshipType: userResidences.relationshipType,
      startDate: userResidences.startDate,
      endDate: userResidences.endDate,
      isActive: userResidences.isActive,
      // Include residence details
      unitNumber: residences.unitNumber,
      floor: residences.floor,
      squareFootage: residences.squareFootage,
      bedrooms: residences.bedrooms,
      bathrooms: residences.bathrooms,
      monthlyFees: residences.monthlyFees,
      // Include building details
      buildingId: buildings.id,
      buildingName: buildings.name,
      buildingAddress: buildings.address,
      buildingCity: buildings.city,
      buildingType: buildings.buildingType,
      // Include organization details
      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationType: organizations.type,
    })
    .from(userResidences)
    .innerJoin(residences, eq(userResidences.residenceId, residences.id))
    .innerJoin(buildings, eq(residences.buildingId, buildings.id))
    .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
    .where(
      and(
        eq(userResidences.userId, userContext.userId),
        eq(userResidences.isActive, true),
        eq(residences.isActive, true),
        eq(buildings.isActive, true),
        eq(organizations.isActive, true)
      )
    )
    .orderBy(userResidences.relationshipType, residences.unitNumber);

  return {
    ...userProfile,
    residences: residenceAssociations,
  };
}

/**
 * Get user summary statistics for accessible users.
 * Provides role distribution and activity metrics.
 * 
 * @param userContext - User context for access control.
 * @returns Promise resolving to user summary statistics.
 */
export async function getUserSummary(userContext: UserContext) {
  // Get all accessible users
  const accessibleUsersQuery = await scopeQuery(
    db.select({ 
      id: users.id,
      role: users.role,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
    }).from(users),
    userContext,
    'users'
  );
  
  const accessibleUsers = await accessibleUsersQuery;
  
  if (accessibleUsers.length === 0) {
    return {
      totalUsers: 0,
      activeUsers: 0,
      inactiveUsers: 0,
      roleDistribution: {
        admin: 0,
        manager: 0,
        owner: 0,
        tenant: 0,
        board_member: 0,
      },
      recentlyActiveUsers: 0,
    };
  }

  let totalUsers = 0;
  let activeUsers = 0;
  let inactiveUsers = 0;
  let recentlyActiveUsers = 0;
  
  const roleDistribution = {
    admin: 0,
    manager: 0,
    owner: 0,
    tenant: 0,
    board_member: 0,
  };

  // Consider "recently active" as login within last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  accessibleUsers.forEach((user: any) => {
    totalUsers++;
    
    if (user.isActive) {
      activeUsers++;
    } else {
      inactiveUsers++;
    }
    
    // Count by role
    if (roleDistribution.hasOwnProperty(user.role)) {
      roleDistribution[user.role as keyof typeof roleDistribution]++;
    }
    
    // Check recent activity
    if (user.lastLoginAt && new Date(user.lastLoginAt) > thirtyDaysAgo) {
      recentlyActiveUsers++;
    }
  });

  return {
    totalUsers,
    activeUsers,
    inactiveUsers,
    roleDistribution,
    recentlyActiveUsers,
  };
}