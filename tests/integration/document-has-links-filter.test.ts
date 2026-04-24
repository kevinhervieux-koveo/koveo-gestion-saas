/**
 * @jest-environment node
 *
 * @file Task #502 — Backend coverage for the `?hasLinks=true` filter on
 *   `GET /api/documents`.
 * @description The same documents page exposes a "show only linked
 *   documents" toggle that wires `?hasLinks=true` into the listing
 *   endpoint. The post-filter lives at `server/api/documents.ts` ~line
 *   1698 and runs after the link-summary attachment loop:
 *
 *     d.hasLinks = !!summary && (!!summary.previous || !!summary.next);
 *     if (hasLinksFilter) { ...filter to d.hasLinks === true... }
 *
 *   Mirrors the real-DB harness used by
 *   `tests/integration/document-manager-only-visibility.test.ts` and
 *   `tests/integration/document-links-api.test.ts`. Asserts the filter
 *   collapses the result set to only documents that are actual
 *   endpoints of an explicit `document_links` row, regardless of:
 *     - the requester's role (admin / manager / resident / tenant)
 *     - the request's scope (organization-wide, buildingId, residenceId)
 *
 *   The unlinked control fixture must NEVER appear when
 *   `hasLinks=true`, while it MUST appear when the filter is omitted —
 *   that pair of assertions is what gives the test its discriminating
 *   power.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// jest.config.cjs maps `./storage`, `./auth`, `./routes` to in-repo
// unit-tier mocks. For this real-DB integration suite we need the real
// implementations (same trick used by the sibling integration suites).
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
const TEST_TAG = 'task502-has-links-filter';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

describeIfDb('GET /api/documents?hasLinks=true — Task #502', () => {
  let app: express.Application;
  let db: any;
  let schema: any;

  const PASSWORD = 'Password!234';
  const ids = {
    org: crypto.randomUUID(),
    building: crypto.randomUUID(),
    residence: crypto.randomUUID(),
    admin: crypto.randomUUID(),
    manager: crypto.randomUUID(),
    resident: crypto.randomUUID(),
    tenant: crypto.randomUUID(),
    // Residence-scoped pair joined by an explicit `document_links` row.
    docResLinkedFrom: crypto.randomUUID(),
    docResLinkedTo: crypto.randomUUID(),
    // Building-scoped pair joined by an explicit `document_links` row.
    docBldLinkedFrom: crypto.randomUUID(),
    docBldLinkedTo: crypto.randomUUID(),
    // Unlinked controls — these must NEVER appear when `hasLinks=true`.
    docResUnlinked: crypto.randomUUID(),
    docBldUnlinked: crypto.randomUUID(),
    // Explicit link rows — tracked so afterAll can clean them up even
    // if a midsuite assertion fails.
    linkResidence: crypto.randomUUID(),
    linkBuilding: crypto.randomUUID(),
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
      process.env.SESSION_SECRET || 'test-session-secret-task502';
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
        username: `${TEST_TAG}-adm-${ids.admin.slice(0, 8)}`,
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

    // Document fixtures. Every document is `isVisibleToTenants=true`
    // and `isManagerOnly=false` so visibility rules never become a
    // confound — the only thing distinguishing the linked from
    // unlinked rows is the presence of an explicit `document_links`
    // row pointing at them. Each role's listing should therefore see
    // every fixture when `hasLinks` is omitted, and only the linked
    // ones when `hasLinks=true`.
    await db.insert(schema.documents).values([
      {
        id: ids.docResLinkedFrom,
        name: `${TEST_TAG} res linked from`,
        documentType: 'legal',
        filePath: `/objects/uploads/${TEST_TAG}/${ids.docResLinkedFrom}.pdf`,
        fileName: `${ids.docResLinkedFrom}.pdf`,
        mimeType: 'application/pdf',
        fileSize: 100,
        residenceId: ids.residence,
        uploadedById: ids.manager,
        isVisibleToTenants: true,
        isManagerOnly: false,
        effectiveDate: new Date('2025-01-01T00:00:00Z'),
      },
      {
        id: ids.docResLinkedTo,
        name: `${TEST_TAG} res linked to`,
        documentType: 'legal',
        filePath: `/objects/uploads/${TEST_TAG}/${ids.docResLinkedTo}.pdf`,
        fileName: `${ids.docResLinkedTo}.pdf`,
        mimeType: 'application/pdf',
        fileSize: 100,
        residenceId: ids.residence,
        uploadedById: ids.manager,
        isVisibleToTenants: true,
        isManagerOnly: false,
        effectiveDate: new Date('2025-02-01T00:00:00Z'),
      },
      {
        id: ids.docResUnlinked,
        name: `${TEST_TAG} res unlinked control`,
        documentType: 'legal',
        filePath: `/objects/uploads/${TEST_TAG}/${ids.docResUnlinked}.pdf`,
        fileName: `${ids.docResUnlinked}.pdf`,
        mimeType: 'application/pdf',
        fileSize: 100,
        residenceId: ids.residence,
        uploadedById: ids.manager,
        isVisibleToTenants: true,
        isManagerOnly: false,
        effectiveDate: new Date('2025-03-01T00:00:00Z'),
      },
      {
        id: ids.docBldLinkedFrom,
        name: `${TEST_TAG} bld linked from`,
        documentType: 'legal',
        filePath: `/objects/uploads/${TEST_TAG}/${ids.docBldLinkedFrom}.pdf`,
        fileName: `${ids.docBldLinkedFrom}.pdf`,
        mimeType: 'application/pdf',
        fileSize: 100,
        buildingId: ids.building,
        uploadedById: ids.manager,
        isVisibleToTenants: true,
        isManagerOnly: false,
        effectiveDate: new Date('2025-04-01T00:00:00Z'),
      },
      {
        id: ids.docBldLinkedTo,
        name: `${TEST_TAG} bld linked to`,
        documentType: 'legal',
        filePath: `/objects/uploads/${TEST_TAG}/${ids.docBldLinkedTo}.pdf`,
        fileName: `${ids.docBldLinkedTo}.pdf`,
        mimeType: 'application/pdf',
        fileSize: 100,
        buildingId: ids.building,
        uploadedById: ids.manager,
        isVisibleToTenants: true,
        isManagerOnly: false,
        effectiveDate: new Date('2025-05-01T00:00:00Z'),
      },
      {
        id: ids.docBldUnlinked,
        name: `${TEST_TAG} bld unlinked control`,
        documentType: 'legal',
        filePath: `/objects/uploads/${TEST_TAG}/${ids.docBldUnlinked}.pdf`,
        fileName: `${ids.docBldUnlinked}.pdf`,
        mimeType: 'application/pdf',
        fileSize: 100,
        buildingId: ids.building,
        uploadedById: ids.manager,
        isVisibleToTenants: true,
        isManagerOnly: false,
        effectiveDate: new Date('2025-06-01T00:00:00Z'),
      },
    ]);
    created.documents.add(ids.docResLinkedFrom);
    created.documents.add(ids.docResLinkedTo);
    created.documents.add(ids.docResUnlinked);
    created.documents.add(ids.docBldLinkedFrom);
    created.documents.add(ids.docBldLinkedTo);
    created.documents.add(ids.docBldUnlinked);

    // Two explicit link rows — one inside the residence pair and one
    // inside the building pair. Inserted directly into the table so
    // we don't need to drive the link-creation routes (the route
    // enforces a same-building/same-residence constraint that already
    // has its own integration coverage in
    // `tests/integration/document-links-api.test.ts`).
    await db.insert(schema.documentLinks).values([
      {
        id: ids.linkResidence,
        fromDocumentId: ids.docResLinkedFrom,
        toDocumentId: ids.docResLinkedTo,
        position: 'after',
      },
      {
        id: ids.linkBuilding,
        fromDocumentId: ids.docBldLinkedFrom,
        toDocumentId: ids.docBldLinkedTo,
        position: 'after',
      },
    ]);
    created.documentLinks.add(ids.linkResidence);
    created.documentLinks.add(ids.linkBuilding);
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
        .where(
          inArray(
            schema.userOrganizations.id,
            [...created.userOrganizations]
          )
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

  function listIds(body: any): string[] {
    return (body?.documents ?? []).map((d: any) => d.id);
  }

  // Per-role views of the fixtures, expressed in terms of which
  // documents each role is *expected to see at all* once a given
  // scope is applied. The UI never opens the documents page without a
  // scope (always `buildingId=` or `residenceId=`), but we add an
  // admin-only org-wide test below for completeness — admins see
  // every document regardless of building/residence membership.
  const ourLinkedBuildingIds = () => [
    ids.docBldLinkedFrom,
    ids.docBldLinkedTo,
  ];
  const ourLinkedResidenceIds = () => [
    ids.docResLinkedFrom,
    ids.docResLinkedTo,
  ];
  const ourLinkedAll = () => [
    ...ourLinkedBuildingIds(),
    ...ourLinkedResidenceIds(),
  ];
  const ourUnlinkedAll = () => [ids.docResUnlinked, ids.docBldUnlinked];

  // ----------------------------------------------------------------
  // Admin-only sanity at the broadest (organization-wide) scope.
  // Admins are the only role that bypass the
  // residence-vs-building scope split inside `getDocumentsForUser`,
  // so they're the only role for which an unscoped `?hasLinks=true`
  // can be asserted to drop BOTH the building AND residence
  // unlinked controls in one shot. Documents are ordered by
  // `createdAt DESC` with a default page limit of 100, so our just-
  // inserted fixtures are guaranteed to land in the top page.
  // ----------------------------------------------------------------
  describe('admin org-wide listing', () => {
    it('baseline (no filter) returns every fixture (sanity check)', async () => {
      const agent = await loginAs(emails.admin);
      const res = await agent.get('/api/documents');
      expect(res.status).toBe(200);
      const returned = listIds(res.body);
      // Both linked endpoints AND both unlinked controls must come
      // back — otherwise the filtered assertion below would pass for
      // the wrong reason.
      for (const id of [...ourLinkedAll(), ...ourUnlinkedAll()]) {
        expect(returned).toContain(id);
      }
    }, 30000);

    it('hasLinks=true returns only the linked endpoints', async () => {
      const agent = await loginAs(emails.admin);
      const res = await agent.get('/api/documents?hasLinks=true');
      expect(res.status).toBe(200);
      const returned = listIds(res.body);

      // Every linked fixture (residence + building pair) survives.
      for (const id of ourLinkedAll()) {
        expect(returned).toContain(id);
      }
      // Both unlinked controls are filtered out.
      for (const id of ourUnlinkedAll()) {
        expect(returned).not.toContain(id);
      }
      // Every row the route returns from OUR fixture set must have
      // the `hasLinks` boolean set to true. We restrict the per-row
      // assertion to our fixtures so unrelated documents that happen
      // to coexist in the integration DB don't break this suite.
      const ourRows = (res.body?.documents ?? []).filter((d: any) =>
        [...ourLinkedAll(), ...ourUnlinkedAll()].includes(d.id)
      );
      expect(ourRows.length).toBe(ourLinkedAll().length);
      for (const d of ourRows) {
        expect(d.hasLinks).toBe(true);
      }
      // The reported total must match the number of rows returned —
      // the post-filter recomputes total after dropping unlinked rows.
      expect(res.body?.total).toBe((res.body?.documents ?? []).length);
    }, 30000);
  });

  // ----------------------------------------------------------------
  // Same filter, but narrowed by buildingId — the wire shape sent by
  // the building documents page (`?buildingId=...&hasLinks=true`).
  // The unlinked building control must drop out, the residence-only
  // linked pair must NOT bleed in (building scope strips residence
  // documents at line 1572-1581 of `server/api/documents.ts`).
  // ----------------------------------------------------------------
  describe('hasLinks=true scoped to a building', () => {
    it.each([
      ['admin', () => emails.admin],
      ['manager', () => emails.manager],
      ['resident', () => emails.resident],
      ['tenant', () => emails.tenant],
    ])('%s sees only linked building docs', async (_label, emailFn) => {
      const agent = await loginAs(emailFn());
      const res = await agent.get(
        `/api/documents?buildingId=${ids.building}&hasLinks=true`
      );
      expect(res.status).toBe(200);
      const returned = listIds(res.body);

      // Building-level linked endpoints survive.
      expect(returned).toContain(ids.docBldLinkedFrom);
      expect(returned).toContain(ids.docBldLinkedTo);
      // Building-level unlinked control is filtered out.
      expect(returned).not.toContain(ids.docBldUnlinked);
      // Residence-scoped fixtures must NEVER appear in a buildingId
      // query — even if they are linked — because the buildingId scope
      // strips rows that carry a residenceId.
      expect(returned).not.toContain(ids.docResLinkedFrom);
      expect(returned).not.toContain(ids.docResLinkedTo);
      expect(returned).not.toContain(ids.docResUnlinked);
    }, 30000);
  });

  // ----------------------------------------------------------------
  // Same filter, narrowed by residenceId — the wire shape sent by the
  // residence documents page (`?residenceId=...&hasLinks=true`).
  // ----------------------------------------------------------------
  describe('hasLinks=true scoped to a residence', () => {
    it.each([
      ['admin', () => emails.admin],
      ['manager', () => emails.manager],
      ['resident', () => emails.resident],
      ['tenant', () => emails.tenant],
    ])('%s sees only linked residence docs', async (_label, emailFn) => {
      const agent = await loginAs(emailFn());
      const res = await agent.get(
        `/api/documents?residenceId=${ids.residence}&hasLinks=true`
      );
      expect(res.status).toBe(200);
      const returned = listIds(res.body);

      // Residence-level linked endpoints survive.
      expect(returned).toContain(ids.docResLinkedFrom);
      expect(returned).toContain(ids.docResLinkedTo);
      // Residence-level unlinked control is filtered out.
      expect(returned).not.toContain(ids.docResUnlinked);
    }, 30000);
  });
});
