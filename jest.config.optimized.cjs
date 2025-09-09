/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.simple.ts'],
  
  // Optimized module name mapping - only essential mappings
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/client/src/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@assets/(.*)$': '<rootDir>/tests/mocks/fileMock.js',
    
    // Essential database mocks only
    '@neondatabase/serverless': '<rootDir>/tests/mocks/serverDbMock.js',
    'drizzle-orm/neon-http': '<rootDir>/tests/mocks/serverDbMock.js',
    'drizzle-orm/neon-serverless': '<rootDir>/tests/mocks/serverDbMock.js',
    
    // CSS and assets (simplified)
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg|webp|bmp|ico|woff|woff2|eot|ttf|otf)$': '<rootDir>/tests/mocks/fileMock.js',
  },
  
  testMatch: ['<rootDir>/tests/**/*.test.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '/server/tests/', '**/*.disabled'],
  
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
        isolatedModules: true,
      },
    ],
  },
  
  // Optimized transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(wouter|@tanstack|@testing-library|@radix-ui|@hookform|lucide-react))'
  ],
  
  // Optimized performance settings
  testTimeout: 8000,
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