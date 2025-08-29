import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, varchar, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { buildings, residences } from './property';
import { users } from './core';

/**
 * Unified documents table for storing all document types.
 * Supports both building-level and residence-level documents.
 */
export const documents = pgTable('documents', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  description: text('description'),
  documentType: text('document_type').notNull(), // e.g., 'lease', 'invoice', 'by-law'
  gcsPath: text('gcs_path').notNull().unique(), // Full GCS path: 'residences/{residenceId}/{uuid}.pdf'
  isVisibleToTenants: boolean('is_visible_to_tenants').default(false).notNull(),
  residenceId: varchar('residence_id').references(() => residences.id), // nullable
  buildingId: varchar('building_id').references(() => buildings.id), // nullable  
  uploadedById: varchar('uploaded_by_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Insert schema
export const insertDocumentSchema = createInsertSchema(documents, {
  name: z.string().min(1, 'Document name is required'),
  description: z.string().optional(),
  documentType: z.string().min(1, 'Document type is required'),
  gcsPath: z.string().min(1, 'GCS path is required'),
  isVisibleToTenants: z.boolean().default(false),
  residenceId: z.string().optional(),
  buildingId: z.string().optional(),
  uploadedById: z.string().min(1, 'Uploader ID is required'),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
