/**
 * Server-side performance monitoring for Quebec property management SaaS.
 * Tracks database query performance and provides optimization insights.
 */

import { performance } from 'perf_hooks';

/**
 * Query performance tracker.
 */
class DatabasePerformanceMonitor {
  private queryTimes: number[] = [];
  private slowQueries: Array<{ query: string; duration: number; timestamp: Date }> = [];
  private readonly SLOW_QUERY_THRESHOLD = 100; // ms

  /**
   * Tracks execution time of a database operation.
   * @param queryName
   * @param operation
   */
  trackQuery<T>(queryName: string, operation: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    
    return operation().then(result => {
      const duration = performance.now() - startTime;
      this.recordQueryTime(queryName, duration);
      return result;
    }).catch(error => {
      const duration = performance.now() - startTime;
      this.recordQueryTime(queryName, duration);
      throw error;
    });
  }

  /**
   * Records query execution time.
   * @param queryName
   * @param duration
   */
  private recordQueryTime(queryName: string, duration: number): void {
    this.queryTimes.push(duration);
    
    // Keep only last 1000 query times for memory efficiency
    if (this.queryTimes.length > 1000) {
      this.queryTimes.shift();
    }

    // Track slow queries
    if (duration > this.SLOW_QUERY_THRESHOLD) {
      this.slowQueries.push({
        query: queryName,
        duration,
        timestamp: new Date()
      });
      
      // Keep only last 100 slow queries
      if (this.slowQueries.length > 100) {
        this.slowQueries.shift();
      }
      
      console.warn(`Slow query detected: ${queryName} took ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * Gets average query time.
   */
  getAverageQueryTime(): number {
    if (this.queryTimes.length === 0) {return 0;}
    return this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length;
  }

  /**
   * Gets performance statistics.
   */
  getPerformanceStats(): any {
    const avg = this.getAverageQueryTime();
    const max = Math.max(...this.queryTimes);
    const min = Math.min(...this.queryTimes);
    
    return {
      averageQueryTime: `${avg.toFixed(2)}ms`,
      maxQueryTime: `${max.toFixed(2)}ms`,
      minQueryTime: `${min.toFixed(2)}ms`,
      totalQueries: this.queryTimes.length,
      slowQueries: this.slowQueries.length,
      recentSlowQueries: this.slowQueries.slice(-10)
    };
  }

  /**
   * Provides optimization recommendations.
   */
  getOptimizationRecommendations(): string[] {
    const avg = this.getAverageQueryTime();
    const recommendations: string[] = [];

    if (avg > 100) {
      recommendations.push('Average query time exceeds 100ms. Consider adding database indexes.');
    }

    if (this.slowQueries.length > 10) {
      recommendations.push('Multiple slow queries detected. Review and optimize frequent queries.');
    }

    const commonSlowQueries = this.getCommonSlowQueries();
    if (commonSlowQueries.length > 0) {
      recommendations.push(`Common slow queries: ${commonSlowQueries.join(', ')}`);
    }

    return recommendations;
  }

  /**
   * Identifies commonly slow queries.
   */
  private getCommonSlowQueries(): string[] {
    const queryFrequency: Record<string, number> = {};
    
    this.slowQueries.forEach(({ query }) => {
      queryFrequency[query] = (queryFrequency[query] || 0) + 1;
    });

    return Object.entries(queryFrequency)
      .filter(([, count]) => count > 2)
      .map(([query]) => query);
  }

  /**
   * Resets performance tracking data.
   */
  reset(): void {
    this.queryTimes = [];
    this.slowQueries = [];
  }
}

/**
 * Global performance monitor instance.
 */
export const dbPerformanceMonitor = new DatabasePerformanceMonitor();

/**
 * Decorator for tracking database operation performance.
 * @param queryName
 */
export function trackPerformance(queryName: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return dbPerformanceMonitor.trackQuery(queryName, () => method.apply(this, args));
    };

    return descriptor;
  };
}