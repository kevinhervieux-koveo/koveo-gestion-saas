import { sql, eq, and, inArray, or } from 'drizzle-orm';
import type { PgSelect, PgSelectQueryBuilderHKT } from 'drizzle-orm/pg-core';
import { 
  users, 
  organizations, 
  buildings, 
  residences, 
  userResidences,
  bills,
  maintenanceRequests,
  budgets,
  documents,
  notifications
} from '@shared/schema';
import { db } from '../../db';

/**
 * User context interface for query scoping.
 * Contains the minimum information needed to determine data access scope.
 */
export interface UserContext {
  /** User ID from authentication */
  userId: string;
  /** User role determining base permissions */
  role: 'admin' | 'manager' | 'tenant' | 'resident';
  /** Organization IDs the user is associated with (for managers) */
  organizationIds?: string[];
  /** Building IDs the user manages or has access to */
  buildingIds?: string[];
  /** Residence IDs the user is associated with */
  residenceIds?: string[];
}

/**
 * Scope configuration for different entity types.
 * Defines how each role can access different types of data.
 */
export const SCOPE_CONFIG = {
  // No scoping needed for these entities - they're system-wide
  SYSTEM_ENTITIES: ['users', 'organizations'] as const,
  
  // Building-level entities require building access
  BUILDING_ENTITIES: ['buildings', 'budgets'] as const,
  
  // Residence-level entities require residence access
  RESIDENCE_ENTITIES: ['residences', 'bills', 'maintenanceRequests'] as const,
  
  // User-specific entities
  USER_ENTITIES: ['notifications'] as const,
  
  // Multi-level entities that can be scoped at different levels
  MULTI_LEVEL_ENTITIES: ['documents'] as const,
} as const;

/**
 * Helper function to get user's accessible residence IDs based on their role and associations.
 * This is used for scoping queries to residence-level data.
 * @param userContext
 */
/**
 * GetUserAccessibleResidenceIds function.
 * @param userContext
 * @returns Function result.
 */
export async function getUserAccessibleResidenceIds(userContext: UserContext): Promise<string[]> {
  const { userId, role } = userContext;

  // Admin can access all residences
  if (role === 'admin') {
    const allResidences = await db.select({ id: residences.id }).from(residences);
    return allResidences.map((r: { id: string }) => r.id);
  }

  // For other roles, get residences through userResidences relationship
  const userResidenceQuery = db
    .select({ residenceId: userResidences.residenceId })
    .from(userResidences)
    .where(
      and(
        eq(userResidences.userId, userId),
        eq(userResidences.isActive, true)
      )
    );

  const userResidenceRecords = await userResidenceQuery;
  let accessibleResidenceIds = userResidenceRecords.map((ur: { residenceId: string }) => ur.residenceId);

  // Managers might have additional access through building management
  if (role === 'manager' && userContext.buildingIds?.length) {
    const managedBuildingResidences = await db
      .select({ id: residences.id })
      .from(residences)
      .where(inArray(residences.buildingId, userContext.buildingIds));
    
    const managedResidenceIds = managedBuildingResidences.map((r: { id: string }) => r.id);
    accessibleResidenceIds = Array.from(new Set([...accessibleResidenceIds, ...managedResidenceIds]));
  }

  return accessibleResidenceIds;
}

/**
 * Helper function to get user's accessible building IDs based on their role and associations.
 * This is used for scoping queries to building-level data.
 * @param userContext
 */
/**
 * GetUserAccessibleBuildingIds function.
 * @param userContext
 * @returns Function result.
 */
export async function getUserAccessibleBuildingIds(userContext: UserContext): Promise<string[]> {
  const { userId, role } = userContext;

  // Admin can access all buildings
  if (role === 'admin') {
    const allBuildings = await db.select({ id: buildings.id }).from(buildings);
    return allBuildings.map((b: { id: string }) => b.id);
  }

  // Use provided building IDs if available
  if (userContext.buildingIds?.length) {
    return userContext.buildingIds;
  }

  // Otherwise, get buildings through user's residences
  const accessibleResidenceIds = await getUserAccessibleResidenceIds(userContext);
  
  if (accessibleResidenceIds.length === 0) {
    return [];
  }

  const buildingQuery = await db
    .select({ buildingId: residences.buildingId })
    .from(residences)
    .where(inArray(residences.id, accessibleResidenceIds));

  return Array.from(new Set(buildingQuery.map((b: { buildingId: string }) => b.buildingId)));
}

/**
 * Main scope query function that applies role-based filtering to Drizzle queries.
 * This function adds appropriate WHERE clauses based on the user's role and associated entities.
 * 
 * @param query - The base Drizzle query to scope.
 * @param userContext - User context containing role and entity associations.
 * @param entityType - Type of entity being queried for appropriate scoping logic.
 * @returns The scoped query with added WHERE clauses.
 * 
 * @example
 * ```typescript
 * // Scope a bills query for a tenant
 * const scopedBillsQuery = await scopeQuery(
 *   db.select().from(bills),
 *   { userId: 'user-123', role: 'tenant' },
 *   'bills'
 * );
 * 
 * // Scope a buildings query for a manager
 * const scopedBuildingsQuery = await scopeQuery(
 *   db.select().from(buildings),
 *   { 
 *     userId: 'manager-456', 
 *     role: 'manager',
 *     organizationIds: ['org-1', 'org-2']
 *   },
 *   'buildings'
 * );
 * ```
 */
