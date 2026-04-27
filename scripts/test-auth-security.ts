#!/usr/bin/env npx tsx
// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)

import { exec } from 'child_process';
import { promisify } from 'util';
// Removed chalk dependency - using console.log with manual styling
// import chalk from 'chalk';

const execAsync = promisify(exec);

/**
 * Enhanced Authentication Security Test Runner
 * Runs comprehensive authentication and authorization security tests
 * with selective unmocking for higher-fidelity testing
 */

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: string;
  required?: boolean;
}

interface TestOptions {
  type: 'unit' | 'integration' | 'all';
  verbose: boolean;
  useSelectiveMocking: boolean;
}

class AuthSecurityTester {
  private results: TestResult[] = [];
  private options: TestOptions;

  constructor(options: TestOptions = { type: 'all', verbose: false, useSelectiveMocking: true }) {
    this.options = options;
  }

  /**
   * Run all authentication security tests with enhanced configuration
   */
  async runTests(): Promise<void> {
    this.log('info', '🔒 Enhanced Authentication Security Test Suite');
    this.log('info', '===============================================');
    this.log('info', '');
    
    this.log('info', `Test Type: ${this.options.type}`);
    this.log('info', `Selective Mocking: ${this.options.useSelectiveMocking ? 'Enabled' : 'Disabled'}`);
    this.log('info', '');

    // Set up environment variables for better testing
    await this.setupTestEnvironment();

    if (this.options.type === 'unit' || this.options.type === 'all') {
      await this.runAuthUnitTests();
      await this.runRegistrationTests();
      await this.runSecurityHeaderTests();
    }
    
    if (this.options.type === 'integration' || this.options.type === 'all') {
      await this.runRBACTests();
      await this.runAuthSystemTests();
      await this.runCriticalAuthTests();
    }

    this.generateReport();
  }

  private log(level: 'info' | 'success' | 'error' | 'warn', message: string): void {
    if (level === 'error') {
      console.log(`🔴 ${message}`);
    } else if (level === 'success') {
      console.log(`🟢 ${message}`);
    } else if (level === 'warn') {
      console.log(`🟡 ${message}`);
    } else {
      console.log(`🔵 ${message}`);
    }
  }

  private async setupTestEnvironment(): Promise<void> {
    process.env.NODE_ENV = 'test';
    process.env.SESSION_SECRET = 'test-session-secret';
    
    if (this.options.useSelectiveMocking) {
      if (this.options.type === 'unit') {
        process.env.TEST_TYPE = 'unit';
        process.env.MOCK_PASSWORDS = 'true';
        process.env.MOCK_SESSIONS = 'true';
      } else {
        process.env.TEST_TYPE = 'integration';
        process.env.MOCK_PASSWORDS = 'false';
        process.env.MOCK_SESSIONS = 'false';
      }
    }
  }

  private async runAuthUnitTests(): Promise<void> {
    try {
      this.log('info', '🧪 Running authentication unit tests...');
      
      const configFlag = this.options.useSelectiveMocking ? '--config=jest.config.auth.cjs' : '';
      // The user-deletion integration suite was retired; the current
      // user-lifecycle integration suites are the ones listed below.
      const cmd = `npx jest ${configFlag} tests/integration/user-registration.test.ts tests/integration/user-residences-end-residency.test.ts tests/integration/user-serializer-http.test.ts --passWithNoTests=false --maxWorkers=1 --forceExit`;
      
      if (this.options.verbose) {
        this.log('info', `Command: ${cmd}`);
      }
      
      const { stdout, stderr } = await execAsync(cmd);
      
      this.results.push({
        name: 'Authentication Unit Tests',
        passed: true,
        message: 'All authentication unit tests passed',
        details: this.options.verbose ? stdout : '',
        required: true,
      });
    } catch (error: any) {
      this.results.push({
        name: 'Authentication Unit Tests',
        passed: false,
        message: 'Authentication unit tests failed',
        details: error.stdout || error.message,
        required: true,
      });
    }
  }

  private async runRBACTests(): Promise<void> {
    try {
      this.log('info', '🛡️  Running RBAC security tests...');
      
      const configFlag = this.options.useSelectiveMocking ? '--config=jest.config.auth.cjs' : '';
      const cmd = `npx jest ${configFlag} tests/integration/rbac*.test.ts --passWithNoTests=false --maxWorkers=1 --forceExit`;
      
      if (this.options.verbose) {
        this.log('info', `Command: ${cmd}`);
      }
      
      const { stdout, stderr } = await execAsync(cmd);
      
      this.results.push({
        name: 'RBAC Security Tests',
        passed: true,
        message: 'Role-based access control tests passed',
        details: this.options.verbose ? stdout : '',
        required: true,
      });
    } catch (error: any) {
      this.results.push({
        name: 'RBAC Security Tests',
        passed: false,
        message: 'RBAC security tests failed',
        details: error.stdout || error.message,
        required: true,
      });
    }
  }

