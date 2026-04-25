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
 * Track which components are currently loading to prevent cleanup during import.
 */
const loadingComponents = new Set<string>();

/**
 * Track which components have been fully loaded and are safe to clean up.
 */
const loadedComponents = new Set<string>();

/**
 * Creates an optimized lazy component with memory management.
 * @param importFn Dynamic import function.
 * @param key Unique key for caching.
 * @param options Loading options.
 * @returns Lazy component with optimizations.
 */
export function createOptimizedLoader<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  _key: string,
  _options: LoaderOptions = {}
): LazyExoticComponent<T> {
  if (componentCache.has(_key)) {
    return componentCache.get(_key) as LazyExoticComponent<T>;
  }

  const { retryAttempts = 3, enableMemoryCleanup = true } = _options;

  loadingComponents.add(_key);

  const LazyComponent = lazy(async () => {
    let attempts = 0;

    while (attempts < retryAttempts) {
      try {
        const module = await importFn();

        loadingComponents.delete(_key);
        loadedComponents.add(_key);

        if (enableMemoryCleanup) {
          memoryOptimizer.registerCleanup(() => {
            if (!loadingComponents.has(_key)) {
              componentCache.delete(_key);
              loadedComponents.delete(_key);
            }
          });
        }

        return module;
      } catch (error) {
        attempts++;
        if (attempts >= retryAttempts) {
          loadingComponents.delete(_key);
          console.error(
            `Failed to load component ${_key} after ${retryAttempts} attempts:`,
            error
          );
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempts) * 1000));
      }
    }

    loadingComponents.delete(_key);
    throw new Error(`Failed to load component ${_key}`);
  });

  componentCache.set(_key, LazyComponent);

  return LazyComponent;
}

/**
 * Check if a component is currently loading.
 */
export function isComponentLoading(key: string): boolean {
  return loadingComponents.has(key);
}

/**
 * Get number of components currently loading.
 */
export function getLoadingComponentCount(): number {
  return loadingComponents.size;
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
  // Admin pages
  AdminOrganizations: createOptimizedLoader(
    () => import('@/pages/admin/organizations'),
    'admin-organizations',
    { enableMemoryCleanup: true }
  ),
  AdminQuality: createOptimizedLoader(() => import('@/pages/admin/quality'), 'admin-quality', {
    enableMemoryCleanup: true,
  }),

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
  ManagerBills: createOptimizedLoader(
    () => import('@/pages/manager/bills'),
    'manager-bills',
    { enableMemoryCleanup: true }
  ),
  ManagerInvoices: createOptimizedLoader(
    () => import('@/pages/manager/invoices'),
    'manager-invoices',
    { enableMemoryCleanup: true }
  ),
  ManagerUserManagement: createOptimizedLoader(
    () => import('@/pages/manager/user-management'),
    'manager-user-management',
    { enableMemoryCleanup: true }
  ),

  // Residents pages
  ResidentsDashboard: createOptimizedLoader(
    () => import('@/pages/residents/dashboard'),
    'residents-dashboard',
    { enableMemoryCleanup: true }
  ),
  ResidentsBuilding: createOptimizedLoader(
    () => import('@/pages/residents/building'),
    'residents-building',
    { enableMemoryCleanup: true }
  ),
  ResidentsResidence: createOptimizedLoader(
    () => import('@/pages/residents/residence'),
    'residents-residence',
    { enableMemoryCleanup: true }
  ),

  // Document management pages
  BuildingDocuments: createOptimizedLoader(
    () => import('@/pages/manager/BuildingDocuments'),
    'building-documents',
    { enableMemoryCleanup: true }
  ),
  ResidenceDocuments: createOptimizedLoader(
    () => import('@/pages/manager/ResidenceDocuments'),
    'residence-documents',
    { enableMemoryCleanup: true }
  ),

  // Settings pages
  SettingsSettings: createOptimizedLoader(
    () => import('@/pages/settings/settings'),
    'settings-settings',
    { enableMemoryCleanup: true }
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
  ],
};

/**
 * Progressive loading helper for complex components.
 * OPTIMIZED: Load components in priority order.
 * @param components Array of import functions in priority order.
 */
export function progressivePreload(components: (() => Promise<any>)[]): void {
  const schedule = (cb: () => void) => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as unknown as {
        requestIdleCallback: (cb: () => void, opts?: { timeout?: number }) => number;
      }).requestIdleCallback(cb, { timeout: 2000 });
    } else {
      setTimeout(cb, 200);
    }
  };

  const loadNext = (index: number) => {
    if (index >= components.length) return;
    schedule(() => {
      components[index]()
        .catch(() => {
          // Ignore preload errors
        })
        .finally(() => {
          loadNext(index + 1);
        });
    });
  };

  loadNext(0);
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
 * Only clears components that are not currently loading.
 */
memoryOptimizer.registerCleanup(() => {
  const keys = Array.from(componentCache.keys());
  const safeKeysToRemove = keys.filter(key => !loadingComponents.has(key));
  const keysToRemove = safeKeysToRemove.slice(0, Math.floor(safeKeysToRemove.length / 2));
  clearComponentCache(keysToRemove);
});
