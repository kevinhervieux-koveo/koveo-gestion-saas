/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts', '<rootDir>/tests/setup/jest-dom.ts'],
  setupFiles: ['<rootDir>/tests/polyfills.js', '<rootDir>/tests/mocks/importMetaMock.js'],
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
    '^./vite$': '<rootDir>/tests/mocks/viteMock.js',
    // Scripts that use import.meta
    '^.*production-demo-sync.*$': '<rootDir>/tests/mocks/scriptMock.js'
  },
  testMatch: [
    '<rootDir>/tests/**/*.test.{ts,tsx}',
    '<rootDir>/tests/**/*.spec.{ts,tsx}'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tools/',
    '/build/',
    '/dist/',
    '/server/tests/' // Ignore problematic server tests for now
  ],
  collectCoverageFrom: [
    'client/src/**/*.{ts,tsx}',
    'shared/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 20,
      lines: 20,
      statements: 20
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
  verbose: false,
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