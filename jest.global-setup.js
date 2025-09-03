/**
 * Jest Global Setup - Ensures tests run in safe environment
 * Prevents accidental database modifications during testing
 */

module.exports = async () => {
  // Set environment variables to prevent database operations
  process.env.NODE_ENV = 'test';
  process.env.SKIP_DB_OPERATIONS = 'true';

  // Preserve original DATABASE_URL for integration tests but warn about safety
  if (process.env.DATABASE_URL && !process.env.TEST_DATABASE_URL) {
    console.warn('⚠️  Production DATABASE_URL detected - removing for test safety');
    // Store original for integration tests that need real DB access
    process.env.ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;
    process.env.ORIGINAL_DATABASE_URL_KOVEO = process.env.DATABASE_URL_KOVEO;
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_URL_KOVEO;
  }

  // Set test database URL for unit tests only
  if (!process.env.TEST_DATABASE_URL && !process.env.INTEGRATION_TEST) {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/koveo_test';
  }

  console.log('🛡️  Jest running in safe test environment');
};
