#!/usr/bin/env tsx
/**
 * @file Organization Validation Script.
 * @description Runs all organization validation tests and generates reports.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

const rootDir = path.resolve(__dirname, '..');

/**
 *
 */
interface TestResult {
  suite: string;
  passed: boolean;
  details: string;
  suggestions: string[];
}

/**
 * Run a test suite and capture results.
 * @param suitePath
 */
/**
 * RunTestSuite function.
 * @param suitePath
 * @returns Function result.
 */
function runTestSuite(suitePath: string): TestResult {
  const suiteName = path.basename(suitePath, '.test.ts');
  console.warn(chalk.blue(`\nRunning ${suiteName}...`));
  
  try {
    const output = execSync(
      `npx jest ${suitePath} --no-coverage --silent`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    
    return {
      suite: suiteName,
      passed: true,
      details: output,
      suggestions: extractSuggestions(output)
    };
  } catch (_error: unknown) {
    return {
      suite: suiteName,
      passed: false,
      details: error.stdout || error.message,
      suggestions: extractSuggestions(error.stdout || '')
    };
  }
}

/**
 * Extract improvement suggestions from test output.
 * @param output
 */
/**
 * ExtractSuggestions function.
 * @param output
 * @returns Function result.
 */
function extractSuggestions(output: string): string[] {
  const suggestions: string[] = [];
  const lines = output.split('\n');
  
  lines.forEach(line => {
    if (line.includes('suggestion:') || 
        line.includes('improvement:') || 
        line.includes('TODO:') ||
        line.includes('Missing')) {
      suggestions.push(line.trim());
    }
  });
  
  return suggestions;
}

/**
 * Generate validation report.
 * @param results
 */
/**
 * GenerateReport function.
 * @param results
 * @returns Function result.
 */
function generateReport(results: TestResult[]): string {
  const timestamp = new Date().toISOString();
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  let report = `# Organization Validation Report
Generated: ${timestamp}

## Summary
- Total test suites: ${results.length}
- Passed: ${passed}
- Failed: ${failed}
- Success rate: ${((passed / results.length) * 100).toFixed(1)}%

## Test Results
`;

  results.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    report += `\n### ${status} ${result.suite}\n`;
    
    if (!result.passed) {
      // Extract key error messages
      const errors = result.details
        .split('\n')
        .filter(line => line.includes('Expected') || line.includes('Error'))
        .slice(0, 5);
      
      if (errors.length > 0) {
        report += '\n**Errors:**\n';
        errors.forEach(error => {
          report += `- ${error.trim()}\n`;
        });
      }
    }
    
    if (result.suggestions.length > 0) {
      report += '\n**Suggestions:**\n';
      result.suggestions.forEach(suggestion => {
        report += `- ${suggestion}\n`;
      });
    }
  });

  // Add improvement actions
  report += `\n## Recommended Actions

### Immediate Actions
1. Fix any failing tests in error-detection suite
2. Resolve documentation redundancies identified
3. Update outdated documentation files

### Short-term Improvements
1. Add missing documentation for undocumented APIs
2. Improve readability scores for complex documents
3. Add table of contents to long documentation files

### Long-term Goals
1. Maintain 100% test coverage for critical paths
2. Implement automated documentation generation
3. Set up continuous documentation quality monitoring

## Next Steps
1. Review and fix failing tests
2. Update documentation based on suggestions
3. Run validation again to verify improvements
`;

  return report;
}

/**
 * Main validation function.
 */
/**
 * ValidateOrganization function.
 * @returns Function result.
 */
async function validateOrganization() {
  console.warn(chalk.bold.green('\n🔍 Organization Validation Starting...\n'));

  const testSuites = [
    'tests/organization/project-structure.test.ts',
    'tests/organization/documentation-validation.test.ts',
    'tests/organization/error-detection.test.ts',
    'tests/organization/documentation-improvement.test.ts'
  ];

  const results: TestResult[] = [];

  // Run each test suite
  for (const suite of testSuites) {
    const suitePath = path.join(rootDir, suite);
    if (fs.existsSync(suitePath)) {
      const result = runTestSuite(suitePath);
      results.push(_result);
    } else {
      console.warn(chalk.yellow(`⚠️  Test suite not found: ${suite}`));
    }
  }

  // Generate and save report
  const report = generateReport(results);
  const reportPath = path.join(rootDir, 'ORGANIZATION_VALIDATION_REPORT.md');
  fs.writeFileSync(reportPath, report);

  // Print summary
  console.warn(chalk.bold.blue('\n📊 Validation Summary:\n'));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  results.forEach(result => {
    const status = result.passed ? chalk.green('✅') : chalk.red('❌');
    console.warn(`${status} ${result.suite}`);
  });

  console.warn(chalk.bold(`\nTotal: ${passed} passed, ${failed} failed`));
  console.warn(chalk.cyan(`\n📄 Full report saved to: ${reportPath}\n`));

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run validation
validateOrganization().catch(error => {
  console.error(chalk.red('Validation failed with _error:'), _error);
  process.exit(1);
});