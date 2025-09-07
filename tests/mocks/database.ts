/**
 * Fast in-memory database mock for unit tests
 * Provides instant responses without network calls
 */

// Create a global mock data store
const mockDataStore = new Map();
let mockIdCounter = 1;

const generateMockId = () => {
  return `mock-${mockIdCounter++}-${Date.now().toString(36)}`;
};

export const createMockDatabase = () => {
  return {
    // Mock query function that returns immediately
    query: jest.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT version()')) {
        return [{ version: 'PostgreSQL 15.0 (Mock)' }];
      }
      return [];
    }),
    
    // Mock insert operations - proper Drizzle ORM structure
    insert: jest.fn().mockImplementation((table: any) => {
      return {
        values: jest.fn().mockImplementation((data: any) => {
          return {
            returning: jest.fn().mockImplementation(async () => {
              const id = generateMockId();
              const now = new Date();
              
              if (Array.isArray(data)) {
                return data.map(item => ({
                  id: generateMockId(),
                  ...item,
                  createdAt: now,
                  updatedAt: now
                }));
              } else {
                const result = {
                  id,
                  ...data,
                  createdAt: now,
                  updatedAt: now
                };
                mockDataStore.set(id, result);
                return [result];
              }
            })
          };
        })
      };
    }),
    
    // Also provide async support for values chain
    insertAsync: jest.fn().mockImplementation((table: any) => {
      return {
        values: jest.fn().mockImplementation(async (data: any) => {
          const id = generateMockId();
          const now = new Date();
          
          if (Array.isArray(data)) {
            return data.map(item => ({
              id: generateMockId(),
              ...item,
              createdAt: now,
              updatedAt: now
            }));
          } else {
            const result = {
              id,
              ...data,
              createdAt: now,
              updatedAt: now
            };
            mockDataStore.set(id, result);
            return [result];
          }
        })
      };
    }),
    
    // Mock select operations with proper chaining
    select: jest.fn().mockImplementation(() => {
      const selectChain = {
        from: jest.fn().mockImplementation(() => selectChain),
        where: jest.fn().mockImplementation(() => selectChain),
        leftJoin: jest.fn().mockImplementation(() => selectChain),
        innerJoin: jest.fn().mockImplementation(() => selectChain),
        rightJoin: jest.fn().mockImplementation(() => selectChain),
        orderBy: jest.fn().mockImplementation(() => selectChain),
        limit: jest.fn().mockImplementation(() => selectChain),
        offset: jest.fn().mockImplementation(() => selectChain),
        groupBy: jest.fn().mockImplementation(() => selectChain),
        having: jest.fn().mockImplementation(() => selectChain),
        // Make it thenable
        then: jest.fn().mockImplementation((resolve) => {
          return Promise.resolve([]).then(resolve);
        }),
        catch: jest.fn().mockImplementation((reject) => {
          return Promise.resolve([]).catch(reject);
        })
      };
      return selectChain;
    }),
    
    // Mock delete operations - proper Drizzle ORM structure
    delete: jest.fn().mockImplementation((table: any) => {
      const deleteChain = {
        where: jest.fn().mockImplementation(() => deleteChain),
        // Make it thenable
        then: jest.fn().mockImplementation((resolve) => {
          return Promise.resolve({ affectedRows: 1 }).then(resolve);
        }),
        catch: jest.fn().mockImplementation((reject) => {
          return Promise.resolve({ affectedRows: 1 }).catch(reject);
        })
      };
      return deleteChain;
    }),
    
    // Mock update operations
    update: jest.fn().mockImplementation((table: any) => {
      const updateChain = {
        set: jest.fn().mockImplementation(() => updateChain),
        where: jest.fn().mockImplementation(() => updateChain),
        // Make it thenable
        then: jest.fn().mockImplementation((resolve) => {
          return Promise.resolve({ affectedRows: 1 }).then(resolve);
        }),
        catch: jest.fn().mockImplementation((reject) => {
          return Promise.resolve({ affectedRows: 1 }).catch(reject);
        })
      };
      return updateChain;
    }),
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
(mockSql as any).setTypeParser = jest.fn();
(mockSql as any).sql = mockSql; // Self-reference for compatibility