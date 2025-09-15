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

// In-memory store for test data  
const store = {
  invitations: [],
  organizations: [],
  users: [],
  buildings: [],
  residences: []
};

// Enhanced predicate evaluator with support for column-to-column comparisons
const evaluatePredicate = (item, condition, context = {}) => {
  if (!condition) return true;
  
  if (condition.type === 'eq') {
    const leftValue = condition.column?.name ? item[condition.column.name] : condition.column;
    const rightValue = condition.value?.name ? 
      (context.right && context.right[condition.value.name]) || item[condition.value.name] :
      condition.value;
    
    return leftValue === rightValue;
  }
  
  if (condition.type === 'and') {
    return condition.conditions.every(cond => evaluatePredicate(item, cond, context));
  }
  
  if (condition.type === 'or') {
    return condition.conditions.some(cond => evaluatePredicate(item, cond, context));
  }
  
  return true;
};

// Enhanced mock database with dynamic evaluation
const mockDb = {
  query: mockQuery,
  
  insert: jest.fn().mockImplementation((table) => ({
    values: jest.fn().mockImplementation((data) => {
      const tableName = table?._.name || table?.name;
      const tableStore = store[tableName] || [];
      
      // Handle array of values
      const items = Array.isArray(data) ? data : [data];
      
      items.forEach(item => {
        // Check unique constraints for invitations
        if (tableName === 'invitations' && item.token) {
          const existing = tableStore.find(inv => inv.token === item.token || inv.tokenHash === item.tokenHash);
          if (existing) {
            throw new Error('Unique constraint violation: token already exists');
          }
        }
        
        // Add to store with proper ID generation
        const newItem = { 
          id: item.id || `${tableName}_${Date.now()}_${Math.random()}`, 
          ...item 
        };
        
        // Ensure we're modifying the actual store reference
        if (!store[tableName]) store[tableName] = [];
        store[tableName].push(newItem);
      });
      
      return {
        returning: jest.fn().mockImplementation(() => Promise.resolve(items))
      };
    }),
    returning: jest.fn().mockImplementation(() => Promise.resolve([]))
  })),
  
  update: mockUpdate,
  
  delete: jest.fn().mockImplementation((table) => ({
    where: jest.fn().mockImplementation((condition) => {
      const tableName = table?._.name || table?.name;
      const tableStore = store[tableName] || [];
      
      const initialLength = tableStore.length;
      const filtered = tableStore.filter(item => !evaluatePredicate(item, condition));
      
      // Update the store
      store[tableName] = filtered;
      
      const deletedCount = initialLength - filtered.length;
      return Promise.resolve({ affectedRows: deletedCount });
    })
  })),
  
  select: jest.fn().mockImplementation((projection) => ({
    from: jest.fn().mockImplementation((table) => {
      const tableName = table?._.name || table?.name;
      let dataset = store[tableName] || [];
      
      return {
        where: jest.fn().mockImplementation((condition) => {
          const filtered = dataset.filter(item => evaluatePredicate(item, condition));
          
          return {
            leftJoin: jest.fn().mockImplementation((joinTable, joinCondition) => {
              const joinTableName = joinTable?._.name || joinTable?.name;
              const joinDataset = store[joinTableName] || [];
              
              // Enhanced leftJoin with column-to-column support
              const joined = filtered.map(item => {
                const match = joinDataset.find(joinItem => 
                  evaluatePredicate(item, joinCondition, { right: joinItem })
                );
                
                // Apply projection mapping if provided
                let result = { ...item, ...(match || {}) };
                if (projection && typeof projection === 'object') {
                  const projected = {};
                  Object.keys(projection).forEach(key => {
                    const column = projection[key];
                    if (column?.name) {
                      projected[key] = result[column.name] || (match && match[column.name]);
                    } else {
                      projected[key] = result[key];
                    }
                  });
                  result = projected;
                }
                
                return result;
              });
              
              return {
                where: jest.fn().mockImplementation((cond) => 
                  Promise.resolve(joined.filter(item => evaluatePredicate(item, cond)))
                ),
                execute: jest.fn().mockImplementation(() => Promise.resolve(joined))
              };
            }),
            limit: jest.fn().mockImplementation(() => Promise.resolve(filtered)),
            orderBy: jest.fn().mockImplementation(() => Promise.resolve(filtered)),
            execute: jest.fn().mockImplementation(() => Promise.resolve(filtered))
          };
        }),
        leftJoin: jest.fn().mockImplementation(() => Promise.resolve(dataset)),
        limit: jest.fn().mockImplementation(() => Promise.resolve(dataset)),
        orderBy: jest.fn().mockImplementation(() => Promise.resolve(dataset)),
        execute: jest.fn().mockImplementation(() => Promise.resolve(dataset))
      };
    })
  }))
};

// Mock schema with common tables and column references
const mockSchema = {
  organizations: { 
    name: 'organizations',
    id: { name: 'id' },
    name: { name: 'name' },
    type: { name: 'type' }
  },
  users: { 
    name: 'users',
    id: { name: 'id' },
    username: { name: 'username' },
    email: { name: 'email' }
  },
  userOrganizations: { 
    name: 'userOrganizations',
    id: { name: 'id' },
    userId: { name: 'userId' },
    organizationId: { name: 'organizationId' }
  },
  invitations: { 
    name: 'invitations',
    id: { name: 'id' },
    email: { name: 'email' },
    status: { name: 'status' },
    token: { name: 'token' },
    organizationId: { name: 'organizationId' },
    buildingId: { name: 'buildingId' },
    residenceId: { name: 'residenceId' },
    role: { name: 'role' },
    expiresAt: { name: 'expiresAt' }
  },
  buildings: { 
    name: 'buildings',
    id: { name: 'id' },
    name: { name: 'name' }
  },
  residences: { 
    name: 'residences',
    id: { name: 'id' },
    unitNumber: { name: 'unitNumber' }
  }
};

// Test utilities
const testUtils = {
  resetMocks: jest.fn(),
  clearData: jest.fn().mockImplementation(() => {
    Object.keys(store).forEach(key => {
      store[key] = [];
    });
  }),
  seedData: jest.fn().mockImplementation((tableName, data) => {
    if (!store[tableName]) store[tableName] = [];
    store[tableName].push(...(Array.isArray(data) ? data : [data]));
  }),
  getStore: () => store
};

// Fix exports for proper import compatibility
module.exports = {
  // Core exports for tests
  mockDb,
  testUtils,
  mockSchema,
  
  // Query operators
  eq,
  and, 
  or,
  sql,
  
  // Database mocks for module mapping
  drizzle: jest.fn().mockReturnValue(mockDb),
  
  // pg-core functions for schema imports
  pgEnum,
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  uuid,
  
  // Neon serverless mocks
  Pool: MockPool,
  neonConfig
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