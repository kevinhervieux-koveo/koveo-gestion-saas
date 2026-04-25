/**
 * User Serializer HTTP Integration Tests (Task #964)
 *
 * Makes real authenticated HTTP requests against the test Express application
 * and asserts that no bcrypt hash prefix (`$2a$` / `$2b$`) and no `password`
 * key appear in any user-related API response body.
 *
 * This is the live counterpart to the static analysis in
 * tests/security/user-password-leak-audit.test.ts — it validates runtime
 * serialization rather than source-code structure.
 *
 * Endpoints covered (all 8 from Task #964):
 *   1. GET /api/users                                     (admin role → 200)
 *   2. GET /api/users?organizationId=<own-org>            (org-scoped variant → 200)
 *   3. GET /api/users/:id                                 (self lookup → 200)
 *   4. GET /api/auth/user                                 (session-based → 200)
 *   5. GET /api/buildings/:buildingId/residences          (admin → 200)
 *   6. GET /api/residences/:id/assigned-users             (admin → 200)
 *   7. GET /api/maintenance/projects/:id/vendors          (admin → 200)
 *   8. GET /api/users as tenant role                      (403 expected; if 200, body checked)
 *
 * Pass-#21 probe: the `Object.keys` of the first user object in the
 * GET /api/users response must not contain "password".
 */

import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testApp as app } from './test-app';
import { db } from '../db';
import {
  users,
  organizations,
  buildings,
  userOrganizations,
  residences,
  userResidences,
  maintenanceProjects,
  vendors,
  submissionVendors,
} from '@shared/schema';
import { eq } from 'drizzle-orm';

const SENTINEL_HASH =
  '$2b$12$AuDiTtEsThAsH964sentinel.AuDiTtEsTsEcUrItY.task964.x';

