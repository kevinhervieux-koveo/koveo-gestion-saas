import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { NeonHttpTransaction } from 'drizzle-orm/neon-http';
import * as schema from '@shared/schema';

/**
 * Type for Drizzle database transaction (Neon HTTP)
 * This ensures type safety when passing transactions to service methods
 */
export type DrizzleTransaction = NeonHttpTransaction<typeof schema>;

/**
 * Type for database context that can be either the main db or a transaction
 */
export type DatabaseContext = NeonHttpDatabase<typeof schema> | DrizzleTransaction;