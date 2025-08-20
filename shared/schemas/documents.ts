import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Document tables
/**
 * Documents table for managing property-related documents.
 * Supports role-based access control for buildings, residences, and tenants.
 */
export const documents = pgTable('documents', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  uploadDate: timestamp('upload_date').defaultNow().notNull(),
  dateReference: timestamp('date_reference'),
  type: text('type').notNull(),
  buildings: boolean('buildings').notNull().default(false),
  residence: boolean('residence').notNull().default(false),
  tenant: boolean('tenant').notNull().default(false),
});

// Insert schemas
export const insertDocumentSchema = createInsertSchema(documents).pick({
  name: true,
  dateReference: true,
  type: true,
  buildings: true,
  residence: true,
  tenant: true,
});

// Types
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;