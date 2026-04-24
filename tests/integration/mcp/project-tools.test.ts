/**
 * @jest-environment node
 *
 * Task #315 — MCP integration coverage for the eight project assistant
 * tools registered in `server/mcp/server.ts`:
 *
 *   - list_projects             (read)
 *   - get_project               (read)
 *   - create_project            (write — admin/manager only)
 *   - update_project            (write — admin/manager only)
 *   - advance_project_status    (write — admin/manager only)
 *   - add_project_task          (write — admin/manager only)
 *   - update_project_task       (write — admin/manager only)
 *   - assign_project_vendor     (write — admin/manager only)
 *
 * Goal of this suite: exercise the happy-path end-to-end against a real
 * Postgres instance using the MCP-1 sandbox seed (`MCP_ORG_NAMES`), and
 * lock in two scope behaviours the mocked unit tests can only assert
 * indirectly:
 *
 *   1. A project whose building lives outside any MCP-scoped org is
 *      reported as access-denied for every tool that takes a
 *      `projectId` (or building-scoped equivalent).
 *   2. `advance_project_status` actually advances the row in the DB
 *      and stamps `actualStartDate` when reaching `in_progress`.
 *
 * Mirrors the harness in tests/integration/mcp/document-link-tools.test.ts
 * and is gated on `_INTEGRATION_DB_URL`.
 */

// Stub the heavy modules that server/mcp/server.ts imports at the top —
// the project tools never use them, but loading the real modules pulls
// in ESM-only `uuid` (via objectStorage / consolidated-ai-service)
// which the Jest CJS transformer cannot parse without extra config.
jest.mock('../../../server/services/document-service', () => ({
  DocumentService: class {},
}));
jest.mock('../../../server/objectStorage', () => ({
  ObjectStorageService: class {},
}));
jest.mock('../../../server/services/consolidated-ai-service', () => ({
  aiService: {
    analyzeDocument: jest.fn(),
    getAnalysisStatus: jest.fn(),
  },
}));

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import crypto from 'crypto';
import { eq, inArray } from 'drizzle-orm';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import * as schemaImport from '@shared/schema';

type Schema = typeof schemaImport;
type Db = NeonDatabase<Schema>;

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const TEST_TAG = 'task315-mcp-project-tools';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

interface ToolResult {
  content?: Array<{ type?: string; text?: string }>;
}

function getToolHandler(
  server: unknown,
  toolName: string,
): (args: Record<string, unknown>, extra?: unknown) => Promise<ToolResult> {
  const tools = (server as {
    _registeredTools?: Record<string, { handler?: unknown; callback?: unknown }>;
  })._registeredTools;
  if (!tools || !tools[toolName]) throw new Error(`Tool "${toolName}" not registered`);
  const fn = (tools[toolName].handler ?? tools[toolName].callback) as
    | ((a: Record<string, unknown>, ...rest: unknown[]) => Promise<ToolResult>)
    | undefined;
  if (typeof fn !== 'function') throw new Error(`Tool "${toolName}" handler missing`);
  return fn;
}

function textOf(result: ToolResult): string {
  return result?.content?.[0]?.text ?? '';
}

function parseJson<T = unknown>(result: ToolResult): T {
  return JSON.parse(textOf(result)) as T;
}

