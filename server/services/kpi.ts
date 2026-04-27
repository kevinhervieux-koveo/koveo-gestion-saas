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
 * Classify the admin's final filename against the AI-suggested one
 * for the bulk-import filename suggestion metric.
 *
 * - `verbatim`               — final exactly matches AI suggestion.
 * - `edited`                 — AI suggested something, admin saved a
 *                              different non-empty value.
 * - `cleared`                — AI suggested something, admin cleared
 *                              the rename input.
 * - `manual_no_suggestion`   — AI returned no suggestion, admin typed
 *                              a non-empty rename.
 * - `empty_no_suggestion`    — AI returned no suggestion and admin
 *                              left the rename empty.
 */
export function classifyFilenameSuggestionOutcome(
  aiSuggestion: string | null | undefined,
  adminFinal: string | null | undefined,
): schema.BulkImportFilenameOutcome {
  const ai = (aiSuggestion ?? '').trim();
  const admin = (adminFinal ?? '').trim();
  if (ai) {
    if (!admin) return 'cleared';
    return admin === ai ? 'verbatim' : 'edited';
  }
  return admin ? 'manual_no_suggestion' : 'empty_no_suggestion';
}

export interface FilenameSuggestionAggregateRow {
  language: string | null;
  branch: string | null;
  totals: Record<schema.BulkImportFilenameOutcome, number>;
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

/**
 * Options for {@link aggregateBulkImportFilenameSuggestions}.
 *
 * - `sinceDays` is a convenience for "last N days" windows; ignored when
 *   either `from` or `to` is provided so callers can express explicit
 *   ranges without it silently re-applying.
 * - `from` / `to` are inclusive bounds on `kpi_events.created_at`.
 * - `organizationId` filters to a single tenant; omit (or pass null) to
 *   aggregate across all organizations.
 */
export interface AggregateBulkImportFilenameSuggestionsOptions {
  sinceDays?: number;
  from?: Date | null;
  to?: Date | null;
  organizationId?: string | null;
}

/**
 * Aggregate the bulk-import filename-suggestion metric. Returns one row
 * per `(language, branch)` pair.
 */
export async function aggregateBulkImportFilenameSuggestions(
  options: AggregateBulkImportFilenameSuggestionsOptions = {},
): Promise<FilenameSuggestionAggregateRow[]> {
  const { from, to, organizationId } = options;
  const hasExplicitRange = from != null || to != null;

  const conditions: SQL[] = [
    eq(schema.kpiEvents.metricKey, schema.BULK_IMPORT_FILENAME_METRIC_KEY),
  ];

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

  const grouped = new Map<string, FilenameSuggestionAggregateRow>();
  for (const r of rows) {
    const key = `${r.language ?? ''}|${r.branch ?? ''}`;
    let row = grouped.get(key);
    if (!row) {
      row = {
        language: r.language ?? null,
        branch: r.branch ?? null,
        totals: {
          verbatim: 0,
          edited: 0,
          cleared: 0,
          manual_no_suggestion: 0,
          empty_no_suggestion: 0,
        },
        total: 0,
        acceptRate: null,
        acceptRateSampleSize: 0,
      };
      grouped.set(key, row);
    }
    const outcome = r.outcome as schema.BulkImportFilenameOutcome;
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
