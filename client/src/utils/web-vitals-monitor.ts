// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
/**
 * Enhanced Web Vitals monitoring for Quebec Property Management SaaS
 * Tracks Core Web Vitals and provides real-time performance insights
 */

import { onCLS, onINP, onFCP, onLCP, onTTFB, type Metric } from 'web-vitals';

export interface WebVitalsMetrics {
  // Core Web Vitals
  LCP?: number; // Largest Contentful Paint
  INP?: number; // Interaction to Next Paint (replaces FID)
  CLS?: number; // Cumulative Layout Shift
  
  // Additional Important Metrics
  FCP?: number; // First Contentful Paint
  TTFB?: number; // Time to First Byte
  
  // Calculated Metrics
  performanceScore?: number; // Overall performance score (0-100)
  userExperienceRating?: 'good' | 'needs-improvement' | 'poor';
}

export interface VitalsThresholds {
  LCP: { good: number; needsImprovement: number };
  INP: { good: number; needsImprovement: number };
  CLS: { good: number; needsImprovement: number };
  FCP: { good: number; needsImprovement: number };
  TTFB: { good: number; needsImprovement: number };
}

/**
 * Web Vitals thresholds based on Google's recommendations
 */
const WEB_VITALS_THRESHOLDS: VitalsThresholds = {
  LCP: { good: 2500, needsImprovement: 4000 },
  INP: { good: 200, needsImprovement: 500 },
  CLS: { good: 0.1, needsImprovement: 0.25 },
  FCP: { good: 1800, needsImprovement: 3000 },
  TTFB: { good: 800, needsImprovement: 1800 },
};

class WebVitalsMonitor {
  private metrics: WebVitalsMetrics = {};
  private callbacks: Array<(metrics: WebVitalsMetrics) => void> = [];
  private isInitialized = false;

  /**
   * Initializes Web Vitals monitoring
   */
  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    this.isInitialized = true;

    // Track Core Web Vitals
    onCLS(this.onMetric.bind(this, 'CLS'));
    onINP(this.onMetric.bind(this, 'INP'));
    onLCP(this.onMetric.bind(this, 'LCP'));
    
