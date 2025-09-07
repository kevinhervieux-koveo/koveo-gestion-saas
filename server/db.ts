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

// Use correct database URL based on environment (production uses DATABASE_URL_KOVEO)
const databaseUrl = config.database.url;

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}

const isUsingKoveoDb = databaseUrl.includes('DATABASE_URL_KOVEO') || (config.server.isProduction && process.env.DATABASE_URL_KOVEO);
// Database connection established

/**
 * Neon serverless database connection using HTTP.
 * Uses the same pattern as your successful test code.
 * Optimized for serverless environments like Replit deployments.
 */
export const sql = neon(databaseUrl, {
  arrayMode: false,
  fullResults: false,
});

// Test connection
(async () => {
  try {
    const result = await sql`SELECT version()`;
    // Database connection verified
  } catch (error: any) {
    console.error('Database connection failed:', error.message);
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

// Database schema initialized

// For compatibility, export sql as pool for session store
export const pool = sql;
