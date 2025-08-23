/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  setupFiles: ['<rootDir>/tests/polyfills.js'],
  moduleNameMapper: {
    // Asset mocks must come BEFORE general path mappings
    '^@/assets/(.*)$': '<rootDir>/tests/mocks/fileMock.js',
    '^@assets/(.*)$': '<rootDir>/tests/mocks/fileMock.js',
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/mocks/styleMock.js',
    '\\.(jpg|jpeg|png|gif|svg|webp|bmp|ico|woff|woff2|eot|ttf|otf)$': '<rootDir>/tests/mocks/fileMock.js',
    // Path mappings
    '^@/(.*)$': '<rootDir>/client/src/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@/lib/db$': '<rootDir>/server/db.ts',
    // Router mocks
    'wouter/memory': '<rootDir>/tests/mocks/wouter-memory-mock.js',
    'wouter/memory-location': '<rootDir>/tests/mocks/wouter-memory-mock.js',
    '^wouter$': '<rootDir>/tests/mocks/wouter-mock.js',
    // Build tool mocks
    '^../vite$': '<rootDir>/tests/mocks/viteMock.js',
    '^./vite$': '<rootDir>/tests/mocks/viteMock.js'
  },
  testMatch: [
    '<rootDir>/tests/**/*.test.{ts,tsx}',
    '<rootDir>/tests/**/*.spec.{ts,tsx}'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tools/',
    '/build/',
    '/dist/'
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
        jsxImportSource: 'react',
        module: 'ESNext',
        moduleResolution: 'bundler',
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        target: 'es2022',
        lib: ['es2022', 'dom', 'dom.iterable'],
        isolatedModules: true,
        skipLibCheck: true,
        types: ['node', 'jest', '@testing-library/jest-dom']
      }
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$|wouter|@tanstack|@testing-library|regexparam|@radix-ui|@hookform|msw|@jest|@babel))'
  ],
  testTimeout: 30000,
  maxWorkers: 1,
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  // Improve React component testing
  testEnvironmentOptions: {
    customExportConditions: [''],
    url: 'http://localhost:3000'
  }
};

export default config;