/**
 * Task #227 — DELETE /api/buildings/:id/residences must NOT echo the raw
 * driver/error.message back to the client. Mounts the real route via
 * `registerBuildingRoutes` and forces the underlying operations helper to
 * reject with a pg-style driver error containing SQL fragments and bound
 * parameter values; asserts the response body contains none of those leak
 * substrings.
 */
import { describe, it, expect, jest, beforeEach, afterEach, beforeAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';

jest.mock('../../../server/db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    transaction: jest.fn(),
  },
  pool: {},
  sql: jest.fn(),
}));

jest.mock('../../../server/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-1', role: 'admin', email: 'a@b.test' };
    next();
  },
}));

jest.mock('../../../server/db/queries/buildings-queries', () => ({
  getAllBuildings: jest.fn(),
  getBuildingsByOrganizationIds: jest.fn(),
  getBuildingsByIds: jest.fn(),
  getBuildingIdsForResident: jest.fn(),
}));

const SQL_LEAK_SUBSTRINGS = [
  'delete from "residences"',
  'building_id',
  '$1',
  '$2',
  'pg_query',
  'top-secret-host:5432',
  'koveo_secret_user',
  'duplicate@example.com',
];

const driverError = new Error(
  'delete from "residences" where "building_id" = $1 and "id" in ($2,$3) - connection refused at host=top-secret-host:5432 user=koveo_secret_user / duplicate@example.com',
);
(driverError as Error & { code?: string }).code = '08006';

jest.mock('../../../server/api/buildings/operations', () => ({
  deleteSelectedResidences: jest.fn(() => {
    throw driverError;
  }),
}));

import { registerBuildingRoutes } from '../../../server/api/buildings';

describe('DELETE /api/buildings/:id/residences — sanitizes driver errors (task #227)', () => {
  let app: express.Express;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    registerBuildingRoutes(app);
  });

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('returns 500 with the standard generic shape and no SQL/parameter substrings', async () => {
    const res = await request(app)
      .delete('/api/buildings/building-xyz/residences')
      .send({ residenceIds: ['r1', 'r2'] });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: 'Internal server error',
      message: 'Failed to delete residences',
    });

    const body = JSON.stringify(res.body);
    for (const leak of SQL_LEAK_SUBSTRINGS) {
      expect(body).not.toContain(leak);
    }

    // Full driver error is still logged server-side for operators.
    expect(consoleErrorSpy).toHaveBeenCalled();
    const loggedWithDriverError = consoleErrorSpy.mock.calls.some(
      (call) => call.includes(driverError) || call.some((arg) => arg === driverError),
    );
    expect(loggedWithDriverError).toBe(true);
  });
});
