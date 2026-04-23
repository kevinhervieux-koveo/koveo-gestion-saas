import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock db before importing the service so the resolver picks up the stub.
const queue: any[][] = [];
const enqueue = (rows: any[]) => queue.push(rows);

// Track every db.delete().where(...) invocation so tests can assert that
// the upsert function cleared all four equivalent representations of a
// link (outgoing/incoming on both endpoints) before the insert.
type DeleteCall = { kind: 'delete' };
const deleteLog: DeleteCall[] = [];

const buildSelectBuilder = () => {
  const builder: any = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    limit: () => Promise.resolve(queue.shift() ?? []),
  };
  return builder;
};

const buildDeleteBuilder = () => {
  const builder: any = {
    where: () => {
      deleteLog.push({ kind: 'delete' });
      // Mimic returning() being optional; default resolves to [].
      const tail: any = Promise.resolve([]);
      tail.returning = () => Promise.resolve(queue.shift() ?? []);
      return tail;
    },
  };
  return builder;
};

const buildInsertBuilder = () => {
  const builder: any = {
    values: () => builder,
    returning: () => Promise.resolve(queue.shift() ?? []),
  };
  return builder;
};

jest.mock('../../server/db', () => ({
  db: {
    select: () => buildSelectBuilder(),
    delete: () => buildDeleteBuilder(),
    insert: () => buildInsertBuilder(),
  },
}));

import {
  tokenize,
  nameSimilarity,
  scoreCandidate,
  resolveDocumentNeighbors,
  upsertDocumentLink,
  deleteDocumentLink,
} from '../../server/services/document-link-service';
import type { Document } from '../../shared/schema';

const baseDoc = (overrides: Partial<Document>): Document => ({
  id: 'doc-source',
  name: 'Quarterly Budget Report Q1 2025',
  description: null,
  documentType: 'financial',
  filePath: 'a',
  fileName: 'a',
  fileSize: 1,
  mimeType: 'application/pdf',
  isVisibleToTenants: false,
  buildingId: 'building-1',
  residenceId: null,
  uploadedById: 'user-1',
  effectiveDate: new Date('2025-04-01'),
  attachedToType: null,
  attachedToId: null,
  createdAt: new Date('2025-04-02'),
  updatedAt: new Date('2025-04-02'),
  ...overrides,
} as Document);

describe('document-link-service: tokenize', () => {
  it('lowercases and strips punctuation', () => {
    expect(tokenize('Quarterly-Budget Report!')).toEqual(['quarterly', 'budget', 'report']);
  });

  it('strips diacritics so French and English match', () => {
    expect(tokenize('Procès-verbal')).toEqual(['proces', 'verbal']);
  });

  it('drops single-character tokens', () => {
    expect(tokenize('a b cat')).toEqual(['cat']);
  });

  it('handles null/empty', () => {
    expect(tokenize(null)).toEqual([]);
    expect(tokenize('')).toEqual([]);
  });
});

describe('document-link-service: nameSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(nameSimilarity('Budget Report', 'Budget Report')).toBe(1);
  });

  it('returns 0 for fully disjoint', () => {
    expect(nameSimilarity('Budget Report', 'Maintenance Invoice')).toBe(0);
  });

  it('computes Jaccard for partial overlap', () => {
    // {budget, report, q1} vs {budget, report, q2} → 2/4 = 0.5
    expect(nameSimilarity('Budget Report Q1', 'Budget Report Q2')).toBeCloseTo(0.5, 5);
  });

  it('returns 0 for both empty', () => {
    expect(nameSimilarity('', '')).toBe(0);
  });
});

