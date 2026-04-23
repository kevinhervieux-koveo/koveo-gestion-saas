/**
 * @jest-environment node
 *
 * Task #403 — MCP integration coverage for the document-linking
 * tools registered in `server/mcp/server.ts`:
 *
 *   - list_document_links        (read)
 *   - get_document_neighbors     (read)
 *   - suggest_document_links     (read)
 *   - create_document_link       (write — admin/manager only)
 *   - delete_document_link       (write — admin/manager only)
 *
 * Goal of this suite (per the task spec): "MCP tool tests confirm
 * tenants are blocked from create/delete". We additionally lock down
 * the read-side MCP-scope behavior (a doc outside the MCP-scoped orgs
 * must be reported as access-denied) so a future refactor of the scope
 * predicate cannot quietly start leaking documents into AI-assistant
 * context.
 *
 * Mirrors the harness in tests/integration/mcp/common-spaces-tools.test.ts
 * and is gated on `_INTEGRATION_DB_URL`.
 */

// Stub the heavy modules that server/mcp/server.ts imports at the top
// — the document-link tools never use them, but loading the real
// modules pulls in ESM-only `uuid` which the Jest CJS transformer
// cannot parse without extra config. Same trick the common-spaces MCP
// suite uses.
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
const TEST_TAG = 'task403-mcp-doc-links';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

interface ToolResult {
  content?: Array<{ type?: string; text?: string }>;
}

