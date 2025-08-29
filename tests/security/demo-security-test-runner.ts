#!/usr/bin/env tsx

/**
 * Demo Security Test Runner
 * 
 * Comprehensive test suite to validate all security restrictions for demo users.
 * This ensures that demo users (especially Open Demo users) have proper view-only access
 * and cannot perform any destructive operations.
 */

import { execSync } from 'child_process';
import chalk from 'chalk';
import { performance } from 'perf_hooks';

interface TestSuite {
  name: string;
  path: string;
  description: string;
  critical: boolean;
}

const TEST_SUITES: TestSuite[] = [
  {
    name: 'Demo User Validation',
    path: 'tests/security/demo-users-validation.test.ts',
    description: 'Validates demo user data integrity and naming conventions',
    critical: true
  },
  {
    name: 'Comprehensive Demo Security',
    path: 'tests/security/comprehensive-demo-user-security.test.ts',
    description: 'End-to-end API security tests for demo user restrictions',
    critical: true
  },
  {
    name: 'UI Restrictions Integration',
    path: 'tests/integration/demo-user-ui-restrictions.test.tsx',
    description: 'Frontend UI restrictions and user experience tests',
    critical: false
  }
];

interface TestResult {
  suite: string;
  passed: boolean;
  duration: number;
  output: string;
  error?: string;
}

class DemoSecurityTester {
  private results: TestResult[] = [];
  private startTime: number = 0;

  constructor() {
    this.startTime = performance.now();
  }

  async runAllTests(): Promise<void> {
    console.log(chalk.blue.bold('\n🛡️  Demo User Security Test Suite\n'));
    console.log(chalk.gray('Ensuring demo users have proper view-only restrictions...\n'));

    // Run pre-flight checks
    await this.runPreflightChecks();

    // Run each test suite
    for (const suite of TEST_SUITES) {
      await this.runTestSuite(suite);
    }

    // Generate summary report
    this.generateSummaryReport();

    // Check for critical failures
    this.checkCriticalFailures();
  }

