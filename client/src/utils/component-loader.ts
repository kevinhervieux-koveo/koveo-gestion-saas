/**
 * Optimized component loading utilities for memory efficiency.
 * Provides dynamic imports with preloading and error boundaries for large components.
 */

import { lazy, ComponentType, LazyExoticComponent } from 'react';
import { memoryOptimizer } from './memory-monitor';

/**
 * Configuration options for optimized component loading.
 */
interface LoaderOptions {
  /** Preload the component after specified delay (ms) */
  preloadDelay?: number;
  /** Retry attempts for failed loads */
  retryAttempts?: number;
  /** Custom fallback component */
  fallback?: ComponentType;
  /** Enable memory cleanup on component unmount */
  enableMemoryCleanup?: boolean;
}

/**
 * Cache for loaded components to prevent duplicate imports.
 */
const componentCache = new Map<string, LazyExoticComponent<ComponentType<any>>>();

/**
 * Creates an optimized lazy component with memory management.
 * @param importFn Dynamic import function.
 * @param key Unique key for caching.
 * @param options Loading options.
 * @returns Lazy component with optimizations.
 */
/**
 * CreateOptimizedLoader function.
 * @param importFn
 * @param key
 * @param options
 * @returns Function result.
 */
export function createOptimizedLoader<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  key: string,
  options: LoaderOptions = {}
): LazyExoticComponent<T> {
  // Return cached component if available
  if (componentCache.has(key)) {
    return componentCache.get(key) as LazyExoticComponent<T>;
  }

  const {
    preloadDelay = 0,
    retryAttempts = 3,
    enableMemoryCleanup = true
  } = options;

  // Create lazy component with retry logic
  const LazyComponent = lazy(async () => {
    let attempts = 0;
    
    while (attempts < retryAttempts) {
      try {
        const module = await importFn();
        
        // Register cleanup if enabled
        if (enableMemoryCleanup) {
          memoryOptimizer.registerCleanup(() => {
            componentCache.delete(key);
          });
        }
        
        return module;
      } catch (__error) {
        attempts++;
        if (attempts >= retryAttempts) {
          console.error(`Failed to load component ${key} after ${retryAttempts} attempts:`, error);
          throw error;
        }
        
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
      }
    }
    
    throw new Error(`Failed to load component ${key}`);
  });

  // Cache the component
  componentCache.set(key, LazyComponent);

  // Preload if requested
  if (preloadDelay > 0) {
    setTimeout(() => {
      importFn().catch(() => {
        // Ignore preload errors
      });
    }, preloadDelay);
  }

  return LazyComponent;
}

/**
 * Preloads a component for faster subsequent loading.
 * @param importFn Dynamic import function.
 * @param priority Loading priority (higher numbers load first).
 */
/**
 * PreloadComponent function.
 * @param importFn
 * @param priority
 * @returns Function result.
 */
export function preloadComponent(
  importFn: () => Promise<{ default: ComponentType<any> }>,
  priority: number = 0
): void {
  // Use requestIdleCallback for low-priority preloading
  const loadFn = () => {
    importFn().catch(() => {
      // Ignore preload errors
    });
  };

  if (priority > 0) {
    // High priority - load immediately
    loadFn();
  } else if ('requestIdleCallback' in window) {
    // Low priority - load when idle
    requestIdleCallback(loadFn);
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(loadFn, 100);
  }
}

/**
 * Clears the component cache to free memory.
 * @param keys Specific keys to clear, or undefined to clear all.
 */
/**
 * ClearComponentCache function.
 * @param keys
 * @returns Function result.
 */
export function clearComponentCache(keys?: string[]): void {
  if (keys) {
    keys.forEach(key => componentCache.delete(key));
  } else {
    componentCache.clear();
  }
}

/**
 * Gets current cache size for monitoring.
 */
/**
 * GetComponentCacheSize function.
 * @returns Function result.
 */
export function getComponentCacheSize(): number {
  return componentCache.size;
}

/**
 * Optimized lazy loading for heavy page components.
 */
export const optimizedPageLoaders = {
  // Admin pages
  AdminOrganizations: createOptimizedLoader(
    () => import('@/pages/admin/organizations'),
    'admin-organizations',
    { enableMemoryCleanup: true }
  ),
  AdminRoadmap: createOptimizedLoader(
    () => import('@/pages/admin/roadmap'),
    'admin-roadmap',
    { preloadDelay: 3000, enableMemoryCleanup: true }
  ),
  AdminQuality: createOptimizedLoader(
    () => import('@/pages/admin/quality'),
    'admin-quality',
    { preloadDelay: 5000, enableMemoryCleanup: true }
  ),
  
  // Manager pages  
  ManagerBuildings: createOptimizedLoader(
    () => import('@/pages/manager/buildings'),
    'manager-buildings',
    { enableMemoryCleanup: true }
  ),
  ManagerResidences: createOptimizedLoader(
    () => import('@/pages/manager/residences'),
    'manager-residences',
    { enableMemoryCleanup: true }
  ),
  
  // Residents pages
  ResidentsDashboard: createOptimizedLoader(
    () => import('@/pages/residents/dashboard'),
    'residents-dashboard',
    { preloadDelay: 1000, enableMemoryCleanup: true }
  ),
  ResidentsBuilding: createOptimizedLoader(
    () => import('@/pages/residents/building'),
    'residents-building',
    { enableMemoryCleanup: true }
  ),
};

/**
 * Register memory cleanup for component cache.
 */
memoryOptimizer.registerCleanup(() => {
  // Clear half of the cache when memory is low
  const keys = Array.from(componentCache.keys());
  const keysToRemove = keys.slice(0, Math.floor(keys.length / 2));
  clearComponentCache(keysToRemove);
});