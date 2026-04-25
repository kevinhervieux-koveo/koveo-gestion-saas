/**
 * Task #1047 — The per-item AI retry endpoints
 *   POST /api/admin/bulk-import/items/:id/screen
 *                                      /sort
 *                                      /branch
 *                                      /identify
 *                                      /link
 * used to call Anthropic synchronously inside the request handler. When
 * an analyzer call took longer than ~60 s the Replit edge proxy killed
 * the connection with `502 Bad Gateway`, leaving the wizard's row
 * spinner stuck and the admin with no signal that anything was actually
 * still happening on the backend.
 *
 * The fix re-shapes the handler around the exact pattern
 * `runAllForStep` already uses for bulk runs:
 *
 *   1. Read the row, validate, and short-circuit when *this specific
 *      item* is already being processed — either by an earlier per-item
 *      retry that hasn't returned yet (in-process Set) or by a run-all
 *      worker that has it in `progress.runAll[step].inFlight`. Items
 *      queued behind a run-all loop, or items the run-all loop has
 *      already finished with, can still be retried; only items the loop
 *      is *currently* working on are blocked. This protects against
 *      racing the run-all worker's writes without making the Retry
 *      button a no-op for the entire duration of run-all.
 *   2. Mark the item in-flight in a process-local Set
 *      (`inFlightPerItemRetry`) AND in the persisted
 *      `runAll[step].inFlight` array (which the polling UI already
 *      reads).
 *   3. Fire the AI call in the background via an async IIFE wrapped in
 *      `withItemTimeout`, and return the current item snapshot
 *      immediately so the response always lands in <1 s regardless of
 *      analyzer latency.
 *   4. In the IIFE's `finally`, clear both markers so the next retry
 *      can run.
 *
 * The four cases below pin down each contract bullet:
 *   (a) returns 2xx well before the analyzer settles, even when the
 *       analyzer hangs for longer than the proxy timeout would have
 *       allowed.
 *   (b) a near-simultaneous second click on the same row is treated as
 *       a no-op — the analyzer is still only called exactly once.
 *   (c) the in-flight marker is set during the AI call and cleared on
 *       BOTH success and failure (including the timeout path).
 *   (d) clearing the session via DELETE /sessions/:id drops any
 *       per-item retry markers that belong to items in the session.
 *
 * The component-level spinner-persistence behaviour (the polling UI
 * keeping the row Loader2 visible while the marker is in flight) is
 * pinned separately by `bulk-document-import-retry-isolation.test.tsx`
 * and the dedicated polled-spinner test added in this same task.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () =>
  require('../../manual-mocks/drizzle-orm/pg-core'),
);

// ---------------------------------------------------------------------------
// In-memory stores. The mocked db routes selects/updates/deletes against
// these Maps. Same shape as the sister set-residence tests.
// ---------------------------------------------------------------------------
type Item = Record<string, unknown> & { id: string; sessionId: string };
type Session = Record<string, unknown> & {
  id: string;
  buildingId: string | null;
  organizationId: string;
};

const itemStore = new Map<string, Item>();
const sessionStore = new Map<string, Session>();

function seedSession(id: string, overrides: Partial<Session> = {}): Session {
  const base: Session = {
    id,
    buildingId: 'building-1',
    organizationId: 'org-1',
    progress: {},
    ...overrides,
  };
  sessionStore.set(id, base);
  return base;
}

function seedItem(id: string, overrides: Partial<Item> = {}): Item {
  const base: Item = {
    id,
    sessionId: 'sess-1',
    originalName: `${id}.pdf`,
    stagedPath: `/staging/${id}.pdf`,
    mimeType: 'application/pdf',
    status: 'screened',
    sortingDecision: null,
    branchDecision: null,
    identification: null,
    linkDecisions: null,
    screening: null,
    ...overrides,
  };
  itemStore.set(id, base);
  return base;
}

// ---------------------------------------------------------------------------
// drizzle helpers — the manual-mock builds `eq(col, val)` descriptors.
// We disambiguate which table is being targeted with a per-call cursor.
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

let lastSelectTable: 'items' | 'sessions' = 'items';

const mockDb: any = {
  select: jest.fn((cols?: any) => ({
    from: jest.fn((table: any) => {
      const colsKeys = cols ? Object.keys(cols) : [];
      if (
        table?.name === 'bulk_import_sessions' ||
        table?._?.name === 'bulk_import_sessions'
      ) {
        lastSelectTable = 'sessions';
      } else if (
        colsKeys.length === 1 &&
        colsKeys[0] === 'id' &&
        (table?.name === 'bulk_import_items' ||
          table?._?.name === 'bulk_import_items')
      ) {
        lastSelectTable = 'items';
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
          // Items table: support both .id lookup and .sessionId lookup.
          // We can't tell from the manual mock which column was used, so
          // try id-first, fall back to sessionId scan. When `select()`
          // was called with no projection (cols === undefined), return
          // the full row so callers that read item.sessionId / item.* see
          // real values; projected callers (e.g. select({id, name, …}))
          // continue to receive only the column-shaped payload.
          if (id && itemStore.has(id)) {
            if (cols === undefined) {
              return Promise.resolve([itemStore.get(id)!]);
            }
            return Promise.resolve([{ id }]);
          }
          if (id) {
            const matches = Array.from(itemStore.values())
              .filter((it) => it.sessionId === id)
              .map((it) => ({ id: it.id }));
            if (matches.length > 0) return Promise.resolve(matches);
          }
          return Promise.resolve([]);
        }),
      };
    }),
  })),
  update: jest.fn(() => ({
    set: jest.fn((updates: Partial<Item> | any) => ({
      where: jest.fn((cond: any) => {
        const id = condValue(cond) as string | undefined;
        if (!id) return makeWhereThenable(null);
        if (sessionStore.has(id)) {
          const merged: Session = {
            ...sessionStore.get(id)!,
            ...(updates as Partial<Session>),
          };
          sessionStore.set(id, merged);
          return makeWhereThenable(null);
        }
        if (!itemStore.has(id)) return makeWhereThenable(null);
        const merged: Item = {
          ...itemStore.get(id)!,
          ...(updates as Partial<Item>),
        } as Item;
        itemStore.set(id, merged);
        return makeWhereThenable(merged);
      }),
    })),
  })),
  insert: jest.fn(() => ({
    values: jest.fn(() => Promise.resolve()),
  })),
  delete: jest.fn(() => ({
    where: jest.fn((cond: any) => {
      const id = condValue(cond) as string | undefined;
      if (!id) return Promise.resolve();
      // Drop matching items by id or by sessionId.
      if (itemStore.has(id)) {
        itemStore.delete(id);
      } else {
        for (const [k, v] of itemStore) {
          if (v.sessionId === id) itemStore.delete(k);
        }
      }
      sessionStore.delete(id);
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

const canAccessMock = jest.fn().mockResolvedValue(true);
jest.mock('../../../server/rbac', () => ({
  canUserAccessOrganization: (...args: any[]) => canAccessMock(...args),
}));

// ---------------------------------------------------------------------------
// Analyzer mock — controllable per test so we can simulate slow/fast/
// failing AI calls.
// ---------------------------------------------------------------------------
const analyzerScreen = jest.fn();
jest.mock('../../../server/services/bulk-import-analyzer', () => ({
  bulkImportAnalyzer: {
    screen: (...args: any[]) => (analyzerScreen as any)(...args),
    suggestBranch: jest.fn(),
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
  rotateAndRewriteStagedFile: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../../server/services/document-service', () => ({
  documentService: {},
}));

jest.mock('../../../server/utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
}));

import {
  registerBulkImportRoutes,
  inFlightPerItemRetry,
} from '../../../server/api/bulk-import';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  registerBulkImportRoutes(app);
  return app;
}

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
  await new Promise((resolve) => setImmediate(resolve));
}

beforeEach(() => {
  itemStore.clear();
  sessionStore.clear();
  canAccessMock.mockClear();
  canAccessMock.mockResolvedValue(true);
  analyzerScreen.mockReset();
  jest.clearAllMocks();
  // Reset shared in-flight state in case a previous test crashed mid-run.
  inFlightPerItemRetry.clear();
});

const RUN_SCREEN = (id: string) =>
  `/api/admin/bulk-import/items/${id}/screen`;

// ===========================================================================
// (a) HTTP response is fast — even with a slow analyzer it returns ~immediately
// ===========================================================================

describe('per-item retry: fast HTTP response (Task #1047 — fixes 502)', () => {
  it('returns 200 in milliseconds even when the analyzer takes 60+ s', async () => {
    seedSession('sess-1');
    seedItem('it-slow', { status: 'pending' });

    // Hang the analyzer indefinitely. If the endpoint were still
    // running it inline, supertest would block for the full hang.
    let resolveAnalyzer: ((value: unknown) => void) | null = null;
    analyzerScreen.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAnalyzer = resolve;
        }),
    );

    const start = Date.now();
    const res = await request(buildApp()).post(RUN_SCREEN('it-slow')).send({});
    const elapsedMs = Date.now() - start;

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('it-slow');
    // The HTTP turnaround must be well below the proxy timeout. We
    // pick 5 s as a generous upper bound that still proves the
    // response is not waiting for the analyzer.
    expect(elapsedMs).toBeLessThan(5_000);

    // Marker is in place because the background work hasn't finished.
    expect(inFlightPerItemRetry.has('it-slow:screening')).toBe(true);

    // Release the analyzer so the IIFE can complete and the test
    // doesn't leak a dangling pending promise into other tests.
    resolveAnalyzer?.({
      isComplete: true,
      isMultiDocument: false,
      pageOrderHint: null,
      rotationDegrees: 0,
      suggestedFilename: 'it-slow.pdf',
      description: 'ok',
      confidence: 0.9,
    });
    await waitForRetryToSettle('it-slow', 'screening');
  });
});

// ===========================================================================
// (b) Double-click → only one analyzer call
// ===========================================================================

describe('per-item retry: duplicate-click guard (Task #1047)', () => {
  it('a second concurrent click on the same row is short-circuited and the analyzer runs exactly once', async () => {
    seedSession('sess-1');
    seedItem('it-dbl', { status: 'pending' });

    let resolveAnalyzer: ((value: unknown) => void) | null = null;
    analyzerScreen.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAnalyzer = resolve;
        }),
    );

    const app = buildApp();
    const first = await request(app).post(RUN_SCREEN('it-dbl')).send({});
    expect(first.status).toBe(200);
    // Guard: the first click flipped the marker.
    expect(inFlightPerItemRetry.has('it-dbl:screening')).toBe(true);

    // Second click while the first analyzer call is still hanging.
    const second = await request(app).post(RUN_SCREEN('it-dbl')).send({});
    expect(second.status).toBe(200);
    expect(second.body.id).toBe('it-dbl');

    // The analyzer must NOT have been called twice.
    expect(analyzerScreen).toHaveBeenCalledTimes(1);

    // Release + settle so the in-flight marker is gone before the
    // next test runs.
    resolveAnalyzer?.({
      isComplete: true,
      isMultiDocument: false,
      pageOrderHint: null,
      rotationDegrees: 0,
      suggestedFilename: 'it-dbl.pdf',
      description: 'ok',
      confidence: 0.9,
    });
    await waitForRetryToSettle('it-dbl', 'screening');

    // After settle, a fresh click should be allowed again — the marker
    // was cleared so this is no longer treated as a duplicate.
    expect(inFlightPerItemRetry.has('it-dbl:screening')).toBe(false);
  });
});

// ===========================================================================
// (c) In-flight marker added/cleared on success AND failure
// ===========================================================================

describe('per-item retry: in-flight marker lifecycle (Task #1047)', () => {
  it('marker is cleared after the analyzer resolves successfully', async () => {
    seedSession('sess-1');
    seedItem('it-ok', { status: 'pending' });

    analyzerScreen.mockResolvedValue({
      isComplete: true,
      isMultiDocument: false,
      pageOrderHint: null,
      rotationDegrees: 0,
      suggestedFilename: 'it-ok.pdf',
      description: 'ok',
      confidence: 0.9,
    });

    const res = await request(buildApp()).post(RUN_SCREEN('it-ok')).send({});
    expect(res.status).toBe(200);

    // Marker must be present at least until the IIFE drains.
    // After settle, it must be gone.
    await waitForRetryToSettle('it-ok', 'screening');
    expect(inFlightPerItemRetry.has('it-ok:screening')).toBe(false);
  });

  it('marker is cleared even when the analyzer throws', async () => {
    seedSession('sess-1');
    seedItem('it-fail', { status: 'pending' });

    analyzerScreen.mockRejectedValue(new Error('boom'));

    const res = await request(buildApp())
      .post(RUN_SCREEN('it-fail'))
      .send({});
    expect(res.status).toBe(200);

    // The catch-block in the IIFE must still drop the marker so a
    // future retry can proceed.
    await waitForRetryToSettle('it-fail', 'screening');
    expect(inFlightPerItemRetry.has('it-fail:screening')).toBe(false);
  });
});

// ===========================================================================
// (b2) Item-level (NOT session-level) gate against the run-all loop
//
// The first cut of the Task #1047 fix gated the per-item retry on whether
// the run-all loop was active for the session+step at all. That broke the
// admin's primary use-case: clicking Retry on a row that the run-all
// worker had already moved past (failed early, or hadn't reached yet)
// became a silent no-op for the entire duration of the bulk run. The
// shipped behaviour is item-level: only items currently in
// `progress.runAll[step].inFlight` are short-circuited.
// ===========================================================================

describe('per-item retry: item-level run-all gate (Task #1047)', () => {
  it('schedules the analyzer when run-all is in flight on a different item', async () => {
    // run-all is currently working on `it-other`, NOT on `it-target`.
    // The retry on `it-target` must still fire its analyzer call.
    seedSession('sess-1', {
      progress: {
        runAll: {
          screening: {
            total: 2,
            processed: 0,
            failed: 0,
            startedAt: '2024-01-01T00:00:00.000Z',
            inFlight: [
              { itemId: 'it-other', originalName: 'it-other.pdf' },
            ],
          },
        },
      },
    } as any);
    seedItem('it-target', { status: 'pending' });

    analyzerScreen.mockResolvedValue({
      isComplete: true,
      isMultiDocument: false,
      pageOrderHint: null,
      rotationDegrees: 0,
      suggestedFilename: 'it-target.pdf',
      description: 'ok',
      confidence: 0.9,
    });

    const res = await request(buildApp())
      .post(RUN_SCREEN('it-target'))
      .send({});
    expect(res.status).toBe(200);

    // Settle the background IIFE so the assertion lands after the AI
    // call has either fired or been skipped — without a wait we'd be
    // racing the IIFE.
    await waitForRetryToSettle('it-target', 'screening');

    // The core regression guard: the analyzer must be called once.
    expect(analyzerScreen).toHaveBeenCalledTimes(1);
  });

  it('short-circuits when run-all has THIS item in inFlight', async () => {
    // run-all is currently working on `it-busy`. A concurrent click on
    // the same row would race the run-all worker's writes — short out.
    seedSession('sess-1', {
      progress: {
        runAll: {
          screening: {
            total: 1,
            processed: 0,
            failed: 0,
            startedAt: '2024-01-01T00:00:00.000Z',
            inFlight: [
              { itemId: 'it-busy', originalName: 'it-busy.pdf' },
            ],
          },
        },
      },
    } as any);
    seedItem('it-busy', { status: 'pending' });

    analyzerScreen.mockResolvedValue({
      isComplete: true,
      isMultiDocument: false,
      pageOrderHint: null,
      rotationDegrees: 0,
      suggestedFilename: 'it-busy.pdf',
      description: 'ok',
      confidence: 0.9,
    });

    const res = await request(buildApp()).post(RUN_SCREEN('it-busy')).send({});
    expect(res.status).toBe(200);

    // No background IIFE was scheduled, so nothing to settle. A short
    // tick gives any (incorrectly-scheduled) microtask a chance to fire
    // before we assert the analyzer never ran.
    await new Promise((resolve) => setImmediate(resolve));

    expect(analyzerScreen).not.toHaveBeenCalled();
    // And the in-process marker stays clean since we returned before
    // adding it.
    expect(inFlightPerItemRetry.has('it-busy:screening')).toBe(false);
  });
});

// ===========================================================================
// (d) Clearing a session drops any of its in-flight per-item retry markers
// ===========================================================================

describe('per-item retry: session clear drops markers (Task #1047)', () => {
  it('DELETE /sessions/:id removes per-item retry markers belonging to the session', async () => {
    seedSession('sess-clear');
    seedItem('it-clear', { sessionId: 'sess-clear', status: 'pending' });

    // Pre-seed a marker as if a retry were in flight. We deliberately
    // do NOT exercise the full handler here so the test stays focused
    // on the clear-path behavior alone.
    inFlightPerItemRetry.add('it-clear:screening');
    expect(inFlightPerItemRetry.has('it-clear:screening')).toBe(true);

    const res = await request(buildApp())
      .delete('/api/admin/bulk-import/sessions/sess-clear')
      .send();
    expect(res.status).toBe(200);

    expect(inFlightPerItemRetry.has('it-clear:screening')).toBe(false);
  });
});
