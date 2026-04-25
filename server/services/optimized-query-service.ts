// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
/**
 * Optimized Query Service for Quebec Property Management SaaS.
 * 
 * This service provides optimized database operations with intelligent caching,
 * batch operations, and performance monitoring to achieve 50%+ query time reduction.
 * 
 * Key Optimizations:
 * - Intelligent query result caching with proper invalidation
 * - Batch operations to reduce N+1 query problems
 * - Selective field fetching to minimize over-fetching
 * - Optimized joins and scope queries
 * - Performance monitoring and metrics tracking
 */

import { eq, and, inArray, sql, desc, asc, count, exists } from 'drizzle-orm';
import { db } from '../db';
import { withCache, queryCache, CacheInvalidator } from '../query-cache';
import { dbPerformanceMonitor } from '../performance-monitoring';
import {
  users,
  organizations,
  buildings,
  residences,
  userResidences,
  userOrganizations,
  bills,
  maintenanceRequests,
  documents,
  notifications,
  budgets,
} from '@shared/schema';
import type { UserContext } from '../db/queries/scope-query';

/**
 * Interface for optimized query options
 */
interface OptimizedQueryOptions {
  /** Enable caching for this query */
  cache?: boolean;
  /** Cache TTL override (milliseconds) */
  cacheTtl?: number;
  /** Select specific fields only */
  selectFields?: string[];
  /** Maximum number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Include performance monitoring */
  monitor?: boolean;
}

/**
 * Batch operation result interface
 */
interface BatchOperationResult<T> {
  results: T[];
  totalTime: number;
  cacheHits: number;
  cacheMisses: number;
}

/**
 * Optimized Query Service with intelligent caching and performance monitoring
 */
export class OptimizedQueryService {
  private readonly cachePrefix = 'optimized_query';

  /**
   * Execute a query with automatic caching and performance monitoring
   */
  private async executeOptimizedQuery<T>(
    queryName: string,
    operation: () => Promise<T>,
    options: OptimizedQueryOptions & { cacheKey?: string } = {}
  ): Promise<T> {
    const { cache = true, cacheTtl, monitor = true, cacheKey } = options;

    if (monitor) {
      return dbPerformanceMonitor.trackQuery(queryName, async () => {
        if (cache) {
          const finalCacheKey = cacheKey || `${this.cachePrefix}:${queryName}`;
          
          // Check cache first with accurate hit/miss tracking
          const cached = queryCache.get<T>('search', finalCacheKey);
          if (cached !== undefined) {
            // Actual cache hit
            return cached;
          }
          
          // Cache miss - execute operation and cache result
          const result = await operation();
          queryCache.set('search', finalCacheKey, result, cacheTtl);
          return result;
        }
        return operation();
      });
    }

    if (cache) {
      const finalCacheKey = cacheKey || `${this.cachePrefix}:${queryName}`;
      
      // Check cache first with accurate hit/miss tracking
      const cached = queryCache.get<T>('search', finalCacheKey);
      if (cached !== undefined) {
        return cached;
      }
      
      // Cache miss - execute operation and cache result
      const result = await operation();
      queryCache.set('search', finalCacheKey, result, cacheTtl);
      return result;
    }

    return operation();
  }

  /**
   * Get user context with intelligent caching to reduce scope query overhead
   */
  async getUserContextOptimized(userId: string, userRole: string): Promise<UserContext> {
    const cacheKey = `user_context:${userId}:${userRole}`;
    
    return withCache('users', cacheKey, async () => {
      const role = userRole as UserContext['role'];
      const userContext: UserContext = { userId, role };

      // For non-admin users, populate their associated entities in batch
      if (role !== 'admin') {
        // Single query to get all user associations
        const userAssociations = await db
          .select({
            residenceId: userResidences.residenceId,
            buildingId: residences.buildingId,
            organizationId: buildings.organizationId,
          })
          .from(userResidences)
          .innerJoin(residences, eq(userResidences.residenceId, residences.id))
          .innerJoin(buildings, eq(residences.buildingId, buildings.id))
          .where(and(eq(userResidences.userId, userId), eq(userResidences.isActive, true)));

        userContext.residenceIds = Array.from(
          new Set(userAssociations.map(ua => ua.residenceId))
        );
        userContext.buildingIds = Array.from(
          new Set(userAssociations.map(ua => ua.buildingId))
        );
        userContext.organizationIds = Array.from(
          new Set(userAssociations.map(ua => ua.organizationId))
        );
      }

      return userContext;
    });
  }

