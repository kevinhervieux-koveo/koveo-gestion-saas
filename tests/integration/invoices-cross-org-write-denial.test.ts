/**
 * @file Invoices Cross-Org Write Denial — Task #1306 regression coverage.
 *
 * Verifies that a manager pinned to org "alpha" cannot create, update, or
 * delete invoices whose `buildingId` lives in org "beta", and that
 * providing a `residenceId` that does not belong to the invoice's building
 * is rejected with RESIDENCE_BUILDING_MISMATCH.
 *
 * The test mirrors the approach used in
 * `tests/integration/bills-cross-org-write-denial.test.ts` — Express +
 * mocked db + mocked rbac, no real database required.
 */

import request from 'supertest';
import express from 'express';
import session from 'express-session';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const ORG_ALPHA = '00000000-0000-0000-0000-00000000aaaa';
const ORG_BETA = '00000000-0000-0000-0000-00000000bbbb';

const ALPHA_BUILDING = '00000000-0000-0000-0000-0000000000a1';
const BETA_BUILDING = '00000000-0000-0000-0000-0000000000b1';

const ALPHA_RESIDENCE = '00000000-0000-0000-0000-0000000000a3';
const BETA_RESIDENCE = '00000000-0000-0000-0000-0000000000b3';

const ALPHA_INVOICE_ID = '00000000-0000-0000-0000-0000000000a2';
const BETA_INVOICE_ID = '00000000-0000-0000-0000-0000000000b2';

const MANAGER_USER_ID = '00000000-0000-0000-0000-0000000000aa';

const buildingRowsById = new Map<string, any>();
const invoiceRowsById = new Map<string, any>();
const residenceRowsById = new Map<string, any>();

const mockDb = {
  select: jest.fn<any>(),
  insert: jest.fn<any>(),
  update: jest.fn<any>(),
  delete: jest.fn<any>(),
};

jest.mock('../../server/db', () => ({
  db: mockDb,
}));

jest.mock('../../server/mcp/server', () => ({
  buildWriteErrorResponse: jest.fn((_err: unknown) => ({
    status: 500,
    body: { error: 'mocked' },
  })),
  createMcpServer: jest.fn(),
}));

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((col: any, val: any) => ({ kind: 'eq', col, val })),
  and: jest.fn((...c: any[]) => ({ kind: 'and', conditions: c })),
  inArray: jest.fn((col: any, vals: any[]) => ({ kind: 'inArray', col, vals })),
  isNull: jest.fn((col: any) => ({ kind: 'isNull', col })),
  sql: Object.assign(jest.fn((s: any) => ({ sql: s })), {
    join: (p: any[]) => ({ sql: 'join', p }),
    raw: jest.fn((s: string) => ({ raw: s })),
  }),
}));

jest.mock('@shared/schema', () => {
  const buildingsTable = {
    id: 'buildings.id',
    organizationId: 'buildings.organizationId',
    isActive: 'buildings.isActive',
  };
  const residencesTable = {
    id: 'residences.id',
    buildingId: 'residences.buildingId',
  };
  const makeMockSchema: any = () => {
    const s: any = {
      parse: jest.fn((data: any) => data),
      partial: jest.fn(() => makeMockSchema()),
      omit: jest.fn(() => makeMockSchema()),
      extend: jest.fn(() => makeMockSchema()),
    };
    return s;
  };
  return {
    buildings: buildingsTable,
    residences: residencesTable,
    bills: { id: 'bills.id' },
    documents: { id: 'documents.id' },
    users: { id: 'users.id' },
    insertInvoiceSchema: makeMockSchema(),
    aiExtractionResponseSchema: makeMockSchema(),
  };
});

jest.mock('../../server/auth', () => {
  const passthrough = (_req: any, _res: any, next: any) => next();
  return {
    requireAuth: passthrough,
    requireRole: jest.fn(() => passthrough),
  };
});

