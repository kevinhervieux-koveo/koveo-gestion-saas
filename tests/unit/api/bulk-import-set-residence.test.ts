/**
 * Task #802 — Server-side coverage for the residence picker flow added
 * by Task #780 to the Sorting / Branching step of the bulk-document-
 * import wizard.
 *
 * Two pieces of behaviour are pinned here:
 *
 *   1. POST /api/admin/bulk-import/items/:id/set-residence
 *      The endpoint that lets an admin attach (or clear) a residence
 *      on an item routed to `residence_documents`. The handler also
 *      promotes the item from `sorted` → `branched` once a residence
 *      is set, and reverts it back to `sorted` when it is cleared.
 *      Coverage:
 *        - happy path (valid residence belonging to the session's
 *          building) flips the item to `branched` and persists the
 *          residenceId + manual-override flag.
 *        - missing body (no residenceId field) is rejected with 400
 *          by the Zod schema.
 *        - residenceId pointing at a residence that does not exist is
 *          rejected with 404.
 *        - residenceId belonging to a *different* building than the
 *          session is rejected with 400.
 *        - clearing the residence (residenceId: null) reverts the
 *          item back to `sorted` and resets manual-override to false.
 *        - calling the endpoint on an item whose branch is NOT
 *          `residence_documents` is rejected with 400 (the residence
 *          field has no meaning there).
 *        - calling the endpoint on an unknown item id returns 404.
 *
 *   2. The promotion gate inside `processItemForStep` (the per-item
 *      branch retry endpoint exercises the exact same code path).
 *      When the analyzer routes an item to `residence_documents` but
 *      cannot resolve a residenceId, the item must stay in `sorted`
 *      so the admin is forced to use the picker before identification
 *      runs. When a residenceId IS resolved (or the destination is
 *      not `residence_documents`), the item must advance to
 *      `branched` exactly like before.
 *
 * Both pieces share the same in-memory item / session / residence
 * stores so the file is one logically-consistent fixture.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () => require('../../manual-mocks/drizzle-orm/pg-core'));

// ---------------------------------------------------------------------------
// In-memory stores. The mocked db below routes select / update / insert
// against these Maps. Keys mirror the real Drizzle table names just
// enough for the endpoint code to round-trip realistically.
// ---------------------------------------------------------------------------
type Item = Record<string, unknown> & { id: string; sessionId: string };
type Session = Record<string, unknown> & {
  id: string;
  buildingId: string | null;
  organizationId: string;
};
type Residence = { id: string; buildingId: string };

const itemStore = new Map<string, Item>();
const sessionStore = new Map<string, Session>();
const residenceStore = new Map<string, Residence>();

function seedItem(id: string, overrides: Partial<Item> = {}): Item {
  const base: Item = {
    id,
    sessionId: 'sess-1',
    originalName: `${id}.pdf`,
    stagedPath: `/staging/${id}.pdf`,
    mimeType: 'application/pdf',
    status: 'sorted',
    branchDecision: {
      branch: 'residence_documents',
      subCategory: 'lease',
      reason: 'looks like a lease',
      confidence: 0.9,
      residenceId: null,
      residenceConfidence: null,
      residenceReason: null,
      residenceFallbackReason: 'AI could not determine the residence',
      residenceManualOverride: false,
    } as Record<string, unknown>,
    ...overrides,
  };
  itemStore.set(id, base);
  return base;
}

function seedSession(id: string, overrides: Partial<Session> = {}): Session {
  const base: Session = {
    id,
    buildingId: 'building-1',
    organizationId: 'org-1',
    ...overrides,
  };
  sessionStore.set(id, base);
  return base;
}

function seedResidence(id: string, buildingId: string): void {
  residenceStore.set(id, { id, buildingId });
}

// ---------------------------------------------------------------------------
// drizzle helpers — every condition the endpoint builds is `eq(col, val)`
// from the manual mock, so we can identify which table is being targeted
// by sniffing the `column` reference and pulling the value off the
// descriptor.
// ---------------------------------------------------------------------------
function condValue(cond: any): unknown {
  if (!cond) return undefined;
  if ('value' in cond) return cond.value;
  return undefined;
}

function makeWhereThenable(updated: Item | null) {
  const p: any = Promise.resolve();
  p.returning = () => Promise.resolve(updated ? [updated] : []);
  return p;
}

let lastSelectTable: 'items' | 'sessions' | 'residences' | null = null;

const mockDb: any = {
  select: jest.fn((cols?: any) => ({
    from: jest.fn((table: any) => {
      // The bulk-import endpoint passes the schema table directly. The
      // manual pg-core mock gives every table a `name`, but we care
      // about the *call site* — so we infer from the columns argument
      // when present (selectFromResidences passes { id, buildingId }),
      // and otherwise use a per-call counter to disambiguate.
      const colsKeys = cols ? Object.keys(cols) : [];
      if (colsKeys.includes('buildingId') && colsKeys.includes('id') && colsKeys.length === 2) {
        lastSelectTable = 'residences';
      } else if (table?.name === 'bulk_import_sessions' || table?._?.name === 'bulk_import_sessions') {
        lastSelectTable = 'sessions';
      } else if (table?.name === 'residences' || table?._?.name === 'residences') {
        lastSelectTable = 'residences';
      } else {
        lastSelectTable = 'items';
      }
      return {
        where: jest.fn((cond: any) => {
          const id = condValue(cond) as string | undefined;
          if (lastSelectTable === 'sessions') {
            const row = id ? sessionStore.get(id) : undefined;
            return Promise.resolve(row ? [row] : []);
          }
          if (lastSelectTable === 'residences') {
            const row = id ? residenceStore.get(id) : undefined;
            return Promise.resolve(row ? [row] : []);
          }
          const row = id ? itemStore.get(id) : undefined;
          return Promise.resolve(row ? [row] : []);
        }),
      };
    }),
  })),
  update: jest.fn(() => ({
    set: jest.fn((updates: Partial<Item>) => ({
      where: jest.fn((cond: any) => {
        const id = condValue(cond) as string | undefined;
        if (!id || !itemStore.has(id)) return makeWhereThenable(null);
        const merged: Item = { ...itemStore.get(id)!, ...updates } as Item;
        itemStore.set(id, merged);
        return makeWhereThenable(merged);
      }),
    })),
  })),
  insert: jest.fn(() => ({
    values: jest.fn(() => Promise.resolve()),
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

const canAccessMock = jest.fn().mockResolvedValue(true);
jest.mock('../../../server/rbac', () => ({
  canUserAccessOrganization: (...args: any[]) => canAccessMock(...args),
}));

// ---------------------------------------------------------------------------
// Analyzer mock. The set-residence endpoint never touches the analyzer,
// but the branch retry endpoint does — and it's the same module import
// at the top of bulk-import.ts. We control the per-test behaviour by
// reassigning `analyzerSuggestBranch` inside individual cases.
// ---------------------------------------------------------------------------
let analyzerSuggestBranch: jest.Mock = jest.fn();
jest.mock('../../../server/services/bulk-import-analyzer', () => ({
  bulkImportAnalyzer: {
    suggestBranch: (...args: any[]) => analyzerSuggestBranch(...args),
    screen: jest.fn(),
    suggestMergeOrSplit: jest.fn(),
    identify: jest.fn(),
    suggestLinks: jest.fn(),
  },
  isBulkImportAiAvailable: () => true,
  BRANCH_SUB_CATEGORIES: {
    building_documents: ['other'],
    residence_documents: ['lease', 'other'],
    bill: ['other'],
    demand: ['other'],
    maintenance: ['other'],
    other: ['other'],
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
  logDebug: jest.fn(),
  logWarn: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Import the router under test (after every mock is registered).
// ---------------------------------------------------------------------------
import {
  registerBulkImportRoutes,
  inFlightPerItemRetry,
} from '../../../server/api/bulk-import';

/**
 * Task #1047: the per-item branch retry endpoint is now fire-and-forget.
 * The HTTP response carries the pre-AI snapshot; the AI work runs in the
 * background and updates the row asynchronously. Tests that assert on
 * the post-AI state must await this helper before reading the store.
 */
