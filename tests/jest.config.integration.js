/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testEnvironment: 'node', // Use node environment for integration tests
  setupFilesAfterEnv: ['<rootDir>/setup-integration.ts'],
  testMatch: ['<rootDir>/integration/**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/client/src/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@server/(.*)$': '<rootDir>/server/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
    '^@assets/(.*)$': '<rootDir>/attached_assets/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: true,
      tsconfig: 'tsconfig.json',
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$|@testing-library|msw|@bundled-es-modules))',
  ],
  // Disable MSW for integration tests
  globals: {
    'process.env.NODE_ENV': 'test',
    'process.env.DISABLE_MSW': 'true',
    'process.env.TEST_ENV': 'integration',
  },
  maxWorkers: 1, // Run tests sequentially to avoid database conflicts
  testTimeout: 30000,
};