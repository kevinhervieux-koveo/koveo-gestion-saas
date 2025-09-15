// Enhanced database mock for complete drizzle-orm isolation
const { jest } = require('@jest/globals');

// Mock all drizzle-orm functions
const mockQuery = jest.fn().mockResolvedValue([]);
const mockInsert = jest.fn().mockReturnValue({
  values: jest.fn().mockReturnValue({
    returning: jest.fn().mockResolvedValue([])
  }),
  returning: jest.fn().mockResolvedValue([])
});
const mockUpdate = jest.fn().mockReturnValue({
  set: jest.fn().mockReturnValue({
    where: jest.fn().mockResolvedValue([])
  })
});
const mockDelete = jest.fn().mockReturnValue({
  where: jest.fn().mockResolvedValue([])
});
const mockSelect = jest.fn().mockReturnValue({
  from: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnValue({
      limit: jest.fn().mockResolvedValue([])
    }),
    limit: jest.fn().mockResolvedValue([])
  })
});

// Mock drizzle operators
const eq = jest.fn().mockImplementation((column, value) => ({
  type: 'eq', column, value
}));
const and = jest.fn().mockImplementation((...conditions) => ({
  type: 'and', conditions
}));
const or = jest.fn().mockImplementation((...conditions) => ({
  type: 'or', conditions
}));
const sql = jest.fn().mockImplementation((strings, ...values) => ({
  sql: Array.isArray(strings) ? strings.join('?') : strings,
  params: values
}));

// Mock pg-core functions
const pgEnum = jest.fn().mockImplementation((name, values) => ({
  name, values, enumValues: values
}));
const pgTable = jest.fn().mockImplementation((name, schema) => ({
  name, schema, _: { name, columns: schema }
}));
const text = jest.fn().mockImplementation(() => ({ type: 'text' }));
const varchar = jest.fn().mockImplementation(() => ({ type: 'varchar' }));
const boolean = jest.fn().mockImplementation(() => ({ type: 'boolean' }));
const timestamp = jest.fn().mockImplementation(() => ({ type: 'timestamp' }));
const integer = jest.fn().mockImplementation(() => ({ type: 'integer' }));
const uuid = jest.fn().mockImplementation(() => ({ type: 'uuid' }));

// Mock Neon serverless
class MockPool {
  constructor() {}
  connect() { return Promise.resolve({ release: () => {} }); }
  query() { return Promise.resolve({ rows: [] }); }
  end() { return Promise.resolve(); }
}

const neonConfig = {
  fetchConnectionCache: true
};

module.exports = {
  // Database mocks
  drizzle: jest.fn().mockReturnValue({
    query: mockQuery,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    select: mockSelect
  }),
  
  // Operators
  eq, and, or, sql,
  
  // pg-core functions
  pgEnum, pgTable, text, varchar, boolean, timestamp, integer, uuid,
  
  // Neon serverless
  Pool: MockPool,
  neonConfig,
  
  // Default export
  default: {
    drizzle: jest.fn().mockReturnValue({
      query: mockQuery,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      select: mockSelect
    })
  }
};