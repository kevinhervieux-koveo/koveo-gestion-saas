/**
 * @jest-environment node
 *
 * Task #183 — Verify the all-or-nothing safety nets that wrap the
 * invitation-accept flow, the `createBuilding` flow, and the three
 * user-assignment PUT endpoints (`/api/users/:id/organizations`,
 * `/api/users/:id/buildings`, `/api/users/:id/residences`).
 *
 * Each of these flows was recently rewritten to wrap its multi-table
 * writes inside a single `db.transaction(...)`. There are no targeted
 * tests today that prove a forced mid-flight failure actually triggers
 * the rollback, so a future refactor could quietly drop the `tx`
 * wrapper and nothing would catch it.
 *
 * Strategy: stand up the real Express app (auth + user routes) against
 * the real test database via `_INTEGRATION_DB_URL`, hit each route as
 * an authenticated user, and inject a failure inside the production
 * `db.transaction` by spying on `db.transaction` once per test. The
 * spy intercepts the `tx.insert(<target table>)` call on which the
 * route's reinsert / audit-log insert depends and throws. If the
 * production code ever stops sharing one transaction with that insert,
 * the database state assertions afterwards will catch it.
 *
 * Pattern mirrors `tests/integration/cross-organization-isolation.test.ts`
 * (real Express stack + supertest agents) and
 * `tests/integration/multi-table-write-rollback.test.ts` (skip suite
 * when `_INTEGRATION_DB_URL` is absent).
 */

// jest.config.cjs maps `./storage`, `./auth`, `./routes` (and the
// relative `../../server/...` variants) to in-repo unit-tier mocks.
// For this real-DB integration suite we MUST exercise the real
// implementations. Override the mocks at their resolved paths so jest
// substitutes the real modules.
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

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { eq, inArray } from 'drizzle-orm';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import * as schemaImport from '@shared/schema';

type Schema = typeof schemaImport;
type Db = NeonDatabase<Schema>;
type TxArg = Parameters<Parameters<Db['transaction']>[0]>[0];

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const TEST_TAG = 'task183-rollback';
const PASSWORD = 'Password!234';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

/**
 * Replace `db.transaction` for one call. The replacement runs the real
 * transaction but wraps the `tx` argument so that `tx.insert(failOn)`
 * throws. The localized casts below are unavoidable because we are
 * monkey-patching a method on a runtime object whose signature is
 * defined by drizzle as a generic overload.
 */
function injectTxInsertFailure(
  targetDb: Db,
  failOn: unknown,
  errorMsg: string,
): jest.SpiedFunction<Db['transaction']> {
  const realTransaction = targetDb.transaction.bind(targetDb);
  return jest
    .spyOn(targetDb, 'transaction')
    .mockImplementationOnce(((
      cb: (tx: TxArg) => Promise<unknown>,
      ...rest: unknown[]
    ) =>
      realTransaction(async (tx) => {
        const origInsert = tx.insert.bind(tx);
        (tx as { insert: TxArg['insert'] }).insert = ((
          table: Parameters<TxArg['insert']>[0],
        ) => {
          if (table === failOn) {
            throw new Error(errorMsg);
          }
          return origInsert(table);
        }) as TxArg['insert'];
        return cb(tx);
      }, ...(rest as []))) as Db['transaction']);
}

