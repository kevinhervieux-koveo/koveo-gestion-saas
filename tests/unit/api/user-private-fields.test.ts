/**
 * @jest-environment node
 *
 * Task #1307 — Private-field redaction unit + HTTP regression tests.
 *
 * Verifies that `phone` and `profileImage` are stripped from user API
 * responses for callers who are not the resource owner or an admin.
 *
 * Coverage:
 *   Pure function: serializeUserForResponse
 *     - admin caller sees phone + profileImage
 *     - owner (same id) sees phone + profileImage
 *     - manager / demo_manager see phone + profileImage (contact details)
 *       but do NOT see notificationsStartingDate
 *     - non-owner tenants/residents do NOT see phone, profileImage, or
 *       notificationsStartingDate
 *     - password is always stripped regardless of caller
 *
 *   HTTP layer (GET /api/users, GET /api/users/:id):
 *     - admin caller receives phone + profileImage for others
 *     - manager caller receives phone + profileImage (contact details) but
 *       NOT notificationsStartingDate
 *     - self lookup (owner) receives phone + profileImage
 *
 * NOTE: The original Task #1307 tests asserted that managers MUST NOT see
 * `phone`/`profileImage`. Task #1486 deliberately changed the serializer to
 * grant managers visibility on those contact fields (see JSDoc on
 * serializeUserForResponse). These tests were reconciled with that policy
 * in Task #1593.
 */

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

jest.mock('../../../server/config/index', () => ({
  config: {
    rateLimit: { windowMs: 60000 },
    server: { isProduction: false, domain: 'localhost' },
    session: { secret: 'test-secret', cookie: {} },
  },
}));

jest.mock('../../../server/rbac', () => ({
  canUserAccessOrganization: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../server/query-cache', () => ({
  queryCache: { get: jest.fn(() => null), set: jest.fn(), delete: jest.fn(), clear: jest.fn(), invalidate: jest.fn() },
  CacheInvalidator: { invalidate: jest.fn(), invalidateUserCaches: jest.fn() },
}));

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

import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { serializeUserForResponse } from '../../../server/db/queries/user-queries';
import { registerUserRoutes } from '../../../server/api/users';

const ADMIN_ID = 'user-admin-001';
const MANAGER_ID = 'user-manager-001';
const TENANT_ID = 'user-tenant-001';

const BASE_USER = {
  id: TENANT_ID,
  username: 'tenant1',
  password: '$2b$12$somehash',
  email: 'tenant1@test.com',
  firstName: 'Tenant',
  lastName: 'One',
  role: 'tenant' as const,
  isActive: true,
  language: 'fr',
  phone: '+1-555-000-0001',
  profileImage: 'https://example.com/avatar.jpg',
  notificationsStartingDate: null,
  lastLoginAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  organizations: [],
  buildings: [],
  residences: [],
};

describe('serializeUserForResponse — pure function', () => {
  it('admin caller sees phone and profileImage', () => {
    const result = serializeUserForResponse(BASE_USER, ADMIN_ID, 'admin') as any;
    expect(result).not.toHaveProperty('password');
    expect(result.phone).toBe(BASE_USER.phone);
    expect(result.profileImage).toBe(BASE_USER.profileImage);
  });

  it('owner (same id as user) sees phone and profileImage', () => {
    const result = serializeUserForResponse(BASE_USER, TENANT_ID, 'tenant') as any;
    expect(result).not.toHaveProperty('password');
    expect(result.phone).toBe(BASE_USER.phone);
    expect(result.profileImage).toBe(BASE_USER.profileImage);
  });

  it('manager caller sees phone and profileImage but NOT notificationsStartingDate', () => {
    // Per Task #1486 policy (documented on serializeUserForResponse):
    // managers need contact details, so they DO see phone and profileImage.
    // notificationsStartingDate remains owner/admin-only.
    const result = serializeUserForResponse(BASE_USER, MANAGER_ID, 'manager') as any;
    expect(result).not.toHaveProperty('password');
    expect(result.phone).toBe(BASE_USER.phone);
    expect(result.profileImage).toBe(BASE_USER.profileImage);
    expect(result).not.toHaveProperty('notificationsStartingDate');
  });

  it('demo_manager caller sees phone and profileImage but NOT notificationsStartingDate', () => {
    const result = serializeUserForResponse(BASE_USER, 'demo-mgr-id', 'demo_manager') as any;
    expect(result).not.toHaveProperty('password');
    expect(result.phone).toBe(BASE_USER.phone);
    expect(result.profileImage).toBe(BASE_USER.profileImage);
    expect(result).not.toHaveProperty('notificationsStartingDate');
  });

  it('different tenant caller does NOT see phone or profileImage', () => {
    const result = serializeUserForResponse(BASE_USER, 'other-tenant-id', 'tenant') as any;
    expect(result).not.toHaveProperty('phone');
    expect(result).not.toHaveProperty('profileImage');
  });

  it('always strips password regardless of caller role', () => {
    for (const role of ['admin', 'manager', 'tenant', 'resident'] as const) {
      const result = serializeUserForResponse(BASE_USER, 'any-id', role) as any;
      expect(result).not.toHaveProperty('password');
    }
  });

  it('preserves non-private public fields for all callers', () => {
    const result = serializeUserForResponse(BASE_USER, MANAGER_ID, 'manager') as any;
    expect(result.id).toBe(BASE_USER.id);
    expect(result.email).toBe(BASE_USER.email);
    expect(result.firstName).toBe(BASE_USER.firstName);
    expect(result.lastName).toBe(BASE_USER.lastName);
    expect(result.role).toBe(BASE_USER.role);
  });
});

