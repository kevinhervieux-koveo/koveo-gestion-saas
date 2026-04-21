/**
 * Task #227 — GET /api/maintenance/vendors must NOT echo the raw
 * driver/error.message back to the client. Mounts the real route via
 * `registerMaintenanceRoutes` and forces the underlying DB helper to throw a
 * pg-style driver error containing SQL fragments and bound parameter values;
 * asserts the response body contains none of those leak substrings.
 */
import { describe, it, expect, jest, beforeEach, afterEach, beforeAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const driverError = new Error(
  'select "id" from "user_organizations" where "user_id" = $1 - connection refused at host=top-secret-host:5432 user=koveo_secret_user password=top-secret-password',
);
(driverError as Error & { code?: string }).code = '08006';

jest.mock('../../../server/db', () => {
  const rejecting = () => Promise.reject(driverError);
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  chain.innerJoin = () => chain;
  chain.leftJoin = () => chain;
  chain.orderBy = rejecting;
  chain.limit = rejecting;
  (chain as { then: (a: any, b: any) => Promise<unknown> }).then = (onF, onR) =>
    Promise.reject(driverError).then(onF, onR);
  return {
    db: {
      select: jest.fn(() => chain),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      transaction: jest.fn(),
    },
    pool: {},
    sql: jest.fn(),
  };
});

jest.mock('../../../server/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-1', role: 'admin', email: 'a@b.test' };
    next();
  },
}));

jest.mock('../../../server/services/workflow-service', () => ({
  workflowService: {},
}));
jest.mock('../../../server/services/document-service', () => ({
  documentService: {},
}));
jest.mock('../../../server/services/secure-file-storage', () => ({
  secureFileStorage: {},
}));
jest.mock('../../../server/services/maintenanceSuggestionService', () => ({
  maintenanceSuggestionService: {},
}));
jest.mock('../../../server/jobs/maintenanceJobs', () => ({
  maintenanceJobsScheduler: {},
}));
jest.mock('../../../server/services/project-payment-service', () => ({
  projectPaymentService: {},
}));

import { registerMaintenanceRoutes } from '../../../server/api/maintenance';

const SQL_LEAK_SUBSTRINGS = [
  'select "id"',
  'user_organizations',
  'user_id',
  '$1',
  'connection refused',
  'top-secret-host:5432',
  'koveo_secret_user',
  'top-secret-password',
];

describe('GET /api/maintenance/vendors — sanitizes driver errors (task #227)', () => {
  let app: express.Express;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    registerMaintenanceRoutes(app);
  });

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('GET /vendors returns 500 with the standard generic shape and no SQL/parameter substrings', async () => {
    const res = await request(app).get('/api/maintenance/vendors');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: 'Internal server error',
      message: 'Failed to fetch vendors',
    });

    const body = JSON.stringify(res.body);
    for (const leak of SQL_LEAK_SUBSTRINGS) {
      expect(body).not.toContain(leak);
    }

    expect(consoleErrorSpy).toHaveBeenCalled();
    const loggedWithDriverError = consoleErrorSpy.mock.calls.some(
      (call) => call.includes(driverError) || call.some((arg) => arg === driverError),
    );
    expect(loggedWithDriverError).toBe(true);
  });

  // Regression guard: before the fix this endpoint returned only
  // `{ error: 'Internal server error' }` (no `message`) which broke the
  // standard contract and confused the code-review gate. Lock in both the
  // exact shape AND the no-leak guarantee here.
  it('DELETE /history/:id returns the full standard shape (error + message)', async () => {
    const res = await request(app).delete('/api/maintenance/history/hist-123');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: 'Internal server error',
      message: 'Failed to delete element history',
    });

    const body = JSON.stringify(res.body);
    for (const leak of SQL_LEAK_SUBSTRINGS) {
      expect(body).not.toContain(leak);
    }
  });
});
