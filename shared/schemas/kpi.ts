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
 * Outcome vocabulary for the bulk-import filename-suggestion metric.
 * Re-exported so the recorder, aggregator, and dashboard agree on the
 * exact string set.
 */
export const BULK_IMPORT_FILENAME_METRIC_KEY =
  'bulk_import.filename_suggestion';

export const BULK_IMPORT_FILENAME_OUTCOMES = [
  'verbatim',
  'edited',
  'cleared',
  'manual_no_suggestion',
  'empty_no_suggestion',
] as const;

export type BulkImportFilenameOutcome =
  (typeof BULK_IMPORT_FILENAME_OUTCOMES)[number];
