/**
 * Task #898 — run-all concurrency, cooperative cancellation, inFlight.
 *
 * Tests that focus on the three new behaviours introduced by Task #898.
 * These tests are entirely self-contained (no server module import, no DB)
 * so they run fast and reliably in the unit-test environment.
 *
 *  1. Worker-pool pattern: the same Promise.all + shared-index approach
 *     used in `runAllForStep` processes all items exactly once, never
 *     exceeds the configured concurrency, and genuinely runs items in
 *     parallel (peak concurrency > 1 for async work items).
 *
 *  2. Cooperative cancellation: a shared boolean/Set gate lets the loop
 *     detect mid-run that it should stop issuing new work — exactly how
 *     `inFlightRunAll` is used when the session-delete endpoint fires.
 *
 *  3. Per-item timeout (already covered by `bulk-import-with-item-timeout.test.ts`):
 *     referenced here only to confirm the suite dependency.
 */

import { describe, it, expect } from '@jest/globals';

// ─── Worker-pool helper (mirrors the production pattern exactly) ───────────────

/**
 * Processes `items` using at most `concurrency` simultaneous workers.
 * Workers share a mutable `idx` counter via closure — the same pattern
 * used inside `runAllForStep`.
 */
async function workerPool<T>(
  items: T[],
  concurrency: number,
  work: (item: T, idx: number) => Promise<void>,
): Promise<void> {
  let idx = 0;
  async function worker(): Promise<void> {
    while (idx < items.length) {
      const i = idx++;
      await work(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('worker-pool pattern (Task #898)', () => {
  it('processes all items exactly once with N=4 workers', async () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const processed: string[] = [];

    await workerPool(items, 4, async (item) => {
      processed.push(item);
    });

    expect(processed.sort()).toEqual(items.slice().sort());
  });

  it('runs up to N items concurrently (peak concurrency > 1)', async () => {
    const CONCURRENCY = 4;
    const items = Array.from({ length: 12 }, (_, i) => i);
    let current = 0;
    let peak = 0;

    await workerPool(items, CONCURRENCY, async (_item) => {
      current++;
      peak = Math.max(peak, current);
      await new Promise<void>((r) => setImmediate(r));
      current--;
    });

    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(CONCURRENCY);
  });

  it('never exceeds the concurrency limit', async () => {
    const CONCURRENCY = 4;
    const items = Array.from({ length: 20 }, (_, i) => i);
    let current = 0;
    let exceeded = false;

    await workerPool(items, CONCURRENCY, async (_item) => {
      current++;
      if (current > CONCURRENCY) exceeded = true;
      await new Promise<void>((r) => setImmediate(r));
      current--;
    });

    expect(exceeded).toBe(false);
  });

  it('handles an empty item list without errors', async () => {
    const processed: number[] = [];
    await workerPool([], 4, async (x: number) => { processed.push(x); });
    expect(processed).toHaveLength(0);
  });

  it('handles a single item with N=4 workers', async () => {
    const processed: string[] = [];
    await workerPool(['only'], 4, async (item) => { processed.push(item); });
    expect(processed).toEqual(['only']);
  });
});

describe('rawInFlight semaphore (Task #898 — bounded concurrency under timeout)', () => {
  /**
   * Mirrors the semaphore used in `runAllForStep`.
   *
   * Each item:
   *   1. Waits until rawInFlight < CONCURRENCY (the gate)
   *   2. Increments rawInFlight (synchronously)
   *   3. Starts a workPromise whose .finally() decrements rawInFlight
   *   4. Races workPromise against a short timeout
   *   5. On timeout, the gate prevents the next dequeue until the slot frees
   *
   * This guarantees total active workPromises ≤ CONCURRENCY regardless of
   * how many items time out.
   */
  async function semaphorePool(
    items: number[],
    concurrency: number,
    workDelayMs: number,
    timeoutMs: number,
  ): Promise<{ maxObservedInFlight: number; totalProcessed: number }> {
    let rawInFlight = 0;
    let maxObservedInFlight = 0;
    let totalProcessed = 0;
    const queue = [...items];

    async function worker(): Promise<void> {
      while (true) {
        // Gate: wait for a slot (mirrors the production while loop)
        while (rawInFlight >= concurrency) {
          await new Promise<void>((r) => setTimeout(r, 5));
        }
        const item = queue.shift();
        if (item === undefined) break;

        // Claim a slot synchronously before the first await
        rawInFlight++;
        maxObservedInFlight = Math.max(maxObservedInFlight, rawInFlight);

        // workPromise models the real AI call; .finally() frees the slot
        const workPromise = new Promise<void>((r) => setTimeout(r, workDelayMs));
        void workPromise.finally(() => { rawInFlight--; });

        // Race against a short timeout
        try {
          await Promise.race([
            workPromise,
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('timed out')), timeoutMs),
            ),
          ]);
        } catch {
          // Timeout: slot is still occupied by workPromise.finally()
        }
        totalProcessed++;
      }
    }

    await Promise.all(Array.from({ length: concurrency }, worker));
    return { maxObservedInFlight, totalProcessed };
  }

  it('rawInFlight never exceeds concurrency when no items time out', async () => {
    const { maxObservedInFlight, totalProcessed } = await semaphorePool(
      Array.from({ length: 12 }, (_, i) => i),
      4,
      1,    // work: 1 ms
      500,  // timeout: 500 ms (no items time out)
    );
    expect(maxObservedInFlight).toBeLessThanOrEqual(4);
    expect(totalProcessed).toBe(12);
  });

  it('rawInFlight never exceeds concurrency even when most items time out', async () => {
    const { maxObservedInFlight, totalProcessed } = await semaphorePool(
      Array.from({ length: 8 }, (_, i) => i),
      4,
      200,  // work: 200 ms (hangs beyond the 20 ms timeout)
      20,   // timeout: 20 ms (all items time out)
    );
    expect(maxObservedInFlight).toBeLessThanOrEqual(4);
    expect(totalProcessed).toBe(8);
  });

  it('all items are eventually processed even with timeouts', async () => {
    const { totalProcessed } = await semaphorePool(
      Array.from({ length: 10 }, (_, i) => i),
      3,
      80,   // work: 80 ms (beyond 30 ms timeout)
      30,   // timeout: 30 ms
    );
    expect(totalProcessed).toBe(10);
  });
});

