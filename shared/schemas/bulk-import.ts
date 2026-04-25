import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  integer,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { buildings, residences } from './property';
import { organizations, users } from './core';
import { documents } from './documents';

/**
 * Lifecycle of a bulk-import session as the admin walks through the five
 * AI-assisted steps. `complete` and `cleared` are terminal — `cleared`
 * means the admin wiped the session and its staged files, `complete`
 * means every selected item has been committed to the real document
 * tables. `paused` is set automatically on every page leave so we can
 * tell the difference between "actively in progress" and "user closed
 * the tab".
 */
export const bulkImportStepEnum = pgEnum('bulk_import_step', [
  'upload',
  'screening',
  'sorting',
  'branching',
  'identification',
  'linking',
  'complete',
]);

export const bulkImportStatusEnum = pgEnum('bulk_import_status', [
  'active',
  'paused',
  'completed',
  'cleared',
]);

export const bulkImportItemStatusEnum = pgEnum('bulk_import_item_status', [
  'pending',
  'screening',
  'screened',
  'sorted',
  'branched',
  'identified',
  'linked',
  'committed',
  'rejected',
  'duplicate',
]);

/**
 * One bulk-import session = one admin onboarding a building's worth of
 * historical paperwork. Progress is persisted as JSON so the UI can
 * resume the stepper exactly where the admin left off.
 */
export const bulkImportSessions = pgTable(
  'bulk_import_sessions',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    buildingId: varchar('building_id')
      .notNull()
      .references(() => buildings.id, { onDelete: 'cascade' }),
    organizationId: varchar('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    adminUserId: varchar('admin_user_id')
      .notNull()
      .references(() => users.id),
    currentStep: bulkImportStepEnum('current_step').notNull().default('upload'),
    status: bulkImportStatusEnum('status').notNull().default('active'),
    progress: jsonb('progress').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    buildingIdx: index('bulk_import_sessions_building_idx').on(table.buildingId),
    adminIdx: index('bulk_import_sessions_admin_idx').on(table.adminUserId),
    statusIdx: index('bulk_import_sessions_status_idx').on(table.status),
  }),
);

/**
 * One staged source file inside a session. Every per-step decision
 * (screening JSON, sorting decision, branch decision, identification,
 * link decisions) and the AI's confidence score are kept here so the
 * admin can leave/resume without losing any work. Once committed,
 * `finalDocumentId` points at the real `documents` row.
 */
export const bulkImportItems = pgTable(
  'bulk_import_items',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    sessionId: text('session_id')
      .notNull()
      .references(() => bulkImportSessions.id, { onDelete: 'cascade' }),
    originalPath: text('original_path').notNull(),
    originalName: text('original_name').notNull(),
    stagedPath: text('staged_path').notNull(),
    finalFileName: text('final_file_name'),
    contentHash: text('content_hash').notNull(),
    mimeType: text('mime_type'),
    fileSize: integer('file_size'),
    status: bulkImportItemStatusEnum('status').notNull().default('pending'),
    /**
     * Set when the admin manually excludes an item from the bulk-import
     * pipeline via `PATCH /api/admin/bulk-import/items/:id/exclude`
     * (Task #717). Holds the status the item was in just before
     * exclusion so a subsequent un-exclude can restore the row to
     * exactly where it was — for example, an item screened by the AI
     * then excluded will come back as `screened`, not `pending`. Stays
     * NULL whenever the item is not currently excluded, so the column
     * doubles as the "is currently excluded" flag (rejected + non-null
     * = manually excluded). Round-trip is covered by the integration
     * tests in Task #720.
     */
    preExcludeStatus: bulkImportItemStatusEnum('pre_exclude_status'),
    screening: jsonb('screening').$type<Record<string, unknown>>(),
    sortingDecision: jsonb('sorting_decision').$type<Record<string, unknown>>(),
    branchDecision: jsonb('branch_decision').$type<Record<string, unknown>>(),
    identification: jsonb('identification').$type<Record<string, unknown>>(),
    linkDecisions: jsonb('link_decisions').$type<Record<string, unknown>>(),
    finalDocumentId: text('final_document_id').references(() => documents.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    sessionIdx: index('bulk_import_items_session_idx').on(table.sessionId),
    statusIdx: index('bulk_import_items_status_idx').on(table.status),
    contentHashIdx: index('bulk_import_items_content_hash_idx').on(table.contentHash),
  }),
);

/**
 * Per-organization fingerprint cache. Used so the screening step can
 * skip files that have already been ingested through any previous
 * bulk-import session for the same client (org). The unique
 * `(organizationId, contentHash)` index lets us upsert safely.
 */
