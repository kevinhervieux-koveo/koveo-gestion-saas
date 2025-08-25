#!/usr/bin/env tsx

/**
 * Script to run comprehensive bug reporting system tests.
 * Runs both frontend and API tests for the bug functionality.
 */

import { execSync } from 'child_process';
import path from 'path';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

/**
 *
 * @param message
 * @param color
 */
function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 *
 * @param command
 * @param description
 */
function runCommand(command: string, description: string): boolean {
  try {
    log(`\n${colors.blue}${colors.bold}${description}${colors.reset}`);
    log(`Running: ${command}`);
    
    execSync(command, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    log(`${colors.green}✅ ${description} completed successfully${colors.reset}`);
    return true;
  } catch (error) {
    log(`${colors.red}❌ ${description} failed${colors.reset}`);
    log(`Error: ${error.message}`);
    return false;
  }
}

/**
 *
 */
async function main() {
  log(`${colors.bold}${colors.blue}🐛 Bug Reporting System Test Suite${colors.reset}`);
  log('='.repeat(50));

  const testResults = {
    passed: 0,
    failed: 0,
    total: 0
  };

  // Test configuration
  const tests = [
    {
      command: 'npm run test -- tests/unit/bugs-frontend.test.tsx --verbose',
      description: '🎨 Frontend UI Tests - Bug Reporting Page'
    },
    {
      command: 'npm run test -- tests/integration/bugs-api.test.ts --verbose',
      description: '🔌 API Integration Tests - Bug CRUD Operations'
    },
    {
      command: 'npm run test -- tests/integration/page-language-validation.test.tsx --testNamePattern="Bug Reports.*language" --verbose',
      description: '🇫🇷 Language Validation - Bug Reports Page'
    },
    {
      command: 'npm run test -- tests/integration/page-language-validation.test.tsx --testNamePattern="Settings.*language" --verbose',
      description: '🇫🇷 Language Validation - Settings Page'
    }
  ];

  log(`\n${colors.yellow}Running ${tests.length} test suites...${colors.reset}\n`);

  // Run each test suite
  for (const test of tests) {
    testResults.total++;
    
    const success = runCommand(test.command, test.description);
    if (success) {
      testResults.passed++;
    } else {
      testResults.failed++;
    }
  }

  // Summary
  log('\n' + '='.repeat(50));
  log(`${colors.bold}📊 Test Results Summary${colors.reset}`);
  log('='.repeat(50));
  
  log(`Total test suites: ${testResults.total}`);
  log(`${colors.green}Passed: ${testResults.passed}${colors.reset}`);
  log(`${colors.red}Failed: ${testResults.failed}${colors.reset}`);

  if (testResults.failed === 0) {
    log(`\n${colors.green}${colors.bold}🎉 All bug reporting tests passed!${colors.reset}`);
    log(`${colors.green}The bug reporting system is fully functional and well-tested.${colors.reset}`);
  } else {
    log(`\n${colors.red}${colors.bold}❌ Some tests failed.${colors.reset}`);
    log(`${colors.yellow}Please review the failed tests above and fix any issues.${colors.reset}`);
  }

  // Additional test commands for manual testing
  log(`\n${colors.blue}${colors.bold}🔧 Additional Manual Testing Commands:${colors.reset}`);
  log(''.padEnd(50, '-'));
  log(`${colors.yellow}Run all bug tests:${colors.reset}`);
  log('npm run test -- --testPathPattern="bugs" --verbose');
  log(`\n${colors.yellow}Run specific test file:${colors.reset}`);
  log('npm run test -- tests/unit/bugs-frontend.test.tsx');
  log('npm run test -- tests/integration/bugs-api.test.ts');
  log(`\n${colors.yellow}Run with coverage:${colors.reset}`);
  log('npm run test -- --coverage --testPathPattern="bugs"');
  log(`\n${colors.yellow}Run in watch mode:${colors.reset}`);
  log('npm run test -- --watch --testPathPattern="bugs"');

  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Handle errors gracefully
process.on('uncaughtException', (error) => {
  log(`${colors.red}Uncaught exception: ${error.message}${colors.reset}`, colors.red);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log(`${colors.red}Unhandled rejection: ${reason}${colors.reset}`, colors.red);
  process.exit(1);
});

// Run the script
main().catch((error) => {
  log(`${colors.red}Script failed: ${error.message}${colors.reset}`, colors.red);
  process.exit(1);
});