/**
 * @file Integration test that verifies an asyncHandler-migrated route still
 * produces the same `{ message: 'Failed to ...' }` body with a 500 status when
 * an unexpected error is thrown deep inside the handler. The frontend (and
 * downstream tooling) depend on this exact contract for routes migrated in
 * Task #207, so we lock it in here against future regressions of the
 * asyncHandler / secureErrorHandler chain.
 */

import { describe, it, expect, jest, beforeAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// Mock the database module BEFORE importing the route. The handler we are
// exercising (`GET /api/user/residences`) calls `db.select(...).from(...).where(...)`
// — making `.where()` reject simulates an unexpected DB failure.
jest.mock('../../server/db', () => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => Promise.reject(new Error('simulated db failure: secret-host:5432'))),
      })),
    })),
  },
}));

// Mock auth so requireAuth becomes a passthrough that injects a fake user.
jest.mock('../../server/auth/index', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'test-user', role: 'admin', canAccessAllOrganizations: true };
    next();
  },
}));

// Mock the cache invalidation and delayed update services since the route
// module imports them at top level. The mocks just need to satisfy the import
// shape — the test only exercises a read endpoint that throws.
jest.mock('../../server/services/cache-invalidation-service', () => ({
  cacheInvalidationService: { invalidate: jest.fn() },
  createInvalidationMiddleware: () => (_req: any, _res: any, next: any) => next(),
}));
jest.mock('../../server/services/delayed-update-service', () => ({
  delayedUpdateService: { scheduleUpdate: jest.fn() },
}));

// Imports must come AFTER jest.mock calls.
import { registerResidenceRoutes } from '../../server/api/residences';
import { secureErrorHandler } from '../../server/middleware/error-security';

describe('asyncHandler integration: migrated residences endpoint', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    registerResidenceRoutes(app);
    app.use(secureErrorHandler);
  });

  it('returns 500 with the per-route generic message for an unexpected throw', async () => {
    const res = await request(app).get('/api/user/residences');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: 'Failed to fetch user residences' });
    // Make sure the raw error message did NOT leak through to the response.
    expect(JSON.stringify(res.body)).not.toContain('simulated db failure');
    expect(JSON.stringify(res.body)).not.toContain('secret-host');
  });
});
