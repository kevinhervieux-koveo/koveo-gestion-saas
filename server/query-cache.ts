/**
 * Query caching system for Quebec property management SaaS.
 * Implements intelligent caching to reduce 132ms average query time.
 */

import { LRUCache } from 'lru-cache';

/**
 * Cache configuration for different types of queries.
 */
interface CacheConfig {
  maxSize: number;
  ttl: number; // Time to live in milliseconds
}

/**
 * Cache configurations optimized for property management workloads.
 */
const CACHE_CONFIGS: Record<string, CacheConfig> = {
  // User data - frequently accessed, moderate changes
  // OPTIMIZED: Longer TTL for complex user assignments query
  users: { maxSize: 1500, ttl: 8 * 60 * 1000 }, // 8 minutes (was 5)

  // Organization data - stable, infrequent changes
  organizations: { maxSize: 200, ttl: 45 * 60 * 1000 }, // 45 minutes (was 30)

  // Building data - relatively stable
  // OPTIMIZED: Increased cache size and TTL for building queries
  buildings: { maxSize: 1000, ttl: 20 * 60 * 1000 }, // 20 minutes (was 15)

  // Residence data - stable structure, occasional updates
  // OPTIMIZED: Increased cache size for residence queries
  residences: { maxSize: 3000, ttl: 12 * 60 * 1000 }, // 12 minutes (was 10)

  // Documents - frequently accessed, moderate updates
  // OPTIMIZED: New cache category for document queries
  documents: { maxSize: 2000, ttl: 10 * 60 * 1000 }, // 10 minutes

  // Bills - time-sensitive, frequent updates
  bills: { maxSize: 1500, ttl: 3 * 60 * 1000 }, // 3 minutes (was 2)

  // Maintenance requests - dynamic, frequent status changes
  maintenance: { maxSize: 750, ttl: 90 * 1000 }, // 90 seconds (was 60)

  // Notifications - real-time, short cache
  notifications: { maxSize: 1000, ttl: 45 * 1000 }, // 45 seconds (was 30)

  // Quality metrics - stable for periods
  metrics: { maxSize: 300, ttl: 8 * 60 * 1000 }, // 8 minutes (was 5)

  // Features and roadmap - moderately stable
  features: { maxSize: 500, ttl: 5 * 60 * 1000 }, // 5 minutes (was 3)

  // Framework configuration - very stable
  config: { maxSize: 150, ttl: 90 * 60 * 1000 }, // 1.5 hours (was 1)

  // Bug reports - moderate changes, user-specific
  bugs: { maxSize: 750, ttl: 4 * 60 * 1000 }, // 4 minutes (was 2)

  // Financial data - moderate changes, important for dashboard
  financial: { maxSize: 500, ttl: 5 * 60 * 1000 }, // 5 minutes

  // Search results - temporary but frequently accessed
  search: { maxSize: 1000, ttl: 2 * 60 * 1000 }, // 2 minutes

  // Statistics and aggregations - expensive to compute
  stats: { maxSize: 300, ttl: 10 * 60 * 1000 }, // 10 minutes
};

/**
 * Cache instances for different data types.
 */
class QueryCacheManager {
  private caches: Map<string, LRUCache<string, any>> = new Map();
  private hitCounts: Map<string, number> = new Map();
  private missCounts: Map<string, number> = new Map();

  /**
   *
   */
  constructor() {
    // Initialize caches for each data type
    Object.entries(CACHE_CONFIGS).forEach(([type, config]) => {
      this.caches.set(
        type,
        new LRUCache({
          max: config.maxSize,
          ttl: config.ttl,
          updateAgeOnGet: true,
          updateAgeOnHas: true,
        })
      );
      this.hitCounts.set(type, 0);
      this.missCounts.set(type, 0);
    });
  }

  /**
   * Gets cached data if available.
   * @param cacheType Type of cache (users, buildings, etc.).
   * @param key Cache key.
   * @param _key
   * @returns Cached data or undefined.
   */
  get<T>(cacheType: string, _key: string): T | undefined {
    const cache = this.caches.get(cacheType);
    if (!cache) {
      return undefined;
    }

    const result = cache.get(_key);
    if (result !== undefined) {
      this.hitCounts.set(cacheType, (this.hitCounts.get(cacheType) || 0) + 1);
      return result;
    }

    this.missCounts.set(cacheType, (this.missCounts.get(cacheType) || 0) + 1);
    return undefined;
  }

  /**
   * Stores data in cache.
   * @param cacheType Type of cache.
   * @param key Cache key.
   * @param data Data to cache.
   * @param _key
   * @param _data
   */
  set<T>(cacheType: string, _key: string, _data: T): void {
    const cache = this.caches.get(cacheType);
    if (!cache) {
      return;
    }

    cache.set(_key, _data);
  }

