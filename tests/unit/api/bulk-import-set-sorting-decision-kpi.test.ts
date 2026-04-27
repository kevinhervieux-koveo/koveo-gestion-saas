/**
 * Task #1413 — KPI telemetry coverage for the
 *   POST /api/admin/bulk-import/items/:id/set-sorting-decision
 * endpoint.
 *
 * Why a separate file?
 *   The neighbouring `bulk-import-set-sorting-decision.test.ts` mocks
 *   `server/services/kpi` so its mocked `db.insert(...)` doesn't have
 *   to disambiguate `kpi_events` writes from `bulk_import_items`
 *   writes.  This file does the opposite: it imports the real KPI
 *   service and uses a table-aware db mock so we can assert exactly
 *   what is recorded for each accept/manual path (keep / merge /
 *   split), with the right `outcome` (`verbatim`, `edited`, …) and
 *   the right `dimensions` (decision, branch, language, mimeType, …).
 *
 * Coverage:
 *   - keep + AI-suggested filename kept verbatim     → 1 verbatim event
 *   - merge + admin edits the AI-suggested name      → 1 edited event
 *   - split + AI suggested two names, admin keeps    → 2 verbatim events
 *     them both verbatim                                with part=0 and part=1
 *   - The dimensions block carries decision / branch / subCategory /
 *     mimeType / language; the payload block carries sessionId / itemId.
 *   - The userId on the event matches the authenticated request.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () => require('../../manual-mocks/drizzle-orm/pg-core'));

// ---------------------------------------------------------------------------
// Item store, mirroring the bulk_import_items table.  Same shape as the
// fixture in bulk-import-set-sorting-decision.test.ts but kept local so the
// two suites can evolve independently.
// ---------------------------------------------------------------------------
type Item = Record<string, unknown> & { id: string };
const itemStore = new Map<string, Item>();
let bulkImportInserts: Item[] = [];
let kpiInserts: any[] = [];

function seed(id: string, overrides: Partial<Item> = {}): Item {
  const base: Item = {
    id,
    sessionId: 'sess-kpi-1',
    originalPath: `${id}.pdf`,
    originalName: `${id}.pdf`,
    stagedPath: `/staging/${id}.pdf`,
    contentHash: `hash-${id}`,
    mimeType: 'application/pdf',
    fileSize: 1024,
    status: 'sorted',
    preExcludeStatus: null,
    sortingDecision: null,
    branchDecision: null,
    finalFileName: null,
    ...overrides,
  };
  itemStore.set(id, base);
  return base;
}

function whereId(cond: any): string | undefined {
  if (!cond) return undefined;
  if ('value' in cond) return cond.value;
  return undefined;
}

function makeWhereThenable(updated: Item | null) {
  const p: any = Promise.resolve();
  p.returning = () => Promise.resolve(updated ? [updated] : []);
  return p;
}

// Resolve the "table" arg passed to drizzle's db.insert / db.update by
// inspecting its `name` (the pg-core mock stamps `name` on every pgTable
// result, and the real schema definitions use 'kpi_events' / 'bulk_import_items').
function tableName(table: any): string {
  return (table?.name ?? table?._?.name ?? '') as string;
}

const mockDb: any = {
  select: jest.fn((cols?: unknown) => ({
    from: jest.fn(() => ({
      where: jest.fn((cond: any) => {
        const id = whereId(cond);
        if (cols !== undefined) {
          // Session-scoped projection query — returns every item in the store.
          return Promise.resolve([...itemStore.values()]);
        }
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
  insert: jest.fn((table: any) => ({
    values: jest.fn((vals: any) => {
      // Disambiguate writes by destination table — the kpi service writes
      // to `kpi_events`, the bulk-import endpoint writes new sibling rows
      // to `bulk_import_items`.
      if (tableName(table) === 'kpi_events') {
        kpiInserts.push(vals);
        const p: any = Promise.resolve();
        p.returning = () => Promise.resolve([]);
        return p;
      }
      const id = vals.id ?? `gen-${bulkImportInserts.length + 1}`;
      const row: Item = { id, ...vals };
      itemStore.set(id, row);
      bulkImportInserts.push(row);
      const p: any = Promise.resolve([row]);
      p.returning = () => Promise.resolve([row]);
      return p;
    }),
  })),
  delete: jest.fn(() => ({
    where: jest.fn((cond: any) => {
      const id = whereId(cond);
      if (id) itemStore.delete(id);
      return Promise.resolve();
    }),
  })),
};

jest.mock('../../../server/db', () => ({ db: mockDb }));

jest.mock('../../../server/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-kpi-1', role: 'admin' };
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../server/rbac', () => ({
  canUserAccessOrganization: jest.fn().mockResolvedValue(true),
}));

// Stub out heavy AI / rotation / document services pulled in at module load.
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

// Note: we DO NOT mock `server/services/kpi` here — the whole point is to
// drive the real classifier + recordKpiEvent through the endpoint and
// observe the resulting db.insert(kpi_events) calls.

jest.mock('../../../server/utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
  logWarn: jest.fn(),
}));

// ---------------------------------------------------------------------------
// fs / pdf-lib stubs — minimal versions of the merge/split fixtures from the
// neighbouring suite so the keep / merge / split paths actually run their
// file-IO code without touching real disk.
// ---------------------------------------------------------------------------
const stagedFiles = new Map<string, Buffer>();
function stagePdf(p: string, pages: number) {
  const buf = Buffer.alloc(8);
  buf[0] = pages;
  stagedFiles.set(p, buf);
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

class MockDoc {
  pages: string[];
  constructor(pages: string[] = []) { this.pages = pages; }
  getPageCount() { return this.pages.length; }
  async copyPages(src: MockDoc, indices: number[]) { return indices.map((i) => src.pages[i]); }
  addPage(p: string) { this.pages.push(p); }
  async save() {
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
// Import the router AFTER every mock is registered.
// ---------------------------------------------------------------------------
import { registerBulkImportRoutes } from '../../../server/api/bulk-import';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  registerBulkImportRoutes(app);
  return app;
}

const ROUTE = (id: string) =>
  `/api/admin/bulk-import/items/${id}/set-sorting-decision`;

beforeEach(() => {
  itemStore.clear();
  stagedFiles.clear();
  bulkImportInserts = [];
  kpiInserts = [];
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Shared assertions about every kpi_events row the endpoint emits.
// ---------------------------------------------------------------------------
function expectCommonKpiShape(row: any) {
  expect(row.metricKey).toBe('bulk_import.filename_suggestion');
  // Stable, scoped to the requesting admin.
  expect(row.userId).toBe('admin-kpi-1');
  // Outcome must be one of the documented buckets.
  expect([
    'verbatim',
    'edited',
    'cleared',
    'manual_no_suggestion',
    'empty_no_suggestion',
  ]).toContain(row.outcome);
  // Dimensions and payload are jsonb columns; both are populated by the route.
  expect(row.dimensions).toEqual(expect.any(Object));
  expect(row.payload).toEqual(expect.any(Object));
}

describe('POST /api/admin/bulk-import/items/:id/set-sorting-decision — KPI telemetry (Task #1413)', () => {
  // -------------------------------------------------------------------
  // KEEP — accept on a keep suggestion + admin keeps the AI rename
  //        verbatim → exactly one `verbatim` kpi_events row.
  // -------------------------------------------------------------------
  it('keep: writes one kpi_events row with outcome=verbatim and the right dimensions', async () => {
    seed('kpi-keep', {
      finalFileName: 'invoice-2025-04',
      mimeType: 'application/pdf',
      branchDecision: {
        branch: 'financial_documents',
        subCategory: 'utility_bill',
        suggestedFinalFileName: 'invoice-2025-04',
      },
      sortingDecision: {
        decision: 'keep',
        reason: 'Standalone invoice',
        decisionState: 'pending',
      },
    });
    stagePdf('/staging/kpi-keep.pdf', 2);

    await request(buildApp())
      .post(ROUTE('kpi-keep'))
      .send({ action: 'accept', uiLanguage: 'en' })
      .expect(200);

    expect(kpiInserts).toHaveLength(1);
    const evt = kpiInserts[0];
    expectCommonKpiShape(evt);
    expect(evt.outcome).toBe('verbatim');
    expect(evt.dimensions).toMatchObject({
      decision: 'keep',
      branch: 'financial_documents',
      subCategory: 'utility_bill',
      mimeType: 'application/pdf',
      language: 'en',
    });
    // `part` is only set on split events.
    expect(evt.dimensions).not.toHaveProperty('part');
    expect(evt.payload).toMatchObject({
      sessionId: 'sess-kpi-1',
      itemId: 'kpi-keep',
    });
  });

  // -------------------------------------------------------------------
  // MERGE — accept on a merge suggestion + admin saves a different
  //         filename than the AI proposed → outcome=edited.
  // -------------------------------------------------------------------
  it('merge: writes one kpi_events row with outcome=edited when admin overrides the AI rename', async () => {
    seed('kpi-A', {
      stagedPath: '/staging/kpi-A.pdf',
      contentHash: 'hash-A',
      mimeType: 'application/pdf',
      branchDecision: {
        branch: 'meeting_documents',
        subCategory: 'agenda',
        suggestedFinalFileName: 'meeting-2024-10-agenda',
      },
      sortingDecision: {
        decision: 'merge',
        mergeWithItemId: 'kpi-B',
        decisionState: 'pending',
      },
    });
    seed('kpi-B', {
      stagedPath: '/staging/kpi-B.pdf',
      contentHash: 'hash-B',
      status: 'sorted',
    });
    stagePdf('/staging/kpi-A.pdf', 2);
    stagePdf('/staging/kpi-B.pdf', 3);

    await request(buildApp())
      .post(ROUTE('kpi-A'))
      .send({
        action: 'accept',
        finalFileName: 'meeting-2024-10-agenda-final',
        uiLanguage: 'fr',
      })
      .expect(200);

    expect(kpiInserts).toHaveLength(1);
    const evt = kpiInserts[0];
    expectCommonKpiShape(evt);
    expect(evt.outcome).toBe('edited');
    expect(evt.dimensions).toMatchObject({
      decision: 'merge',
      branch: 'meeting_documents',
      subCategory: 'agenda',
      mimeType: 'application/pdf',
      language: 'fr',
    });
    expect(evt.dimensions).not.toHaveProperty('part');
    expect(evt.payload).toMatchObject({
      sessionId: 'sess-kpi-1',
      itemId: 'kpi-A',
    });
  });

  // -------------------------------------------------------------------
  // SPLIT — accept on a split suggestion + admin keeps both AI-proposed
  //         names verbatim → exactly two events, one per part, with
  //         part=0 and part=1.
  // -------------------------------------------------------------------
  it('split: writes one kpi_events row per part with the right `part` dimension', async () => {
    seed('kpi-S', {
      stagedPath: '/staging/kpi-S.pdf',
      contentHash: 'hash-S',
      mimeType: 'application/pdf',
      branchDecision: {
        branch: 'legal_documents',
        subCategory: 'contract',
        suggestedSplitFinalNames: ['contract-part-1', 'contract-part-2'],
      },
      sortingDecision: {
        decision: 'split',
        splitAtPage: 2,
        decisionState: 'pending',
      },
    });
    stagePdf('/staging/kpi-S.pdf', 5);

    await request(buildApp())
      .post(ROUTE('kpi-S'))
      .send({
        action: 'accept',
        splitFinalNames: ['contract-part-1', 'contract-part-2'],
        uiLanguage: 'en',
      })
      .expect(200);

    expect(kpiInserts).toHaveLength(2);
    for (const evt of kpiInserts) {
      expectCommonKpiShape(evt);
      expect(evt.outcome).toBe('verbatim');
      expect(evt.dimensions).toMatchObject({
        decision: 'split',
        branch: 'legal_documents',
        subCategory: 'contract',
        mimeType: 'application/pdf',
        language: 'en',
      });
      expect(evt.payload).toMatchObject({
        sessionId: 'sess-kpi-1',
        itemId: 'kpi-S',
      });
    }
    // The two events distinguish their part via the `part` dimension.
    const parts = kpiInserts.map((e) => e.dimensions.part).sort();
    expect(parts).toEqual([0, 1]);
  });

  // -------------------------------------------------------------------
  // KEEP with NO AI suggestion + admin clears the rename → the metric
  // surfaces this as `empty_no_suggestion` so the dashboard doesn't
  // count it against the AI accept-rate denominator.
  // -------------------------------------------------------------------
  it('keep with no AI suggestion and no admin rename: outcome=empty_no_suggestion', async () => {
    seed('kpi-keep-empty', {
      finalFileName: null,
      branchDecision: {
        branch: 'other_documents',
        subCategory: null,
      },
      sortingDecision: {
        decision: 'keep',
        decisionState: 'pending',
      },
    });
    stagePdf('/staging/kpi-keep-empty.pdf', 1);

    await request(buildApp())
      .post(ROUTE('kpi-keep-empty'))
      .send({ action: 'accept' })
      .expect(200);

    expect(kpiInserts).toHaveLength(1);
    const evt = kpiInserts[0];
    expectCommonKpiShape(evt);
    expect(evt.outcome).toBe('empty_no_suggestion');
    // language was omitted from the request — must surface as null, not undefined.
    expect(evt.dimensions.language).toBeNull();
  });

  // -------------------------------------------------------------------
  // DRAFT saves are intentionally NOT KPI-tracked — only commits count.
  // -------------------------------------------------------------------
  it('draft save does NOT write any kpi_events row', async () => {
    seed('kpi-draft', {
      branchDecision: {
        branch: 'building_documents',
        suggestedFinalFileName: 'draft-name',
      },
      sortingDecision: { decision: 'keep', decisionState: 'pending' },
    });
    stagePdf('/staging/kpi-draft.pdf', 1);

    await request(buildApp())
      .post(ROUTE('kpi-draft'))
      .send({ action: 'manual', draft: true, decision: 'keep' })
      .expect(200);

    expect(kpiInserts).toHaveLength(0);
  });

  // -------------------------------------------------------------------
  // REJECT does NOT write a kpi_events row — the admin hasn't committed
  // a final filename yet.
  // -------------------------------------------------------------------
  it('reject does NOT write any kpi_events row', async () => {
    seed('kpi-reject', {
      branchDecision: {
        branch: 'building_documents',
        suggestedFinalFileName: 'whatever',
      },
      sortingDecision: {
        decision: 'merge',
        mergeWithItemId: 'someone-else',
        decisionState: 'pending',
      },
    });

    await request(buildApp())
      .post(ROUTE('kpi-reject'))
      .send({ action: 'reject' })
      .expect(200);

    expect(kpiInserts).toHaveLength(0);
  });
});
