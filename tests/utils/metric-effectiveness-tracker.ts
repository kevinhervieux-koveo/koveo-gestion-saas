/**
 * Metric Effectiveness Tracker for Quality System Tests.
 * 
 * This utility tracks the real-world effectiveness of quality metrics
 * to ensure they are finding actual issues, not just reporting numbers.
 */

/**
 *
 */
interface MetricEffectivenessData {
  metric: string;
  calculatedValue: string;
  realIssuesFound: number;
  falsePositives: number;
  missedIssues: number;
  projectPhase?: string;
  accuracy: number;
  timestamp: string;
  issueDetails?: {
    criticalIssues?: number;
    moderateIssues?: number;
    minorIssues?: number;
    description?: string;
  };
}

/**
 *
 */
interface EffectivenessResult {
  metric: string;
  totalMeasurements: number;
  totalRealIssuesFound: number;
  totalFalsePositives: number;
  totalMissedIssues: number;
  averageAccuracy: number;
  accuracyTrend: number;
  issueSeverityDistribution: {
    critical: number;
    moderate: number;
    minor: number;
  };
  lastMeasurement?: MetricEffectivenessData;
}

/**
 *
 */
interface ValidationResult {
  isValid: boolean;
  reasons: string[];
  recommendations: string[];
}

/**
 *
 */
interface ImprovementSuggestion {
  metric: string;
  currentAccuracy: number;
  targetAccuracy: number;
  suggestions: string[];
  priority: 'high' | 'medium' | 'low';
}

/**
 *
 */
export class MetricEffectivenessTracker {
  private static measurements: MetricEffectivenessData[] = [];

