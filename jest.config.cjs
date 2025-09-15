/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  
  // Optimized module name mapping - only essential mappings
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/client/src/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@assets/(.*)$': '<rootDir>/__mocks__/fileMock.js',
    
    // Complete database isolation - prevent any real connections
    '@neondatabase/serverless': '<rootDir>/__mocks__/enhanced-database-mock.js',
    'drizzle-orm/neon-http': '<rootDir>/__mocks__/enhanced-database-mock.js',
    'drizzle-orm/neon-serverless': '<rootDir>/__mocks__/enhanced-database-mock.js',
    'drizzle-orm/pg-core': '<rootDir>/__mocks__/enhanced-database-mock.js',
    'drizzle-orm': '<rootDir>/__mocks__/enhanced-database-mock.js',
    'drizzle-zod': '<rootDir>/__mocks__/enhanced-database-mock.js',
    
    // Server module mocks to prevent real imports
    '^../server/db$': '<rootDir>/__mocks__/server/db.ts',
    '^../server/storage$': '<rootDir>/__mocks__/server/storage.ts',
    '^../../server/db$': '<rootDir>/__mocks__/server/db.ts', 
    '^../../server/storage$': '<rootDir>/__mocks__/server/storage.ts',
    '^../../../server/routes$': '<rootDir>/__mocks__/server/routes.ts',
    '^../../server/routes$': '<rootDir>/__mocks__/server/routes.ts',
    '^../server/routes$': '<rootDir>/__mocks__/server/routes.ts',
    '^../../../server/auth$': '<rootDir>/__mocks__/server/auth.ts',
    '^../../server/auth$': '<rootDir>/__mocks__/server/auth.ts',
    '^../server/auth$': '<rootDir>/__mocks__/server/auth.ts',
    
    // Schema mocks to prevent drizzle-orm imports
    '^../../../shared/schema$': '<rootDir>/__mocks__/shared/schema.ts',
    '^../../shared/schema$': '<rootDir>/__mocks__/shared/schema.ts',
    '^../shared/schema$': '<rootDir>/__mocks__/shared/schema.ts',
    
    // CSS and assets (simplified)
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg|webp|bmp|ico|woff|woff2|eot|ttf|otf)$': '<rootDir>/__mocks__/fileMock.js',
  },
  
  testMatch: ['<rootDir>/tests/**/*.test.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '/server/tests/', '\\.disabled'],
  
  collectCoverageFrom: [
    'client/src/**/*.{ts,tsx}',
    'shared/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  
  preset: 'ts-jest',
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.test.json',
      },
    ],
  },
  
  // Optimized transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(wouter|@tanstack|@testing-library|@radix-ui|@hookform|lucide-react|@google/genai|regexparam|@google-cloud))'
  ],
  
  // Performance settings - remove duplicates and optimize
  testTimeout: 25000,
  maxWorkers: 1,
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  detectOpenHandles: false,
  forceExit: true,
  clearMocks: true,
  restoreMocks: true,
  resetMocks: false,
  resetModules: false,
  verbose: false,
  passWithNoTests: false,
  
  // Memory and performance optimizations
  workerIdleMemoryLimit: '256MB',
  errorOnDeprecated: false,
  
  // CI/CD Guardrails
  collectCoverage: process.env.CI === 'true',
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Optimize module resolution
  modulePathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/.cache/',
    '<rootDir>/node_modules/.cache/',
  ],
  
  // Faster haste map
  haste: {
    enableSymlinks: false,
  },
};

module.exports = config;