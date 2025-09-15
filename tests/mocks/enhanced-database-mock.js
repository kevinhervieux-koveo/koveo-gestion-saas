/**
 * Enhanced Database Mock - Comprehensive solution for all database testing needs
 * Supports both CommonJS and ES modules, Drizzle ORM, and Neon Serverless
 * Consolidates functionality from serverDbMock.js, unified-database-mock.ts, and database.ts
 */

// Global state management for test isolation
let mockIdCounter = 1;
const mockDataStore = new Map();

// Test isolation utilities
const generateMockId = () => {
  return `mock-${mockIdCounter++}-${Date.now().toString(36)}`;
};

const clearMockData = () => {
  mockDataStore.clear();
  mockIdCounter = 1;
};

// Enhanced chainable query builder with comprehensive Drizzle ORM support
const createQueryBuilder = (defaultResult = [], operation = 'select') => {
  const builder = {};
  
  // All chainable methods supported by Drizzle ORM
  const chainableMethods = [
    'from', 'where', 'leftJoin', 'innerJoin', 'rightJoin', 'fullJoin',
    'select', 'set', 'values', 'returning', 'orderBy', 'limit',
    'offset', 'groupBy', 'having', 'onConflictDoUpdate', 'onConflictDoNothing',
    'onConflictDoSet', 'with', '$with', 'distinct', 'union', 'unionAll',
    'intersect', 'except', 'as', 'for'
  ];
  
  chainableMethods.forEach(method => {
    if (typeof jest !== 'undefined') {
      builder[method] = jest.fn().mockImplementation((...args) => {
        // Special handling for values method to capture insert data
        if (method === 'values') {
          builder._insertData = args[0];
          builder._operation = 'insert';
        } else if (method === 'set') {
          builder._updateData = args[0];
          builder._operation = 'update';
        } else if (method === 'from') {
          builder._tableName = args[0]?._?.name || args[0]?.name || 'unknown';
        }
        return builder;
      });
    } else {
      // Standalone environment without Jest
      builder[method] = function(...args) {
        // Special handling for values method to capture insert data
        if (method === 'values') {
          builder._insertData = args[0];
          builder._operation = 'insert';
        } else if (method === 'set') {
          builder._updateData = args[0];
          builder._operation = 'update';
        } else if (method === 'from') {
          builder._tableName = args[0]?._?.name || args[0]?.name || 'unknown';
        }
        return builder;
      };
    }
  });
  
  // Make the builder thenable (promise-like) with realistic data generation
  if (typeof jest !== 'undefined') {
    builder.then = jest.fn().mockImplementation((resolve) => {
    let result = defaultResult;
    
    // Handle insert operations
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
        const record = {
          id: generateMockId(),
          ...data,
          createdAt: now,
          updatedAt: now
        };
        // Store in mock data store for potential retrieval
        mockDataStore.set(record.id, record);
        result = [record];
      }
    } 
    // Handle update operations
    else if (builder._updateData) {
      const now = new Date();
      result = { 
        affectedRows: 1, 
        changes: { ...builder._updateData, updatedAt: now },
        meta: { tableName: builder._tableName }
      };
    }
    // Handle delete operations
    else if (operation === 'delete') {
      result = { 
        affectedRows: 1,
        meta: { tableName: builder._tableName }
      };
    }
    
      return Promise.resolve(result).then(resolve);
    });
    
    builder.catch = jest.fn().mockImplementation((reject) => {
      return Promise.resolve(defaultResult).catch(reject);
    });
    
    builder.finally = jest.fn().mockImplementation((finallyFn) => {
      return Promise.resolve(defaultResult).finally(finallyFn);
    });
  } else {
    // Standalone environment
    builder.then = function(resolve) {
      let result = defaultResult;
      
      // Handle insert operations
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
          const record = {
            id: generateMockId(),
            ...data,
            createdAt: now,
            updatedAt: now
          };
          mockDataStore.set(record.id, record);
          result = [record];
        }
      } 
      else if (builder._updateData) {
        const now = new Date();
        result = { 
          affectedRows: 1, 
          changes: { ...builder._updateData, updatedAt: now },
          meta: { tableName: builder._tableName }
        };
      }
      else if (operation === 'delete') {
        result = { 
          affectedRows: 1,
          meta: { tableName: builder._tableName }
        };
      }
      
      return Promise.resolve(result).then(resolve);
    };
    
    builder.catch = function(reject) {
      return Promise.resolve(defaultResult).catch(reject);
    };
    
    builder.finally = function(finallyFn) {
      return Promise.resolve(defaultResult).finally(finallyFn);
    };
  }

  return builder;
};

