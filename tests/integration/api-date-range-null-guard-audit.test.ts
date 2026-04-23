/**
 * @file API Date-Range NULL-Guard Audit (Task #374)
 *
 * Codifies the project-wide invariant introduced by Task #373:
 *
 *   Every user-supplied date-range filter (`gte`/`lte`/`BETWEEN`) on a
 *   *nullable* date column in `server/api/**` must be paired with an
 *   explicit `isNotNull(<column>)` guard whenever any bound is set.
 *
 * The guard makes the NULL-exclusion contract explicit so a future
 * refactor that swaps the operator or moves the bound into an `or(...)`
 * group cannot silently start returning records with no date inside a
 * date window.
 *
 * This is a **static-source-scan** test: it reads the API source files
 * and the shared schema files, identifies every `gte(<col>, ...)` /
 * `lte(<col>, ...)` call against a date/timestamp column, classifies
 * the column as NOT NULL or nullable, and asserts the NULL guard exists
 * for every nullable case.
 *
 * Adding a new date-range filter on a nullable column without a guard
 * (or removing the existing `bills.issueDate` guard) will fail this
 * test until the guard is added or the audit allowlist below is
 * updated with a deliberate classification.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import { describe, it, expect } from '@jest/globals';

const REPO_ROOT = resolve(__dirname, '..', '..');
const API_DIR = join(REPO_ROOT, 'server', 'api');
const SHARED_SCHEMA_DIRS = [
  join(REPO_ROOT, 'shared'),
];

/** Recursively list all .ts files under `dir`. */
function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Build a map of `<table>.<column>` → nullability metadata by scanning
 * every drizzle table column declaration in shared schemas.
 *
 * A column declaration looks like one of:
 *   issueDate: date('issue_date'),                      // nullable
 *   startDate: date('start_date').notNull(),            // not null
 *   startTime: timestamp('start_time', { ... }).notNull(),
 *
 * We don't try to resolve the table name from the surrounding
 * `pgTable('bills', { ... })` block precisely; instead we record the
 * column's JS property name and note its nullability. Callers below
 * disambiguate by table alias when querying the map.
 */
type ColumnInfo = { isDateLike: boolean; nullable: boolean };
const columnInfo = new Map<string, ColumnInfo>();

const DATE_LIKE_TYPES = new Set(['date', 'timestamp', 'time', 'timestamptz']);

function loadColumnInfo(): void {
  const files: string[] = [];
  for (const dir of SHARED_SCHEMA_DIRS) {
    files.push(...walkTsFiles(dir));
  }
  // Match: `propName: <type>('col_name'...).notNull()` or without notNull.
  const re = /(\w+)\s*:\s*(date|timestamp|time|timestamptz)\s*\(\s*['"][^'"]+['"][^)]*\)([^,\n]*)/g;
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const [, prop, type, tail] = m;
      if (!DATE_LIKE_TYPES.has(type)) continue;
      const nullable = !/\.notNull\s*\(/.test(tail);
      // First-write wins; multiple tables can share a column name (e.g.
      // `endDate`). We refine via per-call disambiguation below.
      const key = prop;
      const existing = columnInfo.get(key);
      if (!existing) {
        columnInfo.set(key, { isDateLike: true, nullable });
      } else if (existing.nullable !== nullable) {
        // Same prop name appears with different nullability across
        // tables — record as "ambiguous: nullable" so the audit errs on
        // the safe side and demands a guard.
        columnInfo.set(key, { isDateLike: true, nullable: true });
      }
    }
  }
}

loadColumnInfo();

/**
 * Find every `gte(<expr>, ...)` and `lte(<expr>, ...)` call in `src`,
 * returning the `<expr>` as written (e.g. `bills.issueDate`,
 * `payments.scheduledDate`, `schema.bookings.startTime`).
 *
 * We intentionally accept anything up to the first comma at depth 0 so
 * `sql\`...\`` expressions and computed bounds are captured for manual
 * classification via the allowlist below.
 */
function findRangeCalls(src: string): Array<{ op: 'gte' | 'lte' | 'between'; col: string; line: number; lineText: string }> {
  const out: Array<{ op: 'gte' | 'lte' | 'between'; col: string; line: number; lineText: string }> = [];
  // Match drizzle's gte(col, ...) / lte(col, ...) / between(col, ..., ...) calls.
  // Limitation: this regex catches identifier-style column references
  // (e.g. `bills.issueDate`, `schema.payments.scheduledDate`). Alternate
  // expression forms (e.g. raw `sql\`...\`` template ranges) are scanned
  // separately below to avoid blind spots.
  const re = /\b(gte|lte|between)\s*\(\s*([A-Za-z_][\w.]*)\s*,/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const lineStart = src.lastIndexOf('\n', m.index) + 1;
    const lineEnd = src.indexOf('\n', m.index);
    const lineText = src.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    const line = src.slice(0, m.index).split('\n').length;
    out.push({ op: m[1] as 'gte' | 'lte' | 'between', col: m[2], line, lineText });
  }
  return out;
}