describe('User serializer HTTP — no password leak (all 8 endpoints)', () => {
  let adminUser: typeof users.$inferSelect;
  let tenantUser: typeof users.$inferSelect;
  let testOrg: typeof organizations.$inferSelect;
  let testBuilding: typeof buildings.$inferSelect;
  let testResidence: typeof residences.$inferSelect;
  let testProject: typeof maintenanceProjects.$inferSelect;
  const suffix = Date.now();

  // -------------------------------------------------------------------------
  // Seed
  // -------------------------------------------------------------------------
  beforeAll(async () => {
    const [org] = await db
      .insert(organizations)
      .values({
        name: `PwdLeak Audit Org ${suffix}`,
        type: 'management_company',
        address: '1 Audit St',
        city: 'Montreal',
        postalCode: 'H1H 1H1',
        email: `pwdleak-org-${suffix}@example.com`,
      })
      .returning();
    testOrg = org;

    const [admin] = await db
      .insert(users)
      .values({
        username: `pwdleak-admin-${suffix}`,
        email: `pwdleak-admin-${suffix}@example.com`,
        password: SENTINEL_HASH,
        firstName: 'Audit',
        lastName: 'Admin',
        role: 'admin',
        isActive: true,
      })
      .returning();
    adminUser = admin;

    await db.insert(userOrganizations).values({
      userId: adminUser.id,
      organizationId: testOrg.id,
      organizationRole: 'admin',
      isActive: true,
      canAccessAllOrganizations: true,
    });

    const [tenant] = await db
      .insert(users)
      .values({
        username: `pwdleak-tenant-${suffix}`,
        email: `pwdleak-tenant-${suffix}@example.com`,
        password: SENTINEL_HASH,
        firstName: 'Tenant',
        lastName: 'User',
        role: 'tenant',
        isActive: true,
      })
      .returning();
    tenantUser = tenant;

    await db.insert(userOrganizations).values({
      userId: tenantUser.id,
      organizationId: testOrg.id,
      organizationRole: 'tenant',
      isActive: true,
      canAccessAllOrganizations: false,
    });

    const [building] = await db
      .insert(buildings)
      .values({
        name: `PwdLeak Building ${suffix}`,
        address: '1 Audit',
        city: 'Montreal',
        postalCode: 'H1H 1H1',
        buildingType: 'apartment',
        totalUnits: 1,
        organizationId: testOrg.id,
        isActive: true,
      })
      .returning();
    testBuilding = building;

    const [residence] = await db
      .insert(residences)
      .values({
        buildingId: testBuilding.id,
        unitNumber: '101',
        isActive: true,
      })
      .returning();
    testResidence = residence;

    await db.insert(userResidences).values({
      userId: tenantUser.id,
      residenceId: testResidence.id,
      relationshipType: 'tenant',
      startDate: new Date().toISOString().split('T')[0],
      isActive: true,
    });

    const [project] = await db
      .insert(maintenanceProjects)
      .values({
        buildingId: testBuilding.id,
        projectNumber: `TEST-${suffix}`,
        title: 'PwdLeak Test Project',
        type: 'not_sure',
        origin: 'manual',
        status: 'planned',
        priority: 'medium',
        createdBy: adminUser.id,
      })
      .returning();
    testProject = project;

    const [vendor] = await db
      .insert(vendors)
      .values({
        organizationId: testOrg.id,
        name: `PwdLeak Vendor ${suffix}`,
        isActive: true,
      })
      .returning();

    await db.insert(submissionVendors).values({
      projectId: testProject.id,
      vendorName: vendor.id,
      projectType: 'not_sure',
    });
  });

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  function assertNoPasswordLeak(body: unknown, endpoint: string): void {
    const json = JSON.stringify(body);
    expect(json, `${endpoint}: bcrypt $2b$ sentinel must not appear`).not.toMatch(
      /\$2[ab]\$/
    );
    expect(json, `${endpoint}: "password" key must not appear in JSON`).not.toMatch(
      /"password"\s*:/
    );
  }

  // -------------------------------------------------------------------------
  // 1. GET /api/users  (admin role — must return 200)
  // -------------------------------------------------------------------------
  it('GET /api/users — no password in paginated user list', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('x-test-user-id', adminUser.id)
      .expect(200);

    assertNoPasswordLeak(res.body, 'GET /api/users');
    const usersList: unknown[] = res.body.users ?? [];
    expect(Array.isArray(usersList)).toBe(true);
    if (usersList.length > 0) {
      const keys = Object.keys(usersList[0] as object);
      expect(keys, 'Pass-#21: first user object must not have a `password` key').not.toContain(
        'password'
      );
    }
  });

  // -------------------------------------------------------------------------
  // 2. GET /api/users?organizationId=<own-org>  (org-scoped, admin → 200)
  // -------------------------------------------------------------------------
  it('GET /api/users?organizationId=... — no password in org-filtered user list', async () => {
    const res = await request(app)
      .get(`/api/users?organizationId=${testOrg.id}`)
      .set('x-test-user-id', adminUser.id)
      .expect(200);

    assertNoPasswordLeak(res.body, 'GET /api/users?organizationId');
    const usersList: unknown[] = res.body.users ?? [];
    for (const u of usersList) {
      expect(Object.keys(u as object)).not.toContain('password');
    }
  });

  // -------------------------------------------------------------------------
  // 3. GET /api/users/:id  (self lookup, admin → 200)
  // -------------------------------------------------------------------------
  it('GET /api/users/:id — no password in single-user response', async () => {
    const res = await request(app)
      .get(`/api/users/${adminUser.id}`)
      .set('x-test-user-id', adminUser.id)
      .expect(200);

    assertNoPasswordLeak(res.body, 'GET /api/users/:id');
    expect(Object.keys(res.body as object)).not.toContain('password');
  });

  // -------------------------------------------------------------------------
  // 4. GET /api/auth/user  (session-based current user → 200)
  // -------------------------------------------------------------------------
  it('GET /api/auth/user — no password in current-user response', async () => {
    const res = await request(app)
      .get('/api/auth/user')
      .set('x-test-user-id', adminUser.id)
      .expect(200);

    assertNoPasswordLeak(res.body, 'GET /api/auth/user');
    expect(Object.keys(res.body as object)).not.toContain('password');
  });

  // -------------------------------------------------------------------------
  // 5. GET /api/buildings/:buildingId/residences  (admin → 200)
  //    Returns residence rows; verifying no user password bleeds into the
  //    response body (e.g. from embedded tenant assignments).
  // -------------------------------------------------------------------------
  it('GET /api/buildings/:buildingId/residences — no password in response', async () => {
    const res = await request(app)
      .get(`/api/buildings/${testBuilding.id}/residences`)
      .set('x-test-user-id', adminUser.id)
      .expect(200);

    assertNoPasswordLeak(res.body, 'GET /api/buildings/:buildingId/residences');
  });

  // -------------------------------------------------------------------------
  // 6. GET /api/residences/:id/assigned-users  (admin → 200)
  // -------------------------------------------------------------------------
  it('GET /api/residences/:id/assigned-users — no password in assigned user list', async () => {
    const res = await request(app)
      .get(`/api/residences/${testResidence.id}/assigned-users`)
      .set('x-test-user-id', adminUser.id)
      .expect(200);

    assertNoPasswordLeak(res.body, 'GET /api/residences/:id/assigned-users');
    const list: unknown[] = Array.isArray(res.body) ? res.body : [];
    for (const u of list) {
      expect(Object.keys(u as object)).not.toContain('password');
    }
  });

  // -------------------------------------------------------------------------
  // 7. GET /api/maintenance/projects/:id/vendors  (admin → 200)
  //    Returns vendor/submission_vendor rows (not users); bcrypt guard still
  //    validates no user hash bleeds through.
  // -------------------------------------------------------------------------
  it('GET /api/maintenance/projects/:id/vendors — no password in vendor response', async () => {
    const res = await request(app)
      .get(`/api/maintenance/projects/${testProject.id}/vendors`)
      .set('x-test-user-id', adminUser.id)
      .expect(200);

    assertNoPasswordLeak(res.body, 'GET /api/maintenance/projects/:id/vendors');
  });

  // -------------------------------------------------------------------------
  // 8. GET /api/users as tenant role  (non-admin → 403 expected)
  //    If the authorization decision ever changes to 200, the body must still
  //    contain no password data.
  // -------------------------------------------------------------------------
  it('GET /api/users as tenant — 403 access denied or safe body if 200', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('x-test-user-id', tenantUser.id);

    if (res.status === 200) {
      assertNoPasswordLeak(res.body, 'GET /api/users (tenant)');
      const usersList: unknown[] = res.body.users ?? [];
      for (const u of usersList) {
        expect(Object.keys(u as object)).not.toContain('password');
      }
    } else {
      expect([403, 401]).toContain(res.status);
    }
  });

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------
  afterAll(async () => {
    if (testProject?.id) {
      await db.delete(submissionVendors).where(eq(submissionVendors.projectId, testProject.id));
      await db.delete(maintenanceProjects).where(eq(maintenanceProjects.id, testProject.id));
    }
    if (testOrg?.id) {
      await db.delete(vendors).where(eq(vendors.organizationId, testOrg.id));
    }
    if (testResidence?.id) {
      await db.delete(userResidences).where(eq(userResidences.residenceId, testResidence.id));
      await db.delete(residences).where(eq(residences.id, testResidence.id));
    }
    if (testBuilding?.id) {
      await db.delete(buildings).where(eq(buildings.id, testBuilding.id));
    }
    if (tenantUser?.id) {
      await db.delete(userOrganizations).where(eq(userOrganizations.userId, tenantUser.id));
      await db.delete(userResidences).where(eq(userResidences.userId, tenantUser.id));
      await db.delete(users).where(eq(users.id, tenantUser.id));
    }
    if (adminUser?.id) {
      await db.delete(userOrganizations).where(eq(userOrganizations.userId, adminUser.id));
      await db.delete(users).where(eq(users.id, adminUser.id));
    }
    if (testOrg?.id) {
      await db.delete(organizations).where(eq(organizations.id, testOrg.id));
    }
  });
});
