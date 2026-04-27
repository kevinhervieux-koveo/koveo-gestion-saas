// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
/**
 * @jest-environment node
 *
 * Route-level access-control tests for task #1540:
 *   GET /api/buildings/:buildingId/bills/available-years
 *   GET /api/buildings/:buildingId/bills/monthly-summary
 *
 * Verifies that super_admin (and admin as a regression guard) receive 200
 * from both endpoints, that an authorized manager also receives 200, and
 * that a role without building access still receives 403.
 *
 * Pattern mirrors ai-bill-analyze-route.test.ts:
 *   - requireAuth is replaced so each test can inject an arbitrary user
 *   - the db module is replaced with a chainable mock so no real DB is needed
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const BUILDING_ID = 'building-access-test-001';
const USER_ID = 'user-access-test-001';

// ---------------------------------------------------------------------------
// Mutable user holder — changed per test in beforeEach
// ---------------------------------------------------------------------------
const userHolder: { user: any } = {
  user: { id: USER_ID, role: 'admin' },
};

// ---------------------------------------------------------------------------
// Mock requireAuth — injects userHolder.user onto req
// ---------------------------------------------------------------------------
jest.mock('../auth', () => ({
  __esModule: true,
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = userHolder.user;
    next();
  },
}));

// ---------------------------------------------------------------------------
// Chainable DB mock helper
// Creates an object that mimics Drizzle's fluent query builder.
// The chain is a thenable (so `await chain.from().where()` resolves) AND
// has an explicit .limit() that also resolves — covering both call styles
// used in bills.ts:
//   style A: await db.select(...).from(...).where(...).limit(1)
//   style B: await db.select(...).from(...).innerJoin(...).where(...).orderBy(...)
// ---------------------------------------------------------------------------
function makeChain(rows: any[]) {
  const chain: any = {
    then: (resolve: any, reject?: any) => Promise.resolve(rows).then(resolve, reject),
    catch: (onReject: any) => Promise.resolve(rows).catch(onReject),
    finally: (onFinally: any) => Promise.resolve(rows).finally(onFinally),
  };

  const self = () => chain;
  chain.from = jest.fn(self);
  chain.where = jest.fn(self);
  chain.innerJoin = jest.fn(self);
  chain.leftJoin = jest.fn(self);
  chain.groupBy = jest.fn(self);
  chain.orderBy = jest.fn(self);
  // limit returns a new Promise (style A), but the chain itself is also
  // thenable so style B works without calling limit.
  chain.limit = jest.fn().mockResolvedValue(rows);
  return chain;
}

// Single building row returned for the "does building exist?" guard in monthly-summary
const BUILDING_ROW = [{ id: BUILDING_ID, name: 'Test Building' }];

// A row indicating a manager has access to the building
const BUILDING_ACCESS_ROW = [{ buildingId: BUILDING_ID }];

// ---------------------------------------------------------------------------
// Mock ../db — select / selectDistinct return configurable chains
// ---------------------------------------------------------------------------
const dbSelectMock = jest.fn();
const dbSelectDistinctMock = jest.fn();

jest.mock('../db', () => ({
  __esModule: true,
  db: {
    select: dbSelectMock,
    selectDistinct: dbSelectDistinctMock,
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// App factory — mount only the bill routes under test
// ---------------------------------------------------------------------------
import { registerBillRoutes } from '../api/bills';

function buildApp() {
  const app = express();
  app.use(express.json());
  registerBillRoutes(app);
  return app;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const MONTHLY_SUMMARY_QUERY = {
  lastMonthStart: '2025-03-01',
  lastMonthEnd: '2025-03-31',
  nextMonthStart: '2025-05-01',
  nextMonthEnd: '2025-05-31',
};

// ---------------------------------------------------------------------------
// Tests — GET /api/buildings/:buildingId/bills/available-years
// ---------------------------------------------------------------------------
describe('GET /api/buildings/:buildingId/bills/available-years — access control (task #1540)', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();

    // Default: DB always returns empty arrays (no data but no access denial)
    dbSelectMock.mockImplementation(() => makeChain([]));
    dbSelectDistinctMock.mockImplementation(() => makeChain([]));
  });

  it('returns 200 for super_admin — was 403 before the fix', async () => {
    userHolder.user = { id: USER_ID, role: 'super_admin' };

    const res = await request(app)
      .get(`/api/buildings/${BUILDING_ID}/bills/available-years`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('years');
    expect(Array.isArray(res.body.years)).toBe(true);
  });

  it('returns 200 for admin (regression guard — was already working)', async () => {
    userHolder.user = { id: USER_ID, role: 'admin' };

    const res = await request(app)
      .get(`/api/buildings/${BUILDING_ID}/bills/available-years`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('years');
  });

  it('returns 200 for manager with building access', async () => {
    userHolder.user = { id: USER_ID, role: 'manager' };

    // First db.select call is the checkBuildingAccess manager branch
    // (userBuildings lookup) — return a row to grant access.
    // Subsequent calls are the year-extraction selectDistincts — return [].
    dbSelectMock
      .mockImplementationOnce(() => makeChain(BUILDING_ACCESS_ROW))
      .mockImplementation(() => makeChain([]));

    const res = await request(app)
      .get(`/api/buildings/${BUILDING_ID}/bills/available-years`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('years');
  });

  it('returns 403 for manager without building access', async () => {
    userHolder.user = { id: USER_ID, role: 'manager' };

    // checkBuildingAccess manager branch: no rows → denied
    dbSelectMock.mockImplementation(() => makeChain([]));

    const res = await request(app)
      .get(`/api/buildings/${BUILDING_ID}/bills/available-years`);

    expect(res.status).toBe(403);
  });

  it('returns 403 for unrelated resident with no building association', async () => {
    userHolder.user = { id: USER_ID, role: 'resident' };

    // checkBuildingAccess resident branch: no residence rows → denied
    dbSelectMock.mockImplementation(() => makeChain([]));

    const res = await request(app)
      .get(`/api/buildings/${BUILDING_ID}/bills/available-years`);

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Tests — GET /api/buildings/:buildingId/bills/monthly-summary
// ---------------------------------------------------------------------------
describe('GET /api/buildings/:buildingId/bills/monthly-summary — access control (task #1540)', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();

    // Default: DB always returns empty arrays
    dbSelectMock.mockImplementation(() => makeChain([]));
    dbSelectDistinctMock.mockImplementation(() => makeChain([]));
  });

  it('returns 200 for super_admin — was 403 before the fix', async () => {
    userHolder.user = { id: USER_ID, role: 'super_admin' };

    // monthly-summary checks building existence first (db.select from buildings)
    dbSelectMock
      .mockImplementationOnce(() => makeChain(BUILDING_ROW))
      .mockImplementation(() => makeChain([]));

    const res = await request(app)
      .get(`/api/buildings/${BUILDING_ID}/bills/monthly-summary`)
      .query(MONTHLY_SUMMARY_QUERY);

    expect(res.status).toBe(200);
  });

  it('returns 200 for admin (regression guard — was already working)', async () => {
    userHolder.user = { id: USER_ID, role: 'admin' };

    dbSelectMock
      .mockImplementationOnce(() => makeChain(BUILDING_ROW))
      .mockImplementation(() => makeChain([]));

    const res = await request(app)
      .get(`/api/buildings/${BUILDING_ID}/bills/monthly-summary`)
      .query(MONTHLY_SUMMARY_QUERY);

    expect(res.status).toBe(200);
  });

  it('returns 200 for manager with building access', async () => {
    userHolder.user = { id: USER_ID, role: 'manager' };

    // Call 1: building existence check → return building row
    // Call 2: checkBuildingAccess manager branch → return building access row
    // Subsequent: data queries → return []
    dbSelectMock
      .mockImplementationOnce(() => makeChain(BUILDING_ROW))
      .mockImplementationOnce(() => makeChain(BUILDING_ACCESS_ROW))
      .mockImplementation(() => makeChain([]));

    const res = await request(app)
      .get(`/api/buildings/${BUILDING_ID}/bills/monthly-summary`)
      .query(MONTHLY_SUMMARY_QUERY);

    expect(res.status).toBe(200);
  });

  it('returns 403 for manager without building access', async () => {
    userHolder.user = { id: USER_ID, role: 'manager' };

    // Call 1: building exists → return row
    // Call 2: checkBuildingAccess manager branch → return [] (denied)
    dbSelectMock
      .mockImplementationOnce(() => makeChain(BUILDING_ROW))
      .mockImplementation(() => makeChain([]));

    const res = await request(app)
      .get(`/api/buildings/${BUILDING_ID}/bills/monthly-summary`)
      .query(MONTHLY_SUMMARY_QUERY);

    expect(res.status).toBe(403);
  });

  it('returns 403 for unrelated resident with no building association', async () => {
    userHolder.user = { id: USER_ID, role: 'resident' };

    // Call 1: building exists → return row
    // Call 2: checkBuildingAccess resident branch → return [] (denied)
    dbSelectMock
      .mockImplementationOnce(() => makeChain(BUILDING_ROW))
      .mockImplementation(() => makeChain([]));

    const res = await request(app)
      .get(`/api/buildings/${BUILDING_ID}/bills/monthly-summary`)
      .query(MONTHLY_SUMMARY_QUERY);

    expect(res.status).toBe(403);
  });

  it('returns 400 when required date params are missing', async () => {
    userHolder.user = { id: USER_ID, role: 'super_admin' };

    const res = await request(app)
      .get(`/api/buildings/${BUILDING_ID}/bills/monthly-summary`);

    expect(res.status).toBe(400);
  });
});
