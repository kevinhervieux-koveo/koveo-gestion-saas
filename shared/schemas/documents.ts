import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
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
  buildingId: uuid('building_id').references(() => buildings.id).notNull(),
  fileUrl: text('file_url'),
  fileName: text('file_name'),
  fileSize: text('file_size'),
  mimeType: text('mime_type'),
  uploadedBy: uuid('uploaded_by').notNull(),
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
  residenceId: uuid('residence_id').references(() => residences.id).notNull(),
  fileUrl: text('file_url'),
  fileName: text('file_name'),
  fileSize: text('file_size'),
  mimeType: text('mime_type'),
  uploadedBy: uuid('uploaded_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Insert schemas
export const insertDocumentBuildingSchema = createInsertSchema(documentsBuildings).pick({
  name: true,
  dateReference: true,
  type: true,
  buildingId: true,
  fileUrl: true,
  fileName: true,
  fileSize: true,
  mimeType: true,
  uploadedBy: true,
}).extend({
  dateReference: z.string().optional().transform((val) => val ? new Date(val) : undefined),
});

export const insertDocumentResidentSchema = createInsertSchema(documentsResidents).pick({
  name: true,
  dateReference: true,
  type: true,
  residenceId: true,
  fileUrl: true,
  fileName: true,
  fileSize: true,
  mimeType: true,
  uploadedBy: true,
}).extend({
  dateReference: z.string().optional().transform((val) => val ? new Date(val) : undefined),
});

// Types
export type InsertDocumentBuilding = z.infer<typeof insertDocumentBuildingSchema>;
export type DocumentBuilding = typeof documentsBuildings.$inferSelect;
export type InsertDocumentResident = z.infer<typeof insertDocumentResidentSchema>;
export type DocumentResident = typeof documentsResidents.$inferSelect;

// Legacy document table (kept for migration purposes)
export const documents = pgTable('documents', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  uploadDate: timestamp('upload_date').defaultNow().notNull(),
  dateReference: timestamp('date_reference'),
  type: text('type').notNull(),
  buildings: text('buildings').notNull().default('false'),
  residence: text('residence').notNull().default('false'),
  tenant: text('tenant').notNull().default('false'),
});

// Legacy types for migration
export const insertDocumentSchema = createInsertSchema(documents).pick({
  name: true,
  dateReference: true,
  type: true,
  buildings: true,
  residence: true,
  tenant: true,
});

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;