  /**
   * Batch get multiple users with their assignments to reduce N+1 queries
   */
  async getUsersWithAssignmentsBatch(
    userIds: string[],
    options: OptimizedQueryOptions = {}
  ): Promise<BatchOperationResult<any>> {
    const startTime = Date.now();
    let cacheHits = 0;
    let cacheMisses = 0;

    if (userIds.length === 0) {
      return { results: [], totalTime: 0, cacheHits: 0, cacheMisses: 0 };
    }

    const cacheKey = `users_with_assignments_batch:${userIds.sort().join(',')}`;

    const results = await this.executeOptimizedQuery(
      'batch_users_with_assignments',
      async () => {
        // Single optimized query to get all user data with assignments
        const usersData = await db
          .select({
            // User fields
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            phone: users.phone,
            role: users.role,
            isActive: users.isActive,
            lastLoginAt: users.lastLoginAt,
            createdAt: users.createdAt,
            // Organization assignment
            organizationId: organizations.id,
            organizationName: organizations.name,
            organizationType: organizations.type,
            // Residence assignment
            residenceId: residences.id,
            unitNumber: residences.unitNumber,
            buildingId: buildings.id,
            buildingName: buildings.name,
            buildingAddress: buildings.address,
            relationshipType: userResidences.relationshipType,
            startDate: userResidences.startDate,
            endDate: userResidences.endDate,
          })
          .from(users)
          .leftJoin(userOrganizations, eq(users.id, userOrganizations.userId))
          .leftJoin(organizations, eq(userOrganizations.organizationId, organizations.id))
          .leftJoin(userResidences, eq(users.id, userResidences.userId))
          .leftJoin(residences, eq(userResidences.residenceId, residences.id))
          .leftJoin(buildings, eq(residences.buildingId, buildings.id))
          .where(
            and(
              inArray(users.id, userIds),
              eq(users.isActive, true)
            )
          );

        // Group by user to handle multiple assignments
        const groupedUsers = new Map();
        usersData.forEach(row => {
          if (!groupedUsers.has(row.id)) {
            groupedUsers.set(row.id, {
              id: row.id,
              email: row.email,
              firstName: row.firstName,
              lastName: row.lastName,
              phone: row.phone,
              role: row.role,
              isActive: row.isActive,
              lastLoginAt: row.lastLoginAt,
              createdAt: row.createdAt,
              organizations: [],
              residences: [],
            });
          }

          const user = groupedUsers.get(row.id);
          
          // Add organization if exists and not already added
          if (row.organizationId && !user.organizations.find((o: any) => o.id === row.organizationId)) {
            user.organizations.push({
              id: row.organizationId,
              name: row.organizationName,
              type: row.organizationType,
            });
          }

          // Add residence if exists and not already added
          if (row.residenceId && !user.residences.find((r: any) => r.id === row.residenceId)) {
            user.residences.push({
              id: row.residenceId,
              unitNumber: row.unitNumber,
              buildingId: row.buildingId,
              buildingName: row.buildingName,
              buildingAddress: row.buildingAddress,
              relationshipType: row.relationshipType,
              startDate: row.startDate,
              endDate: row.endDate,
            });
          }
        });

        return Array.from(groupedUsers.values());
      },
      { ...options, cacheKey }
    );

    const totalTime = Date.now() - startTime;
    return { results, totalTime, cacheHits, cacheMisses };
  }