describe('cooperative cancellation pattern (Task #898)', () => {
  /**
   * Simulates the `inFlightRunAll.has(key)` guard used between items.
   * The loop checks the flag before every item; once cancelled it stops
   * picking up new work (already-in-flight work continues to completion).
   */
  async function cancellablePool<T>(
    items: T[],
    concurrency: number,
    isActive: () => boolean,
    work: (item: T) => Promise<void>,
  ): Promise<void> {
    let idx = 0;
    async function worker(): Promise<void> {
      while (idx < items.length && isActive()) {
        const item = items[idx++];
        await work(item);
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));
  }

  it('stops early when the active flag is cleared mid-loop (single worker)', async () => {
    const CONCURRENCY = 1; // single worker for deterministic ordering
    const items = [0, 1, 2, 3, 4, 5];
    const processed: number[] = [];
    let active = true;

    await cancellablePool(items, CONCURRENCY, () => active, async (item) => {
      processed.push(item);
      if (item === 2) active = false; // cancel after item 2
    });

    expect(processed).toEqual([0, 1, 2]);
  });

  it('processes all items when never cancelled', async () => {
    const items = [0, 1, 2, 3, 4];
    const processed: number[] = [];

    await cancellablePool(items, 4, () => true, async (item) => {
      processed.push(item);
    });

    expect(processed.sort((a, b) => a - b)).toEqual(items);
  });

  it('cancelling immediately (before first item) processes 0 items', async () => {
    const items = [0, 1, 2, 3, 4];
    const processed: number[] = [];

    await cancellablePool(items, 4, () => false, async (item) => {
      processed.push(item);
    });

    expect(processed).toHaveLength(0);
  });

  it('Set-based gate: deleting the key stops the loop (inFlightRunAll pattern)', async () => {
    const inFlight = new Set<string>();
    const key = 'sess-42:branching';
    inFlight.add(key);

    const items = Array.from({ length: 10 }, (_, i) => i);
    const processed: number[] = [];

    await cancellablePool(items, 1, () => inFlight.has(key), async (item) => {
      processed.push(item);
      if (item === 3) inFlight.delete(key); // simulate session delete
    });

    // Items 0-3 were processed; 4-9 were skipped.
    expect(processed).toEqual([0, 1, 2, 3]);
    expect(inFlight.has(key)).toBe(false);
  });
});
