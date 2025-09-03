/**
 * Fast in-memory database mock for unit tests
 * Provides instant responses without network calls
 */

export const createMockDatabase = () => {
  const mockData = new Map();
  
  return {
    // Mock query function that returns immediately
    query: jest.fn().mockImplementation(async (sql: string) => {
      // Return empty results for test queries
      if (sql.includes('SELECT version()')) {
        return [{ version: 'PostgreSQL 15.0 (Mock)' }];
      }
      return [];
    }),
    
    // Mock insert operations
    insert: jest.fn().mockImplementation(async (table: string) => ({
      values: jest.fn().mockImplementation(async (data: any) => {
        const id = Math.random().toString(36).substr(2, 9);
        mockData.set(id, data);
        return [{ ...data, id }];
      }),
    })),
    
    // Mock select operations
    select: jest.fn().mockImplementation(() => ({
      from: jest.fn().mockImplementation(() => ({
        where: jest.fn().mockImplementation(() => ({
          limit: jest.fn().mockImplementation(async () => []),
        })),
      })),
    })),
    
    // Mock delete operations
    delete: jest.fn().mockImplementation(() => ({
      where: jest.fn().mockImplementation(async () => ({ affectedRows: 0 })),
    })),
    
    // Mock update operations
    update: jest.fn().mockImplementation(() => ({
      set: jest.fn().mockImplementation(() => ({
        where: jest.fn().mockImplementation(async () => ({ affectedRows: 0 })),
      })),
    })),
  };
};

// Global mock instance
export const mockDb = createMockDatabase();

// Mock SQL template function
export const mockSql = jest.fn().mockImplementation(async (strings: TemplateStringsArray, ...values: any[]) => {
  const query = strings.join('?');
  if (query.includes('SELECT version()')) {
    return [{ version: 'PostgreSQL 15.0 (Mock)' }];
  }
  return [];
});