/**
 * @jest-environment node
 *
 * Real-Postgres integration tests for the seven inventory MCP tools added
 * in Task #301:
 *
 *   - list_inventory_elements   (with condition + category filters)
 *   - get_inventory_element
 *   - create_inventory_element
 *   - update_inventory_element
 *   - delete_inventory_element  (cascade success + FK-violation envelope)
 *   - search_uniformat_codes
 *   - list_element_history
 *
 * The matching mocked-Drizzle suite in `mcp-tools.test.ts` only covers the
 * registration shape and the cheap RBAC short-circuits. This file exercises
 * the same tools end-to-end against a real Postgres so we additionally
 * lock in:
 *
 *   - tenant-denied path on every tool,
 *   - out-of-scope-org rejection (building outside MCP-1 / MCP-2),
 *   - the UNIFORMAT category filter that joins through `uniformat_codes`,
 *   - the level-3 UNIFORMAT validation on create,
 *   - the cross-building residenceId guard on create,
 *   - the partial-update PATCH semantics + the immutable `buildingId`
 *     contract on update,
 *   - cascade behaviour on delete (history + project-element rows go away
 *     when the element does), and
 *   - the structured FK-violation envelope wired through
 *     `buildWriteErrorResponse` on delete.
 *
 * Skipped cleanly when `_INTEGRATION_DB_URL` is not set so unit-tier
 * runs stay green. The `_INTEGRATION_DB_URL` env var is captured from
 * the original `DATABASE_URL` in `jest.polyfills.js` before
 * `jest.setup.simple.ts` overwrites it with a placeholder, mirroring
 * `mcp-property-update-integration.test.ts`.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { eq, and } from 'drizzle-orm';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import type * as SchemaImport from '@shared/schema';

// File-level mocks for unrelated services that `createMcpServer`
// instantiates during tool registration. Mirrors the property-update
// integration suite so the inventory branch under test runs against the
// real DB while document/storage/AI dependencies stay inert and offline.
jest.mock('../services/document-service', () => ({
  DocumentService: jest.fn().mockImplementation(() => ({
    getDocuments: jest.fn().mockResolvedValue([]),
    getUploadUrl: jest.fn().mockResolvedValue({
      success: true,
      uploadUrl: 'https://example.com/upload',
      filePath: '/objects/test.pdf',
    }),
    confirmUpload: jest.fn().mockResolvedValue({ id: 'doc-1' }),
    normalizePath: jest.fn((p: string) => p),
  })),
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

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

type Schema = typeof SchemaImport;
type Db = NeonDatabase<Schema>;

/**
 * Pull a registered tool handler off the server. Mirrors the helper used
 * by `mcp-property-update-integration.test.ts` so the suites stay
 * symmetrical and easy to read together.
 */
function getToolHandler(server: unknown, toolName: string) {
  const tools = (server as {
    _registeredTools: Record<
      string,
      {
        handler?: (...args: unknown[]) => unknown;
        callback?: (...args: unknown[]) => unknown;
      }
    >;
  })._registeredTools;
  if (!tools || !tools[toolName]) {
    throw new Error(`Tool "${toolName}" not found in registered tools`);
  }
  const tool = tools[toolName];
  const handler = tool.handler || tool.callback;
  if (typeof handler !== 'function') {
    throw new Error(`Tool "${toolName}" handler is not a function`);
  }
  return handler as (
    args: Record<string, unknown>,
    extra?: unknown,
  ) => Promise<{ content: Array<{ type: string; text: string }> }>;
}

function parseToolText(result: {
  content?: Array<{ text?: string }>;
}): string {
  return result?.content?.[0]?.text ?? JSON.stringify(result);
}

/**
 * UNIFORMAT codes the tests pin to. `A1010` and `A1020` are level-3 codes
 * under the `Substructure` category in the canonical Quebec catalog, so
 * they exercise the level-3 gate AND the category-filter join through
 * `uniformat_codes` without depending on more obscure entries.
 */
const TEST_LEVEL3_CODE = 'A1010';
const TEST_LEVEL3_CODE_ALT = 'A1020';
const TEST_LEVEL2_CODE = 'A10';
const TEST_LEVEL1_CODE = 'A';
const TEST_CATEGORY = 'Substructure';

