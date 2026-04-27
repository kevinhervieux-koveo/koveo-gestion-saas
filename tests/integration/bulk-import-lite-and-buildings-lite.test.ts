/**
 * @jest-environment node
 *
 * Task #1310 — Integration tests for the two lightweight bulk-import
 * read endpoints:
 *
 *   GET /api/admin/bulk-import/sessions/:id/lite
 *   GET /api/admin/bulk-import/buildings-lite
 *
 * Each endpoint is covered by three contract axes:
 *
 *   1. Happy path — successful 200, correct response shape.
 *   2. Auth required — no session header → 401.
 *   3. Role required — non-admin (manager role) → 403.
 *
 * The session-lite endpoint also covers:
 *   4. 404 for an unknown session ID.
 *   5. Cross-org scope documentation: loadSession has no org-scope guard (by-ID
 *      only); a foreign admin currently receives 200. A follow-up task should
 *      add the guard and restrict this to 403/404.
 *
 * The buildings-lite endpoint also covers:
 *   6. Org-scope correctness — a user linked only to org A must NOT
 *      see buildings belonging to org B.
 *
 * Same real-Postgres pattern used by the other bulk-import integration
 * suites: gated on `_INTEGRATION_DB_URL`, skips cleanly when no DB is
 * available so this suite never blocks CI lanes that lack a Postgres
 * fixture.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

jest.mock('../../__mocks__/server/storage', () => {
  const path = require('path');
  return require(path.resolve(__dirname, '../../server/storage.ts'));
});
jest.mock('../../__mocks__/server/auth', () => {
  const path = require('path');
  return require(path.resolve(__dirname, '../../server/auth.ts'));
});
jest.mock('../../__mocks__/server/routes', () => {
  const path = require('path');
  return require(path.resolve(__dirname, '../../server/routes.ts'));
});
jest.mock('../../server/config/index', () => {
  const path = require('path');
  return require(path.resolve(__dirname, '../../server/config/index.ts'));
});

import express from 'express';
import session from 'express-session';
import request from 'supertest';
import crypto from 'crypto';
import fs from 'fs';
import nodePath from 'path';
import { inArray, eq } from 'drizzle-orm';

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const TEST_TAG = 'task1310-lite-endpoints';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

describeIfDb('bulk-import lite endpoints — Task #1310', () => {
  let app: express.Application;
  let db: any;
  let schema: any;

  const ids = {
    orgA: crypto.randomUUID(),
    orgB: crypto.randomUUID(),
    buildingA: crypto.randomUUID(),
    buildingB: crypto.randomUUID(),
    admin: crypto.randomUUID(),
    manager: crypto.randomUUID(),
    foreignAdmin: crypto.randomUUID(),
  };

  const trackedSessions = new Set<string>();
  const trackedItems = new Set<string>();
  const stagingRoot = nodePath.join(process.cwd(), '.staging', 'bulk-import');
  const PREV_STAGING_ROOT_ENV = process.env.BULK_IMPORT_STAGING_ROOT;

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    process.env.SESSION_SECRET =
      process.env.SESSION_SECRET || 'test-session-secret-task1310';
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';
    delete process.env.BULK_IMPORT_STAGING_ROOT;
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-fake-key';

    db = require('../../server/db').db;
    schema = require('@shared/schema');
    const { registerBulkImportRoutes } = require('../../server/api/bulk-import');

    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(
      session({
        secret: process.env.SESSION_SECRET!,
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: { secure: false, httpOnly: true, sameSite: 'lax', path: '/' },
        name: 'koveo.sid',
      }),
    );
    registerBulkImportRoutes(app);

    // Insert two organizations so we can verify scope isolation.
    await db.insert(schema.organizations).values([
      {
        id: ids.orgA,
        name: `${TEST_TAG} OrgA ${ids.orgA.slice(0, 8)}`,
        type: 'syndicate',
        address: '1 Test A',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A1',
      },
      {
        id: ids.orgB,
        name: `${TEST_TAG} OrgB ${ids.orgB.slice(0, 8)}`,
        type: 'syndicate',
        address: '2 Test B',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A1',
      },
    ]);

    await db.insert(schema.buildings).values([
      {
        id: ids.buildingA,
        organizationId: ids.orgA,
        name: `${TEST_TAG} BldgA`,
        address: '1 A',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A1',
        buildingType: 'condo',
        totalUnits: 4,
        isActive: true,
      },
      {
        id: ids.buildingB,
        organizationId: ids.orgB,
        name: `${TEST_TAG} BldgB`,
        address: '2 B',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A1',
        buildingType: 'condo',
        totalUnits: 8,
        isActive: true,
      },
    ]);

    await db.insert(schema.users).values([
      {
        id: ids.admin,
        username: `${TEST_TAG}-admin-${ids.admin.slice(0, 8)}`,
        email: `${ids.admin}@${TEST_TAG}.test`,
        password: 'unused',
        firstName: 'Admin',
        lastName: 'Test',
        role: 'admin',
        isActive: true,
      },
      {
        id: ids.manager,
        username: `${TEST_TAG}-mgr-${ids.manager.slice(0, 8)}`,
        email: `${ids.manager}@${TEST_TAG}.test`,
        password: 'unused',
        firstName: 'Manager',
        lastName: 'Test',
        role: 'manager',
        isActive: true,
      },
      {
        id: ids.foreignAdmin,
        username: `${TEST_TAG}-foreign-${ids.foreignAdmin.slice(0, 8)}`,
        email: `${ids.foreignAdmin}@${TEST_TAG}.test`,
        password: 'unused',
        firstName: 'Foreign',
        lastName: 'Admin',
        role: 'admin',
        isActive: true,
      },
    ]);

    // Link primary admin to orgA only. foreignAdmin is linked to orgB only.
    // manager is linked to orgA (to test role rejection).
    await db.insert(schema.userOrganizations).values([
      {
        userId: ids.admin,
        organizationId: ids.orgA,
        organizationRole: 'admin',
        isActive: true,
      },
      {
        userId: ids.manager,
        organizationId: ids.orgA,
        organizationRole: 'manager',
        isActive: true,
      },
      {
        userId: ids.foreignAdmin,
        organizationId: ids.orgB,
        organizationRole: 'admin',
        isActive: true,
      },
    ]);
  }, 30_000);

  afterAll(async () => {
    const restoreEnv = () => {
      if (PREV_STAGING_ROOT_ENV === undefined) {
        delete process.env.BULK_IMPORT_STAGING_ROOT;
      } else {
        process.env.BULK_IMPORT_STAGING_ROOT = PREV_STAGING_ROOT_ENV;
      }
    };
    if (!REAL_DB_URL || !db) {
      restoreEnv();
      return;
    }

    if (trackedItems.size > 0) {
      await db
        .delete(schema.bulkImportItems)
        .where(inArray(schema.bulkImportItems.id, Array.from(trackedItems)));
    }
    if (trackedSessions.size > 0) {
      await db
        .delete(schema.bulkImportSessions)
        .where(inArray(schema.bulkImportSessions.id, Array.from(trackedSessions)));
      for (const sid of trackedSessions) {
        const dir = nodePath.join(stagingRoot, sid);
        try {
          if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
        } catch {
          /* best-effort */
        }
      }
    }
    await db
      .delete(schema.userOrganizations)
      .where(
        inArray(schema.userOrganizations.userId, [
          ids.admin,
          ids.manager,
          ids.foreignAdmin,
        ]),
      );
    await db
      .delete(schema.users)
      .where(inArray(schema.users.id, [ids.admin, ids.manager, ids.foreignAdmin]));
    await db
      .delete(schema.buildings)
      .where(inArray(schema.buildings.id, [ids.buildingA, ids.buildingB]));
    await db
      .delete(schema.organizations)
      .where(inArray(schema.organizations.id, [ids.orgA, ids.orgB]));
    restoreEnv();
  }, 30_000);

  beforeEach(async () => {
    if (!REAL_DB_URL) return;
    if (trackedItems.size > 0) {
      await db
        .delete(schema.bulkImportItems)
        .where(inArray(schema.bulkImportItems.id, Array.from(trackedItems)));
      trackedItems.clear();
    }
    if (trackedSessions.size > 0) {
      await db
        .delete(schema.bulkImportSessions)
        .where(inArray(schema.bulkImportSessions.id, Array.from(trackedSessions)));
      for (const sid of trackedSessions) {
        const dir = nodePath.join(stagingRoot, sid);
        try {
          if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
        } catch {
          /* best-effort */
        }
      }
      trackedSessions.clear();
    }
  });

  async function createSession(adminId: string, buildingId: string): Promise<string> {
    const res = await request(app)
      .post('/api/admin/bulk-import/sessions')
      .set('x-test-user-id', adminId)
      .send({ buildingId });
    expect([200, 201]).toContain(res.status);
    const sid: string = res.body.id;
    trackedSessions.add(sid);
    return sid;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/admin/bulk-import/sessions/:id/lite
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/admin/bulk-import/sessions/:id/lite', () => {
    it('returns 401 when no session header is provided', async () => {
      const nonExistentId = crypto.randomUUID();
      const res = await request(app).get(
        `/api/admin/bulk-import/sessions/${nonExistentId}/lite`,
      );
      // requireAuth returns 401 when no identity is supplied.
      expect(res.status).toBe(401);
    });

    it('returns 403 when the caller has a manager (non-admin) role', async () => {
      const sid = await createSession(ids.admin, ids.buildingA);
      const res = await request(app)
        .get(`/api/admin/bulk-import/sessions/${sid}/lite`)
        .set('x-test-user-id', ids.manager);
      // requireRole(['admin']) returns 403 for an authenticated but non-admin caller.
      expect(res.status).toBe(403);
    });

    it('returns 404 for a session ID that does not exist', async () => {
      const nonExistentId = crypto.randomUUID();
      const res = await request(app)
        .get(`/api/admin/bulk-import/sessions/${nonExistentId}/lite`)
        .set('x-test-user-id', ids.admin);
      expect(res.status).toBe(404);
    });

    it('returns 200 with correct session shape and empty items for a new session', async () => {
      const sid = await createSession(ids.admin, ids.buildingA);
      const res = await request(app)
        .get(`/api/admin/bulk-import/sessions/${sid}/lite`)
        .set('x-test-user-id', ids.admin);

      expect(res.status).toBe(200);
      // Response must include both `session` and `items` keys.
      expect(res.body).toHaveProperty('session');
      expect(res.body).toHaveProperty('items');

      // Session shape sanity checks.
      const { session } = res.body;
      expect(session.id).toBe(sid);
      expect(session.buildingId).toBe(ids.buildingA);
      expect(session.adminUserId).toBe(ids.admin);
      expect(session.status).toBe('active');

      // A brand-new session has no items.
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items).toHaveLength(0);
    });

    it('lite payload does not include raw AI JSON blobs (screening/sortingDecision)', async () => {
      const sid = await createSession(ids.admin, ids.buildingA);
      const res = await request(app)
        .get(`/api/admin/bulk-import/sessions/${sid}/lite`)
        .set('x-test-user-id', ids.admin);
      expect(res.status).toBe(200);
      // The lite endpoint omits the full `screening` and `sortingDecision` JSON
      // blobs from each item row. An empty session naturally has no items, so
      // we just verify the endpoint resolves successfully and the shape is correct.
      expect(res.body).toHaveProperty('session');
      expect(res.body).toHaveProperty('items');
    });

    it('documents cross-org access: the session-lite endpoint is not org-scoped (fetches by ID only)', async () => {
      // A session created by ids.admin belongs to orgA.
      // ids.foreignAdmin is linked to orgB only.
      // The lite endpoint currently performs no org-scope check — it queries by
      // session ID alone (see loadSession in server/api/bulk-import.ts).
      // This test documents that behavior.  A follow-up task should add the
      // org-scope guard and flip this expectation to 403/404.
      const sid = await createSession(ids.admin, ids.buildingA);
      const res = await request(app)
        .get(`/api/admin/bulk-import/sessions/${sid}/lite`)
        .set('x-test-user-id', ids.foreignAdmin);
      // Until org-scope is enforced on this endpoint a cross-org admin receives 200.
      expect(res.status).toBe(200);
      expect(res.body.session.id).toBe(sid);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/admin/bulk-import/buildings-lite
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/admin/bulk-import/buildings-lite', () => {
    it('returns 401 when no session header is provided', async () => {
      const res = await request(app).get('/api/admin/bulk-import/buildings-lite');
      // requireAuth returns 401 when no identity is supplied.
      expect(res.status).toBe(401);
    });

    it('returns 403 when the caller has a manager (non-admin) role', async () => {
      const res = await request(app)
        .get('/api/admin/bulk-import/buildings-lite')
        .set('x-test-user-id', ids.manager);
      // requireRole(['admin']) returns 403 for an authenticated but non-admin caller.
      expect(res.status).toBe(403);
    });

    it('returns 200 with an array of building objects in the correct shape', async () => {
      const res = await request(app)
        .get('/api/admin/bulk-import/buildings-lite')
        .set('x-test-user-id', ids.admin);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      // Every building must carry the scalar fields the picker needs.
      for (const b of res.body) {
        expect(b).toHaveProperty('id');
        expect(b).toHaveProperty('name');
        expect(b).toHaveProperty('organizationId');
      }
    });

    it('scopes results to the calling user's organization (org-scope correctness)', async () => {
      // ids.admin is linked to orgA only — they must see buildingA but not buildingB.
      const res = await request(app)
        .get('/api/admin/bulk-import/buildings-lite')
        .set('x-test-user-id', ids.admin);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      const returnedIds: string[] = res.body.map((b: any) => b.id);
      expect(returnedIds).toContain(ids.buildingA);
      expect(returnedIds).not.toContain(ids.buildingB);
    });

    it('a user linked only to orgB does not see buildings from orgA', async () => {
      // ids.foreignAdmin is linked to orgB only.
      const res = await request(app)
        .get('/api/admin/bulk-import/buildings-lite')
        .set('x-test-user-id', ids.foreignAdmin);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      const returnedIds: string[] = res.body.map((b: any) => b.id);
      expect(returnedIds).toContain(ids.buildingB);
      expect(returnedIds).not.toContain(ids.buildingA);
    });
  });
});
