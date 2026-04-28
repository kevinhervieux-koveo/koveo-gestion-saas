/**
 * Task #1150 + Task #994 — REST element-history write paths must keep
 * `building_elements.last_inspection_date` in sync via the shared helper,
 * BUT must also leave a manually-set value untouched.
 *
 * `recomputeLastInspectionDate` (in
 * `server/services/inventory-inspection-date.ts`) is the single source of
 * truth for re-deriving `last_inspection_date` from `MAX(event_date)` over
 * inspection-type rows. Task #994 added the `eventSetsLastInspectionDate`
 * gate so recompute now runs only when the event being edited or deleted
 * was the one that originally established the current
 * `lastInspectionDate` (i.e. its stored eventDate matches the element's
 * current value AND its eventType is an inspection type). When the
 * current value was set manually via `update_inventory_element`, no event
 * date will match it and the column is left untouched.
 *
 * This file mocks that helper and asserts the REST PUT and DELETE
 * handlers call it under the right conditions:
 *
 *   PUT  /api/maintenance/history/:id
 *     - eventDate change AND existing event "set" the value → recompute called once
 *     - eventType change AND existing event "set" the value → recompute called once
 *     - description-only change                              → recompute NOT called
 *
 *   DELETE /api/maintenance/history/:id
 *     - delete of the inspection event that "set" the value  → recompute called once
 *     - delete of a non-inspection event (manual override)   → recompute NOT called
 *
 * If a future change re-introduces an unconditional recompute on every
 * write (the pre-#994 behavior that wiped manual overrides), or
 * re-introduces an inline UPDATE on `building_elements.last_inspection_date`
 * that bypasses the helper, the spy assertions here will fail.
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

/**
 * Pre-load the SELECT queue with the rows the PUT handler fetches.
 *
 * The joined `building_elements` row carries `lastInspectionDate` because the
 * Task #994 gate (`eventSetsLastInspectionDate`) compares it to the
 * existing history row's `eventDate`. By default we make them match so an
 * eventDate/eventType change on this inspection-type event triggers the
 * recompute as the pre-#994 tests expected. Tests that need a manual
 * override scenario can pass `elementLastInspectionDate` to force a
 * mismatch.
 */
function queueExistingRow(
  overrides: Partial<typeof EXISTING_HISTORY> & {
    elementLastInspectionDate?: string | null;
  } = {},
) {
  const { elementLastInspectionDate, ...historyOverrides } = overrides;
  const merged = { ...EXISTING_HISTORY, ...historyOverrides };
  const lastInspectionDate =
    elementLastInspectionDate === undefined
      ? merged.eventDate
      : elementLastInspectionDate;
  selectQueue.push([
    {
      element_history: merged,
      building_elements: { buildingId: BUILDING_ID, lastInspectionDate },
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

describe('DELETE /api/maintenance/history/:id — lastInspectionDate recompute (task #1150 + #994)', () => {
  /**
   * Pre-load the SELECT row the DELETE handler fetches.
   *
   * Task #994 expanded that SELECT to also project `eventType`, `eventDate`,
   * and the joined `building_elements.lastInspectionDate` so the handler can
   * call `eventSetsLastInspectionDate(...)` before deciding to recompute.
   * Defaults assume the deleted event "set" the current value (inspection
   * type, eventDate matches lastInspectionDate) so recompute fires.
   */
  function queueDeleteSelect(
    overrides: Partial<{
      eventType: string;
      eventDate: string;
      lastInspectionDate: string | null;
    }> = {},
  ) {
    const eventType = overrides.eventType ?? EXISTING_HISTORY.eventType;
    const eventDate = overrides.eventDate ?? EXISTING_HISTORY.eventDate;
    const lastInspectionDate =
      overrides.lastInspectionDate === undefined
        ? eventDate
        : overrides.lastInspectionDate;
    selectQueue.push([
      {
        elementId: ELEMENT_ID,
        buildingId: BUILDING_ID,
        eventType,
        eventDate,
        lastInspectionDate,
      },
    ]);
    // The handler also re-selects the full row for the audit snapshot.
    selectQueue.push([{ ...EXISTING_HISTORY, eventType, eventDate }]);
  }

  it('calls recomputeLastInspectionDate after deleting the inspection event that set the value', async () => {
    queueDeleteSelect();

    const res = await supertest(app)
      .delete(`/api/maintenance/history/${HISTORY_ID}`);

    expect(res.status).toBe(200);
    expect(recomputeSpy).toHaveBeenCalledTimes(1);
    expect(recomputeSpy).toHaveBeenCalledWith(expect.anything(), ELEMENT_ID);
  });

  it('does NOT call recomputeLastInspectionDate when the deleted row was a non-inspection event (preserves manual override)', async () => {
    // Task #994: deleting (e.g.) a `construction` row must NOT recompute,
    // because non-inspection events can never have set lastInspectionDate.
    // Re-running MAX(event_date) over the remaining inspection rows would
    // wipe a manually-set value.
    queueDeleteSelect({ eventType: 'construction', lastInspectionDate: '2024-06-15' });

    const res = await supertest(app)
      .delete(`/api/maintenance/history/${HISTORY_ID}`);

    expect(res.status).toBe(200);
    expect(recomputeSpy).not.toHaveBeenCalled();
  });

  it('does NOT call recomputeLastInspectionDate when the deleted inspection event was NOT the one that set the value (manual override case)', async () => {
    // Same inspection event type ('repair'), but the element's current
    // lastInspectionDate was set manually to a date that does NOT match
    // this event's eventDate. The gate must leave the manual value alone.
    queueDeleteSelect({ lastInspectionDate: '2025-01-01' });

    const res = await supertest(app)
      .delete(`/api/maintenance/history/${HISTORY_ID}`);

    expect(res.status).toBe(200);
    expect(recomputeSpy).not.toHaveBeenCalled();
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
