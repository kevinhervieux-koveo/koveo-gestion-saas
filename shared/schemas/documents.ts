import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, boolean, varchar, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { buildings, residences } from './property';


// Unified documents table
/**
 * Unified documents table for all document types across the system.
 * Stores documents that can be associated with either residences, buildings, or neither.
 * Enhanced with file metadata, content type, and attachment relationships.
 */
export const documents = pgTable('documents', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  description: text('description'),
  documentType: text('document_type').notNull(),
  filePath: text('file_path').notNull().unique(),
  fileName: text('file_name'), // Original filename
  fileSize: varchar('file_size'), // File size in bytes
  mimeType: text('mime_type'), // MIME type for proper handling
  isVisibleToTenants: boolean('is_visible_to_tenants').default(false).notNull(),
  residenceId: varchar('residence_id').references(() => residences.id),
  buildingId: varchar('building_id').references(() => buildings.id),
  uploadedById: varchar('uploaded_by_id').notNull(),
  // Support for document attachments to forms
  attachedToType: text('attached_to_type'), // 'bill', 'feature_request', 'bug_report', etc.
  attachedToId: varchar('attached_to_id'), // ID of the entity this document is attached to
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Enhanced document schema with file metadata
export const insertDocumentSchema = z.object({
  name: z.string().min(1, 'Document name is required'),
  description: z.string().optional(),
  documentType: z.string().min(1, 'Document type is required'),
  filePath: z.string().min(1, 'File path is required'),
  fileName: z.string().optional(),
  fileSize: z.string().optional(),
  mimeType: z.string().optional(),
  isVisibleToTenants: z.boolean().default(false),
  residenceId: z.string().uuid().optional(),
  buildingId: z.string().uuid().optional(),
  uploadedById: z.string().uuid().min(1, 'Uploaded by user ID is required'),
  attachedToType: z.string().optional(),
  attachedToId: z.string().uuid().optional(),
});

// Schema for form-attached documents
export const attachDocumentSchema = z.object({
  name: z.string().min(1, 'Document name is required'),
  description: z.string().optional(),
  documentType: z.enum(['attachment', 'screenshot', 'evidence', 'supporting_document']).default('attachment'),
  fileName: z.string().min(1, 'File name is required'),
  fileSize: z.string().optional(),
  mimeType: z.string().optional(),
  attachedToType: z.enum(['bill', 'feature_request', 'bug_report', 'maintenance_request']),
  attachedToId: z.string().uuid().min(1, 'Attached entity ID is required'),
  uploadedById: z.string().uuid().min(1, 'Uploaded by user ID is required'),
});

/**
 * Insert type for unified documents
 */
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

/**
 * Insert type for form-attached documents
 */
export type AttachDocument = z.infer<typeof attachDocumentSchema>;

/**
 * Select type for unified documents
 */
export type Document = typeof documents.$inferSelect;

// Document type constants for consistency
export const DOCUMENT_TYPES = {
  // Building/Residence documents
  BYLAW: 'bylaw',
  FINANCIAL: 'financial', 
  MAINTENANCE: 'maintenance',
  LEGAL: 'legal',
  MEETING_MINUTES: 'meeting_minutes',
  INSURANCE: 'insurance',
  CONTRACTS: 'contracts',
  PERMITS: 'permits',
  INSPECTION: 'inspection',
  LEASE: 'lease',
  CORRESPONDENCE: 'correspondence',
  UTILITIES: 'utilities',
  OTHER: 'other',
  
  // Form attachments
  ATTACHMENT: 'attachment',
  SCREENSHOT: 'screenshot', 
  EVIDENCE: 'evidence',
  SUPPORTING_DOCUMENT: 'supporting_document'
} as const;

// Entity types that can have attached documents
export const ATTACHABLE_ENTITY_TYPES = {
  BILL: 'bill',
  FEATURE_REQUEST: 'feature_request',
  BUG_REPORT: 'bug_report', 
  MAINTENANCE_REQUEST: 'maintenance_request'
} as const;
