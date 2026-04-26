/**
 * Task #1102 — Defensive server-side coverage for the residence-branch
 * Save flow.
 *
 * Background
 * ----------
 * Task #1101 added a client-side guard to the Sorting / Branching step
 * of the bulk-document-import wizard so the Save button is disabled
 * when an admin reassigns an item to `residence_documents` but has not
 * picked a residence. The implementation notes for that task claimed
 * "the server already handles a missing residenceId correctly", but
 * there was no automated test pinning that claim. A motivated admin
 * (e.g. somebody crafting a curl request) or a future refactor of the
 * client could easily bypass the disabled-button guard and POST to the
 * reassign endpoint with `branch: "residence_documents"` and no
 * `residenceId`. If the server were to silently persist such an
 * incomplete record — e.g. mark the item `branched` while leaving the
 * residence linkage empty — the document would graduate to the next
 * wizard step and almost certainly be saved against the wrong (or no)
 * residence.
 *
 * What this file pins
 * -------------------
 * The reassign endpoint's documented "no-op" behaviour for the
 * residence-without-id case:
 *
 *   POST /api/admin/bulk-import/items/:id/reassign
 *     body: { branch: "residence_documents", subCategory: "lease" }
 *           // residenceId intentionally omitted
 *
 *   - The request succeeds with HTTP 200 (the destination/sub-category
 *     pair is still recorded so the admin's partial pick is not lost).
 *   - No residence-related fields are written to `branchDecision`
 *     (no residenceId, no residenceManualOverride, no
 *     residenceAiConfirmed). A broken fallback that defaulted any of
 *     these would be caught here.
 *   - The item's `status` is left at its previous value (`sorted`) and
 *     is NOT promoted to `branched`. The promotion to `branched` is
 *     what gates the item out of the Sorting step into the next
 *     wizard step, so leaving it at `sorted` is what keeps an
 *     incomplete record from leaking forward.
 *
 * The same three properties are also asserted for the explicit
 * `residenceId: null` shape, which is the other way the client (or a
 * curl-wielding admin) can express "no residence chosen". This guards
 * against a future refactor that adds a `null`-vs-`undefined` branch
 * to the handler and treats one of them as "promote anyway".
 *
 * Sibling file: bulk-import-reassign-with-residence.test.ts already
 * exercises the happy path (Task #1083). This file deliberately
 * focuses on the Task #1101-defensive shape so a regression search
 * for "1101" / "1102" lands directly on the relevant assertions.
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

describe('POST /api/admin/bulk-import/items/:id/reassign — residence_documents WITHOUT residenceId (Task #1102 defensive guard for #1101)', () => {
  it('omitted residenceId: records destination/subCategory, writes NO residence fields, and leaves status at "sorted" (not promoted to "branched")', async () => {
    seedSession('sess-1');
    seedItem('it-no-res-1', {
      status: 'sorted',
      branchDecision: { branch: 'building_documents', subCategory: 'other' },
    });

    const res = await request(buildApp())
      .post(REASSIGN('it-no-res-1'))
      // residenceId intentionally omitted — this is what an admin who
      // bypassed the Task #1101 disabled Save button would send.
      .send({ branch: 'residence_documents', subCategory: 'lease' });

    expect(res.status).toBe(200);

    const stored = itemStore.get('it-no-res-1')!;
    const bd = stored.branchDecision as Record<string, unknown>;

    // Partial pick is preserved.
    expect(bd.branch).toBe('residence_documents');
    expect(bd.subCategory).toBe('lease');

    // Critical defensive assertions: NO residence fields are written.
    expect(bd.residenceId).toBeUndefined();
    expect(bd.residenceManualOverride).toBeUndefined();
    expect(bd.residenceAiConfirmed).toBeUndefined();

    // Critical defensive assertion: status is NOT promoted, so the
    // item stays in the Sorting step instead of leaking forward
    // with an empty residence linkage.
    expect(stored.status).toBe('sorted');
  });

  it('explicit residenceId: null behaves identically to an omitted residenceId — no residence fields, status stays "sorted"', async () => {
    seedSession('sess-1');
    seedItem('it-no-res-2', {
      status: 'sorted',
      branchDecision: { branch: 'building_documents', subCategory: 'other' },
    });

    const res = await request(buildApp())
      .post(REASSIGN('it-no-res-2'))
      .send({
        branch: 'residence_documents',
        subCategory: 'lease',
        residenceId: null,
      });

    expect(res.status).toBe(200);

    const stored = itemStore.get('it-no-res-2')!;
    const bd = stored.branchDecision as Record<string, unknown>;

    expect(bd.branch).toBe('residence_documents');
    expect(bd.subCategory).toBe('lease');
    expect(bd.residenceId).toBeUndefined();
    expect(bd.residenceManualOverride).toBeUndefined();
    expect(bd.residenceAiConfirmed).toBeUndefined();
    expect(stored.status).toBe('sorted');
  });

  it('does not consult the residences table when no residenceId is supplied (no spurious 404 from a missing residence row)', async () => {
    // residenceStore is intentionally empty — proves the handler
    // skips the residence lookup entirely instead of bailing out
    // with 404 "Residence not found".
    seedSession('sess-1');
    seedItem('it-no-res-3', {
      status: 'sorted',
      branchDecision: { branch: 'building_documents', subCategory: 'other' },
    });

    const res = await request(buildApp())
      .post(REASSIGN('it-no-res-3'))
      .send({ branch: 'residence_documents', subCategory: 'other' });

    expect(res.status).toBe(200);
    expect(res.body).not.toMatchObject({ error: expect.stringContaining('Residence') });
  });
});
