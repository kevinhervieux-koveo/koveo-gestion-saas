/**
 * Task #1202: Budget math contract test for the bulk-import analyzer.
 *
 * The per-item budget enforced in `server/api/bulk-import.ts`
 * (`RUN_ALL_ITEM_TIMEOUT_MS`) must be larger than the worst-case time
 * the analyzer can spend on a single suggestion call. Without this
 * guarantee a slow Anthropic response would be killed by the run-all
 * supervisor *before* the analyzer's own per-call timeout had a chance
 * to fire, which would skip the retry/backoff path entirely and leave
 * the row stuck on a transient failure.
 *
 * The relationship is:
 *
 *   worst-case = MAX_RETRY_ATTEMPTS × PER_CALL_TIMEOUT_MS
 *              + Σ(min(RETRY_BASE_DELAY_MS × 2^(attempt-1), RETRY_MAX_DELAY_MS))
 *              + small jitter (~10%)
 *
 * If anyone tightens RUN_ALL_ITEM_TIMEOUT_MS or loosens the analyzer
 * constants without re-running the math, this test fails loudly so we
 * don't silently re-introduce the bug Task #1202 was opened for.
 */
import {
  MAX_RETRY_ATTEMPTS,
  RETRY_BASE_DELAY_MS,
  RETRY_MAX_DELAY_MS,
  PER_CALL_TIMEOUT_MS,
} from '../../../server/services/bulk-import-analyzer';
import { RUN_ALL_ITEM_TIMEOUT_MS } from '../../../server/api/bulk-import';

describe('bulk-import analyzer ↔ run-all per-item budget', () => {
  it('exports finite, positive budget constants', () => {
    expect(Number.isFinite(MAX_RETRY_ATTEMPTS)).toBe(true);
    expect(Number.isFinite(RETRY_BASE_DELAY_MS)).toBe(true);
    expect(Number.isFinite(RETRY_MAX_DELAY_MS)).toBe(true);
    expect(Number.isFinite(PER_CALL_TIMEOUT_MS)).toBe(true);
    expect(Number.isFinite(RUN_ALL_ITEM_TIMEOUT_MS)).toBe(true);
    expect(MAX_RETRY_ATTEMPTS).toBeGreaterThanOrEqual(1);
    expect(RETRY_BASE_DELAY_MS).toBeGreaterThan(0);
    expect(RETRY_MAX_DELAY_MS).toBeGreaterThanOrEqual(RETRY_BASE_DELAY_MS);
    expect(PER_CALL_TIMEOUT_MS).toBeGreaterThan(0);
    expect(RUN_ALL_ITEM_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it('worst-case retry chain fits inside RUN_ALL_ITEM_TIMEOUT_MS with margin', () => {
    // Sum of capped exponential backoff delays *between* attempts.
    // There are MAX_RETRY_ATTEMPTS - 1 sleeps (no sleep after the
    // final failed attempt — the analyzer surfaces the failure and
    // returns).
    let backoffSum = 0;
    for (let attempt = 1; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      backoffSum += Math.min(
        RETRY_BASE_DELAY_MS * 2 ** (attempt - 1),
        RETRY_MAX_DELAY_MS,
      );
    }
    // 10 % jitter on each backoff slot is the maximum the analyzer
    // adds (`±10 %`), so worst-case adds another 10 % of the sum.
    const worstCaseMs =
      MAX_RETRY_ATTEMPTS * PER_CALL_TIMEOUT_MS + backoffSum * 1.1;

    // Hard requirement: budget must cover the whole chain.
    expect(worstCaseMs).toBeLessThan(RUN_ALL_ITEM_TIMEOUT_MS);

    // Guard rail: keep at least 5 s of slack so the next round of
    // overhead (network roundtrip on the supervisor side, JSON parse,
    // DB write) doesn't push us over.
    expect(RUN_ALL_ITEM_TIMEOUT_MS - worstCaseMs).toBeGreaterThanOrEqual(
      5_000,
    );
  });

  it('per-call timeout leaves room for at least one full retry within the per-item budget', () => {
    // Even if every attempt hits PER_CALL_TIMEOUT_MS, the supervisor
    // budget must be big enough to cover at least 2 attempts so a
    // single transient error can be retried before the supervisor
    // gives up. (This guards against accidentally bumping
    // PER_CALL_TIMEOUT_MS so high that the supervisor can only ever
    // see one attempt.)
    expect(RUN_ALL_ITEM_TIMEOUT_MS).toBeGreaterThanOrEqual(
      2 * PER_CALL_TIMEOUT_MS + RETRY_BASE_DELAY_MS,
    );
  });
});
