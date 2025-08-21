/**
 * Quality Monitoring Integration for Continuous Improvement Pillar.
 * 
 * This module provides utilities for integrating new quality metrics
 * with the continuous improvement pillar automatically.
 */

import { registerQualityAnalyzer } from './routes';
import type { InsertImprovementSuggestion } from '@shared/schema';

/**
 * Configuration interface for quality metric thresholds.
 * Defines warning and critical levels for automated monitoring.
 */
interface MetricThresholds {
  /** Warning threshold value for metric monitoring */
  warning?: number;
  /** Critical threshold value for metric monitoring */
  critical?: number;
  /** Additional custom threshold properties */
  [key: string]: number | undefined;
}

/**
 * Configuration interface for quality metric monitoring integration.
 * Used to set up automated analysis and improvement suggestion generation.
 */
interface QualityMetricConfig {
  /** Name of the quality metric being monitored */
  metricName: string;
  /** Threshold configuration for warning and critical levels */
  thresholds: MetricThresholds;
  /** Function to generate improvement suggestions when thresholds are exceeded */
  generateSuggestion: (value: any, thresholdType: string, threshold: number) => InsertImprovementSuggestion;
}

/**
 * Registers a new quality metric for automated monitoring by the continuous improvement pillar.
 * The metric will be automatically analyzed every 5 minutes and generate improvement
 * suggestions when thresholds are exceeded.
 * 
 * @param {QualityMetricConfig} config - Configuration object for the quality metric monitoring.
 * @param {string} config.metricName - Name of the metric to monitor.
 * @param {MetricThresholds} config.thresholds - Warning and critical threshold values.
 * @param {Function} config.generateSuggestion - Function to create improvement suggestions.
 * @returns {void} No return value - metric monitoring is registered globally.
 * 
 * @example
 * ```typescript
 * addQualityMetricMonitoring({
 *   metricName: 'memory_usage',
 *   thresholds: { warning: 80, critical: 95 },
 *   generateSuggestion: (value, type, threshold) => ({
 *     category: 'Performance',
 *     priority: type === 'critical' ? 'Critical' : 'High',
 *     title: `High Memory Usage: ${value}%`,
 *     description: `Memory usage exceeded ${type} threshold of ${threshold}%`,
 *     recommendation: 'Optimize memory usage and investigate memory leaks'
 *   })
 * });
 * ```
 */
/**
 * AddQualityMetricMonitoring function.
 * @param config
 * @returns Function result.
 */
export function addQualityMetricMonitoring(config: QualityMetricConfig): void {
  registerQualityAnalyzer({
    metricName: config.metricName,
    analyze: async (value: unknown) => {
      const suggestions: InsertImprovementSuggestion[] = [];
      
      // Parse numeric values if they're strings with units
      let numericValue: number;
      if (typeof value === 'string') {
        numericValue = parseFloat(value.replace(/[^0-9.-]/g, ''));
      } else if (typeof value === 'number') {
        numericValue = value;
      } else {
        return [];
      }
      
      // Check against thresholds in order of severity
      if (config.thresholds.critical !== undefined && numericValue >= config.thresholds.critical) {
        suggestions.push(config.generateSuggestion(value, 'critical', config.thresholds.critical));
      } else if (config.thresholds.warning !== undefined && numericValue >= config.thresholds.warning) {
        suggestions.push(config.generateSuggestion(value, 'warning', config.thresholds.warning));
      }
      
      return suggestions;
    },
  });
}

/**
 * Instructions for developers on how to add new quality metrics
 * that will be automatically monitored by the continuous improvement pillar.
 */
export const INTEGRATION_GUIDE = `
# Adding New Quality Metrics to Continuous Improvement Pillar

## Automatic Integration

All quality metrics added to the system will automatically be monitored by the continuous improvement pillar.

### 1. Add your metric to the quality metrics API response

In server/routes.ts, modify the getQualityMetrics() or getPerformanceMetrics() functions:

return {
  // ... existing metrics
  yourNewMetric: await calculateYourMetric(),
};

### 2. The metric will be automatically monitored

Your metric will now:
- Be fetched every 5 minutes
- Automatically generate improvement suggestions when issues are detected
- Feed into the continuous improvement pillar
- Be visible to users in the quality assurance dashboard

## Built-in Monitoring

The following metrics are already monitored:
- Code coverage
- Code quality grade  
- Security vulnerabilities
- API response time
- Memory usage
- Bundle size
- Database query time
- Page load time
- Translation coverage
`;