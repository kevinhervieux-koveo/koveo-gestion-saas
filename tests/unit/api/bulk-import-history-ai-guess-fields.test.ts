/**
 * Task #1320 — GET /api/admin/bulk-import/sessions/:id returns AI guess fields
 * that are present and correctly typed.
 *
 * The endpoint enriches each item with flat scalar fields from the screening
 * JSON blob via extractScreeningQuickAnalysisFields. Coverage:
 *   - Full screening blob → all five fields present and correctly typed.
 *   - Null screening blob → null strings, false boolean.
 *   - Blob without quickAnalysis → periodHint still populated.
 *   - periodHintManualOverride: true propagated.
 *   - Multiple items all enriched.
 *   - 404 on missing session.
 *   - Empty items array when session has no items.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () => require('../../manual-mocks/drizzle-orm/pg-core'));

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

interface Item {
  id: string;
  sessionId: string;
  screening: Record<string, unknown> | null;
  status: string;
  [key: string]: unknown;
}

interface Session {
  id: string;
  buildingId: string | null;
  organizationId: string;
  status: string;
  step: string;
}

const itemStore = new Map<string, Item>();
const sessionStore = new Map<string, Session>();

function seedSession(id: string, overrides: Partial<Session> = {}): Session {
  const base: Session = {
    id,
    buildingId: 'building-1',
    organizationId: 'org-1',
    status: 'screening',
    step: 'screening',
    ...overrides,
  };
  sessionStore.set(id, base);
  return base;
}

function seedItem(
  id: string,
  screening: Record<string, unknown> | null,
  overrides: Partial<Item> = {},
): Item {
  const base: Item = {
    id,
    sessionId: 'sess-hist',
    originalName: `${id}.pdf`,
    status: 'screened',
    screening,
    ...overrides,
  };
  itemStore.set(id, base);
  return base;
}

// ---------------------------------------------------------------------------
// drizzle mock
// ---------------------------------------------------------------------------

const mockDb = {
  select: jest.fn(() => ({
    from: jest.fn((table: { name?: string; _?: { name?: string } }) => {
      const isSession =
        table?.name === 'bulk_import_sessions' ||
        table?._?.name === 'bulk_import_sessions';
      return {
        where: jest.fn((cond: { value?: string }) => {
          const val = cond?.value;
          if (isSession) {
            const row = val ? sessionStore.get(val) : undefined;
            return Promise.resolve(row ? [row] : []);
          }
          const rows = [...itemStore.values()].filter((it) => it.sessionId === val);
          return Promise.resolve(rows);
        }),
      };
    }),
  })),
  update: jest.fn(() => ({
    set: jest.fn(() => ({
      where: jest.fn(() => {
        const thenable = Promise.resolve() as Promise<void> & { returning: () => Promise<unknown[]> };
        thenable.returning = () => Promise.resolve([]);
        return thenable;
      }),
    })),
  })),
};

jest.mock('../../../server/db', () => ({ db: mockDb }));

jest.mock('../../../server/auth', () => ({
  requireAuth: (req: express.Request & { user?: { id: string; role: string } }, _res: express.Response, next: express.NextFunction) => {
    req.user = { id: 'admin-1', role: 'admin' };
    next();
  },
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

const canAccessMock = jest.fn<() => Promise<boolean>>().mockResolvedValue(true);
jest.mock('../../../server/rbac', () => ({
  canUserAccessOrganization: (...args: unknown[]) => canAccessMock(...args as []),
}));

jest.mock('../../../server/services/bulk-import-analyzer', () => ({
  bulkImportAnalyzer: {
    suggestBranch: jest.fn(),
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

import { registerBulkImportRoutes } from '../../../server/api/bulk-import';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  registerBulkImportRoutes(app);
  return app;
}

const HISTORY = (id: string) => `/api/admin/bulk-import/sessions/${id}`;

interface EnrichedItem {
  id: string;
  screeningTypeGuess: string | null;
  screeningBucketGuess: string | null;
  screeningQaReason: string | null;
  screeningPeriodHint: string | null;
  screeningPeriodHintManualOverride: boolean;
}

beforeEach(() => {
  itemStore.clear();
  sessionStore.clear();
  canAccessMock.mockClear();
  canAccessMock.mockResolvedValue(true);
  jest.clearAllMocks();
});

// ===========================================================================
// Tests
// ===========================================================================

describe('GET /api/admin/bulk-import/sessions/:id — AI guess fields (Task #1320)', () => {
  it('returns { session, items } shape with items as an array', async () => {
    seedSession('sess-hist');
    seedItem('it-1', null);

    const res = await request(buildApp()).get(HISTORY('sess-hist')).expect(200);

    expect(res.body).toHaveProperty('session');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('items with a full screening blob expose all five AI guess fields with correct types', async () => {
    seedSession('sess-hist');
    seedItem('it-full', {
      periodHint: '2024-Q3',
      quickAnalysis: {
        typeGuess: 'invoice',
        bucketGuess: 'utility_bill',
        reason: 'Looks like a utility invoice from EDF',
      },
    });

    const res = await request(buildApp()).get(HISTORY('sess-hist')).expect(200);
    const item = res.body.items[0] as EnrichedItem;

    expect(item.screeningTypeGuess).toBe('invoice');
    expect(item.screeningBucketGuess).toBe('utility_bill');
    expect(item.screeningQaReason).toBe('Looks like a utility invoice from EDF');
    expect(item.screeningPeriodHint).toBe('2024-Q3');
    expect(typeof item.screeningPeriodHintManualOverride).toBe('boolean');
    expect(item.screeningPeriodHintManualOverride).toBe(false);
  });

  it('null screening → null string fields and false boolean flag', async () => {
    seedSession('sess-hist');
    seedItem('it-null', null);

    const res = await request(buildApp()).get(HISTORY('sess-hist')).expect(200);
    const item = res.body.items[0] as EnrichedItem;

    expect(item.screeningTypeGuess).toBeNull();
    expect(item.screeningBucketGuess).toBeNull();
    expect(item.screeningQaReason).toBeNull();
    expect(item.screeningPeriodHint).toBeNull();
    expect(item.screeningPeriodHintManualOverride).toBe(false);
  });

  it('blob without quickAnalysis still exposes screeningPeriodHint from periodHint key', async () => {
    seedSession('sess-hist');
    seedItem('it-noquick', { periodHint: '2025-2026' });

    const res = await request(buildApp()).get(HISTORY('sess-hist')).expect(200);
    const item = res.body.items[0] as EnrichedItem;

    expect(item.screeningPeriodHint).toBe('2025-2026');
    expect(item.screeningTypeGuess).toBeNull();
    expect(item.screeningBucketGuess).toBeNull();
    expect(item.screeningQaReason).toBeNull();
  });

  it('screeningPeriodHintManualOverride is true when periodHintManualOverride: true in blob', async () => {
    seedSession('sess-hist');
    seedItem('it-manual', {
      periodHint: '2023-2024',
      periodHintManualOverride: true,
      quickAnalysis: { typeGuess: 'insurance', bucketGuess: 'insurance', reason: 'cert' },
    });

    const res = await request(buildApp()).get(HISTORY('sess-hist')).expect(200);
    const item = res.body.items[0] as EnrichedItem;

    expect(item.screeningPeriodHintManualOverride).toBe(true);
    expect(item.screeningPeriodHint).toBe('2023-2024');
    expect(item.screeningTypeGuess).toBe('insurance');
  });

  it('all items in the session are enriched with AI guess fields', async () => {
    seedSession('sess-hist');
    seedItem('it-a', { quickAnalysis: { typeGuess: 'lease', bucketGuess: 'residential_lease', reason: 'Tenancy agreement' } });
    seedItem('it-b', { quickAnalysis: { typeGuess: 'invoice', bucketGuess: 'utility_bill', reason: 'EDF invoice' } });
    seedItem('it-c', null);

    const res = await request(buildApp()).get(HISTORY('sess-hist')).expect(200);
    expect(res.body.items).toHaveLength(3);

    const byId = Object.fromEntries(
      (res.body.items as EnrichedItem[]).map((it) => [it.id, it]),
    );

    expect(byId['it-a'].screeningTypeGuess).toBe('lease');
    expect(byId['it-b'].screeningTypeGuess).toBe('invoice');
    expect(byId['it-c'].screeningTypeGuess).toBeNull();
  });

  it('returns 404 when the session does not exist', async () => {
    const res = await request(buildApp()).get(HISTORY('no-such-session')).expect(404);
    expect(res.body.error).toMatch(/Session not found/i);
  });

  it('returns an empty items array when the session has no items', async () => {
    seedSession('sess-empty');

    const res = await request(buildApp()).get(HISTORY('sess-empty')).expect(200);
    expect(res.body.items).toHaveLength(0);
    expect((res.body.session as Session).id).toBe('sess-empty');
  });
});
