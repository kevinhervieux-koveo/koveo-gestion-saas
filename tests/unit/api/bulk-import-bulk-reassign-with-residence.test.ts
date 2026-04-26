/**
 * Task #1084 — Bulk reassign endpoint extended to accept an optional
 * `residenceId` and apply it to every eligible item in one call.
 *
 * Mirrors the per-item residence coverage in
 * `bulk-import-reassign-with-residence.test.ts`, scoped to the
 * `/sessions/:id/items/reassign-bulk` route. The bulk endpoint reuses
 * the same per-item residence rules (manual-override flag, AI
 * confirmation flag, promotion to `branched`) so this suite locks in
 * the bulk shape — happy path with mixed AI/manual picks, validation
 * shortcuts on bad residenceId, and the no-residence path that still
 * moves the destination/sub-category without touching residenceId.
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

/**
 * The bulk reassign route fires three different SELECTs:
 *   1. SELECT id, buildingId FROM residences WHERE eq(id, ...)
 *   2. SELECT * FROM bulk_import_items WHERE and(eq(sessionId, ...), inArray(id, ...))
 *   3. (loadSession already mocked separately via session store)
 * The shape of `cond` differs between them; the helpers below pull the
 * relevant primary key out of each cond shape so the in-memory stores
 * can return the right rows.
 */
function condEqValue(cond: any): unknown {
  if (!cond) return undefined;
  if ('value' in cond) return cond.value;
  return undefined;
}

