import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, boolean, varchar, uuid, integer, index, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { buildings, residences } from './property';
import { organizations } from './core';


// Unified documents table
/**
 * Unified documents table for all document types across the system.
 * Stores documents that can be associated with either residences, buildings, or neither.
 * Enhanced with file metadata, content type, and attachment relationships.
 */
export const documents = pgTable('documents', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  description: text('description'),
  documentType: text('document_type').notNull(),
  filePath: text('file_path').notNull().unique(),
  fileName: text('file_name'), // Original filename
  fileSize: integer('file_size'), // File size in bytes
  mimeType: text('mime_type'), // MIME type for proper handling
  isVisibleToTenants: boolean('is_visible_to_tenants').default(false).notNull(),
  isManagerOnly: boolean('is_manager_only').default(false).notNull(),
  isQuarantined: boolean('is_quarantined').default(false).notNull(),
  residenceId: varchar('residence_id').references(() => residences.id),
  buildingId: varchar('building_id').references(() => buildings.id),
  uploadedById: varchar('uploaded_by_id'),
  // Support for document attachments to forms
  attachedToType: text('attached_to_type'), // 'bill', 'feature_request', 'bug_report', etc.
  attachedToId: varchar('attached_to_id'), // ID of the entity this document is attached to
  effectiveDate: timestamp('effective_date'), // Date the document becomes effective
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  residenceIdIdx: index('documents_residence_id_idx').on(table.residenceId),
  buildingIdIdx: index('documents_building_id_idx').on(table.buildingId),
  uploadedByIdIdx: index('documents_uploaded_by_id_idx').on(table.uploadedById),
  attachedToIdIdx: index('documents_attached_to_id_idx').on(table.attachedToId),
  documentTypeIdx: index('documents_document_type_idx').on(table.documentType),
  // Date indexes for range queries
  effectiveDateIdx: index('documents_effective_date_idx').on(table.effectiveDate),
  createdAtIdx: index('documents_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('documents_updated_at_idx').on(table.updatedAt),
  // Composite indexes for common query patterns
  buildingDocTypeIdx: index('documents_building_doctype_idx').on(table.buildingId, table.documentType),
  residenceDocTypeIdx: index('documents_residence_doctype_idx').on(table.residenceId, table.documentType),
  uploaderCreatedIdx: index('documents_uploader_created_idx').on(table.uploadedById, table.createdAt),
  buildingCreatedIdx: index('documents_building_created_idx').on(table.buildingId, table.createdAt),
  residenceCreatedIdx: index('documents_residence_created_idx').on(table.residenceId, table.createdAt),
  attachedEntityIdx: index('documents_attached_entity_idx').on(table.attachedToType, table.attachedToId),
}));

// Enhanced document schema with file metadata
export const insertDocumentSchema = z.object({
  name: z.string().min(1, 'Document name is required'),
  description: z.string().optional(),
  documentType: z.string().min(1, 'Document type is required'),
  filePath: z.string().min(1, 'File path is required'),
  fileName: z.string().optional(),
  fileSize: z.number().int().optional(),
  mimeType: z.string().optional(),
  isVisibleToTenants: z.boolean().default(false),
  isManagerOnly: z.boolean().default(false),
  isQuarantined: z.boolean().default(false),
  residenceId: z.string().optional(),
  buildingId: z.string().optional(),
  uploadedById: z.string().optional(),
  attachedToType: z.string().optional(),
  attachedToId: z.string().optional(),
  effectiveDate: z.string().optional(),
});