    // Track Additional Metrics
    onFCP(this.onMetric.bind(this, 'FCP'));
    onTTFB(this.onMetric.bind(this, 'TTFB'));

  }

  /**
   * Handles metric updates
   */
  private onMetric(metricName: keyof WebVitalsMetrics, metric: Metric): void {
    this.metrics[metricName] = metric.value;
    
    // Calculate performance score and rating
    this.updatePerformanceScore();
    this.updateUserExperienceRating();

    // Notify callbacks
    this.callbacks.forEach(callback => callback(this.metrics));

    // Log significant metrics
    this.logMetric(metricName, metric.value);

    // Send to analytics if enabled
    this.sendToAnalytics(metricName, metric);
  }

  /**
   * Calculates overall performance score (0-100)
   */
  private updatePerformanceScore(): void {
    const scores: number[] = [];

    // LCP Score (0-100)
    if (this.metrics.LCP !== undefined) {
      scores.push(this.calculateMetricScore('LCP', this.metrics.LCP));
    }

    // INP Score (0-100)
    if (this.metrics.INP !== undefined) {
      scores.push(this.calculateMetricScore('INP', this.metrics.INP));
    }

    // CLS Score (0-100)
    if (this.metrics.CLS !== undefined) {
      scores.push(this.calculateMetricScore('CLS', this.metrics.CLS));
    }

    // FCP Score (0-100)
    if (this.metrics.FCP !== undefined) {
      scores.push(this.calculateMetricScore('FCP', this.metrics.FCP));
    }

    if (scores.length > 0) {
      this.metrics.performanceScore = Math.round(
        scores.reduce((sum, score) => sum + score, 0) / scores.length
      );
    }
  }

  /**
   * Calculates score for individual metric
   */
  private calculateMetricScore(metricName: keyof VitalsThresholds, value: number): number {
    const thresholds = WEB_VITALS_THRESHOLDS[metricName];
    
    if (value <= thresholds.good) {
      return 100; // Perfect score
    } else if (value <= thresholds.needsImprovement) {
      // Linear interpolation between 50-100
      const range = thresholds.needsImprovement - thresholds.good;
      const position = value - thresholds.good;
      return Math.max(50, 100 - (position / range) * 50);
    } else {
      // Linear interpolation between 0-50
      const poorValue = thresholds.needsImprovement * 2; // Assume 2x is "very poor"
      const range = poorValue - thresholds.needsImprovement;
      const position = Math.min(value - thresholds.needsImprovement, range);
      return Math.max(0, 50 - (position / range) * 50);
    }
  }

  /**
   * Updates user experience rating
   */
  private updateUserExperienceRating(): void {
    const { LCP, INP, CLS } = this.metrics;
    
    if (LCP === undefined || INP === undefined || CLS === undefined) {
      return; // Need all Core Web Vitals for rating
    }

    const lcpGood = LCP <= WEB_VITALS_THRESHOLDS.LCP.good;
    const inpGood = INP <= WEB_VITALS_THRESHOLDS.INP.good;
    const clsGood = CLS <= WEB_VITALS_THRESHOLDS.CLS.good;

    if (lcpGood && inpGood && clsGood) {
      this.metrics.userExperienceRating = 'good';
    } else if (
      LCP <= WEB_VITALS_THRESHOLDS.LCP.needsImprovement &&
      INP <= WEB_VITALS_THRESHOLDS.INP.needsImprovement &&
      CLS <= WEB_VITALS_THRESHOLDS.CLS.needsImprovement
    ) {
      this.metrics.userExperienceRating = 'needs-improvement';
    } else {
      this.metrics.userExperienceRating = 'poor';
    }
  }

  /**
   * Logs metric with appropriate styling
   */
  private logMetric(metricName: string, value: number): void {
    const thresholds = WEB_VITALS_THRESHOLDS[metricName as keyof VitalsThresholds];
    if (!thresholds) return;

    let color = '🟢'; // Good
    let status = 'Good';

    if (value > thresholds.needsImprovement) {
      color = '🔴';
      status = 'Poor';
    } else if (value > thresholds.good) {
      color = '🟡';
      status = 'Needs Improvement';
    }

  }

  /**
   * Sends metrics to analytics service
   */
  private sendToAnalytics(metricName: string, metric: Metric): void {
    // Send to performance API if available
    if (typeof fetch !== 'undefined') {
      fetch('/api/performance/web-vitals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: metricName,
          value: metric.value,
          id: metric.id,
          rating: this.getMetricRating(metricName as keyof VitalsThresholds, metric.value),
          timestamp: Date.now(),
          url: window.location.href,
          userAgent: navigator.userAgent,
        }),
      }).catch(() => {
        // Failed to send Web Vitals to analytics - silent fail
      });
    }
  }

  /**
   * Gets rating for specific metric
   */
  private getMetricRating(metricName: keyof VitalsThresholds, value: number): string {
    const thresholds = WEB_VITALS_THRESHOLDS[metricName];
    
    if (value <= thresholds.good) {
      return 'good';
    } else if (value <= thresholds.needsImprovement) {
      return 'needs-improvement';
    } else {
      return 'poor';
    }
  }

  /**
   * Subscribes to metric updates
   */
  onMetricsUpdate(callback: (metrics: WebVitalsMetrics) => void): () => void {
    this.callbacks.push(callback);
    
    // Call immediately with current metrics if available
    if (Object.keys(this.metrics).length > 0) {
      callback(this.metrics);
    }

    // Return unsubscribe function
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Gets current metrics
   */
  getMetrics(): WebVitalsMetrics {
    return { ...this.metrics };
  }

  /**
   * Gets optimization recommendations based on current metrics
   */
  getOptimizationRecommendations(): Array<{
    metric: string;
    issue: string;
    recommendation: string;
    priority: 'high' | 'medium' | 'low';
  }> {
    const recommendations: Array<{
      metric: string;
      issue: string;
      recommendation: string;
      priority: 'high' | 'medium' | 'low';
    }> = [];

    // LCP Recommendations
    if (this.metrics.LCP && this.metrics.LCP > WEB_VITALS_THRESHOLDS.LCP.needsImprovement) {
      recommendations.push({
        metric: 'LCP',
        issue: `Largest Contentful Paint is ${this.metrics.LCP}ms (target: <${WEB_VITALS_THRESHOLDS.LCP.good}ms)`,
        recommendation: 'Optimize images, preload critical resources, or implement server-side rendering',
        priority: 'high',
      });
    }

    // INP Recommendations
    if (this.metrics.INP && this.metrics.INP > WEB_VITALS_THRESHOLDS.INP.needsImprovement) {
      recommendations.push({
        metric: 'INP',
        issue: `Interaction to Next Paint is ${this.metrics.INP}ms (target: <${WEB_VITALS_THRESHOLDS.INP.good}ms)`,
        recommendation: 'Reduce JavaScript execution time, break up long tasks, or use web workers',
        priority: 'high',
      });
    }

    // CLS Recommendations
    if (this.metrics.CLS && this.metrics.CLS > WEB_VITALS_THRESHOLDS.CLS.needsImprovement) {
      recommendations.push({
        metric: 'CLS',
        issue: `Cumulative Layout Shift is ${this.metrics.CLS} (target: <${WEB_VITALS_THRESHOLDS.CLS.good})`,
        recommendation: 'Set explicit dimensions for images/videos, preload fonts, or avoid inserting content above existing content',
        priority: 'high',
      });
    }

    // FCP Recommendations
    if (this.metrics.FCP && this.metrics.FCP > WEB_VITALS_THRESHOLDS.FCP.needsImprovement) {
      recommendations.push({
        metric: 'FCP',
        issue: `First Contentful Paint is ${this.metrics.FCP}ms (target: <${WEB_VITALS_THRESHOLDS.FCP.good}ms)`,
        recommendation: 'Optimize critical rendering path, reduce blocking resources, or use resource hints',
        priority: 'medium',
      });
    }

    // TTFB Recommendations
    if (this.metrics.TTFB && this.metrics.TTFB > WEB_VITALS_THRESHOLDS.TTFB.needsImprovement) {
      recommendations.push({
        metric: 'TTFB',
        issue: `Time to First Byte is ${this.metrics.TTFB}ms (target: <${WEB_VITALS_THRESHOLDS.TTFB.good}ms)`,
        recommendation: 'Optimize server response time, use CDN, or implement caching strategies',
        priority: 'medium',
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Resets all metrics
   */
  reset(): void {
    this.metrics = {};
  }
}

/**
 * Global Web Vitals monitor instance
 */
export const webVitalsMonitor = new WebVitalsMonitor();

/**
 * React hook for Web Vitals monitoring
 */
export function useWebVitals() {
  const [metrics, setMetrics] = useState<WebVitalsMetrics>({});

  useEffect(() => {
    // Initialize monitoring
    webVitalsMonitor.initialize();

    // Subscribe to updates
    const unsubscribe = webVitalsMonitor.onMetricsUpdate(setMetrics);

    return unsubscribe;
  }, []);

  return {
    metrics,
    recommendations: webVitalsMonitor.getOptimizationRecommendations(),
    performanceScore: metrics.performanceScore,
    userExperienceRating: metrics.userExperienceRating,
  };
}

// Import React hooks
import { useState, useEffect } from 'react';