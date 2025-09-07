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
 * @param _key
 * @param _options
 * @returns Function result.
 */
export function createOptimizedLoader<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  _key: string,
  _options: LoaderOptions = {}
): LazyExoticComponent<T> {
  // Return cached component if available
  if (componentCache.has(_key)) {
    return componentCache.get(_key) as LazyExoticComponent<T>;
  }

  const { preloadDelay = 0, retryAttempts = 3, enableMemoryCleanup = true } = _options;

  // Create lazy component with retry logic
  const LazyComponent = lazy(async () => {
    let attempts = 0;

    while (attempts < retryAttempts) {
      try {
        const module = await importFn();

        // Register cleanup if enabled
        if (enableMemoryCleanup) {
          memoryOptimizer.registerCleanup(() => {
            componentCache.delete(_key);
          });
        }

        return module;
      } catch (error) {
        attempts++;
        if (attempts >= retryAttempts) {
          console.error(
            `Failed to load component ${_key} after ${retryAttempts} attempts:`,
            error
          );
          throw error;
        }

        // Wait before retry with exponential backoff
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempts) * 1000));
      }
    }

    throw new Error(`Failed to load component ${_key}`);
  });

  // Cache the component
  componentCache.set(_key, LazyComponent);

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
    keys.forEach((key) => componentCache.delete(key));
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
 * OPTIMIZED: Enhanced preloading strategies and route-based optimization.
 */
export const optimizedPageLoaders = {
  // Admin pages - Higher preload delays for heavy admin components
  AdminOrganizations: createOptimizedLoader(
    () => import('@/pages/admin/organizations'),
    'admin-organizations',
    { preloadDelay: 2000, enableMemoryCleanup: true }
  ),
  AdminRoadmap: createOptimizedLoader(() => import('@/pages/admin/roadmap'), 'admin-roadmap', {
    preloadDelay: 4000,
    enableMemoryCleanup: true,
  }),
  AdminQuality: createOptimizedLoader(() => import('@/pages/admin/quality'), 'admin-quality', {
    preloadDelay: 6000,
    enableMemoryCleanup: true,
  }),

  // Manager pages - Medium preload for frequently accessed pages
  ManagerBuildings: createOptimizedLoader(
    () => import('@/pages/manager/buildings'),
    'manager-buildings',
    { preloadDelay: 1500, enableMemoryCleanup: true }
  ),
  ManagerResidences: createOptimizedLoader(
    () => import('@/pages/manager/residences'),
    'manager-residences',
    { preloadDelay: 1500, enableMemoryCleanup: true }
  ),
  ManagerBills: createOptimizedLoader(
    () => import('@/pages/manager/bills'),
    'manager-bills',
    { preloadDelay: 2000, enableMemoryCleanup: true }
  ),
  ManagerInvoices: createOptimizedLoader(
    () => import('@/pages/manager/invoices'),
    'manager-invoices',
    { preloadDelay: 2000, enableMemoryCleanup: true }
  ),
  ManagerUserManagement: createOptimizedLoader(
    () => import('@/pages/manager/user-management'),
    'manager-user-management',
    { preloadDelay: 3000, enableMemoryCleanup: true }
  ),

  // Residents pages - Fast preload for high traffic pages
  ResidentsDashboard: createOptimizedLoader(
    () => import('@/pages/residents/dashboard'),
    'residents-dashboard',
    { preloadDelay: 500, enableMemoryCleanup: true }
  ),
  ResidentsBuilding: createOptimizedLoader(
    () => import('@/pages/residents/building'),
    'residents-building',
    { preloadDelay: 1000, enableMemoryCleanup: true }
  ),
  ResidentsResidence: createOptimizedLoader(
    () => import('@/pages/residents/residence'),
    'residents-residence',
    { preloadDelay: 1000, enableMemoryCleanup: true }
  ),

  // Document management pages - Critical for user workflow
  BuildingDocuments: createOptimizedLoader(
    () => import('@/pages/manager/BuildingDocuments'),
    'building-documents',
    { preloadDelay: 1500, enableMemoryCleanup: true }
  ),
  ResidenceDocuments: createOptimizedLoader(
    () => import('@/pages/manager/ResidenceDocuments'),
    'residence-documents',
    { preloadDelay: 1500, enableMemoryCleanup: true }
  ),

  // Settings pages - Lower priority
  SettingsSettings: createOptimizedLoader(
    () => import('@/pages/settings/settings'),
    'settings-settings',
    { preloadDelay: 5000, enableMemoryCleanup: true }
  ),
  SettingsBugReports: createOptimizedLoader(
    () => import('@/pages/settings/bug-reports'),
    'settings-bug-reports',
    { preloadDelay: 8000, enableMemoryCleanup: true }
  ),
};

/**
 * Route-based preloading strategies.
 * OPTIMIZED: Intelligent preloading based on user navigation patterns.
 */
export const routePreloadingStrategy = {
  // When user visits admin pages, preload related admin components
  '/admin/*': [
    () => import('@/pages/admin/organizations'),
    () => import('@/pages/admin/roadmap'),
  ],

  // When user visits manager pages, preload commonly used manager components
  '/manager/*': [
    () => import('@/pages/manager/buildings'),
    () => import('@/pages/manager/residences'),
    () => import('@/pages/manager/user-management'),
  ],

  // When user visits resident pages, preload resident workflow components
  '/residents/*': [
    () => import('@/pages/residents/dashboard'),
    () => import('@/pages/residents/building'),
    () => import('@/pages/residents/residence'),
  ],

  // Dashboard pages should preload based on user role
  '/dashboard/*': [
    () => import('@/pages/dashboard'),
    () => import('@/pages/dashboard/calendar'),
  ],
};

/**
 * Progressive loading helper for complex components.
 * OPTIMIZED: Load components in priority order.
 * @param components Array of import functions in priority order.
 */
export function progressivePreload(components: (() => Promise<any>)[]): void {
  let delay = 0;
  
  components.forEach((componentImport, index) => {
    setTimeout(() => {
      componentImport().catch(() => {
        // Ignore preload errors
      });
    }, delay);
    
    // Stagger preloads with exponential backoff
    delay += Math.min(500 * (index + 1), 3000);
  });
}

/**
 * Smart preloader based on current route.
 * OPTIMIZED: Context-aware preloading.
 * @param currentPath Current route path.
 */
export function smartPreload(currentPath: string): void {
  // Find matching route pattern
  const matchingPatterns = Object.keys(routePreloadingStrategy).filter(pattern => {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return regex.test(currentPath);
  });

  // Preload components for matching patterns
  matchingPatterns.forEach(pattern => {
    const components = routePreloadingStrategy[pattern as keyof typeof routePreloadingStrategy];
    if (components) {
      progressivePreload(components);
    }
  });
}

/**
 * Register memory cleanup for component cache.
 */
memoryOptimizer.registerCleanup(() => {
  // Clear half of the cache when memory is low
  const keys = Array.from(componentCache.keys());
  const keysToRemove = keys.slice(0, Math.floor(keys.length / 2));
  clearComponentCache(keysToRemove);
});
