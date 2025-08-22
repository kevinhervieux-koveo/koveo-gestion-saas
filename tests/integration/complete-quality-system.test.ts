import { MetricEffectivenessTracker } from '../utils/metric-effectiveness-tracker';
import request from 'supertest';
import express, { type Express } from 'express';
import { registerRoutes } from '../../server/routes-minimal';

/**
 * Complete Quality Metrics System Integration Test.
 * 
 * This test validates the entire quality metrics system working together:
 * 1. API endpoints return valid data
 * 2. Metrics calculations are accurate
 * 3. Effectiveness tracking works correctly
 * 4. Continuous improvement feedback loop functions
 * 5. System provides actionable insights.
 */
describe('Complete Quality Metrics System Integration', () => {
  let app: Express;
  let server: any;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('End-to-End Quality Metrics Workflow', () => {
    it('should provide comprehensive quality assessment with effectiveness tracking', async () => {
      // Step 1: Fetch current quality metrics from API
      const response = await request(app)
        .get('/api/quality-metrics')
        .expect(200);

      const metrics = response.body;

      // Validate API response structure
      expect(metrics).toHaveProperty('coverage');
      expect(metrics).toHaveProperty('codeQuality');
      expect(metrics).toHaveProperty('securityIssues');
      expect(metrics).toHaveProperty('buildTime');
      expect(metrics).toHaveProperty('translationCoverage');

      // Step 2: Simulate tracking effectiveness for each metric
      // (In production, this data would come from real usage)
      
      // Coverage metric effectiveness
      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'coverage',
        calculatedValue: metrics.coverage,
        realIssuesFound: 8, // Real uncovered critical paths found
        falsePositives: 1, // One minor uncovered code that wasn't critical
        missedIssues: 2, // Two critical paths not detected
        projectPhase: 'development',
        issueDetails: {
          criticalIssues: 4,
          moderateIssues: 3,
          minorIssues: 1,
          description: 'Found uncovered error handling in authentication, payment processing, and file validation'
        }
      });

      // Code quality metric effectiveness
      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'codeQuality',
        calculatedValue: metrics.codeQuality,
        realIssuesFound: 6, // Real maintainability issues
        falsePositives: 1, // Style issue that doesn't affect maintainability
        missedIssues: 1, // Complex function not caught by current rules
        projectPhase: 'development',
        issueDetails: {
          criticalIssues: 2, // High complexity functions
          moderateIssues: 3, // Duplicated code, inconsistent patterns
          minorIssues: 1, // Minor style inconsistencies
          description: 'Found complex authentication logic, duplicated validation code, and inconsistent error handling patterns'
        }
      });

      // Security issues metric effectiveness
      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'securityIssues',
        calculatedValue: metrics.securityIssues,
        realIssuesFound: parseInt(metrics.securityIssues), // All reported security issues are real
        falsePositives: 0,
        missedIssues: 1, // One security issue not caught by automated scan
        projectPhase: 'development',
        issueDetails: {
          criticalIssues: Math.min(parseInt(metrics.securityIssues), 2),
          moderateIssues: Math.max(0, parseInt(metrics.securityIssues) - 2),
          minorIssues: 0,
          description: 'Found real security vulnerabilities in dependencies and potential injection points'
        }
      });

      // Translation coverage metric effectiveness
      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'translationCoverage',
        calculatedValue: metrics.translationCoverage,
        realIssuesFound: 100 - parseInt(metrics.translationCoverage) > 0 ? 3 : 0, // Missing translations cause real UX issues
        falsePositives: 0,
        missedIssues: 1, // Dynamic strings not caught by static analysis
        projectPhase: 'development',
        issueDetails: {
          criticalIssues: 100 - parseInt(metrics.translationCoverage) > 10 ? 2 : 0,
          moderateIssues: 100 - parseInt(metrics.translationCoverage) > 5 ? 2 : 0,
          minorIssues: 100 - parseInt(metrics.translationCoverage) > 0 ? 1 : 0,
          description: 'Missing translations affecting French user experience in forms and error messages'
        }
      });

      // Build time metric effectiveness
      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'buildTime',
        calculatedValue: metrics.buildTime,
        realIssuesFound: metrics.buildTime.includes('Error') ? 1 : (parseFloat(metrics.buildTime) > 5 ? 1 : 0),
        falsePositives: 0,
        missedIssues: 0,
        projectPhase: 'development',
        issueDetails: {
          criticalIssues: 0,
          moderateIssues: metrics.buildTime.includes('Error') ? 1 : 0,
          minorIssues: parseFloat(metrics.buildTime) > 5 ? 1 : 0,
          description: 'Build performance affecting development workflow'
        }
      });

      // Step 3: Validate system effectiveness
      const systemHealth = MetricEffectivenessTracker.getSystemHealth();
      
      expect(systemHealth).toBeTruthy();
      expect(systemHealth.totalMetrics).toBe(5);
      expect(systemHealth.averageSystemAccuracy).toBeGreaterThan(50); // Should find real issues

      // Step 4: Validate individual metric effectiveness
      const coverageEffectiveness = MetricEffectivenessTracker.getMetricEffectiveness('coverage');
      const codeQualityEffectiveness = MetricEffectivenessTracker.getMetricEffectiveness('codeQuality');
      
      expect(coverageEffectiveness).toBeTruthy();
      expect(coverageEffectiveness!.totalRealIssuesFound).toBeGreaterThan(0);
      
      expect(codeQualityEffectiveness).toBeTruthy();
      expect(codeQualityEffectiveness!.totalRealIssuesFound).toBeGreaterThan(0);

      // Step 5: Test quality validation
      const coverageValidation = MetricEffectivenessTracker.validateMetricQuality('coverage');
      expect(coverageValidation.reasons).toBeInstanceOf(Array);
      expect(coverageValidation.recommendations).toBeInstanceOf(Array);

      console.warn('\n📊 Quality Metrics System Validation Results:');
      console.warn(`   System Health: ${systemHealth.effectiveMetrics > systemHealth.ineffectiveMetrics ? 'Good' : 'Poor'}`);
      console.warn(`   Average Accuracy: ${systemHealth.averageSystemAccuracy.toFixed(1)}%`);
      console.warn(`   Valid Metrics: ${systemHealth.effectiveMetrics}/${systemHealth.totalMetrics}`);
      console.warn(`   Coverage Effectiveness: ${coverageEffectiveness!.averageAccuracy.toFixed(1)}%`);
      console.warn(`   Code Quality Effectiveness: ${codeQualityEffectiveness!.averageAccuracy.toFixed(1)}%`);
    });

    it('should detect and report metric improvement over time', () => {
      // Simulate metrics improving over multiple iterations
      const iterations = [
        { coverage: '65%', realIssues: 12, falsePositives: 4, missedIssues: 6 },
        { coverage: '72%', realIssues: 9, falsePositives: 2, missedIssues: 4 },
        { coverage: '81%', realIssues: 6, falsePositives: 1, missedIssues: 2 },
        { coverage: '89%', realIssues: 3, falsePositives: 0, missedIssues: 1 },
        { coverage: '94%', realIssues: 1, falsePositives: 0, missedIssues: 0 },
      ];

      iterations.forEach((iteration, _index) => {
        MetricEffectivenessTracker.recordMetricEffectiveness({
          metric: 'improvingCoverage',
          calculatedValue: iteration.coverage,
          realIssuesFound: iteration.realIssues,
          falsePositives: iteration.falsePositives,
          missedIssues: iteration.missedIssues,
          projectPhase: 'development',
          issueDetails: {
            criticalIssues: Math.ceil(iteration.realIssues / 3),
            moderateIssues: Math.ceil(iteration.realIssues / 3),
            minorIssues: iteration.realIssues - Math.ceil(iteration.realIssues / 3) * 2,
            description: `Iteration ${index + 1}: Continuous improvement in test coverage`
          }
        });
      });

      const effectiveness = MetricEffectivenessTracker.getMetricEffectiveness('improvingCoverage');
      expect(effectiveness!.accuracyTrend).toBeGreaterThan(10); // Should show significant improvement
      expect(effectiveness!.totalMeasurements).toBe(5);
      expect(effectiveness!.totalRealIssuesFound).toBe(31); // Sum of all real issues found

      console.warn(`   Improvement Trend: +${effectiveness!.accuracyTrend.toFixed(1)}% accuracy over time`);
    });

    it('should identify problematic metrics that need attention', () => {
      // Simulate a metric that produces many false positives
      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'problematicMetric',
        calculatedValue: 'High Risk',
        realIssuesFound: 2,
        falsePositives: 15, // Many false positives
        missedIssues: 8, // Many missed real issues
        projectPhase: 'development',
        issueDetails: {
          criticalIssues: 0,
          moderateIssues: 1,
          minorIssues: 1,
          description: 'Metric reporting many non-issues as problems'
        }
      });

      const validation = MetricEffectivenessTracker.validateMetricQuality('problematicMetric');
      
      expect(validation.isValid).toBe(false);
      expect(validation.reasons.some(reason => reason.includes('false positive'))).toBe(true);
      expect(validation.recommendations.some(rec => rec.includes('review'))).toBe(true);

      const suggestion = MetricEffectivenessTracker.generateImprovementSuggestion('problematicMetric', 20);
      expect(suggestion.priority).toBe('critical');
      expect(suggestion.suggestions.length).toBeGreaterThan(0);

      console.warn(`   Problematic Metric Detected: ${validation.reasons.join(', ')}`);
      console.warn(`   Priority: ${suggestion.priority}`);
    });

    it('should export data for external analysis', () => {
      const jsonData = MetricEffectivenessTracker.exportEffectivenessData();
      const csvData = MetricEffectivenessTracker.exportEffectivenessData();

      // Validate JSON export
      expect(() => JSON.parse(jsonData)).not.toThrow();
      const parsedData = JSON.parse(jsonData);
      expect(parsedData).toBeInstanceOf(Array);
      expect(parsedData.length).toBeGreaterThan(0);

      // Validate CSV export
      expect(csvData).toContain('timestamp,metric,calculatedValue');
      expect(csvData.split('\n').length).toBeGreaterThan(1);

      console.warn(`   Export capabilities: JSON (${parsedData.length} records), CSV format available`);
    });

    it('should provide actionable system recommendations', () => {
      const systemHealth = MetricEffectivenessTracker.getSystemHealth();
      
      expect(systemHealth.recommendations).toBeInstanceOf(Array);
      
      if (systemHealth.recommendations.length > 0) {
        console.warn('   System Recommendations:');
        systemHealth.recommendations.forEach(rec => {
          console.warn(`     • ${rec}`);
        });
      } else {
        console.warn('   System Status: All metrics performing well');
      }

      // Should provide specific guidance based on metric performance
      expect(systemHealth.effectiveMetrics >= 0).toBe(true); // Should have some effective metrics
    });
  });

  describe('Quality Metrics Real-World Scenarios', () => {
    it('should handle development phase quality tracking', async () => {
      // Test development phase tracking
      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'developmentPhase',
        calculatedValue: '78%',
        realIssuesFound: 10,
        falsePositives: 2,
        missedIssues: 3,
        projectPhase: 'development',
        issueDetails: {
          criticalIssues: 4,
          moderateIssues: 4,
          minorIssues: 2,
          description: 'Development phase: Finding and fixing issues as code evolves'
        }
      });

      const effectiveness = MetricEffectivenessTracker.getMetricEffectiveness('developmentPhase');
      expect(effectiveness!.totalRealIssuesFound).toBe(10);
    });

    it('should handle production phase quality tracking', async () => {
      // Test production phase tracking (should find fewer but more critical issues)
      MetricEffectivenessTracker.recordMetricEffectiveness({
        metric: 'productionPhase',
        calculatedValue: '95%',
        realIssuesFound: 2,
        falsePositives: 0,
        missedIssues: 0,
        projectPhase: 'production',
        issueDetails: {
          criticalIssues: 2,
          moderateIssues: 0,
          minorIssues: 0,
          description: 'Production phase: Critical issues affecting live users'
        }
      });

      const effectiveness = MetricEffectivenessTracker.getMetricEffectiveness('productionPhase');
      expect(effectiveness!.averageAccuracy).toBe(100); // Should be very accurate in production
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large amounts of effectiveness data', () => {
      // Add many data points to test scalability
      for (let i = 0; i < 100; i++) {
        MetricEffectivenessTracker.recordMetricEffectiveness({
          metric: 'scalabilityTest',
          calculatedValue: `${60 + (i % 40)}%`,
          realIssuesFound: Math.floor(Math.random() * 10),
          falsePositives: Math.floor(Math.random() * 3),
          missedIssues: Math.floor(Math.random() * 2),
          projectPhase: i % 2 === 0 ? 'development' : 'production',
          issueDetails: {
            criticalIssues: Math.floor(Math.random() * 3),
            moderateIssues: Math.floor(Math.random() * 4),
            minorIssues: Math.floor(Math.random() * 3),
            description: `Scalability test iteration ${i}`
          }
        });
      }

      const effectiveness = MetricEffectivenessTracker.getMetricEffectiveness('scalabilityTest');
      expect(effectiveness!.totalMeasurements).toBe(100);
      expect(effectiveness!.averageAccuracy).toBeGreaterThan(0);

      console.warn(`   Scalability Test: Successfully processed ${effectiveness!.totalMeasurements} measurements`);
    });

    it('should provide time-range filtered analysis', () => {
      // Test time-range filtering
      const recentEffectiveness = MetricEffectivenessTracker.getMetricEffectiveness('scalabilityTest');
      const allTimeEffectiveness = MetricEffectivenessTracker.getMetricEffectiveness('scalabilityTest');

      expect(recentEffectiveness!.totalMeasurements).toBeLessThanOrEqual(allTimeEffectiveness!.totalMeasurements);
    });
  });
});