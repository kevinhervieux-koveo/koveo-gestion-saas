/**
 * Task #898 — `withItemTimeout` helper
 *
 * The helper wraps any promise with a generous per-item time budget so a
 * single hung Anthropic call no longer wedges the whole run-all batch.
 * These tests verify the contract without touching Anthropic or the DB.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// withItemTimeout is a pure utility exported for testing.
import { withItemTimeout } from '../../../server/api/bulk-import';

describe('withItemTimeout (Task #898)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves with the wrapped promise result when it finishes before the deadline', async () => {
    const inner = Promise.resolve('done');
    const result = await withItemTimeout(inner, 5000, 'test.pdf');
    expect(result).toBe('done');
  });

  it('rejects with a timeout error when the deadline is reached first', async () => {
    const inner = new Promise<string>(() => {});
    const race = withItemTimeout(inner, 1000, 'slow.pdf');
    jest.advanceTimersByTime(1001);
    await expect(race).rejects.toThrow('timed out after 1000ms');
    await expect(race).rejects.toThrow('slow.pdf');
  });

  it('clears the timer and does not fire after the inner promise resolves', async () => {
    jest.spyOn(globalThis, 'clearTimeout');
    const inner = Promise.resolve(42);
    await withItemTimeout(inner, 5000, 'fast.pdf');
    expect(clearTimeout).toHaveBeenCalled();
  });

  it('propagates non-timeout rejections from the inner promise', async () => {
    const inner = Promise.reject(new Error('network error'));
    await expect(withItemTimeout(inner, 5000, 'errored.pdf')).rejects.toThrow(
      'network error',
    );
  });

  it('timeout message includes the item label for easy log search', async () => {
    const inner = new Promise<never>(() => {});
    const race = withItemTimeout(inner, 100, 'assurance_2025-2026.pdf');
    jest.advanceTimersByTime(101);
    try {
      await race;
      throw new Error('should not reach here');
    } catch (err) {
      expect((err as Error).message).toContain('assurance_2025-2026.pdf');
    }
  });
});
