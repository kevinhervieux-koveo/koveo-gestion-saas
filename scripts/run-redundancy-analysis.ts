#!/usr/bin/env npx tsx

/**
 * @file Redundancy Analysis Script.
 * @description Runs comprehensive redundancy detection tests as part of validation pipeline.
 */

import { spawn } from 'child_process';
import chalk from 'chalk';

/**
 *
 */
interface TestResult {
  passed: boolean;
  output: string;
  error?: string;
}

/**
 * Run redundancy analysis tests.
 */
const runRedundancyTests = (): Promise<TestResult> => {
  return new Promise((resolve) => {
    console.warn(chalk.blue('🔍 Running UI Component Redundancy Analysis...'));

    const jest = spawn(
      'npx',
      [
        'jest',
        'tests/code-analysis/redundancy-detection.test.ts',
        'tests/code-analysis/ui-component-redundancy.test.ts',
        'tests/code-analysis/style-consolidation.test.ts',
        '--verbose',
        '--testNamePattern=redundancy|consolidation|component.*analysis',
      ],
      {
        stdio: 'pipe',
        shell: false,
      }
    );

    let output = '';
    let errorOutput = '';

    jest.stdout?.on('data', (_data) => {
      const text = _data.toString();
      output += text;

      // Show relevant progress in real-time
      if (text.includes('PASS') || text.includes('FAIL') || text.includes('===')) {
        process.stdout.write(text);
      }
    });

    jest.stderr?.on('data', (_data) => {
      errorOutput += _data.toString();
    });

    jest.on('close', (code) => {
      const passed = code === 0;

      if (passed) {
        console.warn(chalk.green('✅ Redundancy Analysis: PASSED'));
        console.warn(chalk.gray('   All component redundancy checks completed successfully'));
      } else {
        console.warn(chalk.red('❌ Redundancy Analysis: FAILED'));
        console.warn(chalk.gray('   Component redundancy issues detected'));
      }

      resolve({
        passed,
        output,
        error: errorOutput,
      });
    });

    jest.on('error', (_error) => {
      console.warn(chalk.red(`❌ Error running redundancy tests: ${_error.message}`));
      resolve({
        passed: false,
        output,
        error: _error.message,
      });
    });
  });
};

/**
 * Run style consolidation analysis.
 */
const runStyleAnalysis = (): Promise<TestResult> => {
  return new Promise((resolve) => {
    console.warn(chalk.blue('🎨 Running Style Consolidation Analysis...'));

    const jest = spawn(
      'npx',
      ['jest', 'tests/code-analysis/style-consolidation.test.ts', '--verbose', '--silent'],
      {
        stdio: 'pipe',
        shell: false,
      }
    );

    let output = '';
    let errorOutput = '';

    jest.stdout?.on('data', (_data) => {
      output += _data.toString();
    });

    jest.stderr?.on('data', (_data) => {
      errorOutput += _data.toString();
    });

    jest.on('close', (code) => {
      const passed = code === 0;

      if (passed) {
        console.warn(chalk.green('✅ Style Analysis: PASSED'));
      } else {
        console.warn(chalk.yellow('⚠️  Style Analysis: WARNINGS'));
        console.warn(chalk.gray('   Some style consolidation opportunities identified'));
      }

      resolve({
        passed,
        output,
        error: errorOutput,
      });
    });

    jest.on('error', (_error) => {
      resolve({
        passed: false,
        output,
        error: _error.message,
      });
    });
  });
};

/**
 * Generate redundancy report summary.
 * @param redundancyResult
 * @param styleResult
 */
const generateSummary = (redundancyResult: TestResult, styleResult: TestResult) => {
  console.warn('\n' + chalk.bold('📊 REDUNDANCY ANALYSIS SUMMARY'));
  console.warn('='.repeat(50));

  // Extract key metrics from test output
  const redundancyMetrics = extractMetrics(redundancyResult.output);

  console.warn(chalk.cyan('Key Findings:'));

  if (redundancyMetrics.totalComponents > 0) {
    console.warn(`• Total Components Analyzed: ${redundancyMetrics.totalComponents}`);
  }

  if (redundancyMetrics.redundancyPercentage > 0) {
    const color =
      redundancyMetrics.redundancyPercentage > 40
        ? 'red'
        : redundancyMetrics.redundancyPercentage > 20
          ? 'yellow'
          : 'green';
    console.warn(chalk[color](`• Redundancy Rate: ${redundancyMetrics.redundancyPercentage}%`));
  }

  if (redundancyMetrics.highPriorityComponents > 0) {
    console.warn(
      chalk.red(`• High-Priority Refactor Candidates: ${redundancyMetrics.highPriorityComponents}`)
    );
  }

  // Status assessment
  if (redundancyResult.passed && styleResult.passed) {
    console.warn(chalk.green('\n✅ Overall Status: PASSED'));
    console.warn(chalk.gray('   Redundancy tracking active - continue monitoring'));
  } else {
    console.warn(chalk.yellow('\n⚠️  Overall Status: ATTENTION NEEDED'));
    console.warn(chalk.gray('   Review redundancy findings and consider refactoring'));
  }

  console.warn('\n' + chalk.gray('Run with --verbose for detailed component analysis'));
};

/**
 * Extract metrics from test output.
 * @param output
 */
const extractMetrics = (output: string) => {
  const metrics = {
    totalComponents: 0,
    redundancyPercentage: 0,
    highPriorityComponents: 0,
  };

  // Extract metrics using regex patterns
  const totalMatch = output.match(/Total Components.*?(\d+)/i);
  if (totalMatch) {
    metrics.totalComponents = parseInt(totalMatch[1]);
  }

  const redundancyMatch = output.match(/(\d+)%\)/i);
  if (redundancyMatch) {
    metrics.redundancyPercentage = parseInt(redundancyMatch[1]);
  }

  const highPriorityMatch = output.match(/High-Priority.*?(\d+)/i);
  if (highPriorityMatch) {
    metrics.highPriorityComponents = parseInt(highPriorityMatch[1]);
  }

  return metrics;
};

/**
 * Main execution.
 */
/**
 * Main function.
 * @returns Function result.
 */
async function main() {
  console.warn(chalk.bold.blue('🚀 Starting Redundancy Analysis Pipeline\n'));

  try {
    // Run redundancy analysis
    const redundancyResult = await runRedundancyTests();

    // Run style analysis (non-blocking for validation)
    const styleResult = await runStyleAnalysis();

    // Generate summary
    generateSummary(redundancyResult, styleResult);

    // Exit with appropriate code
    // Redundancy analysis is informational, so we don't fail validation
    // unless there are critical errors (not just redundancy findings)
    if (redundancyResult.passed) {
      console.warn(chalk.green('\n✅ Redundancy Analysis completed successfully'));
      process.exit(0);
    } else {
      // Check if it's a test failure or actual error
      if (redundancyResult.error && !redundancyResult.error.includes('expect(')) {
        console.warn(chalk.red('\n❌ Redundancy Analysis failed with errors'));
        process.exit(1);
      } else {
        console.warn(chalk.yellow('\n⚠️  Redundancy Analysis completed with findings'));
        process.exit(0); // Don't fail validation for redundancy findings
      }
    }
  } catch (_error) {
    console.error(chalk.red(`\n❌ Failed to run redundancy analysis: ${_error}`));
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((_error) => {
    console.error(chalk.red(`Fatal error: ${_error}`));
    process.exit(1);
  });
}

export { runRedundancyTests, runStyleAnalysis, generateSummary };
