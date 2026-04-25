/**
 * Task #898 — `isTriviallyKeep` short-circuit for the sorting step.
 *
 * Files that are obviously not merge/split candidates get a deterministic
 * "keep" decision without an Anthropic round-trip.  The two preconditions
 * are:
 *   1. Screening said `isMultiDocument === false` (explicitly false, not
 *      null/undefined — those fall through to the AI).
 *   2. No sibling in the session shares the same typeGuess + bucketGuess.
 *
 * When both are true the short-circuit fires; when either is absent the
 * AI call runs normally.
 */

import { describe, it, expect } from '@jest/globals';
import { isTriviallyKeep } from '../../../server/api/bulk-import';

function makeScreening(opts: {
  isMultiDocument?: boolean | null;
  typeGuess?: string;
  bucketGuess?: string;
} = {}): Record<string, unknown> {
  return {
    isMultiDocument: opts.isMultiDocument !== undefined ? opts.isMultiDocument : false,
    quickAnalysis:
      opts.typeGuess !== undefined
        ? { typeGuess: opts.typeGuess, bucketGuess: opts.bucketGuess ?? 'building_documents', reason: 'test', confidence: 0.8 }
        : undefined,
  };
}

describe('isTriviallyKeep (Task #898)', () => {
  const itemId = 'item-1';

  it('returns true when isMultiDocument=false and no sibling shares type+bucket', () => {
    const myScreening = makeScreening({ isMultiDocument: false, typeGuess: 'invoice', bucketGuess: 'bill' });
    const siblings = [
      { id: 'sib-1', screening: makeScreening({ isMultiDocument: false, typeGuess: 'contract', bucketGuess: 'building_documents' }) },
      { id: 'sib-2', screening: makeScreening({ isMultiDocument: false, typeGuess: 'report', bucketGuess: 'building_documents' }) },
    ];
    const allItems = [{ id: itemId, screening: myScreening }, ...siblings];
    expect(isTriviallyKeep(myScreening, allItems, itemId)).toBe(true);
  });

  it('returns false when isMultiDocument=true even if no sibling matches', () => {
    const myScreening = makeScreening({ isMultiDocument: true, typeGuess: 'invoice', bucketGuess: 'bill' });
    const allItems = [{ id: itemId, screening: myScreening }];
    expect(isTriviallyKeep(myScreening, allItems, itemId)).toBe(false);
  });

  it('returns false when isMultiDocument=null (unknown)', () => {
    const myScreening = makeScreening({ isMultiDocument: null, typeGuess: 'invoice', bucketGuess: 'bill' });
    const allItems = [{ id: itemId, screening: myScreening }];
    expect(isTriviallyKeep(myScreening, allItems, itemId)).toBe(false);
  });

  it('returns false when isMultiDocument=undefined (missing)', () => {
    const myScreening: Record<string, unknown> = {
      quickAnalysis: { typeGuess: 'invoice', bucketGuess: 'bill' },
    };
    const allItems = [{ id: itemId, screening: myScreening }];
    expect(isTriviallyKeep(myScreening, allItems, itemId)).toBe(false);
  });

  it('returns false when a sibling shares the same typeGuess+bucketGuess', () => {
    const myScreening = makeScreening({ isMultiDocument: false, typeGuess: 'invoice', bucketGuess: 'bill' });
    const siblings = [
      {
        id: 'sib-1',
        screening: makeScreening({ isMultiDocument: false, typeGuess: 'invoice', bucketGuess: 'bill' }),
      },
    ];
    const allItems = [{ id: itemId, screening: myScreening }, ...siblings];
    expect(isTriviallyKeep(myScreening, allItems, itemId)).toBe(false);
  });

  it('returns true when sibling shares typeGuess but not bucketGuess (no full match)', () => {
    const myScreening = makeScreening({ isMultiDocument: false, typeGuess: 'invoice', bucketGuess: 'bill' });
    const siblings = [
      {
        id: 'sib-1',
        screening: makeScreening({ isMultiDocument: false, typeGuess: 'invoice', bucketGuess: 'building_documents' }),
      },
    ];
    const allItems = [{ id: itemId, screening: myScreening }, ...siblings];
    expect(isTriviallyKeep(myScreening, allItems, itemId)).toBe(true);
  });

  it('returns true when sibling shares bucketGuess but not typeGuess (no full match)', () => {
    const myScreening = makeScreening({ isMultiDocument: false, typeGuess: 'invoice', bucketGuess: 'bill' });
    const siblings = [
      {
        id: 'sib-1',
        screening: makeScreening({ isMultiDocument: false, typeGuess: 'contract', bucketGuess: 'bill' }),
      },
    ];
    const allItems = [{ id: itemId, screening: myScreening }, ...siblings];
    expect(isTriviallyKeep(myScreening, allItems, itemId)).toBe(true);
  });

  it('returns false when quickAnalysis is absent (no typeGuess to check)', () => {
    const myScreening: Record<string, unknown> = { isMultiDocument: false };
    const allItems = [{ id: itemId, screening: myScreening }];
    expect(isTriviallyKeep(myScreening, allItems, itemId)).toBe(false);
  });

  it('returns false when screening is null', () => {
    const allItems = [{ id: itemId, screening: null as Record<string, unknown> | null | undefined }];
    expect(isTriviallyKeep(null, allItems, itemId)).toBe(false);
  });

  it('ignores the item itself when scanning siblings for merge candidates', () => {
    // If the only entry in allItems is the item itself, it should NOT count
    // as a merge candidate — the short-circuit must fire.
    const myScreening = makeScreening({ isMultiDocument: false, typeGuess: 'invoice', bucketGuess: 'bill' });
    const allItems = [{ id: itemId, screening: myScreening }];
    expect(isTriviallyKeep(myScreening, allItems, itemId)).toBe(true);
  });

  it('sibling with null quickAnalysis is not a merge candidate', () => {
    const myScreening = makeScreening({ isMultiDocument: false, typeGuess: 'invoice', bucketGuess: 'bill' });
    const allItems = [
      { id: itemId, screening: myScreening },
      { id: 'sib-1', screening: { isMultiDocument: false, quickAnalysis: null } as Record<string, unknown> },
    ];
    expect(isTriviallyKeep(myScreening, allItems, itemId)).toBe(true);
  });
});

