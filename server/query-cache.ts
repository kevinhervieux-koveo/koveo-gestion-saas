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
  users: { maxSize: 1000, ttl: 5 * 60 * 1000 }, // 5 minutes
  
  // Organization data - stable, infrequent changes
  organizations: { maxSize: 100, ttl: 30 * 60 * 1000 }, // 30 minutes
  
  // Building data - relatively stable
  buildings: { maxSize: 500, ttl: 15 * 60 * 1000 }, // 15 minutes
  
  // Residence data - stable structure, occasional updates
  residences: { maxSize: 2000, ttl: 10 * 60 * 1000 }, // 10 minutes
  
  // Bills - time-sensitive, frequent updates
  bills: { maxSize: 1000, ttl: 2 * 60 * 1000 }, // 2 minutes
  
  // Maintenance requests - dynamic, frequent status changes
  maintenance: { maxSize: 500, ttl: 1 * 60 * 1000 }, // 1 minute
  
  // Notifications - real-time, short cache
  notifications: { maxSize: 500, ttl: 30 * 1000 }, // 30 seconds
  
  // Quality metrics - stable for periods
  metrics: { maxSize: 200, ttl: 5 * 60 * 1000 }, // 5 minutes
  
  // Features and roadmap - moderately stable
  features: { maxSize: 300, ttl: 3 * 60 * 1000 }, // 3 minutes
  
  // Framework configuration - very stable
  config: { maxSize: 100, ttl: 60 * 60 * 1000 }, // 1 hour
};

/**
 * Cache instances for different data types.
 */
class QueryCacheManager {
  private caches: Map<string, LRUCache<string, any>> = new Map();
  private hitCounts: Map<string, number> = new Map();
  private missCounts: Map<string, number> = new Map();

  constructor() {
    // Initialize caches for each data type
    Object.entries(CACHE_CONFIGS).forEach(([type, config]) => {
      this.caches.set(type, new LRUCache({
        max: config.maxSize,
        ttl: config.ttl,
        updateAgeOnGet: true,
        updateAgeOnHas: true,
      }));
      this.hitCounts.set(type, 0);
      this.missCounts.set(type, 0);
    });
  }

  /**
   * Gets cached data if available.
   * @param cacheType Type of cache (users, buildings, etc.)
   * @param key Cache key
   * @returns Cached data or undefined
   */
  get<T>(cacheType: string, key: string): T | undefined {
    const cache = this.caches.get(cacheType);
    if (!cache) return undefined;

    const result = cache.get(key);
    if (result !== undefined) {
      this.hitCounts.set(cacheType, (this.hitCounts.get(cacheType) || 0) + 1);
      console.debug(`Cache hit: ${cacheType}:${key}`);
      return result;
    }

    this.missCounts.set(cacheType, (this.missCounts.get(cacheType) || 0) + 1);
    console.debug(`Cache miss: ${cacheType}:${key}`);
    return undefined;
  }

  /**
   * Stores data in cache.
   * @param cacheType Type of cache
   * @param key Cache key
   * @param data Data to cache
   */
  set<T>(cacheType: string, key: string, data: T): void {
    const cache = this.caches.get(cacheType);
    if (!cache) return;

    cache.set(key, data);
    console.debug(`Cached: ${cacheType}:${key}`);
  }

  /**
   * Invalidates cache entries by pattern.
   * @param cacheType Type of cache
   * @param pattern Key pattern to invalidate (supports wildcards)
   */
  invalidate(cacheType: string, pattern?: string): void {
    const cache = this.caches.get(cacheType);
    if (!cache) return;

    if (pattern) {
      // Remove entries matching pattern
      for (const key of cache.keys()) {
        if (this.matchesPattern(key, pattern)) {
          cache.delete(key);
          console.debug(`Invalidated: ${cacheType}:${key}`);
        }
      }
    } else {
      // Clear entire cache
      cache.clear();
      console.debug(`Cleared cache: ${cacheType}`);
    }
  }

  /**
   * Gets cache performance statistics.
   */
  getStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [type, cache] of this.caches) {
      const hits = this.hitCounts.get(type) || 0;
      const misses = this.missCounts.get(type) || 0;
      const total = hits + misses;
      const hitRate = total > 0 ? ((hits / total) * 100).toFixed(2) : '0.00';
      
      stats[type] = {
        size: cache.size,
        maxSize: cache.max,
        hits,
        misses,
        hitRate: `${hitRate}%`,
        memoryUsage: this.estimateMemoryUsage(cache)
      };
    }
    
    return stats;
  }

  /**
   * Clears all caches.
   */
  clearAll(): void {
    for (const [type, cache] of this.caches) {
      cache.clear();
      this.hitCounts.set(type, 0);
      this.missCounts.set(type, 0);
    }
    console.log('All caches cleared');
  }

  /**
   * Pattern matching for cache key invalidation.
   */
  private matchesPattern(key: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(key);
  }

  /**
   * Estimates memory usage of a cache.
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
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Cache invalidation utilities for specific operations.
 */
export class CacheInvalidator {
  
  /**
   * Invalidates user-related caches when user data changes.
   */
  static invalidateUserCaches(userId: string): void {
    queryCache.invalidate('users', `user:${userId}*`);
    queryCache.invalidate('residences', `user_residences:${userId}*`);
    queryCache.invalidate('notifications', `user_notifications:${userId}*`);
  }

  /**
   * Invalidates building-related caches when building data changes.
   */
  static invalidateBuildingCaches(buildingId: string): void {
    queryCache.invalidate('buildings', `building:${buildingId}*`);
    queryCache.invalidate('residences', `building_residences:${buildingId}*`);
    queryCache.invalidate('budgets', `building_budgets:${buildingId}*`);
  }

  /**
   * Invalidates residence-related caches when residence data changes.
   */
  static invalidateResidenceCaches(residenceId: string): void {
    queryCache.invalidate('residences', `residence:${residenceId}*`);
    queryCache.invalidate('bills', `residence_bills:${residenceId}*`);
    queryCache.invalidate('maintenance', `residence_maintenance:${residenceId}*`);
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
    console.log('Cache Performance Statistics:');
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
        suggestions.push(`Low hit rate for ${cacheType} cache (${stat.hitRate}). Consider increasing TTL or cache size.`);
      }
      
      if (stat.size === stat.maxSize) {
        suggestions.push(`${cacheType} cache is at maximum capacity. Consider increasing max size.`);
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
    console.log('Warming up caches...');
    
    try {
      // This would be implemented with actual database calls
      // Example: Pre-load active users, organizations, etc.
      console.log('Cache warming complete');
    } catch (error) {
      console.warn('Cache warming failed:', error);
    }
  }
}

/**
 * Export cache utilities for easy access.
 */
export {
  queryCache as default,
  QueryCacheManager,
  CACHE_CONFIGS
};