  /**
   * Invalidates cache entries by pattern.
   * @param cacheType Type of cache.
   * @param pattern Key pattern to invalidate (supports wildcards).
   */
  invalidate(cacheType: string, pattern?: string): void {
    const cache = this.caches.get(cacheType);
    if (!cache) {
      return;
    }

    if (pattern) {
      // Remove entries matching pattern
      for (const key of cache.keys()) {
        if (this.matchesPattern(key, pattern)) {
          cache.delete(key);
        }
      }
    } else {
      // Clear entire cache
      cache.clear();
    }
  }

  /**
   * Gets cache performance statistics.
   */
  getStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [_type, cache] of this.caches) {
      const hits = this.hitCounts.get(_type) || 0;
      const misses = this.missCounts.get(_type) || 0;
      const total = hits + misses;
      const hitRate = total > 0 ? ((hits / total) * 100).toFixed(2) : '0.00';

      stats[_type] = {
        size: cache.size,
        maxSize: cache.max,
        hits,
        misses,
        hitRate: `${hitRate}%`,
        memoryUsage: this.estimateMemoryUsage(cache),
      };
    }

    return stats;
  }

  /**
   * Clears all caches.
   */
  clearAll(): void {
    for (const [_type, cache] of this.caches) {
      cache.clear();
      this.hitCounts.set(_type, 0);
      this.missCounts.set(_type, 0);
    }
  }

  /**
   * Pattern matching for cache key invalidation.
   * @param key
   * @param _key
   * @param pattern
   */
  private matchesPattern(_key: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(_key);
  }

  /**
   * Estimates memory usage of a cache.
   * @param cache
   */
  private estimateMemoryUsage(cache: LRUCache<string, any>): string {
    let totalSize = 0;
    for (const value of cache.values()) {
      totalSize += JSON.stringify(value).length * 2; // Rough estimate
    }
    return `${(totalSize / 1024).toFixed(2)} KB`;
  }
}

/**
 * Global cache manager instance.
 */
export const queryCache = new QueryCacheManager();

/**
 * Cached query helper function for database operations.
 * Replaces decorator approach for better compatibility.
 * @param cacheType
 * @param cacheKey
 * @param operation
 */
/**
 * WithCache function.
 * @param cacheType
 * @param cacheKey
 * @param operation
 * @returns Function result.
 */
export function withCache<T>(
  cacheType: string,
  cacheKey: string,
  operation: () => Promise<T>
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    try {
      // Try to get from cache first
      const cached = queryCache.get<T>(cacheType, cacheKey);
      if (cached !== undefined) {
        resolve(cached);
        return;
      }

      // Execute operation
      const result = await operation();

      // Cache the result
      queryCache.set(cacheType, cacheKey, result);

      resolve(result);
    } catch (error: any) {
      reject(error);
    }
  });
}

/**
 * Cache invalidation utilities for specific operations.
 * OPTIMIZED: Added smarter invalidation patterns and cascade invalidation.
 */
export class CacheInvalidator {
  /**
   * Invalidates user-related caches when user data changes.
   * OPTIMIZED: More comprehensive user cache invalidation.
   * @param userId
   */
  static invalidateUserCaches(userId: string): void {
    // Individual user caches
    queryCache.invalidate('users', `user:${userId}*`);
    queryCache.invalidate('users', `users_by_org:${userId}*`);
    queryCache.invalidate('residences', `user_residences:${userId}*`);
    queryCache.invalidate('residences', `user_residences_details:${userId}*`);
    queryCache.invalidate('documents', `legacy_docs:${userId}*`);
    queryCache.invalidate('notifications', `user_notifications:${userId}*`);
    
    // Invalidate aggregated user queries that include this user
    queryCache.invalidate('users', 'all_users');
    queryCache.invalidate('users', 'all_users_assignments*');
  }

  /**
   * Invalidates building-related caches when building data changes.
   * OPTIMIZED: Cascade invalidation for building dependencies.
   * @param buildingId
   */
  static invalidateBuildingCaches(buildingId: string): void {
    // Building-specific caches
    queryCache.invalidate('buildings', `building:${buildingId}*`);
    queryCache.invalidate('residences', `building_residences:${buildingId}*`);
    queryCache.invalidate('documents', `building_documents:${buildingId}*`);
    queryCache.invalidate('financial', `building_budgets:${buildingId}*`);
    queryCache.invalidate('stats', `building_stats:${buildingId}*`);
    
    // Invalidate aggregated building queries
    queryCache.invalidate('buildings', 'all_buildings');
    queryCache.invalidate('buildings', 'buildings_with_residents*');
    
    // Cascade invalidation - building changes affect user assignments
    queryCache.invalidate('users', 'all_users_assignments*');
  }

  /**
   * Invalidates residence-related caches when residence data changes.
   * OPTIMIZED: Comprehensive residence cache invalidation.
   * @param residenceId
   */
  static invalidateResidenceCaches(residenceId: string): void {
    // Residence-specific caches
    queryCache.invalidate('residences', `residence:${residenceId}*`);
    queryCache.invalidate('documents', `residence_documents:${residenceId}*`);
    queryCache.invalidate('bills', `residence_bills:${residenceId}*`);
    queryCache.invalidate('maintenance', `residence_maintenance:${residenceId}*`);
    
    // Invalidate aggregated queries that include this residence
    queryCache.invalidate('residences', 'all_residences');
    queryCache.invalidate('users', 'all_users_assignments*');
  }

