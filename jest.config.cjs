/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/jest.polyfills.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.simple.ts'],
  
  // Custom resolver temporarily disabled - format issues
  // resolver: '<rootDir>/jest-resolver.js',
  
  // Optimized module name mapping - only essential mappings
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/client/src/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@assets/(.*)$': '<rootDir>/__mocks__/fileMock.js',
    
    // Complete database isolation - prevent any real connections (disabled for server integration tests)
    // '@neondatabase/serverless': '<rootDir>/__mocks__/enhanced-database-mock.js',
    // 'drizzle-orm/neon-http': '<rootDir>/__mocks__/enhanced-database-mock.js',
    // 'drizzle-orm/neon-serverless': '<rootDir>/__mocks__/enhanced-database-mock.js',
    // '^drizzle-orm/pg-core(?:\\.js)?$': '<rootDir>/__mocks__/drizzle-orm/pg-core.js',
    // '^drizzle-orm$': '<rootDir>/__mocks__/drizzle-orm/index.js',
    // '^drizzle-zod(?:\\.js)?$': '<rootDir>/__mocks__/enhanced-database-mock.js',
    
    // Server module mocks to prevent real imports - relative paths
    // Note: db mocking disabled for server integration tests
    // '^../server/db$': '<rootDir>/__mocks__/server/db.ts',
    '^../server/storage$': '<rootDir>/__mocks__/server/storage.ts',
    // '^../../server/db$': '<rootDir>/__mocks__/server/db.ts', 
    '^../../server/storage$': '<rootDir>/__mocks__/server/storage.ts',
    '^../../../server/routes$': '<rootDir>/__mocks__/server/routes.ts',
    '^../../server/routes$': '<rootDir>/__mocks__/server/routes.ts',
    '^../server/routes$': '<rootDir>/__mocks__/server/routes.ts',
    '^../../../server/auth$': '<rootDir>/__mocks__/server/auth.ts',
    '^../../server/auth$': '<rootDir>/__mocks__/server/auth.ts',
    '^../server/auth$': '<rootDir>/__mocks__/server/auth.ts',
    
    // Server module mocks to prevent real imports - absolute paths
    '^server/auth(?:/index\\.ts)?$': '<rootDir>/__mocks__/server/auth.ts',
    // '^server/db(?:/index\\.ts)?$': '<rootDir>/__mocks__/server/db.ts',
    '^server/storage(?:/index\\.ts)?$': '<rootDir>/__mocks__/server/storage.ts',
    '^server/routes(?:/index\\.ts)?$': '<rootDir>/__mocks__/server/routes.ts',
    
    // Critical: Server internal imports (from within server directory) 
    // These patterns catch imports within server files themselves
    // '^\\./db(?:\\.ts)?$': '<rootDir>/__mocks__/server/db.ts',
    '^\\./storage(?:\\.ts)?$': '<rootDir>/__mocks__/server/storage.ts',
    '^\\./auth(?:\\.ts)?$': '<rootDir>/__mocks__/server/auth.ts',
    '^\\./routes(?:\\.ts)?$': '<rootDir>/__mocks__/server/routes.ts',
    
    // Server subdirectory imports (from server/api/, server/services/, etc.)
    // '^\\.\\./db(?:\\.ts)?$': '<rootDir>/__mocks__/server/db.ts',
    '^\\.\\./storage(?:\\.ts)?$': '<rootDir>/__mocks__/server/storage.ts',
    '^\\.\\./auth(?:\\.ts)?$': '<rootDir>/__mocks__/server/auth.ts',
    '^\\.\\./routes(?:\\.ts)?$': '<rootDir>/__mocks__/server/routes.ts',
    
    // Schema mocks to prevent drizzle-orm imports - robust directory-agnostic pattern (disabled for server integration tests)
    // '^(.*/)?shared/schema(?:\\.(ts|js))?$': '<rootDir>/__mocks__/shared/schema.ts',
    
    // CSS and assets (simplified)
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg|webp|bmp|ico|woff|woff2|eot|ttf|otf)$': '<rootDir>/__mocks__/fileMock.js',
    
    // ES Module mocks to prevent import issues
    'wouter': '<rootDir>/__mocks__/wouter.js',
    
    // Mock components that use import.meta.env to prevent syntax errors
    '^@/pages/manager/budget$': '<rootDir>/__mocks__/client/src/pages/manager/budget.tsx',
    '^@/pages/admin/documentation$': '<rootDir>/__mocks__/client/src/pages/admin/documentation.tsx',
    '^client/src/pages/manager/budget$': '<rootDir>/__mocks__/client/src/pages/manager/budget.tsx',
    '^client/src/pages/admin/documentation$': '<rootDir>/__mocks__/client/src/pages/admin/documentation.tsx',
    '^\\.\\./\\.\\./client/src/pages/manager/budget$': '<rootDir>/__mocks__/client/src/pages/manager/budget.tsx',
    '^\\.\\./\\.\\./client/src/pages/admin/documentation$': '<rootDir>/__mocks__/client/src/pages/admin/documentation.tsx',
    
    // Child process and exec mocks to prevent hanging
    '^child_process$': '<rootDir>/__mocks__/child_process.js',
    '^util$': '<rootDir>/__mocks__/util.js',
    
    // File system mocks for safer testing (excluding server tests)
    // Note: fs mocking is skipped for server integration tests to allow real file operations
    // '^fs$': '<rootDir>/__mocks__/fs.js',
    // '^fs/promises$': '<rootDir>/__mocks__/fs-promises.js',
  },
  
  testMatch: ['<rootDir>/tests/**/*.test.{ts,tsx}', '<rootDir>/server/tests/**/*.test.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '\\.disabled'],
  
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
        useESM: false,
        // Enhanced TypeScript support for better error handling
        diagnostics: {
          ignoreCodes: [1343]
        }
      },
    ],
  },
  
  // Enhanced transform ignore patterns for better ES module support
  transformIgnorePatterns: [
    'node_modules/(?!(wouter|@tanstack|@testing-library|@radix-ui|@hookform|lucide-react|@google/genai|regexparam|@google-cloud|react-router-dom|drizzle-orm|drizzle-zod|@neondatabase))'
  ],
  
  // Performance settings - more aggressive timeouts to prevent hanging
  testTimeout: 8000,
  maxWorkers: '50%',
  cache: false,
  cacheDirectory: '<rootDir>/.jest-cache',
  detectOpenHandles: true,
  forceExit: false,
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  resetModules: false,  // Disable module reset to avoid import issues
  verbose: true,
  passWithNoTests: false,
  bail: false,  // Run all tests to discover all issues
  
  // Strict cleanup and isolation settings
  sandboxInjectedGlobals: [
    'Math'
  ],

  
  // Enhanced module resolution for better mock handling
  moduleDirectories: ['node_modules', '<rootDir>'],
  rootDir: '.',
  testEnvironmentOptions: {
    url: 'http://localhost:3000'
  },
  
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