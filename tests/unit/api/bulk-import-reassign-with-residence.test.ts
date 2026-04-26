/**
 * Task #1083 — Per-item reassign endpoint extended to accept an
 * optional `residenceId` when the destination is `residence_documents`.
 *
 * Coverage:
 *  - Happy path: valid residenceId belonging to the session's building is
 *    persisted, `residenceManualOverride` is set correctly, and the item
 *    is promoted to `branched`.
 *  - AI-suggestion confirmation: when the saved residenceId matches the
 *    AI's original guess, `residenceManualOverride` is false and
 *    `residenceAiConfirmed` is true.
 *  - Unknown residenceId returns 404.
 *  - residenceId belonging to a different building is rejected with 400.
 *  - Forbidden org access is rejected with 403.
 *  - When destination is NOT `residence_documents`, an incoming
 *    `residenceId` is silently ignored and all residence fields on the
 *    existing decision are cleared.
 *  - Reassigning into `residence_documents` without a residenceId still
 *    saves destination/subCategory and leaves the item in `sorted`.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () => require('../../manual-mocks/drizzle-orm/pg-core'));

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
      branch: 'building_documents',
      subCategory: 'other',
      manualOverride: false,
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
  logWarn: jest.fn(),
}));

import { registerBulkImportRoutes } from '../../../server/api/bulk-import';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  registerBulkImportRoutes(app);
  return app;
}

const REASSIGN = (id: string) => `/api/admin/bulk-import/items/${id}/reassign`;

beforeEach(() => {
  itemStore.clear();
  sessionStore.clear();
  residenceStore.clear();
  canAccessMock.mockClear();
  canAccessMock.mockResolvedValue(true);
  jest.clearAllMocks();
});

describe('POST /api/admin/bulk-import/items/:id/reassign — with residenceId (Task #1083)', () => {
  it('happy path: persists residenceId, sets residenceManualOverride=true for a non-AI pick, and promotes to branched', async () => {
    seedSession('sess-1');
    seedResidence('res-1', 'building-1');
    seedItem('it-1', {
      status: 'sorted',
      branchDecision: {
        branch: 'building_documents',
        subCategory: 'other',
        residenceAiSuggestedId: null,
      },
    });

    const res = await request(buildApp())
      .post(REASSIGN('it-1'))
      .send({ branch: 'residence_documents', subCategory: 'lease', residenceId: 'res-1' });

    expect(res.status).toBe(200);
    const stored = itemStore.get('it-1')!;
    const bd = stored.branchDecision as Record<string, unknown>;
    expect(bd.residenceId).toBe('res-1');
    expect(bd.residenceManualOverride).toBe(true);
    expect(bd.residenceAiConfirmed).toBe(false);
    expect(stored.status).toBe('branched');
  });

  it('AI confirmation: when residenceId matches residenceAiSuggestedId, override is false and confirmed is true', async () => {
    seedSession('sess-1');
    seedResidence('res-ai', 'building-1');
    seedItem('it-2', {
      status: 'sorted',
      branchDecision: {
        branch: 'building_documents',
        subCategory: 'other',
        residenceAiSuggestedId: 'res-ai',
      },
    });

    const res = await request(buildApp())
      .post(REASSIGN('it-2'))
      .send({ branch: 'residence_documents', subCategory: 'other', residenceId: 'res-ai' });

    expect(res.status).toBe(200);
    const bd = (itemStore.get('it-2')!.branchDecision as Record<string, unknown>);
    expect(bd.residenceId).toBe('res-ai');
    expect(bd.residenceManualOverride).toBe(false);
    expect(bd.residenceAiConfirmed).toBe(true);
    expect(itemStore.get('it-2')!.status).toBe('branched');
  });

  it('returns 404 when the residenceId does not exist', async () => {
    seedSession('sess-1');
    seedItem('it-3', {
      status: 'sorted',
      branchDecision: { branch: 'building_documents', subCategory: 'other' },
    });

    const res = await request(buildApp())
      .post(REASSIGN('it-3'))
      .send({ branch: 'residence_documents', subCategory: 'other', residenceId: 'res-missing' });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: expect.stringContaining('Residence not found') });
  });

  it('returns 400 when residenceId belongs to a different building', async () => {
    seedSession('sess-1');
    seedResidence('res-other', 'building-OTHER');
    seedItem('it-4', {
      status: 'sorted',
      branchDecision: { branch: 'building_documents', subCategory: 'other' },
    });

    const res = await request(buildApp())
      .post(REASSIGN('it-4'))
      .send({ branch: 'residence_documents', subCategory: 'other', residenceId: 'res-other' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining('building') });
  });

  it('returns 403 when the user cannot access the org', async () => {
    canAccessMock.mockResolvedValue(false);
    seedSession('sess-1');
    seedResidence('res-1', 'building-1');
    seedItem('it-5', {
      status: 'sorted',
      branchDecision: { branch: 'building_documents', subCategory: 'other' },
    });

    const res = await request(buildApp())
      .post(REASSIGN('it-5'))
      .send({ branch: 'residence_documents', subCategory: 'other', residenceId: 'res-1' });

    expect(res.status).toBe(403);
  });

  it('ignores incoming residenceId and clears all residence fields when destination is not residence_documents', async () => {
    seedSession('sess-1');
    seedResidence('res-1', 'building-1');
    seedItem('it-6', {
      status: 'sorted',
      branchDecision: {
        branch: 'residence_documents',
        subCategory: 'other',
        residenceId: 'res-1',
        residenceManualOverride: true,
        residenceAiSuggestedId: 'res-ai',
        residenceAiConfirmed: false,
        residenceConfidence: 0.9,
        residenceReason: 'some reason',
        residenceFallbackReason: null,
      },
    });

    const res = await request(buildApp())
      .post(REASSIGN('it-6'))
      .send({ branch: 'building_documents', subCategory: 'other', residenceId: 'res-1' });

    expect(res.status).toBe(200);
    const bd = (itemStore.get('it-6')!.branchDecision as Record<string, unknown>);
    expect(bd.residenceId).toBeUndefined();
    expect(bd.residenceManualOverride).toBeUndefined();
    expect(bd.residenceAiSuggestedId).toBeUndefined();
    expect(bd.residenceAiConfirmed).toBeUndefined();
    expect(bd.residenceConfidence).toBeUndefined();
    expect(bd.residenceReason).toBeUndefined();
  });

  it('saves destination/subCategory without a residence and leaves status unchanged when no residenceId provided', async () => {
    seedSession('sess-1');
    seedItem('it-7', {
      status: 'sorted',
      branchDecision: { branch: 'building_documents', subCategory: 'other' },
    });

    const res = await request(buildApp())
      .post(REASSIGN('it-7'))
      .send({ branch: 'residence_documents', subCategory: 'lease' });

    expect(res.status).toBe(200);
    const stored = itemStore.get('it-7')!;
    const bd = stored.branchDecision as Record<string, unknown>;
    expect(bd.branch).toBe('residence_documents');
    expect(bd.subCategory).toBe('lease');
    expect(bd.residenceId).toBeUndefined();
    expect(stored.status).toBe('sorted');
  });
});
