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
      // Task #561 — reopen_project_status is the write counterpart
      // to list_allowed_reopen_targets and shares the same guard.
      // A regression that allowed an out-of-scope reopen would let
      // an AI assistant flip the workflow status of a project in a
      // tenant whose org is not MCP-allowlisted.
      'reopen_project_status',
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
      if (tool === 'reopen_project_status') {
        args.targetStatus = 'planned';
      }
      const res = await handler(args);
      expect(textOf(res)).toMatch(/not found or access denied|not attached to an MCP/i);
    }

    // Belt-and-braces guard for Task #561: even after the access
    // denied response, the out-of-scope project's status must be
    // unchanged in the database. This is the regression the task
    // brief explicitly worries about ("could silently allow an AI
    // assistant to revert a project that's outside its allowed
    // scope") — assert it directly against the row.
    const [outsideAfterScopeReject] = await db
      .select({ status: schema.maintenanceProjects.status })
      .from(schema.maintenanceProjects)
      .where(eq(schema.maintenanceProjects.id, outsideProjectId));
    expect(outsideAfterScopeReject.status).toBe('planned');

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

  // -----------------------------------------------------------------
  // -----------------------------------------------------------------
  // Task #557 — skip-flag end-to-end coverage.
  //
  // The default happy-path (above) walks every status. Here we flip
  // skip flags directly in the DB (the MCP create_project tool does
  // not accept them) and confirm `advance_project_status`:
  //   1. Honours each skip flag via workflowService.getNextStatus —
  //      the previousStatus / newStatus pair must jump over the
  //      skipped phases instead of visiting them.
  //   2. Still stamps `actualStartDate` exactly on the
  //      `* → in_progress` transition (and only that one), even
  //      when the prior phase was skipped.
  //   3. Still stamps `actualEndDate` exactly on the
  //      `* → completed` transition (and only that one), even when
  //      the prior phase (post_work) was skipped.
  //
  // These behaviours are the interaction between the skip-flag
  // branches in `getNextStatus` (server/services/workflow-service.ts
  // L430–455) and the per-transition spread in `advance_project_status`
  // (server/mcp/server.ts ~L5599–5660). Mocked unit tests cover them
  // separately; this is the only place they're proved together
  // against a real Postgres row.
  // -----------------------------------------------------------------
  describe('advance_project_status — Task #557 skip-flag coverage', () => {
    it('skipSubmission + skipPostWork: planned → pre_work → in_progress → completed, with timestamps on the right transitions only', async () => {
      const adminSrv = serverFor('admin', adminUserId);

      const createRes = await getToolHandler(adminSrv, 'create_project')({
        role: 'admin',
        buildingId: buildingInScopeId,
        title: `${TEST_TAG} skip-sub-post`,
      });
      const project = parseJson<{ id: string; status: string }>(createRes);
      created.projectIds.add(project.id);
      expect(project.status).toBe('planned');

      // Flip skip flags directly — create_project does not expose
      // them, but advance_project_status reads them via
      // workflowService.getProjectWorkflowState on every call.
      await db
        .update(schema.maintenanceProjects)
        .set({
          skipSubmission: true,
          skipPostWork: true,
          updatedAt: new Date(),
        })
        .where(eq(schema.maintenanceProjects.id, project.id));

      const advanceHandler = getToolHandler(adminSrv, 'advance_project_status');

      // ── Call 1: planned → pre_work (submission skipped) ─────────
      const res1 = await advanceHandler({ role: 'admin', projectId: project.id });
      const step1 = parseJson<{
        previousStatus: string;
        newStatus: string;
        project: { status: string; actualStartDate: string | null; actualEndDate: string | null };
      }>(res1);
      expect(step1.previousStatus).toBe('planned');
      // Critical: must skip 'submission' and land on 'pre_work'.
      expect(step1.newStatus).toBe('pre_work');
      expect(step1.project.status).toBe('pre_work');
      // Neither in_progress nor completed → no actual* stamping yet.
      expect(step1.project.actualStartDate).toBeNull();
      expect(step1.project.actualEndDate).toBeNull();

      const [persisted1] = await db
        .select({
          status: schema.maintenanceProjects.status,
          actualStartDate: schema.maintenanceProjects.actualStartDate,
          actualEndDate: schema.maintenanceProjects.actualEndDate,
        })
        .from(schema.maintenanceProjects)
        .where(eq(schema.maintenanceProjects.id, project.id));
      expect(persisted1.status).toBe('pre_work');
      expect(persisted1.actualStartDate).toBeNull();
      expect(persisted1.actualEndDate).toBeNull();

      // ── Call 2: pre_work → in_progress (stamps actualStartDate) ─
      const res2 = await advanceHandler({ role: 'admin', projectId: project.id });
      const step2 = parseJson<{
        previousStatus: string;
        newStatus: string;
        project: { status: string; actualStartDate: string | null; actualEndDate: string | null };
      }>(res2);
      expect(step2.previousStatus).toBe('pre_work');
      expect(step2.newStatus).toBe('in_progress');
      expect(step2.project.status).toBe('in_progress');

      const today = new Date().toISOString().split('T')[0];
      // actualStartDate must be stamped *exactly* on this transition.
      expect(step2.project.actualStartDate).toBe(today);
      // actualEndDate must NOT be stamped yet.
      expect(step2.project.actualEndDate).toBeNull();

      const [persisted2] = await db
        .select({
          status: schema.maintenanceProjects.status,
          actualStartDate: schema.maintenanceProjects.actualStartDate,
          actualEndDate: schema.maintenanceProjects.actualEndDate,
        })
        .from(schema.maintenanceProjects)
        .where(eq(schema.maintenanceProjects.id, project.id));
      expect(persisted2.status).toBe('in_progress');
      expect(persisted2.actualStartDate).toBe(today);
      expect(persisted2.actualEndDate).toBeNull();

      // ── Call 3: in_progress → completed (post_work skipped, stamps actualEndDate) ─
      const res3 = await advanceHandler({ role: 'admin', projectId: project.id });
      const step3 = parseJson<{
        previousStatus: string;
        newStatus: string;
        project: { status: string; actualStartDate: string | null; actualEndDate: string | null };
      }>(res3);
      expect(step3.previousStatus).toBe('in_progress');
      // Critical: must skip 'post_work' and land on 'completed'.
      expect(step3.newStatus).toBe('completed');
      expect(step3.project.status).toBe('completed');
      // actualStartDate stays at today (set on the previous transition).
      expect(step3.project.actualStartDate).toBe(today);
      // actualEndDate must be stamped *exactly* on this transition.
      expect(step3.project.actualEndDate).toBe(today);

      const [persisted3] = await db
        .select({
          status: schema.maintenanceProjects.status,
          actualStartDate: schema.maintenanceProjects.actualStartDate,
          actualEndDate: schema.maintenanceProjects.actualEndDate,
        })
        .from(schema.maintenanceProjects)
        .where(eq(schema.maintenanceProjects.id, project.id));
      expect(persisted3.status).toBe('completed');
      expect(persisted3.actualStartDate).toBe(today);
      expect(persisted3.actualEndDate).toBe(today);

      // Once `completed`, further advances must be rejected — same
      // guard the non-skip happy-path proves above.
      const resAfter = await advanceHandler({ role: 'admin', projectId: project.id });
      expect(textOf(resAfter)).toMatch(/already completed/i);
    }, 120000);

    it('skipPreWork + skipInProgress: submission jumps straight to post_work without stamping actualStartDate', async () => {
      // Symmetric coverage for the other two skippable phases. The
      // important property here is the *negative*: no actualStartDate
      // is stamped because the `in_progress` phase is skipped — the
      // spread in advance_project_status only fires when newStatus is
      // exactly 'in_progress' / 'completed'.
      const adminSrv = serverFor('admin', adminUserId);

      const createRes = await getToolHandler(adminSrv, 'create_project')({
        role: 'admin',
        buildingId: buildingInScopeId,
        title: `${TEST_TAG} skip-pre-in`,
      });
      const project = parseJson<{ id: string }>(createRes);
      created.projectIds.add(project.id);

      // Park at `submission` and turn on the two middle skip flags.
      await db
        .update(schema.maintenanceProjects)
        .set({
          status: 'submission',
          skipPreWork: true,
          skipInProgress: true,
          updatedAt: new Date(),
        })
        .where(eq(schema.maintenanceProjects.id, project.id));

      const advanceHandler = getToolHandler(adminSrv, 'advance_project_status');

      // ── submission → post_work (pre_work + in_progress skipped) ─
      const res = await advanceHandler({ role: 'admin', projectId: project.id });
      const step = parseJson<{
        previousStatus: string;
        newStatus: string;
        project: { status: string; actualStartDate: string | null; actualEndDate: string | null };
      }>(res);
      expect(step.previousStatus).toBe('submission');
      expect(step.newStatus).toBe('post_work');
      expect(step.project.status).toBe('post_work');
      // in_progress was skipped → actualStartDate must NOT be stamped.
      expect(step.project.actualStartDate).toBeNull();
      expect(step.project.actualEndDate).toBeNull();

      const [persisted] = await db
        .select({
          status: schema.maintenanceProjects.status,
          actualStartDate: schema.maintenanceProjects.actualStartDate,
          actualEndDate: schema.maintenanceProjects.actualEndDate,
        })
        .from(schema.maintenanceProjects)
        .where(eq(schema.maintenanceProjects.id, project.id));
      expect(persisted.status).toBe('post_work');
      expect(persisted.actualStartDate).toBeNull();
      expect(persisted.actualEndDate).toBeNull();

      // ── post_work → completed (stamps actualEndDate) ─────────────
      const res2 = await advanceHandler({ role: 'admin', projectId: project.id });
      const step2 = parseJson<{
        previousStatus: string;
        newStatus: string;
        project: { status: string; actualStartDate: string | null; actualEndDate: string | null };
      }>(res2);
      expect(step2.previousStatus).toBe('post_work');
      expect(step2.newStatus).toBe('completed');
      expect(step2.project.status).toBe('completed');
      // actualStartDate was never stamped (in_progress was skipped),
      // so the row must still report null even at completion.
      expect(step2.project.actualStartDate).toBeNull();
      const today = new Date().toISOString().split('T')[0];
      expect(step2.project.actualEndDate).toBe(today);

      const [persisted2] = await db
        .select({
          status: schema.maintenanceProjects.status,
          actualStartDate: schema.maintenanceProjects.actualStartDate,
          actualEndDate: schema.maintenanceProjects.actualEndDate,
        })
        .from(schema.maintenanceProjects)
        .where(eq(schema.maintenanceProjects.id, project.id));
      expect(persisted2.status).toBe('completed');
      expect(persisted2.actualStartDate).toBeNull();
      expect(persisted2.actualEndDate).toBe(today);
    }, 120000);
  });

  // -----------------------------------------------------------------
  // Task #561 — `reopen_project_status` write-tool coverage. This is
  // the write counterpart to `list_allowed_reopen_targets`. The
  // mocked unit tests prove role-gating, scope-rejection, and that
  // workflow-service errors are funneled through
  // `buildWriteErrorResponse`. The block below exercises the
  // happy-path against a real `workflowService.reopenToPhase` and
  // real Postgres rows so the behaviour the task brief calls out
  // ("flips a project's status and resets the appropriate downstream
  // date columns / phase artifacts when called with an allowed
  // targetStatus, and refuses non-allowed targets") is locked in.
  // -----------------------------------------------------------------
  describe('reopen_project_status — Task #561 write-tool coverage', () => {
    it('flips status, clears actual dates, and refuses non-allowed targets', async () => {
      const adminSrv = serverFor('admin', adminUserId);
      const mgrSrv = serverFor('manager', managerUserId);

      // 1. Create a fresh project, walk it all the way to
      //    `completed` so both `actualStartDate` and `actualEndDate`
      //    are populated and every previous status is in the
      //    allowed-reopen list.
      const createRes = await getToolHandler(adminSrv, 'create_project')({
        role: 'admin',
        buildingId: buildingInScopeId,
        title: `${TEST_TAG} reopen-flow`,
      });
      const project = parseJson<{ id: string }>(createRes);
      created.projectIds.add(project.id);

      // Park the project at `completed` directly with stamped actual
      // dates so the reopen call's date-clearing branch becomes
      // observable. Mirrors how the unit suite skips intermediate
      // transitions to keep the integration cost bounded.
      const baselineDate = '2025-01-15';
      await db
        .update(schema.maintenanceProjects)
        .set({
          status: 'completed',
          actualStartDate: baselineDate,
          actualEndDate: baselineDate,
          updatedAt: new Date(),
        })
        .where(eq(schema.maintenanceProjects.id, project.id));

      // 2. Fetch the allowed reopen targets so the test stays
      //    coupled to the real workflowService.getAllowedReopenTargets
      //    contract — if a future refactor changes which statuses
      //    are reachable from `completed`, the assertion below will
      //    fail loudly rather than silently drift.
      const targetsHandler = getToolHandler(adminSrv, 'list_allowed_reopen_targets');
      const targetsRes = await targetsHandler({ role: 'admin', projectId: project.id });
      const targets = parseJson<{
        currentStatus: string;
        allowedTargets: string[];
      }>(targetsRes);
      expect(targets.currentStatus).toBe('completed');
      expect(targets.allowedTargets).toEqual(
        expect.arrayContaining(['planned', 'submission', 'pre_work', 'in_progress', 'post_work']),
      );

      // 3. Refuse a non-allowed target. `completed` is the project's
      //    *current* status, so attempting to reopen to it must be
      //    rejected by workflowService.reopenToPhase. The MCP
      //    handler must surface that rejection through
      //    buildWriteErrorResponse — and crucially, the row must
      //    not move.
      const reopenHandler = getToolHandler(adminSrv, 'reopen_project_status');
      const refusedRes = await reopenHandler({
        role: 'admin',
        projectId: project.id,
        // `completed` is not in allowedTargets (it's the current
        // status). targetStatus enum still accepts it, so the
        // workflowService validation is what should reject.
        targetStatus: 'completed',
      });
      expect(textOf(refusedRes)).toMatch(/Failed to update project|already at completed/i);

      const [unchanged] = await db
        .select({
          status: schema.maintenanceProjects.status,
          actualStartDate: schema.maintenanceProjects.actualStartDate,
          actualEndDate: schema.maintenanceProjects.actualEndDate,
        })
        .from(schema.maintenanceProjects)
        .where(eq(schema.maintenanceProjects.id, project.id));
      expect(unchanged.status).toBe('completed');
      expect(unchanged.actualStartDate).toBe(baselineDate);
      expect(unchanged.actualEndDate).toBe(baselineDate);

      // 4. Happy-path reopen to `pre_work`. This index sits before
      //    `in_progress` (so `actualStartDate` should be cleared)
      //    and before `completed` (so `actualEndDate` should also
      //    be cleared) — exercising both date-reset branches in
      //    workflowService.reopenToPhase in a single call.
      const reopenedRes = await reopenHandler({
        role: 'admin',
        projectId: project.id,
        targetStatus: 'pre_work',
        reason: `${TEST_TAG} reopen reason`,
      });
      const reopened = parseJson<{
        previousStatus: string;
        newStatus: string;
        workflowState: { currentStatus: string; canProgress: boolean };
      }>(reopenedRes);
      expect(reopened.previousStatus).toBe('completed');
      expect(reopened.newStatus).toBe('pre_work');
      expect(reopened.workflowState.currentStatus).toBe('pre_work');
      expect(reopened.workflowState.canProgress).toBe(true);

      // 5. Verify the row really was updated in Postgres (no
      //    implicit mocking — workflowService wrote against real
      //    drizzle). actualCost should also be recalculated to a
      //    decimal string by the cost recalculation step inside
      //    reopenToPhase.
      const [persisted] = await db
        .select({
          status: schema.maintenanceProjects.status,
          actualStartDate: schema.maintenanceProjects.actualStartDate,
          actualEndDate: schema.maintenanceProjects.actualEndDate,
          actualCost: schema.maintenanceProjects.actualCost,
        })
        .from(schema.maintenanceProjects)
        .where(eq(schema.maintenanceProjects.id, project.id));
      expect(persisted.status).toBe('pre_work');
      // pre_work sits before in_progress and before completed in
      // STATUS_PROGRESSION → both actualStartDate AND actualEndDate
      // must have been reset to NULL by reopenToPhase.
      expect(persisted.actualStartDate).toBeNull();
      expect(persisted.actualEndDate).toBeNull();
      // actualCost must be present (recalculated to a decimal
      // string by calculateActualCostFromCompletedPhases).
      expect(persisted.actualCost).not.toBeNull();
      expect(Number(persisted.actualCost)).not.toBeNaN();

      // 6. Manager role parity — the manager can also reopen
      //    (further back this time, to `planned`). Mirrors the
      //    update_project parity check elsewhere in this suite.
      const managerReopenHandler = getToolHandler(mgrSrv, 'reopen_project_status');
      const mgrReopenedRes = await managerReopenHandler({
        role: 'manager',
        projectId: project.id,
        targetStatus: 'planned',
      });
      const mgrReopened = parseJson<{
        previousStatus: string;
        newStatus: string;
      }>(mgrReopenedRes);
      expect(mgrReopened.previousStatus).toBe('pre_work');
      expect(mgrReopened.newStatus).toBe('planned');

      const [persistedAfterMgr] = await db
        .select({ status: schema.maintenanceProjects.status })
        .from(schema.maintenanceProjects)
        .where(eq(schema.maintenanceProjects.id, project.id));
      expect(persistedAfterMgr.status).toBe('planned');
    }, 120000);

    it('denies tenant role and leaves the project status unchanged', async () => {
      const adminSrv = serverFor('admin', adminUserId);
      const tenantSrv = serverFor('tenant', tenantUserId);

      // Seed a project parked at in_progress so a successful reopen
      // would actually be observable as a status flip.
      const createRes = await getToolHandler(adminSrv, 'create_project')({
        role: 'admin',
        buildingId: buildingInScopeId,
        title: `${TEST_TAG} reopen-tenant`,
      });
      const project = parseJson<{ id: string }>(createRes);
      created.projectIds.add(project.id);
      await db
        .update(schema.maintenanceProjects)
        .set({ status: 'in_progress', updatedAt: new Date() })
        .where(eq(schema.maintenanceProjects.id, project.id));

      const tenantRes = await getToolHandler(tenantSrv, 'reopen_project_status')({
        role: 'tenant',
        projectId: project.id,
        targetStatus: 'planned',
      });
      expect(textOf(tenantRes)).toMatch(/tenants cannot reopen project status/i);

      const [persisted] = await db
        .select({ status: schema.maintenanceProjects.status })
        .from(schema.maintenanceProjects)
        .where(eq(schema.maintenanceProjects.id, project.id));
      expect(persisted.status).toBe('in_progress');
    }, 60000);
  });

  // -----------------------------------------------------------------
  // Task #582 — Prove the actual-cost recalculation after
  // `reopen_project_status` produces the right number, not just a
  // non-null/numeric value. Task #561 above only asserts the column
  // ends up populated; a regression that returned 0 (or summed in
  // tasks from now-reopened phases) would slip past it and silently
  // corrupt project actual-cost reporting in the dashboard.
  //
  // The seed has completed workflow_tasks across pre_work,
  // in_progress and post_work with known costs, plus an incomplete
  // pre_work task that must always be excluded by the
  // `isCompleted = true` filter inside
  // `workflowService.calculateActualCostFromCompletedPhases`. After
  // reopening from `completed` back to `pre_work`, the rollup must
  // drop the in_progress and post_work contributions (those phases
  // are no longer in `completedStatuses`) while keeping the
  // pre_work completed tasks (pre_work is the new currentStatus,
  // and the recalc includes the current phase's completed tasks
  // by design — see the OR-branch in
  // calculateActualCostFromCompletedPhases).
  // -----------------------------------------------------------------
  describe('reopen_project_status — Task #582 actual-cost recalculation', () => {
    it('rolls up only the still-counted phases when reopening to pre_work', async () => {
      const adminSrv = serverFor('admin', adminUserId);

      // 1. Create a project (starts at `planned`) so the
      //    workflowService rollup has a real row to work against.
      const createRes = await getToolHandler(adminSrv, 'create_project')({
        role: 'admin',
        buildingId: buildingInScopeId,
        title: `${TEST_TAG} reopen-cost`,
      });
      const project = parseJson<{ id: string }>(createRes);
      created.projectIds.add(project.id);

      // 2. Seed workflow_tasks with known costs across every task
      //    phase. We insert directly via drizzle (rather than
      //    add_project_task + update_project_task) so the test
      //    stays narrowly focused on the reopen-recalc behaviour
      //    and does not depend on the unrelated
      //    update_project_task code path. Each `cost` value is
      //    distinct so any silent off-by-one in the SUM() would be
      //    visible in the assertion.
      const seedTask = async (
        phase: 'pre_work' | 'in_progress' | 'post_work',
        cost: string,
        isCompleted: boolean,
        orderIndex: number,
      ) => {
        const id = crypto.randomUUID();
        await db.insert(schema.workflowTasks).values({
          id,
          projectId: project.id,
          phase,
          taskName: `${TEST_TAG} ${phase} ${orderIndex}`,
          cost,
          isCompleted,
          orderIndex,
        });
        // Tracked in the suite-level set so the existing tag-based
        // afterAll teardown will FK-safely delete these rows before
        // the projects/users/buildings cleanup steps.
        created.workflowTaskIds.add(id);
      };

      // pre_work: two completed tasks (100.00 + 50.00 = 150.00)
      // and one INCOMPLETE task (999.00) that must never count.
      await seedTask('pre_work', '100.00', true, 0);
      await seedTask('pre_work', '50.00', true, 1);
      await seedTask('pre_work', '999.00', false, 2);
      // in_progress: 200.00, completed.
      await seedTask('in_progress', '200.00', true, 0);
      // post_work: 300.00, completed.
      await seedTask('post_work', '300.00', true, 0);

      // 3. Park the project at `completed` so every phase sits in
      //    `completedStatuses`. Mirrors the pattern used by the
      //    Task #561 happy-path block above.
      await db
        .update(schema.maintenanceProjects)
        .set({
          status: 'completed',
          actualStartDate: '2025-01-15',
          actualEndDate: '2025-01-20',
          updatedAt: new Date(),
        })
        .where(eq(schema.maintenanceProjects.id, project.id));

      // 4. Reopen back to `pre_work`. After this call:
      //    - completedStatuses = ['planned', 'submission']
      //    - currentStatus     = 'pre_work'
      //    The recalc therefore only counts task phases where
      //    completedStatuses.includes(phase) || currentStatus===phase.
      //    That selects pre_work (current) and excludes in_progress
      //    and post_work — those are the regression we want to
      //    catch.
      const reopenHandler = getToolHandler(adminSrv, 'reopen_project_status');
      const reopenedRes = await reopenHandler({
        role: 'admin',
        projectId: project.id,
        targetStatus: 'pre_work',
        reason: `${TEST_TAG} cost-recalc`,
      });
      const reopened = parseJson<{ newStatus: string }>(reopenedRes);
      expect(reopened.newStatus).toBe('pre_work');

      // 5. Read the persisted actualCost and assert the EXACT
      //    decimal-string value the rollup must produce:
      //    - pre_work completed tasks  → 100 + 50 = 150 (counted: current phase)
      //    - pre_work incomplete task  →   0       (filtered by isCompleted)
      //    - in_progress completed     →   0       (no longer in completedStatuses)
      //    - post_work  completed      →   0       (no longer in completedStatuses)
      //    Total = 150.00 → stored as "150.00" by `.toFixed(2)`.
      const [persisted] = await db
        .select({
          status: schema.maintenanceProjects.status,
          actualCost: schema.maintenanceProjects.actualCost,
        })
        .from(schema.maintenanceProjects)
        .where(eq(schema.maintenanceProjects.id, project.id));
      expect(persisted.status).toBe('pre_work');
      // Exact value — not just non-null. A regression returning 0
      // (e.g. the OR-branch dropped the current phase) would yield
      // "0.00"; a regression that kept summing in_progress/post_work
      // would yield "650.00". Both must fail this assertion.
      expect(persisted.actualCost).toBe('150.00');
      expect(Number(persisted.actualCost)).toBe(150);
    }, 120000);
  });
});
