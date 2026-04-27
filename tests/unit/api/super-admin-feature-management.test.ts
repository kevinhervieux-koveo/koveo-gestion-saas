/**
 * @jest-environment node
 *
 * Task #1435 — super-admin-only Koveo feature-management routes.
 *
 * The `features` table is Koveo's internal product roadmap (no
 * `organizationId` scope). The audit performed for this task identified
 * the four mutation endpoints in `server/api/feature-management.ts` as
 * the only remaining surface that let any authenticated user (admin,
 * manager, tenant, resident, demo_*) modify a Koveo system resource —
 * everything else with an `isSystem` flag was already locked down by
 * task #1418.
 *
 * Verifies for every roadmap-mutation route:
 *   - super_admin can call it (200 / passes the auth guard).
 *   - admin, manager, tenant, resident receive 403.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// ─── DB mock ─────────────────────────────────────────────────────────────────
const updateReturning = jest.fn(() => Promise.resolve([{ id: 'feat-1', status: 'planned' }]));
const selectReturning = jest.fn(() => Promise.resolve([{ id: 'feat-1', status: 'in-progress' }]));
const countReturning = jest.fn(() => Promise.resolve([{ count: 0 }]));

jest.mock('../../../server/db', () => ({
  db: {
    update: jest.fn(() => ({
      set: () => ({
        where: () => ({ returning: updateReturning }),
      }),
    })),
    select: jest.fn(() => ({
      from: () => ({
        where: selectReturning,
      }),
    })),
  },
  pool: {},
  sql: jest.fn(),
}));

jest.mock('../../../server/config/index', () => ({
  config: {
    rateLimit: { windowMs: 60000 },
    server: { isProduction: false, domain: 'localhost' },
    session: { secret: 'test-secret', cookie: {} },
  },
}));

// Mirror the real auth helpers (super_admin satisfies any requireRole
// allowlist; requireSuperAdmin only allows super_admin).
jest.mock('../../../server/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ message: 'Authentication required' });
    next();
  },
  requireRole: (allowedRoles: string[]) => (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ message: 'Authentication required' });
    const isAuthorized =
      req.user.role === 'super_admin' || allowedRoles.includes(req.user.role);
    if (!isAuthorized) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  },
  requireSuperAdmin: (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ message: 'Authentication required' });
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  },
}));

import { registerFeatureManagementRoutes } from '../../../server/api/feature-management';

function makeAuth(role: string | null) {
  return (req: any, _res: any, next: any) => {
    if (role) {
      req.user = { id: `user-${role}`, role, email: `${role}@test.com` };
    }
    next();
  };
}

function buildApp(role: string | null) {
  const app = express();
  app.use(express.json());
  app.use(makeAuth(role));
  registerFeatureManagementRoutes(app);
  return app;
}

beforeEach(() => {
  updateReturning.mockClear();
  selectReturning.mockClear();
  countReturning.mockClear();
  // Default returning values for "happy path" calls from super_admin.
  updateReturning.mockImplementation(() =>
    Promise.resolve([{ id: 'feat-1', status: 'planned', isStrategicPath: false }]),
  );
  selectReturning.mockImplementation(() =>
    Promise.resolve([{ id: 'feat-1', status: 'in-progress' }]),
  );
});

const NON_SUPER_ROLES = [
  'admin',
  'manager',
  'demo_manager',
  'tenant',
  'resident',
  'demo_tenant',
  'demo_resident',
] as const;

// ─── POST /api/features/:id/update-status ────────────────────────────────────

describe('POST /api/features/:id/update-status — super-admin only', () => {
  it('super_admin can update feature status (200)', async () => {
    const res = await request(buildApp('super_admin'))
      .post('/api/features/feat-1/update-status')
      .send({ status: 'planned' });
    expect(res.status).toBe(200);
    expect(updateReturning).toHaveBeenCalled();
  });

  it.each(NON_SUPER_ROLES)('%s gets 403', async (role) => {
    const res = await request(buildApp(role))
      .post('/api/features/feat-1/update-status')
      .send({ status: 'planned' });
    expect(res.status).toBe(403);
    expect(updateReturning).not.toHaveBeenCalled();
  });

  it('unauthenticated gets 401', async () => {
    const res = await request(buildApp(null))
      .post('/api/features/feat-1/update-status')
      .send({ status: 'planned' });
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/features/:id/toggle-strategic ─────────────────────────────────

describe('POST /api/features/:id/toggle-strategic — super-admin only', () => {
  it('super_admin can toggle strategic path (200)', async () => {
    const res = await request(buildApp('super_admin'))
      .post('/api/features/feat-1/toggle-strategic')
      .send({ isStrategicPath: true });
    expect(res.status).toBe(200);
    expect(updateReturning).toHaveBeenCalled();
  });

  it.each(NON_SUPER_ROLES)('%s gets 403', async (role) => {
    const res = await request(buildApp(role))
      .post('/api/features/feat-1/toggle-strategic')
      .send({ isStrategicPath: true });
    expect(res.status).toBe(403);
    expect(updateReturning).not.toHaveBeenCalled();
  });
});

// ─── POST /api/features/:id/analyze ──────────────────────────────────────────

describe('POST /api/features/:id/analyze — super-admin only', () => {
  it('super_admin can trigger AI analysis (200)', async () => {
    selectReturning.mockImplementationOnce(() =>
      Promise.resolve([{ id: 'feat-1', status: 'in-progress' }]),
    );
    updateReturning.mockImplementationOnce(() =>
      Promise.resolve([{ id: 'feat-1', status: 'ai-analyzed' }]),
    );
    const res = await request(buildApp('super_admin'))
      .post('/api/features/feat-1/analyze')
      .send({});
    expect(res.status).toBe(200);
  });

  it.each(NON_SUPER_ROLES)('%s gets 403', async (role) => {
    const res = await request(buildApp(role))
      .post('/api/features/feat-1/analyze')
      .send({});
    expect(res.status).toBe(403);
    expect(selectReturning).not.toHaveBeenCalled();
    expect(updateReturning).not.toHaveBeenCalled();
  });
});

// ─── POST /api/features/trigger-sync ─────────────────────────────────────────

describe('POST /api/features/trigger-sync — super-admin only', () => {
  it('super_admin can trigger a sync (200)', async () => {
    // trigger-sync uses .update(...).set(...).where(...).returning({ id })
    // followed by .select(...).from(...).where(sql`...`).
    // Our generic mocks return arbitrary rows which is fine — the route
    // only inspects shape, not values.
    updateReturning.mockImplementationOnce(() => Promise.resolve([{ id: 'feat-1' }]));
    selectReturning.mockImplementationOnce(() => Promise.resolve([{ count: 0 }]));
    const res = await request(buildApp('super_admin'))
      .post('/api/features/trigger-sync')
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it.each(NON_SUPER_ROLES)('%s gets 403', async (role) => {
    const res = await request(buildApp(role))
      .post('/api/features/trigger-sync')
      .send({});
    expect(res.status).toBe(403);
    expect(updateReturning).not.toHaveBeenCalled();
  });
});
