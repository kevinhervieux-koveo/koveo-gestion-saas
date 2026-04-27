import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  uuid,
  index,
} from 'drizzle-orm/pg-core';
import { z } from 'zod';

/**
 * Generic event log for product/AI KPIs.
 *
 * The table is intentionally schemaless beyond the four columns that the
 * aggregation queries always need (`metricKey`, `outcome`, `createdAt`,
 * and the optional `organizationId` / `userId` for scoping). Anything
 * else specific to a particular KPI lives inside `dimensions` (group-by
 * fields) or `payload` (raw debugging data) so we can introduce new
 * metrics without a migration each time.
 *
 * Currently captured metrics
 * --------------------------
 * - `bulk_import.filename_suggestion` — emitted by the bulk-document-import
 *   sorting step when an admin commits (accept / manual) a sorting
 *   decision. `outcome` is one of:
 *     * `verbatim`               — admin kept the AI suggestion exactly.
 *     * `edited`                 — AI suggested X, admin saved Y (Y ≠ X).
 *     * `cleared`                — AI suggested something, admin cleared
 *                                  the field so we fall back to the
 *                                  original filename.
 *     * `manual_no_suggestion`   — AI returned no suggestion, admin
 *                                  typed one anyway.
 *     * `empty_no_suggestion`    — AI returned no suggestion and admin
 *                                  left the field empty.
 *   Dimensions populated for this metric:
 *     * `branch`        — destination branch (`building_documents`, …).
 *     * `subCategory`   — analyzer-classified sub-category.
 *     * `mimeType`      — source file MIME type.
 *     * `language`      — admin UI language at the time of the decision.
 *     * `part`          — `0` or `1` for split decisions (one event per
 *                          part), absent otherwise.
 *   The accept-rate per language and per branch type is derived from
 *   `count(outcome='verbatim') / count(outcome IN ('verbatim','edited','cleared'))`
 *   grouped by `dimensions->>'language'` and `dimensions->>'branch'`.
 *
 * Add new metrics by picking a fresh `metricKey` namespace (e.g.
 * `screening.is_complete_accept_rate`) and documenting the expected
 * `outcome` values + dimensions in this comment block.
 */
export const kpiEvents = pgTable(
  'kpi_events',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    /**
     * Stable identifier for the metric. Convention: `<feature>.<metric>`
     * (e.g. `bulk_import.filename_suggestion`). Used as the primary
     * group-by key in aggregation queries.
     */
    metricKey: text('metric_key').notNull(),
    /**
     * Discrete outcome of the event. Each `metricKey` defines its own
     * vocabulary — see the table comment block above.
     */
    outcome: text('outcome').notNull(),
    /**
     * Optional org / user scoping. Stored as plain `varchar` (not FK)
     * so historical telemetry survives org or user deletion.
     */
    organizationId: varchar('organization_id'),
    userId: varchar('user_id'),
    /**
     * Group-by dimensions for slicing the metric. Keep the value space
     * small (enums, language codes, MIME types) so JSONB->>'key'
     * aggregations stay cheap.
     */
    dimensions: jsonb('dimensions').$type<Record<string, unknown>>(),
    /**
     * Free-form debugging payload. Not used by aggregation queries —
     * keep it small (truncate long strings) and never put PII here.
     */
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    metricKeyIdx: index('kpi_events_metric_key_idx').on(table.metricKey),
    metricCreatedIdx: index('kpi_events_metric_created_idx').on(
      table.metricKey,
      table.createdAt,
    ),
    orgIdx: index('kpi_events_org_idx').on(table.organizationId),
  }),
);

export const insertKpiEventSchema = z.object({
  metricKey: z.string().min(1).max(120),
  outcome: z.string().min(1).max(80),
  organizationId: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
  dimensions: z.record(z.unknown()).optional().nullable(),
  payload: z.record(z.unknown()).optional().nullable(),
});

export type KpiEvent = typeof kpiEvents.$inferSelect;
export type InsertKpiEvent = z.infer<typeof insertKpiEventSchema>;

/**
 * Shared outcome vocabulary used by every bulk-import KPI that
 * compares one AI suggestion to one admin-final value (filename,
 * residence, effective date, branch destination, tag set).
 *
 * - `verbatim`               — admin kept the AI suggestion exactly.
 * - `edited`                 — AI suggested X, admin saved Y (Y ≠ X).
 * - `cleared`                — AI suggested something, admin cleared
 *                              the field so we have no committed value.
 * - `manual_no_suggestion`   — AI returned no suggestion, admin
 *                              picked one anyway.
 * - `empty_no_suggestion`    — AI returned no suggestion and admin
 *                              left the field empty.
 *
 * Pulled out into a shared union so the dashboard can render every
 * metric with the same five-tile summary and the aggregator never
 * needs a per-metric cast.
 */
