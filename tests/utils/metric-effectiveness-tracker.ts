import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Interface for tracking quality metric effectiveness over time.
 */
export interface MetricEffectivenessData {
  timestamp: string;
  metric: string;
  calculatedValue: string;
  realIssuesFound: number;
  falsePositives: number;
  missedIssues: number;
  accuracy: number;
  projectPhase: 'development' | 'testing' | 'staging' | 'production';
  issueDetails?: {
    criticalIssues: number;
    moderateIssues: number;
    minorIssues: number;
    description?: string;
  };
}

/**
 * Interface for metric improvement suggestions.
 */
export interface MetricImprovementSuggestion {
  metric: string;
  currentAccuracy: number;
  targetAccuracy: number;
  suggestions: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Comprehensive quality metric effectiveness tracking system.
 * This class tracks how well our quality metrics actually identify real problems
 * and provides insights for continuous improvement.
 */
export class MetricEffectivenessTracker {
  private static readonly DATA_FILE = join(process.cwd(), '.quality-metrics-history.json');
  private static metricsHistory: MetricEffectivenessData[] = [];

  /**
   * Loads historical metric data from file.
   */
  static loadHistory(): void {
    if (existsSync(this.DATA_FILE)) {
      try {
        const data = readFileSync(this.DATA_FILE, 'utf-8');
        this.metricsHistory = JSON.parse(data);
      } catch (error) {
        console.warn('Failed to load metric history, starting fresh:', error);
        this.metricsHistory = [];
      }
    }
  }

  /**
   * Saves historical metric data to file.
   */
  static saveHistory(): void {
    try {
      writeFileSync(this.DATA_FILE, JSON.stringify(this.metricsHistory, null, 2));
    } catch (error) {
      console.error('Failed to save metric history:', error);
    }
  }

  /**
   * Records the effectiveness of a quality metric calculation.
   * @param data - The metric effectiveness data
   */
  static recordMetricEffectiveness(data: Omit<MetricEffectivenessData, 'accuracy' | 'timestamp'>): void {
    const totalReported = data.realIssuesFound + data.falsePositives;
    const totalActual = data.realIssuesFound + data.missedIssues;
    const accuracy = totalActual > 0 ? (data.realIssuesFound / totalActual) * 100 : 100;

    const effectivenessData: MetricEffectivenessData = {
      ...data,
      timestamp: new Date().toISOString(),
      accuracy,
    };

    this.metricsHistory.push(effectivenessData);
    this.saveHistory();

    // Auto-generate improvement suggestions if accuracy is low
    if (accuracy < 70) {
      this.generateImprovementSuggestion(data.metric, accuracy);
    }
  }

  /**
   * Gets comprehensive effectiveness statistics for a specific metric.
   * @param metric - The metric name to analyze
   * @param timeRangeHours - Optional time range to analyze (default: all time)
   * @returns Detailed effectiveness statistics
   */
  static getMetricEffectiveness(metric: string, timeRangeHours?: number) {
    this.loadHistory();
    
    let metricData = this.metricsHistory.filter(m => m.metric === metric);
    
    if (timeRangeHours) {
      const cutoffTime = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);
      metricData = metricData.filter(m => new Date(m.timestamp) >= cutoffTime);
    }

    if (metricData.length === 0) return null;

    const avgAccuracy = metricData.reduce((sum, data) => sum + data.accuracy, 0) / metricData.length;
    const totalRealIssues = metricData.reduce((sum, data) => sum + data.realIssuesFound, 0);
    const totalFalsePositives = metricData.reduce((sum, data) => sum + data.falsePositives, 0);
    const totalMissedIssues = metricData.reduce((sum, data) => sum + data.missedIssues, 0);

    // Calculate trend (improvement/deterioration over time)
    const recentData = metricData.slice(-5); // Last 5 measurements
    const oldData = metricData.slice(0, 5); // First 5 measurements
    const recentAvgAccuracy = recentData.reduce((sum, data) => sum + data.accuracy, 0) / recentData.length;
    const oldAvgAccuracy = oldData.reduce((sum, data) => sum + data.accuracy, 0) / oldData.length;
    const trend = recentAvgAccuracy - oldAvgAccuracy;

    // Calculate issue severity distribution
    const criticalIssues = metricData.reduce((sum, data) => 
      sum + (data.issueDetails?.criticalIssues || 0), 0);
    const moderateIssues = metricData.reduce((sum, data) => 
      sum + (data.issueDetails?.moderateIssues || 0), 0);
    const minorIssues = metricData.reduce((sum, data) => 
      sum + (data.issueDetails?.minorIssues || 0), 0);