// Enhanced mock SQL template function with Neon compatibility
const mockSql = (typeof jest !== 'undefined' ? jest.fn() : function() {});
const mockSqlImpl = async (strings, ...values) => {
  // Handle template literal calls
  if (Array.isArray(strings) && strings.raw) {
    const query = strings.join('?').toLowerCase();
    
    // Common database queries with realistic responses
    if (query.includes('select version()')) {
      return [{ version: 'PostgreSQL 15.0 (Mock Version)' }];
    }
    if (query.includes('select now()')) {
      return [{ now: new Date().toISOString() }];
    }
    if (query.includes('select 1')) {
      return [{ '?column?': 1 }];
    }
    
    return [];
  }
  
  // Handle direct string calls
  if (typeof strings === 'string') {
    const query = strings.toLowerCase();
    if (query.includes('select version()')) {
      return [{ version: 'PostgreSQL 15.0 (Mock Version)' }];
    }
  }
  
  return [];
};

if (typeof jest !== 'undefined') {
  mockSql.mockImplementation(mockSqlImpl);
} else {
  Object.assign(mockSql, mockSqlImpl);
}

// Add Neon-specific properties and methods
Object.assign(mockSql, {
  query: typeof jest !== 'undefined' ? jest.fn().mockResolvedValue({ rows: [] }) : async () => ({ rows: [] }),
  end: typeof jest !== 'undefined' ? jest.fn().mockResolvedValue(undefined) : async () => undefined,
  arrayMode: false,
  fullResults: false,
  // Neon specific methods
  setTypeParser: typeof jest !== 'undefined' ? jest.fn() : function() {},
  // Add sql property for compatibility
  sql: mockSql
});

// Mock Pool class for session store and connection pooling
class MockPool {
  constructor(config = {}) {
    this.config = config;
    this.totalCount = 0;
    this.idleCount = 0;
    this.waitingCount = 0;
  }
  
  async query(sql, params = []) {
    // Handle different query types
    if (typeof sql === 'string') {
      const query = sql.toLowerCase();
      if (query.includes('select version()')) {
        return { rows: [{ version: 'PostgreSQL 15.0 (Mock Version)' }] };
      }
      if (query.includes('session')) {
        return { rows: [] }; // Session store queries
      }
    }
    return { rows: [] };
  }
  
  async connect() {
    return {
      query: this.query.bind(this),
      release: jest.fn()
    };
  }
  
  async end() {
    return undefined;
  }
  
  // Event emitter methods
  on(event, handler) {
    // Mock event listener
  }
  
  removeListener(event, handler) {
    // Mock remove listener
  }
  
  emit(event, ...args) {
    // Mock event emission
  }
}

