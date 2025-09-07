/**
 * Optimized database storage with caching and performance monitoring.
 * Replaces decorators with direct implementation for better compatibility.
 */

import { eq, desc, and, or, gte, lte, count, like, inArray, isNull, sql } from 'drizzle-orm';
// Use shared database connection to avoid multiple pools in production
import { db } from './db';
import crypto from 'crypto';
import * as schema from '@shared/schema';
import type {
  User,
  InsertUser,
  Organization,
  InsertOrganization,
  Building,
  InsertBuilding,
  Residence,
  InsertResidence,
  Document,
  InsertDocument,
  InsertPillar,
  Pillar as DevelopmentPillar,
  WorkspaceStatus,
  InsertWorkspaceStatus,
  QualityMetric,
  InsertQualityMetric,
  FrameworkConfiguration,
  InsertFrameworkConfiguration,
  ImprovementSuggestion,
  InsertImprovementSuggestion,
  Feature,
  InsertFeature,
  ActionableItem,
  InsertActionableItem,
  Invitation,
  InsertInvitation,
  InvitationAuditLog,
  InsertInvitationAuditLog,
  Permission,
  RolePermission,
  UserPermission,
  PasswordResetToken,
  InsertPasswordResetToken,
  Bug,
  InsertBug,
  Invoice,
  InsertInvoice,
} from '@shared/schema';
import type { IStorage } from './storage';
import type { Pillar } from '@shared/schema';
import { QueryOptimizer, PaginationHelper, type PaginationOptions } from './database-optimization';
import { queryCache, CacheInvalidator, withCache } from './query-cache';
import { dbPerformanceMonitor } from './performance-monitoring';
import { exists, sql as sqlOp } from 'drizzle-orm';

// Database connection imported from shared db.ts

/**
 * Enhanced database storage with built-in caching and performance monitoring.
 */
export class OptimizedDatabaseStorage implements IStorage {
  /**
   *
   */
  constructor() {
    // Skip optimizations in test environment
    if (
      process.env.TEST_ENV !== 'integration' &&
      !process.env.DISABLE_DB_OPTIMIZATIONS &&
      process.env.NODE_ENV !== 'test' &&
      !process.env.JEST_WORKER_ID
    ) {
      this.initializeOptimizations();
    }
  }

  /**
   * Initializes database optimizations.
   */
  private async initializeOptimizations(): Promise<void> {
    // Skip database optimization during tests
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.JEST_WORKER_ID ||
      process.env.SKIP_DB_OPTIMIZATION
    ) {
      // Database optimizations skipped in test environment
      return;
    }

