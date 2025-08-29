import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { buildings, residences } from './property';

// Separate document tables for buildings and residents
/**
 * Documents table for building-related documents.
 */
export const documentsBuildings = pgTable('documents_buildings', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  uploadDate: timestamp('upload_date').defaultNow().notNull(),
  dateReference: timestamp('date_reference'),
  type: text('type').notNull(),
  buildingId: uuid('building_id')
    .references(() => buildings.id)
    .notNull(),
  fileUrl: text('file_url'),
  fileName: text('file_name'),
  fileSize: text('file_size'),
  mimeType: text('mime_type'),
  uploadedBy: uuid('uploaded_by').notNull(),
  isVisibleToTenants: boolean('is_visible_to_tenants').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Documents table for resident-related documents (includes tenants).
 */
export const documentsResidents = pgTable('documents_residents', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  uploadDate: timestamp('upload_date').defaultNow().notNull(),
  dateReference: timestamp('date_reference'),
  type: text('type').notNull(),
  residenceId: uuid('residence_id')
    .references(() => residences.id)
    .notNull(),
  fileUrl: text('file_url'),
  fileName: text('file_name'),
  fileSize: text('file_size'),
  mimeType: text('mime_type'),
  uploadedBy: uuid('uploaded_by').notNull(),
  isVisibleToTenants: boolean('is_visible_to_tenants').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Insert schemas
export const insertDocumentBuildingSchema = z.object({
  name: z.string(),
  dateReference: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  type: z.string(),
  buildingId: z.string().uuid(),
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
  fileSize: z.string().optional(),
  mimeType: z.string().optional(),
  uploadedBy: z.string().min(1, 'Uploaded by user ID is required'),
  isVisibleToTenants: z.boolean().default(false),
});

export const insertDocumentResidentSchema = z.object({
  name: z.string(),
  dateReference: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  type: z.string(),
  residenceId: z.string().uuid(),
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
  fileSize: z.string().optional(),
  mimeType: z.string().optional(),
  uploadedBy: z.string().min(1, 'Uploaded by user ID is required'),
  isVisibleToTenants: z.boolean().default(false),
});

// Types
/**
 *
 */
export type InsertDocumentBuilding = z.infer<typeof insertDocumentBuildingSchema>;
/**
 *
 */
export type DocumentBuilding = typeof documentsBuildings.$inferSelect;
/**
 *
 */
export type InsertDocumentResident = z.infer<typeof insertDocumentResidentSchema>;
/**
 *
 */
export type DocumentResident = typeof documentsResidents.$inferSelect;

// Unified documents table
/**
 * Unified documents table for all document types across the system.
 * Stores documents that can be associated with either residences, buildings, or neither.
 */
export const documents = pgTable('documents', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  description: text('description'),
  documentType: text('document_type').notNull(),
  gcsPath: text('gcs_path').notNull().unique(),
  isVisibleToTenants: boolean('is_visible_to_tenants').default(false).notNull(),
  residenceId: uuid('residence_id').references(() => residences.id),
  buildingId: uuid('building_id').references(() => buildings.id),
  uploadedById: uuid('uploaded_by_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Unified document schema
export const insertDocumentSchema = z.object({
  name: z.string().min(1, 'Document name is required'),
  description: z.string().optional(),
  documentType: z.string().min(1, 'Document type is required'),
  gcsPath: z.string().min(1, 'GCS path is required'),
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