  /**
   * Records the effectiveness of a quality metric measurement.
   * @param data
   * @param data.metric
   * @param data.calculatedValue
   * @param data.realIssuesFound
   * @param data.falsePositives
   * @param data.missedIssues
   * @param data.projectPhase
   * @param data.issueDetails
   * @param data.issueDetails.criticalIssues
   * @param data.issueDetails.moderateIssues
   * @param data.issueDetails.minorIssues
   * @param data.issueDetails.description
   */
  static recordMetricEffectiveness(data: {
    metric: string;
    calculatedValue: string;
    realIssuesFound: number;
    falsePositives: number;
    missedIssues: number;
    projectPhase?: string;
    issueDetails?: {
      criticalIssues?: number;
      moderateIssues?: number;
      minorIssues?: number;
      description?: string;
    };
  }): void {
    const totalReported = data.realIssuesFound + data.falsePositives;
    const totalActual = data.realIssuesFound + data.missedIssues;
    const accuracy = totalActual > 0 ? (data.realIssuesFound / totalActual) * 100 : 100;

    this.measurements.push({
      ...data,
      accuracy,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Gets effectiveness statistics for a specific metric.
   * @param metric
   */
  static getMetricEffectiveness(metric: string): EffectivenessResult | null {
    const metricData = this.measurements.filter(m => m.metric === metric);
    if (metricData.length === 0) {return null;}

    const totalRealIssues = metricData.reduce((sum, m) => sum + m.realIssuesFound, 0);
    const totalFalsePositives = metricData.reduce((sum, m) => sum + m.falsePositives, 0);
    const totalMissedIssues = metricData.reduce((sum, m) => sum + m.missedIssues, 0);
    const avgAccuracy = metricData.reduce((sum, m) => sum + m.accuracy, 0) / metricData.length;

    // Calculate accuracy trend (positive means improving)
    let accuracyTrend = 0;
    if (metricData.length >= 2) {
      const recent = metricData.slice(-3).map(m => m.accuracy);
      const early = metricData.slice(0, 3).map(m => m.accuracy);
      const recentAvg = recent.reduce((sum, acc) => sum + acc, 0) / recent.length;
      const earlyAvg = early.reduce((sum, acc) => sum + acc, 0) / early.length;
      accuracyTrend = recentAvg - earlyAvg;
    }

    // Calculate issue severity distribution
    const issueSeverityDistribution = {
      critical: metricData.reduce((sum, m) => sum + (m.issueDetails?.criticalIssues || 0), 0),
      moderate: metricData.reduce((sum, m) => sum + (m.issueDetails?.moderateIssues || 0), 0),
      minor: metricData.reduce((sum, m) => sum + (m.issueDetails?.minorIssues || 0), 0),
    };

    return {
      metric,
      totalMeasurements: metricData.length,
      totalRealIssuesFound: totalRealIssues,
      totalFalsePositives,
      totalMissedIssues,
      averageAccuracy: avgAccuracy,
      accuracyTrend,
      issueSeverityDistribution,
      lastMeasurement: metricData[metricData.length - 1],
    };
  }

  /**
   * Validates whether a metric is performing effectively.
   * @param metric
   * @param threshold
   */
  static validateMetricQuality(metric: string, threshold: number = 80): ValidationResult {
    const effectiveness = this.getMetricEffectiveness(metric);
    if (!effectiveness) {
      return {
        isValid: false,
        reasons: ['No measurement data available for this metric'],
        recommendations: ['Collect metric effectiveness data over time'],
      };
    }

    const reasons: string[] = [];
    const recommendations: string[] = [];

    // Check accuracy
    if (effectiveness.averageAccuracy < threshold) {
      reasons.push(`Average accuracy (${effectiveness.averageAccuracy.toFixed(1)}%) below threshold (${threshold}%)`);
      recommendations.push('Review metric implementation for accuracy');
    }

    // Check false positive rate
    const falsePositiveRate = effectiveness.totalFalsePositives / (effectiveness.totalRealIssuesFound + effectiveness.totalFalsePositives) * 100;
    if (falsePositiveRate > 30) {
      reasons.push(`High false positive rate (${falsePositiveRate.toFixed(1)}%)`);
      recommendations.push('Review metric implementation to reduce false positives');
    }

    // Check if metric finds more false positives than real issues
    if (effectiveness.totalFalsePositives >= effectiveness.totalRealIssuesFound) {
      reasons.push('More false positives than real issues detected');
      recommendations.push('Review metric implementation to reduce false positives');
    }

    const isValid = reasons.length === 0;

    return {
      isValid,
      reasons,
      recommendations,
    };
  }

  /**
   * Generates improvement suggestions for a metric.
   * @param metric
   * @param currentAccuracy
   */
  static generateImprovementSuggestion(metric: string, currentAccuracy: number): ImprovementSuggestion {
    const targetAccuracy = Math.min(95, currentAccuracy + 15);
    const gap = targetAccuracy - currentAccuracy;

    let priority: 'high' | 'medium' | 'low' = 'medium';
    if (currentAccuracy < 60) {priority = 'high';}
    else if (currentAccuracy > 85) {priority = 'low';}

    const suggestions: string[] = [];

    if (gap > 20) {
      suggestions.push('Consider redesigning the metric calculation');
      suggestions.push('Validate metric against real-world scenarios');
    } else if (gap > 10) {
      suggestions.push('Fine-tune metric thresholds');
      suggestions.push('Add additional validation checks');
    } else {
      suggestions.push('Monitor metric performance over time');
      suggestions.push('Collect more diverse measurement scenarios');
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
   * Clears all measurement data (for testing purposes).
   */
  static clearMeasurements(): void {
    this.measurements = [];
  }

  /**
   * Gets all measurements for a specific metric.
   * @param metric
   */
  static getMeasurements(metric?: string): MetricEffectivenessData[] {
    if (metric) {
      return this.measurements.filter(m => m.metric === metric);
    }
    return [...this.measurements];
  }

  /**
   * Gets overall system health across all metrics.
   */
  static getSystemHealth(): {
    totalMetrics: number;
    effectiveMetrics: number;
    ineffectiveMetrics: number;
    averageSystemAccuracy: number;
    criticalIssues: number;
    recommendations: string[];
  } {
    const uniqueMetrics = [...new Set(this.measurements.map(m => m.metric))];
    let effectiveCount = 0;
    let totalAccuracy = 0;
    let totalCritical = 0;
    const recommendations: string[] = [];

    uniqueMetrics.forEach(metric => {
      const effectiveness = this.getMetricEffectiveness(metric);
      if (effectiveness) {
        totalAccuracy += effectiveness.averageAccuracy;
        totalCritical += effectiveness.issueSeverityDistribution.critical;

        const validation = this.validateMetricQuality(metric);
        if (validation.isValid) {
          effectiveCount++;
        } else {
          recommendations.push(...validation.recommendations);
        }
      }
    });

    return {
      totalMetrics: uniqueMetrics.length,
      effectiveMetrics: effectiveCount,
      ineffectiveMetrics: uniqueMetrics.length - effectiveCount,
      averageSystemAccuracy: uniqueMetrics.length > 0 ? totalAccuracy / uniqueMetrics.length : 0,
      criticalIssues: totalCritical,
      recommendations: [...new Set(recommendations)]
    };
  }

  /**
   * Exports effectiveness data for external analysis.
   */
  static exportEffectivenessData(): string {
    const systemHealth = this.getSystemHealth();
    const allMeasurements = this.getMeasurements();
    
    return JSON.stringify({
      systemHealth,
      measurements: allMeasurements,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    }, null, 2);
  }
}