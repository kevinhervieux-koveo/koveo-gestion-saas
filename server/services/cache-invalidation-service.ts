/**
 * Cache Invalidation Service for Quebec Property Management SaaS.
 * 
 * This service provides centralized cache invalidation for user context and 
 * association-related caches to ensure data consistency and security.
 */

import { queryCache } from '../query-cache';
import { optimizedScopeManager } from '../db/queries/optimized-scope-queries';
import { optimizedQueryService } from './optimized-query-service';

/**
 * Types of entities that can trigger cache invalidation
 */
export type InvalidationEntityType = 
  | 'user' 
  | 'userResidence' 
  | 'userOrganization' 
  | 'residence' 
  | 'building' 
  | 'organization';

/**
 * Invalidation operation types
 */
export type InvalidationOperation = 'create' | 'update' | 'delete';

/**
 * Invalidation context for tracking what triggered the invalidation
 */
interface InvalidationContext {
  entityType: InvalidationEntityType;
  entityId: string;
  operation: InvalidationOperation;
  affectedUserIds?: string[];
  additionalContext?: Record<string, any>;
  triggeredBy?: string; // User ID who triggered the change
  timestamp?: Date;
}

/**
 * Centralized Cache Invalidation Service
 */
export class CacheInvalidationService {
  private readonly logPrefix = '🗑️ [CACHE-INVALIDATION]';

  /**
   * Invalidate all caches related to user associations
   */
  async invalidateUserAssociations(context: InvalidationContext): Promise<void> {
    const { entityType, entityId, operation, affectedUserIds = [], triggeredBy } = context;
    

    const startTime = Date.now();
    const invalidationPromises: Promise<void>[] = [];

    // 1. Invalidate scope caches for affected users
    if (affectedUserIds.length > 0) {
      invalidationPromises.push(
        optimizedScopeManager.invalidateAssociationCaches(affectedUserIds)
      );
    }

    // 2. Invalidate optimized query service caches
    for (const userId of affectedUserIds) {
      invalidationPromises.push(
        optimizedQueryService.invalidateUserAssignmentCaches(userId)
      );
    }

    // 3. Entity-specific invalidations
    switch (entityType) {
      case 'userResidence':
        invalidationPromises.push(this.invalidateResidenceAssignmentCaches(entityId, affectedUserIds));
        break;
      case 'userOrganization':
        invalidationPromises.push(this.invalidateOrganizationAssignmentCaches(entityId, affectedUserIds));
        break;
      case 'user':
        invalidationPromises.push(this.invalidateUserSpecificCaches(entityId));
        break;
      case 'residence':
        invalidationPromises.push(this.invalidateResidenceCaches(entityId));
        break;
      case 'building':
        invalidationPromises.push(this.invalidateBuildingCaches(entityId));
        break;
      case 'organization':
        invalidationPromises.push(this.invalidateOrganizationCaches(entityId));
        break;
    }

    // 4. Execute all invalidations in parallel
    await Promise.allSettled(invalidationPromises);

    const duration = Date.now() - startTime;

    // 5. Log invalidation for audit trail
    this.logInvalidation(context, duration);
  }

  /**
   * Invalidate caches when user-residence assignments change
   */
  private async invalidateResidenceAssignmentCaches(residenceId: string, userIds: string[]): Promise<void> {
    // Invalidate residence-specific caches
    queryCache.invalidate('search', `bills_optimized:*:*residenceIds*${residenceId}*`);
    queryCache.invalidate('search', `maintenance_optimized:*:*buildingIds*`);
    
    // Invalidate building statistics that might include this residence
    queryCache.invalidate('search', `building_stats:*`);
    
  }

  /**
   * Invalidate caches when user-organization assignments change
   */
  private async invalidateOrganizationAssignmentCaches(organizationId: string, userIds: string[]): Promise<void> {
    // Invalidate organization-wide caches
    queryCache.invalidate('search', `optimized_query:*organization*${organizationId}*`);
    queryCache.invalidate('users', `*organization*${organizationId}*`);
    
  }

  /**
   * Invalidate all caches for a specific user
   */
  private async invalidateUserSpecificCaches(userId: string): Promise<void> {
    // Invalidate all user-specific caches
    queryCache.invalidate('users', `*${userId}*`);
    queryCache.invalidate('search', `*${userId}*`);
    
  }

  /**
   * Invalidate caches for a residence
   */
  private async invalidateResidenceCaches(residenceId: string): Promise<void> {
    queryCache.invalidate('search', `*residence*${residenceId}*`);
    queryCache.invalidate('residences', `*${residenceId}*`);
    
  }

  /**
   * Invalidate caches for a building
   */
  private async invalidateBuildingCaches(buildingId: string): Promise<void> {
    queryCache.invalidate('search', `*building*${buildingId}*`);
    queryCache.invalidate('buildings', `*${buildingId}*`);
    queryCache.invalidate('search', `building_stats:*${buildingId}*`);
    
  }

  /**
   * Invalidate caches for an organization
   */
  private async invalidateOrganizationCaches(organizationId: string): Promise<void> {
    queryCache.invalidate('search', `*organization*${organizationId}*`);
    queryCache.invalidate('organizations', `*${organizationId}*`);
    
  }

