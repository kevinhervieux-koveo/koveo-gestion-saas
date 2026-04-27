/**
 * Resident maintenance request REST endpoint — Task #1277.
 *
 * Walks the contract documented on `server/api/auto/maintenance-requests.ts`:
 *   - 400 when `category` is not one of `MAINTENANCE_CATEGORY_VALUES`
 *     (the same enum the MCP `create_maintenance_request` tool and the DB
 *     CHECK constraint enforce — keeps every surface in sync), and
 *   - 201 + the inserted row when a tenant linked to the residence submits
 *     a valid request.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () => require('../../manual-mocks/drizzle-orm/pg-core'));

let insertCallCount = 0;
let lastInsertValues: any = null;
const mockDb: any = {
  select: jest.fn(),
  insert: jest.fn().mockImplementation(() => {
    insertCallCount++;
    return {
      values: (vals: any) => {
        lastInsertValues = vals;
        return {
          returning: () =>
            Promise.resolve([
              {
                id: 'mr-1',
                ...vals,
                status: 'submitted',
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ]),
        };
      },
    };
  }),
};

jest.mock('../../../server/db', () => ({ db: mockDb }));

let currentTestUser: any = null;
const mockRequireAuth = (req: any, _res: any, next: any) => {
  req.user = currentTestUser;
  next();
};
// Mock every path Jest may resolve `requireAuth` through:
//   - the test-relative path (covered by moduleNameMapper → __mocks__/server/auth.ts), and
//   - the route-relative path `../../auth` from `server/api/auto/maintenance-requests.ts`
//     which is NOT covered by moduleNameMapper and would otherwise pull the real
//     `server/auth.ts`. Mocking by absolute path catches it.
jest.mock('../../../server/auth', () => ({
  requireAuth: mockRequireAuth,
}));
jest.mock('../../../server/auth/index', () => ({
  requireAuth: mockRequireAuth,
}));
// `server/api/auto/maintenance-requests.ts` imports `../../auth`. That path
// is NOT covered by the `moduleNameMapper` rules in `jest.config.cjs` (which
// only map `../auth`, `../../server/auth`, and `../../../server/auth`), so
// the real `server/auth.ts` would otherwise be loaded. Mock the real file
// path explicitly so the route's import resolves to our pass-through.
jest.mock(
  require('path').resolve(__dirname, '../../../server/auth.ts'),
  () => ({ requireAuth: mockRequireAuth }),
);

let canAccess = true;
jest.mock('../../../server/rbac', () => ({
  canUserAccessResidence: jest.fn(async () => canAccess),
}));

import register from '../../../server/api/auto/maintenance-requests';

function buildApp(user: any): Express {
  currentTestUser = user;
  const app = express();
  app.use(express.json());
  register(app);
  return app;
}

const VALID_RESIDENCE_ID = '11111111-1111-4111-8111-111111111111';

describe('POST /api/maintenance-requests', () => {
  beforeEach(() => {
    insertCallCount = 0;
    lastInsertValues = null;
    canAccess = true;
  });

  it('rejects an invalid category with 400 and never touches the DB', async () => {
    const app = buildApp({ id: 'u-tenant', role: 'tenant' });

    const response = await request(app)
      .post('/api/maintenance-requests')
      .send({
        residenceId: VALID_RESIDENCE_ID,
        title: 'Leaky faucet',
        description: 'Kitchen tap drips constantly',
        category: 'not_a_real_category',
        priority: 'medium',
      })
      .expect(400);

    expect(response.body.message).toBe('Invalid maintenance request');
    expect(response.body.errors).toBeDefined();
    expect(insertCallCount).toBe(0);
  });

  it('returns 201 with the new row when a linked tenant submits a valid request', async () => {
    const app = buildApp({ id: 'u-tenant', role: 'tenant' });

    const response = await request(app)
      .post('/api/maintenance-requests')
      .send({
        residenceId: VALID_RESIDENCE_ID,
        title: 'Leaky faucet',
        description: 'Kitchen tap drips constantly',
        category: 'plumbing',
        priority: 'high',
      })
      .expect(201);

    expect(insertCallCount).toBe(1);
    expect(lastInsertValues).toMatchObject({
      residenceId: VALID_RESIDENCE_ID,
      title: 'Leaky faucet',
      description: 'Kitchen tap drips constantly',
      category: 'plumbing',
      priority: 'high',
      submittedBy: 'u-tenant',
      status: 'submitted',
    });
    expect(response.body).toMatchObject({
      id: 'mr-1',
      residenceId: VALID_RESIDENCE_ID,
      category: 'plumbing',
      status: 'submitted',
    });
  });

  it('rejects an invalid priority with 400 and never touches the DB', async () => {
    const app = buildApp({ id: 'u-tenant', role: 'tenant' });

    const response = await request(app)
      .post('/api/maintenance-requests')
      .send({
        residenceId: VALID_RESIDENCE_ID,
        title: 'Leaky faucet',
        description: 'Kitchen tap drips constantly',
        category: 'plumbing',
        priority: 'super_critical',
      })
      .expect(400);

    expect(response.body.message).toBe('Invalid maintenance request');
    expect(response.body.errors).toBeDefined();
    expect(insertCallCount).toBe(0);
  });

  it('returns 403 when the caller cannot access the residence (residence-scope guard)', async () => {
    canAccess = false;
    const app = buildApp({ id: 'u-tenant', role: 'tenant' });

    const response = await request(app)
      .post('/api/maintenance-requests')
      .send({
        residenceId: VALID_RESIDENCE_ID,
        title: 'Leaky faucet',
        description: 'Kitchen tap drips constantly',
        category: 'plumbing',
      })
      .expect(403);

    expect(response.body.code).toBe('RESIDENCE_ACCESS_DENIED');
    expect(insertCallCount).toBe(0);
  });
});
