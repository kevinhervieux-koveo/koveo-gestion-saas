/**
 * @jest-environment node
 *
 * Task #652: Integration test for the `list_bills` and `create_bill` MCP
 * tools against a real Postgres instance.
 *
 * The mocked unit suite cannot catch a regression where `list_bills` fails
 * because a column present in `shared/schemas/financial.ts` is absent from
 * the deployed database (e.g. `original_file_name` — the column whose
 * absence caused every `list_bills` call to crash with a Drizzle
 * DrizzleQueryError on 2026-04-25).
 *
 * This test:
 *   (a) Seeds an MCP-scoped building + a handful of bills.
 *   (b) Calls `list_bills` and asserts a successful JSON-array response
 *       with no `"error"` key containing `"Internal server error"`.
 *   (c) Creates a bill via `create_bill` and verifies it round-trips back
 *       through `list_bills`.
 *   (d) Verifies the tenant role is blocked from listing bills.
 *
 * Follows the existing real-Postgres integration pattern:
 *   gated on `_INTEGRATION_DB_URL` (auto-populated from `DATABASE_URL`
 *   by `jest.polyfills.js`) and skips cleanly when no Postgres is available.
 */

jest.mock('../../server/services/document-service', () => ({
  DocumentService: class {},
}));
jest.mock('../../server/objectStorage', () => ({
  ObjectStorageService: class {},
}));
jest.mock('../../server/services/consolidated-ai-service', () => ({
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
const TEST_TAG = 'task652-list-bills';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

interface ToolResult {
  content?: Array<{ text?: string }>;
}

function getToolHandler(
  server: unknown,
  toolName: string,
): (args: unknown, extra?: unknown) => Promise<ToolResult> {
  const tools = (
    server as {
      _registeredTools?: Record<
        string,
        { handler?: unknown; callback?: unknown }
      >;
    }
  )._registeredTools;
  if (!tools || !tools[toolName])
    throw new Error(`Tool "${toolName}" not registered`);
  const fn = (tools[toolName].handler ?? tools[toolName].callback) as
    | ((args: unknown, extra?: unknown) => Promise<ToolResult>)
    | undefined;
  if (typeof fn !== 'function')
    throw new Error(`Tool "${toolName}" handler missing`);
  return fn;
}

function textOf(result: ToolResult): string {
  return result?.content?.[0]?.text ?? '';
}

function parseJson<T = unknown>(result: ToolResult): T {
  return JSON.parse(textOf(result)) as T;
}

describeIfDb('MCP list_bills — real Postgres (Task #652)', () => {
  let db: Db;
  let schema: Schema;
  let createMcpServer: typeof import('../../server/mcp/server').createMcpServer;

  const created = {
    organizationId: null as string | null,
    organizationCreatedByUs: false,
    buildingId: null as string | null,
    billIds: new Set<string>(),
  };

  let buildingId: string;

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    db = require('../../server/db').db as Db;
    schema = require('@shared/schema') as Schema;
    ({ createMcpServer } = require('../../server/mcp/server'));

    // Reuse the existing MCP-1 sandbox org when present.
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
        address: `${TEST_TAG} org`,
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A1',
      });
      created.organizationId = orgId;
      created.organizationCreatedByUs = true;
    }

    buildingId = crypto.randomUUID();
    await db.insert(schema.buildings).values({
      id: buildingId,
      organizationId: created.organizationId!,
      name: `${TEST_TAG} bldg`,
      address: '1 Bills Lane',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
      buildingType: 'condo',
      totalUnits: 4,
      totalFloors: 1,
      isActive: true,
    });
    created.buildingId = buildingId;

    // Seed two bills directly so list_bills has rows to return.
    const billNumber1 = `${TEST_TAG}-SEED-${crypto.randomUUID().slice(0, 8)}`;
    const billNumber2 = `${TEST_TAG}-SEED-${crypto.randomUUID().slice(0, 8)}`;
    const rows = await db
      .insert(schema.bills)
      .values([
        {
          buildingId,
          billNumber: billNumber1,
          title: 'Seed bill alpha',
          category: 'insurance',
          totalAmount: '1000.00',
          costs: ['1000.00'],
          paymentType: 'unique',
          startDate: '2025-01-01',
          status: 'draft',
        },
        {
          buildingId,
          billNumber: billNumber2,
          title: 'Seed bill beta',
          category: 'maintenance',
          totalAmount: '500.00',
          costs: ['500.00'],
          paymentType: 'unique',
          startDate: '2025-02-01',
          status: 'sent',
        },
      ])
      .returning({ id: schema.bills.id });
    for (const r of rows) created.billIds.add(r.id);
  }, 60000);

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;
    if (created.billIds.size) {
      await db
        .delete(schema.bills)
        .where(inArray(schema.bills.id, [...created.billIds]));
    }
    if (created.buildingId) {
      await db
        .delete(schema.buildings)
        .where(eq(schema.buildings.id, created.buildingId));
    }
    if (created.organizationCreatedByUs && created.organizationId) {
      await db
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, created.organizationId));
    }
  }, 60000);

  it('list_bills returns a JSON array and no Internal server error (regression guard)', async () => {
    const server = createMcpServer();
    const handler = getToolHandler(server, 'list_bills');

    const result = await handler({ role: 'manager', buildingId });
    const text = textOf(result);

    // Must not contain the generic error sentinel.
    expect(text).not.toContain('Internal server error');

    const parsed = JSON.parse(text);
    expect(Array.isArray(parsed)).toBe(true);

    // Both seeded bills must appear.
    expect(parsed.length).toBeGreaterThanOrEqual(2);
  }, 30000);

  it('list_bills returns bills with all expected fields including original_file_name', async () => {
    const server = createMcpServer();
    const handler = getToolHandler(server, 'list_bills');

    const result = await handler({ role: 'admin', buildingId });
    const bills = parseJson<Array<Record<string, unknown>>>(result);

    expect(Array.isArray(bills)).toBe(true);
    expect(bills.length).toBeGreaterThanOrEqual(1);

    const bill = bills[0];
    // Core fields that must be present for list_bills to be useful.
    expect(bill).toHaveProperty('id');
    expect(bill).toHaveProperty('buildingId');
    expect(bill).toHaveProperty('billNumber');
    expect(bill).toHaveProperty('title');
    expect(bill).toHaveProperty('status');
    expect(bill).toHaveProperty('totalAmount');
    // The column whose absence caused the crash (Task #652).
    expect(bill).toHaveProperty('originalFileName');
  }, 30000);

  it('tenant is denied access to list_bills', async () => {
    const server = createMcpServer();
    const handler = getToolHandler(server, 'list_bills');

    const result = await handler({ role: 'tenant', buildingId });
    const text = textOf(result);

    expect(text).toMatch(/access denied/i);
  }, 15000);

  it('list_bills can filter by status', async () => {
    const server = createMcpServer();
    const handler = getToolHandler(server, 'list_bills');

    // Filter to 'sent' — only seed bill beta should match.
    const result = await handler({ role: 'admin', buildingId, status: 'sent' });
    const bills = parseJson<Array<{ status: string }>>(result);

    expect(Array.isArray(bills)).toBe(true);
    for (const b of bills) {
      expect(b.status).toBe('sent');
    }
  }, 15000);

  it('create_bill → list_bills round-trip succeeds', async () => {
    const server = createMcpServer();
    const createHandler = getToolHandler(server, 'create_bill');
    const listHandler = getToolHandler(server, 'list_bills');

    // Create a new bill via the MCP tool.
    const createResult = await createHandler({
      role: 'manager',
      buildingId,
      title: 'Round-trip test bill',
      category: 'utilities',
      totalAmount: 250,
      paymentType: 'unique',
      startDate: '2025-06-01',
    });
    const createText = textOf(createResult);

    // Must not report an error.
    expect(createText).not.toContain('Internal server error');
    expect(createText).not.toContain('error');

    const createdBill = JSON.parse(createText) as Record<string, unknown>;
    expect(typeof createdBill.id).toBe('string');
    // Track for cleanup.
    created.billIds.add(createdBill.id as string);

    // Re-read via list_bills and assert the new bill is present.
    const listResult = await listHandler({ role: 'manager', buildingId });
    const listText = textOf(listResult);
    expect(listText).not.toContain('Internal server error');

    const allBills = JSON.parse(listText) as Array<Record<string, unknown>>;
    expect(Array.isArray(allBills)).toBe(true);
    const found = allBills.find((b) => b.id === createdBill.id);
    expect(found).toBeTruthy();
    expect(found?.title).toBe('Round-trip test bill');
    expect(found?.status).toBe('draft');
  }, 30000);
});
