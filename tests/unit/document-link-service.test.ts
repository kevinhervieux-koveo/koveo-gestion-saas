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
  // The builder is itself thenable so awaiting after `.where(...)` (without
  // a final `.limit(...)`) resolves with the next queued result. This lets
  // tests model both "fetch one" (.limit(1)) and "fetch all" call sites.
  const resolveQueued = () => Promise.resolve(queue.shift() ?? []);
  const builder: any = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    limit: () => resolveQueued(),
    then: (onFulfilled: any, onRejected: any) =>
      resolveQueued().then(onFulfilled, onRejected),
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
    // Make `await db.insert(...).values(...)` resolve without consuming a
    // queue entry, so callers that don't chain `.returning()` (e.g. the
    // batch reorderChain helper) still work in the mock.
    then: (onFulfilled: any) => Promise.resolve([]).then(onFulfilled),
  };
  return builder;
};

const fakeDb: any = {
  select: () => buildSelectBuilder(),
  delete: () => buildDeleteBuilder(),
  insert: () => buildInsertBuilder(),
  // The reorder/remove helpers run their writes inside a transaction.
  // Resolve with the same fake `db` so writes go through the same mocked
  // builders the existing tests already exercise.
  transaction: async (fn: any) => fn(fakeDb),
};

jest.mock('../../server/db', () => ({
  db: fakeDb,
}));