describe('HTTP — private fields redaction (Task #1307)', () => {
  let appAsAdmin: express.Express;
  let appAsManager: express.Express;

  // '../../server/storage' matches moduleNameMapper pattern '^../../server/storage$'
  // → __mocks__/server/storage.ts.  This is the SAME module instance that
  // users.ts (via '../storage') and auth.ts (via './storage') both see.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const storageMock: {
    getUsersWithAssignmentsPaginated: jest.Mock;
    getUser: jest.Mock;
    getUserOrganizations: jest.Mock;
    getUserResidences: jest.Mock;
  } = require('../../server/storage').storage;

  beforeAll(() => {
    appAsAdmin = express();
    appAsAdmin.use(express.json());
    appAsAdmin.use((req: any, _res, next) => {
      req.session = { userId: ADMIN_ID };
      req.user = { id: ADMIN_ID, role: 'admin', email: 'admin@test.com' };
      next();
    });
    registerUserRoutes(appAsAdmin);

    appAsManager = express();
    appAsManager.use(express.json());
    appAsManager.use((req: any, _res, next) => {
      req.session = { userId: MANAGER_ID };
      req.user = { id: MANAGER_ID, role: 'manager', email: 'manager@test.com' };
      next();
    });
    registerUserRoutes(appAsManager);
  });

  beforeEach(() => {
    const { password: _pw, ...userWithoutPassword } = BASE_USER;
    const userForList = { ...BASE_USER };

    storageMock.getUsersWithAssignmentsPaginated.mockResolvedValue({
      users: [userForList],
      total: 1,
    });
    storageMock.getUser.mockResolvedValue({ ...userWithoutPassword });
    storageMock.getUserOrganizations.mockResolvedValue([]);
    storageMock.getUserResidences.mockResolvedValue([]);
  });

  describe('GET /api/users — list endpoint', () => {
    it('admin sees phone and profileImage in user list', async () => {
      const res = await request(appAsAdmin).get('/api/users').expect(200);
      // /api/users without pagination params MUST return a flat User[] directly
      expect(Array.isArray(res.body)).toBe(true);
      const users: any[] = res.body;
      expect(users.length).toBeGreaterThan(0);
      expect(users[0]).toHaveProperty('phone');
      expect(users[0]).toHaveProperty('profileImage');
      expect(users[0]).not.toHaveProperty('password');
    });

    it('manager sees phone and profileImage in user list (contact details) but NOT notificationsStartingDate', async () => {
      // Per Task #1486 policy: managers need contact details, so phone +
      // profileImage are exposed. notificationsStartingDate remains
      // owner/admin-only.
      const res = await request(appAsManager).get('/api/users').expect(200);
      // /api/users without pagination params MUST return a flat User[] directly
      expect(Array.isArray(res.body)).toBe(true);
      const users: any[] = res.body;
      expect(users.length).toBeGreaterThan(0);
      expect(users[0].phone).toBe(BASE_USER.phone);
      expect(users[0].profileImage).toBe(BASE_USER.profileImage);
      expect(users[0]).not.toHaveProperty('notificationsStartingDate');
      expect(users[0]).not.toHaveProperty('password');
    });
  });

  describe('GET /api/users/:id — single-user endpoint', () => {
    it('admin sees phone and profileImage when fetching another user', async () => {
      const res = await request(appAsAdmin)
        .get(`/api/users/${TENANT_ID}`)
        .expect(200);
      expect(res.body).toHaveProperty('phone');
      expect(res.body).toHaveProperty('profileImage');
      expect(res.body).not.toHaveProperty('password');
    });

    it('manager sees phone and profileImage when fetching another user but NOT notificationsStartingDate', async () => {
      // Per Task #1486 policy: managers need contact details to do their job.
      const res = await request(appAsManager)
        .get(`/api/users/${TENANT_ID}`)
        .expect(200);
      expect(res.body.phone).toBe(BASE_USER.phone);
      expect(res.body.profileImage).toBe(BASE_USER.profileImage);
      expect(res.body).not.toHaveProperty('notificationsStartingDate');
      expect(res.body).not.toHaveProperty('password');
    });

    it('owner (same user) sees their own phone and profileImage', async () => {
      const ownerApp = express();
      ownerApp.use(express.json());
      ownerApp.use((req: any, _res, next) => {
        req.session = { userId: TENANT_ID };
        req.user = { id: TENANT_ID, role: 'tenant', email: 'tenant@test.com' };
        next();
      });
      registerUserRoutes(ownerApp);

      const res = await request(ownerApp)
        .get(`/api/users/${TENANT_ID}`)
        .expect(200);
      expect(res.body).toHaveProperty('phone');
      expect(res.body).toHaveProperty('profileImage');
      expect(res.body).not.toHaveProperty('password');
    });
  });
});
