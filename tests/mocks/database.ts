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
// Create the complete mock database with all Drizzle operations
export const mockDb = createMockDatabase();

// Create a mock table that looks like a Drizzle table with all necessary properties
const createMockTable = (tableName: string) => {
  return {
    // Table properties that Drizzle uses
    _: {
      name: tableName,
      schema: undefined,
      columns: {},
      baseName: tableName
    },
    // Mock column properties for common fields
    id: { name: 'id' },
    email: { name: 'email' },
    name: { name: 'name' },
    role: { name: 'role' },
    userId: { name: 'userId' },
    organizationId: { name: 'organizationId' },
    buildingId: { name: 'buildingId' },
    // Add any other commonly accessed column properties
  };
};

// Mock all the individual schema tables that tests import
export const mockSchemaObject = {
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
  
  // Document and financial tables
  documents: createMockTable('documents'),
  bills: createMockTable('bills'),
  budgets: createMockTable('budgets'),
  monthlyBudgets: createMockTable('monthlyBudgets'),
  
  // Operations tables
  maintenanceRequests: createMockTable('maintenanceRequests'),
  commonSpaces: createMockTable('commonSpaces'),
  
  // System tables
  permissions: createMockTable('permissions'),
  userPermissions: createMockTable('userPermissions'),
  rolePermissions: createMockTable('rolePermissions'),
  demands: createMockTable('demands')
};

// Mock SQL template function with Neon compatibility
export const mockSql = jest.fn().mockImplementation(async (strings: TemplateStringsArray, ...values: any[]) => {
  const query = strings.join('?');
  if (query.includes('SELECT version()')) {
    return [{ version: 'PostgreSQL 15.0 (Mock)' }];
  }
  return [];
});

// Add Neon-specific methods to prevent TypeScript errors
mockSql.setTypeParser = jest.fn();
mockSql.sql = mockSql; // Self-reference for compatibility