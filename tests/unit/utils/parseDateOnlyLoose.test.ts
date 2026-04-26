/**
 * @file parseDateOnlyLoose utility tests
 * @description Verifies that `parseDateOnlyLoose` correctly handles both
 * strict `YYYY-MM-DD` strings and UTC-midnight ISO timestamps, returning the
 * same calendar day in any host timezone. Regression guard for task #1151
 * (preventing UTC-midnight off-by-one for `documents.effectiveDate` and
 * other date-only fields stored in `timestamp` columns).
 */

import { describe, it, expect } from '@jest/globals';
import { parseDateOnlyLoose } from '../../../client/src/lib/utils';

describe('parseDateOnlyLoose', () => {
  it('parses a strict YYYY-MM-DD string in local time', () => {
    const d = parseDateOnlyLoose('2026-05-01');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(4); // May (0-indexed)
    expect(d!.getDate()).toBe(1);
  });

  it('parses a UTC-midnight ISO timestamp as the same calendar day', () => {
    // The shape returned by Postgres `timestamp` columns when the backend
    // converts a YYYY-MM-DD input via `new Date('YYYY-MM-DD')`.
    const d = parseDateOnlyLoose('2026-05-01T00:00:00.000Z');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(4);
    expect(d!.getDate()).toBe(1);
  });

  it('extracts the calendar day from any ISO timestamp by ignoring the time', () => {
    const d = parseDateOnlyLoose('2026-05-01T18:30:00.000Z');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(4);
    expect(d!.getDate()).toBe(1);
  });

  it('accepts a Date input and yields the UTC calendar day in local time', () => {
    const utcMidnight = new Date(Date.UTC(2026, 4, 1));
    const d = parseDateOnlyLoose(utcMidnight);
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(4);
    expect(d!.getDate()).toBe(1);
  });

  it('is timezone-invariant for the documented test date in negative offsets', () => {
    const originalTz = process.env.TZ;
    try {
      process.env.TZ = 'America/Vancouver';
      const vancouverString = parseDateOnlyLoose('2026-05-01');
      const vancouverIso = parseDateOnlyLoose('2026-05-01T00:00:00.000Z');
      expect(vancouverString!.getDate()).toBe(1);
      expect(vancouverIso!.getDate()).toBe(1);

      process.env.TZ = 'America/Montreal';
      const montrealString = parseDateOnlyLoose('2026-05-01');
      const montrealIso = parseDateOnlyLoose('2026-05-01T00:00:00.000Z');
      expect(montrealString!.getDate()).toBe(1);
      expect(montrealIso!.getDate()).toBe(1);
    } finally {
      process.env.TZ = originalTz;
    }
  });

  it('returns null for null, undefined, empty, or non-string-or-Date input', () => {
    expect(parseDateOnlyLoose(null)).toBeNull();
    expect(parseDateOnlyLoose(undefined)).toBeNull();
    expect(parseDateOnlyLoose('')).toBeNull();
    expect(parseDateOnlyLoose('not a date')).toBeNull();
    expect(parseDateOnlyLoose(new Date('not a real date'))).toBeNull();
    // @ts-expect-error — testing runtime guard
    expect(parseDateOnlyLoose(123)).toBeNull();
  });

  it('rejects strings whose first 10 chars are not a valid calendar day', () => {
    expect(parseDateOnlyLoose('2026-13-01T00:00:00Z')).toBeNull();
    expect(parseDateOnlyLoose('2026-02-30T00:00:00Z')).toBeNull();
    expect(parseDateOnlyLoose('not-a-date')).toBeNull();
  });
});
