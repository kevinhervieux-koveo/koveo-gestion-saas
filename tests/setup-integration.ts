import { jest } from '@jest/globals';

// Disable database optimizations during tests
process.env.DISABLE_DB_OPTIMIZATIONS = 'true';
process.env.TEST_ENV = 'integration';

// Mock database optimization functions to prevent them from running
jest.mock('../server/database-optimization.ts', () => ({
  QueryOptimizer: {
    applyCoreOptimizations: jest.fn().mockResolvedValue(undefined),
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
  const actual = jest.requireActual('../server/db-storage.ts');
  return {
    OptimizedDatabaseStorage: actual.DatabaseStorage,
  };
});

// Mock performance monitoring
jest.mock('../server/performance-monitoring.ts', () => ({
  dbPerformanceMonitor: {
    trackQuery: jest.fn().mockImplementation(async (name, fn) => await fn()),
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
beforeAll(() => {
  // Reduce console noise during tests
  console.log = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  // Restore console
  Object.assign(console, originalConsole);
});