describeIfDb('MCP inventory tools — real Postgres', () => {
  // Each test run gets its own suffix so concurrent runs and leftover seed
  // data from other suites cannot collide on unique constraints.
  const runId = randomUUID().slice(0, 8);
  const mcpOrgName = `MCP-1`; // MUST be one of MCP_ORG_NAMES in server.ts
  const otherOrgName = `mcp-inv-it-other-${runId}`;

  let db: Db;
  let schema: Schema;
  let server: unknown;

  let mcpOrgId: string;
  let otherOrgId: string;
  let inScopeBuildingId: string;
  let outOfScopeBuildingId: string;
  let inScopeResidenceId: string;
  let secondBuildingResidenceId: string;
  let secondInScopeBuildingId: string;
  let baseElementId: string;
  let outOfScopeElementId: string;
  let createdMcpOrgHere = false;
  let createdAdminUserHere = false;
  let createdManagerUserHere = false;
  let createdTenantUserHere = false;
  let adminUserId: string;
  let seededLevel1Here = false;
  let seededLevel2Here = false;
  let seededCodeAHere = false;
  let seededCodeBHere = false;

  // Tracked so afterAll can clean up only the rows we own.
  const createdElementIds: string[] = [];
  const createdHistoryIds: string[] = [];
  const createdProjectIds: string[] = [];
  const createdVendorIds: string[] = [];

  // The MCP server resolves the acting user by role via these seed
  // accounts. The inventory tools never look these users up themselves
  // (they reject tenants before any DB read), but the same defensive
  // baseline used by `mcp-property-update-integration.test.ts` keeps the
  // suites symmetrical.
  const adminEmail = 'mcp-admin@koveo-mcp.test';
  const managerEmail = 'mcp-manager@koveo-mcp.test';
  const tenantEmail = 'mcp-tenant@koveo-mcp.test';

  async function ensureMcpUser(
    email: string,
    role: 'admin' | 'manager' | 'tenant',
  ): Promise<{ id: string; created: boolean }> {
    const [existing] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email));
    if (existing) return { id: existing.id, created: false };
    const username = email.split('@')[0];
    const [inserted] = await db
      .insert(schema.users)
      .values({
        email,
        username,
        password: 'integration-test-disabled',
        firstName: role,
        lastName: 'mcp-it',
        role,
        isActive: true,
      })
      .returning({ id: schema.users.id });
    return { id: inserted.id, created: true };
  }

  async function ensureUniformatCode(
    code: string,
    level: number,
    parentCode: string | null,
    category: string | null,
  ): Promise<boolean> {
    const [existing] = await db
      .select({ code: schema.uniformatCodes.code })
      .from(schema.uniformatCodes)
      .where(eq(schema.uniformatCodes.code, code));
    if (existing) return false;
    await db.insert(schema.uniformatCodes).values({
      code,
      level,
      parentCode: parentCode ?? undefined,
      nameFr: `Test ${code}`,
      nameEn: `Test ${code}`,
      category: category ?? undefined,
    });
    return true;
  }

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    db = require('../db').db as Db;
    schema = require('@shared/schema') as Schema;

    // --- Organizations ---------------------------------------------------
    const [existingMcpOrg] = await db
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(eq(schema.organizations.name, mcpOrgName));
    if (existingMcpOrg) {
      mcpOrgId = existingMcpOrg.id;
    } else {
      const [created] = await db
        .insert(schema.organizations)
        .values({
          name: mcpOrgName,
          type: 'demo',
          address: '1 MCP Way',
          city: 'Montreal',
          province: 'QC',
          postalCode: 'H1A1A1',
          isActive: true,
        })
        .returning({ id: schema.organizations.id });
      mcpOrgId = created.id;
      createdMcpOrgHere = true;
    }

    const [otherOrg] = await db
      .insert(schema.organizations)
      .values({
        name: otherOrgName,
        type: 'demo',
        address: '99 Out Of Scope Rd',
        city: 'Quebec',
        province: 'QC',
        postalCode: 'H9Z9Z9',
        isActive: true,
      })
      .returning({ id: schema.organizations.id });
    otherOrgId = otherOrg.id;

    // --- Users (need adminUserId for elementHistory.createdBy) -----------
    const adminInfo = await ensureMcpUser(adminEmail, 'admin');
    adminUserId = adminInfo.id;
    createdAdminUserHere = adminInfo.created;
    const managerInfo = await ensureMcpUser(managerEmail, 'manager');
    createdManagerUserHere = managerInfo.created;
    const tenantInfo = await ensureMcpUser(tenantEmail, 'tenant');
    createdTenantUserHere = tenantInfo.created;

    // --- UNIFORMAT codes -------------------------------------------------
    // The `uniformat_codes` table is FK-referenced by `building_elements`
    // (with ON DELETE RESTRICT), so we must guarantee the codes the tests
    // use exist. Production DBs already seed the canonical catalog; on a
    // pristine integration DB we insert the minimum set ourselves and
    // track which inserts we own so afterAll can clean up safely.
    seededLevel1Here = await ensureUniformatCode(
      TEST_LEVEL1_CODE,
      1,
      null,
      TEST_CATEGORY,
    );
    seededLevel2Here = await ensureUniformatCode(
      TEST_LEVEL2_CODE,
      2,
      TEST_LEVEL1_CODE,
      TEST_CATEGORY,
    );
    seededCodeAHere = await ensureUniformatCode(
      TEST_LEVEL3_CODE,
      3,
      TEST_LEVEL2_CODE,
      TEST_CATEGORY,
    );
    seededCodeBHere = await ensureUniformatCode(
      TEST_LEVEL3_CODE_ALT,
      3,
      TEST_LEVEL2_CODE,
      TEST_CATEGORY,
    );

    // --- Buildings -------------------------------------------------------
    const [inScopeBuilding] = await db
      .insert(schema.buildings)
      .values({
        organizationId: mcpOrgId,
        name: `mcp-inv-it-bldg-${runId}`,
        address: '10 Original St',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A1',
        buildingType: 'apartment',
        totalUnits: 12,
        totalFloors: 4,
        isActive: true,
      })
      .returning({ id: schema.buildings.id });
    inScopeBuildingId = inScopeBuilding.id;

    const [secondInScopeBuilding] = await db
      .insert(schema.buildings)
      .values({
        organizationId: mcpOrgId,
        name: `mcp-inv-it-bldg-2-${runId}`,
        address: '20 Original St',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A2',
        buildingType: 'apartment',
        totalUnits: 8,
        totalFloors: 3,
        isActive: true,
      })
      .returning({ id: schema.buildings.id });
    secondInScopeBuildingId = secondInScopeBuilding.id;

    const [outOfScopeBuilding] = await db
      .insert(schema.buildings)
      .values({
        organizationId: otherOrgId,
        name: `mcp-inv-it-bldg-out-${runId}`,
        address: '999 OOS Ave',
        city: 'Quebec',
        province: 'QC',
        postalCode: 'H9Z9Z9',
        buildingType: 'condo',
        totalUnits: 4,
        isActive: true,
      })
      .returning({ id: schema.buildings.id });
    outOfScopeBuildingId = outOfScopeBuilding.id;

    // --- Residences (used by the cross-building guard test) --------------
    const [inScopeResidence] = await db
      .insert(schema.residences)
      .values({
        buildingId: inScopeBuildingId,
        unitNumber: '101',
        floor: 1,
        isActive: true,
      })
      .returning({ id: schema.residences.id });
    inScopeResidenceId = inScopeResidence.id;

    const [secondBuildingResidence] = await db
      .insert(schema.residences)
      .values({
        buildingId: secondInScopeBuildingId,
        unitNumber: 'A1',
        floor: 1,
        isActive: true,
      })
      .returning({ id: schema.residences.id });
    secondBuildingResidenceId = secondBuildingResidence.id;

    // --- Base inventory elements ----------------------------------------
    // One in MCP scope used by get/list/update/history tests, and one in
    // the out-of-scope org used by the cross-org rejection assertions.
    const [baseElement] = await db
      .insert(schema.buildingElements)
      .values({
        buildingId: inScopeBuildingId,
        uniformatCode: TEST_LEVEL3_CODE,
        name: `inv-it-base-${runId}`,
        currentCondition: 'good',
        notes: 'integration baseline',
        unit: 'm2',
        unitValue: '100.00',
        reconstructionCost: '5000.00',
      })
      .returning({ id: schema.buildingElements.id });
    baseElementId = baseElement.id;
    createdElementIds.push(baseElementId);

    // Seed a history row so list_element_history has something to return
    // and so the cascade test can assert it disappears alongside the
    // element.
    const [history] = await db
      .insert(schema.elementHistory)
      .values({
        elementId: baseElementId,
        eventType: 'minor_rehab',
        eventDate: '2024-06-15',
        workDescription: 'Initial baseline event',
        cost: '750.00',
        createdBy: adminUserId,
      })
      .returning({ id: schema.elementHistory.id });
    createdHistoryIds.push(history.id);

    const [outOfScopeElement] = await db
      .insert(schema.buildingElements)
      .values({
        buildingId: outOfScopeBuildingId,
        uniformatCode: TEST_LEVEL3_CODE,
        name: `inv-it-out-${runId}`,
        currentCondition: 'fair',
      })
      .returning({ id: schema.buildingElements.id });
    outOfScopeElementId = outOfScopeElement.id;
    createdElementIds.push(outOfScopeElementId);

    const { createMcpServer } = require('../mcp/server') as {
      createMcpServer: (auth?: unknown) => unknown;
    };
    server = createMcpServer();
  }, 60000);

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;
    // Delete any history rows we explicitly created (most are cascaded by
    // the element-delete tests, but the baseline row gets cleaned up when
    // its element does — this is defensive in case a test failed early).
    for (const id of createdHistoryIds) {
      await db
        .delete(schema.elementHistory)
        .where(eq(schema.elementHistory.id, id));
    }
    for (const id of createdProjectIds) {
      await db
        .delete(schema.maintenanceProjects)
        .where(eq(schema.maintenanceProjects.id, id));
    }
    for (const id of createdElementIds) {
      await db
        .delete(schema.buildingElements)
        .where(eq(schema.buildingElements.id, id));
    }
    // Vendors must be removed before their parent organization is dropped
    // (cascade would otherwise yank the wrong rows). Vendors created in
    // `mcpOrgId` (which can be a pre-existing org) would otherwise leak.
    for (const id of createdVendorIds) {
      await db.delete(schema.vendors).where(eq(schema.vendors.id, id));
    }
    if (secondBuildingResidenceId) {
      await db
        .delete(schema.residences)
        .where(eq(schema.residences.id, secondBuildingResidenceId));
    }
    if (inScopeResidenceId) {
      await db
        .delete(schema.residences)
        .where(eq(schema.residences.id, inScopeResidenceId));
    }
    if (inScopeBuildingId) {
      await db
        .delete(schema.buildings)
        .where(eq(schema.buildings.id, inScopeBuildingId));
    }
    if (secondInScopeBuildingId) {
      await db
        .delete(schema.buildings)
        .where(eq(schema.buildings.id, secondInScopeBuildingId));
    }
    if (outOfScopeBuildingId) {
      await db
        .delete(schema.buildings)
        .where(eq(schema.buildings.id, outOfScopeBuildingId));
    }
    if (otherOrgId) {
      await db
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, otherOrgId));
    }
    if (createdMcpOrgHere && mcpOrgId) {
      await db
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, mcpOrgId));
    }
    // UNIFORMAT codes are RESTRICT-cascaded, so we must remove the leaf
    // codes we own first (only when they were not pre-seeded).
    if (seededCodeBHere) {
      await db
        .delete(schema.uniformatCodes)
        .where(eq(schema.uniformatCodes.code, TEST_LEVEL3_CODE_ALT));
    }
    if (seededCodeAHere) {
      await db
        .delete(schema.uniformatCodes)
        .where(eq(schema.uniformatCodes.code, TEST_LEVEL3_CODE));
    }
    if (seededLevel2Here) {
      await db
        .delete(schema.uniformatCodes)
        .where(eq(schema.uniformatCodes.code, TEST_LEVEL2_CODE));
    }
    if (seededLevel1Here) {
      await db
        .delete(schema.uniformatCodes)
        .where(eq(schema.uniformatCodes.code, TEST_LEVEL1_CODE));
    }
    if (createdAdminUserHere) {
      await db.delete(schema.users).where(eq(schema.users.email, adminEmail));
    }
    if (createdManagerUserHere) {
      await db.delete(schema.users).where(eq(schema.users.email, managerEmail));
    }
    if (createdTenantUserHere) {
      await db.delete(schema.users).where(eq(schema.users.email, tenantEmail));
    }
  }, 60000);

  // -------------------------------------------------------------------
  // RBAC: every tool must reject tenants up-front before any DB reads.
  // -------------------------------------------------------------------
  describe('tenant denial — applies to every inventory tool', () => {
    const tenantCases: Array<{
      tool: string;
      args: () => Record<string, unknown>;
    }> = [
      {
        tool: 'list_inventory_elements',
        args: () => ({ role: 'tenant', buildingId: inScopeBuildingId }),
      },
      {
        tool: 'get_inventory_element',
        args: () => ({ role: 'tenant', elementId: baseElementId }),
      },
      {
        tool: 'create_inventory_element',
        args: () => ({
          role: 'tenant',
          buildingId: inScopeBuildingId,
          uniformatCode: TEST_LEVEL3_CODE,
          name: 'tenant attempt',
          currentCondition: 'good',
        }),
      },
      {
        tool: 'update_inventory_element',
        args: () => ({
          role: 'tenant',
          elementId: baseElementId,
          name: 'tenant attempt',
        }),
      },
      {
        tool: 'delete_inventory_element',
        args: () => ({ role: 'tenant', elementId: baseElementId }),
      },
      {
        tool: 'search_uniformat_codes',
        args: () => ({ role: 'tenant', query: 'foundation' }),
      },
      {
        tool: 'list_element_history',
        args: () => ({ role: 'tenant', elementId: baseElementId }),
      },
      {
        tool: 'update_element_history_event',
        args: () => ({
          role: 'tenant',
          historyId: createdHistoryIds[0],
          cost: 1,
        }),
      },
      {
        tool: 'delete_element_history_event',
        args: () => ({
          role: 'tenant',
          historyId: createdHistoryIds[0],
        }),
      },
    ];

    it.each(tenantCases)(
      'rejects tenants from $tool',
      async ({ tool, args }) => {
        const handler = getToolHandler(server, tool);
        const result = await handler(args(), {});
        expect(parseToolText(result)).toMatch(/access denied/i);
      },
      30000,
    );

    it('does not mutate the baseline element when a tenant attempts update', async () => {
      const [before] = await db
        .select({ name: schema.buildingElements.name })
        .from(schema.buildingElements)
        .where(eq(schema.buildingElements.id, baseElementId));
      const handler = getToolHandler(server, 'update_inventory_element');
      await handler(
        { role: 'tenant', elementId: baseElementId, name: 'tenant overwrite' },
        {},
      );
      const [after] = await db
        .select({ name: schema.buildingElements.name })
        .from(schema.buildingElements)
        .where(eq(schema.buildingElements.id, baseElementId));
      expect(after!.name).toBe(before!.name);
    }, 30000);
  });

  // -------------------------------------------------------------------
  // list_inventory_elements
  // -------------------------------------------------------------------
  describe('list_inventory_elements', () => {
    it('returns elements for an in-scope building', async () => {
      const handler = getToolHandler(server, 'list_inventory_elements');
      const result = await handler(
        { role: 'admin', buildingId: inScopeBuildingId },
        {},
      );
      const text = parseToolText(result);
      const parsed = JSON.parse(text) as Array<{ id: string; name: string }>;
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.some((e) => e.id === baseElementId)).toBe(true);
    }, 30000);

    it('rejects buildings outside the MCP org scope', async () => {
      const handler = getToolHandler(server, 'list_inventory_elements');
      const result = await handler(
        { role: 'admin', buildingId: outOfScopeBuildingId },
        {},
      );
      expect(parseToolText(result)).toMatch(/not found or access denied/i);
    }, 30000);

    it('filters by `condition` (excludes elements with a different condition)', async () => {
      // Insert a second element with a `poor` condition under the same
      // building so the filter has something to discriminate against.
      const [poorElement] = await db
        .insert(schema.buildingElements)
        .values({
          buildingId: inScopeBuildingId,
          uniformatCode: TEST_LEVEL3_CODE,
          name: `inv-it-poor-${runId}`,
          currentCondition: 'poor',
        })
        .returning({ id: schema.buildingElements.id });
      createdElementIds.push(poorElement.id);

      const handler = getToolHandler(server, 'list_inventory_elements');
      const goodResult = await handler(
        {
          role: 'admin',
          buildingId: inScopeBuildingId,
          condition: 'good',
        },
        {},
      );
      const goodList = JSON.parse(parseToolText(goodResult)) as Array<{
        id: string;
        currentCondition: string;
      }>;
      expect(goodList.every((e) => e.currentCondition === 'good')).toBe(true);
      expect(goodList.some((e) => e.id === baseElementId)).toBe(true);
      expect(goodList.some((e) => e.id === poorElement.id)).toBe(false);

      const poorResult = await handler(
        {
          role: 'admin',
          buildingId: inScopeBuildingId,
          condition: 'poor',
        },
        {},
      );
      const poorList = JSON.parse(parseToolText(poorResult)) as Array<{
        id: string;
      }>;
      expect(poorList.some((e) => e.id === poorElement.id)).toBe(true);
      expect(poorList.some((e) => e.id === baseElementId)).toBe(false);
    }, 30000);

    it('filters by `category` via the uniformat_codes join', async () => {
      const handler = getToolHandler(server, 'list_inventory_elements');
      const inCategory = await handler(
        {
          role: 'admin',
          buildingId: inScopeBuildingId,
          category: TEST_CATEGORY,
        },
        {},
      );
      const inCategoryList = JSON.parse(parseToolText(inCategory)) as Array<{
        id: string;
        uniformatCode: string;
      }>;
      // Every returned element's UNIFORMAT code must roll up to the
      // requested category in the `uniformat_codes` table.
      expect(inCategoryList.length).toBeGreaterThan(0);
      expect(inCategoryList.some((e) => e.id === baseElementId)).toBe(true);

      const noCategoryMatch = await handler(
        {
          role: 'admin',
          buildingId: inScopeBuildingId,
          category: `definitely-not-a-real-category-${runId}`,
        },
        {},
      );
      expect(parseToolText(noCategoryMatch).trim()).toBe('[]');
    }, 30000);
  });

  // -------------------------------------------------------------------
  // get_inventory_element
  // -------------------------------------------------------------------
  describe('get_inventory_element', () => {
    it('returns full details for an in-scope element', async () => {
      const handler = getToolHandler(server, 'get_inventory_element');
      const result = await handler(
        { role: 'manager', elementId: baseElementId },
        {},
      );
      const parsed = JSON.parse(parseToolText(result)) as {
        id: string;
        buildingId: string;
        uniformatCode: string;
      };
      expect(parsed.id).toBe(baseElementId);
      expect(parsed.buildingId).toBe(inScopeBuildingId);
      expect(parsed.uniformatCode).toBe(TEST_LEVEL3_CODE);
    }, 30000);

    it('rejects elements in non-MCP organizations', async () => {
      const handler = getToolHandler(server, 'get_inventory_element');
      const result = await handler(
        { role: 'admin', elementId: outOfScopeElementId },
        {},
      );
      expect(parseToolText(result)).toMatch(/access denied/i);
    }, 30000);

    it('returns "not found" for unknown element ids', async () => {
      const handler = getToolHandler(server, 'get_inventory_element');
      const result = await handler(
        { role: 'admin', elementId: randomUUID() },
        {},
      );
      expect(parseToolText(result)).toMatch(/not found/i);
    }, 30000);
  });

  // -------------------------------------------------------------------
  // create_inventory_element
  // -------------------------------------------------------------------
  describe('create_inventory_element', () => {
    it('creates a level-3 element in an in-scope building and persists it', async () => {
      const handler = getToolHandler(server, 'create_inventory_element');
      const result = await handler(
        {
          role: 'admin',
          buildingId: inScopeBuildingId,
          uniformatCode: TEST_LEVEL3_CODE_ALT,
          name: `inv-it-create-${runId}`,
          currentCondition: 'fair',
          unit: 'm',
          unitValue: 12.5,
          reconstructionCost: 999.99,
        },
        {},
      );
      const text = parseToolText(result);
      expect(text).not.toMatch(/access denied|failed to create/i);
      const parsed = JSON.parse(text) as {
        id: string;
        buildingId: string;
        uniformatCode: string;
        currentCondition: string;
        unitValue: string;
        reconstructionCost: string;
      };
      createdElementIds.push(parsed.id);
      expect(parsed.buildingId).toBe(inScopeBuildingId);
      expect(parsed.uniformatCode).toBe(TEST_LEVEL3_CODE_ALT);
      expect(parsed.currentCondition).toBe('fair');
      // Decimals round-trip as fixed-precision strings.
      expect(parsed.unitValue).toBe('12.50');
      expect(parsed.reconstructionCost).toBe('999.99');

      const [row] = await db
        .select()
        .from(schema.buildingElements)
        .where(eq(schema.buildingElements.id, parsed.id));
      expect(row).toBeDefined();
      expect(row!.buildingId).toBe(inScopeBuildingId);
      expect(row!.name).toBe(`inv-it-create-${runId}`);
    }, 30000);

    it('rejects creation against a non-MCP building', async () => {
      const handler = getToolHandler(server, 'create_inventory_element');
      const result = await handler(
        {
          role: 'admin',
          buildingId: outOfScopeBuildingId,
          uniformatCode: TEST_LEVEL3_CODE,
          name: 'should not persist',
          currentCondition: 'good',
        },
        {},
      );
      expect(parseToolText(result)).toMatch(/not found or access denied/i);

      const all = await db
        .select({ id: schema.buildingElements.id })
        .from(schema.buildingElements)
        .where(
          and(
            eq(schema.buildingElements.buildingId, outOfScopeBuildingId),
            eq(schema.buildingElements.name, 'should not persist'),
          ),
        );
      expect(all).toHaveLength(0);
    }, 30000);

    it('rejects a UNIFORMAT code above level 3', async () => {
      const handler = getToolHandler(server, 'create_inventory_element');
      const result = await handler(
        {
          role: 'admin',
          buildingId: inScopeBuildingId,
          uniformatCode: TEST_LEVEL2_CODE,
          name: `inv-it-bad-level-${runId}`,
          currentCondition: 'good',
        },
        {},
      );
      const text = parseToolText(result);
      expect(text).toMatch(/level-3 codes/i);
    }, 30000);

    it('rejects a residenceId that belongs to another building', async () => {
      const handler = getToolHandler(server, 'create_inventory_element');
      const result = await handler(
        {
          role: 'admin',
          buildingId: inScopeBuildingId,
          residenceId: secondBuildingResidenceId,
          uniformatCode: TEST_LEVEL3_CODE,
          name: `inv-it-cross-bldg-${runId}`,
          currentCondition: 'good',
        },
        {},
      );
      expect(parseToolText(result)).toMatch(/does not belong to building/i);
    }, 30000);
  });

  // -------------------------------------------------------------------
  // update_inventory_element
  // -------------------------------------------------------------------
  describe('update_inventory_element', () => {
    it('partially updates an element and leaves omitted columns untouched', async () => {
      const handler = getToolHandler(server, 'update_inventory_element');
      const result = await handler(
        {
          role: 'manager',
          elementId: baseElementId,
          currentCondition: 'fair',
          notes: 'updated by integration test',
        },
        {},
      );
      const text = parseToolText(result);
      expect(text).not.toMatch(/access denied|not found|failed to update/i);

      const [row] = await db
        .select()
        .from(schema.buildingElements)
        .where(eq(schema.buildingElements.id, baseElementId));
      expect(row).toBeDefined();
      expect(row!.currentCondition).toBe('fair');
      expect(row!.notes).toBe('updated by integration test');
      // Untouched columns must round-trip the seeded values.
      expect(row!.name).toBe(`inv-it-base-${runId}`);
      expect(row!.uniformatCode).toBe(TEST_LEVEL3_CODE);
      expect(row!.unit).toBe('m2');
      expect(row!.unitValue).toBe('100.00');
      expect(row!.reconstructionCost).toBe('5000.00');
      // The `buildingId` is immutable per the tool description.
      expect(row!.buildingId).toBe(inScopeBuildingId);
    }, 30000);

    it('rejects updates to elements in non-MCP organizations', async () => {
      const handler = getToolHandler(server, 'update_inventory_element');
      const result = await handler(
        {
          role: 'admin',
          elementId: outOfScopeElementId,
          name: 'should not apply',
        },
        {},
      );
      expect(parseToolText(result)).toMatch(/access denied/i);
      const [row] = await db
        .select({ name: schema.buildingElements.name })
        .from(schema.buildingElements)
        .where(eq(schema.buildingElements.id, outOfScopeElementId));
      expect(row!.name).toBe(`inv-it-out-${runId}`);
    }, 30000);
  });

  // -------------------------------------------------------------------
  // search_uniformat_codes
  // -------------------------------------------------------------------
  describe('search_uniformat_codes', () => {
    it('rejects calls with no filter args (no full-catalog dump)', async () => {
      const handler = getToolHandler(server, 'search_uniformat_codes');
      const result = await handler({ role: 'admin' }, {});
      expect(parseToolText(result)).toMatch(/at least one of/i);
    }, 30000);

    it('returns matches when filtering by query', async () => {
      const handler = getToolHandler(server, 'search_uniformat_codes');
      const result = await handler(
        { role: 'manager', query: TEST_LEVEL3_CODE },
        {},
      );
      const parsed = JSON.parse(parseToolText(result)) as Array<{
        code: string;
      }>;
      expect(parsed.some((e) => e.code === TEST_LEVEL3_CODE)).toBe(true);
    }, 30000);

    it('returns level-3 codes only when filtering by `level: 3`', async () => {
      const handler = getToolHandler(server, 'search_uniformat_codes');
      const result = await handler({ role: 'admin', level: 3 }, {});
      const parsed = JSON.parse(parseToolText(result)) as Array<{
        level: number;
      }>;
      expect(parsed.length).toBeGreaterThan(0);
      expect(parsed.every((e) => e.level === 3)).toBe(true);
      // Capped at 50 entries by the tool implementation.
      expect(parsed.length).toBeLessThanOrEqual(50);
    }, 30000);

    it('respects a category filter', async () => {
      const handler = getToolHandler(server, 'search_uniformat_codes');
      const result = await handler(
        { role: 'admin', category: TEST_CATEGORY, level: 3 },
        {},
      );
      const parsed = JSON.parse(parseToolText(result)) as Array<{
        category: string;
      }>;
      expect(parsed.length).toBeGreaterThan(0);
      expect(
        parsed.every((e) =>
          e.category.toLowerCase().includes(TEST_CATEGORY.toLowerCase()),
        ),
      ).toBe(true);
    }, 30000);
  });

  // -------------------------------------------------------------------
  // list_element_history
  // -------------------------------------------------------------------
  describe('list_element_history', () => {
    it('returns history rows for an in-scope element ordered by event date desc', async () => {
      // Add a more-recent event so the order assertion has signal.
      const [later] = await db
        .insert(schema.elementHistory)
        .values({
          elementId: baseElementId,
          eventType: 'replacement',
          eventDate: '2025-09-30',
          workDescription: 'Later replacement event',
          cost: '4200.00',
          createdBy: adminUserId,
        })
        .returning({ id: schema.elementHistory.id });
      createdHistoryIds.push(later.id);

      const handler = getToolHandler(server, 'list_element_history');
      const result = await handler(
        { role: 'admin', elementId: baseElementId },
        {},
      );
      const parsed = JSON.parse(parseToolText(result)) as Array<{
        id: string;
        eventDate: string;
        eventType: string;
      }>;
      expect(parsed.length).toBeGreaterThanOrEqual(2);
      // Most-recent event date first.
      const dates = parsed.map((e) => e.eventDate);
      const sortedDesc = [...dates].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
      expect(dates).toEqual(sortedDesc);
      expect(parsed[0]!.eventType).toBe('replacement');
    }, 30000);

    it('rejects elements in non-MCP organizations', async () => {
      const handler = getToolHandler(server, 'list_element_history');
      const result = await handler(
        { role: 'admin', elementId: outOfScopeElementId },
        {},
      );
      expect(parseToolText(result)).toMatch(/access denied/i);
    }, 30000);
  });

  // -------------------------------------------------------------------
  // create_element_history_event — lastInspectionDate sync
  //
  // Locks in the chat-side parity with `POST /api/maintenance/elements/
  // :elementId/history`: only `repair` and `minor_rehab` should bump the
  // element's `lastInspectionDate` (and `updatedAt`) to the supplied
  // `eventDate`; the other event types must leave it untouched. The
  // combined `lifespanImpact` + repair-style case must also write both
  // `currentLifespan` AND `lastInspectionDate` inside the same
  // transaction so a future refactor cannot silently split the bump.
  // -------------------------------------------------------------------
  describe('create_element_history_event — lastInspectionDate sync', () => {
    /**
     * Seeds a fresh element with a known initial `lastInspectionDate` and
     * `currentLifespan` so each event-type assertion has a stable baseline
     * without polluting the shared `baseElementId` fixture used elsewhere.
     */
    async function seedFreshHistoryElement(opts: {
      initialInspection: string; // YYYY-MM-DD
      initialLifespan: number;
    }): Promise<string> {
      const [el] = await db
        .insert(schema.buildingElements)
        .values({
          buildingId: inScopeBuildingId,
          uniformatCode: TEST_LEVEL3_CODE,
          name: `inv-it-history-${randomUUID().slice(0, 8)}`,
          currentCondition: 'good',
          lastInspectionDate: opts.initialInspection,
          currentLifespan: opts.initialLifespan,
        })
        .returning({ id: schema.buildingElements.id });
      createdElementIds.push(el.id);
      return el.id;
    }

    it.each([
      { eventType: 'repair', expectedBump: true },
      { eventType: 'minor_rehab', expectedBump: true },
      { eventType: 'construction', expectedBump: false },
      { eventType: 'major_rehab', expectedBump: false },
      { eventType: 'replacement', expectedBump: false },
    ] as const)(
      'eventType=$eventType — lastInspectionDate is bumped only for repair-style events',
      async ({ eventType, expectedBump }) => {
        const initialInspection = '2020-01-01';
        const initialLifespan = 30;
        const eventDate = '2025-04-15';
        const elementId = await seedFreshHistoryElement({
          initialInspection,
          initialLifespan,
        });

        const [before] = await db
          .select({
            updatedAt: schema.buildingElements.updatedAt,
            lastInspectionDate: schema.buildingElements.lastInspectionDate,
            currentLifespan: schema.buildingElements.currentLifespan,
          })
          .from(schema.buildingElements)
          .where(eq(schema.buildingElements.id, elementId));
        expect(before!.lastInspectionDate).toBe(initialInspection);
        expect(before!.currentLifespan).toBe(initialLifespan);

        // Wait long enough that `new Date()` inside the tool will be
        // strictly later than the `defaultNow()` captured on insert. The
        // millisecond wall-clock advance is what makes the `updatedAt`
        // ordering assertion below reliable.
        await new Promise((r) => setTimeout(r, 50));

        const handler = getToolHandler(server, 'create_element_history_event');
        const result = await handler(
          {
            role: 'admin',
            elementId,
            eventType,
            eventDate,
            workDescription: `${eventType} event integration test`,
          },
          {},
        );
        const text = parseToolText(result);
        expect(text).not.toMatch(/access denied|not found|failed to create/i);
        const parsed = JSON.parse(text) as {
          event: { id: string; eventType: string; elementId: string };
          updatedElement: {
            id: string;
            currentLifespan: number | null;
            lastInspectionDate: string | null;
          } | null;
        };
        createdHistoryIds.push(parsed.event.id);
        expect(parsed.event.eventType).toBe(eventType);
        expect(parsed.event.elementId).toBe(elementId);

        const [after] = await db
          .select({
            updatedAt: schema.buildingElements.updatedAt,
            lastInspectionDate: schema.buildingElements.lastInspectionDate,
            currentLifespan: schema.buildingElements.currentLifespan,
          })
          .from(schema.buildingElements)
          .where(eq(schema.buildingElements.id, elementId));

        if (expectedBump) {
          // repair / minor_rehab — both the column and its `updatedAt`
          // sibling must move, and the tool must echo the same value.
          expect(after!.lastInspectionDate).toBe(eventDate);
          expect(after!.updatedAt!.getTime()).toBeGreaterThan(
            before!.updatedAt!.getTime(),
          );
          expect(parsed.updatedElement).not.toBeNull();
          expect(parsed.updatedElement!.id).toBe(elementId);
          expect(parsed.updatedElement!.lastInspectionDate).toBe(eventDate);
        } else {
          // construction / major_rehab / replacement — no `lifespanImpact`
          // was supplied either, so the tool must skip the element write
          // entirely. That means `updatedAt` is preserved and the tool
          // returns `updatedElement: null` so callers can tell the
          // element row was untouched.
          expect(after!.lastInspectionDate).toBe(initialInspection);
          expect(after!.updatedAt!.getTime()).toBe(
            before!.updatedAt!.getTime(),
          );
          expect(parsed.updatedElement).toBeNull();
        }
        // `currentLifespan` is only ever touched when `lifespanImpact` is
        // supplied, regardless of the event type.
        expect(after!.currentLifespan).toBe(initialLifespan);
      },
      30000,
    );

    it('updates currentLifespan AND lastInspectionDate in the same transaction when lifespanImpact + repair-style eventType are supplied', async () => {
      const initialInspection = '2019-05-05';
      const initialLifespan = 25;
      const lifespanImpact = 7;
      const eventDate = '2025-08-01';
      const elementId = await seedFreshHistoryElement({
        initialInspection,
        initialLifespan,
      });

      const handler = getToolHandler(server, 'create_element_history_event');
      const result = await handler(
        {
          role: 'admin',
          elementId,
          eventType: 'repair',
          eventDate,
          workDescription: 'combined lifespan + inspection bump',
          lifespanImpact,
        },
        {},
      );
      const text = parseToolText(result);
      expect(text).not.toMatch(/access denied|not found|failed to create/i);
      const parsed = JSON.parse(text) as {
        event: { id: string; lifespanImpact: number | null };
        updatedElement: {
          id: string;
          currentLifespan: number | null;
          lastInspectionDate: string | null;
        } | null;
      };
      createdHistoryIds.push(parsed.event.id);

      // Tool response — both writes are reflected in the returned snapshot.
      expect(parsed.updatedElement).not.toBeNull();
      expect(parsed.updatedElement!.currentLifespan).toBe(
        initialLifespan + lifespanImpact,
      );
      expect(parsed.updatedElement!.lastInspectionDate).toBe(eventDate);

      // DB read-back — both writes landed atomically. If the bump had
      // been split across two updates a half-applied state would surface
      // here when one of them silently no-op'd.
      const [row] = await db
        .select({
          currentLifespan: schema.buildingElements.currentLifespan,
          lastInspectionDate: schema.buildingElements.lastInspectionDate,
        })
        .from(schema.buildingElements)
        .where(eq(schema.buildingElements.id, elementId));
      expect(row!.currentLifespan).toBe(initialLifespan + lifespanImpact);
      expect(row!.lastInspectionDate).toBe(eventDate);
    }, 30000);

    it('non-repair eventType + lifespanImpact bumps currentLifespan but leaves lastInspectionDate untouched', async () => {
      // Guards against the inverse mistake of the bump above: a future
      // refactor that always sets `lastInspectionDate = eventDate` once
      // any element write happens (e.g. because the lifespan branch
      // already opens an UPDATE) would break parity with the REST
      // endpoint, which only treats `repair`/`minor_rehab` as inspection
      // events.
      const initialInspection = '2018-03-03';
      const initialLifespan = 40;
      const lifespanImpact = 5;
      const elementId = await seedFreshHistoryElement({
        initialInspection,
        initialLifespan,
      });

      const handler = getToolHandler(server, 'create_element_history_event');
      const result = await handler(
        {
          role: 'admin',
          elementId,
          eventType: 'major_rehab',
          eventDate: '2026-02-02',
          workDescription: 'major rehab with lifespan bump',
          lifespanImpact,
        },
        {},
      );
      const text = parseToolText(result);
      expect(text).not.toMatch(/access denied|not found|failed to create/i);
      const parsed = JSON.parse(text) as {
        event: { id: string };
        updatedElement: {
          currentLifespan: number | null;
          lastInspectionDate: string | null;
        } | null;
      };
      createdHistoryIds.push(parsed.event.id);

      expect(parsed.updatedElement).not.toBeNull();
      expect(parsed.updatedElement!.currentLifespan).toBe(
        initialLifespan + lifespanImpact,
      );
      expect(parsed.updatedElement!.lastInspectionDate).toBe(initialInspection);

      const [row] = await db
        .select({
          currentLifespan: schema.buildingElements.currentLifespan,
          lastInspectionDate: schema.buildingElements.lastInspectionDate,
        })
        .from(schema.buildingElements)
        .where(eq(schema.buildingElements.id, elementId));
      expect(row!.currentLifespan).toBe(initialLifespan + lifespanImpact);
      expect(row!.lastInspectionDate).toBe(initialInspection);
    }, 30000);
  });

  // -------------------------------------------------------------------
  // update_element_history_event + delete_element_history_event
  //
  // Shared helpers seed a fresh element + history pair per test so the
  // lifespan-delta math and refund assertions stay independent. The
  // tools live in `server/mcp/server.ts` next to `create_element_history_event`
  // and run their event-write + element-recompute inside one transaction.
  // -------------------------------------------------------------------
  /**
   * Seed an element with a known starting `currentLifespan` plus a single
   * history row whose `lifespanImpact` is `historyImpact`. The element's
   * `currentLifespan` is initialized to `initialLifespan + (historyImpact ?? 0)`
   * so it represents the state AFTER the history bump was originally
   * applied — the realistic precondition for an update / delete that
   * needs to roll the bump back or re-bump it.
   */
  async function seedElementWithHistory(opts: {
    initialLifespan: number;
    historyImpact: number | null;
    eventType?:
      | 'construction'
      | 'repair'
      | 'minor_rehab'
      | 'major_rehab'
      | 'replacement';
    cost?: string;
    vendorId?: string;
  }): Promise<{ elementId: string; historyId: string }> {
    const startingLifespan = opts.initialLifespan + (opts.historyImpact ?? 0);
    const [el] = await db
      .insert(schema.buildingElements)
      .values({
        buildingId: inScopeBuildingId,
        uniformatCode: TEST_LEVEL3_CODE,
        name: `inv-it-edit-${randomUUID().slice(0, 8)}`,
        currentCondition: 'good',
        currentLifespan: startingLifespan,
      })
      .returning({ id: schema.buildingElements.id });
    createdElementIds.push(el.id);
    const [hist] = await db
      .insert(schema.elementHistory)
      .values({
        elementId: el.id,
        eventType: opts.eventType ?? 'minor_rehab',
        eventDate: '2024-01-15',
        workDescription: 'edit-test seed event',
        createdBy: adminUserId,
        ...(opts.cost !== undefined && { cost: opts.cost }),
        ...(opts.vendorId !== undefined && { vendorId: opts.vendorId }),
        ...(opts.historyImpact !== null && {
          lifespanImpact: opts.historyImpact,
        }),
      })
      .returning({ id: schema.elementHistory.id });
    createdHistoryIds.push(hist.id);
    return { elementId: el.id, historyId: hist.id };
  }

  describe('update_element_history_event', () => {
    it('rejects when the history row\'s element lives in a non-MCP organization', async () => {
      // Seed a history row attached to the out-of-scope element so the
      // tool's element->building->organization lookup falls outside the
      // MCP scope. Without this guard, an MCP caller could mutate work
      // history on someone else's portfolio just by knowing the row id.
      const [hist] = await db
        .insert(schema.elementHistory)
        .values({
          elementId: outOfScopeElementId,
          eventType: 'repair',
          eventDate: '2024-04-04',
          workDescription: 'out-of-scope row for update guard',
          createdBy: adminUserId,
        })
        .returning({ id: schema.elementHistory.id });
      createdHistoryIds.push(hist.id);

      const handler = getToolHandler(server, 'update_element_history_event');
      const result = await handler(
        {
          role: 'admin',
          historyId: hist.id,
          workDescription: 'attempted overwrite from MCP scope',
        },
        {},
      );
      expect(parseToolText(result)).toMatch(/access denied/i);

      // The row is unchanged — the org guard short-circuited before the
      // transaction opened.
      const [after] = await db
        .select({
          workDescription: schema.elementHistory.workDescription,
        })
        .from(schema.elementHistory)
        .where(eq(schema.elementHistory.id, hist.id));
      expect(after!.workDescription).toBe('out-of-scope row for update guard');
    }, 30000);

    it('updates cost / vendor / event type and returns the new row', async () => {
      const vendorId = (
        await db
          .insert(schema.vendors)
          .values({
            organizationId: mcpOrgId,
            name: `inv-it-update-vendor-${randomUUID().slice(0, 8)}`,
            isActive: true,
          })
          .returning({ id: schema.vendors.id })
      )[0].id;
      createdVendorIds.push(vendorId);

      const { historyId } = await seedElementWithHistory({
        initialLifespan: 20,
        historyImpact: 0,
        eventType: 'minor_rehab',
        cost: '100.00',
      });

      const handler = getToolHandler(server, 'update_element_history_event');
      const result = await handler(
        {
          role: 'admin',
          historyId,
          eventType: 'major_rehab',
          cost: 1234.56,
          vendorId,
        },
        {},
      );
      const text = parseToolText(result);
      expect(text).not.toMatch(/access denied|not found|failed to update/i);
      const parsed = JSON.parse(text) as {
        event: {
          id: string;
          eventType: string;
          cost: string | null;
          vendorId: string | null;
          workDescription: string;
        };
        updatedElement: { id: string; currentLifespan: number | null } | null;
      };
      expect(parsed.event.id).toBe(historyId);
      expect(parsed.event.eventType).toBe('major_rehab');
      // Drizzle's decimal columns round-trip as strings — Postgres normalises
      // 1234.56 to "1234.56" with trailing zeros preserved.
      expect(parsed.event.cost).toBe('1234.56');
      expect(parsed.event.vendorId).toBe(vendorId);
      // Untouched fields are preserved (the seed value).
      expect(parsed.event.workDescription).toBe('edit-test seed event');
      // No `lifespanImpact` change → tool must skip the element write.
      expect(parsed.updatedElement).toBeNull();

      // DB read-back confirms the columns moved.
      const [row] = await db
        .select({
          eventType: schema.elementHistory.eventType,
          cost: schema.elementHistory.cost,
          vendorId: schema.elementHistory.vendorId,
        })
        .from(schema.elementHistory)
        .where(eq(schema.elementHistory.id, historyId));
      expect(row!.eventType).toBe('major_rehab');
      expect(row!.cost).toBe('1234.56');
      expect(row!.vendorId).toBe(vendorId);
    }, 30000);

    it('rejects vendors from a different organization (cross-org guard)', async () => {
      const foreignVendorId = (
        await db
          .insert(schema.vendors)
          .values({
            organizationId: otherOrgId,
            name: `inv-it-foreign-vendor-${randomUUID().slice(0, 8)}`,
            isActive: true,
          })
          .returning({ id: schema.vendors.id })
      )[0].id;
      createdVendorIds.push(foreignVendorId);

      const { historyId } = await seedElementWithHistory({
        initialLifespan: 10,
        historyImpact: 0,
      });

      const handler = getToolHandler(server, 'update_element_history_event');
      const result = await handler(
        { role: 'admin', historyId, vendorId: foreignVendorId },
        {},
      );
      expect(parseToolText(result)).toMatch(
        /does not belong to the element's organization/i,
      );

      // The vendor was NOT attached.
      const [row] = await db
        .select({ vendorId: schema.elementHistory.vendorId })
        .from(schema.elementHistory)
        .where(eq(schema.elementHistory.id, historyId));
      expect(row!.vendorId).toBeNull();
    }, 30000);

    it.each([
      { from: 5, to: 10, description: 'increase (+5)' },
      { from: 10, to: 2, description: 'decrease (-8)' },
    ] as const)(
      'changes lifespanImpact $from→$to and shifts currentLifespan by the delta ($description)',
      async ({ from, to }) => {
        const initialLifespan = 30;
        const { elementId, historyId } = await seedElementWithHistory({
          initialLifespan,
          historyImpact: from,
        });
        // Sanity: the seeded element reflects the prior bump.
        const [pre] = await db
          .select({ currentLifespan: schema.buildingElements.currentLifespan })
          .from(schema.buildingElements)
          .where(eq(schema.buildingElements.id, elementId));
        expect(pre!.currentLifespan).toBe(initialLifespan + from);

        const handler = getToolHandler(server, 'update_element_history_event');
        const result = await handler(
          { role: 'admin', historyId, lifespanImpact: to },
          {},
        );
        const text = parseToolText(result);
        expect(text).not.toMatch(/access denied|failed to update/i);
        const parsed = JSON.parse(text) as {
          event: { id: string; lifespanImpact: number | null };
          updatedElement: { id: string; currentLifespan: number | null } | null;
        };
        expect(parsed.event.lifespanImpact).toBe(to);
        expect(parsed.updatedElement).not.toBeNull();
        expect(parsed.updatedElement!.id).toBe(elementId);
        expect(parsed.updatedElement!.currentLifespan).toBe(
          initialLifespan + to,
        );

        const [post] = await db
          .select({ currentLifespan: schema.buildingElements.currentLifespan })
          .from(schema.buildingElements)
          .where(eq(schema.buildingElements.id, elementId));
        expect(post!.currentLifespan).toBe(initialLifespan + to);
      },
      30000,
    );

    it('clamps currentLifespan at 0 when the lifespan delta would push it negative', async () => {
      // Element starts at 1, history's prior bump was 10 → so the
      // realistic post-create currentLifespan baked into the seed is 11.
      // Wait — we want to provoke the clamp on *update*, so the delta
      // (new - old) must exceed currentLifespan in the negative direction.
      // Seed: history.lifespanImpact=10, element.currentLifespan=3
      // (someone trimmed the element down between create and update).
      // Update: lifespanImpact -> 0  =>  delta = -10  =>  Math.max(0, 3-10) = 0.
      const [el] = await db
        .insert(schema.buildingElements)
        .values({
          buildingId: inScopeBuildingId,
          uniformatCode: TEST_LEVEL3_CODE,
          name: `inv-it-clamp-${randomUUID().slice(0, 8)}`,
          currentCondition: 'good',
          currentLifespan: 3,
        })
        .returning({ id: schema.buildingElements.id });
      createdElementIds.push(el.id);
      const [hist] = await db
        .insert(schema.elementHistory)
        .values({
          elementId: el.id,
          eventType: 'minor_rehab',
          eventDate: '2024-02-02',
          workDescription: 'clamp-test seed',
          createdBy: adminUserId,
          lifespanImpact: 10,
        })
        .returning({ id: schema.elementHistory.id });
      createdHistoryIds.push(hist.id);

      const handler = getToolHandler(server, 'update_element_history_event');
      const result = await handler(
        { role: 'admin', historyId: hist.id, lifespanImpact: 0 },
        {},
      );
      const parsed = JSON.parse(parseToolText(result)) as {
        updatedElement: { currentLifespan: number | null } | null;
      };
      expect(parsed.updatedElement).not.toBeNull();
      expect(parsed.updatedElement!.currentLifespan).toBe(0);

      const [row] = await db
        .select({ currentLifespan: schema.buildingElements.currentLifespan })
        .from(schema.buildingElements)
        .where(eq(schema.buildingElements.id, el.id));
      expect(row!.currentLifespan).toBe(0);
    }, 30000);

    it('clearing lifespanImpact to null refunds the prior bump', async () => {
      const initialLifespan = 25;
      const priorBump = 6;
      const { elementId, historyId } = await seedElementWithHistory({
        initialLifespan,
        historyImpact: priorBump,
      });

      const handler = getToolHandler(server, 'update_element_history_event');
      const result = await handler(
        { role: 'admin', historyId, lifespanImpact: null },
        {},
      );
      const text = parseToolText(result);
      expect(text).not.toMatch(/access denied|failed to update/i);
      const parsed = JSON.parse(text) as {
        event: { lifespanImpact: number | null };
        updatedElement: { currentLifespan: number | null } | null;
      };
      expect(parsed.event.lifespanImpact).toBeNull();
      expect(parsed.updatedElement).not.toBeNull();
      // Refund: (initial+priorBump) + (0 - priorBump) = initial.
      expect(parsed.updatedElement!.currentLifespan).toBe(initialLifespan);

      const [row] = await db
        .select({
          currentLifespan: schema.buildingElements.currentLifespan,
          lifespanImpact: schema.elementHistory.lifespanImpact,
        })
        .from(schema.buildingElements)
        .innerJoin(
          schema.elementHistory,
          eq(schema.elementHistory.elementId, schema.buildingElements.id),
        )
        .where(
          and(
            eq(schema.buildingElements.id, elementId),
            eq(schema.elementHistory.id, historyId),
          ),
        );
      expect(row!.currentLifespan).toBe(initialLifespan);
      expect(row!.lifespanImpact).toBeNull();
    }, 30000);
  });

  describe('delete_element_history_event', () => {
    it('rejects when the history row\'s element lives in a non-MCP organization', async () => {
      // Same guard as the update tool — out-of-scope deletes must be
      // refused before the transaction even opens.
      const [hist] = await db
        .insert(schema.elementHistory)
        .values({
          elementId: outOfScopeElementId,
          eventType: 'repair',
          eventDate: '2024-05-05',
          workDescription: 'out-of-scope row for delete guard',
          createdBy: adminUserId,
        })
        .returning({ id: schema.elementHistory.id });
      createdHistoryIds.push(hist.id);

      const handler = getToolHandler(server, 'delete_element_history_event');
      const result = await handler(
        { role: 'admin', historyId: hist.id },
        {},
      );
      expect(parseToolText(result)).toMatch(/access denied/i);

      // Row still present.
      const stillThere = await db
        .select({ id: schema.elementHistory.id })
        .from(schema.elementHistory)
        .where(eq(schema.elementHistory.id, hist.id));
      expect(stillThere).toHaveLength(1);
    }, 30000);

    it('deletes the row and refunds lifespanImpact from currentLifespan', async () => {
      const initialLifespan = 18;
      const priorBump = 4;
      const { elementId, historyId } = await seedElementWithHistory({
        initialLifespan,
        historyImpact: priorBump,
      });

      const handler = getToolHandler(server, 'delete_element_history_event');
      const result = await handler(
        { role: 'admin', historyId },
        {},
      );
      const text = parseToolText(result);
      expect(text).not.toMatch(/access denied|fk_violation|failed to delete/i);
      const parsed = JSON.parse(text) as {
        deleted: { id: string };
        updatedElement: { id: string; currentLifespan: number | null } | null;
      };
      expect(parsed.deleted.id).toBe(historyId);
      expect(parsed.updatedElement).not.toBeNull();
      expect(parsed.updatedElement!.id).toBe(elementId);
      expect(parsed.updatedElement!.currentLifespan).toBe(initialLifespan);

      // History row is gone, element refund persisted.
      const remainingHistory = await db
        .select({ id: schema.elementHistory.id })
        .from(schema.elementHistory)
        .where(eq(schema.elementHistory.id, historyId));
      expect(remainingHistory).toHaveLength(0);
      const [row] = await db
        .select({ currentLifespan: schema.buildingElements.currentLifespan })
        .from(schema.buildingElements)
        .where(eq(schema.buildingElements.id, elementId));
      expect(row!.currentLifespan).toBe(initialLifespan);
    }, 30000);

    it('clamps the refund at 0 when prior bump exceeds currentLifespan', async () => {
      // Defensive against the same negative-clamp regression as the update
      // path — if someone manually trimmed the element below the prior
      // bump, deleting the history row must still leave the element at 0
      // rather than dipping into negatives.
      const [el] = await db
        .insert(schema.buildingElements)
        .values({
          buildingId: inScopeBuildingId,
          uniformatCode: TEST_LEVEL3_CODE,
          name: `inv-it-del-clamp-${randomUUID().slice(0, 8)}`,
          currentCondition: 'good',
          currentLifespan: 2,
        })
        .returning({ id: schema.buildingElements.id });
      createdElementIds.push(el.id);
      const [hist] = await db
        .insert(schema.elementHistory)
        .values({
          elementId: el.id,
          eventType: 'minor_rehab',
          eventDate: '2024-03-03',
          workDescription: 'delete-clamp seed',
          createdBy: adminUserId,
          lifespanImpact: 12,
        })
        .returning({ id: schema.elementHistory.id });
      createdHistoryIds.push(hist.id);

      const handler = getToolHandler(server, 'delete_element_history_event');
      const result = await handler(
        { role: 'admin', historyId: hist.id },
        {},
      );
      const parsed = JSON.parse(parseToolText(result)) as {
        deleted: { id: string };
        updatedElement: { currentLifespan: number | null } | null;
      };
      expect(parsed.deleted.id).toBe(hist.id);
      expect(parsed.updatedElement).not.toBeNull();
      expect(parsed.updatedElement!.currentLifespan).toBe(0);
    }, 30000);

    it('returns the structured FK_VIOLATION envelope when the DB raises 23503', async () => {
      // No FK currently points TO `element_history`, so a real 23503 is
      // not organically reachable. The envelope wiring through
      // `buildWriteErrorResponse` must still be exercised end-to-end so a
      // future schema change (e.g. an audit table referencing the row)
      // doesn't quietly bypass the structured error contract. The tool's
      // delete runs inside `db.transaction(...)`, so we mock the
      // transaction itself to throw a Postgres-shaped error.
      const { historyId } = await seedElementWithHistory({
        initialLifespan: 5,
        historyImpact: 0,
      });

      const fkError = Object.assign(new Error('fk violation'), {
        code: '23503',
        detail:
          `Key (id)=(${historyId}) is still referenced from table "audit_logs".`,
      });

      const transactionSpy = jest
        .spyOn(db, 'transaction')
        .mockImplementationOnce((async () => {
          throw fkError;
        }) as never);

      try {
        const handler = getToolHandler(server, 'delete_element_history_event');
        const result = await handler(
          { role: 'admin', historyId },
          {},
        );
        const parsed = JSON.parse(parseToolText(result)) as {
          status: string;
          code: string;
          retryable: boolean;
          blocking_entity: string;
          message: string;
        };
        expect(parsed.status).toBe('fk_violation');
        expect(parsed.code).toBe('FK_VIOLATION');
        expect(parsed.retryable).toBe(false);
        // `audit_logs` is not in FK_TABLE_TO_ENTITY → fallback strips the
        // trailing "s" to produce a singular entity label.
        expect(parsed.blocking_entity).toBe('audit_log');
        expect(parsed.message).toMatch(/cannot delete element history event/i);
      } finally {
        transactionSpy.mockRestore();
      }

      // The history row is still present because the simulated transaction
      // threw before any real delete fired.
      const stillThere = await db
        .select({ id: schema.elementHistory.id })
        .from(schema.elementHistory)
        .where(eq(schema.elementHistory.id, historyId));
      expect(stillThere).toHaveLength(1);
    }, 30000);
  });

  // -------------------------------------------------------------------
  // delete_inventory_element — cascade success + FK envelope
  // -------------------------------------------------------------------
  describe('delete_inventory_element', () => {
    it('cascades history and project_elements when the element is deleted', async () => {
      // Build a fresh element + project + history graph so the cascade
      // assertions don't disturb other tests' fixtures.
      const [element] = await db
        .insert(schema.buildingElements)
        .values({
          buildingId: inScopeBuildingId,
          uniformatCode: TEST_LEVEL3_CODE,
          name: `inv-it-cascade-${runId}`,
          currentCondition: 'good',
        })
        .returning({ id: schema.buildingElements.id });

      const [history] = await db
        .insert(schema.elementHistory)
        .values({
          elementId: element.id,
          eventType: 'repair',
          eventDate: '2025-01-01',
          workDescription: 'cascade-test repair event',
          cost: '120.00',
          createdBy: adminUserId,
        })
        .returning({ id: schema.elementHistory.id });

      const [project] = await db
        .insert(schema.maintenanceProjects)
        .values({
          buildingId: inScopeBuildingId,
          projectNumber: `INV-IT-${runId}`,
          title: 'Cascade Test Project',
          createdBy: adminUserId,
        })
        .returning({ id: schema.maintenanceProjects.id });
      createdProjectIds.push(project.id);

      await db.insert(schema.projectElements).values({
        projectId: project.id,
        elementId: element.id,
        workDescription: 'cascade test work',
      });

      const handler = getToolHandler(server, 'delete_inventory_element');
      const result = await handler(
        { role: 'admin', elementId: element.id },
        {},
      );
      const text = parseToolText(result);
      expect(text).not.toMatch(/access denied|fk_violation|failed to delete/i);
      const parsed = JSON.parse(text) as {
        deleted: { id: string };
        message: string;
      };
      expect(parsed.deleted.id).toBe(element.id);

      // Element row gone.
      const remainingElement = await db
        .select({ id: schema.buildingElements.id })
        .from(schema.buildingElements)
        .where(eq(schema.buildingElements.id, element.id));
      expect(remainingElement).toHaveLength(0);

      // History cascaded.
      const remainingHistory = await db
        .select({ id: schema.elementHistory.id })
        .from(schema.elementHistory)
        .where(eq(schema.elementHistory.id, history.id));
      expect(remainingHistory).toHaveLength(0);

      // project_elements junction row cascaded.
      const remainingProjectElements = await db
        .select({ id: schema.projectElements.id })
        .from(schema.projectElements)
        .where(eq(schema.projectElements.elementId, element.id));
      expect(remainingProjectElements).toHaveLength(0);

      // The maintenance_projects row itself must NOT be cascaded — only
      // its junction row to the deleted element. This protects against a
      // future schema change accidentally turning the cascade into a
      // project-deleting bomb.
      const projectStillThere = await db
        .select({ id: schema.maintenanceProjects.id })
        .from(schema.maintenanceProjects)
        .where(eq(schema.maintenanceProjects.id, project.id));
      expect(projectStillThere).toHaveLength(1);
    }, 60000);

    it('returns the structured FK_VIOLATION envelope when the DB raises 23503', async () => {
      // Every FK that points at `building_elements.id` is declared with
      // ON DELETE CASCADE in the schema, so a real-world delete cannot
      // organically raise 23503 from this tool today. The envelope wiring
      // through `buildWriteErrorResponse` must still be exercised end-to-
      // end in case a future schema change tightens one of those FKs to
      // RESTRICT (e.g. preserving history at the DB layer instead of the
      // application layer, as the tool docstring already promises). We
      // simulate the violation by spying on `db.delete` for one call and
      // throwing a Postgres-shaped error matching the shape parsed in
      // `buildWriteErrorResponse`.
      const [element] = await db
        .insert(schema.buildingElements)
        .values({
          buildingId: inScopeBuildingId,
          uniformatCode: TEST_LEVEL3_CODE,
          name: `inv-it-fk-${runId}`,
          currentCondition: 'good',
        })
        .returning({ id: schema.buildingElements.id });
      createdElementIds.push(element.id);

      const fkError = Object.assign(new Error('fk violation'), {
        code: '23503',
        detail:
          `Key (id)=(${element.id}) is still referenced from table "project_elements".`,
      });

      const deleteSpy = jest
        .spyOn(db, 'delete')
        .mockImplementationOnce(() => {
          throw fkError;
        });

      try {
        const handler = getToolHandler(server, 'delete_inventory_element');
        const result = await handler(
          { role: 'admin', elementId: element.id },
          {},
        );
        const parsed = JSON.parse(parseToolText(result)) as {
          status: string;
          code: string;
          retryable: boolean;
          blocking_entity: string;
          message: string;
        };
        expect(parsed.status).toBe('fk_violation');
        expect(parsed.code).toBe('FK_VIOLATION');
        expect(parsed.retryable).toBe(false);
        // FK_TABLE_TO_ENTITY does not include "project_elements", so the
        // helper falls back to the singular form of the table name.
        expect(parsed.blocking_entity).toBe('project_element');
        expect(parsed.message).toMatch(/cannot delete inventory element/i);
      } finally {
        deleteSpy.mockRestore();
      }

      // The element is still present because the simulated delete threw.
      const stillThere = await db
        .select({ id: schema.buildingElements.id })
        .from(schema.buildingElements)
        .where(eq(schema.buildingElements.id, element.id));
      expect(stillThere).toHaveLength(1);
    }, 30000);

    it('rejects deleting an element in a non-MCP organization', async () => {
      const handler = getToolHandler(server, 'delete_inventory_element');
      const result = await handler(
        { role: 'admin', elementId: outOfScopeElementId },
        {},
      );
      expect(parseToolText(result)).toMatch(/access denied/i);
      const stillThere = await db
        .select({ id: schema.buildingElements.id })
        .from(schema.buildingElements)
        .where(eq(schema.buildingElements.id, outOfScopeElementId));
      expect(stillThere).toHaveLength(1);
    }, 30000);
  });
});
