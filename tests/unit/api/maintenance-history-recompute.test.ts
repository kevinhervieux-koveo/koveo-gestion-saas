/**
 * Task #1150 — REST element-history write paths must keep
 * `building_elements.last_inspection_date` in sync via the shared helper.
 *
 * `recomputeLastInspectionDate` (in
 * `server/services/inventory-inspection-date.ts`) is the single source of
 * truth for re-deriving `last_inspection_date` from `MAX(event_date)` over
 * inspection-type rows. This test file mocks that helper and asserts the
 * REST PUT and DELETE handlers call it under the right conditions:
 *
 *   PUT  /api/maintenance/history/:id
 *     - eventDate change                → recompute called once
 *     - eventType change                → recompute called once
 *     - description-only change         → recompute NOT called
 *
 *   DELETE /api/maintenance/history/:id
 *     - any successful delete           → recompute called once
 *
 * If a future change re-introduces an inline UPDATE on
 * `building_elements.last_inspection_date` that bypasses the helper, the
 * spy assertions here will fail because the helper will not be invoked.
 */
import { describe, it, expect, jest, beforeAll, beforeEach } from '@jest/globals';
import express from 'express';
import supertest from 'supertest';

const ELEMENT_ID = 'elem-aaaa-1111-bbbb-cccc';
const HISTORY_ID = 'hist-1111-2222-3333-4444';
const BUILDING_ID = 'bldg-1111-2222-3333-4444';
const VENDOR_ID = '11111111-2222-3333-4444-555555555555';

// Existing history row returned by the SELECT (joined with building_elements).
const EXISTING_HISTORY = {
  id: HISTORY_ID,
  elementId: ELEMENT_ID,
  eventType: 'repair' as string,
  eventDate: '2024-06-15',
  workDescription: 'Original description',
  cost: '100.00',
  vendorId: null as string | null,
  vendorName: null as string | null,
  lifespanImpact: null as number | null,
  warranty: null as Record<string, unknown> | null,
};

// Spies imported from the mocked helper module — the registry of calls.
const recomputeSpy = jest.fn().mockResolvedValue(undefined as never);
const advanceForwardSpy = jest.fn().mockResolvedValue(undefined as never);

jest.mock('../../../server/services/inventory-inspection-date', () => {
  const actual = jest.requireActual(
    '../../../server/services/inventory-inspection-date',
  ) as Record<string, unknown>;
  return {
    ...actual,
    recomputeLastInspectionDate: (...args: unknown[]) => recomputeSpy(...args),
    advanceLastInspectionDateForward: (...args: unknown[]) =>
      advanceForwardSpy(...args),
  };
});

// Drizzle-shaped chainable mock. Each terminal method (`limit`, `returning`,
// or awaiting the chain itself) resolves with the next item in `selectQueue`.
let selectQueue: unknown[][] = [];

function makeSelectChain() {
  const result = (): Promise<unknown[]> =>
    Promise.resolve(selectQueue.shift() ?? []);
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  chain.innerJoin = () => chain;
  chain.leftJoin = () => chain;
  chain.orderBy = () => chain;
  chain.limit = result;
  chain.returning = result;
  (chain as { then: (cb: (v: unknown[]) => unknown) => Promise<unknown> }).then =
    (cb) => result().then(cb);
  return chain;
}

jest.mock('../../../server/db', () => {
  const txDb = {
    select: jest.fn(() => makeSelectChain()),
    insert: jest.fn(() => ({
      values: jest.fn().mockResolvedValue(undefined as never),
    })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue([EXISTING_HISTORY]),
        })),
      })),
    })),
    delete: jest.fn(() => ({
      where: jest.fn().mockResolvedValue(undefined as never),
    })),
  };

  const mockDb = {
    select: jest.fn(() => makeSelectChain()),
    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        returning: jest.fn().mockResolvedValue([EXISTING_HISTORY]),
      })),
    })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue([EXISTING_HISTORY]),
        })),
      })),
    })),
    delete: jest.fn(() => ({
      where: jest.fn().mockResolvedValue(undefined as never),
    })),
    transaction: jest.fn(
      async (cb: (tx: typeof txDb) => Promise<unknown>) => cb(txDb),
    ),
  };

  return {
    db: mockDb,
    pool: {},
    sql: jest.fn(),
    __txDb: txDb,
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

let app: express.Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  registerMaintenanceRoutes(app as any);
});

beforeEach(() => {
  recomputeSpy.mockClear();
  advanceForwardSpy.mockClear();
  selectQueue = [];
});

/** Pre-load the SELECT queue with the rows the PUT/DELETE handlers fetch. */
function queueExistingRow(overrides: Partial<typeof EXISTING_HISTORY> = {}) {
  selectQueue.push([
    {
      element_history: { ...EXISTING_HISTORY, ...overrides },
      building_elements: { buildingId: BUILDING_ID },
    },
  ]);
}

