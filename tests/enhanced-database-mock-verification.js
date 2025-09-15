/**
 * Direct verification of enhanced database mock functionality
 * Tests the database mock without full Jest setup to avoid MSW conflicts
 */

// Import the enhanced database mock directly using dynamic import
import('./mocks/enhanced-database-mock.js').then(async ({
  db,
  sql,
  pool,
  mockSchema,
  testUtils,
  drizzle,
  neon
}) => {

function runTests() {
  console.log('🔧 Running Enhanced Database Mock Verification Tests...\n');

  let testResults = {
    passed: 0,
    failed: 0,
    total: 0
  };

  function test(name, fn) {
    testResults.total++;
    try {
      const result = fn();
      if (result instanceof Promise) {
        result.then(() => {
          console.log(`✅ ${name}`);
          testResults.passed++;
        }).catch((error) => {
          console.log(`❌ ${name}: ${error.message}`);
          testResults.failed++;
        });
      } else {
        console.log(`✅ ${name}`);
        testResults.passed++;
      }
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
      testResults.failed++;
    }
  }

  // Basic functionality tests
  test('SQL template function works', async () => {
    const result = await sql`SELECT version()`;
    if (!Array.isArray(result) || result[0].version !== 'PostgreSQL 15.0 (Mock Version)') {
      throw new Error('SQL template function failed');
    }
  });

  test('Neon function returns callable', () => {
    const connection = neon('test://connection');
    if (typeof connection !== 'function') {
      throw new Error('Neon function should return a callable');
    }
  });

  test('Drizzle function returns database object', () => {
    const database = drizzle(sql);
    if (!database || typeof database.query !== 'function') {
      throw new Error('Drizzle function should return database object with query method');
    }
  });

  test('Pool query works', async () => {
    const result = await pool.query('SELECT version()');
    if (!result.rows || !Array.isArray(result.rows)) {
      throw new Error('Pool query should return object with rows array');
    }
  });

  // Drizzle ORM operations
  test('Insert operation with values chain', async () => {
    const result = await db
      .insert(mockSchema.users)
      .values({ email: 'test@example.com', name: 'Test User' });
    
    if (!Array.isArray(result) || result.length === 0) {
      throw new Error('Insert should return array with results');
    }
    if (!result[0].id || !result[0].id.startsWith('mock-')) {
      throw new Error('Insert should generate mock ID');
    }
    if (result[0].email !== 'test@example.com') {
      throw new Error('Insert should preserve data');
    }
  });

  test('Select operation with chaining', async () => {
    const result = await db
      .select()
      .from(mockSchema.users)
      .where({})
      .orderBy('name');
    
    if (!Array.isArray(result)) {
      throw new Error('Select should return array');
    }
  });

  test('Update operation', async () => {
    const result = await db
      .update(mockSchema.users)
      .set({ name: 'Updated Name' })
      .where({});
    
    if (!result.affectedRows || result.affectedRows !== 1) {
      throw new Error('Update should return affectedRows');
    }
  });

  test('Delete operation', async () => {
    const result = await db
      .delete(mockSchema.users)
      .where({});
    
    if (!result.affectedRows || result.affectedRows !== 1) {
      throw new Error('Delete should return affectedRows');
    }
  });

  test('Transaction support', async () => {
    const result = await db.transaction(async (tx) => {
      return 'transaction completed';
    });
    
    if (result !== 'transaction completed') {
      throw new Error('Transaction should execute callback');
    }
  });

  // Schema tests
  test('Mock schema has required tables', () => {
    const requiredTables = [
      'users', 'organizations', 'buildings', 'residences',
      'documents', 'bills', 'maintenanceRequests'
    ];
    
    for (const tableName of requiredTables) {
      if (!mockSchema[tableName]) {
        throw new Error(`Schema missing table: ${tableName}`);
      }
      if (!mockSchema[tableName]._ || mockSchema[tableName]._.name !== tableName) {
        throw new Error(`Table ${tableName} missing proper structure`);
      }
    }
  });

  // Test utilities
  test('Test utilities work', () => {
    const id = testUtils.generateMockId();
    if (!id || !id.startsWith('mock-')) {
      throw new Error('generateMockId should return mock ID');
    }
    
    const testData = testUtils.createTestData('users', { email: 'util@example.com' });
    if (!testData.id || !testData.email) {
      throw new Error('createTestData should return proper data');
    }
    
    const dataStore = testUtils.getMockData();
    if (!dataStore.has(testData.id)) {
      throw new Error('createTestData should store data');
    }
    
    testUtils.clearMockData();
    if (dataStore.size !== 0) {
      throw new Error('clearMockData should clear store');
    }
  });

  test('Complex query chaining', async () => {
    const result = await db
      .select()
      .from(mockSchema.users)
      .leftJoin(mockSchema.userOrganizations, {})
      .where({})
      .orderBy('name')
      .limit(5);
    
    if (!Array.isArray(result)) {
      throw new Error('Complex query should return array');
    }
  });

  test('Batch operations', async () => {
    const queries = [
      db.insert(mockSchema.users).values({ email: 'batch1@example.com' }),
      db.insert(mockSchema.users).values({ email: 'batch2@example.com' })
    ];
    
    const results = await db.batch(queries);
    if (!Array.isArray(results) || results.length !== 2) {
      throw new Error('Batch should return array of results');
    }
  });

  // Wait for async tests to complete
  setTimeout(() => {
    console.log('\n📊 Test Results:');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📝 Total: ${testResults.total}`);
    
    if (testResults.failed === 0) {
      console.log('\n🎉 All tests passed! Enhanced database mock is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the implementation.');
    }
  }, 1000);
}

  // Run the tests
  runTests();
}).catch((error) => {
  console.error('❌ Failed to import enhanced database mock:', error);
});