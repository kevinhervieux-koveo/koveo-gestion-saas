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
 *
 * Cross-organisation invariant (Task #811 / #1472)
 * -------------------------------------------------
 * When BOTH `residence_id` and `building_id` are non-NULL, the
 * residence's `building_id` must equal the document's `building_id`,
 * otherwise the document leaks across organisations the moment a
 * reader filters by `building_id`. This is enforced at the database
 * layer by the BEFORE INSERT/UPDATE trigger
 * `documents_residence_building_check` (see migration
 * `migrations/0030_documents_residence_building_check.sql`). Drizzle
 * does not model that trigger, so `drizzle-kit push` will not drop
 * or alter it.
 *
 * `residence_id` FK (Task #1271)
 * ------------------------------
 * `documents.residence_id` has a real foreign key to `residences.id`
 * with `ON DELETE SET NULL`, applied out-of-band by migration
 * `migrations/0020_documents_residence_id_fk.sql`. Drizzle's
 * `.references()` call here is descriptive only — `drizzle-kit push`
 * is not the source of truth for that constraint. Orphan
 * `residence_id` values are NULLed by the same migration before the
 * FK is created so existing data stays valid.
 */
export const documents = pgTable('documents', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  description: text('description'),
  documentType: text('document_type').notNull(),
  filePath: text('file_path').notNull().unique(),
  fileName: text('file_name'), // Stored (normalized) filename
  // Original UTF-8 display name supplied by the uploader (Task #420). The
  // `fileName` column above holds the ASCII-safe slug used on disk so paths
  // and DB rows stay consistent, while this column preserves the original
  // (potentially accented) name for download headers and UI display.
  originalFileName: text('original_file_name'),
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
  originalFileName: z.string().optional(),
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
  originalFileName: z.string().optional(),
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
 * Link families: named groupings that give meaning to a document chain.
 * System families (isSystem=true, organizationId=null) are seeded by Koveo
 * and are read-only for non-admins. Custom families belong to an organization.
 */
export const documentLinkFamilies = pgTable('document_link_families', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar('organization_id').references(() => organizations.id, {
    onDelete: 'cascade',
  }),
  name: text('name').notNull(),
  description: text('description'),
  isSystem: boolean('is_system').notNull().default(false),
  source: text('source'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  organizationIdIdx: index('document_link_families_organization_id_idx').on(table.organizationId),
  isSystemIdx: index('document_link_families_is_system_idx').on(table.isSystem),
  orgNameUniq: uniqueIndex('document_link_families_org_name_uniq').on(table.organizationId, table.name),
  systemNameUniq: uniqueIndex('document_link_families_system_name_uniq').on(table.name).where(sql`organization_id IS NULL`),
}));

export const insertDocumentLinkFamilySchema = z.object({
  organizationId: z.string().optional().nullable(),
  name: z.string().min(1, 'Family name is required').max(150),
  description: z.string().optional().nullable(),
  isSystem: z.boolean().default(false),
  source: z.string().optional().nullable(),
});

export type InsertDocumentLinkFamily = z.infer<typeof insertDocumentLinkFamilySchema>;
export type DocumentLinkFamily = typeof documentLinkFamilies.$inferSelect;

/**
 * Position of a linked document relative to the source document in a sequence.
 *  - before: the linked target comes BEFORE the source document
 *  - after: the linked target comes AFTER the source document
 */
export const documentLinkPositionEnum = pgEnum('document_link_position', ['before', 'after']);

/**
 * Explicit links between documents to define a reading sequence within a family.
 * Each row says: from `fromDocumentId`, the document reached at `position` in
 * family `familyId` is `toDocumentId`. A document has at most one explicit `before`
 * and one `after` per family (enforced via uniqueness on (fromDocumentId, position, familyId)).
 */
export const documentLinks = pgTable('document_links', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  fromDocumentId: text('from_document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  toDocumentId: text('to_document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  familyId: text('family_id').notNull().references(() => documentLinkFamilies.id, { onDelete: 'cascade' }),
  position: documentLinkPositionEnum('position').notNull(),
  ordinal: integer('ordinal'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  fromDocumentIdIdx: index('document_links_from_document_id_idx').on(table.fromDocumentId),
  toDocumentIdIdx: index('document_links_to_document_id_idx').on(table.toDocumentId),
  familyIdIdx: index('document_links_family_id_idx').on(table.familyId),
  // Each document has at most one outgoing `before` and one outgoing `after` per family.
  fromPositionFamilyUniq: uniqueIndex('document_links_from_position_family_uniq').on(table.fromDocumentId, table.position, table.familyId),
  // Branching prevention per family: each document can be the target of at most one
  // incoming link per direction per family.
  toPositionFamilyUniq: uniqueIndex('document_links_to_position_family_uniq').on(table.toDocumentId, table.position, table.familyId),
  edgeFamilyUniq: uniqueIndex('document_links_edge_family_uniq').on(table.fromDocumentId, table.toDocumentId, table.position, table.familyId),
}));

export const insertDocumentLinkSchema = z.object({
  fromDocumentId: z.string().min(1, 'fromDocumentId is required'),
  toDocumentId: z.string().min(1, 'toDocumentId is required'),
  familyId: z.string().min(1, 'familyId is required'),
  position: z.enum(['before', 'after']),
  ordinal: z.number().int().optional().nullable(),
});

export type InsertDocumentLink = z.infer<typeof insertDocumentLinkSchema>;
export type DocumentLink = typeof documentLinks.$inferSelect;
