/**
 * @jest-environment node
 *
 * Task #1440 — GET /api/organizations returns all organizations for super_admin.
 *
 * Before this fix, only `admin` received the globally-scoped query; `super_admin`
 * fell into the membership-only branch and would see an empty list if they had
 * no direct org memberships. The fix adds `super_admin` to the all-orgs branch.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));

// ---------------------------------------------------------------------------
// In-memory org store
// ---------------------------------------------------------------------------

type Org = { id: string; name: string; isActive: boolean };

const ALL_ORGS: Org[] = [
  { id: 'org-a', name: 'Alpha Org', isActive: true },
  { id: 'org-b', name: 'Beta Org', isActive: true },
];

// ---------------------------------------------------------------------------
// Mock DB — returns all orgs for the all-orgs branch, empty for join branch.
// The test overrides mockDb.select per-test to capture which branch is used.
// ---------------------------------------------------------------------------

const mockDb: any = {
  select: jest.fn(),
};

function makeAllOrgsChain() {
  return {
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        orderBy: jest.fn(() => Promise.resolve(ALL_ORGS)),
      })),
      innerJoin: jest.fn(() => ({
        where: jest.fn(() => ({
          orderBy: jest.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  };
}

function makeEmptyJoinChain() {
  return {
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        orderBy: jest.fn(() => Promise.resolve([])),
      })),
      innerJoin: jest.fn(() => ({
        where: jest.fn(() => ({
          orderBy: jest.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  };
}

jest.mock('../../../server/db', () => ({ db: mockDb }));

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

jest.mock('../../../server/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    const role = (req.headers['x-test-role'] as string) || 'manager';
    req.user = { id: `user-${role}`, role };
    next();
  },
  requireRole: (_roles: string[]) => (_req: any, _res: any, next: any) => next(),
}));

// ---------------------------------------------------------------------------
// Schema mock — must match the @shared/schema alias
// ---------------------------------------------------------------------------

const makeTable = (name: string, cols: Record<string, unknown> = {}) => ({
  _: { name },
  ...cols,
});

jest.mock('@shared/schema', () => ({
  organizations: makeTable('organizations', {
    id: { name: 'id' },
    name: { name: 'name' },
    code: { name: 'code' },
    type: { name: 'type' },
    address: { name: 'address' },
    city: { name: 'city' },
    province: { name: 'province' },
    postalCode: { name: 'postalCode' },
    phone: { name: 'phone' },
    email: { name: 'email' },
    website: { name: 'website' },
    registrationNumber: { name: 'registrationNumber' },
    isActive: { name: 'isActive' },
    createdAt: { name: 'createdAt' },
  }),
  userOrganizations: makeTable('user_organizations', {
    organizationId: { name: 'organizationId' },
    userId: { name: 'userId' },
    isActive: { name: 'isActive' },
  }),
  buildings: makeTable('buildings'),
  residences: makeTable('residences'),
  users: makeTable('users'),
  userResidences: makeTable('user_residences'),
  userBuildings: makeTable('user_buildings'),
  invitations: makeTable('invitations'),
  commonSpaces: makeTable('common_spaces'),
}));

jest.mock('../../../server/utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

jest.mock('../../../server/utils/async-handler', () => ({
  asyncHandler: (fn: any, _opts?: any) => async (req: any, res: any, next: any) => {
    try {
      await fn(req, res, next);
    } catch (e) {
      next(e);
    }
  },
}));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------

import express, { type Express } from 'express';
import request from 'supertest';
import { registerOrganizationRoutes } from '../../../server/api/organizations';

let app: Express;

beforeEach(() => {
  jest.clearAllMocks();
  app = express();
  app.use(express.json());
  registerOrganizationRoutes(app as any);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/organizations — super_admin org list (task #1440)', () => {
  it('returns all organizations for super_admin (membership-independent)', async () => {
    mockDb.select.mockReturnValue(makeAllOrgsChain());

    const res = await request(app)
      .get('/api/organizations')
      .set('x-test-role', 'super_admin');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
  });

  it('returns all organizations for admin (existing behavior unchanged)', async () => {
    mockDb.select.mockReturnValue(makeAllOrgsChain());

    const res = await request(app)
      .get('/api/organizations')
      .set('x-test-role', 'admin');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
  });

  it('returns membership-filtered results for manager (membership-scoped behavior unchanged)', async () => {
    mockDb.select.mockReturnValue(makeEmptyJoinChain());

    const res = await request(app)
      .get('/api/organizations')
      .set('x-test-role', 'manager');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });
});