export const BULK_IMPORT_AI_ACCEPT_OUTCOMES = [
  'verbatim',
  'edited',
  'cleared',
  'manual_no_suggestion',
  'empty_no_suggestion',
] as const;

export type BulkImportAiAcceptOutcome =
  (typeof BULK_IMPORT_AI_ACCEPT_OUTCOMES)[number];

/**
 * Filename-suggestion metric (Task #1406). Emitted by the
 * `set-sorting-decision` route when the admin commits a sorting
 * decision. See {@link BULK_IMPORT_AI_ACCEPT_OUTCOMES} for the
 * outcome vocabulary.
 */
export const BULK_IMPORT_FILENAME_METRIC_KEY =
  'bulk_import.filename_suggestion';

export const BULK_IMPORT_FILENAME_OUTCOMES = BULK_IMPORT_AI_ACCEPT_OUTCOMES;
export type BulkImportFilenameOutcome = BulkImportAiAcceptOutcome;

/**
 * Branch-destination metric (Task #1411). Emitted by the per-item
 * commit route when an item is finalised. Compares the admin-saved
 * `branchDecision.branch` against the AI's original branching pick
 * (snapshotted as `branchAiSuggested` at branching-step time).
 *
 * Dimensions populated:
 *   * `aiBranch`   — what the AI picked (`building_documents`, …).
 *   * `branch`     — what the admin committed.
 *   * `language`   — admin UI language at commit time (per-language
 *                    breakdown in the dashboard).
 */
export const BULK_IMPORT_BRANCH_METRIC_KEY =
  'bulk_import.branch_destination';

/**
 * Residence-pick metric (Task #1411). Emitted by the per-item commit
 * route for items routed to `residence_documents`. Compares the
 * admin-saved `branchDecision.residenceId` against the AI's original
 * residence pick (`residenceAiSuggestedId`).
 *
 * Dimensions populated:
 *   * `branch`     — always `residence_documents` (kept for shape parity).
 *   * `language`   — admin UI language at commit time.
 */
export const BULK_IMPORT_RESIDENCE_METRIC_KEY =
  'bulk_import.residence_pick';

/**
 * Effective-date metric (Task #1411). Emitted by the per-item commit
 * route. Compares the admin-saved `identification.effectiveDate`
 * against the AI's original date pick (`effectiveDateAiSuggested`,
 * snapshotted at identification-step time).
 *
 * Dimensions populated:
 *   * `branch`     — destination branch of the committed item.
 *   * `language`   — admin UI language at commit time.
 */
export const BULK_IMPORT_EFFECTIVE_DATE_METRIC_KEY =
  'bulk_import.effective_date';

/**
 * Tag-suggestion metric (Task #1411). Emitted by the per-item commit
 * route. Compares the admin-saved tag UUID set
 * (`identification.tags`) against the AI's original tag pick
 * (`identification.aiSuggestedTagIds`).
 *
 * Set comparison:
 *   * `verbatim`              — both sets non-empty AND identical.
 *   * `edited`                — both sets non-empty AND not identical.
 *   * `cleared`               — AI suggested ≥1 tag, admin saved 0.
 *   * `manual_no_suggestion`  — AI suggested 0, admin saved ≥1.
 *   * `empty_no_suggestion`   — both empty.
 *
 * Dimensions populated:
 *   * `branch`     — destination branch of the committed item.
 *   * `language`   — admin UI language at commit time.
 */
export const BULK_IMPORT_TAG_METRIC_KEY = 'bulk_import.tag_suggestion';

/**
 * All bulk-import KPI metric keys that share the
 * {@link BULK_IMPORT_AI_ACCEPT_OUTCOMES} vocabulary. Used by the
 * generic aggregator + dashboard renderer so adding a new metric only
 * requires picking a fresh key, declaring it here, and instrumenting
 * the right code path.
 */
export const BULK_IMPORT_AI_METRIC_KEYS = [
  BULK_IMPORT_FILENAME_METRIC_KEY,
  BULK_IMPORT_BRANCH_METRIC_KEY,
  BULK_IMPORT_RESIDENCE_METRIC_KEY,
  BULK_IMPORT_EFFECTIVE_DATE_METRIC_KEY,
  BULK_IMPORT_TAG_METRIC_KEY,
] as const;

export type BulkImportAiMetricKey =
  (typeof BULK_IMPORT_AI_METRIC_KEYS)[number];
