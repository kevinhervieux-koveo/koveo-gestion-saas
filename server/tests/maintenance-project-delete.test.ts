/**
 * @jest-environment node
 *
 * Integration tests for DELETE /api/maintenance/projects/:id (Task #919).
 *
 * These tests exercise the real HTTP route registered by
 * `registerMaintenanceRoutes` against the live Postgres DB captured in
 * `_INTEGRATION_DB_URL`, so they verify:
 *
 *   1. The route rejects tenant-role users (403).
 *   2. The route returns 404 for a non-existent project UUID.
 *   3. The route returns 403 when a manager has no building access.
 *   4. The route returns 200 and Postgres cascades all six ON DELETE CASCADE
 *      child tables: projectSteps, workflowTasks, projectNotifications,
 *      submissionVendors, projectElements, elementProjectUpdates.
 *   5. The route returns 200 and Postgres sets evaluationSuggestions.projectId
 *      to NULL (ON DELETE SET NULL) rather than deleting the suggestion row.
 *
 * Auth uses the `x-test-user-id` header path that `requireAuth` in
 * server/auth.ts enables when NODE_ENV=test. This path calls
 * `storage.getUser(userId)`, so both requireAuth and the route's
 * `checkBuildingAccess` helper use the fresh real-DB connection obtained
 * after `jest.resetModules()` clears the module cache.
 *
 * Tests skip automatically when `_INTEGRATION_DB_URL` is absent (unit tier).
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import supertest from 'supertest';
import express from 'express';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import type * as SchemaImport from '@shared/schema';
import type { RouteRegistry } from '../utils/lazy-mount';

type Schema = typeof SchemaImport;
type Db = NeonDatabase<Schema>;

// ── Service mocks ────────────────────────────────────────────────────────────
// These are hoisted by jest and applied even after jest.resetModules(), so
// the fresh maintenance module still gets inert stubs for external services.
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

// ── DB availability guard ────────────────────────────────────────────────────
const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

describeIfDb('DELETE /api/maintenance/projects/:id — integration (real Postgres)', () => {
  const runId = randomUUID().slice(0, 8);
  let db: Db;
  let schema: Schema;
  let request: ReturnType<typeof supertest>;

  let orgId: string;
  let buildingId: string;
  let adminUserId: string;
  let managerUserId: string;
  let tenantUserId: string;
  let uniformatCode: string;
  let createdOrgHere = false;
  let createdUniformatHere = false;

  beforeAll(async () => {
    if (!REAL_DB_URL) return;

    // Set the real DB URL BEFORE jest.resetModules() so all subsequently
    // required modules (db, storage, auth, maintenance) share the same
    // real Postgres pool. jest.resetModules() clears the module registry
    // but NOT the mock registry, so jest.mock() factories above still apply.
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    process.env.NODE_ENV = 'test';

    jest.resetModules();

    db = (require('../db') as { db: Db }).db;
    schema = require('@shared/schema') as Schema;

    // Reuse or create an organization
    const [existingOrg] = await db
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(eq(schema.organizations.name, 'Open Demo'))
      .limit(1);

    if (existingOrg) {
      orgId = existingOrg.id;
    } else {
      const [created] = await db
        .insert(schema.organizations)
        .values({
          name: `del-integ-org-${runId}`,
          type: 'demo',
          address: '1 Test St',
          city: 'Montreal',
          province: 'QC',
          postalCode: 'H1A1A1',
          isActive: true,
        })
        .returning({ id: schema.organizations.id });
      orgId = created.id;
      createdOrgHere = true;
    }

    // Test building
    const [bldg] = await db
      .insert(schema.buildings)
      .values({
        organizationId: orgId,
        name: `del-integ-bldg-${runId}`,
        address: '100 Integration Ave',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H2B2B2',
        buildingType: 'apartment',
        totalUnits: 4,
        totalFloors: 2,
        isActive: true,
      })
      .returning({ id: schema.buildings.id });
    buildingId = bldg.id;

    // Three users with different roles
    const [adminRow] = await db
      .insert(schema.users)
      .values({
        email: `del-integ-admin-${runId}@koveo.test`,
        username: `del-integ-admin-${runId}`,
        password: 'x',
        firstName: 'Admin',
        lastName: 'IntegTest',
        role: 'admin',
        isActive: true,
      })
      .returning({ id: schema.users.id });
    adminUserId = adminRow.id;

    const [mgrRow] = await db
      .insert(schema.users)
      .values({
        email: `del-integ-mgr-${runId}@koveo.test`,
        username: `del-integ-mgr-${runId}`,
        password: 'x',
        firstName: 'Mgr',
        lastName: 'IntegTest',
        role: 'manager',
        isActive: true,
      })
      .returning({ id: schema.users.id });
    managerUserId = mgrRow.id;

    const [tenantRow] = await db
      .insert(schema.users)
      .values({
        email: `del-integ-tenant-${runId}@koveo.test`,
        username: `del-integ-tenant-${runId}`,
        password: 'x',
        firstName: 'Tenant',
        lastName: 'IntegTest',
        role: 'tenant',
        isActive: true,
      })
      .returning({ id: schema.users.id });
    tenantUserId = tenantRow.id;

    // Give the admin and manager access to the test building
    await db.insert(schema.userBuildings).values([
      { userId: adminUserId, buildingId, relationshipType: 'owner', isActive: true },
      { userId: managerUserId, buildingId, relationshipType: 'owner', isActive: true },
    ]);

    // Uniformat code — required FK target for buildingElements
    const [existingCode] = await db
      .select({ code: schema.uniformatCodes.code })
      .from(schema.uniformatCodes)
      .limit(1);

    if (existingCode) {
      uniformatCode = existingCode.code;
    } else {
      const code = `T919-${runId.slice(0, 4)}`;
      await db.insert(schema.uniformatCodes).values({
        code,
        level: 1,
        nameFr: 'Test',
        nameEn: 'Test',
      });
      uniformatCode = code;
      createdUniformatHere = true;
    }

    // Build Express app using freshly-required maintenance routes.
    // All transitive requires (db, storage, auth) now share the real-DB pool.
    const app = express();
    app.use(express.json());
    const { registerMaintenanceRoutes } = require('../api/maintenance') as {
      registerMaintenanceRoutes: (r: RouteRegistry) => void;
    };
    registerMaintenanceRoutes(app as RouteRegistry);
    request = supertest(app);
  });

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;
    for (const uid of [adminUserId, managerUserId, tenantUserId]) {
      if (uid) {
        await db.delete(schema.userBuildings).where(eq(schema.userBuildings.userId, uid));
        await db.delete(schema.userOrganizations).where(eq(schema.userOrganizations.userId, uid));
        await db.delete(schema.users).where(eq(schema.users.id, uid));
      }
    }
    if (buildingId) await db.delete(schema.buildings).where(eq(schema.buildings.id, buildingId));
    if (createdOrgHere && orgId) await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId));
    if (createdUniformatHere && uniformatCode) {
      await db.delete(schema.uniformatCodes).where(eq(schema.uniformatCodes.code, uniformatCode));
    }
  });

  async function seedProject(num: string): Promise<string> {
    const [proj] = await db
      .insert(schema.maintenanceProjects)
      .values({
        buildingId,
        projectNumber: `T919-${runId}-${num}`,
        title: `Integration Test Project ${num}`,
        type: 'replacement',
        origin: 'manual',
        status: 'planned',
        priority: 'medium',
        createdBy: adminUserId,
        isQuickProject: false,
        skipSubmission: false,
        skipPreWork: false,
        skipInProgress: false,
        skipPostWork: false,
      })
      .returning({ id: schema.maintenanceProjects.id });
    return proj.id;
  }

  it('returns 403 for tenant role', async () => {
    const projectId = await seedProject('403t');
    try {
      const res = await request
        .delete(`/api/maintenance/projects/${projectId}`)
        .set('x-test-user-id', tenantUserId);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/permissions/i);
    } finally {
      await db.delete(schema.maintenanceProjects).where(eq(schema.maintenanceProjects.id, projectId));
    }
  });

  it('returns 404 when the project does not exist', async () => {
    const res = await request
      .delete(`/api/maintenance/projects/${randomUUID()}`)
      .set('x-test-user-id', adminUserId);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Project not found');
  });

  it('returns 403 when manager has no access to the project building', async () => {
    const [otherOrg] = await db
      .insert(schema.organizations)
      .values({
        name: `del-integ-other-${runId}`,
        type: 'demo',
        address: '2 Other St',
        city: 'Quebec',
        province: 'QC',
        postalCode: 'H9Z9Z9',
        isActive: true,
      })
      .returning({ id: schema.organizations.id });

    const [otherBldg] = await db
      .insert(schema.buildings)
      .values({
        organizationId: otherOrg.id,
        name: `del-integ-other-bldg-${runId}`,
        address: '2 Other Ave',
        city: 'Quebec',
        province: 'QC',
        postalCode: 'H9Z9Z9',
        buildingType: 'condo',
        totalUnits: 2,
        totalFloors: 1,
        isActive: true,
      })
      .returning({ id: schema.buildings.id });

    const [proj] = await db
      .insert(schema.maintenanceProjects)
      .values({
        buildingId: otherBldg.id,
        projectNumber: `T919-${runId}-403m`,
        title: 'No Access Project',
        type: 'replacement',
        origin: 'manual',
        status: 'planned',
        priority: 'medium',
        createdBy: adminUserId,
        isQuickProject: false,
        skipSubmission: false,
        skipPreWork: false,
        skipInProgress: false,
        skipPostWork: false,
      })
      .returning({ id: schema.maintenanceProjects.id });

    try {
      const res = await request
        .delete(`/api/maintenance/projects/${proj.id}`)
        .set('x-test-user-id', managerUserId);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('No access to this project');
    } finally {
      await db.delete(schema.maintenanceProjects).where(eq(schema.maintenanceProjects.id, proj.id));
      await db.delete(schema.buildings).where(eq(schema.buildings.id, otherBldg.id));
      await db.delete(schema.organizations).where(eq(schema.organizations.id, otherOrg.id));
    }
  });

  it('deletes the project and cascades all six ON DELETE CASCADE child tables', async () => {
    const projectId = await seedProject('cascade');

    // Seed one row in every CASCADE child table
    await db.insert(schema.projectSteps).values({
      projectId,
      stepType: 'submission',
      isRequired: true,
      status: 'pending',
    });

    await db.insert(schema.workflowTasks).values({
      projectId,
      phase: 'pre_work',
      taskName: 'Integration test task',
      orderIndex: 1,
      isCompleted: false,
    });

    await db.insert(schema.projectNotifications).values({
      projectId,
      messageText: 'Test notification',
      timingType: 'one_week_before',
      isSent: false,
    });

    await db.insert(schema.submissionVendors).values({
      projectId,
      vendorName: 'Test Vendor',
      projectType: 'replacement',
      isSelected: false,
      preferred: false,
    });

    const [element] = await db
      .insert(schema.buildingElements)
      .values({
        buildingId,
        uniformatCode,
        name: `del-integ-elem-${runId}`,
        currentCondition: 'good',
        isActive: true,
      })
      .returning({ id: schema.buildingElements.id });

    await db.insert(schema.projectElements).values({
      projectId,
      elementId: element.id,
      confirmed: false,
    });

    await db.insert(schema.elementProjectUpdates).values({
      projectId,
      elementId: element.id,
      updateStatus: 'replace',
    });

    const rowCount = async (
      table: 'steps' | 'tasks' | 'notifs' | 'vendors' | 'elems' | 'updates',
    ) =>
      ({
        steps: () => db.select().from(schema.projectSteps).where(eq(schema.projectSteps.projectId, projectId)),
        tasks: () => db.select().from(schema.workflowTasks).where(eq(schema.workflowTasks.projectId, projectId)),
        notifs: () => db.select().from(schema.projectNotifications).where(eq(schema.projectNotifications.projectId, projectId)),
        vendors: () => db.select().from(schema.submissionVendors).where(eq(schema.submissionVendors.projectId, projectId)),
        elems: () => db.select().from(schema.projectElements).where(eq(schema.projectElements.projectId, projectId)),
        updates: () => db.select().from(schema.elementProjectUpdates).where(eq(schema.elementProjectUpdates.projectId, projectId)),
      }[table]().then((rows) => rows.length));

    expect(await rowCount('steps')).toBe(1);
    expect(await rowCount('tasks')).toBe(1);
    expect(await rowCount('notifs')).toBe(1);
    expect(await rowCount('vendors')).toBe(1);
    expect(await rowCount('elems')).toBe(1);
    expect(await rowCount('updates')).toBe(1);

    const res = await request
      .delete(`/api/maintenance/projects/${projectId}`)
      .set('x-test-user-id', adminUserId);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const projectAfter = await db
      .select({ id: schema.maintenanceProjects.id })
      .from(schema.maintenanceProjects)
      .where(eq(schema.maintenanceProjects.id, projectId));
    expect(projectAfter.length).toBe(0);

    expect(await rowCount('steps')).toBe(0);
    expect(await rowCount('tasks')).toBe(0);
    expect(await rowCount('notifs')).toBe(0);
    expect(await rowCount('vendors')).toBe(0);
    expect(await rowCount('elems')).toBe(0);
    expect(await rowCount('updates')).toBe(0);

    await db.delete(schema.buildingElements).where(eq(schema.buildingElements.id, element.id));
  });

  it('sets evaluationSuggestions.projectId to NULL (ON DELETE SET NULL) after project delete', async () => {
    const projectId = await seedProject('setnull');

    const { evaluationSuggestions } = require('@shared/schemas/maintenance') as {
      evaluationSuggestions: (typeof schema)['evaluationSuggestions'];
    };

    const [element] = await db
      .insert(schema.buildingElements)
      .values({
        buildingId,
        uniformatCode,
        name: `del-integ-elem-setnull-${runId}`,
        currentCondition: 'good',
        isActive: true,
      })
      .returning({ id: schema.buildingElements.id });

    const [suggestion] = await db
      .insert(evaluationSuggestions)
      .values({
        elementId: element.id,
        suggestedDate: '2026-01-01',
        suggestedType: 'replacement',
        reason: 'Integration test suggestion',
        priority: 'medium',
        projectId,
      })
      .returning({ id: evaluationSuggestions.id });

    try {
      const res = await request
        .delete(`/api/maintenance/projects/${projectId}`)
        .set('x-test-user-id', adminUserId);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const [afterDelete] = await db
        .select({ id: evaluationSuggestions.id, projectId: evaluationSuggestions.projectId })
        .from(evaluationSuggestions)
        .where(eq(evaluationSuggestions.id, suggestion.id));

      expect(afterDelete).toBeDefined();
      expect(afterDelete.projectId).toBeNull();
    } finally {
      await db.delete(evaluationSuggestions).where(eq(evaluationSuggestions.id, suggestion.id));
      await db.delete(schema.buildingElements).where(eq(schema.buildingElements.id, element.id));
    }
  });
});