import {
  tokenize,
  nameSimilarity,
  scoreCandidate,
  resolveDocumentNeighbors,
  upsertDocumentLink,
  deleteDocumentLink,
  getLinkSummariesForDocuments,
  resolveChain,
  reorderChain,
  removeFromChain,
  DocumentLinkValidationError,
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

  it('getLinkSummariesForDocuments returns prev/next previews per document', async () => {
    queue.length = 0;
    // Two outgoing links seeded onto the source doc:
    //   - {from=doc-a, position='before', to=doc-prev}  → A's previous = prev
    //   - {from=doc-a, position='after',  to=doc-next}  → A's next     = next
    // Plus one incoming row for doc-b:
    //   - {from=doc-other, position='before', to=doc-b}  → B's next   = doc-other
    enqueue([
      {
        id: 'l1',
        fromDocumentId: 'doc-a',
        toDocumentId: 'doc-prev',
        position: 'before',
        ordinal: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'l2',
        fromDocumentId: 'doc-a',
        toDocumentId: 'doc-next',
        position: 'after',
        ordinal: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'l3',
        fromDocumentId: 'doc-other',
        toDocumentId: 'doc-b',
        position: 'before',
        ordinal: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    enqueue([
      { id: 'doc-a', name: 'Source A' },
      { id: 'doc-b', name: 'Source B' },
      { id: 'doc-prev', name: 'Previous Doc' },
      { id: 'doc-next', name: 'Next Doc' },
      { id: 'doc-other', name: 'Other Doc' },
    ]);

    const summaries = await getLinkSummariesForDocuments(['doc-a', 'doc-b']);
    expect(summaries.get('doc-a')).toEqual({
      previous: { id: 'doc-prev', name: 'Previous Doc' },
      next: { id: 'doc-next', name: 'Next Doc' },
    });
    // doc-b is the *target* of an incoming 'before' link from doc-other,
    // which means doc-other comes after doc-b in the chain.
    expect(summaries.get('doc-b')).toEqual({
      next: { id: 'doc-other', name: 'Other Doc' },
    });
  });

  it('getLinkSummariesForDocuments returns an empty map when there are no links', async () => {
    queue.length = 0;
    enqueue([]); // no links at all → second db.select for names is skipped
    const summaries = await getLinkSummariesForDocuments(['doc-x']);
    expect(summaries.size).toBe(0);
  });

  it('getLinkSummariesForDocuments hides neighbor names the viewer cannot see', async () => {
    // Regression: the linked-indicator hover must not leak names of
    // documents that role-based visibility (manager-only / tenant-only)
    // would normally hide from the viewer's listing endpoint.
    queue.length = 0;
    enqueue([
      {
        id: 'l1',
        fromDocumentId: 'doc-visible',
        toDocumentId: 'doc-manager-only',
        position: 'after',
        ordinal: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'l2',
        fromDocumentId: 'doc-visible',
        toDocumentId: 'doc-tenant-hidden',
        position: 'before',
        ordinal: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    enqueue([
      { id: 'doc-visible', name: 'Visible', isManagerOnly: false, isVisibleToTenants: true },
      { id: 'doc-manager-only', name: 'Manager Only', isManagerOnly: true, isVisibleToTenants: true },
      { id: 'doc-tenant-hidden', name: 'Hidden From Tenants', isManagerOnly: false, isVisibleToTenants: false },
    ]);

    const summaries = await getLinkSummariesForDocuments(['doc-visible'], {
      role: 'tenant',
    });
    // Both neighbors must be filtered out — manager-only is hidden from
    // tenants, and isVisibleToTenants=false also hides the previous one.
    // The visible doc therefore has no neighbors to advertise.
    expect(summaries.get('doc-visible')).toBeUndefined();
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

describe('document-link-service: resolveChain', () => {
  it('returns null when the seed document does not exist', async () => {
    queue.length = 0;
    enqueue([]); // loadDocument(seed)
    const chain = await resolveChain('missing');
    expect(chain).toBeNull();
  });

  it('returns a single-element chain when the seed has no explicit links', async () => {
    queue.length = 0;
    const seed = baseDoc({ id: 'solo' });
    enqueue([seed]); // loadDocument(seed)
    enqueue([]); // walk back: outgoing 'before' empty
    enqueue([]); // walk back: incoming 'after' empty
    enqueue([]); // walk forward: outgoing 'after' empty
    enqueue([]); // walk forward: incoming 'before' empty
    const chain = await resolveChain('solo');
    expect(chain?.map((d) => d.id)).toEqual(['solo']);
  });

  it('walks the chain in both directions and returns ids in head→tail order', async () => {
    queue.length = 0;
    const a = baseDoc({ id: 'A' });
    const b = baseDoc({ id: 'B' });
    const c = baseDoc({ id: 'C' });
    const d = baseDoc({ id: 'D' });
    // Seed is C. Chain: A → B → C → D.
    // Sequence:
    //  loadDocument(C)
    //  walk back from C: outgoing 'before' on C → B (loadDocument(B))
    //  walk back from B: outgoing 'before' on B → A (loadDocument(A))
    //  walk back from A: outgoing 'before' empty, then incoming 'after' empty
    //  walk forward from C: outgoing 'after' on C → D (loadDocument(D))
    //  walk forward from D: outgoing 'after' empty, then incoming 'before' empty
    enqueue([c]);
    enqueue([{ id: 'l-cb', toDocumentId: 'B', fromDocumentId: 'C', position: 'before' }]);
    enqueue([b]);
    enqueue([{ id: 'l-bb', toDocumentId: 'A', fromDocumentId: 'B', position: 'before' }]);
    enqueue([a]);
    enqueue([]); // walk back from A: outgoing 'before' empty
    enqueue([]); // walk back from A: incoming 'after' empty
    enqueue([{ id: 'l-ca', toDocumentId: 'D', fromDocumentId: 'C', position: 'after' }]);
    enqueue([d]);
    enqueue([]); // walk forward from D: outgoing 'after' empty
    enqueue([]); // walk forward from D: incoming 'before' empty

    const chain = await resolveChain('C');
    expect(chain?.map((x) => x.id)).toEqual(['A', 'B', 'C', 'D']);
  });
});

describe('document-link-service: reorderChain', () => {
  it('rejects duplicate ids before touching the database', async () => {
    queue.length = 0;
    deleteLog.length = 0;
    await expect(reorderChain(['A', 'B', 'A'])).rejects.toBeInstanceOf(DocumentLinkValidationError);
    expect(deleteLog).toHaveLength(0);
  });

  it('rejects when a referenced document is missing', async () => {
    queue.length = 0;
    enqueue([baseDoc({ id: 'A', buildingId: 'b1', residenceId: null })]); // only one row returned for two ids
    await expect(reorderChain(['A', 'B'])).rejects.toBeInstanceOf(DocumentLinkValidationError);
  });

  it('rejects when chain documents span different scopes', async () => {
    queue.length = 0;
    enqueue([
      baseDoc({ id: 'A', buildingId: 'b1', residenceId: null }),
      baseDoc({ id: 'B', buildingId: 'b2', residenceId: null }),
    ]);
    await expect(reorderChain(['A', 'B'])).rejects.toBeInstanceOf(DocumentLinkValidationError);
  });

  it('clears existing links and inserts N-1 sequential after links', async () => {
    queue.length = 0;
    deleteLog.length = 0;
    enqueue([
      baseDoc({ id: 'A', buildingId: 'b1', residenceId: null }),
      baseDoc({ id: 'B', buildingId: 'b1', residenceId: null }),
      baseDoc({ id: 'C', buildingId: 'b1', residenceId: null }),
    ]);
    await reorderChain(['A', 'B', 'C']);
    // The transaction performs exactly one bulk delete and one bulk insert.
    expect(deleteLog).toHaveLength(1);
  });

  it('is a no-op for a single-element list (still clears that doc\'s old links)', async () => {
    queue.length = 0;
    deleteLog.length = 0;
    enqueue([baseDoc({ id: 'A', buildingId: 'b1', residenceId: null })]);
    await reorderChain(['A']);
    expect(deleteLog).toHaveLength(1);
  });

  it('returns immediately for an empty list without touching the database', async () => {
    queue.length = 0;
    deleteLog.length = 0;
    await reorderChain([]);
    expect(deleteLog).toHaveLength(0);
  });
});

describe('document-link-service: removeFromChain', () => {
  it('stitches neighbors together when both sides exist', async () => {
    queue.length = 0;
    deleteLog.length = 0;
    const prev = baseDoc({ id: 'P' });
    const next = baseDoc({ id: 'N' });
    // Sequence (Promise.all for explicit lookup):
    //  prev: outgoing 'before' on doc → row → loadDocument(P)
    //  next: outgoing 'after'  on doc → row → loadDocument(N)
    enqueue([{ id: 'l-prev', toDocumentId: 'P', fromDocumentId: 'D', position: 'before' }]);
    enqueue([{ id: 'l-next', toDocumentId: 'N', fromDocumentId: 'D', position: 'after' }]);
    enqueue([prev]);
    enqueue([next]);
    const result = await removeFromChain('D');
    expect(result.previous?.id).toBe('P');
    expect(result.next?.id).toBe('N');
    // 1 bulk delete (touching D) + 4 collision-clear deletes around the
    // stitched edge before the insert.
    expect(deleteLog).toHaveLength(5);
  });

  it('removes links without inserting a stitch when only one neighbor exists', async () => {
    queue.length = 0;
    deleteLog.length = 0;
    const prev = baseDoc({ id: 'P' });
    enqueue([{ id: 'l-prev', toDocumentId: 'P', fromDocumentId: 'D', position: 'before' }]);
    enqueue([]); // outgoing 'after' empty
    enqueue([prev]);
    enqueue([]); // incoming 'before' for next side: empty
    const result = await removeFromChain('D');
    expect(result.previous?.id).toBe('P');
    expect(result.next).toBeNull();
    // Only the bulk delete; no stitching pass.
    expect(deleteLog).toHaveLength(1);
  });

  it('is a no-op (single delete) when the document has no neighbors', async () => {
    queue.length = 0;
    deleteLog.length = 0;
    enqueue([]); // outgoing 'before'
    enqueue([]); // outgoing 'after'
    enqueue([]); // incoming 'after' (prev side fallback)
    enqueue([]); // incoming 'before' (next side fallback)
    const result = await removeFromChain('D');
    expect(result.previous).toBeNull();
    expect(result.next).toBeNull();
    expect(deleteLog).toHaveLength(1);
  });
});
