/**
 * Test Effectiveness Metrics for Koveo Gestion Quebec Property Management.
 * 
 * Tracks and analyzes test effectiveness, including prediction accuracy,
 * false positive/negative rates, and Quebec compliance validation effectiveness.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

/**
 * Represents a test effectiveness metric measurement for quality analysis.
 */
interface TestEffectivenessMetric {
  id: string;
  testSuite: string;
  metricType: 'bug_detection' | 'regression_prevention' | 'quebec_compliance' | 'accessibility' | 'performance';
  timestamp: string;
  predicted: boolean;
  actual: boolean;
  confidence: number;
  quebecSpecific: boolean;
  details: unknown;
}

/**
 * Analysis results for test effectiveness metrics.
 */
interface EffectivenessAnalysis {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  quebecComplianceAccuracy: number;
  recommendations: string[];
}

/**
 * Effectiveness metrics for a specific test suite.
 */
interface TestSuiteEffectiveness {
  suiteName: string;
  totalTests: number;
  passRate: number;
  bugDetectionRate: number;
  falsePositiveRate: number;
  quebecComplianceRate: number;
  effectiveness: EffectivenessAnalysis;
  trends: unknown[];
}

/**
 * Service for tracking and analyzing test effectiveness in Quebec property management context.
 */
export class TestEffectivenessTracker {
  private projectRoot: string;
  private metricsPath: string;
  private metrics: TestEffectivenessMetric[] = [];

  /**
   * Creates a new TestEffectivenessTracker instance.
   */
  constructor() {
    this.projectRoot = process.cwd();
    this.metricsPath = join(this.projectRoot, 'coverage', 'test-effectiveness.json');
    this.loadExistingMetrics();
  }

  /**
   * Records a test effectiveness metric with Quebec context.
   * @param testSuite
   * @param metricType
   * @param predicted
   * @param actual
   * @param confidence
   * @param quebecSpecific
   * @param details
   */
  recordMetric(
    testSuite: string,
    metricType: TestEffectivenessMetric['metricType'],
    predicted: boolean,
    actual: boolean,
    confidence: number,
    quebecSpecific: boolean = false,
    details: unknown = {
    // No action needed
  }
  ): string {
    const metric: TestEffectivenessMetric = {
      id: this.generateId(),
      testSuite,
      metricType,
      timestamp: new Date().toISOString(),
      predicted,
      actual,
      confidence,
      quebecSpecific,
      details
    };

    this.metrics.push(metric);
    this.saveMetrics();
    
    return metric.id;
  }

  /**
   * Analyzes overall test effectiveness with Quebec compliance focus.
   * @param timeRangeHours
   */
  analyzeEffectiveness(timeRangeHours: number = 168): EffectivenessAnalysis {
    const cutoffTime = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => 
      new Date(m.timestamp) > cutoffTime
    );

    if (recentMetrics.length === 0) {
      return this.getDefaultAnalysis();
    }

    // Calculate confusion matrix
    const tp = recentMetrics.filter(m => m.predicted && m.actual).length;
    const fp = recentMetrics.filter(m => m.predicted && !m.actual).length;
    const tn = recentMetrics.filter(m => !m.predicted && !m.actual).length;
    const fn = recentMetrics.filter(m => !m.predicted && m.actual).length;

    const accuracy = (tp + tn) / (tp + fp + tn + fn);
    const precision = tp > 0 ? tp / (tp + fp) : 0;
    const recall = tp > 0 ? tp / (tp + fn) : 0;
    const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

    // Quebec-specific analysis
    const quebecMetrics = recentMetrics.filter(m => m.quebecSpecific);
    const quebecComplianceAccuracy = quebecMetrics.length > 0 ?
      quebecMetrics.filter(m => m.predicted === m.actual).length / quebecMetrics.length : 1;

    const analysis: EffectivenessAnalysis = {
      accuracy: accuracy * 100,
      precision: precision * 100,
      recall: recall * 100,
      f1Score: f1Score * 100,
      truePositives: tp,
      falsePositives: fp,
      trueNegatives: tn,
      falseNegatives: fn,
      quebecComplianceAccuracy: quebecComplianceAccuracy * 100,
      recommendations: this.generateRecommendations(accuracy, precision, recall, quebecComplianceAccuracy)
    };