function condInArrayValues(cond: any): string[] | undefined {
  if (!cond) return undefined;
  if (cond.type === 'and' && Array.isArray(cond.conditions)) {
    for (const c of cond.conditions) {
      if (c?.operator === 'in' && Array.isArray(c.values)) {
        return c.values as string[];
      }
    }
  }
  if (cond.operator === 'in' && Array.isArray(cond.values)) {
    return cond.values as string[];
  }
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
          if (lastSelectTable === 'sessions') {
            const id = condEqValue(cond) as string | undefined;
            const row = id ? sessionStore.get(id) : undefined;
            return Promise.resolve(row ? [row] : []);
          }
          if (lastSelectTable === 'residences') {
            const id = condEqValue(cond) as string | undefined;
            const row = id ? residenceStore.get(id) : undefined;
            return Promise.resolve(row ? [row] : []);
          }
          // items: bulk reassign uses inArray, per-id lookups use eq
          const ids = condInArrayValues(cond);
          if (ids) {
            const rows: Item[] = [];
            for (const id of ids) {
              const r = itemStore.get(id);
              if (r) rows.push(r);
            }
            return Promise.resolve(rows);
          }
          const id = condEqValue(cond) as string | undefined;
          const row = id ? itemStore.get(id) : undefined;
          return Promise.resolve(row ? [row] : []);
        }),
      };
    }),
  })),
  update: jest.fn(() => ({
    set: jest.fn((updates: Partial<Item>) => ({
      where: jest.fn((cond: any) => {
        const id = condEqValue(cond) as string | undefined;
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

const BULK = (sid: string) => `/api/admin/bulk-import/sessions/${sid}/items/reassign-bulk`;

beforeEach(() => {
  itemStore.clear();
  sessionStore.clear();
  residenceStore.clear();
  canAccessMock.mockClear();
  canAccessMock.mockResolvedValue(true);
  jest.clearAllMocks();
});

describe('POST /sessions/:id/items/reassign-bulk — with residenceId (Task #1084)', () => {
  it('happy path: stamps the residence on every eligible item, sets manualOverride correctly per-row, and promotes them to branched', async () => {
    seedSession('sess-1');
    seedResidence('res-1', 'building-1');
    // it-a has no AI suggestion — saving a manual residence flips the
    // manual-override flag on. it-b's AI suggestion matches the chosen
    // residence — saving it counts as confirming the AI's pick.
    seedItem('it-a', {
      status: 'sorted',
      branchDecision: { branch: 'building_documents', subCategory: 'other' },
    });
    seedItem('it-b', {
      status: 'sorted',
      branchDecision: {
        branch: 'building_documents',
        subCategory: 'other',
        residenceAiSuggestedId: 'res-1',
      },
    });

    const res = await request(buildApp())
      .post(BULK('sess-1'))
      .send({
        branch: 'residence_documents',
        subCategory: 'lease',
        itemIds: ['it-a', 'it-b'],
        residenceId: 'res-1',
      });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(2);

    const a = itemStore.get('it-a')!;
    const aBd = a.branchDecision as Record<string, unknown>;
    expect(aBd.branch).toBe('residence_documents');
    expect(aBd.subCategory).toBe('lease');
    expect(aBd.residenceId).toBe('res-1');
    expect(aBd.residenceManualOverride).toBe(true);
    expect(aBd.residenceAiConfirmed).toBe(false);
    expect(a.status).toBe('branched');

    const b = itemStore.get('it-b')!;
    const bBd = b.branchDecision as Record<string, unknown>;
    expect(bBd.residenceId).toBe('res-1');
    expect(bBd.residenceManualOverride).toBe(false);
    expect(bBd.residenceAiConfirmed).toBe(true);
    expect(b.status).toBe('branched');
  });

  it('returns 404 when the residenceId does not exist (and never updates any row)', async () => {
    seedSession('sess-1');
    seedItem('it-1', {
      branchDecision: { branch: 'building_documents', subCategory: 'other' },
    });
    const before = JSON.parse(JSON.stringify(itemStore.get('it-1')));

    const res = await request(buildApp())
      .post(BULK('sess-1'))
      .send({
        branch: 'residence_documents',
        subCategory: 'other',
        itemIds: ['it-1'],
        residenceId: 'res-missing',
      });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: expect.stringContaining('Residence not found') });
    expect(itemStore.get('it-1')).toEqual(before);
  });

  it('returns 400 when residenceId belongs to a different building', async () => {
    seedSession('sess-1');
    seedResidence('res-other', 'building-OTHER');
    seedItem('it-1', {
      branchDecision: { branch: 'building_documents', subCategory: 'other' },
    });

    const res = await request(buildApp())
      .post(BULK('sess-1'))
      .send({
        branch: 'residence_documents',
        subCategory: 'other',
        itemIds: ['it-1'],
        residenceId: 'res-other',
      });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining('building') });
  });

  it('returns 403 when the user cannot access the org', async () => {
    canAccessMock.mockResolvedValue(false);
    seedSession('sess-1');
    seedResidence('res-1', 'building-1');
    seedItem('it-1', {
      branchDecision: { branch: 'building_documents', subCategory: 'other' },
    });

    const res = await request(buildApp())
      .post(BULK('sess-1'))
      .send({
        branch: 'residence_documents',
        subCategory: 'other',
        itemIds: ['it-1'],
        residenceId: 'res-1',
      });

    expect(res.status).toBe(403);
  });

  it('without a residenceId, still moves destination/subCategory and leaves status untouched (no residence side-effects)', async () => {
    seedSession('sess-1');
    seedItem('it-1', {
      status: 'sorted',
      branchDecision: { branch: 'building_documents', subCategory: 'other' },
    });

    const res = await request(buildApp())
      .post(BULK('sess-1'))
      .send({
        branch: 'residence_documents',
        subCategory: 'lease',
        itemIds: ['it-1'],
      });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(1);
    const stored = itemStore.get('it-1')!;
    const bd = stored.branchDecision as Record<string, unknown>;
    expect(bd.branch).toBe('residence_documents');
    expect(bd.subCategory).toBe('lease');
    expect(bd.residenceId).toBeUndefined();
    // Status stays at sorted because no residence was applied — the
    // per-row residence picker still has to be used to promote it.
    expect(stored.status).toBe('sorted');
  });

  it('ignores residenceId entirely when destination is not residence_documents', async () => {
    seedSession('sess-1');
    seedResidence('res-1', 'building-1');
    seedItem('it-1', {
      status: 'sorted',
      branchDecision: {
        branch: 'residence_documents',
        subCategory: 'other',
        residenceId: 'res-old',
        residenceManualOverride: true,
        residenceAiSuggestedId: 'res-old',
        residenceAiConfirmed: true,
      },
    });

    const res = await request(buildApp())
      .post(BULK('sess-1'))
      .send({
        branch: 'building_documents',
        subCategory: 'other',
        itemIds: ['it-1'],
        residenceId: 'res-1',
      });

    expect(res.status).toBe(200);
    const bd = (itemStore.get('it-1')!.branchDecision as Record<string, unknown>);
    expect(bd.branch).toBe('building_documents');
    // Same cleanup as the per-file reassign endpoint.
    expect(bd.residenceId).toBeUndefined();
    expect(bd.residenceManualOverride).toBeUndefined();
    expect(bd.residenceAiSuggestedId).toBeUndefined();
    expect(bd.residenceAiConfirmed).toBeUndefined();
  });
});
