/**
 * Task #1252 — `buildSessionItemsForStep` wiring regression guard.
 *
 * Background: Task #1235 stripped the per-item `screening` JSONB from
 * the `sessionItems` array built in `runAllForStep` to fix a memory
 * issue in the linking worker pool. The change was safe for linking
 * (whose analyzer call already trims candidates to `{id, name}` before
 * the prompt) but silently broke the sorting step:
 *
 *   - The sorting branch's `SiblingContext` started passing
 *     `quickAnalysis: null, periodHint: null` for every sibling, so
 *     Claude lost all sibling context.
 *   - More importantly, `isTriviallyKeep` walks each sibling looking
 *     for one that shares `typeGuess + bucketGuess`. With `screening`
 *     missing on every sibling, that check always returned "no merge
 *     candidate", so EVERY item processed by the sorting run-all loop
 *     was silently short-circuited to `{ decision: 'keep' }` without
 *     an AI call.
 *
 * The existing `bulk-import-trivially-keep.test.ts` exercises
 * `isTriviallyKeep` in isolation — it always built its own arrays
 * with screening so it never noticed the wiring strip the helper
 * relies on. These tests cover the wiring itself: the per-step shape
 * of `sessionItems` that `runAllForStep` hands to every parallel
 * `processItemForStep` worker.
 */

import { describe, it, expect } from '@jest/globals';
import {
  buildSessionItemsForStep,
  isTriviallyKeep,
} from '../../../server/api/bulk-import';

type FakeItem = {
  id: string;
  originalName: string;
  screening: Record<string, unknown> | null;
};

function makeRow(
  id: string,
  name: string,
  screening: Record<string, unknown> | null,
): FakeItem {
  return { id, originalName: name, screening };
}

const PV_2021_SCREENING: Record<string, unknown> = {
  isMultiDocument: false,
  periodHint: '2021-10',
  quickAnalysis: {
    typeGuess: 'minutes',
    bucketGuess: 'building_documents',
    reason: 'mock',
    confidence: 0.9,
  },
};

const PV_2021_DUP_SCREENING: Record<string, unknown> = {
  isMultiDocument: false,
  periodHint: '2021-10',
  quickAnalysis: {
    typeGuess: 'minutes',
    bucketGuess: 'building_documents',
    reason: 'mock-dup',
    confidence: 0.9,
  },
};

const PV_2022_SCREENING: Record<string, unknown> = {
  isMultiDocument: false,
  periodHint: '2022-11',
  quickAnalysis: {
    typeGuess: 'minutes',
    bucketGuess: 'building_documents',
    reason: 'mock',
    confidence: 0.9,
  },
};

describe('buildSessionItemsForStep — Task #1252 wiring', () => {
  it('preserves each sibling\u2019s screening blob for the sorting step', () => {
    const rows: FakeItem[] = [
      makeRow('a', 'pv-2021-10.pdf', PV_2021_SCREENING),
      makeRow('b', 'pv-2021-10-part2.pdf', PV_2021_DUP_SCREENING),
      makeRow('c', 'pv-2022-11.pdf', PV_2022_SCREENING),
    ];
    const out = buildSessionItemsForStep(rows, 'sorting');
    expect(out).toHaveLength(3);
    for (const sib of out) {
      expect(sib.screening).not.toBeNull();
      expect(sib.screening).not.toBeUndefined();
      const qa = (sib.screening as Record<string, unknown>).quickAnalysis as {
        typeGuess?: string;
        bucketGuess?: string;
      };
      expect(qa.typeGuess).toBe('minutes');
      expect(qa.bucketGuess).toBe('building_documents');
    }
  });

  it.each(['screening', 'branching', 'identification', 'linking'] as const)(
    'omits screening for the %s step (Task #1235 memory win)',
    (step) => {
      const rows: FakeItem[] = [
        makeRow('a', 'pv-2021-10.pdf', PV_2021_SCREENING),
        makeRow('b', 'pv-2022-11.pdf', PV_2022_SCREENING),
      ];
      const out = buildSessionItemsForStep(rows, step);
      expect(out).toHaveLength(2);
      for (const sib of out) {
        expect(sib).toEqual({ id: expect.any(String), name: expect.any(String) });
        expect('screening' in sib).toBe(false);
      }
    },
  );

  it('always exposes id + name regardless of step', () => {
    const rows: FakeItem[] = [makeRow('a', 'one.pdf', PV_2021_SCREENING)];
    for (const step of ['screening', 'sorting', 'branching', 'identification', 'linking'] as const) {
      const out = buildSessionItemsForStep(rows, step);
      expect(out[0].id).toBe('a');
      expect(out[0].name).toBe('one.pdf');
    }
  });

  it('handles a null screening blob without throwing', () => {
    const rows: FakeItem[] = [
      makeRow('a', 'unscreened.pdf', null),
      makeRow('b', 'screened.pdf', PV_2021_SCREENING),
    ];
    const out = buildSessionItemsForStep(rows, 'sorting');
    expect(out[0].screening).toBeNull();
    expect(out[1].screening).toEqual(PV_2021_SCREENING);
  });
});

