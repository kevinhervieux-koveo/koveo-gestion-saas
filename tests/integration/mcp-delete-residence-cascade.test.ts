/**
 * @jest-environment node
 *
 * Task #266: Cover the MCP `delete_residence` cascade with a real
 * end-to-end integration test against Postgres.
 *
 * The original mocked unit tests in `server/tests/mcp-tools.test.ts`
 * stub `db.transaction` and the per-table delete chains, so they only
 * verify ordering and the response shape. They cannot catch a regression
 * where, for example, the order of `invoices` vs `documents` deletion
 * gets swapped (and trips the `documents.id` FK from `invoices`), or a
 * new child table gets added without being included in the cascade.
 *
 * This test seeds a real residence inside an MCP-scoped organization
 * with at least one row in every dependent table touched by the
 * cascade — invoices (with a linked document), demands (both as the
 * primary `residenceId` and as `assignationResidenceId` from a sibling
 * demand), maintenance requests, building elements, and user-residence
 * links — then invokes the production `delete_residence` MCP tool
 * handler against the real database. It asserts:
 *
 *   1. Every dependent row that targeted the residence as its primary
 *      owner is gone after the cascade.
 *   2. The sibling demand whose `assignationResidenceId` pointed at the
 *      deleted residence survives but has its `assignationResidenceId`
 *      cleared (matching the documented "demands cleared" semantics).
 *   3. The cascade summary returned by the tool reports the exact
 *      counts that match the rows we seeded.
 *   4. The residence row itself is gone.
 *
 * The test follows the existing real-Postgres integration pattern
 * (`tests/integration/building-create-rollback.test.ts` etc.): it is
 * gated on `_INTEGRATION_DB_URL` (auto-populated from `DATABASE_URL`
 * by `jest.polyfills.js`) and skips cleanly when no Postgres is
 * available.
 */

// Task #274 removed the package-wide drizzle-orm auto-mocks, so the real
// drizzle implementation is loaded by default for integration tests — no
// manual `jest.unmock` calls are required here.
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import crypto from 'crypto';
import { eq, inArray } from 'drizzle-orm';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import * as schemaImport from '@shared/schema';

type Schema = typeof schemaImport;
type Db = NeonDatabase<Schema>;

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const TEST_TAG = 'task266-mcp-residence-cascade';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

interface ToolResult {
  content?: Array<{ text?: string }>;
}

function getToolHandler(server: unknown, toolName: string): (args: unknown, extra: unknown) => Promise<ToolResult> {
  const tools = (server as { _registeredTools?: Record<string, { handler?: unknown; callback?: unknown }> })._registeredTools;
  if (!tools || !tools[toolName]) throw new Error(`Tool "${toolName}" not registered`);
  const fn = (tools[toolName].handler ?? tools[toolName].callback) as
    | ((args: unknown, extra: unknown) => Promise<ToolResult>)
    | undefined;
  if (typeof fn !== 'function') throw new Error(`Tool "${toolName}" handler missing`);
  return fn;
}

function parseToolJson(result: ToolResult): Record<string, unknown> {
  const text = result?.content?.[0]?.text ?? '';
  return JSON.parse(text);
}

