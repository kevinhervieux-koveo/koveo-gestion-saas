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
  builder.then = jest.fn().mockImplementation((resolve) => {
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
      }\n    }\n    \n    return Promise.resolve(result).then(resolve);\n  });\n  \n  builder.catch = jest.fn().mockImplementation((reject) => {\n    return Promise.resolve(defaultResult).catch(reject);\n  });\n  \n  builder.finally = jest.fn().mockImplementation((finallyFn) => {\n    return Promise.resolve(defaultResult).finally(finallyFn);\n  });\n\n  return builder;\n};\n\n// Main mock database object\nexport const mockDb = {\n  // Core database operations\n  query: jest.fn().mockImplementation(async (sql: string) => {\n    if (sql.includes('SELECT version()')) {\n      return [{ version: 'PostgreSQL 15.0 (Mock)' }];\n    }\n    return [];\n  }),\n  \n  // Insert operations\n  insert: jest.fn().mockImplementation((table: any) => {\n    return createQueryBuilder([{ id: generateMockId() }]);\n  }),\n  \n  // Select operations\n  select: jest.fn().mockImplementation((fields?: any) => {\n    return createQueryBuilder([]);\n  }),\n  \n  // Update operations\n  update: jest.fn().mockImplementation((table: any) => {\n    return createQueryBuilder({ affectedRows: 1 });\n  }),\n  \n  // Delete operations\n  delete: jest.fn().mockImplementation((table: any) => {\n    return createQueryBuilder({ affectedRows: 1 });\n  }),\n  \n  // Transaction support\n  transaction: jest.fn().mockImplementation(async (callback) => {\n    return await callback(mockDb);\n  }),\n  \n  // Batch operations\n  batch: jest.fn().mockImplementation(async (queries) => {\n    return queries.map(() => ({ affectedRows: 1 }));\n  }),\n  \n  // With clause support\n  $with: jest.fn().mockImplementation(() => createQueryBuilder([])),\n  \n  // Raw SQL support\n  execute: jest.fn().mockImplementation(async () => ({ rows: [] })),\n  \n  // Connection management (for integration tests)\n  end: jest.fn().mockResolvedValue(undefined),\n  connect: jest.fn().mockResolvedValue(undefined)\n};\n\n// Mock schema tables for type safety\nconst createMockTable = (tableName: string) => ({\n  _: {\n    name: tableName,\n    schema: undefined,\n    columns: {},\n    baseName: tableName\n  },\n  // Common column mocks\n  id: { name: 'id' },\n  email: { name: 'email' },\n  name: { name: 'name' },\n  role: { name: 'role' },\n  userId: { name: 'userId' },\n  organizationId: { name: 'organizationId' },\n  buildingId: { name: 'buildingId' },\n  residenceId: { name: 'residenceId' },\n  status: { name: 'status' },\n  createdAt: { name: 'createdAt' },\n  updatedAt: { name: 'updatedAt' }\n});\n\n// Export mock schema for tests to import\nexport const mockSchema = {\n  // Core tables\n  users: createMockTable('users'),\n  organizations: createMockTable('organizations'),\n  userOrganizations: createMockTable('userOrganizations'),\n  invitations: createMockTable('invitations'),\n  passwordResetTokens: createMockTable('passwordResetTokens'),\n  \n  // Property tables  \n  buildings: createMockTable('buildings'),\n  residences: createMockTable('residences'),\n  userResidences: createMockTable('userResidences'),\n  \n  // Document tables\n  documents: createMockTable('documents'),\n  \n  // Financial tables\n  bills: createMockTable('bills'),\n  budgets: createMockTable('budgets'),\n  monthlyBudgets: createMockTable('monthlyBudgets'),\n  \n  // Operations tables\n  maintenanceRequests: createMockTable('maintenanceRequests'),\n  commonSpaces: createMockTable('commonSpaces'),\n  \n  // System tables\n  permissions: createMockTable('permissions'),\n  userPermissions: createMockTable('userPermissions'),\n  rolePermissions: createMockTable('rolePermissions'),\n  demands: createMockTable('demands')\n};\n\n// Export test utilities\nexport const testUtils = {\n  clearMockData,\n  generateMockId,\n  getMockData: () => mockDataStore,\n  resetMocks: () => {\n    clearMockData();\n    jest.clearAllMocks();\n  }\n};\n\n// Default export for convenience\nexport default mockDb;\n