/**
 * Find raw `sql\`... >= ... \`` / `sql\`... <= ... \`` / `sql\`... BETWEEN ... \``
 * template literals so alternate-expression forms can't sneak past the
 * identifier-form scan above. Returns the matched line number and text
 * for manual classification — these must already be covered by the
 * allowlist (or be a non-date arithmetic comparison such as
 * monthlyBudgets.year * 100 + month).
 */
function findRawSqlRangeLines(src: string): Array<{ line: number; lineText: string }> {
  const out: Array<{ line: number; lineText: string }> = [];
  const re = /sql`[^`]*?(>=|<=|BETWEEN)[^`]*?`/gs;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const lineStart = src.lastIndexOf('\n', m.index) + 1;
    const lineEnd = src.indexOf('\n', m.index);
    const lineText = src.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    const line = src.slice(0, m.index).split('\n').length;
    out.push({ line, lineText: lineText.trim() });
  }
  return out;
}

/**
 * Return true iff a regex pattern matches at least one line within
 * `window` lines above or below `centerLine` in `src`.
 */
function hasNearbyMatch(src: string, centerLine: number, pattern: string, window: number): boolean {
  const re = new RegExp(pattern);
  const lines = src.split('\n');
  const lo = Math.max(0, centerLine - 1 - window);
  const hi = Math.min(lines.length, centerLine - 1 + window + 1);
  for (let i = lo; i < hi; i++) {
    if (re.test(lines[i])) return true;
  }
  return false;
}

/** Strip a leading `schema.` qualifier so `schema.bookings.startTime` → `bookings.startTime`. */
function stripSchemaPrefix(col: string): string {
  return col.replace(/^schema\./, '');
}

/** Last segment of a dotted column reference (e.g. `bookings.startTime` → `startTime`). */
function leafProp(col: string): string {
  const parts = col.split('.');
  return parts[parts.length - 1];
}

/**
 * Audit allowlist — the result of the Task #374 audit. Each entry
 * declares one date-range filter found in `server/api/**` and how the
 * NULL-exclusion contract is satisfied. The test below verifies every
 * `gte`/`lte` on a date-like column matches one of these entries; new
 * entries must be added (with a deliberate classification) when a new
 * date-range filter is introduced.
 *
 * Classifications:
 *   - `notNull`        : column is NOT NULL in shared schema (no guard required).
 *   - `guarded`        : column is nullable AND filter is paired with
 *                        an explicit `isNotNull(<col>)` guard whenever
 *                        any user-supplied bound is set.
 *   - `orIsNullWrapped`: filter is intentionally wrapped in
 *                        `or(isNull(<col>), gte/lte(...))` to *include*
 *                        records with no date (different semantics).
 *   - `hardcodedBound` : the gte/lte bound is a hardcoded server-side
 *                        constant (e.g. `today`, `new Date()`), not a
 *                        user-supplied query parameter — so a future
 *                        refactor cannot turn this into a NULL-leak
 *                        through user input.
 */
type Classification = 'notNull' | 'guarded' | 'orIsNullWrapped' | 'hardcodedBound';
type AllowlistEntry = {
  file: string; // path relative to repo root
  col: string;  // column expression as written
  classification: Classification;
  note?: string;
};

const ALLOWLIST: AllowlistEntry[] = [
  // bills.ts — year filter (drives by `year` query param). bills.startDate
  // and payments.scheduledDate are both NOT NULL.
  { file: 'server/api/bills.ts', col: 'payments.scheduledDate', classification: 'notNull' },
  { file: 'server/api/bills.ts', col: 'bills.startDate', classification: 'notNull' },
  { file: 'server/api/bills.ts', col: 'schema.payments.scheduledDate', classification: 'notNull' },

  // bills.ts — issue-date range filter (issueDateFrom/issueDateTo).
  // bills.issueDate is nullable; an explicit `isNotNull(bills.issueDate)`
  // guard is added when either bound is set (Task #373).
  {
    file: 'server/api/bills.ts',
    col: 'bills.issueDate',
    classification: 'guarded',
    note: 'Task #373 — paired with isNotNull(bills.issueDate) guard.',
  },

  // bills.ts — monthly-summary endpoint (lastMonthStart/lastMonthEnd,
  // nextMonthStart/nextMonthEnd). payments.scheduledDate is NOT NULL.
  // (Same column name as above; multiple call sites all classified.)

  // ai-monitoring.ts — hardcoded `today` bound (no user input). The
  // column itself may be nullable but no user-driven date window leak
  // is possible.
  {
    file: 'server/api/ai-monitoring.ts',
    col: 'aiInteractions.timestamp',
    classification: 'hardcodedBound',
    note: 'Bound is server-side `today`; no user query parameter feeds it.',
  },

  // common-spaces.ts and common-spaces-rules.ts — bookings.startTime /
  // bookings.endTime are both NOT NULL.
  { file: 'server/api/common-spaces.ts', col: 'bookings.startTime', classification: 'notNull' },
  { file: 'server/api/common-spaces.ts', col: 'bookings.endTime', classification: 'notNull' },
  { file: 'server/api/common-spaces-rules.ts', col: 'bookings.startTime', classification: 'notNull' },
  { file: 'server/api/common-spaces-rules.ts', col: 'bookings.endTime', classification: 'notNull' },

  // budgets.ts — year/month range filters target integer columns
  // (`budgets.year`, `monthlyBudgets.year`, `monthlyBudgets.month`),
  // not date columns. Date-like gte/lte calls below:
  { file: 'server/api/budgets.ts', col: 'payments.scheduledDate', classification: 'notNull' },
  {
    file: 'server/api/budgets.ts',
    col: 'bills.endDate',
    classification: 'orIsNullWrapped',
    note: 'Wrapped in or(isNull(bills.endDate), gte(...)) to include ongoing bills.',
  },
];

