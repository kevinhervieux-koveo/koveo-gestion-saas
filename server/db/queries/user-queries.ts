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
/**
 * GetUsersForUser function.
 * @param userContext
 * @returns Function result.
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
    .where(eq(users.isActive, true));

  const scopedQuery = await scopeQuery(baseQuery, userContext, 'users');
  return await scopedQuery.orderBy(users.lastName, users.firstName);
}

/**
 * Get a single user by ID with role-based access control.
 *
 * @param userId - The user ID to retrieve.
 * @param userContext - User context for access control.
 * @returns Promise resolving to the user if accessible, undefined otherwise.
 */
/**
 * GetUserById function.
 * @param userId
 * @param userContext
 * @returns Function result.
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
/**
 * GetUsersByRole function.
 * @param role
 * @param userContext
 * @returns Function result.
 */
export async function getUsersByRole(
  role: 'admin' | 'manager' | 'tenant' | 'resident',
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
    .where(and(eq(users.role, role), eq(users.isActive, true)));

  const scopedQuery = await scopeQuery(baseQuery, userContext, 'users');
  return await scopedQuery.orderBy(users.lastName, users.firstName);
}

/**
 * Search users by name or email with role-based filtering.
 *
 * @param searchTerm - Search term to look for in name or email.
 * @param userContext - User context for access control.
 * @returns Promise resolving to array of matching users.
 */
/**
 * SearchUsers function.
 * @param searchTerm
 * @param userContext
 * @returns Function result.
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
    );

  const scopedQuery = await scopeQuery(baseQuery, userContext, 'users');
  return await scopedQuery.orderBy(users.lastName, users.firstName);
}

/**
 * Get users associated with a specific residence.
 * Shows all users (owners, tenants, occupants) for a residence.
 * OPTIMIZED: Access check integrated using EXISTS subquery instead of separate query.
 *
 * @param residenceId - Residence ID to get users for.
 * @param userContext - User context for access control.
 * @returns Promise resolving to array of users associated with the residence.
 */
/**
 * GetUsersForResidence function.
 * @param residenceId
 * @param userContext
 * @returns Function result.
 */
export async function getUsersForResidence(residenceId: string, userContext: UserContext) {
  const { userId, role } = userContext;

  // OPTIMIZATION: Single query with integrated access check
  // Admin users have access to all residences
  if (role === 'admin') {
    return await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        role: users.role,
        isActive: users.isActive,
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
  }

  // For non-admin users, verify access via their own residence associations
  // User has access if they have an active residence association
  const hasAccess = await db
    .select({ id: userResidences.id })
    .from(userResidences)
    .innerJoin(residences, eq(userResidences.residenceId, residences.id))
    .where(
      and(
        eq(userResidences.userId, userId),
        eq(userResidences.residenceId, residenceId),
        eq(userResidences.isActive, true),
        eq(residences.isActive, true)
      )
    )
    .limit(1);

  if (hasAccess.length === 0) {
    // For managers, check if they have access through building management
    if (role === 'manager' && userContext.buildingIds?.length) {
      const buildingAccess = await db
        .select({ id: residences.id })
        .from(residences)
        .where(
          and(
            eq(residences.id, residenceId),
            inArray(residences.buildingId, userContext.buildingIds),
            eq(residences.isActive, true)
          )
        )
        .limit(1);

      if (buildingAccess.length === 0) {
        return [];
      }
    } else {
      return [];
    }
  }

  // User has access, return the users for this residence
  return await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      role: users.role,
      isActive: users.isActive,
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
}

/**
 * Get users associated with a specific building.
 * Shows all users who have residences in the building.
 * OPTIMIZED: Access check integrated instead of separate query.
 *
 * @param buildingId - Building ID to get users for.
 * @param userContext - User context for access control.
 * @returns Promise resolving to array of users associated with the building.
 */
/**
 * GetUsersForBuilding function.
 * @param buildingId
 * @param userContext
 * @returns Function result.
 */
export async function getUsersForBuilding(buildingId: string, userContext: UserContext) {
  const { userId, role } = userContext;

  // OPTIMIZATION: Integrated access check instead of separate queries
  // Admin users have access to all buildings
  if (role === 'admin') {
    return await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        role: users.role,
        isActive: users.isActive,
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
  }

  // For managers, check if they manage this building
  if (role === 'manager' && userContext.buildingIds?.includes(buildingId)) {
    return await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        role: users.role,
        isActive: users.isActive,
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
  }

  // For non-admin/non-manager users, verify they have a residence in this building
  const hasAccess = await db
    .select({ id: userResidences.id })
    .from(userResidences)
    .innerJoin(residences, eq(userResidences.residenceId, residences.id))
    .where(
      and(
        eq(userResidences.userId, userId),
        eq(residences.buildingId, buildingId),
        eq(userResidences.isActive, true),
        eq(residences.isActive, true)
      )
    )
    .limit(1);

  if (hasAccess.length === 0) {
    return [];
  }

  return await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      role: users.role,
      isActive: users.isActive,
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
}

