/**
 * @jest-environment node
 *
 * Real-Postgres integration test for the MCP-manager seed contract added in
 * Task #963 and pinned here by Task #969.
 *
 * Task #963 grants the seeded `mcp-manager@koveo-mcp.test` user
 * `user_buildings` access to all 3 MCP-scoped buildings (Résidence du Parc,
 * Les Terrasses MCP, Condo Vieux-Québec) so manager-only flows that consult
 * `user_buildings` work end-to-end without an admin co-pilot. Without an
 * automated check it would be easy to regress the seed (dropping the
 * `userBuildings` inserts, flipping `relationshipType` to a value the API
 * treats as inactive, or breaking the cascade from `userOrganizations` ->
 * `userBuildings`) and only notice when a downstream manager-scoped e2e
 * starts failing again.
 *
 * This suite locks in three things end-to-end:
 *
 *   1. The underlying `user_buildings` rows for the seeded manager are
 *      `isActive=true` and use `relationshipType='manager'` for all 3
 *      MCP buildings (the contract the seed promises and that the
 *      `/me/buildings` handler relies on).
 *   2. `GET /api/users/me/buildings`, signed in as the seeded MCP manager,
 *      returns exactly the 3 MCP buildings, all with `isActive=true`.
 *   3. `POST /api/maintenance/projects` for one of those buildings
 *      succeeds end-to-end (201). This exercises the same
 *      `checkBuildingAccess` helper in `server/api/maintenance.ts` that
 *      Task #963 unblocked, proving the manager really can drive a
 *      manager-only write flow with no admin involvement.
 *
 * ──── Test isolation philosophy ────────────────────────────────────────────
 * This suite intentionally does NOT mutate the shared MCP sandbox. It
 * relies on `seedMcpData()` (which is idempotent — the "MCP-1 already
 * exists" sentinel makes re-runs no-ops) to make sure the contract is
 * present on a fresh DB, and on a small read-only assertion to fail
 * loudly with developer-actionable instructions when it isn't (e.g.
 * a dev DB still holding pre-Task #963 MCP data). Avoiding cross-suite
 * deletes keeps parallel jest workers from racing each other on the
 * shared sandbox; the only writes this suite makes are the
 * `maintenance_projects` rows it creates itself, which `afterAll`
 * cleans up.
 *
 * ──── Why we set `req.user` in our own middleware ─────────────────────────
 * `jest.config.cjs` redirects `'../auth'` (and friends) via
 * `moduleNameMapper` to `__mocks__/server/auth.ts`, whose `requireAuth` is
 * a no-op middleware that does NOT set `req.user`. That mock cannot be
 * disabled per-suite (moduleNameMapper resolves before `jest.unmock`).
 * Because every protected route calls `requireAuth` first and then reads
 * `req.user`, any integration test of a protected route has to inject
 * `req.user` itself. We do that by registering a tiny middleware BEFORE
 * the route bundles: it reads `x-test-user-id`, looks the user up in the
 * REAL Postgres pool we just connected to, and attaches a
 * `{ ...user, organizations, canAccessAllOrganizations }` value typed as
 * the same `AuthenticatedUser`-compatible shape the real `requireAuth`
 * produces in `server/auth.ts`. The mocked `requireAuth` then runs as a
 * noop and the handler sees a fully populated `req.user`.
 *
 * Skipped cleanly when `_INTEGRATION_DB_URL` is not set so unit-tier runs
 * stay green. The env var is captured from the original `DATABASE_URL` in
 * `jest.polyfills.js` before `jest.setup.simple.ts` overwrites it with a
 * placeholder, mirroring `mcp-property-update-integration.test.ts` and
 * `maintenance-project-delete.test.ts`.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { and, eq, inArray } from 'drizzle-orm';
import supertest from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import type * as SchemaImport from '@shared/schema';
import type { User } from '@shared/schemas/core';
import type { RouteRegistry } from '../utils/lazy-mount';

type Schema = typeof SchemaImport;
type Db = NeonDatabase<Schema>;

/**
 * The shape `server/auth.ts`'s real `requireAuth` attaches to `req.user`:
 * every column of the `users` row plus the derived organization scope.
 * We re-state it here (rather than importing `AuthenticatedUser`, which
 * is a non-exported local interface in `server/auth.ts`) because the
 * global Express augmentation already declares `req.user` as compatible
 * with this shape — see the `declare global { namespace Express ... }`
 * block at the bottom of `server/auth.ts`.
 */
