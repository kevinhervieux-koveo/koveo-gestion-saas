/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.simple.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/client/src/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@assets/(.*)$': '<rootDir>/tests/mocks/fileMock.js',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg|webp|bmp|ico|woff|woff2|eot|ttf|otf)$': '<rootDir>/tests/mocks/fileMock.js',
    // Mock server API routes for integration tests
    '^../../server/api/(.*)$': '<rootDir>/tests/mocks/serverApiMock.js',
    '^../../shared/schema$': '<rootDir>/tests/mocks/schemaMock.js',
    '^../../server/config/(.*)$': '<rootDir>/tests/mocks/configMock.js',
    '^../../server/routes$': '<rootDir>/tests/mocks/serverRoutesMock.js',
    '^../../server/db$': '<rootDir>/tests/mocks/serverDbMock.js',
  },
  testMatch: ['<rootDir>/tests/**/*.test.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/'],
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
        useESM: true,
      },
    ],
    '^.+\\.(js|jsx|mjs)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$|wouter|@tanstack|@testing-library|regexparam|@radix-ui|@hookform|react|lucide-react))'
  ],
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  verbose: false,
  passWithNoTests: false,
  maxWorkers: 1,
  cache: false,
  detectOpenHandles: true,
  forceExit: true,
  resetModules: true,
};

module.exports = config;