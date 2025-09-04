/**
 * Performance monitoring utilities for Quebec property management SaaS.
 * Tracks performance metrics and provides optimization insights.
 */

import { useEffect } from 'react';
import { memoryOptimizer, getMemoryUsage } from './memory-monitor';

/**
 * Performance metrics interface.
 */
export interface PerformanceMetrics {
  loadTime: number;
  domContentLoaded: number;
  firstContentfulPaint: number;
  memoryUsage: number;
  componentLoadTimes: Record<string, number>;
}

/**
 * Performance monitoring class.
 */
class PerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {};
  private componentLoadStart = new Map<string, number>();
  private isMonitoring = false;

  /**
   * Starts performance monitoring.
   */
  start(): void {
    if (this.isMonitoring) {
      return;
    }
    this.isMonitoring = true;

    // Monitor initial page load metrics
    this.trackPageLoadMetrics();

    // Monitor memory usage periodically
    this.startMemoryTracking();

    // Set up performance observer if available
    this.setupPerformanceObserver();
  }

  /**
   * Stops performance monitoring.
   */
  stop(): void {
    this.isMonitoring = false;
  }

  /**
   * Records the start of a component load.
   * @param componentName Name of the component.
   */
  markComponentLoadStart(componentName: string): void {
    this.componentLoadStart.set(componentName, performance.now());
  }

  /**
   * Records the end of a component load.
   * @param componentName Name of the component.
   */
  markComponentLoadEnd(componentName: string): void {
    const startTime = this.componentLoadStart.get(componentName);
    if (startTime) {
      const loadTime = performance.now() - startTime;
      if (!this.metrics.componentLoadTimes) {
        this.metrics.componentLoadTimes = {};
      }
      this.metrics.componentLoadTimes[componentName] = loadTime;
      this.componentLoadStart.delete(componentName);

      // Log slow components
      if (loadTime > 1000) {
      }
    }
  }

  /**
   * Gets current performance metrics.
   */
  getMetrics(): Partial<PerformanceMetrics> {
    // Update memory usage
    const memoryUsage = getMemoryUsage();
    if (memoryUsage) {
      this.metrics.memoryUsage = memoryUsage.used;
    }

    return { ...this.metrics };
  }

  /**
   * Tracks page load metrics.
   */
  private trackPageLoadMetrics(): void {
    // Use performance navigation timing API
    if ('performance' in window && performance.timing) {
      const timing = performance.timing;
      const navigationStart = timing.navigationStart;

      this.metrics.loadTime = timing.loadEventEnd - navigationStart;
      this.metrics.domContentLoaded = timing.domContentLoadedEventEnd - navigationStart;
    }

    // Track First Contentful Paint if available
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              this.metrics.firstContentfulPaint = entry.startTime;
            }
          }
        });
        observer.observe({ entryTypes: ['paint'] });
      }
    }
  }

  /**
   * Starts periodic memory tracking.
   */
  private startMemoryTracking(): void {
    const trackMemory = () => {
      if (!this.isMonitoring) {
        return;
      }

      const usage = getMemoryUsage();
      if (usage) {
        this.metrics.memoryUsage = usage.used;

        if (usage.percentage > 80) {
        }
      }

      setTimeout(trackMemory, 30000); // Every 30 seconds
    };

    trackMemory();
  }

  /**
   * Sets up performance observer for detailed metrics.
   */
  private setupPerformanceObserver(): void {
    if (!('PerformanceObserver' in window)) {
      return;
    }

    try {
      // Observe resource loading times
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 2000) {
            // Log slow resources
          }
        }
      });
      resourceObserver.observe({ entryTypes: ['resource'] });

      // Observe long tasks
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
        }
      });
      longTaskObserver.observe({ entryTypes: ['longtask'] });
    }
  }
}

/**
 * Global performance monitor instance.
 */
export const performanceMonitor = new PerformanceMonitor();

/**
 * React hook for component performance tracking.
 * @param componentName Name of the component to track.
 */
/**
 * UsePerformanceTracking function.
 * @param componentName
 * @returns Function result.
 */
export function usePerformanceTracking(componentName: string): void {
  useEffect(() => {
    performanceMonitor.markComponentLoadStart(componentName);

    return () => {
      performanceMonitor.markComponentLoadEnd(componentName);
    };
  }, [componentName]);
}

/**
 * Function to manually trigger performance analysis.
 */
/**
 * AnalyzePerformance function.
 * @returns Function result.
 */
export function analyzePerformance(): void {
  const metrics = performanceMonitor.getMetrics();

    'DOM Content Loaded:',
    metrics.domContentLoaded ? `${metrics.domContentLoaded}ms` : 'N/A'
  );
    'First Contentful Paint:',
    metrics.firstContentfulPaint ? `${metrics.firstContentfulPaint}ms` : 'N/A'
  );

  if (metrics.componentLoadTimes) {
    Object.entries(metrics.componentLoadTimes).forEach(([name, time]) => {
    });
  }

  // Provide optimization suggestions
  const suggestions = [];

  if (metrics.memoryUsage && metrics.memoryUsage > 100) {
    suggestions.push('High memory usage detected. Consider implementing component lazy loading.');
  }

  if (metrics.loadTime && metrics.loadTime > 3000) {
    suggestions.push('Slow page load. Consider bundle splitting and optimizing assets.');
  }

  if (metrics.componentLoadTimes) {
    const slowComponents = Object.entries(metrics.componentLoadTimes)
      .filter(([, time]) => time > 500)
      .map(([name]) => name);

    if (slowComponents.length > 0) {
      suggestions.push(
        `Slow components detected: ${slowComponents.join(', ')}. Consider optimization.`
      );
    }
  }

  if (suggestions.length > 0) {
  }
}
