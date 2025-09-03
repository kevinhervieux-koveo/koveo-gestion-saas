import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { config } from './config/index';

// Import only tables that exist, not relations to avoid circular dependency issues in production
import {
  users,
  organizations,
  buildings,
  residences,
  userOrganizations,
  userResidences,
  invitations,
  documents,
  bills,
  demands,
  commonSpaces,
  passwordResetTokens,
  maintenanceRequests,
  permissions,
  userPermissions,
  rolePermissions,
  budgets,
  monthlyBudgets,
} from '@shared/schema';

const databaseUrl = config.database.url;

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}

console.log('🔗 Connecting to database with URL:', databaseUrl.substring(0, 50) + '...');
console.log('🌍 Environment:', config.server.nodeEnv);

/**
 * Neon serverless database connection using HTTP.
 * Uses the same pattern as your successful test code.
 * Optimized for serverless environments like Replit deployments.
 */
export const sql = neon(databaseUrl);

// Test connection
(async () => {
  try {
    const result = await sql`SELECT version()`;
    console.log('✅ Database connection successful:', result[0].version.substring(0, 50) + '...');
  } catch (error: any) {
    console.error('❌ Database connection failed:', error.message);
  }
})();

// Create schema object with only tables (no relations to avoid production errors)
const schema = {
  users,
  organizations,
  buildings,
  residences,
  userOrganizations,
  userResidences,
  invitations,
  documents,
  bills,
  demands,
  commonSpaces,
  passwordResetTokens,
  maintenanceRequests,
  permissions,
  userPermissions,
  rolePermissions,
  budgets,
  monthlyBudgets,
};

/**
 * Drizzle ORM database instance with table definitions only.
 * Provides type-safe database operations for the Quebec property management system.
 * Uses HTTP connection for better compatibility with serverless environments.
 */
export const db = drizzle(sql, { schema });

// Log schema loading
console.log('📊 Database initialized with', Object.keys(schema).length, 'tables');

// For compatibility, export sql as pool for session store
export const pool = sql;
