/**
 * Task #1233 — Server-side integration tests for the per-item linking-decision
 * endpoint and the batch variant.
 *
 * POST /api/admin/bulk-import/items/:id/set-linking-decision
 *   Validates self-link guard, session membership, cycle detection, and the
 *   happy path (link two unrelated items, break a middle item out of a chain).
 *
 * POST /api/admin/bulk-import/sessions/:id/batch-set-linking-decisions
 *   Validates the atomic batch path including cycle rejection.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () => require('../../manual-mocks/drizzle-orm/pg-core'));

type LinkDecisions = {
  beforeItemId: string | null;
  afterItemId: string | null;
  manualOverride?: boolean;
};

type Item = {
  id: string;
  sessionId: string;
  linkDecisions: LinkDecisions | null;
  updatedAt?: Date;
  [key: string]: unknown;
};

const itemStore = new Map<string, Item>();

function seedItem(id: string, sessionId: string, linkDecisions: LinkDecisions | null = null): Item {
  const item: Item = { id, sessionId, linkDecisions };
  itemStore.set(id, item);
  return item;
}

function condValue(cond: any): unknown {
  if (!cond) return undefined;
  if ('value' in cond) return cond.value;
  return undefined;
}

function condColumnName(cond: any): string | undefined {
  return cond?.column?.name ?? cond?.column?.sqlName;
}

function makeReturning(item: Item | null) {
  const p: any = Promise.resolve();
  p.returning = () => Promise.resolve(item ? [item] : []);
  return p;
}

const mockDb: any = {
  select: jest.fn((projection?: any) => ({
    from: jest.fn(() => ({
      where: jest.fn((cond: any) => {
        const colName = condColumnName(cond);
        const value = condValue(cond) as string | undefined;
        if (colName === 'session_id') {
          const sessionItems = Array.from(itemStore.values()).filter(
            (i) => i.sessionId === value,
          );
          return Promise.resolve(sessionItems);
        }
        const item = value ? itemStore.get(value) : undefined;
        return Promise.resolve(item ? [item] : []);
      }),
    })),
  })),
  update: jest.fn(() => ({
    set: jest.fn((updates: Partial<Item>) => ({
      where: jest.fn((cond: any) => {
        const value = condValue(cond) as string | undefined;
        if (!value || !itemStore.has(value)) return makeReturning(null);
        const existing = itemStore.get(value)!;
        const merged: Item = { ...existing, ...updates };
        itemStore.set(value, merged);
        return makeReturning(merged);
      }),
    })),
  })),
  transaction: jest.fn(async (fn: (tx: any) => Promise<any>) => {
    const txDb: any = {
      update: jest.fn(() => ({
        set: jest.fn((updates: Partial<Item>) => ({
          where: jest.fn((cond: any) => {
            const value = condValue(cond) as string | undefined;
            if (!value || !itemStore.has(value)) return makeReturning(null);
            const existing = itemStore.get(value)!;
            const merged: Item = { ...existing, ...updates };
            itemStore.set(value, merged);
            const p: any = Promise.resolve();
            p.returning = () => Promise.resolve([{ id: merged.id }]);
            return p;
          }),
        })),
      })),
    };
    return fn(txDb);
  }),
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

const ITEM_URL = (id: string) =>
  `/api/admin/bulk-import/items/${id}/set-linking-decision`;

const BATCH_URL = (sessionId: string) =>
  `/api/admin/bulk-import/sessions/${sessionId}/batch-set-linking-decisions`;

const SESSION = 'sess-link-1';

beforeEach(() => {
  itemStore.clear();
  jest.clearAllMocks();
});

describe('POST /api/admin/bulk-import/items/:id/set-linking-decision (Task #1233)', () => {
  it('links two unrelated items: sets afterItemId and stamps manualOverride', async () => {
    seedItem('doc-a', SESSION, null);
    seedItem('doc-b', SESSION, null);

    const res = await request(buildApp())
      .post(ITEM_URL('doc-a'))
      .send({ beforeItemId: null, afterItemId: 'doc-b' })
      .expect(200);

    const ld = res.body.linkDecisions as LinkDecisions;
    expect(ld.afterItemId).toBe('doc-b');
    expect(ld.beforeItemId).toBeNull();
    expect(ld.manualOverride).toBe(true);
    expect(itemStore.get('doc-a')!.linkDecisions?.afterItemId).toBe('doc-b');
  });

  it('breaks a middle item out of a chain: clears both before and after', async () => {
    seedItem('doc-a', SESSION, { beforeItemId: null, afterItemId: 'doc-b', manualOverride: true });
    seedItem('doc-b', SESSION, { beforeItemId: 'doc-a', afterItemId: 'doc-c', manualOverride: true });
    seedItem('doc-c', SESSION, { beforeItemId: 'doc-b', afterItemId: null, manualOverride: true });

    const res = await request(buildApp())
      .post(ITEM_URL('doc-b'))
      .send({ beforeItemId: null, afterItemId: null })
      .expect(200);

    const ld = res.body.linkDecisions as LinkDecisions;
    expect(ld.beforeItemId).toBeNull();
    expect(ld.afterItemId).toBeNull();
    expect(ld.manualOverride).toBe(true);
  });

  it('returns 400 with cycle error when the change would create a circular chain', async () => {
    seedItem('doc-a', SESSION, { beforeItemId: null, afterItemId: 'doc-b', manualOverride: true });
    seedItem('doc-b', SESSION, { beforeItemId: 'doc-a', afterItemId: null, manualOverride: true });

    const res = await request(buildApp())
      .post(ITEM_URL('doc-b'))
      .send({ beforeItemId: 'doc-a', afterItemId: 'doc-a' })
      .expect(400);

    expect(res.body.error).toMatch(/cycle/i);
    expect(itemStore.get('doc-b')!.linkDecisions?.afterItemId).toBeNull();
  });

  it('returns 400 for a self-link (afterItemId === itemId)', async () => {
    seedItem('doc-a', SESSION, null);

    const res = await request(buildApp())
      .post(ITEM_URL('doc-a'))
      .send({ beforeItemId: null, afterItemId: 'doc-a' })
      .expect(400);

    expect(res.body.error).toMatch(/self-link/i);
  });

  it('returns 400 when afterItemId is not in the same session', async () => {
    seedItem('doc-a', SESSION, null);
    seedItem('other-item', 'different-session', null);

    const res = await request(buildApp())
      .post(ITEM_URL('doc-a'))
      .send({ beforeItemId: null, afterItemId: 'other-item' })
      .expect(400);

    expect(res.body.error).toMatch(/session/i);
  });

  it('returns 404 for an unknown item id', async () => {
    const res = await request(buildApp())
      .post(ITEM_URL('does-not-exist'))
      .send({ beforeItemId: null, afterItemId: null })
      .expect(404);

    expect(res.body.error).toMatch(/not found/i);
  });
});

describe('POST /api/admin/bulk-import/sessions/:id/batch-set-linking-decisions (Task #1233)', () => {
  it('atomically links three items in a chain', async () => {
    seedItem('doc-a', SESSION, null);
    seedItem('doc-b', SESSION, null);
    seedItem('doc-c', SESSION, null);

    const res = await request(buildApp())
      .post(BATCH_URL(SESSION))
      .send({
        decisions: [
          { itemId: 'doc-a', beforeItemId: null, afterItemId: 'doc-b' },
          { itemId: 'doc-b', beforeItemId: 'doc-a', afterItemId: 'doc-c' },
          { itemId: 'doc-c', beforeItemId: 'doc-b', afterItemId: null },
        ],
      })
      .expect(200);

    expect(res.body.updated).toContain('doc-a');
    expect(res.body.updated).toContain('doc-b');
    expect(res.body.updated).toContain('doc-c');
    expect(itemStore.get('doc-a')!.linkDecisions?.afterItemId).toBe('doc-b');
    expect(itemStore.get('doc-c')!.linkDecisions?.beforeItemId).toBe('doc-b');
  });

  it('rejects a batch with a cycle and leaves the store untouched', async () => {
    seedItem('doc-a', SESSION, null);
    seedItem('doc-b', SESSION, null);

    const snapshotA = { ...itemStore.get('doc-a')! };
    const snapshotB = { ...itemStore.get('doc-b')! };

    const res = await request(buildApp())
      .post(BATCH_URL(SESSION))
      .send({
        decisions: [
          { itemId: 'doc-a', beforeItemId: 'doc-b', afterItemId: 'doc-b' },
          { itemId: 'doc-b', beforeItemId: 'doc-a', afterItemId: 'doc-a' },
        ],
      })
      .expect(400);

    expect(res.body.error).toMatch(/cycle/i);
    expect(itemStore.get('doc-a')!.linkDecisions).toEqual(snapshotA.linkDecisions);
    expect(itemStore.get('doc-b')!.linkDecisions).toEqual(snapshotB.linkDecisions);
  });

  it('returns 400 when an itemId does not belong to the session', async () => {
    seedItem('doc-a', SESSION, null);
    seedItem('outsider', 'other-session', null);

    const res = await request(buildApp())
      .post(BATCH_URL(SESSION))
      .send({
        decisions: [
          { itemId: 'doc-a', beforeItemId: null, afterItemId: 'outsider' },
        ],
      })
      .expect(400);

    expect(res.body.error).toMatch(/session/i);
  });

  it('returns 404 when the session has no items', async () => {
    const res = await request(buildApp())
      .post(BATCH_URL('empty-session'))
      .send({
        decisions: [
          { itemId: 'ghost', beforeItemId: null, afterItemId: null },
        ],
      })
      .expect(404);

    expect(res.body.error).toMatch(/session not found/i);
  });
});
