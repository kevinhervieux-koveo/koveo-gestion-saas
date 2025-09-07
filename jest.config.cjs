/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.simple.ts'],
  // Temporarily disable global setup/teardown to debug hanging issues
  // globalSetup: '<rootDir>/jest.global-setup.js',
  // globalTeardown: '<rootDir>/jest.global-teardown.js',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/client/src/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@assets/(.*)$': '<rootDir>/tests/mocks/fileMock.js',
    // Fix database mock imports
    '^\\./server/db$': '<rootDir>/tests/mocks/database.js',
    '^\\./tests/mocks/database$': '<rootDir>/tests/mocks/database.js',
    // Mock problematic ES modules
    '@google/genai': '<rootDir>/tests/mocks/googleGenaiMock.js',
    // Mock CSS and assets
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg|webp|bmp|ico|woff|woff2|eot|ttf|otf)$':
      '<rootDir>/tests/mocks/fileMock.js',
  },
  testMatch: ['<rootDir>/tests/**/*.test.{ts,tsx}', '<rootDir>/tests/**/*.spec.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '/server/tests/'],
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
    '^.+\\.js$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'CommonJS',
          target: 'ES2022',
          allowJs: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },

      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$|wouter|@tanstack|@testing-library|regexparam|@radix-ui|@hookform|react|stream/web|lucide-react|drizzle-orm|drizzle-zod|@neondatabase))'
  ],
  testTimeout: 15000,
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  verbose: false,
  passWithNoTests: false,
  // Performance optimizations
  maxWorkers: '50%',
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  detectOpenHandles: true,
  forceExit: true,
  // Faster test isolation
  resetModules: false,
  // Skip expensive operations
  haste: {
    enableSymlinks: false,
  },
  // Optimize module resolution
  modulePathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/.cache/',
    '<rootDir>/node_modules/.cache/',
  ],
};

module.exports = config;