describeIfDb('MCP delete_residence cascade — real Postgres (Task #266)', () => {
  let db: Db;
  let schema: Schema;
  let createMcpServer: typeof import('../../server/mcp/server').createMcpServer;

  // Track every row we insert so afterAll can clean up regardless of
  // which assertion (or which prior dev seed) was already in the DB.
  const created = {
    organizationId: null as string | null,
    organizationCreatedByUs: false,
    buildingId: null as string | null,
    residenceIds: new Set<string>(), // primary + sibling residence
    userIds: new Set<string>(),
    documentIds: new Set<string>(),
    invoiceIds: new Set<string>(),
    maintenanceIds: new Set<string>(),
    buildingElementIds: new Set<string>(),
    demandIds: new Set<string>(),
    userResidenceIds: new Set<string>(),
    uniformatCode: null as string | null,
    uniformatCodeCreatedByUs: false,
  };

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    db = require('../../server/db').db as Db;
    schema = require('@shared/schema') as Schema;
    ({ createMcpServer } = require('../../server/mcp/server'));
  }, 60000);

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;

    // Delete in dependent-first order, mirroring the cascade itself,
    // so this still works even if the test failed before the tool ran.
    if (created.invoiceIds.size) {
      await db.delete(schema.invoices).where(inArray(schema.invoices.id, [...created.invoiceIds]));
    }
    if (created.documentIds.size) {
      await db
        .delete(schema.documents)
        .where(inArray(schema.documents.id, [...created.documentIds]));
    }
    if (created.buildingElementIds.size) {
      await db
        .delete(schema.buildingElements)
        .where(inArray(schema.buildingElements.id, [...created.buildingElementIds]));
    }
    if (created.maintenanceIds.size) {
      await db
        .delete(schema.maintenanceRequests)
        .where(inArray(schema.maintenanceRequests.id, [...created.maintenanceIds]));
    }
    if (created.demandIds.size) {
      await db.delete(schema.demands).where(inArray(schema.demands.id, [...created.demandIds]));
    }
    if (created.userResidenceIds.size) {
      await db
        .delete(schema.userResidences)
        .where(inArray(schema.userResidences.id, [...created.userResidenceIds]));
    }
    if (created.residenceIds.size) {
      await db
        .delete(schema.residences)
        .where(inArray(schema.residences.id, [...created.residenceIds]));
    }
    if (created.buildingId) {
      await db.delete(schema.buildings).where(eq(schema.buildings.id, created.buildingId));
    }
    if (created.organizationId && created.organizationCreatedByUs) {
      await db
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, created.organizationId));
    }
    if (created.userIds.size) {
      await db.delete(schema.users).where(inArray(schema.users.id, [...created.userIds]));
    }
    if (created.uniformatCode && created.uniformatCodeCreatedByUs) {
      await db
        .delete(schema.uniformatCodes)
        .where(eq(schema.uniformatCodes.code, created.uniformatCode));
    }
  }, 60000);

  it('deletes the residence and every dependent row, returning matching cascade counts', async () => {
    // 1. Resolve (or seed) an MCP-scoped organization. The MCP scope
    //    check (`getMcpOrgIds`) only allows residences inside orgs
    //    named "MCP-1" or "MCP-2", so we must reuse the existing
    //    sandbox org if it's already in the DB and only insert one
    //    when it isn't.
    const existingMcp = await db
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(eq(schema.organizations.name, 'MCP-1'))
      .limit(1);

    if (existingMcp.length > 0) {
      created.organizationId = existingMcp[0].id;
    } else {
      const orgId = crypto.randomUUID();
      await db.insert(schema.organizations).values({
        id: orgId,
        name: 'MCP-1',
        type: 'syndicate',
        address: `${TEST_TAG} 1`,
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A1',
      });
      created.organizationId = orgId;
      created.organizationCreatedByUs = true;
    }

    // 2. Building inside the MCP-scoped org.
    const buildingId = crypto.randomUUID();
    await db.insert(schema.buildings).values({
      id: buildingId,
      organizationId: created.organizationId,
      name: `${TEST_TAG} bldg`,
      address: '1 Cascade',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
      buildingType: 'condo',
      totalUnits: 2,
      totalFloors: 1,
      isActive: true,
    });
    created.buildingId = buildingId;

    // 3. Two residences: the one we'll delete (primary) and a sibling
    //    used to host a demand whose `assignationResidenceId` points
    //    at the primary — so we can verify the "cleared, not deleted"
    //    branch of the cascade.
    const residenceId = crypto.randomUUID();
    const siblingResidenceId = crypto.randomUUID();
    await db.insert(schema.residences).values([
      { id: residenceId, buildingId, unitNumber: '101', floor: 1, isActive: true },
      {
        id: siblingResidenceId,
        buildingId,
        unitNumber: '102',
        floor: 1,
        isActive: true,
      },
    ]);
    created.residenceIds.add(residenceId);
    created.residenceIds.add(siblingResidenceId);

    // 4. A user we can attach to the residence and use as submitter.
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: userId,
      username: `${TEST_TAG}-${userId.slice(0, 8)}`,
      email: `${TEST_TAG}-${userId.slice(0, 8)}@example.test`,
      password: 'x'.repeat(60),
      firstName: 'Cascade',
      lastName: 'Tester',
      role: 'tenant',
      language: 'en',
    });
    created.userIds.add(userId);

    // 5. Document linked to the residence.
    const documentId = crypto.randomUUID();
    await db.insert(schema.documents).values({
      id: documentId,
      name: `${TEST_TAG}-doc`,
      documentType: 'invoice',
      filePath: `/objects/${TEST_TAG}/${documentId}.pdf`,
      residenceId,
    });
    created.documentIds.add(documentId);

    // 6. Invoice linked to the residence (and to the document above —
    //    this is exactly the FK that breaks if the cascade ever
    //    deletes documents before invoices).
    const invoiceId = crypto.randomUUID();
    await db.insert(schema.invoices).values({
      id: invoiceId,
      vendorName: `${TEST_TAG}-vendor`,
      invoiceNumber: `INV-${invoiceId.slice(0, 8)}`,
      totalAmount: '123.45',
      dueDate: '2030-01-01',
      paymentType: 'one-time',
      documentId,
      buildingId,
      residenceId,
    });
    created.invoiceIds.add(invoiceId);

    // 7. Maintenance request on the residence.
    const maintenanceId = crypto.randomUUID();
    await db.insert(schema.maintenanceRequests).values({
      id: maintenanceId,
      residenceId,
      submittedBy: userId,
      title: `${TEST_TAG}-mr`,
      description: 'leaky faucet',
      category: 'plumbing',
    });
    created.maintenanceIds.add(maintenanceId);

    // 8. Building element scoped to the residence. Requires a uniformat
    //    code FK target — reuse one if present, else seed one.
    const existingCode = await db
      .select({ code: schema.uniformatCodes.code })
      .from(schema.uniformatCodes)
      .limit(1);
    if (existingCode.length > 0) {
      created.uniformatCode = existingCode[0].code;
    } else {
      const code = `T266`;
      await db.insert(schema.uniformatCodes).values({
        code,
        level: 1,
        nameFr: 'Test cascade',
        nameEn: 'Test cascade',
      });
      created.uniformatCode = code;
      created.uniformatCodeCreatedByUs = true;
    }
    const buildingElementId = crypto.randomUUID();
    await db.insert(schema.buildingElements).values({
      id: buildingElementId,
      buildingId,
      residenceId,
      uniformatCode: created.uniformatCode,
      name: `${TEST_TAG}-element`,
    });
    created.buildingElementIds.add(buildingElementId);

    // 9. Two demands:
    //    - primary: lives on the deleted residence (`residenceId`) and
    //      also targets it as its `assignationResidenceId`. Should be
    //      hard-deleted by the cascade.
    //    - sibling: lives on the OTHER residence but targets the
    //      deleted one as its `assignationResidenceId`. Should
    //      survive with `assignationResidenceId` cleared to NULL.
    const primaryDemandId = crypto.randomUUID();
    const siblingDemandId = crypto.randomUUID();
    await db.insert(schema.demands).values([
      {
        id: primaryDemandId,
        submitterId: userId,
        type: 'maintenance',
        residenceId,
        assignationResidenceId: residenceId,
        buildingId,
        description: `${TEST_TAG}-primary-demand`,
        status: 'draft',
      },
      {
        id: siblingDemandId,
        submitterId: userId,
        type: 'maintenance',
        residenceId: siblingResidenceId,
        assignationResidenceId: residenceId,
        buildingId,
        description: `${TEST_TAG}-sibling-demand`,
        status: 'draft',
      },
    ]);
    created.demandIds.add(primaryDemandId);
    created.demandIds.add(siblingDemandId);

    // 10. User-residence link.
    const userResidenceId = crypto.randomUUID();
    await db.insert(schema.userResidences).values({
      id: userResidenceId,
      userId,
      residenceId,
      relationshipType: 'tenant',
      startDate: '2024-01-01',
      isActive: true,
    });
    created.userResidenceIds.add(userResidenceId);

    // ---- Invoke the real MCP `delete_residence` handler ----
    const server = createMcpServer();
    const handler = getToolHandler(server, 'delete_residence');
    const result = await handler({ role: 'admin', residenceId }, {});
    const parsed = parseToolJson(result);

    // Cascade summary must report exactly the rows we seeded.
    expect(parsed.deleted).toEqual({ residenceId, unitNumber: '101' });
    expect(parsed.cascaded).toEqual({
      invoices: 1,
      documents: 1,
      demands: 1, // only the primary demand; sibling is cleared, not deleted
      maintenanceRequests: 1,
      buildingElements: 1,
      userResidences: 1,
    });
    expect(parsed.demandsAssignationCleared).toBe(1);

    // Now verify the actual database state: every dependent row that
    // pointed at the deleted residence as its primary owner is gone…
    const remainingInvoices = await db
      .select({ id: schema.invoices.id })
      .from(schema.invoices)
      .where(eq(schema.invoices.id, invoiceId));
    expect(remainingInvoices).toHaveLength(0);
    created.invoiceIds.delete(invoiceId);

    const remainingDocuments = await db
      .select({ id: schema.documents.id })
      .from(schema.documents)
      .where(eq(schema.documents.id, documentId));
    expect(remainingDocuments).toHaveLength(0);
    created.documentIds.delete(documentId);

    const remainingMaintenance = await db
      .select({ id: schema.maintenanceRequests.id })
      .from(schema.maintenanceRequests)
      .where(eq(schema.maintenanceRequests.id, maintenanceId));
    expect(remainingMaintenance).toHaveLength(0);
    created.maintenanceIds.delete(maintenanceId);

    const remainingBuildingElements = await db
      .select({ id: schema.buildingElements.id })
      .from(schema.buildingElements)
      .where(eq(schema.buildingElements.id, buildingElementId));
    expect(remainingBuildingElements).toHaveLength(0);
    created.buildingElementIds.delete(buildingElementId);

    const remainingPrimaryDemand = await db
      .select({ id: schema.demands.id })
      .from(schema.demands)
      .where(eq(schema.demands.id, primaryDemandId));
    expect(remainingPrimaryDemand).toHaveLength(0);
    created.demandIds.delete(primaryDemandId);

    const remainingUserResidence = await db
      .select({ id: schema.userResidences.id })
      .from(schema.userResidences)
      .where(eq(schema.userResidences.id, userResidenceId));
    expect(remainingUserResidence).toHaveLength(0);
    created.userResidenceIds.delete(userResidenceId);

    // …the residence itself is gone…
    const remainingResidence = await db
      .select({ id: schema.residences.id })
      .from(schema.residences)
      .where(eq(schema.residences.id, residenceId));
    expect(remainingResidence).toHaveLength(0);
    created.residenceIds.delete(residenceId);

    // …and the sibling demand survives, but with its
    // `assignationResidenceId` cleared rather than deleted (the FK
    // would otherwise have been violated when the residence row
    // disappeared).
    const sibling = await db
      .select({
        id: schema.demands.id,
        residenceId: schema.demands.residenceId,
        assignationResidenceId: schema.demands.assignationResidenceId,
      })
      .from(schema.demands)
      .where(eq(schema.demands.id, siblingDemandId));
    expect(sibling).toHaveLength(1);
    expect(sibling[0].residenceId).toBe(siblingResidenceId);
    expect(sibling[0].assignationResidenceId).toBeNull();

    // Sanity: there is no demand row left in the DB that still
    // references the deleted residence in either FK column. This is
    // the regression guard: if a future change to the cascade ever
    // misses one of these branches, this assertion fails immediately.
    const danglingPrimary = await db
      .select({ id: schema.demands.id })
      .from(schema.demands)
      .where(eq(schema.demands.residenceId, residenceId));
    expect(danglingPrimary).toHaveLength(0);
    const danglingAssignation = await db
      .select({ id: schema.demands.id })
      .from(schema.demands)
      .where(eq(schema.demands.assignationResidenceId, residenceId));
    expect(danglingAssignation).toHaveLength(0);
  }, 60000);
});
