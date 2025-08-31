/**
 * Jest Global Setup - Ensures tests run in safe environment
 * Prevents accidental database modifications during testing
 */

module.exports = async () => {
  // Set environment variables to prevent database operations
  process.env.NODE_ENV = 'test';
  process.env.SKIP_DB_OPERATIONS = 'true';

  // Remove production database URL to prevent accidental connections
  if (process.env.DATABASE_URL && !process.env.TEST_DATABASE_URL) {
    console.warn('⚠️  Production DATABASE_URL detected - removing for test safety');
    delete process.env.DATABASE_URL;
  }

  // Set test database URL for all tests
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/koveo_test';

  console.log('🛡️  Jest running in safe test environment');
};
