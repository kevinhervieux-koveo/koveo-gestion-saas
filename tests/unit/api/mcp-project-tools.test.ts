/**
 * Task #315 — Mocked unit-test coverage for the eight maintenance-project
 * MCP tools registered in `server/mcp/server.ts` by Task #302:
 *
 *   list_projects, get_project,
 *   create_project, update_project, advance_project_status,
 *   add_project_task, update_project_task, assign_project_vendor.
 *
 * These tests are intentionally hermetic — `db` and `workflow-service`
 * are mocked so the suite can run on the project's default jsdom Jest
 * config without any database. They exercise:
 *
 *   1. Role gating — tenants are denied every write tool, admins/managers
 *      are not blocked by the role check.
 *   2. MCP-org scope guards — a building / project that is not in the
 *      MCP-allowlisted orgs (`MCP-1` / `MCP-2`) is refused with the same
 *      message all eight tools share.
 *   3. `advance_project_status` delegates to
 *      `workflowService.getProjectWorkflowState` (and short-circuits when
 *      the workflow refuses to progress) — same contract the REST handler
 *      uses.
 *   4. Write tools surface `buildWriteErrorResponse` (FK / unique
 *      violations) instead of leaking the raw driver error.
 *
 * Companion real-Postgres happy-path coverage lives in
 * `tests/integration/mcp/project-tools.test.ts`.
 */

import { describe, it, expect, beforeEach, beforeAll, jest } from '@jest/globals';
import * as schema from '@shared/schema';

// ---------------------------------------------------------------------------
// Hermetic db + workflow-service mock. Mirrors the pattern used by
// `server/tests/mcp-tools.test.ts` so the test stays config-portable: the
// project tools only need select/insert/update — there is no transaction.
// ---------------------------------------------------------------------------
function createWhereResult(value: unknown[] = []) {
  const result = Promise.resolve(value);
  (result as Record<string, unknown>).limit = jest.fn().mockResolvedValue(value);
  (result as Record<string, unknown>).orderBy = jest.fn().mockResolvedValue(value);
  return result;
}

const mockSelectChain = {
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockImplementation(() => createWhereResult([])),
  innerJoin: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockResolvedValue([]),
  limit: jest.fn().mockResolvedValue([]),
};
const mockInsertChain = {
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([{}]),
};
const mockUpdateChain = {
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([{}]),
};
const mockDb = {
  select: jest.fn().mockReturnValue(mockSelectChain),
  insert: jest.fn().mockReturnValue(mockInsertChain),
  update: jest.fn().mockReturnValue(mockUpdateChain),
  delete: jest.fn(),
};

jest.mock('../../../server/db', () => ({ db: mockDb }));

// `workflow-service` is the only collaborator that the MCP project tools
// hit besides `db`. Stub it so the test can assert delegation explicitly.
const mockGetProjectWorkflowState = jest.fn();
const mockGetAllowedReopenTargets = jest.fn();
const mockReopenToPhase = jest.fn();
jest.mock('../../../server/services/workflow-service', () => ({
  workflowService: {
    getProjectWorkflowState: (...args: unknown[]) => mockGetProjectWorkflowState(...args),
    getAllowedReopenTargets: (...args: unknown[]) => mockGetAllowedReopenTargets(...args),
    reopenToPhase: (...args: unknown[]) => mockReopenToPhase(...args),
  },
}));

// The MCP server module imports a bunch of unrelated heavy services at
// the top of the file. Stub them out so this unit test can boot without
// pulling in object storage, AI, etc.
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

import { createMcpServer } from '../../../server/mcp/server';

interface ToolResult {
  content?: Array<{ type?: string; text?: string }>;
}

function getToolHandler(
  server: ReturnType<typeof createMcpServer>,
  toolName: string,
): (args: Record<string, unknown>, extra?: unknown) => Promise<ToolResult> {
  const tools = (server as unknown as {
    _registeredTools: Record<string, { handler?: unknown; callback?: unknown }>;
  })._registeredTools;
  if (!tools || !tools[toolName]) throw new Error(`Tool "${toolName}" not registered`);
  const fn = (tools[toolName].handler ?? tools[toolName].callback) as
    | ((args: Record<string, unknown>, extra?: unknown) => Promise<ToolResult>)
    | undefined;
  if (typeof fn !== 'function') throw new Error(`Tool "${toolName}" handler missing`);
  return fn;
}

function textOf(result: ToolResult): string {
  return result?.content?.[0]?.text ?? '';
}

// `loadMcpScopedProject` issues 3 selects in this order:
//   1. getMcpOrgIds         → orgs
//   2. select project where → project row
//   3. select building where → building row
function queueScopedProjectLookup(opts: {
  orgs?: Array<{ id: string }>;
  project?: Record<string, unknown> | null;
  building?: Record<string, unknown> | null;
}) {
  mockSelectChain.where
    .mockImplementationOnce(() => createWhereResult(opts.orgs ?? [{ id: 'mcp-org-1' }]))
    .mockImplementationOnce(() => createWhereResult(opts.project ? [opts.project] : []))
    .mockImplementationOnce(() => createWhereResult(opts.building ? [opts.building] : []));
}

const PG_FK_VIOLATION = (() => {
  const e = new Error('insert or update on table "x" violates foreign key constraint "fk"');
  (e as Error & { code?: string; detail?: string }).code = '23503';
  (e as Error & { code?: string; detail?: string }).detail =
    'Key (project_id)=(p-1) is not present in table "maintenance_projects".';
  return e;
})();
const PG_UNIQUE_VIOLATION = (() => {
  const e = new Error('duplicate key value violates unique constraint "uq"');
  (e as Error & { code?: string }).code = '23505';
  return e;
})();

