#!/usr/bin/env tsx

/**
 * LLM Form Mapping Validation Script.
 * 
 * This script validates that the AI/LLM help form returns responses 
 * that map exactly to the form fields available in the application.
 * 
 * Usage:
 *   npm run validate-llm-mapping
 *   npx tsx scripts/validate-llm-form-mapping.ts
 *   npx tsx scripts/validate-llm-form-mapping.ts --include-integration
 *   npx tsx scripts/validate-llm-form-mapping.ts --report.
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Display help information.
 */
/**
 * DisplayHelp function.
 * @returns Function result.
 */
function displayHelp() {
  console.warn(`
${colors.bright}${colors.blue}=== LLM FORM MAPPING VALIDATION ===${colors.reset}

${colors.bright}Description:${colors.reset}
  Validates that AI/LLM responses map exactly to form fields in the application.
  Ensures consistency between AI-generated content and form structure.

${colors.bright}Usage:${colors.reset}
  npm run validate-llm-mapping                           # Run unit tests only
  npx tsx scripts/validate-llm-form-mapping.ts           # Run unit tests only
  npx tsx scripts/validate-llm-form-mapping.ts --help    # Show this help
  npx tsx scripts/validate-llm-form-mapping.ts --integration # Include integration tests
  npx tsx scripts/validate-llm-form-mapping.ts --report  # Generate detailed report

${colors.bright}Options:${colors.reset}
  --help, -h          Show this help message
  --integration, -i   Include integration tests (requires GEMINI_API_KEY)
  --report, -r        Generate detailed validation report
  --output FILE       Save report to specified file
  --verbose, -v       Show detailed test output

${colors.bright}Examples:${colors.reset}
  # Run all tests including integration (requires API key)
  npx tsx scripts/validate-llm-form-mapping.ts --integration

  # Generate a detailed report
  npx tsx scripts/validate-llm-form-mapping.ts --report --output llm-validation-report.txt

  # Run unit tests with verbose output
  npx tsx scripts/validate-llm-form-mapping.ts --verbose
`);
}

/**
 * Parse command line arguments.
 */
/**
 * ParseArguments function.
 * @returns Function result.
 */
