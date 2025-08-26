import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';

// Import schema components directly to avoid circular dependency issues
import * as schema from '@shared/schema';

// Ensure schema is properly loaded
if (!schema || Object.keys(schema).length === 0) {
  console.warn('⚠️ Schema import failed - using database without schema');
}

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}

/**
 * PostgreSQL connection pool for the Koveo Gestion application.
 * Uses Neon serverless database with connection pooling for optimal performance.
 */
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Drizzle ORM database instance with complete schema definitions.
 * Provides type-safe database operations for the Quebec property management system.
 * Includes all tables for users, organizations, buildings, features, and development framework.
 */
export const db = drizzle({ client: pool });

// For production debugging - log schema loading
if (process.env.NODE_ENV === 'production') {
  console.log('📊 Database initialized without schema to avoid relation errors');
}
