import { useEffect } from 'react';

/**
 * Memory monitoring and optimization utilities for Koveo Gestion.
 * Provides tools for tracking memory usage and implementing cleanup strategies.
 */

/**
 * Memory monitoring configuration.
 */
interface MemoryConfig {
  /** Threshold in MB to trigger cleanup */
  cleanupThreshold: number;
  /** Cleanup interval in milliseconds */
  cleanupInterval: number;
}

/**
 * Default memory configuration optimized for Quebec property management SaaS.
 */
const DEFAULT_CONFIG: MemoryConfig = {
  cleanupThreshold: 120, // 120MB cleanup trigger
  cleanupInterval: 60000, // 1 minute
};

/**
 * Memory usage information.
 */
export interface MemoryUsage {
  used: number;
  total: number;
  percentage: number;
}

/**
 * Gets current memory usage information.
 * @returns Memory usage details in MB.
 */
/**
 * GetMemoryUsage function.
 * @returns Function result.
 */
export function getMemoryUsage(): MemoryUsage | null {
  if ('memory' in performance && performance.memory) {
    const memory = performance.memory as any;
    const used = Math.round(memory.usedJSHeapSize / 1024 / 1024);
    const total = Math.round(memory.totalJSHeapSize / 1024 / 1024);
    const percentage = Math.round((used / total) * 100);

    return { used, total, percentage };
  }
  return null;
}

/**
 * Memory cleanup strategies for React components and caches.
 */
export class MemoryOptimizer {
  private cleanupInterval: number | null = null;
  private config: MemoryConfig;
  private cleanupCallbacks: Array<() => void> = [];

  /**
   * Creates a new memory optimizer instance.
   * @param config - Optional memory configuration parameters.
   */
  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Starts automatic memory monitoring and cleanup.
   */
  start(): void {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = window.setInterval(() => {
      this.checkAndCleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Stops automatic memory monitoring.
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Registers a cleanup callback to be called during memory cleanup.
   * @param callback Function to call during cleanup.
   */
  registerCleanup(callback: () => void): void {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * Removes a cleanup callback.
   * @param callback Function to remove from cleanup callbacks.
   */
  unregisterCleanup(callback: () => void): void {
    const index = this.cleanupCallbacks.indexOf(callback);
    if (index > -1) {
      this.cleanupCallbacks.splice(index, 1);
    }
  }

  /**
   * Manually triggers memory cleanup.
   */
  cleanup(): void {
    // Execute all registered cleanup callbacks
    this.cleanupCallbacks.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error('Cleanup callback error:', error);
      }
    });

    // Clear unused React Query cache
    if (typeof window !== 'undefined' && (window as any).queryClient) {
      const client = (window as any).queryClient;
      const cache = client.getQueryCache();
      const queries = cache.getAll();

      // Remove stale queries to free memory
      queries.forEach((query: any) => {
        if (query.isStale() && !query.getObserversCount()) {
          cache.remove(query);
        }
      });
    }

    // Suggest garbage collection if available
    if ('gc' in window && typeof window.gc === 'function') {
      window.gc();
    }
  }

  /**
   * Checks memory usage and triggers cleanup if needed.
   */
  private checkAndCleanup(): void {
    const usage = getMemoryUsage();
    if (!usage) {
      return;
    }

    if (usage.used >= this.config.cleanupThreshold) {
      this.cleanup();
    }
  }
}

/**
 * Global memory optimizer instance.
 */
export const memoryOptimizer = new MemoryOptimizer();

/**
 * React hook for component-level memory cleanup.
 * @param cleanupFn Function to call when component unmounts.
 */
/**
 * UseMemoryCleanup function.
 * @param cleanupFn
 * @returns Function result.
 */
export function useMemoryCleanup(cleanupFn: () => void): void {
  // Register cleanup on mount and unregister on unmount
  useEffect(() => {
    memoryOptimizer.registerCleanup(cleanupFn);

    return () => {
      memoryOptimizer.unregisterCleanup(cleanupFn);
    };
  }, [cleanupFn]);
}

/**
 * Optimized image loading with memory management.
 * @param src Image source URL.
 * @param options Loading options.
 * @param options.width
 * @param options.height
 * @param options.quality
 * @returns Promise that resolves when image is loaded.
 */
/**
 * LoadImageOptimized function.
 * @param src
 * @param options
 * @param options.width
 * @param options.height
 * @param options.quality
 * @param _options
 * @param _options.width
 * @param _options.height
 * @param _options.quality
 * @returns Function result.
 */
export function loadImageOptimized(
  src: string,
  _options: { width?: number; height?: number; quality?: number } = {}
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    // Set loading attributes for better performance
    img.loading = 'lazy';
    img.decoding = 'async';

    // Apply size constraints if provided
    if (_options.width) {
      img.width = _options.width;
    }
    if (_options.height) {
      img.height = _options.height;
    }

    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Debounced function creator for reducing excessive function calls.
 * @param func Function to debounce.
 * @param delay Delay in milliseconds.
 * @returns Debounced function.
 */
/**
 * Debounce function.
 * @param func
 * @param delay
 * @returns Function result.
 */
export function debounce<T extends (...args: unknown[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => func(...args), delay);
  };
}

/**
 * Throttled function creator for limiting function call frequency.
 * @param func Function to throttle.
 * @param limit Time limit in milliseconds.
 * @returns Throttled function.
 */
/**
 * Throttle function.
 * @param func
 * @param limit
 * @returns Function result.
 */
export function throttle<T extends (...args: unknown[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