function parseArguments(): {
  help: boolean;
  integration: boolean;
  report: boolean;
  verbose: boolean;
  output?: string;
} {
  const args = process.argv.slice(2);
  
  return {
    help: args.includes('--help') || args.includes('-h'),
    integration: args.includes('--integration') || args.includes('-i'),
    report: args.includes('--report') || args.includes('-r'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    output: (() => {
      const outputIndex = args.findIndex(arg => arg === '--output');
      return outputIndex !== -1 ? args[outputIndex + 1] : undefined;
    })()
  };
}

/**
 * Run Jest tests and capture results.
 * @param testPattern
 * @param verbose
 */
/**
 * RunTests function.
 * @param testPattern
 * @param verbose
 * @returns Function result.
 */
function runTests(testPattern: string, verbose: boolean = false): {
  success: boolean;
  output: string;
  summary: {
    passed: number;
    failed: number;
    total: number;
  };
} {
  try {
    const verboseFlag = verbose ? '--verbose' : '';
    const command = `npx jest ${testPattern} ${verboseFlag} --passWithNoTests --json`;
    const output = execSync(command, { 
      encoding: 'utf-8',
      cwd: process.cwd()
    });
    
    // Parse Jest JSON output
    const lastLine = output.trim().split('\n').pop();
    const result = JSON.parse(lastLine || '{}');
    
    return {
      success: result.success || false,
      output: output,
      summary: {
        passed: result.numPassedTests || 0,
        failed: result.numFailedTests || 0,
        total: result.numTotalTests || 0
      }
    };
  } catch (_error: unknown) {
    // Try to parse error output for test results
    let summary = { passed: 0, failed: 1, total: 1 };
    try {
      const errorOutput = error.stdout || error.stderr || '';
      const lines = errorOutput.split('\n');
      const jsonLine = lines.find(line => line.trim().startsWith('{') && line.includes('numTotalTests'));
      if (jsonLine) {
        const result = JSON.parse(jsonLine);
        summary = {
          passed: result.numPassedTests || 0,
          failed: result.numFailedTests || 0,
          total: result.numTotalTests || 0
        };
      }
    } catch (__parseError) {
      // Use default summary
    }
    
    return {
      success: false,
      output: error.stdout + error.stderr,
      summary
    };
  }
}

/**
 * Generate comprehensive validation report.
 * @param includeIntegration
 * @param verbose
 */
/**
 * GenerateReport function.
 * @param includeIntegration
 * @param verbose
 * @returns Function result.
 */
function generateReport(includeIntegration: boolean, verbose: boolean): string {
  const timestamp = new Date().toLocaleString('en-CA', {
    timeZone: 'America/Montreal',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  let report = `
════════════════════════════════════════════════════════════════
                  LLM FORM MAPPING VALIDATION REPORT
                        KOVEO GESTION PLATFORM
════════════════════════════════════════════════════════════════

Generated: ${timestamp}
System: Koveo Gestion - Property Management Platform
Purpose: Validate AI/LLM responses map to application form structure

`;

  // Run unit tests for LLM form mapping
  console.warn(`${colors.cyan}🧪 Running LLM form mapping unit tests...${colors.reset}`);
  const unitTestResult = runTests('tests/unit/llm-form-mapping.test.ts', verbose);
  
  report += `
════════════════════════════════════════════════════════════════
                       UNIT TESTS - FORM MAPPING
════════════════════════════════════════════════════════════════

Tests validating form field structure and AI response mapping
`;
  
  if (unitTestResult.success) {
    report += `✅ Status: PASSED
📊 Results: ${unitTestResult.summary.passed}/${unitTestResult.summary.total} tests passed
✨ All form mapping validations successful
`;
  } else {
    report += `❌ Status: FAILED
📊 Results: ${unitTestResult.summary.passed}/${unitTestResult.summary.total} tests passed
⚠️  ${unitTestResult.summary.failed} test(s) failed
🔧 Form mapping issues detected that need attention
`;
  }

  let integrationTestResult = null;

  // Run integration tests if requested and API key is available
  if (includeIntegration) {
    if (process.env.GEMINI_API_KEY) {
      console.warn(`${colors.cyan}🚀 Running AI integration tests...${colors.reset}`);
      integrationTestResult = runTests('tests/integration/ai-form-response-validation.test.ts', verbose);
      
      report += `
════════════════════════════════════════════════════════════════
                   INTEGRATION TESTS - AI SERVICE
════════════════════════════════════════════════════════════════

Tests validating real AI service responses with live API calls
`;
      
      if (integrationTestResult.success) {
        report += `✅ Status: PASSED
📊 Results: ${integrationTestResult.summary.passed}/${integrationTestResult.summary.total} tests passed
🤖 AI service responses properly mapped to form structure
`;
      } else {
        report += `❌ Status: FAILED
📊 Results: ${integrationTestResult.summary.passed}/${integrationTestResult.summary.total} tests passed
⚠️  ${integrationTestResult.summary.failed} test(s) failed
🔧 AI service integration issues detected
`;
      }
    } else {
      report += `
════════════════════════════════════════════════════════════════
                   INTEGRATION TESTS - SKIPPED
════════════════════════════════════════════════════════════════

⚠️  Integration tests skipped - GEMINI_API_KEY not configured
💡 Set GEMINI_API_KEY environment variable to run AI integration tests
`;
    }
  }

  // Calculate overall summary
  const totalPassed = unitTestResult.summary.passed + (integrationTestResult?.summary.passed || 0);
  const totalFailed = unitTestResult.summary.failed + (integrationTestResult?.summary.failed || 0);
  const totalTests = totalPassed + totalFailed;
  
  report += `
════════════════════════════════════════════════════════════════
                         OVERALL SUMMARY
════════════════════════════════════════════════════════════════

📈 Total tests executed: ${totalTests}
✅ Tests passed: ${totalPassed}
❌ Tests failed: ${totalFailed}
📊 Success rate: ${totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0}%

`;

  if (totalFailed === 0) {
    report += `🎉 EXCELLENT!
   All LLM form mapping validations passed successfully.
   AI responses properly map to application form structure.
   Form field consistency is maintained.
`;
  } else if (totalFailed <= 2) {
    report += `⚠️  MINOR ISSUES DETECTED
   Most validations passed with only minor issues.
   Review failed tests for specific mapping problems.
`;
  } else if (totalFailed <= 5) {
    report += `🔧 MODERATE ISSUES DETECTED
   Several mapping validation failures detected.
   Form-AI integration requires attention and fixes.
`;
  } else {
    report += `🚨 SIGNIFICANT ISSUES DETECTED
   Multiple validation failures indicate serious mapping problems.
   Comprehensive review of form-AI integration required.
`;
  }

  report += `
════════════════════════════════════════════════════════════════
                           RECOMMENDATIONS
════════════════════════════════════════════════════════════════

1. 🔄 CONTINUOUS VALIDATION
   - Run these tests before every AI service deployment
   - Include LLM mapping validation in CI/CD pipeline
   - Monitor AI response consistency over time

2. 📋 FORM FIELD MAINTENANCE
   - Keep form field structure synchronized with AI prompts
   - Update validation tests when adding new form fields
   - Document any changes to form-AI mapping logic

3. 🤖 AI SERVICE MONITORING
   - Set up alerts for AI response structure changes
   - Regularly validate AI responses against form schema
   - Monitor API response times and error rates

4. 🧪 TESTING BEST PRACTICES
   - Run integration tests with real API keys in staging
   - Mock AI responses for unit tests to avoid API costs
   - Test edge cases and error scenarios regularly

5. 📊 QUALITY METRICS
   - Track AI response consistency metrics
   - Monitor form completion rates and user feedback
   - Measure AI-generated content quality scores

════════════════════════════════════════════════════════════════
              END REPORT - ${timestamp}
════════════════════════════════════════════════════════════════
`;

  if (verbose && (unitTestResult.output || integrationTestResult?.output)) {
    report += `
════════════════════════════════════════════════════════════════
                        DETAILED TEST OUTPUT
════════════════════════════════════════════════════════════════

${unitTestResult.output}

${integrationTestResult?.output || ''}
`;
  }

  return report;
}

/**
 * Main execution function.
 */
/**
 * Main function.
 * @returns Function result.
 */
function main() {
  const args = parseArguments();
  
  if (args.help) {
    displayHelp();
    return;
  }
  
  console.warn(`${colors.bright}${colors.blue}=== LLM FORM MAPPING VALIDATION ===${colors.reset}\n`);
  
  if (args.integration) {
    if (process.env.GEMINI_API_KEY) {
      console.warn(`${colors.green}🔑 GEMINI_API_KEY detected - including integration tests${colors.reset}`);
    } else {
      console.warn(`${colors.yellow}⚠️  GEMINI_API_KEY not set - integration tests will be skipped${colors.reset}`);
    }
  }
  
  try {
    const report = generateReport(args.integration, args.verbose);
    
    console.warn(report);
    
    if (args.output) {
      writeFileSync(args.output, report, 'utf-8');
      console.warn(`\n${colors.green}📄 Report saved to: ${args.output}${colors.reset}`);
    }
    
    // Exit with error code if tests failed
    if (report.includes('❌ Status: FAILED')) {
      console.warn(`\n${colors.red}⚠️  Some validation tests failed. Review the report for details.${colors.reset}`);
      process.exit(1);
    } else {
      console.warn(`\n${colors.green}✅ All LLM form mapping validations passed successfully!${colors.reset}`);
      process.exit(0);
    }
    
  } catch (__error) {
    console.error(`${colors.red}❌ Error during validation:${colors.reset}`, error);
    process.exit(1);
  }
}

// Run if called directly (ES module equivalent)
const isMainModule = import.meta.url === new URL(process.argv[1], 'file://').href;
if (isMainModule) {
  main();
}

export { generateReport, runTests };