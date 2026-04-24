/**
 * @jest-environment node
 *
 * Task #516 — MCP integration coverage for the two new post-work
 * element-update tools registered in `server/mcp/server.ts` (Task #308):
 *
 *   - upsert_element_project_update  (write — admin/manager only)
 *   - list_element_project_updates   (read  — admin/manager only)
 *
 * Both tools wrap the same `element_project_updates` table the REST
 * handlers in `server/api/maintenance.ts` use:
 *   - GET  /api/maintenance/projects/:id/element-updates
 *   - POST /api/maintenance/projects/:id/element-updates  (upsert)
 *
 * This suite exercises the happy paths and the four guard rails the
 * REST layer pins down, against a real Postgres instance:
 *
 *   1. Successful create on the first upsert call.
 *   2. Successful update on the second upsert call for the same
 *      (projectId, elementId) — proves the
 *      `element_project_updates_unique_project_element` constraint is
 *      handled by `onConflictDoUpdate` (status, actualCost and notes
 *      are overwritten and `updatedAt` advances).
 *   3. Tenant rejection on BOTH tools (no row written / no row read).
 *   4. Project-not-in-MCP-scope rejection on BOTH tools (admin role).
 *   5. "Element not linked to project" rejection (admin role) —
 *      the `project_elements` link guard mirrors the REST upsert.
 *   6. The `list_element_project_updates` tool's join to
 *      `building_elements` returns the element's `name`,
 *      `uniformatCode` and `description` fields.
 *
 * Mirrors the harness in tests/integration/mcp/project-tools.test.ts
 * and is gated on `_INTEGRATION_DB_URL` (auto-populated from
 * `DATABASE_URL` by `jest.polyfills.js`).
 */

// Stub the heavy modules that server/mcp/server.ts imports at the top —
// the element-update tools never use them, but loading the real modules
// pulls in ESM-only `uuid` (via objectStorage / consolidated-ai-service)
// which Jest's CJS transformer cannot parse without extra config.
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
import { and, eq, inArray } from 'drizzle-orm';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import * as schemaImport from '@shared/schema';

type Schema = typeof schemaImport;
type Db = NeonDatabase<Schema>;

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const TEST_TAG = 'task516-mcp-element-project-update';
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

