// Simplified database mock to prevent circular dependencies
const mockQuery = jest.fn(() => Promise.resolve({ rows: [] }));

// Create mock database directly to avoid circular imports
const mockDb = {
  query: mockQuery,
  insert: jest.fn().mockImplementation(() => ({
    values: jest.fn().mockImplementation(() => ({
      returning: jest.fn().mockResolvedValue([{ id: 'mock-id' }])
    }))
  })),
  select: jest.fn().mockImplementation(() => ({
    from: jest.fn().mockImplementation(() => ({
      where: jest.fn().mockResolvedValue([])
    }))
  })),
  update: jest.fn().mockImplementation(() => ({
    set: jest.fn().mockImplementation(() => ({
      where: jest.fn().mockResolvedValue({ affectedRows: 0 })
    }))
  })),
  delete: jest.fn().mockImplementation(() => ({
    where: jest.fn().mockResolvedValue({ affectedRows: 0 })
  }))
};

const mockSql = jest.fn().mockResolvedValue([]);

module.exports = {
  mockDb,
  mockSql,
  mockQuery,
};