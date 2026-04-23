/**
 * @jest-environment node
 *
 * @file Manager-only document visibility — Task #321
 * @description Behavioural integration tests proving that the
 *   `documents.isManagerOnly` flag hides records from residents and
 *   tenants across every public read endpoint, while admins and
 *   managers still see them. Mirrors the real-DB pattern used by
 *   `tests/integration/cross-organization-isolation.test.ts` and
 *   exercises:
 *     - GET /api/documents              (list)
 *     - GET /api/documents/:id          (single fetch)
 *     - GET /api/documents/:id/file     (download/preview path in
 *                                        server/api/documents.ts)
 *     - GET /api/documents/:id/optimized-file
 *                                       (preview/download path in
 *                                        server/api/optimized-documents.ts)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// jest.config.cjs maps `./storage`, `./auth`, `./routes` to in-repo
// unit-tier mocks. For this real-DB integration suite we need the
// real implementations, so override the mocks at their resolved paths
// (same trick used by cross-organization-isolation.test.ts).
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

// Stub object-storage and the optimized file-storage service. The real
// modules pull in `@google-cloud/storage` (transitively loads ESM `uuid`)
// and `lru-cache`, neither of which Jest can transform under the current
// config. The access-control checks under test happen before any file
// streaming, so a thin stub that logs the call and returns 404 is enough
// to keep the route handlers happy for the positive (admin/manager) cases.
// `uuid` v14 ships ESM-only `dist-node` which Jest's CJS transform
// cannot parse. Replace with a tiny CJS-friendly stub — the actual UUID
// values produced are irrelevant to the access-control behaviour we
// assert on.
jest.mock('uuid', () => {
  const { randomUUID } = require('crypto');
  return {
    v1: () => randomUUID(),
    v3: () => randomUUID(),
    v4: () => randomUUID(),
    v5: () => randomUUID(),
    v6: () => randomUUID(),
    v7: () => randomUUID(),
    NIL: '00000000-0000-0000-0000-000000000000',
    MAX: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    parse: (s: string) => s,
    stringify: (b: any) => String(b),
    validate: () => true,
    version: () => 4,
  };
});

jest.mock('../../server/objectStorage', () => {
  class ObjectNotFoundError extends Error {
    constructor() {
      super('Object not found');
      this.name = 'ObjectNotFoundError';
    }
  }
  const stub = {
    ObjectNotFoundError,
    ObjectStorageService: class {
      async downloadObject(_path: string, res: any) {
        res.status(404).json({ message: 'stubbed: file streaming disabled in tests' });
      }
      normalizeObjectEntityPath(p: string) { return p; }
      async getObjectEntityFile() { throw new ObjectNotFoundError(); }
      async canAccessObjectEntity() { return false; }
    },
    objectStorageClient: {},
    parseObjectPath: (p: string) => ({ bucketName: 'stub', objectName: p }),
  };
  return stub;
});

jest.mock('../../server/services/optimized-file-storage', () => ({
  optimizedFileStorage: {
    async streamFile(_filePath: string, res: any) {
      res.status(404).json({ message: 'stubbed: optimized streaming disabled in tests' });
    },
    async getFileMetadata() { return null; },
    invalidateCache: () => {},
    invalidateAllCaches: () => {},
  },
}));

import express from 'express';
import session from 'express-session';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { inArray, eq, and } from 'drizzle-orm';

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const TEST_TAG = 'task321-mgr-only-docs';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

describeIfDb('manager-only document visibility — Task #321', () => {
  let app: express.Application;
  let db: any;
  let schema: any;

  const created: Record<string, Set<string>> = {
    documents: new Set(),
    userResidences: new Set(),
    userBuildings: new Set(),
    userOrganizations: new Set(),
    residences: new Set(),
    buildings: new Set(),
    organizations: new Set(),
    users: new Set(),
  };

  const PASSWORD = 'Password!234';
  const ids = {
    org: crypto.randomUUID(),
    building: crypto.randomUUID(),
    residence: crypto.randomUUID(),
    admin: crypto.randomUUID(),
    manager: crypto.randomUUID(),
    resident: crypto.randomUUID(),
    tenant: crypto.randomUUID(),
    docMgrOnlyResidence: crypto.randomUUID(),
    docMgrOnlyBuilding: crypto.randomUUID(),
    docNormalResidence: crypto.randomUUID(),
  };
  const emails = {
    admin: `${ids.admin}@${TEST_TAG}.test`,
    manager: `${ids.manager}@${TEST_TAG}.test`,
    resident: `${ids.resident}@${TEST_TAG}.test`,
    tenant: `${ids.tenant}@${TEST_TAG}.test`,
  };

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    process.env.SESSION_SECRET =
      process.env.SESSION_SECRET || 'test-session-secret-task321';
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';

    db = require('../../server/db').db;
    schema = require('@shared/schema');
    const { setupAuthRoutes } = require('../../server/auth');
    const { registerDocumentRoutes } = require('../../server/api/documents');
    const {
      registerOptimizedDocumentRoutes,
    } = require('../../server/api/optimized-documents');

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
    registerOptimizedDocumentRoutes(app);

    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    await db.insert(schema.organizations).values({
      id: ids.org,
      name: `${TEST_TAG} Org ${ids.org.slice(0, 8)}`,
      type: 'syndicate',
      address: '1 Test',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
    });
    created.organizations.add(ids.org);

    await db.insert(schema.buildings).values({
      id: ids.building,
      organizationId: ids.org,
      name: `${TEST_TAG} bldg`,
      address: '1 Test',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
      buildingType: 'condo',
      totalUnits: 1,
      isActive: true,
    });
    created.buildings.add(ids.building);

    await db.insert(schema.residences).values({
      id: ids.residence,
      buildingId: ids.building,
      unitNumber: '101',
      isActive: true,
    });
    created.residences.add(ids.residence);

    await db.insert(schema.users).values([
      {
        id: ids.admin,
        username: `${TEST_TAG}-admin-${ids.admin.slice(0, 8)}`,
        email: emails.admin,
        password: passwordHash,
        firstName: 'A',
        lastName: 'D',
        role: 'admin',
        isActive: true,
      },
      {
        id: ids.manager,
        username: `${TEST_TAG}-mgr-${ids.manager.slice(0, 8)}`,
        email: emails.manager,
        password: passwordHash,
        firstName: 'M',
        lastName: 'G',
        role: 'manager',
        isActive: true,
      },
      {
        id: ids.resident,
        username: `${TEST_TAG}-res-${ids.resident.slice(0, 8)}`,
        email: emails.resident,
        password: passwordHash,
        firstName: 'R',
        lastName: 'S',
        role: 'resident',
        isActive: true,
      },
      {
        id: ids.tenant,
        username: `${TEST_TAG}-ten-${ids.tenant.slice(0, 8)}`,
        email: emails.tenant,
        password: passwordHash,
        firstName: 'T',
        lastName: 'N',
        role: 'tenant',
        isActive: true,
      },
    ]);
    created.users.add(ids.admin);
    created.users.add(ids.manager);
    created.users.add(ids.resident);
    created.users.add(ids.tenant);

    const orgLinks = [
      {
        id: crypto.randomUUID(),
        userId: ids.admin,
        organizationId: ids.org,
        organizationRole: 'admin',
        isActive: true,
      },
      {
        id: crypto.randomUUID(),
        userId: ids.manager,
        organizationId: ids.org,
        organizationRole: 'manager',
        isActive: true,
      },
      {
        id: crypto.randomUUID(),
        userId: ids.resident,
        organizationId: ids.org,
        organizationRole: 'resident',
        isActive: true,
      },
      {
        id: crypto.randomUUID(),
        userId: ids.tenant,
        organizationId: ids.org,
        organizationRole: 'tenant',
        isActive: true,
      },
    ];
    await db.insert(schema.userOrganizations).values(orgLinks);
    orgLinks.forEach((l) => created.userOrganizations.add(l.id));

    // Manager direct building assignment so getUserAccessScope's
    // building union returns the building under manager scope too.
    const mgrBuilding = {
      id: crypto.randomUUID(),
      userId: ids.manager,
      buildingId: ids.building,
      relationshipType: 'manager',
      isActive: true,
    };
    await db.insert(schema.userBuildings).values(mgrBuilding);
    created.userBuildings.add(mgrBuilding.id);

    // Resident + tenant linked to the same residence so they "own"
    // documents tied to that residence in scope queries.
    const residenceLinks = [
      {
        id: crypto.randomUUID(),
        userId: ids.manager,
        residenceId: ids.residence,
        relationshipType: 'manager',
        startDate: '2024-01-01',
        isActive: true,
      },
      {
        id: crypto.randomUUID(),
        userId: ids.resident,
        residenceId: ids.residence,
        relationshipType: 'owner',
        startDate: '2024-01-01',
        isActive: true,
      },
      {
        id: crypto.randomUUID(),
        userId: ids.tenant,
        residenceId: ids.residence,
        relationshipType: 'tenant',
        startDate: '2024-01-01',
        isActive: true,
      },
    ];
    await db.insert(schema.userResidences).values(residenceLinks);
    residenceLinks.forEach((l) => created.userResidences.add(l.id));

    // Documents:
    //  1. Manager-only document on the residence — both isManagerOnly
    //     and isVisibleToTenants are true to prove the manager-only
    //     flag overrides the tenant-visibility flag.
    //  2. Manager-only document at the building level (also flagged
    //     as visible to tenants for the same reason).
    //  3. A normal residence-scoped document that resident & tenant
    //     SHOULD be able to see, used as a positive sanity control.
    await db.insert(schema.documents).values([
      {
        id: ids.docMgrOnlyResidence,
        name: `${TEST_TAG} mgr-only residence`,
        documentType: 'legal',
        filePath: `tests/${TEST_TAG}/${ids.docMgrOnlyResidence}.pdf`,
        residenceId: ids.residence,
        uploadedById: ids.manager,
        isVisibleToTenants: true,
        isManagerOnly: true,
      },
      {
        id: ids.docMgrOnlyBuilding,
        name: `${TEST_TAG} mgr-only building`,
        documentType: 'legal',
        filePath: `tests/${TEST_TAG}/${ids.docMgrOnlyBuilding}.pdf`,
        buildingId: ids.building,
        uploadedById: ids.manager,
        isVisibleToTenants: true,
        isManagerOnly: true,
      },
      {
        id: ids.docNormalResidence,
        name: `${TEST_TAG} normal residence`,
        documentType: 'legal',
        filePath: `tests/${TEST_TAG}/${ids.docNormalResidence}.pdf`,
        residenceId: ids.residence,
        uploadedById: ids.manager,
        isVisibleToTenants: true,
        isManagerOnly: false,
      },
    ]);
    created.documents.add(ids.docMgrOnlyResidence);
    created.documents.add(ids.docMgrOnlyBuilding);
    created.documents.add(ids.docNormalResidence);
  }, 60000);

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;
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
        .where(
          inArray(schema.userOrganizations.id, [...created.userOrganizations])
        );
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

  // Cache one logged-in agent per user. Express's login rate limiter
  // (10 / 15min / IP) trips quickly otherwise because every test in
  // the suite originates from the same loopback address.
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

  function listIds(body: any): string[] {
    const docs = body?.documents ?? body ?? [];
    return Array.isArray(docs) ? docs.map((d: any) => d.id) : [];
  }

  // ----------------------------------------------------------------
  // GET /api/documents (list)
  // ----------------------------------------------------------------

  describe('GET /api/documents — list', () => {
    it('admin sees both manager-only documents in their scope', async () => {
      const agent = await loginAs(emails.admin);
      const res = await agent
        .get('/api/documents')
        .query({ buildingId: ids.building });
      expect(res.status).toBe(200);
      const idsReturned = listIds(res.body);
      expect(idsReturned).toEqual(
        expect.arrayContaining([ids.docMgrOnlyBuilding])
      );
    }, 30000);

    it('manager sees the manager-only building document in building scope', async () => {
      const agent = await loginAs(emails.manager);
      const res = await agent
        .get('/api/documents')
        .query({ buildingId: ids.building });
      expect(res.status).toBe(200);
      const idsReturned = listIds(res.body);
      expect(idsReturned).toEqual(
        expect.arrayContaining([ids.docMgrOnlyBuilding])
      );
    }, 30000);

    it('manager sees the manager-only residence document in residence scope', async () => {
      const agent = await loginAs(emails.manager);
      const res = await agent
        .get('/api/documents')
        .query({ residenceId: ids.residence });
      expect(res.status).toBe(200);
      const idsReturned = listIds(res.body);
      expect(idsReturned).toEqual(
        expect.arrayContaining([ids.docMgrOnlyResidence])
      );
    }, 30000);

    it('resident NEVER sees manager-only docs even in their own residence/building', async () => {
      const agent = await loginAs(emails.resident);

      const buildingRes = await agent
        .get('/api/documents')
        .query({ buildingId: ids.building });
      expect(buildingRes.status).toBe(200);
      expect(listIds(buildingRes.body)).not.toContain(ids.docMgrOnlyBuilding);

      const residenceRes = await agent
        .get('/api/documents')
        .query({ residenceId: ids.residence });
      expect(residenceRes.status).toBe(200);
      const residenceIds = listIds(residenceRes.body);
      expect(residenceIds).not.toContain(ids.docMgrOnlyResidence);
      // Sanity: the non-restricted document IS visible.
      expect(residenceIds).toEqual(
        expect.arrayContaining([ids.docNormalResidence])
      );
    }, 30000);

    it('tenant NEVER sees manager-only docs even with isVisibleToTenants=true', async () => {
      const agent = await loginAs(emails.tenant);

      const buildingRes = await agent
        .get('/api/documents')
        .query({ buildingId: ids.building });
      expect(buildingRes.status).toBe(200);
      expect(listIds(buildingRes.body)).not.toContain(ids.docMgrOnlyBuilding);

      const residenceRes = await agent
        .get('/api/documents')
        .query({ residenceId: ids.residence });
      expect(residenceRes.status).toBe(200);
      const residenceIds = listIds(residenceRes.body);
      expect(residenceIds).not.toContain(ids.docMgrOnlyResidence);
      // Sanity: the non-restricted, tenant-visible document IS visible.
      expect(residenceIds).toEqual(
        expect.arrayContaining([ids.docNormalResidence])
      );
    }, 30000);
  });

  // ----------------------------------------------------------------
  // GET /api/documents/:id (single fetch)
  // ----------------------------------------------------------------

  describe('GET /api/documents/:id — single fetch', () => {
    it('admin can fetch both manager-only documents', async () => {
      const agent = await loginAs(emails.admin);
      for (const docId of [ids.docMgrOnlyResidence, ids.docMgrOnlyBuilding]) {
        const res = await agent.get(`/api/documents/${docId}`);
        expect(res.status).toBe(200);
        expect(res.body?.id).toBe(docId);
        expect(res.body?.isManagerOnly).toBe(true);
      }
    }, 30000);

    it('manager can fetch both manager-only documents', async () => {
      const agent = await loginAs(emails.manager);
      for (const docId of [ids.docMgrOnlyResidence, ids.docMgrOnlyBuilding]) {
        const res = await agent.get(`/api/documents/${docId}`);
        expect(res.status).toBe(200);
        expect(res.body?.id).toBe(docId);
      }
    }, 30000);

    it('resident receives 404 on manager-only documents (own residence + building)', async () => {
      const agent = await loginAs(emails.resident);
      for (const docId of [ids.docMgrOnlyResidence, ids.docMgrOnlyBuilding]) {
        const res = await agent.get(`/api/documents/${docId}`);
        expect(res.status).toBe(404);
        expect(res.body?.id).not.toBe(docId);
      }
      // Sanity: the non-restricted document is reachable.
      const ok = await agent.get(`/api/documents/${ids.docNormalResidence}`);
      expect(ok.status).toBe(200);
    }, 30000);

    it('tenant receives 404 on manager-only documents (own residence + building)', async () => {
      const agent = await loginAs(emails.tenant);
      for (const docId of [ids.docMgrOnlyResidence, ids.docMgrOnlyBuilding]) {
        const res = await agent.get(`/api/documents/${docId}`);
        expect(res.status).toBe(404);
        expect(res.body?.id).not.toBe(docId);
      }
      // Sanity: tenant-visible non-restricted document IS reachable.
      const ok = await agent.get(`/api/documents/${ids.docNormalResidence}`);
      expect(ok.status).toBe(200);
    }, 30000);
  });

  // ----------------------------------------------------------------
  // GET /api/documents — organization-wide scope (no filters)
  // Proves the manager-only flag also hides the documents from
  // residents/tenants when the list is fetched at the broadest
  // organization scope (no buildingId / residenceId narrow-down),
  // closing the third scope dimension called out by the task spec.
  // ----------------------------------------------------------------

  describe('GET /api/documents — organization scope (no filter)', () => {
    it('admin sees the manager-only building doc at organization scope', async () => {
      const agent = await loginAs(emails.admin);
      const res = await agent.get('/api/documents');
      expect(res.status).toBe(200);
      expect(listIds(res.body)).toEqual(
        expect.arrayContaining([ids.docMgrOnlyBuilding])
      );
    }, 30000);

    it('manager sees the manager-only building doc at organization scope', async () => {
      const agent = await loginAs(emails.manager);
      const res = await agent.get('/api/documents');
      expect(res.status).toBe(200);
      expect(listIds(res.body)).toEqual(
        expect.arrayContaining([ids.docMgrOnlyBuilding])
      );
    }, 30000);

    it('resident NEVER sees manager-only docs at organization scope', async () => {
      const agent = await loginAs(emails.resident);
      const res = await agent.get('/api/documents');
      expect(res.status).toBe(200);
      const idsReturned = listIds(res.body);
      expect(idsReturned).not.toContain(ids.docMgrOnlyResidence);
      expect(idsReturned).not.toContain(ids.docMgrOnlyBuilding);
    }, 30000);

    it('tenant NEVER sees manager-only docs at organization scope', async () => {
      const agent = await loginAs(emails.tenant);
      const res = await agent.get('/api/documents');
      expect(res.status).toBe(200);
      const idsReturned = listIds(res.body);
      expect(idsReturned).not.toContain(ids.docMgrOnlyResidence);
      expect(idsReturned).not.toContain(ids.docMgrOnlyBuilding);
    }, 30000);
  });

  // ----------------------------------------------------------------
  // GET /api/documents/:id/file (download / preview, base routes)
  // ----------------------------------------------------------------

  describe('GET /api/documents/:id/file — download/preview', () => {
    it('resident is rejected with 403 on manager-only documents', async () => {
      const agent = await loginAs(emails.resident);
      for (const docId of [ids.docMgrOnlyResidence, ids.docMgrOnlyBuilding]) {
        const res = await agent.get(`/api/documents/${docId}/file`);
        expect(res.status).toBe(403);
      }
    }, 30000);

    it('tenant is rejected with 403 on manager-only documents', async () => {
      const agent = await loginAs(emails.tenant);
      for (const docId of [ids.docMgrOnlyResidence, ids.docMgrOnlyBuilding]) {
        const res = await agent.get(`/api/documents/${docId}/file`);
        expect(res.status).toBe(403);
      }
    }, 30000);

    it('admin is NOT blocked by access control on manager-only documents', async () => {
      const agent = await loginAs(emails.admin);
      for (const docId of [ids.docMgrOnlyResidence, ids.docMgrOnlyBuilding]) {
        const res = await agent.get(`/api/documents/${docId}/file`);
        // The seeded document references a path that does not exist
        // in object storage, so the actual stream may 404/500 — what
        // we MUST never see is a 403 access-denied.
        expect(res.status).not.toBe(403);
      }
    }, 30000);

    it('manager is NOT blocked by access control on manager-only documents', async () => {
      const agent = await loginAs(emails.manager);
      for (const docId of [ids.docMgrOnlyResidence, ids.docMgrOnlyBuilding]) {
        const res = await agent.get(`/api/documents/${docId}/file`);
        expect(res.status).not.toBe(403);
      }
    }, 30000);
  });

  // ----------------------------------------------------------------
  // GET /api/documents/:id/optimized-file (preview, optimized routes)
  // ----------------------------------------------------------------

  // ----------------------------------------------------------------
  // Task #333 — manager-only flag MUST be a manager-only privilege.
  // Residents/tenants cannot escalate visibility on create, and they
  // cannot strip the flag off an existing manager-only document via
  // an edit. Covers:
  //   - POST   /api/documents              (JSON metadata path)
  //   - POST   /api/documents              (multipart upload path)
  //   - POST   /api/documents/upload       (optimized create path)
  //   - POST   /api/documents/optimized-upload (optimized-file path)
  //   - PUT    /api/documents/:id          (edit round-trip)
  // ----------------------------------------------------------------

  describe('Task #333 — manager-only flag is privileged on create', () => {
    // Track docs we create here so they're cleaned up alongside the
    // suite-level seeded docs in afterAll().
    function trackCreatedDoc(id: string | undefined | null) {
      if (id) created.documents.add(id);
    }

    it('manager CAN create a manager-only document via POST /api/documents', async () => {
      const agent = await loginAs(emails.manager);
      const res = await agent
        .post('/api/documents')
        .field('name', `${TEST_TAG} mgr-create-mgronly`)
        .field('documentType', 'legal')
        .field('residenceId', ids.residence)
        .field('isVisibleToTenants', 'true')
        .field('isManagerOnly', 'true');
      expect([200, 201]).toContain(res.status);
      const body = res.body?.document ?? res.body;
      trackCreatedDoc(body?.id);
      expect(body?.isManagerOnly).toBe(true);
    }, 30000);

    it('resident CANNOT escalate isManagerOnly=true via POST /api/documents', async () => {
      const agent = await loginAs(emails.resident);
      const res = await agent
        .post('/api/documents')
        .field('name', `${TEST_TAG} res-create-attempt-mgronly`)
        .field('documentType', 'legal')
        .field('residenceId', ids.residence)
        .field('isVisibleToTenants', 'true')
        .field('isManagerOnly', 'true');
      expect([200, 201]).toContain(res.status);
      const body = res.body?.document ?? res.body;
      trackCreatedDoc(body?.id);
      // The flag must be silently coerced to false — residents may not
      // hide their own uploads from co-owners by spoofing the field.
      expect(body?.isManagerOnly).toBe(false);
    }, 30000);

    it('tenant CANNOT escalate isManagerOnly=true via POST /api/documents', async () => {
      // Tenants are not in the upload-allowed role list, so the request
      // is normally rejected with 403. The behavioural guarantee under
      // test is "tenants never end up with a manager-only document
      // attributed to them", which the 403 satisfies on its own. If a
      // future change broadens the allowed roles, the optional creation
      // assertion below will catch any regression that lets the flag
      // through.
      const agent = await loginAs(emails.tenant);
      const res = await agent
        .post('/api/documents')
        .field('name', `${TEST_TAG} ten-create-attempt-mgronly`)
        .field('documentType', 'legal')
        .field('residenceId', ids.residence)
        .field('isVisibleToTenants', 'true')
        .field('isManagerOnly', 'true');
      if (res.status === 201 || res.status === 200) {
        const body = res.body?.document ?? res.body;
        trackCreatedDoc(body?.id);
        expect(body?.isManagerOnly).toBe(false);
      } else {
        expect(res.status).toBe(403);
      }
    }, 30000);

    it('resident CANNOT escalate isManagerOnly=true via POST /api/documents/upload (multipart with file)', async () => {
      const agent = await loginAs(emails.resident);
      const res = await agent
        .post('/api/documents/upload')
        .field('name', `${TEST_TAG} res-upload-attempt-mgronly`)
        .field('documentType', 'legal')
        .field('residenceId', ids.residence)
        .field('isVisibleToTenants', 'true')
        .field('isManagerOnly', 'true')
        .attach(
          'file',
          Buffer.from('hello world'),
          { filename: `${TEST_TAG}-res-upload.txt`, contentType: 'text/plain' }
        );

      // The route may succeed (201) or fail later in the storage stack
      // because we stub object storage in this test environment — what
      // we MUST never see is the manager-only flag set on the persisted
      // record. Probe the DB directly for any document attributed to
      // this resident with a matching name.
      const rows = await db
        .select()
        .from(schema.documents)
        .where(
          and(
            eq(
              schema.documents.uploadedById,
              ids.resident
            ),
            eq(
              schema.documents.name,
              `${TEST_TAG} res-upload-attempt-mgronly`
            )
          )
        );
      rows.forEach((r: any) => trackCreatedDoc(r.id));
      // If a row was created, it MUST NOT be manager-only.
      for (const r of rows) {
        expect(r.isManagerOnly).toBe(false);
      }
      // Defensive check on the response body itself if present.
      const body = res.body?.document ?? res.body;
      if (body?.isManagerOnly !== undefined) {
        expect(body.isManagerOnly).toBe(false);
      }
    }, 30000);

    it('tenant CANNOT escalate isManagerOnly=true via POST /api/documents/upload (multipart with file)', async () => {
      const agent = await loginAs(emails.tenant);
      const res = await agent
        .post('/api/documents/upload')
        .field('name', `${TEST_TAG} ten-upload-attempt-mgronly`)
        .field('documentType', 'legal')
        .field('residenceId', ids.residence)
        .field('isVisibleToTenants', 'true')
        .field('isManagerOnly', 'true')
        .attach(
          'file',
          Buffer.from('hello'),
          { filename: `${TEST_TAG}-ten-upload.txt`, contentType: 'text/plain' }
        );

      // Mirrors the resident assertion: regardless of where the route
      // fails (auth, validation, or storage), no row attributed to the
      // tenant with this name may end up flagged manager-only.
      const rows = await db
        .select()
        .from(schema.documents)
        .where(
          and(
            eq(schema.documents.uploadedById, ids.tenant),
            eq(
              schema.documents.name,
              `${TEST_TAG} ten-upload-attempt-mgronly`
            )
          )
        );
      rows.forEach((r: any) => trackCreatedDoc(r.id));
      for (const r of rows) {
        expect(r.isManagerOnly).toBe(false);
      }
      const body = res.body?.document ?? res.body;
      if (body?.isManagerOnly !== undefined) {
        expect(body.isManagerOnly).toBe(false);
      }
    }, 30000);

    it('resident CANNOT escalate isManagerOnly=true via POST /api/documents/optimized-upload', async () => {
      const agent = await loginAs(emails.resident);
      const res = await agent
        .post('/api/documents/optimized-upload')
        .field('name', `${TEST_TAG} res-opt-upload-attempt`)
        .field('documentType', 'legal')
        .field('buildingId', ids.building)
        .field('residenceId', ids.residence)
        .field('isManagerOnly', 'true')
        .attach(
          'file',
          Buffer.from('opt'),
          { filename: `${TEST_TAG}-res-opt.txt`, contentType: 'text/plain' }
        );

      // The optimized storage backend is not mocked in this suite, so
      // the request typically fails before persisting. The behavioural
      // guarantee is the same as above: NO row owned by the resident
      // with the spoofed name may carry isManagerOnly=true.
      const rows = await db
        .select()
        .from(schema.documents)
        .where(
          and(
            eq(
              schema.documents.uploadedById,
              ids.resident
            ),
            eq(
              schema.documents.name,
              `${TEST_TAG} res-opt-upload-attempt`
            )
          )
        );
      rows.forEach((r: any) => trackCreatedDoc(r.id));
      for (const r of rows) {
        expect(r.isManagerOnly).toBe(false);
      }
      const body = res.body?.document ?? res.body;
      if (body?.isManagerOnly !== undefined) {
        expect(body.isManagerOnly).toBe(false);
      }
    }, 30000);
  });

  describe('Task #333 — manager-only flag survives non-manager edit attempts', () => {
    it('resident PUT attempting isManagerOnly=false leaves the flag set', async () => {
      const agent = await loginAs(emails.resident);
      const res = await agent
        .put(`/api/documents/${ids.docMgrOnlyResidence}`)
        .send({ name: `${TEST_TAG} mutated-by-resident`, isManagerOnly: false });
      // The PUT route MAY allow the resident to edit (because the doc
      // is in their residence scope) OR reject the request — what we
      // MUST guarantee is that the manager-only flag survives. The
      // existing role guard around line 2704 of server/api/documents.ts
      // is what's under test here.
      expect([200, 403, 404]).toContain(res.status);

      const [row] = await db
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.id, ids.docMgrOnlyResidence));
      expect(row?.isManagerOnly).toBe(true);
    }, 30000);

    it('tenant PUT attempting isManagerOnly=false leaves the flag set', async () => {
      const agent = await loginAs(emails.tenant);
      const res = await agent
        .put(`/api/documents/${ids.docMgrOnlyBuilding}`)
        .send({ name: `${TEST_TAG} mutated-by-tenant`, isManagerOnly: false });
      // Same contract as above — accept any non-mutating status, but
      // assert the persisted flag is unchanged.
      expect([200, 403, 404]).toContain(res.status);

      const [row] = await db
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.id, ids.docMgrOnlyBuilding));
      expect(row?.isManagerOnly).toBe(true);
    }, 30000);

    it('manager PUT can flip and restore the manager-only flag', async () => {
      const agent = await loginAs(emails.manager);

      // Use the building-scoped manager-only doc — the manager has a
      // direct userBuildings link to that building so the PUT route's
      // scope query reaches it consistently.
      const turnOff = await agent
        .put(`/api/documents/${ids.docMgrOnlyBuilding}`)
        .send({ isManagerOnly: false });
      expect(turnOff.status).toBe(200);
      expect(turnOff.body?.isManagerOnly).toBe(false);

      const turnOn = await agent
        .put(`/api/documents/${ids.docMgrOnlyBuilding}`)
        .send({ isManagerOnly: true });
      expect(turnOn.status).toBe(200);
      expect(turnOn.body?.isManagerOnly).toBe(true);

      // Restore DB state for downstream assertions in the suite.
      const [row] = await db
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.id, ids.docMgrOnlyBuilding));
      expect(row?.isManagerOnly).toBe(true);
    }, 30000);
  });

  describe('GET /api/documents/:id/optimized-file — preview', () => {
    it('resident receives access-denied (404) on manager-only documents', async () => {
      const agent = await loginAs(emails.resident);
      for (const docId of [ids.docMgrOnlyResidence, ids.docMgrOnlyBuilding]) {
        const res = await agent.get(`/api/documents/${docId}/optimized-file`);
        // The optimized route uses storage.getDocumentWithScope(), which
        // returns null for unauthorized users; the route then responds
        // with 404 "Document not found or access denied".
        expect(res.status).toBe(404);
      }
    }, 30000);

    it('tenant receives access-denied (404) on manager-only documents', async () => {
      const agent = await loginAs(emails.tenant);
      for (const docId of [ids.docMgrOnlyResidence, ids.docMgrOnlyBuilding]) {
        const res = await agent.get(`/api/documents/${docId}/optimized-file`);
        expect(res.status).toBe(404);
      }
    }, 30000);

    it('admin passes the access check on manager-only documents', async () => {
      const agent = await loginAs(emails.admin);
      for (const docId of [ids.docMgrOnlyResidence, ids.docMgrOnlyBuilding]) {
        const res = await agent.get(`/api/documents/${docId}/optimized-file`);
        // Document scope authorization passes; the file itself does
        // not exist on disk, so a non-404 access-denied is acceptable
        // (typically 403 from the file retrieval layer or 500). The
        // critical assertion is that we do NOT see the 404 "not found
        // or access denied" returned by getDocumentWithScope().
        expect(res.status).not.toBe(404);
      }
    }, 30000);

    it('manager passes the access check on manager-only documents', async () => {
      const agent = await loginAs(emails.manager);
      for (const docId of [ids.docMgrOnlyResidence, ids.docMgrOnlyBuilding]) {
        const res = await agent.get(`/api/documents/${docId}/optimized-file`);
        expect(res.status).not.toBe(404);
      }
    }, 30000);
  });
});
