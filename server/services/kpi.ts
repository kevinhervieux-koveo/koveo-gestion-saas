import { and, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '@shared/schema';
import { logWarn } from '../utils/logger';

/**
 * Persist one KPI event. Failures are swallowed (with a warning log) so
 * a telemetry insert can never break the user-facing operation that
 * triggered it.
 */
export async function recordKpiEvent(input: {
  metricKey: string;
  outcome: string;
  organizationId?: string | null;
  userId?: string | null;
  dimensions?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await db.insert(schema.kpiEvents).values({
      metricKey: input.metricKey,
      outcome: input.outcome,
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      dimensions: input.dimensions ?? null,
      payload: input.payload ?? null,
    });
  } catch (err) {
    logWarn('[kpi] failed to record event', {
      metadata: {
        metricKey: input.metricKey,
        outcome: input.outcome,
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

/**
 * Classify any one-AI-suggestion-vs-one-admin-final-string decision
 * against the shared {@link schema.BulkImportAiAcceptOutcome}
 * vocabulary. Used by the bulk-import filename, residence,
 * effective-date, and branch-destination metrics so they all agree
 * on the exact same five-outcome shape.
 *
 * Inputs are normalised to "trimmed string or null" before comparison
 * so a leading/trailing space never surfaces as an `edited` event,
 * and empty strings are treated as "no value".
 *
 * - `verbatim`               — final exactly matches AI suggestion.
 * - `edited`                 — AI suggested something, admin saved a
 *                              different non-empty value.
 * - `cleared`                — AI suggested something, admin cleared
 *                              the field.
 * - `manual_no_suggestion`   — AI returned no suggestion, admin saved
 *                              a non-empty value.
 * - `empty_no_suggestion`    — AI returned no suggestion and admin
 *                              left the field empty.
 */
export function classifyAiAcceptOutcome(
  aiSuggestion: string | null | undefined,
  adminFinal: string | null | undefined,
): schema.BulkImportAiAcceptOutcome {
  const ai = (aiSuggestion ?? '').trim();
  const admin = (adminFinal ?? '').trim();
  if (ai) {
    if (!admin) return 'cleared';
    return admin === ai ? 'verbatim' : 'edited';
  }
  return admin ? 'manual_no_suggestion' : 'empty_no_suggestion';
}

/**
 * Backwards-compatible alias kept so existing call sites
 * (`set-sorting-decision`) and tests keep working without churn.
 * New call sites should prefer the more general
 * {@link classifyAiAcceptOutcome}.
 */
export const classifyFilenameSuggestionOutcome = classifyAiAcceptOutcome;

/**
 * Classify a tag-suggestion outcome by comparing the admin-saved tag
 * UUID set against the AI-suggested tag UUID set. Order does not
 * matter (the picker rendering is unordered) so we compare as sets.
 *
 * - `verbatim`              — both sets non-empty and identical.
 * - `edited`                — both sets non-empty but not identical.
 * - `cleared`               — AI suggested ≥1 tag, admin saved 0.
 * - `manual_no_suggestion`  — AI suggested 0 tags, admin saved ≥1.
 * - `empty_no_suggestion`   — both empty.
 */
export function classifyTagSuggestionOutcome(
  aiSuggestion: readonly string[] | null | undefined,
  adminFinal: readonly string[] | null | undefined,
): schema.BulkImportAiAcceptOutcome {
  const aiSet = new Set((aiSuggestion ?? []).filter((s) => typeof s === 'string' && s.length > 0));
  const adminSet = new Set((adminFinal ?? []).filter((s) => typeof s === 'string' && s.length > 0));
  if (aiSet.size > 0) {
    if (adminSet.size === 0) return 'cleared';
    if (aiSet.size !== adminSet.size) return 'edited';
    for (const id of aiSet) {
      if (!adminSet.has(id)) return 'edited';
    }
    return 'verbatim';
  }
  return adminSet.size > 0 ? 'manual_no_suggestion' : 'empty_no_suggestion';
}

/**
 * One row of the KPI dashboard's per-(language, branch) breakdown.
 * Re-used by every bulk-import metric that follows the
 * {@link schema.BulkImportAiAcceptOutcome} vocabulary.
 */
export interface AiAcceptAggregateRow {
  language: string | null;
  branch: string | null;
  totals: Record<schema.BulkImportAiAcceptOutcome, number>;
  total: number;
  /**
   * `verbatim / (verbatim + edited + cleared)` — the share of AI
   * suggestions the admin accepted as-is. `null` when there is no
   * AI-suggestion sample (denominator = 0).
   */
  acceptRate: number | null;
  /** Same numerator/denominator as `acceptRate` so callers can show n. */
  acceptRateSampleSize: number;
}

function emptyTotals(): Record<schema.BulkImportAiAcceptOutcome, number> {
  return {
    verbatim: 0,
    edited: 0,
    cleared: 0,
    manual_no_suggestion: 0,
    empty_no_suggestion: 0,
  };
}

/**
 * Options for {@link aggregateBulkImportAiMetric} and every per-metric
 * wrapper below.
 *
 * - `sinceDays` is a convenience for "last N days" windows; ignored when
 *   either `from` or `to` is provided so callers can express explicit
 *   ranges without it silently re-applying.
 * - `from` / `to` are inclusive bounds on `kpi_events.created_at`.
 * - `organizationId` filters to a single tenant; omit (or pass null) to
 *   aggregate across all organizations.
 */
export interface AggregateBulkImportAiMetricOptions {
  sinceDays?: number;
  from?: Date | null;
  to?: Date | null;
  organizationId?: string | null;
}

/**
 * Generic aggregator for any bulk-import metric that uses the shared
 * {@link schema.BulkImportAiAcceptOutcome} vocabulary. Returns one row
 * per `(language, branch)` pair within the rolling `sinceDays` window
 * (defaults to 90 days) — or within the explicit `from`/`to` bounds
 * when either is provided.
 *
 * Each metric has a thin convenience wrapper below
 * (`aggregateBulkImportFilenameSuggestions`, …) so the routes layer
 * never has to repeat the metric-key constant.
 */
export async function aggregateBulkImportAiMetric(
  metricKey: schema.BulkImportAiMetricKey,
  options: AggregateBulkImportAiMetricOptions = {},
): Promise<AiAcceptAggregateRow[]> {
  const { from, to, organizationId } = options;
  const hasExplicitRange = from != null || to != null;

  const conditions: SQL[] = [eq(schema.kpiEvents.metricKey, metricKey)];

  if (hasExplicitRange) {
    if (from) conditions.push(gte(schema.kpiEvents.createdAt, from));
    if (to) conditions.push(lte(schema.kpiEvents.createdAt, to));
  } else {
    const sinceDays = options.sinceDays ?? 90;
    const cutoff = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    conditions.push(gte(schema.kpiEvents.createdAt, cutoff));
  }

  if (organizationId) {
    conditions.push(eq(schema.kpiEvents.organizationId, organizationId));
  }

  const rows = await db
    .select({
      language: sql<string | null>`${schema.kpiEvents.dimensions}->>'language'`,
      branch: sql<string | null>`${schema.kpiEvents.dimensions}->>'branch'`,
      outcome: schema.kpiEvents.outcome,
      n: sql<number>`count(*)::int`,
    })
    .from(schema.kpiEvents)
    .where(and(...conditions))
    .groupBy(
      sql`${schema.kpiEvents.dimensions}->>'language'`,
      sql`${schema.kpiEvents.dimensions}->>'branch'`,
      schema.kpiEvents.outcome,
    );

  const grouped = new Map<string, AiAcceptAggregateRow>();
  for (const r of rows) {
    const key = `${r.language ?? ''}|${r.branch ?? ''}`;
    let row = grouped.get(key);
    if (!row) {
      row = {
        language: r.language ?? null,
        branch: r.branch ?? null,
        totals: emptyTotals(),
        total: 0,
        acceptRate: null,
        acceptRateSampleSize: 0,
      };
      grouped.set(key, row);
    }
    const outcome = r.outcome as schema.BulkImportAiAcceptOutcome;
    if (outcome in row.totals) {
      row.totals[outcome] += r.n;
    }
    row.total += r.n;
  }

  for (const row of grouped.values()) {
    const sample =
      row.totals.verbatim + row.totals.edited + row.totals.cleared;
    row.acceptRateSampleSize = sample;
    row.acceptRate = sample > 0 ? row.totals.verbatim / sample : null;
  }

  return Array.from(grouped.values()).sort((a, b) => {
    if ((b.total ?? 0) !== (a.total ?? 0)) return b.total - a.total;
    return (a.branch ?? '').localeCompare(b.branch ?? '');
  });
}

/**
 * Backwards-compatible alias for the filename-suggestion aggregator
 * shape (Task #1406). Same row layout as
 * {@link AiAcceptAggregateRow} so existing callers keep working.
 */
export type FilenameSuggestionAggregateRow = AiAcceptAggregateRow;

export function aggregateBulkImportFilenameSuggestions(
  options: AggregateBulkImportAiMetricOptions = {},
): Promise<AiAcceptAggregateRow[]> {
  return aggregateBulkImportAiMetric(
    schema.BULK_IMPORT_FILENAME_METRIC_KEY,
    options,
  );
}

export function aggregateBulkImportBranchDestinations(
  options: AggregateBulkImportAiMetricOptions = {},
): Promise<AiAcceptAggregateRow[]> {
  return aggregateBulkImportAiMetric(
    schema.BULK_IMPORT_BRANCH_METRIC_KEY,
    options,
  );
}

export function aggregateBulkImportResidencePicks(
  options: AggregateBulkImportAiMetricOptions = {},
): Promise<AiAcceptAggregateRow[]> {
  return aggregateBulkImportAiMetric(
    schema.BULK_IMPORT_RESIDENCE_METRIC_KEY,
    options,
  );
}

export function aggregateBulkImportEffectiveDates(
  options: AggregateBulkImportAiMetricOptions = {},
): Promise<AiAcceptAggregateRow[]> {
  return aggregateBulkImportAiMetric(
    schema.BULK_IMPORT_EFFECTIVE_DATE_METRIC_KEY,
    options,
  );
}

export function aggregateBulkImportTagSuggestions(
  options: AggregateBulkImportAiMetricOptions = {},
): Promise<AiAcceptAggregateRow[]> {
  return aggregateBulkImportAiMetric(
    schema.BULK_IMPORT_TAG_METRIC_KEY,
    options,
  );
}