// Enhanced mock database object with comprehensive Drizzle ORM support
const mockDb = {
  // Core database operations
  query: mockSql,
  
  // Insert operations with proper chainable support
  insert: typeof jest !== 'undefined' ? jest.fn().mockImplementation((table) => {
    return createQueryBuilder([{ id: generateMockId() }], 'insert');
  }) : function(table) {
    return createQueryBuilder([{ id: generateMockId() }], 'insert');
  },
  
  // Select operations with comprehensive chaining
  select: typeof jest !== 'undefined' ? jest.fn().mockImplementation((fields) => {
    return createQueryBuilder([], 'select');
  }) : function(fields) {
    return createQueryBuilder([], 'select');
  },
  
  // Update operations
  update: typeof jest !== 'undefined' ? jest.fn().mockImplementation((table) => {
    return createQueryBuilder({ affectedRows: 1 }, 'update');
  }) : function(table) {
    return createQueryBuilder({ affectedRows: 1 }, 'update');
  },
  
  // Delete operations
  delete: typeof jest !== 'undefined' ? jest.fn().mockImplementation((table) => {
    return createQueryBuilder({ affectedRows: 1 }, 'delete');
  }) : function(table) {
    return createQueryBuilder({ affectedRows: 1 }, 'delete');
  },
  
  // Transaction support
  transaction: typeof jest !== 'undefined' ? jest.fn().mockImplementation(async (callback) => {
    return await callback(mockDb);
  }) : async function(callback) {
    return await callback(mockDb);
  },
  
  // Batch operations
  batch: typeof jest !== 'undefined' ? jest.fn().mockImplementation(async (queries) => {
    return queries.map(() => ({ affectedRows: 1 }));
  }) : async function(queries) {
    return queries.map(() => ({ affectedRows: 1 }));
  },
  
  // With clause support ($with is used by some Drizzle queries)
  $with: typeof jest !== 'undefined' ? jest.fn().mockImplementation(() => createQueryBuilder([])) : function() {
    return createQueryBuilder([]);
  },
  with: typeof jest !== 'undefined' ? jest.fn().mockImplementation(() => createQueryBuilder([])) : function() {
    return createQueryBuilder([]);
  },
  
  // Raw SQL execution
  execute: typeof jest !== 'undefined' ? jest.fn().mockImplementation(async () => ({ rows: [] })) : async function() {
    return { rows: [] };
  },
  
  // Connection management
  end: typeof jest !== 'undefined' ? jest.fn().mockResolvedValue(undefined) : async function() {
    return undefined;
  },
  connect: typeof jest !== 'undefined' ? jest.fn().mockResolvedValue(undefined) : async function() {
    return undefined;
  }
};

// Create mock table factory that matches Drizzle table structure
const createMockTable = (tableName) => ({
  _: {
    name: tableName,
    schema: undefined,
    columns: {},
    baseName: tableName
  },
  // Common column mocks for type safety
  id: { name: 'id' },
  email: { name: 'email' },
  name: { name: 'name' },
  role: { name: 'role' },
  userId: { name: 'userId' },
  organizationId: { name: 'organizationId' },
  buildingId: { name: 'buildingId' },
  residenceId: { name: 'residenceId' },
  status: { name: 'status' },
  type: { name: 'type' },
  amount: { name: 'amount' },
  description: { name: 'description' },
  createdAt: { name: 'createdAt' },
  updatedAt: { name: 'updatedAt' }
});

// Mock schema with all tables found in the server files
const mockSchema = {
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
  demands: createMockTable('demands'),
  
  // System tables
  permissions: createMockTable('permissions'),
  userPermissions: createMockTable('userPermissions'),
  rolePermissions: createMockTable('rolePermissions')
};

// Mock Neon function for @neondatabase/serverless
const mockNeon = typeof jest !== 'undefined' ? jest.fn().mockImplementation((connectionString, options = {}) => {
  return mockSql;
}) : function(connectionString, options = {}) {
  return mockSql;
};

// Mock drizzle function that returns the enhanced database mock
const mockDrizzle = typeof jest !== 'undefined' ? jest.fn().mockImplementation((connection, options = {}) => {
  return mockDb;
}) : function(connection, options = {}) {
  return mockDb;
};

// Mock pg-core functions for schema definitions
const mockPgEnum = typeof jest !== 'undefined' ? jest.fn().mockImplementation((name, values) => {
  // Return a mock enum object that behaves like a drizzle pgEnum
  return {
    enumName: name,
    enumValues: values,
    _: {
      name,
      values,
      schema: undefined,
      baseName: name
    }
  };
}) : function(name, values) {
  return {
    enumName: name,
    enumValues: values,
    _: {
      name,
      values,
      schema: undefined,
      baseName: name
    }
  };
};

const mockPgTable = typeof jest !== 'undefined' ? jest.fn().mockImplementation((name, columns) => {
  return createMockTable(name);
}) : function(name, columns) {
  return createMockTable(name);
};

