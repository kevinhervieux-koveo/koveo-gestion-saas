// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
/**
 * Optimized database storage with caching and performance monitoring.
 * Replaces decorators with direct implementation for better compatibility.
 */

import { eq, desc, and, or, gte, lte, count, like, inArray, isNull, sql, notInArray } from 'drizzle-orm';
// Use shared database connection to avoid multiple pools in production
import { db } from './db';
import crypto from 'crypto';
import * as schema from '@shared/schema';
import type { InsertMaintenanceRequest, MaintenanceRequest } from '@shared/schemas/operations';
import { maintenancePriorityEnum } from '@shared/schemas/operations';
import { logDebug, logInfo, logWarn, logError } from './utils/logger';

type MaintenancePriorityValue = (typeof maintenancePriorityEnum.enumValues)[number];
import type {
  User,
  InsertUser,
  Organization,
  InsertOrganization,
  Building,
  InsertBuilding,
  Residence,
  InsertResidence,
  Contact,
  InsertContact,
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
  Invoice,
  InsertInvoice,
} from '@shared/schema';
import type { IStorage } from './storage';
import type { Pillar } from '@shared/schema';
import { QueryOptimizer, PaginationHelper, type PaginationOptions } from './database-optimization';
import { queryCache, CacheInvalidator, withCache } from './query-cache';
import { dbPerformanceMonitor } from './performance-monitoring';
import { exists, sql as sqlOp } from 'drizzle-orm';
import { ObjectStorageService } from './objectStorage';
import { OptimizedFileStorageService } from './services/optimized-file-storage';
import { safeUserColumns } from './db/queries/user-queries';
import type { SafeUser, SafeUserWithAssignments } from './db/queries/user-queries';

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
      logError('Error initializing database optimizations', error);
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

  /**
   * Enhanced logging function for storage operations
   */
  private logStorageOperation(operation: string, data: any, level: 'INFO' | 'ERROR' | 'DEBUG' | 'WARN' = 'INFO') {
    const timestamp = new Date().toISOString();
    const emoji = {
      INFO: '📊',
      ERROR: '❌', 
      DEBUG: '🔍',
      WARN: '⚠️'
    }[level];
    
    logDebug(`[STORAGE ${operation.toUpperCase()}] ${level}`, { metadata: data });
  }

  /**
   * OPTIMIZATION: Batch fetch user associations to reduce N+1 queries
   */
  private async batchFetchUserAssociations(userIds: string[]): Promise<Map<string, { organizations: any[]; buildings: any[]; residences: any[] }>> {
    if (userIds.length === 0) return new Map();

    const cacheKey = `batch_user_associations:${userIds.sort().join(',')}`;
    return this.withOptimizations('batchFetchUserAssociations', cacheKey, 'users', async () => {
      // Single query to get all user organizations
      const userOrganizations = await db
        .select({
          userId: schema.userOrganizations.userId,
          id: schema.organizations.id,
          name: schema.organizations.name,
          type: schema.organizations.type
        })
        .from(schema.userOrganizations)
        .innerJoin(schema.organizations, eq(schema.userOrganizations.organizationId, schema.organizations.id))
        .where(
          and(
            inArray(schema.userOrganizations.userId, userIds),
            eq(schema.userOrganizations.isActive, true),
            eq(schema.organizations.isActive, true)
          )
        );

      // Single query to get all user buildings from direct assignments
      const directUserBuildings = await db
        .select({
          userId: schema.userBuildings.userId,
          id: schema.buildings.id,
          name: schema.buildings.name
        })
        .from(schema.userBuildings)
        .innerJoin(schema.buildings, eq(schema.userBuildings.buildingId, schema.buildings.id))
        .where(
          and(
            inArray(schema.userBuildings.userId, userIds),
            eq(schema.userBuildings.isActive, true),
            eq(schema.buildings.isActive, true)
          )
        );

      // Single query to get all user buildings (through residence assignments)
      const indirectUserBuildings = await db
        .selectDistinct({
          userId: schema.userResidences.userId,
          id: schema.buildings.id,
          name: schema.buildings.name
        })
        .from(schema.userResidences)
        .innerJoin(schema.residences, eq(schema.userResidences.residenceId, schema.residences.id))
        .innerJoin(schema.buildings, eq(schema.residences.buildingId, schema.buildings.id))
        .where(
          and(
            inArray(schema.userResidences.userId, userIds),
            eq(schema.userResidences.isActive, true),
            eq(schema.residences.isActive, true),
            eq(schema.buildings.isActive, true)
          )
        );

      // Combine direct and indirect building assignments
      const userBuildings = [...directUserBuildings, ...indirectUserBuildings];

      // Single query to get all user residences
      const userResidences = await db
        .select({
          userId: schema.userResidences.userId,
          id: schema.residences.id,
          unitNumber: schema.residences.unitNumber,
          buildingId: schema.residences.buildingId,
          buildingName: schema.buildings.name
        })
        .from(schema.userResidences)
        .innerJoin(schema.residences, eq(schema.userResidences.residenceId, schema.residences.id))
        .innerJoin(schema.buildings, eq(schema.residences.buildingId, schema.buildings.id))
        .where(
          and(
            inArray(schema.userResidences.userId, userIds),
            eq(schema.userResidences.isActive, true),
            eq(schema.residences.isActive, true)
          )
        );

      // Group results by userId
      const associations = new Map();
      userIds.forEach(userId => {
        associations.set(userId, {
          organizations: [],
          buildings: [],
          residences: []
        });
      });

      userOrganizations.forEach(org => {
        const userAssoc = associations.get(org.userId);
        if (userAssoc) {
          userAssoc.organizations.push({
            id: org.id,
            name: org.name,
            type: org.type
          });
        }
      });

      userBuildings.forEach(building => {
        const userAssoc = associations.get(building.userId);
        if (userAssoc) {
          // Avoid duplicates
          const exists = userAssoc.buildings.some((b: any) => b.id === building.id);
          if (!exists) {
            userAssoc.buildings.push({
              id: building.id,
              name: building.name
            });
          }
        }
      });

      userResidences.forEach(res => {
        const userAssoc = associations.get(res.userId);
        if (userAssoc) {
          userAssoc.residences.push({
            id: res.id,
            unitNumber: res.unitNumber,
            buildingId: res.buildingId,
            buildingName: res.buildingName
          });
        }
      });

      return associations;
    });
  }

  /**
   * SECURITY: Sanitizes and validates filter inputs to prevent SQL injection
   */
  private sanitizeFilters(filters: { role?: string; status?: string; organization?: string; orphan?: string; demoOnly?: string; managerOrganizations?: string; search?: string }) {
    const sanitized: any = {};

    // Validate and sanitize role
    if (filters.role) {
      const allowedRoles = ['admin', 'manager', 'tenant', 'resident', 'demo_manager', 'demo_tenant', 'demo_resident', 'null'];
      if (allowedRoles.includes(filters.role)) {
        sanitized.role = filters.role;
      } else {
        logWarn('[SECURITY] Invalid role filter rejected', { metadata: { role: filters.role } });
      }
    }

    // Validate and sanitize status
    if (filters.status) {
      const allowedStatuses = ['true', 'false', 'null'];
      if (allowedStatuses.includes(filters.status)) {
        sanitized.status = filters.status;
      } else {
        logWarn('[SECURITY] Invalid status filter rejected', { metadata: { status: filters.status } });
      }
    }

    // Validate and sanitize organization UUID
    if (filters.organization) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(filters.organization.trim())) {
        sanitized.organization = filters.organization.trim();
      } else {
        logWarn('[SECURITY] Invalid organization UUID rejected');
      }
    }

    // Validate and sanitize orphan filter
    if (filters.orphan) {
      const allowedOrphan = ['true', 'false'];
      if (allowedOrphan.includes(filters.orphan)) {
        sanitized.orphan = filters.orphan;
      } else {
        logWarn('[SECURITY] Invalid orphan filter rejected', { metadata: { orphan: filters.orphan } });
      }
    }

    // Validate and sanitize demoOnly
    if (filters.demoOnly) {
      const allowedDemoOnly = ['true', 'false'];
      if (allowedDemoOnly.includes(filters.demoOnly)) {
        sanitized.demoOnly = filters.demoOnly;
      } else {
        logWarn('[SECURITY] Invalid demoOnly filter rejected', { metadata: { demoOnly: filters.demoOnly } });
      }
    }

    // Validate and sanitize manager organizations (comma-separated UUIDs)
    if (filters.managerOrganizations) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const orgIds = filters.managerOrganizations.split(',').map(id => id.trim()).filter(id => uuidRegex.test(id));
      if (orgIds.length > 0) {
        sanitized.managerOrganizations = orgIds;
      } else {
        logWarn('[SECURITY] Invalid manager organization UUIDs rejected');
      }
    }

    // Validate and sanitize search (basic XSS prevention)
    if (filters.search) {
      const searchTerm = filters.search.trim();
      // Remove potentially dangerous characters but allow basic search characters
      const sanitizedSearch = searchTerm
        .replace(/[<>'"&%]/g, '') // Remove XSS-prone characters
        .replace(/[;]/g, '') // Remove SQL statement terminators
        .substring(0, 100); // Limit length
      if (sanitizedSearch.length > 0) {
        sanitized.search = sanitizedSearch.toLowerCase();
      } else {
        logWarn('[SECURITY] Invalid or dangerous search term rejected');
      }
    }

    return sanitized;
  }

  /**
   * SECURITY: Builds secure WHERE clause conditions for the main query
   */
  private buildSecureWhereClause(filters: any): any {
    const conditions = [];

    // Always default to active users unless explicitly filtered
    if (!filters.status) {
      conditions.push(sql`u.is_active = true`);
    } else if (filters.status === 'null') {
      conditions.push(sql`u.is_active IS NULL`);
    } else {
      const isActive = filters.status === 'true';
      conditions.push(sql`u.is_active = ${isActive}`);
    }

    // Role filter with parameterized conditions
    if (filters.role && filters.role !== 'null') {
      // Validate role against allowed values
      const allowedRoles = ['admin', 'manager', 'tenant', 'resident', 'demo_manager', 'demo_tenant', 'demo_resident'];
      if (allowedRoles.includes(filters.role)) {
        conditions.push(sql`u.role = ${filters.role}`);
      }
    } else if (filters.role === 'null') {
      conditions.push(sql`u.role IS NULL`);
    }

    // Demo-only filter
    if (filters.demoOnly === 'true') {
      conditions.push(sql`u.role IN ('demo_manager', 'demo_tenant', 'demo_resident')`);
    }

    // Search filter with parameterized LIKE
    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(sql`(
        LOWER(u.first_name || ' ' || u.last_name) LIKE ${searchPattern} OR 
        LOWER(u.email) LIKE ${searchPattern} OR 
        LOWER(u.username) LIKE ${searchPattern}
      )`);
    }

    // Manager organizations filter
    if (filters.managerOrganizations && filters.managerOrganizations.length > 0) {
      const orgIds = filters.managerOrganizations;
      conditions.push(sql`EXISTS (
        SELECT 1 FROM user_organizations uo_mgr 
        WHERE uo_mgr.user_id = u.id 
        AND uo_mgr.organization_id = ANY(${orgIds})
        AND uo_mgr.is_active = true
      )`);
    }

    // Organization filter
    if (filters.organization) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM user_organizations uo_filter 
        WHERE uo_filter.user_id = u.id 
        AND uo_filter.organization_id = ${filters.organization}
        AND uo_filter.is_active = true
      )`);
    }

    // Orphan filter
    if (filters.orphan === 'true' && !filters.organization) {
      conditions.push(sql`NOT EXISTS (
        SELECT 1 FROM user_organizations uo_orphan 
        WHERE uo_orphan.user_id = u.id AND uo_orphan.is_active = true
      ) AND NOT EXISTS (
        SELECT 1 FROM user_residences ur_orphan 
        WHERE ur_orphan.user_id = u.id AND ur_orphan.is_active = true
      )`);
    } else if (filters.orphan === 'false' && !filters.organization) {
      conditions.push(sql`(EXISTS (
        SELECT 1 FROM user_organizations uo_assigned 
        WHERE uo_assigned.user_id = u.id AND uo_assigned.is_active = true
      ) OR EXISTS (
        SELECT 1 FROM user_residences ur_assigned 
        WHERE ur_assigned.user_id = u.id AND ur_assigned.is_active = true
      ))`);
    }

    return conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`1=1`;
  }

  // User operations with optimization

  /**
   * Retrieves all active users with caching and performance tracking.
   * OPTIMIZED: Select only frequently used fields to reduce data transfer.
   */
  async getUsers(): Promise<User[]> {
    return this.withOptimizations('getUsers', 'all_users_optimized_v2', 'users', () =>
      db
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
          updatedAt: schema.users.updatedAt
        })
        .from(schema.users)
        .where(eq(schema.users.isActive, true))
        .orderBy(desc(schema.users.createdAt))
        .limit(100) // Always use LIMIT for large result sets
    );
  }

  /**
   * Retrieves all active users with their assignments (organizations, buildings, residences).
   * OPTIMIZED: Uses single query with JOINs and aggregation instead of N+1 queries.
   */
  async getUsersWithAssignments(): Promise<Array<SafeUserWithAssignments>> {
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
                buildings_distinct.user_id,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'id', buildings_distinct.id,
                      'name', buildings_distinct.name
                    )
                  ),
                  '[]'::json
                ) as buildings
              FROM (
                -- Direct building assignments from user_buildings table
                SELECT DISTINCT ub.user_id, b.id, b.name
                FROM user_buildings ub
                INNER JOIN buildings b ON ub.building_id = b.id
                WHERE ub.is_active = true AND b.is_active = true
                
                UNION
                
                -- Indirect building assignments through residences
                SELECT DISTINCT ur.user_id, b.id, b.name
                FROM user_residences ur
                INNER JOIN residences r ON ur.residence_id = r.id
                INNER JOIN buildings b ON r.building_id = b.id
                WHERE ur.is_active = true AND r.is_active = true AND b.is_active = true
              ) buildings_distinct
              GROUP BY buildings_distinct.user_id
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
              u.id, u.username, u.email, u.first_name, u.last_name,
              u.phone, u.profile_image, u.language, u.role, u.is_active,
              u.notifications_starting_date, u.last_login_at,
              u.created_at, u.updated_at,
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

          // Transform the raw SQL result to match the expected TypeScript types.
          // password is intentionally excluded from the SELECT, so it is not
          // present in row and therefore not mapped here (SafeUserWithAssignments).
          return result.rows.map((row: any) => ({
            id: row.id,
            username: row.username,
            email: row.email,
            firstName: row.first_name,
            lastName: row.last_name,
            phone: row.phone,
            profileImage: row.profile_image,
            language: row.language,
            role: row.role,
            isActive: row.is_active,
            notificationsStartingDate: row.notifications_starting_date,
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
          logError('Error in optimized getUsersWithAssignments', error);
          
          // Fallback to the original implementation if optimized query fails
          logDebug('Falling back to original implementation...');
          return this.getUsersWithAssignmentsFallback();
        }
      }
    );
  }

  /**
   * Retrieves paginated active users with their assignments (organizations, buildings, residences).
   * SECURITY HARDENED: Uses parameterized queries and input validation to prevent SQL injection.
   */
  async getUsersWithAssignmentsPaginated(
    offset: number = 0, 
    limit: number = 10, 
    filters: { role?: string; status?: string; organization?: string; orphan?: string; demoOnly?: string; managerOrganizations?: string; search?: string } = {}
  ): Promise<{
    users: Array<SafeUserWithAssignments>;
    total: number;
  }> {
    return this.withOptimizations(
      'getUsersWithAssignmentsPaginated',
      `paginated_users_${offset}_${limit}_${JSON.stringify(filters)}_secure_v1`,
      'users',
      async () => {
        try {
          logDebug('[DB FILTER] Input filters', { metadata: filters });
          
          // SECURITY: Input validation and sanitization
          const sanitizedFilters = this.sanitizeFilters(filters);
          logDebug('[SECURITY] Sanitized filters', { metadata: sanitizedFilters });
          
          // Build base conditions using Drizzle query builders (secure)
          const baseConditions = [];
          
          // Always default to active users unless explicitly filtered
          if (!sanitizedFilters.status) {
            baseConditions.push(eq(schema.users.isActive, true));
          } else if (sanitizedFilters.status === 'null') {
            baseConditions.push(isNull(schema.users.isActive));
          } else {
            const isActive = sanitizedFilters.status === 'true';
            baseConditions.push(eq(schema.users.isActive, isActive));
          }

          // Role filter with security validation
          if (sanitizedFilters.role && sanitizedFilters.role !== 'null') {
            baseConditions.push(eq(schema.users.role, sanitizedFilters.role));
          } else if (sanitizedFilters.role === 'null') {
            baseConditions.push(isNull(schema.users.role));
          }

          // Demo-only filter for demo users
          if (sanitizedFilters.demoOnly === 'true') {
            baseConditions.push(inArray(schema.users.role, ['demo_manager', 'demo_tenant', 'demo_resident']));
          }

          // Search filter using parameterized queries (secure)
          if (sanitizedFilters.search) {
            const searchPattern = `%${sanitizedFilters.search}%`;
            baseConditions.push(
              or(
                like(sql`LOWER(${schema.users.firstName} || ' ' || ${schema.users.lastName})`, searchPattern),
                like(sql`LOWER(${schema.users.email})`, searchPattern),
                like(sql`LOWER(${schema.users.username})`, searchPattern)
              )
            );
          }

          // Get total count first using secure Drizzle query
          // Collect all count conditions in a single array to avoid type issues
          const countConditions = [...baseConditions];

          // Add organization filter to count conditions if needed
          if (sanitizedFilters.organization) {
            countConditions.push(
              exists(
                db
                  .select()
                  .from(schema.userOrganizations)
                  .where(
                    and(
                      eq(schema.userOrganizations.userId, schema.users.id),
                      eq(schema.userOrganizations.organizationId, sanitizedFilters.organization),
                      eq(schema.userOrganizations.isActive, true)
                    )
                  )
              )
            );
          }

          // Add manager organizations filter to count conditions if needed
          if (sanitizedFilters.managerOrganizations) {
            countConditions.push(
              exists(
                db
                  .select()
                  .from(schema.userOrganizations)
                  .where(
                    and(
                      eq(schema.userOrganizations.userId, schema.users.id),
                      inArray(schema.userOrganizations.organizationId, sanitizedFilters.managerOrganizations),
                      eq(schema.userOrganizations.isActive, true)
                    )
                  )
              )
            );
          }

          // Add orphan filter to count conditions if needed
          if (sanitizedFilters.orphan === 'true' && !sanitizedFilters.organization) {
            countConditions.push(
              and(
                sql`NOT EXISTS (
                  SELECT 1 FROM user_organizations uo 
                  WHERE uo.user_id = ${schema.users.id} AND uo.is_active = true
                )`,
                sql`NOT EXISTS (
                  SELECT 1 FROM user_residences ur 
                  WHERE ur.user_id = ${schema.users.id} AND ur.is_active = true
                )`
              )
            );
          } else if (sanitizedFilters.orphan === 'false' && !sanitizedFilters.organization) {
            countConditions.push(
              or(
                sql`EXISTS (
                  SELECT 1 FROM user_organizations uo 
                  WHERE uo.user_id = ${schema.users.id} AND uo.is_active = true
                )`,
                sql`EXISTS (
                  SELECT 1 FROM user_residences ur 
                  WHERE ur.user_id = ${schema.users.id} AND ur.is_active = true
                )`
              )
            );
          }

          // Build the count query with all conditions at once
          const countQuery = countConditions.length > 0
            ? db.select({ count: count() }).from(schema.users).where(and(...countConditions))
            : db.select({ count: count() }).from(schema.users);

          const countResult = await countQuery;
          const total = countResult[0]?.count || 0;
          logDebug('[COUNT RESULT]', { metadata: { total } });

          // Main query using secure parameterized CTE approach
          const mainQuery = sql`
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
                buildings_distinct.user_id,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'id', buildings_distinct.id,
                      'name', buildings_distinct.name
                    )
                  ),
                  '[]'::json
                ) as buildings
              FROM (
                -- Direct building assignments from user_buildings table
                SELECT DISTINCT ub.user_id, b.id, b.name
                FROM user_buildings ub
                INNER JOIN buildings b ON ub.building_id = b.id
                WHERE ub.is_active = true AND b.is_active = true
                
                UNION
                
                -- Indirect building assignments through residences
                SELECT DISTINCT ur.user_id, b.id, b.name
                FROM user_residences ur
                INNER JOIN residences r ON ur.residence_id = r.id
                INNER JOIN buildings b ON r.building_id = b.id
                WHERE ur.is_active = true AND r.is_active = true AND b.is_active = true
              ) buildings_distinct
              GROUP BY buildings_distinct.user_id
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
              u.id,
              u.username,
              u.email,
              u.first_name,
              u.last_name,
              u.phone,
              u.profile_image,
              u.language,
              u.role,
              u.is_active,
              u.notifications_starting_date,
              u.last_login_at,
              u.created_at,
              u.updated_at,
              COALESCE(uo.organizations, '[]'::json) as organizations,
              COALESCE(ub.buildings, '[]'::json) as buildings,
              COALESCE(ur.residences, '[]'::json) as residences
            FROM users u
            LEFT JOIN user_orgs uo ON u.id = uo.user_id
            LEFT JOIN user_buildings ub ON u.id = ub.user_id
            LEFT JOIN user_residences ur ON u.id = ur.user_id
            WHERE ${this.buildSecureWhereClause(sanitizedFilters)}
            ORDER BY u.created_at DESC
            LIMIT ${sql.raw(limit.toString())} OFFSET ${sql.raw(offset.toString())}
          `;
          
          logDebug('[SECURE MAIN QUERY] Built with parameterized conditions');
          const result = await db.execute(mainQuery);
          logDebug('[MAIN RESULT] Users found', { metadata: { count: result.rows.length } });

          // Transform the raw SQL result to match the expected TypeScript types
          const users = result.rows.map((row: any) => ({
            id: row.id,
            username: row.username,
            email: row.email,
            firstName: row.first_name,
            lastName: row.last_name,
            phone: row.phone,
            profileImage: row.profile_image,
            language: row.language,
            role: row.role,
            isActive: row.is_active,
            notificationsStartingDate: row.notifications_starting_date,
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
          logError('Error in optimized getUsersWithAssignmentsPaginated', error);
          
          // Fallback to paginated version of the original implementation if optimized query fails
          logDebug('Falling back to paginated original implementation...');
          return this.getUsersWithAssignmentsPaginatedFallback(offset, limit, filters);
        }
      }
    );
  }

  /**
   * OPTIMIZED Fallback implementation for getUsersWithAssignments using batch fetch to eliminate N+1 queries.
   */
  private async getUsersWithAssignmentsFallback(): Promise<Array<SafeUserWithAssignments>> {
    try {
      // Get all users first with selected fields only (password excluded for security)
      const users = await db
        .select({
          id: schema.users.id,
          username: schema.users.username,
          email: schema.users.email,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          phone: schema.users.phone,
          profileImage: schema.users.profileImage,
          language: schema.users.language,
          role: schema.users.role,
          isActive: schema.users.isActive,
          notificationsStartingDate: schema.users.notificationsStartingDate,
          lastLoginAt: schema.users.lastLoginAt,
          createdAt: schema.users.createdAt,
          updatedAt: schema.users.updatedAt
        })
        .from(schema.users)
        .where(eq(schema.users.isActive, true))
        .orderBy(desc(schema.users.createdAt))
        .limit(100); // Always limit for performance

      if (users.length === 0) {
        return [];
      }

      // OPTIMIZATION: Use batch fetch to get all associations in 3 queries instead of N*3 queries
      const userIds = users.map(user => user.id);
      const userAssociations = await this.batchFetchUserAssociations(userIds);

      // Combine users with their associations
      const usersWithAssignments = users.map(user => {
        const associations = userAssociations.get(user.id) || {
          organizations: [],
          buildings: [],
          residences: []
        };

        return {
          ...user,
          organizations: associations.organizations,
          buildings: associations.buildings,
          residences: associations.residences,
        };
      });

      return usersWithAssignments;
    } catch (error: any) {
      logError('Critical error getting users with assignments', error);
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
    filters: { role?: string; status?: string; organization?: string; orphan?: string; demoOnly?: string; managerOrganizations?: string; search?: string } = {}
  ): Promise<{
    users: Array<SafeUserWithAssignments>;
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

      // Demo-only filter for demo users
      if (filters.demoOnly === 'true') {
        whereConditions.push(
          or(
            eq(schema.users.role, 'demo_manager'),
            eq(schema.users.role, 'demo_tenant'),
            eq(schema.users.role, 'demo_resident')
          )
        );
      }

      // Search filter for name/email
      if (filters.search && filters.search.trim()) {
        const searchTerm = `%${filters.search.trim().toLowerCase()}%`;
        whereConditions.push(
          or(
            sql`LOWER(${schema.users.firstName} || ' ' || ${schema.users.lastName}) LIKE ${searchTerm}`,
            sql`LOWER(${schema.users.email}) LIKE ${searchTerm}`,
            sql`LOWER(${schema.users.username}) LIKE ${searchTerm}`
          )
        );
        logDebug('[SEARCH FILTER FALLBACK] Applied search', { metadata: { search: filters.search.trim() } });
      }

      // Manager organizations filter
      if (filters.managerOrganizations) {
        const orgIds = filters.managerOrganizations.split(',');
        whereConditions.push(
          exists(
            db
              .select()
              .from(schema.userOrganizations)
              .where(
                and(
                  eq(schema.userOrganizations.userId, schema.users.id),
                  inArray(schema.userOrganizations.organizationId, orgIds),
                  eq(schema.userOrganizations.isActive, true)
                )
              )
          )
        );
      }

      // Orphan filter implementation for fallback
      if (filters.orphan === 'true') {
        // Users with no organization AND no residence assignments
        logDebug('[FALLBACK] Applying orphan filter: true (users with no assignments)');
        
        // Users who are NOT in either organizations or residences
        whereConditions.push(
          and(
            sql`NOT EXISTS (
              SELECT 1 FROM user_organizations uo 
              WHERE uo.user_id = ${schema.users.id} AND uo.is_active = true
            )`,
            sql`NOT EXISTS (
              SELECT 1 FROM user_residences ur 
              WHERE ur.user_id = ${schema.users.id} AND ur.is_active = true
            )`
          )
        );
      } else if (filters.orphan === 'false') {
        // Users with at least one organization OR residence assignment
        logDebug('[FALLBACK] Applying orphan filter: false (users with assignments)');
        
        // Users who are in at least one of these
        whereConditions.push(
          or(
            exists(
              db
                .select()
                .from(schema.userOrganizations)
                .where(
                  and(
                    eq(schema.userOrganizations.userId, schema.users.id),
                    eq(schema.userOrganizations.isActive, true)
                  )
                )
            ),
            exists(
              db
                .select()
                .from(schema.userResidences)
                .where(
                  and(
                    eq(schema.userResidences.userId, schema.users.id),
                    eq(schema.userResidences.isActive, true)
                  )
                )
            )
          )
        );
      }

      // First get total count with filters
      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.users)
        .where(and(...whereConditions));
      
      const total = Number(totalResult[0]?.count || 0);

      // Get paginated users with filters (password excluded for security)
      const users = await db
        .select({
          id: schema.users.id,
          username: schema.users.username,
          email: schema.users.email,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          phone: schema.users.phone,
          profileImage: schema.users.profileImage,
          language: schema.users.language,
          role: schema.users.role,
          isActive: schema.users.isActive,
          notificationsStartingDate: schema.users.notificationsStartingDate,
          lastLoginAt: schema.users.lastLoginAt,
          createdAt: schema.users.createdAt,
          updatedAt: schema.users.updatedAt,
        })
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

            // Get user buildings (through residence assignments only)
            const userBuildings = await db
              .selectDistinct({
                id: schema.buildings.id,
                name: schema.buildings.name,
              })
              .from(schema.userResidences)
              .innerJoin(schema.residences, eq(schema.userResidences.residenceId, schema.residences.id))
              .innerJoin(schema.buildings, eq(schema.residences.buildingId, schema.buildings.id))
              .where(
                and(
                  eq(schema.userResidences.userId, user.id),
                  eq(schema.userResidences.isActive, true),
                  eq(schema.residences.isActive, true),
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
            logError('Error getting user assignments', error);
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
      logError('Critical error getting paginated users with assignments', error);
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
    const countResult = await db
      .select({ count: count() })
      .from(schema.users)
      .where(eq(schema.users.isActive, true));
    const total = Number(countResult[0]?.count || 0);

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
  async getUser(id: string): Promise<SafeUser | undefined> {
    return this.withOptimizations('getUser', `user:${id}`, 'users', async () => {
      const result = await db.select(safeUserColumns).from(schema.users).where(eq(schema.users.id, id));
      return result[0];
    });
  }

  /**
   * Retrieves a user by email with caching.
   * @param email
   */
  async getUserPasswordHash(id: string): Promise<string | undefined> {
    const result = await db
      .select({ password: schema.users.password })
      .from(schema.users)
      .where(eq(schema.users.id, id));
    return result[0]?.password ?? undefined;
  }

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
        // Use environment variable for demo password hash, with secure fallback
        password = process.env.DEMO_PASSWORD_HASH || insertUser.password;
        logInfo('Setting demo password for user with role', { metadata: { role: insertUser.role } });
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
        logError('Error creating user', error);
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
      // Whitelist allowed fields and ensure security best practices
      const updateFields: any = {
        updatedAt: new Date(),
      };

      // Only allow safe user fields - block security-sensitive fields
      if (updates.firstName !== undefined) updateFields.firstName = updates.firstName;
      if (updates.lastName !== undefined) updateFields.lastName = updates.lastName;
      if (updates.email !== undefined) {
        // Normalize email (lowercase and trim)
        updateFields.email = updates.email.toLowerCase().trim();
      }
      if (updates.phone !== undefined) updateFields.phone = updates.phone;
      if (updates.role !== undefined) updateFields.role = updates.role;
      if (updates.language !== undefined) updateFields.language = updates.language;
      if (updates.isActive !== undefined) updateFields.isActive = updates.isActive;
      if (updates.profileImage !== undefined) updateFields.profileImage = updates.profileImage;
      
      // SECURITY: Block lastLoginAt and password updates in generic updates
      // - lastLoginAt should only be updated through auth flow
      // - password should only be updated through dedicated hashing endpoint
      
      logDebug('[updateUser] Updating user', { userId: id, metadata: { fields: Object.keys(updateFields) } });
      
      return db
        .update(schema.users)
        .set(updateFields)
        .where(eq(schema.users.id, id))
        .returning();
    });

    // Enhanced cache invalidation to prevent stale reads
    CacheInvalidator.invalidateUserCaches(id);
    CacheInvalidator.invalidateUserCaches('*'); // Invalidate user list caches

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
      return db.insert(schema.buildings).values([{
        ...insertBuilding,
        buildingType: insertBuilding.buildingType as 'condo' | 'appartement',
        totalUnits: insertBuilding.totalUnits || 0,
        bankAccountStartAmount: insertBuilding.bankAccountStartAmount ? insertBuilding.bankAccountStartAmount.toString() : undefined,
        bankAccountMinimums: insertBuilding.bankAccountMinimums ? JSON.stringify(insertBuilding.bankAccountMinimums) : undefined,
        unplannedBillsAmount: insertBuilding.unplannedBillsAmount ? insertBuilding.unplannedBillsAmount.toString() : undefined
      }]).returning();
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
      return db.insert(schema.residences).values([{
        ...insertResidence,
        bathrooms: insertResidence.bathrooms ? insertResidence.bathrooms.toString() : undefined,
        squareFootage: insertResidence.squareFootage ? insertResidence.squareFootage.toString() : undefined,
        ownershipPercentage: insertResidence.ownershipPercentage ? insertResidence.ownershipPercentage.toString() : undefined,
        monthlyFees: insertResidence.monthlyFees ? insertResidence.monthlyFees.toString() : undefined
      }]).returning();
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
          .orderBy(schema.buildings.name, sql`CAST(${schema.residences.unitNumber} AS INTEGER)`)
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

  /**
   * Creates a new maintenance request — resident self-service path (Task #1314).
   * Invalidates the maintenance cache so the manager queue picks it up immediately.
   */
  async createMaintenanceRequest(data: InsertMaintenanceRequest): Promise<MaintenanceRequest> {
    const [row] = await db
      .insert(schema.maintenanceRequests)
      .values({
        residenceId: data.residenceId,
        title: data.title,
        description: data.description,
        category: data.category,
        priority: (data.priority ?? 'medium') as MaintenancePriorityValue,
        submittedBy: data.submittedBy ?? null,
        status: 'submitted',
        ...(data.images && data.images.length > 0 ? { images: data.images } : {}),
      })
      .returning();
    CacheInvalidator.invalidate('maintenance');
    return row as MaintenanceRequest;
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
      return db.insert(schema.developmentPillars).values([{
        ...pillar,
        order: pillar.order.toString(),
        description: pillar.description || ''
      }]).returning();
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
      return db.insert(schema.workspaceStatus).values([status]).returning();
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
    statusUpdates: Partial<WorkspaceStatus>
  ): Promise<WorkspaceStatus | undefined> {
    const result = await dbPerformanceMonitor.trackQuery('updateWorkspaceStatus', async () => {
      return db
        .update(schema.workspaceStatus)
        .set({ ...statusUpdates, lastUpdated: new Date() })
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
              priority: suggestion.priority as 'Low' | 'Medium' | 'High' | 'Critical',
              status: suggestion.status as 'New' | 'Acknowledged' | 'Done',
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
      return db.insert(schema.features).values([{
        ...feature,
        category: feature.category as 'Dashboard & Home' | 'Property Management' | 'Resident Management' | 'Financial Management' | 'Maintenance & Requests' | 'Document Management' | 'Communication' | 'AI & Automation' | 'Compliance & Security' | 'Analytics & Reporting' | 'Integration & API' | 'Infrastructure & Performance' | 'Website',
        status: feature.status as 'submitted' | 'planned' | 'in-progress' | 'ai-analyzed' | 'completed' | 'cancelled',
        priority: feature.priority as 'low' | 'medium' | 'high' | 'critical',
        dependencies: feature.dependencies ? JSON.stringify(feature.dependencies) : undefined
      }]).returning();
    });

    queryCache.invalidate('features');
    return result[0];
  }

  /**
   * Updates feature.
   * @param id
   * @param updates
   */
  async updateFeature(id: string, updates: Partial<Feature>): Promise<Feature | undefined> {
    const result = await dbPerformanceMonitor.trackQuery('updateFeature', async () => {
      return db
        .update(schema.features)
        .set({ ...updates, updatedAt: new Date() })
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
      return db.insert(schema.actionableItems).values([{
        ...item,
        featureId: item.featureId || crypto.randomUUID(),
        status: item.status as 'pending' | 'in-progress' | 'completed' | 'blocked'
      }]).returning();
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
      return db.insert(schema.actionableItems).values(items.map(item => ({
        ...item,
        featureId: item.featureId || crypto.randomUUID(),
        status: item.status as 'pending' | 'in-progress' | 'completed' | 'blocked'
      }))).returning();
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
    status: 'pending' | 'accepted' | 'expired' | 'cancelled' | 'replaced'
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
    const token = crypto.randomUUID();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const result = await dbPerformanceMonitor.trackQuery('createInvitation', async () => {
      return db.insert(schema.invitations).values([{
        ...invitation,
        token,
        tokenHash,
        expiresAt: invitation.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Default 7 days
      }]).returning();
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
   */
  async getInvitationAuditLogs(): Promise<InvitationAuditLog[]> {
    return this.withOptimizations(
      'getInvitationAuditLogs',
      'invitation_logs:all',
      'invitation_logs',
      () =>
        db
          .select()
          .from(schema.invitationAuditLog)
          .orderBy(desc(schema.invitationAuditLog.createdAt))
    );
  }

  /**
   * Creates invitation audit log.
   * @param logEntry
   */
  async createInvitationAuditLog(logEntry: InsertInvitationAuditLog): Promise<InvitationAuditLog> {
    const result = await dbPerformanceMonitor.trackQuery('createInvitationAuditLog', async () => {
      return db.insert(schema.invitationAuditLog).values([{
        ...logEntry,
        previousStatus: logEntry.previousStatus as 'pending' | 'cancelled' | 'accepted' | 'expired' | undefined,
        newStatus: logEntry.newStatus as 'pending' | 'cancelled' | 'accepted' | 'expired' | undefined
      }]).returning();
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
      async () => {
        const results = await db
          .select({
            id: schema.rolePermissions.id,
            role: schema.rolePermissions.role,
            createdAt: schema.rolePermissions.createdAt,
            permissionId: schema.rolePermissions.permissionId,
            grantedBy: schema.rolePermissions.grantedBy,
            grantedAt: schema.rolePermissions.grantedAt,
            permissions: {
              id: schema.permissions.id,
              name: schema.permissions.name,
              displayName: schema.permissions.displayName,
              description: schema.permissions.description,
              resourceType: schema.permissions.resourceType,
              action: schema.permissions.action,
              conditions: schema.permissions.conditions,
              isActive: schema.permissions.isActive,
              createdAt: schema.permissions.createdAt,
              updatedAt: schema.permissions.updatedAt
            }
          })
          .from(schema.rolePermissions)
          .innerJoin(
            schema.permissions,
            eq(schema.rolePermissions.permissionId, schema.permissions.id)
          )
          .where(eq(schema.permissions.isActive, true))
          .orderBy(schema.rolePermissions.role, schema.permissions.resourceType);

        // Map to expected RolePermission format
        return results.map(row => ({
          id: row.id,
          role: row.role,
          createdAt: row.createdAt,
          permissionId: row.permissionId,
          grantedBy: row.grantedBy,
          grantedAt: row.grantedAt
        }));
      }
    );
  }

  /**
   * Gets all user permissions.
   */
  async getUserPermissions(): Promise<UserPermission[]> {
    try {
      const results = await db
        .select({
          id: schema.userPermissions.id,
          createdAt: schema.userPermissions.createdAt,
          updatedAt: schema.userPermissions.updatedAt,
          permissionId: schema.userPermissions.permissionId,
          userId: schema.userPermissions.userId,
          granted: schema.userPermissions.granted,
          user_permissions: {
            id: schema.userPermissions.id,
            createdAt: schema.userPermissions.createdAt,
            updatedAt: schema.userPermissions.updatedAt,
            permissionId: schema.userPermissions.permissionId,
            userId: schema.userPermissions.userId,
            granted: schema.userPermissions.granted
          },
          permissions: {
            id: schema.permissions.id,
            name: schema.permissions.name,
            displayName: schema.permissions.displayName,
            description: schema.permissions.description,
            resourceType: schema.permissions.resourceType,
            action: schema.permissions.action,
            conditions: schema.permissions.conditions,
            isActive: schema.permissions.isActive,
            createdAt: schema.permissions.createdAt,
            updatedAt: schema.permissions.updatedAt
          }
        })
        .from(schema.userPermissions)
        .innerJoin(
          schema.permissions,
          eq(schema.userPermissions.permissionId, schema.permissions.id)
        )
        .where(eq(schema.permissions.isActive, true))
        .orderBy(schema.userPermissions.userId);

      // Map to expected UserPermission format
      return results.map(row => ({
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        permissionId: row.permissionId,
        userId: row.userId,
        granted: row.granted
      })) || [];
    } catch (error: any) {
      logError('Error getting user permissions', error);
      return [];
    }
  }

  // Old building document methods removed - using unified documents table

  // Unified Document operations with optimized queries
  async getDocuments(filters?: {
    buildingId?: string;
    residenceId?: string;
    documentType?: string;
    attachedToType?: string;
    attachedToId?: string;
    userId?: string;
    userRole?: string;
  }): Promise<Document[]> {
    const operationId = crypto.randomUUID();
    
    this.logStorageOperation('getDocuments_START', {
      operationId,
      filters: filters || {},
      cacheKey: `documents:${JSON.stringify(filters)}`
    }, 'DEBUG');

    // Import optimized query functions
    const { getDocumentsWithRelations, getDocumentsForUser } = await import('./db/queries/optimized-document-queries');

    return this.withOptimizations(
      'getDocuments',
      `documents:${JSON.stringify(filters)}`,
      'documents',
      async () => {
        const dbStart = performance.now();

        // Use optimized queries with JOINs when user filtering is involved
        if (filters?.userId && filters?.userRole) {
          this.logStorageOperation('getDocuments_USING_OPTIMIZED_USER_QUERY', {
            operationId,
            userId: filters.userId,
            userRole: filters.userRole
          }, 'DEBUG');

          const documents = await getDocumentsForUser(
            filters.userId,
            filters.userRole,
            {
              buildingId: filters.buildingId,
              residenceId: filters.residenceId,
              documentType: filters.documentType,
            }
          );

          const dbTime = performance.now() - dbStart;
          this.logStorageOperation('getDocuments_OPTIMIZED_QUERY_EXECUTED', {
            operationId,
            resultCount: documents.length,
            dbExecutionTime: `${dbTime.toFixed(2)}ms`,
            optimization: 'Single query with JOINs'
          }, 'DEBUG');

          return documents;
        }

        // Use optimized query with relations for better performance
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
        if (filters?.attachedToType) {
          conditions.push(eq(schema.documents.attachedToType, filters.attachedToType));
        } else {
          // By default, exclude bill attachments unless explicitly requested
          conditions.push(or(
            isNull(schema.documents.attachedToType),
            notInArray(schema.documents.attachedToType, ['bill'])
          ));
        }
        if (filters?.attachedToId) {
          conditions.push(eq(schema.documents.attachedToId, filters.attachedToId));
        }

        // Build query with all conditions at once to avoid type issues
        const query = conditions.length > 0
          ? db.select().from(schema.documents).where(and(...conditions))
          : db.select().from(schema.documents);

        const result = await query.orderBy(desc(schema.documents.createdAt));
        const dbTime = performance.now() - dbStart;
        
        this.logStorageOperation('getDocuments_QUERY_EXECUTED', {
          operationId,
          resultCount: result?.length || 0,
          dbExecutionTime: `${dbTime.toFixed(2)}ms`,
          filters: filters || {}
        }, 'DEBUG');

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

  async getDocumentWithScope(
    documentId: string,
    userId: string,
    userRole: string,
    organizationIds?: string[]
  ): Promise<Document | null> {
    const operationId = crypto.randomUUID();
    
    this.logStorageOperation('getDocumentWithScope_START', {
      operationId,
      documentId,
      userId,
      userRole,
      organizationIds
    }, 'DEBUG');

    return dbPerformanceMonitor.trackQuery('getDocumentWithScope', async () => {
      try {
        // Get the document first
        const document = await db
          .select()
          .from(schema.documents)
          .where(eq(schema.documents.id, documentId))
          .limit(1)
          .then(result => result[0]);

        if (!document) {
          this.logStorageOperation('getDocumentWithScope_NOT_FOUND', {
            operationId,
            documentId
          }, 'DEBUG');
          return null;
        }

        // Manager-only documents are accessible only to admins and managers
        // (including demo_manager). Residents and tenants are denied even when
        // the document belongs to their own residence/building.
        if (
          document.isManagerOnly &&
          userRole !== 'admin' &&
          userRole !== 'manager' &&
          userRole !== 'demo_manager'
        ) {
          this.logStorageOperation('getDocumentWithScope_MANAGER_ONLY_DENIED', {
            operationId,
            documentId,
            userRole,
          }, 'DEBUG');
          return null;
        }

        // Admins can access everything
        if (userRole === 'admin') {
          this.logStorageOperation('getDocumentWithScope_ADMIN_ACCESS', {
            operationId,
            documentId
          }, 'DEBUG');
          return document;
        }

        // Managers can access any document in their organizations (check ALL organizations, not just the first).
        // demo_manager is treated equivalently to manager throughout the rest of the codebase
        // (see rbac.ts), so we honor the same scope here.
        if ((userRole === 'manager' || userRole === 'demo_manager') && organizationIds && organizationIds.length > 0) {
          // Check if document belongs to a building/residence in any of the manager's organizations
          if (document.buildingId) {
            const building = await db
              .select()
              .from(schema.buildings)
              .where(eq(schema.buildings.id, document.buildingId))
              .limit(1)
              .then(result => result[0]);

            if (building && organizationIds.includes(building.organizationId)) {
              this.logStorageOperation('getDocumentWithScope_MANAGER_ORG_ACCESS', {
                operationId,
                documentId,
                buildingId: document.buildingId,
                organizationId: building.organizationId
              }, 'DEBUG');
              return document;
            }
          }

          if (document.residenceId) {
            const residence = await db
              .select({ 
                residenceId: schema.residences.id, 
                buildingId: schema.residences.buildingId,
                organizationId: schema.buildings.organizationId
              })
              .from(schema.residences)
              .innerJoin(schema.buildings, eq(schema.residences.buildingId, schema.buildings.id))
              .where(eq(schema.residences.id, document.residenceId))
              .limit(1)
              .then(result => result[0]);

            if (residence && organizationIds.includes(residence.organizationId)) {
              this.logStorageOperation('getDocumentWithScope_MANAGER_ORG_ACCESS', {
                operationId,
                documentId,
                residenceId: document.residenceId,
                organizationId: residence.organizationId
              }, 'DEBUG');
              return document;
            }
          }
        }

        // Residents can only access documents from their own residences.
        // demo_resident is treated equivalently to resident throughout the
        // codebase (see rbac.ts), so we honor the same scope here.
        if (userRole === 'resident' || userRole === 'demo_resident') {
          const userResidences = await db
            .select({ residenceId: schema.userResidences.residenceId })
            .from(schema.userResidences)
            .where(
              and(
                eq(schema.userResidences.userId, userId),
                eq(schema.userResidences.isActive, true)
              )
            );

          const residenceIds = userResidences.map(ur => ur.residenceId);

          if (document.residenceId && residenceIds.includes(document.residenceId)) {
            this.logStorageOperation('getDocumentWithScope_RESIDENT_ACCESS', {
              operationId,
              documentId,
              residenceId: document.residenceId
            }, 'DEBUG');
            return document;
          }
        }

        // Tenants can view documents marked as visible to tenants.
        // demo_tenant is treated equivalently to tenant throughout the
        // codebase (see rbac.ts), so we honor the same scope here.
        if (userRole === 'tenant' || userRole === 'demo_tenant') {
          if (document.isVisibleToTenants) {
            this.logStorageOperation('getDocumentWithScope_TENANT_VIEW_ACCESS', {
              operationId,
              documentId,
              isVisibleToTenants: true
            }, 'DEBUG');
            return document;
          }

          // Tenants can also create/access documents in their own residence
          const userResidences = await db
            .select({ residenceId: schema.userResidences.residenceId })
            .from(schema.userResidences)
            .where(
              and(
                eq(schema.userResidences.userId, userId),
                eq(schema.userResidences.isActive, true)
              )
            );

          const residenceIds = userResidences.map(ur => ur.residenceId);

          if (document.residenceId && residenceIds.includes(document.residenceId)) {
            this.logStorageOperation('getDocumentWithScope_TENANT_OWN_RESIDENCE_ACCESS', {
              operationId,
              documentId,
              residenceId: document.residenceId
            }, 'DEBUG');
            return document;
          }
        }

        this.logStorageOperation('getDocumentWithScope_ACCESS_DENIED', {
          operationId,
          documentId,
          userId,
          userRole,
          reason: 'No permission to access this document'
        }, 'DEBUG');

        return null;
      } catch (error: any) {
        this.logStorageOperation('getDocumentWithScope_ERROR', {
          operationId,
          documentId,
          error: error.message
        }, 'ERROR');
        throw error;
      }
    });
  }

  async listDocumentsByScope(
    filters: {
      buildingId?: string;
      residenceId?: string;
      documentType?: string;
    },
    userId: string,
    userRole: string,
    organizationIds?: string[]
  ): Promise<Document[]> {
    const operationId = crypto.randomUUID();
    
    this.logStorageOperation('listDocumentsByScope_START', {
      operationId,
      filters,
      userId,
      userRole,
      organizationIds
    }, 'DEBUG');

    return dbPerformanceMonitor.trackQuery('listDocumentsByScope', async () => {
      try {
        const conditions: any[] = [];

        // Apply basic filters
        if (filters.documentType) {
          conditions.push(eq(schema.documents.documentType, filters.documentType));
        }

        // Admins can see everything
        if (userRole === 'admin') {
          if (filters.buildingId) {
            conditions.push(eq(schema.documents.buildingId, filters.buildingId));
          }
          if (filters.residenceId) {
            conditions.push(eq(schema.documents.residenceId, filters.residenceId));
          }

          const query = conditions.length > 0
            ? db.select().from(schema.documents).where(and(...conditions))
            : db.select().from(schema.documents);

          const result = await query.orderBy(desc(schema.documents.createdAt));
          
          this.logStorageOperation('listDocumentsByScope_ADMIN_ACCESS', {
            operationId,
            resultCount: result.length
          }, 'DEBUG');

          return result;
        }

        // Managers can see documents from any building/residence in their organizations (check ALL organizations)
        if (userRole === 'manager' && organizationIds && organizationIds.length > 0) {
          // Get all buildings in the user's organizations
          const orgBuildings = await db
            .select({ id: schema.buildings.id })
            .from(schema.buildings)
            .where(inArray(schema.buildings.organizationId, organizationIds));

          const buildingIds = orgBuildings.map(b => b.id);

          // Get all residences in those buildings
          const orgResidences = buildingIds.length > 0 
            ? await db
                .select({ id: schema.residences.id })
                .from(schema.residences)
                .where(inArray(schema.residences.buildingId, buildingIds))
            : [];

          const residenceIds = orgResidences.map(r => r.id);

          // Filter by organization's buildings and residences
          if (filters.buildingId && buildingIds.includes(filters.buildingId)) {
            conditions.push(eq(schema.documents.buildingId, filters.buildingId));
          } else if (filters.residenceId && residenceIds.includes(filters.residenceId)) {
            conditions.push(eq(schema.documents.residenceId, filters.residenceId));
          } else if (!filters.buildingId && !filters.residenceId) {
            // Show all documents from the user's organizations
            // Build OR predicates safely - avoid passing undefined to or()
            const orPredicates = [];
            if (buildingIds.length > 0) {
              orPredicates.push(inArray(schema.documents.buildingId, buildingIds));
            }
            if (residenceIds.length > 0) {
              orPredicates.push(inArray(schema.documents.residenceId, residenceIds));
            }
            
            if (orPredicates.length > 1) {
              conditions.push(or(...orPredicates));
            } else if (orPredicates.length === 1) {
              conditions.push(orPredicates[0]);
            }
            // If no buildings or residences in org, query will return empty (no condition added)
          }

          const query = conditions.length > 0
            ? db.select().from(schema.documents).where(and(...conditions))
            : db.select().from(schema.documents);

          const result = await query.orderBy(desc(schema.documents.createdAt));
          
          this.logStorageOperation('listDocumentsByScope_MANAGER_ACCESS', {
            operationId,
            organizationIds,
            resultCount: result.length
          }, 'DEBUG');

          return result;
        }

        // Residents can only see documents from their own residences
        if (userRole === 'resident') {
          const userResidences = await db
            .select({ residenceId: schema.userResidences.residenceId })
            .from(schema.userResidences)
            .where(
              and(
                eq(schema.userResidences.userId, userId),
                eq(schema.userResidences.isActive, true)
              )
            );

          const residenceIds = userResidences.map(ur => ur.residenceId);

          if (residenceIds.length === 0) {
            this.logStorageOperation('listDocumentsByScope_RESIDENT_NO_RESIDENCES', {
              operationId,
              userId
            }, 'DEBUG');
            return [];
          }

          if (filters.residenceId) {
            if (residenceIds.includes(filters.residenceId)) {
              conditions.push(eq(schema.documents.residenceId, filters.residenceId));
            } else {
              // Requested residence doesn't belong to user
              return [];
            }
          } else {
            conditions.push(inArray(schema.documents.residenceId, residenceIds));
          }

          // Residents cannot see manager-only documents.
          conditions.push(eq(schema.documents.isManagerOnly, false));

          const query = conditions.length > 0
            ? db.select().from(schema.documents).where(and(...conditions))
            : db.select().from(schema.documents);

          const result = await query.orderBy(desc(schema.documents.createdAt));
          
          this.logStorageOperation('listDocumentsByScope_RESIDENT_ACCESS', {
            operationId,
            userId,
            resultCount: result.length
          }, 'DEBUG');

          return result;
        }

        // Tenants can view documents marked as visible to tenants
        if (userRole === 'tenant') {
          const userResidences = await db
            .select({ residenceId: schema.userResidences.residenceId })
            .from(schema.userResidences)
            .where(
              and(
                eq(schema.userResidences.userId, userId),
                eq(schema.userResidences.isActive, true)
              )
            );

          const residenceIds = userResidences.map(ur => ur.residenceId);

          // Tenants can see:
          // 1. Documents marked as visible to tenants
          // 2. Documents they created in their own residence
          const tenantConditions = [
            eq(schema.documents.isVisibleToTenants, true)
          ];

          if (residenceIds.length > 0) {
            tenantConditions.push(
              and(
                inArray(schema.documents.residenceId, residenceIds),
                eq(schema.documents.uploadedById, userId)
              )
            );
          }

          conditions.push(or(...tenantConditions));

          // Tenants cannot see manager-only documents.
          conditions.push(eq(schema.documents.isManagerOnly, false));

          if (filters.residenceId) {
            conditions.push(eq(schema.documents.residenceId, filters.residenceId));
          }
          if (filters.buildingId) {
            conditions.push(eq(schema.documents.buildingId, filters.buildingId));
          }

          const query = conditions.length > 0
            ? db.select().from(schema.documents).where(and(...conditions))
            : db.select().from(schema.documents);

          const result = await query.orderBy(desc(schema.documents.createdAt));
          
          this.logStorageOperation('listDocumentsByScope_TENANT_ACCESS', {
            operationId,
            userId,
            resultCount: result.length
          }, 'DEBUG');

          return result;
        }

        // Default: no access
        this.logStorageOperation('listDocumentsByScope_NO_ACCESS', {
          operationId,
          userId,
          userRole
        }, 'DEBUG');

        return [];
      } catch (error: any) {
        this.logStorageOperation('listDocumentsByScope_ERROR', {
          operationId,
          error: error.message
        }, 'ERROR');
        throw error;
      }
    });
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const operationId = crypto.randomUUID();
    
    this.logStorageOperation('createDocument_START', {
      operationId,
      documentData: {
        name: document.name,
        documentType: document.documentType,
        buildingId: document.buildingId,
        residenceId: document.residenceId,
        uploadedById: document.uploadedById,
        filePath: document.filePath,
        isVisibleToTenants: document.isVisibleToTenants
      }
    }, 'INFO');

    return dbPerformanceMonitor.trackQuery('createDocument', async () => {
      try {
        const dbStart = performance.now();
        const result = await db.insert(schema.documents).values(document).returning();
        const dbTime = performance.now() - dbStart;
        
        this.logStorageOperation('createDocument_SUCCESS', {
          operationId,
          documentId: result[0]?.id,
          dbExecutionTime: `${dbTime.toFixed(2)}ms`,
          insertedData: {
            name: result[0]?.name,
            documentType: result[0]?.documentType,
            filePath: result[0]?.filePath
          }
        }, 'INFO');

        // Cache invalidation with logging
        if (document.buildingId) {
          queryCache.invalidate('documents', `*buildingId*${document.buildingId}*`);
          this.logStorageOperation('createDocument_CACHE_INVALIDATED', {
            operationId,
            cachePattern: `*buildingId*${document.buildingId}*`
          }, 'DEBUG');
        }
        if (document.residenceId) {
          queryCache.invalidate('documents', `*residenceId*${document.residenceId}*`);
          this.logStorageOperation('createDocument_CACHE_INVALIDATED', {
            operationId,
            cachePattern: `*residenceId*${document.residenceId}*`
          }, 'DEBUG');
        }
        if (document.attachedToType && document.attachedToId) {
          queryCache.invalidate('documents', `*attachedToType*${document.attachedToType}*attachedToId*${document.attachedToId}*`);
          this.logStorageOperation('createDocument_CACHE_INVALIDATED', {
            operationId,
            cachePattern: `*attachedToType*${document.attachedToType}*attachedToId*${document.attachedToId}*`
          }, 'DEBUG');
        }

        return result[0];
      } catch (error: any) {
        this.logStorageOperation('createDocument_ERROR', {
          operationId,
          error: error.message,
          errorCode: error.code,
          documentData: {
            name: document.name,
            documentType: document.documentType,
            buildingId: document.buildingId,
            residenceId: document.residenceId
          }
        }, 'ERROR');
        throw error;
      }
    });
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined> {
    const operationId = crypto.randomUUID();
    
    this.logStorageOperation('updateDocument_START', {
      operationId,
      documentId: id,
      updates: {
        fieldsBeingUpdated: Object.keys(updates),
        hasFilePathUpdate: !!updates.filePath,
        hasNameUpdate: !!updates.name,
        hasVisibilityUpdate: !!updates.isVisibleToTenants
      }
    }, 'INFO');

    return dbPerformanceMonitor.trackQuery('updateDocument', async () => {
      try {
        const dbStart = performance.now();
        const result = await db
          .update(schema.documents)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(schema.documents.id, id))
          .returning();
        const dbTime = performance.now() - dbStart;

        if (result[0]) {
          this.logStorageOperation('updateDocument_SUCCESS', {
            operationId,
            documentId: id,
            dbExecutionTime: `${dbTime.toFixed(2)}ms`,
            updatedFields: Object.keys(updates),
            resultData: {
              name: result[0].name,
              documentType: result[0].documentType,
              filePath: result[0].filePath,
              updatedAt: result[0].updatedAt
            }
          }, 'INFO');

          // Cache invalidation with logging
          queryCache.invalidate('documents', `document:${id}`);
          queryCache.invalidate('documents', '*');
          
          this.logStorageOperation('updateDocument_CACHE_INVALIDATED', {
            operationId,
            documentId: id,
            cachePatterns: [`document:${id}`, '*']
          }, 'DEBUG');
        } else {
          this.logStorageOperation('updateDocument_NOT_FOUND', {
            operationId,
            documentId: id,
            dbExecutionTime: `${dbTime.toFixed(2)}ms`
          }, 'WARN');
        }

        return result[0];
      } catch (error: any) {
        this.logStorageOperation('updateDocument_ERROR', {
          operationId,
          documentId: id,
          error: error.message,
          errorCode: error.code,
          updates: Object.keys(updates)
        }, 'ERROR');
        throw error;
      }
    });
  }

  /**
   * Normalize file path by removing leading slashes and 'uploads/' prefix if present
   */
  private normalizeFilePath(filePath: string): string {
    // Remove leading slashes
    let normalized = filePath.replace(/^\/+/, '');
    
    // Remove 'uploads/' prefix if present to avoid duplication
    if (normalized.startsWith('uploads/')) {
      normalized = normalized.substring('uploads/'.length);
    }
    
    return normalized;
  }

  async deleteDocument(id: string): Promise<boolean> {
    const operationId = crypto.randomUUID();
    
    this.logStorageOperation('deleteDocument_START', {
      operationId,
      documentId: id
    }, 'INFO');

    return dbPerformanceMonitor.trackQuery('deleteDocument', async () => {
      try {
        // First get document info for logging and file deletion
        const documentInfo = await db
          .select({
            id: schema.documents.id,
            name: schema.documents.name,
            documentType: schema.documents.documentType,
            filePath: schema.documents.filePath,
            buildingId: schema.documents.buildingId,
            residenceId: schema.documents.residenceId
          })
          .from(schema.documents)
          .where(eq(schema.documents.id, id))
          .limit(1);

        if (documentInfo.length === 0) {
          this.logStorageOperation('deleteDocument_NOT_FOUND', {
            operationId,
            documentId: id
          }, 'WARN');
          return false;
        }

        const filePath = documentInfo[0].filePath;

        // Delete physical file before deleting database record
        if (filePath) {
          try {
            if (filePath.startsWith('/objects/')) {
              // File is in object storage
              this.logStorageOperation('deleteDocument_FILE_DELETION_START', {
                operationId,
                documentId: id,
                filePath,
                storageType: 'object_storage'
              }, 'INFO');

              const objectStorageService = new ObjectStorageService();
              const fileDeleted = await objectStorageService.deleteObject(filePath);
              
              if (fileDeleted) {
                this.logStorageOperation('deleteDocument_FILE_DELETED', {
                  operationId,
                  documentId: id,
                  filePath,
                  storageType: 'object_storage'
                }, 'INFO');
              } else {
                this.logStorageOperation('deleteDocument_FILE_DELETION_FAILED', {
                  operationId,
                  documentId: id,
                  filePath,
                  storageType: 'object_storage'
                }, 'WARN');
              }
            } else {
              // File is in local filesystem
              this.logStorageOperation('deleteDocument_FILE_DELETION_START', {
                operationId,
                documentId: id,
                filePath,
                storageType: 'local_filesystem'
              }, 'INFO');

              const fs = await import('fs/promises');
              const path = await import('path');
              const normalizedPath = this.normalizeFilePath(filePath);
              const fullPath = path.join(process.cwd(), 'uploads', normalizedPath);
              
              try {
                await fs.unlink(fullPath);
                this.logStorageOperation('deleteDocument_FILE_DELETED', {
                  operationId,
                  documentId: id,
                  filePath,
                  storageType: 'local_filesystem'
                }, 'INFO');
              } catch (unlinkError: any) {
                if (unlinkError.code === 'ENOENT') {
                  this.logStorageOperation('deleteDocument_FILE_NOT_FOUND', {
                    operationId,
                    documentId: id,
                    filePath,
                    storageType: 'local_filesystem'
                  }, 'WARN');
                } else {
                  throw unlinkError;
                }
              }
            }
          } catch (fileError: any) {
            // Log file deletion error but continue with database deletion
            this.logStorageOperation('deleteDocument_FILE_DELETION_ERROR', {
              operationId,
              documentId: id,
              filePath,
              error: fileError.message
            }, 'WARN');
          }
        }

        // Delete database record
        const dbStart = performance.now();
        const result = await db
          .delete(schema.documents)
          .where(eq(schema.documents.id, id))
          .returning({ id: schema.documents.id });
        const dbTime = performance.now() - dbStart;

        if (result.length > 0) {
          this.logStorageOperation('deleteDocument_SUCCESS', {
            operationId,
            documentId: id,
            dbExecutionTime: `${dbTime.toFixed(2)}ms`,
            deletedDocument: {
              name: documentInfo[0].name,
              documentType: documentInfo[0].documentType,
              filePath: documentInfo[0].filePath,
              buildingId: documentInfo[0].buildingId,
              residenceId: documentInfo[0].residenceId
            }
          }, 'INFO');

          // Cache invalidation with logging
          queryCache.invalidate('documents', `document:${id}`);
          queryCache.invalidate('documents', '*');
          
          this.logStorageOperation('deleteDocument_CACHE_INVALIDATED', {
            operationId,
            documentId: id,
            cachePatterns: [`document:${id}`, '*']
          }, 'DEBUG');
          
          return true;
        }

        this.logStorageOperation('deleteDocument_FAILED', {
          operationId,
          documentId: id,
          dbExecutionTime: `${dbTime.toFixed(2)}ms`
        }, 'WARN');
        
        return false;
      } catch (error: any) {
        this.logStorageOperation('deleteDocument_ERROR', {
          operationId,
          documentId: id,
          error: error.message,
          errorCode: error.code
        }, 'ERROR');
        throw error;
      }
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
      async () => {
        const results = await db
          .select({
            // Contact fields
            id: schema.contacts.id,
            name: schema.contacts.name,
            email: schema.contacts.email,
            phone: schema.contacts.phone,
            isActive: schema.contacts.isActive,
            createdAt: schema.contacts.createdAt,
            updatedAt: schema.contacts.updatedAt,
            entity: schema.contacts.entity,
            entityId: schema.contacts.entityId,
            contactCategory: schema.contacts.contactCategory,
            // User fields
            users: {
              id: schema.users.id,
              username: schema.users.username,
              email: schema.users.email,
              password: schema.users.password,
              firstName: schema.users.firstName,
              lastName: schema.users.lastName,
              phone: schema.users.phone,
              profileImage: schema.users.profileImage,
              language: schema.users.language,
              role: schema.users.role,
              isActive: schema.users.isActive,
              lastLoginAt: schema.users.lastLoginAt,
              createdAt: schema.users.createdAt,
              updatedAt: schema.users.updatedAt
            }
          })
          .from(schema.contacts)
          .innerJoin(schema.users, eq(schema.contacts.name, schema.users.email))
          .where(
            and(
              eq(schema.contacts.entityId, residenceId),
              eq(schema.contacts.entity, 'residence'),
              eq(schema.contacts.isActive, true)
            )
          );
        
        // Map to expected format
        return results.map(row => ({
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          isActive: row.isActive,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          entity: row.entity,
          entityId: row.entityId,
          contactCategory: row.contactCategory,
          user: row.users
        }));
      }
    );
  }

  /**
   * Creates a new contact.
   * @param contact
   */
  async createContact(contact: InsertContact): Promise<Contact> {
    const result = await dbPerformanceMonitor.trackQuery('createContact', async () => {
      return db.insert(schema.contacts).values([{
        ...contact,
        entity: contact.entity as 'organization' | 'building' | 'residence',
        contactCategory: contact.contactCategory as 'resident' | 'manager' | 'tenant' | 'maintenance' | 'emergency' | 'other'
      }]).returning();
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
      db.select().from(schema.demands).where(eq(schema.demands.submitterId, userId))
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

  // Invoice operations
  async getInvoices(filters?: {
    buildingId?: string;
    residenceId?: string;
    userId?: string;
    userRole?: string;
  }): Promise<Invoice[]> {
    try {
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

      // Build query with all conditions at once to avoid type issues
      const query = conditions.length > 0
        ? db.select().from(schema.invoices).where(and(...conditions))
        : db.select().from(schema.invoices);

      const invoices = await query.orderBy(desc(schema.invoices.createdAt));
      return invoices;
    } catch (error: any) {
      logError('Error fetching invoices', error);
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
      logError('Error fetching invoice', error);
      return undefined;
    }
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    try {
      const result = await db
        .insert(schema.invoices)
        .values([{
          ...invoice,
          totalAmount: invoice.totalAmount.toString(),
          dueDate: invoice.dueDate.toISOString().split('T')[0], // Convert Date to string
          startDate: invoice.startDate ? (invoice.startDate instanceof Date ? invoice.startDate.toISOString().split('T')[0] : String(invoice.startDate)) : undefined, // Convert Date to string
          customPaymentDates: invoice.customPaymentDates ? invoice.customPaymentDates.map(date => date instanceof Date ? date.toISOString().split('T')[0] : String(date)) : undefined, // Convert Date[] to string[]
          extractionConfidence: invoice.extractionConfidence ? invoice.extractionConfidence.toString() : undefined
        }])
        .returning();
      
      return result[0];
    } catch (error: any) {
      logError('Error creating invoice', error);
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
      logError('Error updating invoice', error);
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
      logError('Error deleting invoice', error);
      return false;
    }
  }

  // Admin-only method to count orphan users
  async countOrphanUsers(): Promise<number> {
    logDebug('[STORAGE - COUNT] Count orphan users started');
    
    try {
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM users u
        WHERE u.is_active = true
          AND u.role NOT IN ('demo_manager', 'demo_tenant', 'demo_resident')
          AND NOT EXISTS (
            SELECT 1 FROM user_organizations uo 
            WHERE uo.user_id = u.id AND uo.is_active = true
          )
          AND NOT EXISTS (
            SELECT 1 FROM user_residences ur 
            WHERE ur.user_id = u.id AND ur.is_active = true
          )
      `;
      
      logDebug('[STORAGE - COUNT] Executing orphan users query');
      
      const startTime = Date.now();
      const result = await db.execute(sql.raw(countQuery));
      const endTime = Date.now();
      
      const count = parseInt(String(result.rows[0]?.total || '0'));
      logDebug('[STORAGE - COUNT] Orphan users count completed', { metadata: { count, durationMs: endTime - startTime } });
      
      return count;
    } catch (error: any) {
      logError('[STORAGE - COUNT] Critical error counting orphan users', error);
      return 0;
    }
  }

  // Admin-only method to count all users except specified admin
  async countAllUsersExcept(excludeUserId: string): Promise<number> {
    logDebug('[STORAGE - COUNT ALL] Count all users except admin started', { userId: excludeUserId });
    
    try {
      const countQuery = sql`
        SELECT COUNT(*) as total 
        FROM users u
        WHERE u.is_active = true
        AND u.id != ${excludeUserId}
      `;
      
      logDebug('[STORAGE - COUNT ALL] Executing parameterized SQL query');
      
      const startTime = Date.now();
      const result = await db.execute(countQuery);
      const endTime = Date.now();
      
      const count = parseInt(String(result.rows[0]?.total || '0'));
      logDebug('[STORAGE - COUNT ALL] User count completed', { metadata: { count, durationMs: endTime - startTime } });
      
      return count;
    } catch (error: any) {
      logError('[STORAGE - COUNT ALL] Critical error counting users', error);
      return 0;
    }
  }

  // Admin-only method to delete all users except specified admin
  async deleteAllUsersExcept(excludeUserId: string): Promise<number> {
    logInfo('[STORAGE - DELETE ALL] Delete all users except admin started', { userId: excludeUserId });
    
    try {
      // First, let's get the list of users that will be affected for debugging
      const previewQuery = sql`SELECT u.id, u.email, u.first_name, u.last_name, u.role
        FROM users u
        WHERE u.is_active = true
          AND u.id != ${excludeUserId}`;
      
      logDebug('[STORAGE - DELETE ALL] Getting preview of users to be deleted...');
      const previewResult = await db.execute(previewQuery);
      logDebug('[STORAGE - DELETE ALL] Users to be deleted', { metadata: { count: previewResult.rows.length } });
      
      // Mark all other users as inactive
      const updateQuery = sql`UPDATE users 
        SET is_active = false,
            updated_at = CURRENT_TIMESTAMP
        WHERE is_active = true
          AND id != ${excludeUserId}`;
      
      logDebug('[STORAGE - DELETE ALL] Executing UPDATE query to mark users as inactive...');
      
      const startTime = Date.now();
      const result = await db.execute(updateQuery);
      const updateTime = Date.now();
      
      logDebug('[STORAGE - DELETE ALL] Update operation completed', { metadata: { durationMs: updateTime - startTime } });
      
      // Count the affected rows
      const countQuery = sql`SELECT COUNT(*) as deleted_count
        FROM users u
        WHERE u.is_active = false
          AND u.id != ${excludeUserId}
          AND u.updated_at >= CURRENT_TIMESTAMP - INTERVAL '1 minute'`;
      
      logDebug('[STORAGE - DELETE ALL] Executing count query to verify deletion...');
      const countStartTime = Date.now();
      const countResult = await db.execute(countQuery);
      const countEndTime = Date.now();
      
      const deletedCount = parseInt(String(countResult.rows[0]?.deleted_count || '0'));
      logInfo('[STORAGE - DELETE ALL] Delete all users except admin completed', { 
        userId: excludeUserId, 
        metadata: { deletedCount, totalDurationMs: countEndTime - startTime } 
      });
      
      return deletedCount;
    } catch (error: any) {
      logError('[STORAGE - DELETE ALL] Critical error deleting users', error);
      throw error;
    }
  }

  // Admin-only method to delete orphan users (excluding specified admin user)
  async deleteOrphanUsers(excludeUserId: string): Promise<number> {
    logInfo('[STORAGE - DELETE] Delete orphan users started', { userId: excludeUserId });
    
    try {
      // First, let's get the list of users that will be affected for debugging
      const previewQuery = sql`SELECT u.id, u.email, u.first_name, u.last_name, u.role
        FROM users u
        WHERE u.is_active = true
          AND u.id != ${excludeUserId}
          AND u.role NOT IN ('demo_manager', 'demo_tenant', 'demo_resident')
          AND NOT EXISTS (
            SELECT 1 FROM user_organizations uo 
            WHERE uo.user_id = u.id AND uo.is_active = true
          )
          AND NOT EXISTS (
            SELECT 1 FROM user_residences ur 
            WHERE ur.user_id = u.id AND ur.is_active = true
          )`;
      
      logDebug('[STORAGE - DELETE] Getting preview of users to be deleted...');
      const previewResult = await db.execute(previewQuery);
      logDebug('[STORAGE - DELETE] Users to be deleted', { metadata: { count: previewResult.rows.length } });
      
      // Mark orphan users as inactive to avoid foreign key issues
      const updateQuery = sql`UPDATE users 
        SET is_active = false,
            updated_at = CURRENT_TIMESTAMP
        WHERE is_active = true
          AND id != ${excludeUserId}
          AND role NOT IN ('demo_manager', 'demo_tenant', 'demo_resident')
          AND NOT EXISTS (
            SELECT 1 FROM user_organizations uo 
            WHERE uo.user_id = id AND uo.is_active = true
          )
          AND NOT EXISTS (
            SELECT 1 FROM user_residences ur 
            WHERE ur.user_id = id AND ur.is_active = true
          )`;
      
      logDebug('[STORAGE - DELETE] Executing UPDATE query to mark users as inactive...');
      
      const startTime = Date.now();
      const result = await db.execute(updateQuery);
      const updateTime = Date.now();
      
      logDebug('[STORAGE - DELETE] Update operation completed', { metadata: { durationMs: updateTime - startTime } });
      
      // Count the affected rows
      const countQuery = sql`SELECT COUNT(*) as deleted_count
        FROM users u
        WHERE u.is_active = false
          AND u.id != ${excludeUserId}
          AND u.role NOT IN ('demo_manager', 'demo_tenant', 'demo_resident')
          AND u.updated_at >= CURRENT_TIMESTAMP - INTERVAL '1 minute'
          AND NOT EXISTS (
            SELECT 1 FROM user_organizations uo 
            WHERE uo.user_id = u.id AND uo.is_active = true
          )
          AND NOT EXISTS (
            SELECT 1 FROM user_residences ur 
            WHERE ur.user_id = u.id AND ur.is_active = true
          )`;
      
      logDebug('[STORAGE - DELETE] Executing count query to verify deletion...');
      const countStartTime = Date.now();
      const countResult = await db.execute(countQuery);
      const countEndTime = Date.now();
      
      const deletedCount = parseInt(String(countResult.rows[0]?.deleted_count || '0'));
      logInfo('[STORAGE - DELETE] Delete orphan users completed', { 
        userId: excludeUserId, 
        metadata: { deletedCount, totalDurationMs: countEndTime - startTime } 
      });
      
      return deletedCount;
    } catch (error: any) {
      logError('[STORAGE - DELETE] Critical error deleting orphan users', error);
      throw error;
    }
  }
}