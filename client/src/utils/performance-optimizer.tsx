// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
/**
 * Performance Optimization Utilities for Quebec Property Management SaaS
 * Provides tools and strategies for optimizing React application performance
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { performanceMonitor } from './performance-monitor';
import { complexityAnalyzer } from './component-complexity-analyzer';
import { memoryOptimizer } from './memory-monitor';

// Performance optimization strategies
export enum OptimizationStrategy {
  MEMOIZATION = 'memoization',
  LAZY_LOADING = 'lazy_loading',
  VIRTUALIZATION = 'virtualization',
  CODE_SPLITTING = 'code_splitting',
  DEBOUNCING = 'debouncing',
  THROTTLING = 'throttling',
  CACHING = 'caching',
  IMAGE_OPTIMIZATION = 'image_optimization',
}

export interface OptimizationRecommendation {
  strategy: OptimizationStrategy;
  component: string;
  issue: string;
  implementation: string;
  expectedImprovement: string;
  priority: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
}

export interface PerformanceOptimizer {
  analyzeComponent(componentName: string): OptimizationRecommendation[];
  optimizeRenderPerformance<T>(component: React.ComponentType<T>): React.ComponentType<T>;
  createOptimizedList<T>(items: T[], renderItem: (item: T, index: number) => React.ReactNode): React.ReactNode;
  optimizeImageLoading(images: string[]): void;
  createDebouncedCallback<T extends (...args: any[]) => any>(fn: T, delay: number): T;
  createThrottledCallback<T extends (...args: any[]) => any>(fn: T, limit: number): T;
}

class PerformanceOptimizerImpl implements PerformanceOptimizer {
  private optimizationHistory = new Map<string, OptimizationRecommendation[]>();
  private imageCache = new Map<string, HTMLImageElement>();
  private observerCache = new Map<string, IntersectionObserver>();

  /**
   * Analyzes a component and provides optimization recommendations
   */
  analyzeComponent(componentName: string): OptimizationRecommendation[] {
    const metrics = complexityAnalyzer.getComponentMetrics(componentName);
    if (!metrics) {
      return [];
    }

    const recommendations: OptimizationRecommendation[] = [];

    // Analyze render time
    if (metrics.renderTime > 16) { // 60fps threshold
      recommendations.push({
        strategy: OptimizationStrategy.MEMOIZATION,
        component: componentName,
        issue: `Slow rendering (${metrics.renderTime}ms)`,
        implementation: 'Wrap component with React.memo() and use useMemo for expensive calculations',
        expectedImprovement: `${Math.round((metrics.renderTime - 16) / metrics.renderTime * 100)}% faster rendering`,
        priority: metrics.renderTime > 50 ? 'high' : 'medium',
        effort: 'low',
      });
    }

    // Analyze render frequency
    if (metrics.renderCount > 30) { // Too many renders per minute
      recommendations.push({
        strategy: OptimizationStrategy.DEBOUNCING,
        component: componentName,
        issue: `Excessive re-renders (${metrics.renderCount}/min)`,
        implementation: 'Use useCallback for event handlers and debounce rapid state updates',
        expectedImprovement: `${Math.round((metrics.renderCount - 15) / metrics.renderCount * 100)}% fewer renders`,
        priority: 'high',
        effort: 'medium',
      });
    }

    // Analyze props complexity
    if (metrics.propsCount > 15) {
      recommendations.push({
        strategy: OptimizationStrategy.CODE_SPLITTING,
        component: componentName,
        issue: `Too many props (${metrics.propsCount})`,
        implementation: 'Break into smaller components and use composition patterns',
        expectedImprovement: 'Improved maintainability and render performance',
        priority: 'medium',
        effort: 'high',
      });
    }

    // Analyze children complexity
    if (metrics.childrenCount > 50) {
      recommendations.push({
        strategy: OptimizationStrategy.VIRTUALIZATION,
        component: componentName,
        issue: `Too many child elements (${metrics.childrenCount})`,
        implementation: 'Implement virtualization with react-window or similar',
        expectedImprovement: 'Constant rendering performance regardless of list size',
        priority: 'high',
        effort: 'medium',
      });
    }

    // Cache recommendations for this component
    this.optimizationHistory.set(componentName, recommendations);

    return recommendations;
  }

  /**
   * Optimizes a component's render performance automatically
   */
  optimizeRenderPerformance<T>(component: React.ComponentType<T>): React.ComponentType<T> {
    const OptimizedComponent = React.memo(component, (prevProps, nextProps) => {
      // Custom comparison function for deep equality
      return this.deepEqual(prevProps, nextProps);
    });

    // Add performance tracking
    const TrackedComponent = (props: T) => {
      const componentName = component.displayName || component.name || 'Unknown';
      const renderStart = useRef(Date.now());

      useEffect(() => {
        const renderTime = Date.now() - renderStart.current;
        complexityAnalyzer.trackComponentRender(
          componentName,
          renderTime,
          props,
          null
        );
      });

      renderStart.current = Date.now();
      return <OptimizedComponent {...props} />;
    };

    TrackedComponent.displayName = `Optimized(${component.displayName || component.name || 'Component'})`;
    
    return TrackedComponent;
  }

  /**
   * Creates an optimized list with virtualization for large datasets
   */
  createOptimizedList<T>(
    items: T[], 
    renderItem: (item: T, index: number) => React.ReactNode
  ): React.ReactNode {
    // For small lists, render normally
    if (items.length <= 50) {
      return items.map((item, index) => renderItem(item, index));
    }

    // For large lists, implement simple virtualization
    return <VirtualizedList items={items} renderItem={renderItem} />;
  }

  /**
   * Optimizes image loading with lazy loading and preloading
   */
  optimizeImageLoading(images: string[]): void {
    // Preload critical images (first 3)
    const criticalImages = images.slice(0, 3);
    criticalImages.forEach(src => this.preloadImage(src));

    // Set up lazy loading for remaining images
    const lazyImages = images.slice(3);
    lazyImages.forEach(src => this.setupLazyLoading(src));
  }

  /**
   * Creates a debounced callback to reduce excessive function calls
   */
  createDebouncedCallback<T extends (...args: any[]) => any>(
    fn: T, 
    delay: number
  ): T {
    let timeoutId: number;

    return ((...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => fn(...args), delay);
    }) as T;
  }

  /**
   * Creates a throttled callback to limit function call frequency
   */
  createThrottledCallback<T extends (...args: any[]) => any>(
    fn: T, 
    limit: number
  ): T {
    let inThrottle: boolean;

    return ((...args: Parameters<T>) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    }) as T;
  }

  /**
   * Deep equality check for React.memo
   */
  private deepEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) {
      return true;
    }

    if (obj1 == null || obj2 == null) {
      return obj1 === obj2;
    }

    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
      return obj1 === obj2;
    }

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) {
      return false;
    }

    for (const key of keys1) {
      if (!keys2.includes(key)) {
        return false;
      }

      if (!this.deepEqual(obj1[key], obj2[key])) {
        return false;
      }
    }

    return true;
  }

  /**
   * Preloads an image for faster rendering
   */
  private preloadImage(src: string): void {
    if (this.imageCache.has(src)) {
      return;
    }

    const img = new Image();
    img.onload = () => {
      this.imageCache.set(src, img);
    };
    img.onerror = () => {
      console.warn(`Failed to preload image: ${src}`);
    };
    img.src = src;
  }

  /**
   * Sets up lazy loading for an image
   */
  private setupLazyLoading(src: string): void {
    const observerId = `lazy-${src}`;
    
    if (this.observerCache.has(observerId)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              observer.unobserve(img);
            }
          }
        });
      },
      {
        rootMargin: '50px', // Load 50px before entering viewport
      }
    );

    this.observerCache.set(observerId, observer);
  }

  /**
   * Gets optimization history for analysis
   */
  getOptimizationHistory(): Map<string, OptimizationRecommendation[]> {
    return new Map(this.optimizationHistory);
  }

  /**
   * Clears optimization cache
   */
  clearCache(): void {
    this.optimizationHistory.clear();
    this.imageCache.clear();
    this.observerCache.forEach(observer => observer.disconnect());
    this.observerCache.clear();
  }
}

