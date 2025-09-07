// Mock for server database with proper chaining
const createMockQuery = () => {
  const mockQuery = {
    select: jest.fn(() => mockQuery),
    insert: jest.fn(() => mockQuery),
    update: jest.fn(() => mockQuery),
    delete: jest.fn(() => mockQuery),
    from: jest.fn(() => mockQuery),
    where: jest.fn(() => mockQuery),
    limit: jest.fn(() => []),
    values: jest.fn(() => mockQuery),
    set: jest.fn(() => mockQuery),
    returning: jest.fn(() => Promise.resolve([{ id: 'mock-id', name: 'Mock Item' }])),
    execute: jest.fn(() => Promise.resolve([])),
    then: jest.fn((callback) => callback([{ id: 'mock-id', name: 'Mock Item' }])),
  };
  return mockQuery;
};

module.exports = {
  db: {
    select: jest.fn(() => createMockQuery()),
    insert: jest.fn(() => createMockQuery()),
    update: jest.fn(() => createMockQuery()),
    delete: jest.fn(() => createMockQuery()),
    from: jest.fn(() => createMockQuery()),
    where: jest.fn(() => createMockQuery()),
    limit: jest.fn(() => []),
    values: jest.fn(() => createMockQuery()),
    set: jest.fn(() => createMockQuery()),
    execute: jest.fn().mockResolvedValue([]),
  },
  pool: {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end: jest.fn().mockResolvedValue(undefined),
  },
  sql: jest.fn(),
  // Default export
  __esModule: true,
  default: {
    db: {},
    pool: {},
    sql: jest.fn(),
  }
};