function getToolHandler(
  server: unknown,
  toolName: string,
): (args: Record<string, unknown>, extra?: unknown) => Promise<ToolResult> {
  const tools = (server as { _registeredTools?: Record<string, { handler?: unknown; callback?: unknown }> })
    ._registeredTools;
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

describeIfDb('MCP document-link tools — Task #403', () => {
  let db: Db;
  let schema: Schema;
  let createMcpServer: typeof import('../../../server/mcp/server').createMcpServer;

  // Reuse the same MCP-scoped org name (`MCP-1`) the common-spaces
  // suite relies on so the MCP scope helpers (getMcpAccessibleBuildingIds)
  // resolve into our test buildings.
  const created = {
    organizationId: null as string | null,
    organizationCreatedByUs: false,
    outsideOrgId: null as string | null,
    documentLinks: new Set<string>(),
    documents: new Set<string>(),
    userResidences: new Set<string>(),
    userOrgs: new Set<string>(),
    residences: new Set<string>(),
    buildings: new Set<string>(),
    users: new Set<string>(),
  };

  let mcpOrgId: string;
  let outsideOrgId: string;
  let buildingInScopeId: string;
  let buildingOutsideId: string;
  let residenceInScopeId: string;
  let tenantUserId: string;
  let managerUserId: string;
  let docInScopeA: string;
  let docInScopeB: string;
  let docOutsideId: string;

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

    // 2. A second org that is NOT inside the MCP scope, used to host
    //    a document we expect every MCP tool to refuse to address.
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

    // 4. Residence inside the in-scope building (only one — both
    //    in-scope docs share it so they're linkable to each other).
    residenceInScopeId = crypto.randomUUID();
    await db.insert(schema.residences).values({
      id: residenceInScopeId,
      buildingId: buildingInScopeId,
      unitNumber: '101',
      floor: 1,
      isActive: true,
    });
    created.residences.add(residenceInScopeId);

    // 5. Users: a tenant linked to the residence, and a manager
    //    linked to MCP-1.
    const mkUser = async (role: 'tenant' | 'manager', suffix: string) => {
      const id = crypto.randomUUID();
      await db.insert(schema.users).values({
        id,
        username: `${TEST_TAG}-${suffix}-${id.slice(0, 8)}`,
        email: `${TEST_TAG}-${suffix}-${id.slice(0, 8)}@example.test`,
        password: 'x'.repeat(60),
        firstName: 'DL',
        lastName: suffix,
        role,
        language: 'en',
      });
      created.users.add(id);
      return id;
    };
    tenantUserId = await mkUser('tenant', 'tenant');
    managerUserId = await mkUser('manager', 'mgr');

    const userResId = crypto.randomUUID();
    await db.insert(schema.userResidences).values({
      id: userResId,
      userId: tenantUserId,
      residenceId: residenceInScopeId,
      relationshipType: 'tenant',
      startDate: '2024-01-01',
      isActive: true,
    });
    created.userResidences.add(userResId);

    const userOrgId = crypto.randomUUID();
    await db.insert(schema.userOrganizations).values({
      id: userOrgId,
      userId: managerUserId,
      organizationId: mcpOrgId,
      organizationRole: 'manager',
      isActive: true,
    });
    created.userOrgs.add(userOrgId);

    // 6. Documents: two in-scope (same building+residence → linkable),
    //    one outside the MCP scope.
    docInScopeA = crypto.randomUUID();
    docInScopeB = crypto.randomUUID();
    docOutsideId = crypto.randomUUID();
    await db.insert(schema.documents).values([
      {
        id: docInScopeA,
        name: `${TEST_TAG} docA`,
        documentType: 'legal',
        filePath: `/objects/uploads/${TEST_TAG}/${docInScopeA}.pdf`,
        fileName: `${docInScopeA}.pdf`,
        mimeType: 'application/pdf',
        fileSize: 100,
        buildingId: buildingInScopeId,
        residenceId: residenceInScopeId,
        uploadedById: managerUserId,
        isVisibleToTenants: true,
        isManagerOnly: false,
        effectiveDate: new Date('2025-01-01T00:00:00Z'),
      },
      {
        id: docInScopeB,
        name: `${TEST_TAG} docB`,
        documentType: 'legal',
        filePath: `/objects/uploads/${TEST_TAG}/${docInScopeB}.pdf`,
        fileName: `${docInScopeB}.pdf`,
        mimeType: 'application/pdf',
        fileSize: 100,
        buildingId: buildingInScopeId,
        residenceId: residenceInScopeId,
        uploadedById: managerUserId,
        isVisibleToTenants: true,
        isManagerOnly: false,
        effectiveDate: new Date('2025-02-01T00:00:00Z'),
      },
      {
        id: docOutsideId,
        name: `${TEST_TAG} docOutside`,
        documentType: 'legal',
        filePath: `/objects/uploads/${TEST_TAG}/${docOutsideId}.pdf`,
        fileName: `${docOutsideId}.pdf`,
        mimeType: 'application/pdf',
        fileSize: 100,
        buildingId: buildingOutsideId,
        residenceId: null,
        uploadedById: managerUserId,
        isVisibleToTenants: true,
        isManagerOnly: false,
        effectiveDate: new Date('2025-03-01T00:00:00Z'),
      },
    ]);
    created.documents.add(docInScopeA);
    created.documents.add(docInScopeB);
    created.documents.add(docOutsideId);
  }, 60000);

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;
    if (created.documentLinks.size) {
      await db
        .delete(schema.documentLinks)
        .where(inArray(schema.documentLinks.id, [...created.documentLinks]));
    }
    if (created.documents.size) {
      await db.delete(schema.documents).where(inArray(schema.documents.id, [...created.documents]));
    }
    if (created.userResidences.size) {
      await db
        .delete(schema.userResidences)
        .where(inArray(schema.userResidences.id, [...created.userResidences]));
    }
    if (created.userOrgs.size) {
      await db
        .delete(schema.userOrganizations)
        .where(inArray(schema.userOrganizations.id, [...created.userOrgs]));
    }
    if (created.residences.size) {
      await db.delete(schema.residences).where(inArray(schema.residences.id, [...created.residences]));
    }
    if (created.buildings.size) {
      await db.delete(schema.buildings).where(inArray(schema.buildings.id, [...created.buildings]));
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
  // Tenants are blocked from create/delete (the headline assertion
  // for this task).
  // -----------------------------------------------------------------
  it('create_document_link denies a tenant role with an "Access denied" message', async () => {
    const handler = getToolHandler(serverFor('tenant', tenantUserId), 'create_document_link');
    const result = await handler({
      role: 'tenant',
      fromDocumentId: docInScopeA,
      toDocumentId: docInScopeB,
      position: 'after',
    });
    expect(textOf(result)).toMatch(/Access denied/i);

    // And the database must not have been mutated.
    const rows = await db
      .select({ id: schema.documentLinks.id })
      .from(schema.documentLinks)
      .where(eq(schema.documentLinks.fromDocumentId, docInScopeA));
    expect(rows.length).toBe(0);
  }, 30000);

  it('delete_document_link denies a tenant role with an "Access denied" message', async () => {
    // Pre-seed a real link from the manager so we can prove the tenant
    // call did not delete it.
    const createHandler = getToolHandler(serverFor('manager', managerUserId), 'create_document_link');
    const createRes = await createHandler({
      role: 'manager',
      fromDocumentId: docInScopeA,
      toDocumentId: docInScopeB,
      position: 'after',
    });
    const created_link = parseJson<{ id: string }>(createRes);
    expect(created_link.id).toBeTruthy();
    created.documentLinks.add(created_link.id);

    const tenantDelete = getToolHandler(serverFor('tenant', tenantUserId), 'delete_document_link');
    const result = await tenantDelete({
      role: 'tenant',
      fromDocumentId: docInScopeA,
      position: 'after',
    });
    expect(textOf(result)).toMatch(/Access denied/i);

    const rows = await db
      .select({ id: schema.documentLinks.id })
      .from(schema.documentLinks)
      .where(eq(schema.documentLinks.id, created_link.id));
    expect(rows.length).toBe(1);

    // Cleanup: let the manager remove the link so afterAll cleanup is
    // unaffected by sequencing.
    const mgrDelete = getToolHandler(serverFor('manager', managerUserId), 'delete_document_link');
    await mgrDelete({ role: 'manager', fromDocumentId: docInScopeA, position: 'after' });
    created.documentLinks.delete(created_link.id);
  }, 30000);

  // -----------------------------------------------------------------
  // MCP scope: a doc that lives outside any of the MCP-scoped orgs is
  // never addressable by ANY of the document-link tools.
  // -----------------------------------------------------------------
  it('every document-link tool returns "Document not found or access denied" for an out-of-scope document (admin role)', async () => {
    const adminSrv = serverFor('admin', managerUserId);

    for (const tool of ['list_document_links', 'get_document_neighbors', 'suggest_document_links']) {
      const handler = getToolHandler(adminSrv, tool);
      const res = await handler({ role: 'admin', documentId: docOutsideId });
      expect(textOf(res)).toMatch(/not found or access denied/i);
    }

    const create = getToolHandler(adminSrv, 'create_document_link');
    const createRes = await create({
      role: 'admin',
      fromDocumentId: docOutsideId,
      toDocumentId: docInScopeA,
      position: 'after',
    });
    expect(textOf(createRes)).toMatch(/not found or access denied/i);

    // Even when the SOURCE is in-scope, an out-of-scope TARGET must
    // be refused.
    const createRes2 = await create({
      role: 'admin',
      fromDocumentId: docInScopeA,
      toDocumentId: docOutsideId,
      position: 'after',
    });
    expect(textOf(createRes2)).toMatch(/Target document not found/i);

    const del = getToolHandler(adminSrv, 'delete_document_link');
    const delRes = await del({
      role: 'admin',
      fromDocumentId: docOutsideId,
      position: 'after',
    });
    expect(textOf(delRes)).toMatch(/not found or access denied/i);
  }, 30000);

  // -----------------------------------------------------------------
  // Manager happy-path round-trip — confirms the same tools that
  // refuse tenants happily serve admin/manager roles.
  // -----------------------------------------------------------------
  it('manager can create, list, resolve neighbors for, and delete an explicit link', async () => {
    const mgrSrv = serverFor('manager', managerUserId);

    const create = getToolHandler(mgrSrv, 'create_document_link');
    const createRes = await create({
      role: 'manager',
      fromDocumentId: docInScopeA,
      toDocumentId: docInScopeB,
      position: 'after',
    });
    const link = parseJson<{ id: string; toDocumentId: string }>(createRes);
    expect(link.toDocumentId).toBe(docInScopeB);
    created.documentLinks.add(link.id);

    const list = getToolHandler(mgrSrv, 'list_document_links');
    const listRes = await list({ role: 'manager', documentId: docInScopeA });
    const links = parseJson<Array<{ toDocumentId: string }>>(listRes);
    expect(links.some((l) => l.toDocumentId === docInScopeB)).toBe(true);

    const neighbors = getToolHandler(mgrSrv, 'get_document_neighbors');
    const neighborsRes = await neighbors({ role: 'manager', documentId: docInScopeA });
    const neighborJson = parseJson<{ next: { id: string; source: string } | null }>(neighborsRes);
    expect(neighborJson.next?.id).toBe(docInScopeB);
    expect(neighborJson.next?.source).toBe('explicit');

    const del = getToolHandler(mgrSrv, 'delete_document_link');
    const delRes = await del({ role: 'manager', fromDocumentId: docInScopeA, position: 'after' });
    expect(textOf(delRes)).toMatch(/Deleted/i);
    created.documentLinks.delete(link.id);
  }, 30000);
});
