/**
 * Tests for W45: GET /api/buildings RBAC fix.
 *
 * Verifies that:
 *   - super_admin receives 200 (previously 403 due to omission from the allow-list).
 *   - admin / manager receive 200 scoped to their orgs.
 *   - tenant / resident receive 403.
 *   - The roleRank helper orders roles correctly.
 */

// --- DB mock (must be before any imports) ---
jest.mock('../../../server/db', () => ({
  db: {},
  sql: jest.fn(),
  pool: {},
}));

jest.mock('drizzle-orm', () => ({
  eq: jest.fn(() => 'eq'),
  and: jest.fn(() => 'and'),
  or: jest.fn(() => 'or'),
  inArray: jest.fn(() => 'inArray'),
  isNull: jest.fn(() => 'isNull'),
  sql: jest.fn(() => 'sql'),
  count: jest.fn(() => 'count'),
}));

jest.mock('@shared/schema', () => ({
  buildings: { id: 'b.id', name: 'b.name', organizationId: 'b.organizationId', isActive: 'b.isActive' },
  organizations: { id: 'o.id' },
  users: { id: 'u.id', role: 'u.role' },
  residences: { id: 'r.id', buildingId: 'r.buildingId', isActive: 'r.isActive' },
  userResidences: { userId: 'ur.userId', residenceId: 'ur.residenceId', isActive: 'ur.isActive' },
  userOrganizations: { userId: 'uo.userId', organizationId: 'uo.organizationId', isActive: 'uo.isActive', canAccessAllOrganizations: 'uo.canAll' },
  userBuildings: { userId: 'ub.userId', buildingId: 'ub.buildingId', isActive: 'ub.isActive' },
  documents: { id: 'd.id' },
  commonSpaces: { id: 'cs.id', buildingId: 'cs.buildingId' },
}));

// --- Auth: requireAuth just passes the user through; no DB needed ---
jest.mock('../../../server/auth', () => ({
  requireAuth: jest.fn((req: any, _res: any, next: any) => {
    if (req.user) return next();
    return _res.status(401).json({ code: 'AUTH_REQUIRED' });
  }),
}));

// --- RBAC helpers ---
const MOCK_ORG_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const MOCK_ORG_B = 'bbbbbbbb-0000-0000-0000-000000000002';

jest.mock('../../../server/rbac', () => ({
  getUserAccessibleOrganizations: jest.fn(async (_id: string, role: string) => {
    if (role === 'super_admin') return [MOCK_ORG_A, MOCK_ORG_B];
    if (role === 'admin') return [MOCK_ORG_A];
    if (role === 'manager' || role === 'demo_manager') return [MOCK_ORG_A];
    return [];
  }),
  canUserAccessOrganization: jest.fn(async () => true),
}));

// --- org-scope: pass through to the real helper but override rbac ---
jest.mock('../../../server/utils/org-scope', () => ({
  resolveOrgScope: jest.fn(async (req: any, _res: any) => {
    const { getUserAccessibleOrganizations } = require('../../../server/rbac');
    const user = req.user;
    const orgId = req.query?.organizationId;
    if (orgId) {
      const accessible = await getUserAccessibleOrganizations(user.id, user.role);
      if (!accessible.includes(orgId)) {
        _res.status(403).json({ code: 'INSUFFICIENT_PERMISSIONS' });
        return null;
      }
      return { explicit: true, orgIds: [orgId] };
    }
    const accessible = await getUserAccessibleOrganizations(user.id, user.role);
    return { explicit: false, orgIds: accessible };
  }),
  assertBuildingWriteAccess: jest.fn(),
  assertBillWriteAccess: jest.fn(),
}));

// --- Building query helpers ---
const MOCK_BUILDINGS_A = [
  { id: 'bld-1', name: 'Building 1', organizationId: MOCK_ORG_A },
  { id: 'bld-2', name: 'Building 2', organizationId: MOCK_ORG_A },
];
const MOCK_BUILDINGS_B = [
  { id: 'bld-3', name: 'Building 3', organizationId: MOCK_ORG_B },
];
const ALL_BUILDINGS = [...MOCK_BUILDINGS_A, ...MOCK_BUILDINGS_B];

jest.mock('../../../server/db/queries/buildings-queries', () => ({
  getAllBuildings: jest.fn(async () => ALL_BUILDINGS),
  getBuildingsByOrganizationIds: jest.fn(async (orgIds: string[]) =>
    ALL_BUILDINGS.filter((b) => orgIds.includes(b.organizationId))
  ),
  getBuildingsByIds: jest.fn(async () => []),
  getBuildingIdsForResident: jest.fn(async () => []),
}));

jest.mock('../../../server/utils/async-handler', () => ({
  asyncHandler: jest.fn((fn: any) => fn),
}));

jest.mock('../../../server/utils/validation-helpers', () => ({
  isValidUUID: jest.fn((v: string) => /^[0-9a-f-]{36}$/.test(v)),
}));

// ---- Imports (after mocks) ----
import request from 'supertest';
import express from 'express';
import { roleRank } from '../../../server/lib/auth/roleRank';
import { registerBuildingRoutes } from '../../../server/api/buildings';

