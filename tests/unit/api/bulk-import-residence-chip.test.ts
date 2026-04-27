/**
 * Task #1320 — bandForConfidence thresholds and confirm-ai-residences endpoint.
 *
 * A. bandForConfidence: maps a raw float to the High/Medium/Low chip label.
 * B. POST .../confirm-ai-residences: bulk-confirms AI residence picks.
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
  status: string;
  branchDecision: Record<string, unknown>;
  updatedAt: Date;
  [key: string]: unknown;
}

interface Session {
  id: string;
  buildingId: string | null;
  organizationId: string;
}

const itemStore = new Map<string, Item>();
const sessionStore = new Map<string, Session>();

function seedSession(id: string, overrides: Partial<Session> = {}): Session {
  const base: Session = { id, buildingId: 'building-1', organizationId: 'org-1', ...overrides };
  sessionStore.set(id, base);
  return base;
}

function seedItem(id: string, overrides: Partial<Item> = {}): Item {
  const base: Item = {
    id,
    sessionId: 'sess-1',
    originalName: `${id}.pdf`,
    status: 'branched',
    branchDecision: {
      branch: 'residence_documents',
      subCategory: 'lease',
      residenceId: 'res-ai',
      residenceAiSuggestedId: 'res-ai',
      residenceConfidence: 0.88,
      residenceManualOverride: false,
      residenceAiConfirmed: false,
    },
    updatedAt: new Date(),
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
    set: jest.fn((updates: Partial<Item>) => ({
      where: jest.fn((cond: { value?: string }) => {
        const thenable = Promise.resolve() as Promise<void> & {
          returning: () => Promise<Item[]>;
        };
        thenable.returning = () => {
          const id = cond?.value;
          if (!id || !itemStore.has(id)) return Promise.resolve([]);
          const merged = { ...itemStore.get(id)!, ...updates } as Item;
          itemStore.set(id, merged);
          return Promise.resolve([merged]);
        };
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
import { bandForConfidence } from '../../../shared/schemas/bulk-import';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  registerBulkImportRoutes(app);
  return app;
}

const CONFIRM_ALL = (id: string) =>
  `/api/admin/bulk-import/sessions/${id}/items/confirm-ai-residences`;

beforeEach(() => {
  itemStore.clear();
  sessionStore.clear();
  canAccessMock.mockClear();
  canAccessMock.mockResolvedValue(true);
  jest.clearAllMocks();
});

// ===========================================================================
// A. bandForConfidence
// ===========================================================================

describe('bandForConfidence — confidence chip thresholds (Task #1320)', () => {
  it('returns "high" for confidence >= 0.8', () => {
    expect(bandForConfidence(0.8)).toBe('high');
    expect(bandForConfidence(0.9)).toBe('high');
    expect(bandForConfidence(1.0)).toBe('high');
  });

  it('returns "medium" for confidence in [0.5, 0.8)', () => {
    expect(bandForConfidence(0.5)).toBe('medium');
    expect(bandForConfidence(0.65)).toBe('medium');
    expect(bandForConfidence(0.799)).toBe('medium');
  });

  it('returns "low" for confidence < 0.5', () => {
    expect(bandForConfidence(0.0)).toBe('low');
    expect(bandForConfidence(0.3)).toBe('low');
    expect(bandForConfidence(0.499)).toBe('low');
  });

  it('returns "low" for null or undefined confidence', () => {
    expect(bandForConfidence(null)).toBe('low');
    expect(bandForConfidence(undefined)).toBe('low');
  });

  it('boundary: 0.8 → "high", 0.7999 → "medium"', () => {
    expect(bandForConfidence(0.8)).toBe('high');
    expect(bandForConfidence(0.7999)).toBe('medium');
  });

  it('boundary: 0.5 → "medium", 0.4999 → "low"', () => {
    expect(bandForConfidence(0.5)).toBe('medium');
    expect(bandForConfidence(0.4999)).toBe('low');
  });
});

// ===========================================================================
// B. POST /confirm-ai-residences
// ===========================================================================

describe('POST /confirm-ai-residences (Task #1320 / #803)', () => {
  it('happy path: eligible items are flipped to residenceAiConfirmed: true', async () => {
    seedSession('sess-1');
    seedItem('it-a');
    seedItem('it-b');

    const res = await request(buildApp())
      .post(CONFIRM_ALL('sess-1'))
      .send({})
      .expect(200);

    expect(res.body.updated).toBe(2);
    expect(res.body.items).toHaveLength(2);
    expect((itemStore.get('it-a')!.branchDecision as { residenceAiConfirmed: boolean }).residenceAiConfirmed).toBe(true);
    expect((itemStore.get('it-b')!.branchDecision as { residenceAiConfirmed: boolean }).residenceAiConfirmed).toBe(true);
  });

  it('skips items with status "committed"', async () => {
    seedSession('sess-1');
    seedItem('it-committed', { status: 'committed' });
    seedItem('it-eligible');

    const res = await request(buildApp()).post(CONFIRM_ALL('sess-1')).send({}).expect(200);

    expect(res.body.updated).toBe(1);
    expect((itemStore.get('it-committed')!.branchDecision as { residenceAiConfirmed: boolean }).residenceAiConfirmed).toBe(false);
  });

  it('skips items with status "rejected"', async () => {
    seedSession('sess-1');
    seedItem('it-rejected', { status: 'rejected' });

    const res = await request(buildApp()).post(CONFIRM_ALL('sess-1')).send({}).expect(200);
    expect(res.body.updated).toBe(0);
  });

  it('skips items with status "duplicate"', async () => {
    seedSession('sess-1');
    seedItem('it-dup', { status: 'duplicate' });

    const res = await request(buildApp()).post(CONFIRM_ALL('sess-1')).send({}).expect(200);
    expect(res.body.updated).toBe(0);
  });

  it('skips items whose current residenceId differs from the AI suggestion', async () => {
    seedSession('sess-1');
    seedItem('it-diff', {
      branchDecision: {
        branch: 'residence_documents',
        residenceId: 'res-manual',
        residenceAiSuggestedId: 'res-ai',
        residenceManualOverride: false,
        residenceAiConfirmed: false,
      },
    });

    const res = await request(buildApp()).post(CONFIRM_ALL('sess-1')).send({}).expect(200);
    expect(res.body.updated).toBe(0);
  });

  it('skips items with a manual override flag', async () => {
    seedSession('sess-1');
    seedItem('it-manual', {
      branchDecision: {
        branch: 'residence_documents',
        residenceId: 'res-ai',
        residenceAiSuggestedId: 'res-ai',
        residenceManualOverride: true,
        residenceAiConfirmed: false,
      },
    });

    const res = await request(buildApp()).post(CONFIRM_ALL('sess-1')).send({}).expect(200);
    expect(res.body.updated).toBe(0);
  });

  it('skips items already confirmed', async () => {
    seedSession('sess-1');
    seedItem('it-done', {
      branchDecision: {
        branch: 'residence_documents',
        residenceId: 'res-ai',
        residenceAiSuggestedId: 'res-ai',
        residenceManualOverride: false,
        residenceAiConfirmed: true,
      },
    });

    const res = await request(buildApp()).post(CONFIRM_ALL('sess-1')).send({}).expect(200);
    expect(res.body.updated).toBe(0);
  });

  it('skips items routed to a non-residence branch', async () => {
    seedSession('sess-1');
    seedItem('it-bill', {
      branchDecision: {
        branch: 'bill',
        residenceId: null,
        residenceAiSuggestedId: null,
        residenceManualOverride: false,
        residenceAiConfirmed: false,
      },
    });

    const res = await request(buildApp()).post(CONFIRM_ALL('sess-1')).send({}).expect(200);
    expect(res.body.updated).toBe(0);
  });

  it('returns 404 when the session is not found', async () => {
    const res = await request(buildApp()).post(CONFIRM_ALL('no-such-session')).send({}).expect(404);
    expect(res.body.error).toMatch(/Session not found/);
  });

  it('returns 0 updated when the session has no items', async () => {
    seedSession('sess-empty');

    const res = await request(buildApp()).post(CONFIRM_ALL('sess-empty')).send({}).expect(200);
    expect(res.body.updated).toBe(0);
    expect(res.body.items).toHaveLength(0);
  });
});
