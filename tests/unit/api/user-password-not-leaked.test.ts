/**
 * @jest-environment node
 *
 * Task #799 — Regression guard: password hash must never appear in user API responses.
 *
 * Exercises the real route handlers via supertest HTTP calls.
 *
 * Coverage:
 *   GET /api/users       — primary leak path fixed in Task #799
 *   GET /api/users/:id   — per-user retrieval path
 *   GET /api/auth/user   — session-user path (auth.ts line 794–797)
 *
 * Pattern for loading the real /api/auth/user handler:
 *   The moduleNameMapper in jest.config.cjs redirects `'../../../server/auth'`
 *   to `__mocks__/server/auth.ts`.  Importing with the `.ts` extension bypasses
 *   the mapper and loads the real `server/auth.ts`, exactly as done in
 *   `auth-test-cookie-error-sanitization.test.ts`.  Storage is automatically
 *   redirected to `__mocks__/server/storage.ts` by the mapper, so the test's
 *   `storageMock` and the real handlers share the same mock instance.
 */

// ─── jest.mock() calls are hoisted before all imports ────────────────────────

// Database — real auth.ts and users.ts both import ./db.
// pool must be an empty object ({}) so connect-pg-simple (used by the real
// auth.ts sessionConfig) does not attempt real PG calls on initialization,
// which would hang the test. This matches the pattern in
// auth-test-cookie-error-sanitization.test.ts.
jest.mock('../../../server/db', () => ({
  db: {
    select: jest.fn(() => ({ from: jest.fn(() => ({ where: jest.fn(() => Promise.resolve([])) })) })),
    insert: jest.fn(() => ({ values: jest.fn(() => ({ returning: jest.fn(() => Promise.resolve([])) })) })),
    update: jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn(() => Promise.resolve([])) })) })),
    execute: jest.fn(() => Promise.resolve({ rows: [] })),
  },
  pool: {},
  sql: jest.fn(),
}));

// Config — required by real auth.ts at module load time
jest.mock('../../../server/config/index', () => ({
  config: {
    rateLimit: { windowMs: 60000 },
    server: { isProduction: false, domain: 'localhost' },
    session: { secret: 'test-secret', cookie: {} },
  },
}));

// RBAC — imported by real auth.ts
jest.mock('../../../server/rbac', () => ({
  canUserAccessOrganization: jest.fn().mockResolvedValue(true),
}));

// Query cache — imported by real auth.ts
jest.mock('../../../server/query-cache', () => ({
  queryCache: { get: jest.fn(() => null), set: jest.fn(), delete: jest.fn(), clear: jest.fn() },
  CacheInvalidator: { invalidate: jest.fn() },
}));

// Email service — imported by users.ts
jest.mock('../../../server/services/email-service', () => ({
  emailService: { sendInvitation: jest.fn() },
}));

jest.mock('../../../server/services/invitation-soft-replace', () => ({
  createInvitationWithSoftReplace: jest.fn(),
  InvitationAlreadyPendingError: class {},
}));

jest.mock('../../../server/services/cache-invalidation-service', () => ({
  cacheInvalidationService: { invalidate: jest.fn() },
  createInvalidationMiddleware: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../server/utils/user-creation-logger', () => ({
  logUserCreation: jest.fn(),
}));

jest.mock('../../../server/utils/org-scope', () => ({
  resolveOrgScope: jest.fn(async () => ({ orgIds: ['org-1'], organizationId: 'org-1' })),
}));

// ─── imports ─────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// `registerUserRoutes` maps '../../../server/auth' via moduleNameMapper →
// __mocks__/server/auth.ts whose `requireAuth` passes through (next()).
import { registerUserRoutes } from '../../../server/api/users';

// `.ts` extension bypasses moduleNameMapper → loads the REAL setupAuthRoutes so
// the actual /api/auth/user handler (auth.ts line 750–797) is exercised.
// Storage inside auth.ts is redirected by the mapper to __mocks__/server/storage.ts,
// so the same mock instance is shared.
import { setupAuthRoutes } from '../../../server/auth.ts';

// ─── constants ───────────────────────────────────────────────────────────────

const BCRYPT_HASH = '$2b$12$fakehashabcdefghijklmno';
const MOCK_USER_ID = 'user-admin-1';