jest.mock('../../server/storage', () => ({
  storage: {
    getInvoice: jest.fn<any>(async (id: string) => invoiceRowsById.get(id) ?? null),
    createInvoice: jest.fn<any>(async (data: any) => ({ id: 'new-id', ...data })),
    updateInvoice: jest.fn<any>(async (id: string, data: any) => ({
      id,
      ...(invoiceRowsById.get(id) ?? {}),
      ...data,
    })),
    deleteInvoice: jest.fn<any>(async () => true),
    getInvoices: jest.fn<any>(async () => []),
  },
}));

jest.mock('../../server/middleware/fileUpload', () => ({
  uploadInvoiceFile: (_req: any, _res: any, next: any) => next(),
  handleUploadError: jest.fn(),
}));

jest.mock('../../server/services/consolidated-ai-service', () => ({
  aiService: {
    extractInvoiceData: jest.fn<any>().mockResolvedValue({}),
    calculateConfidenceScore: jest.fn<any>().mockReturnValue(0.9),
    validateApiKey: jest.fn<any>().mockResolvedValue(true),
  },
}));

jest.mock('../../server/utils/logger', () => ({
  logDebug: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn(),
}));

// Pin the manager to ORG_ALPHA only.
jest.mock('../../server/rbac', () => ({
  getUserAccessibleOrganizations: jest.fn<any>(async () => [ORG_ALPHA]),
}));

import { registerInvoiceRoutes } from '../../server/api/invoices';

function buildSelectMock() {
  const state: { conditions: any[] } = { conditions: [] };
  const chain: any = {};

  const collectWhere = (cond: any) => {
    if (!cond) return;
    if (cond.kind === 'and' && Array.isArray(cond.conditions)) {
      cond.conditions.forEach(collectWhere);
      return;
    }
    state.conditions.push(cond);
  };

  const resolveRows = () => {
    const buildingEq = state.conditions.find(
      (c) => c?.kind === 'eq' && c?.col === 'buildings.id',
    );
    if (buildingEq) {
      const row = buildingRowsById.get(buildingEq.val);
      if (!row) return [];
      const isActiveCond = state.conditions.find(
        (c) => c?.kind === 'eq' && c?.col === 'buildings.isActive',
      );
      if (isActiveCond && row.isActive !== isActiveCond.val) return [];
      return [{ id: row.id, organizationId: row.organizationId }];
    }

    const residenceEq = state.conditions.find(
      (c) => c?.kind === 'eq' && c?.col === 'residences.id',
    );
    if (residenceEq) {
      const row = residenceRowsById.get(residenceEq.val);
      return row ? [{ buildingId: row.buildingId }] : [];
    }

    return [];
  };

  ['from', 'leftJoin', 'innerJoin', 'orderBy', 'groupBy', 'having', 'limit', 'offset'].forEach(
    (m) => {
      chain[m] = jest.fn(() => chain);
    },
  );
  chain.where = jest.fn((cond: any) => {
    collectWhere(cond);
    return chain;
  });
  chain.then = (resolve: any) => resolve(resolveRows());
  return chain;
}