describeIfDb('MCP project tools — Task #315 integration', () => {
  let db: Db;
  let schema: Schema;
  let createMcpServer: typeof import('../../../server/mcp/server').createMcpServer;

  // Reuse the same MCP-scoped org name (`MCP-1`) the document-link
  // suite relies on so the MCP scope helpers (getMcpOrgIds /
  // getMcpAccessibleBuildingIds) resolve into our test buildings.
  const created = {
    organizationId: null as string | null,
    organizationCreatedByUs: false,
    outsideOrgId: null as string | null,
    workflowTaskIds: new Set<string>(),
    submissionVendorIds: new Set<string>(),
    projectStepIds: new Set<string>(),
    projectIds: new Set<string>(),
    userOrgs: new Set<string>(),
    buildings: new Set<string>(),
    users: new Set<string>(),
  };

  let mcpOrgId: string;
  let outsideOrgId: string;
  let buildingInScopeId: string;
  let buildingOutsideId: string;
  let tenantUserId: string;
  let managerUserId: string;
  let adminUserId: string;
  let outsideProjectId: string;

  function serverFor(role: 'admin' | 'manager' | 'tenant', userId: string) {
    return createMcpServer({ userId, role });
  }

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    db = require('../../../server/db').db as Db;
    schema = require('@shared/schema') as Schema;
    ({ createMcpServer } = require('../../../server/mcp/server'));

    // 1. MCP-scoped organization (reuse seed if it already exists).
    const existingMcp = await db
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(eq(schema.organizations.name, 'MCP-1'))
      .limit(1);
    if (existingMcp.length > 0) {
      mcpOrgId = existingMcp[0].id;
    } else {
      mcpOrgId = crypto.randomUUID();
      await db.insert(schema.organizations).values({
        id: mcpOrgId,
        name: 'MCP-1',
        type: 'syndicate',
        address: `${TEST_TAG} 1`,
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A1',
      });
      created.organizationCreatedByUs = true;
    }
    created.organizationId = mcpOrgId;

    // 2. A second org that is NOT in the MCP scope, used to host an
    //    out-of-scope project we expect every tool to refuse.
    outsideOrgId = crypto.randomUUID();
    await db.insert(schema.organizations).values({
      id: outsideOrgId,
      name: `${TEST_TAG} outside ${outsideOrgId.slice(0, 8)}`,
      type: 'syndicate',
      address: `${TEST_TAG} outside`,
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
    });
    created.outsideOrgId = outsideOrgId;

    // 3. Buildings: one in MCP scope, one outside.
    buildingInScopeId = crypto.randomUUID();
    buildingOutsideId = crypto.randomUUID();
    await db.insert(schema.buildings).values([
      {
        id: buildingInScopeId,
        organizationId: mcpOrgId,
        name: `${TEST_TAG} in`,
        address: '1',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A1',
        buildingType: 'condo',
        totalUnits: 1,
        totalFloors: 1,
        isActive: true,
      },
      {
        id: buildingOutsideId,
        organizationId: outsideOrgId,
        name: `${TEST_TAG} outside`,
        address: '2',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A1',
        buildingType: 'condo',
        totalUnits: 1,
        totalFloors: 1,
        isActive: true,
      },
    ]);
    created.buildings.add(buildingInScopeId);
    created.buildings.add(buildingOutsideId);

    // 4. Users: admin (acts as the project creator), manager (extra
    //    write coverage), tenant (gating coverage).
    const mkUser = async (role: 'tenant' | 'manager' | 'admin', suffix: string) => {
      const id = crypto.randomUUID();
      await db.insert(schema.users).values({
        id,
        username: `${TEST_TAG}-${suffix}-${id.slice(0, 8)}`,
        email: `${TEST_TAG}-${suffix}-${id.slice(0, 8)}@example.test`,
        password: 'x'.repeat(60),
        firstName: 'PT',
        lastName: suffix,
        role,
        language: 'en',
      });
      created.users.add(id);
      return id;
    };
    adminUserId = await mkUser('admin', 'admin');
    managerUserId = await mkUser('manager', 'mgr');
    tenantUserId = await mkUser('tenant', 'tenant');

    // Manager / admin both need a userOrganizations row pointing at
    // MCP-1 so role-scope guards see them as legitimate operators.
    for (const userId of [adminUserId, managerUserId]) {
      const userOrgId = crypto.randomUUID();
      await db.insert(schema.userOrganizations).values({
        id: userOrgId,
        userId,
        organizationId: mcpOrgId,
        organizationRole: 'manager',
        isActive: true,
      });
      created.userOrgs.add(userOrgId);
    }

    // 5. Pre-seed an out-of-scope project so we can confirm every
    //    project-id-taking tool refuses it. createdBy must reference
    //    a real user, so reuse our admin user (the FK doesn't care
    //    about the building / org link of that user).
    outsideProjectId = crypto.randomUUID();
    await db.insert(schema.maintenanceProjects).values({
      id: outsideProjectId,
      buildingId: buildingOutsideId,
      projectNumber: `${TEST_TAG}-OUT-${outsideProjectId.slice(0, 8)}`,
      title: `${TEST_TAG} outside project`,
      type: 'not_sure',
      status: 'planned',
      priority: 'medium',
      createdBy: adminUserId,
    });
    created.projectIds.add(outsideProjectId);
  }, 60000);

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;

    // FK-safe order: workflow tasks → submission vendors → project
    // steps → projects → user_organizations → buildings → users →
    // outside org → MCP-1 (only if we were the ones who created it).
    if (created.workflowTaskIds.size) {
      await db
        .delete(schema.workflowTasks)
        .where(inArray(schema.workflowTasks.id, [...created.workflowTaskIds]));
    }
    if (created.submissionVendorIds.size) {
      await db
        .delete(schema.submissionVendors)
        .where(inArray(schema.submissionVendors.id, [...created.submissionVendorIds]));
    }
    if (created.projectStepIds.size) {
      await db
        .delete(schema.projectSteps)
        .where(inArray(schema.projectSteps.id, [...created.projectStepIds]));
    }
    if (created.projectIds.size) {
      await db
        .delete(schema.maintenanceProjects)
        .where(inArray(schema.maintenanceProjects.id, [...created.projectIds]));
    }
    if (created.userOrgs.size) {
      await db
        .delete(schema.userOrganizations)
        .where(inArray(schema.userOrganizations.id, [...created.userOrgs]));
    }
    if (created.buildings.size) {
      await db
        .delete(schema.buildings)
        .where(inArray(schema.buildings.id, [...created.buildings]));
    }
    if (created.users.size) {
      await db.delete(schema.users).where(inArray(schema.users.id, [...created.users]));
    }
    if (created.outsideOrgId) {
      await db.delete(schema.organizations).where(eq(schema.organizations.id, created.outsideOrgId));
    }
    if (created.organizationCreatedByUs && created.organizationId) {
      await db
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, created.organizationId));
    }
  }, 60000);

  // -----------------------------------------------------------------
  // Tenants are blocked from every write tool. The mocked unit suite
  // already proves the role-gate fires before any DB call, so here we
  // just confirm that under a real DB the tenant call also leaves the
  // database untouched.
  // -----------------------------------------------------------------
  it('every project write tool denies a tenant role and writes nothing', async () => {
    const tenantSrv = serverFor('tenant', tenantUserId);

    const cases: Array<[string, Record<string, unknown>]> = [
      [
        'create_project',
        { role: 'tenant', buildingId: buildingInScopeId, title: `${TEST_TAG} tenant` },
      ],
      [
        'update_project',
        { role: 'tenant', projectId: outsideProjectId, title: `${TEST_TAG} tenant edit` },
      ],
      ['advance_project_status', { role: 'tenant', projectId: outsideProjectId }],
      [
        'add_project_task',
        {
          role: 'tenant',
          projectId: outsideProjectId,
          phase: 'pre_work',
          taskName: `${TEST_TAG} tenant task`,
        },
      ],
      [
        'update_project_task',
        {
          role: 'tenant',
          taskId: crypto.randomUUID(),
          taskName: `${TEST_TAG} tenant task`,
        },
      ],
      [
        'assign_project_vendor',
        {
          role: 'tenant',
          projectId: outsideProjectId,
          vendorName: `${TEST_TAG} tenant vendor`,
          projectType: 'repair',
        },
      ],
    ];

    for (const [tool, args] of cases) {
      const handler = getToolHandler(tenantSrv, tool);
      const res = await handler(args);
      expect(textOf(res)).toMatch(/Access denied/i);
    }

    // Confirm no rows were written under TEST_TAG by these tenant calls.
    const tenantTitled = await db
      .select({ id: schema.maintenanceProjects.id })
      .from(schema.maintenanceProjects)
      .where(eq(schema.maintenanceProjects.title, `${TEST_TAG} tenant`));
    expect(tenantTitled.length).toBe(0);
  }, 60000);

  // -----------------------------------------------------------------
  // MCP scope: an out-of-scope project must be refused by every
  // project-id-taking tool, even for an admin role.
  // -----------------------------------------------------------------
  it('out-of-scope projectId is rejected by every project-id-taking tool (admin role)', async () => {
    const adminSrv = serverFor('admin', adminUserId);

    for (const tool of [
      'get_project',
      'update_project',
      'advance_project_status',
      'add_project_task',
      'assign_project_vendor',
      // Task #528 — list_allowed_reopen_targets shares the same
      // loadMcpScopedProject guard, so a regression in that helper
      // would surface here alongside the other project tools.
      'list_allowed_reopen_targets',
    ]) {
      const handler = getToolHandler(adminSrv, tool);
      const args: Record<string, unknown> = { role: 'admin', projectId: outsideProjectId };
      // Tools that need extra required fields beyond projectId:
      if (tool === 'add_project_task') {
        args.phase = 'pre_work';
        args.taskName = `${TEST_TAG} oos`;
      }
      if (tool === 'assign_project_vendor') {
        args.vendorName = `${TEST_TAG} oos`;
        args.projectType = 'repair';
      }
      if (tool === 'update_project') {
        args.title = `${TEST_TAG} oos`;
      }
      const res = await handler(args);
      expect(textOf(res)).toMatch(/not found or access denied|not attached to an MCP/i);
    }

    // list_projects refuses by buildingId rather than projectId.
    const list = getToolHandler(adminSrv, 'list_projects');
    const listRes = await list({ role: 'admin', buildingId: buildingOutsideId });
    expect(textOf(listRes)).toMatch(/not found or access denied/i);
  }, 60000);

  // -----------------------------------------------------------------
  // Manager / admin happy-path round-trip — exercises every write
  // tool against the same project and confirms the row shape returned
  // by each handler.
  // -----------------------------------------------------------------
  it('admin can create → update → list → get → add task → update task → assign vendor → advance status', async () => {
    const adminSrv = serverFor('admin', adminUserId);

    // ── create_project ─────────────────────────────────────────────
    const createHandler = getToolHandler(adminSrv, 'create_project');
    const createRes = await createHandler({
      role: 'admin',
      buildingId: buildingInScopeId,
      title: `${TEST_TAG} happy`,
      priority: 'high',
      totalBudget: 1234.5,
      plannedStartDate: '2025-04-01',
      plannedEndDate: '2025-06-30',
    });
    const project = parseJson<{
      id: string;
      buildingId: string;
      title: string;
      status: string;
      priority: string;
      projectNumber: string;
      createdBy: string;
    }>(createRes);
    expect(project.id).toBeTruthy();
    expect(project.buildingId).toBe(buildingInScopeId);
    expect(project.title).toBe(`${TEST_TAG} happy`);
    expect(project.status).toBe('planned');
    expect(project.priority).toBe('high');
    expect(project.projectNumber).toMatch(/^MCP-PROJ-/);
    expect(project.createdBy).toBe(adminUserId);
    created.projectIds.add(project.id);

    // ── update_project ─────────────────────────────────────────────
    const updateHandler = getToolHandler(adminSrv, 'update_project');
    const updateRes = await updateHandler({
      role: 'admin',
      projectId: project.id,
      title: `${TEST_TAG} happy v2`,
      priority: 'critical',
      totalBudget: 2500,
    });
    const updated = parseJson<{ id: string; title: string; priority: string; totalBudget: string }>(
      updateRes,
    );
    expect(updated.id).toBe(project.id);
    expect(updated.title).toBe(`${TEST_TAG} happy v2`);
    expect(updated.priority).toBe('critical');
    // totalBudget is stored as decimal/string
    expect(Number(updated.totalBudget)).toBe(2500);

    // ── list_projects (manager role) ───────────────────────────────
    const mgrSrv = serverFor('manager', managerUserId);
    const listHandler = getToolHandler(mgrSrv, 'list_projects');
    const listRes = await listHandler({ role: 'manager', buildingId: buildingInScopeId });
    const listed = parseJson<Array<{ id: string; title: string }>>(listRes);
    expect(listed.some((p) => p.id === project.id && p.title === `${TEST_TAG} happy v2`)).toBe(true);

    // status filter must narrow results — no projects in 'completed'
    // yet for this building.
    const listCompletedRes = await listHandler({
      role: 'manager',
      buildingId: buildingInScopeId,
      status: 'completed',
    });
    const listedCompleted = parseJson<Array<{ id: string }>>(listCompletedRes);
    expect(listedCompleted.find((p) => p.id === project.id)).toBeUndefined();

    // ── get_project (tenant role is allowed for reads) ─────────────
    const tenantSrv = serverFor('tenant', tenantUserId);
    const getHandler = getToolHandler(tenantSrv, 'get_project');
    const getRes = await getHandler({ role: 'tenant', projectId: project.id });
    const got = parseJson<{
      project: { id: string; title: string };
      workflowState: { currentStatus: string; canProgress: boolean; nextStatus: string | null };
      steps: unknown[];
    }>(getRes);
    expect(got.project.id).toBe(project.id);
    expect(got.project.title).toBe(`${TEST_TAG} happy v2`);
    // workflowService delegate must populate the state object.
    expect(got.workflowState.currentStatus).toBe('planned');
    expect(got.workflowState.nextStatus).toBe('submission');
    expect(got.workflowState.canProgress).toBe(true);
    expect(Array.isArray(got.steps)).toBe(true);

    // ── add_project_task (auto orderIndex) ─────────────────────────
    const addTaskHandler = getToolHandler(adminSrv, 'add_project_task');
    const addTaskRes = await addTaskHandler({
      role: 'admin',
      projectId: project.id,
      phase: 'pre_work',
      taskName: `${TEST_TAG} task A`,
      cost: 100,
      dueDate: '2025-04-15',
    });
    const taskA = parseJson<{
      id: string;
      projectId: string;
      phase: string;
      taskName: string;
      orderIndex: number;
      isCompleted: boolean;
      cost: string;
      dueDate: string;
    }>(addTaskRes);
    expect(taskA.id).toBeTruthy();
    expect(taskA.projectId).toBe(project.id);
    expect(taskA.phase).toBe('pre_work');
    expect(taskA.taskName).toBe(`${TEST_TAG} task A`);
    expect(taskA.orderIndex).toBe(0);
    expect(taskA.isCompleted).toBe(false);
    expect(Number(taskA.cost)).toBe(100);
    expect(taskA.dueDate).toBe('2025-04-15');
    created.workflowTaskIds.add(taskA.id);

    // Second task auto-orders to 1 via the max-orderindex query.
    const addTaskRes2 = await addTaskHandler({
      role: 'admin',
      projectId: project.id,
      phase: 'pre_work',
      taskName: `${TEST_TAG} task B`,
    });
    const taskB = parseJson<{ id: string; orderIndex: number }>(addTaskRes2);
    expect(taskB.orderIndex).toBe(1);
    created.workflowTaskIds.add(taskB.id);

    // ── update_project_task (mark complete) ────────────────────────
    const updateTaskHandler = getToolHandler(adminSrv, 'update_project_task');
    const updateTaskRes = await updateTaskHandler({
      role: 'admin',
      taskId: taskA.id,
      taskName: `${TEST_TAG} task A done`,
      isCompleted: true,
    });
    const taskAUpdated = parseJson<{ id: string; taskName: string; isCompleted: boolean }>(
      updateTaskRes,
    );
    expect(taskAUpdated.id).toBe(taskA.id);
    expect(taskAUpdated.taskName).toBe(`${TEST_TAG} task A done`);
    expect(taskAUpdated.isCompleted).toBe(true);

    // Unknown task id surfaces a clear "Task not found" message.
    const unknownTaskRes = await updateTaskHandler({
      role: 'admin',
      taskId: crypto.randomUUID(),
      isCompleted: true,
    });
    expect(textOf(unknownTaskRes)).toMatch(/Task not found/i);

    // ── assign_project_vendor ──────────────────────────────────────
    const assignVendorHandler = getToolHandler(adminSrv, 'assign_project_vendor');
    const assignRes = await assignVendorHandler({
      role: 'admin',
      projectId: project.id,
      vendorName: `${TEST_TAG} vendor`,
      projectType: 'repair',
      price: 999.99,
      contactInfo: 'vendor@example.test',
      preferred: true,
    });
    const submission = parseJson<{
      id: string;
      projectId: string;
      vendorName: string;
      projectType: string;
      price: string;
      preferred: boolean;
    }>(assignRes);
    expect(submission.id).toBeTruthy();
    expect(submission.projectId).toBe(project.id);
    expect(submission.vendorName).toBe(`${TEST_TAG} vendor`);
    expect(submission.projectType).toBe('repair');
    expect(Number(submission.price)).toBeCloseTo(999.99);
    expect(submission.preferred).toBe(true);
    created.submissionVendorIds.add(submission.id);

    // ── advance_project_status: planned → submission ───────────────
    const advanceHandler = getToolHandler(adminSrv, 'advance_project_status');
    const advanceRes = await advanceHandler({ role: 'admin', projectId: project.id });
    const advanced = parseJson<{
      previousStatus: string;
      newStatus: string;
      project: { id: string; status: string; actualStartDate: string | null; actualEndDate: string | null };
    }>(advanceRes);
    expect(advanced.previousStatus).toBe('planned');
    expect(advanced.newStatus).toBe('submission');
    expect(advanced.project.status).toBe('submission');
    // Neither in_progress nor completed → no actual date stamping yet.
    expect(advanced.project.actualStartDate).toBeNull();
    expect(advanced.project.actualEndDate).toBeNull();

    // Verify the row really was advanced in the database (no implicit
    // mocking — the workflowService call wrote to Postgres).
    const [persistedAfterFirst] = await db
      .select({
        status: schema.maintenanceProjects.status,
        actualStartDate: schema.maintenanceProjects.actualStartDate,
      })
      .from(schema.maintenanceProjects)
      .where(eq(schema.maintenanceProjects.id, project.id));
    expect(persistedAfterFirst.status).toBe('submission');
    expect(persistedAfterFirst.actualStartDate).toBeNull();

    // Make the next assertion deterministic: park the project at
    // `pre_work` directly so a single `advance_project_status` call
    // lands on `in_progress` and exercises the `actualStartDate`
    // stamping branch (the behaviour the unit test mocks but only an
    // integration test can prove against a real
    // `getProjectWorkflowState` + a real DB write).
    await db
      .update(schema.maintenanceProjects)
      .set({ status: 'pre_work', actualStartDate: null, updatedAt: new Date() })
      .where(eq(schema.maintenanceProjects.id, project.id));

    const advanceToInProgressRes = await advanceHandler({ role: 'admin', projectId: project.id });
    const advancedToInProgress = parseJson<{
      previousStatus: string;
      newStatus: string;
      project: { status: string; actualStartDate: string | null };
    }>(advanceToInProgressRes);
    expect(advancedToInProgress.previousStatus).toBe('pre_work');
    expect(advancedToInProgress.newStatus).toBe('in_progress');

    const today = new Date().toISOString().split('T')[0];
    const [persistedAtInProgress] = await db
      .select({
        status: schema.maintenanceProjects.status,
        actualStartDate: schema.maintenanceProjects.actualStartDate,
      })
      .from(schema.maintenanceProjects)
      .where(eq(schema.maintenanceProjects.id, project.id));
    expect(persistedAtInProgress.status).toBe('in_progress');
    expect(persistedAtInProgress.actualStartDate).toBe(today);

    // ── advance_project_status: in_progress → post_work ────────────
    // Walk the remaining workflow phases through a real
    // workflowService call (no mocks). The post_work transition does
    // not stamp any actual* date — only `in_progress` (already
    // covered above) and `completed` (next call) do — so neither
    // actualStartDate nor actualEndDate should change here.
    const advanceToPostWorkRes = await advanceHandler({ role: 'admin', projectId: project.id });
    const advancedToPostWork = parseJson<{
      previousStatus: string;
      newStatus: string;
      project: { status: string; actualStartDate: string | null; actualEndDate: string | null };
    }>(advanceToPostWorkRes);
    expect(advancedToPostWork.previousStatus).toBe('in_progress');
    expect(advancedToPostWork.newStatus).toBe('post_work');
    expect(advancedToPostWork.project.status).toBe('post_work');
    // actualStartDate stays at today (set on the previous transition);
    // actualEndDate is still null because we have not yet hit
    // `completed`.
    expect(advancedToPostWork.project.actualStartDate).toBe(today);
    expect(advancedToPostWork.project.actualEndDate).toBeNull();

    const [persistedAtPostWork] = await db
      .select({
        status: schema.maintenanceProjects.status,
        actualStartDate: schema.maintenanceProjects.actualStartDate,
        actualEndDate: schema.maintenanceProjects.actualEndDate,
      })
      .from(schema.maintenanceProjects)
      .where(eq(schema.maintenanceProjects.id, project.id));
    expect(persistedAtPostWork.status).toBe('post_work');
    expect(persistedAtPostWork.actualStartDate).toBe(today);
    expect(persistedAtPostWork.actualEndDate).toBeNull();

    // ── advance_project_status: post_work → completed ──────────────
    // This is the branch the unit test only covers via mocks: the
    // `nextStatus === 'completed'` spread in server/mcp/server.ts
    // stamps `actualEndDate = today`. Closes the loop on the
    // per-transition timestamp behaviour against a real DB.
    const advanceToCompletedRes = await advanceHandler({ role: 'admin', projectId: project.id });
    const advancedToCompleted = parseJson<{
      previousStatus: string;
      newStatus: string;
      project: { status: string; actualStartDate: string | null; actualEndDate: string | null };
    }>(advanceToCompletedRes);
    expect(advancedToCompleted.previousStatus).toBe('post_work');
    expect(advancedToCompleted.newStatus).toBe('completed');
    expect(advancedToCompleted.project.status).toBe('completed');
    expect(advancedToCompleted.project.actualStartDate).toBe(today);
    expect(advancedToCompleted.project.actualEndDate).toBe(today);

    const [persistedAtCompleted] = await db
      .select({
        status: schema.maintenanceProjects.status,
        actualStartDate: schema.maintenanceProjects.actualStartDate,
        actualEndDate: schema.maintenanceProjects.actualEndDate,
      })
      .from(schema.maintenanceProjects)
      .where(eq(schema.maintenanceProjects.id, project.id));
    expect(persistedAtCompleted.status).toBe('completed');
    expect(persistedAtCompleted.actualStartDate).toBe(today);
    expect(persistedAtCompleted.actualEndDate).toBe(today);

    // Once `completed`, a further advance_project_status call must
    // be rejected by the explicit guard in the MCP handler (the row
    // is already at the terminal status).
    const advanceAfterCompletedRes = await advanceHandler({ role: 'admin', projectId: project.id });
    expect(textOf(advanceAfterCompletedRes)).toMatch(/already completed/i);
  }, 120000);

  // -----------------------------------------------------------------
  // Manager (the *other* allowed write role beyond admin) can drive
  // a write tool end-to-end. Spot-checks parity with the admin
  // happy-path round-trip — the role-gate alone isn't enough since
  // the rest of the handler still has to work for managers.
  // -----------------------------------------------------------------
  it('manager can update_project (write parity with admin)', async () => {
    const adminSrv = serverFor('admin', adminUserId);
    const mgrSrv = serverFor('manager', managerUserId);

    // Manager needs an existing project to update.
    const createRes = await getToolHandler(adminSrv, 'create_project')({
      role: 'admin',
      buildingId: buildingInScopeId,
      title: `${TEST_TAG} mgr-target`,
    });
    const project = parseJson<{ id: string }>(createRes);
    created.projectIds.add(project.id);

    const updateRes = await getToolHandler(mgrSrv, 'update_project')({
      role: 'manager',
      projectId: project.id,
      title: `${TEST_TAG} mgr-edited`,
      priority: 'low',
    });
    const updated = parseJson<{ id: string; title: string; priority: string }>(updateRes);
    expect(updated.id).toBe(project.id);
    expect(updated.title).toBe(`${TEST_TAG} mgr-edited`);
    expect(updated.priority).toBe('low');

    // Confirm the update was actually persisted (not just echoed).
    const [persisted] = await db
      .select({
        title: schema.maintenanceProjects.title,
        priority: schema.maintenanceProjects.priority,
      })
      .from(schema.maintenanceProjects)
      .where(eq(schema.maintenanceProjects.id, project.id));
    expect(persisted.title).toBe(`${TEST_TAG} mgr-edited`);
    expect(persisted.priority).toBe('low');
  }, 60000);

  // -----------------------------------------------------------------
  // Task #528 — `list_allowed_reopen_targets` is the additional
  // project-related read tool that shares the `loadMcpScopedProject`
  // guard but was not covered by Task #315. The block below proves:
  //
  //   - Tenants are denied (mirrors the unit role-gate).
  //   - The tool returns the previously-completed/skipped statuses for
  //     an in-scope project as the project advances through the
  //     workflow (delegates to workflowService.getAllowedReopenTargets
  //     against the real DB).
  //   - Manager role can drive the read tool (parity with admin).
  // -----------------------------------------------------------------
  describe('list_allowed_reopen_targets — Task #528 read-tool coverage', () => {
    it('denies tenant role', async () => {
      const tenantSrv = serverFor('tenant', tenantUserId);
      const handler = getToolHandler(tenantSrv, 'list_allowed_reopen_targets');
      const res = await handler({ role: 'tenant', projectId: outsideProjectId });
      expect(textOf(res)).toMatch(/tenants cannot view reopen targets/i);
    }, 60000);

    it('returns the empty list for a freshly-planned in-scope project', async () => {
      const adminSrv = serverFor('admin', adminUserId);

      // A project still at `planned` has no previously-completed
      // statuses — the list must come back empty.
      const createRes = await getToolHandler(adminSrv, 'create_project')({
        role: 'admin',
        buildingId: buildingInScopeId,
        title: `${TEST_TAG} reopen-empty`,
      });
      const project = parseJson<{ id: string; status: string }>(createRes);
      created.projectIds.add(project.id);

      const handler = getToolHandler(adminSrv, 'list_allowed_reopen_targets');
      const res = await handler({ role: 'admin', projectId: project.id });
      const parsed = parseJson<{
        currentStatus: string;
        allowedTargets: string[];
      }>(res);
      expect(parsed.currentStatus).toBe('planned');
      expect(Array.isArray(parsed.allowedTargets)).toBe(true);
      expect(parsed.allowedTargets).toEqual([]);
    }, 60000);

    it('returns the previously-completed statuses once the project has advanced', async () => {
      const adminSrv = serverFor('admin', adminUserId);
      const mgrSrv = serverFor('manager', managerUserId);

      // Park a fresh project at `in_progress` directly so the
      // workflow service has a deterministic history of completed
      // statuses to surface (`planned`, `submission`, `pre_work`).
      const createRes = await getToolHandler(adminSrv, 'create_project')({
        role: 'admin',
        buildingId: buildingInScopeId,
        title: `${TEST_TAG} reopen-list`,
      });
      const project = parseJson<{ id: string }>(createRes);
      created.projectIds.add(project.id);

      await db
        .update(schema.maintenanceProjects)
        .set({ status: 'in_progress', updatedAt: new Date() })
        .where(eq(schema.maintenanceProjects.id, project.id));

      // Manager role drives the read — same parity check used for
      // update_project elsewhere in this suite.
      const handler = getToolHandler(mgrSrv, 'list_allowed_reopen_targets');
      const res = await handler({ role: 'manager', projectId: project.id });
      const parsed = parseJson<{
        currentStatus: string;
        allowedTargets: string[];
      }>(res);
      expect(parsed.currentStatus).toBe('in_progress');
      // Statuses earlier in the progression than `in_progress` should
      // each be eligible reopen targets. The tool must not include
      // the current status nor anything ahead of it.
      expect(parsed.allowedTargets).toEqual(
        expect.arrayContaining(['planned', 'submission', 'pre_work']),
      );
      expect(parsed.allowedTargets).not.toContain('in_progress');
      expect(parsed.allowedTargets).not.toContain('post_work');
      expect(parsed.allowedTargets).not.toContain('completed');
    }, 60000);
  });
});
