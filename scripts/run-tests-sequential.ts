#!/usr/bin/env tsx

import { spawn } from 'child_process';
import chalk from 'chalk';
import fastGlob from 'fast-glob';
import path from 'path';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  output: string;
  filePath: string;
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
  filePath: string;
}

class SequentialTestRunner {
  private results: TestResult[] = [];
  private startTime: number = Date.now();
  private phases: TestPhase[] = [];

  async initializePhases(): Promise<void> {
    // Check if we're in the correct working directory
    const fs = await import('fs');
    if (!fs.existsSync('package.json') || !fs.existsSync('tests')) {
      console.error(chalk.red('❌ Error: Must be run from the project root directory (where package.json and tests/ exist)'));
      process.exit(1);
    }

    console.log(chalk.blue('🔍 Discovering test files...'));
    
    // Discover all test files
    const testPatterns = [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      '__tests__/**/*.test.ts',
      '__tests__/**/*.test.tsx',
      'server/tests/**/*.test.ts',
      'server/tests/**/*.test.tsx'
    ];

    const allTestFiles = await fastGlob(testPatterns, {
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/*.d.ts'
      ]
    });

    // Filter out utility and setup files that aren't actual tests
    const actualTestFiles = allTestFiles.filter(file => {
      const basename = path.basename(file);
      return !basename.includes('setup') && 
             !basename.includes('utils') && 
             !basename.includes('mock') &&
             !basename.includes('.d.ts') &&
             basename.includes('.test.');
    });

    console.log(chalk.green(`✅ Discovered ${actualTestFiles.length} test files`));

    // Organize tests by category
    const categorizedTests = this.categorizeTests(actualTestFiles);
    
    // Create phases based on categories
    this.phases = this.createPhases(categorizedTests);
    
    console.log(chalk.blue(`📋 Organized into ${this.phases.length} test phases`));
  }

  private categorizeTests(testFiles: string[]): Map<string, string[]> {
    const categories = new Map<string, string[]>();
    
    for (const file of testFiles) {
      let category = 'Other';
      
      // Priority-based categorization with specific rules for communication and budget tests
      if (file.startsWith('tests/critical/')) {
        category = 'Critical';
      } else if (file.startsWith('tests/security/')) {
        category = 'Security';
      } else if (file.startsWith('tests/unit/auth/')) {
        category = 'Authentication';
      } 
      // Communication and Budget test specific categorization
      else if (file.includes('/communication/') && file.includes('translation')) {
        // Communication translation tests go to Unit category
        category = 'Unit';
      } else if (file.includes('/budget/') && file.includes('translation')) {
        // Budget translation tests go to Unit category  
        category = 'Unit';
      } else if (file.includes('/communication/') && file.includes('page.test')) {
        // Communication page tests go to Pages category
        category = 'Pages';
      } else if (file.includes('/budget') && file.includes('page') && file.includes('comprehensive')) {
        // Budget page comprehensive tests go to Pages category
        category = 'Pages';
      } else if (file.startsWith('tests/integration/') && (file.includes('communication') || file.includes('budget'))) {
        // Communication and budget integration tests
        category = 'Integration';
      } else if (file.startsWith('tests/unit/') && (file.includes('budget') || file.includes('communication'))) {
        // Other communication and budget unit tests
        category = 'Unit';
      }
      // Standard categorization rules
      else if (file.startsWith('tests/unit/')) {
        category = 'Unit';
      } else if (file.startsWith('tests/integration/')) {
        category = 'Integration';
      } else if (file.startsWith('tests/pages/')) {
        category = 'Pages';
      } else if (file.startsWith('__tests__/')) {
        category = 'Components';
      } else if (file.startsWith('server/tests/')) {
        category = 'Server';
      }
      
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(file);
    }
    
    return categories;
  }

  private createPhases(categorizedTests: Map<string, string[]>): TestPhase[] {
    const phases: TestPhase[] = [];
    
    // Define phase order and descriptions
    const phaseOrder = [
      { category: 'Critical', description: 'Critical System Tests (Must Pass)' },
      { category: 'Authentication', description: 'Authentication and Authorization Tests' },
      { category: 'Security', description: 'Security and Access Control Tests' },
      { category: 'Unit', description: 'Unit Tests (Business Logic)' },
      { category: 'Components', description: 'React Component Tests' },
      { category: 'Pages', description: 'Page Integration Tests' },
      { category: 'Integration', description: 'System Integration Tests' },
      { category: 'Server', description: 'Server-side Tests' },
      { category: 'Other', description: 'Other Test Files' }
    ];

    let phaseNumber = 1;
    for (const { category, description } of phaseOrder) {
      const files = categorizedTests.get(category) || [];
      if (files.length > 0) {
        const tests = files.map(file => this.createTestConfig(file, category));
        phases.push({
          name: `Phase ${phaseNumber}`,
          description: `${description} (${files.length} files)`,
          tests
        });
        phaseNumber++;
      }
    }

    return phases;
  }

  private createTestConfig(filePath: string, category: string): TestConfig {
    const basename = path.basename(filePath, path.extname(filePath));
    const name = basename.replace('.test', '');
    
    // Determine if test is critical
    const critical = category === 'Critical' || category === 'Authentication';
    
    // Set timeout based on category
    let timeout = 30000; // Default 30s
    if (category === 'Integration' || category === 'Server') {
      timeout = 60000; // 60s for integration tests
    } else if (category === 'Components' || category === 'Pages') {
      timeout = 45000; // 45s for React tests
    }

    return {
      name: `${category}-${name}`,
      command: JSON.stringify(['npx', 'jest', filePath, '--maxWorkers=1', `--testTimeout=${timeout}`, '--passWithNoTests=true']),
      description: `${category}: ${name}`,
      critical,
      timeout,
      filePath
    };
  }

  private async runCommand(command: string, timeout: number): Promise<{ success: boolean; output: string; duration: number }> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const cmdParts = JSON.parse(command);
      const [cmd, ...args] = cmdParts;
      const process = spawn(cmd, args, { 
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false
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
    console.log(chalk.cyan('🧪 Koveo Gestion - Comprehensive Test Suite'));
    console.log(chalk.cyan('==========================================='));
    console.log('');

    // Initialize test discovery
    await this.initializePhases();
    console.log('');

    for (const phase of this.phases) {
      console.log(chalk.blue(`${phase.name}: ${phase.description}`));
      console.log(chalk.blue('='.repeat(phase.name.length + phase.description.length + 2)));
      
      for (const test of phase.tests) {
        console.log(chalk.blue(`📋 Running: ${test.description}`));
        console.log(`   File: ${test.filePath}`);
        console.log(`   Command: ${test.command}`);
        console.log('');
        
        const result = await this.runCommand(test.command, test.timeout);
        
        const testResult: TestResult = {
          name: test.name,
          passed: result.success,
          duration: result.duration,
          output: result.output,
          filePath: test.filePath
        };
        
        this.results.push(testResult);
        
        if (result.success) {
          console.log(chalk.green(`✅ PASSED: ${test.name} (${result.duration}ms)`));
        } else {
          if (test.critical) {
            console.log(chalk.red(`❌ FAILED: ${test.name} (${result.duration}ms)`));
            console.log(chalk.yellow('⏩ Continuing with remaining tests...'));
          } else {
            console.log(chalk.yellow(`⚠️  FAILED: ${test.name} (${result.duration}ms)`));
          }
          
          // Show error details for failed tests
          if (result.output.includes('FAIL') || result.output.includes('Error')) {
            console.log(chalk.gray('📄 Error details:'));
            const errorLines = result.output.split('\n').slice(-10); // Last 10 lines
            errorLines.forEach(line => {
              if (line.trim()) {
                console.log(chalk.gray(`   ${line}`));
              }
            });
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
    
    // Show detailed results by category
    console.log('📋 Results by Category:');
    const phaseResults = new Map<string, { passed: number; total: number }>();
    
    for (const result of this.results) {
      const phase = this.phases.find(p => p.tests.some(t => t.name === result.name));
      if (phase) {
        if (!phaseResults.has(phase.name)) {
          phaseResults.set(phase.name, { passed: 0, total: 0 });
        }
        const stats = phaseResults.get(phase.name)!;
        stats.total++;
        if (result.passed) stats.passed++;
      }
    }
    
    for (const [phaseName, stats] of phaseResults) {
      const phase = this.phases.find(p => p.name === phaseName);
      const rate = Math.round((stats.passed * 100) / stats.total);
      const status = stats.passed === stats.total ? '✅' : stats.passed > 0 ? '⚠️' : '❌';
      console.log(`   ${status} ${phase?.description}: ${stats.passed}/${stats.total} (${rate}%)`);
    }
    
    console.log('');
    
    // Show failed tests details
    const failedTests = this.results.filter(r => !r.passed);
    if (failedTests.length > 0) {
      console.log('❌ Failed Tests Details:');
      failedTests.forEach(result => {
        const duration = `${(result.duration / 1000).toFixed(1)}s`;
        console.log(`   • ${result.name} (${duration})`);
        console.log(`     File: ${result.filePath}`);
      });
      console.log('');
    }
    
    if (failed === 0) {
      console.log(chalk.green('🎉 All tests passed successfully!'));
    } else {
      console.log(chalk.yellow(`⚠️  ${failed} tests failed out of ${total} total`));
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