  /**
   * Optimized bills query with selective fields and intelligent caching
   */
  async getBillsOptimized(
    userContext: UserContext,
    options: OptimizedQueryOptions & {
      status?: string[];
      residenceIds?: string[];
      dateRange?: { start: string; end: string };
    } = {}
  ): Promise<any[]> {
    const { status, residenceIds, dateRange, selectFields, limit, offset } = options;
    
    // Build cache key based on parameters
    const cacheKey = `bills_optimized:${userContext.userId}:${JSON.stringify({ status, residenceIds, dateRange, limit, offset })}`;

    return this.executeOptimizedQuery(
      'bills_optimized',
      async () => {
        // Get accessible residence IDs efficiently (cached from user context)
        let accessibleResidenceIds = userContext.residenceIds || [];
        
        if (userContext.role === 'admin') {
          // For admin, get all residences (cached)
          const allResidences = await withCache('residences', 'all_residence_ids', async () => {
            const result = await db.select({ id: residences.id }).from(residences);
            return result.map(r => r.id);
          });
          accessibleResidenceIds = allResidences;
        }

        if (residenceIds) {
          accessibleResidenceIds = accessibleResidenceIds.filter(id => residenceIds.includes(id));
        }

        if (accessibleResidenceIds.length === 0) {
          return [];
        }

        // Build conditions
        const conditions = [inArray(bills.residenceId, accessibleResidenceIds)];
        
        if (status && status.length > 0) {
          conditions.push(inArray(bills.status, status as any));
        }
        
        if (dateRange) {
          conditions.push(sql`${bills.issueDate} >= ${dateRange.start}`);
          conditions.push(sql`${bills.issueDate} <= ${dateRange.end}`);
        }

        // Optimized query with selective fields
        const fields = selectFields ? 
          Object.fromEntries(selectFields.map(field => [field, bills[field as keyof typeof bills]])) :
          {
            id: bills.id,
            billNumber: bills.billNumber,
            type: bills.type,
            description: bills.description,
            amount: bills.amount,
            dueDate: bills.dueDate,
            issueDate: bills.issueDate,
            status: bills.status,
            finalAmount: bills.finalAmount,
            residenceId: bills.residenceId,
            // Include essential context without full joins
            unitNumber: residences.unitNumber,
            buildingName: buildings.name,
          };

        let query = db
          .select(fields)
          .from(bills)
          .leftJoin(residences, eq(bills.residenceId, residences.id))
          .leftJoin(buildings, eq(residences.buildingId, buildings.id))
          .where(and(...conditions))
          .orderBy(desc(bills.dueDate));

        if (limit) {
          query = query.limit(limit) as any;
        }
        if (offset) {
          query = query.offset(offset) as any;
        }

        return query;
      },
      { ...options, cache: true, cacheKey }
    );
  }

  /**
   * Optimized maintenance requests query with reduced joins
   */
  async getMaintenanceRequestsOptimized(
    userContext: UserContext,
    options: OptimizedQueryOptions & {
      status?: string[];
      priority?: string[];
      buildingIds?: string[];
    } = {}
  ): Promise<any[]> {
    const { status, priority, buildingIds } = options;
    
    const cacheKey = `maintenance_optimized:${userContext.userId}:${JSON.stringify({ status, priority, buildingIds })}`;

    return this.executeOptimizedQuery(
      'maintenance_requests_optimized',
      async () => {
        // Get accessible residence IDs from cached user context
        let accessibleResidenceIds = userContext.residenceIds || [];
        
        if (userContext.role === 'admin') {
          const allResidences = await withCache('residences', 'all_residence_ids', async () => {
            const result = await db.select({ id: residences.id }).from(residences);
            return result.map(r => r.id);
          });
          accessibleResidenceIds = allResidences;
        }

        if (buildingIds) {
          // Filter residences by building IDs
          const buildingResidences = await withCache('residences', `building_residences:${buildingIds.join(',')}`, async () => {
            const result = await db
              .select({ id: residences.id })
              .from(residences)
              .where(inArray(residences.buildingId, buildingIds));
            return result.map(r => r.id);
          });
          accessibleResidenceIds = accessibleResidenceIds.filter(id => buildingResidences.includes(id));
        }

        if (accessibleResidenceIds.length === 0) {
          return [];
        }

        // Build conditions
        const conditions = [inArray(maintenanceRequests.residenceId, accessibleResidenceIds)];
        
        if (status && status.length > 0) {
          conditions.push(inArray(maintenanceRequests.status, status as any));
        }
        
        if (priority && priority.length > 0) {
          conditions.push(inArray(maintenanceRequests.priority, priority as any));
        }

        // Tenant-specific filtering
        if (userContext.role === 'tenant') {
          conditions.push(eq(maintenanceRequests.submittedBy, userContext.userId));
        }

        return db
          .select({
            id: maintenanceRequests.id,
            title: maintenanceRequests.title,
            description: maintenanceRequests.description,
            status: maintenanceRequests.status,
            priority: maintenanceRequests.priority,
            category: maintenanceRequests.category,
            submittedBy: maintenanceRequests.submittedBy,
            assignedTo: maintenanceRequests.assignedTo,
            scheduledDate: maintenanceRequests.scheduledDate,
            completedDate: maintenanceRequests.completedDate,
            residenceId: maintenanceRequests.residenceId,
            createdAt: maintenanceRequests.createdAt,
            // Essential context without complex joins
            unitNumber: residences.unitNumber,
            buildingName: buildings.name,
          })
          .from(maintenanceRequests)
          .leftJoin(residences, eq(maintenanceRequests.residenceId, residences.id))
          .leftJoin(buildings, eq(residences.buildingId, buildings.id))
          .where(and(...conditions))
          .orderBy(desc(maintenanceRequests.createdAt));
      },
      { ...options, cache: true, cacheKey }
    );
  }

