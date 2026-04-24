/**
 * @jest-environment node
 *
 * Task #519 — MCP integration coverage for the three project-workflow
 * MCP tools registered in `server/mcp/server.ts`:
 *
 *   - advance_project_status        (write — admin/manager only)
 *   - list_allowed_reopen_targets   (read  — admin/manager only)
 *   - reopen_project_status         (write — admin/manager only)
 *
 * Goal of this suite: exercise the read + write paths end-to-end against
 * a real Postgres instance using the MCP-1 sandbox seed
 * (`MCP_ORG_NAMES`), and lock in the behaviours the mocked unit tests
 * cannot prove:
 *
 *   1. Tenant role is denied by every tool before any DB write.
 *   2. A project whose building lives outside any MCP-scoped org is
 *      refused for every tool that takes a `projectId` (covers
 *      `loadMcpScopedProject`).
 *   3. `advance_project_status` actually advances the row in the DB
 *      and stamps `actualStartDate` / `actualEndDate` correctly.
 *   4. `list_allowed_reopen_targets` surfaces
 *      `workflowService.getAllowedReopenTargets`, returning each
 *      previously-completed status.
 *   5. `reopen_project_status` rolls the project back, resets
 *      `actualStartDate`/`actualEndDate`, recalculates `actualCost`
 *      from the remaining completed phases, and rejects a
 *      disallowed `targetStatus`.
 *   6. The `project_notifications.is_sent` reset performed by
 *      `workflowService.resetDownstreamArtifacts` actually fires.
 *
 * Mirrors the harness in tests/integration/mcp/project-tools.test.ts
 * and is gated on `_INTEGRATION_DB_URL`.
 */

// Stub the heavy modules that server/mcp/server.ts imports at the top —
// the workflow tools never use them, but loading the real modules pulls
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
const TEST_TAG = 'task519-mcp-workflow-tools';
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

