/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  setupFiles: ['<rootDir>/tests/polyfills.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/client/src/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@assets/(.*)$': '<rootDir>/tests/mocks/fileMock.js',
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/mocks/styleMock.js',
    '\\.(jpg|jpeg|png|gif|svg|webp|bmp|ico|woff|woff2|eot|ttf|otf)$': '<rootDir>/tests/mocks/fileMock.js',
    'wouter/memory': '<rootDir>/tests/mocks/wouter-memory-mock.js',
    '^wouter$': '<rootDir>/tests/mocks/wouter-mock.js'
  },
  testMatch: [
    '<rootDir>/tests/**/*.test.{ts,tsx}',
    '<rootDir>/tests/**/*.spec.{ts,tsx}'
  ],
  collectCoverageFrom: [
    'client/src/**/*.{ts,tsx}',
    'server/**/*.{ts,tsx}',
    'shared/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        jsx: 'react-jsx',
        module: 'ESNext',
        moduleResolution: 'node',
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        target: 'es2020',
        lib: ['es2020', 'dom', 'dom.iterable'],
        isolatedModules: true
      }
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$|wouter|@tanstack|@testing-library|regexparam|@radix-ui|@hookform|msw))'
  ],
  testTimeout: 10000,
  maxWorkers: 1,
  verbose: true
};

export default config;