async function waitForRetryToSettle(
  itemId: string,
  step: 'screening' | 'sorting' | 'branching' | 'identification' | 'linking',
  maxMs = 4000,
): Promise<void> {
  const key = `${itemId}:${step}`;
  const start = Date.now();
  while (inFlightPerItemRetry.has(key)) {
    if (Date.now() - start > maxMs) {
      throw new Error(
        `[test] per-item retry ${key} did not settle within ${maxMs}ms`,
      );
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
  // One extra microtask flush so the trailing
  // `removePerItemRetryInFlight` (which runs after the Set delete) can
  // commit its DB write before the assertion reads the store.
  await new Promise((resolve) => setImmediate(resolve));
}

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  registerBulkImportRoutes(app);
  return app;
}

beforeEach(() => {
  itemStore.clear();
  sessionStore.clear();
  residenceStore.clear();
  canAccessMock.mockClear();
  canAccessMock.mockResolvedValue(true);
  analyzerSuggestBranch = jest.fn();
  jest.clearAllMocks();
});

const SET_RES = (id: string) =>
  `/api/admin/bulk-import/items/${id}/set-residence`;
const RUN_BRANCH = (id: string) =>
  `/api/admin/bulk-import/items/${id}/branch`;

// ===========================================================================
// 1. POST /set-residence — direct picker save
// ===========================================================================

describe('POST /api/admin/bulk-import/items/:id/set-residence (Task #780/#802)', () => {
  it('happy path: a valid residence flips the item to branched and stores the id + override flag', async () => {
    seedSession('sess-1');
    seedResidence('res-7', 'building-1');
    seedItem('it-1', {
      branchDecision: {
        branch: 'residence_documents',
        subCategory: 'lease',
        reason: 'lease',
        confidence: 0.9,
        residenceId: null,
        residenceManualOverride: false,
      } as Record<string, unknown>,
      status: 'sorted',
    });

    const res = await request(buildApp())
      .post(SET_RES('it-1'))
      .send({ residenceId: 'res-7' })
      .expect(200);

    expect(res.body.status).toBe('branched');
    expect((res.body.branchDecision as any).residenceId).toBe('res-7');
    // Picking a residence the AI didn't suggest is a manual override.
    expect((res.body.branchDecision as any).residenceManualOverride).toBe(true);
    // Other branchDecision fields are preserved.
    expect((res.body.branchDecision as any).branch).toBe('residence_documents');
    expect((res.body.branchDecision as any).subCategory).toBe('lease');
  });

  it('happy path: picking the SAME residence the AI already suggested does NOT mark a manual override', async () => {
    seedSession('sess-1');
    seedResidence('res-ai', 'building-1');
    seedItem('it-ai', {
      branchDecision: {
        branch: 'residence_documents',
        subCategory: 'lease',
        residenceId: 'res-ai', // AI's pick
        residenceManualOverride: false,
      } as Record<string, unknown>,
      status: 'branched',
    });

    const res = await request(buildApp())
      .post(SET_RES('it-ai'))
      .send({ residenceId: 'res-ai' })
      .expect(200);

    expect((res.body.branchDecision as any).residenceId).toBe('res-ai');
    expect((res.body.branchDecision as any).residenceManualOverride).toBe(false);
  });

  it('missing body (no residenceId field) is rejected by the Zod schema with 400', async () => {
    seedSession('sess-1');
    seedItem('it-1');

    const res = await request(buildApp())
      .post(SET_RES('it-1'))
      .send({})
      .expect(400);

    expect(res.body.error).toBeDefined();
  });

  it('residenceId pointing at a non-existent residence returns 404', async () => {
    seedSession('sess-1');
    seedItem('it-1');
    // No residence seeded under the given id.

    const res = await request(buildApp())
      .post(SET_RES('it-1'))
      .send({ residenceId: 'res-does-not-exist' })
      .expect(404);

    expect(res.body.error).toMatch(/Residence not found/);
    // The item's branchDecision must be untouched on the failure path.
    expect((itemStore.get('it-1')!.branchDecision as any).residenceId).toBeNull();
    expect(itemStore.get('it-1')!.status).toBe('sorted');
  });

  it('residenceId belonging to a different building than the session is rejected with 400', async () => {
    seedSession('sess-1', { buildingId: 'building-1' });
    seedResidence('res-other', 'building-OTHER');
    seedItem('it-1');

    const res = await request(buildApp())
      .post(SET_RES('it-1'))
      .send({ residenceId: 'res-other' })
      .expect(400);

    expect(res.body.error).toMatch(/does not belong/i);
    // Decision must be untouched.
    expect((itemStore.get('it-1')!.branchDecision as any).residenceId).toBeNull();
    expect(itemStore.get('it-1')!.status).toBe('sorted');
  });

  it('clearing the residence (residenceId: null) reverts the item back to sorted', async () => {
    seedSession('sess-1');
    seedItem('it-clear', {
      branchDecision: {
        branch: 'residence_documents',
        subCategory: 'lease',
        residenceId: 'res-current',
        residenceManualOverride: true,
      } as Record<string, unknown>,
      status: 'branched',
    });

    const res = await request(buildApp())
      .post(SET_RES('it-clear'))
      .send({ residenceId: null })
      .expect(200);

    expect(res.body.status).toBe('sorted');
    expect((res.body.branchDecision as any).residenceId).toBeNull();
    // Cleared rows always reset manualOverride to false.
    expect((res.body.branchDecision as any).residenceManualOverride).toBe(false);
  });

  it('calling set-residence on an item NOT routed to residence_documents is rejected with 400', async () => {
    seedSession('sess-1');
    seedResidence('res-7', 'building-1');
    seedItem('it-bill', {
      branchDecision: {
        branch: 'bill',
        subCategory: 'utility',
      } as Record<string, unknown>,
      status: 'branched',
    });

    const res = await request(buildApp())
      .post(SET_RES('it-bill'))
      .send({ residenceId: 'res-7' })
      .expect(400);

    expect(res.body.error).toMatch(/residence_documents/);
    // Status stays put.
    expect(itemStore.get('it-bill')!.status).toBe('branched');
  });

  it('calling set-residence on an unknown item id returns 404', async () => {
    seedSession('sess-1');

    const res = await request(buildApp())
      .post(SET_RES('does-not-exist'))
      .send({ residenceId: null })
      .expect(404);

    expect(res.body.error).toMatch(/Item not found/);
  });

  it('residenceId of empty string is rejected (Zod min(1)) with 400', async () => {
    seedSession('sess-1');
    seedItem('it-1');

    const res = await request(buildApp())
      .post(SET_RES('it-1'))
      .send({ residenceId: '' })
      .expect(400);

    expect(res.body.error).toBeDefined();
  });
});

// ===========================================================================
// 2. Promotion gate inside processItemForStep (exercised through the
//    per-item branch retry endpoint POST /items/:id/branch).
// ===========================================================================

describe('Branching promotion gate for residence_documents (Task #780/#802)', () => {
  it('analyzer returns residence_documents WITHOUT a residenceId → item stays at "sorted"', async () => {
    seedSession('sess-1');
    seedResidence('res-1', 'building-1');
    seedItem('it-no-res', {
      status: 'sorted',
      screening: { description: 'lease for unit 7' },
      branchDecision: null,
    });

    analyzerSuggestBranch.mockResolvedValue({
      branch: 'residence_documents',
      subCategory: 'lease',
      reason: 'looks like a lease',
      confidence: 0.9,
      residenceId: null,
      residenceConfidence: null,
      residenceReason: null,
      residenceFallbackReason: 'AI could not determine the residence',
    });

    const res = await request(buildApp())
      .post(RUN_BRANCH('it-no-res'))
      .send({})
      .expect(200);

    // Task #1047: the response is now the immediate snapshot. Wait for
    // the background AI call to settle, then assert on the persisted
    // item state.
    expect(res.body.id).toBe('it-no-res');
    await waitForRetryToSettle('it-no-res', 'branching');
    const stored = itemStore.get('it-no-res')!;

    // Critical: gate held the item back at `sorted` so the admin must
    // use the picker before identification runs.
    expect(stored.status).toBe('sorted');
    expect((stored.branchDecision as any).branch).toBe('residence_documents');
    expect((stored.branchDecision as any).residenceId).toBeNull();
    // residenceManualOverride defaults to false on a fresh AI run.
    expect((stored.branchDecision as any).residenceManualOverride).toBe(false);
  });

  it('analyzer returns residence_documents WITH a residenceId → item advances to "branched"', async () => {
    seedSession('sess-1');
    seedResidence('res-1', 'building-1');
    seedItem('it-with-res', {
      status: 'sorted',
      screening: { description: 'lease for unit 7' },
      branchDecision: null,
    });

    analyzerSuggestBranch.mockResolvedValue({
      branch: 'residence_documents',
      subCategory: 'lease',
      reason: 'looks like a lease',
      confidence: 0.92,
      residenceId: 'res-1',
      residenceConfidence: 0.88,
      residenceReason: 'unit 7 in filename',
      residenceFallbackReason: null,
    });

    const res = await request(buildApp())
      .post(RUN_BRANCH('it-with-res'))
      .send({})
      .expect(200);

    // Task #1047: response is the pre-AI snapshot; wait for background.
    expect(res.body.id).toBe('it-with-res');
    await waitForRetryToSettle('it-with-res', 'branching');
    const stored = itemStore.get('it-with-res')!;
    expect(stored.status).toBe('branched');
    expect((stored.branchDecision as any).residenceId).toBe('res-1');
  });

  it('analyzer returns a NON-residence branch → gate is irrelevant, item advances to "branched"', async () => {
    seedSession('sess-1');
    seedItem('it-bill', {
      status: 'sorted',
      screening: { description: 'electricity invoice' },
      branchDecision: null,
    });

    analyzerSuggestBranch.mockResolvedValue({
      branch: 'bill',
      subCategory: 'utility',
      reason: 'utility invoice',
      confidence: 0.95,
      residenceId: null,
    });

    const res = await request(buildApp())
      .post(RUN_BRANCH('it-bill'))
      .send({})
      .expect(200);

    // Task #1047: response is the pre-AI snapshot; wait for background.
    expect(res.body.id).toBe('it-bill');
    await waitForRetryToSettle('it-bill', 'branching');
    const stored = itemStore.get('it-bill')!;
    // No residence required — promotion is unconditional.
    expect(stored.status).toBe('branched');
    expect((stored.branchDecision as any).branch).toBe('bill');
  });

  it('preserves residenceManualOverride from the previous decision when the analyzer is re-run', async () => {
    seedSession('sess-1');
    seedItem('it-keep-override', {
      status: 'sorted',
      screening: { description: 'lease' },
      branchDecision: {
        branch: 'residence_documents',
        residenceManualOverride: true, // admin already overrode once
      } as Record<string, unknown>,
    });

    analyzerSuggestBranch.mockResolvedValue({
      branch: 'residence_documents',
      subCategory: 'lease',
      reason: 'still a lease',
      confidence: 0.9,
      residenceId: null,
    });

    const res = await request(buildApp())
      .post(RUN_BRANCH('it-keep-override'))
      .send({})
      .expect(200);

    // Task #1047: response is the pre-AI snapshot; wait for background.
    expect(res.body.id).toBe('it-keep-override');
    await waitForRetryToSettle('it-keep-override', 'branching');
    const stored = itemStore.get('it-keep-override')!;
    // Manual override survives a re-run of the AI step (Task #780 spec).
    expect((stored.branchDecision as any).residenceManualOverride).toBe(true);
    // Gate still holds because residenceId is null on the fresh result.
    expect(stored.status).toBe('sorted');
  });
});
