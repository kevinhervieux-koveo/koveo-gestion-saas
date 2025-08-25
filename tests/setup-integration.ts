import { jest } from '@jest/globals';

// Disable database optimizations during tests
process.env.DISABLE_DB_OPTIMIZATIONS = 'true';
process.env.TEST_ENV = 'integration';

// Mock database optimization functions to prevent them from running
jest.mock('../server/database-optimization.ts', () => ({
  QueryOptimizer: {
    applyCoreOptimizations: jest.fn(),
  },
  DatabaseOptimization: {
    coreIndexes: [],
    frameworkIndexes: [],
    compositeIndexes: [],
    partialIndexes: [],
    coveringIndexes: [],
    materializedViews: [],
  },
}));

// Mock optimized database storage to use simple storage
jest.mock('../server/optimized-db-storage.ts', () => {
  const actual = jest.requireActual('../server/db-storage.ts') as any;
  return {
    OptimizedDatabaseStorage: actual.DatabaseStorage || class MockStorage {},
  };
});

// Mock performance monitoring
jest.mock('../server/performance-monitoring.ts', () => ({
  dbPerformanceMonitor: {
    trackQuery: jest
      .fn()
      .mockImplementation(async (_name: string, fn: () => Promise<any>) => await fn()),
    getSlowQueries: jest.fn().mockReturnValue([]),
  },
  queryCache: {
    get: jest.fn().mockReturnValue(undefined),
    set: jest.fn(),
    clear: jest.fn(),
    delete: jest.fn(),
  },
}));

// Console setup
const originalConsole = { ...console };

/**
 * Global test setup to reduce console noise during test execution.
 */
global.beforeAll(() => {
  // Reduce console noise during tests
  console.log = jest.fn();
  console.warn = jest.fn();
});

/**
 * Global test teardown to restore console functionality.
 */
global.afterAll(() => {
  // Restore console
  Object.assign(console, originalConsole);
});
