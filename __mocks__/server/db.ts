/**
 * Mock for server/db.ts - Prevents real database connections during tests
 * This ensures complete database isolation for all tests
 */

// Mock the Neon SQL function with Jest-compatible implementation
const mockSql = jest.fn().mockImplementation(async (strings: any, ...values: any[]) => {
  // Handle template literal calls
  if (Array.isArray(strings) && 'raw' in strings) {
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
    if (query.includes('select')) return [];
    if (query.includes('insert')) return [{ id: 'mock-insert-id', affectedRows: 1 }];
    if (query.includes('update')) return [{ affectedRows: 1 }];
    if (query.includes('delete')) return [{ affectedRows: 1 }];
  }
  
  return [];
});

// Add query method for compatibility
Object.assign(mockSql, {
  query: jest.fn().mockResolvedValue({ rows: [] }),
  end: jest.fn().mockResolvedValue(undefined),
  arrayMode: false,
  fullResults: false,
});

// Mock Drizzle database instance with comprehensive query builder support
const mockDb = {
  // Create realistic query builders
  select: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue([]),
      orderBy: jest.fn().mockResolvedValue([]),
      limit: jest.fn().mockResolvedValue([]),
      offset: jest.fn().mockResolvedValue([]),
      then: jest.fn().mockResolvedValue([])
    }),
    where: jest.fn().mockResolvedValue([]),
    then: jest.fn().mockResolvedValue([])
  }),
  
  insert: jest.fn().mockReturnValue({
    into: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{ id: 'mock-id' }]),
        then: jest.fn().mockResolvedValue([{ id: 'mock-id' }])
      }),
      then: jest.fn().mockResolvedValue([{ id: 'mock-id' }])
    }),
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([{ id: 'mock-id' }]),
      then: jest.fn().mockResolvedValue([{ id: 'mock-id' }])
    }),
    then: jest.fn().mockResolvedValue([{ id: 'mock-id' }])
  }),
  
  update: jest.fn().mockReturnValue({
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{ id: 'mock-id' }]),
        then: jest.fn().mockResolvedValue([{ id: 'mock-id' }])
      }),
      then: jest.fn().mockResolvedValue([{ id: 'mock-id' }])
    }),
    where: jest.fn().mockResolvedValue([]),
    then: jest.fn().mockResolvedValue([])
  }),
  
  delete: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
      then: jest.fn().mockResolvedValue([{ affectedRows: 1 }])
    }),
    where: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
    then: jest.fn().mockResolvedValue([{ affectedRows: 1 }])
  })
};

// Export mocked database components
export const sql = mockSql;
export const db = mockDb;
export const pool = mockSql;

// Mock config to prevent real config loading
export const config = {
  database: {
    url: 'mock://test-database-url'
  },
  server: {
    isProduction: false
  }
};