    return {
      metric,
      totalMeasurements: metricData.length,
      averageAccuracy: avgAccuracy,
      accuracyTrend: trend,
      totalRealIssuesFound: totalRealIssues,
      totalFalsePositives,
      totalMissedIssues,
      falsePositiveRate: totalRealIssues > 0 ? (totalFalsePositives / totalRealIssues) * 100 : 0,
      missedIssueRate: totalRealIssues > 0 ? (totalMissedIssues / totalRealIssues) * 100 : 0,
      issueSeverityDistribution: {
        critical: criticalIssues,
        moderate: moderateIssues,
        minor: minorIssues,
      },
      lastMeasurement: metricData[metricData.length - 1],
      recentMeasurements: recentData,
    };
  }

  /**
   * Validates whether a metric meets quality standards.
   * @param metric - The metric name
   * @param minAccuracy - Minimum accuracy threshold (default: 80%)
   * @param maxFalsePositiveRate - Maximum false positive rate (default: 20%)
   * @returns Whether the metric meets quality standards
   */
  static validateMetricQuality(
    metric: string, 
    minAccuracy: number = 80, 
    maxFalsePositiveRate: number = 20
  ): {
    isValid: boolean;
    reasons: string[];
    recommendations: string[];
  } {
    const effectiveness = this.getMetricEffectiveness(metric);
    
    if (!effectiveness) {
      return {
        isValid: false,
        reasons: ['No effectiveness data available'],
        recommendations: ['Start tracking metric effectiveness data']
      };
    }

    const reasons: string[] = [];
    const recommendations: string[] = [];
    let isValid = true;

    // Check accuracy
    if (effectiveness.averageAccuracy < minAccuracy) {
      isValid = false;
      reasons.push(`Average accuracy (${effectiveness.averageAccuracy.toFixed(1)}%) below threshold (${minAccuracy}%)`);
      recommendations.push('Review metric calculation logic and improve detection algorithms');
    }

    // Check false positive rate
    if (effectiveness.falsePositiveRate > maxFalsePositiveRate) {
      isValid = false;
      reasons.push(`False positive rate (${effectiveness.falsePositiveRate.toFixed(1)}%) exceeds threshold (${maxFalsePositiveRate}%)`);
      recommendations.push('Refine metric criteria to reduce false positives');
    }

    // Check if metric finds more real issues than false positives
    if (effectiveness.totalFalsePositives > effectiveness.totalRealIssuesFound) {
      isValid = false;
      reasons.push('More false positives than real issues found');
      recommendations.push('Completely review metric implementation - may be fundamentally flawed');
    }

    // Check trend
    if (effectiveness.accuracyTrend < -10) {
      isValid = false;
      reasons.push(`Accuracy declining over time (${effectiveness.accuracyTrend.toFixed(1)}% trend)`);
      recommendations.push('Investigate why metric effectiveness is decreasing');
    }

    // Positive feedback
    if (isValid) {
      reasons.push('Metric meets quality standards');
      if (effectiveness.averageAccuracy > 90) {
        reasons.push('Excellent accuracy achieved');
      }
      if (effectiveness.accuracyTrend > 5) {
        reasons.push('Improving trend over time');
      }
    }

    return { isValid, reasons, recommendations };
  }

  /**
   * Generates improvement suggestions for a metric with low effectiveness.
   * @param metric - The metric name
   * @param currentAccuracy - Current accuracy percentage
   * @returns Improvement suggestions
   */
  static generateImprovementSuggestion(
    metric: string, 
    currentAccuracy: number
  ): MetricImprovementSuggestion {
    const suggestions: string[] = [];
    let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    let targetAccuracy = 85;

    if (currentAccuracy < 50) {
      priority = 'critical';
      targetAccuracy = 75;
      suggestions.push('Completely re-evaluate metric calculation methodology');
      suggestions.push('Consider replacing with alternative measurement approach');
    } else if (currentAccuracy < 70) {
      priority = 'high';
      targetAccuracy = 80;
      suggestions.push('Review and refine metric detection algorithms');
      suggestions.push('Analyze false positives to identify common patterns');
    } else if (currentAccuracy < 80) {
      priority = 'medium';
      targetAccuracy = 85;
      suggestions.push('Fine-tune metric thresholds and criteria');
    }

    // Metric-specific suggestions
    switch (metric) {
      case 'coverage':
        suggestions.push('Ensure coverage includes all critical code paths');
        suggestions.push('Review excluded files and directories');
        suggestions.push('Consider adding integration test coverage');
        break;
      
      case 'codeQuality':
        suggestions.push('Review ESLint rules for relevance to code quality');
        suggestions.push('Add custom rules for project-specific quality concerns');
        suggestions.push('Weight different types of issues by severity');
        break;
      
      case 'securityIssues':
        suggestions.push('Supplement npm audit with additional security scanning');
        suggestions.push('Filter out dev-only vulnerabilities in production metrics');
        suggestions.push('Add manual security review for critical components');
        break;
      
      case 'translationCoverage':
        suggestions.push('Implement automated detection of user-facing strings');
        suggestions.push('Add validation for translation key consistency');
        suggestions.push('Consider context-aware translation validation');
        break;
      
      case 'buildTime':
        suggestions.push('Profile build process to identify bottlenecks');
        suggestions.push('Consider caching strategies for faster builds');
        suggestions.push('Set up build time monitoring and alerting');
        break;
    }

    return {
      metric,
      currentAccuracy,
      targetAccuracy,
      suggestions,
      priority,
    };
  }

