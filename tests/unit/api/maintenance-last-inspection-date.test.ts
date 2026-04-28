/**
 * Task #971 — POST /api/maintenance/elements/:elementId/history
 *
 * Verifies that:
 * 1. Inspection-type events (repair, minor_rehab) emit a db.update WHERE clause
 *    that references last_inspection_date (the forward-only IS-NULL-or-less-than guard).
 * 2. Non-inspection-type events (construction, major_rehab, replacement) never call
 *    db.update for lastInspectionDate at all.
 *
 * The guard itself (`last_inspection_date IS NULL OR last_inspection_date < $date`)
 * runs atomically inside Postgres; the unit test responsibility is to confirm the
 * route emits the correct WHERE predicate so the database can enforce the invariant.
 * If a future change regresses the route to an unconditional update, case (1) will
 * fail because the WHERE clause will no longer contain "last_inspection_date".
 */
import { describe, it, expect, jest, beforeAll, beforeEach } from '@jest/globals';
import express from 'express';
import supertest from 'supertest';

const ELEMENT_ID = 'elem-aaaa-1111-bbbb-cccc';
const BUILDING_ID = 'bldg-1111-2222-3333-4444';

type UpdateCapture = { set: Record<string, unknown>; whereArg: unknown };
let updateCaptures: UpdateCapture[] = [];

/** Recursively extract all string `name` values from a drizzle SQL queryChunks tree. */
function extractColumnNames(node: unknown, depth = 0): string {
  if (depth > 15 || !node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(n => extractColumnNames(n, depth + 1)).join(' ');
  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof obj.name === 'string') parts.push(obj.name);
    if (Array.isArray(obj.queryChunks)) parts.push(extractColumnNames(obj.queryChunks, depth + 1));
    return parts.join(' ');
  }
  return '';
}

jest.mock('../../../server/db', () => {
  let selectCallCount = 0;

  function makeSelectChain(stub: unknown[]) {
    const chain: Record<string, jest.Mock> = {};
    const resolve = jest.fn().mockResolvedValue(stub);
    chain.from = jest.fn(() => chain);
    chain.where = jest.fn(() => chain);
    chain.innerJoin = jest.fn(() => chain);
    chain.leftJoin = jest.fn(() => chain);
    chain.limit = resolve;
    chain.returning = resolve;
    return chain;
  }

  const mockDb = {
    select: jest.fn(() => {
      const stub = selectCallCount === 0
        ? [{ buildingId: BUILDING_ID }]          // element lookup
        : [{ userId: 'admin-1', buildingId: BUILDING_ID }]; // access check
      selectCallCount++;
      return makeSelectChain(stub);
    }),

    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        returning: jest.fn().mockResolvedValue([{
          id: 'hist-0001',
          elementId: ELEMENT_ID,
          eventType: 'repair',
          eventDate: '2024-06-15',
        }]),
      })),
    })),

    // Capture update calls without applying any conditional logic — the guard
    // lives in the route's WHERE clause; we verify its presence below.
    update: jest.fn((_table: unknown) => ({
      set: jest.fn((setArg: Record<string, unknown>) => ({
        where: jest.fn((whereArg: unknown) => {
          updateCaptures.push({ set: setArg, whereArg });
          return Promise.resolve({ rowCount: 1 });
        }),
      })),
    })),

    delete: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
    // The route now wraps the history insert + audit-log insert in a transaction
    // (Task #1663). Run the callback with `mockDb` itself acting as the tx so the
    // chained insert/values/returning mocks above continue to apply.
    transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(mockDb)),
  };

  return {
    db: mockDb,
    pool: {},
    sql: jest.fn(),
    __resetSelectCount: () => { selectCallCount = 0; },
  };
});

jest.mock('../../../server/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-1', role: 'admin', email: 'a@b.test' };
    next();
  },
}));
jest.mock('../../../server/services/workflow-service', () => ({ workflowService: {} }));
jest.mock('../../../server/services/document-service', () => ({ documentService: {} }));
jest.mock('../../../server/services/secure-file-storage', () => ({ secureFileStorage: {} }));
jest.mock('../../../server/services/maintenanceSuggestionService', () => ({ maintenanceSuggestionService: {} }));
jest.mock('../../../server/jobs/maintenanceJobs', () => ({ maintenanceJobsScheduler: {} }));
jest.mock('../../../server/services/project-payment-service', () => ({ projectPaymentService: {} }));
jest.mock('../../../server/services/consolidated-ai-service', () => ({
  aiService: { analyzeDocument: jest.fn(), getAnalysisStatus: jest.fn() },
}));
jest.mock('../../../server/objectStorage', () => ({ ObjectStorageService: jest.fn() }));

import { registerMaintenanceRoutes } from '../../../server/api/maintenance';

function resetSelectCount() {
  const dbMod = require('../../../server/db') as { __resetSelectCount: () => void };
  dbMod.__resetSelectCount();
}

async function postHistory(app: express.Express, eventType: string, eventDate: string) {
  resetSelectCount();
  return supertest(app)
    .post(`/api/maintenance/elements/${ELEMENT_ID}/history`)
    .send({ eventType, eventDate, description: 'unit test description' });
}

describe('POST /api/maintenance/elements/:elementId/history — lastInspectionDate guard (task #971)', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    registerMaintenanceRoutes(app as any);
  });

  beforeEach(() => {
    updateCaptures = [];
  });

  // ── Inspection-type events: WHERE clause must include the forward-only guard ──

  it('emits a db.update with last_inspection_date in the WHERE for a repair event', async () => {
    const res = await postHistory(app, 'repair', '2024-06-15');

    expect(res.status).toBe(201);
    expect(updateCaptures).toHaveLength(1);

    const { set, whereArg } = updateCaptures[0];
    expect(set.lastInspectionDate).toBe('2024-06-15');

    // The WHERE clause must reference last_inspection_date (the IS NULL / < guard).
    // If the route regresses to an unconditional update, this column name will be absent.
    const columnNames = extractColumnNames(whereArg);
    expect(columnNames).toMatch(/last_inspection_date/);
  });

  it('emits a db.update with last_inspection_date in the WHERE for a minor_rehab event', async () => {
    const res = await postHistory(app, 'minor_rehab', '2025-03-20');

    expect(res.status).toBe(201);
    expect(updateCaptures).toHaveLength(1);

    const columnNames = extractColumnNames(updateCaptures[0].whereArg);
    expect(updateCaptures[0].set.lastInspectionDate).toBe('2025-03-20');
    expect(columnNames).toMatch(/last_inspection_date/);
  });

  // Out-of-order guard: the WHERE predicate is the mechanism that prevents regression.
  // Verify it is present regardless of which date value the caller passes.
  it('includes the forward-only WHERE guard even when the incoming date is old', async () => {
    const res = await postHistory(app, 'repair', '2000-01-01');

    expect(res.status).toBe(201);
    expect(updateCaptures).toHaveLength(1);

    const columnNames = extractColumnNames(updateCaptures[0].whereArg);
    expect(columnNames).toMatch(/last_inspection_date/);
  });

  // ── Non-inspection-type events: db.update must NOT be called ──────────────────

  it.each([
    ['construction', '2099-01-01'],
    ['major_rehab', '2099-06-15'],
    ['replacement', '2099-12-31'],
  ])('does NOT call db.update for a %s event (non-inspection type)', async (eventType, eventDate) => {
    const res = await postHistory(app, eventType, eventDate);

    expect(res.status).toBe(201);
    expect(updateCaptures).toHaveLength(0);
  });
});