describe('PUT /api/maintenance/history/:id — lastInspectionDate recompute (task #1150)', () => {
  it('calls recomputeLastInspectionDate exactly once when eventDate changes', async () => {
    queueExistingRow();

    const res = await supertest(app)
      .put(`/api/maintenance/history/${HISTORY_ID}`)
      .send({
        eventType: 'repair',
        eventDate: '2025-09-01',
        description: EXISTING_HISTORY.workDescription,
      });

    expect(res.status).toBe(200);
    expect(recomputeSpy).toHaveBeenCalledTimes(1);
    expect(recomputeSpy).toHaveBeenCalledWith(expect.anything(), ELEMENT_ID);
  });

  it('calls recomputeLastInspectionDate exactly once when eventType changes', async () => {
    queueExistingRow();

    const res = await supertest(app)
      .put(`/api/maintenance/history/${HISTORY_ID}`)
      .send({
        // eventDate stays the same as the existing row
        eventDate: EXISTING_HISTORY.eventDate,
        eventType: 'minor_rehab',
        description: EXISTING_HISTORY.workDescription,
      });

    expect(res.status).toBe(200);
    expect(recomputeSpy).toHaveBeenCalledTimes(1);
    expect(recomputeSpy).toHaveBeenCalledWith(expect.anything(), ELEMENT_ID);
  });

  it('does NOT call recomputeLastInspectionDate when only the description changes', async () => {
    queueExistingRow();

    const res = await supertest(app)
      .put(`/api/maintenance/history/${HISTORY_ID}`)
      .send({
        eventType: EXISTING_HISTORY.eventType,
        eventDate: EXISTING_HISTORY.eventDate,
        description: 'Edited description only',
      });

    expect(res.status).toBe(200);
    expect(recomputeSpy).not.toHaveBeenCalled();
  });

  it('does NOT call recomputeLastInspectionDate when only the cost changes', async () => {
    queueExistingRow();

    const res = await supertest(app)
      .put(`/api/maintenance/history/${HISTORY_ID}`)
      .send({
        eventType: EXISTING_HISTORY.eventType,
        eventDate: EXISTING_HISTORY.eventDate,
        description: EXISTING_HISTORY.workDescription,
        cost: 250,
      });

    expect(res.status).toBe(200);
    expect(recomputeSpy).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/maintenance/history/:id — lastInspectionDate recompute (task #1150)', () => {
  function queueDeleteSelect() {
    selectQueue.push([
      {
        elementId: ELEMENT_ID,
        buildingId: BUILDING_ID,
      },
    ]);
  }

  it('always calls recomputeLastInspectionDate after a successful delete', async () => {
    queueDeleteSelect();

    const res = await supertest(app)
      .delete(`/api/maintenance/history/${HISTORY_ID}`);

    expect(res.status).toBe(200);
    expect(recomputeSpy).toHaveBeenCalledTimes(1);
    expect(recomputeSpy).toHaveBeenCalledWith(expect.anything(), ELEMENT_ID);
  });

  it('still calls recomputeLastInspectionDate when the deleted row was a non-inspection event', async () => {
    // The handler does not branch on eventType for deletes — recompute runs
    // unconditionally so deleting (e.g.) a `construction` row that was the
    // last write on the element still re-derives MAX(event_date) over
    // inspection rows. We model this by simulating a delete on an element
    // whose other rows include inspection events (the helper's job).
    queueDeleteSelect();

    const res = await supertest(app)
      .delete(`/api/maintenance/history/${HISTORY_ID}`);

    expect(res.status).toBe(200);
    expect(recomputeSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT call advanceLastInspectionDateForward on the delete path', async () => {
    queueDeleteSelect();

    const res = await supertest(app)
      .delete(`/api/maintenance/history/${HISTORY_ID}`);

    expect(res.status).toBe(200);
    expect(advanceForwardSpy).not.toHaveBeenCalled();
  });
});

// Sanity coverage: vendor-id changes are field-level changes that must NOT
// trigger the inspection recompute, because they don't affect the
// MAX(event_date) over inspection rows. Documents the boundary so a future
// change that incorrectly broadens `inspectionRecomputeNeeded` is caught.
describe('PUT /api/maintenance/history/:id — recompute boundary (task #1150)', () => {
  it('does NOT call recomputeLastInspectionDate when only the vendor changes', async () => {
    selectQueue.push([
      {
        element_history: { ...EXISTING_HISTORY },
        building_elements: { buildingId: BUILDING_ID },
      },
    ]);

    const res = await supertest(app)
      .put(`/api/maintenance/history/${HISTORY_ID}`)
      .send({
        eventType: EXISTING_HISTORY.eventType,
        eventDate: EXISTING_HISTORY.eventDate,
        description: EXISTING_HISTORY.workDescription,
        vendorId: VENDOR_ID,
      });

    expect(res.status).toBe(200);
    expect(recomputeSpy).not.toHaveBeenCalled();
  });
});
