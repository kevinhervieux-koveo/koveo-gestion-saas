/**
 * @jest-environment node
 *
 * Task #364 — Real-Postgres integration test for `pruneAiSuggestionCache`.
 *
 * Verifies that the maintenance pass:
 *   1. Deletes only rows whose `expiresAt` is in the past.
 *   2. Trims the oldest rows when the table exceeds the configured size
 *      cap, leaving the freshest entries behind.
 *   3. Returns counts that account for the rows it actually removed,
 *      including the rows seeded by this test.
 *
 * The integration DB is shared with other suites and the running app,
 * so this suite is careful to:
 *   - Tag every seeded row with a `task364-prune::` cache-key prefix.
 *   - Clean up only its own rows in `beforeEach` / `afterAll`.
 *   - Snapshot the unrelated baseline (non-test rows + their expired
 *     subset) before each prune call, then assert deltas attributable
 *     to its own seed data instead of asserting absolute counters.
 *     This keeps the assertions deterministic even when the rest of
 *     the table is non-empty.
 *
 * Skipped when `_INTEGRATION_DB_URL` is not set so unit-tier runs stay
 * lightweight; the real-DB pattern mirrors
 * `tests/integration/invitations-pending-unique-index.test.ts`.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { inArray } from 'drizzle-orm';

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

const TEST_KEY_PREFIX = 'task364-prune::';

interface BaselineSnapshot {
  /** Total non-test rows currently in the cache. */
  nonTestTotal: number;
  /** Subset of non-test rows whose `expiresAt` is already in the past. */
  nonTestExpired: number;
}

