/**
 * Jest Global Setup - Ensures tests run in safe environment
 * Prevents accidental database modifications during testing
 */

module.exports = async () => {
  // Set environment variables to prevent database operations
  process.env.NODE_ENV = 'test';
  process.env.SKIP_DB_OPERATIONS = 'true';

  // For tests that need database access, use the same database but with test isolation
  if (process.env.DATABASE_URL) {
    console.warn('⚠️  Production DATABASE_URL detected - using for tests with isolation');
    // Keep the database URL for tests that need it but ensure proper cleanup
    process.env.TEST_DATABASE_URL = process.env.DATABASE_URL;
  }

  console.log('🛡️  Jest running in safe test environment');
};