describeIfDb('all-or-nothing safety nets — Task #183', () => {
  let app: express.Application;
  let db: Db;
  let schema: Schema;
  let adminId: string;
  let adminEmail: string;

  const created: Record<string, Set<string>> = {
    invitationAuditLog: new Set(),
    invitations: new Set(),
    userBuildings: new Set(),
    userResidences: new Set(),
    userOrganizations: new Set(),
    residences: new Set(),
    buildings: new Set(),
    organizations: new Set(),
    users: new Set(),
  };

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    process.env.SESSION_SECRET =
      process.env.SESSION_SECRET || 'test-session-secret-task183';
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';

    db = require('../../server/db').db as Db;
    schema = require('@shared/schema') as Schema;
    const { setupAuthRoutes } = require('../../server/auth');
    const { registerUserRoutes } = require('../../server/api/users');

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
    setupAuthRoutes(app);
    registerUserRoutes(app);

    // Seed an admin so we can hit the privileged PUT endpoints with a
    // real session.
    adminId = crypto.randomUUID();
    adminEmail = `${adminId}@${TEST_TAG}-admin.test`;
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    await db.insert(schema.users).values({
      id: adminId,
      username: `${TEST_TAG}-admin-${adminId.slice(0, 8)}`,
      email: adminEmail,
      password: passwordHash,
      firstName: 'Adm',
      lastName: 'In',
      role: 'admin',
      isActive: true,
    });
    created.users.add(adminId);
  }, 60000);

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;
    if (created.invitationAuditLog.size) {
      await db
        .delete(schema.invitationAuditLog)
        .where(inArray(schema.invitationAuditLog.id, [...created.invitationAuditLog]));
    }
    if (created.invitations.size) {
      await db
        .delete(schema.invitations)
        .where(inArray(schema.invitations.id, [...created.invitations]));
    }
    if (created.userBuildings.size) {
      await db
        .delete(schema.userBuildings)
        .where(inArray(schema.userBuildings.id, [...created.userBuildings]));
    }
    if (created.userResidences.size) {
      await db
        .delete(schema.userResidences)
        .where(inArray(schema.userResidences.id, [...created.userResidences]));
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
      await db.delete(schema.buildings).where(inArray(schema.buildings.id, [...created.buildings]));
    }
    if (created.organizations.size) {
      await db
        .delete(schema.organizations)
        .where(inArray(schema.organizations.id, [...created.organizations]));
    }
    if (created.users.size) {
      await db.delete(schema.users).where(inArray(schema.users.id, [...created.users]));
    }
  }, 60000);

  // ---------- shared seed helpers ----------

  async function seedOrg(): Promise<string> {
    const orgId = crypto.randomUUID();
    await db.insert(schema.organizations).values({
      id: orgId,
      name: `${TEST_TAG} org ${orgId.slice(0, 8)}`,
      type: 'syndicate',
      address: '1 T',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
    });
    created.organizations.add(orgId);
    return orgId;
  }

  async function seedBuilding(orgId: string): Promise<string> {
    const buildingId = crypto.randomUUID();
    await db.insert(schema.buildings).values({
      id: buildingId,
      organizationId: orgId,
      name: `${TEST_TAG} bldg ${buildingId.slice(0, 8)}`,
      address: '1 T',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
      buildingType: 'condo',
      totalUnits: 1,
      isActive: true,
    });
    created.buildings.add(buildingId);
    return buildingId;
  }

  async function seedResidence(buildingId: string, unitNumber = '101'): Promise<string> {
    const residenceId = crypto.randomUUID();
    await db.insert(schema.residences).values({
      id: residenceId,
      buildingId,
      unitNumber,
      isActive: true,
    });
    created.residences.add(residenceId);
    return residenceId;
  }

  async function seedUser(role: 'tenant' | 'manager' | 'admin' = 'tenant'): Promise<string> {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: userId,
      username: `${TEST_TAG}-${userId.slice(0, 8)}`,
      email: `${userId}@${TEST_TAG}.test`,
      password: 'x',
      firstName: 'T',
      lastName: 'U',
      role,
      isActive: true,
    });
    created.users.add(userId);
    return userId;
  }

  async function loginAsAdmin() {
    const agent = request.agent(app);
    const res = await agent
      .post('/api/auth/login')
      .send({ email: adminEmail, password: PASSWORD });
    expect(res.status).toBe(200);
    return agent;
  }

  // ---------- 1. Invitation accept rollback (real route) ----------

  it('POST /api/invitations/accept/:token: audit-log failure rolls back user, org link, residence link, and invitation status', async () => {
    const orgId = await seedOrg();
    const buildingId = await seedBuilding(orgId);
    const residenceId = await seedResidence(buildingId, '201');
    const inviterId = await seedUser('admin');

    const invitationId = crypto.randomUUID();
    const inviteeEmail = `${invitationId}@${TEST_TAG}-invite.test`;
    const token = `${TEST_TAG}-token-${invitationId}`;
    await db.insert(schema.invitations).values({
      id: invitationId,
      organizationId: orgId,
      residenceId,
      email: inviteeEmail,
      token,
      tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
      role: 'tenant',
      status: 'pending',
      invitedByUserId: inviterId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    created.invitations.add(invitationId);

    // Inject failure on the audit-log insert inside the real
    // POST /api/invitations/accept/:token transaction. This is the
    // last write in the production sequence, so a successful rollback
    // must undo every preceding write (user, org link, residence link,
    // invitation status flip).
    const spy = injectTxInsertFailure(
      db,
      schema.invitationAuditLog,
      'injected audit-log insert failure',
    );

    let resStatus = 0;
    try {
      const res = await request(app)
        .post(`/api/invitations/accept/${token}`)
        .send({
          firstName: 'Acc',
          lastName: 'Eptee',
          password: PASSWORD,
          dataCollectionConsent: true,
          acknowledgedRights: true,
        });
      resStatus = res.status;
    } finally {
      spy.mockRestore();
    }
    // The route catches the thrown error and returns 500.
    expect(resStatus).toBe(500);

    // No orphan user row was created for the invitee.
    const userRows = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, inviteeEmail));
    expect(userRows).toHaveLength(0);

    // No organization assignment landed.
    const orgLinks = await db
      .select({ id: schema.userOrganizations.id })
      .from(schema.userOrganizations)
      .where(eq(schema.userOrganizations.organizationId, orgId));
    expect(orgLinks).toHaveLength(0);

    // No residence assignment landed.
    const resLinks = await db
      .select({ id: schema.userResidences.id })
      .from(schema.userResidences)
      .where(eq(schema.userResidences.residenceId, residenceId));
    expect(resLinks).toHaveLength(0);

    // Invitation must still be pending, untouched.
    const invRows = await db
      .select({
        status: schema.invitations.status,
        acceptedAt: schema.invitations.acceptedAt,
        acceptedBy: schema.invitations.acceptedBy,
      })
      .from(schema.invitations)
      .where(eq(schema.invitations.id, invitationId));
    expect(invRows).toHaveLength(1);
    expect(invRows[0].status).toBe('pending');
    expect(invRows[0].acceptedAt).toBeNull();
    expect(invRows[0].acceptedBy).toBeNull();

    // No audit row was persisted.
    const auditRows = await db
      .select({ id: schema.invitationAuditLog.id })
      .from(schema.invitationAuditLog)
      .where(eq(schema.invitationAuditLog.invitationId, invitationId));
    expect(auditRows).toHaveLength(0);
  }, 60000);

  // ---------- 2. createBuilding rollback (real function) ----------

  it('createBuilding: residence-generation failure leaves no building row behind', async () => {
    const orgId = await seedOrg();

    const spy = injectTxInsertFailure(
      db,
      schema.residences,
      'injected residence-insert failure',
    );

    try {
      const { createBuilding } = await import('../../server/api/buildings/operations');
      await expect(
        createBuilding({
          name: `${TEST_TAG} bldg-rollback`,
          address: '1 T',
          city: 'Montreal',
          province: 'QC',
          postalCode: 'H1A1A1',
          buildingType: 'condo',
          totalUnits: 3,
          totalFloors: 1,
          organizationId: orgId,
        }),
      ).rejects.toThrow('injected residence-insert failure');
    } finally {
      spy.mockRestore();
    }

    const buildingRows = await db
      .select({ id: schema.buildings.id })
      .from(schema.buildings)
      .where(eq(schema.buildings.organizationId, orgId));
    expect(buildingRows).toHaveLength(0);

    // Track anything that did leak so afterAll still cleans it up.
    for (const row of buildingRows) created.buildings.add(row.id);
  }, 60000);

  // ---------- 3. PUT /api/users/:id/organizations rollback (real route) ----------

  it('PUT /api/users/:id/organizations: failed reinsert leaves the previous assignment intact', async () => {
    const orgIdExisting = await seedOrg();
    const orgIdNew = await seedOrg();
    const userId = await seedUser('tenant');
    const existingLinkId = crypto.randomUUID();
    await db.insert(schema.userOrganizations).values({
      id: existingLinkId,
      userId,
      organizationId: orgIdExisting,
      organizationRole: 'tenant',
      isActive: true,
    });
    created.userOrganizations.add(existingLinkId);

    const agent = await loginAsAdmin();
    const spy = injectTxInsertFailure(
      db,
      schema.userOrganizations,
      'injected user_organizations reinsert failure',
    );

    let putStatus = 0;
    try {
      const res = await agent
        .put(`/api/users/${userId}/organizations`)
        .send({ organizationIds: [orgIdNew] });
      putStatus = res.status;
    } finally {
      spy.mockRestore();
    }
    expect(putStatus).toBe(500);

    const links = await db
      .select({
        id: schema.userOrganizations.id,
        organizationId: schema.userOrganizations.organizationId,
      })
      .from(schema.userOrganizations)
      .where(eq(schema.userOrganizations.userId, userId));
    expect(links).toHaveLength(1);
    expect(links[0].id).toBe(existingLinkId);
    expect(links[0].organizationId).toBe(orgIdExisting);
  }, 60000);

  // ---------- 4. PUT /api/users/:id/buildings rollback (real route) ----------

  it('PUT /api/users/:id/buildings: failed reinsert leaves the previous assignment intact', async () => {
    const orgId = await seedOrg();
    const buildingExisting = await seedBuilding(orgId);
    const buildingNew = await seedBuilding(orgId);
    const userId = await seedUser('manager');
    const existingLinkId = crypto.randomUUID();
    await db.insert(schema.userBuildings).values({
      id: existingLinkId,
      userId,
      buildingId: buildingExisting,
      relationshipType: 'manager',
      isActive: true,
    });
    created.userBuildings.add(existingLinkId);

    const agent = await loginAsAdmin();
    const spy = injectTxInsertFailure(
      db,
      schema.userBuildings,
      'injected user_buildings reinsert failure',
    );

    let putStatus = 0;
    try {
      const res = await agent
        .put(`/api/users/${userId}/buildings`)
        .send({ buildingIds: [buildingNew] });
      putStatus = res.status;
    } finally {
      spy.mockRestore();
    }
    expect(putStatus).toBe(500);

    const links = await db
      .select({
        id: schema.userBuildings.id,
        buildingId: schema.userBuildings.buildingId,
      })
      .from(schema.userBuildings)
      .where(eq(schema.userBuildings.userId, userId));
    expect(links).toHaveLength(1);
    expect(links[0].id).toBe(existingLinkId);
    expect(links[0].buildingId).toBe(buildingExisting);
  }, 60000);

  // ---------- 5. PUT /api/users/:id/residences rollback (real route) ----------

  it('PUT /api/users/:id/residences: failed reinsert leaves the previous assignment intact', async () => {
    const orgId = await seedOrg();
    const buildingId = await seedBuilding(orgId);
    const residenceExisting = await seedResidence(buildingId, '301');
    const residenceNew = await seedResidence(buildingId, '302');
    const userId = await seedUser('tenant');
    const existingLinkId = crypto.randomUUID();
    await db.insert(schema.userResidences).values({
      id: existingLinkId,
      userId,
      residenceId: residenceExisting,
      relationshipType: 'tenant',
      startDate: new Date().toISOString().split('T')[0],
      isActive: true,
    });
    created.userResidences.add(existingLinkId);

    const agent = await loginAsAdmin();
    const spy = injectTxInsertFailure(
      db,
      schema.userResidences,
      'injected user_residences reinsert failure',
    );

    let putStatus = 0;
    try {
      const res = await agent
        .put(`/api/users/${userId}/residences`)
        .send({
          residenceAssignments: [
            {
              residenceId: residenceNew,
              relationshipType: 'tenant',
              startDate: new Date().toISOString().split('T')[0],
            },
          ],
        });
      putStatus = res.status;
    } finally {
      spy.mockRestore();
    }
    expect(putStatus).toBe(500);

    const links = await db
      .select({
        id: schema.userResidences.id,
        residenceId: schema.userResidences.residenceId,
      })
      .from(schema.userResidences)
      .where(eq(schema.userResidences.userId, userId));
    expect(links).toHaveLength(1);
    expect(links[0].id).toBe(existingLinkId);
    expect(links[0].residenceId).toBe(residenceExisting);
  }, 60000);
});
