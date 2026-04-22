/**
 * @jest-environment node
 *
 * @file User-residences end-residency behavioral integration test
 * @description Behavioural coverage for Task #144's write contract on
 * `userResidences`, executed against the real (test) database.
 * Runs in the Node environment because Task #152 switched server/db.ts
 * to the neon-serverless WebSocket Pool, and the `ws` package's
 * browser-stub entry (picked up by jsdom) cannot open real sockets.
 *
 * For each end-residency production code path we:
 *   1. Seed an organization, building, residence, user.
 *   2. Insert TWO `user_residences` rows on the same residence:
 *        - an active link (isActive=true, endDate=null)
 *        - an already-ended historical link (isActive=false, endDate
 *          fixed to '2020-01-01')
 *   3. Run the production code path.
 *   4. Assert from persisted DB state:
 *        - the active link transitioned to isActive=false with today's
 *          endDate, AND
 *        - the historical link's endDate is preserved (still
 *          '2020-01-01' — NOT clobbered to today).
 *
 * Production paths covered:
 *   1. server/api/buildings/operations.ts -> deleteSelectedResidences
 *   2. server/api/buildings/operations.ts -> cascadeDeleteBuilding
 *   3. server/api/buildings.ts -> DELETE /api/admin/buildings/:id/cascade
 *
 * NOTE on env: jest.setup.simple.ts overwrites DATABASE_URL with a
 * placeholder. jest.polyfills.js captures the real value into
 * process.env._INTEGRATION_DB_URL BEFORE that happens, and this file
 * restores it before dynamically importing server/db. If no real DB
 * URL is available (e.g. CI without DB credentials), the suite skips
 * itself rather than failing.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
// Task #274 finished removing the package-wide drizzle-orm auto-mocks
// (the relocated stubs now live opt-in under `tests/manual-mocks/`), so
// the real package is loaded by default and no `jest.unmock` calls are
// required here.
import crypto from 'crypto';

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const HISTORICAL_END_DATE = '2020-01-01';
const TEST_TAG = 'task149-end-residency-test';

const describeIfDb = REAL_DB_URL ? describe : describe.skip;

describeIfDb('end-residency write contract — behavioural DB test (Task #144)', () => {
  // Module references resolved in beforeAll after restoring DATABASE_URL.
  let db: any;
  let schema: any;
  let ops: any;
  let registerBuildingRoutes: any;
  let eq: any, and: any, inArray: any;

  // Track every row this suite creates so afterAll can clean up even on
  // partial failures. Keyed by table name -> set of ids.
  const created: Record<string, Set<string>> = {
    userResidences: new Set(),
    residences: new Set(),
    buildings: new Set(),
    organizations: new Set(),
    users: new Set(),
  };

  async function seedFixture() {
    const orgId = crypto.randomUUID();
    const buildingId = crypto.randomUUID();
    const residenceId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const activeLinkId = crypto.randomUUID();
    const historicalLinkId = crypto.randomUUID();

    await db.insert(schema.organizations).values({
      id: orgId,
      name: `${TEST_TAG} org ${orgId.slice(0, 8)}`,
      type: 'syndicate',
      address: '1 Test',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
    });
    created.organizations.add(orgId);

    await db.insert(schema.buildings).values({
      id: buildingId,
      organizationId: orgId,
      name: `${TEST_TAG} bldg`,
      address: '1 Test',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
      buildingType: 'condo',
      totalUnits: 1,
      isActive: true,
    });
    created.buildings.add(buildingId);

    await db.insert(schema.residences).values({
      id: residenceId,
      buildingId,
      unitNumber: '101',
      isActive: true,
    });
    created.residences.add(residenceId);

    await db.insert(schema.users).values({
      id: userId,
      username: `${TEST_TAG}-${userId.slice(0, 8)}`,
      email: `${userId}@task149.test`,
      password: 'x',
      firstName: 'T',
      lastName: 'U',
      role: 'tenant',
      isActive: true,
    });
    created.users.add(userId);

    // Active link: starts today, no endDate.
    await db.insert(schema.userResidences).values({
      id: activeLinkId,
      userId,
      residenceId,
      relationshipType: 'tenant',
      startDate: new Date().toISOString().split('T')[0],
      endDate: null,
      isActive: true,
    });
    created.userResidences.add(activeLinkId);

    // Historical link on the SAME residence — already inactive with a
    // fixed endDate. The contract under test is: production code MUST
    // NOT clobber this endDate when ending the active link.
    await db.insert(schema.userResidences).values({
      id: historicalLinkId,
      userId,
      residenceId,
      relationshipType: 'tenant',
      startDate: '2019-01-01',
      endDate: HISTORICAL_END_DATE,
      isActive: false,
    });
    created.userResidences.add(historicalLinkId);

    return { orgId, buildingId, residenceId, userId, activeLinkId, historicalLinkId };
  }

  async function fetchLink(id: string) {
    const rows = await db
      .select({
        id: schema.userResidences.id,
        isActive: schema.userResidences.isActive,
        endDate: schema.userResidences.endDate,
      })
      .from(schema.userResidences)
      .where(eq(schema.userResidences.id, id))
      .limit(1);
    return rows[0];
  }

  function todayIso() {
    return new Date().toISOString().split('T')[0];
  }

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';

    // Use require() so DATABASE_URL is set before server/db is evaluated.
    // Do NOT call jest.resetModules() — that would force drizzle-orm to
    // re-evaluate and create fresh internal Symbols, which then don't
    // match the table metadata captured at schema-module load time.
    db = require('../../server/db').db;
    schema = require('@shared/schema');
    ops = require('../../server/api/buildings/operations');
    ({ registerBuildingRoutes } = require('../../server/api/buildings'));
    ({ eq, and, inArray } = require('drizzle-orm'));
    if (!schema.organizations) {
      throw new Error('schema.organizations is undefined — module resolution broken');
    }

    // Task #152 switched server/db.ts to drizzle-orm/neon-serverless,
    // which DOES support real transactions. The previous neon-http
    // shim is no longer required.
  }, 60000);

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;
    // Best-effort cleanup in FK-safe order.
    if (created.userResidences.size) {
      await db.delete(schema.userResidences).where(
        inArray(schema.userResidences.id, [...created.userResidences])
      );
    }
    if (created.residences.size) {
      await db.delete(schema.residences).where(
        inArray(schema.residences.id, [...created.residences])
      );
    }
    if (created.buildings.size) {
      await db.delete(schema.buildings).where(
        inArray(schema.buildings.id, [...created.buildings])
      );
    }
    if (created.organizations.size) {
      await db.delete(schema.organizations).where(
        inArray(schema.organizations.id, [...created.organizations])
      );
    }
    if (created.users.size) {
      await db.delete(schema.users).where(
        inArray(schema.users.id, [...created.users])
      );
    }
  }, 60000);

  it('deleteSelectedResidences ends active link AND preserves historical endDate', async () => {
    const { residenceId, activeLinkId, historicalLinkId } = await seedFixture();

    await ops.deleteSelectedResidences(
      // buildingId not strictly required for the userResidences UPDATE
      // path, but the function signature wants it.
      [...created.buildings].slice(-1)[0],
      [residenceId],
      'admin'
    );

    const active = await fetchLink(activeLinkId);
    const historical = await fetchLink(historicalLinkId);

    // Active link: ended today.
    expect(active.isActive).toBe(false);
    expect(active.endDate).toBe(todayIso());

    // Historical link: endDate UNCHANGED.
    expect(historical.isActive).toBe(false);
    expect(historical.endDate).toBe(HISTORICAL_END_DATE);
  }, 30000);

  it('cascadeDeleteBuilding ends active link AND preserves historical endDate', async () => {
    const { buildingId, activeLinkId, historicalLinkId } = await seedFixture();

    await ops.cascadeDeleteBuilding(buildingId);

    const active = await fetchLink(activeLinkId);
    const historical = await fetchLink(historicalLinkId);

    expect(active.isActive).toBe(false);
    expect(active.endDate).toBe(todayIso());
    expect(historical.isActive).toBe(false);
    expect(historical.endDate).toBe(HISTORICAL_END_DATE);
  }, 30000);

  it('DELETE /api/admin/buildings/:id/cascade ends active link AND preserves historical endDate', async () => {
    const { buildingId, activeLinkId, historicalLinkId } = await seedFixture();

    // Mock requireAuth to inject an admin user for this route.
    jest.doMock('../../server/auth', () => ({
      requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'task149-admin', role: 'admin' };
        next();
      },
    }));
    jest.resetModules();

    // Re-require everything in this isolated module graph so the mocked
    // requireAuth is wired through. We use require() (CJS) instead of
    // dynamic import() because ts-jest's ESM interop returns a wrapped
    // namespace where re-exported tables come back undefined.
    const isolatedDb = require('../../server/db').db;
    const isolatedSchema = require('@shared/schema');
    const { eq: isoEq } = require('drizzle-orm');
    const { registerBuildingRoutes: isoRegister } = require(
      '../../server/api/buildings'
    );

    // Task #152 switched the driver to neon-serverless; transactions
    // are real. No shim needed.

    const express = require('express');
    const supertest = require('supertest');

    const app = express();
    app.use(express.json());
    isoRegister(app);

    const res = await supertest(app)
      .delete(`/api/admin/buildings/${buildingId}/cascade`)
      .send();
    expect(res.status).toBe(200);

    // Verify against the real DB through the isolated db instance.
    const activeRows = await isolatedDb
      .select({
        isActive: isolatedSchema.userResidences.isActive,
        endDate: isolatedSchema.userResidences.endDate,
      })
      .from(isolatedSchema.userResidences)
      .where(isoEq(isolatedSchema.userResidences.id, activeLinkId))
      .limit(1);
    const historicalRows = await isolatedDb
      .select({
        isActive: isolatedSchema.userResidences.isActive,
        endDate: isolatedSchema.userResidences.endDate,
      })
      .from(isolatedSchema.userResidences)
      .where(isoEq(isolatedSchema.userResidences.id, historicalLinkId))
      .limit(1);

    expect(activeRows[0].isActive).toBe(false);
    expect(activeRows[0].endDate).toBe(todayIso());
    expect(historicalRows[0].isActive).toBe(false);
    expect(historicalRows[0].endDate).toBe(HISTORICAL_END_DATE);

    jest.dontMock('../../server/auth');
  }, 30000);

  // Task #154: behavioural coverage for the FOURTH soft-end site
  // listed in the static-text guard
  // (`tests/unit/access-control/user-residences-active-rule.test.ts`):
  // the organization cascade-delete route. When an organization is
  // deleted, every active `user_residences` link tied to one of its
  // residences must be ended today, while already-ended historical
  // links keep their original `endDate`. A regression that drops the
  // `eq(userResidences.isActive, true)` filter on this UPDATE would
  // silently clobber historical end dates in production — this test
  // is the behavioural backstop for that regression.
  it('DELETE /api/organizations/:id ends active link AND preserves historical endDate', async () => {
    const { orgId, activeLinkId, historicalLinkId } = await seedFixture();

    // Mock requireAuth to inject an admin user for this route. Mirror
    // the isolated-module pattern used by the cascade-building test
    // above so the mocked auth middleware actually wires through.
    jest.doMock('../../server/auth', () => ({
      requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'task154-admin', role: 'admin' };
        next();
      },
    }));
    jest.resetModules();

    const isolatedDb = require('../../server/db').db;
    const isolatedSchema = require('@shared/schema');
    const { eq: isoEq } = require('drizzle-orm');
    const { registerOrganizationRoutes: isoRegister } = require(
      '../../server/api/organizations'
    );

    const express = require('express');
    const supertest = require('supertest');

    const app = express();
    app.use(express.json());
    isoRegister(app);

    const res = await supertest(app)
      .delete(`/api/organizations/${orgId}`)
      .send();
    expect(res.status).toBe(200);

    const activeRows = await isolatedDb
      .select({
        isActive: isolatedSchema.userResidences.isActive,
        endDate: isolatedSchema.userResidences.endDate,
      })
      .from(isolatedSchema.userResidences)
      .where(isoEq(isolatedSchema.userResidences.id, activeLinkId))
      .limit(1);
    const historicalRows = await isolatedDb
      .select({
        isActive: isolatedSchema.userResidences.isActive,
        endDate: isolatedSchema.userResidences.endDate,
      })
      .from(isolatedSchema.userResidences)
      .where(isoEq(isolatedSchema.userResidences.id, historicalLinkId))
      .limit(1);

    // Active link: ended today.
    expect(activeRows[0].isActive).toBe(false);
    expect(activeRows[0].endDate).toBe(todayIso());
    // Historical link: endDate UNCHANGED.
    expect(historicalRows[0].isActive).toBe(false);
    expect(historicalRows[0].endDate).toBe(HISTORICAL_END_DATE);

    jest.dontMock('../../server/auth');
  }, 30000);
});
