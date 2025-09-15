// Enhanced database mock for complete drizzle-orm isolation
// Use global jest instead of importing it
const jest = global.jest || {
  fn: (impl) => impl || (() => {}),
  clearAllMocks: () => {},
};

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

// Mock database instance
const mockDb = {
  query: mockQuery,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  select: mockSelect
};

// Mock schema with common tables
const mockSchema = {
  organizations: { name: 'organizations' },
  users: { name: 'users' },
  userOrganizations: { name: 'userOrganizations' },
  invitations: { name: 'invitations' },
  buildings: { name: 'buildings' },
  residences: { name: 'residences' }
};

// Test utilities
const testUtils = {
  resetMocks: jest.fn(),
  clearData: jest.fn()
};

// Ensure pg-core functions are available for early import mocking
module.exports = {
  // Database instance
  mockDb,
  testUtils,
  mockSchema,
  
  // Database mocks
  drizzle: jest.fn().mockReturnValue(mockDb),
  
  // Operators
  eq, and, or, sql,
  
  // pg-core functions - these must be available for schema imports
  pgEnum, pgTable, text, varchar, boolean, timestamp, integer, uuid,
  
  // Neon serverless
  Pool: MockPool,
  neonConfig,
  
  // Default export
  default: {
    drizzle: jest.fn().mockReturnValue(mockDb),
    mockDb,
    testUtils,
    mockSchema
  }
};

// Also export as CommonJS for compatibility with module name mapping
module.exports.pgEnum = pgEnum;
module.exports.pgTable = pgTable;
module.exports.text = text;
module.exports.varchar = varchar;
module.exports.boolean = boolean;
module.exports.timestamp = timestamp;
module.exports.integer = integer;
module.exports.uuid = uuid;