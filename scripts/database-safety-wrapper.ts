#!/usr/bin/env tsx

/**
 * Database Safety Wrapper
 * Prevents accidental database modifications during testing and validation
 */

/**
 * Check if current environment is safe for database operations
 */
export function isDatabaseSafe(): boolean {
  // Skip database operations if explicitly disabled
  if (process.env.SKIP_DB_OPERATIONS === 'true') {
    return false;
  }

  // Skip database operations in test environment unless explicitly allowed
  if (process.env.NODE_ENV === 'test' && !process.env.ALLOW_TEST_DB) {
    return false;
  }

  // Require explicit production flag for production database operations
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_PRODUCTION_DB) {
    return false;
  }

  return true;
}

/**
 * Safely execute database operations with environment checks
 */
export async function safeDbOperation<T>(
  operation: () => Promise<T>,
  fallbackValue: T,
  operationName: string = 'Database operation'
): Promise<T> {
  if (!isDatabaseSafe()) {
    console.warn(`⚠️  ${operationName} skipped (safe mode - database operations disabled)`);
    return fallbackValue;
  }

  try {
    return await operation();
  } catch (error) {
    console.error(`❌ ${operationName} failed:`, error);
    return fallbackValue;
  }
}

/**
 * Get safe database URL for current environment
 */
export function getSafeDatabaseUrl(): string | undefined {
  if (!isDatabaseSafe()) {
    return undefined;
  }

  // Use test database if available
  if (process.env.NODE_ENV === 'test' && process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }

  // Use production database only if explicitly allowed
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_DB) {
    return process.env.DATABASE_URL;
  }

  // Use development database by default
  if (process.env.NODE_ENV === 'development') {
    return process.env.DATABASE_URL;
  }

  return undefined;
}

/**
 * Log current database safety status
 */
export function logDatabaseStatus(): void {
  const safe = isDatabaseSafe();
  const url = getSafeDatabaseUrl();

  console.log(`🛡️  Database Safety Status: ${safe ? 'ENABLED' : 'DISABLED'}`);
  console.log(`🔗 Database URL: ${url ? 'SET' : 'NOT SET'}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'unknown'}`);
  console.log(`🚫 Skip DB Operations: ${process.env.SKIP_DB_OPERATIONS || 'false'}`);
}
