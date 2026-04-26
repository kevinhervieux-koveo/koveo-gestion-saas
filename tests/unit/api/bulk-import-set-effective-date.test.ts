/**
 * Task #1031 — Server-side coverage for the inline effective-date editor
 * added to the identification step of the bulk-document-import wizard.
 *
 * The endpoint POST /api/admin/bulk-import/items/:id/set-effective-date
 * lets an admin override the AI-detected `identification.effectiveDate`
 * on a single staged item. The handler must:
 *
 *   - Merge the new value into the existing `identification` blob so
 *     sibling fields the AI also writes (`name`, `description`, `tags`,
 *     `confidence`, …) are preserved untouched.
 *   - Stamp `identification.effectiveDateManualOverride = true` when a
 *     date is set, so the wizard can hide the "from screening" chip
 *     once the admin owns the value.
 *   - Strip both the date and the override marker when the admin
 *     clears the field, so a later AI re-identify can repopulate them.
 *   - Reject malformed dates (wrong shape, non-calendar dates) with
 *     a 400 instead of writing garbage into the JSONB column.
 *   - Reject access from admins who don't belong to the session's
 *     organization with a 403.
 *   - Return 404 when the item id is unknown.
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

const itemStore = new Map<string, Item>();
const sessionStore = new Map<string, Session>();

function seedItem(id: string, overrides: Partial<Item> = {}): Item {
  const base: Item = {
    id,
    sessionId: 'sess-1',
    originalName: `${id}.pdf`,
    stagedPath: `/staging/${id}.pdf`,
    mimeType: 'application/pdf',
    status: 'identified',
    identification: {
      name: 'AI-detected name',
      description: 'AI-detected description',
      tags: ['ai-tag'],
      confidence: 0.92,
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

let lastSelectTable: 'items' | 'sessions' | null = null;

const mockDb: any = {
  select: jest.fn(() => ({
    from: jest.fn((table: any) => {
      if (table?.name === 'bulk_import_sessions' || table?._?.name === 'bulk_import_sessions') {
        lastSelectTable = 'sessions';
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

beforeEach(() => {
  itemStore.clear();
  sessionStore.clear();
  canAccessMock.mockClear();
  canAccessMock.mockResolvedValue(true);
  jest.clearAllMocks();
});

const URL = (id: string) =>
  `/api/admin/bulk-import/items/${id}/set-effective-date`;

describe('POST /api/admin/bulk-import/items/:id/set-effective-date (Task #1031)', () => {
  it('happy path: writes effectiveDate, stamps the manual-override flag, and preserves sibling fields', async () => {
    seedSession('sess-1');
    seedItem('it-1');

    const res = await request(buildApp())
      .post(URL('it-1'))
      .send({ effectiveDate: '2024-03-15' })
      .expect(200);

    const ident = (res.body.identification ?? {}) as Record<string, unknown>;
    expect(ident.effectiveDate).toBe('2024-03-15');
    expect(ident.effectiveDateManualOverride).toBe(true);
    // Other identification fields the AI wrote are not clobbered by the merge.
    expect(ident.name).toBe('AI-detected name');
    expect(ident.description).toBe('AI-detected description');
    expect(ident.tags).toEqual(['ai-tag']);
    expect(ident.confidence).toBe(0.92);
  });

  it('seeds a fresh identification blob when the item has none yet', async () => {
    seedSession('sess-1');
    seedItem('it-fresh', { identification: null });

    const res = await request(buildApp())
      .post(URL('it-fresh'))
      .send({ effectiveDate: '2025-01-01' })
      .expect(200);

    const ident = (res.body.identification ?? {}) as Record<string, unknown>;
    expect(ident.effectiveDate).toBe('2025-01-01');
    expect(ident.effectiveDateManualOverride).toBe(true);
  });

  it('clearing the field (null) drops both the date and the override marker', async () => {
    seedSession('sess-1');
    seedItem('it-cleared', {
      identification: {
        name: 'Doc',
        effectiveDate: '2024-03-15',
        effectiveDateManualOverride: true,
      } as Record<string, unknown>,
    });

    const res = await request(buildApp())
      .post(URL('it-cleared'))
      .send({ effectiveDate: null })
      .expect(200);

    const ident = (res.body.identification ?? {}) as Record<string, unknown>;
    expect(ident.effectiveDate).toBeUndefined();
    expect(ident.effectiveDateManualOverride).toBeUndefined();
    // Sibling field survives the clear.
    expect(ident.name).toBe('Doc');
  });

  it('rejects malformed shapes with a 400 (wrong format)', async () => {
    seedSession('sess-1');
    seedItem('it-bad');

    const res = await request(buildApp())
      .post(URL('it-bad'))
      .send({ effectiveDate: '03/15/2024' })
      .expect(400);

    expect(res.body.error).toBeDefined();
    // The item's identification must be untouched on the failure path.
    const stored = (itemStore.get('it-bad')!.identification ?? {}) as Record<string, unknown>;
    expect(stored.effectiveDate).toBeUndefined();
  });

  it('rejects non-calendar dates (e.g. Feb 31) with a 400', async () => {
    seedSession('sess-1');
    seedItem('it-feb31');

    const res = await request(buildApp())
      .post(URL('it-feb31'))
      .send({ effectiveDate: '2024-02-31' })
      .expect(400);

    expect(res.body.error).toMatch(/valid calendar date/i);
    const stored = (itemStore.get('it-feb31')!.identification ?? {}) as Record<string, unknown>;
    expect(stored.effectiveDate).toBeUndefined();
  });

  it('returns 404 for an unknown item id', async () => {
    seedSession('sess-1');

    const res = await request(buildApp())
      .post(URL('does-not-exist'))
      .send({ effectiveDate: '2024-03-15' })
      .expect(404);

    expect(res.body.error).toMatch(/Item not found/);
  });

  it('returns 403 when the admin cannot access the session organization', async () => {
    seedSession('sess-1');
    seedItem('it-1');
    canAccessMock.mockResolvedValueOnce(false);

    const res = await request(buildApp())
      .post(URL('it-1'))
      .send({ effectiveDate: '2024-03-15' })
      .expect(403);

    expect(res.body.error).toMatch(/do not have access/i);
    // Identification must be untouched on the access-denied path.
    const stored = (itemStore.get('it-1')!.identification ?? {}) as Record<string, unknown>;
    expect(stored.effectiveDate).toBeUndefined();
  });
});