/**
 * Get the current user's profile with their residence associations.
 * Shows complete profile information and all associated residences.
 * OPTIMIZED: Single query with LEFT JOIN instead of separate queries.
 *
 * @param userContext - User context containing current user info.
 * @returns Promise resolving to user profile with residence associations.
 */
/**
 * GetCurrentUserProfile function.
 * @param userContext
 * @returns Function result.
 */
export async function getCurrentUserProfile(userContext: UserContext) {
  // OPTIMIZATION: Combined query - get user and all residence associations in a single query
  const results = await db
    .select({
      // User fields
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
      // Residence relationship fields
      residenceId: userResidences.residenceId,
      relationshipType: userResidences.relationshipType,
      startDate: userResidences.startDate,
      endDate: userResidences.endDate,
      residenceActive: userResidences.isActive,
      // Residence details
      unitNumber: residences.unitNumber,
      floor: residences.floor,
      squareFootage: residences.squareFootage,
      bedrooms: residences.bedrooms,
      bathrooms: residences.bathrooms,
      monthlyFees: residences.monthlyFees,
      // Building details
      buildingId: buildings.id,
      buildingName: buildings.name,
      buildingAddress: buildings.address,
      buildingCity: buildings.city,
      buildingType: buildings.buildingType,
      // Organization details
      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationType: organizations.type,
    })
    .from(users)
    .leftJoin(
      userResidences,
      and(
        eq(users.id, userResidences.userId),
        eq(userResidences.isActive, true)
      )
    )
    .leftJoin(
      residences,
      and(
        eq(userResidences.residenceId, residences.id),
        eq(residences.isActive, true)
      )
    )
    .leftJoin(
      buildings,
      and(
        eq(residences.buildingId, buildings.id),
        eq(buildings.isActive, true)
      )
    )
    .leftJoin(
      organizations,
      and(
        eq(buildings.organizationId, organizations.id),
        eq(organizations.isActive, true)
      )
    )
    .where(eq(users.id, userContext.userId))
    .orderBy(userResidences.relationshipType, residences.unitNumber);

  if (results.length === 0) {
    return null;
  }

  // Transform flat results into nested structure
  const userProfile = {
    id: results[0].id,
    email: results[0].email,
    firstName: results[0].firstName,
    lastName: results[0].lastName,
    phone: results[0].phone,
    language: results[0].language,
    role: results[0].role,
    isActive: results[0].isActive,
    lastLoginAt: results[0].lastLoginAt,
    createdAt: results[0].createdAt,
    updatedAt: results[0].updatedAt,
    residences: results
      .filter(r => r.residenceId !== null)
      .map(r => ({
        residenceId: r.residenceId,
        relationshipType: r.relationshipType,
        startDate: r.startDate,
        endDate: r.endDate,
        isActive: r.residenceActive,
        unitNumber: r.unitNumber,
        floor: r.floor,
        squareFootage: r.squareFootage,
        bedrooms: r.bedrooms,
        bathrooms: r.bathrooms,
        monthlyFees: r.monthlyFees,
        buildingId: r.buildingId,
        buildingName: r.buildingName,
        buildingAddress: r.buildingAddress,
        buildingCity: r.buildingCity,
        buildingType: r.buildingType,
        organizationId: r.organizationId,
        organizationName: r.organizationName,
        organizationType: r.organizationType,
      })),
  };

  return userProfile;
}

/**
 * Get user summary statistics for accessible users.
 * Provides role distribution and activity metrics.
 *
 * @param userContext - User context for access control.
 * @returns Promise resolving to user summary statistics.
 */
/**
 * GetUserSummary function.
 * @param userContext
 * @returns Function result.
 */
export async function getUserSummary(userContext: UserContext) {
  // Get all accessible users
  const baseQuery = db
    .select({
      id: users.id,
      role: users.role,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users);

  const accessibleUsersQuery = await scopeQuery(baseQuery, userContext, 'users');
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
  };

  // Consider "recently active" as login within last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  accessibleUsers.forEach((user) => {
    totalUsers++;

    if (user.isActive) {
      activeUsers++;
    } else {
      inactiveUsers++;
    }

    // Count by role
    if (Object.prototype.hasOwnProperty.call(roleDistribution, user.role)) {
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
