/**
 * Unified Database Mock for Jest Tests
 * This provides a consistent mock interface that works across all test types
 */

import { jest } from '@jest/globals';

// Global state management for test isolation
let mockIdCounter = 1;
const mockDataStore = new Map();

export const generateMockId = () => {
  return `mock-${mockIdCounter++}-${Date.now().toString(36)}`;
};

export const clearMockData = () => {
  mockDataStore.clear();
  mockIdCounter = 1;
};

// Create a chainable query builder that handles all Drizzle operations
const createQueryBuilder = (defaultResult: any = []) => {
  const builder: any = {};
  
  // All chainable methods return the builder itself
  const chainableMethods = [
    'from', 'where', 'leftJoin', 'innerJoin', 'rightJoin',
    'select', 'set', 'values', 'returning', 'orderBy', 'limit',
    'offset', 'groupBy', 'having', 'onConflictDoUpdate', 'onConflictDoNothing'
  ];
  
  chainableMethods.forEach(method => {
    builder[method] = jest.fn().mockImplementation((...args) => {
      // Special handling for values method to return proper data
      if (method === 'values') {
        const data = args[0];
        builder._insertData = data;
      }
      return builder;
    });
  });
  
  // Make the builder thenable (promise-like)
  builder.then = jest.fn().mockImplementation((resolve: any) => {
    let result = defaultResult;
    
    // If this is an insert operation with data, return mock records
    if (builder._insertData) {
      const data = builder._insertData;
      const now = new Date();
      
      if (Array.isArray(data)) {
        result = data.map(item => ({
          id: generateMockId(),
          ...item,
          createdAt: now,
          updatedAt: now
        }));
      } else {
        result = [{
          id: generateMockId(),
          ...data,
          createdAt: now,
          updatedAt: now
        }];
      }
    }
    
    return Promise.resolve(result).then(resolve);
  });
  
  builder.catch = jest.fn().mockImplementation((reject: any) => {
    return Promise.resolve(defaultResult).catch(reject);
  });
  
  builder.finally = jest.fn().mockImplementation((finallyFn: any) => {
    return Promise.resolve(defaultResult).finally(finallyFn);
  });

  return builder;
};

// Main mock database object
export const mockDb = {
  // Core database operations
  query: jest.fn().mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT version()')) {
      return [{ version: 'PostgreSQL 15.0 (Mock)' }];
    }
    return [];
  }),
  
  // Insert operations
  insert: jest.fn().mockImplementation((table: any) => {
    return createQueryBuilder([{ id: generateMockId() }]);
  }),
  
  // Select operations
  select: jest.fn().mockImplementation((fields?: any) => {
    return createQueryBuilder([]);
  }),
  
  // Update operations
  update: jest.fn().mockImplementation((table: any) => {
    return createQueryBuilder({ affectedRows: 1 });
  }),
  
  // Delete operations
  delete: jest.fn().mockImplementation((table: any) => {
    return createQueryBuilder({ affectedRows: 1 });
  }),
  
  // Transaction support
  transaction: jest.fn().mockImplementation(async (callback: any) => {
    return await callback(mockDb);
  }),
  
  // Batch operations
  batch: jest.fn().mockImplementation(async (queries: any[]) => {
    return queries.map(() => ({ affectedRows: 1 }));
  }),
  
  // With clause support
  $with: jest.fn().mockImplementation(() => createQueryBuilder([])),
  
  // Raw SQL support
  execute: jest.fn().mockImplementation(async () => ({ rows: [] })),
  
  // Connection management (for integration tests)
  end: jest.fn().mockResolvedValue(void 0),
  connect: jest.fn().mockResolvedValue(void 0)
};

// Mock schema tables for type safety
const createMockTable = (tableName: string) => ({
  _: {
    name: tableName,
    schema: undefined,
    columns: {},
    baseName: tableName
  },
  // Common column mocks
  id: { name: 'id' },
  email: { name: 'email' },
  name: { name: 'name' },
  role: { name: 'role' },
  userId: { name: 'userId' },
  organizationId: { name: 'organizationId' },
  buildingId: { name: 'buildingId' },
  residenceId: { name: 'residenceId' },
  status: { name: 'status' },
  createdAt: { name: 'createdAt' },
  updatedAt: { name: 'updatedAt' }
});

// Export mock schema for tests to import
export const mockSchema = {
  // Core tables
  users: createMockTable('users'),
  organizations: createMockTable('organizations'),
  userOrganizations: createMockTable('userOrganizations'),
  invitations: createMockTable('invitations'),
  passwordResetTokens: createMockTable('passwordResetTokens'),
  
  // Property tables  
  buildings: createMockTable('buildings'),
  residences: createMockTable('residences'),
  userResidences: createMockTable('userResidences'),
  
  // Document tables
  documents: createMockTable('documents'),
  
  // Financial tables
  bills: createMockTable('bills'),
  budgets: createMockTable('budgets'),
  monthlyBudgets: createMockTable('monthlyBudgets'),
  
  // Operations tables
  maintenanceRequests: createMockTable('maintenanceRequests'),
  commonSpaces: createMockTable('commonSpaces'),
  
  // System tables
  permissions: createMockTable('permissions'),
  userPermissions: createMockTable('userPermissions'),
  rolePermissions: createMockTable('rolePermissions'),
  demands: createMockTable('demands')
};

// Export test utilities
export const testUtils = {
  clearMockData,
  generateMockId,
  getMockData: () => mockDataStore,
  resetMocks: () => {
    clearMockData();
    jest.clearAllMocks();
  }
};

// Default export for convenience
export default mockDb;