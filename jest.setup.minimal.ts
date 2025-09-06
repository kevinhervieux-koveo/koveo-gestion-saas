/**
 * Minimal Jest Setup for Testing Koveo Gestion Platform
 * Focused on preventing hanging and test failures
 */

// Set test environment variables first
process.env.NODE_ENV = 'test';
process.env.TEST_TYPE = 'unit';
process.env.USE_MOCK_DB = 'true';
process.env.SKIP_DB_OPERATIONS = 'true';
process.env.DATABASE_URL = 'postgresql://mock:mock@localhost:5432/mock_test';

// Mock fetch for tests
global.fetch = jest.fn();

// Mock any modules that might cause hanging
jest.mock('@neondatabase/serverless', () => ({
  Pool: jest.fn(),
  neon: jest.fn(),
}));

jest.mock('drizzle-orm/neon-serverless', () => ({
  drizzle: jest.fn(),
}));

console.log('✅ Minimal Jest setup completed');