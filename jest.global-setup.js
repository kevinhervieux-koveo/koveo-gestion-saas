/**
 * Jest Global Setup - Fast test environment initialization
 * Optimized for performance with minimal database operations
 */

module.exports = async () => {
  // Set standardized environment variables for test execution
  process.env.NODE_ENV = 'test';
  process.env.SKIP_DB_OPERATIONS = 'true';
  process.env.DISABLE_LOGS = 'true';
  process.env.DISABLE_NEON_WARNINGS = 'true';
  
  // Set test database URL if not already set
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/koveo_test';
  }
  
  // Determine test type from test path
  const testPath = process.env.npm_config_testPathPattern || process.env.JEST_WORKER_ID || '';
  const testFile = process.env.npm_lifecycle_script || '';
  
  if (testPath.includes('unit') || testFile.includes('unit')) {
    process.env.TEST_TYPE = 'unit';
    process.env.USE_MOCK_DB = 'true';
  } else if (testPath.includes('integration') || testFile.includes('integration')) {
    process.env.TEST_TYPE = 'integration';
    process.env.USE_MOCK_DB = 'false';
    process.env.TEST_DATABASE_URL = process.env.DATABASE_URL;
  } else {
    // Default to unit test mode for safety
    process.env.TEST_TYPE = 'unit';
    process.env.USE_MOCK_DB = 'true';
  }

  // Initialize mock database for unit tests
  if (process.env.USE_MOCK_DB === 'true') {
    global.mockDatabase = new Map();
  }
  
  console.log(`🚀 Test environment initialized: ${process.env.TEST_TYPE} tests, mock DB: ${process.env.USE_MOCK_DB}`);
};
