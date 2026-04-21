/**
 * Component Complexity Analyzer for Quebec Property Management SaaS
 * Identifies complex components and provides optimization recommendations
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { performanceMonitor } from './performance-monitor';

export interface ComponentComplexityMetrics {
  renderTime: number;
  renderCount: number;
  propsCount: number;
  childrenCount: number;
  rerenderReasons: string[];
  complexityScore: number; // 0-100, higher = more complex
  optimizationSuggestions: string[];
}

export interface ComplexityThresholds {
  renderTime: number; // ms
  renderCount: number; // renders per minute
  complexityScore: number; // overall complexity
}

const DEFAULT_THRESHOLDS: ComplexityThresholds = {
  renderTime: 16, // 16ms for 60fps
  renderCount: 30, // 30 renders per minute
  complexityScore: 70, // scores above 70 need attention
};

class ComponentComplexityAnalyzer {
  private componentMetrics = new Map<string, ComponentComplexityMetrics>();
  private renderTimestamps = new Map<string, number[]>();
  private thresholds: ComplexityThresholds;

  constructor(thresholds: Partial<ComplexityThresholds> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * Tracks component render performance
   */
  trackComponentRender(
    componentName: string,
    renderTime: number,
    props: any,
    children: React.ReactNode,
    rerenderReason?: string
  ): void {
    const now = Date.now();
    
    // Update render timestamps
    if (!this.renderTimestamps.has(componentName)) {
      this.renderTimestamps.set(componentName, []);
    }
    
    const timestamps = this.renderTimestamps.get(componentName)!;
    timestamps.push(now);
    
    // Keep only last minute of renders
    const oneMinuteAgo = now - 60000;
    this.renderTimestamps.set(
      componentName,
      timestamps.filter(timestamp => timestamp > oneMinuteAgo)
    );

    // Get or create metrics
    let metrics = this.componentMetrics.get(componentName);
    if (!metrics) {
      metrics = {
        renderTime: 0,
        renderCount: 0,
        propsCount: 0,
        childrenCount: 0,
        rerenderReasons: [],
        complexityScore: 0,
        optimizationSuggestions: [],
      };
    }

    // Update metrics
    metrics.renderTime = renderTime;
    metrics.renderCount = timestamps.length;
    metrics.propsCount = props ? Object.keys(props).length : 0;
    metrics.childrenCount = this.countChildren(children);
    
    if (rerenderReason && !metrics.rerenderReasons.includes(rerenderReason)) {
      metrics.rerenderReasons.push(rerenderReason);
    }

    // Calculate complexity score
    metrics.complexityScore = this.calculateComplexityScore(metrics);
    
    // Generate optimization suggestions
    metrics.optimizationSuggestions = this.generateOptimizationSuggestions(metrics);

    this.componentMetrics.set(componentName, metrics);

    // Log performance issues
    this.checkPerformanceIssues(componentName, metrics);
  }

  /**
   * Counts children recursively
   */
  private countChildren(children: React.ReactNode): number {
    if (!children) return 0;
    
    if (Array.isArray(children)) {
      return children.reduce((count, child) => count + this.countChildren(child), 0);
    }
    
    if (typeof children === 'object' && children !== null) {
      return 1;
    }
    
    return 0;
  }

  /**
   * Calculates component complexity score (0-100)
   */
  private calculateComplexityScore(metrics: ComponentComplexityMetrics): number {
    let score = 0;

    // Render time impact (0-30 points)
    const renderTimeScore = Math.min(30, (metrics.renderTime / this.thresholds.renderTime) * 30);
    score += renderTimeScore;

    // Render frequency impact (0-25 points)
    const renderFrequencyScore = Math.min(25, (metrics.renderCount / this.thresholds.renderCount) * 25);
    score += renderFrequencyScore;

    // Props complexity (0-20 points)
    const propsScore = Math.min(20, (metrics.propsCount / 20) * 20);
    score += propsScore;

    // Children complexity (0-15 points)
    const childrenScore = Math.min(15, (metrics.childrenCount / 50) * 15);
    score += childrenScore;

    // Rerender reasons (0-10 points)
    const rerenderScore = Math.min(10, metrics.rerenderReasons.length * 2);
    score += rerenderScore;

    return Math.round(score);
  }

  /**
   * Generates optimization suggestions based on metrics
   */
  private generateOptimizationSuggestions(metrics: ComponentComplexityMetrics): string[] {
    const suggestions: string[] = [];

    // Render time optimizations
    if (metrics.renderTime > this.thresholds.renderTime) {
      suggestions.push('Consider memoizing expensive calculations with useMemo');
      suggestions.push('Break down into smaller sub-components');
      suggestions.push('Use React.memo to prevent unnecessary re-renders');
    }

    // High render frequency
    if (metrics.renderCount > this.thresholds.renderCount) {
      suggestions.push('Check for unnecessary state updates or props changes');
      suggestions.push('Consider debouncing rapid state changes');
      suggestions.push('Use useCallback for event handlers');
    }

    // Too many props
    if (metrics.propsCount > 15) {
      suggestions.push('Group related props into objects');
      suggestions.push('Consider using React context for deeply nested props');
      suggestions.push('Extract prop interfaces and use composition');
    }

    // Too many children
    if (metrics.childrenCount > 30) {
      suggestions.push('Implement virtualization for large lists');
      suggestions.push('Use lazy loading for heavy child components');
      suggestions.push('Consider pagination or infinite scrolling');
    }

    // Rerender issues
    if (metrics.rerenderReasons.length > 3) {
      suggestions.push('Investigate rerender causes and optimize dependencies');
      suggestions.push('Use React DevTools Profiler to identify rerender sources');
    }

    // Remove duplicates
    return Array.from(new Set(suggestions));
  }

  /**
   * Checks for immediate performance issues
   */
  private checkPerformanceIssues(componentName: string, metrics: ComponentComplexityMetrics): void {
    if (metrics.renderTime > this.thresholds.renderTime * 2) {
      console.warn(`🐌 Slow component detected: ${componentName} (${metrics.renderTime}ms render time)`);
    }

    if (metrics.renderCount > this.thresholds.renderCount * 1.5) {
      console.warn(`🔄 High render frequency: ${componentName} (${metrics.renderCount} renders/min)`);
    }

    if (metrics.complexityScore > this.thresholds.complexityScore) {
      console.warn(`🚨 Complex component: ${componentName} (complexity score: ${metrics.complexityScore})`);
    }
  }

  /**
   * Gets metrics for a specific component
   */
  getComponentMetrics(componentName: string): ComponentComplexityMetrics | undefined {
    return this.componentMetrics.get(componentName);
  }

  /**
   * Gets all component metrics
   */
  getAllMetrics(): Map<string, ComponentComplexityMetrics> {
    return new Map(this.componentMetrics);
  }

  /**
   * Gets components that need optimization
   */
  getComplexComponents(): Array<{ name: string; metrics: ComponentComplexityMetrics }> {
    const complexComponents: Array<{ name: string; metrics: ComponentComplexityMetrics }> = [];

    this.componentMetrics.forEach((metrics, name) => {
      if (metrics.complexityScore > this.thresholds.complexityScore) {
        complexComponents.push({ name, metrics });
      }
    });

    return complexComponents.sort((a, b) => b.metrics.complexityScore - a.metrics.complexityScore);
  }

  /**
   * Generates optimization report
   */
  generateOptimizationReport(): {
    summary: {
      totalComponents: number;
      complexComponents: number;
      averageComplexity: number;
      topIssues: string[];
    };
    recommendations: Array<{
      component: string;
      priority: 'high' | 'medium' | 'low';
      issues: string[];
      suggestions: string[];
    }>;
  } {
    const allMetrics = Array.from(this.componentMetrics.values());
    const complexComponents = this.getComplexComponents();

    // Calculate summary
    const totalComponents = allMetrics.length;
    const averageComplexity = totalComponents > 0 
      ? allMetrics.reduce((sum, m) => sum + m.complexityScore, 0) / totalComponents 
      : 0;

    // Find top issues
    const allSuggestions = allMetrics.flatMap(m => m.optimizationSuggestions);
    const suggestionCounts = allSuggestions.reduce((counts, suggestion) => {
      counts[suggestion] = (counts[suggestion] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const topIssues = Object.entries(suggestionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([suggestion]) => suggestion);

    // Generate recommendations
    const recommendations = complexComponents.map(({ name, metrics }) => {
      let priority: 'high' | 'medium' | 'low' = 'low';
      
      if (metrics.complexityScore > 85) {
        priority = 'high';
      } else if (metrics.complexityScore > 70) {
        priority = 'medium';
      }

      const issues: string[] = [];
      
      if (metrics.renderTime > this.thresholds.renderTime) {
        issues.push(`Slow rendering (${metrics.renderTime}ms)`);
      }
      
      if (metrics.renderCount > this.thresholds.renderCount) {
        issues.push(`Frequent re-renders (${metrics.renderCount}/min)`);
      }
      
      if (metrics.propsCount > 15) {
        issues.push(`Too many props (${metrics.propsCount})`);
      }

      return {
        component: name,
        priority,
        issues,
        suggestions: metrics.optimizationSuggestions,
      };
    });

    return {
      summary: {
        totalComponents,
        complexComponents: complexComponents.length,
        averageComplexity: Math.round(averageComplexity),
        topIssues,
      },
      recommendations,
    };
  }

  /**
   * Clears all metrics
   */
  clear(): void {
    this.componentMetrics.clear();
    this.renderTimestamps.clear();
  }
}

/**
 * Global complexity analyzer instance
 */
export const complexityAnalyzer = new ComponentComplexityAnalyzer();

/**
 * React hook for tracking component performance
 */
export function useComponentPerformance(componentName: string) {
  const renderStartTime = useRef<number>(Date.now());
  const [renderCount, setRenderCount] = useState(0);
  const previousProps = useRef<any>();
  const previousChildren = useRef<React.ReactNode>();

  // Track render start
  useEffect(() => {
    renderStartTime.current = Date.now();
  });

  // Track render completion
  useEffect(() => {
    const renderTime = Date.now() - renderStartTime.current;
    setRenderCount(prev => prev + 1);
    
    // Track with complexity analyzer
    complexityAnalyzer.trackComponentRender(
      componentName,
      renderTime,
      previousProps.current,
      previousChildren.current
    );
  });

  // Memoized performance utilities
  const optimizationUtils = useMemo(() => ({
    // Memoized callback creator
    createCallback: <T extends (...args: any[]) => any>(fn: T, deps: React.DependencyList) => 
      useCallback(fn, deps),
    
    // Memoized value creator
    createMemo: <T>(fn: () => T, deps: React.DependencyList) => 
      useMemo(fn, deps),
    
    // Component metrics getter
    getMetrics: () => complexityAnalyzer.getComponentMetrics(componentName),
  }), [componentName]);

  return {
    renderCount,
    ...optimizationUtils,
  };
}

/**
 * Higher-order component for automatic performance tracking
 */
export function withPerformanceTracking<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
) {
  const displayName = componentName || WrappedComponent.displayName || WrappedComponent.name || 'Component';
  
  const TrackedComponent = (props: P) => {
    useComponentPerformance(displayName);
    
    return React.createElement(WrappedComponent, props);
  };

  TrackedComponent.displayName = `withPerformanceTracking(${displayName})`;
  
  return TrackedComponent;
}

/**
 * Performance optimization utilities
 */
export const PerformanceUtils = {
  /**
   * Creates a memoized component with automatic performance tracking
   */
  createOptimizedComponent: <P extends object>(
    component: React.ComponentType<P>,
    propsAreEqual?: (prevProps: P, nextProps: P) => boolean
  ) => {
    const MemoizedComponent = React.memo(component, propsAreEqual);
    return withPerformanceTracking(MemoizedComponent);
  },

  /**
   * Debounced state updater for high-frequency updates
   */
  createDebouncedState: <T>(initialValue: T, delay: number = 300) => {
    const [value, setValue] = useState(initialValue);
    const [debouncedValue, setDebouncedValue] = useState(initialValue);

    useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);

      return () => {
        clearTimeout(handler);
      };
    }, [value, delay]);

    return [debouncedValue, setValue] as const;
  },

  /**
   * Throttled event handler creator
   */
  createThrottledHandler: <T extends (...args: any[]) => any>(
    handler: T,
    delay: number = 100
  ) => {
    const lastCall = useRef<number>(0);

    return useCallback((...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall.current >= delay) {
        lastCall.current = now;
        handler(...args);
      }
    }, [handler, delay]);
  },
};

// Import React
import React from 'react';