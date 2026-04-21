/**
 * @jest-environment node
 *
 * @file Cross-organization data-isolation behavioural integration tests
 * @description Replaces the skipped unit-tier suite at
 *   `tests/security/database-permissions.test.ts` (Task #169 / Task #176).
 *   Exercises the real Express app + setupAuthRoutes + register*Routes
 *   stack against the real (test) database via `_INTEGRATION_DB_URL`.
 *
 *   Coverage:
 *     - Cross-organization listing isolation (users + buildings)
 *     - SQL-injection-safe filtering of organization scope
 *     - Password-hash redaction on /api/auth/user
 *     - Privilege-escalation prevention via PUT /api/users/:id role updates
 *     - Session invalidation on logout
 *     - Session-fixation: cookie value changes after login
 *     - Input-validation safety on /api/users `search` parameter
 *
 *   Pattern mirrors `tests/integration/multi-table-write-rollback.test.ts`:
 *   skip the suite if no real DB URL is available.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// jest.config.cjs maps `./storage`, `./auth`, `./routes` (and the relative
// `../../server/...` variants) to in-repo unit-tier mocks. For this real-DB
// integration suite we MUST exercise the real implementations. Override the
// mocks at their resolved paths so jest substitutes the real modules.
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

// `server/config/index.js` is a stale orphaned file that Jest's default
// moduleFileExtensions picks before `index.ts`. It only exports a tiny
// `{database, server}` shape, missing `rateLimit`/`session` etc., which
// crashes real `server/auth.ts`. Force the .ts module instead.
jest.mock('../../server/config/index', () => {
  const path = require('path');
  return require(path.resolve(__dirname, '../../server/config/index.ts'));
});

import express from 'express';
import session from 'express-session';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { inArray } from 'drizzle-orm';

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const TEST_TAG = 'task176-cross-org';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

describeIfDb('cross-organization data isolation — Task #176', () => {
  let app: express.Application;
  let db: any;
  let schema: any;

  const created: Record<string, Set<string>> = {
    userOrganizations: new Set(),
    users: new Set(),
    buildings: new Set(),
    organizations: new Set(),
  };

  const PASSWORD = 'Password!234';
  const ids = {
    org1: crypto.randomUUID(),
    org2: crypto.randomUUID(),
    manager1: crypto.randomUUID(),
    resident1: crypto.randomUUID(),
    manager2: crypto.randomUUID(),
    building1: crypto.randomUUID(),
    building2: crypto.randomUUID(),
  };
  const emails = {
    manager1: `${ids.manager1}@${TEST_TAG}.test`,
    resident1: `${ids.resident1}@${TEST_TAG}.test`,
    manager2: `${ids.manager2}@${TEST_TAG}.test`,
  };

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    process.env.SESSION_SECRET =
      process.env.SESSION_SECRET || 'test-session-secret-cross-org';
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';

    db = require('../../server/db').db;
    schema = require('@shared/schema');
    const { setupAuthRoutes } = require('../../server/auth');
    const { registerUserRoutes } = require('../../server/api/users');
    const { registerBuildingRoutes } = require('../../server/api/buildings');

    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    // Use in-memory session store for the test app — avoids needing a
    // table or PostgreSQL session-store wiring in CI.
    app.use(
      session({
        secret: process.env.SESSION_SECRET!,
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: { secure: false, httpOnly: true, sameSite: 'lax', path: '/' },
        name: 'koveo.sid',
      })
    );
    setupAuthRoutes(app);
    registerUserRoutes(app);
    registerBuildingRoutes(app);

    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    await db.insert(schema.organizations).values([
      {
        id: ids.org1,
        name: `${TEST_TAG} Org 1 ${ids.org1.slice(0, 8)}`,
        type: 'syndicate',
        address: '1 Test',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A1',
      },
      {
        id: ids.org2,
        name: `${TEST_TAG} Org 2 ${ids.org2.slice(0, 8)}`,
        type: 'syndicate',
        address: '2 Test',
        city: 'Quebec',
        province: 'QC',
        postalCode: 'G1A1A1',
      },
    ]);
    created.organizations.add(ids.org1);
    created.organizations.add(ids.org2);

    await db.insert(schema.buildings).values([
      {
        id: ids.building1,
        organizationId: ids.org1,
        name: `${TEST_TAG} bldg-1`,
        address: '1 Test',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A1',
        buildingType: 'condo',
        totalUnits: 1,
        isActive: true,
      },
      {
        id: ids.building2,
        organizationId: ids.org2,
        name: `${TEST_TAG} bldg-2`,
        address: '2 Test',
        city: 'Quebec',
        province: 'QC',
        postalCode: 'G1A1A1',
        buildingType: 'condo',
        totalUnits: 1,
        isActive: true,
      },
    ]);
    created.buildings.add(ids.building1);
    created.buildings.add(ids.building2);

    await db.insert(schema.users).values([
      {
        id: ids.manager1,
        username: `${TEST_TAG}-mgr1-${ids.manager1.slice(0, 8)}`,
        email: emails.manager1,
        password: passwordHash,
        firstName: 'Mgr',
        lastName: 'One',
        role: 'manager',
        isActive: true,
      },
      {
        id: ids.resident1,
        username: `${TEST_TAG}-res1-${ids.resident1.slice(0, 8)}`,
        email: emails.resident1,
        password: passwordHash,
        firstName: 'Res',
        lastName: 'One',
        role: 'resident',
        isActive: true,
      },
      {
        id: ids.manager2,
        username: `${TEST_TAG}-mgr2-${ids.manager2.slice(0, 8)}`,
        email: emails.manager2,
        password: passwordHash,
        firstName: 'Mgr',
        lastName: 'Two',
        role: 'manager',
        isActive: true,
      },
    ]);
    created.users.add(ids.manager1);
    created.users.add(ids.resident1);
    created.users.add(ids.manager2);

    const links = [
      {
        id: crypto.randomUUID(),
        userId: ids.manager1,
        organizationId: ids.org1,
        organizationRole: 'manager',
        isActive: true,
      },
      {
        id: crypto.randomUUID(),
        userId: ids.resident1,
        organizationId: ids.org1,
        organizationRole: 'resident',
        isActive: true,
      },
      {
        id: crypto.randomUUID(),
        userId: ids.manager2,
        organizationId: ids.org2,
        organizationRole: 'manager',
        isActive: true,
      },
    ];
    await db.insert(schema.userOrganizations).values(links);
    links.forEach((l) => created.userOrganizations.add(l.id));
  }, 60000);

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;
    if (created.userOrganizations.size) {
      await db
        .delete(schema.userOrganizations)
        .where(
          inArray(schema.userOrganizations.id, [...created.userOrganizations])
        );
    }
    if (created.users.size) {
      await db
        .delete(schema.users)
        .where(inArray(schema.users.id, [...created.users]));
    }
    if (created.buildings.size) {
      await db
        .delete(schema.buildings)
        .where(inArray(schema.buildings.id, [...created.buildings]));
    }
    if (created.organizations.size) {
      await db
        .delete(schema.organizations)
        .where(
          inArray(schema.organizations.id, [...created.organizations])
        );
    }
  }, 60000);

  async function loginAs(email: string) {
    const agent = request.agent(app);
    const res = await agent
      .post('/api/auth/login')
      .send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    return agent;
  }

  it('login succeeds and the response body never includes the password hash', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: emails.manager1, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body?.user?.id).toBe(ids.manager1);
    expect(res.body?.user?.password).toBeUndefined();
  }, 30000);

  it('GET /api/auth/user redacts the password hash for the authenticated user', async () => {
    const agent = await loginAs(emails.manager1);
    const res = await agent.get('/api/auth/user');

    expect(res.status).toBe(200);
    expect(res.body?.id).toBe(ids.manager1);
    expect(res.body?.password).toBeUndefined();
  }, 30000);

  it('GET /api/auth/user requires authentication (no session → 401)', async () => {
    const res = await request(app).get('/api/auth/user');
    expect(res.status).toBe(401);
  }, 30000);

  it('GET /api/users for org-1 manager returns org-1 peers and NEVER org-2 users', async () => {
    const agent = await loginAs(emails.manager1);
    const res = await agent.get('/api/users').query({ limit: 200 });

    expect(res.status).toBe(200);
    const returnedIds = (res.body?.users ?? []).map((u: any) => u.id);
    // Positive: org-1 peers (the manager themselves at minimum) must be visible.
    expect(returnedIds).toEqual(expect.arrayContaining([ids.manager1]));
    // Negative: org-2's manager must NEVER leak across organizations.
    expect(returnedIds).not.toContain(ids.manager2);
  }, 30000);

  it('SQL-injection-shaped organization filter does not leak org-2 users', async () => {
    const agent = await loginAs(emails.manager1);
    const res = await agent
      .get('/api/users')
      .query({ organization: `${ids.org2}' OR '1'='1`, limit: 200 });

    // Either rejected (4xx) or scoped — must NEVER return org-2's manager2.
    expect(res.status).toBeLessThan(500);
    if (res.status === 200) {
      const returnedIds = (res.body?.users ?? []).map((u: any) => u.id);
      expect(returnedIds).not.toContain(ids.manager2);
    }
  }, 30000);

  it('GET /api/buildings for org-1 manager lists org-1 building and NEVER org-2 building', async () => {
    const agent = await loginAs(emails.manager1);
    const res = await agent.get('/api/buildings');

    expect(res.status).toBe(200);
    const returnedIds = (res.body ?? []).map((b: any) => b.id);
    expect(returnedIds).toEqual(expect.arrayContaining([ids.building1]));
    expect(returnedIds).not.toContain(ids.building2);
  }, 30000);

  it('GET /api/manager/buildings/:id refuses cross-org object access (IDOR guard)', async () => {
    const agent = await loginAs(emails.manager1);

    // Sanity: org-1 manager can read its OWN building.
    const own = await agent.get(`/api/manager/buildings/${ids.building1}`);
    expect([200, 304]).toContain(own.status);

    // Cross-org request for org-2's building must be rejected — never 200
    // with the building payload, and never 5xx.
    const cross = await agent.get(`/api/manager/buildings/${ids.building2}`);
    expect(cross.status).toBeGreaterThanOrEqual(400);
    expect(cross.status).toBeLessThan(500);
    expect(cross.body?.id).not.toBe(ids.building2);
  }, 30000);

  it('PUT /api/users/:id from a resident cannot escalate own role to admin', async () => {
    const agent = await loginAs(emails.resident1);
    const res = await agent
      .put(`/api/users/${ids.resident1}`)
      .send({ role: 'admin' });

    expect(res.status).toBe(403);

    // Confirm the persisted role is unchanged.
    const { eq } = require('drizzle-orm');
    const [row] = await db
      .select({ role: schema.users.role })
      .from(schema.users)
      .where(eq(schema.users.id, ids.resident1))
      .limit(1);
    expect(row.role).toBe('resident');
  }, 30000);

  it('logout invalidates the session — subsequent /api/auth/user returns 401', async () => {
    const agent = await loginAs(emails.manager1);
    const before = await agent.get('/api/auth/user');
    expect(before.status).toBe(200);

    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(200);

    const after = await agent.get('/api/auth/user');
    expect(after.status).toBe(401);
  }, 30000);

  it('login issues a session cookie distinct from any pre-login cookie (fixation guard)', async () => {
    const agent = request.agent(app);
    // Touch an endpoint to provoke any anonymous cookie if one were issued.
    const pre = await agent.get('/api/auth/user');
    const preCookies = pre.headers['set-cookie'] as string[] | undefined;

    const login = await agent
      .post('/api/auth/login')
      .send({ email: emails.manager1, password: PASSWORD });
    expect(login.status).toBe(200);

    const loginCookies = login.headers['set-cookie'] as string[] | undefined;
    // express-session with saveUninitialized:false will not set a cookie
    // for the unauthenticated request, but MUST issue one on login.
    expect(loginCookies).toBeDefined();
    if (preCookies && preCookies.length) {
      expect(loginCookies).not.toEqual(preCookies);
    }
  }, 30000);

  it('search parameter tolerates injection-shaped strings without 5xx', async () => {
    const agent = await loginAs(emails.manager1);
    const payloads = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "{ $ne: null }",
      '../../../etc/passwd',
    ];
    for (const search of payloads) {
      const res = await agent.get('/api/users').query({ search, limit: 50 });
      expect(res.status).toBeLessThan(500);
    }
  }, 30000);
});