describe('MCP project tools — Task #315 mocked unit tests', () => {
  let server: ReturnType<typeof createMcpServer>;

  beforeAll(() => {
    server = createMcpServer();
  });

  beforeEach(() => {
    // mockReset (not clearAllMocks) so any leftover `mockImplementationOnce`
    // queue from a prior test cannot bleed over. clearAllMocks only clears
    // mock.calls — leftover queued impls would silently shift the
    // `mockSelectChain.where` sequence and cascade into spurious "Access
    // denied" responses on the next test.
    mockSelectChain.from.mockReset().mockReturnThis();
    mockSelectChain.where.mockReset().mockImplementation(() => createWhereResult([]));
    mockSelectChain.innerJoin.mockReset().mockReturnThis();
    mockSelectChain.leftJoin.mockReset().mockReturnThis();
    mockSelectChain.orderBy.mockReset().mockResolvedValue([]);
    mockSelectChain.limit.mockReset().mockResolvedValue([]);
    mockDb.select.mockReset().mockReturnValue(mockSelectChain);
    mockInsertChain.values.mockReset().mockReturnThis();
    mockInsertChain.returning.mockReset().mockResolvedValue([{}]);
    mockDb.insert.mockReset().mockReturnValue(mockInsertChain);
    mockUpdateChain.set.mockReset().mockReturnThis();
    mockUpdateChain.where.mockReset().mockReturnThis();
    mockUpdateChain.returning.mockReset().mockResolvedValue([{}]);
    mockDb.update.mockReset().mockReturnValue(mockUpdateChain);
    mockGetProjectWorkflowState.mockReset();
    mockGetAllowedReopenTargets.mockReset();
    mockReopenToPhase.mockReset();
  });

  // ===========================================================================
  // Tool registration sanity check (regression guard against renames)
  // ===========================================================================
  it('registers all eight project tools', () => {
    const tools = (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools;
    for (const name of [
      'list_projects',
      'get_project',
      'create_project',
      'update_project',
      'advance_project_status',
      'add_project_task',
      'update_project_task',
      'assign_project_vendor',
    ]) {
      expect(tools[name]).toBeDefined();
    }
  });

  // Task #528 — `list_allowed_reopen_targets` is the additional
  // project-related read tool that shares `loadMcpScopedProject` with
  // the eight tools above and was not covered by Task #315.
  it('registers list_allowed_reopen_targets (Task #528 read-tool coverage)', () => {
    const tools = (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools;
    expect(tools.list_allowed_reopen_targets).toBeDefined();
  });

  // Task #561 — `reopen_project_status` is the write counterpart to
  // `list_allowed_reopen_targets` and shares the same scope helper.
  it('registers reopen_project_status (Task #561 write-tool coverage)', () => {
    const tools = (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools;
    expect(tools.reopen_project_status).toBeDefined();
  });

  // ===========================================================================
  // 1. Role gating: tenants denied write ops, reads still work for tenants
  // ===========================================================================
  describe('role gating', () => {
    const writeCases: Array<{ tool: string; args: Record<string, unknown>; deny: RegExp }> = [
      {
        tool: 'create_project',
        args: { role: 'tenant', buildingId: 'b-1', title: 'Test' },
        deny: /tenants cannot create projects/i,
      },
      {
        tool: 'update_project',
        args: { role: 'tenant', projectId: 'p-1', title: 'X' },
        deny: /tenants cannot update projects/i,
      },
      {
        tool: 'advance_project_status',
        args: { role: 'tenant', projectId: 'p-1' },
        deny: /tenants cannot advance project status/i,
      },
      {
        tool: 'add_project_task',
        args: { role: 'tenant', projectId: 'p-1', phase: 'pre_work', taskName: 't' },
        deny: /tenants cannot add project tasks/i,
      },
      {
        tool: 'update_project_task',
        args: { role: 'tenant', taskId: 't-1', taskName: 'x' },
        deny: /tenants cannot update project tasks/i,
      },
      {
        tool: 'assign_project_vendor',
        args: { role: 'tenant', projectId: 'p-1', vendorName: 'V', projectType: 'repair' },
        deny: /tenants cannot assign vendors to projects/i,
      },
      {
        tool: 'reopen_project_status',
        args: { role: 'tenant', projectId: 'p-1', targetStatus: 'planned' },
        deny: /tenants cannot reopen project status/i,
      },
    ];

    it.each(writeCases)('denies tenant on $tool before any DB call', async ({ tool, args, deny }) => {
      const handler = getToolHandler(server, tool);
      const result = await handler(args, {});
      expect(textOf(result)).toMatch(deny);
      // Tenant short-circuit must run BEFORE any DB call so the rejection
      // is unconditional regardless of project state.
      expect(mockDb.select).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    // Spot-check that manager (the *other* allowed role beside admin) can
    // pass the role-gate on a write tool. Most write paths in this suite
    // exercise role:'admin'; this test pins the documented "admin OR
    // manager" allowance so a future refactor that accidentally
    // narrowed it to admin-only would fail loudly here.
    it('allows manager role on update_project (write path reaches the DB)', async () => {
      queueScopedProjectLookup({
        project: { id: 'p-1', buildingId: 'b-1', status: 'planned' },
        building: { id: 'b-1', organizationId: 'mcp-org-1' },
      });
      mockUpdateChain.returning.mockResolvedValueOnce([
        { id: 'p-1', title: 'Edited by manager' },
      ]);
      const handler = getToolHandler(server, 'update_project');
      const result = await handler(
        { role: 'manager', projectId: 'p-1', title: 'Edited by manager' },
        {},
      );
      expect(textOf(result)).not.toMatch(/Access denied/);
      expect(mockDb.update).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(textOf(result));
      expect(parsed.title).toBe('Edited by manager');
    });

    it('list_projects is allowed for tenants (read-only tool)', async () => {
      // The list query is `select(...).from(...).where(and(...)).orderBy(...)`.
      // `.orderBy` lives on the result of `.where`, so we have to seed it
      // there — overriding the chain-level `orderBy` won't fire.
      const projectRow = {
        id: 'p-1',
        projectNumber: 'P-001',
        title: 'Roof',
        status: 'planned',
      };
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'mcp-org-1' }])) // orgs
        .mockImplementationOnce(() =>
          createWhereResult([{ id: 'b-1', organizationId: 'mcp-org-1' }]),
        ) // building
        .mockImplementationOnce(() => {
          const result = Promise.resolve([projectRow]);
          (result as Record<string, unknown>).orderBy = jest.fn().mockResolvedValue([projectRow]);
          return result;
        });
      const handler = getToolHandler(server, 'list_projects');
      const result = await handler({ role: 'tenant', buildingId: 'b-1' }, {});
      const text = textOf(result);
      expect(text).not.toMatch(/Access denied/);
      expect(text).toContain('P-001');
    });

    it('get_project is allowed for tenants (read-only tool)', async () => {
      queueScopedProjectLookup({
        project: { id: 'p-1', buildingId: 'b-1', status: 'planned', title: 'Roof' },
        building: { id: 'b-1', organizationId: 'mcp-org-1' },
      });
      // 4th select inside get_project loads the project_steps list.
      mockSelectChain.where.mockImplementationOnce(() => createWhereResult([]));
      mockGetProjectWorkflowState.mockResolvedValue({ canProgress: true, nextStatus: 'submission' });
      const handler = getToolHandler(server, 'get_project');
      const result = await handler({ role: 'tenant', projectId: 'p-1' }, {});
      const text = textOf(result);
      expect(text).not.toMatch(/Access denied/);
      const parsed = JSON.parse(text);
      expect(parsed.project.id).toBe('p-1');
    });
  });

  // ===========================================================================
  // 2. MCP-org scope guards
  // ===========================================================================
  describe('MCP-org scope guards', () => {
    it('list_projects refuses a building outside the MCP scope', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'mcp-org-1' }]))
        .mockImplementationOnce(() => createWhereResult([{ id: 'b-x', organizationId: 'other-org' }]));
      const handler = getToolHandler(server, 'list_projects');
      const result = await handler({ role: 'admin', buildingId: 'b-x' }, {});
      expect(textOf(result)).toMatch(/Building not found or access denied/);
    });

    it('list_projects refuses when the building does not exist', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'mcp-org-1' }]))
        .mockImplementationOnce(() => createWhereResult([]));
      const handler = getToolHandler(server, 'list_projects');
      const result = await handler({ role: 'admin', buildingId: 'missing' }, {});
      expect(textOf(result)).toMatch(/Building not found or access denied/);
    });

    it('create_project refuses a building outside the MCP scope (admin role)', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'mcp-org-1' }]))
        .mockImplementationOnce(() => createWhereResult([{ id: 'b-x', organizationId: 'other-org' }]));
      const handler = getToolHandler(server, 'create_project');
      const result = await handler(
        { role: 'admin', buildingId: 'b-x', title: 'New' },
        {},
      );
      expect(textOf(result)).toMatch(/Building not found or access denied/);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    // The remaining six tools share `loadMcpScopedProject`, so the same
    // 3-select sequence governs scope rejection for all of them.
    const scopeCases: Array<{ tool: string; args: Record<string, unknown> }> = [
      { tool: 'get_project', args: { role: 'admin', projectId: 'p-1' } },
      { tool: 'update_project', args: { role: 'admin', projectId: 'p-1', title: 'X' } },
      { tool: 'advance_project_status', args: { role: 'admin', projectId: 'p-1' } },
      {
        tool: 'add_project_task',
        args: { role: 'admin', projectId: 'p-1', phase: 'pre_work', taskName: 't' },
      },
      {
        tool: 'assign_project_vendor',
        args: { role: 'admin', projectId: 'p-1', vendorName: 'V', projectType: 'repair' },
      },
      {
        tool: 'reopen_project_status',
        args: { role: 'admin', projectId: 'p-1', targetStatus: 'planned' },
      },
    ];
    it.each(scopeCases)(
      '$tool refuses a project whose building is outside the MCP scope',
      async ({ tool, args }) => {
        queueScopedProjectLookup({
          project: { id: 'p-1', buildingId: 'b-x', status: 'planned' },
          building: { id: 'b-x', organizationId: 'other-org' },
        });
        const handler = getToolHandler(server, tool);
        const result = await handler(args, {});
        expect(textOf(result)).toMatch(/project is not attached to an MCP-scoped building/);
        expect(mockDb.insert).not.toHaveBeenCalled();
        expect(mockDb.update).not.toHaveBeenCalled();
      },
    );

    it('update_project_task refuses when the parent project is outside the MCP scope', async () => {
      // First select: lookup of the workflow_task by id (returns its
      // projectId so loadMcpScopedProject can be called against it).
      mockSelectChain.where.mockImplementationOnce(() =>
        createWhereResult([{ id: 't-1', projectId: 'p-1' }]),
      );
      queueScopedProjectLookup({
        project: { id: 'p-1', buildingId: 'b-x', status: 'planned' },
        building: { id: 'b-x', organizationId: 'other-org' },
      });
      const handler = getToolHandler(server, 'update_project_task');
      const result = await handler({ role: 'admin', taskId: 't-1', taskName: 'X' }, {});
      expect(textOf(result)).toMatch(/project is not attached to an MCP-scoped building/);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('update_project_task refuses when the workflow task does not exist', async () => {
      mockSelectChain.where.mockImplementationOnce(() => createWhereResult([]));
      const handler = getToolHandler(server, 'update_project_task');
      const result = await handler({ role: 'admin', taskId: 'missing', taskName: 'X' }, {});
      expect(textOf(result)).toMatch(/Task not found: missing/);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('get_project / update_project / advance_project_status refuse a missing project', async () => {
      for (const tool of ['get_project', 'update_project', 'advance_project_status'] as const) {
        jest.clearAllMocks();
        mockSelectChain.where
          .mockImplementationOnce(() => createWhereResult([{ id: 'mcp-org-1' }]))
          .mockImplementationOnce(() => createWhereResult([])); // project lookup → empty
        const handler = getToolHandler(server, tool);
        const args =
          tool === 'update_project'
            ? { role: 'admin', projectId: 'missing', title: 'X' }
            : { role: 'admin', projectId: 'missing' };
        const result = await handler(args, {});
        expect(textOf(result)).toMatch(/Project not found: missing/);
      }
    });
  });

  // ===========================================================================
  // 3. advance_project_status delegates to workflowService and short-circuits
  //    when the workflow refuses to progress.
  // ===========================================================================
  describe('advance_project_status — workflowService delegation', () => {
    it('asks workflowService.getProjectWorkflowState for the next status and writes it', async () => {
      queueScopedProjectLookup({
        project: { id: 'p-1', buildingId: 'b-1', status: 'planned' },
        building: { id: 'b-1', organizationId: 'mcp-org-1' },
      });
      mockGetProjectWorkflowState.mockResolvedValue({
        canProgress: true,
        nextStatus: 'submission',
      });
      mockUpdateChain.returning.mockResolvedValueOnce([
        { id: 'p-1', status: 'submission' },
      ]);

      const handler = getToolHandler(server, 'advance_project_status');
      const result = await handler({ role: 'admin', projectId: 'p-1' }, {});

      expect(mockGetProjectWorkflowState).toHaveBeenCalledTimes(1);
      expect(mockGetProjectWorkflowState).toHaveBeenCalledWith('p-1');
      const parsed = JSON.parse(textOf(result));
      expect(parsed.previousStatus).toBe('planned');
      expect(parsed.newStatus).toBe('submission');
      expect(parsed.project.status).toBe('submission');
    });

    it('refuses to advance when workflowService says canProgress=false', async () => {
      queueScopedProjectLookup({
        project: { id: 'p-1', buildingId: 'b-1', status: 'planned' },
        building: { id: 'b-1', organizationId: 'mcp-org-1' },
      });
      mockGetProjectWorkflowState.mockResolvedValue({
        canProgress: false,
        nextStatus: null,
      });
      const handler = getToolHandler(server, 'advance_project_status');
      const result = await handler({ role: 'admin', projectId: 'p-1' }, {});
      expect(textOf(result)).toMatch(/Cannot advance from current status/);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('refuses to advance a project that is already completed (no workflow lookup needed)', async () => {
      queueScopedProjectLookup({
        project: { id: 'p-1', buildingId: 'b-1', status: 'completed' },
        building: { id: 'b-1', organizationId: 'mcp-org-1' },
      });
      const handler = getToolHandler(server, 'advance_project_status');
      const result = await handler({ role: 'admin', projectId: 'p-1' }, {});
      expect(textOf(result)).toMatch(/already completed/i);
      expect(mockGetProjectWorkflowState).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('stamps actualStartDate when advancing into in_progress', async () => {
      queueScopedProjectLookup({
        project: { id: 'p-1', buildingId: 'b-1', status: 'pre_work' },
        building: { id: 'b-1', organizationId: 'mcp-org-1' },
      });
      mockGetProjectWorkflowState.mockResolvedValue({
        canProgress: true,
        nextStatus: 'in_progress',
      });
      mockUpdateChain.returning.mockResolvedValueOnce([
        { id: 'p-1', status: 'in_progress' },
      ]);
      const handler = getToolHandler(server, 'advance_project_status');
      await handler({ role: 'admin', projectId: 'p-1' }, {});
      const setArg = (mockUpdateChain.set as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
      expect(setArg.status).toBe('in_progress');
      expect(setArg).toHaveProperty('actualStartDate');
      expect(setArg).not.toHaveProperty('actualEndDate');
    });

    it('stamps actualEndDate when advancing into completed', async () => {
      queueScopedProjectLookup({
        project: { id: 'p-1', buildingId: 'b-1', status: 'post_work' },
        building: { id: 'b-1', organizationId: 'mcp-org-1' },
      });
      mockGetProjectWorkflowState.mockResolvedValue({
        canProgress: true,
        nextStatus: 'completed',
      });
      mockUpdateChain.returning.mockResolvedValueOnce([
        { id: 'p-1', status: 'completed' },
      ]);
      const handler = getToolHandler(server, 'advance_project_status');
      await handler({ role: 'admin', projectId: 'p-1' }, {});
      const setArg = (mockUpdateChain.set as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
      expect(setArg.status).toBe('completed');
      expect(setArg).toHaveProperty('actualEndDate');
      expect(setArg).not.toHaveProperty('actualStartDate');
    });

    it('returns a sanitized error response when workflowService throws', async () => {
      queueScopedProjectLookup({
        project: { id: 'p-1', buildingId: 'b-1', status: 'planned' },
        building: { id: 'b-1', organizationId: 'mcp-org-1' },
      });
      // Suppress the expected console.error from the production handler so
      // the test output stays clean.
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockGetProjectWorkflowState.mockRejectedValue(PG_FK_VIOLATION);
      const handler = getToolHandler(server, 'advance_project_status');
      const result = await handler({ role: 'admin', projectId: 'p-1' }, {});
      const parsed = JSON.parse(textOf(result));
      expect(parsed.code).toBe('FK_VIOLATION');
      errSpy.mockRestore();
    });
  });

  // ===========================================================================
  // 4. Write tools surface buildWriteErrorResponse on FK / unique violations.
  // ===========================================================================
  describe('buildWriteErrorResponse on FK / unique violations', () => {
    let errSpy: jest.SpiedFunction<typeof console.error>;
    beforeEach(() => {
      errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    function runWithThrow(setup: () => void, throwIn: 'insert' | 'update', err: Error) {
      setup();
      if (throwIn === 'insert') {
        mockInsertChain.returning.mockImplementationOnce(() => Promise.reject(err));
      } else {
        mockUpdateChain.returning.mockImplementationOnce(() => Promise.reject(err));
      }
    }

    it('create_project returns FK_VIOLATION on a 23503 from the insert', async () => {
      // create_project doesn't go through loadMcpScopedProject — its scope
      // check is direct (orgIds + building). It then calls getMcpUser
      // which issues a `.where(...).limit(1)` on the same chain. The
      // `.limit` lives on the where-result, so we have to set it there.
      runWithThrow(
        () => {
          mockSelectChain.where
            .mockImplementationOnce(() => createWhereResult([{ id: 'mcp-org-1' }])) // orgs
            .mockImplementationOnce(() =>
              createWhereResult([{ id: 'b-1', organizationId: 'mcp-org-1' }]),
            ) // building
            .mockImplementationOnce(() =>
              // 3rd select is `lookupMcpUser`. The await is on `.limit(1)`,
              // so seed the user there — createWhereResult conveniently
              // wires `.limit` to return whatever array is passed in.
              createWhereResult([{ id: 'mcp-user', role: 'admin' }]),
            );
        },
        'insert',
        PG_FK_VIOLATION,
      );
      const handler = getToolHandler(server, 'create_project');
      const result = await handler(
        { role: 'admin', buildingId: 'b-1', title: 'New' },
        {},
      );
      const parsed = JSON.parse(textOf(result));
      expect(parsed.code).toBe('FK_VIOLATION');
      expect(parsed.message).toMatch(/Cannot create project/i);
    });

    it('update_project returns a unique-violation message on 23505', async () => {
      runWithThrow(
        () => {
          queueScopedProjectLookup({
            project: { id: 'p-1', buildingId: 'b-1', status: 'planned' },
            building: { id: 'b-1', organizationId: 'mcp-org-1' },
          });
        },
        'update',
        PG_UNIQUE_VIOLATION,
      );
      const handler = getToolHandler(server, 'update_project');
      const result = await handler(
        { role: 'admin', projectId: 'p-1', title: 'New title' },
        {},
      );
      const text = textOf(result);
      // 23505 is rendered as a JSON unique-conflict body by
      // buildWriteErrorResponse — assert both the SQLSTATE-derived code
      // and the human message are present.
      expect(text).toMatch(/unique/i);
      expect(text).toMatch(/Cannot update project/i);
    });

    it('add_project_task returns FK_VIOLATION on 23503 from the insert', async () => {
      runWithThrow(
        () => {
          queueScopedProjectLookup({
            project: { id: 'p-1', buildingId: 'b-1', status: 'planned' },
            building: { id: 'b-1', organizationId: 'mcp-org-1' },
          });
          // The handler computes max(orderIndex) via a select-from-where
          // when no orderIndex is supplied. Default mockSelectChain.where
          // returns []. We need to satisfy the .where().then on the
          // aggregate call — its query returns [{ value: maxOrder }] but
          // the handler tolerates an empty array.
          mockSelectChain.where.mockImplementationOnce(() => createWhereResult([]));
        },
        'insert',
        PG_FK_VIOLATION,
      );
      const handler = getToolHandler(server, 'add_project_task');
      const result = await handler(
        {
          role: 'admin',
          projectId: 'p-1',
          phase: 'pre_work',
          taskName: 'New task',
          orderIndex: 0, // skip the max-order select branch
        },
        {},
      );
      const parsed = JSON.parse(textOf(result));
      expect(parsed.code).toBe('FK_VIOLATION');
      expect(parsed.message).toMatch(/Cannot create project task/i);
    });

    it('assign_project_vendor returns FK_VIOLATION on 23503 from the insert', async () => {
      runWithThrow(
        () => {
          queueScopedProjectLookup({
            project: { id: 'p-1', buildingId: 'b-1', status: 'planned' },
            building: { id: 'b-1', organizationId: 'mcp-org-1' },
          });
        },
        'insert',
        PG_FK_VIOLATION,
      );
      const handler = getToolHandler(server, 'assign_project_vendor');
      const result = await handler(
        {
          role: 'admin',
          projectId: 'p-1',
          vendorName: 'Acme',
          projectType: 'repair',
        },
        {},
      );
      const parsed = JSON.parse(textOf(result));
      expect(parsed.code).toBe('FK_VIOLATION');
      expect(parsed.message).toMatch(/Cannot create project vendor submission/i);
    });

    it('update_project_task returns FK_VIOLATION on 23503 from the update', async () => {
      runWithThrow(
        () => {
          mockSelectChain.where.mockImplementationOnce(() =>
            createWhereResult([{ id: 't-1', projectId: 'p-1' }]),
          );
          queueScopedProjectLookup({
            project: { id: 'p-1', buildingId: 'b-1', status: 'planned' },
            building: { id: 'b-1', organizationId: 'mcp-org-1' },
          });
        },
        'update',
        PG_FK_VIOLATION,
      );
      const handler = getToolHandler(server, 'update_project_task');
      const result = await handler(
        { role: 'admin', taskId: 't-1', isCompleted: true },
        {},
      );
      const parsed = JSON.parse(textOf(result));
      expect(parsed.code).toBe('FK_VIOLATION');
      expect(parsed.message).toMatch(/Cannot update project task/i);
    });
  });

  // ===========================================================================
  // Task #528 — `list_allowed_reopen_targets` mocked coverage.
  //
  // This tool is read-only and shares `loadMcpScopedProject` with the
  // eight write/read tools above. It delegates to
  // `workflowService.getAllowedReopenTargets` and surfaces the project's
  // current status alongside the list. The tests below assert:
  //
  //   1. Tenant role is denied before any DB call.
  //   2. The MCP-org scope guard rejects an out-of-scope project (a
  //      regression in `loadMcpScopedProject` would otherwise leak the
  //      project's workflow history into the AI-assistant context).
  //   3. A missing project is reported with the shared
  //      "Project not found" message.
  //   4. The happy path delegates to `workflowService.getAllowedReopenTargets`
  //      with the project id and returns `{ currentStatus, allowedTargets }`.
  //   5. A workflow-service throw is funneled through
  //      `buildWriteErrorResponse` rather than leaking the raw driver
  //      error.
  // ===========================================================================
  describe('list_allowed_reopen_targets — Task #528 read-tool coverage', () => {
    it('denies tenant role before any DB call', async () => {
      const handler = getToolHandler(server, 'list_allowed_reopen_targets');
      const result = await handler({ role: 'tenant', projectId: 'p-1' }, {});
      expect(textOf(result)).toMatch(/tenants cannot view reopen targets/i);
      expect(mockDb.select).not.toHaveBeenCalled();
      expect(mockGetAllowedReopenTargets).not.toHaveBeenCalled();
    });

    it('refuses a project whose building is outside the MCP scope', async () => {
      queueScopedProjectLookup({
        project: { id: 'p-1', buildingId: 'b-x', status: 'in_progress' },
        building: { id: 'b-x', organizationId: 'other-org' },
      });
      const handler = getToolHandler(server, 'list_allowed_reopen_targets');
      const result = await handler({ role: 'admin', projectId: 'p-1' }, {});
      expect(textOf(result)).toMatch(/project is not attached to an MCP-scoped building/);
      expect(mockGetAllowedReopenTargets).not.toHaveBeenCalled();
    });

    it('refuses a missing project with the shared "Project not found" message', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'mcp-org-1' }]))
        .mockImplementationOnce(() => createWhereResult([])); // project lookup → empty
      const handler = getToolHandler(server, 'list_allowed_reopen_targets');
      const result = await handler({ role: 'admin', projectId: 'missing' }, {});
      expect(textOf(result)).toMatch(/Project not found: missing/);
      expect(mockGetAllowedReopenTargets).not.toHaveBeenCalled();
    });

    it('returns currentStatus + allowedTargets from workflowService.getAllowedReopenTargets', async () => {
      queueScopedProjectLookup({
        project: { id: 'p-1', buildingId: 'b-1', status: 'in_progress' },
        building: { id: 'b-1', organizationId: 'mcp-org-1' },
      });
      mockGetAllowedReopenTargets.mockResolvedValueOnce(['planned', 'submission', 'pre_work']);

      const handler = getToolHandler(server, 'list_allowed_reopen_targets');
      const result = await handler({ role: 'admin', projectId: 'p-1' }, {});
      expect(mockGetAllowedReopenTargets).toHaveBeenCalledTimes(1);
      expect(mockGetAllowedReopenTargets).toHaveBeenCalledWith('p-1');
      const parsed = JSON.parse(textOf(result));
      expect(parsed.currentStatus).toBe('in_progress');
      expect(parsed.allowedTargets).toEqual(['planned', 'submission', 'pre_work']);
    });

    it('manager role is allowed (parity with admin) and reaches the workflow service', async () => {
      queueScopedProjectLookup({
        project: { id: 'p-1', buildingId: 'b-1', status: 'completed' },
        building: { id: 'b-1', organizationId: 'mcp-org-1' },
      });
      mockGetAllowedReopenTargets.mockResolvedValueOnce(['post_work']);
      const handler = getToolHandler(server, 'list_allowed_reopen_targets');
      const result = await handler({ role: 'manager', projectId: 'p-1' }, {});
      expect(textOf(result)).not.toMatch(/Access denied/);
      const parsed = JSON.parse(textOf(result));
      expect(parsed.currentStatus).toBe('completed');
      expect(parsed.allowedTargets).toEqual(['post_work']);
    });

    it('returns a sanitized error response when workflowService throws', async () => {
      queueScopedProjectLookup({
        project: { id: 'p-1', buildingId: 'b-1', status: 'in_progress' },
        building: { id: 'b-1', organizationId: 'mcp-org-1' },
      });
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockGetAllowedReopenTargets.mockRejectedValueOnce(PG_FK_VIOLATION);
      const handler = getToolHandler(server, 'list_allowed_reopen_targets');
      const result = await handler({ role: 'admin', projectId: 'p-1' }, {});
      const parsed = JSON.parse(textOf(result));
      expect(parsed.code).toBe('FK_VIOLATION');
      expect(parsed.message).toMatch(/Cannot update project/i);
      errSpy.mockRestore();
    });
  });

  // ===========================================================================
  // Task #561 — `reopen_project_status` mocked coverage.
  //
  // The write counterpart to `list_allowed_reopen_targets`. Shares
  // `loadMcpScopedProject` with the existing project tools and
  // delegates the actual mutation to `workflowService.reopenToPhase`,
  // which validates the targetStatus against `getAllowedReopenTargets`
  // and then resets downstream phase artifacts / date columns. The
  // tests below assert:
  //
  //   1. Tenant role is denied before any DB call (covered above in
  //      the parametrised `writeCases` table — repeated here as a
  //      narrowly-scoped guard so `mockReopenToPhase` is verified
  //      untouched).
  //   2. The MCP-org scope guard rejects an out-of-scope project
  //      (also exercised in `scopeCases`, repeated here to assert
  //      `reopenToPhase` is never called when scope rejects).
  //   3. A missing project surfaces the shared "Project not found"
  //      message before delegation.
  //   4. The happy path delegates to `workflowService.reopenToPhase`
  //      with `(projectId, targetStatus, reason)` and returns
  //      `{ previousStatus, newStatus, workflowState }` where
  //      `previousStatus` is the project's current status (captured
  //      *before* the mutation).
  //   5. The `reason` argument is forwarded verbatim and is optional
  //      (omitting it must call `reopenToPhase` with `undefined`).
  //   6. Manager role is allowed (parity with admin).
  //   7. Errors thrown by `reopenToPhase` (e.g. the "Cannot reopen to
  //      X. Allowed targets: ..." validation thrown when the AI
  //      assistant requests a non-allowed targetStatus, or a raw
  //      driver FK violation) are funneled through
  //      `buildWriteErrorResponse` rather than leaking the raw
  //      driver error.
  // ===========================================================================
  describe('reopen_project_status — Task #561 write-tool coverage', () => {
    it('denies tenant role before any DB call (and never calls reopenToPhase)', async () => {
      const handler = getToolHandler(server, 'reopen_project_status');
      const result = await handler(
        { role: 'tenant', projectId: 'p-1', targetStatus: 'planned' },
        {},
      );
      expect(textOf(result)).toMatch(/tenants cannot reopen project status/i);
      expect(mockDb.select).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(mockReopenToPhase).not.toHaveBeenCalled();
    });

    it('refuses a project whose building is outside the MCP scope', async () => {
      queueScopedProjectLookup({
        project: { id: 'p-1', buildingId: 'b-x', status: 'in_progress' },
        building: { id: 'b-x', organizationId: 'other-org' },
      });
      const handler = getToolHandler(server, 'reopen_project_status');
      const result = await handler(
        { role: 'admin', projectId: 'p-1', targetStatus: 'planned' },
        {},
      );
      expect(textOf(result)).toMatch(/project is not attached to an MCP-scoped building/);
      expect(mockReopenToPhase).not.toHaveBeenCalled();
    });

    it('refuses a missing project with the shared "Project not found" message', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'mcp-org-1' }]))
        .mockImplementationOnce(() => createWhereResult([])); // project lookup → empty
      const handler = getToolHandler(server, 'reopen_project_status');
      const result = await handler(
        { role: 'admin', projectId: 'missing', targetStatus: 'planned' },
        {},
      );
      expect(textOf(result)).toMatch(/Project not found: missing/);
      expect(mockReopenToPhase).not.toHaveBeenCalled();
    });

    it('delegates to workflowService.reopenToPhase with (projectId, targetStatus, reason)', async () => {
      queueScopedProjectLookup({
        project: { id: 'p-1', buildingId: 'b-1', status: 'in_progress' },
        building: { id: 'b-1', organizationId: 'mcp-org-1' },
      });
      const fakeWorkflowState = {
        currentStatus: 'planned',
        completedStatuses: [],
        canProgress: true,
        nextStatus: 'submission',
      };
      mockReopenToPhase.mockResolvedValueOnce(fakeWorkflowState);

      const handler = getToolHandler(server, 'reopen_project_status');
      const result = await handler(
        {
          role: 'admin',
          projectId: 'p-1',
          targetStatus: 'planned',
          reason: 'AI assistant rollback',
        },
        {},
      );

      expect(mockReopenToPhase).toHaveBeenCalledTimes(1);
      expect(mockReopenToPhase).toHaveBeenCalledWith('p-1', 'planned', 'AI assistant rollback');
      const parsed = JSON.parse(textOf(result));
      // previousStatus must reflect the project's status *before* the
      // mutation (captured from loadMcpScopedProject), not whatever
      // the workflowService eventually returns.
      expect(parsed.previousStatus).toBe('in_progress');
      expect(parsed.newStatus).toBe('planned');
      expect(parsed.workflowState).toEqual(fakeWorkflowState);
    });

    it('forwards an undefined reason when the optional argument is omitted', async () => {
      queueScopedProjectLookup({
        project: { id: 'p-1', buildingId: 'b-1', status: 'completed' },
        building: { id: 'b-1', organizationId: 'mcp-org-1' },
      });
      mockReopenToPhase.mockResolvedValueOnce({
        currentStatus: 'post_work',
        completedStatuses: ['planned', 'submission', 'pre_work', 'in_progress'],
        canProgress: true,
        nextStatus: 'completed',
      });
      const handler = getToolHandler(server, 'reopen_project_status');
      await handler(
        { role: 'admin', projectId: 'p-1', targetStatus: 'post_work' },
        {},
      );
      expect(mockReopenToPhase).toHaveBeenCalledWith('p-1', 'post_work', undefined);
    });

    it('manager role is allowed (parity with admin) and reaches the workflow service', async () => {
      queueScopedProjectLookup({
        project: { id: 'p-1', buildingId: 'b-1', status: 'in_progress' },
        building: { id: 'b-1', organizationId: 'mcp-org-1' },
      });
      mockReopenToPhase.mockResolvedValueOnce({
        currentStatus: 'pre_work',
        completedStatuses: ['planned', 'submission'],
        canProgress: true,
        nextStatus: 'in_progress',
      });
      const handler = getToolHandler(server, 'reopen_project_status');
      const result = await handler(
        { role: 'manager', projectId: 'p-1', targetStatus: 'pre_work' },
        {},
      );
      expect(textOf(result)).not.toMatch(/Access denied/);
      expect(mockReopenToPhase).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(textOf(result));
      expect(parsed.previousStatus).toBe('in_progress');
      expect(parsed.newStatus).toBe('pre_work');
    });

    it('returns a sanitized error response when reopenToPhase throws a driver error', async () => {
      queueScopedProjectLookup({
        project: { id: 'p-1', buildingId: 'b-1', status: 'in_progress' },
        building: { id: 'b-1', organizationId: 'mcp-org-1' },
      });
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockReopenToPhase.mockRejectedValueOnce(PG_FK_VIOLATION);
      const handler = getToolHandler(server, 'reopen_project_status');
      const result = await handler(
        { role: 'admin', projectId: 'p-1', targetStatus: 'planned' },
        {},
      );
      const parsed = JSON.parse(textOf(result));
      expect(parsed.code).toBe('FK_VIOLATION');
      expect(parsed.message).toMatch(/Cannot update project/i);
      // The raw driver error must NOT leak through.
      expect(textOf(result)).not.toMatch(/violates foreign key constraint/);
      errSpy.mockRestore();
    });

    it('surfaces the workflowService validation error when targetStatus is not allowed', async () => {
      // workflowService.reopenToPhase throws "Cannot reopen to X.
      // Allowed targets: ..." when the AI assistant tries to revert
      // a project to a status that wasn't in the allowed list. The
      // MCP handler must surface a sanitized response (no raw error
      // leaking through) — this is the regression the task brief
      // explicitly calls out: "could silently allow an AI assistant
      // to revert a project ... to a non-allowed previous status."
      queueScopedProjectLookup({
        project: { id: 'p-1', buildingId: 'b-1', status: 'planned' },
        building: { id: 'b-1', organizationId: 'mcp-org-1' },
      });
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockReopenToPhase.mockRejectedValueOnce(
        new Error('Cannot reopen to in_progress. Allowed targets: '),
      );
      const handler = getToolHandler(server, 'reopen_project_status');
      const result = await handler(
        { role: 'admin', projectId: 'p-1', targetStatus: 'in_progress' },
        {},
      );
      const text = textOf(result);
      // No SQLSTATE → buildWriteErrorResponse falls back to the
      // generic "Failed to update project — please retry" sentence.
      // The important regression guard is: the raw "Cannot reopen
      // to ... Allowed targets: ..." sentence must NOT leak (the AI
      // assistant should never be coached on which non-allowed
      // targets it tried), and the response must be the sanitized
      // fallback message.
      expect(text).toMatch(/Failed to update project/i);
      expect(text).not.toMatch(/Cannot reopen to/);
      expect(text).not.toMatch(/Allowed targets:/);
      // No DB write should have happened from the MCP handler itself
      // — the throw bubbled out of workflowService before any
      // caller-managed transaction could have been started.
      expect(mockDb.update).not.toHaveBeenCalled();
      errSpy.mockRestore();
    });
  });

  // Reference `schema` so the lint config doesn't drop the import — kept
  // for parity with the other MCP-tool tests and to make the table set
  // visible at-a-glance.
  it('schema import covers maintenanceProjects + workflowTasks', () => {
    expect(schema.maintenanceProjects).toBeDefined();
    expect(schema.workflowTasks).toBeDefined();
    expect(schema.submissionVendors).toBeDefined();
  });
});
