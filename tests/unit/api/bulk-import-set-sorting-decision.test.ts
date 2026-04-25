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

const mockDb: any = {
  select: jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn((cond: any) => {
        const id = whereId(cond);
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

  it('accept on a "merge" suggestion 404s when the merge target is missing', async () => {
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
      .expect(404);

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

  it('N-way merge returns 404 when one sibling ID does not exist', async () => {
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
      .expect(404);

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
});