  private async runPreflightChecks(): Promise<void> {
    console.log(chalk.yellow('🔍 Running pre-flight checks...\n'));

    try {
      // Check database connection
      console.log('  ✓ Checking database connection...');
      execSync('tsx tests/utils/check-db-connection.ts', { stdio: 'pipe' });

      // Check test environment
      console.log('  ✓ Verifying test environment...');
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL environment variable not set');
      }

      // Check demo organizations exist
      console.log('  ✓ Verifying demo organizations...');
      execSync('tsx tests/utils/verify-demo-orgs.ts', { stdio: 'pipe' });

      console.log(chalk.green('  ✅ All pre-flight checks passed\n'));
    } catch (error) {
      console.log(chalk.red('  ❌ Pre-flight check failed:'), error);
      process.exit(1);
    }
  }

  private async runTestSuite(suite: TestSuite): Promise<void> {
    console.log(chalk.blue(`📋 Running: ${suite.name}`));
    console.log(chalk.gray(`   ${suite.description}\n`));

    const startTime = performance.now();
    
    try {
      // Use Jest directly for better performance
      const output = execSync(`npx jest ${suite.path} --verbose --forceExit --detectOpenHandles`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const duration = performance.now() - startTime;
      
      this.results.push({
        suite: suite.name,
        passed: true,
        duration,
        output
      });

      console.log(chalk.green(`   ✅ PASSED (${Math.round(duration)}ms)\n`));
    } catch (error: any) {
      const duration = performance.now() - startTime;
      
      this.results.push({
        suite: suite.name,
        passed: false,
        duration,
        output: error.stdout || '',
        error: error.stderr || error.message
      });

      console.log(chalk.red(`   ❌ FAILED (${Math.round(duration)}ms)`));
      if (suite.critical) {
        console.log(chalk.red('   ⚠️  CRITICAL FAILURE - Security may be compromised'));
      }
      console.log('');
    }
  }

  private generateSummaryReport(): void {
    const totalDuration = performance.now() - this.startTime;
    const passedCount = this.results.filter(r => r.passed).length;
    const failedCount = this.results.filter(r => !r.passed).length;
    const criticalFailures = this.results.filter(r => !r.passed && TEST_SUITES.find(s => s.name === r.suite)?.critical).length;

    console.log(chalk.blue.bold('\n📊 Demo Security Test Summary\n'));
    console.log(chalk.gray('=')); repeat('=', 50);
    console.log('');

    // Overall status
    const overallStatus = failedCount === 0 ? 'SECURE' : criticalFailures > 0 ? 'CRITICAL' : 'WARNING';
    const statusColor = overallStatus === 'SECURE' ? chalk.green : overallStatus === 'CRITICAL' ? chalk.red : chalk.yellow;
    
    console.log(`${statusColor.bold('Status:')} ${statusColor(overallStatus)}`);
    console.log(`${chalk.blue('Tests:')} ${passedCount} passed, ${failedCount} failed`);
    console.log(`${chalk.blue('Duration:')} ${Math.round(totalDuration)}ms`);
    
    if (criticalFailures > 0) {
      console.log(`${chalk.red.bold('Critical Failures:')} ${criticalFailures}`);
    }

    console.log('');

    // Individual test results
    console.log(chalk.blue.bold('Test Results:\n'));
    
    this.results.forEach(result => {
      const status = result.passed ? chalk.green('✅ PASS') : chalk.red('❌ FAIL');
      const critical = TEST_SUITES.find(s => s.name === result.suite)?.critical ? ' (CRITICAL)' : '';
      
      console.log(`${status} ${result.suite}${critical}`);
      console.log(`      Duration: ${Math.round(result.duration)}ms`);
      
      if (!result.passed && result.error) {
        console.log(`      Error: ${chalk.red(result.error.split('\n')[0])}`);
      }
      console.log('');
    });

    // Security recommendations
    this.generateSecurityRecommendations();
  }

  private generateSecurityRecommendations(): void {
    const failedResults = this.results.filter(r => !r.passed);
    
    if (failedResults.length === 0) {
      console.log(chalk.green.bold('🎉 All security tests passed! Demo users are properly restricted.\n'));
      return;
    }

    console.log(chalk.yellow.bold('⚠️  Security Recommendations:\n'));

    failedResults.forEach((result, index) => {
      console.log(`${index + 1}. ${chalk.yellow(result.suite)}`);
      
      // Provide specific recommendations based on test suite
      if (result.suite.includes('Validation')) {
        console.log('   → Check demo user data integrity in database');
        console.log('   → Ensure no admin users exist in demo organizations');
        console.log('   → Verify user names follow Quebec naming conventions');
      } else if (result.suite.includes('Comprehensive')) {
        console.log('   → Review API endpoint security middleware');
        console.log('   → Check RBAC implementation for demo users');
        console.log('   → Verify write operation restrictions are enforced');
      } else if (result.suite.includes('UI')) {
        console.log('   → Update frontend components to respect demo restrictions');
        console.log('   → Add proper error handling for restricted actions');
        console.log('   → Implement user-friendly restriction messages');
      }
      console.log('');
    });
  }

  private checkCriticalFailures(): void {
    const criticalFailures = this.results.filter(r => !r.passed && TEST_SUITES.find(s => s.name === r.suite)?.critical);
    
    if (criticalFailures.length > 0) {
      console.log(chalk.red.bold('\n🚨 CRITICAL SECURITY FAILURES DETECTED\n'));
      console.log(chalk.red('Demo user security is compromised. The following issues must be resolved immediately:\n'));
      
      criticalFailures.forEach((failure, index) => {
        console.log(`${index + 1}. ${failure.suite}`);
        if (failure.error) {
          console.log(`   Error: ${failure.error.split('\n')[0]}`);
        }
        console.log('');
      });
      
      console.log(chalk.red.bold('⚠️  DO NOT DEPLOY until these critical issues are resolved.\n'));
      process.exit(1);
    }
  }
}

// Utility function to repeat characters
function repeat(char: string, count: number): string {
  return new Array(count + 1).join(char);
}

// Run the test suite if this file is executed directly
if (require.main === module) {
  const tester = new DemoSecurityTester();
  tester.runAllTests().catch(error => {
    console.error(chalk.red('Test runner failed:'), error);
    process.exit(1);
  });
}

export { DemoSecurityTester, TEST_SUITES };