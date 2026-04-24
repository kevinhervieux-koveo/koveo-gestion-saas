/**
 * @jest-environment node
 *
 * Real-Postgres integration tests for the MCP delete tools registered
 * alongside `update_building` / `update_residence` in `server/mcp/server.ts`:
 *
 *   - delete_building
 *   - delete_residence
 *   - delete_bill
 *   - delete_project
 *
 * The mocked-Drizzle tests in `server/tests/mcp-tools.test.ts` stub
 * `db.transaction` and the per-table delete chains, so they only verify
 * the call ordering and the response shape. They cannot catch:
 *
 *   - cascade-delete misconfigurations (a child table that lost its
 *     ON DELETE CASCADE FK, or a handler that stops issuing the delete
 *     in a way Postgres can follow),
 *   - FK-violation regressions (the order of two child deletes gets
 *     swapped and Postgres now rejects the parent delete),
 *   - org-scope filter regressions where an out-of-scope row is
 *     accidentally accepted, or where the rejection path forgets to
 *     short-circuit before the destructive delete fires.
 *
 * This file mirrors the pattern established by
 * `server/tests/mcp-property-update-integration.test.ts`: mocks the
 * unrelated services that `createMcpServer` instantiates during tool
 * registration, then runs each delete tool against the real database
 * captured by jest.polyfills.js into `_INTEGRATION_DB_URL`.
 *
 * The acceptance criteria for this file (task #503) are, for every tool:
 *
 *   1. Exercise the tool against a seeded MCP-1-scoped row and assert
 *      the row is gone and the dependent rows cascade as expected.
 *   2. Assert tenants are denied (and the seeded row is preserved).
 *   3. Assert out-of-scope rows are rejected and preserved.
 *
 * Skipped cleanly when `_INTEGRATION_DB_URL` is not set so unit-tier
 * runs stay green.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { eq, inArray } from 'drizzle-orm';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import type * as SchemaImport from '@shared/schema';

// File-level mocks for unrelated services that `createMcpServer` instantiates
// during tool registration. Mirrors `mcp-property-update-integration.test.ts`
// so the delete branches under test are exercised against the real DB while
// document/storage/AI dependencies stay inert and offline.
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
 * by both the mocked tests in `mcp-tools.test.ts` and the property-update
 * integration tests so the three suites stay symmetrical.
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

describeIfDb('MCP delete_* property-mutation tools — real Postgres', () => {
  // Each test run gets its own suffix so concurrent runs and leftover
  // seed data from other suites cannot collide on the unique constraints
  // (`bills.bill_number`, `users.email`, `maintenance_projects.project_number`).
  const runId = randomUUID().slice(0, 8);
  const mcpOrgName = 'MCP-1'; // MUST be one of MCP_ORG_NAMES in server.ts
  const otherOrgName = `mcp-delete-it-other-${runId}`;

  let db: Db;
  let schema: Schema;
  let server: unknown;

  // Shared seed: orgs, users, a uniformat code (FK target for
  // building_elements when we exercise the cascade), and an in-scope
  // building used by the residence/bill/project tests.
  let mcpOrgId: string;
  let otherOrgId: string;
  let inScopeBuildingId: string;
  let outOfScopeBuildingId: string;
  let userId: string;
  let uniformatCode: string;

  // Per-tool deny rows. These are seeded once and must survive both the
  // tenant-deny and out-of-scope-deny attempts so the assertions can
  // confirm "row preserved".
  let denyResidenceId: string;
  let outOfScopeResidenceId: string;
  let denyBillId: string;
  let outOfScopeBillId: string;
  let denyProjectId: string;
  let outOfScopeProjectId: string;
  // delete_building's deny rows are first-class buildings (separate
  // from the shared in-scope/out-of-scope buildings used by other
  // tools, since a successful cascade later deletes its own building).
  let denyBuildingId: string;
  let outOfScopeBuildingDenyId: string;

  let createdMcpOrgHere = false;
  let createdUniformatHere = false;
  let createdUserHere = false;

  const userEmail = `mcp-delete-it-${runId}@koveo-mcp.test`;

  // Cascade-test rows (seeded inside the cascade tests). Tracked so
  // afterAll can clean them up if a test failed before the handler
  // ran — leaking them would block the next run on the unique-bill-
  // number constraint.
  const cascadeBuildingIds = new Set<string>();
  const cascadeResidenceIds = new Set<string>();
  const cascadeBillIds = new Set<string>();
  const cascadeProjectIds = new Set<string>();
  const cascadeInvoiceIds = new Set<string>();
  const cascadePaymentIds = new Set<string>();
  const cascadeMaintenanceRequestIds = new Set<string>();
  const cascadeUserResidenceIds = new Set<string>();
  const cascadeContactIds = new Set<string>();
  const cascadeProjectStepIds = new Set<string>();
  const cascadeWorkflowTaskIds = new Set<string>();

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    // Restore the real DB URL captured by jest.polyfills.js before
    // jest.setup.simple.ts overwrote it with the placeholder. Done
    // before requiring the db module so the Drizzle pool talks to the
    // real DB.
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    db = require('../db').db as Db;
    schema = require('@shared/schema') as Schema;

    // Reuse a pre-existing MCP-1 organization if one is already seeded
    // (dev DB, shared CI DB), otherwise create one for the run. We
    // track `createdMcpOrgHere` so cleanup only deletes what we own.
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

    // Out-of-scope organization (never an MCP org name) used to seed
    // every tool's "not in MCP scope" deny row.
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

    // A user that owns the seeded maintenance projects (NOT NULL FK on
    // `maintenance_projects.created_by`). The MCP delete tools never
    // attribute the delete back to a user, but createMcpServer registers
    // every tool, so we need at least one valid user row in the DB.
    const [insertedUser] = await db
      .insert(schema.users)
      .values({
        email: userEmail,
        username: `mcp-delete-it-${runId}`,
        password: 'integration-test-disabled',
        firstName: 'Delete',
        lastName: 'IntegrationTest',
        role: 'admin',
        isActive: true,
      })
      .returning({ id: schema.users.id });
    userId = insertedUser.id;
    createdUserHere = true;

    // Uniformat code (FK target for building_elements) — reuse an
    // existing one if available so we don't pollute the dev seed.
    const [existingCode] = await db
      .select({ code: schema.uniformatCodes.code })
      .from(schema.uniformatCodes)
      .limit(1);
    if (existingCode) {
      uniformatCode = existingCode.code;
    } else {
      const code = `T503-${runId.slice(0, 4)}`;
      await db.insert(schema.uniformatCodes).values({
        code,
        level: 1,
        nameFr: 'Test cascade',
        nameEn: 'Test cascade',
      });
      uniformatCode = code;
      createdUniformatHere = true;
    }

    // In-scope shared building. Used as the FK parent for the deny
    // rows of the residence/bill/project tools. Never deleted by any
    // test in this file (cascade tests seed their own building).
    const [inScopeBuilding] = await db
      .insert(schema.buildings)
      .values({
        organizationId: mcpOrgId,
        name: `mcp-del-it-shared-bldg-${runId}`,
        address: '10 Shared St',
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

    // Out-of-scope shared building. Used as the FK parent for the
    // out-of-scope deny rows of the residence/bill/project tools.
    const [outOfScopeBuilding] = await db
      .insert(schema.buildings)
      .values({
        organizationId: otherOrgId,
        name: `mcp-del-it-out-bldg-${runId}`,
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

    // Dedicated deny buildings for the delete_building tool. The
    // cascade test seeds its own building inside the in-scope org,
    // and these two stay alive across the suite so we can re-verify
    // "row preserved" after each deny attempt.
    const [denyBuilding] = await db
      .insert(schema.buildings)
      .values({
        organizationId: mcpOrgId,
        name: `mcp-del-it-deny-bldg-${runId}`,
        address: '11 Deny St',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A1',
        buildingType: 'apartment',
        totalUnits: 2,
        isActive: true,
      })
      .returning({ id: schema.buildings.id });
    denyBuildingId = denyBuilding.id;

    const [outBuildingDeny] = await db
      .insert(schema.buildings)
      .values({
        organizationId: otherOrgId,
        name: `mcp-del-it-out-deny-bldg-${runId}`,
        address: '998 OOS Ave',
        city: 'Quebec',
        province: 'QC',
        postalCode: 'H9Z9Z9',
        buildingType: 'condo',
        totalUnits: 2,
        isActive: true,
      })
      .returning({ id: schema.buildings.id });
    outOfScopeBuildingDenyId = outBuildingDeny.id;

    // Deny residences. The in-scope one lives in the shared in-scope
    // building; the out-of-scope one lives in the shared out-of-scope
    // building. Both must survive every deny attempt below.
    const [denyResidence] = await db
      .insert(schema.residences)
      .values({
        buildingId: inScopeBuildingId,
        unitNumber: `D-${runId}`,
        floor: 1,
        isActive: true,
      })
      .returning({ id: schema.residences.id });
    denyResidenceId = denyResidence.id;

    const [outResidence] = await db
      .insert(schema.residences)
      .values({
        buildingId: outOfScopeBuildingId,
        unitNumber: `OOS-${runId}`,
        floor: 1,
        isActive: true,
      })
      .returning({ id: schema.residences.id });
    outOfScopeResidenceId = outResidence.id;

    // Deny bills.
    const [denyBill] = await db
      .insert(schema.bills)
      .values({
        buildingId: inScopeBuildingId,
        billNumber: `T503-D-${runId}`,
        title: `mcp-del-it-deny-bill-${runId}`,
        category: 'utilities',
        paymentType: 'unique',
        costs: ['10.00'],
        totalAmount: '10.00',
        startDate: '2030-01-01',
      })
      .returning({ id: schema.bills.id });
    denyBillId = denyBill.id;

    const [outBill] = await db
      .insert(schema.bills)
      .values({
        buildingId: outOfScopeBuildingId,
        billNumber: `T503-O-${runId}`,
        title: `mcp-del-it-out-bill-${runId}`,
        category: 'utilities',
        paymentType: 'unique',
        costs: ['10.00'],
        totalAmount: '10.00',
        startDate: '2030-01-01',
      })
      .returning({ id: schema.bills.id });
    outOfScopeBillId = outBill.id;

    // Deny projects. `maintenance_projects.project_number` is unique
    // across the whole table, so include the runId in both.
    const [denyProject] = await db
      .insert(schema.maintenanceProjects)
      .values({
        buildingId: inScopeBuildingId,
        projectNumber: `T503-D-${runId}`,
        title: `mcp-del-it-deny-proj-${runId}`,
        type: 'repair',
        origin: 'manual',
        status: 'planned',
        priority: 'medium',
        createdBy: userId,
      })
      .returning({ id: schema.maintenanceProjects.id });
    denyProjectId = denyProject.id;

    const [outProject] = await db
      .insert(schema.maintenanceProjects)
      .values({
        buildingId: outOfScopeBuildingId,
        projectNumber: `T503-O-${runId}`,
        title: `mcp-del-it-out-proj-${runId}`,
        type: 'repair',
        origin: 'manual',
        status: 'planned',
        priority: 'medium',
        createdBy: userId,
      })
      .returning({ id: schema.maintenanceProjects.id });
    outOfScopeProjectId = outProject.id;

    const { createMcpServer } = require('../mcp/server') as {
      createMcpServer: (auth?: unknown) => unknown;
    };
    server = createMcpServer();
  }, 90000);

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;

    // Cascade-test leftovers (only present if a test failed before the
    // delete handler succeeded). Order matters: child rows first, then
    // parents, mirroring the cascade itself.
    if (cascadePaymentIds.size) {
      await db
        .delete(schema.payments)
        .where(inArray(schema.payments.id, [...cascadePaymentIds]));
    }
    if (cascadeInvoiceIds.size) {
      await db
        .delete(schema.invoices)
        .where(inArray(schema.invoices.id, [...cascadeInvoiceIds]));
    }
    if (cascadeMaintenanceRequestIds.size) {
      await db
        .delete(schema.maintenanceRequests)
        .where(inArray(schema.maintenanceRequests.id, [...cascadeMaintenanceRequestIds]));
    }
    if (cascadeUserResidenceIds.size) {
      await db
        .delete(schema.userResidences)
        .where(inArray(schema.userResidences.id, [...cascadeUserResidenceIds]));
    }
    if (cascadeContactIds.size) {
      await db
        .delete(schema.contacts)
        .where(inArray(schema.contacts.id, [...cascadeContactIds]));
    }
    if (cascadeProjectStepIds.size) {
      await db
        .delete(schema.projectSteps)
        .where(inArray(schema.projectSteps.id, [...cascadeProjectStepIds]));
    }
    if (cascadeWorkflowTaskIds.size) {
      await db
        .delete(schema.workflowTasks)
        .where(inArray(schema.workflowTasks.id, [...cascadeWorkflowTaskIds]));
    }
    if (cascadeBillIds.size) {
      await db
        .delete(schema.bills)
        .where(inArray(schema.bills.id, [...cascadeBillIds]));
    }
    if (cascadeProjectIds.size) {
      await db
        .delete(schema.maintenanceProjects)
        .where(inArray(schema.maintenanceProjects.id, [...cascadeProjectIds]));
    }
    if (cascadeResidenceIds.size) {
      await db
        .delete(schema.residences)
        .where(inArray(schema.residences.id, [...cascadeResidenceIds]));
    }
    if (cascadeBuildingIds.size) {
      await db
        .delete(schema.buildings)
        .where(inArray(schema.buildings.id, [...cascadeBuildingIds]));
    }

    // Deny rows (and their parents).
    if (denyProjectId) {
      await db
        .delete(schema.maintenanceProjects)
        .where(eq(schema.maintenanceProjects.id, denyProjectId));
    }
    if (outOfScopeProjectId) {
      await db
        .delete(schema.maintenanceProjects)
        .where(eq(schema.maintenanceProjects.id, outOfScopeProjectId));
    }
    if (denyBillId) {
      await db.delete(schema.bills).where(eq(schema.bills.id, denyBillId));
    }
    if (outOfScopeBillId) {
      await db.delete(schema.bills).where(eq(schema.bills.id, outOfScopeBillId));
    }
    if (denyResidenceId) {
      await db
        .delete(schema.residences)
        .where(eq(schema.residences.id, denyResidenceId));
    }
    if (outOfScopeResidenceId) {
      await db
        .delete(schema.residences)
        .where(eq(schema.residences.id, outOfScopeResidenceId));
    }
    if (denyBuildingId) {
      await db
        .delete(schema.buildings)
        .where(eq(schema.buildings.id, denyBuildingId));
    }
    if (outOfScopeBuildingDenyId) {
      await db
        .delete(schema.buildings)
        .where(eq(schema.buildings.id, outOfScopeBuildingDenyId));
    }
    if (inScopeBuildingId) {
      await db
        .delete(schema.buildings)
        .where(eq(schema.buildings.id, inScopeBuildingId));
    }
    if (outOfScopeBuildingId) {
      await db
        .delete(schema.buildings)
        .where(eq(schema.buildings.id, outOfScopeBuildingId));
    }

    // Org we created for the run. The MCP-1 org is shared infra and
    // we only delete it if this suite seeded it.
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

    if (createdUserHere && userId) {
      await db.delete(schema.users).where(eq(schema.users.id, userId));
    }
    if (createdUniformatHere && uniformatCode) {
      await db
        .delete(schema.uniformatCodes)
        .where(eq(schema.uniformatCodes.code, uniformatCode));
    }
  }, 90000);

  // ============================================================
  // delete_building
  // ============================================================
  describe('delete_building', () => {
    it('denies tenants and preserves the in-scope building', async () => {
      const handler = getToolHandler(server, 'delete_building');
      const result = await handler(
        { role: 'tenant', buildingId: denyBuildingId },
        {},
      );
      expect(parseToolText(result)).toMatch(/access denied/i);
      // Building still exists.
      const [row] = await db
        .select({ id: schema.buildings.id })
        .from(schema.buildings)
        .where(eq(schema.buildings.id, denyBuildingId));
      expect(row?.id).toBe(denyBuildingId);
    }, 30000);

    it('rejects buildings outside the MCP org scope and preserves them', async () => {
      const handler = getToolHandler(server, 'delete_building');
      const result = await handler(
        { role: 'admin', buildingId: outOfScopeBuildingDenyId },
        {},
      );
      expect(parseToolText(result)).toMatch(/not in an mcp-scoped/i);
      const [row] = await db
        .select({ id: schema.buildings.id })
        .from(schema.buildings)
        .where(eq(schema.buildings.id, outOfScopeBuildingDenyId));
      expect(row?.id).toBe(outOfScopeBuildingDenyId);
    }, 30000);

    it('deletes an in-scope building and cascades dependents', async () => {
      // Fresh building inside the MCP-1 org with at least one row in
      // each of the most common cascade targets: a residence, a bill
      // (with a payment), and a contact attached to the building.
      const [bldg] = await db
        .insert(schema.buildings)
        .values({
          organizationId: mcpOrgId,
          name: `mcp-del-it-cascade-bldg-${runId}`,
          address: '20 Cascade Way',
          city: 'Montreal',
          province: 'QC',
          postalCode: 'H1A1A1',
          buildingType: 'apartment',
          totalUnits: 1,
          totalFloors: 1,
          isActive: true,
        })
        .returning({ id: schema.buildings.id });
      cascadeBuildingIds.add(bldg.id);

      const [res] = await db
        .insert(schema.residences)
        .values({
          buildingId: bldg.id,
          unitNumber: '101',
          floor: 1,
          isActive: true,
        })
        .returning({ id: schema.residences.id });
      cascadeResidenceIds.add(res.id);

      const [bill] = await db
        .insert(schema.bills)
        .values({
          buildingId: bldg.id,
          billNumber: `T503-BC-${runId}`,
          title: `mcp-del-it-cascade-bill-${runId}`,
          category: 'utilities',
          paymentType: 'unique',
          costs: ['25.00'],
          totalAmount: '25.00',
          startDate: '2030-01-01',
        })
        .returning({ id: schema.bills.id });
      cascadeBillIds.add(bill.id);

      const [pmt] = await db
        .insert(schema.payments)
        .values({
          billId: bill.id,
          paymentNumber: 1,
          scheduledDate: '2030-01-01',
          amount: '25.00',
        })
        .returning({ id: schema.payments.id });
      cascadePaymentIds.add(pmt.id);

      const [contact] = await db
        .insert(schema.contacts)
        .values({
          name: `mcp-del-it-cascade-contact-${runId}`,
          entity: 'building',
          entityId: bldg.id,
          contactCategory: 'manager',
          isActive: true,
        })
        .returning({ id: schema.contacts.id });
      cascadeContactIds.add(contact.id);

      // ---- Invoke delete_building ----
      const handler = getToolHandler(server, 'delete_building');
      const result = await handler(
        { role: 'admin', buildingId: bldg.id },
        {},
      );
      const text = parseToolText(result);
      expect(text).not.toMatch(/access denied|not found|Failed to delete/i);
      const parsed = JSON.parse(text) as {
        deleted: { id: string } | null;
        cascaded: Record<string, number>;
        message: string;
      };
      expect(parsed.deleted?.id).toBe(bldg.id);
      // Cascade summary must reflect what we seeded. Other counts may
      // be 0 because we didn't seed those dependents.
      expect(parsed.cascaded.residences).toBe(1);
      expect(parsed.cascaded.bills).toBe(1);
      expect(parsed.cascaded.contacts).toBe(1);
      expect(parsed.message).toMatch(/cascade/i);

      // The building row is gone…
      const remainingBldg = await db
        .select({ id: schema.buildings.id })
        .from(schema.buildings)
        .where(eq(schema.buildings.id, bldg.id));
      expect(remainingBldg).toHaveLength(0);
      cascadeBuildingIds.delete(bldg.id);

      // …and so is every dependent we seeded.
      const remainingRes = await db
        .select({ id: schema.residences.id })
        .from(schema.residences)
        .where(eq(schema.residences.id, res.id));
      expect(remainingRes).toHaveLength(0);
      cascadeResidenceIds.delete(res.id);

      const remainingBill = await db
        .select({ id: schema.bills.id })
        .from(schema.bills)
        .where(eq(schema.bills.id, bill.id));
      expect(remainingBill).toHaveLength(0);
      cascadeBillIds.delete(bill.id);

      const remainingPayment = await db
        .select({ id: schema.payments.id })
        .from(schema.payments)
        .where(eq(schema.payments.id, pmt.id));
      expect(remainingPayment).toHaveLength(0);
      cascadePaymentIds.delete(pmt.id);

      const remainingContact = await db
        .select({ id: schema.contacts.id })
        .from(schema.contacts)
        .where(eq(schema.contacts.id, contact.id));
      expect(remainingContact).toHaveLength(0);
      cascadeContactIds.delete(contact.id);
    }, 60000);
  });

  // ============================================================
  // delete_residence
  // ============================================================
  describe('delete_residence', () => {
    it('denies tenants and preserves the in-scope residence', async () => {
      const handler = getToolHandler(server, 'delete_residence');
      const result = await handler(
        { role: 'tenant', residenceId: denyResidenceId },
        {},
      );
      expect(parseToolText(result)).toMatch(/access denied/i);
      const [row] = await db
        .select({ id: schema.residences.id })
        .from(schema.residences)
        .where(eq(schema.residences.id, denyResidenceId));
      expect(row?.id).toBe(denyResidenceId);
    }, 30000);

    it('rejects residences outside the MCP org scope and preserves them', async () => {
      const handler = getToolHandler(server, 'delete_residence');
      const result = await handler(
        { role: 'admin', residenceId: outOfScopeResidenceId },
        {},
      );
      expect(parseToolText(result)).toMatch(/not in an mcp-scoped/i);
      const [row] = await db
        .select({ id: schema.residences.id })
        .from(schema.residences)
        .where(eq(schema.residences.id, outOfScopeResidenceId));
      expect(row?.id).toBe(outOfScopeResidenceId);
    }, 30000);

    it('deletes an in-scope residence and cascades dependents', async () => {
      // Fresh residence in the shared in-scope building, with a
      // maintenance request and a user-residence link as cascade
      // targets. (Documents/invoices are exercised in the dedicated
      // residence-cascade integration test; this file only needs
      // representative coverage per the task acceptance.)
      const [res] = await db
        .insert(schema.residences)
        .values({
          buildingId: inScopeBuildingId,
          unitNumber: `C-${runId}`,
          floor: 2,
          isActive: true,
        })
        .returning({ id: schema.residences.id });
      cascadeResidenceIds.add(res.id);

      const [mr] = await db
        .insert(schema.maintenanceRequests)
        .values({
          residenceId: res.id,
          submittedBy: userId,
          title: `mcp-del-it-cascade-mr-${runId}`,
          description: 'leaky tap',
          category: 'plumbing',
        })
        .returning({ id: schema.maintenanceRequests.id });
      cascadeMaintenanceRequestIds.add(mr.id);

      const [ur] = await db
        .insert(schema.userResidences)
        .values({
          userId,
          residenceId: res.id,
          relationshipType: 'tenant',
          startDate: '2030-01-01',
          isActive: true,
        })
        .returning({ id: schema.userResidences.id });
      cascadeUserResidenceIds.add(ur.id);

      const handler = getToolHandler(server, 'delete_residence');
      const result = await handler(
        { role: 'admin', residenceId: res.id },
        {},
      );
      const text = parseToolText(result);
      expect(text).not.toMatch(/access denied|not found|Failed to delete/i);
      const parsed = JSON.parse(text) as {
        deleted: { residenceId: string } | null;
        cascaded: Record<string, number>;
        message: string;
      };
      expect(parsed.deleted?.residenceId).toBe(res.id);
      expect(parsed.cascaded.maintenanceRequests).toBe(1);
      expect(parsed.cascaded.userResidences).toBe(1);
      expect(parsed.message).toMatch(/cascade/i);

      // Row gone.
      const remainingRes = await db
        .select({ id: schema.residences.id })
        .from(schema.residences)
        .where(eq(schema.residences.id, res.id));
      expect(remainingRes).toHaveLength(0);
      cascadeResidenceIds.delete(res.id);

      // Dependents gone.
      const remainingMr = await db
        .select({ id: schema.maintenanceRequests.id })
        .from(schema.maintenanceRequests)
        .where(eq(schema.maintenanceRequests.id, mr.id));
      expect(remainingMr).toHaveLength(0);
      cascadeMaintenanceRequestIds.delete(mr.id);

      const remainingUr = await db
        .select({ id: schema.userResidences.id })
        .from(schema.userResidences)
        .where(eq(schema.userResidences.id, ur.id));
      expect(remainingUr).toHaveLength(0);
      cascadeUserResidenceIds.delete(ur.id);
    }, 60000);
  });

  // ============================================================
  // delete_bill
  // ============================================================
  describe('delete_bill', () => {
    it('denies tenants and preserves the in-scope bill', async () => {
      const handler = getToolHandler(server, 'delete_bill');
      const result = await handler(
        { role: 'tenant', billId: denyBillId },
        {},
      );
      expect(parseToolText(result)).toMatch(/access denied/i);
      const [row] = await db
        .select({ id: schema.bills.id })
        .from(schema.bills)
        .where(eq(schema.bills.id, denyBillId));
      expect(row?.id).toBe(denyBillId);
    }, 30000);

    it('rejects bills outside the MCP org scope and preserves them', async () => {
      const handler = getToolHandler(server, 'delete_bill');
      const result = await handler(
        { role: 'admin', billId: outOfScopeBillId },
        {},
      );
      expect(parseToolText(result)).toMatch(/not attached to an mcp-scoped/i);
      const [row] = await db
        .select({ id: schema.bills.id })
        .from(schema.bills)
        .where(eq(schema.bills.id, outOfScopeBillId));
      expect(row?.id).toBe(outOfScopeBillId);
    }, 30000);

    it('deletes an in-scope bill and cascades its payments', async () => {
      const [bill] = await db
        .insert(schema.bills)
        .values({
          buildingId: inScopeBuildingId,
          billNumber: `T503-BCB-${runId}`,
          title: `mcp-del-it-cascade-bill-only-${runId}`,
          category: 'utilities',
          paymentType: 'recurrent',
          costs: ['100.00', '100.00'],
          totalAmount: '200.00',
          startDate: '2030-01-01',
        })
        .returning({ id: schema.bills.id });
      cascadeBillIds.add(bill.id);

      const [pmt1] = await db
        .insert(schema.payments)
        .values({
          billId: bill.id,
          paymentNumber: 1,
          scheduledDate: '2030-01-01',
          amount: '100.00',
        })
        .returning({ id: schema.payments.id });
      cascadePaymentIds.add(pmt1.id);
      const [pmt2] = await db
        .insert(schema.payments)
        .values({
          billId: bill.id,
          paymentNumber: 2,
          scheduledDate: '2030-02-01',
          amount: '100.00',
        })
        .returning({ id: schema.payments.id });
      cascadePaymentIds.add(pmt2.id);

      const handler = getToolHandler(server, 'delete_bill');
      const result = await handler(
        { role: 'admin', billId: bill.id },
        {},
      );
      const text = parseToolText(result);
      expect(text).not.toMatch(/access denied|not found|Failed to delete/i);
      const parsed = JSON.parse(text) as {
        deleted: { id: string } | null;
        cascaded: { payments: number };
        message: string;
      };
      expect(parsed.deleted?.id).toBe(bill.id);
      expect(parsed.cascaded.payments).toBe(2);
      expect(parsed.message).toMatch(/cascade/i);

      const remainingBill = await db
        .select({ id: schema.bills.id })
        .from(schema.bills)
        .where(eq(schema.bills.id, bill.id));
      expect(remainingBill).toHaveLength(0);
      cascadeBillIds.delete(bill.id);

      const remainingPayments = await db
        .select({ id: schema.payments.id })
        .from(schema.payments)
        .where(inArray(schema.payments.id, [pmt1.id, pmt2.id]));
      expect(remainingPayments).toHaveLength(0);
      cascadePaymentIds.delete(pmt1.id);
      cascadePaymentIds.delete(pmt2.id);
    }, 60000);
  });

  // ============================================================
  // delete_project
  // ============================================================
  describe('delete_project', () => {
    it('denies tenants and preserves the in-scope project', async () => {
      const handler = getToolHandler(server, 'delete_project');
      const result = await handler(
        { role: 'tenant', projectId: denyProjectId },
        {},
      );
      expect(parseToolText(result)).toMatch(/access denied/i);
      const [row] = await db
        .select({ id: schema.maintenanceProjects.id })
        .from(schema.maintenanceProjects)
        .where(eq(schema.maintenanceProjects.id, denyProjectId));
      expect(row?.id).toBe(denyProjectId);
    }, 30000);

    it('rejects projects outside the MCP org scope and preserves them', async () => {
      const handler = getToolHandler(server, 'delete_project');
      const result = await handler(
        { role: 'admin', projectId: outOfScopeProjectId },
        {},
      );
      expect(parseToolText(result)).toMatch(/not attached to an mcp-scoped/i);
      const [row] = await db
        .select({ id: schema.maintenanceProjects.id })
        .from(schema.maintenanceProjects)
        .where(eq(schema.maintenanceProjects.id, outOfScopeProjectId));
      expect(row?.id).toBe(outOfScopeProjectId);
    }, 30000);

    it('deletes an in-scope project and cascades dependents', async () => {
      const [proj] = await db
        .insert(schema.maintenanceProjects)
        .values({
          buildingId: inScopeBuildingId,
          projectNumber: `T503-PC-${runId}`,
          title: `mcp-del-it-cascade-proj-${runId}`,
          type: 'repair',
          origin: 'manual',
          status: 'planned',
          priority: 'medium',
          createdBy: userId,
        })
        .returning({ id: schema.maintenanceProjects.id });
      cascadeProjectIds.add(proj.id);

      const [step] = await db
        .insert(schema.projectSteps)
        .values({
          projectId: proj.id,
          stepType: 'submission',
          isRequired: true,
          status: 'pending',
        })
        .returning({ id: schema.projectSteps.id });
      cascadeProjectStepIds.add(step.id);

      const [task] = await db
        .insert(schema.workflowTasks)
        .values({
          projectId: proj.id,
          phase: 'pre_work',
          taskName: `mcp-del-it-cascade-task-${runId}`,
          orderIndex: 1,
        })
        .returning({ id: schema.workflowTasks.id });
      cascadeWorkflowTaskIds.add(task.id);

      const handler = getToolHandler(server, 'delete_project');
      const result = await handler(
        { role: 'admin', projectId: proj.id },
        {},
      );
      const text = parseToolText(result);
      expect(text).not.toMatch(/access denied|not found|Failed to delete/i);
      const parsed = JSON.parse(text) as {
        deleted: { id: string } | null;
        cascaded: Record<string, number>;
        message: string;
      };
      expect(parsed.deleted?.id).toBe(proj.id);
      expect(parsed.cascaded.projectSteps).toBe(1);
      expect(parsed.cascaded.workflowTasks).toBe(1);
      expect(parsed.message).toMatch(/cascade/i);

      const remainingProj = await db
        .select({ id: schema.maintenanceProjects.id })
        .from(schema.maintenanceProjects)
        .where(eq(schema.maintenanceProjects.id, proj.id));
      expect(remainingProj).toHaveLength(0);
      cascadeProjectIds.delete(proj.id);

      const remainingStep = await db
        .select({ id: schema.projectSteps.id })
        .from(schema.projectSteps)
        .where(eq(schema.projectSteps.id, step.id));
      expect(remainingStep).toHaveLength(0);
      cascadeProjectStepIds.delete(step.id);

      const remainingTask = await db
        .select({ id: schema.workflowTasks.id })
        .from(schema.workflowTasks)
        .where(eq(schema.workflowTasks.id, task.id));
      expect(remainingTask).toHaveLength(0);
      cascadeWorkflowTaskIds.delete(task.id);
    }, 60000);
  });
});
