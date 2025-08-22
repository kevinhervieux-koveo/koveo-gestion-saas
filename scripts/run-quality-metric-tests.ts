#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { MetricEffectivenessTracker } from '../tests/utils/metric-effectiveness-tracker';

/**
 * Automated Quality Metrics Testing and Effectiveness Tracking Script.
 * 
 * This script runs comprehensive tests on all quality metrics to ensure they:
 * 1. Calculate correctly
 * 2. Find real problems (not just report numbers)
 * 3. Track effectiveness over time
 * 4. Provide actionable insights for improvement.
 */

/**
 * Interface for quality test results.
 */
interface QualityTestResult {
  success: boolean;
  testsPassed: number;
  testsTotal: number;
  errors: string[];
  coverage?: number;
}

/**
 * Runs quality metrics tests and validates their effectiveness.
 */
/**
 * RunQualityMetricTests function.
 * @returns Function result.
 */
async function runQualityMetricTests(): Promise<QualityTestResult> {
  const _result: QualityTestResult = {
    success: false,
    testsPassed: 0,
    testsTotal: 0,
    errors: [],
  };

  console.warn('🔍 Running Quality Metrics Tests...\n');

  try {
    // Run unit tests for quality metrics
    console.warn('📊 Testing Quality Metrics Calculation Logic...');
    const unitTestResult = execSync(
      'npm test tests/unit/quality-metrics.test.ts -- --verbose',
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    
    console.warn('✅ Unit tests passed');

    // Run integration tests for quality metrics API
    console.warn('\n🌐 Testing Quality Metrics API Integration...');
    const integrationTestResult = execSync(
      'npm test tests/integration/quality-metrics-api.test.ts -- --verbose',
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    
    console.warn('✅ Integration tests passed');

    // Run continuous improvement tests
    console.warn('\n🔄 Testing Continuous Improvement System...');
    const improvementTestResult = execSync(
      'npm test tests/continuous-improvement/quality-system.test.ts -- --verbose',
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    
    console.warn('✅ Continuous improvement tests passed');

    // Parse test results (simplified parsing)
    const allResults = [unitTestResult, integrationTestResult, improvementTestResult].join('\n');
    const passMatches = allResults.match(/(\d+) passing/g) || [];
    const failMatches = allResults.match(/(\d+) failing/g) || [];
    
    result.testsPassed = passMatches.reduce((sum, _match) => {
      const num = parseInt(match.match(/\d+/)?.[0] || '0');
      return sum + num;
    }, 0);

    const testsFailed = failMatches.reduce((sum, _match) => {
      const num = parseInt(match.match(/\d+/)?.[0] || '0');
      return sum + num;
    }, 0);

    result.testsTotal = result.testsPassed + testsFailed;
    result.success = testsFailed === 0;

    console.warn(`\n📈 Quality Metrics Tests Summary:`);
    console.warn(`   Tests Passed: ${result.testsPassed}`);
    console.warn(`   Tests Total: ${result.testsTotal}`);
    console.warn(`   Success Rate: ${result.testsTotal > 0 ? Math.round((result.testsPassed / result.testsTotal) * 100) : 0}%`);

  } catch (_error) {
    result.errors.push(`Test execution failed: ${error}`);
    console.error('❌ Quality metrics tests failed:', _error);
  }

  return result;
}

/**
 * Validates the effectiveness of the quality metrics system.
 */
/**
 * ValidateSystemEffectiveness function.
 * @returns Function result.
 */
async function validateSystemEffectiveness(): Promise<void> {
  console.warn('\n🎯 Validating Quality Metrics System Effectiveness...\n');

  // Load historical effectiveness data
  MetricEffectivenessTracker.loadHistory();
  
  const systemHealth = MetricEffectivenessTracker.getSystemHealth();
  
  console.warn(`System Health Status: ${systemHealth.healthStatus.toUpperCase()}`);
  console.warn(`Average Accuracy: ${systemHealth.averageAccuracy.toFixed(1)}%`);
  console.warn(`Valid Metrics: ${systemHealth.validMetricsCount}/${systemHealth.totalMetrics}`);
  console.warn(`Total Measurements: ${systemHealth.totalMeasurements}`);

  if (systemHealth.metricScores.length > 0) {
    console.warn('\n📊 Individual Metric Performance:');
    systemHealth.metricScores.forEach(score => {
      const status = score.isValid ? '✅' : '❌';
      console.warn(`   ${status} ${score.metric}: ${score.accuracy.toFixed(1)}% accuracy (${score.measurementCount} measurements)`);
    });
  }

  if (systemHealth.recommendations.length > 0) {
    console.warn('\n💡 Recommendations:');
    systemHealth.recommendations.forEach(rec => {
      console.warn(`   • ${rec}`);
    });
  }

  // Validate each metric individually
  const criticalMetrics = ['coverage', 'codeQuality', 'securityIssues', 'translationCoverage'];
  let criticalIssues = 0;

  console.warn('\n🔍 Critical Metrics Validation:');
  criticalMetrics.forEach(metric => {
    const effectiveness = MetricEffectivenessTracker.getMetricEffectiveness(metric);
    const validation = MetricEffectivenessTracker.validateMetricQuality(metric);
    
    if (effectiveness) {
      const status = validation.isValid ? '✅' : '❌';
      console.warn(`   ${status} ${metric}: ${effectiveness.averageAccuracy.toFixed(1)}% accuracy`);
      
      if (!validation.isValid) {
        criticalIssues++;
        console.warn(`      Issues: ${validation.reasons.join(', ')}`);
        if (validation.recommendations.length > 0) {
          console.warn(`      Recommendations: ${validation.recommendations[0]}`);
        }
      }
    } else {
      console.warn(`   ⚠️  ${metric}: No effectiveness data available`);
    }
  });

  if (criticalIssues > 0) {
    console.warn(`\n⚠️  Found ${criticalIssues} critical metric issues that need attention`);
  } else {
    console.warn('\n🎉 All critical metrics are performing well');
  }
}

/**
 * Records current quality metrics for effectiveness tracking.
 */
/**
 * RecordCurrentMetrics function.
 * @returns Function result.
 */
async function recordCurrentMetrics(): Promise<void> {
  console.warn('\n📋 Recording Current Quality Metrics for Effectiveness Tracking...\n');

  try {
    // Fetch current quality metrics from the API (if running)
    // For now, we'll simulate this or get from actual calculation

    // You could make an HTTP request to the running app here:
    // const response = await fetch('http://localhost:5000/api/quality-metrics');
    // const currentMetrics = await response.json();

    // For now, simulate recording effectiveness data
    // In production, you would collect real data about issues found vs. false positives
    
    console.warn('📊 Simulating effectiveness tracking data...');
    console.warn('   (In production, this would track real issues found by each metric)');
    
    // Example: If you found that coverage metric identified 5 real uncovered critical paths
    // and had 1 false positive this iteration:
    // MetricEffectivenessTracker.recordMetricEffectiveness({
    //   metric: 'coverage',
    //   calculatedValue: '85%',
    //   realIssuesFound: 5,
    //   falsePositives: 1,
    //   missedIssues: 0,
    //   projectPhase: 'development',
    //   issueDetails: {
    //     criticalIssues: 3,
    //     moderateIssues: 2,
    //     minorIssues: 0,
    //     description: 'Found uncovered error handling in authentication and payment processing'
    //   }
    // });

    console.warn('✅ Effectiveness tracking setup ready');
    
  } catch (_error) {
    console.error('❌ Failed to record current metrics:', _error);
  }
}

/**
 * Main execution function.
 */
/**
 * Main function.
 * @returns Function result.
 */
async function main(): Promise<void> {
  console.warn('🚀 Quality Metrics Testing & Effectiveness Validation\n');
  console.warn('This script validates that our quality metrics actually find real problems\n');

  const startTime = Date.now();

  try {
    // Step 1: Run quality metrics tests
    const testResult = await runQualityMetricTests();
    
    if (!testResult.success) {
      console.error('\n❌ Quality metrics tests failed. System may have issues.');
      process.exit(1);
    }

    // Step 2: Validate system effectiveness
    await validateSystemEffectiveness();

    // Step 3: Record current metrics for tracking
    await recordCurrentMetrics();

    // Step 4: Final summary
    const duration = Date.now() - startTime;
    console.warn(`\n🎯 Quality Metrics Validation Complete`);
    console.warn(`   Duration: ${(duration / 1000).toFixed(1)}s`);
    console.warn(`   Tests: ${testResult.testsPassed}/${testResult.testsTotal} passed`);
    console.warn(`   Status: ${testResult.success ? '✅ All systems operational' : '❌ Issues detected'}`);

    console.warn('\n📚 Next Steps:');
    console.warn('   • Monitor metric effectiveness over time');
    console.warn('   • Address any low-performing metrics');
    console.warn('   • Continue tracking real issues vs false positives');
    console.warn('   • Run this validation regularly as part of CI/CD');

  } catch (_error) {
    console.error('\n💥 Quality metrics validation failed:', _error);
    process.exit(1);
  }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal _error:', _error);
    process.exit(1);
  });
}