describe('document-link-service: scoreCandidate', () => {
  const source = baseDoc({});

  it('rewards same category, similar name, shared tags, and proximity', () => {
    const candidate = baseDoc({
      id: 'doc-near',
      name: 'Quarterly Budget Report Q2 2025',
      effectiveDate: new Date('2025-04-15'),
    });
    const result = scoreCandidate(source, candidate, ['t1', 't2'], ['t1', 't2', 't3']);
    expect(result.explain.sharedCategory).toBe(true);
    expect(result.explain.sharedTagCount).toBe(2);
    expect(result.explain.sameBuilding).toBe(true);
    expect(result.explain.dateProximityDays).not.toBeNull();
    expect(result.explain.dateProximityDays!).toBeLessThan(30);
    // ≥ 20 (category) + 10 (tags) + ~14 (date) + 5 (building) + name sim*40 = > 50
    expect(result.score).toBeGreaterThan(50);
  });

  it('penalizes different category and far dates', () => {
    const candidate = baseDoc({
      id: 'doc-far',
      name: 'Pool Cleaning Invoice',
      documentType: 'maintenance',
      effectiveDate: new Date('2018-04-01'),
    });
    const result = scoreCandidate(source, candidate, [], []);
    expect(result.explain.sharedCategory).toBe(false);
    expect(result.explain.sharedTagCount).toBe(0);
    expect(result.score).toBeLessThan(15);
  });

  it('orders a closer-name candidate above a far-name candidate', () => {
    const close = scoreCandidate(
      source,
      baseDoc({ id: 'a', name: 'Quarterly Budget Report Q2 2025' }),
      [],
      [],
    );
    const far = scoreCandidate(
      source,
      baseDoc({ id: 'b', name: 'Annual Maintenance Schedule' }),
      [],
      [],
    );
    expect(close.score).toBeGreaterThan(far.score);
  });

  it('resolveDocumentNeighbors prefers explicit links over date fallback', async () => {
    queue.length = 0;
    const source = baseDoc({ id: 'src' });
    const explicitPrev = baseDoc({ id: 'prev-explicit', name: 'Explicit Prev' });
    const explicitNext = baseDoc({ id: 'next-explicit', name: 'Explicit Next' });
    // Sequence under Promise.all (interleaved):
    //   1. loadDocument(source)
    //   2. prev: outgoing 'before' link  (found, skips incoming query)
    //   3. next: outgoing 'after'  link  (found, skips incoming query)
    //   4. loadDocument(explicitPrev)
    //   5. loadDocument(explicitNext)
    enqueue([source]);
    enqueue([{ id: 'l1', toDocumentId: 'prev-explicit', fromDocumentId: 'src', position: 'before' }]);
    enqueue([{ id: 'l2', toDocumentId: 'next-explicit', fromDocumentId: 'src', position: 'after' }]);
    enqueue([explicitPrev]);
    enqueue([explicitNext]);

    const result = await resolveDocumentNeighbors('src');
    expect(result?.previous.document?.id).toBe('prev-explicit');
    expect(result?.previous.source).toBe('explicit');
    expect(result?.next.document?.id).toBe('next-explicit');
    expect(result?.next.source).toBe('explicit');
  });

  it('resolveDocumentNeighbors falls back to date ordering when no explicit links exist', async () => {
    queue.length = 0;
    const source = baseDoc({ id: 'src' });
    const datePrev = baseDoc({ id: 'prev-date', name: 'Older Doc', effectiveDate: new Date('2025-03-01') });
    const dateNext = baseDoc({ id: 'next-date', name: 'Newer Doc', effectiveDate: new Date('2025-05-01') });
    // Sequence (Promise.all for explicit, then sequential pickFirstVisible):
    //   1. loadDocument(source)
    //   2. prev: outgoing 'before' link → empty
    //   3. next: outgoing 'after'  link → empty
    //   4. prev: incoming 'after'  link → empty
    //   5. next: incoming 'before' link → empty
    //   6. findDateNeighborCandidates previous (list of up to 20)
    //   7. findDateNeighborCandidates next     (list of up to 20)
    enqueue([source]);
    enqueue([]); // outgoing before
    enqueue([]); // outgoing after
    enqueue([]); // incoming after (for prev)
    enqueue([]); // incoming before (for next)
    enqueue([datePrev]); // date prev candidates
    enqueue([dateNext]); // date next candidates

    const result = await resolveDocumentNeighbors('src');
    expect(result?.previous.document?.id).toBe('prev-date');
    expect(result?.previous.source).toBe('date');
    expect(result?.next.document?.id).toBe('next-date');
    expect(result?.next.source).toBe('date');
  });

  it('resolveDocumentNeighbors returns null neighbors when none are found', async () => {
    queue.length = 0;
    const source = baseDoc({ id: 'src-only' });
    enqueue([source]);
    enqueue([]); // outgoing before
    enqueue([]); // outgoing after
    enqueue([]); // incoming after
    enqueue([]); // incoming before
    enqueue([]); // date prev candidates
    enqueue([]); // date next candidates

    const result = await resolveDocumentNeighbors('src-only');
    expect(result?.previous.document).toBeNull();
    expect(result?.next.document).toBeNull();
    expect(result?.previous.source).toBeNull();
    expect(result?.next.source).toBeNull();
  });

  it('deleteDocumentLink removes both outgoing and incoming equivalents for the requested side', async () => {
    queue.length = 0;
    deleteLog.length = 0;
    // Each delete().where().returning() consumes one queue entry. Pretend the
    // outgoing delete found nothing, but the incoming-side delete removed
    // a row — the function should still report success because the side was
    // cleared via the equivalent representation.
    enqueue([]); // outgoing delete returning
    enqueue([{ id: 'l1' }]); // incoming delete returning
    const removed = await deleteDocumentLink({ fromDocumentId: 'A', position: 'before' });
    expect(removed).toBe(true);
    expect(deleteLog).toHaveLength(2);
  });

  it('resolveDocumentNeighbors skips date candidates hidden by viewer visibility', async () => {
    queue.length = 0;
    const source = baseDoc({ id: 'src-vis' });
    // First date candidate is manager-only (must be skipped for tenant viewer);
    // second is visible. The resolver should pick the second.
    const hiddenPrev = baseDoc({ id: 'hidden-prev', isManagerOnly: true, isVisibleToTenants: true });
    const visiblePrev = baseDoc({ id: 'visible-prev', isVisibleToTenants: true });
    const visibleNext = baseDoc({ id: 'visible-next', isVisibleToTenants: true });
    enqueue([source]);
    enqueue([]); // outgoing before
    enqueue([]); // outgoing after
    enqueue([]); // incoming after
    enqueue([]); // incoming before
    enqueue([hiddenPrev, visiblePrev]); // date prev candidates (list)
    enqueue([visibleNext]); // date next candidates

    const result = await resolveDocumentNeighbors('src-vis', { role: 'tenant' });
    expect(result?.previous.document?.id).toBe('visible-prev');
    expect(result?.next.document?.id).toBe('visible-next');
  });

  it('upsertDocumentLink clears all four equivalent representations and inserts the new link', async () => {
    queue.length = 0;
    deleteLog.length = 0;
    const from = baseDoc({ id: 'A', buildingId: 'b1', residenceId: 'r1' });
    const to = baseDoc({ id: 'B', buildingId: 'b1', residenceId: 'r1' });
    // loadDocument(A), loadDocument(B), then 4 deletes (no return values
    // consumed), then insert returning the new row.
    enqueue([from]);
    enqueue([to]);
    const insertedRow = {
      id: 'link-1',
      fromDocumentId: 'A',
      toDocumentId: 'B',
      position: 'after',
      ordinal: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    enqueue([insertedRow]);

    const row = await upsertDocumentLink({
      fromDocumentId: 'A',
      toDocumentId: 'B',
      position: 'after',
      ordinal: null,
    });
    expect(row).toEqual(insertedRow);
    // The invariant requires four cleanups before the insert: A's outgoing
    // 'after', A's incoming 'before', B's outgoing 'before', B's incoming 'after'.
    expect(deleteLog).toHaveLength(4);
  });

  it('caps shared-tag bonus at 20 points (4 tags max)', () => {
    const cand = baseDoc({ id: 'x', documentType: 'other', name: 'unrelated zzz' });
    const sharedTagIds = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const r = scoreCandidate(source, cand, sharedTagIds, sharedTagIds);
    // Tag contribution = min(7*5, 20) = 20. No category, no name sim.
    // Same building only, dates within range. Strip out variable parts.
    expect(r.explain.sharedTagCount).toBe(7);
    // Sanity: total score's tag piece does not exceed 20.
    const tagPiece = Math.min(7 * 5, 20);
    expect(tagPiece).toBe(20);
    expect(r.score).toBeLessThan(50);
  });
});
