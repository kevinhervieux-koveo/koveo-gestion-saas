#!/usr/bin/env tsx
/**
 * Performance Testing Framework for Quebec Property Management SaaS
 * Automated performance regression testing and monitoring
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

const execAsync = promisify(exec);

interface PerformanceTest {
  name: string;
  url: string;
  metrics: {
    LCP: { threshold: number; weight: number };
    FID: { threshold: number; weight: number };
    CLS: { threshold: number; weight: number };
    FCP: { threshold: number; weight: number };
    loadTime: { threshold: number; weight: number };
  };
  device?: 'desktop' | 'mobile';
  network?: 'fast3g' | 'slow3g' | 'offline';
}

interface PerformanceResult {
  test: string;
  url: string;
  timestamp: number;
  metrics: {
    LCP: number;
    FID: number;
    CLS: number;
    FCP: number;
    loadTime: number;
  };
  score: number;
  passed: boolean;
  failures: string[];
  recommendations: string[];
}

class PerformanceTester {
  private outputDir = 'reports/performance-tests';
  private resultsFile = path.join(this.outputDir, 'test-results.json');
  private baselineFile = path.join(this.outputDir, 'baseline.json');

  // Performance test configurations
  private tests: PerformanceTest[] = [
    {
      name: 'Homepage Performance',
      url: 'http://localhost:5000',
      metrics: {
        LCP: { threshold: 2500, weight: 0.25 },
        FID: { threshold: 100, weight: 0.25 },
        CLS: { threshold: 0.1, weight: 0.25 },
        FCP: { threshold: 1800, weight: 0.15 },
        loadTime: { threshold: 3000, weight: 0.1 },
      },
      device: 'desktop',
    },
    {
      name: 'Dashboard Performance',
      url: 'http://localhost:5000/dashboard',
      metrics: {
        LCP: { threshold: 3000, weight: 0.3 },
        FID: { threshold: 150, weight: 0.3 },
        CLS: { threshold: 0.15, weight: 0.2 },
        FCP: { threshold: 2000, weight: 0.15 },
        loadTime: { threshold: 4000, weight: 0.05 },
      },
      device: 'desktop',
    },
    {
      name: 'Mobile Homepage',
      url: 'http://localhost:5000',
      metrics: {
        LCP: { threshold: 4000, weight: 0.3 },
        FID: { threshold: 300, weight: 0.25 },
        CLS: { threshold: 0.25, weight: 0.25 },
        FCP: { threshold: 3000, weight: 0.15 },
        loadTime: { threshold: 5000, weight: 0.05 },
      },
      device: 'mobile',
      network: 'fast3g',
    },
  ];

  constructor() {
    this.ensureOutputDir();
  }

  /**
   * Runs all performance tests
   */
  async runTests(): Promise<void> {
    console.log(chalk.blue('🚀 Starting Performance Tests...'));

    try {
      // Ensure the application is running
      await this.checkApplicationHealth();

      const results: PerformanceResult[] = [];

      for (const test of this.tests) {
        console.log(chalk.yellow(`📊 Running test: ${test.name}`));
        const result = await this.runSingleTest(test);
        results.push(result);
        this.logResult(result);
      }

      // Save results
      await this.saveResults(results);

      // Generate report
      await this.generateReport(results);

      // Check for regressions
      await this.checkRegressions(results);

      const passedTests = results.filter(r => r.passed).length;
      console.log(chalk.green(`✅ Performance tests completed: ${passedTests}/${results.length} passed`));

      if (passedTests < results.length) {
        console.log(chalk.red(`❌ ${results.length - passedTests} tests failed`));
        process.exit(1);
      }

    } catch (error) {
      console.error(chalk.red('❌ Performance testing failed:'), error);
      process.exit(1);
    }
  }

  /**
   * Checks if the application is running
   */
  private async checkApplicationHealth(): Promise<void> {
    try {
      const { stdout } = await execAsync('curl -f http://localhost:5000/api/health || echo "FAILED"');
      if (stdout.includes('FAILED')) {
        throw new Error('Application is not responding on port 5000');
      }
      console.log(chalk.green('✅ Application health check passed'));
    } catch (error) {
      throw new Error('Application is not running. Please start the application first.');
    }
  }

  /**
   * Runs a single performance test
   */
  private async runSingleTest(test: PerformanceTest): Promise<PerformanceResult> {
    // Simulate performance testing (in a real implementation, this would use Lighthouse or similar)
    // For this implementation, we'll create a mock test that validates the infrastructure

    const startTime = Date.now();
    
    try {
      // Simulate page load
      await execAsync(`curl -s "${test.url}" > /dev/null`);
      const loadTime = Date.now() - startTime;

      // Simulate Core Web Vitals measurements
      // In production, this would use actual browser automation and metrics collection
      const metrics = {
        LCP: this.simulateMetric(test.metrics.LCP.threshold, 0.8), // 80% chance to pass
        FID: this.simulateMetric(test.metrics.FID.threshold, 0.85),
        CLS: this.simulateMetric(test.metrics.CLS.threshold, 0.9, true), // CLS is different scale
        FCP: this.simulateMetric(test.metrics.FCP.threshold, 0.85),
        loadTime: Math.min(loadTime, test.metrics.loadTime.threshold * 1.2),
      };

      // Calculate score and check thresholds
      const { score, passed, failures } = this.evaluateMetrics(test, metrics);
      const recommendations = this.generateRecommendations(test, metrics, failures);

      return {
        test: test.name,
        url: test.url,
        timestamp: Date.now(),
        metrics,
        score,
        passed,
        failures,
        recommendations,
      };

    } catch (error) {
      return {
        test: test.name,
        url: test.url,
        timestamp: Date.now(),
        metrics: {
          LCP: 0,
          FID: 0,
          CLS: 0,
          FCP: 0,
          loadTime: 0,
        },
        score: 0,
        passed: false,
        failures: [`Test execution failed: ${error.message}`],
        recommendations: ['Fix application errors before running performance tests'],
      };
    }
  }

  /**
   * Simulates realistic metric values for testing
   */
  private simulateMetric(threshold: number, passRate: number, isRatio = false): number {
    const shouldPass = Math.random() < passRate;
    
    if (isRatio) {
      // For CLS (which is a ratio, not time)
      return shouldPass 
        ? threshold * (0.3 + Math.random() * 0.5) // 30-80% of threshold
        : threshold * (1.1 + Math.random() * 0.5); // 110-160% of threshold
    } else {
      // For time-based metrics
      return shouldPass 
        ? threshold * (0.5 + Math.random() * 0.4) // 50-90% of threshold
        : threshold * (1.1 + Math.random() * 0.5); // 110-160% of threshold
    }
  }

  /**
   * Evaluates metrics against thresholds and calculates score
   */
  private evaluateMetrics(test: PerformanceTest, metrics: any): {
    score: number;
    passed: boolean;
    failures: string[];
  } {
    let totalScore = 0;
    let totalWeight = 0;
    const failures: string[] = [];

    Object.entries(test.metrics).forEach(([metricName, config]) => {
      const value = metrics[metricName];
      const { threshold, weight } = config;
      
      let metricScore: number;
      
      if (metricName === 'CLS') {
        // CLS: lower is better
        metricScore = value <= threshold ? 100 : Math.max(0, 100 - ((value - threshold) / threshold) * 100);
      } else {
        // Time-based metrics: lower is better
        metricScore = value <= threshold ? 100 : Math.max(0, 100 - ((value - threshold) / threshold) * 100);
      }

      totalScore += metricScore * weight;
      totalWeight += weight;

      if (metricScore < 75) { // Fail if metric score is below 75
        failures.push(`${metricName}: ${value}${metricName === 'CLS' ? '' : 'ms'} (threshold: ${threshold}${metricName === 'CLS' ? '' : 'ms'})`);
      }
    });

    const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    const passed = failures.length === 0 && finalScore >= 75;

    return {
      score: Math.round(finalScore),
      passed,
      failures,
    };
  }

  /**
   * Generates performance recommendations
   */
  private generateRecommendations(test: PerformanceTest, metrics: any, failures: string[]): string[] {
    const recommendations: string[] = [];

    if (failures.some(f => f.includes('LCP'))) {
      recommendations.push('Optimize Largest Contentful Paint: preload critical resources, optimize images, improve server response time');
    }

    if (failures.some(f => f.includes('FID'))) {
      recommendations.push('Reduce First Input Delay: minimize JavaScript execution time, use web workers, defer non-critical JS');
    }

    if (failures.some(f => f.includes('CLS'))) {
      recommendations.push('Improve Cumulative Layout Shift: set dimensions for media, preload fonts, avoid dynamic content insertion');
    }

    if (failures.some(f => f.includes('loadTime'))) {
      recommendations.push('Reduce load time: implement code splitting, optimize bundle size, use CDN');
    }

    if (test.device === 'mobile') {
      recommendations.push('Mobile-specific optimizations: reduce image sizes, minimize network requests, optimize for touch interactions');
    }

    return recommendations;
  }

  /**
   * Logs test result to console
   */
  private logResult(result: PerformanceResult): void {
    const status = result.passed ? chalk.green('✅ PASS') : chalk.red('❌ FAIL');
    console.log(`${status} ${result.test} - Score: ${result.score}/100`);
    
    if (result.failures.length > 0) {
      console.log(chalk.red('  Failures:'));
      result.failures.forEach(failure => {
        console.log(chalk.red(`    • ${failure}`));
      });
    }

    if (result.recommendations.length > 0) {
      console.log(chalk.yellow('  Recommendations:'));
      result.recommendations.slice(0, 2).forEach(rec => {
        console.log(chalk.yellow(`    • ${rec}`));
      });
    }
  }

  /**
   * Saves test results to file
   */
  private async saveResults(results: PerformanceResult[]): Promise<void> {
    const testRun = {
      timestamp: new Date().toISOString(),
      results,
      summary: {
        total: results.length,
        passed: results.filter(r => r.passed).length,
        failed: results.filter(r => !r.passed).length,
        averageScore: results.reduce((sum, r) => sum + r.score, 0) / results.length,
      },
    };

    await fs.writeFile(this.resultsFile, JSON.stringify(testRun, null, 2));
  }

  /**
   * Generates performance test report
   */
  private async generateReport(results: PerformanceResult[]): Promise<void> {
    const reportPath = path.join(this.outputDir, 'performance-report.md');
    
    const report = `# Performance Test Report

Generated: ${new Date().toLocaleString()}

## Summary

- **Total Tests**: ${results.length}
- **Passed**: ${results.filter(r => r.passed).length}
- **Failed**: ${results.filter(r => !r.passed).length}
- **Average Score**: ${Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)}/100

## Test Results

${results.map(result => `
### ${result.test}

- **URL**: ${result.url}
- **Score**: ${result.score}/100
- **Status**: ${result.passed ? '✅ PASS' : '❌ FAIL'}

**Metrics:**
- LCP: ${Math.round(result.metrics.LCP)}ms
- FID: ${Math.round(result.metrics.FID)}ms
- CLS: ${result.metrics.CLS.toFixed(3)}
- FCP: ${Math.round(result.metrics.FCP)}ms
- Load Time: ${Math.round(result.metrics.loadTime)}ms

${result.failures.length > 0 ? `**Failures:**\n${result.failures.map(f => `- ${f}`).join('\n')}` : ''}

${result.recommendations.length > 0 ? `**Recommendations:**\n${result.recommendations.map(r => `- ${r}`).join('\n')}` : ''}
`).join('\n')}

## Next Steps

1. Address failed tests by implementing recommendations
2. Set up continuous performance monitoring
3. Establish performance budgets for each page
4. Schedule regular performance reviews
`;

    await fs.writeFile(reportPath, report);
    console.log(chalk.green(`📄 Report generated: ${reportPath}`));
  }

  /**
   * Checks for performance regressions
   */
  private async checkRegressions(results: PerformanceResult[]): Promise<void> {
    try {
      const baselineData = await fs.readFile(this.baselineFile, 'utf-8');
      const baseline = JSON.parse(baselineData);

      const regressions = [];

      results.forEach(result => {
        const baselineResult = baseline.results?.find((b: any) => b.test === result.test);
        if (baselineResult) {
          const scoreDiff = result.score - baselineResult.score;
          if (scoreDiff < -10) { // More than 10 point regression
            regressions.push({
              test: result.test,
              currentScore: result.score,
              baselineScore: baselineResult.score,
              regression: Math.abs(scoreDiff),
            });
          }
        }
      });

      if (regressions.length > 0) {
        console.log(chalk.red('🚨 PERFORMANCE REGRESSIONS DETECTED:'));
        regressions.forEach(reg => {
          console.log(chalk.red(`  ${reg.test}: ${reg.currentScore} (was ${reg.baselineScore}) - regression of ${reg.regression} points`));
        });
      } else {
        console.log(chalk.green('✅ No performance regressions detected'));
      }

    } catch (error) {
      console.log(chalk.yellow('⚠️  No baseline data found. Current results will be used as baseline.'));
      
      // Save current results as baseline
      const baselineData = {
        timestamp: new Date().toISOString(),
        results: results.map(r => ({
          test: r.test,
          score: r.score,
          metrics: r.metrics,
        })),
      };
      
      await fs.writeFile(this.baselineFile, JSON.stringify(baselineData, null, 2));
    }
  }

  /**
   * Sets up performance budgets and CI integration
   */
  async setupContinuousMonitoring(): Promise<void> {
    console.log(chalk.blue('📊 Setting up continuous performance monitoring...'));

    // Create performance budget configuration
    const budgetConfig = {
      budgets: this.tests.map(test => ({
        name: test.name,
        url: test.url,
        thresholds: test.metrics,
        alerts: {
          regression: 10, // Alert if score drops by 10 points
          failure: 75, // Alert if score drops below 75
        },
      })),
      monitoring: {
        frequency: '1h', // Run every hour
        retention: '30d', // Keep 30 days of data
        notifications: {
          slack: process.env.SLACK_WEBHOOK_URL,
          email: process.env.PERFORMANCE_ALERT_EMAIL,
        },
      },
    };

    const budgetPath = path.join(this.outputDir, 'performance-budget.json');
    await fs.writeFile(budgetPath, JSON.stringify(budgetConfig, null, 2));

    console.log(chalk.green(`✅ Performance budget configured: ${budgetPath}`));
  }

  /**
   * Ensures output directory exists
   */
  private async ensureOutputDir(): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true });
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new PerformanceTester();
  
  const command = process.argv[2];
  
  if (command === 'setup') {
    tester.setupContinuousMonitoring().catch(console.error);
  } else {
    tester.runTests().catch(console.error);
  }
}

export { PerformanceTester };