export const clientDocumentFingerprints = pgTable(
  'client_document_fingerprints',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: varchar('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    buildingId: varchar('building_id').references(() => buildings.id, {
      onDelete: 'set null',
    }),
    contentHash: text('content_hash').notNull(),
    finalDocumentId: text('final_document_id').references(() => documents.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    orgHashUniq: uniqueIndex('client_document_fingerprints_org_hash_uniq').on(
      table.organizationId,
      table.contentHash,
    ),
    buildingIdx: index('client_document_fingerprints_building_idx').on(table.buildingId),
  }),
);

export const insertBulkImportSessionSchema = z.object({
  buildingId: z.string().min(1),
  organizationId: z.string().min(1),
  adminUserId: z.string().min(1),
  currentStep: z
    .enum(['upload', 'screening', 'sorting', 'branching', 'identification', 'linking', 'complete'])
    .optional(),
  status: z.enum(['active', 'paused', 'completed', 'cleared']).optional(),
  progress: z.record(z.unknown()).optional(),
});

export const insertBulkImportItemSchema = z.object({
  sessionId: z.string().min(1),
  originalPath: z.string().min(1),
  originalName: z.string().min(1),
  stagedPath: z.string().min(1),
  finalFileName: z.string().optional().nullable(),
  contentHash: z.string().min(1),
  mimeType: z.string().optional().nullable(),
  fileSize: z.number().int().optional().nullable(),
  status: z
    .enum([
      'pending',
      'screening',
      'screened',
      'sorted',
      'branched',
      'identified',
      'linked',
      'committed',
      'rejected',
      'duplicate',
    ])
    .optional(),
  preExcludeStatus: z
    .enum([
      'pending',
      'screening',
      'screened',
      'sorted',
      'branched',
      'identified',
      'linked',
      'committed',
      'rejected',
      'duplicate',
    ])
    .optional()
    .nullable(),
  screening: z.record(z.unknown()).optional().nullable(),
  sortingDecision: z.record(z.unknown()).optional().nullable(),
  branchDecision: z.record(z.unknown()).optional().nullable(),
  identification: z.record(z.unknown()).optional().nullable(),
  linkDecisions: z.record(z.unknown()).optional().nullable(),
  finalDocumentId: z.string().optional().nullable(),
});

export const insertClientDocumentFingerprintSchema = z.object({
  organizationId: z.string().min(1),
  buildingId: z.string().optional().nullable(),
  contentHash: z.string().min(1),
  finalDocumentId: z.string().optional().nullable(),
});

export type BulkImportSession = typeof bulkImportSessions.$inferSelect;
export type InsertBulkImportSession = z.infer<typeof insertBulkImportSessionSchema>;
export type BulkImportItem = typeof bulkImportItems.$inferSelect;
export type InsertBulkImportItem = z.infer<typeof insertBulkImportItemSchema>;
export type ClientDocumentFingerprint = typeof clientDocumentFingerprints.$inferSelect;
export type InsertClientDocumentFingerprint = z.infer<
  typeof insertClientDocumentFingerprintSchema
>;

export type BulkImportStep =
  | 'upload'
  | 'screening'
  | 'sorting'
  | 'branching'
  | 'identification'
  | 'linking'
  | 'complete';

export type BulkImportStatus = 'active' | 'paused' | 'completed' | 'cleared';

export type BulkImportItemStatus =
  | 'pending'
  | 'screening'
  | 'screened'
  | 'sorted'
  | 'branched'
  | 'identified'
  | 'linked'
  | 'committed'
  | 'rejected'
  | 'duplicate';

/**
 * Confidence band used to decorate AI suggestions on the UI. Numeric
 * confidence is stored separately on each step's JSON payload — the band
 * is purely a presentational helper.
 */
export type ConfidenceBand = 'low' | 'medium' | 'high';

/**
 * Why the analyzer could not produce a real AI-driven result and had to
 * fall back to a filename-only stub. Surfaced per-item so the UI can
 * explain *why* a result came back with low confidence instead of
 * showing a generic low-confidence badge.
 *
 * - `oversize`           — the file is larger than the analyzer's cap.
 * - `unsupported_mime`   — the MIME type isn't one we know how to send.
 * - `extraction_failed`  — mammoth/xlsx extraction threw an error.
 * - `missing_file`       — the staged path could not be read.
 * - `no_api_key`         — Anthropic is not configured, so the analyzer
 *   never ran and every result is a deterministic stub. Distinct from
 *   the per-file reasons above because the cause is environmental, not
 *   per-document, and admins should fix the deployment, not the file.
 */
export type BulkImportFallbackReason =
  | 'oversize'
  | 'unsupported_mime'
  | 'extraction_failed'
  | 'missing_file'
  | 'no_api_key';

export function bandForConfidence(confidence: number | null | undefined): ConfidenceBand {
  if (confidence == null || Number.isNaN(confidence)) return 'low';
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}
