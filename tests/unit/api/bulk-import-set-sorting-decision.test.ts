/**
 * Task #825 — Server-side coverage for the sorting (branching) decision
 * accept / reject flow added in Task #817.
 *
 * The endpoint under test is
 *   POST /api/admin/bulk-import/items/:id/set-sorting-decision
 * implemented in `server/api/bulk-import.ts`. It is the single place
 * where the wizard turns the AI's keep/merge/split suggestion into a
 * committed decision and — for merge and split — physically rewrites
 * the staged PDF on disk. A regression here can silently corrupt
 * documents (drop pages, merge into the wrong sibling, etc.) so every
 * branch needs to be pinned by an automated test.
 *
 * The five paths verified below mirror the five action shapes the
 * wizard can produce:
 *   1. action=accept on a keep suggestion  → state flips to accepted,
 *      no file IO.
 *   2. action=reject                       → state flips to rejected,
 *      decision fields untouched, no file IO.
 *   3. action=manual + decision=keep       → manualOverride=true,
 *      decision stays keep, no file IO.
 *   4. action=accept on a merge suggestion → both PDFs are read, the
 *      sibling's pages are appended, the merged PDF is rewritten with
 *      a fresh content hash, the sibling row is excluded with a
 *      mergedIntoItemId back-pointer, the original row carries a
 *      mergedFromItemId forward-pointer, both end up accepted.
 *   5. action=accept on a split suggestion → original PDF is split at
 *      the AI's page; the original row keeps part 1; a brand-new
 *      sibling row is inserted with the second part, marked accepted,
 *      and tagged with splitFromItemId.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () => require('../../manual-mocks/drizzle-orm/pg-core'));

// ---------------------------------------------------------------------------
// In-memory item store, modelled after the bulk_import_items table. Every
// test seeds the rows it cares about; the mocked db implementation below
// reads/writes this Map so the endpoint sees a realistic round-trip.
// ---------------------------------------------------------------------------
type Item = Record<string, unknown> & { id: string };
const itemStore = new Map<string, Item>();
let insertedItems: Item[] = [];

function seed(id: string, overrides: Partial<Item> = {}): Item {
  const base: Item = {
    id,
    sessionId: 'sess-1',
    originalPath: `${id}.pdf`,
    originalName: `${id}.pdf`,
    stagedPath: `/staging/${id}.pdf`,
    contentHash: `hash-${id}`,
    mimeType: 'application/pdf',
    fileSize: 1024,
    status: 'sorted',
    preExcludeStatus: null,
    sortingDecision: null,
    ...overrides,
  };
  itemStore.set(id, base);
  return base;
}

// The drizzle-orm mock returns descriptor objects for `eq(col, val)`. The
// only `where()` we ever build in the endpoint is `eq(items.id, x)` so we
// can pull the id straight off the descriptor.
function whereId(cond: any): string | undefined {
  if (!cond) return undefined;
  if ('value' in cond) return cond.value;
  return undefined;
}

function makeWhereThenable(updated: Item | null) {
  // Some call-sites await `.where()` directly (sibling exclude on merge),
  // others chain `.returning()` after it (the primary update). Support both
  // by returning a Promise that *also* exposes a `.returning()` method.
  const p: any = Promise.resolve();
  p.returning = () => Promise.resolve(updated ? [updated] : []);
  return p;
}

// Track items deleted during draft revert.
let deletedItemIds: string[] = [];

const mockDb: any = {
  // `cols` is undefined for a plain `select()`, and an object for a
  // `select({ id, sortingDecision })` projection query (session lookup).
  select: jest.fn((cols?: unknown) => ({
    from: jest.fn(() => ({
      where: jest.fn((cond: any) => {
        const id = whereId(cond);
        // Session-query: `select({ id, sortingDecision }).from(...).where(eq(sessionId, x))`
        // returns all items in the store (they all belong to the same session).
        if (cols !== undefined) {
          return Promise.resolve([...itemStore.values()]);
        }
        // Item-ID lookup: `select().from(...).where(eq(items.id, x))`.
        const row = id ? itemStore.get(id) : undefined;
        return Promise.resolve(row ? [row] : []);
      }),
    })),
  })),
  update: jest.fn(() => ({
    set: jest.fn((updates: Partial<Item>) => ({
      where: jest.fn((cond: any) => {
        const id = whereId(cond);
        if (!id || !itemStore.has(id)) return makeWhereThenable(null);
        const merged: Item = { ...itemStore.get(id)!, ...updates } as Item;
        itemStore.set(id, merged);
        return makeWhereThenable(merged);
      }),
    })),
  })),
  insert: jest.fn(() => ({
    values: jest.fn((vals: any) => {
      const id = vals.id ?? `gen-${insertedItems.length + 1}`;
      const row: Item = { id, ...vals };
      itemStore.set(id, row);
      insertedItems.push(row);
      // Support both `.values()` (no chaining) and `.values().returning()`
      // (used in the draft split materialisation path).
      const p: any = Promise.resolve([row]);
      p.returning = () => Promise.resolve([row]);
      return p;
    }),
  })),
  delete: jest.fn(() => ({
    where: jest.fn((cond: any) => {
      const id = whereId(cond);
      if (id && itemStore.has(id)) {
        deletedItemIds.push(id);
        itemStore.delete(id);
      }
      return Promise.resolve();
    }),
  })),
};

jest.mock('../../../server/db', () => ({ db: mockDb }));

jest.mock('../../../server/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-1', role: 'admin' };
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../server/rbac', () => ({
  canUserAccessOrganization: jest.fn().mockResolvedValue(true),
}));

// The bulk-import router imports analyzer + rotation services at module
// load. They are not exercised by set-sorting-decision; stub the surface
// just enough for `import` to succeed.
jest.mock('../../../server/services/bulk-import-analyzer', () => ({
  bulkImportAnalyzer: {},
  isBulkImportAiAvailable: () => false,
  BRANCH_SUB_CATEGORIES: {
    legal_documents: [],
    financial_documents: [],
    maintenance_documents: [],
    meeting_documents: [],
    residence_documents: [],
    other_documents: [],
  },
}));

jest.mock('../../../server/services/bulk-import-rotation', () => ({
  rotateAndRewriteStagedFile: jest.fn(),
}));

jest.mock('../../../server/services/document-service', () => ({
  documentService: {},
}));

jest.mock('../../../server/utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
}));

// ---------------------------------------------------------------------------
// fs mock: stage files in a Map so the endpoint's existsSync /
// readFileSync / writeFileSync round-trip works without touching disk.
// The first byte of each Buffer encodes the page count so the pdf-lib
// stub below can return a doc with the right number of pages.
// ---------------------------------------------------------------------------
const stagedFiles = new Map<string, Buffer>();
function stagePdf(filePath: string, pageCount: number): void {
  const buf = Buffer.alloc(8);
  buf[0] = pageCount;
  stagedFiles.set(filePath, buf);
}

jest.mock('fs', () => {
  const actual = jest.requireActual('fs') as typeof import('fs');
  return {
    ...actual,
    existsSync: jest.fn((p: string) => stagedFiles.has(p) || actual.existsSync(p)),
    readFileSync: jest.fn((p: string, ...rest: any[]) => {
      if (stagedFiles.has(p)) return stagedFiles.get(p)!;
      return (actual.readFileSync as any)(p, ...rest);
    }),
    writeFileSync: jest.fn((p: string, data: any) => {
      stagedFiles.set(p, Buffer.isBuffer(data) ? data : Buffer.from(data));
    }),
    mkdirSync: jest.fn(),
    rmSync: jest.fn(),
  };
});

// ---------------------------------------------------------------------------
// pdf-lib stub: a minimal in-memory document whose `getPageCount()` is
// driven by the first byte of the loaded buffer. `save()` writes the
// resulting page count back into the first byte so the SHA-256 computed
// by the endpoint is stable and *different* for inputs of different
// sizes (catches "I forgot to actually merge the pages" bugs).
// ---------------------------------------------------------------------------
class MockDoc {
  pages: string[];
  constructor(pages: string[] = []) {
    this.pages = pages;
  }
  getPageCount(): number {
    return this.pages.length;
  }
  async copyPages(srcDoc: MockDoc, indices: number[]): Promise<string[]> {
    return indices.map((i) => srcDoc.pages[i]);
  }
  addPage(p: string): void {
    this.pages.push(p);
  }
  async save(): Promise<Uint8Array> {
    const out = new Uint8Array(8);
    out[0] = this.pages.length;
    return out;
  }
}

jest.mock('pdf-lib', () => ({
  PDFDocument: {
    load: jest.fn(async (bytes: Uint8Array) => {
      const count = bytes[0] || 0;
      return new MockDoc(Array.from({ length: count }, (_, i) => `p${i}`));
    }),
    create: jest.fn(async () => new MockDoc([])),
  },
}));

// ---------------------------------------------------------------------------
// Import the router under test (after every mock is registered).
// ---------------------------------------------------------------------------
import { registerBulkImportRoutes } from '../../../server/api/bulk-import';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  registerBulkImportRoutes(app);
  return app;
}

beforeEach(() => {
  itemStore.clear();
  stagedFiles.clear();
  insertedItems = [];
  deletedItemIds = [];
  jest.clearAllMocks();
});

const ROUTE = (id: string) =>
  `/api/admin/bulk-import/items/${id}/set-sorting-decision`;

describe('POST /api/admin/bulk-import/items/:id/set-sorting-decision (Task #817)', () => {
  // -----------------------------------------------------------------
  // 1. Accept on a keep suggestion — pure state flip, no file IO.
  // -----------------------------------------------------------------
  it('accept on a "keep" suggestion sets decisionState=accepted and writes no files', async () => {
    seed('it-keep', {
      sortingDecision: {
        decision: 'keep',
        reason: 'Standalone invoice',
        confidence: 0.92,
        decisionState: 'pending',
      },
    });
    stagePdf('/staging/it-keep.pdf', 3);

    const res = await request(buildApp())
      .post(ROUTE('it-keep'))
      .send({ action: 'accept' })
      .expect(200);

    expect(res.body.sortingDecision).toMatchObject({
      decision: 'keep',
      decisionState: 'accepted',
      reason: 'Standalone invoice',
      confidence: 0.92,
    });
    // No new sibling rows, no file rewrites, hash unchanged.
    expect(insertedItems).toHaveLength(0);
    expect(itemStore.get('it-keep')!.contentHash).toBe('hash-it-keep');
    expect(itemStore.get('it-keep')!.stagedPath).toBe('/staging/it-keep.pdf');
  });

  // -----------------------------------------------------------------
  // 2. Reject — flips state, AI suggestion is preserved untouched.
  // -----------------------------------------------------------------
  it('reject preserves the AI decision but flips decisionState to rejected', async () => {
    seed('it-rej', {
      sortingDecision: {
        decision: 'merge',
        mergeWithItemId: 'it-other',
        reason: 'Looks like part 2',
        confidence: 0.71,
        decisionState: 'pending',
      },
    });

    const res = await request(buildApp())
      .post(ROUTE('it-rej'))
      .send({ action: 'reject' })
      .expect(200);

    expect(res.body.sortingDecision).toMatchObject({
      decision: 'merge', // AI's suggestion is preserved verbatim …
      mergeWithItemId: 'it-other',
      reason: 'Looks like part 2',
      decisionState: 'rejected', // … only the gate state changes.
    });
    // No file ops at all.
    expect(insertedItems).toHaveLength(0);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------
  // 3. Manual override with decision=keep — flags manualOverride=true.
  // -----------------------------------------------------------------
  it('manual override with decision=keep records manualOverride and accepts the row', async () => {
    seed('it-manual', {
      sortingDecision: {
        decision: 'merge', // AI thought "merge" but admin is overriding.
        mergeWithItemId: 'it-friend',
        reason: 'AI guess',
        decisionState: 'rejected',
      },
    });

    const res = await request(buildApp())
      .post(ROUTE('it-manual'))
      .send({ action: 'manual', decision: 'keep' })
      .expect(200);

    expect(res.body.sortingDecision).toMatchObject({
      decision: 'keep',
      decisionState: 'accepted',
      manualOverride: true,
      mergeWithItemId: null,
      splitAtPage: null,
    });
    expect(insertedItems).toHaveLength(0);
  });

  // -----------------------------------------------------------------
  // 4. Accept on a merge suggestion — runs the real PDF merge logic.
  // -----------------------------------------------------------------
  it('accept on a "merge" suggestion appends the sibling, rewrites the staged PDF, and excludes the sibling', async () => {
    const original = seed('it-A', {
      stagedPath: '/staging/A.pdf',
      contentHash: 'hash-A',
      sortingDecision: {
        decision: 'merge',
        mergeWithItemId: 'it-B',
        reason: 'A and B form one document',
        confidence: 0.88,
        decisionState: 'pending',
      },
    });
    seed('it-B', {
      stagedPath: '/staging/B.pdf',
      contentHash: 'hash-B',
      status: 'sorted',
    });
    stagePdf('/staging/A.pdf', 2);
    stagePdf('/staging/B.pdf', 3);

    const res = await request(buildApp())
      .post(ROUTE('it-A'))
      .send({ action: 'accept' })
      .expect(200);

    // The original row keeps the same id but now has a fresh staged
    // path + content hash and a mergedFromItemId back-pointer.
    expect(res.body.id).toBe('it-A');
    expect(res.body.stagedPath).not.toBe(original.stagedPath);
    expect(res.body.stagedPath).toMatch(/merged_/);
    expect(res.body.contentHash).not.toBe('hash-A');
    expect(res.body.contentHash).toHaveLength(64); // sha256 hex
    expect(res.body.sortingDecision).toMatchObject({
      decision: 'merge',
      mergeWithItemId: 'it-B',
      mergedFromItemId: 'it-B',
      decisionState: 'accepted',
    });

    // Merged file is on disk and contains the combined page count
    // (2 + 3 = 5) — a regression that drops pages would surface as a
    // mismatched first byte here.
    const mergedBuf = stagedFiles.get(res.body.stagedPath as string)!;
    expect(mergedBuf).toBeDefined();
    expect(mergedBuf[0]).toBe(5);

    // Sibling is now excluded with a mergedIntoItemId forward-pointer
    // and the previous status is captured in preExcludeStatus so the
    // exclude can be undone later.
    const sibling = itemStore.get('it-B')!;
    expect(sibling.status).toBe('rejected');
    expect(sibling.preExcludeStatus).toBe('sorted');
    expect((sibling.sortingDecision as any).mergedIntoItemId).toBe('it-A');
    expect((sibling.sortingDecision as any).decisionState).toBe('accepted');
    expect((sibling.sortingDecision as any).decision).toBe('merge');
  });

  it('accept on a "merge" suggestion returns 400 when the merge target is missing', async () => {
    seed('it-A', {
      stagedPath: '/staging/A.pdf',
      sortingDecision: {
        decision: 'merge',
        mergeWithItemId: 'does-not-exist',
        decisionState: 'pending',
      },
    });
    stagePdf('/staging/A.pdf', 2);

    const res = await request(buildApp())
      .post(ROUTE('it-A'))
      .send({ action: 'accept' })
      .expect(400);

    expect(res.body.error).toMatch(/Merge target/);
    // Original row must NOT be flipped to accepted on the failure path.
    expect((itemStore.get('it-A')!.sortingDecision as any).decisionState)
      .toBe('pending');
  });

  // -----------------------------------------------------------------
  // 5. Accept on a split suggestion — runs the real PDF split logic.
  // -----------------------------------------------------------------
  it('accept on a "split" suggestion rewrites the original to part 1 and inserts a sibling for part 2', async () => {
    seed('it-S', {
      stagedPath: '/staging/S.pdf',
      contentHash: 'hash-S',
      sortingDecision: {
        decision: 'split',
        splitAtPage: 2,
        reason: 'Two distinct invoices in one PDF',
        confidence: 0.79,
        decisionState: 'pending',
      },
    });
    stagePdf('/staging/S.pdf', 5);

    const res = await request(buildApp())
      .post(ROUTE('it-S'))
      .send({ action: 'accept' })
      .expect(200);

    // The original row now points at the part-1 file (pages 1..splitAt).
    expect(res.body.id).toBe('it-S');
    expect(res.body.stagedPath).toMatch(/split1_/);
    expect(res.body.contentHash).not.toBe('hash-S');
    expect(res.body.contentHash).toHaveLength(64);
    expect(res.body.sortingDecision).toMatchObject({
      decision: 'split',
      decisionState: 'accepted',
      splitAtPage: 2,
      splitTotalPages: 5,
    });

    const part1 = stagedFiles.get(res.body.stagedPath as string)!;
    expect(part1[0]).toBe(2); // pages 1..2

    // Exactly one sibling row was inserted, carrying part 2.
    expect(insertedItems).toHaveLength(1);
    const sibling = insertedItems[0];
    expect(sibling.sessionId).toBe('sess-1');
    expect(sibling.status).toBe('sorted');
    expect(sibling.stagedPath).toMatch(/split2_/);
    expect(sibling.mimeType).toBe('application/pdf');
    expect((sibling.sortingDecision as any)).toMatchObject({
      decision: 'keep',
      decisionState: 'accepted',
      splitFromItemId: 'it-S',
      splitAtPage: 2,
      manualOverride: false,
    });

    const part2 = stagedFiles.get(sibling.stagedPath as string)!;
    expect(part2[0]).toBe(3); // pages 3..5

    // No pages were lost: part1 + part2 == original page count.
    expect(part1[0] + part2[0]).toBe(5);
  });

  // -----------------------------------------------------------------
  // 6. N-way ordered merge — three PDFs merged in given order (Task #856).
  // -----------------------------------------------------------------
  it('manual merge with mergeWithItemIds concatenates 3 PDFs in order and excludes both siblings', async () => {
    seed('it-lead', {
      stagedPath: '/staging/lead.pdf',
      contentHash: 'hash-lead',
      sortingDecision: {
        decision: 'keep',
        decisionState: 'pending',
      },
    });
    seed('it-sib1', {
      stagedPath: '/staging/sib1.pdf',
      contentHash: 'hash-sib1',
      status: 'sorted',
    });
    seed('it-sib2', {
      stagedPath: '/staging/sib2.pdf',
      contentHash: 'hash-sib2',
      status: 'sorted',
    });
    stagePdf('/staging/lead.pdf', 2);
    stagePdf('/staging/sib1.pdf', 3);
    stagePdf('/staging/sib2.pdf', 1);

    const res = await request(buildApp())
      .post(ROUTE('it-lead'))
      .send({ action: 'manual', decision: 'merge', mergeWithItemIds: ['it-sib1', 'it-sib2'] })
      .expect(200);

    // Lead item gets a new merged path and updated hash.
    expect(res.body.id).toBe('it-lead');
    expect(res.body.stagedPath).toMatch(/merged_/);
    expect(res.body.contentHash).not.toBe('hash-lead');
    expect(res.body.contentHash).toHaveLength(64);
    expect(res.body.sortingDecision).toMatchObject({
      decision: 'merge',
      decisionState: 'accepted',
      manualOverride: true,
      mergeWithItemIds: ['it-sib1', 'it-sib2'],
    });

    // Combined page count = 2 + 3 + 1 = 6.
    const mergedBuf = stagedFiles.get(res.body.stagedPath as string)!;
    expect(mergedBuf).toBeDefined();
    expect(mergedBuf[0]).toBe(6);

    // Both siblings must be excluded with mergedIntoItemId back-pointer.
    const sib1 = itemStore.get('it-sib1')!;
    expect(sib1.status).toBe('rejected');
    expect((sib1.sortingDecision as any).mergedIntoItemId).toBe('it-lead');
    expect((sib1.sortingDecision as any).decisionState).toBe('accepted');

    const sib2 = itemStore.get('it-sib2')!;
    expect(sib2.status).toBe('rejected');
    expect((sib2.sortingDecision as any).mergedIntoItemId).toBe('it-lead');
    expect((sib2.sortingDecision as any).decisionState).toBe('accepted');

    // No extra inserted rows — all 3 items were pre-existing.
    expect(insertedItems).toHaveLength(0);
  });

  it('N-way merge returns 400 when one sibling ID does not exist', async () => {
    seed('it-merge-lead', {
      stagedPath: '/staging/ml.pdf',
      sortingDecision: { decision: 'merge', decisionState: 'pending' },
    });
    seed('it-merge-ok', { stagedPath: '/staging/mok.pdf', status: 'sorted' });
    stagePdf('/staging/ml.pdf', 2);
    stagePdf('/staging/mok.pdf', 2);

    const res = await request(buildApp())
      .post(ROUTE('it-merge-lead'))
      .send({ action: 'manual', decision: 'merge', mergeWithItemIds: ['it-merge-ok', 'does-not-exist'] })
      .expect(400);

    expect(res.body.error).toMatch(/Merge target item not found/);
  });

  // -----------------------------------------------------------------
  // Validation — Zod rejects unknown actions.
  // -----------------------------------------------------------------
  it('rejects an unknown action with HTTP 400', async () => {
    seed('it-bad', { sortingDecision: { decision: 'keep', decisionState: 'pending' } });
    await request(buildApp())
      .post(ROUTE('it-bad'))
      .send({ action: 'maybe' })
      .expect(400);
  });

  it('returns 404 when the item id does not exist', async () => {
    await request(buildApp())
      .post(ROUTE('nope'))
      .send({ action: 'accept' })
      .expect(404);
  });

  // -----------------------------------------------------------------
  // 7. DRAFT MODE — auto-save without finalising the decision (Task #860).
  // -----------------------------------------------------------------

  it('draft split materialises two part items and marks lead as rejected', async () => {
    seed('dr-lead', {
      stagedPath: '/staging/dr-lead.pdf',
      contentHash: 'hash-dr-lead',
      sortingDecision: {
        decision: 'keep',
        decisionState: 'pending',
      },
    });
    stagePdf('/staging/dr-lead.pdf', 4);

    const res = await request(buildApp())
      .post(ROUTE('dr-lead'))
      .send({ action: 'manual', draft: true, decision: 'split', splitAtPage: 2 })
      .expect(200);

    // Lead: decision recorded as draft split; status set to 'rejected' so split
    // parts take precedence in the sorting step list.
    expect(res.body.item.sortingDecision.decision).toBe('split');
    expect(res.body.item.sortingDecision.draft).toBe(true);
    expect(res.body.item.sortingDecision.decisionState).not.toBe('accepted');
    expect(itemStore.get('dr-lead')!.status).toBe('rejected');

    // Two part items must be inserted.
    expect(insertedItems).toHaveLength(2);
    const [part1, part2] = insertedItems;
    expect(part1.status).toBe('sorted');
    expect(part2.status).toBe('sorted');

    // Lead's splitIntoItemIds must reference both parts.
    const leadDec = (itemStore.get('dr-lead')!.sortingDecision ?? {}) as Record<string, unknown>;
    const splitIds = leadDec.splitIntoItemIds as string[];
    expect(splitIds).toHaveLength(2);
    expect(splitIds).toContain(part1.id);
    expect(splitIds).toContain(part2.id);

    // Part files must be written to disk (stagedFiles).
    expect(stagedFiles.has(part1.stagedPath as string)).toBe(true);
    expect(stagedFiles.has(part2.stagedPath as string)).toBe(true);
  });

  it('draft split with splitFinalNames persists the name overrides on part items', async () => {
    seed('dr-named', {
      stagedPath: '/staging/dr-named.pdf',
      contentHash: 'hash-dr-named',
      originalName: 'contract.pdf',
      sortingDecision: {
        decision: 'keep',
        decisionState: 'pending',
      },
    });
    stagePdf('/staging/dr-named.pdf', 3);

    await request(buildApp())
      .post(ROUTE('dr-named'))
      .send({
        action: 'manual',
        draft: true,
        decision: 'split',
        splitAtPage: 1,
        splitFinalNames: ['Part A', 'Part B'],
      })
      .expect(200);

    const leadDec = (itemStore.get('dr-named')!.sortingDecision ?? {}) as Record<string, unknown>;
    expect(leadDec.splitFinalNames).toEqual(['Part A', 'Part B']);

    // The part items should carry finalFileName derived from splitFinalNames.
    const [part1, part2] = insertedItems;
    expect(part1.finalFileName).toBe('Part A');
    expect(part2.finalFileName).toBe('Part B');

    // originalName must put the extension at the end ("stem (N).ext"), so the
    // commit path produces "Part A.pdf" not "Part A.pdf (1)".
    expect(part1.originalName).toBe('contract (1).pdf');
    expect(part2.originalName).toBe('contract (2).pdf');

    // splitFromOriginalName in the decision blob must match the source original,
    // giving the commit path a clean extension source for any row format.
    const p1Dec = (part1.sortingDecision ?? {}) as Record<string, unknown>;
    const p2Dec = (part2.sortingDecision ?? {}) as Record<string, unknown>;
    expect(p1Dec.splitFromOriginalName).toBe('contract.pdf');
    expect(p2Dec.splitFromOriginalName).toBe('contract.pdf');
  });

  it('draft keep stores finalFileName without creating part items', async () => {
    seed('dr-keep', {
      stagedPath: '/staging/dr-keep.pdf',
      contentHash: 'hash-dr-keep',
      sortingDecision: {
        decision: 'keep',
        decisionState: 'pending',
      },
    });

    const res = await request(buildApp())
      .post(ROUTE('dr-keep'))
      .send({ action: 'manual', draft: true, decision: 'keep', finalFileName: 'My Renamed Doc' })
      .expect(200);

    expect(res.body.item.finalFileName).toBe('My Renamed Doc');
    expect(itemStore.get('dr-keep')!.finalFileName).toBe('My Renamed Doc');
    expect(insertedItems).toHaveLength(0);
  });

  it('reverting split draft (draft keep) deletes both part items', async () => {
    // First request: draft split → creates 2 part items.
    seed('dr-rev', {
      stagedPath: '/staging/dr-rev.pdf',
      contentHash: 'hash-dr-rev',
      sortingDecision: {
        decision: 'keep',
        decisionState: 'pending',
      },
    });
    stagePdf('/staging/dr-rev.pdf', 4);

    await request(buildApp())
      .post(ROUTE('dr-rev'))
      .send({ action: 'manual', draft: true, decision: 'split', splitAtPage: 2 })
      .expect(200);

    expect(insertedItems).toHaveLength(2);
    const [p1, p2] = insertedItems;
    expect(itemStore.has(p1.id)).toBe(true);
    expect(itemStore.has(p2.id)).toBe(true);

    // Second request: draft keep → reverts the split.
    await request(buildApp())
      .post(ROUTE('dr-rev'))
      .send({ action: 'manual', draft: true, decision: 'keep' })
      .expect(200);

    // Part items must be deleted from the store.
    expect(itemStore.has(p1.id)).toBe(false);
    expect(itemStore.has(p2.id)).toBe(false);
    expect(deletedItemIds).toContain(p1.id);
    expect(deletedItemIds).toContain(p2.id);

    // Lead's splitIntoItemIds must be cleared and status restored to 'sorted'.
    const leadDec = (itemStore.get('dr-rev')!.sortingDecision ?? {}) as Record<string, unknown>;
    expect(leadDec.splitIntoItemIds).toBeUndefined();
    expect(itemStore.get('dr-rev')!.status).toBe('sorted');
  });

  it('draft split rejects a request missing splitAtPage with HTTP 400', async () => {
    seed('dr-nopage', {
      stagedPath: '/staging/dr-nopage.pdf',
      contentHash: 'hash-dr-nopage',
      sortingDecision: { decision: 'keep', decisionState: 'pending' },
    });
    stagePdf('/staging/dr-nopage.pdf', 3);

    const res = await request(buildApp())
      .post(ROUTE('dr-nopage'))
      .send({ action: 'manual', draft: true, decision: 'split' })
      .expect(400);

    expect(res.body.error).toMatch(/splitAtPage is required/);
  });

  // -----------------------------------------------------------------
  // 8. Explicit error classification — Task #924
  // -----------------------------------------------------------------

  it('returns 400 when lead PDF is corrupt and pdf-lib load throws', async () => {
    seed('it-corrupt-lead', {
      stagedPath: '/staging/corrupt-lead.pdf',
      contentHash: 'hash-corrupt-lead',
      sortingDecision: {
        decision: 'merge',
        mergeWithItemId: 'it-sib-ok',
        mergeWithItemIds: ['it-sib-ok'],
        decisionState: 'pending',
      },
    });
    seed('it-sib-ok', { stagedPath: '/staging/sib-ok.pdf', status: 'sorted' });
    stagePdf('/staging/corrupt-lead.pdf', 2);
    stagePdf('/staging/sib-ok.pdf', 3);

    // Make PDFDocument.load throw on the first call (the lead PDF).
    const pdfLib = require('pdf-lib');
    (pdfLib.PDFDocument.load as jest.Mock).mockRejectedValueOnce(new Error('Invalid PDF structure'));

    const res = await request(buildApp())
      .post(ROUTE('it-corrupt-lead'))
      .send({ action: 'accept' })
      .expect(400);

    expect(res.body.error).toMatch(/Failed to load lead PDF/);
    // Lead row must NOT be mutated to accepted.
    expect((itemStore.get('it-corrupt-lead')!.sortingDecision as any).decisionState).toBe('pending');
  });

  it('returns 400 when a sibling PDF is corrupt and pdf-lib load throws', async () => {
    seed('it-lead-ok', {
      stagedPath: '/staging/lead-ok.pdf',
      contentHash: 'hash-lead-ok',
      sortingDecision: {
        decision: 'merge',
        mergeWithItemId: 'it-corrupt-sib',
        mergeWithItemIds: ['it-corrupt-sib'],
        decisionState: 'pending',
      },
    });
    seed('it-corrupt-sib', {
      stagedPath: '/staging/corrupt-sib.pdf',
      contentHash: 'hash-corrupt-sib',
      originalName: 'états financiers 30 septembre 2023.pdf',
      status: 'sorted',
    });
    stagePdf('/staging/lead-ok.pdf', 2);
    stagePdf('/staging/corrupt-sib.pdf', 3);

    // First load (lead) succeeds, second load (sibling) throws.
    // Use a counter-based implementation to avoid re-entering the mock.
    const pdfLib = require('pdf-lib');
    const previousImpl = (pdfLib.PDFDocument.load as jest.Mock).getMockImplementation();
    let pdfLoadCalls = 0;
    (pdfLib.PDFDocument.load as jest.Mock).mockImplementation(async (bytes: Uint8Array) => {
      pdfLoadCalls++;
      if (pdfLoadCalls >= 2) throw new Error('Invalid PDF structure');
      // Replicate the MockDoc shape for the first call.
      const count = bytes[0] || 0;
      const pages = Array.from({ length: count }, (_, i) => `p${i}`);
      return {
        getPageCount: () => pages.length,
        copyPages: async (_src: any, indices: number[]) => indices.map((i) => `p${i}`),
        addPage: (p: string) => pages.push(p),
        save: async () => { const out = new Uint8Array(8); out[0] = pages.length; return out; },
      };
    });

    try {
      const res = await request(buildApp())
        .post(ROUTE('it-lead-ok'))
        .send({ action: 'accept' })
        .expect(400);

      expect(res.body.error).toMatch(/merge target|Failed to (load|copy)/i);
      expect(res.body.error).toMatch(/états financiers/);
      // Lead must remain unchanged.
      expect((itemStore.get('it-lead-ok')!.sortingDecision as any).decisionState).toBe('pending');
    } finally {
      // Restore the original mock implementation for subsequent tests.
      if (previousImpl) {
        (pdfLib.PDFDocument.load as jest.Mock).mockImplementation(previousImpl);
      }
    }
  });

  it('returns 400 when merge target is already merged into another lead', async () => {
    seed('it-lead-b', {
      stagedPath: '/staging/lead-b.pdf',
      contentHash: 'hash-lead-b',
      sortingDecision: {
        decision: 'merge',
        mergeWithItemId: 'it-already-merged',
        mergeWithItemIds: ['it-already-merged'],
        decisionState: 'pending',
      },
    });
    // This sibling was already merged into a different lead (it-other-lead).
    seed('it-already-merged', {
      stagedPath: '/staging/already-merged.pdf',
      status: 'rejected',
      sortingDecision: {
        decision: 'merge',
        decisionState: 'accepted',
        mergedIntoItemId: 'it-other-lead',
      },
    });
    stagePdf('/staging/lead-b.pdf', 2);
    stagePdf('/staging/already-merged.pdf', 3);

    const res = await request(buildApp())
      .post(ROUTE('it-lead-b'))
      .send({ action: 'accept' })
      .expect(400);

    expect(res.body.error).toMatch(/already been merged into another document/);
    expect((itemStore.get('it-lead-b')!.sortingDecision as any).decisionState).toBe('pending');
  });

  it('returns 400 (MERGE_TARGET_WRONG_SESSION) when merge target belongs to a different session', async () => {
    seed('it-lead-sess', {
      stagedPath: '/staging/lead-sess.pdf',
      contentHash: 'hash-lead-sess',
      sortingDecision: {
        decision: 'merge',
        mergeWithItemId: 'it-sib-other-sess',
        mergeWithItemIds: ['it-sib-other-sess'],
        decisionState: 'pending',
      },
    });
    // Sibling belongs to a different session.
    seed('it-sib-other-sess', {
      stagedPath: '/staging/sib-other-sess.pdf',
      sessionId: 'different-session-id',
      status: 'sorted',
    });
    stagePdf('/staging/lead-sess.pdf', 2);
    stagePdf('/staging/sib-other-sess.pdf', 2);

    const res = await request(buildApp())
      .post(ROUTE('it-lead-sess'))
      .send({ action: 'accept' })
      .expect(400);

    expect(res.body.error).toMatch(/Merge target belongs to a different session/);
    expect(res.body.code).toBe('MERGE_TARGET_WRONG_SESSION');
  });

  it('returns 400 (MERGE_TARGET_NOT_PDF) when merge target is not a PDF', async () => {
    seed('it-lead-notpdf', {
      stagedPath: '/staging/lead-notpdf.pdf',
      contentHash: 'hash-lead-notpdf',
      sortingDecision: {
        decision: 'merge',
        mergeWithItemId: 'it-sib-docx',
        mergeWithItemIds: ['it-sib-docx'],
        decisionState: 'pending',
      },
    });
    seed('it-sib-docx', {
      stagedPath: '/staging/sib-docx.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      status: 'sorted',
    });
    stagePdf('/staging/lead-notpdf.pdf', 2);
    // The staged file isn't a real PDF but existsSync just checks presence.
    stagedFiles.set('/staging/sib-docx.docx', Buffer.alloc(4));

    const res = await request(buildApp())
      .post(ROUTE('it-lead-notpdf'))
      .send({ action: 'accept' })
      .expect(400);

    expect(res.body.error).toMatch(/Can only merge PDF files together/);
    expect(res.body.code).toBe('MERGE_TARGET_NOT_PDF');
  });

  it('returns 400 (SPLIT_OPERATION_FAILED) when slicePdf throws during a non-draft split', async () => {
    seed('it-split-fail', {
      stagedPath: '/staging/split-fail.pdf',
      contentHash: 'hash-split-fail',
      sortingDecision: {
        decision: 'split',
        splitAtPage: 2,
        decisionState: 'pending',
      },
    });
    stagePdf('/staging/split-fail.pdf', 4);

    // Make PDFDocument.load throw (slicePdf uses it internally).
    const pdfLib = require('pdf-lib');
    (pdfLib.PDFDocument.load as jest.Mock).mockRejectedValueOnce(new Error('split PDF corrupt'));

    const res = await request(buildApp())
      .post(ROUTE('it-split-fail'))
      .send({ action: 'accept' })
      .expect(400);

    expect(res.body.error).toMatch(/Failed to split PDF/);
    expect(res.body.code).toBe('SPLIT_OPERATION_FAILED');
  });

  it('returns 400 when disk write fails during merge', async () => {
    seed('it-lead-diskfail', {
      stagedPath: '/staging/diskfail-lead.pdf',
      contentHash: 'hash-diskfail-lead',
      sortingDecision: {
        decision: 'merge',
        mergeWithItemId: 'it-diskfail-sib',
        mergeWithItemIds: ['it-diskfail-sib'],
        decisionState: 'pending',
      },
    });
    seed('it-diskfail-sib', { stagedPath: '/staging/diskfail-sib.pdf', status: 'sorted' });
    stagePdf('/staging/diskfail-lead.pdf', 2);
    stagePdf('/staging/diskfail-sib.pdf', 3);

    // Make writeFileSync throw only for the merged-output write.
    const fsModule = require('fs');
    (fsModule.writeFileSync as jest.Mock).mockImplementationOnce((p: string) => {
      if ((p as string).includes('merged_')) throw new Error('ENOSPC: no space left on device');
      // fall through for other writes
      stagedFiles.set(p, Buffer.alloc(1));
    });

    const res = await request(buildApp())
      .post(ROUTE('it-lead-diskfail'))
      .send({ action: 'accept' })
      .expect(400);

    expect(res.body.error).toMatch(/Failed to write merged PDF/);
  });

  // -----------------------------------------------------------------
  // 9. New classified merge errors — Task #957
  // -----------------------------------------------------------------

  it('returns 400 (MERGE_PDF_COPY_FAILED) when copyPages throws during merge', async () => {
    seed('it-copy-fail-lead', {
      stagedPath: '/staging/copy-fail-lead.pdf',
      contentHash: 'hash-copy-fail-lead',
      sortingDecision: {
        decision: 'merge',
        mergeWithItemId: 'it-copy-fail-sib',
        mergeWithItemIds: ['it-copy-fail-sib'],
        decisionState: 'pending',
      },
    });
    seed('it-copy-fail-sib', {
      stagedPath: '/staging/copy-fail-sib.pdf',
      originalName: 'ordre du jour réunion 28 octobre 2023.pdf',
      status: 'sorted',
    });
    stagePdf('/staging/copy-fail-lead.pdf', 2);
    stagePdf('/staging/copy-fail-sib.pdf', 3);

    // Make copyPages throw to simulate a pdf-lib internal error on this PDF pair.
    const pdfLib = require('pdf-lib');
    const prevImpl = (pdfLib.PDFDocument.load as jest.Mock).getMockImplementation();
    let loadCalls = 0;
    (pdfLib.PDFDocument.load as jest.Mock).mockImplementation(async (bytes: Uint8Array) => {
      loadCalls++;
      const count = bytes[0] || 0;
      const pages = Array.from({ length: count }, (_, i) => `p${i}`);
      return {
        getPageCount: () => pages.length,
        copyPages: async () => { throw new Error('Unsupported font encoding'); },
        addPage: (p: string) => pages.push(p),
        save: async () => { const out = new Uint8Array(8); out[0] = pages.length; return out; },
      };
    });

    try {
      const res = await request(buildApp())
        .post(ROUTE('it-copy-fail-lead'))
        .send({ action: 'accept' })
        .expect(400);

      expect(res.body.code).toBe('MERGE_PDF_COPY_FAILED');
      expect(res.body.error).toMatch(/Failed to copy pages/);
      // Lead row must remain un-accepted.
      expect((itemStore.get('it-copy-fail-lead')!.sortingDecision as any).decisionState).toBe('pending');
    } finally {
      if (prevImpl) (pdfLib.PDFDocument.load as jest.Mock).mockImplementation(prevImpl);
    }
  });

  it('returns 400 (MERGE_PDF_SAVE_FAILED) when leadPdf.save throws during merge', async () => {
    seed('it-save-fail-lead', {
      stagedPath: '/staging/save-fail-lead.pdf',
      contentHash: 'hash-save-fail-lead',
      sortingDecision: {
        decision: 'merge',
        mergeWithItemId: 'it-save-fail-sib',
        mergeWithItemIds: ['it-save-fail-sib'],
        decisionState: 'pending',
      },
    });
    seed('it-save-fail-sib', {
      stagedPath: '/staging/save-fail-sib.pdf',
      originalName: 'Procès verbal octobre 2023.pdf',
      status: 'sorted',
    });
    stagePdf('/staging/save-fail-lead.pdf', 2);
    stagePdf('/staging/save-fail-sib.pdf', 1);

    const pdfLib = require('pdf-lib');
    const prevImpl = (pdfLib.PDFDocument.load as jest.Mock).getMockImplementation();
    (pdfLib.PDFDocument.load as jest.Mock).mockImplementation(async (bytes: Uint8Array) => {
      const count = bytes[0] || 0;
      const pages = Array.from({ length: count }, (_, i) => `p${i}`);
      return {
        getPageCount: () => pages.length,
        copyPages: async (_src: any, indices: number[]) => indices.map((i) => `p${i}`),
        addPage: (p: string) => pages.push(p),
        save: async () => { throw new Error('Out of memory during PDF serialisation'); },
      };
    });

    try {
      const res = await request(buildApp())
        .post(ROUTE('it-save-fail-lead'))
        .send({ action: 'accept' })
        .expect(400);

      expect(res.body.code).toBe('MERGE_PDF_SAVE_FAILED');
      expect(res.body.error).toMatch(/Failed to serialise merged PDF/);
      expect((itemStore.get('it-save-fail-lead')!.sortingDecision as any).decisionState).toBe('pending');
    } finally {
      if (prevImpl) (pdfLib.PDFDocument.load as jest.Mock).mockImplementation(prevImpl);
    }
  });

  it('returns 400 (MERGE_DB_UPDATE_FAILED) when the lead db.update throws after merge', async () => {
    seed('it-dbu-lead', {
      stagedPath: '/staging/dbu-lead.pdf',
      contentHash: 'hash-dbu-lead',
      sortingDecision: {
        decision: 'merge',
        mergeWithItemId: 'it-dbu-sib',
        mergeWithItemIds: ['it-dbu-sib'],
        decisionState: 'pending',
      },
    });
    seed('it-dbu-sib', { stagedPath: '/staging/dbu-sib.pdf', status: 'sorted' });
    stagePdf('/staging/dbu-lead.pdf', 2);
    stagePdf('/staging/dbu-sib.pdf', 3);

    // First db.update call (the lead row update) throws.
    let updateCalls = 0;
    const prevUpdateImpl = (mockDb.update as jest.Mock).getMockImplementation()!;
    (mockDb.update as jest.Mock).mockImplementation(() => {
      updateCalls++;
      if (updateCalls === 1) throw new Error('DB constraint violation');
      return prevUpdateImpl();
    });

    try {
      const res = await request(buildApp())
        .post(ROUTE('it-dbu-lead'))
        .send({ action: 'accept' })
        .expect(400);

      expect(res.body.code).toBe('MERGE_DB_UPDATE_FAILED');
      expect(res.body.error).toMatch(/Failed to update lead item record/);
    } finally {
      (mockDb.update as jest.Mock).mockImplementation(prevUpdateImpl);
    }
  });

  it('improved 500 response body contains error and code when an unexpected error escapes', async () => {
    // Force an unexpected error by making the db.update throw after item load.
    seed('it-keep-throw', {
      sortingDecision: { decision: 'keep', decisionState: 'pending' },
    });
    (mockDb.update as jest.Mock).mockImplementationOnce(() => {
      throw new Error('DB connection dropped');
    });

    const res = await request(buildApp())
      .post(ROUTE('it-keep-throw'))
      .send({ action: 'accept' })
      .expect(500);

    expect(res.body.error).toMatch(/Internal error/);
    expect(res.body.code).toBe('SORTING_DECISION_INTERNAL_ERROR');
    expect(res.body.message).toMatch(/Internal error/);
  });

  // -----------------------------------------------------------------
  // 10. NoCentris PDF recovery — Task #1014
  //
  // PDFs exported by the NoCentris Quebec real-estate system load
  // successfully under pdf-lib's lenient parser, but getPageCount()
  // throws "Expected instance of PDFDict, but got instance of undefined"
  // on the first walk of the page tree.  The loadPdfForBulkImport helper
  // must recover via a re-encode pass (save → reload) before the merge
  // is allowed to proceed.  If both attempts fail the endpoint must
  // still return a classified 400, never a 500.
  // -----------------------------------------------------------------

  it('NoCentris-style merge: succeeds when sibling getPageCount throws on first load but recovers after re-encode', async () => {
    // Lead has 2 pages (healthy), sibling has 3 pages (NoCentris-style broken page tree).
    // The sibling's getPageCount throws on the initial load but succeeds after the
    // re-encode pass (save → reload), as happens with recoverable NoCentris PDFs.
    seed('it-nc-lead', {
      stagedPath: '/staging/nc-lead.pdf',
      contentHash: 'hash-nc-lead',
      sortingDecision: {
        decision: 'merge',
        mergeWithItemId: 'it-nc-sib',
        mergeWithItemIds: ['it-nc-sib'],
        decisionState: 'pending',
      },
    });
    seed('it-nc-sib', {
      stagedPath: '/staging/nc-sib.pdf',
      originalName: 'Etats_financiers_2023_preliminaire_15_NoCentris_28525705.pdf',
      contentHash: 'hash-nc-sib',
      status: 'sorted',
    });
    stagePdf('/staging/nc-lead.pdf', 2);
    stagePdf('/staging/nc-sib.pdf', 3);

    const pdfLib = require('pdf-lib');
    const prevImpl = (pdfLib.PDFDocument.load as jest.Mock).getMockImplementation();

    // The NoCentris pattern: load() succeeds but getPageCount() throws on the
    // ORIGINAL bytes.  The recovery pass calls doc.save() then reloads: the
    // saved bytes carry a marker in byte-index 1 (0x01) so we can tell them
    // apart from the original file bytes (byte-index 1 = 0x00).  When the
    // re-encoded doc is loaded, getPageCount() succeeds → merge can proceed.
    let loadCallCount = 0;
    (pdfLib.PDFDocument.load as jest.Mock).mockImplementation(async (bytes: Uint8Array) => {
      loadCallCount++;
      const count = bytes[0] || 0;
      const pages = Array.from({ length: count }, (_, i) => `p${i}`);
      const isSib = count === 3;
      const isReencoded = bytes[1] === 0x01;
      return {
        getPageCount: () => {
          // Sib on original bytes: broken page tree → throw.
          // Sib on re-encoded bytes (or lead): healthy → return count.
          if (isSib && !isReencoded) {
            throw new Error('Expected instance of PDFDict, but got instance of undefined');
          }
          return pages.length;
        },
        copyPages: async (_src: any, indices: number[]) => indices.map((i) => `p${i}`),
        addPage: (p: string) => pages.push(p),
        // save() produces re-encoded bytes with marker at index 1.
        save: async () => { const out = new Uint8Array(8); out[0] = pages.length; out[1] = 0x01; return out; },
      };
    });

    try {
      const res = await request(buildApp())
        .post(ROUTE('it-nc-lead'))
        .send({ action: 'accept' })
        .expect(200);

      // Merge succeeded despite the broken page-tree on first sib load.
      expect(res.body.id).toBe('it-nc-lead');
      expect(res.body.stagedPath).toMatch(/merged_/);
      expect(res.body.contentHash).toHaveLength(64);
      expect(res.body.sortingDecision).toMatchObject({
        decision: 'merge',
        decisionState: 'accepted',
        mergedFromItemId: 'it-nc-sib',
      });

      // Sibling is excluded with back-pointer.
      const sibling = itemStore.get('it-nc-sib')!;
      expect(sibling.status).toBe('rejected');
      expect((sibling.sortingDecision as any).mergedIntoItemId).toBe('it-nc-lead');

      // 3 load() calls: lead (1) + sib initial broken (1) + sib re-encoded (1).
      expect(loadCallCount).toBe(3);
    } finally {
      if (prevImpl) (pdfLib.PDFDocument.load as jest.Mock).mockImplementation(prevImpl);
    }
  });

  // -----------------------------------------------------------------
  // 10c. NoCentris-style: stage-2 recovery — copyPages fails on first
  // call (getPageCount passes) but succeeds after sibling re-encode.
  //
  // This covers the second NoCentris failure mode: the page-tree object
  // graph is corrupt in a way that only surfaces during cross-document
  // reference resolution inside copyPages(), not during the simpler
  // getPageCount() walk.  copyPagesFromFileWithRecovery re-encodes the
  // sibling (raw → save → reload) and retries; the re-encoded doc has
  // a clean object graph so copyPages succeeds and the merge goes through.
  // -----------------------------------------------------------------
  it('NoCentris-style merge: succeeds when copyPages fails on first call but recovers after sibling re-encode (stage-2 recovery)', async () => {
    seed('it-nc2-lead', {
      stagedPath: '/staging/nc2-lead.pdf',
      contentHash: 'hash-nc2-lead',
      sortingDecision: {
        decision: 'merge',
        mergeWithItemId: 'it-nc2-sib',
        mergeWithItemIds: ['it-nc2-sib'],
        decisionState: 'pending',
      },
    });
    seed('it-nc2-sib', {
      stagedPath: '/staging/nc2-sib.pdf',
      originalName: 'Etats_financiers_2024_NoCentris_stage2_corrupt.pdf',
      contentHash: 'hash-nc2-sib',
      status: 'sorted',
    });
    stagePdf('/staging/nc2-lead.pdf', 2);
    stagePdf('/staging/nc2-sib.pdf', 3);

    const pdfLib = require('pdf-lib');
    const prevImpl = (pdfLib.PDFDocument.load as jest.Mock).getMockImplementation();

    // getPageCount() never throws in this test — the corruption only surfaces
    // during cross-document copyPages().  Docs loaded from original sib bytes
    // have broken=true; after save→reload the re-encoded bytes carry a marker
    // at index 1 (0x01), producing broken=false docs where copyPages succeeds.
    let loadCallCount2 = 0;
    (pdfLib.PDFDocument.load as jest.Mock).mockImplementation(async (bytes: Uint8Array) => {
      loadCallCount2++;
      const count = bytes[0] || 0;
      const pages = Array.from({ length: count }, (_, i) => `p${i}`);
      const isReencoded = bytes[1] === 0x01;
      const broken = count === 3 && !isReencoded;
      return {
        broken,
        getPageCount: () => pages.length,
        copyPages: async (src: any, indices: number[]) => {
          if (src.broken) {
            throw new Error('Cross-document page tree reference unresolvable (NoCentris)');
          }
          return indices.map((i: number) => `p${i}`);
        },
        addPage: (p: string) => pages.push(p),
        save: async () => {
          const out = new Uint8Array(8);
          out[0] = pages.length;
          out[1] = 0x01;
          return out;
        },
      };
    });

    try {
      const res = await request(buildApp())
        .post(ROUTE('it-nc2-lead'))
        .send({ action: 'accept' })
        .expect(200);

      // Merge succeeded despite copyPages failing on first sib load.
      expect(res.body.id).toBe('it-nc2-lead');
      expect(res.body.stagedPath).toMatch(/merged_/);
      expect(res.body.contentHash).toHaveLength(64);
      expect(res.body.sortingDecision).toMatchObject({
        decision: 'merge',
        decisionState: 'accepted',
        mergedFromItemId: 'it-nc2-sib',
      });

      // Sibling is excluded with back-pointer.
      const sibling = itemStore.get('it-nc2-sib')!;
      expect(sibling.status).toBe('rejected');
      expect((sibling.sortingDecision as any).mergedIntoItemId).toBe('it-nc2-lead');

      // 4 load() calls: lead(1) + sib-initial-broken(2) + sib-raw-for-tempDoc(3) + sib-reencoded(4).
      expect(loadCallCount2).toBe(4);
    } finally {
      if (prevImpl) (pdfLib.PDFDocument.load as jest.Mock).mockImplementation(prevImpl);
    }
  });

  // -----------------------------------------------------------------
  // 10b. NoCentris unrecoverable — fixture-based, REAL pdf-lib.
  //
  // tests/fixtures/nocentris-broken-page-tree.pdf is a hand-crafted
  // PDF whose catalog points /Pages at object 99 0 R (non-existent).
  // Real pdf-lib's lenient parser loads it successfully, but both
  // getPageCount() and the recovery save() throw
  // "Expected instance of PDFDict, but got instance of undefined".
  //
  // This test exercises the full endpoint path with real pdf-lib — no
  // mocking of PDFDocument.load — confirming that an unrecoverable
  // NoCentris-style PDF yields a classified 400 and never a 500.
  // -----------------------------------------------------------------
  it('NoCentris-style merge (fixture, real pdf-lib): returns 400 (MERGE_PDF_COPY_FAILED) when sibling is truly unrecoverable', async () => {
    const FIXTURE_PATH = 'tests/fixtures/nocentris-broken-page-tree.pdf';

    seed('it-nc-fix-lead', {
      stagedPath: '/staging/nc-fix-lead.pdf',
      contentHash: 'hash-nc-fix-lead',
      sortingDecision: {
        decision: 'merge',
        mergeWithItemId: 'it-nc-fix-sib',
        mergeWithItemIds: ['it-nc-fix-sib'],
        decisionState: 'pending',
      },
    });
    seed('it-nc-fix-sib', {
      stagedPath: FIXTURE_PATH,
      originalName: 'Etats_financiers_unrecoverable_NoCentris.pdf',
      contentHash: 'hash-nc-fix-sib',
      status: 'sorted',
    });
    // Lead is a normal 2-page mock PDF.
    stagePdf('/staging/nc-fix-lead.pdf', 2);
    // Sibling uses the REAL fixture file — NOT registered in stagedFiles,
    // so fs.readFileSync falls back to the actual file on disk.

    const pdfLib = require('pdf-lib');
    const realPdfLib = jest.requireActual('pdf-lib') as typeof import('pdf-lib');
    const prevImpl = (pdfLib.PDFDocument.load as jest.Mock).getMockImplementation();

    // Hybrid mock: real pdf-lib for '%PDF' bytes (fixture), mock for
    // fake staging bytes (lead).
    (pdfLib.PDFDocument.load as jest.Mock).mockImplementation(
      async (bytes: Uint8Array, opts?: any) => {
        if (bytes[0] === 0x25) {
          // '%' — real fixture bytes: use actual pdf-lib with lenient options.
          return realPdfLib.PDFDocument.load(bytes, {
            ignoreEncryption: true,
            throwOnInvalidObject: false,
            updateMetadata: false,
            ...(realPdfLib.ParseSpeeds != null && {
              parseSpeed: realPdfLib.ParseSpeeds.Fastest,
            }),
          });
        }
        // Mock staging bytes: first byte encodes page count.
        const count = bytes[0] || 0;
        const pages = Array.from({ length: count }, (_, i) => `p${i}`);
        return {
          getPageCount: () => pages.length,
          copyPages: async (src: any, indices: number[]) =>
            indices.map((i: number) => src.pages[i]),
          addPage: (p: any) => pages.push(p),
          save: async () => {
            const out = new Uint8Array(8);
            out[0] = pages.length;
            return out;
          },
        };
      },
    );

    try {
      const res = await request(buildApp())
        .post(ROUTE('it-nc-fix-lead'))
        .send({ action: 'accept' })
        .expect(400);

      // Must be a classified 400, never a 500.
      expect(res.body.code).toBe('MERGE_PDF_COPY_FAILED');
      expect(res.body.error).toMatch(/Failed to copy pages from merge target/);
      expect(res.body.error).toMatch(/NoCentris/);

      // Lead row must NOT be flipped to accepted.
      expect(
        (itemStore.get('it-nc-fix-lead')!.sortingDecision as any).decisionState,
      ).toBe('pending');
    } finally {
      if (prevImpl) (pdfLib.PDFDocument.load as jest.Mock).mockImplementation(prevImpl);
    }
  });

  it('NoCentris-style merge (mock): returns 400 (MERGE_PDF_COPY_FAILED) when both load attempts fail on sibling', async () => {
    seed('it-nc-unrecov-lead', {
      stagedPath: '/staging/nc-unrecov-lead.pdf',
      contentHash: 'hash-nc-unrecov-lead',
      sortingDecision: {
        decision: 'merge',
        mergeWithItemId: 'it-nc-unrecov-sib',
        mergeWithItemIds: ['it-nc-unrecov-sib'],
        decisionState: 'pending',
      },
    });
    seed('it-nc-unrecov-sib', {
      stagedPath: '/staging/nc-unrecov-sib.pdf',
      originalName: 'Etats_financiers_unrecoverable_NoCentris.pdf',
      contentHash: 'hash-nc-unrecov-sib',
      status: 'sorted',
    });
    stagePdf('/staging/nc-unrecov-lead.pdf', 2);
    stagePdf('/staging/nc-unrecov-sib.pdf', 3);

    const pdfLib = require('pdf-lib');
    const prevImpl = (pdfLib.PDFDocument.load as jest.Mock).getMockImplementation();

    // Sibling (count=3) ALWAYS throws on getPageCount — even after re-encode.
    // Lead (count=2) loads normally.
    let loadCallCount = 0;
    (pdfLib.PDFDocument.load as jest.Mock).mockImplementation(async (bytes: Uint8Array) => {
      loadCallCount++;
      const count = bytes[0] || 0;
      const pages = Array.from({ length: count }, (_, i) => `p${i}`);
      const isSib = count === 3;
      return {
        getPageCount: () => {
          if (isSib) throw new Error('Expected instance of PDFDict, but got instance of undefined');
          return pages.length;
        },
        copyPages: async (_src: any, indices: number[]) => indices.map((i) => `p${i}`),
        addPage: (p: string) => pages.push(p),
        save: async () => { const out = new Uint8Array(8); out[0] = pages.length; return out; },
      };
    });

    try {
      const res = await request(buildApp())
        .post(ROUTE('it-nc-unrecov-lead'))
        .send({ action: 'accept' })
        .expect(400);

      // Must be a classified 400, never a 500.
      expect(res.body.code).toBe('MERGE_PDF_COPY_FAILED');
      expect(res.body.error).toMatch(/Failed to copy pages from merge target/);
      expect(res.body.error).toMatch(/NoCentris/);

      // Lead row must NOT be flipped to accepted.
      expect((itemStore.get('it-nc-unrecov-lead')!.sortingDecision as any).decisionState).toBe('pending');
    } finally {
      if (prevImpl) (pdfLib.PDFDocument.load as jest.Mock).mockImplementation(prevImpl);
    }
  });
});