    try {
      await QueryOptimizer.applyCoreOptimizations();
      // Database optimizations applied
    } catch (error: any) {
      console.error('❌ Error initializing database optimizations:', error);
    }
  }

  /**
   * Wrapper for performance tracking and caching.
   * @param operation
   * @param cacheKey
   * @param cacheType
   * @param fn
   */
  private async withOptimizations<T>(
    operation: string,
    cacheKey: string | null,
    cacheType: string,
    fn: () => Promise<T>
  ): Promise<T> {
    // Try cache first
    if (cacheKey) {
      const cached = queryCache.get<T>(cacheType, cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    // Execute with performance tracking
    const result = await dbPerformanceMonitor.trackQuery(operation, fn);

    // Cache result
    if (cacheKey && result !== undefined) {
      queryCache.set(cacheType, cacheKey, result);
    }

    return result;
  }

  // User operations with optimization

  /**
   * Retrieves all active users with caching and performance tracking.
   */
  async getUsers(): Promise<User[]> {
    return this.withOptimizations('getUsers', 'all_users', 'users', () =>
      db
        .select()
        .from(schema.users)
        .where(eq(schema.users.isActive, true))
        .limit(100) // Always use LIMIT for large result sets
        .orderBy(desc(schema.users.createdAt))
    );
  }

  /**
   * Retrieves all active users with their assignments (organizations, buildings, residences).
   * OPTIMIZED: Uses single query with JOINs and aggregation instead of N+1 queries.
   */
  async getUsersWithAssignments(): Promise<Array<User & { organizations: Array<{ id: string; name: string; type: string }>; buildings: Array<{ id: string; name: string }>; residences: Array<{ id: string; unitNumber: string; buildingId: string; buildingName: string }> }>> {
    return this.withOptimizations(
      'getUsersWithAssignments',
      'all_users_assignments_optimized_v4',
      'users',
      async () => {
        try {
          // Single optimized query using CTEs and aggregation
          const result = await db.execute(sql`
            WITH user_orgs AS (
              SELECT 
                uo.user_id,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'id', o.id,
                      'name', o.name,
                      'type', o.type
                    )
                  ) FILTER (WHERE o.id IS NOT NULL),
                  '[]'::json
                ) as organizations
              FROM user_organizations uo
              INNER JOIN organizations o ON uo.organization_id = o.id
              WHERE uo.is_active = true AND o.is_active = true
              GROUP BY uo.user_id
            ),
            user_buildings AS (
              SELECT 
                uo.user_id,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'id', b.id,
                      'name', b.name
                    )
                  ) FILTER (WHERE b.id IS NOT NULL),
                  '[]'::json
                ) as buildings
              FROM user_organizations uo
              INNER JOIN buildings b ON uo.organization_id = b.organization_id
              WHERE uo.is_active = true AND b.is_active = true
              GROUP BY uo.user_id, b.id, b.name
            ),
            user_residences AS (
              SELECT 
                ur.user_id,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'id', r.id,
                      'unitNumber', r.unit_number,
                      'buildingId', r.building_id,
                      'buildingName', b.name
                    )
                  ) FILTER (WHERE r.id IS NOT NULL),
                  '[]'::json
                ) as residences
              FROM user_residences ur
              INNER JOIN residences r ON ur.residence_id = r.id
              INNER JOIN buildings b ON r.building_id = b.id
              WHERE ur.is_active = true AND r.is_active = true
              GROUP BY ur.user_id
            )
            SELECT 
              u.*,
              COALESCE(uo.organizations, '[]'::json) as organizations,
              COALESCE(ub.buildings, '[]'::json) as buildings,
              COALESCE(ur.residences, '[]'::json) as residences
            FROM users u
            LEFT JOIN user_orgs uo ON u.id = uo.user_id
            LEFT JOIN user_buildings ub ON u.id = ub.user_id
            LEFT JOIN user_residences ur ON u.id = ur.user_id
            WHERE u.is_active = true
            ORDER BY u.created_at DESC
            LIMIT 100
          `);

          // Transform the raw SQL result to match the expected TypeScript types
          return result.rows.map((row: any) => ({
            id: row.id,
            username: row.username,
            password: row.password,
            email: row.email,
            firstName: row.first_name,
            lastName: row.last_name,
            phone: row.phone,
            profileImage: row.profile_image,
            language: row.language,
            role: row.role,
            isActive: row.is_active,
            lastLoginAt: row.last_login_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            organizations: typeof row.organizations === 'string' 
              ? JSON.parse(row.organizations) 
              : row.organizations || [],
            buildings: typeof row.buildings === 'string' 
              ? JSON.parse(row.buildings) 
              : row.buildings || [],
            residences: typeof row.residences === 'string' 
              ? JSON.parse(row.residences) 
              : row.residences || []
          }));
        } catch (error: any) {
          console.error('❌ Error in optimized getUsersWithAssignments:', error);
          
          // Fallback to the original implementation if optimized query fails
          console.log('🔄 Falling back to original implementation...');
          return this.getUsersWithAssignmentsFallback();
        }
      }
    );
  }

  /**
   * Retrieves paginated active users with their assignments (organizations, buildings, residences).
   * OPTIMIZED: Uses single query with JOINs, aggregation, and LIMIT/OFFSET for pagination.
   */
  async getUsersWithAssignmentsPaginated(
    offset: number = 0, 
    limit: number = 10, 
    filters: { role?: string; status?: string; organization?: string; orphan?: string } = {}
  ): Promise<{
    users: Array<User & { organizations: Array<{ id: string; name: string; type: string }>; buildings: Array<{ id: string; name: string }>; residences: Array<{ id: string; unitNumber: string; buildingId: string; buildingName: string }> }>;
    total: number;
  }> {
    return this.withOptimizations(
      'getUsersWithAssignmentsPaginated',
      `paginated_users_${offset}_${limit}_${JSON.stringify(filters)}_v2`,
      'users',
      async () => {
        try {
          // Build WHERE conditions for filtering
          let whereConditions = [];
          let countWhereConditions = [];
          
          if (filters.role) {
            if (filters.role === 'null') {
              whereConditions.push('u.role IS NULL');
              countWhereConditions.push('role IS NULL');
            } else {
              whereConditions.push(`u.role = '${filters.role}'`);
              countWhereConditions.push(`role = '${filters.role}'`);
            }
          }
          
          if (filters.status) {
            if (filters.status === 'null') {
              whereConditions.push('u.is_active IS NULL');
              countWhereConditions.push('is_active IS NULL');
            } else {
              const isActive = filters.status === 'true';
              whereConditions.push(`u.is_active = ${isActive}`);
              countWhereConditions.push(`is_active = ${isActive}`);
            }
          } else {
            // Default: only show active users if no status filter is applied
            whereConditions.push('u.is_active = true');
            countWhereConditions.push('is_active = true');
          }

          // First get total count for pagination metadata with filters
          const countQuery = `
            SELECT COUNT(*) as total 
            FROM users 
            WHERE ${countWhereConditions.join(' AND ')}
          `;
          const countResult = await db.execute(sql.raw(countQuery));
          const total = parseInt(countResult.rows[0]?.total || '0');

          // Single optimized query using CTEs and aggregation with pagination and filters
          const mainQuery = `
            WITH user_orgs AS (
              SELECT 
                uo.user_id,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'id', o.id,
                      'name', o.name,
                      'type', o.type
                    )
                  ) FILTER (WHERE o.id IS NOT NULL),
                  '[]'::json
                ) as organizations
              FROM user_organizations uo
              INNER JOIN organizations o ON uo.organization_id = o.id
              WHERE uo.is_active = true AND o.is_active = true
              GROUP BY uo.user_id
            ),
            user_buildings AS (
              SELECT 
                uo.user_id,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'id', b.id,
                      'name', b.name
                    )
                  ) FILTER (WHERE b.id IS NOT NULL),
                  '[]'::json
                ) as buildings
              FROM user_organizations uo
              INNER JOIN buildings b ON uo.organization_id = b.organization_id
              WHERE uo.is_active = true AND b.is_active = true
              GROUP BY uo.user_id, b.id, b.name
            ),
            user_residences AS (
              SELECT 
                ur.user_id,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'id', r.id,
                      'unitNumber', r.unit_number,
                      'buildingId', r.building_id,
                      'buildingName', b.name
                    )
                  ) FILTER (WHERE r.id IS NOT NULL),
                  '[]'::json
                ) as residences
              FROM user_residences ur
              INNER JOIN residences r ON ur.residence_id = r.id
              INNER JOIN buildings b ON r.building_id = b.id
              WHERE ur.is_active = true AND r.is_active = true
              GROUP BY ur.user_id
            )
            SELECT 
              u.*,
              COALESCE(uo.organizations, '[]'::json) as organizations,
              COALESCE(ub.buildings, '[]'::json) as buildings,
              COALESCE(ur.residences, '[]'::json) as residences
            FROM users u
            LEFT JOIN user_orgs uo ON u.id = uo.user_id
            LEFT JOIN user_buildings ub ON u.id = ub.user_id
            LEFT JOIN user_residences ur ON u.id = ur.user_id
            WHERE ${whereConditions.join(' AND ')}
            ${filters.organization ? `AND uo.organizations @> '[{"id":"${filters.organization}"}]'` : ''}
            ${filters.orphan === 'true' ? `AND uo.organizations = '[]'::json AND ub.buildings = '[]'::json AND ur.residences = '[]'::json` : ''}
            ${filters.orphan === 'false' ? `AND (uo.organizations != '[]'::json OR ub.buildings != '[]'::json OR ur.residences != '[]'::json)` : ''}
            ORDER BY u.created_at DESC
            LIMIT ${limit} OFFSET ${offset}
          `;
          
          const result = await db.execute(sql.raw(mainQuery));

          // Transform the raw SQL result to match the expected TypeScript types
          const users = result.rows.map((row: any) => ({
            id: row.id,
            username: row.username,
            password: row.password,
            email: row.email,
            firstName: row.first_name,
            lastName: row.last_name,
            phone: row.phone,
            profileImage: row.profile_image,
            language: row.language,
            role: row.role,
            isActive: row.is_active,
            lastLoginAt: row.last_login_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            organizations: typeof row.organizations === 'string' 
              ? JSON.parse(row.organizations) 
              : row.organizations || [],
            buildings: typeof row.buildings === 'string' 
              ? JSON.parse(row.buildings) 
              : row.buildings || [],
            residences: typeof row.residences === 'string' 
              ? JSON.parse(row.residences) 
              : row.residences || []
          }));

          return { users, total };
        } catch (error: any) {
          console.error('❌ Error in optimized getUsersWithAssignmentsPaginated:', error);
          
          // Fallback to paginated version of the original implementation if optimized query fails
          console.log('🔄 Falling back to paginated original implementation...');
          return this.getUsersWithAssignmentsPaginatedFallback(offset, limit, filters);
        }
      }
    );
  }

  /**
   * Fallback implementation for getUsersWithAssignments if optimized version fails.
   * This is the original N+1 query implementation kept for reliability.
   */
  private async getUsersWithAssignmentsFallback(): Promise<Array<User & { organizations: Array<{ id: string; name: string; type: string }>; buildings: Array<{ id: string; name: string }>; residences: Array<{ id: string; unitNumber: string; buildingId: string; buildingName: string }> }>> {
    try {
      // Get all users first
      const users = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.isActive, true))
        .orderBy(desc(schema.users.createdAt));

      // For each user, fetch their assignments with limited concurrency to prevent connection issues
      const batchSize = 5; // Process 5 users at a time to avoid connection pool exhaustion
      const usersWithAssignments = [];
      
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (user) => {
          try {
            // Get user organizations
            const userOrgs = await db
              .select({
                id: schema.organizations.id,
                name: schema.organizations.name,
                type: schema.organizations.type,
              })
              .from(schema.userOrganizations)
              .innerJoin(schema.organizations, eq(schema.userOrganizations.organizationId, schema.organizations.id))
              .where(
                and(
                  eq(schema.userOrganizations.userId, user.id),
                  eq(schema.userOrganizations.isActive, true),
                  eq(schema.organizations.isActive, true)
                )
              );

            // Get user buildings (through organization relationships)
            const userBuildings = await db
              .select({
                id: schema.buildings.id,
                name: schema.buildings.name,
              })
              .from(schema.userOrganizations)
              .innerJoin(schema.buildings, eq(schema.userOrganizations.organizationId, schema.buildings.organizationId))
              .where(
                and(
                  eq(schema.userOrganizations.userId, user.id),
                  eq(schema.userOrganizations.isActive, true),
                  eq(schema.buildings.isActive, true)
                )
              );

            // Get user residences
            const userResidences = await db
              .select({
                id: schema.residences.id,
                unitNumber: schema.residences.unitNumber,
                buildingId: schema.residences.buildingId,
                buildingName: schema.buildings.name,
              })
              .from(schema.userResidences)
              .innerJoin(schema.residences, eq(schema.userResidences.residenceId, schema.residences.id))
              .innerJoin(schema.buildings, eq(schema.residences.buildingId, schema.buildings.id))
              .where(
                and(
                  eq(schema.userResidences.userId, user.id),
                  eq(schema.userResidences.isActive, true),
                  eq(schema.residences.isActive, true)
                )
              );

            return {
              ...user,
              organizations: userOrgs || [],
              buildings: userBuildings || [],
              residences: userResidences || [],
            };
          } catch (error: any) {
            console.error('❌ Error getting user assignments:', error);
            // Return user with empty assignments if there's an error
            return {
              ...user,
              organizations: [],
              buildings: [],
              residences: [],
            };
          }
        })
      );
      
      usersWithAssignments.push(...batchResults);
      }

      return usersWithAssignments;
    } catch (error: any) {
      console.error('❌ Critical error getting users with assignments:', error);
      // Return empty array on critical error
      return [];
    }
  }

  /**
   * Paginated fallback implementation for getUsersWithAssignmentsPaginated if optimized version fails.
   * This is the original N+1 query implementation with pagination support.
   */
  private async getUsersWithAssignmentsPaginatedFallback(
    offset: number = 0, 
    limit: number = 10, 
    filters: { role?: string; status?: string; organization?: string; orphan?: string } = {}
  ): Promise<{
    users: Array<User & { organizations: Array<{ id: string; name: string; type: string }>; buildings: Array<{ id: string; name: string }>; residences: Array<{ id: string; unitNumber: string; buildingId: string; buildingName: string }> }>;
    total: number;
  }> {
    try {
      // Build WHERE conditions for filtering
      let whereConditions = [];
      
      if (filters.role) {
        if (filters.role === 'null') {
          whereConditions.push(isNull(schema.users.role));
        } else {
          whereConditions.push(eq(schema.users.role, filters.role as any));
        }
      }
      
      if (filters.status) {
        if (filters.status === 'null') {
          whereConditions.push(isNull(schema.users.isActive));
        } else {
          const isActive = filters.status === 'true';
          whereConditions.push(eq(schema.users.isActive, isActive));
        }
      } else {
        // Default: only show active users if no status filter is applied
        whereConditions.push(eq(schema.users.isActive, true));
      }

      // First get total count with filters
      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.users)
        .where(and(...whereConditions));
      
      const total = Number(totalResult[0]?.count || 0);

      // Get paginated users with filters
      const users = await db
        .select()
        .from(schema.users)
        .where(and(...whereConditions))
        .orderBy(desc(schema.users.createdAt))
        .limit(limit)
        .offset(offset);

      // For each user, fetch their assignments with limited concurrency to prevent connection issues
      const batchSize = 5; // Process 5 users at a time to avoid connection pool exhaustion
      const usersWithAssignments = [];
      
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (user) => {
          try {
            // Get user organizations
            const userOrgs = await db
              .select({
                id: schema.organizations.id,
                name: schema.organizations.name,
                type: schema.organizations.type,
              })
              .from(schema.userOrganizations)
              .innerJoin(schema.organizations, eq(schema.userOrganizations.organizationId, schema.organizations.id))
              .where(
                and(
                  eq(schema.userOrganizations.userId, user.id),
                  eq(schema.userOrganizations.isActive, true),
                  eq(schema.organizations.isActive, true)
                )
              );

            // Get user buildings (through organization relationships)
            const userBuildings = await db
              .select({
                id: schema.buildings.id,
                name: schema.buildings.name,
              })
              .from(schema.userOrganizations)
              .innerJoin(schema.buildings, eq(schema.userOrganizations.organizationId, schema.buildings.organizationId))
              .where(
                and(
                  eq(schema.userOrganizations.userId, user.id),
                  eq(schema.userOrganizations.isActive, true),
                  eq(schema.buildings.isActive, true)
                )
              );

            // Get user residences
            const userResidences = await db
              .select({
                id: schema.residences.id,
                unitNumber: schema.residences.unitNumber,
                buildingId: schema.residences.buildingId,
                buildingName: schema.buildings.name,
              })
              .from(schema.userResidences)
              .innerJoin(schema.residences, eq(schema.userResidences.residenceId, schema.residences.id))
              .innerJoin(schema.buildings, eq(schema.residences.buildingId, schema.buildings.id))
              .where(
                and(
                  eq(schema.userResidences.userId, user.id),
                  eq(schema.userResidences.isActive, true),
                  eq(schema.residences.isActive, true)
                )
              );

            return {
              ...user,
              organizations: userOrgs || [],
              buildings: userBuildings || [],
              residences: userResidences || [],
            };
          } catch (error: any) {
            console.error('❌ Error getting user assignments:', error);
            // Return user with empty assignments if there's an error
            return {
              ...user,
              organizations: [],
              buildings: [],
              residences: [],
            };
          }
        })
      );
      
      usersWithAssignments.push(...batchResults);
      }

      return { users: usersWithAssignments, total };
    } catch (error: any) {
      console.error('❌ Critical error getting paginated users with assignments:', error);
      // Return empty result on critical error
      return { users: [], total: 0 };
    }
  }

  /**
   * Retrieves users from organizations that a specific user has access to.
   * @param userId
   */
  async getUsersByOrganizations(userId: string): Promise<User[]> {
    return this.withOptimizations(
      'getUsersByOrganizations',
      `users_by_org:${userId}`,
      'users',
      async () => {
        // First, get organization IDs that the user has access to
        const userOrgs = await db
          .select({ organizationId: schema.userOrganizations.organizationId })
          .from(schema.userOrganizations)
          .where(
            and(
              eq(schema.userOrganizations.userId, userId),
              eq(schema.userOrganizations.isActive, true)
            )
          );

        if (userOrgs.length === 0) {
          return [];
        }

        const organizationIds = userOrgs.map((org) => org.organizationId);

        // Then get all users from those organizations
        return db
          .select({
            id: schema.users.id,
            username: schema.users.username,
            password: schema.users.password,
            email: schema.users.email,
            firstName: schema.users.firstName,
            lastName: schema.users.lastName,
            phone: schema.users.phone,
            profileImage: schema.users.profileImage,
            language: schema.users.language,
            role: schema.users.role,
            isActive: schema.users.isActive,
            lastLoginAt: schema.users.lastLoginAt,
            createdAt: schema.users.createdAt,
            updatedAt: schema.users.updatedAt,
          })
          .from(schema.users)
          .innerJoin(schema.userOrganizations, eq(schema.users.id, schema.userOrganizations.userId))
          .where(
            and(
              eq(schema.users.isActive, true),
              eq(schema.userOrganizations.isActive, true),
              inArray(schema.userOrganizations.organizationId, organizationIds)
            )
          )
          .orderBy(schema.users.firstName, schema.users.lastName);
      }
    );
  }

  /**
   * Gets paginated users with optimized query structure.
   * @param options
   * @param _options
   */
  async getPaginatedUsers(_options: PaginationOptions): Promise<{ users: User[]; total: number }> {
    PaginationHelper.validatePagination(_options);

    const cacheKey = `paginated_users:${_options.page}:${_options.pageSize}:${_options.sortBy}:${_options.sortDirection}`;

    // Try cache first
    const cached = queryCache.get<{ users: User[]; total: number }>('users', cacheKey);
    if (cached) {
      return cached;
    }

    // Get total count using covering index
    const [{ count: total }] = await db
      .select({ count: count() })
      .from(schema.users)
      .where(eq(schema.users.isActive, true));

    // Get paginated results with LIMIT and optimized ORDER BY
    const users = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.isActive, true))
      .orderBy(
        _options.sortDirection === 'DESC' ? desc(schema.users.createdAt) : schema.users.createdAt
      )
      .limit(_options.pageSize)
      .offset((_options.page - 1) * _options.pageSize);

    const result = { users, total };
    queryCache.set('users', cacheKey, result);

    return result;
  }

  /**
   * Gets buildings with residents using EXISTS instead of IN subquery.
   * @param organizationId
   * @param limit
   */
  async getBuildingsWithResidents(organizationId: string, limit: number = 50): Promise<Building[]> {
    const cacheKey = `buildings_with_residents:${organizationId}:${limit}`;

    return this.withOptimizations(
      'getBuildingsWithResidents',
      cacheKey,
      'buildings',
      () =>
        db
          .select()
          .from(schema.buildings)
          .where(
            and(
              eq(schema.buildings.organizationId, organizationId),
              eq(schema.buildings.isActive, true),
              exists(
                db
                  .select()
                  .from(schema.residences)
                  .where(
                    and(
                      eq(schema.residences.buildingId, schema.buildings.id),
                      eq(schema.residences.isActive, true)
                    )
                  )
              )
            )
          )
          .limit(limit) // Always use LIMIT for large result sets
    );
  }

  /**
   * Searches users with optimized covering index and LIMIT.
   * @param query
   * @param limit
   */
  async searchUsers(query: string, limit: number = 20): Promise<User[]> {
    const cacheKey = `search_users:${query}:${limit}`;

    return this.withOptimizations('searchUsers', cacheKey, 'users', () =>
      db
        .select()
        .from(schema.users)
        .where(
          and(
            eq(schema.users.isActive, true),
            or(
              like(schema.users.email, `%${query}%`),
              like(schema.users.firstName, `%${query}%`),
              like(schema.users.lastName, `%${query}%`)
            )
          )
        )
        .limit(limit) // Always limit search results
        .orderBy(schema.users.lastName, schema.users.firstName)
    );
  }

  /**
   * Gets financial summary using materialized view for complex aggregations.
   * @param buildingId
   */
  async getFinancialSummary(buildingId: string): Promise<any[]> {
    const cacheKey = `financial_summary:${buildingId}`;

    return this.withOptimizations('getFinancialSummary', cacheKey, 'financial', async () => {
      // Use materialized view for complex aggregations
      const summary = await db.execute(
        sqlOp`SELECT * FROM mv_financial_summary WHERE building_id = ${buildingId} ORDER BY month DESC LIMIT 12`
      );
      return summary.rows;
    });
  }

  /**
   * Gets building statistics using materialized view.
   * @param buildingId
   */
  async getBuildingStats(buildingId: string): Promise<any> {
    const cacheKey = `building_stats:${buildingId}`;

    return this.withOptimizations('getBuildingStats', cacheKey, 'buildings', async () => {
      // Use materialized view for dashboard statistics
      const stats = await db.execute(
        sqlOp`SELECT * FROM mv_building_stats WHERE building_id = ${buildingId}`
      );
      return stats.rows[0];
    });
  }

  /**
   * Retrieves a specific user by ID with caching.
   * @param id
   */
  async getUser(id: string): Promise<User | undefined> {
    return this.withOptimizations('getUser', `user:${id}`, 'users', async () => {
      
      const result = await db.select().from(schema.users).where(eq(schema.users.id, id));
      
      if (result.length > 0) {
        console.log(`🔍 Storage.getUser: Found user:`, {
          id: result[0].id,
          email: result[0].email,
          role: result[0].role,
        });
      } else {
        
      }
      return result[0];
    });
  }

  /**
   * Retrieves a user by email with caching.
   * @param email
   */
  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.withOptimizations('getUserByEmail', `user_email:${email}`, 'users', async () => {
      const result = await db.select().from(schema.users).where(eq(schema.users.email, email));
      return result[0];
    });
  }

  /**
   * Creates a new user with cache invalidation.
   * @param insertUser
   */
  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await dbPerformanceMonitor.trackQuery('createUser', async () => {
      // Automatically set demo password for demo role users
      let password = insertUser.password;
      const isDemoRole = ['demo_manager', 'demo_tenant', 'demo_resident'].includes(insertUser.role);
      
      if (isDemoRole) {
        // Always set the standard demo password hash for demo users, regardless of provided password
        password = '$2b$12$cOc/QjMjzlhqAQqF2b/MTOZr2QAtERbXJGd4OSa1CXMlF04FC3F02'; // demo123456
        console.log('🎭 Setting demo password for user with role:', insertUser.role);
      }

      // Ensure username uniqueness with random numbers if collision occurs
      let uniqueUsername = insertUser.username;
      let attempts = 0;
      const maxAttempts = 10;
      
      // Check for username collision
      let existingUser = await db
        .select({ username: schema.users.username })
        .from(schema.users)
        .where(eq(schema.users.username, uniqueUsername))
        .limit(1);

      while (existingUser.length > 0 && attempts < maxAttempts) {
        // Generate random 4-digit suffix
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        uniqueUsername = `${insertUser.username}${randomSuffix}`;
        attempts++;
        
        existingUser = await db
          .select({ username: schema.users.username })
          .from(schema.users)
          .where(eq(schema.users.username, uniqueUsername))
          .limit(1);
      }

      if (attempts >= maxAttempts && existingUser.length > 0) {
        throw new Error('Unable to generate unique username after maximum attempts');
      }

      // Filter only the fields that exist in the database schema
      const userData = {
        username: uniqueUsername,
        email: insertUser.email,
        password,
        firstName: insertUser.firstName,
        lastName: insertUser.lastName,
        phone: insertUser.phone || '',
        profileImage: insertUser.profileImage,
        language: insertUser.language || 'fr',
        role: insertUser.role,
        isActive: true, // Default value for new users
      };


      try {
        const inserted = await db.insert(schema.users).values([userData]).returning();
        
        return inserted;
      } catch (error: any) {
        console.error('❌ Error creating user:', error);
        throw error;
      }
    });

    // Invalidate related caches
    CacheInvalidator.invalidateUserCaches('*');

    return result[0];
  }

  /**
   * Updates a user with cache invalidation.
   * @param id
   * @param updates
   */
  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await dbPerformanceMonitor.trackQuery('updateUser', async () => {
      return db
        .update(schema.users)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.users.id, id))
        .returning();
    });

    // Invalidate specific user caches
    CacheInvalidator.invalidateUserCaches(id);

    return result[0];
  }

  /**
   * Retrieves organizations for a specific user.
   * @param userId
   */
  async getUserOrganizations(userId: string): Promise<Array<{ organizationId: string }>> {
    return this.withOptimizations(
      'getUserOrganizations',
      `user_orgs:${userId}`,
      'users',
      async () => {
        const result = await db
          .select({
            organizationId: schema.userOrganizations.organizationId,
          })
          .from(schema.userOrganizations)
          .where(
            and(
              eq(schema.userOrganizations.userId, userId),
              eq(schema.userOrganizations.isActive, true)
            )
          );
        return result;
      }
    );
  }

  /**
   * Retrieves residences for a specific user.
   * @param userId
   */
  async getUserResidences(userId: string): Promise<Array<{ residenceId: string }>> {
    return this.withOptimizations(
      'getUserResidences',
      `user_residences:${userId}`,
      'residences',
      async () => {
        const result = await db
          .select({
            residenceId: schema.userResidences.residenceId,
          })
          .from(schema.userResidences)
          .where(
            and(eq(schema.userResidences.userId, userId), eq(schema.userResidences.isActive, true))
          );
        return result;
      }
    );
  }

  // Organization operations with optimization

  /**
   * Retrieves all active organizations with caching.
   */
  async getOrganizations(): Promise<Organization[]> {
    return this.withOptimizations('getOrganizations', 'all_organizations', 'organizations', () =>
      db.select().from(schema.organizations).where(eq(schema.organizations.isActive, true))
    );
  }

  /**
   * Retrieves an organization by ID with caching.
   * @param id
   */
  async getOrganization(id: string): Promise<Organization | undefined> {
    return this.withOptimizations(
      'getOrganization',
      `organization:${id}`,
      'organizations',
      async () => {
        const result = await db
          .select()
          .from(schema.organizations)
          .where(eq(schema.organizations.id, id));
        return result[0];
      }
    );
  }

  /**
   * Creates a new organization with cache invalidation.
   * @param insertOrganization
   */
  async createOrganization(insertOrganization: InsertOrganization): Promise<Organization> {
    const result = await dbPerformanceMonitor.trackQuery('createOrganization', async () => {
      return db.insert(schema.organizations).values(insertOrganization).returning();
    });

    // Invalidate organization caches
    queryCache.invalidate('organizations');

    return result[0];
  }

  // Building operations with optimization

  /**
   * Retrieves buildings by organization with caching.
   * @param organizationId
   */
  async getBuildingsByOrganization(organizationId: string): Promise<Building[]> {
    return this.withOptimizations(
      'getBuildingsByOrganization',
      `org_buildings:${organizationId}`,
      'buildings',
      () =>
        db
          .select()
          .from(schema.buildings)
          .where(
            and(
              eq(schema.buildings.organizationId, organizationId),
              eq(schema.buildings.isActive, true)
            )
          )
    );
  }

  /**
   * Retrieves a building by ID with caching.
   * @param id
   */
  async getBuilding(id: string): Promise<Building | undefined> {
    return this.withOptimizations('getBuilding', `building:${id}`, 'buildings', async () => {
      const result = await db.select().from(schema.buildings).where(eq(schema.buildings.id, id));
      return result[0];
    });
  }

  /**
   * Creates a new building with cache invalidation.
   * @param insertBuilding
   */
  async createBuilding(insertBuilding: InsertBuilding): Promise<Building> {
    const result = await dbPerformanceMonitor.trackQuery('createBuilding', async () => {
      return db.insert(schema.buildings).values([insertBuilding]).returning();
    });

    // Invalidate building caches
    CacheInvalidator.invalidateBuildingCaches('*');

    return result[0];
  }

  // Residence operations with optimization

  /**
   * Retrieves residences by building with caching.
   * @param buildingId
   */
  async getResidencesByBuilding(buildingId: string): Promise<Residence[]> {
    return this.withOptimizations(
      'getResidencesByBuilding',
      `building_residences:${buildingId}`,
      'residences',
      () =>
        db
          .select()
          .from(schema.residences)
          .where(
            and(eq(schema.residences.buildingId, buildingId), eq(schema.residences.isActive, true))
          )
          .orderBy(schema.residences.unitNumber)
    );
  }

  /**
   * Retrieves a residence by ID with caching.
   * @param id
   */
  async getResidence(id: string): Promise<Residence | undefined> {
    return this.withOptimizations('getResidence', `residence:${id}`, 'residences', async () => {
      const result = await db.select().from(schema.residences).where(eq(schema.residences.id, id));
      return result[0];
    });
  }

  /**
   * Creates a new residence with cache invalidation.
   * @param insertResidence
   */
  async createResidence(insertResidence: InsertResidence): Promise<Residence> {
    const result = await dbPerformanceMonitor.trackQuery('createResidence', async () => {
      return db.insert(schema.residences).values([insertResidence]).returning();
    });

    // Invalidate residence caches
    CacheInvalidator.invalidateResidenceCaches('*');

    return result[0];
  }

  // Additional optimized methods for frequently accessed data

  /**
   * Gets user residences with full details - for complex residence views.
   * @param userId
   */
  async getUserResidencesWithDetails(userId: string): Promise<any[]> {
    return this.withOptimizations(
      'getUserResidencesWithDetails',
      `user_residences_details:${userId}`,
      'residences',
      () =>
        db
          .select({
            residence: schema.residences,
            building: schema.buildings,
            userResidence: schema.userResidences,
          })
          .from(schema.userResidences)
          .innerJoin(schema.residences, eq(schema.userResidences.residenceId, schema.residences.id))
          .innerJoin(schema.buildings, eq(schema.residences.buildingId, schema.buildings.id))
          .where(
            and(eq(schema.userResidences.userId, userId), eq(schema.userResidences.isActive, true))
          )
    );
  }

  /**
   * Gets active bills for a residence - frequently queried.
   * @param residenceId
   */
  async getActiveBillsByResidence(residenceId: string): Promise<any[]> {
    return this.withOptimizations(
      'getActiveBillsByResidence',
      `residence_bills:${residenceId}`,
      'bills',
      () =>
        db
          .select()
          .from(schema.bills)
          .where(
            and(
              eq(schema.bills.residenceId, residenceId),
              or(eq(schema.bills.status, 'sent'), eq(schema.bills.status, 'overdue'))
            )
          )
          .orderBy(desc(schema.bills.dueDate))
    );
  }

  /**
   * Gets maintenance requests for a residence - frequently accessed.
   * @param residenceId
   */
  async getMaintenanceRequestsByResidence(residenceId: string): Promise<any[]> {
    return this.withOptimizations(
      'getMaintenanceRequestsByResidence',
      `residence_maintenance:${residenceId}`,
      'maintenance',
      () =>
        db
          .select()
          .from(schema.maintenanceRequests)
          .where(eq(schema.maintenanceRequests.residenceId, residenceId))
          .orderBy(desc(schema.maintenanceRequests.createdAt))
    );
  }

  // Missing Organization operations

  /**
   * Gets organization by name with caching.
   * @param name
   */
  async getOrganizationByName(name: string): Promise<Organization | undefined> {
    return this.withOptimizations(
      'getOrganizationByName',
      `org_name:${name}`,
      'organizations',
      async () => {
        const result = await db
          .select()
          .from(schema.organizations)
          .where(eq(schema.organizations.name, name));
        return result[0];
      }
    );
  }

  /**
   * Updates organization with cache invalidation.
   * @param id
   * @param updates
   */
  async updateOrganization(
    id: string,
    updates: Partial<Organization>
  ): Promise<Organization | undefined> {
    const result = await dbPerformanceMonitor.trackQuery('updateOrganization', async () => {
      return db
        .update(schema.organizations)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.organizations.id, id))
        .returning();
    });

    CacheInvalidator.invalidateUserCaches('*');
    return result[0];
  }

  // Missing Building operations

  /**
   * Gets all buildings with caching.
   */
  async getBuildings(): Promise<Building[]> {
    return this.withOptimizations('getBuildings', 'all_buildings', 'buildings', () =>
      db.select().from(schema.buildings).where(eq(schema.buildings.isActive, true))
    );
  }

  /**
   * Updates building with cache invalidation.
   * @param id
   * @param updates
   */
  async updateBuilding(id: string, updates: Partial<Building>): Promise<Building | undefined> {
    const result = await dbPerformanceMonitor.trackQuery('updateBuilding', async () => {
      return db
        .update(schema.buildings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.buildings.id, id))
        .returning();
    });

    CacheInvalidator.invalidateBuildingCaches(id);
    return result[0];
  }

  /**
   * Deletes building (soft delete).
   * @param id
   */
  async deleteBuilding(id: string): Promise<boolean> {
    const result = await dbPerformanceMonitor.trackQuery('deleteBuilding', async () => {
      return db
        .update(schema.buildings)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(schema.buildings.id, id))
        .returning();
    });

    CacheInvalidator.invalidateBuildingCaches(id);
    return result.length > 0;
  }

  // Missing Residence operations

  /**
   * Gets all residences with caching.
   */
  async getResidences(): Promise<Residence[]> {
    return this.withOptimizations('getResidences', 'all_residences', 'residences', () =>
      db.select().from(schema.residences).where(eq(schema.residences.isActive, true))
    );
  }

  /**
   * Updates residence with cache invalidation.
   * @param id
   * @param updates
   */
  async updateResidence(id: string, updates: Partial<Residence>): Promise<Residence | undefined> {
    const result = await dbPerformanceMonitor.trackQuery('updateResidence', async () => {
      return db
        .update(schema.residences)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.residences.id, id))
        .returning();
    });

    CacheInvalidator.invalidateResidenceCaches(id);
    return result[0];
  }

  /**
   * Deletes residence (soft delete).
   * @param id
   */
  async deleteResidence(id: string): Promise<boolean> {
    const result = await dbPerformanceMonitor.trackQuery('deleteResidence', async () => {
      return db
        .update(schema.residences)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(schema.residences.id, id))
        .returning();
    });

    CacheInvalidator.invalidateResidenceCaches(id);
    return result.length > 0;
  }

  // Development Pillar operations

  /**
   * Gets all development pillars.
   */
  async getPillars(): Promise<DevelopmentPillar[]> {
    return this.withOptimizations('getPillars', 'all_pillars', 'pillars', () =>
      db.select().from(schema.developmentPillars)
    );
  }

  /**
   * Gets development pillar by ID.
   * @param id
   */
  async getPillar(id: string): Promise<DevelopmentPillar | undefined> {
    return this.withOptimizations('getPillar', `pillar:${id}`, 'pillars', async () => {
      const result = await db
        .select()
        .from(schema.developmentPillars)
        .where(eq(schema.developmentPillars.id, id));
      return result[0];
    });
  }

  /**
   * Creates development pillar.
   * @param pillar
   */
  async createPillar(pillar: InsertPillar): Promise<DevelopmentPillar> {
    const result = await dbPerformanceMonitor.trackQuery('createPillar', async () => {
      return db.insert(schema.developmentPillars).values(pillar).returning();
    });

    queryCache.invalidate('pillars');
    return result[0];
  }

  /**
   * Updates development pillar.
   * @param id
   * @param pillar
   */
  async updatePillar(
    id: string,
    pillar: Partial<DevelopmentPillar>
  ): Promise<DevelopmentPillar | undefined> {
    const result = await dbPerformanceMonitor.trackQuery('updatePillar', async () => {
      return db
        .update(schema.developmentPillars)
        .set({ ...pillar, updatedAt: new Date() })
        .where(eq(schema.developmentPillars.id, id))
        .returning();
    });

    queryCache.invalidate('pillars');
    return result[0];
  }

  // Workspace Status operations

  /**
   * Gets all workspace statuses.
   */
  async getWorkspaceStatuses(): Promise<WorkspaceStatus[]> {
    return this.withOptimizations(
      'getWorkspaceStatuses',
      'all_workspace_statuses',
      'workspace_status',
      () => db.select().from(schema.workspaceStatus)
    );
  }

  /**
   * Gets workspace status by component.
   * @param component
   */
  async getWorkspaceStatus(component: string): Promise<WorkspaceStatus | undefined> {
    return this.withOptimizations(
      'getWorkspaceStatus',
      `workspace_status:${component}`,
      'workspace_status',
      async () => {
        const result = await db
          .select()
          .from(schema.workspaceStatus)
          .where(eq(schema.workspaceStatus.component, component));
        return result[0];
      }
    );
  }

  /**
   * Creates workspace status.
   * @param status
   */
  async createWorkspaceStatus(status: InsertWorkspaceStatus): Promise<WorkspaceStatus> {
    const result = await dbPerformanceMonitor.trackQuery('createWorkspaceStatus', async () => {
      return db.insert(schema.workspaceStatus).values(status).returning();
    });

    queryCache.invalidate('workspace_status');
    return result[0];
  }

  /**
   * Updates workspace status.
   * @param component
   * @param status
   */
  async updateWorkspaceStatus(
    component: string,
    status: string
  ): Promise<WorkspaceStatus | undefined> {
    const result = await dbPerformanceMonitor.trackQuery('updateWorkspaceStatus', async () => {
      return db
        .update(schema.workspaceStatus)
        .set({ status })
        .where(eq(schema.workspaceStatus.component, component))
        .returning();
    });

    queryCache.invalidate('workspace_status');
    return result[0];
  }

  // Quality Metrics operations

  /**
   * Gets all quality metrics.
   */
  async getQualityMetrics(): Promise<QualityMetric[]> {
    return this.withOptimizations(
      'getQualityMetrics',
      'all_quality_metrics',
      'quality_metrics',
      () => db.select().from(schema.qualityMetrics)
    );
  }

  /**
   * Creates quality metric.
   * @param metric
   */
  async createQualityMetric(metric: InsertQualityMetric): Promise<QualityMetric> {
    const result = await dbPerformanceMonitor.trackQuery('createQualityMetric', async () => {
      return db.insert(schema.qualityMetrics).values(metric).returning();
    });

    queryCache.invalidate('quality_metrics');
    return result[0];
  }

  // Framework Configuration operations

  /**
   * Gets all framework configurations.
   */
  async getFrameworkConfigs(): Promise<FrameworkConfiguration[]> {
    return this.withOptimizations(
      'getFrameworkConfigs',
      'all_framework_configs',
      'framework_configs',
      () => db.select().from(schema.frameworkConfiguration)
    );
  }

  /**
   * Gets framework config by key.
   * @param key
   * @param _key
   */
  async getFrameworkConfig(_key: string): Promise<FrameworkConfiguration | undefined> {
    return this.withOptimizations(
      'getFrameworkConfig',
      `framework_config:${_key}`,
      'framework_configs',
      async () => {
        const result = await db
          .select()
          .from(schema.frameworkConfiguration)
          .where(eq(schema.frameworkConfiguration._key, _key));
        return result[0];
      }
    );
  }

  /**
   * Sets framework configuration.
   * @param config
   */
  async setFrameworkConfig(config: InsertFrameworkConfiguration): Promise<FrameworkConfiguration> {
    const result = await dbPerformanceMonitor.trackQuery('setFrameworkConfig', async () => {
      return db
        .insert(schema.frameworkConfiguration)
        .values(config)
        .onConflictDoUpdate({
          target: schema.frameworkConfiguration._key,
          set: { _value: config._value, updatedAt: new Date() },
        })
        .returning();
    });

    queryCache.invalidate('framework_configs');
    return result[0];
  }

  // Improvement Suggestions operations

  /**
   * Gets all improvement suggestions.
   */
  async getImprovementSuggestions(): Promise<ImprovementSuggestion[]> {
    return this.withOptimizations(
      'getImprovementSuggestions',
      'all_improvement_suggestions',
      'improvement_suggestions',
      () => db.select().from(schema.improvementSuggestions)
    );
  }

  /**
   * Gets top improvement suggestions.
   * @param limit
   */
  async getTopImprovementSuggestions(limit: number): Promise<ImprovementSuggestion[]> {
    return this.withOptimizations(
      'getTopImprovementSuggestions',
      `top_suggestions:${limit}`,
      'improvement_suggestions',
      () =>
        db
          .select()
          .from(schema.improvementSuggestions)
          .orderBy(
            desc(schema.improvementSuggestions.priority),
            desc(schema.improvementSuggestions.createdAt)
          )
          .limit(limit)
    );
  }

  /**
   * Creates improvement suggestion.
   * @param suggestion
   */
  async createImprovementSuggestion(
    suggestion: InsertImprovementSuggestion
  ): Promise<ImprovementSuggestion> {
    const result = await dbPerformanceMonitor.trackQuery(
      'createImprovementSuggestion',
      async () => {
        return db
          .insert(schema.improvementSuggestions)
          .values([
            {
              ...suggestion,
              category: suggestion.category as
                | 'Code Quality'
                | 'Security'
                | 'Testing'
                | 'Documentation'
                | 'Performance'
                | 'Continuous Improvement'
                | 'Replit AI Agent Monitoring'
                | 'Replit App',
            },
          ])
          .returning();
      }
    );

    queryCache.invalidate('improvement_suggestions');
    return result[0];
  }

  /**
   * Clears new suggestions.
   */
  async clearNewSuggestions(): Promise<void> {
    await dbPerformanceMonitor.trackQuery('clearNewSuggestions', async () => {
      return db
        .update(schema.improvementSuggestions)
        .set({ status: 'Acknowledged' })
        .where(eq(schema.improvementSuggestions.status, 'New'));
    });

    queryCache.invalidate('improvement_suggestions');
  }

  /**
   * Updates suggestion status.
   * @param id
   * @param status
   */
  async updateSuggestionStatus(
    id: string,
    status: 'New' | 'Acknowledged' | 'Done'
  ): Promise<ImprovementSuggestion | undefined> {
    const result = await dbPerformanceMonitor.trackQuery('updateSuggestionStatus', async () => {
      return db
        .update(schema.improvementSuggestions)
        .set({ status })
        .where(eq(schema.improvementSuggestions.id, id))
        .returning();
    });

    queryCache.invalidate('improvement_suggestions');
    return result[0];
  }

  // Features operations

  /**
   * Gets all features.
   */
  async getFeatures(): Promise<Feature[]> {
    return this.withOptimizations('getFeatures', 'all_features', 'features', () =>
      db.select().from(schema.features)
    );
  }

  /**
   * Gets features by status.
   * @param status
   */
  async getFeaturesByStatus(
    status: 'completed' | 'in-progress' | 'planned' | 'cancelled' | 'requested'
  ): Promise<Feature[]> {
    return this.withOptimizations(
      'getFeaturesByStatus',
      `features_status:${status}`,
      'features',
      () =>
        db
          .select()
          .from(schema.features)
          .where(eq(schema.features.status, status as any))
    );
  }

  /**
   * Gets features by category.
   * @param category
   */
  async getFeaturesByCategory(category: string): Promise<Feature[]> {
    return this.withOptimizations(
      'getFeaturesByCategory',
      `features_category:${category}`,
      'features',
      () =>
        db
          .select()
          .from(schema.features)
          .where(eq(schema.features.category, category as any))
    );
  }

  /**
   * Gets public roadmap features.
   */
  async getPublicRoadmapFeatures(): Promise<Feature[]> {
    return this.withOptimizations(
      'getPublicRoadmapFeatures',
      'public_roadmap_features',
      'features',
      () => db.select().from(schema.features).where(eq(schema.features.isPublicRoadmap, true))
    );
  }

  /**
   * Creates feature.
   * @param feature
   */
  async createFeature(feature: InsertFeature): Promise<Feature> {
    const result = await dbPerformanceMonitor.trackQuery('createFeature', async () => {
      return db.insert(schema.features).values([feature]).returning();
    });

    queryCache.invalidate('features');
    return result[0];
  }

  /**
   * Updates feature.
   * @param id
   * @param updates
   */
  async updateFeature(id: string, updates: Partial<InsertFeature>): Promise<Feature | undefined> {
    const result = await dbPerformanceMonitor.trackQuery('updateFeature', async () => {
      return db
        .update(schema.features)
        .set(updates as any)
        .where(eq(schema.features.id, id))
        .returning();
    });

    queryCache.invalidate('features');
    return result[0];
  }

  /**
   * Deletes feature.
   * @param id
   */
  async deleteFeature(id: string): Promise<boolean> {
    const result = await dbPerformanceMonitor.trackQuery('deleteFeature', async () => {
      return db.delete(schema.features).where(eq(schema.features.id, id)).returning();
    });

    queryCache.invalidate('features');
    return result.length > 0;
  }

  // Actionable Items operations

  /**
   * Gets actionable items by feature.
   * @param featureId
   */
  async getActionableItemsByFeature(featureId: string): Promise<ActionableItem[]> {
    return this.withOptimizations(
      'getActionableItemsByFeature',
      `actionable_items:${featureId}`,
      'actionable_items',
      () =>
        db
          .select()
          .from(schema.actionableItems)
          .where(eq(schema.actionableItems.featureId, featureId))
    );
  }

  /**
   * Gets actionable item by ID.
   * @param id
   */
  async getActionableItem(id: string): Promise<ActionableItem | undefined> {
    return this.withOptimizations(
      'getActionableItem',
      `actionable_item:${id}`,
      'actionable_items',
      async () => {
        const result = await db
          .select()
          .from(schema.actionableItems)
          .where(eq(schema.actionableItems.id, id));
        return result[0];
      }
    );
  }

  /**
   * Creates actionable item.
   * @param item
   */
  async createActionableItem(item: InsertActionableItem): Promise<ActionableItem> {
    const result = await dbPerformanceMonitor.trackQuery('createActionableItem', async () => {
      return db.insert(schema.actionableItems).values([item]).returning();
    });

    queryCache.invalidate('actionable_items');
    return result[0];
  }

  /**
   * Creates multiple actionable items.
   * @param items
   */
  async createActionableItems(items: InsertActionableItem[]): Promise<ActionableItem[]> {
    const result = await dbPerformanceMonitor.trackQuery('createActionableItems', async () => {
      return db.insert(schema.actionableItems).values(items).returning();
    });

    queryCache.invalidate('actionable_items');
    return result;
  }

  /**
   * Updates actionable item.
   * @param id
   * @param updates
   */
  async updateActionableItem(
    id: string,
    updates: Partial<ActionableItem>
  ): Promise<ActionableItem | undefined> {
    const result = await dbPerformanceMonitor.trackQuery('updateActionableItem', async () => {
      return db
        .update(schema.actionableItems)
        .set(updates as any)
        .where(eq(schema.actionableItems.id, id))
        .returning();
    });

    queryCache.invalidate('actionable_items');
    return result[0];
  }

  /**
   * Deletes actionable item.
   * @param id
   */
  async deleteActionableItem(id: string): Promise<boolean> {
    const result = await dbPerformanceMonitor.trackQuery('deleteActionableItem', async () => {
      return db.delete(schema.actionableItems).where(eq(schema.actionableItems.id, id)).returning();
    });

    queryCache.invalidate('actionable_items');
    return result.length > 0;
  }

  /**
   * Deletes actionable items by feature.
   * @param featureId
   */
  async deleteActionableItemsByFeature(featureId: string): Promise<boolean> {
    const result = await dbPerformanceMonitor.trackQuery(
      'deleteActionableItemsByFeature',
      async () => {
        return db
          .delete(schema.actionableItems)
          .where(eq(schema.actionableItems.featureId, featureId))
          .returning();
      }
    );

    queryCache.invalidate('actionable_items');
    return result.length > 0;
  }

  // Invitation operations

  /**
   * Gets all invitations.
   */
  async getInvitations(): Promise<Invitation[]> {
    return this.withOptimizations('getInvitations', 'all_invitations', 'invitations', () =>
      db.select().from(schema.invitations)
    );
  }

  /**
   * Gets invitation by ID.
   * @param id
   */
  async getInvitation(id: string): Promise<Invitation | undefined> {
    return this.withOptimizations('getInvitation', `invitation:${id}`, 'invitations', async () => {
      const result = await db
        .select()
        .from(schema.invitations)
        .where(eq(schema.invitations.id, id));
      return result[0];
    });
  }

  /**
   * Gets invitation by token.
   * @param token
   */
  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    return this.withOptimizations(
      'getInvitationByToken',
      `invitation_token:${token}`,
      'invitations',
      async () => {
        const result = await db
          .select()
          .from(schema.invitations)
          .where(eq(schema.invitations.token, token));
        return result[0];
      }
    );
  }

  /**
   * Gets invitations by email.
   * @param email
   */
  async getInvitationsByEmail(email: string): Promise<Invitation[]> {
    return this.withOptimizations(
      'getInvitationsByEmail',
      `invitations_email:${email}`,
      'invitations',
      () => db.select().from(schema.invitations).where(eq(schema.invitations.email, email))
    );
  }

  /**
   * Gets invitations by inviter.
   * @param userId
   */
  async getInvitationsByInviter(userId: string): Promise<Invitation[]> {
    return this.withOptimizations(
      'getInvitationsByInviter',
      `invitations_inviter:${userId}`,
      'invitations',
      () =>
        db.select().from(schema.invitations).where(eq(schema.invitations.invitedByUserId, userId))
    );
  }

  /**
   * Gets invitations by status.
   * @param status
   */
  async getInvitationsByStatus(
    status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  ): Promise<Invitation[]> {
    return this.withOptimizations(
      'getInvitationsByStatus',
      `invitations_status:${status}`,
      'invitations',
      () => db.select().from(schema.invitations).where(eq(schema.invitations.status, status))
    );
  }

  /**
   * Creates invitation.
   * @param invitation
   */
  async createInvitation(invitation: InsertInvitation): Promise<Invitation> {
    const result = await dbPerformanceMonitor.trackQuery('createInvitation', async () => {
      return db.insert(schema.invitations).values([invitation]).returning();
    });

    queryCache.invalidate('invitations');
    return result[0];
  }

  /**
   * Updates invitation.
   * @param id
   * @param updates
   */
  async updateInvitation(
    id: string,
    updates: Partial<Invitation>
  ): Promise<Invitation | undefined> {
    const result = await dbPerformanceMonitor.trackQuery('updateInvitation', async () => {
      return db
        .update(schema.invitations)
        .set(updates as any)
        .where(eq(schema.invitations.id, id))
        .returning();
    });

    queryCache.invalidate('invitations');
    return result[0];
  }

  /**
   * Accepts invitation.
   * @param token
   * @param userData
   * @param userData.firstName
   * @param ipAddress
   * @param userData.lastName
   * @param userAgent
   * @param userData.password
   */
  async acceptInvitation(
    token: string,
    userData: { firstName: string; lastName: string; password: string },
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ user: User; invitation: Invitation } | null> {
    return dbPerformanceMonitor.trackQuery('acceptInvitation', async () => {
      const invitation = await this.getInvitationByToken(token);
      if (!invitation || invitation.status !== 'pending') {
        return null;
      }

      // Create user with required fields
      const user = await this.createUser({
        username: invitation.email.split('@')[0], // Use email prefix as username
        email: invitation.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        password: userData.password, // This should be hashed
        language: 'en', // Default language
        role: invitation.role,
      });

      // Update invitation
      const updatedInvitation = await this.updateInvitation(invitation.id, {
        status: 'accepted',
        acceptedAt: new Date(),
      });

      return { user, invitation: updatedInvitation! };
    });
  }

  /**
   * Cancels invitation.
   * @param id
   * @param cancelledBy
   */
  async cancelInvitation(id: string, cancelledBy: string): Promise<Invitation | undefined> {
    const result = await dbPerformanceMonitor.trackQuery('cancelInvitation', async () => {
      return db
        .update(schema.invitations)
        .set({
          status: 'cancelled',
          cancelledBy,
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.invitations.id, id))
        .returning();
    });

    queryCache.invalidate('invitations');
    return result[0];
  }

  /**
   * Expires old invitations.
   */
  async expireInvitations(): Promise<number> {
    const result = await dbPerformanceMonitor.trackQuery('expireInvitations', async () => {
      return db
        .update(schema.invitations)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(
          and(
            eq(schema.invitations.status, 'pending'),
            lte(schema.invitations.expiresAt, new Date())
          )
        )
        .returning();
    });

    queryCache.invalidate('invitations');
    return result.length;
  }

  /**
   * Deletes invitation.
   * @param id
   */
  async deleteInvitation(id: string): Promise<boolean> {
    const result = await dbPerformanceMonitor.trackQuery('deleteInvitation', async () => {
      return db.delete(schema.invitations).where(eq(schema.invitations.id, id)).returning();
    });

    queryCache.invalidate('invitations');
    return result.length > 0;
  }

  // Invitation Audit Log operations

  /**
   * Gets invitation audit logs.
   * @param invitationId
   */
  async getInvitationAuditLogs(invitationId: string): Promise<InvitationAuditLog[]> {
    return this.withOptimizations(
      'getInvitationAuditLogs',
      `invitation_logs:${invitationId}`,
      'invitation_logs',
      () =>
        db
          .select()
          .from(schema.invitationAuditLog)
          .where(eq(schema.invitationAuditLog.invitationId, invitationId))
          .orderBy(desc(schema.invitationAuditLog.createdAt))
    );
  }

  /**
   * Creates invitation audit log.
   * @param logEntry
   */
  async createInvitationAuditLog(logEntry: InsertInvitationAuditLog): Promise<InvitationAuditLog> {
    const result = await dbPerformanceMonitor.trackQuery('createInvitationAuditLog', async () => {
      return db.insert(schema.invitationAuditLog).values(logEntry).returning();
    });

    queryCache.invalidate('invitation_logs');
    return result[0];
  }

  // Permission operations

  /**
   * Gets all permissions.
   */
  async getPermissions(): Promise<Permission[]> {
    return this.withOptimizations('getPermissions', 'permissions:all', 'permissions', () =>
      db
        .select()
        .from(schema.permissions)
        .where(eq(schema.permissions.isActive, true))
        .orderBy(schema.permissions.resourceType, schema.permissions.action)
    );
  }

  /**
   * Gets all role permissions.
   */
  async getRolePermissions(): Promise<RolePermission[]> {
    return this.withOptimizations(
      'getRolePermissions',
      'role_permissions:all',
      'role_permissions',
      () =>
        db
          .select()
          .from(schema.rolePermissions)
          .innerJoin(
            schema.permissions,
            eq(schema.rolePermissions.permissionId, schema.permissions.id)
          )
          .where(eq(schema.permissions.isActive, true))
          .orderBy(schema.rolePermissions.role, schema.permissions.resourceType)
    );
  }

  /**
   * Gets all user permissions.
   */
  async getUserPermissions(): Promise<UserPermission[]> {
    try {
      const results = await db
        .select()
        .from(schema.userPermissions)
        .innerJoin(
          schema.permissions,
          eq(schema.userPermissions.permissionId, schema.permissions.id)
        )
        .where(eq(schema.permissions.isActive, true))
        .orderBy(schema.userPermissions.userId);

      return results || [];
    } catch (error: any) {
      console.error('❌ Error getting user permissions:', error);
      return [];
    }
  }

  // Old building document methods removed - using unified documents table

  // Unified Document operations
  async getDocuments(filters?: {
    buildingId?: string;
    residenceId?: string;
    documentType?: string;
    userId?: string;
    userRole?: string;
  }): Promise<Document[]> {
    return this.withOptimizations(
      'getDocuments',
      `documents:${JSON.stringify(filters)}`,
      'documents',
      async () => {
        let query = db.select().from(schema.documents);

        const conditions = [];
        if (filters?.buildingId) {
          conditions.push(eq(schema.documents.buildingId, filters.buildingId));
        }
        if (filters?.residenceId) {
          conditions.push(eq(schema.documents.residenceId, filters.residenceId));
        }
        if (filters?.documentType) {
          conditions.push(eq(schema.documents.documentType, filters.documentType));
        }

        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }

        const result = await query.orderBy(desc(schema.documents.createdAt));
        return result || [];
      }
    );
  }

  async getDocument(id: string): Promise<Document | undefined> {
    return this.withOptimizations('getDocument', `document:${id}`, 'documents', async () => {
      const result = await db
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.id, id))
        .limit(1);
      return result[0];
    });
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    return dbPerformanceMonitor.trackQuery('createDocument', async () => {
      
      const result = await db.insert(schema.documents).values(document).returning();
      

      // Invalidate related caches
      if (document.buildingId) {
        queryCache.invalidate('documents', `*buildingId*${document.buildingId}*`);
      }
      if (document.residenceId) {
        queryCache.invalidate('documents', `*residenceId*${document.residenceId}*`);
      }

      return result[0];
    });
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined> {
    return dbPerformanceMonitor.trackQuery('updateDocument', async () => {
      const result = await db
        .update(schema.documents)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.documents.id, id))
        .returning();

      if (result[0]) {
        // Invalidate caches
        queryCache.invalidate('documents', `document:${id}`);
        queryCache.invalidate('documents', '*');
      }

      return result[0];
    });
  }

  async deleteDocument(id: string): Promise<boolean> {
    return dbPerformanceMonitor.trackQuery('deleteDocument', async () => {
      const result = await db
        .delete(schema.documents)
        .where(eq(schema.documents.id, id))
        .returning({ id: schema.documents.id });

      if (result.length > 0) {
        // Invalidate caches
        queryCache.invalidate('documents', `document:${id}`);
        queryCache.invalidate('documents', '*');
        return true;
      }

      return false;
    });
  }

  // Old resident document methods removed - using unified documents table

  // Legacy Document operations (kept for migration purposes)

  /**
   * Gets legacy documents for user.
   * @param userId
   * @param userRole
   * @param organizationId
   * @param residenceIds
   */
  async getDocumentsForUser(
    userId: string,
    userRole: string,
    organizationId?: string,
    residenceIds?: string[]
  ): Promise<Document[]> {
    return this.withOptimizations(
      'getDocumentsForUser',
      `legacy_docs:${userId}:${userRole}`,
      'documents',
      async () => {
        return await db.select().from(schema.documents).orderBy(desc(schema.documents.createdAt));
      }
    );
  }

  // Password reset operations
  /**
   *
   * @param token
   */
  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const result = await db.insert(schema.passwordResetTokens).values(token).returning();

    // Token created successfully

    return result[0];
  }

  /**
   *
   * @param tokenValue
   */
  async getPasswordResetToken(tokenValue: string): Promise<PasswordResetToken | undefined> {
    return this.withOptimizations(
      'getPasswordResetToken',
      `token_${tokenValue}`,
      'password_reset_tokens',
      async () => {
        const result = await db
          .select()
          .from(schema.passwordResetTokens)
          .where(eq(schema.passwordResetTokens.token, tokenValue))
          .limit(1);
        return result[0];
      }
    );
  }

  /**
   *
   * @param tokenId
   */
  async markPasswordResetTokenAsUsed(tokenId: string): Promise<PasswordResetToken | undefined> {
    const result = await db
      .update(schema.passwordResetTokens)
      .set({
        isUsed: true,
        usedAt: new Date(),
      })
      .where(eq(schema.passwordResetTokens.id, tokenId))
      .returning();

    // Token marked as used

    return result[0];
  }

  /**
   *
   */
  async cleanupExpiredPasswordResetTokens(): Promise<number> {
    const result = await db
      .delete(schema.passwordResetTokens)
      .where(lte(schema.passwordResetTokens.expiresAt, new Date()))
      .returning();

    // Expired tokens cleaned up

    return result.length;
  }

  // Contact operations
  /**
   * Gets all contacts.
   */
  async getContacts(): Promise<Contact[]> {
    return this.withOptimizations('getContacts', 'all_contacts', 'contacts', () =>
      db.select().from(schema.contacts).where(eq(schema.contacts.isActive, true))
    );
  }

  /**
   * Gets contacts by entity.
   * @param entityId
   * @param entity
   */
  async getContactsByEntity(
    entityId: string,
    entity: 'organization' | 'building' | 'residence'
  ): Promise<Contact[]> {
    return this.withOptimizations(
      'getContactsByEntity',
      `contacts_entity:${entity}_${entityId}`,
      'contacts',
      () =>
        db
          .select()
          .from(schema.contacts)
          .where(
            and(
              eq(schema.contacts.entityId, entityId),
              eq(schema.contacts.entity, entity),
              eq(schema.contacts.isActive, true)
            )
          )
    );
  }

  /**
   * Gets contacts for residence with user data.
   * @param residenceId
   */
  async getContactsForResidence(residenceId: string): Promise<Array<Contact & { user: User }>> {
    return this.withOptimizations(
      'getContactsForResidence',
      `contacts_residence:${residenceId}`,
      'contacts',
      () =>
        db
          .select()
          .from(schema.contacts)
          .innerJoin(schema.users, eq(schema.contacts.name, schema.users.email))
          .where(
            and(
              eq(schema.contacts.entityId, residenceId),
              eq(schema.contacts.entity, 'residence'),
              eq(schema.contacts.isActive, true)
            )
          )
    );
  }

  /**
   * Creates a new contact.
   * @param contact
   */
  async createContact(contact: InsertContact): Promise<Contact> {
    const result = await dbPerformanceMonitor.trackQuery('createContact', async () => {
      return db.insert(schema.contacts).values(contact).returning();
    });

    queryCache.invalidate('contacts');
    return result[0];
  }

  /**
   * Updates a contact.
   * @param id
   * @param updates
   */
  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact | undefined> {
    const result = await dbPerformanceMonitor.trackQuery('updateContact', async () => {
      return db
        .update(schema.contacts)
        .set(updates as any)
        .where(eq(schema.contacts.id, id))
        .returning();
    });

    queryCache.invalidate('contacts');
    return result[0];
  }

  /**
   * Deletes a contact.
   * @param id
   */
  async deleteContact(id: string): Promise<boolean> {
    const result = await dbPerformanceMonitor.trackQuery('deleteContact', async () => {
      return db
        .update(schema.contacts)
        .set({ isActive: false })
        .where(eq(schema.contacts.id, id))
        .returning();
    });

    queryCache.invalidate('contacts');
    return result.length > 0;
  }

  /**
   * Gets demands for a user.
   * @param userId
   */
  async getDemandsForUser(userId: string): Promise<any[]> {
    return this.withOptimizations('getDemandsForUser', `demands_user:${userId}`, 'demands', () =>
      db.select().from(schema.demands).where(eq(schema.demands.userId, userId))
    );
  }

  /**
   * Gets a specific demand.
   * @param id
   */
  async getDemand(id: string): Promise<any | undefined> {
    return this.withOptimizations('getDemand', `demand:${id}`, 'demands', async () => {
      const result = await db.select().from(schema.demands).where(eq(schema.demands.id, id));
      return result[0];
    });
  }

  // Bug operations implementation
  /**
   *
   * @param userId
   * @param userRole
   * @param organizationId
   */
  async getBugsForUser(userId: string, userRole: string, organizationId?: string): Promise<Bug[]> {
    return this.withOptimizations(
      'getBugsForUser',
      `bugs:${userRole}:${userId}`,
      'bugs',
      async () => {
        let results;
        
        if (userRole === 'admin') {
          // Admin can see all bugs
          results = await db
            .select()
            .from(schema.bugs)
            .orderBy(desc(schema.bugs.createdAt));
        } else if (userRole === 'manager' && organizationId) {
          // For managers, return all bugs for now (can be refined later)
          results = await db
            .select()
            .from(schema.bugs)
            .orderBy(desc(schema.bugs.createdAt));
        } else {
          // For residents and tenants, return only their own bugs
          results = await db
            .select()
            .from(schema.bugs)
            .where(eq(schema.bugs.createdBy, userId))
            .orderBy(desc(schema.bugs.createdAt));
        }

        // Get attachment counts and details for each bug
        const bugsWithAttachments = await Promise.all(
          results.map(async (bug) => {
            const attachments = await db
              .select({
                id: schema.documents.id,
                name: schema.documents.name,
                fileName: schema.documents.fileName,
                fileSize: schema.documents.fileSize,
                filePath: schema.documents.filePath,
              })
              .from(schema.documents)
              .where(
                and(
                  eq(schema.documents.attachedToType, 'bug'),
                  eq(schema.documents.attachedToId, bug.id)
                )
              );

            return {
              ...bug,
              attachmentCount: attachments.length,
              attachments: attachments.map(att => ({
                id: att.id,
                name: att.fileName || att.name,
                size: parseInt(att.fileSize || '0'),
                url: `/api/documents/${att.id}/file`,
                type: att.fileName ? att.fileName.split('.').pop()?.toLowerCase() || 'unknown' : 'unknown'
              }))
            };
          })
        );

        return bugsWithAttachments;
      }
    );
  }

  /**
   *
   * @param id
   * @param userId
   * @param userRole
   * @param organizationId
   */
  async getBug(
    id: string,
    userId: string,
    userRole: string,
    organizationId?: string
  ): Promise<Bug | undefined> {
    const key = `bug:${id}:user:${userId}:${userRole}`;

    console.log(`🔍 getBug called with key: ${key}`);

    return withCache('bug', key, async () => {
      console.log(`📊 Cache miss for ${key}, querying database...`);
      const result = await db.select().from(schema.bugs).where(eq(schema.bugs.id, id));

      const bug = result[0];
      console.log(`📋 Database query result:`, bug ? { id: bug.id, title: bug.title, filePath: bug.filePath, file_path: (bug as any).file_path } : 'undefined');

      if (!bug) {
        return undefined;
      }

      if (userRole === 'admin') {
        return bug;
      }

      if (userRole === 'manager') {
        return bug; // Managers can see all bugs for now
      }

      // Residents and tenants can only see their own bugs
      return bug.createdBy === userId ? bug : undefined;
    });
  }

  /**
   *
   * @param bugData
   */
  async createBug(bugData: InsertBug): Promise<Bug> {
    const result = await db
      .insert(schema.bugs)
      .values({
        ...bugData,
        id: crypto.randomUUID(),
        status: 'new',
        assignedTo: null,
        resolvedAt: null,
        resolvedBy: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Invalidate cache for this user and specific bug queries  
    queryCache.invalidate('bugs');
    queryCache.invalidate('bug', `bug:${result[0].id}:*`);

    return result[0];
  }

  /**
   *
   * @param id
   * @param updates
   * @param userId
   * @param userRole
   */
  async updateBug(
    id: string,
    updates: Partial<Bug>,
    userId: string,
    userRole: string
  ): Promise<Bug | undefined> {
    // First check if the bug exists and get its current data
    const [existingBug] = await db.select().from(schema.bugs).where(eq(schema.bugs.id, id));

    if (!existingBug) {
      return undefined;
    }

    // Access control: users can edit their own bugs, admins and managers can edit any bug
    const canEdit =
      userRole === 'admin' || userRole === 'manager' || existingBug.createdBy === userId;

    if (!canEdit) {
      return undefined;
    }

    const result = await db
      .update(schema.bugs)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.bugs.id, id))
      .returning();

    if (result[0]) {
      // Invalidate related cache entries
      queryCache.invalidate('bugs');
    }

    return result[0];
  }

  /**
   *
   * @param id
   * @param userId
   * @param userRole
   */
  async deleteBug(id: string, userId: string, userRole: string): Promise<boolean> {
    // First check if the bug exists and get its current data
    const [existingBug] = await db.select().from(schema.bugs).where(eq(schema.bugs.id, id));

    if (!existingBug) {
      return false;
    }

    // Access control: users can delete their own bugs, admins can delete any bug
    const canDelete = userRole === 'admin' || existingBug.createdBy === userId;

    if (!canDelete) {
      return false;
    }

    const result = await db.delete(schema.bugs).where(eq(schema.bugs.id, id)).returning();

    if (result.length > 0) {
      // Invalidate related cache entries
      queryCache.invalidate('bugs');
      return true;
    }

    return false;
  }

  // Feature Request operations with optimization

  /**
   * Retrieves feature requests for a user with role-based access control.
   * @param userId
   * @param userRole
   * @param organizationId
   */
  async getFeatureRequestsForUser(
    userId: string,
    userRole: string,
    organizationId?: string
  ): Promise<FeatureRequest[]> {
    return this.withOptimizations(
      'getFeatureRequestsForUser',
      `feature_requests:${userRole}:${userId}`,
      'feature_requests',
      async () => {
        const results = await db
          .select()
          .from(schema.featureRequests)
          .orderBy(desc(schema.featureRequests.createdAt));

        // Get attachment counts and details for each feature request
        const requestsWithAttachments = await Promise.all(
          results.map(async (request) => {
            const attachments = await db
              .select({
                id: schema.documents.id,
                name: schema.documents.name,
                filePath: schema.documents.filePath,
                fileSize: schema.documents.fileSize,
                mimeType: schema.documents.mimeType,
              })
              .from(schema.documents)
              .where(
                and(
                  eq(schema.documents.attachedToType, 'feature_request'),
                  eq(schema.documents.attachedToId, request.id)
                )
              );

            return {
              ...request,
              attachmentCount: attachments.length,
              attachments: attachments.map(att => ({
                id: att.id,
                name: att.name,
                url: `/api/documents/${att.id}/file`,
                size: att.fileSize ? parseInt(att.fileSize) : 0,
                mimeType: att.mimeType,
              })),
            };
          })
        );

        // All users can see all feature requests, but non-admins don't see who submitted
        if (userRole === 'admin') {
          return requestsWithAttachments;
        }

        // For non-admin users, hide the createdBy field
        return requestsWithAttachments.map((request) => ({
          ...request,
          createdBy: null as any,
        }));
      }
    );
  }

  /**
   * Retrieves a specific feature request by ID with role-based access control.
   * @param id
   * @param userId
   * @param userRole
   * @param organizationId
   */
  async getFeatureRequest(
    id: string,
    userId: string,
    userRole: string,
    organizationId?: string
  ): Promise<FeatureRequest | undefined> {
    return this.withOptimizations(
      'getFeatureRequest',
      `feature_request:${id}:${userRole}`,
      'feature_requests',
      async () => {
        const result = await db
          .select()
          .from(schema.featureRequests)
          .where(eq(schema.featureRequests.id, id));

        const featureRequest = result[0];
        if (!featureRequest) {
          return undefined;
        }

        // All users can see any feature request
        if (userRole === 'admin') {
          return featureRequest;
        }

        // For non-admin users, hide the createdBy field
        return {
          ...featureRequest,
          createdBy: null as any,
        };
      }
    );
  }

  /**
   * Creates a new feature request.
   * @param featureRequestData
   */
  async createFeatureRequest(featureRequestData: InsertFeatureRequest): Promise<FeatureRequest> {
    const result = await dbPerformanceMonitor.trackQuery('createFeatureRequest', async () => {
      return db
        .insert(schema.featureRequests)
        .values({
          ...featureRequestData,
          id: crypto.randomUUID(),
          status: 'submitted',
          upvoteCount: 0,
          assignedTo: null,
          reviewedBy: null,
          reviewedAt: null,
          adminNotes: null,
          mergedIntoId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
    });

    // Invalidate cache
    queryCache.invalidate('feature_requests');

    return result[0];
  }

  /**
   * Updates a feature request with role-based permissions.
   * Users can edit their own, managers can edit within org, admins can edit all.
   * @param id
   * @param updates
   * @param userId
   * @param userRole
   */
  async updateFeatureRequest(
    id: string,
    updates: Partial<FeatureRequest>,
    userId: string,
    userRole: string
  ): Promise<FeatureRequest | undefined> {
    // Get existing feature request to check permissions
    const existingFeatureRequest = await db
      .select()
      .from(schema.featureRequests)
      .where(eq(schema.featureRequests.id, id))
      .limit(1);

    if (!existingFeatureRequest[0]) {
      return undefined;
    }

    // Check permissions: users can edit their own, admins can edit all
    const canEdit = userRole === 'admin' || existingFeatureRequest[0].createdBy === userId;

    if (!canEdit) {
      return undefined;
    }

    const result = await dbPerformanceMonitor.trackQuery('updateFeatureRequest', async () => {
      return db
        .update(schema.featureRequests)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(schema.featureRequests.id, id))
        .returning();
    });

    if (result[0]) {
      // Invalidate related cache entries
      queryCache.invalidate('feature_requests');
    }

    return result[0];
  }

  /**
   * Deletes a feature request (admin only).
   * @param id
   * @param userId
   * @param userRole
   */
  async deleteFeatureRequest(id: string, userId: string, userRole: string): Promise<boolean> {
    // Only admins can delete feature requests
    if (userRole !== 'admin') {
      return false;
    }

    // First delete all upvotes for this feature request
    await db
      .delete(schema.featureRequestUpvotes)
      .where(eq(schema.featureRequestUpvotes.featureRequestId, id));

    const result = await db
      .delete(schema.featureRequests)
      .where(eq(schema.featureRequests.id, id))
      .returning();

    if (result.length > 0) {
      // Invalidate related cache entries
      queryCache.invalidate('feature_requests');
      queryCache.invalidate('feature_request_upvotes');
      return true;
    }

    return false;
  }

  /**
   * Upvotes a feature request.
   * @param upvoteData
   */
  async upvoteFeatureRequest(
    upvoteData: InsertFeatureRequestUpvote
  ): Promise<{ success: boolean; message: string; data?: any }> {
    const { featureRequestId, userId } = upvoteData;

    try {
      // Check if feature request exists
      const featureRequestResult = await db
        .select()
        .from(schema.featureRequests)
        .where(eq(schema.featureRequests.id, featureRequestId));

      if (featureRequestResult.length === 0) {
        return {
          success: false,
          message: 'Feature request not found',
        };
      }

      // Check if user has already upvoted this feature request
      const existingUpvote = await db
        .select()
        .from(schema.featureRequestUpvotes)
        .where(
          and(
            eq(schema.featureRequestUpvotes.featureRequestId, featureRequestId),
            eq(schema.featureRequestUpvotes.userId, userId)
          )
        );

      if (existingUpvote.length > 0) {
        return {
          success: false,
          message: 'You have already upvoted this feature request',
        };
      }

      // Create the upvote
      const upvoteResult = await db
        .insert(schema.featureRequestUpvotes)
        .values({
          ...upvoteData,
          id: crypto.randomUUID(),
          createdAt: new Date(),
        })
        .returning();

      // Update the upvote count on the feature request
      const updatedFeatureRequest = await db
        .update(schema.featureRequests)
        .set({
          upvoteCount: sql`${schema.featureRequests.upvoteCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.featureRequests.id, featureRequestId))
        .returning();

      // Invalidate cache
      queryCache.invalidate('feature_requests');
      queryCache.invalidate('feature_request_upvotes');

      return {
        success: true,
        message: 'Feature request upvoted successfully',
        data: {
          upvote: upvoteResult[0],
          featureRequest: updatedFeatureRequest[0],
        },
      };
    } catch (error: any) {
      console.error('❌ Error upvoting feature request:', error);
      return {
        success: false,
        message: 'Failed to upvote feature request',
      };
    }
  }

  /**
   * Removes an upvote from a feature request.
   * @param featureRequestId
   * @param userId
   */
  async removeFeatureRequestUpvote(
    featureRequestId: string,
    userId: string
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // Check if feature request exists
      const featureRequestResult = await db
        .select()
        .from(schema.featureRequests)
        .where(eq(schema.featureRequests.id, featureRequestId));

      if (featureRequestResult.length === 0) {
        return {
          success: false,
          message: 'Feature request not found',
        };
      }

      // Find and remove the upvote
      const removedUpvote = await db
        .delete(schema.featureRequestUpvotes)
        .where(
          and(
            eq(schema.featureRequestUpvotes.featureRequestId, featureRequestId),
            eq(schema.featureRequestUpvotes.userId, userId)
          )
        )
        .returning();

      if (removedUpvote.length === 0) {
        return {
          success: false,
          message: 'You have not upvoted this feature request',
        };
      }

      // Update the upvote count on the feature request
      const updatedFeatureRequest = await db
        .update(schema.featureRequests)
        .set({
          upvoteCount: sql`GREATEST(0, ${schema.featureRequests.upvoteCount} - 1)`,
          updatedAt: new Date(),
        })
        .where(eq(schema.featureRequests.id, featureRequestId))
        .returning();

      // Invalidate cache
      queryCache.invalidate('feature_requests');
      queryCache.invalidate('feature_request_upvotes');

      return {
        success: true,
        message: 'Upvote removed successfully',
        data: {
          featureRequest: updatedFeatureRequest[0],
        },
      };
    } catch (error: any) {
      console.error('❌ Error removing feature request upvote:', error);
      return {
        success: false,
        message: 'Failed to remove upvote',
      };
    }
  }

  // Invoice operations
  async getInvoices(filters?: {
    buildingId?: string;
    residenceId?: string;
    userId?: string;
    userRole?: string;
  }): Promise<Invoice[]> {
    try {
      let query = db.select().from(schema.invoices);
      const conditions = [];

      if (filters) {
        if (filters.buildingId) {
          conditions.push(eq(schema.invoices.buildingId, filters.buildingId));
        }
        if (filters.residenceId) {
          conditions.push(eq(schema.invoices.residenceId, filters.residenceId));
        }
        if (filters.userId && filters.userRole) {
          // Apply role-based filtering
          if (filters.userRole === 'tenant' || filters.userRole === 'resident') {
            conditions.push(eq(schema.invoices.createdBy, filters.userId));
          }
          // Admin and manager can see all invoices (already filtered by building/residence above)
        }
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const invoices = await query.orderBy(desc(schema.invoices.createdAt));
      return invoices;
    } catch (error: any) {
      console.error('❌ Error fetching invoices:', error);
      return [];
    }
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    try {
      const result = await db
        .select()
        .from(schema.invoices)
        .where(eq(schema.invoices.id, id))
        .limit(1);
      
      return result[0];
    } catch (error: any) {
      console.error('❌ Error fetching invoice:', error);
      return undefined;
    }
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    try {
      const result = await db
        .insert(schema.invoices)
        .values(invoice)
        .returning();
      
      return result[0];
    } catch (error: any) {
      console.error('❌ Error creating invoice:', error);
      throw error;
    }
  }

  async updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice | undefined> {
    try {
      const result = await db
        .update(schema.invoices)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.invoices.id, id))
        .returning();
      
      return result[0];
    } catch (error: any) {
      console.error('❌ Error updating invoice:', error);
      return undefined;
    }
  }

  async deleteInvoice(id: string): Promise<boolean> {
    try {
      const result = await db
        .delete(schema.invoices)
        .where(eq(schema.invoices.id, id))
        .returning();
      
      return result.length > 0;
    } catch (error: any) {
      console.error('❌ Error deleting invoice:', error);
      return false;
    }
  }
}