// Schema for form-attached documents
export const attachDocumentSchema = z.object({
  name: z.string().min(1, 'Document name is required'),
  description: z.string().optional(),
  documentType: z.enum(['attachment', 'screenshot', 'evidence', 'supporting_document']).default('attachment'),
  fileName: z.string().min(1, 'File name is required'),
  fileSize: z.number().int().optional(),
  mimeType: z.string().optional(),
  attachedToType: z.enum(['bill', 'feature_request', 'bug_report', 'maintenance_request']),
  attachedToId: z.string().min(1, 'Attached entity ID is required'),
  uploadedById: z.string().optional(),
  effectiveDate: z.string().optional(),
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

// Enhanced types for modular document management components
export interface DocumentWithMetadata extends Document {
  uploadedBy?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  residence?: {
    id: string;
    unitNumber?: string;
    address?: string;
  };
  building?: {
    id: string;
    name?: string;
    address?: string;
  };
}

// User permissions for document access control
export interface DocumentPermissions {
  canView: boolean;
  canDownload: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canCreate: boolean;
}

// Document display preferences
export interface DocumentDisplayOptions {
  showMetadata?: boolean;
  compact?: boolean;
  showFileSize?: boolean;
  showUploadDate?: boolean;
  showUploader?: boolean;
  showEntityInfo?: boolean;
}

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

/**
 * Document tag scope: where the tag is most relevant.
 *  - building: applies to building-level documents
 *  - residence: applies to residence-level documents
 *  - any: applies anywhere
 */
export const documentTagScopeEnum = pgEnum('document_tag_scope', ['building', 'residence', 'any']);

/**
 * Document tag importance.
 */
export const documentTagImportanceEnum = pgEnum('document_tag_importance', [
  'obligatoire',
  'nice_to_have',
  'extra',
]);

/**
 * Document tags table. Tags classify documents by real-world role
 * (e.g. "Procès-verbaux"). System ("Koveo") tags have organizationId = null
 * and isSystem = true; custom tags belong to a specific organization.
 */
export const documentTags = pgTable('document_tags', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar('organization_id').references(() => organizations.id, {
    onDelete: 'cascade',
  }),
  name: text('name').notNull(),
  description: text('description'),
  scope: documentTagScopeEnum('scope').notNull().default('any'),
  importance: documentTagImportanceEnum('importance').notNull().default('nice_to_have'),
  suggestedProfessionals: text('suggested_professionals').array().notNull().default(sql`ARRAY[]::text[]`),
  isSystem: boolean('is_system').notNull().default(false),
  source: text('source'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  organizationIdIdx: index('document_tags_organization_id_idx').on(table.organizationId),
  scopeIdx: index('document_tags_scope_idx').on(table.scope),
  isSystemIdx: index('document_tags_is_system_idx').on(table.isSystem),
}));

/**
 * Join table assigning tags to documents.
 */
export const documentTagAssignments = pgTable('document_tag_assignments', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => documentTags.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  documentIdIdx: index('document_tag_assignments_document_id_idx').on(table.documentId),
  tagIdIdx: index('document_tag_assignments_tag_id_idx').on(table.tagId),
  documentTagUniq: uniqueIndex('document_tag_assignments_document_tag_uniq').on(table.documentId, table.tagId),
}));

export const insertDocumentTagSchema = z.object({
  organizationId: z.string().optional().nullable(),
  name: z.string().min(1, 'Tag name is required').max(150),
  description: z.string().optional().nullable(),
  scope: z.enum(['building', 'residence', 'any']).default('any'),
  importance: z.enum(['obligatoire', 'nice_to_have', 'extra']).default('nice_to_have'),
  suggestedProfessionals: z.array(z.string()).default([]),
  isSystem: z.boolean().default(false),
  source: z.string().optional().nullable(),
});

export const insertDocumentTagAssignmentSchema = z.object({
  documentId: z.string().min(1),
  tagId: z.string().min(1),
});

export type InsertDocumentTag = z.infer<typeof insertDocumentTagSchema>;
export type DocumentTag = typeof documentTags.$inferSelect;
export type InsertDocumentTagAssignment = z.infer<typeof insertDocumentTagAssignmentSchema>;
export type DocumentTagAssignment = typeof documentTagAssignments.$inferSelect;

/**
 * Position of a linked document relative to the source document in a sequence.
 *  - before: the linked target comes BEFORE the source document
 *  - after: the linked target comes AFTER the source document
 */
export const documentLinkPositionEnum = pgEnum('document_link_position', ['before', 'after']);

/**
 * Explicit links between documents to define a reading sequence.
 * Each row says: from `fromDocumentId`, the document reached at `position`
 * is `toDocumentId`. A document has at most one explicit `before` and one
 * explicit `after` link (enforced via uniqueness on (fromDocumentId, position)).
 * When no explicit link exists, the resolver falls back to date-based ordering.
 */
export const documentLinks = pgTable('document_links', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  fromDocumentId: text('from_document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  toDocumentId: text('to_document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  position: documentLinkPositionEnum('position').notNull(),
  ordinal: integer('ordinal'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  fromDocumentIdIdx: index('document_links_from_document_id_idx').on(table.fromDocumentId),
  toDocumentIdIdx: index('document_links_to_document_id_idx').on(table.toDocumentId),
  // Each document has at most one outgoing `before` and one outgoing `after`.
  fromPositionUniq: uniqueIndex('document_links_from_position_uniq').on(table.fromDocumentId, table.position),
  // Branching prevention: each document can be the target of at most one
  // incoming link per direction. Combined with `fromPositionUniq` this means
  // any document has at most one previous and at most one next.
  toPositionUniq: uniqueIndex('document_links_to_position_uniq').on(table.toDocumentId, table.position),
  edgeUniq: uniqueIndex('document_links_edge_uniq').on(table.fromDocumentId, table.toDocumentId, table.position),
}));

export const insertDocumentLinkSchema = z.object({
  fromDocumentId: z.string().min(1, 'fromDocumentId is required'),
  toDocumentId: z.string().min(1, 'toDocumentId is required'),
  position: z.enum(['before', 'after']),
  ordinal: z.number().int().optional().nullable(),
});

export type InsertDocumentLink = z.infer<typeof insertDocumentLinkSchema>;
export type DocumentLink = typeof documentLinks.$inferSelect;