type TestRequestUser = User & {
  organizations: string[];
  canAccessAllOrganizations: boolean;
};

// ── Service mocks ────────────────────────────────────────────────────────────
// Hoisted by jest and applied even after jest.resetModules(). Mirrors the
// stubs in `maintenance-project-delete.test.ts` so the freshly required
// maintenance/users modules get inert dependencies for everything we are not
// exercising here.
jest.mock('../services/document-service', () => ({
  documentService: {
    getDocuments: jest.fn().mockResolvedValue([]),
    getUploadUrl: jest.fn().mockResolvedValue({ success: true, uploadUrl: '', filePath: '' }),
    confirmUpload: jest.fn().mockResolvedValue({ id: 'doc-1' }),
    normalizePath: jest.fn((p: string) => p),
  },
  DocumentService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../objectStorage', () => ({
  ObjectStorageService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../services/consolidated-ai-service', () => ({
  aiService: {
    analyzeDocument: jest.fn().mockResolvedValue({ status: 'pending' }),
    getAnalysisStatus: jest.fn().mockResolvedValue({ status: 'complete' }),
  },
}));

jest.mock('../services/secure-file-storage', () => ({
  secureFileStorage: {
    getSignedDownloadUrl: jest.fn().mockResolvedValue('https://example.com/signed'),
    deleteObject: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../services/workflow-service', () => ({
  workflowService: {
    getWorkflowState: jest.fn().mockResolvedValue(null),
    advanceWorkflow: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../jobs/maintenanceJobs', () => ({
  maintenanceJobsScheduler: { start: jest.fn(), stop: jest.fn() },
}));

jest.mock('../services/project-payment-service', () => ({
  projectPaymentService: {
    getProjectPayments: jest.fn().mockResolvedValue([]),
    createPayment: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../services/maintenanceSuggestionService', () => ({
  maintenanceSuggestionService: {
    getSuggestions: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../services/email-service', () => ({
  emailService: {
    sendInvitationEmail: jest.fn().mockResolvedValue({ success: true }),
    sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
  },
}));

// ── DB availability guard ────────────────────────────────────────────────────
const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

// The names the seed creates in `server/mcp/seed-mcp-data.ts`. This test
// pins the EXACT three buildings the seed promises so a regression that
// drops one of them (or names it differently) is caught immediately.
const EXPECTED_BUILDING_NAMES = [
  'Résidence du Parc',
  'Les Terrasses MCP',
  'Condo Vieux-Québec',
] as const;

const STALE_SANDBOX_HINT = [
  'MCP sandbox does not match Task #963 contract.',
  'The seeded `mcp-manager@koveo-mcp.test` user is missing one or more of',
  'the expected `user_buildings` rows (relationshipType=manager, isActive=true)',
  'for the 3 MCP buildings.',
  '',
  'This usually means the dev DB still holds pre-Task #963 MCP data and the',
  'idempotent `seedMcpData()` short-circuit prevents the new inserts from running.',
  'To fix, drop the MCP-1/MCP-2 organizations and the `mcp-*@koveo-mcp.test`',
  'users (a small reset script is appropriate here — see follow-up #1028)',
  'and let the next app start re-seed from scratch.',
].join('\n');

describeIfDb('MCP manager seed contract — manager-only flows end-to-end', () => {
  const runId = randomUUID().slice(0, 8);
  let db: Db;
  let schema: Schema;
  let request: ReturnType<typeof supertest>;

  let managerUserId: string;
  // Track only what this suite creates so afterAll never touches rows the
  // shared sandbox owns. Keeps the suite safe to run alongside other
  // integration suites that share the MCP fixtures.
  const createdProjectIds: string[] = [];

  beforeAll(async () => {
    if (!REAL_DB_URL) return;

    // Switch to real Postgres BEFORE resetModules so every subsequently
    // required module (db, storage, auth, users, maintenance, seed) shares
    // the same pool. resetModules clears the module registry but NOT the
    // mock registry, so the jest.mock factories above still apply.
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    process.env.NODE_ENV = 'test';

    jest.resetModules();

    db = (require('../db') as { db: Db }).db;
    schema = require('@shared/schema') as Schema;

    // Idempotent: short-circuits if MCP-1 already exists. On a fresh CI DB
    // this seeds from scratch; on a dev DB with the contract already in
    // place it is a no-op. We deliberately do NOT tear anything down — see
    // "Test isolation philosophy" at the top of this file.
    const { seedMcpData } = require('../mcp/seed-mcp-data') as {
      seedMcpData: () => Promise<void>;
    };
    await seedMcpData();

    const [manager] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, 'mcp-manager@koveo-mcp.test'));
    if (!manager) {
      throw new Error(
        `mcp-manager@koveo-mcp.test was not present after seedMcpData(). ${STALE_SANDBOX_HINT}`,
      );
    }
    managerUserId = manager.id;

    // Build the test app. The mocked `requireAuth` (see jest.config.cjs's
    // moduleNameMapper) is a no-op middleware that does NOT populate
    // `req.user`, so we register our own auth-injecting middleware FIRST.
    // It reads `x-test-user-id`, queries the real DB for the user, and
    // attaches a `TestRequestUser` shape compatible with the global
    // Express.Request.user augmentation declared in `server/auth.ts`.
    const app = express();
    app.use(express.json());
    app.use(async (req: Request, _res: Response, next: NextFunction) => {
      const userId = req.headers['x-test-user-id'];
      if (typeof userId !== 'string' || userId.length === 0) {
        return next();
      }
      try {
        const [user] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, userId));
        if (!user) {
          return next();
        }
        const userOrganizations = await db
          .select({
            organizationId: schema.userOrganizations.organizationId,
            canAccessAllOrganizations: schema.userOrganizations.canAccessAllOrganizations,
          })
          .from(schema.userOrganizations)
          .where(
            and(
              eq(schema.userOrganizations.userId, user.id),
              eq(schema.userOrganizations.isActive, true),
            ),
          );
        // Mirror the shape produced by the real `requireAuth` in
        // `server/auth.ts`: spread the full user row (including
        // `password`, which the global `Express.Request.user`
        // augmentation requires) and tack on the derived org scope.
        // This matches the augmented type exactly, so no `any` cast is
        // needed.
        const authenticatedUser: TestRequestUser = {
          ...user,
          organizations: userOrganizations.map((uo) => uo.organizationId),
          canAccessAllOrganizations: userOrganizations.some(
            (uo) => uo.canAccessAllOrganizations,
          ),
        };
        req.user = authenticatedUser;
        return next();
      } catch (err) {
        return next(err as Error);
      }
    });

    const { registerUserRoutes } = require('../api/users') as {
      registerUserRoutes: (a: express.Express) => void;
    };
    const { registerMaintenanceRoutes } = require('../api/maintenance') as {
      registerMaintenanceRoutes: (r: RouteRegistry) => void;
    };
    registerUserRoutes(app);
    registerMaintenanceRoutes(app as RouteRegistry);

    request = supertest(app);
  }, 120000);

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;
    // Only remove what this suite created. The seed rows (orgs, users,
    // buildings, residences, etc.) belong to the shared sandbox and are
    // re-used by other suites — we never touch them.
    if (createdProjectIds.length > 0) {
      await db
        .delete(schema.maintenanceProjects)
        .where(inArray(schema.maintenanceProjects.id, createdProjectIds));
    }
  }, 30000);

  it('seeds user_buildings with isActive=true + relationshipType=manager for all 3 MCP buildings', async () => {
    // Pull the buildings the seed creates so we can match by id.
    const seededBuildings = await db
      .select({ id: schema.buildings.id, name: schema.buildings.name })
      .from(schema.buildings)
      .where(inArray(schema.buildings.name, EXPECTED_BUILDING_NAMES as unknown as string[]));

    if (seededBuildings.length !== EXPECTED_BUILDING_NAMES.length) {
      throw new Error(`${STALE_SANDBOX_HINT}\n\nFound buildings: ${JSON.stringify(seededBuildings)}`);
    }
    expect(seededBuildings.map((b) => b.name).sort()).toEqual(
      [...EXPECTED_BUILDING_NAMES].sort(),
    );

    const seededBuildingIds = seededBuildings.map((b) => b.id);

    // The contract under test: the seeded manager has an active manager
    // relationship with EVERY MCP building. If the seed regresses (insert
    // dropped, isActive flipped, relationshipType changed to a value the
    // /me/buildings handler ignores) this assertion fires first.
    const userBuildingsRows = await db
      .select({
        buildingId: schema.userBuildings.buildingId,
        relationshipType: schema.userBuildings.relationshipType,
        isActive: schema.userBuildings.isActive,
      })
      .from(schema.userBuildings)
      .where(
        and(
          eq(schema.userBuildings.userId, managerUserId),
          inArray(schema.userBuildings.buildingId, seededBuildingIds),
        ),
      );

    if (userBuildingsRows.length !== 3) {
      throw new Error(
        `${STALE_SANDBOX_HINT}\n\nFound user_buildings rows: ${JSON.stringify(userBuildingsRows)}`,
      );
    }
    for (const row of userBuildingsRows) {
      expect(row.isActive).toBe(true);
      expect(row.relationshipType).toBe('manager');
    }
  }, 30000);

  it('GET /api/users/me/buildings returns the 3 MCP buildings (isActive=true) for the seeded manager', async () => {
    const res = await request
      .get('/api/users/me/buildings')
      .set('x-test-user-id', managerUserId);

    if (res.status !== 200) {
      throw new Error(
        `Expected 200 from GET /api/users/me/buildings, got ${res.status}: ${JSON.stringify(res.body)}`,
      );
    }
    expect(Array.isArray(res.body)).toBe(true);

    // The endpoint resolves manager buildings from the userBuildings table
    // (server/api/users.ts). If Task #963's inserts are missing or marked
    // inactive, this comes back empty / partial.
    const returnedNames = (res.body as Array<{ name: string; isActive: boolean }>)
      .map((b) => b.name)
      .sort();
    expect(returnedNames).toEqual([...EXPECTED_BUILDING_NAMES].sort());

    for (const building of res.body as Array<{ isActive: boolean }>) {
      expect(building.isActive).toBe(true);
    }
  }, 30000);

  it('POST /api/maintenance/projects succeeds end-to-end as the seeded manager (no admin co-pilot)', async () => {
    // Pick an MCP-1 building (Résidence du Parc) the seeded manager has
    // userBuildings access to. checkBuildingAccess in
    // server/api/maintenance.ts only sees the manager as having access
    // when the seed contract is intact.
    const [target] = await db
      .select({ id: schema.buildings.id })
      .from(schema.buildings)
      .where(eq(schema.buildings.name, 'Résidence du Parc'));
    expect(target).toBeDefined();

    const projectNumber = `MCP-MGR-IT-${runId}`;
    const res = await request
      .post('/api/maintenance/projects')
      .set('x-test-user-id', managerUserId)
      .send({
        buildingId: target.id,
        projectNumber,
        title: `Manager seed contract test ${runId}`,
        type: 'repair',
        priority: 'medium',
        planningDescription:
          'Created by mcp-manager-seed-integration test to pin the Task #963 seed contract.',
      });

    if (res.status !== 201) {
      // Surface the server error envelope so a future regression points
      // straight at the failing layer (validation vs checkBuildingAccess
      // vs DB insert) instead of just "got 4xx/5xx".
      throw new Error(
        `Expected 201 from POST /api/maintenance/projects, got ${res.status}: ${JSON.stringify(res.body)}`,
      );
    }
    expect(res.body.success).toBe(true);
    expect(res.body.data?.buildingId).toBe(target.id);
    expect(res.body.data?.createdBy).toBe(managerUserId);
    expect(res.body.data?.projectNumber).toBe(projectNumber);

    if (res.body.data?.id) {
      createdProjectIds.push(res.body.data.id);
    }
  }, 30000);
});
