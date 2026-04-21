/** @type {import('jest').Config} */
const baseConfig = require('./jest.config.cjs');

// Authentication-specific test configuration with selective unmocking
const authConfig = {
  ...baseConfig,
  
  // Override display name for auth tests
  displayName: 'Authentication & Security Tests',
  
  // Specific test patterns for auth and security tests
  testMatch: [
    '<rootDir>/tests/**/*auth*.test.{ts,tsx}',
    '<rootDir>/tests/**/*security*.test.{ts,tsx}',
    '<rootDir>/tests/**/*rbac*.test.{ts,tsx}',
    '<rootDir>/tests/**/*permission*.test.{ts,tsx}',
    '<rootDir>/tests/critical/authentication*.test.{ts,tsx}',
    '<rootDir>/tests/integration/authentication*.test.{ts,tsx}',
    '<rootDir>/tests/integration/api-authorization*.test.{ts,tsx}',
    '<rootDir>/tests/security/**/*.test.{ts,tsx}',
    '<rootDir>/tests/unit/auth/**/*.test.{ts,tsx}',
    '<rootDir>/tests/unit/security/**/*.test.{ts,tsx}',
  ],
  
  // Enhanced module name mapping for selective unmocking of auth
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    
    // Use selective auth mock instead of full mock for better testing
    '^../../../server/auth$': '<rootDir>/__mocks__/server/auth-selective.ts',
    '^../../server/auth$': '<rootDir>/__mocks__/server/auth-selective.ts',
    '^../server/auth$': '<rootDir>/__mocks__/server/auth-selective.ts',
    '^server/auth(?:/index\\.ts)?$': '<rootDir>/__mocks__/server/auth-selective.ts',
  },
  
  // Setup files specific to auth testing
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.ts',
    '<rootDir>/tests/setup/auth-test-setup.ts'
  ],
  
  // Environment variables for auth testing
  setupFiles: ['<rootDir>/tests/setup/auth-env-setup.js'],
  
  // Increased timeout for authentication tests (they may involve bcrypt)
  testTimeout: 20000,
  
  // More focused coverage for auth components
  collectCoverageFrom: [
    'server/auth/**/*.{ts,tsx}',
    'server/middleware/**/*.{ts,tsx}',
    'server/api/**/*.{ts,tsx}',
    'shared/schemas/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  
  // Enhanced performance for auth tests
  maxWorkers: 1, // Sequential execution for session tests
  cache: false, // Disable cache for auth tests to ensure fresh state
  
  // Stricter error handling for auth tests
  errorOnDeprecated: true,
  verbose: true,
  
  // Force exit after auth tests (prevent hanging)
  forceExit: true,
  
  // Clear all mocks between tests for clean state
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
};

module.exports = authConfig;