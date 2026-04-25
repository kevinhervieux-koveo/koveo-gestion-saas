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