/**
 * Virtualized List Component for handling large datasets
 */
interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight?: number;
  containerHeight?: number;
}

function VirtualizedList<T>({ 
  items, 
  renderItem, 
  itemHeight = 50, 
  containerHeight = 400 
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + visibleCount + 1, items.length);

  const visibleItems = items.slice(startIndex, endIndex);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  return (
    <div
      ref={containerRef}
      style={{
        height: containerHeight,
        overflow: 'auto',
      }}
      onScroll={handleScroll}
      data-testid="virtualized-list"
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <div key={startIndex + index} style={{ height: itemHeight }}>
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * React Hooks for Performance Optimization
 */

/**
 * Hook for optimized state management with debouncing
 */
export function useOptimizedState<T>(
  initialValue: T,
  debounceMs: number = 300
): [T, (value: T) => void, T] {
  const [value, setValue] = useState(initialValue);
  const [debouncedValue, setDebouncedValue] = useState(initialValue);

  const debouncedSetValue = useMemo(
    () => performanceOptimizer.createDebouncedCallback(setDebouncedValue, debounceMs),
    [debounceMs]
  );

  useEffect(() => {
    debouncedSetValue(value);
  }, [value, debouncedSetValue]);

  return [value, setValue, debouncedValue];
}

/**
 * Hook for performance-monitored effects
 */
export function useOptimizedEffect(
  effect: React.EffectCallback,
  deps: React.DependencyList,
  name: string
): void {
  useEffect(() => {
    const startTime = performance.now();
    
    const cleanup = effect();
    
    const executionTime = performance.now() - startTime;
    if (executionTime > 5) { // Log slow effects
      console.warn(`Slow effect detected: ${name} took ${executionTime.toFixed(2)}ms`);
    }

    return cleanup;
  }, deps);
}

/**
 * Hook for optimized data fetching with caching
 */
export function useOptimizedFetch<T>(
  url: string,
  options?: RequestInit
): { data: T | null; loading: boolean; error: Error | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Simple cache implementation
  const cacheKey = useMemo(() => `${url}-${JSON.stringify(options)}`, [url, options]);
  
  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check cache first
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          setData(JSON.parse(cached));
          setLoading(false);
          return;
        }

        const response = await fetch(url, options);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (!cancelled) {
          setData(result);
          // Cache the result
          sessionStorage.setItem(cacheKey, JSON.stringify(result));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [url, options, cacheKey]);

  return { data, loading, error };
}

// Global performance optimizer instance
export const performanceOptimizer = new PerformanceOptimizerImpl();

// Initialize performance optimization on module load
if (typeof window !== 'undefined') {
  // Start memory optimization
  memoryOptimizer.start();
  
  // Start performance monitoring
  performanceMonitor.start();
  
}

// Import React
import React from 'react';