    return analysis;
  }

  /**
   * Analyzes effectiveness by test suite with Quebec context.
   */
  analyzeTestSuiteEffectiveness(): TestSuiteEffectiveness[] {
    const suiteGroups = this.groupMetricsByTestSuite();
    const results: TestSuiteEffectiveness[] = [];

    for (const [_suiteName, metrics] of Object.entries(suiteGroups)) {
      const totalTests = metrics.length;
      const passedTests = metrics.filter(m => m.predicted === m.actual).length;
      const bugsDetected = metrics.filter(m => m.actual && m.predicted).length;
      const falsePositives = metrics.filter(m => m.predicted && !m.actual).length;
      const quebecTests = metrics.filter(m => m.quebecSpecific).length;

      const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
      const bugDetectionRate = metrics.filter(m => m.actual).length > 0 ?
        (bugsDetected / metrics.filter(m => m.actual).length) * 100 : 0;
      const falsePositiveRate = totalTests > 0 ? (falsePositives / totalTests) * 100 : 0;
      const quebecComplianceRate = totalTests > 0 ? (quebecTests / totalTests) * 100 : 0;

      const effectiveness = this.calculateSuiteEffectiveness(metrics);
      const trends = this.calculateSuiteTrends(suiteName);

      results.push({
        suiteName,
        totalTests,
        passRate,
        bugDetectionRate,
        falsePositiveRate,
        quebecComplianceRate,
        effectiveness,
        trends
      });
    }

    return results.sort((a, b) => b.effectiveness.f1Score - a.effectiveness.f1Score);
  }

  /**
   * Tracks Quebec compliance test effectiveness specifically.
   */
  analyzeQuebecComplianceEffectiveness(): any {
    const quebecMetrics = this.metrics.filter(m => m.quebecSpecific);
    
    if (quebecMetrics.length === 0) {
      return {
        totalQuebecTests: 0,
        accuracy: 0,
        categories: {},
        recommendations: ['Ajouter des tests de conformité québécoise']
      };
    }

    // Group by Quebec compliance categories
    const categories = {
      'Loi 25': quebecMetrics.filter(m => 
        m.details.category === 'privacy' || 
        JSON.stringify(m.details).toLowerCase().includes('loi 25')
      ),
      'Taxes QC': quebecMetrics.filter(m => 
        m.details.category === 'taxation' || 
        JSON.stringify(m.details).toLowerCase().includes('tps') ||
        JSON.stringify(m.details).toLowerCase().includes('tvq')
      ),
      'Français': quebecMetrics.filter(m => 
        m.details.category === 'language' || 
        JSON.stringify(m.details).toLowerCase().includes('français')
      ),
      'Règlements': quebecMetrics.filter(m => 
        m.details.category === 'regulations' ||
        JSON.stringify(m.details).toLowerCase().includes('règlement')
      )
    };

    const categoryAnalysis: unknown = {
    // No action needed
  };
    for (const [_category, metrics] of Object.entries(categories)) {
      if (metrics.length > 0) {
        const accuracy = metrics.filter(m => m.predicted === m.actual).length / metrics.length;
        categoryAnalysis[category] = {
          count: metrics.length,
          accuracy: accuracy * 100,
          effectiveTests: metrics.filter(m => m.predicted === m.actual).length
        };
      }
    }

    const overallAccuracy = quebecMetrics.filter(m => m.predicted === m.actual).length / quebecMetrics.length;
    
    return {
      totalQuebecTests: quebecMetrics.length,
      accuracy: overallAccuracy * 100,
      categories: categoryAnalysis,
      recommendations: this.generateQuebecRecommendations(categoryAnalysis, overallAccuracy)
    };
  }

  /**
   * Generates comprehensive effectiveness report.
   */
  generateEffectivenessReport(): any {
    const overallAnalysis = this.analyzeEffectiveness();
    const suiteAnalysis = this.analyzeTestSuiteEffectiveness();
    const quebecAnalysis = this.analyzeQuebecComplianceEffectiveness();
    const trends = this.calculateEffectivenessTrends();

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalMetrics: this.metrics.length,
        overallAccuracy: overallAnalysis.accuracy,
        quebecComplianceAccuracy: quebecAnalysis.accuracy,
        topPerformingSuite: suiteAnalysis[0]?.suiteName || 'N/A',
        needsImprovement: suiteAnalysis.filter(s => s.effectiveness.f1Score < 80).length
      },
      overall: overallAnalysis,
      testSuites: suiteAnalysis,
      quebecCompliance: quebecAnalysis,
      trends,
      recommendations: this.generateComprehensiveRecommendations(overallAnalysis, quebecAnalysis)
    };

    // Save report
    const reportPath = join(this.projectRoot, 'coverage', 'test-effectiveness-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return report;
  }

  /**
   * Records a bug detection event for effectiveness tracking.
   * @param testSuite
   * @param bugType
   * @param severity
   * @param detectedByTest
   * @param quebecRelated
   * @param details
   */
  recordBugDetection(
    testSuite: string,
    bugType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    detectedByTest: boolean,
    quebecRelated: boolean = false,
    details: unknown = {
    // No action needed
  }
  ): void {
    this.recordMetric(
      testSuite,
      'bug_detection',
      detectedByTest,
      true, // actual bug exists
      severity === 'critical' ? 100 : severity === 'high' ? 80 : severity === 'medium' ? 60 : 40,
      quebecRelated,
      { bugType, severity, ...details }
    );
  }

  /**
   * Records a regression prevention event.
   * @param testSuite
   * @param featureArea
   * @param preventedRegression
   * @param quebecFeature
   * @param details
   */
  recordRegressionPrevention(
    testSuite: string,
    featureArea: string,
    preventedRegression: boolean,
    quebecFeature: boolean = false,
    details: unknown = {}
  ): void {
    this.recordMetric(
      testSuite,
      'regression_prevention',
      preventedRegression,
      true, // regression would have occurred
      preventedRegression ? 90 : 20,
      quebecFeature,
      { featureArea, ...details }
    );
  }

  /**
   * Records Quebec compliance validation effectiveness.
   * @param testSuite
   * @param complianceType
   * @param validationPassed
   * @param actualCompliance
   * @param details
   */
  recordQuebecComplianceValidation(
    testSuite: string,
    complianceType: 'privacy' | 'language' | 'taxation' | 'regulations',
    validationPassed: boolean,
    actualCompliance: boolean,
    details: unknown = {}
  ): void {
    this.recordMetric(
      testSuite,
      'quebec_compliance',
      validationPassed,
      actualCompliance,
      85,
      true,
      { complianceType, ...details }
    );
  }

  // Private helper methods

  /**
   *
   */
  private loadExistingMetrics(): void {
    if (existsSync(this.metricsPath)) {
      try {
        const data = readFileSync(this.metricsPath, 'utf8');
        this.metrics = JSON.parse(_data);
      } catch (_error) {
        console.warn('Failed to load existing metrics, starting fresh');
        this.metrics = [];
      }
    }
  }

  /**
   *
   */
  private saveMetrics(): void {
    writeFileSync(this.metricsPath, JSON.stringify(this.metrics, null, 2));
  }

  /**
   *
   */
  private generateId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   *
   */
  private getDefaultAnalysis(): EffectivenessAnalysis {
    return {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      truePositives: 0,
      falsePositives: 0,
      trueNegatives: 0,
      falseNegatives: 0,
      quebecComplianceAccuracy: 0,
      recommendations: ['Commencer à enregistrer des métriques d\'efficacité des tests']
    };
  }

  /**
   *
   */
  private groupMetricsByTestSuite(): Record<string, TestEffectivenessMetric[]> {
    const groups: Record<string, TestEffectivenessMetric[]> = {};
    
    for (const metric of this.metrics) {
      if (!groups[metric.testSuite]) {
        groups[metric.testSuite] = [];
      }
      groups[metric.testSuite].push(metric);
    }
    
    return groups;
  }

  /**
   *
   * @param metrics
   */
  private calculateSuiteEffectiveness(metrics: TestEffectivenessMetric[]): EffectivenessAnalysis {
    if (metrics.length === 0) {
      return this.getDefaultAnalysis();
    }

    const tp = metrics.filter(m => m.predicted && m.actual).length;
    const fp = metrics.filter(m => m.predicted && !m.actual).length;
    const tn = metrics.filter(m => !m.predicted && !m.actual).length;
    const fn = metrics.filter(m => !m.predicted && m.actual).length;

    const accuracy = (tp + tn) / (tp + fp + tn + fn);
    const precision = tp > 0 ? tp / (tp + fp) : 0;
    const recall = tp > 0 ? tp / (tp + fn) : 0;
    const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

    const quebecMetrics = metrics.filter(m => m.quebecSpecific);
    const quebecComplianceAccuracy = quebecMetrics.length > 0 ?
      quebecMetrics.filter(m => m.predicted === m.actual).length / quebecMetrics.length : 1;

    return {
      accuracy: accuracy * 100,
      precision: precision * 100,
      recall: recall * 100,
      f1Score: f1Score * 100,
      truePositives: tp,
      falsePositives: fp,
      trueNegatives: tn,
      falseNegatives: fn,
      quebecComplianceAccuracy: quebecComplianceAccuracy * 100,
      recommendations: this.generateRecommendations(accuracy, precision, recall, quebecComplianceAccuracy)
    };
  }

  /**
   *
   * @param suiteName
   */
  private calculateSuiteTrends(suiteName: string): unknown[] {
    const suiteMetrics = this.metrics.filter(m => m.testSuite === suiteName);
    const trends = [];
    
    // Group by week for trend analysis
    const weeklyGroups: Record<string, TestEffectivenessMetric[]> = {};
    
    for (const metric of suiteMetrics) {
      const week = this.getWeekKey(new Date(metric.timestamp));
      if (!weeklyGroups[week]) {
        weeklyGroups[week] = [];
      }
      weeklyGroups[week].push(metric);
    }
    
    for (const [_week, metrics] of Object.entries(weeklyGroups)) {
      const accuracy = metrics.filter(m => m.predicted === m.actual).length / metrics.length;
      trends.push({
        week,
        accuracy: accuracy * 100,
        totalTests: metrics.length,
        quebecTests: metrics.filter(m => m.quebecSpecific).length
      });
    }
    
    return trends.sort((a, b) => a.week.localeCompare(b.week));
  }

  /**
   *
   */
  private calculateEffectivenessTrends(): unknown[] {
    const trends = [];
    const monthlyGroups: Record<string, TestEffectivenessMetric[]> = {};
    
    for (const metric of this.metrics) {
      const month = this.getMonthKey(new Date(metric.timestamp));
      if (!monthlyGroups[month]) {
        monthlyGroups[month] = [];
      }
      monthlyGroups[month].push(metric);
    }
    
    for (const [_month, metrics] of Object.entries(monthlyGroups)) {
      const accuracy = metrics.filter(m => m.predicted === m.actual).length / metrics.length;
      const quebecAccuracy = metrics.filter(m => m.quebecSpecific && m.predicted === m.actual).length / 
                            metrics.filter(m => m.quebecSpecific).length || 0;
      
      trends.push({
        month,
        overallAccuracy: accuracy * 100,
        quebecAccuracy: quebecAccuracy * 100,
        totalMetrics: metrics.length,
        quebecMetrics: metrics.filter(m => m.quebecSpecific).length
      });
    }
    
    return trends.sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   *
   * @param accuracy
   * @param precision
   * @param recall
   * @param quebecAccuracy
   */
  private generateRecommendations(
    accuracy: number,
    precision: number,
    recall: number,
    quebecAccuracy: number
  ): string[] {
    const recommendations = [];
    
    if (accuracy < 0.8) {
      recommendations.push('Améliorer la précision générale des tests');
    }
    
    if (precision < 0.75) {
      recommendations.push('Réduire les faux positifs dans les tests');
    }
    
    if (recall < 0.75) {
      recommendations.push('Améliorer la détection des vrais problèmes');
    }
    
    if (quebecAccuracy < 0.9) {
      recommendations.push('Renforcer les tests de conformité québécoise');
    }
    
    return recommendations;
  }

  /**
   *
   * @param categoryAnalysis
   * @param overallAccuracy
   */
  private generateQuebecRecommendations(categoryAnalysis: any, overallAccuracy: number): string[] {
    const recommendations = [];
    
    if (overallAccuracy < 0.9) {
      recommendations.push('Améliorer la couverture globale des tests québécois');
    }
    
    for (const [_category, analysis] of Object.entries(categoryAnalysis)) {
      if ((analysis as any).accuracy < 85) {
        recommendations.push(`Améliorer les tests pour: ${category}`);
      }
    }
    
    if (!categoryAnalysis['Loi 25'] || categoryAnalysis['Loi 25'].count < 5) {
      recommendations.push('Ajouter plus de tests de conformité Loi 25');
    }
    
    if (!categoryAnalysis['Taxes QC'] || categoryAnalysis['Taxes QC'].count < 3) {
      recommendations.push('Ajouter des tests pour les calculs de taxes québécoises');
    }
    
    return recommendations;
  }

  /**
   *
   * @param overall
   * @param quebec
   */
  private generateComprehensiveRecommendations(overall: EffectivenessAnalysis, quebec: unknown): string[] {
    const recommendations = [...overall.recommendations];
    
    if (quebec.recommendations) {
      recommendations.push(...quebec.recommendations);
    }
    
    // Add specific action items
    if (overall.falsePositives > overall.truePositives) {
      recommendations.push('Priorité: réduire les faux positifs pour améliorer la confiance');
    }
    
    if (overall.falseNegatives > overall.truePositives * 0.2) {
      recommendations.push('Priorité: améliorer la détection pour réduire les faux négatifs');
    }
    
    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   *
   * @param date
   */
  private getWeekKey(date: Date): string {
    const year = date.getFullYear();
    const week = Math.ceil((date.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    return `${year}-W${week.toString().padStart(2, '0')}`;
  }

  /**
   *
   * @param date
   */
  private getMonthKey(date: Date): string {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  }
}

// Export singleton instance
export const testEffectivenessTracker = new TestEffectivenessTracker();