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

  it('is timezone-invariant for the documented test date', () => {
    // Original TZ
    const originalTz = process.env.TZ;

    try {
      // Simulate UTC-8 (America/Vancouver)
      process.env.TZ = 'America/Vancouver';
      const vancouver = parseDateOnly('2026-05-01');
      expect(vancouver!.getFullYear()).toBe(2026);
      expect(vancouver!.getMonth()).toBe(4);
      expect(vancouver!.getDate()).toBe(1);

      // Simulate UTC+12 (Pacific/Auckland)
      process.env.TZ = 'Pacific/Auckland';
      const auckland = parseDateOnly('2026-05-01');
      expect(auckland!.getFullYear()).toBe(2026);
      expect(auckland!.getMonth()).toBe(4);
      expect(auckland!.getDate()).toBe(1);
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