  /**
   * Optimized building statistics with materialized view preference
   */
  async getBuildingStatisticsOptimized(
    buildingIds: string[],
    options: OptimizedQueryOptions = {}
  ): Promise<any[]> {
    if (buildingIds.length === 0) return [];

    const cacheKey = `building_stats:${buildingIds.sort().join(',')}`;

    return this.executeOptimizedQuery(
      'building_statistics_optimized',
      async () => {
        try {
          // Try to use materialized view first (much faster)
          const materializedStats = await db
            .select()
            .from(sql`mv_building_stats`)
            .where(sql`building_id = ANY(${buildingIds})`);
          
          if (materializedStats.length > 0) {
            return materializedStats;
          }
        } catch (error) {
          // Materialized view doesn't exist or is stale, fall back to real-time query
        }

        // Fall back to optimized real-time calculation
        return db
          .select({
            buildingId: buildings.id,
            buildingName: buildings.name,
            totalResidences: count(residences.id),
            totalActiveResidences: sql<number>`COUNT(CASE WHEN ${residences.isActive} = true THEN 1 END)`,
            totalUsers: sql<number>`COUNT(DISTINCT ${userResidences.userId})`,
            overdueBills: sql<number>`COUNT(CASE WHEN ${bills.status} = 'overdue' THEN 1 END)`,
            openMaintenance: sql<number>`COUNT(CASE WHEN ${maintenanceRequests.status} IN ('submitted', 'acknowledged', 'in_progress') THEN 1 END)`,
          })
          .from(buildings)
          .leftJoin(residences, eq(buildings.id, residences.buildingId))
          .leftJoin(userResidences, and(eq(residences.id, userResidences.residenceId), eq(userResidences.isActive, true)))
          .leftJoin(bills, eq(residences.id, bills.residenceId))
          .leftJoin(maintenanceRequests, eq(residences.id, maintenanceRequests.residenceId))
          .where(
            and(
              inArray(buildings.id, buildingIds),
              eq(buildings.isActive, true)
            )
          )
          .groupBy(buildings.id, buildings.name);
      },
      { ...options, cache: true, cacheTtl: 5 * 60 * 1000, cacheKey } // 5 minutes for statistics
    );
  }

  /**
   * Batch invalidate caches for multiple entities
   */
  async batchInvalidateCache(operations: Array<{
    entityType: 'user' | 'building' | 'residence' | 'organization' | 'document';
    entityId: string;
    operation: 'create' | 'update' | 'delete';
    additionalContext?: any;
  }>): Promise<void> {
    // Group invalidations by type for efficiency
    const userIds = new Set<string>();
    const buildingIds = new Set<string>();
    const residenceIds = new Set<string>();
    const organizationIds = new Set<string>();

    operations.forEach(op => {
      switch (op.entityType) {
        case 'user':
          userIds.add(op.entityId);
          break;
        case 'building':
          buildingIds.add(op.entityId);
          break;
        case 'residence':
          residenceIds.add(op.entityId);
          break;
        case 'organization':
          organizationIds.add(op.entityId);
          break;
      }
    });

    // Batch invalidate
    userIds.forEach(id => CacheInvalidator.invalidateUserCaches(id));
    buildingIds.forEach(id => CacheInvalidator.invalidateBuildingCaches(id));
    residenceIds.forEach(id => CacheInvalidator.invalidateResidenceCaches(id));
    organizationIds.forEach(id => CacheInvalidator.invalidateOrganizationCaches(id));

    // Invalidate parameter-based aggregated caches
    queryCache.invalidate('search', 'optimized_query:*'); // All optimized query caches
    queryCache.invalidate('search', 'building_stats:*');
    queryCache.invalidate('search', 'maintenance_optimized:*');
    queryCache.invalidate('search', 'bills_optimized:*');
    queryCache.invalidate('search', 'users_with_assignments_batch:*');
    
    // Invalidate scope query caches
    queryCache.invalidate('search', 'scope_query:*');
  }