  /**
   * Bulk invalidation for multiple users (more efficient than individual calls)
   */
  async bulkInvalidateUsers(userIds: string[], context: Partial<InvalidationContext> = {}): Promise<void> {
    if (userIds.length === 0) return;


    const fullContext: InvalidationContext = {
      entityType: 'user',
      entityId: 'bulk',
      operation: 'update',
      affectedUserIds: userIds,
      timestamp: new Date(),
      ...context,
    };

    await this.invalidateUserAssociations(fullContext);
  }

  /**
   * Smart invalidation that determines what to invalidate based on the change
   */
  async smartInvalidate(changes: {
    before?: Record<string, any>;
    after?: Record<string, any>;
    entityType: InvalidationEntityType;
    entityId: string;
    operation: InvalidationOperation;
    triggeredBy?: string;
  }): Promise<void> {
    const { before, after, entityType, entityId, operation, triggeredBy } = changes;
    
    let affectedUserIds: string[] = [];

    // Determine affected users based on the type of change
    switch (entityType) {
      case 'userResidence':
        if (before?.userId) affectedUserIds.push(before.userId);
        if (after?.userId && !affectedUserIds.includes(after.userId)) {
          affectedUserIds.push(after.userId);
        }
        break;
      
      case 'userOrganization':
        if (before?.userId) affectedUserIds.push(before.userId);
        if (after?.userId && !affectedUserIds.includes(after.userId)) {
          affectedUserIds.push(after.userId);
        }
        break;
      
      case 'user':
        affectedUserIds = [entityId];
        break;
    }

    await this.invalidateUserAssociations({
      entityType,
      entityId,
      operation,
      affectedUserIds,
      triggeredBy,
      timestamp: new Date(),
      additionalContext: { before, after },
    });
  }

  /**
   * Get invalidation statistics
   */
  getInvalidationStats(): {
    cacheStats: any;
    recommendedActions: string[];
  } {
    const cacheStats = queryCache.getStats();
    const recommendations: string[] = [];

    // Analyze cache hit rates and recommend invalidation strategies
    Object.entries(cacheStats).forEach(([cacheType, stats]) => {
      const hitRate = stats.hits + stats.misses > 0 ? 
        (stats.hits / (stats.hits + stats.misses)) * 100 : 0;
      
      if (hitRate < 50) {
        recommendations.push(`Low hit rate (${hitRate.toFixed(1)}%) for ${cacheType} cache - consider reviewing invalidation strategy`);
      }
      
      if (stats.size / stats.maxSize > 0.9) {
        recommendations.push(`${cacheType} cache is ${((stats.size / stats.maxSize) * 100).toFixed(1)}% full - consider increasing size or more aggressive invalidation`);
      }
    });

    return {
      cacheStats,
      recommendedActions: recommendations,
    };
  }

  /**
   * Log invalidation for audit and debugging
   */
  private logInvalidation(context: InvalidationContext, duration: number): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      entityType: context.entityType,
      entityId: context.entityId,
      operation: context.operation,
      affectedUsers: context.affectedUserIds?.length || 0,
      durationMs: duration,
      triggeredBy: context.triggeredBy,
    };

    // In production, this could be sent to a logging service
  }

  /**
   * Preemptive cache warming after invalidation
   */
  async warmupAfterInvalidation(userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;


    // Warm up user contexts for affected users (in batches to avoid overwhelming the DB)
    const batchSize = 5;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      
      const warmupPromises = batch.map(async userId => {
        try {
          // Get user role first
          const user = await queryCache.get('users', `user:${userId}`) || 
                       await optimizedQueryService.getUserContextOptimized(userId, 'tenant'); // fallback role
          
          if (user) {
            await optimizedScopeManager.buildOptimizedUserContext(userId, user.role, { cache: true });
          }
        } catch (error) {
        }
      });

      await Promise.allSettled(warmupPromises);
    }

  }
}

/**
 * Global cache invalidation service instance
 */
export const cacheInvalidationService = new CacheInvalidationService();

/**
 * Middleware factory for automatic cache invalidation
 */
export function createInvalidationMiddleware(
  entityType: InvalidationEntityType,
  options: {
    extractEntityId?: (req: any) => string;
    extractAffectedUsers?: (req: any, res: any) => Promise<string[]>;
    operation?: InvalidationOperation;
  } = {}
) {
  return async (req: any, res: any, next: any) => {
    // Store original res.json to intercept successful responses
    const originalJson = res.json.bind(res);
    
    res.json = async function(data: any) {
      // Only invalidate on successful responses (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const entityId = options.extractEntityId?.(req) || req.params.id || req.params.userId || req.params.residenceId;
          const affectedUsers = await options.extractAffectedUsers?.(req, res) || [];
          const operation = options.operation || (req.method === 'POST' ? 'create' : req.method === 'PUT' || req.method === 'PATCH' ? 'update' : 'delete');
          
          if (entityId) {
            await cacheInvalidationService.invalidateUserAssociations({
              entityType,
              entityId,
              operation,
              affectedUserIds: affectedUsers,
              triggeredBy: req.user?.id,
              timestamp: new Date(),
            });
          }
        } catch (error) {
          console.error(`${cacheInvalidationService['logPrefix']} Error in invalidation middleware:`, error);
          // Don't fail the request if invalidation fails
        }
      }
      
      return originalJson(data);
    };
    
    next();
  };
}