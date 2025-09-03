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
    
    // Mock insert operations - proper Drizzle ORM structure
    insert: jest.fn().mockImplementation((table: any) => {
      const insertChain = {
        values: jest.fn().mockImplementation(async (data: any) => {
          const id = Math.random().toString(36).substr(2, 9);
          const result = Array.isArray(data) 
            ? data.map(item => ({ ...item, id: Math.random().toString(36).substr(2, 9) }))
            : [{ ...data, id }];
          mockData.set(id, data);
          return result;
        }),
        returning: jest.fn().mockImplementation(async () => {
          const id = Math.random().toString(36).substr(2, 9);
          return [{ id }];
        })
      };
      
      // Create chainable methods that return properly structured objects
      const createValuesChain = (data: any) => {
        const id = Math.random().toString(36).substr(2, 9);
        const result = Array.isArray(data) 
          ? data.map(item => ({ ...item, id: Math.random().toString(36).substr(2, 9) }))
          : [{ ...data, id }];
        mockData.set(id, data);
        
        return {
          returning: jest.fn().mockImplementation(async () => result)
        };
      };
      
      insertChain.values = jest.fn().mockImplementation((data: any) => createValuesChain(data));
      insertChain.returning = jest.fn().mockImplementation(() => insertChain);
      
      return insertChain;
    }),
    
    // Mock select operations
    select: jest.fn().mockImplementation(() => ({
      from: jest.fn().mockImplementation(() => ({
        where: jest.fn().mockImplementation(() => ({
          limit: jest.fn().mockImplementation(async () => []),
          orderBy: jest.fn().mockImplementation(async () => []),
        })),
        leftJoin: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockImplementation(() => ({
            limit: jest.fn().mockImplementation(async () => []),
          })),
        })),
        innerJoin: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockImplementation(() => ({
            limit: jest.fn().mockImplementation(async () => []),
          })),
        })),
        limit: jest.fn().mockImplementation(async () => []),
        orderBy: jest.fn().mockImplementation(async () => []),
      })),
    })),
    
    // Mock delete operations - proper Drizzle ORM structure
    delete: jest.fn().mockImplementation((table: any) => ({
      where: jest.fn().mockImplementation(async () => {
        return Promise.resolve({ affectedRows: 0 });
      }),
    })),
    
    // Mock update operations
    update: jest.fn().mockImplementation((table: any) => ({
      set: jest.fn().mockImplementation(() => ({
        where: jest.fn().mockImplementation(async () => {
          return Promise.resolve({ affectedRows: 0 });
        }),
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