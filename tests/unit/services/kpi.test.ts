/**
 * Task #1413 — Unit tests for the bulk-import filename-suggestion KPI
 * helpers in `server/services/kpi.ts`.
 *
 * The KPI is fire-and-forget: a regression in the classifier or the
 * aggregator silently corrupts the dashboard accept-rate without
 * breaking the user-facing flow. These tests pin down the exact
 * behaviour the rest of the system relies on.
 *
 * Coverage:
 *   1. `classifyFilenameSuggestionOutcome`
 *      - verbatim / edited / cleared / manual_no_suggestion /
 *        empty_no_suggestion buckets
 *      - whitespace trimming on both sides
 *      - null / undefined inputs treated as empty
 *      - case sensitivity of the verbatim/edited boundary
 *   2. `aggregateBulkImportFilenameSuggestions`
 *      - per-(language, branch) totals
 *      - accept-rate denominator = verbatim + edited + cleared
 *        (manual_/empty_no_suggestion rows are excluded)
 *      - acceptRate = null when the denominator is 0
 *      - row sort by total desc, then branch asc
 *      - sinceDays cutoff is forwarded to the where clause as a Date
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () => require('../../manual-mocks/drizzle-orm/pg-core'));

// ---------------------------------------------------------------------------
// db mock — captures the `where` argument from the aggregator's select
// chain and serves a configurable row set as the result of `.groupBy(...)`.
// ---------------------------------------------------------------------------
type AggRow = {
  language: string | null;
  branch: string | null;
  outcome: string;
  n: number;
};

let aggregateRows: AggRow[] = [];
let lastWhereCondition: any = null;

const mockDb = {
  select: jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn((cond: any) => {
        lastWhereCondition = cond;
        return {
          groupBy: jest.fn(() => Promise.resolve(aggregateRows)),
        };
      }),
    })),
  })),
  insert: jest.fn(),
};

jest.mock('../../../server/db', () => ({ db: mockDb }));

jest.mock('../../../server/utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
  logWarn: jest.fn(),
}));

import {
  classifyFilenameSuggestionOutcome,
  aggregateBulkImportFilenameSuggestions,
} from '../../../server/services/kpi';

// ---------------------------------------------------------------------------
// 1. classifyFilenameSuggestionOutcome
// ---------------------------------------------------------------------------
describe('classifyFilenameSuggestionOutcome (Task #1413)', () => {
  it('returns "verbatim" when the admin saves the AI suggestion exactly', () => {
    expect(classifyFilenameSuggestionOutcome('invoice-2025', 'invoice-2025')).toBe('verbatim');
  });

  it('returns "verbatim" when both sides differ only in surrounding whitespace', () => {
    expect(classifyFilenameSuggestionOutcome('  invoice-2025 ', 'invoice-2025')).toBe('verbatim');
    expect(classifyFilenameSuggestionOutcome('invoice-2025', '   invoice-2025\n')).toBe('verbatim');
  });

  it('returns "edited" when the admin keeps a non-empty value different from the AI suggestion', () => {
    expect(classifyFilenameSuggestionOutcome('invoice-2025', 'invoice-2025-final')).toBe('edited');
  });

  it('treats casing changes as edits (the verbatim boundary is case-sensitive)', () => {
    // "verbatim" must mean character-for-character identical so the dashboard
    // doesn't over-claim the AI's accuracy on cosmetic changes.
    expect(classifyFilenameSuggestionOutcome('Invoice', 'invoice')).toBe('edited');
  });

  it('returns "cleared" when the AI suggested something but the admin saved an empty string', () => {
    expect(classifyFilenameSuggestionOutcome('invoice-2025', '')).toBe('cleared');
  });

  it('returns "cleared" when the admin saved only whitespace', () => {
    expect(classifyFilenameSuggestionOutcome('invoice-2025', '   ')).toBe('cleared');
  });

  it('returns "cleared" when the admin saved null while the AI had a suggestion', () => {
    expect(classifyFilenameSuggestionOutcome('invoice-2025', null)).toBe('cleared');
    expect(classifyFilenameSuggestionOutcome('invoice-2025', undefined)).toBe('cleared');
  });

  it('returns "manual_no_suggestion" when the AI returned nothing but the admin typed a name', () => {
    expect(classifyFilenameSuggestionOutcome(null, 'manual-name')).toBe('manual_no_suggestion');
    expect(classifyFilenameSuggestionOutcome(undefined, 'manual-name')).toBe('manual_no_suggestion');
    expect(classifyFilenameSuggestionOutcome('', 'manual-name')).toBe('manual_no_suggestion');
    expect(classifyFilenameSuggestionOutcome('   ', 'manual-name')).toBe('manual_no_suggestion');
  });

  it('returns "empty_no_suggestion" when both sides are missing or whitespace-only', () => {
    expect(classifyFilenameSuggestionOutcome(null, null)).toBe('empty_no_suggestion');
    expect(classifyFilenameSuggestionOutcome(undefined, undefined)).toBe('empty_no_suggestion');
    expect(classifyFilenameSuggestionOutcome('', '')).toBe('empty_no_suggestion');
    expect(classifyFilenameSuggestionOutcome('  ', '\t\n ')).toBe('empty_no_suggestion');
  });
});

// ---------------------------------------------------------------------------
// 2. aggregateBulkImportFilenameSuggestions
// ---------------------------------------------------------------------------
describe('aggregateBulkImportFilenameSuggestions (Task #1413)', () => {
  beforeEach(() => {
    aggregateRows = [];
    lastWhereCondition = null;
    jest.clearAllMocks();
  });

  it('groups raw rows into per-(language, branch) totals and computes accept-rate', async () => {
    // Two slices: (en, building_documents) with a known accept rate, and
    // (fr, financial_documents) with a different one.
    aggregateRows = [
      { language: 'en', branch: 'building_documents', outcome: 'verbatim', n: 7 },
      { language: 'en', branch: 'building_documents', outcome: 'edited', n: 2 },
      { language: 'en', branch: 'building_documents', outcome: 'cleared', n: 1 },
      // manual_/empty_no_suggestion must NOT contribute to the accept-rate
      // denominator: there's no AI suggestion to compare against.
      { language: 'en', branch: 'building_documents', outcome: 'manual_no_suggestion', n: 5 },
      { language: 'en', branch: 'building_documents', outcome: 'empty_no_suggestion', n: 3 },

      { language: 'fr', branch: 'financial_documents', outcome: 'verbatim', n: 1 },
      { language: 'fr', branch: 'financial_documents', outcome: 'edited', n: 3 },
    ];

    const rows = await aggregateBulkImportFilenameSuggestions();

    expect(rows).toHaveLength(2);

    // The (en, building_documents) row is bigger (18 events vs 4) so it sorts first.
    const enRow = rows[0];
    expect(enRow.language).toBe('en');
    expect(enRow.branch).toBe('building_documents');
    expect(enRow.totals).toEqual({
      verbatim: 7,
      edited: 2,
      cleared: 1,
      manual_no_suggestion: 5,
      empty_no_suggestion: 3,
    });
    expect(enRow.total).toBe(18);
    // accept-rate denominator = 7 + 2 + 1 = 10; numerator = 7.
    expect(enRow.acceptRateSampleSize).toBe(10);
    expect(enRow.acceptRate).toBeCloseTo(0.7, 5);

    const frRow = rows[1];
    expect(frRow.language).toBe('fr');
    expect(frRow.branch).toBe('financial_documents');
    expect(frRow.totals.verbatim).toBe(1);
    expect(frRow.totals.edited).toBe(3);
    expect(frRow.totals.cleared).toBe(0);
    expect(frRow.total).toBe(4);
    expect(frRow.acceptRateSampleSize).toBe(4);
    expect(frRow.acceptRate).toBeCloseTo(0.25, 5);
  });

  it('returns acceptRate=null when the denominator is 0 (all rows are manual_/empty_no_suggestion)', async () => {
    // No verbatim/edited/cleared rows at all → there's no AI sample, so the
    // dashboard must show "n/a" instead of dividing by zero or reporting 0%.
    aggregateRows = [
      { language: 'en', branch: 'maintenance_documents', outcome: 'manual_no_suggestion', n: 4 },
      { language: 'en', branch: 'maintenance_documents', outcome: 'empty_no_suggestion', n: 6 },
    ];

    const [row] = await aggregateBulkImportFilenameSuggestions();

    expect(row.total).toBe(10);
    expect(row.acceptRateSampleSize).toBe(0);
    expect(row.acceptRate).toBeNull();
  });

  it('returns an empty list when there are no events in the window', async () => {
    aggregateRows = [];
    const rows = await aggregateBulkImportFilenameSuggestions();
    expect(rows).toEqual([]);
  });

  it('ignores unknown outcome strings in the per-bucket totals but still counts them in `total`', async () => {
    // Defensive: a future migration could introduce a new outcome string.
    // We don't want the aggregator to crash; the row should still appear
    // with its known buckets at zero and `total` reflecting the raw count.
    aggregateRows = [
      { language: 'en', branch: 'building_documents', outcome: 'verbatim', n: 2 },
      { language: 'en', branch: 'building_documents', outcome: 'some_future_outcome', n: 5 },
    ];

    const [row] = await aggregateBulkImportFilenameSuggestions();
    expect(row.totals.verbatim).toBe(2);
    expect(row.total).toBe(7);
    // Sample for accept-rate is just the verbatim row (no edited/cleared seen).
    expect(row.acceptRateSampleSize).toBe(2);
    expect(row.acceptRate).toBe(1);
  });

  it('handles null language / null branch as their own group', async () => {
    aggregateRows = [
      { language: null, branch: null, outcome: 'verbatim', n: 2 },
      { language: null, branch: null, outcome: 'edited', n: 2 },
    ];

    const [row] = await aggregateBulkImportFilenameSuggestions();
    expect(row.language).toBeNull();
    expect(row.branch).toBeNull();
    expect(row.totals.verbatim).toBe(2);
    expect(row.totals.edited).toBe(2);
    expect(row.acceptRateSampleSize).toBe(4);
    expect(row.acceptRate).toBeCloseTo(0.5, 5);
  });

  it('sorts rows by total desc, then branch asc as a tiebreaker', async () => {
    // Three slices with two distinct totals: 4 (twice) and 1 (once).
    aggregateRows = [
      { language: 'en', branch: 'zeta_branch', outcome: 'verbatim', n: 4 },
      { language: 'en', branch: 'alpha_branch', outcome: 'verbatim', n: 4 },
      { language: 'en', branch: 'mid_branch', outcome: 'verbatim', n: 1 },
    ];

    const rows = await aggregateBulkImportFilenameSuggestions();
    // Two rows with total=4 → sorted by branch ascending: alpha, then zeta.
    // Then the smaller total row.
    expect(rows.map((r) => r.branch)).toEqual([
      'alpha_branch',
      'zeta_branch',
      'mid_branch',
    ]);
  });

  it('forwards the sinceDays cutoff to the where clause as a Date roughly N days ago', async () => {
    aggregateRows = [];
    const t0 = Date.now();
    await aggregateBulkImportFilenameSuggestions({ sinceDays: 7 });

    // The aggregator builds `and(eq(metricKey, ...), gte(createdAt, cutoff))`.
    // Our drizzle-orm mock represents that as { type: 'and', conditions: [...] },
    // and `gte(col, val)` as { type: 'condition', value: val, operator: 'gte' }.
    expect(lastWhereCondition).toBeTruthy();
    expect(lastWhereCondition.type).toBe('and');
    const gteCond = lastWhereCondition.conditions.find(
      (c: any) => c?.operator === 'gte',
    );
    expect(gteCond).toBeTruthy();
    expect(gteCond.value).toBeInstanceOf(Date);
    const cutoffMs = (gteCond.value as Date).getTime();
    const expectedMs = t0 - 7 * 24 * 60 * 60 * 1000;
    // Allow a few seconds of slack for test execution.
    expect(Math.abs(cutoffMs - expectedMs)).toBeLessThan(5_000);
  });

  it('defaults the cutoff to ~90 days when sinceDays is omitted', async () => {
    aggregateRows = [];
    const t0 = Date.now();
    await aggregateBulkImportFilenameSuggestions();

    const gteCond = lastWhereCondition.conditions.find(
      (c: any) => c?.operator === 'gte',
    );
    const cutoffMs = (gteCond.value as Date).getTime();
    const expectedMs = t0 - 90 * 24 * 60 * 60 * 1000;
    expect(Math.abs(cutoffMs - expectedMs)).toBeLessThan(5_000);
  });
});
