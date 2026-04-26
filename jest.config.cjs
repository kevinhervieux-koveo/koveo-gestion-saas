/* eslint-env node */
/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/jest.polyfills.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.simple.ts'],
  globalSetup: '<rootDir>/jest.global-setup.cjs',
  
  moduleNameMapper: {
    '^@/lib/logger$': '<rootDir>/__mocks__/client/src/lib/logger.ts',
    '^@/lib/debug-log$': '<rootDir>/__mocks__/client/src/lib/debug-log.ts',
    '^@/(.*)$': '<rootDir>/client/src/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@assets/(.*)$': '<rootDir>/__mocks__/fileMock.js',
    
    '^../server/storage$': '<rootDir>/__mocks__/server/storage.ts',
    '^../../server/storage$': '<rootDir>/__mocks__/server/storage.ts',
    '^../../../server/routes$': '<rootDir>/__mocks__/server/routes.ts',
    '^../../server/routes$': '<rootDir>/__mocks__/server/routes.ts',
    '^../server/routes$': '<rootDir>/__mocks__/server/routes.ts',
    '^../../../server/auth$': '<rootDir>/__mocks__/server/auth.ts',
    '^../../server/auth$': '<rootDir>/__mocks__/server/auth.ts',
    '^../server/auth$': '<rootDir>/__mocks__/server/auth.ts',
    
    '^server/auth(?:/index\\.ts)?$': '<rootDir>/__mocks__/server/auth.ts',
    '^server/storage(?:/index\\.ts)?$': '<rootDir>/__mocks__/server/storage.ts',
    '^server/routes(?:/index\\.ts)?$': '<rootDir>/__mocks__/server/routes.ts',
    
    '^\\./storage(?:\\.ts)?$': '<rootDir>/__mocks__/server/storage.ts',
    '^\\./auth(?:\\.ts)?$': '<rootDir>/__mocks__/server/auth.ts',
    '^\\./routes(?:\\.ts)?$': '<rootDir>/__mocks__/server/routes.ts',
    
    '^\\.\\./storage(?:\\.ts)?$': '<rootDir>/__mocks__/server/storage.ts',
    '^\\.\\./auth(?:\\.ts)?$': '<rootDir>/__mocks__/server/auth.ts',
    '^\\.\\./routes(?:\\.ts)?$': '<rootDir>/__mocks__/server/routes.ts',
    
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg|webp|bmp|ico|woff|woff2|eot|ttf|otf)$': '<rootDir>/__mocks__/fileMock.js',
    
    'wouter': '<rootDir>/__mocks__/wouter.js',
    
    '^@/pages/manager/budget$': '<rootDir>/__mocks__/client/src/pages/manager/budget.tsx',
    '^client/src/pages/manager/budget$': '<rootDir>/__mocks__/client/src/pages/manager/budget.tsx',
    '^\\.\\./\\.\\./client/src/pages/manager/budget$': '<rootDir>/__mocks__/client/src/pages/manager/budget.tsx',
    
    '^uuid$': '<rootDir>/__mocks__/uuid.cjs',

    '^child_process$': '<rootDir>/__mocks__/child_process.js',
    '^util$': '<rootDir>/__mocks__/util.js',
  },
  
  testMatch: ['<rootDir>/tests/**/*.test.{ts,tsx}', '<rootDir>/server/tests/**/*.test.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '\\.disabled'],
  
  collectCoverageFrom: [
    'client/src/**/*.{ts,tsx}',
    'shared/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json',
        diagnostics: false,
      },
    ],
  },
  
  transformIgnorePatterns: [
    'node_modules/(?!(wouter|@tanstack|@testing-library|@radix-ui|@hookform|lucide-react|@google/genai|regexparam|@google-cloud|react-router-dom|@neondatabase))'
  ],
  
  testTimeout: 3000,
  maxWorkers: '50%',
  cacheDirectory: '<rootDir>/.jest-cache',
  forceExit: true,
  restoreMocks: true,
  resetModules: false,
  verbose: false,
  passWithNoTests: false,
  bail: false,
  
  sandboxInjectedGlobals: [
    'Math'
  ],

  moduleDirectories: ['node_modules', '<rootDir>'],
  rootDir: '.',
  testEnvironmentOptions: {
    url: 'http://localhost:3000'
  },
  
  workerIdleMemoryLimit: '256MB',
  errorOnDeprecated: false,
  
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
  
  modulePathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/.cache/',
    '<rootDir>/node_modules/.cache/',
  ],
  
  haste: {
    enableSymlinks: false,
  },
};

module.exports = config;