describeIfDb('MCP project workflow tools — Task #519 integration', () => {
  let db: Db;
  let schema: Schema;
  let createMcpServer: typeof import('../../../server/mcp/server').createMcpServer;

  // Reuse the same MCP-scoped org name (`MCP-1`) the rest of the MCP
  // integration suites use so `getMcpOrgIds` resolves into our test
  // buildings.
  const created = {
    organizationId: null as string | null,
    organizationCreatedByUs: false,
    outsideOrgId: null as string | null,
    workflowTaskIds: new Set<string>(),
    submissionVendorIds: new Set<string>(),
    notificationIds: new Set<string>(),
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

    // 2. Out-of-scope org for the access-denial assertions.
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

    // 4. Users: admin (project creator), manager, tenant.
    const mkUser = async (role: 'tenant' | 'manager' | 'admin', suffix: string) => {
      const id = crypto.randomUUID();
      await db.insert(schema.users).values({
        id,
        username: `${TEST_TAG}-${suffix}-${id.slice(0, 8)}`,
        email: `${TEST_TAG}-${suffix}-${id.slice(0, 8)}@example.test`,
        password: 'x'.repeat(60),
        firstName: 'WF',
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

    // 5. Out-of-scope project so we can confirm every workflow tool
    //    refuses it. createdBy must reference a real user, so reuse
    //    our admin user (the FK doesn't care about the building/org
    //    link of that user).
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

    // FK-safe order: notifications + workflow tasks + submission
    // vendors → projects → user_organizations → buildings → users →
    // outside org → MCP-1 (only if we created it).
    if (created.notificationIds.size) {
      await db
        .delete(schema.projectNotifications)
        .where(inArray(schema.projectNotifications.id, [...created.notificationIds]));
    }
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
  // Helper: spin up an in-scope project at the requested status, with
  // optional submission vendor and workflow tasks pre-populated. Used
  // for the happy-path / reopen scenarios.
  // -----------------------------------------------------------------
  async function makeProject(opts: {
    status: 'planned' | 'submission' | 'pre_work' | 'in_progress' | 'post_work' | 'completed';
    actualStartDate?: string | null;
    actualEndDate?: string | null;
    actualCost?: string | null;
  }) {
    const id = crypto.randomUUID();
    await db.insert(schema.maintenanceProjects).values({
      id,
      buildingId: buildingInScopeId,
      projectNumber: `${TEST_TAG}-${id.slice(0, 8)}`,
      title: `${TEST_TAG} ${id.slice(0, 8)}`,
      type: 'not_sure',
      status: opts.status,
      priority: 'medium',
      createdBy: adminUserId,
      actualStartDate: opts.actualStartDate ?? null,
      actualEndDate: opts.actualEndDate ?? null,
      actualCost: opts.actualCost ?? null,
    });
    created.projectIds.add(id);
    return id;
  }

  // -----------------------------------------------------------------
  // 1. Tenant role is denied by every workflow tool before any DB
  //    write. The mocked unit suite proves the gate fires before the
  //    DB call; here we double-check end-to-end the row stays at its
  //    starting status.
  // -----------------------------------------------------------------
  it('every workflow tool denies a tenant role and writes nothing', async () => {
    const tenantSrv = serverFor('tenant', tenantUserId);
    const projectId = await makeProject({ status: 'planned' });

    const cases: Array<[string, Record<string, unknown>]> = [
      ['advance_project_status', { role: 'tenant', projectId }],
      ['list_allowed_reopen_targets', { role: 'tenant', projectId }],
      ['reopen_project_status', { role: 'tenant', projectId, targetStatus: 'planned' }],
    ];

    for (const [tool, args] of cases) {
      const handler = getToolHandler(tenantSrv, tool);
      const res = await handler(args);
      expect(textOf(res)).toMatch(/Access denied/i);
    }

    const [persisted] = await db
      .select({ status: schema.maintenanceProjects.status })
      .from(schema.maintenanceProjects)
      .where(eq(schema.maintenanceProjects.id, projectId));
    expect(persisted.status).toBe('planned');
  }, 60000);

  // -----------------------------------------------------------------
  // 2. MCP scope: an out-of-scope project must be refused by every
  //    workflow tool, even for an admin role. Exercises
  //    `loadMcpScopedProject`'s "Access denied: project is not
  //    attached to an MCP-scoped building" branch.
  // -----------------------------------------------------------------
  it('out-of-scope projectId is rejected by every workflow tool (admin role)', async () => {
    const adminSrv = serverFor('admin', adminUserId);

    const cases: Array<[string, Record<string, unknown>]> = [
      ['advance_project_status', { role: 'admin', projectId: outsideProjectId }],
      ['list_allowed_reopen_targets', { role: 'admin', projectId: outsideProjectId }],
      [
        'reopen_project_status',
        { role: 'admin', projectId: outsideProjectId, targetStatus: 'planned' },
      ],
    ];

    for (const [tool, args] of cases) {
      const handler = getToolHandler(adminSrv, tool);
      const res = await handler(args);
      expect(textOf(res)).toMatch(/not attached to an MCP/i);
    }

    // Sanity: the outside project's status is untouched.
    const [persisted] = await db
      .select({ status: schema.maintenanceProjects.status })
      .from(schema.maintenanceProjects)
      .where(eq(schema.maintenanceProjects.id, outsideProjectId));
    expect(persisted.status).toBe('planned');
  }, 60000);

  // -----------------------------------------------------------------
  // 3. advance_project_status: refuses when current status is
  //    'completed' (no further transitions possible).
  // -----------------------------------------------------------------
  it('advance_project_status refuses to advance a completed project', async () => {
    const adminSrv = serverFor('admin', adminUserId);
    const projectId = await makeProject({
      status: 'completed',
      actualStartDate: '2025-01-01',
      actualEndDate: '2025-02-01',
    });

    const handler = getToolHandler(adminSrv, 'advance_project_status');
    const res = await handler({ role: 'admin', projectId });
    expect(textOf(res)).toMatch(/already completed/i);

    // Status untouched.
    const [persisted] = await db
      .select({ status: schema.maintenanceProjects.status })
      .from(schema.maintenanceProjects)
      .where(eq(schema.maintenanceProjects.id, projectId));
    expect(persisted.status).toBe('completed');
  }, 60000);

  // -----------------------------------------------------------------
  // 4. advance_project_status happy path: admin advances
  //    planned → submission, then pre_work → in_progress (which
  //    stamps `actualStartDate`), then post_work → completed (which
  //    stamps `actualEndDate`).
  // -----------------------------------------------------------------
  it('admin can advance through the workflow and the row is persisted with the right date stamps', async () => {
    const adminSrv = serverFor('admin', adminUserId);
    const projectId = await makeProject({ status: 'planned' });
    const advance = getToolHandler(adminSrv, 'advance_project_status');

    // planned → submission (no date stamping).
    const r1 = parseJson<{
      previousStatus: string;
      newStatus: string;
      project: { status: string; actualStartDate: string | null; actualEndDate: string | null };
    }>(await advance({ role: 'admin', projectId }));
    expect(r1.previousStatus).toBe('planned');
    expect(r1.newStatus).toBe('submission');
    expect(r1.project.status).toBe('submission');
    expect(r1.project.actualStartDate).toBeNull();
    expect(r1.project.actualEndDate).toBeNull();

    // Park at pre_work to make the next call deterministic and exercise
    // the in_progress branch.
    await db
      .update(schema.maintenanceProjects)
      .set({ status: 'pre_work', actualStartDate: null, updatedAt: new Date() })
      .where(eq(schema.maintenanceProjects.id, projectId));

    const today = new Date().toISOString().split('T')[0];
    const r2 = parseJson<{
      previousStatus: string;
      newStatus: string;
      project: { status: string; actualStartDate: string | null };
    }>(await advance({ role: 'admin', projectId }));
    expect(r2.previousStatus).toBe('pre_work');
    expect(r2.newStatus).toBe('in_progress');
    expect(r2.project.actualStartDate).toBe(today);

    // Park at post_work to drive the final completed transition (which
    // stamps `actualEndDate`).
    await db
      .update(schema.maintenanceProjects)
      .set({ status: 'post_work', actualEndDate: null, updatedAt: new Date() })
      .where(eq(schema.maintenanceProjects.id, projectId));

    const r3 = parseJson<{
      previousStatus: string;
      newStatus: string;
      project: { status: string; actualEndDate: string | null };
    }>(await advance({ role: 'admin', projectId }));
    expect(r3.previousStatus).toBe('post_work');
    expect(r3.newStatus).toBe('completed');
    expect(r3.project.actualEndDate).toBe(today);

    // Persisted row matches.
    const [persisted] = await db
      .select({
        status: schema.maintenanceProjects.status,
        actualEndDate: schema.maintenanceProjects.actualEndDate,
      })
      .from(schema.maintenanceProjects)
      .where(eq(schema.maintenanceProjects.id, projectId));
    expect(persisted.status).toBe('completed');
    expect(persisted.actualEndDate).toBe(today);
  }, 90000);

  // -----------------------------------------------------------------
  // 5. list_allowed_reopen_targets: returns the previously-completed
  //    statuses for a manager-scoped project. At `in_progress` those
  //    are exactly ['planned', 'submission', 'pre_work'].
  // -----------------------------------------------------------------
  it('list_allowed_reopen_targets returns previously-completed statuses (manager role)', async () => {
    const mgrSrv = serverFor('manager', managerUserId);
    const projectId = await makeProject({
      status: 'in_progress',
      actualStartDate: '2025-04-01',
    });

    const handler = getToolHandler(mgrSrv, 'list_allowed_reopen_targets');
    const res = parseJson<{ currentStatus: string; allowedTargets: string[] }>(
      await handler({ role: 'manager', projectId }),
    );

    expect(res.currentStatus).toBe('in_progress');
    expect(res.allowedTargets).toEqual(['planned', 'submission', 'pre_work']);
  }, 60000);

  // -----------------------------------------------------------------
  // 6. reopen_project_status happy path: admin reopens an in_progress
  //    project back to `submission`. Confirms:
  //      • the row's status drops back,
  //      • `actualStartDate` is cleared (target is before in_progress),
  //      • `actualCost` is recalculated from the remaining completed
  //        phases (none after reopen → 0.00),
  //      • previously-sent project notifications get their `is_sent`
  //        flag flipped to false (resetDownstreamArtifacts).
  // -----------------------------------------------------------------
  it('admin can reopen to a previous status and downstream phase data + actualCost are reset', async () => {
    const adminSrv = serverFor('admin', adminUserId);
    const projectId = await makeProject({
      status: 'in_progress',
      actualStartDate: '2025-04-01',
      actualCost: '1300.00', // pretend the previous flow recorded a cost
    });

    // Add a preferred submission vendor (would contribute to actualCost
    // *if* submission counted as completed after reopen — it won't,
    // because reopening to `submission` makes that the current status).
    const vendorId = crypto.randomUUID();
    await db.insert(schema.submissionVendors).values({
      id: vendorId,
      projectId,
      vendorName: `${TEST_TAG} vendor`,
      projectType: 'repair',
      price: '1000.00',
      preferred: true,
    });
    created.submissionVendorIds.add(vendorId);

    // Add completed pre_work + in_progress tasks so we can prove the
    // reopen recalculation drops them (target is before pre_work in
    // the cost-inclusion logic — only completed phases or the current
    // phase contribute).
    const preWorkTaskId = crypto.randomUUID();
    const inProgressTaskId = crypto.randomUUID();
    await db.insert(schema.workflowTasks).values([
      {
        id: preWorkTaskId,
        projectId,
        phase: 'pre_work',
        taskName: `${TEST_TAG} pre task`,
        cost: '100.00',
        isCompleted: true,
        orderIndex: 0,
      },
      {
        id: inProgressTaskId,
        projectId,
        phase: 'in_progress',
        taskName: `${TEST_TAG} in task`,
        cost: '200.00',
        isCompleted: true,
        orderIndex: 0,
      },
    ]);
    created.workflowTaskIds.add(preWorkTaskId);
    created.workflowTaskIds.add(inProgressTaskId);

    // Pre-existing project notification marked `is_sent=true` — should
    // be flipped to false by `resetDownstreamArtifacts`.
    const notificationId = crypto.randomUUID();
    await db.insert(schema.projectNotifications).values({
      id: notificationId,
      projectId,
      messageText: `${TEST_TAG} notification`,
      timingType: 'one_week_before',
      isSent: true,
    });
    created.notificationIds.add(notificationId);

    // Reopen in_progress → submission.
    const handler = getToolHandler(adminSrv, 'reopen_project_status');
    const res = parseJson<{
      previousStatus: string;
      newStatus: string;
      workflowState: { currentStatus: string; nextStatus: string | null };
    }>(
      await handler({
        role: 'admin',
        projectId,
        targetStatus: 'submission',
        reason: `${TEST_TAG} testing reopen`,
      }),
    );

    expect(res.previousStatus).toBe('in_progress');
    expect(res.newStatus).toBe('submission');
    expect(res.workflowState.currentStatus).toBe('submission');
    // From submission, the next non-skipped status is `pre_work`.
    expect(res.workflowState.nextStatus).toBe('pre_work');

    // Persisted row: status reverted, actualStartDate cleared, cost
    // recalculated. With currentStatus='submission' the cost-inclusion
    // logic includes neither submission cost (only counted when
    // submission is completed) nor any task phase costs (none of
    // pre_work/in_progress/post_work is completed or current), so
    // actualCost collapses to 0.00.
    const [persisted] = await db
      .select({
        status: schema.maintenanceProjects.status,
        actualStartDate: schema.maintenanceProjects.actualStartDate,
        actualEndDate: schema.maintenanceProjects.actualEndDate,
        actualCost: schema.maintenanceProjects.actualCost,
      })
      .from(schema.maintenanceProjects)
      .where(eq(schema.maintenanceProjects.id, projectId));
    expect(persisted.status).toBe('submission');
    expect(persisted.actualStartDate).toBeNull();
    expect(persisted.actualEndDate).toBeNull();
    expect(Number(persisted.actualCost)).toBe(0);

    // resetDownstreamArtifacts must have flipped the previously-sent
    // notification back to is_sent=false so future scheduler passes
    // re-evaluate it.
    const [notif] = await db
      .select({ isSent: schema.projectNotifications.isSent })
      .from(schema.projectNotifications)
      .where(eq(schema.projectNotifications.id, notificationId));
    expect(notif.isSent).toBe(false);

    // Sanity: workflow task rows themselves are preserved (the
    // reopen helper intentionally keeps progress in future phases —
    // the comment in resetDownstreamArtifacts is explicit about this).
    const remainingTasks = await db
      .select({ id: schema.workflowTasks.id })
      .from(schema.workflowTasks)
      .where(eq(schema.workflowTasks.projectId, projectId));
    expect(remainingTasks.map((t) => t.id).sort()).toEqual(
      [preWorkTaskId, inProgressTaskId].sort(),
    );
  }, 90000);

  // -----------------------------------------------------------------
  // 7. reopen_project_status: rejects a target that is not in the
  //    allowed list (e.g. `post_work` for an in_progress project).
  // -----------------------------------------------------------------
  it('reopen_project_status rejects a disallowed targetStatus and writes nothing', async () => {
    const adminSrv = serverFor('admin', adminUserId);
    const projectId = await makeProject({
      status: 'in_progress',
      actualStartDate: '2025-04-01',
    });

    const handler = getToolHandler(adminSrv, 'reopen_project_status');
    const res = await handler({
      role: 'admin',
      projectId,
      targetStatus: 'post_work', // future status — never allowed
    });
    // workflowService.reopenToPhase throws "Cannot reopen to ..." which
    // bubbles up via buildWriteErrorResponse.
    expect(textOf(res)).toMatch(/Cannot reopen|reopen|update/i);

    // Project untouched.
    const [persisted] = await db
      .select({
        status: schema.maintenanceProjects.status,
        actualStartDate: schema.maintenanceProjects.actualStartDate,
      })
      .from(schema.maintenanceProjects)
      .where(eq(schema.maintenanceProjects.id, projectId));
    expect(persisted.status).toBe('in_progress');
    expect(persisted.actualStartDate).toBe('2025-04-01');
  }, 60000);
});
