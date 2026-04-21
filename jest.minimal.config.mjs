// Using .cjs extension for proper ES module compatibility
export default {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/invitation/invitation-integration.test.ts'],
  testTimeout: 3000,
  maxWorkers: 1,
  forceExit: true,
  cache: false,
  verbose: true,
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { useESM: false }],
  },
};