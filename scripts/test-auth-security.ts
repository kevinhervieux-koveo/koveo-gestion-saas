#!/usr/bin/env npx tsx

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Authentication Security Test Runner
 * Runs comprehensive authentication and authorization security tests
 */

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: string;
}

class AuthSecurityTester {
  private results: TestResult[] = [];

  /**
   * Run all authentication security tests
   */
  async runTests(): Promise<void> {
    console.log('🔒 Authentication Security Test Suite');
    console.log('=====================================');
    console.log('');

    // Test authentication unit tests
    await this.runAuthUnitTests();
    
    // Test RBAC system
    await this.runRBACTests();
    
    // Test user registration security
    await this.runRegistrationTests();
    
    // Test authentication system integration
    await this.runAuthSystemTests();

    this.generateReport();
  }

  private async runAuthUnitTests(): Promise<void> {
    try {
      console.log('🧪 Running authentication unit tests...');
      const { stdout, stderr } = await execAsync(
        'npx jest tests/unit/auth/ --passWithNoTests=false --silent --forceExit'
      );
      
      this.results.push({
        name: 'Authentication Unit Tests',
        passed: true,
        message: 'All authentication unit tests passed',
        details: stdout
      });
    } catch (error: any) {
      this.results.push({
        name: 'Authentication Unit Tests',
        passed: false,
        message: 'Authentication unit tests failed',
        details: error.stdout || error.message
      });
    }
  }

  private async runRBACTests(): Promise<void> {
    try {
      console.log('🛡️  Running RBAC security tests...');
      const { stdout, stderr } = await execAsync(
        'npx jest tests/unit/auth/rbac-comprehensive.test.ts --passWithNoTests=false --silent --forceExit'
      );
      
      this.results.push({
        name: 'RBAC Security Tests',
        passed: true,
        message: 'Role-based access control tests passed',
        details: stdout
      });
    } catch (error: any) {
      this.results.push({
        name: 'RBAC Security Tests',
        passed: false,
        message: 'RBAC security tests failed',
        details: error.stdout || error.message
      });
    }
  }

  private async runRegistrationTests(): Promise<void> {
    try {
      console.log('📝 Running user registration security tests...');
      const { stdout, stderr } = await execAsync(
        'npx jest tests/unit/auth/user-registration.test.ts --passWithNoTests=false --silent --forceExit'
      );
      
      this.results.push({
        name: 'Registration Security Tests',
        passed: true,
        message: 'User registration security tests passed',
        details: stdout
      });
    } catch (error: any) {
      this.results.push({
        name: 'Registration Security Tests',
        passed: false,
        message: 'Registration security tests failed',
        details: error.stdout || error.message
      });
    }
  }

  private async runAuthSystemTests(): Promise<void> {
    try {
      console.log('🔐 Running authentication system integration tests...');
      const { stdout, stderr } = await execAsync(
        'npx jest tests/integration/authentication-system.test.ts --passWithNoTests=false --silent --forceExit'
      );
      
      this.results.push({
        name: 'Authentication System Tests',
        passed: true,
        message: 'Authentication system integration tests passed',
        details: stdout
      });
    } catch (error: any) {
      this.results.push({
        name: 'Authentication System Tests',
        passed: false,
        message: 'Authentication system integration tests failed',
        details: error.stdout || error.message
      });
    }
  }

  private generateReport(): void {
    console.log('\n🏁 Authentication Security Test Results');
    console.log('=========================================');
    console.log('');

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;

    this.results.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.name}: ${result.message}`);
    });

    console.log('');
    console.log('📊 Summary:');
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📈 Success Rate: ${passed > 0 ? Math.round((passed / this.results.length) * 100) : 0}%`);

    if (failed > 0) {
      console.log('\n⚠️  Authentication security issues detected!');
      process.exit(1);
    } else {
      console.log('\n🔒 All authentication security tests passed!');
      process.exit(0);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new AuthSecurityTester();
  tester.runTests().catch((error) => {
    console.error('❌ Authentication security test failed:', error);
    process.exit(1);
  });
}

export default AuthSecurityTester;