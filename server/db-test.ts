/**
 * Optimized database configuration for tests
 * Uses connection pooling and faster setup for test environments
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { config } from './config/index';
import * as schema from '@shared/schema';

// Use test database URL or fallback to main database with test isolation
const testDatabaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error('No database URL available for tests');
}

// Configure Neon for faster test execution
const testSql = neon(testDatabaseUrl, {
  // Optimize for test performance
  fullResults: false,
  arrayMode: false,
});

// Create database instance optimized for tests
export const testDb = drizzle(testSql, { 
  schema,
  logger: false, // Disable logging for faster tests
});

export { testSql };

// Connection pool for session store in tests
export const testPool = testSql;

// Fast database health check for tests
export const checkTestDbConnection = async () => {
  try {
    await testSql`SELECT 1`;
    return true;
  } catch (error) {
    console.warn('Test database connection failed:', error);
    return false;
  }
};