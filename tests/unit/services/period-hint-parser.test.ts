/**
 * Unit tests for parsePeriodHint (Task #1003).
 *
 * Covers every format the screening prompt promises, plus a representative
 * set of non-date inputs that must return null.
 */

import { parsePeriodHint } from '../../../server/services/period-hint-parser';

describe('parsePeriodHint', () => {
  // Helper: assert the result is a Date at the expected UTC midnight.
  function expectDate(hint: string, year: number, month: number, day: number) {
    const result = parsePeriodHint(hint);
    expect(result).not.toBeNull();
    expect(result!.getUTCFullYear()).toBe(year);
    expect(result!.getUTCMonth() + 1).toBe(month);
    expect(result!.getUTCDate()).toBe(day);
  }

  // ── Null / empty inputs ────────────────────────────────────────────────────
  it('returns null for null input', () => {
    expect(parsePeriodHint(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(parsePeriodHint(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parsePeriodHint('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(parsePeriodHint('   ')).toBeNull();
  });

  // ── ISO date ───────────────────────────────────────────────────────────────
  it('parses ISO date "2021-10-15"', () => {
    expectDate('2021-10-15', 2021, 10, 15);
  });

  it('parses ISO date "2020-01-01"', () => {
    expectDate('2020-01-01', 2020, 1, 1);
  });

  it('parses ISO date "1999-12-31"', () => {
    expectDate('1999-12-31', 1999, 12, 31);
  });

  it('returns null for ISO date with invalid month', () => {
    expect(parsePeriodHint('2021-13-01')).toBeNull();
  });

  it('returns null for ISO date with invalid day', () => {
    expect(parsePeriodHint('2021-05-00')).toBeNull();
  });

  // ── Calendar year ──────────────────────────────────────────────────────────
  it('parses calendar year "2022" → Jan 1', () => {
    expectDate('2022', 2022, 1, 1);
  });

  it('parses calendar year "2000" → Jan 1', () => {
    expectDate('2000', 2000, 1, 1);
  });

  // ── Fiscal-year range ──────────────────────────────────────────────────────
  it('parses dash range "2022-2023" → Jan 1 of first year', () => {
    expectDate('2022-2023', 2022, 1, 1);
  });

  it('parses slash range "2022/2023" → Jan 1 of first year', () => {
    expectDate('2022/2023', 2022, 1, 1);
  });

  it('parses "FY 2022-2023" → Jan 1 of first year', () => {
    expectDate('FY 2022-2023', 2022, 1, 1);
  });

  it('parses "fy 2019-2020" (case-insensitive prefix)', () => {
    expectDate('fy 2019-2020', 2019, 1, 1);
  });

  it('returns null for non-consecutive year range "2020-2024"', () => {
    expect(parsePeriodHint('2020-2024')).toBeNull();
  });

  // ── Quarter ────────────────────────────────────────────────────────────────
  it('parses "2023 Q3" → July 1', () => {
    expectDate('2023 Q3', 2023, 7, 1);
  });

  it('parses "Q3 2023" → July 1', () => {
    expectDate('Q3 2023', 2023, 7, 1);
  });

  it('parses "2022 Q1" → January 1', () => {
    expectDate('2022 Q1', 2022, 1, 1);
  });

  it('parses "2022 Q2" → April 1', () => {
    expectDate('2022 Q2', 2022, 4, 1);
  });

  it('parses "2022 Q4" → October 1', () => {
    expectDate('2022 Q4', 2022, 10, 1);
  });

  it('parses "q1 2024" (lower-case q)', () => {
    expectDate('q1 2024', 2024, 1, 1);
  });

  // ── ISO month ──────────────────────────────────────────────────────────────
  it('parses "2023-07" → July 1', () => {
    expectDate('2023-07', 2023, 7, 1);
  });

  it('parses "2024-01" → January 1', () => {
    expectDate('2024-01', 2024, 1, 1);
  });

  it('returns null for "2024-13" (invalid month)', () => {
    expect(parsePeriodHint('2024-13')).toBeNull();
  });

  // ── Month-year (long name) ─────────────────────────────────────────────────
  it('parses "July 2023" → July 1', () => {
    expectDate('July 2023', 2023, 7, 1);
  });

  it('parses "January 2021" → January 1', () => {
    expectDate('January 2021', 2021, 1, 1);
  });

  it('parses "December 2020" → December 1', () => {
    expectDate('December 2020', 2020, 12, 1);
  });

  // ── Month-year (short name) ────────────────────────────────────────────────
  it('parses "Jul 2023" → July 1', () => {
    expectDate('Jul 2023', 2023, 7, 1);
  });

  it('parses "Jan 2022" → January 1', () => {
    expectDate('Jan 2022', 2022, 1, 1);
  });

  it('parses "Dec 2019" → December 1', () => {
    expectDate('Dec 2019', 2019, 12, 1);
  });

  it('parses "Sep 2021" → September 1', () => {
    expectDate('Sep 2021', 2021, 9, 1);
  });

  it('parses "Sept 2021" → September 1', () => {
    expectDate('Sept 2021', 2021, 9, 1);
  });

  // ── Non-date inputs (must return null) ────────────────────────────────────
  it('returns null for invoice number "INV-2024-042"', () => {
    expect(parsePeriodHint('INV-2024-042')).toBeNull();
  });

  it('returns null for free-form text "Annual Report"', () => {
    expect(parsePeriodHint('Annual Report')).toBeNull();
  });

  it('returns null for partial string "Q3"', () => {
    expect(parsePeriodHint('Q3')).toBeNull();
  });

  it('returns null for "2024 Q5" (invalid quarter)', () => {
    // Q5 doesn't match the Q[1-4] pattern so it returns null.
    expect(parsePeriodHint('2024 Q5')).toBeNull();
  });

  it('returns null for random alphanumeric label "ABC-123"', () => {
    expect(parsePeriodHint('ABC-123')).toBeNull();
  });

  it('returns null for "2024-" (trailing dash, not a valid format)', () => {
    expect(parsePeriodHint('2024-')).toBeNull();
  });
});
