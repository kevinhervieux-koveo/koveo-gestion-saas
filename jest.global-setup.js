/**
 * Jest Global Setup - Fast test environment initialization
 * Optimized for performance with minimal database operations
 */

module.exports = async () => {
  // Set environment variables for fast test execution
  process.env.NODE_ENV = 'test';
  process.env.SKIP_DB_OPERATIONS = 'true';
  process.env.DISABLE_LOGS = 'true';
  
  // Performance: Disable warnings for faster execution
  process.env.DISABLE_NEON_WARNINGS = 'true';
  
  // Performance: Use fast mock database for unit tests
  const testPath = process.env.npm_config_testPathPattern || '';
  if (testPath.includes('unit')) {
    process.env.TEST_TYPE = 'unit';
    process.env.USE_MOCK_DB = 'true';
  } else if (testPath.includes('integration')) {
    process.env.TEST_TYPE = 'integration';
    // Only use real database for integration tests
    if (process.env.DATABASE_URL) {
      process.env.TEST_DATABASE_URL = process.env.DATABASE_URL;
    }
  }

  // Initialize fast mock database
  global.mockDatabase = new Map();
  
  console.log('🚀 Fast test environment initialized');
};