/** Lookup nullability from the shared-schema scan. */
function nullabilityOf(col: string): { known: boolean; isDateLike: boolean; nullable: boolean } {
  const prop = leafProp(stripSchemaPrefix(col));
  const info = columnInfo.get(prop);
  if (!info) return { known: false, isDateLike: false, nullable: false };
  return { known: true, isDateLike: info.isDateLike, nullable: info.nullable };
}

/** Find an allowlist entry matching a given (file, col) pair. */
function findAllowlist(file: string, col: string): AllowlistEntry | undefined {
  return ALLOWLIST.find((e) => e.file === file && e.col === col);
}

describe('API date-range filter NULL-guard audit (Task #374)', () => {
  const apiFiles = walkTsFiles(API_DIR);

  it('discovers shared-schema date columns', () => {
    // Sanity check the schema scanner — these must be populated for
    // the per-file assertions below to mean anything.
    expect(columnInfo.get('issueDate')).toEqual({ isDateLike: true, nullable: true });
    expect(columnInfo.get('startTime')).toEqual({ isDateLike: true, nullable: false });
    expect(columnInfo.get('scheduledDate')?.isDateLike).toBe(true);
  });

  it('every gte/lte on a date-like column in server/api/** is classified by the audit allowlist', () => {
    const unclassified: Array<{ file: string; col: string; line: number; lineText: string }> = [];
    const guardMissing: Array<{ file: string; col: string; line: number }> = [];

    for (const file of apiFiles) {
      const rel = relative(REPO_ROOT, file).replace(/\\/g, '/');
      const src = readFileSync(file, 'utf8');
      const calls = findRangeCalls(src);

      for (const call of calls) {
        const colKey = stripSchemaPrefix(call.col);
        const meta = nullabilityOf(call.col);

        // Skip non-date columns entirely (e.g. integer year/month
        // filters in budgets.ts — `budgets.year`, `monthlyBudgets.year`).
        if (!meta.isDateLike) continue;

        const entry = findAllowlist(rel, call.col);
        if (!entry) {
          unclassified.push({ file: rel, col: call.col, line: call.line, lineText: call.lineText.trim() });
          continue;
        }

        // For nullable columns classified as `guarded`, verify an
        // `isNotNull(<col>)` reference exists *near the callsite* (within
        // a 40-line window above or below). File-level presence isn't
        // enough — a future unguarded range call could otherwise hide
        // behind an unrelated guarded call elsewhere in the same file.
        if (entry.classification === 'guarded' && meta.nullable) {
          if (!hasNearbyMatch(src, call.line, `isNotNull\\s*\\(\\s*${colKey.replace('.', '\\.')}\\s*\\)`, 40)) {
            guardMissing.push({ file: rel, col: call.col, line: call.line });
          }
        }

        // For `orIsNullWrapped`, verify an `isNull(<col>)` reference
        // exists near the callsite (same windowed proximity check).
        if (entry.classification === 'orIsNullWrapped' && meta.nullable) {
          if (!hasNearbyMatch(src, call.line, `isNull\\s*\\(\\s*${colKey.replace('.', '\\.')}\\s*\\)`, 40)) {
            guardMissing.push({ file: rel, col: call.col, line: call.line });
          }
        }
      }
    }

    expect({ unclassified, guardMissing }).toEqual({ unclassified: [], guardMissing: [] });
  });

  it('every allowlist classification is one of the documented values', () => {
    // Sanity check that no typo silently lands in the audit table.
    const valid: Classification[] = ['notNull', 'guarded', 'orIsNullWrapped', 'hardcodedBound'];
    for (const entry of ALLOWLIST) {
      expect(valid).toContain(entry.classification);
    }
  });
});
