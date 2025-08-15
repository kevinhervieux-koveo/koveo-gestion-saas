/**
 * Quality Monitoring Integration for Continuous Improvement Pillar
 * 
 * This module provides utilities for integrating new quality metrics
 * with the continuous improvement pillar automatically.
 */

import { registerQualityAnalyzer } from './routes';
import type { InsertImprovementSuggestion } from '@shared/schema';

interface MetricThresholds {
  warning?: number;
  critical?: number;
  [key: string]: number | undefined;
}

interface QualityMetricConfig {
  metricName: string;
  thresholds: MetricThresholds;
  generateSuggestion: (value: any, thresholdType: string, threshold: number) => InsertImprovementSuggestion;
}

/**
 * Adds monitoring for a new quality metric to the continuous improvement pillar.
 * The metric will be automatically analyzed whenever quality metrics are fetched.
 * 
 * @param config Configuration for the new quality metric monitoring
 */
export function addQualityMetricMonitoring(config: QualityMetricConfig): void {
  registerQualityAnalyzer({
    metricName: config.metricName,
    analyze: async (value: any) => {
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