describeIfDb('MCP element-project-update tools — Task #516 integration', () => {
  let db: Db;
  let schema: Schema;
  let createMcpServer: typeof import('../../../server/mcp/server').createMcpServer;

  // Track every row we insert so afterAll can clean up in dependency
  // order, even if a single test bailed before its own cleanup.
  const created = {
    organizationId: null as string | null,
    organizationCreatedByUs: false,
    outsideOrgId: null as string | null,
    elementProjectUpdateIds: new Set<string>(),
    projectElementIds: new Set<string>(),
    elementIds: new Set<string>(),
    projectIds: new Set<string>(),
    userOrgs: new Set<string>(),
    buildings: new Set<string>(),
    users: new Set<string>(),
    uniformatCode: null as string | null,
    uniformatCodeCreatedByUs: false,
  };

  // Common fixture handles populated in beforeAll.
  let mcpOrgId: string;
  let outsideOrgId: string;
  let buildingInScopeId: string;
  let buildingOutsideId: string;
  let tenantUserId: string;
  let managerUserId: string;
  let adminUserId: string;
  let projectInScopeId: string;
  let outsideProjectId: string;
  let linkedElementId: string;       // attached to projectInScopeId via project_elements
  let unlinkedElementId: string;     // exists in the same building but NOT attached
  let linkedProjectElementId: string;

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
    //    out-of-scope project we expect both tools to refuse.
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

    // 4. Users: admin (project creator), manager (extra write coverage),
    //    tenant (gating coverage).
    const mkUser = async (role: 'tenant' | 'manager' | 'admin', suffix: string) => {
      const id = crypto.randomUUID();
      await db.insert(schema.users).values({
        id,
        username: `${TEST_TAG}-${suffix}-${id.slice(0, 8)}`,
        email: `${TEST_TAG}-${suffix}-${id.slice(0, 8)}@example.test`,
        password: 'x'.repeat(60),
        firstName: 'EU',
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

    // 5. Resolve (or seed) a uniformat code we can attach building
    //    elements to (FK building_elements.uniformat_code →
    //    uniformat_codes.code). Reusing the seed when present keeps
    //    the test cheap; otherwise we mint one tagged with TEST_TAG so
    //    afterAll can drop it.
    const existingCode = await db
      .select({ code: schema.uniformatCodes.code })
      .from(schema.uniformatCodes)
      .limit(1);
    if (existingCode.length > 0) {
      created.uniformatCode = existingCode[0].code;
    } else {
      const code = `T516`;
      await db.insert(schema.uniformatCodes).values({
        code,
        level: 1,
        nameFr: 'Test element project update',
        nameEn: 'Test element project update',
      });
      created.uniformatCode = code;
      created.uniformatCodeCreatedByUs = true;
    }
    const uniformatCode = created.uniformatCode!;

    // 6. Two building elements:
    //    - linkedElement is attached to the MCP-scoped project via
    //      project_elements, so the upsert tool will accept it.
    //    - unlinkedElement lives in the same building but is NOT
    //      attached, so the upsert tool must refuse it.
    linkedElementId = crypto.randomUUID();
    unlinkedElementId = crypto.randomUUID();
    await db.insert(schema.buildingElements).values([
      {
        id: linkedElementId,
        buildingId: buildingInScopeId,
        uniformatCode,
        name: `${TEST_TAG} linked element`,
        description: `${TEST_TAG} linked element description`,
      },
      {
        id: unlinkedElementId,
        buildingId: buildingInScopeId,
        uniformatCode,
        name: `${TEST_TAG} unlinked element`,
        description: `${TEST_TAG} unlinked element description`,
      },
    ]);
    created.elementIds.add(linkedElementId);
    created.elementIds.add(unlinkedElementId);

    // 7. The MCP-scoped project the upsert / list tools will target,
    //    parked at `post_work` to mirror the closing-phase usage.
    projectInScopeId = crypto.randomUUID();
    await db.insert(schema.maintenanceProjects).values({
      id: projectInScopeId,
      buildingId: buildingInScopeId,
      projectNumber: `${TEST_TAG}-IN-${projectInScopeId.slice(0, 8)}`,
      title: `${TEST_TAG} in-scope project`,
      type: 'repair',
      status: 'post_work',
      priority: 'medium',
      createdBy: adminUserId,
    });
    created.projectIds.add(projectInScopeId);

    // 8. Pre-seed the out-of-scope project. createdBy must reference
    //    a real user; reuse our admin user (the FK doesn't care about
    //    the building / org link of that user).
    outsideProjectId = crypto.randomUUID();
    await db.insert(schema.maintenanceProjects).values({
      id: outsideProjectId,
      buildingId: buildingOutsideId,
      projectNumber: `${TEST_TAG}-OUT-${outsideProjectId.slice(0, 8)}`,
      title: `${TEST_TAG} outside project`,
      type: 'repair',
      status: 'post_work',
      priority: 'medium',
      createdBy: adminUserId,
    });
    created.projectIds.add(outsideProjectId);

    // 9. project_elements link for the in-scope project ↔ linkedElement
    //    only. Mirrors how the inventory UI attaches elements to a
    //    project's scope of work before the post-work phase opens.
    linkedProjectElementId = crypto.randomUUID();
    await db.insert(schema.projectElements).values({
      id: linkedProjectElementId,
      projectId: projectInScopeId,
      elementId: linkedElementId,
      projectType: 'repair',
      workDescription: `${TEST_TAG} planned work`,
    });
    created.projectElementIds.add(linkedProjectElementId);
  }, 60000);

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;

    // FK-safe order: element_project_updates → project_elements →
    // maintenance_projects → building_elements → user_organizations
    // → buildings → users → outside org → uniformat (only if we
    // created it) → MCP-1 (only if we created it).
    if (created.elementProjectUpdateIds.size) {
      await db
        .delete(schema.elementProjectUpdates)
        .where(inArray(schema.elementProjectUpdates.id, [...created.elementProjectUpdateIds]));
    }
    if (created.projectElementIds.size) {
      await db
        .delete(schema.projectElements)
        .where(inArray(schema.projectElements.id, [...created.projectElementIds]));
    }
    if (created.projectIds.size) {
      await db
        .delete(schema.maintenanceProjects)
        .where(inArray(schema.maintenanceProjects.id, [...created.projectIds]));
    }
    if (created.elementIds.size) {
      await db
        .delete(schema.buildingElements)
        .where(inArray(schema.buildingElements.id, [...created.elementIds]));
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
      await db
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, created.outsideOrgId));
    }
    if (created.uniformatCode && created.uniformatCodeCreatedByUs) {
      await db
        .delete(schema.uniformatCodes)
        .where(eq(schema.uniformatCodes.code, created.uniformatCode));
    }
    if (created.organizationCreatedByUs && created.organizationId) {
      await db
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, created.organizationId));
    }
  }, 60000);

  // -----------------------------------------------------------------
  // 1. Tenants are blocked from BOTH tools — the role gate fires
  //    before any DB write. Confirm under a real DB that nothing was
  //    persisted by either tenant call.
  // -----------------------------------------------------------------
  it('denies tenant on upsert_element_project_update and list_element_project_updates', async () => {
    const tenantSrv = serverFor('tenant', tenantUserId);

    const upsertHandler = getToolHandler(tenantSrv, 'upsert_element_project_update');
    const upsertRes = await upsertHandler({
      role: 'tenant',
      projectId: projectInScopeId,
      elementId: linkedElementId,
      updateStatus: 'repair',
      actualCost: 42,
      notes: `${TEST_TAG} tenant`,
    });
    expect(textOf(upsertRes)).toMatch(/tenants cannot record post-work element updates/i);

    const listHandler = getToolHandler(tenantSrv, 'list_element_project_updates');
    const listRes = await listHandler({ role: 'tenant', projectId: projectInScopeId });
    expect(textOf(listRes)).toMatch(/tenants cannot view post-work element updates/i);

    // Confirm the tenant call did NOT create a row in the table.
    const rowsAfterTenant = await db
      .select({ id: schema.elementProjectUpdates.id })
      .from(schema.elementProjectUpdates)
      .where(and(
        eq(schema.elementProjectUpdates.projectId, projectInScopeId),
        eq(schema.elementProjectUpdates.elementId, linkedElementId),
      ));
    expect(rowsAfterTenant.length).toBe(0);
  }, 60000);

  // -----------------------------------------------------------------
  // 2. Both tools refuse a project whose building is outside the MCP
  //    scope, even for an admin role.
  // -----------------------------------------------------------------
  it('rejects an out-of-scope project on both tools (admin role)', async () => {
    const adminSrv = serverFor('admin', adminUserId);

    const upsertHandler = getToolHandler(adminSrv, 'upsert_element_project_update');
    const upsertRes = await upsertHandler({
      role: 'admin',
      projectId: outsideProjectId,
      elementId: linkedElementId,
      updateStatus: 'repair',
    });
    expect(textOf(upsertRes)).toMatch(/not attached to an MCP-scoped building/i);

    const listHandler = getToolHandler(adminSrv, 'list_element_project_updates');
    const listRes = await listHandler({ role: 'admin', projectId: outsideProjectId });
    expect(textOf(listRes)).toMatch(/not attached to an MCP-scoped building/i);

    // Confirm the rejected upsert did not write a row scoped to the
    // out-of-scope project.
    const rowsAfterOos = await db
      .select({ id: schema.elementProjectUpdates.id })
      .from(schema.elementProjectUpdates)
      .where(eq(schema.elementProjectUpdates.projectId, outsideProjectId));
    expect(rowsAfterOos.length).toBe(0);
  }, 60000);

  // -----------------------------------------------------------------
  // 3. The "element must be linked to project" guard mirrors the
  //    REST upsert: the upsert tool refuses an element that is not
  //    attached via project_elements. The hint text is asserted so a
  //    future copy change shows up here.
  // -----------------------------------------------------------------
  it('refuses an element that is not linked to the project (admin role)', async () => {
    const adminSrv = serverFor('admin', adminUserId);

    const upsertHandler = getToolHandler(adminSrv, 'upsert_element_project_update');
    const res = await upsertHandler({
      role: 'admin',
      projectId: projectInScopeId,
      elementId: unlinkedElementId,
      updateStatus: 'repair',
    });
    const text = textOf(res);
    expect(text).toMatch(new RegExp(`Element ${unlinkedElementId} is not linked to project ${projectInScopeId}`, 'i'));
    expect(text).toMatch(/Attach it to the project first/i);

    // Make sure the rejection actually short-circuited before the
    // insert: there must be no row for (projectInScopeId,
    // unlinkedElementId).
    const rowsAfterUnlinked = await db
      .select({ id: schema.elementProjectUpdates.id })
      .from(schema.elementProjectUpdates)
      .where(and(
        eq(schema.elementProjectUpdates.projectId, projectInScopeId),
        eq(schema.elementProjectUpdates.elementId, unlinkedElementId),
      ));
    expect(rowsAfterUnlinked.length).toBe(0);
  }, 60000);

  // -----------------------------------------------------------------
  // 4. Happy path — a single (projectId, elementId) pair upserts
  //    cleanly:
  //      a) First call creates the row.
  //      b) Second call updates the same row in place (proves the
  //         element_project_updates_unique_project_element constraint
  //         is handled by onConflictDoUpdate; status, actualCost and
  //         notes are overwritten and updatedAt advances).
  //      c) The list tool then returns one row joined to the
  //         building element's name, uniformat code and description.
  //      d) Manager role can also drive an upsert (write-role parity).
  // -----------------------------------------------------------------
  it('admin can create then update the same element update (unique-constraint upsert) and list joins the element', async () => {
    const adminSrv = serverFor('admin', adminUserId);
    const upsertHandler = getToolHandler(adminSrv, 'upsert_element_project_update');

    // ── First upsert call → INSERT ────────────────────────────────
    const firstRes = await upsertHandler({
      role: 'admin',
      projectId: projectInScopeId,
      elementId: linkedElementId,
      updateStatus: 'repair',
      actualCost: 100,
      notes: `${TEST_TAG} initial`,
    });
    const created1 = parseJson<{
      id: string;
      projectId: string;
      elementId: string;
      updateStatus: string;
      actualCost: string | null;
      notes: string | null;
      createdAt: string;
      updatedAt: string;
    }>(firstRes);
    expect(created1.id).toBeTruthy();
    expect(created1.projectId).toBe(projectInScopeId);
    expect(created1.elementId).toBe(linkedElementId);
    expect(created1.updateStatus).toBe('repair');
    // actualCost is decimal — Postgres returns it as a string.
    expect(Number(created1.actualCost)).toBe(100);
    expect(created1.notes).toBe(`${TEST_TAG} initial`);
    created.elementProjectUpdateIds.add(created1.id);

    // Confirm the row really landed in the DB (no echo from the tool).
    const persistedAfterCreate = await db
      .select()
      .from(schema.elementProjectUpdates)
      .where(eq(schema.elementProjectUpdates.id, created1.id));
    expect(persistedAfterCreate.length).toBe(1);
    expect(persistedAfterCreate[0].updateStatus).toBe('repair');

    // ── Second upsert call → UPDATE in place ──────────────────────
    // Sleep just long enough that updatedAt must advance — Postgres'
    // `now()` resolution is microsecond-level, so 5ms is plenty.
    await new Promise((r) => setTimeout(r, 5));
    const secondRes = await upsertHandler({
      role: 'admin',
      projectId: projectInScopeId,
      elementId: linkedElementId,
      updateStatus: 'replace',
      actualCost: 250.5,
      notes: `${TEST_TAG} updated`,
    });
    const created2 = parseJson<{
      id: string;
      projectId: string;
      elementId: string;
      updateStatus: string;
      actualCost: string | null;
      notes: string | null;
      createdAt: string;
      updatedAt: string;
    }>(secondRes);
    // Same row id — the unique (projectId, elementId) constraint
    // forced an UPDATE rather than a duplicate INSERT.
    expect(created2.id).toBe(created1.id);
    expect(created2.updateStatus).toBe('replace');
    expect(Number(created2.actualCost)).toBeCloseTo(250.5);
    expect(created2.notes).toBe(`${TEST_TAG} updated`);
    // createdAt is preserved; updatedAt advances.
    expect(created2.createdAt).toBe(created1.createdAt);
    expect(new Date(created2.updatedAt).getTime()).toBeGreaterThan(
      new Date(created1.updatedAt).getTime(),
    );

    // Belt-and-suspenders: only ONE row exists for this pair (no
    // accidental duplicate insert).
    const allForPair = await db
      .select({ id: schema.elementProjectUpdates.id })
      .from(schema.elementProjectUpdates)
      .where(and(
        eq(schema.elementProjectUpdates.projectId, projectInScopeId),
        eq(schema.elementProjectUpdates.elementId, linkedElementId),
      ));
    expect(allForPair.length).toBe(1);

    // ── list_element_project_updates joins building_elements ──────
    const listHandler = getToolHandler(adminSrv, 'list_element_project_updates');
    const listRes = await listHandler({ role: 'admin', projectId: projectInScopeId });
    const listed = parseJson<Array<{
      id: string;
      projectId: string;
      elementId: string;
      updateStatus: string;
      actualCost: string | null;
      notes: string | null;
      elementName: string;
      uniformatCode: string;
      elementDescription: string | null;
    }>>(listRes);
    expect(listed.length).toBe(1);
    const [row] = listed;
    expect(row.id).toBe(created1.id);
    expect(row.projectId).toBe(projectInScopeId);
    expect(row.elementId).toBe(linkedElementId);
    expect(row.updateStatus).toBe('replace');
    expect(Number(row.actualCost)).toBeCloseTo(250.5);
    expect(row.notes).toBe(`${TEST_TAG} updated`);
    // The join to building_elements must surface name, uniformat
    // code and description on every returned row.
    expect(row.elementName).toBe(`${TEST_TAG} linked element`);
    expect(row.uniformatCode).toBe(created.uniformatCode);
    expect(row.elementDescription).toBe(`${TEST_TAG} linked element description`);

    // ── Manager-role parity on the upsert tool ────────────────────
    // Run a third upsert under the manager role to confirm the
    // role gate accepts both admin AND manager (the documented
    // write-allowed roles).
    const mgrSrv = serverFor('manager', managerUserId);
    const mgrUpsertHandler = getToolHandler(mgrSrv, 'upsert_element_project_update');
    const mgrRes = await mgrUpsertHandler({
      role: 'manager',
      projectId: projectInScopeId,
      elementId: linkedElementId,
      updateStatus: 'minor_rehab',
      notes: `${TEST_TAG} mgr`,
    });
    const mgrUpdated = parseJson<{ id: string; updateStatus: string; notes: string | null }>(mgrRes);
    expect(mgrUpdated.id).toBe(created1.id);
    expect(mgrUpdated.updateStatus).toBe('minor_rehab');
    expect(mgrUpdated.notes).toBe(`${TEST_TAG} mgr`);
  }, 90000);
});
