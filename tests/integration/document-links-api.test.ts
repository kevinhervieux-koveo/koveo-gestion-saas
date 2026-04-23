/**
 * @jest-environment node
 *
 * Task #403 — REST integration coverage for the document-linking
 * endpoints registered in `server/api/documents.ts`:
 *
 *   - GET    /api/documents/:id/neighbors
 *   - GET    /api/documents/:id/links
 *   - POST   /api/documents/:id/links
 *   - DELETE /api/documents/:id/links/:position
 *   - GET    /api/documents/:id/link-suggestions
 *
 * The unit suite (`tests/unit/services/document-link-service.*`) already
 * exercises the resolver / scorer in isolation. This suite drives the
 * actual Express routes through a real Postgres database and proves:
 *
 *   1. Org-scope filtering: a user from another organization cannot
 *      read neighbors / links / suggestions for a document, and a
 *      manager cannot link to a target document outside their org.
 *   2. Role checks: residents and tenants cannot POST/DELETE links;
 *      managers and admins can.
 *   3. Same-building/residence constraint: even an admin (who has full
 *      cross-org access) is rejected at the service level when the two
 *      documents do not share buildingId+residenceId.
 *
 * Mirrors the real-DB harness in
 * `tests/integration/document-manager-only-visibility.test.ts` and is
 * gated on `_INTEGRATION_DB_URL`, so it skips cleanly in environments
 * without a Postgres instance.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';

// jest.config.cjs maps server modules to unit-tier mocks. For this
// real-DB integration suite we need the real implementations.
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
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { inArray } from 'drizzle-orm';

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const TEST_TAG = 'task403-doc-links-api';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

describeIfDb('document linking REST endpoints — Task #403', () => {
  let app: express.Application;
  let db: any;
  let schema: any;

  const PASSWORD = 'Password!234';
  const ids = {
    // Org A — primary org under test.
    orgA: crypto.randomUUID(),
    buildingA: crypto.randomUUID(),
    residenceA: crypto.randomUUID(),
    // A second building inside org A so we can prove the
    // same-building / same-residence constraint *within* an org.
    buildingA2: crypto.randomUUID(),
    // Org B — completely separate org, used to prove cross-org isolation.
    orgB: crypto.randomUUID(),
    buildingB: crypto.randomUUID(),
    // Users in org A.
    adminA: crypto.randomUUID(),
    managerA: crypto.randomUUID(),
    residentA: crypto.randomUUID(),
    tenantA: crypto.randomUUID(),
    // User in org B — used as the cross-org outsider.
    managerB: crypto.randomUUID(),
    // Documents (all in org A unless noted).
    //   - docA1, docA2: same building+residence → linkable to each other
    //   - docA3: same building, no residence → cross-scope target
    //   - docB1: in org B → cross-org outsider target
    docA1: crypto.randomUUID(),
    docA2: crypto.randomUUID(),
    docA3: crypto.randomUUID(),
    docB1: crypto.randomUUID(),
  };

  const created: Record<string, Set<string>> = {
    documentLinks: new Set(),
    documents: new Set(),
    userResidences: new Set(),
    userBuildings: new Set(),
    userOrganizations: new Set(),
    residences: new Set(),
    buildings: new Set(),
    organizations: new Set(),
    users: new Set(),
  };

  const emails = {
    adminA: `${ids.adminA}@${TEST_TAG}.test`,
    managerA: `${ids.managerA}@${TEST_TAG}.test`,
    residentA: `${ids.residentA}@${TEST_TAG}.test`,
    tenantA: `${ids.tenantA}@${TEST_TAG}.test`,
    managerB: `${ids.managerB}@${TEST_TAG}.test`,
  };

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    process.env.SESSION_SECRET =
      process.env.SESSION_SECRET || 'test-session-secret-task403';
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';

    db = require('../../server/db').db;
    schema = require('@shared/schema');
    const { setupAuthRoutes } = require('../../server/auth');
    const { registerDocumentRoutes } = require('../../server/api/documents');

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
      })
    );
    setupAuthRoutes(app);
    registerDocumentRoutes(app);

    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    // ---- Organizations ---------------------------------------------------
    await db.insert(schema.organizations).values([
      {
        id: ids.orgA,
        name: `${TEST_TAG} OrgA ${ids.orgA.slice(0, 8)}`,
        type: 'syndicate',
        address: '1 OrgA',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A1',
      },
      {
        id: ids.orgB,
        name: `${TEST_TAG} OrgB ${ids.orgB.slice(0, 8)}`,
        type: 'syndicate',
        address: '1 OrgB',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A1',
      },
    ]);
    created.organizations.add(ids.orgA);
    created.organizations.add(ids.orgB);

    // ---- Buildings -------------------------------------------------------
    await db.insert(schema.buildings).values([
      {
        id: ids.buildingA,
        organizationId: ids.orgA,
        name: `${TEST_TAG} bldgA`,
        address: '1 A',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A1',
        buildingType: 'condo',
        totalUnits: 1,
        isActive: true,
      },
      {
        id: ids.buildingA2,
        organizationId: ids.orgA,
        name: `${TEST_TAG} bldgA2`,
        address: '2 A',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A1',
        buildingType: 'condo',
        totalUnits: 1,
        isActive: true,
      },
      {
        id: ids.buildingB,
        organizationId: ids.orgB,
        name: `${TEST_TAG} bldgB`,
        address: '1 B',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A1',
        buildingType: 'condo',
        totalUnits: 1,
        isActive: true,
      },
    ]);
    created.buildings.add(ids.buildingA);
    created.buildings.add(ids.buildingA2);
    created.buildings.add(ids.buildingB);

    // ---- Residence (only inside buildingA) ------------------------------
    await db.insert(schema.residences).values({
      id: ids.residenceA,
      buildingId: ids.buildingA,
      unitNumber: '101',
      isActive: true,
    });
    created.residences.add(ids.residenceA);

    // ---- Users -----------------------------------------------------------
    await db.insert(schema.users).values([
      {
        id: ids.adminA,
        username: `${TEST_TAG}-adm-${ids.adminA.slice(0, 8)}`,
        email: emails.adminA,
        password: passwordHash,
        firstName: 'A',
        lastName: 'D',
        role: 'admin',
        isActive: true,
      },
      {
        id: ids.managerA,
        username: `${TEST_TAG}-mgrA-${ids.managerA.slice(0, 8)}`,
        email: emails.managerA,
        password: passwordHash,
        firstName: 'M',
        lastName: 'A',
        role: 'manager',
        isActive: true,
      },
      {
        id: ids.residentA,
        username: `${TEST_TAG}-res-${ids.residentA.slice(0, 8)}`,
        email: emails.residentA,
        password: passwordHash,
        firstName: 'R',
        lastName: 'A',
        role: 'resident',
        isActive: true,
      },
      {
        id: ids.tenantA,
        username: `${TEST_TAG}-ten-${ids.tenantA.slice(0, 8)}`,
        email: emails.tenantA,
        password: passwordHash,
        firstName: 'T',
        lastName: 'A',
        role: 'tenant',
        isActive: true,
      },
      {
        id: ids.managerB,
        username: `${TEST_TAG}-mgrB-${ids.managerB.slice(0, 8)}`,
        email: emails.managerB,
        password: passwordHash,
        firstName: 'M',
        lastName: 'B',
        role: 'manager',
        isActive: true,
      },
    ]);
    created.users.add(ids.adminA);
    created.users.add(ids.managerA);
    created.users.add(ids.residentA);
    created.users.add(ids.tenantA);
    created.users.add(ids.managerB);

    // ---- userOrganizations links ----------------------------------------
    const orgLinks = [
      { id: crypto.randomUUID(), userId: ids.adminA, organizationId: ids.orgA, organizationRole: 'admin', isActive: true },
      { id: crypto.randomUUID(), userId: ids.managerA, organizationId: ids.orgA, organizationRole: 'manager', isActive: true },
      { id: crypto.randomUUID(), userId: ids.residentA, organizationId: ids.orgA, organizationRole: 'resident', isActive: true },
      { id: crypto.randomUUID(), userId: ids.tenantA, organizationId: ids.orgA, organizationRole: 'tenant', isActive: true },
      { id: crypto.randomUUID(), userId: ids.managerB, organizationId: ids.orgB, organizationRole: 'manager', isActive: true },
    ];
    await db.insert(schema.userOrganizations).values(orgLinks);
    orgLinks.forEach((l) => created.userOrganizations.add(l.id));

    // Manager direct building assignment to mirror prod scope queries.
    const mgrBuilding = {
      id: crypto.randomUUID(),
      userId: ids.managerA,
      buildingId: ids.buildingA,
      relationshipType: 'manager',
      isActive: true,
    };
    await db.insert(schema.userBuildings).values(mgrBuilding);
    created.userBuildings.add(mgrBuilding.id);

    // Resident + tenant residence link to residenceA (so they own
    // residence-scoped documents in scope queries).
    const residenceLinks = [
      {
        id: crypto.randomUUID(),
        userId: ids.managerA,
        residenceId: ids.residenceA,
        relationshipType: 'manager',
        startDate: '2024-01-01',
        isActive: true,
      },
      {
        id: crypto.randomUUID(),
        userId: ids.residentA,
        residenceId: ids.residenceA,
        relationshipType: 'owner',
        startDate: '2024-01-01',
        isActive: true,
      },
      {
        id: crypto.randomUUID(),
        userId: ids.tenantA,
        residenceId: ids.residenceA,
        relationshipType: 'tenant',
        startDate: '2024-01-01',
        isActive: true,
      },
    ];
    await db.insert(schema.userResidences).values(residenceLinks);
    residenceLinks.forEach((l) => created.userResidences.add(l.id));

    // ---- Documents -------------------------------------------------------
    await db.insert(schema.documents).values([
      // docA1, docA2 — same building + same residence → linkable.
      {
        id: ids.docA1,
        name: `${TEST_TAG} docA1`,
        documentType: 'legal',
        filePath: `/objects/uploads/${TEST_TAG}/${ids.docA1}.pdf`,
        fileName: `${ids.docA1}.pdf`,
        mimeType: 'application/pdf',
        fileSize: 100,
        buildingId: ids.buildingA,
        residenceId: ids.residenceA,
        uploadedById: ids.managerA,
        isVisibleToTenants: true,
        isManagerOnly: false,
        effectiveDate: new Date('2025-01-01T00:00:00Z'),
      },
      {
        id: ids.docA2,
        name: `${TEST_TAG} docA2`,
        documentType: 'legal',
        filePath: `/objects/uploads/${TEST_TAG}/${ids.docA2}.pdf`,
        fileName: `${ids.docA2}.pdf`,
        mimeType: 'application/pdf',
        fileSize: 100,
        buildingId: ids.buildingA,
        residenceId: ids.residenceA,
        uploadedById: ids.managerA,
        isVisibleToTenants: true,
        isManagerOnly: false,
        effectiveDate: new Date('2025-02-01T00:00:00Z'),
      },
      // docA3 — same building, NO residence → cross-scope w.r.t. docA1/A2.
      {
        id: ids.docA3,
        name: `${TEST_TAG} docA3`,
        documentType: 'legal',
        filePath: `/objects/uploads/${TEST_TAG}/${ids.docA3}.pdf`,
        fileName: `${ids.docA3}.pdf`,
        mimeType: 'application/pdf',
        fileSize: 100,
        buildingId: ids.buildingA,
        residenceId: null,
        uploadedById: ids.managerA,
        isVisibleToTenants: true,
        isManagerOnly: false,
        effectiveDate: new Date('2025-03-01T00:00:00Z'),
      },
      // docB1 — in OrgB. Used to prove cross-org isolation.
      {
        id: ids.docB1,
        name: `${TEST_TAG} docB1`,
        documentType: 'legal',
        filePath: `/objects/uploads/${TEST_TAG}/${ids.docB1}.pdf`,
        fileName: `${ids.docB1}.pdf`,
        mimeType: 'application/pdf',
        fileSize: 100,
        buildingId: ids.buildingB,
        residenceId: null,
        uploadedById: ids.managerB,
        isVisibleToTenants: true,
        isManagerOnly: false,
        effectiveDate: new Date('2025-04-01T00:00:00Z'),
      },
    ]);
    created.documents.add(ids.docA1);
    created.documents.add(ids.docA2);
    created.documents.add(ids.docA3);
    created.documents.add(ids.docB1);
  }, 60000);

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;

    if (created.documentLinks.size) {
      await db
        .delete(schema.documentLinks)
        .where(inArray(schema.documentLinks.id, [...created.documentLinks]));
    }
    if (created.documents.size) {
      await db
        .delete(schema.documents)
        .where(inArray(schema.documents.id, [...created.documents]));
    }
    if (created.userResidences.size) {
      await db
        .delete(schema.userResidences)
        .where(inArray(schema.userResidences.id, [...created.userResidences]));
    }
    if (created.userBuildings.size) {
      await db
        .delete(schema.userBuildings)
        .where(inArray(schema.userBuildings.id, [...created.userBuildings]));
    }
    if (created.userOrganizations.size) {
      await db
        .delete(schema.userOrganizations)
        .where(inArray(schema.userOrganizations.id, [...created.userOrganizations]));
    }
    if (created.residences.size) {
      await db
        .delete(schema.residences)
        .where(inArray(schema.residences.id, [...created.residences]));
    }
    if (created.buildings.size) {
      await db
        .delete(schema.buildings)
        .where(inArray(schema.buildings.id, [...created.buildings]));
    }
    if (created.users.size) {
      await db
        .delete(schema.users)
        .where(inArray(schema.users.id, [...created.users]));
    }
    if (created.organizations.size) {
      await db
        .delete(schema.organizations)
        .where(inArray(schema.organizations.id, [...created.organizations]));
    }
  }, 60000);

  // One agent per email so the rate limiter doesn't bite mid-suite.
  const agentCache = new Map<string, request.SuperAgentTest>();
  async function loginAs(email: string) {
    const cached = agentCache.get(email);
    if (cached) return cached;
    const agent = request.agent(app);
    const res = await agent
      .post('/api/auth/login')
      .send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    agentCache.set(email, agent);
    return agent;
  }

  // Ensure we always start each test with a clean slate of links —
  // the link-creation tests inside this file may leave rows behind
  // depending on which assertions run.
  async function clearAllLinks() {
    if (created.documentLinks.size) {
      await db
        .delete(schema.documentLinks)
        .where(inArray(schema.documentLinks.id, [...created.documentLinks]));
      created.documentLinks.clear();
    }
  }

  // -------------------------------------------------------------------
  // Cross-org scope filtering — outsider must get 404 on every read
  // route, even though the document exists.
  // -------------------------------------------------------------------
  describe('cross-organization scope filtering', () => {
    it('GET /neighbors returns 404 to a manager from another org', async () => {
      const agent = await loginAs(emails.managerB);
      const res = await agent.get(`/api/documents/${ids.docA1}/neighbors`);
      expect(res.status).toBe(404);
    }, 30000);

    it('GET /links returns 404 to a manager from another org', async () => {
      const agent = await loginAs(emails.managerB);
      const res = await agent.get(`/api/documents/${ids.docA1}/links`);
      expect(res.status).toBe(404);
    }, 30000);

    it('GET /link-suggestions returns 404 to a manager from another org', async () => {
      const agent = await loginAs(emails.managerB);
      const res = await agent.get(`/api/documents/${ids.docA1}/link-suggestions`);
      expect(res.status).toBe(404);
    }, 30000);

    it('POST /links rejects when SOURCE document is in another org', async () => {
      const agent = await loginAs(emails.managerB);
      const res = await agent
        .post(`/api/documents/${ids.docA1}/links`)
        .send({ targetDocumentId: ids.docB1, position: 'after' });
      expect(res.status).toBe(404);
    }, 30000);

    it('POST /links rejects when TARGET document is in another org (manager from orgA)', async () => {
      // Manager from org A trying to link their org-A doc to an org-B doc.
      // The route's targetAccessible check should reject with 404 before
      // the service ever runs.
      const agent = await loginAs(emails.managerA);
      const res = await agent
        .post(`/api/documents/${ids.docA1}/links`)
        .send({ targetDocumentId: ids.docB1, position: 'after' });
      expect(res.status).toBe(404);
    }, 30000);
  });

  // -------------------------------------------------------------------
  // Role checks — only admin / manager / demo_manager can mutate links.
  // -------------------------------------------------------------------
  describe('role-based access on POST/DELETE', () => {
    it('resident receives 403 from POST /links', async () => {
      const agent = await loginAs(emails.residentA);
      const res = await agent
        .post(`/api/documents/${ids.docA1}/links`)
        .send({ targetDocumentId: ids.docA2, position: 'after' });
      expect(res.status).toBe(403);
    }, 30000);

    it('tenant receives 403 from POST /links', async () => {
      const agent = await loginAs(emails.tenantA);
      const res = await agent
        .post(`/api/documents/${ids.docA1}/links`)
        .send({ targetDocumentId: ids.docA2, position: 'after' });
      expect(res.status).toBe(403);
    }, 30000);

    it('resident receives 403 from DELETE /links/:position', async () => {
      const agent = await loginAs(emails.residentA);
      const res = await agent.delete(`/api/documents/${ids.docA1}/links/after`);
      expect(res.status).toBe(403);
    }, 30000);

    it('tenant receives 403 from DELETE /links/:position', async () => {
      const agent = await loginAs(emails.tenantA);
      const res = await agent.delete(`/api/documents/${ids.docA1}/links/after`);
      expect(res.status).toBe(403);
    }, 30000);

    it('manager can read /neighbors, /links, /link-suggestions', async () => {
      const agent = await loginAs(emails.managerA);
      const neighborsRes = await agent.get(`/api/documents/${ids.docA1}/neighbors`);
      expect(neighborsRes.status).toBe(200);
      expect(neighborsRes.body.currentId).toBe(ids.docA1);

      const linksRes = await agent.get(`/api/documents/${ids.docA1}/links`);
      expect(linksRes.status).toBe(200);
      expect(Array.isArray(linksRes.body.links)).toBe(true);

      const sugRes = await agent.get(`/api/documents/${ids.docA1}/link-suggestions`);
      expect(sugRes.status).toBe(200);
      expect(Array.isArray(sugRes.body.suggestions)).toBe(true);
    }, 30000);
  });

  // -------------------------------------------------------------------
  // Same-building / same-residence constraint — service-level check.
  // The route's checkDocumentAccess only verifies that the current
  // user can SEE both docs; the service then enforces that they belong
  // to the same scope, returning a 400 with the `scope_mismatch` code.
  // -------------------------------------------------------------------
  describe('same-building / same-residence constraint', () => {
    afterEach(async () => {
      await clearAllLinks();
    });

    it('admin cannot link two documents that differ in residenceId', async () => {
      // docA1 has residenceA, docA3 has null residence — both in
      // buildingA — so the scope mismatch is purely on residenceId.
      const agent = await loginAs(emails.adminA);
      const res = await agent
        .post(`/api/documents/${ids.docA1}/links`)
        .send({ targetDocumentId: ids.docA3, position: 'after' });
      expect(res.status).toBe(400);
      expect(res.body?.code).toBe('scope_mismatch');
    }, 30000);

    it('manager can link two documents inside the same building+residence', async () => {
      const agent = await loginAs(emails.managerA);
      const res = await agent
        .post(`/api/documents/${ids.docA1}/links`)
        .send({ targetDocumentId: ids.docA2, position: 'after' });
      expect(res.status).toBe(201);
      expect(res.body?.fromDocumentId).toBe(ids.docA1);
      expect(res.body?.toDocumentId).toBe(ids.docA2);
      expect(res.body?.position).toBe('after');
      if (res.body?.id) created.documentLinks.add(res.body.id);

      // Sanity: GET /links now returns the row, and /neighbors picks
      // it up as an explicit forward neighbor.
      const linksRes = await agent.get(`/api/documents/${ids.docA1}/links`);
      expect(linksRes.status).toBe(200);
      expect(linksRes.body.links.length).toBe(1);
      expect(linksRes.body.links[0].toDocumentId).toBe(ids.docA2);

      const neighborsRes = await agent.get(`/api/documents/${ids.docA1}/neighbors`);
      expect(neighborsRes.status).toBe(200);
      expect(neighborsRes.body?.next?.id).toBe(ids.docA2);
      expect(neighborsRes.body?.next?.source).toBe('explicit');

      // And the manager can subsequently delete it.
      const delRes = await agent.delete(`/api/documents/${ids.docA1}/links/after`);
      expect(delRes.status).toBe(200);
      // Mutate our tracking set so afterEach's clearAllLinks doesn't
      // try to re-delete a row that's already gone.
      created.documentLinks.clear();
    }, 30000);

    it('rejects self-links with 400 and a typed error code', async () => {
      const agent = await loginAs(emails.managerA);
      const res = await agent
        .post(`/api/documents/${ids.docA1}/links`)
        .send({ targetDocumentId: ids.docA1, position: 'after' });
      expect(res.status).toBe(400);
      expect(res.body?.code).toBe('self_link');
    }, 30000);

    it('rejects an unknown :position with 400', async () => {
      const agent = await loginAs(emails.managerA);
      const res = await agent.delete(`/api/documents/${ids.docA1}/links/sideways`);
      expect(res.status).toBe(400);
    }, 30000);
  });

  // -------------------------------------------------------------------
  // /link-suggestions never leaks cross-org candidates.
  // -------------------------------------------------------------------
  it('GET /link-suggestions only returns candidates inside the same scope', async () => {
    const agent = await loginAs(emails.managerA);
    const res = await agent.get(`/api/documents/${ids.docA1}/link-suggestions`);
    expect(res.status).toBe(200);
    const suggestionIds: string[] = (res.body?.suggestions ?? []).map(
      (s: any) => s?.document?.id,
    );
    // docB1 is in another org; docA3 is in the same building but
    // different residence — neither shares scope with docA1.
    expect(suggestionIds).not.toContain(ids.docB1);
    expect(suggestionIds).not.toContain(ids.docA3);
    // docA2 IS in the same scope and must be present.
    expect(suggestionIds).toContain(ids.docA2);
  }, 30000);
});