// ── Task #955 — period-hint extension of isTriviallyKeep ──────────────────────
describe('isTriviallyKeep — periodHint short-circuit (Task #955)', () => {
  const itemId = 'item-1';

  function makeScreeningWithPeriod(opts: {
    isMultiDocument?: boolean | null;
    typeGuess?: string;
    bucketGuess?: string;
    periodHint?: string | null;
  } = {}): Record<string, unknown> {
    return {
      isMultiDocument: opts.isMultiDocument !== undefined ? opts.isMultiDocument : false,
      periodHint: opts.periodHint !== undefined ? opts.periodHint : null,
      quickAnalysis:
        opts.typeGuess !== undefined
          ? { typeGuess: opts.typeGuess, bucketGuess: opts.bucketGuess ?? 'building_documents', reason: 'test', confidence: 0.8 }
          : undefined,
    };
  }

  it('returns true when sibling shares type+bucket but both have different non-null periodHints', () => {
    const myScreening = makeScreeningWithPeriod({
      isMultiDocument: false,
      typeGuess: 'minutes',
      bucketGuess: 'building_documents',
      periodHint: '2021-10',
    });
    const siblings = [
      {
        id: 'sib-1',
        screening: makeScreeningWithPeriod({
          isMultiDocument: false,
          typeGuess: 'minutes',
          bucketGuess: 'building_documents',
          periodHint: '2022-11',
        }),
      },
    ];
    const allItems = [{ id: itemId, screening: myScreening }, ...siblings];
    // Two meeting-minutes from different years → trivially keep, no AI call needed
    expect(isTriviallyKeep(myScreening, allItems, itemId)).toBe(true);
  });

  it('returns false when sibling shares type+bucket and periodHints match (same physical doc)', () => {
    const myScreening = makeScreeningWithPeriod({
      isMultiDocument: false,
      typeGuess: 'minutes',
      bucketGuess: 'building_documents',
      periodHint: '2021-10',
    });
    const siblings = [
      {
        id: 'sib-1',
        screening: makeScreeningWithPeriod({
          isMultiDocument: false,
          typeGuess: 'minutes',
          bucketGuess: 'building_documents',
          periodHint: '2021-10',
        }),
      },
    ];
    const allItems = [{ id: itemId, screening: myScreening }, ...siblings];
    // Same period → might be same document → fall through to AI
    expect(isTriviallyKeep(myScreening, allItems, itemId)).toBe(false);
  });

  it('returns false (conservative) when my periodHint is null even though sibling has a different one', () => {
    const myScreening = makeScreeningWithPeriod({
      isMultiDocument: false,
      typeGuess: 'minutes',
      bucketGuess: 'building_documents',
      periodHint: null,
    });
    const siblings = [
      {
        id: 'sib-1',
        screening: makeScreeningWithPeriod({
          isMultiDocument: false,
          typeGuess: 'minutes',
          bucketGuess: 'building_documents',
          periodHint: '2022-11',
        }),
      },
    ];
    const allItems = [{ id: itemId, screening: myScreening }, ...siblings];
    // My period unknown → can't prove they differ → fall through to AI
    expect(isTriviallyKeep(myScreening, allItems, itemId)).toBe(false);
  });

  it('returns false (conservative) when sibling periodHint is null even though mine is set', () => {
    const myScreening = makeScreeningWithPeriod({
      isMultiDocument: false,
      typeGuess: 'minutes',
      bucketGuess: 'building_documents',
      periodHint: '2021-10',
    });
    const siblings = [
      {
        id: 'sib-1',
        screening: makeScreeningWithPeriod({
          isMultiDocument: false,
          typeGuess: 'minutes',
          bucketGuess: 'building_documents',
          periodHint: null,
        }),
      },
    ];
    const allItems = [{ id: itemId, screening: myScreening }, ...siblings];
    // Sibling period unknown → can't prove they differ → fall through to AI
    expect(isTriviallyKeep(myScreening, allItems, itemId)).toBe(false);
  });

  it('returns false (conservative) when both periodHints are null (no info)', () => {
    const myScreening = makeScreeningWithPeriod({
      isMultiDocument: false,
      typeGuess: 'minutes',
      bucketGuess: 'building_documents',
      periodHint: null,
    });
    const siblings = [
      {
        id: 'sib-1',
        screening: makeScreeningWithPeriod({
          isMultiDocument: false,
          typeGuess: 'minutes',
          bucketGuess: 'building_documents',
          periodHint: null,
        }),
      },
    ];
    const allItems = [{ id: itemId, screening: myScreening }, ...siblings];
    // No period info on either side → fall through to AI
    expect(isTriviallyKeep(myScreening, allItems, itemId)).toBe(false);
  });

  it('returns true for the specific 2021/2022 PV example from the task description', () => {
    // Proces_verbal_ordre_du_jour_2021_10_… vs Proces_verbal_ordre_du_jour_2022_11_…
    // Both are minutes/building_documents, but different years → trivially keep both.
    const myScreening = makeScreeningWithPeriod({
      isMultiDocument: false,
      typeGuess: 'minutes',
      bucketGuess: 'building_documents',
      periodHint: '2021-10',
    });
    const siblings = [
      {
        id: 'pv-2022',
        screening: makeScreeningWithPeriod({
          isMultiDocument: false,
          typeGuess: 'minutes',
          bucketGuess: 'building_documents',
          periodHint: '2022-11',
        }),
      },
    ];
    const allItems = [{ id: itemId, screening: myScreening }, ...siblings];
    expect(isTriviallyKeep(myScreening, allItems, itemId)).toBe(true);
  });

  it('returns true for two invoices with different invoice numbers (differing periodHints)', () => {
    const myScreening = makeScreeningWithPeriod({
      isMultiDocument: false,
      typeGuess: 'invoice',
      bucketGuess: 'bill',
      periodHint: 'INV-2024-042',
    });
    const siblings = [
      {
        id: 'sib-inv-057',
        screening: makeScreeningWithPeriod({
          isMultiDocument: false,
          typeGuess: 'invoice',
          bucketGuess: 'bill',
          periodHint: 'INV-2024-057',
        }),
      },
    ];
    const allItems = [{ id: itemId, screening: myScreening }, ...siblings];
    expect(isTriviallyKeep(myScreening, allItems, itemId)).toBe(true);
  });

  it('handles multiple siblings — trivially keeps when all type+bucket matches have differing periodHints', () => {
    const myScreening = makeScreeningWithPeriod({
      isMultiDocument: false,
      typeGuess: 'minutes',
      bucketGuess: 'building_documents',
      periodHint: '2021-10',
    });
    const siblings = [
      {
        id: 'sib-2022',
        screening: makeScreeningWithPeriod({
          isMultiDocument: false,
          typeGuess: 'minutes',
          bucketGuess: 'building_documents',
          periodHint: '2022-11',
        }),
      },
      {
        id: 'sib-2023',
        screening: makeScreeningWithPeriod({
          isMultiDocument: false,
          typeGuess: 'minutes',
          bucketGuess: 'building_documents',
          periodHint: '2023-03',
        }),
      },
    ];
    const allItems = [{ id: itemId, screening: myScreening }, ...siblings];
    // All three have different periods → trivially keep
    expect(isTriviallyKeep(myScreening, allItems, itemId)).toBe(true);
  });

  it('falls through to AI when at least one type+bucket match has the same period', () => {
    const myScreening = makeScreeningWithPeriod({
      isMultiDocument: false,
      typeGuess: 'minutes',
      bucketGuess: 'building_documents',
      periodHint: '2021-10',
    });
    const siblings = [
      {
        id: 'sib-diff',
        screening: makeScreeningWithPeriod({
          isMultiDocument: false,
          typeGuess: 'minutes',
          bucketGuess: 'building_documents',
          periodHint: '2022-11',
        }),
      },
      {
        id: 'sib-same',
        screening: makeScreeningWithPeriod({
          isMultiDocument: false,
          typeGuess: 'minutes',
          bucketGuess: 'building_documents',
          periodHint: '2021-10', // same period! could be Part 1 / Part 2
        }),
      },
    ];
    const allItems = [{ id: itemId, screening: myScreening }, ...siblings];
    // One sibling has the same period → might be same document → fall through
    expect(isTriviallyKeep(myScreening, allItems, itemId)).toBe(false);
  });
});
