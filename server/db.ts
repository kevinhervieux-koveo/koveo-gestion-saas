import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';

// Import only tables that exist, not relations to avoid circular dependency issues in production
import { 
  users, 
  organizations, 
  buildings, 
  residences,
  userOrganizations,
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
  monthlyBudgets
} from '@shared/schema';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}

/**
 * PostgreSQL connection pool for the Koveo Gestion application.
 * Uses Neon serverless database with connection pooling for optimal performance.
 */
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Create schema object with only tables (no relations to avoid production errors)
const schema = {
  users,
  organizations,
  buildings,
  residences,
  userOrganizations,
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
 * Relations excluded in production to prevent initialization errors.
 */
export const db = drizzle({ client: pool, schema });

// For production debugging - log schema loading
if (process.env.NODE_ENV === 'production') {
  console.log('📊 Database initialized with', Object.keys(schema).length, 'tables (relations excluded for stability)');
}
