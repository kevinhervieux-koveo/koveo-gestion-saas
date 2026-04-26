/**
 * @file parseDateOnly utility tests
 * @description Verifies that `parseDateOnly` interprets `YYYY-MM-DD` strings
 * as local-time dates so that displayed calendar days never shift across
 * timezones. The function must return the same calendar date in any timezone.
 */

import { describe, it, expect } from '@jest/globals';
import { parseDateOnly } from '../../../client/src/lib/utils';

describe('parseDateOnly', () => {
  it('returns a local-time Date with no timezone shift for YYYY-MM-DD', () => {
    const result = parseDateOnly('2026-05-01');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(4); // May (0-indexed)
    expect(result!.getDate()).toBe(1);
  });

  it('returns the documented calendar day (2026-04-25) without a UTC shift', () => {
    // Sanity-check the canonical regression input from Task #1153. If anyone
    // reverts `parseDateOnly` to `new Date(value)`, the day would silently
    // become April 24 in any timezone west of UTC.
    const result = parseDateOnly('2026-04-25');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(3); // April (0-indexed)
    expect(result!.getDate()).toBe(25);
  });

  it('is timezone-invariant in any UTC offset', () => {
    // Original TZ
    const originalTz = process.env.TZ;

    try {
      // Simulate UTC-8 (America/Vancouver) — most common regression env.
      process.env.TZ = 'America/Vancouver';
      const vancouver = parseDateOnly('2026-05-01');
      expect(vancouver!.getFullYear()).toBe(2026);
      expect(vancouver!.getMonth()).toBe(4);
      expect(vancouver!.getDate()).toBe(1);

      // The task's documented input must also stay on the same day.
      const vancouverApril = parseDateOnly('2026-04-25');
      expect(vancouverApril!.getFullYear()).toBe(2026);
      expect(vancouverApril!.getMonth()).toBe(3);
      expect(vancouverApril!.getDate()).toBe(25);

      // Simulate UTC+12 (Pacific/Auckland)
      process.env.TZ = 'Pacific/Auckland';
      const auckland = parseDateOnly('2026-05-01');
      expect(auckland!.getFullYear()).toBe(2026);
      expect(auckland!.getMonth()).toBe(4);
      expect(auckland!.getDate()).toBe(1);

      const aucklandApril = parseDateOnly('2026-04-25');
      expect(aucklandApril!.getFullYear()).toBe(2026);
      expect(aucklandApril!.getMonth()).toBe(3);
      expect(aucklandApril!.getDate()).toBe(25);
    } finally {
      process.env.TZ = originalTz;
    }
  });

  it('rejects ISO timestamps so datetime values cannot slip through', () => {
    // Datetime values must be parsed with `new Date(...)` directly; the
    // strict parser refuses anything that is not pure `YYYY-MM-DD`.
    expect(parseDateOnly('2026-05-01T12:34:56.000Z')).toBeNull();
    expect(parseDateOnly('2026-05-01T00:00:00')).toBeNull();
    expect(parseDateOnly('2026-05-01 12:00:00')).toBeNull();
  });

  it('returns null for null, undefined, empty, or malformed input', () => {
    expect(parseDateOnly(null)).toBeNull();
    expect(parseDateOnly(undefined)).toBeNull();
    expect(parseDateOnly('')).toBeNull();
    expect(parseDateOnly('not a date')).toBeNull();
    expect(parseDateOnly('2026/05/01')).toBeNull();
    expect(parseDateOnly('2026-13-01')).toBeNull();
    expect(parseDateOnly('2026-02-30')).toBeNull();
  });
});