// Mock column types for pg-core
const createColumnMock = (type) => {
  const mock = typeof jest !== 'undefined' ? jest.fn() : function() {};
  
  const columnFactory = (...args) => {
    const column = {
      _: { type, name: args[0] || 'unknown' },
      name: args[0] || 'unknown',
      // Chain methods
      primaryKey: () => column,
      notNull: () => column,
      unique: () => column,
      default: () => column,
      references: () => column,
      array: () => column
    };
    return column;
  };
  
  if (typeof jest !== 'undefined') {
    return jest.fn().mockImplementation(columnFactory);
  }
  return columnFactory;
};

// Mock all pg-core column types
const mockText = createColumnMock('text');
const mockVarchar = createColumnMock('varchar');
const mockInteger = createColumnMock('integer');
const mockBoolean = createColumnMock('boolean');
const mockTimestamp = createColumnMock('timestamp');
const mockDate = createColumnMock('date');
const mockUuid = createColumnMock('uuid');
const mockJson = createColumnMock('json');

// Mock sql template function
const mockSqlFromCore = typeof jest !== 'undefined' ? jest.fn().mockImplementation((strings, ...values) => {
  if (typeof strings === 'string') {
    return { sql: strings, params: values };
  }
  if (Array.isArray(strings) && strings.raw) {
    const query = strings.join('?');
    return { sql: query, params: values };
  }
  return { sql: '', params: [] };
}) : function(strings, ...values) {
  if (typeof strings === 'string') {
    return { sql: strings, params: values };
  }
  if (Array.isArray(strings) && strings.raw) {
    const query = strings.join('?');
    return { sql: query, params: values };
  }
  return { sql: '', params: [] };
};

// Mock relations function
const mockRelations = typeof jest !== 'undefined' ? jest.fn().mockImplementation((table, relationsFn) => {
  return {};
}) : function(table, relationsFn) {
  return {};
};

// Mock eq and other operators
const mockEq = typeof jest !== 'undefined' ? jest.fn().mockImplementation((column, value) => {
  return { type: 'eq', column, value };
}) : function(column, value) {
  return { type: 'eq', column, value };
};

const mockAnd = typeof jest !== 'undefined' ? jest.fn().mockImplementation((...conditions) => {
  return { type: 'and', conditions };
}) : function(...conditions) {
  return { type: 'and', conditions };
};

const mockOr = typeof jest !== 'undefined' ? jest.fn().mockImplementation((...conditions) => {
  return { type: 'or', conditions };
}) : function(...conditions) {
  return { type: 'or', conditions };
};

// Test utilities for data isolation and testing
const testUtils = {
  clearMockData,
  generateMockId,
  getMockData: () => mockDataStore,
  resetMocks: () => {
    clearMockData();
    jest.clearAllMocks();
  },
  // Helper to create test data
  createTestData: (tableName, data) => {
    const id = generateMockId();
    const record = {
      id,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockDataStore.set(id, record);
    return record;
  }
};

// Comprehensive export object supporting both CommonJS and ES modules
const exports = {
  // Core database exports
  sql: mockSql,
  db: mockDb,
  pool: new MockPool({ connectionString: 'test://test' }),
  
  // Constructor exports
  Pool: MockPool,
  
  // Factory functions
  neon: mockNeon,
  drizzle: mockDrizzle,
  
  // Schema and utilities
  mockSchema,
  testUtils,
  
  // For ES modules compatibility
  __esModule: true,
  default: mockNeon, // Default export should be neon for @neondatabase/serverless
  
  // Named exports for different import patterns
  createQueryBuilder,
  createMockTable,
  
  // Data management
  generateMockId,
  clearMockData,
  
  // pg-core exports for schema definitions
  pgEnum: mockPgEnum,
  pgTable: mockPgTable,
  text: mockText,
  varchar: mockVarchar,
  integer: mockInteger,
  boolean: mockBoolean,
  timestamp: mockTimestamp,
  date: mockDate,
  uuid: mockUuid,
  json: mockJson,
  
  // drizzle-orm exports (operators and utilities)
  eq: mockEq,
  and: mockAnd,
  or: mockOr,
  relations: mockRelations,
  
  // Additional sql export for compatibility
  sqlFromCore: mockSqlFromCore
};

// Export for CommonJS (required for jest.config.cjs moduleNameMapper)
module.exports = exports;

// Add ES module compatibility
if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
  Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
}