describe('buildSessionItemsForStep + isTriviallyKeep integration — Task #1252', () => {
  /**
   * The bug that prompted Task #1252: when `runAllForStep` built
   * sessionItems without screening, `isTriviallyKeep` could not see
   * any sibling's typeGuess/bucketGuess so it returned `true` for
   * EVERY item — silently short-circuiting the entire sorting run.
   *
   * This test reproduces that scenario with two PVs from the same
   * period (a real merge candidate pair) and asserts that the
   * helper-built sessionItems array is enough for `isTriviallyKeep`
   * to detect the candidate and fall through to the AI.
   */
  it('lets isTriviallyKeep detect merge candidates when wiring is correct', () => {
    const rows: FakeItem[] = [
      makeRow('a', 'pv-2021-10.pdf', PV_2021_SCREENING),
      makeRow('b', 'pv-2021-10-part2.pdf', PV_2021_DUP_SCREENING),
    ];
    const sessionItems = buildSessionItemsForStep(rows, 'sorting');
    const myScreening = rows[0].screening!;
    // Two PVs sharing the same typeGuess + bucketGuess + periodHint
    // are a textbook merge candidate — must NOT be short-circuited.
    expect(isTriviallyKeep(myScreening, sessionItems, 'a')).toBe(false);
  });

  it('still short-circuits a genuinely solo item', () => {
    const rows: FakeItem[] = [
      makeRow('a', 'pv-2021-10.pdf', PV_2021_SCREENING),
      // Sibling has a different type → not a merge candidate.
      makeRow('b', 'invoice-042.pdf', {
        isMultiDocument: false,
        periodHint: 'INV-2024-042',
        quickAnalysis: {
          typeGuess: 'invoice',
          bucketGuess: 'bill',
          reason: 'mock',
          confidence: 0.9,
        },
      }),
    ];
    const sessionItems = buildSessionItemsForStep(rows, 'sorting');
    const myScreening = rows[0].screening!;
    expect(isTriviallyKeep(myScreening, sessionItems, 'a')).toBe(true);
  });

  /**
   * Critical regression assertion: the wiring used by the linking
   * step (and every non-sorting step prior to Task #1252) drops
   * screening, which would falsely make `isTriviallyKeep` return
   * `true` for a real merge pair. The sorting step must NEVER use
   * that lean shape — this test fails loudly if anyone changes
   * `runAllForStep` to share one shape across steps again.
   */
  it('regression guard — non-sorting wiring would break the sorting short-circuit', () => {
    const rows: FakeItem[] = [
      makeRow('a', 'pv-2021-10.pdf', PV_2021_SCREENING),
      makeRow('b', 'pv-2021-10-part2.pdf', PV_2021_DUP_SCREENING),
    ];
    const linkingShape = buildSessionItemsForStep(rows, 'linking');
    const myScreening = rows[0].screening!;
    // Without screening, isTriviallyKeep cannot see the merge candidate
    // and falsely short-circuits — proving why sorting must not share
    // this shape.
    expect(isTriviallyKeep(myScreening, linkingShape, 'a')).toBe(true);
    // And the sorting shape, which carries screening, behaves
    // correctly on the same input.
    const sortingShape = buildSessionItemsForStep(rows, 'sorting');
    expect(isTriviallyKeep(myScreening, sortingShape, 'a')).toBe(false);
  });
});
