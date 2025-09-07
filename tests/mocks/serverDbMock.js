/**
 * Enhanced server database mock to handle all database operations properly
 */

// Mock the basic database operations that server code expects
const mockQuery = jest.fn().mockImplementation(async (sql) => {
  if (typeof sql === 'string' && sql.includes('SELECT version()')) {
    return [{ version: 'PostgreSQL 15.0 (Mock Version)' }];
  }
  return [];
});

// Mock the neon sql client  
const mockSql = jest.fn().mockImplementation(mockQuery);
mockSql.query = mockQuery;

// Mock Pool class for session store
class MockPool {
  constructor(config) {
    this.config = config;
  }
  
  async query(sql, params) {
    return { rows: [] };
  }
  
  async connect() {
    return {
      query: mockQuery,
      release: jest.fn()
    };
  }
  
  async end() {
    return undefined;
  }
  
  on(event, handler) {
    // Mock event listener
  }
  
  removeListener(event, handler) {
    // Mock remove listener
  }
}

// Create chainable query builder for drizzle operations
const createQueryBuilder = (defaultResult = []) => {
  const builder = {};
  
  const chainableMethods = [
    'from', 'where', 'leftJoin', 'innerJoin', 'rightJoin',
    'select', 'set', 'values', 'returning', 'orderBy', 'limit',
    'offset', 'groupBy', 'having', 'onConflictDoUpdate', 'onConflictDoNothing'
  ];
  
  chainableMethods.forEach(method => {
    builder[method] = jest.fn().mockImplementation((...args) => {
      if (method === 'values') {
        builder._insertData = args[0];
      }
      return builder;
    });
  });
  
  // Make the builder thenable (promise-like)
  builder.then = jest.fn().mockImplementation((resolve) => {
    let result = defaultResult;
    
    if (builder._insertData) {
      const data = builder._insertData;
      const now = new Date();
      
      if (Array.isArray(data)) {
        result = data.map(item => ({
          id: `mock-${Date.now()}-${Math.random()}`,
          ...item,
          createdAt: now,
          updatedAt: now
        }));
      } else {
        result = [{
          id: `mock-${Date.now()}-${Math.random()}`,
          ...data,
          createdAt: now,
          updatedAt: now
        }];
      }
    }
    
    return Promise.resolve(result).then(resolve);
  });
  
  builder.catch = jest.fn().mockImplementation((reject) => {
    return Promise.resolve(defaultResult).catch(reject);
  });
  
  return builder;
};

// Main mock database object
const mockDb = {
  query: mockQuery,
  insert: jest.fn().mockImplementation(() => createQueryBuilder([{ id: 'mock-id' }])),
  select: jest.fn().mockImplementation(() => createQueryBuilder([])),
  update: jest.fn().mockImplementation(() => createQueryBuilder({ affectedRows: 1 })),
  delete: jest.fn().mockImplementation(() => createQueryBuilder({ affectedRows: 1 })),
  transaction: jest.fn().mockImplementation(async (callback) => {
    return await callback(mockDb);
  }),
  batch: jest.fn().mockImplementation(async (queries) => {
    return queries.map(() => ({ affectedRows: 1 }));
  }),
  execute: jest.fn().mockImplementation(async () => ({ rows: [] })),
  end: jest.fn().mockResolvedValue(undefined),
  connect: jest.fn().mockResolvedValue(undefined)
};

// Export for different import patterns
module.exports = {
  sql: mockSql,
  db: mockDb,
  pool: new MockPool({ connectionString: 'test://test' }),
  Pool: MockPool,
  neon: jest.fn().mockReturnValue(mockSql),
  drizzle: jest.fn().mockReturnValue(mockDb),
  // For ES modules
  __esModule: true,
  default: mockDb
};