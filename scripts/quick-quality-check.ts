#!/usr/bin/env tsx

import { execSync } from 'child_process';
import chalk from 'chalk';

/**
 * Quick quality check that focuses on essential metrics
 * This is a streamlined version that avoids timeout issues
 */

interface QualityMetrics {
  typecheck: boolean;
  lint: boolean;
  basicTests: boolean;
  buildTest: boolean;
}

async function runQuickQualityCheck(): Promise<QualityMetrics> {
  console.log(chalk.blue('🔍 Running Quick Quality Check...'));
  console.log(chalk.gray('===================================='));

  const metrics: QualityMetrics = {
    typecheck: false,
    lint: false,
    basicTests: false,
    buildTest: false,
  };

  // 1. TypeScript check
  console.log(chalk.yellow('\n📝 Checking TypeScript...'));
  try {
    execSync('npm run typecheck', { stdio: 'pipe', timeout: 30000 });
    console.log(chalk.green('✅ TypeScript check passed'));
    metrics.typecheck = true;
  } catch (error) {
    console.log(chalk.red('❌ TypeScript check failed'));
  }

  // 2. Lint check
  console.log(chalk.yellow('\n🧹 Checking code style...'));
  try {
    execSync('npm run lint:check', { stdio: 'pipe', timeout: 30000 });
    console.log(chalk.green('✅ Lint check passed'));
    metrics.lint = true;
  } catch (error) {
    console.log(chalk.red('❌ Lint check failed'));
  }

  // 3. Basic tests (with timeout)
  console.log(chalk.yellow('\n🧪 Running basic tests...'));
  try {
    execSync('timeout 45s npm run test -- --passWithNoTests --testTimeout=10000', { 
      stdio: 'pipe', 
      timeout: 50000 
    });
    console.log(chalk.green('✅ Basic tests passed'));
    metrics.basicTests = true;
  } catch (error) {
    console.log(chalk.red('❌ Basic tests failed or timed out'));
  }

  // 4. Build test
  console.log(chalk.yellow('\n🔨 Testing build process...'));
  try {
    execSync('timeout 60s npm run build', { stdio: 'pipe', timeout: 65000 });
    console.log(chalk.green('✅ Build test passed'));
    metrics.buildTest = true;
  } catch (error) {
    console.log(chalk.red('❌ Build test failed or timed out'));
  }

  return metrics;
}

async function main() {
  try {
    const metrics = await runQuickQualityCheck();
    
    const passedChecks = Object.values(metrics).filter(Boolean).length;
    const totalChecks = Object.keys(metrics).length;
    
    console.log(chalk.blue('\n📊 Quality Check Summary'));
    console.log(chalk.gray('=========================='));
    console.log(`📈 Passed: ${passedChecks}/${totalChecks} checks`);
    console.log(`🎯 TypeScript: ${metrics.typecheck ? '✅' : '❌'}`);
    console.log(`🎯 Linting: ${metrics.lint ? '✅' : '❌'}`);
    console.log(`🎯 Tests: ${metrics.basicTests ? '✅' : '❌'}`);
    console.log(`🎯 Build: ${metrics.buildTest ? '✅' : '❌'}`);
    
    if (passedChecks === totalChecks) {
      console.log(chalk.green('\n🎉 All quality checks passed!'));
      console.log(chalk.blue('✅ Code is ready for deployment'));
      process.exit(0);
    } else {
      console.log(chalk.yellow(`\n⚠️  ${totalChecks - passedChecks} quality checks failed`));
      console.log(chalk.blue('🔧 Please fix the issues above before deployment'));
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('💥 Quality check failed:'), error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}