import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, boolean, varchar, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { buildings, residences } from './property';


// Unified documents table
/**
 * Unified documents table for all document types across the system.
 * Stores documents that can be associated with either residences, buildings, or neither.
 */
export const documents = pgTable('documents', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  description: text('description'),
  documentType: text('document_type').notNull(),
  filePath: text('file_path').notNull().unique(),
  isVisibleToTenants: boolean('is_visible_to_tenants').default(false).notNull(),
  residenceId: uuid('residence_id').references(() => residences.id),
  buildingId: uuid('building_id').references(() => buildings.id),
  uploadedById: varchar('uploaded_by_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Unified document schema
export const insertDocumentSchema = z.object({
  name: z.string().min(1, 'Document name is required'),
  description: z.string().optional(),
  documentType: z.string().min(1, 'Document type is required'),
  filePath: z.string().min(1, 'File path is required'),
  isVisibleToTenants: z.boolean().default(false),
  residenceId: z.string().uuid().optional(),
  buildingId: z.string().uuid().optional(),
  uploadedById: z.string().uuid().min(1, 'Uploaded by user ID is required'),
});

/**
 * Insert type for unified documents
 */
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

/**
 * Select type for unified documents
 */
export type Document = typeof documents.$inferSelect;