const USER_WITH_HASH = {
  id: MOCK_USER_ID,
  username: 'alice',
  password: BCRYPT_HASH,
  email: 'alice@test.com',
  firstName: 'Alice',
  lastName: 'Smith',
  role: 'admin' as const,
  isActive: true,
  language: 'fr',
  phone: null,
  profileImage: null,
  notificationsStartingDate: null,
  lastLoginAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  organizations: [],
  buildings: [],
  residences: [],
};

// ─── helper ──────────────────────────────────────────────────────────────────

function assertNoPasswordHash(body: unknown): void {
  const s = JSON.stringify(body);
  expect(s).not.toContain('$2a$');
  expect(s).not.toContain('$2b$');
  expect(s).not.toContain(BCRYPT_HASH);
}

// ─── suite ───────────────────────────────────────────────────────────────────

describe('Task #799 — password hash must not appear in user API responses', () => {
  let app: express.Express;

  // '../../server/storage' matches moduleNameMapper pattern '^../../server/storage$'
  // → __mocks__/server/storage.ts.  This is the SAME module instance that
  // users.ts (via '../storage') and auth.ts (via './storage') both see.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const storageMock: {
    getUsersWithAssignmentsPaginated: jest.Mock;
    getUser: jest.Mock;
    getUserOrganizations: jest.Mock;
    getUserResidences: jest.Mock;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  } = require('../../server/storage').storage;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Global middleware: give every request a session with userId and a user
    // object so both requireAuth (users routes) and the session check inside
    // /api/auth/user (auth.ts line 755) can proceed.
    app.use((req: any, _res, next) => {
      req.session = req.session || {};
      req.session.userId = MOCK_USER_ID;
      req.user = { id: MOCK_USER_ID, role: 'admin', email: 'admin@test.com' };
      next();
    });

    // Register real user API routes (uses mocked requireAuth from __mocks__/server/auth.ts)
    registerUserRoutes(app);

    // Register the REAL auth routes so /api/auth/user exercises the production
    // handler (auth.ts lines 750–797) — not a local reimplementation.
    setupAuthRoutes(app);
  });

  beforeEach(() => {
    // getUsersWithAssignmentsPaginated returns a hash-bearing fixture so
    // GET /api/users proves the defence-in-depth strip actually removes it.
    storageMock.getUsersWithAssignmentsPaginated.mockResolvedValue({
      users: [{ ...USER_WITH_HASH }],
      total: 1,
    });
    // getUser contract: returns SafeUser (no password) — mirrors the
    // storage layer change in Task #799 where DB projection uses safeUserColumns.
    // Used by both GET /api/users/:id (stripPassword applied as defence-in-depth)
    // and GET /api/auth/user (auth.ts returns result directly).
    const { password: _pw, ...userWithoutPassword } = USER_WITH_HASH;
    storageMock.getUser.mockResolvedValue({ ...userWithoutPassword });
    storageMock.getUserOrganizations.mockResolvedValue([]);
    storageMock.getUserResidences.mockResolvedValue([]);
  });

  describe('GET /api/users', () => {
    it('responds 200 and contains no bcrypt hash', async () => {
      const res = await request(app).get('/api/users');
      expect(res.status).toBe(200);
      assertNoPasswordHash(res.body);
    });

    it('users array omits the password key', async () => {
      const res = await request(app).get('/api/users');
      expect(res.status).toBe(200);
      const users: any[] = res.body?.users ?? (Array.isArray(res.body) ? res.body : []);
      expect(users.length).toBeGreaterThan(0);
      expect(users[0]).not.toHaveProperty('password');
    });
  });

  describe('GET /api/users/:id', () => {
    it('responds 200 and contains no bcrypt hash', async () => {
      const res = await request(app).get(`/api/users/${MOCK_USER_ID}`);
      expect(res.status).toBe(200);
      assertNoPasswordHash(res.body);
      expect(res.body).not.toHaveProperty('password');
    });
  });

  describe('GET /api/auth/user', () => {
    it('responds 200 and contains no bcrypt hash', async () => {
      const res = await request(app).get('/api/auth/user');
      expect(res.status).toBe(200);
      assertNoPasswordHash(res.body);
      expect(res.body).not.toHaveProperty('password');
    });
  });

  describe('schema guard', () => {
    it('users table has a password column — projections must explicitly exclude it', async () => {
      const schema = await import('@shared/schema');
      expect(schema.users).toBeDefined();
      expect((schema.users as any).password).toBeDefined();
    });
  });
});