  /**
   * Gets overall quality metrics system health.
   * @returns System health assessment
   */
  static getSystemHealth() {
    this.loadHistory();
    
    const metrics = [...new Set(this.metricsHistory.map(m => m.metric))];
    const healthScores = metrics.map(metric => {
      const effectiveness = this.getMetricEffectiveness(metric);
      const validation = this.validateMetricQuality(metric);
      
      return {
        metric,
        accuracy: effectiveness?.averageAccuracy || 0,
        isValid: validation.isValid,
        measurementCount: effectiveness?.totalMeasurements || 0,
      };
    });

    const avgAccuracy = healthScores.reduce((sum, score) => sum + score.accuracy, 0) / healthScores.length;
    const validMetrics = healthScores.filter(score => score.isValid).length;
    const totalMeasurements = healthScores.reduce((sum, score) => sum + score.measurementCount, 0);

    let healthStatus: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' = 'good';
    
    if (avgAccuracy >= 90 && validMetrics === metrics.length) {
      healthStatus = 'excellent';
    } else if (avgAccuracy >= 80 && validMetrics / metrics.length >= 0.8) {
      healthStatus = 'good';
    } else if (avgAccuracy >= 70 && validMetrics / metrics.length >= 0.6) {
      healthStatus = 'fair';
    } else if (avgAccuracy >= 50) {
      healthStatus = 'poor';
    } else {
      healthStatus = 'critical';
    }

    return {
      healthStatus,
      averageAccuracy: avgAccuracy,
      validMetricsCount: validMetrics,
      totalMetrics: metrics.length,
      totalMeasurements,
      metricScores: healthScores,
      recommendations: this.getSystemRecommendations(healthScores),
    };
  }

  /**
   * Gets system-wide recommendations for improving quality metrics.
   * @param healthScores - Individual metric health scores
   * @returns System recommendations
   */
  private static getSystemRecommendations(healthScores: any[]): string[] {
    const recommendations: string[] = [];
    
    const lowAccuracyMetrics = healthScores.filter(score => score.accuracy < 80);
    const invalidMetrics = healthScores.filter(score => !score.isValid);
    const undermeasuredMetrics = healthScores.filter(score => score.measurementCount < 5);

    if (lowAccuracyMetrics.length > 0) {
      recommendations.push(`Focus on improving accuracy for: ${lowAccuracyMetrics.map(m => m.metric).join(', ')}`);
    }

    if (invalidMetrics.length > 0) {
      recommendations.push(`Review implementation of invalid metrics: ${invalidMetrics.map(m => m.metric).join(', ')}`);
    }

    if (undermeasuredMetrics.length > 0) {
      recommendations.push(`Increase measurement frequency for: ${undermeasuredMetrics.map(m => m.metric).join(', ')}`);
    }

    if (healthScores.length < 5) {
      recommendations.push('Consider adding additional quality metrics for comprehensive coverage');
    }

    if (healthScores.every(score => score.measurementCount > 0)) {
      recommendations.push('Implement automated metric effectiveness tracking in CI/CD pipeline');
    }

    return recommendations;
  }

  /**
   * Exports metric effectiveness data for analysis.
   * @param format - Export format ('json' | 'csv')
   * @returns Formatted data string
   */
  static exportData(format: 'json' | 'csv' = 'json'): string {
    this.loadHistory();
    
    if (format === 'json') {
      return JSON.stringify(this.metricsHistory, null, 2);
    } else {
      // CSV format
      const headers = [
        'timestamp', 'metric', 'calculatedValue', 'realIssuesFound',
        'falsePositives', 'missedIssues', 'accuracy', 'projectPhase'
      ];
      
      const rows = this.metricsHistory.map(data => [
        data.timestamp,
        data.metric,
        data.calculatedValue,
        data.realIssuesFound,
        data.falsePositives,
        data.missedIssues,
        data.accuracy,
        data.projectPhase,
      ]);

      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }
  }
}