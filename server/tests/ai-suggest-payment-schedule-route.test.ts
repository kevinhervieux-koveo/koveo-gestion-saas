// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
/**
 * @jest-environment node
 *
 * Route-level tests for `POST /api/bills/:id/apply-ai-analysis`
 * (server/api/bills.ts:2396), the only route that calls
 * `aiService.suggestPaymentSchedule`.
 *
 * Mirrors the singleton-mocking pattern in `ai-document-analyze.test.ts`:
 *   - the `aiService` singleton is replaced so the route never hits Gemini
 *   - the real `ConsolidatedAIService` class export stays intact (Task #497
 *     covers the service-level behavior)
 *
 * Covers:
 *   - happy path: getBillById returns an analyzed bill → suggestPaymentSchedule
 *     is called with the AI category/amount → updated bill is returned
 *   - bill not found → 404 (input validation)
 *   - bill exists but has no AI analysis data → 400 (input validation)
 *   - suggestPaymentSchedule throws → 500
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// --- Mock the singleton AI service so the route never touches Gemini ---
jest.mock('../services/consolidated-ai-service', () => {
  const actual = jest.requireActual<typeof import('../services/consolidated-ai-service')>(
    '../services/consolidated-ai-service'
  );
  return {
    __esModule: true,
    ...actual,
    aiService: {
      suggestPaymentSchedule: jest.fn(),
      analyzeBillDocument: jest.fn(),
      extractBillData: jest.fn(),
    },
  };
});

// --- requireAuth: dynamic per-test user via mutable holder ---
const userHolder: { user: any } = {
  user: { id: 'test-user', role: 'admin' },
};
jest.mock('../auth', () => ({
  __esModule: true,
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = userHolder.user;
    next();
  },
}));

// --- Mock getBillById so the route reads from a controlled fixture ---
const getBillByIdMock = jest.fn();
jest.mock('../db/queries/bills-queries', () => {
  const actual = jest.requireActual<typeof import('../db/queries/bills-queries')>(
    '../db/queries/bills-queries'
  );
  return {
    __esModule: true,
    ...actual,
    getBillById: (...args: any[]) => getBillByIdMock(...args),
  };
});

// --- Mock the drizzle `db` so update().set().where().returning() resolves ---
// without actually hitting Postgres. The real db module loads neon-serverless
// and would otherwise try to open a websocket on first query.
const returningMock = jest.fn();
jest.mock('../db', () => ({
  __esModule: true,
  db: {
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(() => ({
          returning: returningMock,
        })),
      })),
    })),
    // Some sibling modules (e.g. payment-generation-service) probe these on
    // import. Provide minimal stubs so loading bills.ts doesn't fail.
    select: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
  },
}));

// --- Task #1271: stub the org-scope helpers so the apply-ai-analysis route
// passes the new write-access gate without us having to hand-mock the
// buildings + rbac db chain in this AI-focused test. The helpers are
// covered separately in tests/integration/bills-cross-org-write-denial.
jest.mock('../utils/org-scope', () => ({
  __esModule: true,
  assertBuildingWriteAccess: jest.fn(async () => ({
    ok: true,
    buildingId: 'building-1',
    organizationId: 'org-1',
  })),
  assertBillWriteAccess: jest.fn(async () => ({ ok: true })),
  resolveOrgScope: jest.fn(async () => ({ explicit: false, orgIds: ['org-1'] })),
}));

// Imports after mocks
import { aiService } from '../services/consolidated-ai-service';
import { registerBillRoutes } from '../api/bills';

const suggestMock = aiService.suggestPaymentSchedule as jest.Mock;

function buildApp(): express.Express {
  const app = express();
  app.use(express.json());
  registerBillRoutes(app);
  return app;
}

const ANALYZED_BILL = {
  id: 'bill-123',
  buildingId: 'building-1',
  startDate: '2025-01-01',
  isAiAnalyzed: true,
  aiAnalysisData: {
    title: 'Hydro-Québec Bill',
    vendor: 'Hydro-Québec',
    totalAmount: '142.50',
    category: 'utilities',
    description: 'Monthly electricity bill',
    issueDate: '2025-03-15',
    dueDate: '2025-04-15',
  },
};

describe('POST /api/bills/:id/apply-ai-analysis', () => {
  let app: express.Express;

  beforeEach(() => {
    suggestMock.mockReset();
    getBillByIdMock.mockReset();
    returningMock.mockReset();
    userHolder.user = { id: 'test-user', role: 'admin' };
    app = buildApp();
  });

  it('applies the AI suggestion and returns the updated bill on success', async () => {
    getBillByIdMock.mockResolvedValue(ANALYZED_BILL);
    suggestMock.mockResolvedValue({
      paymentType: 'recurrent',
      schedulePayment: 'monthly',
      reasoning: 'Utilities are usually billed monthly',
    });
    returningMock.mockResolvedValue([
      { ...ANALYZED_BILL, title: 'Hydro-Québec Bill', vendor: 'Hydro-Québec' },
    ]);

    const res = await request(app).post('/api/bills/bill-123/apply-ai-analysis');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      message: 'AI analysis applied successfully',
      bill: { id: 'bill-123' },
      scheduleSignestion: {
        paymentType: 'recurrent',
        schedulePayment: 'monthly',
      },
    });

    // Critical: the AI suggestion is driven by the analysis category + amount.
    expect(suggestMock).toHaveBeenCalledTimes(1);
    expect(suggestMock).toHaveBeenCalledWith('utilities', 142.5);
  });

  it('returns 404 when the bill does not exist', async () => {
    getBillByIdMock.mockResolvedValue(null);

    const res = await request(app).post('/api/bills/missing/apply-ai-analysis');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ message: 'Bill not found' });
    expect(suggestMock).not.toHaveBeenCalled();
  });

  it('returns 400 when the bill has no AI analysis data attached yet', async () => {
    getBillByIdMock.mockResolvedValue({
      ...ANALYZED_BILL,
      isAiAnalyzed: false,
      aiAnalysisData: null,
    });

    const res = await request(app).post('/api/bills/bill-123/apply-ai-analysis');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      message: 'No AI analysis data available for this bill',
    });
    expect(suggestMock).not.toHaveBeenCalled();
  });

  it('returns 500 when suggestPaymentSchedule throws', async () => {
    getBillByIdMock.mockResolvedValue(ANALYZED_BILL);
    suggestMock.mockRejectedValue(new Error('Gemini exploded'));

    const res = await request(app).post('/api/bills/bill-123/apply-ai-analysis');

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      message: 'Failed to apply AI analysis',
    });
    expect(res.body._error).toBe('internal_error');
  });
});