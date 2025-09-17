/**
 * @file Jest Configuration for Budget-Related Tests Only
 * @description Focused test configuration to run only budget forecasting tests
 */

const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  displayName: 'Budget Tests',
  
  // Focus only on budget-related test files
  testMatch: [
    '**/tests/**/*budget*.test.{js,jsx,ts,tsx}',
    '**/tests/**/budgets*.test.{js,jsx,ts,tsx}',
    '**/tests/**/*forecast*.test.{js,jsx,ts,tsx}',
    '**/tests/**/budgetCalculations*.test.{js,jsx,ts,tsx}',
  ],
  
  // Include server utils for budget calculations
  testPathIgnorePatterns: [
    ...baseConfig.testPathIgnorePatterns || [],
    // Ignore all non-budget test files to focus on budget testing only
    '**/tests/**/(?!.*budget)(?!.*forecast)(?!.*Budget).*\\.test\\.(js|jsx|ts|tsx)$',
  ],
  
  // Collect coverage only from budget-related files
  collectCoverageFrom: [
    // Budget API routes
    'server/api/budgets.{js,ts}',
    
    // Budget calculation utilities
    'server/utils/budgetCalculations.{js,ts}',
    
    // Budget page components
    'client/src/pages/manager/budget.{js,jsx,ts,tsx}',
    
    // Budget-related components
    'client/src/components/**/*budget*.{js,jsx,ts,tsx}',
    'client/src/components/**/*Budget*.{js,jsx,ts,tsx}',
    
    // Exclude non-budget files from coverage
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!**/*.config.{js,ts}',
    '!**/*.d.ts',
  ],
  
  // Add specific setupFiles for budget tests
  setupFilesAfterEnv: [
    ...(baseConfig.setupFilesAfterEnv || []),
    '<rootDir>/tests/setup/budget.setup.js',
  ],
  
  // Override test environment settings for budget tests
  testEnvironment: 'jsdom',
  
  // Custom test timeout for integration tests
  testTimeout: 15000,
  
  // Verbose output for budget test debugging
  verbose: true,
  
  // Focus on budget test results
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'coverage/budget',
        outputName: 'budget-test-results.xml',
        classNameTemplate: 'Budget.{classname}',
        titleTemplate: 'Budget: {title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true,
      },
    ],
  ],
  
  // Coverage thresholds specific to budget functionality
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    // Specific thresholds for critical budget files
    'server/api/budgets.ts': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    'server/utils/budgetCalculations.ts': {
      branches: 95,
      functions: 100,
      lines: 95,
      statements: 95,
    },
  },
};