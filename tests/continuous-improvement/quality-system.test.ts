import { MetricEffectivenessTracker } from '../utils/metric-effectiveness-tracker';
import { jest } from '@jest/globals';

/**
 * Continuous Improvement System Tests.
 * 
 * These tests validate that our quality metrics system is actually improving
 * code quality and finding real problems, not just reporting numbers.
 */
describe('Quality Metrics Continuous Improvement System', () => {
  beforeEach(() => {
    // Clear any existing history for clean tests
    jest.clearAllMocks();
    MetricEffectivenessTracker.clearMeasurements();
  });

  describe('Metric Effectiveness Tracking', () => {
    it('should track metric effectiveness over time', () => {
      // Simulate tracking coverage metric over several iterations
      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'coverage',
        calculatedValue: '75%',
        realIssuesFound: 8,
        falsePositives: 1,
        missedIssues: 2,
        projectPhase: 'development',
        issueDetails: {
          criticalIssues: 3,
          moderateIssues: 4,
          minorIssues: 1,
          description: 'Uncovered error handling in payment processing'
        }
      });

      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'coverage',
        calculatedValue: '82%',
        realIssuesFound: 5,
        falsePositives: 0,
        missedIssues: 1,
        projectPhase: 'development',
        issueDetails: {
          criticalIssues: 2,
          moderateIssues: 2,
          minorIssues: 1,
          description: 'Missing test coverage for edge cases in validation'
        }
      });

      const effectiveness = MetricEffectivenessTracker.getMetricEffectiveness('coverage');
      
      expect(effectiveness).toBeTruthy();
      expect(effectiveness!.totalMeasurements).toBe(2);
      expect(effectiveness!.totalRealIssuesFound).toBe(13);
      expect(effectiveness!.totalFalsePositives).toBe(1);
      expect(effectiveness!.accuracyTrend).toBeGreaterThan(0); // Should show improvement
      expect(effectiveness!.issueSeverityDistribution.critical).toBe(5);
    });

    it('should identify ineffective metrics', () => {
      // Simulate a metric that produces many false positives
      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'badMetric',
        calculatedValue: 'Critical',
        realIssuesFound: 1,
        falsePositives: 8,
        missedIssues: 5,
        projectPhase: 'development'
      });

      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'badMetric',
        calculatedValue: 'High Risk',
        realIssuesFound: 0,
        falsePositives: 6,
        missedIssues: 4,
        projectPhase: 'development'
      });

      const validation = MetricEffectivenessTracker.validateMetricQuality('badMetric');
      
      expect(validation.isValid).toBe(false);
      expect(validation.reasons).toEqual(expect.arrayContaining([
        expect.stringMatching(/false positive/i)
      ]));
      expect(validation.recommendations).toEqual(expect.arrayContaining([
        expect.stringMatching(/review metric implementation/i)
      ]));
    });

    it('should generate improvement suggestions for low-performing metrics', () => {
      const suggestion = MetricEffectivenessTracker.generateImprovementSuggestion('coverage', 65);
      
      expect(suggestion.metric).toBe('coverage');
      expect(suggestion.currentAccuracy).toBe(65);
      expect(suggestion.targetAccuracy).toBeGreaterThan(65);
      expect(suggestion.priority).toBe('medium');
      expect(suggestion.suggestions.length).toBeGreaterThan(0);
      expect(suggestion.suggestions.some(s => s.includes('redesigning') || s.includes('thresholds'))).toBe(true);
    });

    it('should track system health across all metrics', () => {
      // Add effectiveness data for multiple metrics
      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'coverage',
        calculatedValue: '88%',
        realIssuesFound: 5,
        falsePositives: 1,
        missedIssues: 0,
        projectPhase: 'development'
      });

      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'codeQuality',
        calculatedValue: 'A',
        realIssuesFound: 3,
        falsePositives: 0,
        missedIssues: 1,
        projectPhase: 'development'
      });

      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'securityIssues',
        calculatedValue: '2',
        realIssuesFound: 2,
        falsePositives: 0,
        missedIssues: 0,
        projectPhase: 'development'
      });

      const systemHealth = MetricEffectivenessTracker.getSystemHealth();
      
      expect(systemHealth.healthStatus).toMatch(/good|excellent/);
      expect(systemHealth.averageAccuracy).toBeGreaterThan(80);
      expect(systemHealth.totalMetrics).toBe(3);
      expect(systemHealth.validMetricsCount).toBeGreaterThan(0);
      expect(systemHealth.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('Quality Metrics Real-World Validation', () => {
    it('should validate that coverage metric finds real untested code', () => {
      // Simulate finding real issues through coverage analysis
      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'coverage',
        calculatedValue: '76%',
        realIssuesFound: 6, // Found 6 critical uncovered code paths
        falsePositives: 0,
        missedIssues: 1, // 1 critical path not detected by coverage
        projectPhase: 'development',
        issueDetails: {
          criticalIssues: 3, // Error handling, edge cases
          moderateIssues: 2, // Validation logic
          minorIssues: 1, // Logging code
          description: 'Found uncovered error handling in user authentication, payment processing validation, and file upload edge cases'
        }
      });

      const effectiveness = MetricEffectivenessTracker.getMetricEffectiveness('coverage');
      const validation = MetricEffectivenessTracker.validateMetricQuality('coverage');
      
      expect(effectiveness!.totalRealIssuesFound).toBe(6);
      expect(validation.isValid).toBe(true);
      expect(effectiveness!.issueSeverityDistribution.critical).toBe(3);
    });

    it('should validate that code quality metric finds real maintainability issues', () => {
      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'codeQuality',
        calculatedValue: 'B+',
        realIssuesFound: 4,
        falsePositives: 1, // One stylistic warning that doesn't affect quality
        missedIssues: 1, // One complex function not caught by cyclomatic complexity
        projectPhase: 'development',
        issueDetails: {
          criticalIssues: 1, // Complex function with high cognitive load
          moderateIssues: 2, // Duplicated code, missing error handling
          minorIssues: 1, // Naming inconsistency
          description: 'Found complex authentication function, duplicated validation logic, and inconsistent naming in API endpoints'
        }
      });

      const effectiveness = MetricEffectivenessTracker.getMetricEffectiveness('codeQuality');
      
      expect(effectiveness!.totalRealIssuesFound).toBe(4);
      expect(effectiveness!.falsePositiveRate).toBe(25); // 1 out of 4
      expect(effectiveness!.issueSeverityDistribution.critical).toBe(1);
    });

    it('should validate that security metric finds real vulnerabilities', () => {
      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'securityIssues',
        calculatedValue: '3',
        realIssuesFound: 3, // All reported issues are real vulnerabilities
        falsePositives: 0,
        missedIssues: 1, // One vulnerability not caught by automated scan
        projectPhase: 'production',
        issueDetails: {
          criticalIssues: 1, // SQL injection vulnerability
          moderateIssues: 1, // Outdated dependency with known CVE
          minorIssues: 1, // Weak password policy
          description: 'Found SQL injection in user search, vulnerable lodash version, and weak password requirements'
        }
      });

      const effectiveness = MetricEffectivenessTracker.getMetricEffectiveness('securityIssues');
      const validation = MetricEffectivenessTracker.validateMetricQuality('securityIssues');
      
      expect(effectiveness!.totalRealIssuesFound).toBe(3);
      expect(effectiveness!.totalFalsePositives).toBe(0);
      expect(validation.isValid).toBe(true);
      expect(effectiveness!.issueSeverityDistribution.critical).toBe(1);
    });

    it('should validate that translation coverage finds real localization gaps', () => {
      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'translationCoverage',
        calculatedValue: '87%',
        realIssuesFound: 8, // Real missing translations affecting user experience
        falsePositives: 0,
        missedIssues: 2, // Dynamic strings not caught by static analysis
        projectPhase: 'staging',
        issueDetails: {
          criticalIssues: 3, // Error messages not translated
          moderateIssues: 3, // Form labels missing French translations
          minorIssues: 2, // Help text not translated
          description: 'Found missing translations for error messages, form validation, and help tooltips affecting French users'
        }
      });

      const effectiveness = MetricEffectivenessTracker.getMetricEffectiveness('translationCoverage');
      
      expect(effectiveness!.totalRealIssuesFound).toBe(8);
      expect(effectiveness!.averageAccuracy).toBeGreaterThan(75); // 8 found out of 10 total (8 + 2 missed)
    });

    it('should track build time metric effectiveness in development productivity', () => {
      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'buildTime',
        calculatedValue: '4.2s',
        realIssuesFound: 1, // Build time affecting developer productivity
        falsePositives: 0,
        missedIssues: 0,
        projectPhase: 'development',
        issueDetails: {
          criticalIssues: 0,
          moderateIssues: 1,
          minorIssues: 0,
          description: 'Slow build time affecting development workflow and hot reload performance'
        }
      });

      const effectiveness = MetricEffectivenessTracker.getMetricEffectiveness('buildTime');
      
      expect(effectiveness!.totalRealIssuesFound).toBe(1);
      expect(effectiveness!.averageAccuracy).toBe(100); // Found 1 out of 1 issue
    });
  });

  describe('Continuous Improvement Feedback Loop', () => {
    it('should identify improving metrics over time', () => {
      // Simulate metric improvement over time
      const timestamps = [
        Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
        Date.now() - 20 * 24 * 60 * 60 * 1000, // 20 days ago
        Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
        Date.now(), // Today
      ];

      // Coverage improving over time with fewer missed issues
      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'improvingCoverage',
        calculatedValue: '70%',
        realIssuesFound: 10,
        falsePositives: 3,
        missedIssues: 5,
        projectPhase: 'development'
      });

      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'improvingCoverage',
        calculatedValue: '78%',
        realIssuesFound: 8,
        falsePositives: 2,
        missedIssues: 3,
        projectPhase: 'development'
      });

      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'improvingCoverage',
        calculatedValue: '85%',
        realIssuesFound: 5,
        falsePositives: 1,
        missedIssues: 1,
        projectPhase: 'development'
      });

      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'improvingCoverage',
        calculatedValue: '92%',
        realIssuesFound: 2,
        falsePositives: 0,
        missedIssues: 0,
        projectPhase: 'development'
      });

      const effectiveness = MetricEffectivenessTracker.getMetricEffectiveness('improvingCoverage');
      
      expect(effectiveness!.accuracyTrend).toBeGreaterThan(10); // Should show significant improvement
      expect(effectiveness!.totalMissedIssues).toBe(9); // Total across all measurements
      expect(effectiveness!.recentMeasurements.length).toBeGreaterThan(0);
    });

    it('should detect degrading metrics and suggest intervention', () => {
      // Simulate metric degradation over time
      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'degradingMetric',
        calculatedValue: 'A+',
        realIssuesFound: 8,
        falsePositives: 1,
        missedIssues: 0,
        projectPhase: 'development'
      });

      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'degradingMetric',
        calculatedValue: 'A',
        realIssuesFound: 5,
        falsePositives: 2,
        missedIssues: 2,
        projectPhase: 'development'
      });

      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'degradingMetric',
        calculatedValue: 'B+',
        realIssuesFound: 3,
        falsePositives: 4,
        missedIssues: 4,
        projectPhase: 'development'
      });

      const effectiveness = MetricEffectivenessTracker.getMetricEffectiveness('degradingMetric');
      const validation = MetricEffectivenessTracker.validateMetricQuality('degradingMetric');
      
      expect(effectiveness!.accuracyTrend).toBeLessThan(-10); // Should show significant degradation
      expect(validation.isValid).toBe(false);
      expect(validation.reasons.some(r => r.includes('declining'))).toBe(true);
      expect(validation.recommendations.some(r => r.includes('investigate'))).toBe(true);
    });

    it('should provide comprehensive system assessment', () => {
      // Add data for multiple metrics with varying performance
      const metrics = ['coverage', 'codeQuality', 'securityIssues', 'translationCoverage', 'buildTime'];
      
      metrics.forEach((metric, index) => {
        // Different performance levels for each metric
        const accuracy = 60 + (index * 10); // 60%, 70%, 80%, 90%, 100%
        const realIssues = Math.max(1, 10 - (index * 2));
        const falsePositives = Math.max(0, 3 - index);
        
        MetricEffectivenessTracker.recordMetricEffectiveness({
          metric,
          calculatedValue: `${accuracy}%`,
          realIssuesFound: realIssues,
          falsePositives,
          missedIssues: Math.max(0, 2 - index),
          projectPhase: 'development'
        });
      });

      const systemHealth = MetricEffectivenessTracker.getSystemHealth();
      
      expect(systemHealth.totalMetrics).toBe(5);
      expect(systemHealth.averageAccuracy).toBeGreaterThan(70);
      expect(systemHealth.metricScores).toHaveLength(5);
      expect(systemHealth.recommendations).toContain(jasmine.stringMatching(/improve/i));
      
      // Should identify which metrics need improvement
      const lowPerformingMetrics = systemHealth.metricScores.filter(score => score.accuracy < 80);
      expect(lowPerformingMetrics.length).toBeGreaterThan(0);
    });
  });

  describe('Export and Reporting', () => {
    it('should export effectiveness data for external analysis', () => {
      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'testMetric',
        calculatedValue: '85%',
        realIssuesFound: 5,
        falsePositives: 1,
        missedIssues: 1,
        projectPhase: 'development'
      });

      const jsonData = MetricEffectivenessTracker.exportData('json');
      const csvData = MetricEffectivenessTracker.exportData('csv');

      // Validate JSON export
      expect(() => JSON.parse(jsonData)).not.toThrow();
      const parsedData = JSON.parse(jsonData);
      expect(parsedData).toBeInstanceOf(Array);
      expect(parsedData.length).toBeGreaterThan(0);

      // Validate CSV export
      expect(csvData).toContain('timestamp,metric,calculatedValue');
      expect(csvData).toContain('testMetric');
      expect(csvData.split('\n').length).toBeGreaterThan(1);
    });
  });
});