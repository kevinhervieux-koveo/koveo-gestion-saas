/**
 * @jest-environment node
 *
 * Task #273: Cover the MCP `delete_building` cascade with a real
 * end-to-end integration test against Postgres.
 *
 * Task #265 added the full FK-cascade behaviour to `delete_building`
 * and exercises it through unit tests that mock the Drizzle
 * transaction (see `server/tests/mcp-tools.test.ts`). Those tests
 * confirm the handler issues the right calls in the right order, but
 * they cannot detect FK relationships that exist in the real Postgres
 * schema yet are missing from the cascade list — for example, a new
 * child table getting added without being included in the cascade
 * block, or two delete steps getting swapped so an FK that is not
 * `ON DELETE CASCADE` blocks the building delete.
 *
 * This test seeds a building inside an MCP-scoped organization with
 * at least one row in every dependent table touched by the cascade:
 *   - residence-scoped: residences, invoices, documents, building
 *     elements, maintenance requests, demands (+ comments), and
 *     user_residences
 *   - building-scoped: bills, budgets, monthly budgets, capital
 *     investments, financial cache, invoices, documents, demands
 *     (+ comments), notification configurations (+ dispatch log),
 *     contacts, common spaces, user_buildings, building elements,
 *     auto-generated projects, maintenance projects
 *   - "cleared, not deleted" branch: a sibling demand on a *different*
 *     building whose `assignationBuildingId` points at the deleted
 *     building (must survive with the assignation cleared)
 *
 * It then invokes the production `delete_building` MCP tool handler
 * against the real database and asserts:
 *
 *   1. Every dependent row that targeted the building as its primary
 *      owner is gone after the cascade.
 *   2. The sibling demand whose `assignationBuildingId` pointed at
 *      the deleted building survives but has its
 *      `assignationBuildingId` cleared (matching the documented
 *      "demands cleared" semantics).
 *   3. The cascade summary returned by the tool reports the exact
 *      counts that match the rows we seeded.
 *   4. The building row itself is gone.
 *
 * Follows the same real-Postgres integration pattern as
 * `tests/integration/mcp-delete-residence-cascade.test.ts` (Task #266):
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
const TEST_TAG = 'task273-mcp-building-cascade';
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

describeIfDb('MCP delete_building cascade — real Postgres (Task #273)', () => {
  let db: Db;
  let schema: Schema;
  let createMcpServer: typeof import('../../server/mcp/server').createMcpServer;

  // Track every row we insert so afterAll can clean up regardless of
  // which assertion (or which prior dev seed) was already in the DB.
  const created = {
    organizationId: null as string | null,
    organizationCreatedByUs: false,
    targetBuildingId: null as string | null,
    siblingBuildingId: null as string | null,
    residenceIds: new Set<string>(),
    userIds: new Set<string>(),
    documentIds: new Set<string>(),
    invoiceIds: new Set<string>(),
    maintenanceIds: new Set<string>(),
    buildingElementIds: new Set<string>(),
    demandIds: new Set<string>(),
    demandCommentIds: new Set<string>(),
    userResidenceIds: new Set<string>(),
    userBuildingIds: new Set<string>(),
    billIds: new Set<string>(),
    budgetIds: new Set<string>(),
    monthlyBudgetIds: new Set<string>(),
    capitalInvestmentIds: new Set<string>(),
    financialCacheIds: new Set<string>(),
    notificationConfigIds: new Set<string>(),
    notificationDispatchIds: new Set<string>(),
    contactIds: new Set<string>(),
    commonSpaceIds: new Set<string>(),
    autoGeneratedProjectIds: new Set<string>(),
    maintenanceProjectIds: new Set<string>(),
    invitationIds: new Set<string>(),
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

    // Best-effort cleanup, dependent-first, so this still works if the
    // cascade test bailed before the tool ran.
    if (created.notificationDispatchIds.size) {
      await db.delete(schema.notificationDispatchLog)
        .where(inArray(schema.notificationDispatchLog.id, [...created.notificationDispatchIds]));
    }
    if (created.notificationConfigIds.size) {
      await db.delete(schema.notificationConfigurations)
        .where(inArray(schema.notificationConfigurations.id, [...created.notificationConfigIds]));
    }
    if (created.demandCommentIds.size) {
      await db.delete(schema.demandComments)
        .where(inArray(schema.demandComments.id, [...created.demandCommentIds]));
    }
    if (created.invoiceIds.size) {
      await db.delete(schema.invoices).where(inArray(schema.invoices.id, [...created.invoiceIds]));
    }
    if (created.documentIds.size) {
      await db.delete(schema.documents).where(inArray(schema.documents.id, [...created.documentIds]));
    }
    if (created.maintenanceProjectIds.size) {
      await db.delete(schema.maintenanceProjects)
        .where(inArray(schema.maintenanceProjects.id, [...created.maintenanceProjectIds]));
    }
    if (created.autoGeneratedProjectIds.size) {
      await db.delete(schema.autoGeneratedProjects)
        .where(inArray(schema.autoGeneratedProjects.id, [...created.autoGeneratedProjectIds]));
    }
    if (created.buildingElementIds.size) {
      await db.delete(schema.buildingElements)
        .where(inArray(schema.buildingElements.id, [...created.buildingElementIds]));
    }
    if (created.maintenanceIds.size) {
      await db.delete(schema.maintenanceRequests)
        .where(inArray(schema.maintenanceRequests.id, [...created.maintenanceIds]));
    }
    if (created.demandIds.size) {
      await db.delete(schema.demands).where(inArray(schema.demands.id, [...created.demandIds]));
    }
    if (created.contactIds.size) {
      await db.delete(schema.contacts).where(inArray(schema.contacts.id, [...created.contactIds]));
    }
    if (created.commonSpaceIds.size) {
      await db.delete(schema.commonSpaces).where(inArray(schema.commonSpaces.id, [...created.commonSpaceIds]));
    }
    if (created.financialCacheIds.size) {
      await db.delete(schema.financialCache)
        .where(inArray(schema.financialCache.id, [...created.financialCacheIds]));
    }
    if (created.capitalInvestmentIds.size) {
      await db.delete(schema.capitalInvestments)
        .where(inArray(schema.capitalInvestments.id, [...created.capitalInvestmentIds]));
    }
    if (created.monthlyBudgetIds.size) {
      await db.delete(schema.monthlyBudgets)
        .where(inArray(schema.monthlyBudgets.id, [...created.monthlyBudgetIds]));
    }
    if (created.budgetIds.size) {
      await db.delete(schema.budgets).where(inArray(schema.budgets.id, [...created.budgetIds]));
    }
    if (created.billIds.size) {
      await db.delete(schema.bills).where(inArray(schema.bills.id, [...created.billIds]));
    }
    if (created.userResidenceIds.size) {
      await db.delete(schema.userResidences)
        .where(inArray(schema.userResidences.id, [...created.userResidenceIds]));
    }
    if (created.invitationIds.size) {
      await db.delete(schema.invitations)
        .where(inArray(schema.invitations.id, [...created.invitationIds]));
    }
    if (created.userBuildingIds.size) {
      await db.delete(schema.userBuildings)
        .where(inArray(schema.userBuildings.id, [...created.userBuildingIds]));
    }
    if (created.residenceIds.size) {
      await db.delete(schema.residences).where(inArray(schema.residences.id, [...created.residenceIds]));
    }
    if (created.targetBuildingId) {
      await db.delete(schema.buildings).where(eq(schema.buildings.id, created.targetBuildingId));
    }
    if (created.siblingBuildingId) {
      await db.delete(schema.buildings).where(eq(schema.buildings.id, created.siblingBuildingId));
    }
    if (created.organizationId && created.organizationCreatedByUs) {
      await db.delete(schema.organizations).where(eq(schema.organizations.id, created.organizationId));
    }
    if (created.userIds.size) {
      await db.delete(schema.users).where(inArray(schema.users.id, [...created.userIds]));
    }
    if (created.uniformatCode && created.uniformatCodeCreatedByUs) {
      await db.delete(schema.uniformatCodes)
        .where(eq(schema.uniformatCodes.code, created.uniformatCode));
    }
  }, 60000);

  it('deletes the building and every dependent row, returning matching cascade counts', async () => {
    // 1. Resolve (or seed) an MCP-scoped organization. The MCP scope
    //    check (`getMcpOrgIds`) only allows buildings inside orgs
    //    named "MCP-1" or "MCP-2"; reuse the existing sandbox org if
    //    it is already in the DB and only insert one when it isn't.
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
    const organizationId = created.organizationId!;

    // 2. Two buildings inside the MCP-scoped org: the one we will
    //    delete (target) and a sibling that hosts a demand whose
    //    `assignationBuildingId` points at the target — so we can
    //    verify the "cleared, not deleted" branch.
    const targetBuildingId = crypto.randomUUID();
    const siblingBuildingId = crypto.randomUUID();
    await db.insert(schema.buildings).values([
      {
        id: targetBuildingId,
        organizationId,
        name: `${TEST_TAG} target`,
        address: '1 Cascade',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A1',
        buildingType: 'condo',
        totalUnits: 2,
        totalFloors: 1,
        isActive: true,
      },
      {
        id: siblingBuildingId,
        organizationId,
        name: `${TEST_TAG} sibling`,
        address: '2 Cascade',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A1',
        buildingType: 'condo',
        totalUnits: 1,
        totalFloors: 1,
        isActive: true,
      },
    ]);
    created.targetBuildingId = targetBuildingId;
    created.siblingBuildingId = siblingBuildingId;

    // 3. A user we attach to residence/building, use as submitter,
    //    creator, etc.
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: userId,
      username: `${TEST_TAG}-${userId.slice(0, 8)}`,
      email: `${TEST_TAG}-${userId.slice(0, 8)}@example.test`,
      password: 'x'.repeat(60),
      firstName: 'Cascade',
      lastName: 'Tester',
      role: 'manager',
      language: 'en',
    });
    created.userIds.add(userId);

    // 4. One residence inside the target building.
    const residenceId = crypto.randomUUID();
    await db.insert(schema.residences).values({
      id: residenceId,
      buildingId: targetBuildingId,
      unitNumber: '101',
      floor: 1,
      isActive: true,
    });
    created.residenceIds.add(residenceId);

    // 5. Residence-scoped document + invoice (document referenced by
    //    the invoice — exactly the FK that breaks if the cascade ever
    //    deletes documents before invoices).
    const resDocumentId = crypto.randomUUID();
    await db.insert(schema.documents).values({
      id: resDocumentId,
      name: `${TEST_TAG}-res-doc`,
      documentType: 'invoice',
      filePath: `/objects/${TEST_TAG}/res/${resDocumentId}.pdf`,
      residenceId,
    });
    created.documentIds.add(resDocumentId);
    const resInvoiceId = crypto.randomUUID();
    await db.insert(schema.invoices).values({
      id: resInvoiceId,
      vendorName: `${TEST_TAG}-res-vendor`,
      invoiceNumber: `INV-${resInvoiceId.slice(0, 8)}`,
      totalAmount: '100.00',
      dueDate: '2030-01-01',
      paymentType: 'one-time',
      documentId: resDocumentId,
      buildingId: targetBuildingId,
      residenceId,
    });
    created.invoiceIds.add(resInvoiceId);

    // 6. Resolve (or seed) a uniformat code we can attach building
    //    elements to.
    const existingCode = await db
      .select({ code: schema.uniformatCodes.code })
      .from(schema.uniformatCodes)
      .limit(1);
    if (existingCode.length > 0) {
      created.uniformatCode = existingCode[0].code;
    } else {
      const code = `T273`;
      await db.insert(schema.uniformatCodes).values({
        code,
        level: 1,
        nameFr: 'Test cascade',
        nameEn: 'Test cascade',
      });
      created.uniformatCode = code;
      created.uniformatCodeCreatedByUs = true;
    }
    const uniformatCode = created.uniformatCode!;

    // 7. Residence-scoped building element + maintenance request +
    //    demand (with comment) + user-residence link.
    const resElementId = crypto.randomUUID();
    await db.insert(schema.buildingElements).values({
      id: resElementId,
      buildingId: targetBuildingId,
      residenceId,
      uniformatCode,
      name: `${TEST_TAG}-res-element`,
    });
    created.buildingElementIds.add(resElementId);
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
    const resDemandId = crypto.randomUUID();
    await db.insert(schema.demands).values({
      id: resDemandId,
      submitterId: userId,
      type: 'maintenance',
      residenceId,
      buildingId: targetBuildingId,
      description: `${TEST_TAG}-res-demand`,
      status: 'draft',
    });
    created.demandIds.add(resDemandId);
    const resDemandCommentId = crypto.randomUUID();
    await db.insert(schema.demandComments).values({
      id: resDemandCommentId,
      demandId: resDemandId,
      commenterId: userId,
      commentText: `${TEST_TAG}-res-comment`,
    });
    created.demandCommentIds.add(resDemandCommentId);
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

    // 8. Building-scoped invoice + document (document referenced by
    //    the invoice).
    const bldgDocumentId = crypto.randomUUID();
    await db.insert(schema.documents).values({
      id: bldgDocumentId,
      name: `${TEST_TAG}-bldg-doc`,
      documentType: 'invoice',
      filePath: `/objects/${TEST_TAG}/bldg/${bldgDocumentId}.pdf`,
      buildingId: targetBuildingId,
    });
    created.documentIds.add(bldgDocumentId);
    const bldgInvoiceId = crypto.randomUUID();
    await db.insert(schema.invoices).values({
      id: bldgInvoiceId,
      vendorName: `${TEST_TAG}-bldg-vendor`,
      invoiceNumber: `INV-${bldgInvoiceId.slice(0, 8)}`,
      totalAmount: '500.00',
      dueDate: '2030-01-01',
      paymentType: 'one-time',
      documentId: bldgDocumentId,
      buildingId: targetBuildingId,
    });
    created.invoiceIds.add(bldgInvoiceId);

    // 9. Building-scoped financial rows: bill, budget, monthly
    //    budget, capital investment, financial cache.
    const billId = crypto.randomUUID();
    await db.insert(schema.bills).values({
      id: billId,
      buildingId: targetBuildingId,
      billNumber: `BILL-${billId.slice(0, 8)}`,
      title: `${TEST_TAG}-bill`,
      category: 'insurance',
      paymentType: 'unique',
      costs: ['100.00'],
      totalAmount: '100.00',
      startDate: '2030-01-01',
      status: 'draft',
      createdBy: userId,
    });
    created.billIds.add(billId);
    const budgetId = crypto.randomUUID();
    await db.insert(schema.budgets).values({
      id: budgetId,
      buildingId: targetBuildingId,
      year: 2099,
      name: `${TEST_TAG}-budget`,
      category: 'operational',
      budgetedAmount: '1000.00',
    });
    created.budgetIds.add(budgetId);
    const monthlyBudgetId = crypto.randomUUID();
    await db.insert(schema.monthlyBudgets).values({
      id: monthlyBudgetId,
      buildingId: targetBuildingId,
      year: 2099,
      month: 1,
      incomeTypes: ['fees'],
      incomes: ['100.00'],
      spendingTypes: ['maintenance'],
      spendings: ['50.00'],
    });
    created.monthlyBudgetIds.add(monthlyBudgetId);
    const capitalInvestmentId = crypto.randomUUID();
    await db.insert(schema.capitalInvestments).values({
      id: capitalInvestmentId,
      buildingId: targetBuildingId,
      title: `${TEST_TAG}-investment`,
      amount: '5000.00',
      targetDate: '2030-06-01',
      urgency: 'not_urgent',
      type: 'custom',
      ownershipType: 'residences',
    });
    created.capitalInvestmentIds.add(capitalInvestmentId);
    const financialCacheId = crypto.randomUUID();
    await db.insert(schema.financialCache).values({
      id: financialCacheId,
      buildingId: targetBuildingId,
      cacheKey: `${TEST_TAG}-cache`,
      cacheData: { test: true },
      startDate: '2030-01-01',
      endDate: '2030-12-31',
      expiresAt: new Date('2099-01-01'),
    });
    created.financialCacheIds.add(financialCacheId);

    // 10. Building-scoped demand (with comment).
    const bldgDemandId = crypto.randomUUID();
    await db.insert(schema.demands).values({
      id: bldgDemandId,
      submitterId: userId,
      type: 'maintenance',
      buildingId: targetBuildingId,
      assignationBuildingId: targetBuildingId,
      description: `${TEST_TAG}-bldg-demand`,
      status: 'draft',
    });
    created.demandIds.add(bldgDemandId);
    const bldgDemandCommentId = crypto.randomUUID();
    await db.insert(schema.demandComments).values({
      id: bldgDemandCommentId,
      demandId: bldgDemandId,
      commenterId: userId,
      commentText: `${TEST_TAG}-bldg-comment`,
    });
    created.demandCommentIds.add(bldgDemandCommentId);

    // 11. Sibling-building demand whose `assignationBuildingId`
    //     points at the deleted building. Should survive with the
    //     assignation cleared rather than deleted.
    const siblingDemandId = crypto.randomUUID();
    await db.insert(schema.demands).values({
      id: siblingDemandId,
      submitterId: userId,
      type: 'maintenance',
      buildingId: siblingBuildingId,
      assignationBuildingId: targetBuildingId,
      description: `${TEST_TAG}-sibling-demand`,
      status: 'draft',
    });
    created.demandIds.add(siblingDemandId);

    // 12. Notification configuration + dispatch log.
    const notifConfigId = crypto.randomUUID();
    await db.insert(schema.notificationConfigurations).values({
      id: notifConfigId,
      organizationId,
      buildingId: targetBuildingId,
      createdBy: userId,
      type: 'maintenance_update',
      title: `${TEST_TAG}-notif`,
      message: 'test',
      frequency: 'monthly',
      startDate: new Date('2030-01-01'),
    });
    created.notificationConfigIds.add(notifConfigId);
    const dispatchId = crypto.randomUUID();
    await db.insert(schema.notificationDispatchLog).values({
      id: dispatchId,
      configurationId: notifConfigId,
      userId,
      periodKey: '2030-01',
    });
    created.notificationDispatchIds.add(dispatchId);

    // 13. Contact attached to the building.
    const contactId = crypto.randomUUID();
    await db.insert(schema.contacts).values({
      id: contactId,
      name: `${TEST_TAG}-contact`,
      entity: 'building',
      entityId: targetBuildingId,
      contactCategory: 'manager',
    });
    created.contactIds.add(contactId);

    // 14. Common space.
    const commonSpaceId = crypto.randomUUID();
    await db.insert(schema.commonSpaces).values({
      id: commonSpaceId,
      name: `${TEST_TAG}-space`,
      buildingId: targetBuildingId,
    });
    created.commonSpaceIds.add(commonSpaceId);

    // 15. user_buildings link.
    const userBuildingId = crypto.randomUUID();
    await db.insert(schema.userBuildings).values({
      id: userBuildingId,
      userId,
      buildingId: targetBuildingId,
      relationshipType: 'manager',
      isActive: true,
    });
    created.userBuildingIds.add(userBuildingId);

    // 16. Building-scoped (no residence) building element. The
    //     auto-generated project below is FK'd to it.
    const bldgElementId = crypto.randomUUID();
    await db.insert(schema.buildingElements).values({
      id: bldgElementId,
      buildingId: targetBuildingId,
      uniformatCode,
      name: `${TEST_TAG}-bldg-element`,
    });
    created.buildingElementIds.add(bldgElementId);

    // 17. Auto-generated project (FK to building element).
    const autoProjectId = crypto.randomUUID();
    await db.insert(schema.autoGeneratedProjects).values({
      id: autoProjectId,
      buildingId: targetBuildingId,
      elementId: bldgElementId,
      title: `${TEST_TAG}-auto`,
      description: 'auto',
      suggestedType: 'replacement',
    });
    created.autoGeneratedProjectIds.add(autoProjectId);

    // 18. Maintenance project.
    const maintProjectId = crypto.randomUUID();
    await db.insert(schema.maintenanceProjects).values({
      id: maintProjectId,
      buildingId: targetBuildingId,
      projectNumber: `MP-${maintProjectId.slice(0, 8)}`,
      title: `${TEST_TAG}-mp`,
      createdBy: userId,
    });
    created.maintenanceProjectIds.add(maintProjectId);

    // Invitations attached to the building or one of its residences
    // (task #383). We seed five rows to exercise every branch of the
    // cascade:
    //   - pending invitation directly on the deleted building -> cancelled (buildingId nulled)
    //   - pending invitation on the residence inside the building -> cancelled (residenceId nulled)
    //   - DUAL-linked pending invitation (both residenceId AND buildingId
    //     point at the deleted building) -> cancelled, BOTH FK columns
    //     nulled in the same residence-scoped sweep so the second
    //     building-scoped sweep doesn't have to revisit it. Regression
    //     guard for the edge case raised in code review on task #383.
    //   - accepted invitation on the building -> left alone (terminal)
    //   - cancelled invitation on the residence -> left alone (terminal)
    //   - pending invitation on the SIBLING building -> left alone (out of scope)
    const invBldgPendingId = crypto.randomUUID();
    const invResPendingId = crypto.randomUUID();
    const invDualPendingId = crypto.randomUUID();
    const invBldgAcceptedId = crypto.randomUUID();
    const invResCancelledId = crypto.randomUUID();
    const invSiblingPendingId = crypto.randomUUID();
    const futureExp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.insert(schema.invitations).values([
      {
        id: invBldgPendingId,
        organizationId,
        buildingId: targetBuildingId,
        email: `${TEST_TAG}-bldg-pending@example.test`,
        token: `tok-bldg-pending-${invBldgPendingId}`,
        tokenHash: `hash-bldg-pending-${invBldgPendingId}`,
        role: 'manager',
        status: 'pending',
        invitedByUserId: userId,
        expiresAt: futureExp,
      },
      {
        id: invResPendingId,
        organizationId,
        residenceId,
        email: `${TEST_TAG}-res-pending@example.test`,
        token: `tok-res-pending-${invResPendingId}`,
        tokenHash: `hash-res-pending-${invResPendingId}`,
        role: 'tenant',
        status: 'pending',
        invitedByUserId: userId,
        expiresAt: futureExp,
      },
      {
        id: invDualPendingId,
        organizationId,
        buildingId: targetBuildingId,
        residenceId,
        email: `${TEST_TAG}-dual-pending@example.test`,
        token: `tok-dual-pending-${invDualPendingId}`,
        tokenHash: `hash-dual-pending-${invDualPendingId}`,
        role: 'tenant',
        status: 'pending',
        invitedByUserId: userId,
        expiresAt: futureExp,
      },
      {
        id: invBldgAcceptedId,
        organizationId,
        buildingId: targetBuildingId,
        email: `${TEST_TAG}-bldg-accepted@example.test`,
        token: `tok-bldg-accepted-${invBldgAcceptedId}`,
        tokenHash: `hash-bldg-accepted-${invBldgAcceptedId}`,
        role: 'manager',
        status: 'accepted',
        invitedByUserId: userId,
        expiresAt: futureExp,
      },
      {
        id: invResCancelledId,
        organizationId,
        residenceId,
        email: `${TEST_TAG}-res-cancelled@example.test`,
        token: `tok-res-cancelled-${invResCancelledId}`,
        tokenHash: `hash-res-cancelled-${invResCancelledId}`,
        role: 'tenant',
        status: 'cancelled',
        invitedByUserId: userId,
        expiresAt: futureExp,
      },
      {
        id: invSiblingPendingId,
        organizationId,
        buildingId: siblingBuildingId,
        email: `${TEST_TAG}-sibling-pending@example.test`,
        token: `tok-sibling-pending-${invSiblingPendingId}`,
        tokenHash: `hash-sibling-pending-${invSiblingPendingId}`,
        role: 'manager',
        status: 'pending',
        invitedByUserId: userId,
        expiresAt: futureExp,
      },
    ]);
    created.invitationIds.add(invBldgPendingId);
    created.invitationIds.add(invResPendingId);
    created.invitationIds.add(invDualPendingId);
    created.invitationIds.add(invBldgAcceptedId);
    created.invitationIds.add(invResCancelledId);
    created.invitationIds.add(invSiblingPendingId);

    // ---- Invoke the real MCP `delete_building` handler ----
    const server = createMcpServer();
    const handler = getToolHandler(server, 'delete_building');
    const result = await handler({ role: 'admin', buildingId: targetBuildingId }, {});
    const parsed = parseToolJson(result);

    // Cascade summary must report exactly the rows we seeded.
    expect(parsed.deleted).toEqual({ id: targetBuildingId, name: `${TEST_TAG} target` });
    expect(parsed.cascaded).toEqual({
      residences: 1,
      invoices: 2, // 1 residence-scoped + 1 building-scoped
      documents: 2, // 1 residence-scoped + 1 building-scoped
      bills: 1,
      budgets: 1,
      monthlyBudgets: 1,
      capitalInvestments: 1,
      financialCache: 1,
      demands: 2, // 1 residence-scoped + 1 building-scoped (sibling cleared, not counted)
      demandComments: 2, // 1 per demand
      maintenanceRequests: 1,
      buildingElements: 2, // 1 residence-scoped + 1 building-scoped
      autoGeneratedProjects: 1,
      maintenanceProjects: 1,
      notificationConfigurations: 1,
      notificationDispatchLog: 1,
      contacts: 1,
      commonSpaces: 1,
      userBuildings: 1,
      userResidences: 1,
      invitations: 3, // 1 building-only pending + 1 residence-only pending + 1 dual-linked pending; terminal rows untouched
    });
    expect(parsed.demandsAssignationCleared).toBe(1);

    // Verify actual DB state: every dependent row that pointed at the
    // deleted building as its primary owner is gone…
    const remainingBuilding = await db
      .select({ id: schema.buildings.id })
      .from(schema.buildings)
      .where(eq(schema.buildings.id, targetBuildingId));
    expect(remainingBuilding).toHaveLength(0);
    created.targetBuildingId = null;

    // Targeted per-table verifications.
    const checks: Array<[string, Promise<unknown[]>, Set<string>?]> = [
      ['residences', db.select({ id: schema.residences.id }).from(schema.residences)
        .where(eq(schema.residences.buildingId, targetBuildingId))],
      ['bills', db.select({ id: schema.bills.id }).from(schema.bills)
        .where(eq(schema.bills.buildingId, targetBuildingId)), created.billIds],
      ['budgets', db.select({ id: schema.budgets.id }).from(schema.budgets)
        .where(eq(schema.budgets.buildingId, targetBuildingId)), created.budgetIds],
      ['monthlyBudgets', db.select({ id: schema.monthlyBudgets.id }).from(schema.monthlyBudgets)
        .where(eq(schema.monthlyBudgets.buildingId, targetBuildingId)), created.monthlyBudgetIds],
      ['capitalInvestments', db.select({ id: schema.capitalInvestments.id }).from(schema.capitalInvestments)
        .where(eq(schema.capitalInvestments.buildingId, targetBuildingId)), created.capitalInvestmentIds],
      ['financialCache', db.select({ id: schema.financialCache.id }).from(schema.financialCache)
        .where(eq(schema.financialCache.buildingId, targetBuildingId)), created.financialCacheIds],
      ['invoices (building)', db.select({ id: schema.invoices.id }).from(schema.invoices)
        .where(eq(schema.invoices.buildingId, targetBuildingId))],
      ['documents (building)', db.select({ id: schema.documents.id }).from(schema.documents)
        .where(eq(schema.documents.buildingId, targetBuildingId))],
      ['notificationConfigurations', db.select({ id: schema.notificationConfigurations.id })
        .from(schema.notificationConfigurations)
        .where(eq(schema.notificationConfigurations.buildingId, targetBuildingId)), created.notificationConfigIds],
      ['contacts', db.select({ id: schema.contacts.id }).from(schema.contacts)
        .where(eq(schema.contacts.entityId, targetBuildingId)), created.contactIds],
      ['commonSpaces', db.select({ id: schema.commonSpaces.id }).from(schema.commonSpaces)
        .where(eq(schema.commonSpaces.buildingId, targetBuildingId)), created.commonSpaceIds],
      ['userBuildings', db.select({ id: schema.userBuildings.id }).from(schema.userBuildings)
        .where(eq(schema.userBuildings.buildingId, targetBuildingId)), created.userBuildingIds],
      ['buildingElements', db.select({ id: schema.buildingElements.id }).from(schema.buildingElements)
        .where(eq(schema.buildingElements.buildingId, targetBuildingId))],
      ['autoGeneratedProjects', db.select({ id: schema.autoGeneratedProjects.id })
        .from(schema.autoGeneratedProjects)
        .where(eq(schema.autoGeneratedProjects.buildingId, targetBuildingId)), created.autoGeneratedProjectIds],
      ['maintenanceProjects', db.select({ id: schema.maintenanceProjects.id })
        .from(schema.maintenanceProjects)
        .where(eq(schema.maintenanceProjects.buildingId, targetBuildingId)), created.maintenanceProjectIds],
      ['demands (building primary)', db.select({ id: schema.demands.id }).from(schema.demands)
        .where(eq(schema.demands.buildingId, targetBuildingId))],
    ];
    for (const [label, q, idSet] of checks) {
      const rows = (await q) as Array<{ id: string }>;
      expect({ table: label, rows }).toEqual({ table: label, rows: [] });
      idSet?.clear();
    }

    // Demand comments pointing at deleted demands are gone.
    const remainingComments = await db
      .select({ id: schema.demandComments.id })
      .from(schema.demandComments)
      .where(inArray(schema.demandComments.id, [...created.demandCommentIds]));
    expect(remainingComments).toHaveLength(0);
    created.demandCommentIds.clear();

    // Notification dispatch log rows are gone (would otherwise FK-block).
    const remainingDispatch = await db
      .select({ id: schema.notificationDispatchLog.id })
      .from(schema.notificationDispatchLog)
      .where(inArray(schema.notificationDispatchLog.id, [...created.notificationDispatchIds]));
    expect(remainingDispatch).toHaveLength(0);
    created.notificationDispatchIds.clear();

    // Maintenance requests for the residences in the deleted building are gone.
    const remainingMaintenance = await db
      .select({ id: schema.maintenanceRequests.id })
      .from(schema.maintenanceRequests)
      .where(inArray(schema.maintenanceRequests.id, [...created.maintenanceIds]));
    expect(remainingMaintenance).toHaveLength(0);
    created.maintenanceIds.clear();

    // user_residences for the deleted residence are gone.
    const remainingUserResidences = await db
      .select({ id: schema.userResidences.id })
      .from(schema.userResidences)
      .where(inArray(schema.userResidences.id, [...created.userResidenceIds]));
    expect(remainingUserResidences).toHaveLength(0);
    created.userResidenceIds.clear();

    // Tracked invoice/document/element IDs are gone (covers both
    // residence-scoped and building-scoped rows).
    const remainingInvoices = await db
      .select({ id: schema.invoices.id })
      .from(schema.invoices)
      .where(inArray(schema.invoices.id, [...created.invoiceIds]));
    expect(remainingInvoices).toHaveLength(0);
    created.invoiceIds.clear();
    const remainingDocuments = await db
      .select({ id: schema.documents.id })
      .from(schema.documents)
      .where(inArray(schema.documents.id, [...created.documentIds]));
    expect(remainingDocuments).toHaveLength(0);
    created.documentIds.clear();
    const remainingElements = await db
      .select({ id: schema.buildingElements.id })
      .from(schema.buildingElements)
      .where(inArray(schema.buildingElements.id, [...created.buildingElementIds]));
    expect(remainingElements).toHaveLength(0);
    created.buildingElementIds.clear();

    // Residence row gone.
    const remainingResidences = await db
      .select({ id: schema.residences.id })
      .from(schema.residences)
      .where(inArray(schema.residences.id, [...created.residenceIds]));
    expect(remainingResidences).toHaveLength(0);
    created.residenceIds.clear();

    // The building-scoped + residence-scoped demands are gone…
    const remainingPrimaryDemands = await db
      .select({ id: schema.demands.id })
      .from(schema.demands)
      .where(inArray(schema.demands.id, [resDemandId, bldgDemandId]));
    expect(remainingPrimaryDemands).toHaveLength(0);

    // …and the sibling demand survives, but with its
    // `assignationBuildingId` cleared rather than deleted (the FK
    // would otherwise have been violated when the building row
    // disappeared).
    const sibling = await db
      .select({
        id: schema.demands.id,
        buildingId: schema.demands.buildingId,
        assignationBuildingId: schema.demands.assignationBuildingId,
      })
      .from(schema.demands)
      .where(eq(schema.demands.id, siblingDemandId));
    expect(sibling).toHaveLength(1);
    expect(sibling[0].buildingId).toBe(siblingBuildingId);
    expect(sibling[0].assignationBuildingId).toBeNull();
    // Drop sibling from cleanup tracking — afterAll will still nuke it
    // alongside its building, but the assertion above is what matters.
    created.demandIds.clear();
    created.demandIds.add(siblingDemandId);

    // Sanity: there is no demand row left in the DB that still
    // references the deleted building in either FK column. This is
    // the regression guard: if a future change to the cascade ever
    // misses one of these branches, this assertion fails immediately.
    const danglingPrimary = await db
      .select({ id: schema.demands.id })
      .from(schema.demands)
      .where(eq(schema.demands.buildingId, targetBuildingId));
    expect(danglingPrimary).toHaveLength(0);
    const danglingAssignation = await db
      .select({ id: schema.demands.id })
      .from(schema.demands)
      .where(eq(schema.demands.assignationBuildingId, targetBuildingId));
    expect(danglingAssignation).toHaveLength(0);

    // Invitation cascade (task #383):
    //   - the pending building-scoped invitation was soft-cancelled
    //     and its buildingId nulled
    //   - the pending residence-scoped invitation was soft-cancelled
    //     and its residenceId nulled
    //   - the accepted building-scoped invitation is left alone
    //   - the cancelled residence-scoped invitation is left alone
    //   - the sibling building's pending invitation is unaffected
    const bldgPendingAfter = await db
      .select({
        id: schema.invitations.id,
        status: schema.invitations.status,
        buildingId: schema.invitations.buildingId,
      })
      .from(schema.invitations)
      .where(eq(schema.invitations.id, invBldgPendingId));
    expect(bldgPendingAfter).toHaveLength(1);
    expect(bldgPendingAfter[0].status).toBe('cancelled');
    expect(bldgPendingAfter[0].buildingId).toBeNull();

    const resPendingAfter = await db
      .select({
        id: schema.invitations.id,
        status: schema.invitations.status,
        residenceId: schema.invitations.residenceId,
      })
      .from(schema.invitations)
      .where(eq(schema.invitations.id, invResPendingId));
    expect(resPendingAfter).toHaveLength(1);
    expect(resPendingAfter[0].status).toBe('cancelled');
    expect(resPendingAfter[0].residenceId).toBeNull();

    // Dual-linked pending invitation: BOTH FK columns must be nulled
    // (regression guard for the code-review edge case on task #383).
    const dualPendingAfter = await db
      .select({
        id: schema.invitations.id,
        status: schema.invitations.status,
        residenceId: schema.invitations.residenceId,
        buildingId: schema.invitations.buildingId,
      })
      .from(schema.invitations)
      .where(eq(schema.invitations.id, invDualPendingId));
    expect(dualPendingAfter).toHaveLength(1);
    expect(dualPendingAfter[0].status).toBe('cancelled');
    expect(dualPendingAfter[0].residenceId).toBeNull();
    expect(dualPendingAfter[0].buildingId).toBeNull();

    const bldgAcceptedAfter = await db
      .select({
        id: schema.invitations.id,
        status: schema.invitations.status,
        buildingId: schema.invitations.buildingId,
      })
      .from(schema.invitations)
      .where(eq(schema.invitations.id, invBldgAcceptedId));
    expect(bldgAcceptedAfter).toHaveLength(1);
    expect(bldgAcceptedAfter[0].status).toBe('accepted');
    expect(bldgAcceptedAfter[0].buildingId).toBe(targetBuildingId);

    const resCancelledAfter = await db
      .select({
        id: schema.invitations.id,
        status: schema.invitations.status,
        residenceId: schema.invitations.residenceId,
      })
      .from(schema.invitations)
      .where(eq(schema.invitations.id, invResCancelledId));
    expect(resCancelledAfter).toHaveLength(1);
    expect(resCancelledAfter[0].status).toBe('cancelled');
    expect(resCancelledAfter[0].residenceId).toBe(residenceId);

    const siblingPendingAfter = await db
      .select({
        id: schema.invitations.id,
        status: schema.invitations.status,
        buildingId: schema.invitations.buildingId,
      })
      .from(schema.invitations)
      .where(eq(schema.invitations.id, invSiblingPendingId));
    expect(siblingPendingAfter).toHaveLength(1);
    expect(siblingPendingAfter[0].status).toBe('pending');
    expect(siblingPendingAfter[0].buildingId).toBe(siblingBuildingId);
  }, 120000);
});
