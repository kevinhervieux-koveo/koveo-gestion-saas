/**
 * Task #1043 — Server-side coverage for the period-override endpoint
 * added in Task #997 and surfaced through the wizard date picker built
 * in Task #1038.
 *
 * The endpoint under test is
 *   POST /api/admin/bulk-import/items/:id/set-period-hint
 * implemented in `server/api/bulk-import.ts`. It carries non-trivial
 * business logic that the wizard relies on:
 *
 *   - Zod-validates the body (`{ periodHint: string | null }`,
 *     trimmed, max 120 chars).
 *   - Returns 404 when the item id is unknown.
 *   - Returns 400 when `item.status` is not `screened` / `sorted`
 *     (the period can only be changed while the row is on the Sorting
 *     step).
 *   - Returns 400 when the row's `sortingDecision.decisionState` is
 *     already `accepted` (re-sorting an accepted row would silently
 *     undo a confirmed merge/split file op).
 *   - Trims the input, treats empty strings as `null`, and toggles
 *     `screening.periodHintManualOverride` based on whether the new
 *     value is null.
 *   - Re-runs sorting on the target item AND on every same-typeGuess +
 *     bucketGuess sibling whose `sortingDecision.decisionState` is
 *     still pending, then returns the list of resorted sibling ids.
 *
 * A regression in any of those branches would silently break the
 * period override flow — the wizard would still POST happily, and
 * the AI-detected period would silently win on the next refresh.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () => require('../../manual-mocks/drizzle-orm/pg-core'));

// ---------------------------------------------------------------------------
// In-memory item store, modelled after the bulk_import_items table.
// Each test seeds the rows it cares about; the mocked db implementation
// below reads/writes this Map so the endpoint sees a realistic round-trip
// (the re-fetch after the screening update, the session-wide sibling
// scan, the per-sibling re-sort update, etc.).
// ---------------------------------------------------------------------------
type Item = Record<string, unknown> & { id: string; sessionId: string };

const itemStore = new Map<string, Item>();

function seedItem(id: string, overrides: Partial<Item> = {}): Item {
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
    screening: {
      isMultiDocument: false,
      quickAnalysis: { typeGuess: 'invoice', bucketGuess: 'utility' },
      periodHint: 'AI-detected period',
    } as Record<string, unknown>,
    sortingDecision: { decision: 'keep', decisionState: 'pending' } as Record<string, unknown>,
    branchDecision: null,
    identification: null,
    linkDecisions: null,
    finalDocumentId: null,
    preExcludeStatus: null,
    excludeSource: null,
    finalFileName: null,
    ...overrides,
  };
  itemStore.set(id, base);
  return base;
}

// The drizzle-orm mock returns descriptor objects for `eq(col, val)`,
// each of which has both `.column` and `.value`. The handler uses two
// item lookups — `eq(items.id, x)` and `eq(items.sessionId, x)` — so we
// disambiguate on the column's SQL name.
function condValue(cond: any): unknown {
  if (!cond) return undefined;
  if ('value' in cond) return cond.value;
  return undefined;
}
function condColName(cond: any): string | undefined {
  return cond?.column?.name as string | undefined;
}

function makeWhereThenable(updated: Item | null) {
  // The handler's primary update is awaited directly; the per-step
  // helper (`processItemForStep`) chains `.returning()`. Support both.
  const p: any = Promise.resolve();
  p.returning = () => Promise.resolve(updated ? [updated] : []);
  return p;
}

const mockDb: any = {
  select: jest.fn(() => ({
    from: jest.fn((table: any) => {
      const tableName: string | undefined = table?.name ?? table?._?.name;
      return {
        where: jest.fn((cond: any) => {
          const value = condValue(cond);
          const col = condColName(cond);
          if (tableName === 'bulk_import_items') {
            if (col === 'session_id') {
              const rows = [...itemStore.values()].filter(
                (it) => it.sessionId === value,
              );
              return Promise.resolve(rows);
            }
            // by id
            const row = typeof value === 'string' ? itemStore.get(value) : undefined;
            return Promise.resolve(row ? [row] : []);
          }
          return Promise.resolve([]);
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

jest.mock('../../../server/rbac', () => ({
  canUserAccessOrganization: jest.fn().mockResolvedValue(true),
}));

// Stub the analyzer so the sibling re-sort path doesn't try to make
// real AI calls. Returns a deterministic merge suggestion so we can
// distinguish AI-driven re-sorts (which write `decision: 'merge'`)
// from rows the handler skipped (left at their seeded state).
const suggestMergeOrSplitMock = jest.fn(async () => ({
  decision: 'merge',
  reason: 'mocked merge suggestion',
  confidence: 0.9,
  fallbackReason: null,
}));
jest.mock('../../../server/services/bulk-import-analyzer', () => ({
  bulkImportAnalyzer: {
    suggestBranch: jest.fn(),
    screen: jest.fn(),
    suggestMergeOrSplit: (...args: any[]) => suggestMergeOrSplitMock(...args),
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
  logWarn: jest.fn(),
}));

import { registerBulkImportRoutes } from '../../../server/api/bulk-import';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  registerBulkImportRoutes(app);
  return app;
}

beforeEach(() => {
  itemStore.clear();
  suggestMergeOrSplitMock.mockClear();
  jest.clearAllMocks();
});

const URL = (id: string) => `/api/admin/bulk-import/items/${id}/set-period-hint`;

describe('POST /api/admin/bulk-import/items/:id/set-period-hint (Task #1043)', () => {
  it('happy path: writes the trimmed periodHint, stamps the manual-override flag, and preserves sibling screening fields', async () => {
    seedItem('it-1', {
      // Pre-existing screening blob with sibling fields the merge must keep.
      screening: {
        isMultiDocument: false,
        quickAnalysis: { typeGuess: 'invoice', bucketGuess: 'utility' },
        periodHint: 'AI-detected period',
        rotationDegrees: 90,
        rotationApplied: true,
      } as Record<string, unknown>,
    });

    const res = await request(buildApp())
      .post(URL('it-1'))
      .send({ periodHint: '  Q1 2024  ' })
      .expect(200);

    // The endpoint returns `{ item, resortedSiblingIds }`.
    expect(Array.isArray(res.body.resortedSiblingIds)).toBe(true);

    const stored = itemStore.get('it-1')!;
    const screening = stored.screening as Record<string, unknown>;
    // Trimmed and stored.
    expect(screening.periodHint).toBe('Q1 2024');
    // Manual-override marker flipped on.
    expect(screening.periodHintManualOverride).toBe(true);
    // Sibling fields the merge must NOT clobber.
    expect(screening.isMultiDocument).toBe(false);
    expect(screening.rotationDegrees).toBe(90);
    expect(screening.rotationApplied).toBe(true);
    // quickAnalysis survives untouched.
    expect(screening.quickAnalysis).toEqual({
      typeGuess: 'invoice',
      bucketGuess: 'utility',
    });
  });

  it('clearing the field (null) drops the periodHint and the manual-override marker', async () => {
    seedItem('it-clear', {
      screening: {
        isMultiDocument: false,
        quickAnalysis: { typeGuess: 'invoice', bucketGuess: 'utility' },
        periodHint: 'old value',
        periodHintManualOverride: true,
      } as Record<string, unknown>,
    });

    await request(buildApp())
      .post(URL('it-clear'))
      .send({ periodHint: null })
      .expect(200);

    const screening = itemStore.get('it-clear')!.screening as Record<string, unknown>;
    expect(screening.periodHint).toBeNull();
    // Manual-override marker is reset; the chip should stop showing "Manual".
    expect(screening.periodHintManualOverride).toBe(false);
  });

  it('treats an empty/whitespace-only string as a clear (no manual override)', async () => {
    seedItem('it-blank', {
      screening: {
        isMultiDocument: false,
        quickAnalysis: { typeGuess: 'invoice', bucketGuess: 'utility' },
        periodHint: 'old value',
        periodHintManualOverride: true,
      } as Record<string, unknown>,
    });

    await request(buildApp())
      .post(URL('it-blank'))
      .send({ periodHint: '   ' })
      .expect(200);

    const screening = itemStore.get('it-blank')!.screening as Record<string, unknown>;
    expect(screening.periodHint).toBeNull();
    expect(screening.periodHintManualOverride).toBe(false);
  });

  it('returns 400 when the item is past the Sorting step (status not screened/sorted)', async () => {
    seedItem('it-late', { status: 'identified' });

    const res = await request(buildApp())
      .post(URL('it-late'))
      .send({ periodHint: 'Q1 2024' })
      .expect(400);

    expect(res.body.error).toMatch(/Sorting step/i);
    // The screening blob must be untouched on the rejection path.
    const screening = itemStore.get('it-late')!.screening as Record<string, unknown>;
    expect(screening.periodHint).toBe('AI-detected period');
    expect(screening.periodHintManualOverride).toBeUndefined();
  });

  it('returns 400 when the existing sorting decision has already been accepted', async () => {
    seedItem('it-accepted', {
      sortingDecision: {
        decision: 'merge',
        decisionState: 'accepted',
      } as Record<string, unknown>,
    });

    const res = await request(buildApp())
      .post(URL('it-accepted'))
      .send({ periodHint: 'Q1 2024' })
      .expect(400);

    expect(res.body.error).toMatch(/already been accepted/i);
    const screening = itemStore.get('it-accepted')!.screening as Record<string, unknown>;
    expect(screening.periodHint).toBe('AI-detected period');
  });

  it('returns 404 for an unknown item id', async () => {
    const res = await request(buildApp())
      .post(URL('does-not-exist'))
      .send({ periodHint: 'Q1 2024' })
      .expect(404);

    expect(res.body.error).toMatch(/Item not found/);
  });

  it('rejects malformed bodies with a 400 (zod validation)', async () => {
    seedItem('it-zod');

    // Missing the required field entirely.
    await request(buildApp()).post(URL('it-zod')).send({}).expect(400);

    // Wrong type — number instead of string|null.
    await request(buildApp())
      .post(URL('it-zod'))
      .send({ periodHint: 42 })
      .expect(400);

    // Over the 120-char cap.
    await request(buildApp())
      .post(URL('it-zod'))
      .send({ periodHint: 'x'.repeat(121) })
      .expect(400);

    // The screening blob must be untouched after every rejected call.
    const screening = itemStore.get('it-zod')!.screening as Record<string, unknown>;
    expect(screening.periodHint).toBe('AI-detected period');
    expect(screening.periodHintManualOverride).toBeUndefined();
  });

  it('re-sorts only same-type/bucket siblings whose decisionState is still pending', async () => {
    // Target row the admin is editing.
    seedItem('target', {
      screening: {
        isMultiDocument: false,
        quickAnalysis: { typeGuess: 'invoice', bucketGuess: 'utility' },
        periodHint: 'old',
      } as Record<string, unknown>,
      sortingDecision: { decision: 'merge', decisionState: 'pending' } as Record<string, unknown>,
    });

    // Sibling A — same type+bucket, pending → must be re-sorted.
    seedItem('sib-pending', {
      screening: {
        isMultiDocument: false,
        quickAnalysis: { typeGuess: 'invoice', bucketGuess: 'utility' },
        periodHint: 'sib-a',
      } as Record<string, unknown>,
      sortingDecision: {
        decision: 'merge',
        decisionState: 'pending',
      } as Record<string, unknown>,
    });

    // Sibling B — same type+bucket, decisionState null (never decided
    // because Screening just finished) → also re-sorted.
    seedItem('sib-null-state', {
      status: 'screened',
      screening: {
        isMultiDocument: false,
        quickAnalysis: { typeGuess: 'invoice', bucketGuess: 'utility' },
        periodHint: 'sib-b',
      } as Record<string, unknown>,
      sortingDecision: null,
    });

    // Sibling C — same type+bucket but already ACCEPTED → never touched.
    seedItem('sib-accepted', {
      screening: {
        isMultiDocument: false,
        quickAnalysis: { typeGuess: 'invoice', bucketGuess: 'utility' },
        periodHint: 'sib-c',
      } as Record<string, unknown>,
      sortingDecision: {
        decision: 'merge',
        decisionState: 'accepted',
      } as Record<string, unknown>,
    });

    // Sibling D — same type+bucket but REJECTED → never touched.
    seedItem('sib-rejected', {
      screening: {
        isMultiDocument: false,
        quickAnalysis: { typeGuess: 'invoice', bucketGuess: 'utility' },
        periodHint: 'sib-d',
      } as Record<string, unknown>,
      sortingDecision: {
        decision: 'keep',
        decisionState: 'rejected',
      } as Record<string, unknown>,
    });

    // Sibling E — different typeGuess → never touched.
    seedItem('sib-other-type', {
      screening: {
        isMultiDocument: false,
        quickAnalysis: { typeGuess: 'meeting-minutes', bucketGuess: 'utility' },
        periodHint: 'sib-e',
      } as Record<string, unknown>,
      sortingDecision: {
        decision: 'keep',
        decisionState: 'pending',
      } as Record<string, unknown>,
    });

    // Sibling F — different bucketGuess → never touched.
    seedItem('sib-other-bucket', {
      screening: {
        isMultiDocument: false,
        quickAnalysis: { typeGuess: 'invoice', bucketGuess: 'telecom' },
        periodHint: 'sib-f',
      } as Record<string, unknown>,
      sortingDecision: {
        decision: 'keep',
        decisionState: 'pending',
      } as Record<string, unknown>,
    });

    // Sibling G — same type+bucket+pending but past the Sorting step
    // (status='branched') → skipped by the status guard inside the loop.
    seedItem('sib-past-sorting', {
      status: 'branched',
      screening: {
        isMultiDocument: false,
        quickAnalysis: { typeGuess: 'invoice', bucketGuess: 'utility' },
        periodHint: 'sib-g',
      } as Record<string, unknown>,
      sortingDecision: {
        decision: 'merge',
        decisionState: 'pending',
      } as Record<string, unknown>,
    });

    // Sibling that lives in a different session entirely → not even
    // visible to the same-session scan.
    seedItem('sib-other-session', {
      sessionId: 'sess-2',
      screening: {
        isMultiDocument: false,
        quickAnalysis: { typeGuess: 'invoice', bucketGuess: 'utility' },
        periodHint: 'sib-x',
      } as Record<string, unknown>,
      sortingDecision: {
        decision: 'merge',
        decisionState: 'pending',
      } as Record<string, unknown>,
    });

    const res = await request(buildApp())
      .post(URL('target'))
      .send({ periodHint: 'Q2 2024' })
      .expect(200);

    const resorted: string[] = res.body.resortedSiblingIds ?? [];
    // Only the two pending same-type/bucket same-session in-Sorting
    // siblings should be in the list. Order is implementation-defined,
    // so compare as a set.
    expect(new Set(resorted)).toEqual(new Set(['sib-pending', 'sib-null-state']));

    // The accepted/rejected/other-type/other-bucket/past-sorting/
    // other-session rows must NOT appear.
    expect(resorted).not.toContain('sib-accepted');
    expect(resorted).not.toContain('sib-rejected');
    expect(resorted).not.toContain('sib-other-type');
    expect(resorted).not.toContain('sib-other-bucket');
    expect(resorted).not.toContain('sib-past-sorting');
    expect(resorted).not.toContain('sib-other-session');

    // Sanity-check that the rows we didn't resort still carry their
    // original sorting decision (the handler must never silently undo
    // a confirmed accept/reject).
    expect((itemStore.get('sib-accepted')!.sortingDecision as any).decisionState).toBe('accepted');
    expect((itemStore.get('sib-rejected')!.sortingDecision as any).decisionState).toBe('rejected');
  });
});
