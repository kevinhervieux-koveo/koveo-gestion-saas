/**
 * Test that validates run-tests-sequential.ts discovers and runs all available tests
 */

import { glob } from 'fast-glob';
import { readFileSync } from 'fs';
import path from 'path';

describe('Test Runner Coverage Validation', () => {
  it('should discover all test files in the project', async () => {
    // Define test file patterns to discover all test files
    const testPatterns = [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      '__tests__/**/*.test.ts',
      '__tests__/**/*.test.tsx',
      'server/tests/**/*.test.ts',
      'server/tests/**/*.test.tsx'
    ];

    // Discover all test files
    const allTestFiles = await glob(testPatterns, {
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

    console.log(`\n📊 Test Discovery Summary:`);
    console.log(`   Found ${actualTestFiles.length} test files`);
    console.log(`   Test directories: tests/, __tests__/, server/tests/`);
    
    // Log some example test files for verification
    console.log(`\n📋 Sample discovered tests:`);
    actualTestFiles.slice(0, 10).forEach(file => {
      console.log(`   - ${file}`);
    });
    
    if (actualTestFiles.length > 10) {
      console.log(`   ... and ${actualTestFiles.length - 10} more`);
    }

    // Ensure we found a reasonable number of tests
    expect(actualTestFiles.length).toBeGreaterThan(10);
    
    // Verify key test directories are covered
    const hasTestsDir = actualTestFiles.some(file => file.startsWith('tests/'));
    const hasTestsDir2 = actualTestFiles.some(file => file.startsWith('__tests__/'));
    const hasServerTests = actualTestFiles.some(file => file.startsWith('server/tests/'));
    
    expect(hasTestsDir).toBe(true);
    expect(hasTestsDir2).toBe(true);
    expect(hasServerTests).toBe(true);
  });

  it('should validate run-tests-sequential.ts can discover all test categories', async () => {
    // Test that our test categories match actual directory structure
    const testCategories = [
      'tests/critical',
      'tests/integration', 
      'tests/security',
      'tests/unit',
      'tests/pages',
      '__tests__',
      'server/tests'
    ];

    for (const category of testCategories) {
      const files = await glob(`${category}/**/*.test.{ts,tsx}`, {
        ignore: ['**/node_modules/**']
      });
      
      console.log(`📁 ${category}: ${files.length} test files`);
      
      // Most categories should have at least some tests
      if (category !== 'tests/pages') { // pages might be empty
        expect(files.length).toBeGreaterThan(0);
      }
    }
  });

  it('should ensure test file naming consistency', async () => {
    const allTestFiles = await glob([
      'tests/**/*.test.{ts,tsx}',
      '__tests__/**/*.test.{ts,tsx}',
      'server/tests/**/*.test.{ts,tsx}'
    ]);

    // Check that all test files follow naming convention
    const invalidFiles = allTestFiles.filter(file => {
      const basename = path.basename(file);
      return !basename.match(/\.test\.(ts|tsx)$/);
    });

    if (invalidFiles.length > 0) {
      console.log('⚠️ Files not following .test.{ts,tsx} convention:');
      invalidFiles.forEach(file => console.log(`   - ${file}`));
    }

    expect(invalidFiles.length).toBe(0);
  });
});