/**
 * ScopeQuery function.
 * @param query
 * @param userContext
 * @param entityType
 * @returns Function result.
 */
export async function scopeQuery<T extends PgSelect>(
  query: T,
  userContext: UserContext,
  entityType: string
): Promise<T> {
  const { userId, role } = userContext;

  // Admin users have no restrictions
  if (role === 'admin') {
    return query;
  }

  // Apply scoping based on entity type
  switch (entityType) {
    case 'users':
      // Users can typically only see their own user record, unless they're managers/admins
      if (role === 'tenant' || role === 'resident') {
        return query.where(eq(users.id, userId)) as T;
      }
      return query; // Managers and admins might see other users in their scope

    case 'organizations':
      // Scope to user's associated organizations
      if (userContext.organizationIds?.length) {
        return query.where(inArray(organizations.id, userContext.organizationIds)) as T;
      }
      return query.where(sql`false`) as T; // No access if no organizations

    case 'buildings':
      const accessibleBuildingIds = await getUserAccessibleBuildingIds(userContext);
      if (accessibleBuildingIds.length === 0) {
        return query.where(sql`false`) as T; // No access
      }
      return query.where(inArray(buildings.id, accessibleBuildingIds)) as T;

    case 'residences':
      const accessibleResidenceIds = await getUserAccessibleResidenceIds(userContext);
      if (accessibleResidenceIds.length === 0) {
        return query.where(sql`false`) as T; // No access
      }
      return query.where(inArray(residences.id, accessibleResidenceIds)) as T;

    case 'bills':
      const billResidenceIds = await getUserAccessibleResidenceIds(userContext);
      if (billResidenceIds.length === 0) {
        return query.where(sql`false`) as T; // No access
      }
      return query.where(inArray(bills.residenceId, billResidenceIds)) as T;

    case 'maintenanceRequests':
      const maintenanceResidenceIds = await getUserAccessibleResidenceIds(userContext);
      if (maintenanceResidenceIds.length === 0) {
        return query.where(sql`false`) as T; // No access
      }
      
      // Tenants can only see their own maintenance requests
      if (role === 'tenant') {
        return query.where(
          and(
            inArray(maintenanceRequests.residenceId, maintenanceResidenceIds),
            eq(maintenanceRequests.submittedBy, userId)
          )
        ) as T;
      }
      
      return query.where(inArray(maintenanceRequests.residenceId, maintenanceResidenceIds)) as T;

    case 'budgets':
      const budgetBuildingIds = await getUserAccessibleBuildingIds(userContext);
      if (budgetBuildingIds.length === 0) {
        return query.where(sql`false`) as T; // No access
      }
      return query.where(inArray(budgets.buildingId, budgetBuildingIds)) as T;

    case 'documents':
      // Documents can be associated with organizations, buildings, or residences
      const docBuildingIds = await getUserAccessibleBuildingIds(userContext);
      const docResidenceIds = await getUserAccessibleResidenceIds(userContext);
      
      const conditions = [];
      
      if (userContext.organizationIds?.length) {
        conditions.push(inArray(documents.organizationId, userContext.organizationIds));
      }
      
      if (docBuildingIds.length > 0) {
        conditions.push(inArray(documents.buildingId, docBuildingIds));
      }
      
      if (docResidenceIds.length > 0) {
        conditions.push(inArray(documents.residenceId, docResidenceIds));
      }

      // User can see documents they uploaded
      conditions.push(eq(documents.uploadedBy, userId));
      
      if (conditions.length === 0) {
        return query.where(sql`false`) as T; // No access
      }
      
      return query.where(or(...conditions)) as T;

    case 'notifications':
      // Users can only see their own notifications
      return query.where(eq(notifications.userId, userId)) as T;

    default:
      console.warn(`No scoping rule defined for entity type: ${entityType}`);
      return query;
  }
}

/**
 * Helper function to build user context from session data.
 * This should be called at the beginning of API routes to establish the user's scope.
 * 
 * @param userId - User ID from authentication.
 * @param userRole - User role from session/database.
 * @returns Promise resolving to UserContext with populated associations.
 */
/**
 * BuildUserContext function.
 * @param userId
 * @param userRole
 * @returns Function result.
 */
export async function buildUserContext(userId: string, userRole: string): Promise<UserContext> {
  const role = userRole as UserContext['role'];
  
  const userContext: UserContext = {
    userId,
    role,
  };

  // For non-admin users, populate their associated entities
  if (role !== 'admin') {
    // Get user's residences
    const userResidenceRecords = await db
      .select({ 
        residenceId: userResidences.residenceId,
        buildingId: residences.buildingId,
        organizationId: buildings.organizationId
      })
      .from(userResidences)
      .innerJoin(residences, eq(userResidences.residenceId, residences.id))
      .innerJoin(buildings, eq(residences.buildingId, buildings.id))
      .where(
        and(
          eq(userResidences.userId, userId),
          eq(userResidences.isActive, true)
        )
      );

    userContext.residenceIds = Array.from(new Set(userResidenceRecords.map((ur: unknown) => ur.residenceId)));
    userContext.buildingIds = Array.from(new Set(userResidenceRecords.map((ur: unknown) => ur.buildingId)));
    userContext.organizationIds = Array.from(new Set(userResidenceRecords.map((ur: unknown) => ur.organizationId)));
  }

  return userContext;
}

/**
 * Type helper for scoped queries.
 * Use this to ensure type safety when working with scoped queries.
 */
export type ScopedQuery<T> = T extends PgSelect ? T : never;