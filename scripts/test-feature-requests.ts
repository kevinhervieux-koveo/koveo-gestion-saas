#!/usr/bin/env tsx

/**
 * Feature Request Testing Script
 * 
 * This script runs comprehensive tests for the feature request functionality,
 * including both integration tests (API) and frontend tests (UI).
 * 
 * Usage:
 *   npm run test:feature-requests
 *   or
 *   tsx scripts/test-feature-requests.ts
 */

import { execSync } from 'child_process';
import chalk from 'chalk';

console.log(chalk.blue('🧪 Starting Feature Request Tests'));
console.log(chalk.gray('Testing both API and UI functionality...\n'));

try {
  // Run integration tests first (API)
  console.log(chalk.yellow('📡 Running Integration Tests (API)...'));
  execSync('npx jest tests/integration/demo-feature-requests-functionality.test.ts --verbose', {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  console.log(chalk.green('✅ Integration tests passed!\n'));

  // Run frontend tests (UI)
  console.log(chalk.yellow('🎨 Running Frontend Tests (UI)...'));
  execSync('npx jest tests/unit/feature-requests-frontend.test.tsx --verbose', {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  console.log(chalk.green('✅ Frontend tests passed!\n'));
  
  // Summary
  console.log(chalk.green.bold('🎉 All Feature Request Tests Passed!'));
  console.log(chalk.gray('The feature request system is fully tested and working correctly.'));
  
} catch (error) {
  console.error(chalk.red('❌ Tests failed:'));
  console.error(error);
  process.exit(1);
}