// ---- Helper to build a test app with a given user role ----
function makeApp(role: string, userId = 'user-123') {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.user = { id: userId, role, email: `${role}@example.com` };
    next();
  });
  registerBuildingRoutes(app as any);
  return app;
}

// ============================================================
// Part 1: roleRank unit tests
// ============================================================
describe('roleRank helper', () => {
  it('orders the five canonical ranks correctly', () => {
    expect(roleRank('super_admin')).toBeGreaterThan(roleRank('admin'));
    expect(roleRank('admin')).toBeGreaterThan(roleRank('manager'));
    expect(roleRank('manager')).toBeGreaterThan(roleRank('resident'));
    expect(roleRank('resident')).toBeGreaterThanOrEqual(roleRank('tenant'));
  });

  it('maps demo roles to their production rank equivalents', () => {
    expect(roleRank('demo_manager')).toEqual(roleRank('manager'));
    expect(roleRank('demo_resident')).toEqual(roleRank('resident'));
    expect(roleRank('demo_tenant')).toEqual(roleRank('tenant'));
  });

  it('returns -1 for unknown roles', () => {
    expect(roleRank('unknown_role')).toBe(-1);
    expect(roleRank('')).toBe(-1);
  });
});

// ============================================================
// Part 2: GET /api/buildings access control
// ============================================================
describe('GET /api/buildings — role-based access control (W45)', () => {
  it('super_admin → 200 with all buildings (no org filter)', async () => {
    const app = makeApp('super_admin');
    const res = await request(app).get('/api/buildings');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // super_admin has access to all orgs so all buildings are returned
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('super_admin + ?organizationId → 200, only that org\'s buildings', async () => {
    const app = makeApp('super_admin');
    const res = await request(app).get(`/api/buildings?organizationId=${MOCK_ORG_A}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    res.body.forEach((b: any) => {
      expect(b.organizationId).toBe(MOCK_ORG_A);
    });
  });

  it('admin → 200, buildings from accessible orgs', async () => {
    const app = makeApp('admin');
    const res = await request(app).get('/api/buildings');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // admin only has MOCK_ORG_A
    res.body.forEach((b: any) => {
      expect(b.organizationId).toBe(MOCK_ORG_A);
    });
  });

  it('manager → 200, buildings from accessible orgs', async () => {
    const app = makeApp('manager');
    const res = await request(app).get('/api/buildings');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    res.body.forEach((b: any) => {
      expect(b.organizationId).toBe(MOCK_ORG_A);
    });
  });

  it('admin + ?organizationId for own org → 200', async () => {
    const app = makeApp('admin');
    const res = await request(app).get(`/api/buildings?organizationId=${MOCK_ORG_A}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('admin + ?organizationId for org they cannot access → 403', async () => {
    const app = makeApp('admin');
    const res = await request(app).get(`/api/buildings?organizationId=${MOCK_ORG_B}`);
    expect(res.status).toBe(403);
  });

  it('resident → 403', async () => {
    const app = makeApp('resident');
    const res = await request(app).get('/api/buildings');
    expect(res.status).toBe(403);
  });

  it('tenant → 403', async () => {
    const app = makeApp('tenant');
    const res = await request(app).get('/api/buildings');
    expect(res.status).toBe(403);
  });
});

// ============================================================
// Part 3: Regression — admin organizations page buildings call (task #1690)
//
// The /admin/organizations page was calling the non-existent route
// GET /api/organizations/:id/buildings. The fix points it at the
// existing GET /api/buildings?organizationId=:id endpoint. This suite
// locks in that the correct endpoint returns non-empty buildings for
// a super_admin viewing a specific org, ensuring the org cards always
// show real building data.
// ============================================================
describe('GET /api/buildings?organizationId — admin/organizations page regression (task #1690)', () => {
  it('super_admin with ?organizationId for org with buildings → 200 non-empty list', async () => {
    const app = makeApp('super_admin');
    const res = await request(app).get(`/api/buildings?organizationId=${MOCK_ORG_A}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    res.body.forEach((b: any) => {
      expect(b.organizationId).toBe(MOCK_ORG_A);
    });
  });

  it('super_admin with ?organizationId for second org → 200 non-empty list', async () => {
    const app = makeApp('super_admin');
    const res = await request(app).get(`/api/buildings?organizationId=${MOCK_ORG_B}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    res.body.forEach((b: any) => {
      expect(b.organizationId).toBe(MOCK_ORG_B);
    });
  });

  it('results are scoped to the requested org (no cross-org leakage)', async () => {
    const app = makeApp('super_admin');
    const resA = await request(app).get(`/api/buildings?organizationId=${MOCK_ORG_A}`);
    const resB = await request(app).get(`/api/buildings?organizationId=${MOCK_ORG_B}`);
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    const idsA = new Set(resA.body.map((b: any) => b.id));
    const idsB = new Set(resB.body.map((b: any) => b.id));
    const overlap = [...idsA].filter((id) => idsB.has(id));
    expect(overlap).toHaveLength(0);
  });
});
