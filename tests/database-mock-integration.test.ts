/**
 * Integration test for the enhanced database mock system
 * This tests the consolidated database mock functionality
 */

import { jest } from '@jest/globals';

// Import the enhanced database mock directly
const { 
  db, 
  sql, 
  pool, 
  mockSchema, 
  testUtils,
  drizzle,
  neon 
} = require('./mocks/enhanced-database-mock');

describe('Enhanced Database Mock Integration', () => {
  beforeEach(() => {
    testUtils.resetMocks();
  });

  describe('Basic Database Operations', () => {
    test('should support SQL template function', async () => {
      const result = await sql`SELECT version()`;
      expect(result).toEqual([{ version: 'PostgreSQL 15.0 (Mock Version)' }]);
    });

    test('should support neon function', () => {
      const connection = neon('test://connection');
      expect(connection).toBeDefined();
      expect(typeof connection).toBe('function');
    });

    test('should support drizzle function', () => {
      const database = drizzle(sql);
      expect(database).toBeDefined();
      expect(database.query).toBeDefined();
    });

    test('should support Pool class', async () => {
      const result = await pool.query('SELECT version()');
      expect(result.rows).toEqual([{ version: 'PostgreSQL 15.0 (Mock Version)' }]);
    });
  });

  describe('Drizzle ORM Operations', () => {
    test('should support insert operations', async () => {
      const result = await db
        .insert(mockSchema.users)
        .values({ email: 'test@example.com', name: 'Test User' });
      
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        email: 'test@example.com',
        name: 'Test User'
      });
      expect(result[0].id).toMatch(/^mock-/);
      expect(result[0].createdAt).toBeInstanceOf(Date);
    });

    test('should support select operations', async () => {
      const result = await db
        .select()
        .from(mockSchema.users)
        .where({})
        .orderBy('name')
        .limit(10);
      
      expect(Array.isArray(result)).toBe(true);
    });

    test('should support update operations', async () => {
      const result = await db
        .update(mockSchema.users)
        .set({ name: 'Updated Name' })
        .where({});
      
      expect(result.affectedRows).toBe(1);
    });

    test('should support delete operations', async () => {
      const result = await db
        .delete(mockSchema.users)
        .where({});
      
      expect(result.affectedRows).toBe(1);
    });

    test('should support transaction operations', async () => {
      const result = await db.transaction(async (tx) => {
        await tx.insert(mockSchema.users).values({ email: 'tx@example.com' });
        return 'transaction completed';
      });
      
      expect(result).toBe('transaction completed');
    });

    test('should support batch operations', async () => {
      const queries = [
        db.insert(mockSchema.users).values({ email: 'batch1@example.com' }),
        db.insert(mockSchema.users).values({ email: 'batch2@example.com' })
      ];
      
      const results = await db.batch(queries);
      expect(results).toHaveLength(2);
      expect(results[0].affectedRows).toBe(1);
    });
  });

  describe('Schema Support', () => {
    test('should provide mock schema tables', () => {
      expect(mockSchema.users).toBeDefined();
      expect(mockSchema.buildings).toBeDefined();
      expect(mockSchema.residences).toBeDefined();
      expect(mockSchema.documents).toBeDefined();
      expect(mockSchema.bills).toBeDefined();
      
      // Test table structure
      expect(mockSchema.users._).toBeDefined();
      expect(mockSchema.users._.name).toBe('users');
      expect(mockSchema.users.id).toBeDefined();
      expect(mockSchema.users.email).toBeDefined();
    });

    test('should support all expected table names', () => {
      const expectedTables = [
        'users', 'organizations', 'userOrganizations', 'invitations',
        'passwordResetTokens', 'buildings', 'residences', 'userResidences',
        'documents', 'bills', 'budgets', 'monthlyBudgets', 'maintenanceRequests',
        'commonSpaces', 'demands', 'permissions', 'userPermissions', 'rolePermissions'
      ];
      
      expectedTables.forEach(tableName => {
        expect(mockSchema[tableName]).toBeDefined();
        expect(mockSchema[tableName]._.name).toBe(tableName);
      });
    });
  });

  describe('Test Utilities', () => {
    test('should provide data isolation utilities', () => {
      expect(testUtils.clearMockData).toBeDefined();
      expect(testUtils.generateMockId).toBeDefined();
      expect(testUtils.getMockData).toBeDefined();
      expect(testUtils.resetMocks).toBeDefined();
      expect(testUtils.createTestData).toBeDefined();
    });

    test('should generate unique mock IDs', () => {
      const id1 = testUtils.generateMockId();
      const id2 = testUtils.generateMockId();
      
      expect(id1).toMatch(/^mock-/);
      expect(id2).toMatch(/^mock-/);
      expect(id1).not.toBe(id2);
    });

    test('should create and store test data', () => {
      const testData = testUtils.createTestData('users', {
        email: 'testdata@example.com',
        name: 'Test Data User'
      });
      
      expect(testData.id).toMatch(/^mock-/);
      expect(testData.email).toBe('testdata@example.com');
      expect(testData.createdAt).toBeInstanceOf(Date);
      
      const dataStore = testUtils.getMockData();
      expect(dataStore.has(testData.id)).toBe(true);
    });

    test('should clear mock data for isolation', () => {
      testUtils.createTestData('users', { email: 'temp@example.com' });
      let dataStore = testUtils.getMockData();
      expect(dataStore.size).toBeGreaterThan(0);
      
      testUtils.clearMockData();
      dataStore = testUtils.getMockData();
      expect(dataStore.size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle promise rejections gracefully', async () => {
      // Test that chainable methods handle catch properly
      const query = db.select().from(mockSchema.users);
      
      expect(() => query.catch(() => {})).not.toThrow();
      expect(() => query.finally(() => {})).not.toThrow();
    });

    test('should handle empty operations', async () => {
      const result = await db.select().from(mockSchema.users);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  describe('Complex Query Support', () => {
    test('should support complex chained operations', async () => {
      const result = await db
        .select()
        .from(mockSchema.users)
        .leftJoin(mockSchema.userOrganizations, {})
        .where({})
        .orderBy('name')
        .groupBy('id')
        .having({})
        .limit(5)
        .offset(10);
      
      expect(Array.isArray(result)).toBe(true);
    });

    test('should support with clauses', async () => {
      const result = await db.$with('temp').select().from(mockSchema.users);
      expect(Array.isArray(result)).toBe(true);
    });

    test('should support returning clauses in inserts', async () => {
      const result = await db
        .insert(mockSchema.users)
        .values({ email: 'returning@example.com' })
        .returning();
      
      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('returning@example.com');
    });
  });
});