  private async runRegistrationTests(): Promise<void> {
    try {
      console.log('📝 Running user registration security tests...');
      const { stdout, stderr } = await execAsync(
        'npx jest tests/integration/user-registration.test.ts --passWithNoTests=false --silent --forceExit'
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
      this.log('info', '🔐 Running authentication system integration tests...');
      
      const configFlag = this.options.useSelectiveMocking ? '--config=jest.config.auth.cjs' : '';
      const cmd = `npx jest ${configFlag} tests/integration/authentication*.test.ts --passWithNoTests=false --maxWorkers=1 --forceExit`;
      
      if (this.options.verbose) {
        this.log('info', `Command: ${cmd}`);
      }
      
      const { stdout, stderr } = await execAsync(cmd);
      
      this.results.push({
        name: 'Authentication System Tests',
        passed: true,
        message: 'Authentication system integration tests passed',
        details: this.options.verbose ? stdout : '',
        required: true,
      });
    } catch (error: any) {
      this.results.push({
        name: 'Authentication System Tests',
        passed: false,
        message: 'Authentication system integration tests failed',
        details: error.stdout || error.message,
        required: true,
      });
    }
  }

  private async runCriticalAuthTests(): Promise<void> {
    try {
      this.log('info', '🚨 Running critical authentication tests...');
      
      const configFlag = this.options.useSelectiveMocking ? '--config=jest.config.auth.cjs' : '';
      const cmd = `npx jest ${configFlag} tests/critical/authentication*.test.ts --passWithNoTests=false --maxWorkers=1 --forceExit`;
      
      if (this.options.verbose) {
        this.log('info', `Command: ${cmd}`);
      }
      
      const { stdout, stderr } = await execAsync(cmd);
      
      this.results.push({
        name: 'Critical Authentication Tests',
        passed: true,
        message: 'Critical authentication tests passed',
        details: this.options.verbose ? stdout : '',
        required: true,
      });
    } catch (error: any) {
      this.results.push({
        name: 'Critical Authentication Tests',
        passed: false,
        message: 'Critical authentication tests failed',
        details: error.stdout || error.message,
        required: true,
      });
    }
  }

  private async runSecurityHeaderTests(): Promise<void> {
    try {
      this.log('info', '🔒 Running security header tests...');
      
      const configFlag = this.options.useSelectiveMocking ? '--config=jest.config.auth.cjs' : '';
      const cmd = `npx jest ${configFlag} tests/integration/security-headers.test.ts --passWithNoTests=false --maxWorkers=1 --forceExit`;
      
      if (this.options.verbose) {
        this.log('info', `Command: ${cmd}`);
      }
      
      const { stdout, stderr } = await execAsync(cmd);
      
      this.results.push({
        name: 'Security Header Tests',
        passed: true,
        message: 'Security header tests passed',
        details: this.options.verbose ? stdout : '',
        required: false,
      });
    } catch (error: any) {
      this.results.push({
        name: 'Security Header Tests',
        passed: false,
        message: 'Security header tests failed',
        details: error.stdout || error.message,
        required: false,
      });
    }
  }

  private generateReport(): void {
    this.log('info', '\n🏁 Enhanced Authentication Security Test Results');
    this.log('info', '==================================================');
    this.log('info', '');

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const requiredFailed = this.results.filter(r => !r.passed && r.required).length;

    this.results.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      const requiredFlag = result.required ? ' (Required)' : ' (Optional)';
      console.log(`${icon} ${result.name}${requiredFlag}: ${result.message}`);
      
      if (!result.passed && this.options.verbose && result.details) {
        console.log(chalk.red(`   Details: ${result.details.slice(0, 200)}...`));
      }
    });

    console.log('');
    this.log('info', '📊 Summary:');
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   🚨 Required Failed: ${requiredFailed}`);
    console.log(`   📈 Success Rate: ${passed > 0 ? Math.round((passed / this.results.length) * 100) : 0}%`);

    if (requiredFailed > 0) {
      this.log('error', '\n⚠️  Critical authentication security issues detected!');
      this.log('warn', '\nDebugging recommendations:');
      this.log('warn', '1. Check server is running: npm run dev');
      this.log('warn', '2. Verify database connectivity');
      this.log('warn', '3. Run with --verbose for detailed output');
      this.log('warn', '4. Check authentication middleware setup');
      process.exit(1);
    } else if (failed > 0) {
      this.log('warn', '\n⚠️  Some optional authentication tests failed');
      this.log('success', '✅ All required authentication security tests passed!');
      process.exit(0);
    } else {
      this.log('success', '\n🔒 All authentication security tests passed!');
      process.exit(0);
    }
  }
}

// Parse command line arguments
function parseArgs(): TestOptions {
  const args = process.argv.slice(2);
  
  return {
    type: args.includes('--unit') ? 'unit' : args.includes('--integration') ? 'integration' : 'all',
    verbose: args.includes('--verbose') || args.includes('-v'),
    useSelectiveMocking: !args.includes('--no-selective-mocking'),
  };
}

// Show help
function showHelp(): void {
  console.log(`
🔒 Enhanced Authentication Security Test Runner

Usage: npm run test:auth [options]

Options:
  --unit                   Run only unit tests
  --integration            Run only integration tests  
  --verbose, -v            Verbose output with details
  --no-selective-mocking   Disable selective unmocking
  --help, -h               Show this help

Examples:
  npm run test:auth                    # Run all tests with selective mocking
  npm run test:auth -- --unit          # Run unit tests only
  npm run test:auth -- --integration   # Run integration tests only
  npm run test:auth -- --verbose       # Run with detailed output
  `);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  
  const options = parseArgs();
  const tester = new AuthSecurityTester(options);
  
  tester.runTests().catch((error) => {
    console.error(chalk.red('❌ Authentication security test failed:'), error);
    process.exit(1);
  });
}

export default AuthSecurityTester;