describeIfDb('pruneAiSuggestionCache (real Postgres)', () => {
  let db: typeof import('../db').db;
  let aiSuggestionCache: typeof import('@shared/schemas/infrastructure').aiSuggestionCache;
  let pruneAiSuggestionCache: typeof import('../services/ai-suggestion-cache').pruneAiSuggestionCache;

  async function clearTestRows() {
    const rows = await db
      .select({ cacheKey: aiSuggestionCache.cacheKey })
      .from(aiSuggestionCache);
    const ours = rows
      .map((r) => r.cacheKey)
      .filter((k) => k.startsWith(TEST_KEY_PREFIX));
    if (ours.length > 0) {
      await db
        .delete(aiSuggestionCache)
        .where(inArray(aiSuggestionCache.cacheKey, ours));
    }
  }

  async function listTestKeys(): Promise<string[]> {
    const rows = await db
      .select({ cacheKey: aiSuggestionCache.cacheKey })
      .from(aiSuggestionCache);
    return rows
      .map((r) => r.cacheKey)
      .filter((k) => k.startsWith(TEST_KEY_PREFIX))
      .sort();
  }

  async function snapshotBaseline(): Promise<BaselineSnapshot> {
    const rows = await db
      .select({
        cacheKey: aiSuggestionCache.cacheKey,
        expiresAt: aiSuggestionCache.expiresAt,
      })
      .from(aiSuggestionCache);
    const nonTest = rows.filter(
      (r) => !r.cacheKey.startsWith(TEST_KEY_PREFIX),
    );
    const now = Date.now();
    return {
      nonTestTotal: nonTest.length,
      nonTestExpired: nonTest.filter(
        (r) => new Date(r.expiresAt).getTime() <= now,
      ).length,
    };
  }

  beforeAll(() => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    db = require('../db').db;
    aiSuggestionCache = require('@shared/schemas/infrastructure').aiSuggestionCache;
    pruneAiSuggestionCache = require('../services/ai-suggestion-cache').pruneAiSuggestionCache;
  }, 60000);

  beforeEach(async () => {
    await clearTestRows();
  });

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;
    await clearTestRows();
  }, 60000);

  it('deletes expired rows and leaves fresh ones intact', async () => {
    const now = Date.now();
    const expiredKeys = [
      `${TEST_KEY_PREFIX}expired-a`,
      `${TEST_KEY_PREFIX}expired-b`,
      `${TEST_KEY_PREFIX}expired-c`,
    ];
    const freshKeys = [
      `${TEST_KEY_PREFIX}fresh-a`,
      `${TEST_KEY_PREFIX}fresh-b`,
    ];

    await db.insert(aiSuggestionCache).values([
      ...expiredKeys.map((cacheKey, idx) => ({
        cacheKey,
        value: { idx } as object,
        expiresAt: new Date(now - (idx + 1) * 60_000),
        createdAt: new Date(now - 10 * 60_000),
      })),
      ...freshKeys.map((cacheKey, idx) => ({
        cacheKey,
        value: { idx } as object,
        expiresAt: new Date(now + 60 * 60_000),
        createdAt: new Date(now - 1_000),
      })),
    ]);

    const baseline = await snapshotBaseline();
    // Cap large enough that no overflow eviction happens for any row,
    // baseline included.
    const result = await pruneAiSuggestionCache(
      baseline.nonTestTotal + freshKeys.length + 1_000,
    );

    // The function returns a global expired count: it removes our N
    // expired rows plus whatever pre-existing non-test rows had also
    // expired. Asserting the delta keeps this stable regardless of
    // unrelated table state.
    expect(result.expiredDeleted).toBeGreaterThanOrEqual(expiredKeys.length);
    expect(result.expiredDeleted).toBeLessThanOrEqual(
      expiredKeys.length + baseline.nonTestExpired,
    );
    expect(result.overflowDeleted).toBe(0);

    // Survivor set is the most direct proof: our fresh rows live, our
    // expired rows are gone.
    const remaining = await listTestKeys();
    expect(remaining).toEqual([...freshKeys].sort());
  });

  it('trims oldest rows when over the configured size cap', async () => {
    const now = Date.now();
    const totalRows = 7;
    const survivorCount = 4;

    const inserted = Array.from({ length: totalRows }, (_, i) => ({
      cacheKey: `${TEST_KEY_PREFIX}cap-${String(i).padStart(2, '0')}`,
      value: { i } as object,
      expiresAt: new Date(now + 60 * 60_000),
      // Monotonically increasing createdAt so cap-00 is oldest, cap-06
      // newest. Offset far into the past so our test rows are always
      // older than any baseline rows the prune step might consider.
      createdAt: new Date(now - 1_000_000_000 + i * 1_000),
    }));

    await db.insert(aiSuggestionCache).values(inserted);

    // Snapshot AFTER seeding: we'll set the cap so that only baseline
    // rows + `survivorCount` of our test rows fit. Because our test
    // rows have older createdAt than realistic baseline rows, prune
    // should pick exclusively from our rows when evicting overflow.
    const baseline = await snapshotBaseline();
    const effectiveCap = baseline.nonTestTotal + survivorCount;
    const expectedOverflow = totalRows - survivorCount;

    const result = await pruneAiSuggestionCache(effectiveCap);

    // No expired rows in this scenario from our seed; baseline may
    // contribute, so assert a lower bound only.
    expect(result.expiredDeleted).toBeGreaterThanOrEqual(0);
    expect(result.expiredDeleted).toBeLessThanOrEqual(baseline.nonTestExpired);
    expect(result.overflowDeleted).toBe(expectedOverflow);

    // Survivor set proves the *oldest* test rows were evicted.
    const remainingTestKeys = await listTestKeys();
    const expectedSurvivors = inserted
      .slice(expectedOverflow)
      .map((r) => r.cacheKey)
      .sort();
    expect(remainingTestKeys).toEqual(expectedSurvivors);
  });

  it('removes both expired and overflow rows in a single pass', async () => {
    const now = Date.now();

    const expiredKeys = [
      `${TEST_KEY_PREFIX}mix-expired-a`,
      `${TEST_KEY_PREFIX}mix-expired-b`,
    ];
    const freshKeys = Array.from(
      { length: 5 },
      (_, i) => `${TEST_KEY_PREFIX}mix-fresh-${String(i).padStart(2, '0')}`,
    );

    await db.insert(aiSuggestionCache).values([
      ...expiredKeys.map((cacheKey, idx) => ({
        cacheKey,
        value: {} as object,
        expiresAt: new Date(now - (idx + 1) * 60_000),
        createdAt: new Date(now - 1_000_000_000),
      })),
      ...freshKeys.map((cacheKey, idx) => ({
        cacheKey,
        value: {} as object,
        expiresAt: new Date(now + 60 * 60_000),
        // Oldest fresh first so we know which ones get evicted as
        // overflow. Offset deep into the past so our rows always
        // outrank baseline rows in the oldest-first eviction order.
        createdAt: new Date(now - 1_000_000_000 + idx * 1_000),
      })),
    ]);

    const baseline = await snapshotBaseline();

    // After expired rows (ours + any baseline expired) are pruned,
    // only the 5 fresh test rows remain among our data. Cap so that
    // 2 of them must be evicted as overflow alongside the baseline.
    const survivorCount = 3;
    const effectiveCap = baseline.nonTestTotal + survivorCount;
    const expectedFreshOverflow = freshKeys.length - survivorCount;

    const result = await pruneAiSuggestionCache(effectiveCap);

    // Expired count covers our 2 plus whatever baseline rows had also
    // expired.
    expect(result.expiredDeleted).toBeGreaterThanOrEqual(expiredKeys.length);
    expect(result.expiredDeleted).toBeLessThanOrEqual(
      expiredKeys.length + baseline.nonTestExpired,
    );
    // Overflow is exact for our seed because our rows are oldest, so
    // they are the ones evicted to bring the table back to the cap.
    expect(result.overflowDeleted).toBe(expectedFreshOverflow);

    const remaining = await listTestKeys();
    const expectedSurvivors = freshKeys.slice(expectedFreshOverflow).sort();
    expect(remaining).toEqual(expectedSurvivors);
  });
});
