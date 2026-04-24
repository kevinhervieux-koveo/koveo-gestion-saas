/**
 * @jest-environment node
 *
 * @file Task #532 — Combined backend coverage for the
 *   `?isManagerOnly=true&hasLinks=true` query on `GET /api/documents`.
 * @description Tasks #327 and #502 each landed real-DB integration
 *   coverage for ONE of the two filters in isolation:
 *     - `tests/integration/document-manager-only-visibility.test.ts`
 *       (isManagerOnly only)
 *     - `tests/integration/document-has-links-filter.test.ts`
 *       (hasLinks only)
 *
 *   What was missing was a guard that flips BOTH at the same time, the
 *   exact wire shape the documents page sends when a manager checks
 *   "show only manager-only" AND "show only linked". The two filters
 *   are applied at different layers of `server/api/documents.ts`:
 *     - `isManagerOnly` flows into the optimized SQL query via
 *       `additionalFilters.isManagerOnly = true` (~line 1502).
 *     - `hasLinks` is a post-filter run AFTER link summaries have been
 *       attached (~line 1698):
 *         d.hasLinks = !!summary && (!!summary.previous || !!summary.next);
 *         if (hasLinksFilter) { ...filter to d.hasLinks === true... }
 *
 *   A regression that lets one filter clobber the other (e.g. the
 *   queryKey only carrying one, or the post-filter operating on the
 *   pre-`isManagerOnly` doc set) would silently let manager-only docs
 *   bleed in or strip linked manager-only docs out — and no existing
 *   test would catch it.
 *
 *   Mirrors the real-DB harness, role/scope matrix, and cleanup
 *   pattern used by the two sibling integration suites listed above.
 *   Fixtures cover all four combinations of (isManagerOnly,hasLinks)
 *   at both residence and building scope, so every assertion either
 *   side of the intersection has a discriminating control.
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
const TEST_TAG = 'task532-mgr-and-links-filter';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

describeIfDb(
  'GET /api/documents?isManagerOnly=true&hasLinks=true — Task #532',
  () => {
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

      // Residence-scoped fixtures — every combination of
      // (isManagerOnly, has-an-explicit-link) so the intersection
      // assertion has a discriminating control on each axis.
      docResMgrLinkedFrom: crypto.randomUUID(), // mgr-only AND linked
      docResMgrLinkedTo: crypto.randomUUID(),   // mgr-only AND linked (target)
      docResMgrUnlinked: crypto.randomUUID(),   // mgr-only, NO link
      docResNormalLinkedFrom: crypto.randomUUID(), // linked, NOT mgr-only
      docResNormalLinkedTo: crypto.randomUUID(),   // linked, NOT mgr-only (target)
      docResNormalUnlinked: crypto.randomUUID(),   // neither

      // Building-scoped fixtures — same matrix at the building level.
      docBldMgrLinkedFrom: crypto.randomUUID(),
      docBldMgrLinkedTo: crypto.randomUUID(),
      docBldMgrUnlinked: crypto.randomUUID(),
      docBldNormalLinkedFrom: crypto.randomUUID(),
      docBldNormalLinkedTo: crypto.randomUUID(),
      docBldNormalUnlinked: crypto.randomUUID(),

      // Explicit document_links rows — tracked so afterAll can clean
      // them up even if a midsuite assertion fails.
      linkResMgr: crypto.randomUUID(),
      linkResNormal: crypto.randomUUID(),
      linkBldMgr: crypto.randomUUID(),
      linkBldNormal: crypto.randomUUID(),
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
        process.env.SESSION_SECRET || 'test-session-secret-task532';
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
          cookie: {
            secure: false,
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
          },
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

      // 12 documents — all four (isManagerOnly, hasLink) combinations
      // at both residence and building scope. `isVisibleToTenants` is
      // true on every row so visibility never silently confounds the
      // assertion: the only thing distinguishing the surviving rows
      // when both filters are on is the manager-only flag plus the
      // presence of an explicit `document_links` row.
      const baseDoc = {
        documentType: 'legal' as const,
        mimeType: 'application/pdf',
        fileSize: 100,
        uploadedById: ids.manager,
        isVisibleToTenants: true,
      };
      await db.insert(schema.documents).values([
        // Residence scope.
        {
          ...baseDoc,
          id: ids.docResMgrLinkedFrom,
          name: `${TEST_TAG} res mgr linked from`,
          filePath: `/objects/uploads/${TEST_TAG}/${ids.docResMgrLinkedFrom}.pdf`,
          fileName: `${ids.docResMgrLinkedFrom}.pdf`,
          residenceId: ids.residence,
          isManagerOnly: true,
          effectiveDate: new Date('2025-01-01T00:00:00Z'),
        },
        {
          ...baseDoc,
          id: ids.docResMgrLinkedTo,
          name: `${TEST_TAG} res mgr linked to`,
          filePath: `/objects/uploads/${TEST_TAG}/${ids.docResMgrLinkedTo}.pdf`,
          fileName: `${ids.docResMgrLinkedTo}.pdf`,
          residenceId: ids.residence,
          isManagerOnly: true,
          effectiveDate: new Date('2025-01-02T00:00:00Z'),
        },
        {
          ...baseDoc,
          id: ids.docResMgrUnlinked,
          name: `${TEST_TAG} res mgr unlinked`,
          filePath: `/objects/uploads/${TEST_TAG}/${ids.docResMgrUnlinked}.pdf`,
          fileName: `${ids.docResMgrUnlinked}.pdf`,
          residenceId: ids.residence,
          isManagerOnly: true,
          effectiveDate: new Date('2025-01-03T00:00:00Z'),
        },
        {
          ...baseDoc,
          id: ids.docResNormalLinkedFrom,
          name: `${TEST_TAG} res normal linked from`,
          filePath: `/objects/uploads/${TEST_TAG}/${ids.docResNormalLinkedFrom}.pdf`,
          fileName: `${ids.docResNormalLinkedFrom}.pdf`,
          residenceId: ids.residence,
          isManagerOnly: false,
          effectiveDate: new Date('2025-01-04T00:00:00Z'),
        },
        {
          ...baseDoc,
          id: ids.docResNormalLinkedTo,
          name: `${TEST_TAG} res normal linked to`,
          filePath: `/objects/uploads/${TEST_TAG}/${ids.docResNormalLinkedTo}.pdf`,
          fileName: `${ids.docResNormalLinkedTo}.pdf`,
          residenceId: ids.residence,
          isManagerOnly: false,
          effectiveDate: new Date('2025-01-05T00:00:00Z'),
        },
        {
          ...baseDoc,
          id: ids.docResNormalUnlinked,
          name: `${TEST_TAG} res normal unlinked`,
          filePath: `/objects/uploads/${TEST_TAG}/${ids.docResNormalUnlinked}.pdf`,
          fileName: `${ids.docResNormalUnlinked}.pdf`,
          residenceId: ids.residence,
          isManagerOnly: false,
          effectiveDate: new Date('2025-01-06T00:00:00Z'),
        },
        // Building scope.
        {
          ...baseDoc,
          id: ids.docBldMgrLinkedFrom,
          name: `${TEST_TAG} bld mgr linked from`,
          filePath: `/objects/uploads/${TEST_TAG}/${ids.docBldMgrLinkedFrom}.pdf`,
          fileName: `${ids.docBldMgrLinkedFrom}.pdf`,
          buildingId: ids.building,
          isManagerOnly: true,
          effectiveDate: new Date('2025-02-01T00:00:00Z'),
        },
        {
          ...baseDoc,
          id: ids.docBldMgrLinkedTo,
          name: `${TEST_TAG} bld mgr linked to`,
          filePath: `/objects/uploads/${TEST_TAG}/${ids.docBldMgrLinkedTo}.pdf`,
          fileName: `${ids.docBldMgrLinkedTo}.pdf`,
          buildingId: ids.building,
          isManagerOnly: true,
          effectiveDate: new Date('2025-02-02T00:00:00Z'),
        },
        {
          ...baseDoc,
          id: ids.docBldMgrUnlinked,
          name: `${TEST_TAG} bld mgr unlinked`,
          filePath: `/objects/uploads/${TEST_TAG}/${ids.docBldMgrUnlinked}.pdf`,
          fileName: `${ids.docBldMgrUnlinked}.pdf`,
          buildingId: ids.building,
          isManagerOnly: true,
          effectiveDate: new Date('2025-02-03T00:00:00Z'),
        },
        {
          ...baseDoc,
          id: ids.docBldNormalLinkedFrom,
          name: `${TEST_TAG} bld normal linked from`,
          filePath: `/objects/uploads/${TEST_TAG}/${ids.docBldNormalLinkedFrom}.pdf`,
          fileName: `${ids.docBldNormalLinkedFrom}.pdf`,
          buildingId: ids.building,
          isManagerOnly: false,
          effectiveDate: new Date('2025-02-04T00:00:00Z'),
        },
        {
          ...baseDoc,
          id: ids.docBldNormalLinkedTo,
          name: `${TEST_TAG} bld normal linked to`,
          filePath: `/objects/uploads/${TEST_TAG}/${ids.docBldNormalLinkedTo}.pdf`,
          fileName: `${ids.docBldNormalLinkedTo}.pdf`,
          buildingId: ids.building,
          isManagerOnly: false,
          effectiveDate: new Date('2025-02-05T00:00:00Z'),
        },
        {
          ...baseDoc,
          id: ids.docBldNormalUnlinked,
          name: `${TEST_TAG} bld normal unlinked`,
          filePath: `/objects/uploads/${TEST_TAG}/${ids.docBldNormalUnlinked}.pdf`,
          fileName: `${ids.docBldNormalUnlinked}.pdf`,
          buildingId: ids.building,
          isManagerOnly: false,
          effectiveDate: new Date('2025-02-06T00:00:00Z'),
        },
      ]);
      [
        ids.docResMgrLinkedFrom,
        ids.docResMgrLinkedTo,
        ids.docResMgrUnlinked,
        ids.docResNormalLinkedFrom,
        ids.docResNormalLinkedTo,
        ids.docResNormalUnlinked,
        ids.docBldMgrLinkedFrom,
        ids.docBldMgrLinkedTo,
        ids.docBldMgrUnlinked,
        ids.docBldNormalLinkedFrom,
        ids.docBldNormalLinkedTo,
        ids.docBldNormalUnlinked,
      ].forEach((id) => created.documents.add(id));

      // Four explicit link rows — one per (scope, isManagerOnly)
      // combination — inserted directly into the table so we don't
      // need to drive the link-creation route (which has its own
      // visibility constraints already covered elsewhere).
      await db.insert(schema.documentLinks).values([
        {
          id: ids.linkResMgr,
          fromDocumentId: ids.docResMgrLinkedFrom,
          toDocumentId: ids.docResMgrLinkedTo,
          position: 'after',
        },
        {
          id: ids.linkResNormal,
          fromDocumentId: ids.docResNormalLinkedFrom,
          toDocumentId: ids.docResNormalLinkedTo,
          position: 'after',
        },
        {
          id: ids.linkBldMgr,
          fromDocumentId: ids.docBldMgrLinkedFrom,
          toDocumentId: ids.docBldMgrLinkedTo,
          position: 'after',
        },
        {
          id: ids.linkBldNormal,
          fromDocumentId: ids.docBldNormalLinkedFrom,
          toDocumentId: ids.docBldNormalLinkedTo,
          position: 'after',
        },
      ]);
      created.documentLinks.add(ids.linkResMgr);
      created.documentLinks.add(ids.linkResNormal);
      created.documentLinks.add(ids.linkBldMgr);
      created.documentLinks.add(ids.linkBldNormal);
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
          .where(
            inArray(schema.userResidences.id, [...created.userResidences])
          );
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
            inArray(schema.userOrganizations.id, [
              ...created.userOrganizations,
            ])
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

    // The fixtures we expect to survive the combined filter, by scope.
    const survivingResidenceIds = () => [
      ids.docResMgrLinkedFrom,
      ids.docResMgrLinkedTo,
    ];
    const survivingBuildingIds = () => [
      ids.docBldMgrLinkedFrom,
      ids.docBldMgrLinkedTo,
    ];
    // Every fixture that must NEVER appear when both filters are on,
    // by scope. Each one fails at least one of the two filters.
    const droppedResidenceIds = () => [
      ids.docResMgrUnlinked,        // mgr-only but no link
      ids.docResNormalLinkedFrom,   // linked but not mgr-only
      ids.docResNormalLinkedTo,     // linked but not mgr-only
      ids.docResNormalUnlinked,     // neither
    ];
    const droppedBuildingIds = () => [
      ids.docBldMgrUnlinked,
      ids.docBldNormalLinkedFrom,
      ids.docBldNormalLinkedTo,
      ids.docBldNormalUnlinked,
    ];
    const allOurFixtureIds = () => [
      ...survivingResidenceIds(),
      ...survivingBuildingIds(),
      ...droppedResidenceIds(),
      ...droppedBuildingIds(),
    ];

    // ----------------------------------------------------------------
    // Admin-only sanity at the broadest (organization-wide) scope.
    // Admins are the only role that bypass the residence-vs-building
    // scope split inside `getDocumentsForUser`, so they're the only
    // role for which an unscoped combined query can be asserted to
    // collapse to BOTH residence + building manager-only-and-linked
    // pairs in one shot.
    // ----------------------------------------------------------------
    describe('admin org-wide listing', () => {
      it('baseline (no filters) returns every fixture (sanity check)', async () => {
        const agent = await loginAs(emails.admin);
        const res = await agent.get('/api/documents');
        expect(res.status).toBe(200);
        const returned = listIds(res.body);
        // Every fixture (all 12) must come back when no filter is on,
        // otherwise the filtered assertion below could pass for the
        // wrong reason (e.g. a fixture missing from the page entirely).
        for (const id of allOurFixtureIds()) {
          expect(returned).toContain(id);
        }
      }, 30000);

      it('isManagerOnly=true&hasLinks=true returns only mgr-only AND linked docs', async () => {
        const agent = await loginAs(emails.admin);
        const res = await agent.get(
          '/api/documents?isManagerOnly=true&hasLinks=true'
        );
        expect(res.status).toBe(200);
        const returned = listIds(res.body);

        // Every doc that is BOTH manager-only AND linked must survive,
        // at both residence and building scope.
        for (const id of [
          ...survivingResidenceIds(),
          ...survivingBuildingIds(),
        ]) {
          expect(returned).toContain(id);
        }
        // Every other fixture must be filtered out — failing either
        // axis alone is enough to be dropped.
        for (const id of [
          ...droppedResidenceIds(),
          ...droppedBuildingIds(),
        ]) {
          expect(returned).not.toContain(id);
        }

        // Restrict the per-row assertion to OUR fixtures so unrelated
        // documents that happen to coexist in the integration DB don't
        // break this suite; every surviving row from our set must be
        // both `isManagerOnly === true` and `hasLinks === true`.
        const ourRows = (res.body?.documents ?? []).filter((d: any) =>
          allOurFixtureIds().includes(d.id)
        );
        expect(ourRows.length).toBe(
          survivingResidenceIds().length + survivingBuildingIds().length
        );
        for (const d of ourRows) {
          expect(d.isManagerOnly).toBe(true);
          expect(d.hasLinks).toBe(true);
        }

        // The reported total must match the number of rows the route
        // returns — the post-filter recomputes total after dropping
        // unlinked rows, and a regression that used the pre-filter
        // count would surface here.
        expect(res.body?.total).toBe((res.body?.documents ?? []).length);
      }, 30000);
    });

    // ----------------------------------------------------------------
    // Combined filter scoped to a building — the wire shape sent by
    // the building documents page when both checkboxes are ticked.
    // The residence-scoped pair must NOT bleed in (building scope
    // strips rows that carry a residenceId at line 1572-1581 of
    // server/api/documents.ts), and every fixture that fails either
    // axis must be filtered out.
    // ----------------------------------------------------------------
    describe('combined filter scoped to a building', () => {
      it.each([
        ['admin', () => emails.admin],
        ['manager', () => emails.manager],
      ])(
        '%s sees only the mgr-only AND linked building pair',
        async (_label, emailFn) => {
          const agent = await loginAs(emailFn());
          const res = await agent.get(
            `/api/documents?buildingId=${ids.building}` +
              `&isManagerOnly=true&hasLinks=true`
          );
          expect(res.status).toBe(200);
          const returned = listIds(res.body);

          // Both endpoints of the building-level mgr-only link survive.
          expect(returned).toContain(ids.docBldMgrLinkedFrom);
          expect(returned).toContain(ids.docBldMgrLinkedTo);

          // Every other building-scoped fixture is filtered out.
          for (const id of droppedBuildingIds()) {
            expect(returned).not.toContain(id);
          }

          // Residence-scoped fixtures must NEVER appear in a buildingId
          // query — even the mgr-only AND linked pair — because the
          // buildingId scope strips rows that carry a residenceId.
          for (const id of [
            ...survivingResidenceIds(),
            ...droppedResidenceIds(),
          ]) {
            expect(returned).not.toContain(id);
          }

          // Per-row sanity on OUR surviving rows.
          const ourRows = (res.body?.documents ?? []).filter((d: any) =>
            allOurFixtureIds().includes(d.id)
          );
          expect(ourRows.length).toBe(survivingBuildingIds().length);
          for (const d of ourRows) {
            expect(d.isManagerOnly).toBe(true);
            expect(d.hasLinks).toBe(true);
          }
        },
        30000
      );

      it.each([
        ['resident', () => emails.resident],
        ['tenant', () => emails.tenant],
      ])(
        '%s gets nothing from our fixture set under the combined filter',
        async (_label, emailFn) => {
          const agent = await loginAs(emailFn());
          const res = await agent.get(
            `/api/documents?buildingId=${ids.building}` +
              `&isManagerOnly=true&hasLinks=true`
          );
          expect(res.status).toBe(200);
          const returned = listIds(res.body);

          // Non-managers cannot use the manager-only filter to surface
          // restricted docs, so the whole mgr-only-AND-linked pair is
          // hidden — and the non-mgr-only-but-linked pair is excluded
          // by the SQL-level isManagerOnly=true filter as well.
          for (const id of allOurFixtureIds()) {
            expect(returned).not.toContain(id);
          }
        },
        30000
      );
    });

    // ----------------------------------------------------------------
    // Combined filter scoped to a residence — the wire shape sent by
    // the residence documents page when both checkboxes are ticked.
    // ----------------------------------------------------------------
    describe('combined filter scoped to a residence', () => {
      it.each([
        ['admin', () => emails.admin],
        ['manager', () => emails.manager],
      ])(
        '%s sees only the mgr-only AND linked residence pair',
        async (_label, emailFn) => {
          const agent = await loginAs(emailFn());
          const res = await agent.get(
            `/api/documents?residenceId=${ids.residence}` +
              `&isManagerOnly=true&hasLinks=true`
          );
          expect(res.status).toBe(200);
          const returned = listIds(res.body);

          expect(returned).toContain(ids.docResMgrLinkedFrom);
          expect(returned).toContain(ids.docResMgrLinkedTo);

          for (const id of droppedResidenceIds()) {
            expect(returned).not.toContain(id);
          }

          // Per-row sanity on OUR surviving rows.
          const ourRows = (res.body?.documents ?? []).filter((d: any) =>
            allOurFixtureIds().includes(d.id)
          );
          expect(ourRows.length).toBe(survivingResidenceIds().length);
          for (const d of ourRows) {
            expect(d.isManagerOnly).toBe(true);
            expect(d.hasLinks).toBe(true);
          }
        },
        30000
      );

      it.each([
        ['resident', () => emails.resident],
        ['tenant', () => emails.tenant],
      ])(
        '%s gets nothing from our fixture set under the combined filter',
        async (_label, emailFn) => {
          const agent = await loginAs(emailFn());
          const res = await agent.get(
            `/api/documents?residenceId=${ids.residence}` +
              `&isManagerOnly=true&hasLinks=true`
          );
          expect(res.status).toBe(200);
          const returned = listIds(res.body);

          for (const id of [
            ...survivingResidenceIds(),
            ...droppedResidenceIds(),
          ]) {
            expect(returned).not.toContain(id);
          }
        },
        30000
      );
    });
  }
);