  /**
   * Enhanced cache invalidation for user assignment changes
   */
  async invalidateUserAssignmentCaches(userId: string): Promise<void> {
    // Invalidate user-specific caches
    queryCache.invalidate('users', `user_context:${userId}:*`);
    queryCache.invalidate('users', `scope_query:user_context:${userId}:*`);
    
    // Invalidate any batch queries that might include this user
    queryCache.invalidate('search', `users_with_assignments_batch:*`);
    queryCache.invalidate('search', `optimized_query:batch_users_with_assignments`);
    
    // Invalidate user-specific query results
    queryCache.invalidate('search', `bills_optimized:${userId}:*`);
    queryCache.invalidate('search', `maintenance_optimized:${userId}:*`);
    queryCache.invalidate('search', `scope_query:batch:${userId}:*`);
  }

  /**
   * Get cache performance metrics for optimized queries with improved accuracy
   */
  getCacheMetrics(): any {
    const stats = queryCache.getStats();
    const performanceStats = dbPerformanceMonitor.getPerformanceStats();
    
    // Calculate more accurate cache metrics
    return {
      cacheStats: stats,
      performanceStats,
      cacheEffectiveness: {
        totalQueries: performanceStats.totalQueries,
        averageQueryTime: performanceStats.averageQueryTime,
        cacheHitRate: this.calculateAccurateCacheHitRate(stats),
        cacheSizeOptimization: this.analyzeCacheSize(stats)
      }
    };
  }

  /**
   * Calculate more accurate cache hit rate
   */
  private calculateAccurateCacheHitRate(stats: any): number {
    const cacheTypes = Object.keys(stats);
    const totalHits = cacheTypes.reduce((sum, type) => sum + (stats[type].hits || 0), 0);
    const totalMisses = cacheTypes.reduce((sum, type) => sum + (stats[type].misses || 0), 0);
    const totalRequests = totalHits + totalMisses;
    return totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
  }

  /**
   * Analyze cache size optimization
   */
  private analyzeCacheSize(stats: any): any {
    const cacheTypes = Object.keys(stats);
    return cacheTypes.reduce((analysis, type) => {
      const typeStats = stats[type];
      analysis[type] = {
        utilizationRate: typeStats.maxSize > 0 ? (typeStats.size / typeStats.maxSize) * 100 : 0,
        hitRate: typeStats.hits + typeStats.misses > 0 ? (typeStats.hits / (typeStats.hits + typeStats.misses)) * 100 : 0,
        size: typeStats.size,
        maxSize: typeStats.maxSize
      };
      return analysis;
    }, {} as any);
  }

  /**
   * Get query performance metrics
   */
  getPerformanceMetrics(): any {
    return dbPerformanceMonitor.getPerformanceStats();
  }

  /**
   * Warm up frequently accessed caches
   */
  async warmupCaches(): Promise<void> {
    try {
      // Warm up common reference data
      await withCache('residences', 'all_residence_ids', async () => {
        const result = await db.select({ id: residences.id }).from(residences);
        return result.map(r => r.id);
      });

      await withCache('buildings', 'all_building_ids', async () => {
        const result = await db.select({ id: buildings.id }).from(buildings);
        return result.map(r => r.id);
      });

      await withCache('organizations', 'all_organization_ids', async () => {
        const result = await db.select({ id: organizations.id }).from(organizations);
        return result.map(r => r.id);
      });

      // console.log('✅ Cache warmup completed');
    } catch (error) {
      // console.error('❌ Error during cache warmup:', error);
    }
  }
}

/**
 * Global optimized query service instance
 */
export const optimizedQueryService = new OptimizedQueryService();

/**
 * Helper function to wrap existing queries with optimization
 */
export function optimizeQuery<T>(
  queryName: string,
  operation: () => Promise<T>,
  options: OptimizedQueryOptions = {}
): Promise<T> {
  return optimizedQueryService['executeOptimizedQuery'](queryName, operation, options);
}