describe('Task #1306 — Invoices cross-org write denial', () => {
  let app: express.Application;
  let agent: ReturnType<typeof request.agent>;

  beforeEach(() => {
    jest.clearAllMocks();
    buildingRowsById.clear();
    invoiceRowsById.clear();
    residenceRowsById.clear();

    buildingRowsById.set(ALPHA_BUILDING, {
      id: ALPHA_BUILDING,
      organizationId: ORG_ALPHA,
      isActive: true,
    });
    buildingRowsById.set(BETA_BUILDING, {
      id: BETA_BUILDING,
      organizationId: ORG_BETA,
      isActive: true,
    });

    residenceRowsById.set(ALPHA_RESIDENCE, {
      id: ALPHA_RESIDENCE,
      buildingId: ALPHA_BUILDING,
    });
    residenceRowsById.set(BETA_RESIDENCE, {
      id: BETA_RESIDENCE,
      buildingId: BETA_BUILDING,
    });

    invoiceRowsById.set(ALPHA_INVOICE_ID, {
      id: ALPHA_INVOICE_ID,
      buildingId: ALPHA_BUILDING,
      createdBy: MANAGER_USER_ID,
      title: 'Alpha Invoice',
      paymentType: 'one-time',
    });
    invoiceRowsById.set(BETA_INVOICE_ID, {
      id: BETA_INVOICE_ID,
      buildingId: BETA_BUILDING,
      createdBy: 'other-user',
      title: 'Beta Invoice',
      paymentType: 'one-time',
    });

    (mockDb.select as any).mockImplementation(() => buildSelectMock());

    app = express();
    app.use(express.json());
    app.use(
      session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false },
      }),
    );
    app.use((req: any, _res: any, next: any) => {
      req.user = {
        id: MANAGER_USER_ID,
        role: 'manager',
        email: 'alpha@example.com',
        firstName: 'Alpha',
        lastName: 'Manager',
        isActive: true,
      };
      next();
    });

    registerInvoiceRoutes(app as any);
    agent = request.agent(app);
  });

  it('rejects POST /api/invoices when buildingId belongs to a different organization', async () => {
    const res = await agent.post('/api/invoices').send({
      buildingId: BETA_BUILDING,
      title: 'Cross-org invoice',
      paymentType: 'one-time',
    });

    // 404 (not 403) to avoid confirming the building exists to a foreign org caller.
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('rejects PUT /api/invoices/:id for an invoice in a different organization', async () => {
    const res = await agent.put(`/api/invoices/${BETA_INVOICE_ID}`).send({
      title: 'Hijacked',
    });

    // 404 (not 403) — existence oracle prevention.
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('rejects DELETE /api/invoices/:id for an invoice in a different organization', async () => {
    const res = await agent.delete(`/api/invoices/${BETA_INVOICE_ID}`);

    // 404 (not 403) — existence oracle prevention.
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('rejects POST /api/invoices when residenceId belongs to a different building', async () => {
    const res = await agent.post('/api/invoices').send({
      buildingId: ALPHA_BUILDING,
      residenceId: BETA_RESIDENCE,
      title: 'Mismatched residence invoice',
      paymentType: 'one-time',
    });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('RESIDENCE_BUILDING_MISMATCH');
  });

  it('allows POST /api/invoices when buildingId and residenceId are in the same building', async () => {
    const res = await agent.post('/api/invoices').send({
      buildingId: ALPHA_BUILDING,
      residenceId: ALPHA_RESIDENCE,
      title: 'Valid invoice',
      paymentType: 'one-time',
    });

    expect([200, 201]).toContain(res.status);
  });

  it('allows POST /api/invoices when buildingId belongs to the caller organization', async () => {
    const res = await agent.post('/api/invoices').send({
      buildingId: ALPHA_BUILDING,
      title: 'Alpha invoice',
      paymentType: 'one-time',
    });

    expect([200, 201]).toContain(res.status);
  });

  it('rejects PUT /api/invoices/:id when payload contains a buildingId from a different organization', async () => {
    // Manager owns ALPHA_INVOICE but tries to reassign it to BETA_BUILDING.
    const res = await agent.put(`/api/invoices/${ALPHA_INVOICE_ID}`).send({
      buildingId: BETA_BUILDING,
      title: 'Reassigned to beta',
    });

    // 404 (not 403) — existence oracle prevention for the target building.
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('allows PUT /api/invoices/:id for an invoice in the caller organization', async () => {
    const res = await agent.put(`/api/invoices/${ALPHA_INVOICE_ID}`).send({
      title: 'Updated alpha invoice',
    });

    expect([200, 201]).toContain(res.status);
  });

  it('allows DELETE /api/invoices/:id for an invoice in the caller organization', async () => {
    const res = await agent.delete(`/api/invoices/${ALPHA_INVOICE_ID}`);

    expect([200, 204]).toContain(res.status);
  });
});