  /**
   * Invalidates organization-related caches when organization data changes.
   * OPTIMIZED: New method for organization cache invalidation.
   * @param organizationId
   */
  static invalidateOrganizationCaches(organizationId: string): void {
    // Organization-specific caches
    queryCache.invalidate('organizations', `organization:${organizationId}*`);
    queryCache.invalidate('buildings', `org_buildings:${organizationId}*`);
    queryCache.invalidate('stats', `organization_overview:${organizationId}*`);
    
    // Invalidate aggregated queries
    queryCache.invalidate('organizations', 'all_organizations');
    queryCache.invalidate('users', 'all_users_assignments*');
  }

  /**
   * Invalidates document-related caches when document data changes.
   * OPTIMIZED: New method for document cache invalidation.
   * @param documentId
   * @param buildingId
   * @param residenceId
   */
  static invalidateDocumentCaches(documentId?: string, buildingId?: string, residenceId?: string): void {
    if (documentId) {
      queryCache.invalidate('documents', `document:${documentId}*`);
    }
    
    if (buildingId) {
      queryCache.invalidate('documents', `building_documents:${buildingId}*`);
    }
    
    if (residenceId) {
      queryCache.invalidate('documents', `residence_documents:${residenceId}*`);
    }
    
    // Invalidate general document queries
    queryCache.invalidate('documents', 'documents:*');
  }

  /**
   * Smart invalidation based on operation type.
   * OPTIMIZED: Intelligent cache invalidation based on operation context.
   * @param operation
   * @param entityType
   * @param entityId
   * @param additionalContext
   */
  static smartInvalidate(
    operation: 'create' | 'update' | 'delete',
    entityType: 'user' | 'building' | 'residence' | 'organization' | 'document',
    entityId: string,
    additionalContext?: { buildingId?: string; residenceId?: string; userId?: string }
  ): void {
    switch (entityType) {
      case 'user':
        this.invalidateUserCaches(entityId);
        break;
      case 'building':
        this.invalidateBuildingCaches(entityId);
        break;
      case 'residence':
        this.invalidateResidenceCaches(entityId);
        // Cascade to building if provided
        if (additionalContext?.buildingId) {
          this.invalidateBuildingCaches(additionalContext.buildingId);
        }
        break;
      case 'organization':
        this.invalidateOrganizationCaches(entityId);
        break;
      case 'document':
        this.invalidateDocumentCaches(
          entityId,
          additionalContext?.buildingId,
          additionalContext?.residenceId
        );
        break;
    }

    // For delete operations, be more aggressive with cache clearing
    if (operation === 'delete') {
      // Clear search caches as deleted items should not appear
      queryCache.invalidate('search');
    }
  }

  /**
   * Invalidates all caches (use sparingly).
   */
  static invalidateAll(): void {
    queryCache.clearAll();
  }
}

/**
 * Performance monitoring for cache effectiveness.
 */
export class CacheMonitor {
  /**
   * Logs cache performance statistics.
   */
  static logPerformanceStats(): void {
    const stats = queryCache.getStats();
    console.table(stats);
  }

  /**
   * Monitors cache hit rates and suggests optimizations.
   */
  static analyzePerformance(): string[] {
    const stats = queryCache.getStats();
    const suggestions: string[] = [];

    Object.entries(stats).forEach(([cacheType, stat]) => {
      const hitRate = parseFloat(stat.hitRate.replace('%', ''));

      if (hitRate < 50) {
        suggestions.push(
          `Low hit rate for ${cacheType} cache (${stat.hitRate}). Consider increasing TTL or cache size.`
        );
      }

      if (stat.size === stat.maxSize) {
        suggestions.push(
          `${cacheType} cache is at maximum capacity. Consider increasing max size.`
        );
      }
    });

    return suggestions;
  }

  /**
   * Gets memory usage summary for all caches.
   */
  static getMemoryUsage(): string {
    const stats = queryCache.getStats();
    let totalMemory = 0;

    Object.values(stats).forEach((stat: any) => {
      totalMemory += parseFloat(stat.memoryUsage.replace(' KB', ''));
    });

    return `${totalMemory.toFixed(2)} KB`;
  }
}

/**
 * Automatic cache warming for frequently accessed data.
 */
export class CacheWarmer {
  /**
   * Warms up caches with frequently accessed data.
   */
  static async warmCaches(): Promise<void> {

    try {
      // This would be implemented with actual database calls
      // Example: Pre-load active users, organizations, etc.
    } catch (error: any) {
      console.error('❌ Error warming caches:', error);
    }
  }
}

/**
 * Export cache utilities for easy access.
 */
export { queryCache as default, QueryCacheManager, CACHE_CONFIGS };
