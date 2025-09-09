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
 * Enhanced Neon serverless database connection with stability improvements.
 * Uses the same pattern as your successful test code.
 * Optimized for serverless environments like Replit deployments.
 */
export const sql = neon(databaseUrl, {
  arrayMode: false,
  fullResults: false,
  // Enhanced connection stability settings
  connectionTimeoutMillis: 30000, // 30 seconds timeout
  idleTimeoutMillis: 60000, // 60 seconds idle timeout
  maxConnections: 10, // Limit concurrent connections
  retries: 3, // Retry failed connections
});

// Enhanced connection test with retry logic
(async () => {
  let retries = 3;
  while (retries > 0) {
    try {
      const result = await sql`SELECT version()`;
      console.log('✅ Database connection verified');
      break;
    } catch (error: any) {
      retries--;
      if (retries === 0) {
        console.error('❌ Database connection failed after retries:', error.message);
      } else {
        console.warn(`⚠️ Database connection retry ${4 - retries}/3...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
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
