/**
 * @file snapToLocalDay utility tests
 * @description Verifies that `snapToLocalDay` rounds an arbitrary millisecond
 * timestamp to the nearest local-time midnight. Used by the Gantt chart's
 * drag/resize gesture (task #851) so committed dates always land on whole
 * calendar days rather than sub-day timestamps.
 */

import { describe, it, expect } from '@jest/globals';
import { snapToLocalDay } from '../../../client/src/lib/utils';

describe('snapToLocalDay', () => {
  it('returns the same timestamp when the input is already local midnight', () => {
    const midnight = new Date(2026, 5, 15).getTime(); // Jun 15 2026 00:00 local
    expect(snapToLocalDay(midnight)).toBe(midnight);
  });

  it('rounds down to the start of the day for early-morning timestamps', () => {
    const early = new Date(2026, 5, 15, 4, 30).getTime(); // 04:30 local
    const expected = new Date(2026, 5, 15).getTime();
    expect(snapToLocalDay(early)).toBe(expected);
  });

  it('rounds up to the next day for evening timestamps', () => {
    const evening = new Date(2026, 5, 15, 18, 0).getTime(); // 18:00 local
    const expected = new Date(2026, 5, 16).getTime();
    expect(snapToLocalDay(evening)).toBe(expected);
  });

  it('rounds up exactly at noon (>= half day)', () => {
    const noon = new Date(2026, 5, 15, 12, 0).getTime();
    const expected = new Date(2026, 5, 16).getTime();
    expect(snapToLocalDay(noon)).toBe(expected);
  });

  it('always returns a local midnight timestamp regardless of the input offset', () => {
    const arbitrary = new Date(2026, 5, 15, 7, 23, 41, 137).getTime();
    const snapped = snapToLocalDay(arbitrary);
    const asDate = new Date(snapped);
    expect(asDate.getHours()).toBe(0);
    expect(asDate.getMinutes()).toBe(0);
    expect(asDate.getSeconds()).toBe(0);
    expect(asDate.getMilliseconds()).toBe(0);
  });

  it('returns the original value for non-finite inputs', () => {
    expect(Number.isNaN(snapToLocalDay(NaN))).toBe(true);
    expect(snapToLocalDay(Infinity)).toBe(Infinity);
  });
});
