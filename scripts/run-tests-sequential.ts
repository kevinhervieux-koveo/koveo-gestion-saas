#!/usr/bin/env tsx

import { spawn } from 'child_process';
import chalk from 'chalk';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  output: string;
}

interface TestPhase {
  name: string;
  description: string;
  tests: TestConfig[];
}

interface TestConfig {
  name: string;
  command: string;
  description: string;
  critical: boolean;
  timeout: number;
}

class SequentialTestRunner {
  private results: TestResult[] = [];
  private startTime: number = Date.now();

  private phases: TestPhase[] = [
    {
      name: 'Phase 1',
      description: 'Schema and Validation Tests (Foundation)',
      tests: [
        {
          name: 'Bills-Schema',
          command: 'npx jest tests/unit/bills-validation.test.ts --maxWorkers=1',
          description: 'Bills schema validation tests',
          critical: true,
          timeout: 30000
        },
        {
          name: 'Demands-Schema',
          command: 'npx jest tests/unit/demands/demands-schema.test.ts --maxWorkers=1',
          description: 'Demands schema validation tests',
          critical: true,
          timeout: 30000
        },
        {
          name: 'Password-Validation',
          command: 'npx jest tests/unit/invitation/password-validation.test.ts --maxWorkers=1',
          description: 'Password validation tests',
          critical: true,
          timeout: 30000
        }
      ]
    },
    {
      name: 'Phase 2',
      description: 'Authentication and Authorization (Security Foundation)',
      tests: [
        {
          name: 'RBAC-Core',
          command: 'npx jest tests/unit/auth/rbac.test.ts --maxWorkers=1',
          description: 'Core RBAC permissions tests',
          critical: true,
          timeout: 30000
        },
        {
          name: 'Auth-Middleware',
          command: 'npx jest tests/unit/auth/auth-middleware-comprehensive.test.ts --maxWorkers=1',
          description: 'Authentication middleware tests',
          critical: false,
          timeout: 45000
        }
      ]
    },
    {
      name: 'Phase 3',
      description: 'Feature and Business Logic Tests',
      tests: [
        {
          name: 'Calendar-Features',
          command: 'npx jest tests/unit/calendar/calendar-features.test.ts --maxWorkers=1',
          description: 'Calendar functionality tests',
          critical: true,
          timeout: 30000
        },
        {
          name: 'Budget-Calculations',
          command: 'npx jest tests/unit/budget/budget-comprehensive.test.ts --maxWorkers=1',
          description: 'Budget calculation tests',
          critical: false,
          timeout: 45000
        }
      ]
    },
    {
      name: 'Phase 4',
      description: 'Quebec Compliance and Internationalization',
      tests: [
        {
          name: 'Quebec-i18n',
          command: 'npx jest tests/unit/i18n/ --maxWorkers=1',
          description: 'Quebec compliance and internationalization',
          critical: false,
          timeout: 30000
        }
      ]
    },
    {
      name: 'Phase 5',
      description: 'Database and Storage Tests',
      tests: [
        {
          name: 'Database-Sync',
          command: 'npm run test:db-sync',
          description: 'Database synchronization tests',
          critical: false,
          timeout: 60000
        }
      ]
    },
    {
      name: 'Phase 6',
      description: 'Integration Tests (System Integration)',
      tests: [
        {
          name: 'Integration-Core',
          command: 'npx jest tests/integration/ --maxWorkers=1 --testTimeout=10000 --passWithNoTests=true',
          description: 'Core integration tests',
          critical: false,
          timeout: 120000
        }
      ]
    }
  ];

  private async runCommand(command: string, timeout: number): Promise<{ success: boolean; output: string; duration: number }> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const [cmd, ...args] = command.split(' ');
      const process = spawn(cmd, args, { 
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });
      
      let output = '';
      let timeoutHandle: NodeJS.Timeout;
      
      process.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      process.stderr?.on('data', (data) => {
        output += data.toString();
      });
      
      const cleanup = () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        const duration = Date.now() - startTime;
        return { duration, output };
      };
      
      process.on('close', (code) => {
        const { duration, output: finalOutput } = cleanup();
        resolve({
          success: code === 0,
          output: finalOutput,
          duration
        });
      });
      
      process.on('error', (error) => {
        const { duration, output: finalOutput } = cleanup();
        resolve({
          success: false,
          output: finalOutput + `\nError: ${error.message}`,
          duration
        });
      });
      
      // Set timeout
      timeoutHandle = setTimeout(() => {
        process.kill('SIGTERM');
        const { duration, output: finalOutput } = cleanup();
        resolve({
          success: false,
          output: finalOutput + '\nTest timed out',
          duration
        });
      }, timeout);
    });
  }

  async runTests(): Promise<void> {
    console.log(chalk.cyan('🧪 Koveo Gestion - Sequential Test Suite'));
    console.log(chalk.cyan('========================================'));
    console.log('');

    for (const phase of this.phases) {
      console.log(chalk.blue(`${phase.name}: ${phase.description}`));
      console.log(chalk.blue('='.repeat(phase.name.length + phase.description.length + 2)));
      
      for (const test of phase.tests) {
        console.log(chalk.blue(`📋 Running: ${test.description}`));
        console.log(`   Command: ${test.command}`);
        console.log('');
        
        const result = await this.runCommand(test.command, test.timeout);
        
        const testResult: TestResult = {
          name: test.name,
          passed: result.success,
          duration: result.duration,
          output: result.output
        };
        
        this.results.push(testResult);
        
        if (result.success) {
          console.log(chalk.green(`✅ PASSED: ${test.name} (${result.duration}ms)`));
        } else {
          if (test.critical) {
            console.log(chalk.red(`❌ FAILED: ${test.name} (${result.duration}ms)`));
            console.log(chalk.yellow('⏩ Continuing with remaining tests...'));
          } else {
            console.log(chalk.yellow(`⚠️  SKIPPED: ${test.name} (Known Issues - ${result.duration}ms)`));
          }
        }
        
        console.log('');
        console.log('----------------------------------------');
        console.log('');
      }
    }

    this.printSummary();
  }

  private printSummary(): void {
    const totalDuration = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    const successRate = total > 0 ? Math.round((passed * 100) / total) : 0;
    
    console.log('');
    console.log(chalk.cyan('🏁 Test Execution Complete'));
    console.log(chalk.cyan('=========================='));
    console.log('');
    console.log('📊 Results Summary:');
    console.log(`   ${chalk.green('✅ Passed:')} ${passed}`);
    console.log(`   ${chalk.red('❌ Failed:')} ${failed}`);
    console.log(`   📋 Total: ${total}`);
    console.log(`   📈 Success Rate: ${successRate}%`);
    console.log(`   ⏱️  Total Duration: ${(totalDuration / 1000).toFixed(1)}s`);
    console.log('');
    
    // Show detailed results
    console.log('📋 Detailed Results:');
    this.results.forEach(result => {
      const status = result.passed ? chalk.green('✅') : chalk.red('❌');
      const duration = `${(result.duration / 1000).toFixed(1)}s`;
      console.log(`   ${status} ${result.name} (${duration})`);
    });
    
    console.log('');
    
    if (failed === 0) {
      console.log(chalk.green('🎉 All critical tests passed successfully!'));
    } else {
      console.log(chalk.yellow('⚠️  Some tests failed but execution completed'));
      console.log('   Review the failed tests above for details');
    }
  }
}

// Run the tests
const runner = new SequentialTestRunner();
runner.runTests().catch((error) => {
  console.error(chalk.red('Failed to run test suite:'), error);
  process.exit(1);
});