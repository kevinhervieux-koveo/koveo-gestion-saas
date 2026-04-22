/**
 * @jest-environment node
 *
 * Task #275: Cover the MCP `delete_bill` cascade with a real
 * end-to-end integration test against Postgres.
 *
 * The mocked unit tests in `server/tests/mcp-tools.test.ts` stub
 * `db.delete` chains, so they cannot catch a regression where the
 * cascade misses a child table or violates an FK. The real cascade
 * relies on Postgres-level `ON DELETE CASCADE` from `payments.bill_id`
 * to `bills.id` (see `shared/schemas/financial.ts`). A schema change
 * that drops the cascade — or a future change to the handler that
 * tries to delete bills before clearing dependents — would silently
 * pass the mocked tests but blow up here.
 *
 * This test seeds a real bill inside an MCP-scoped organization, with
 * multiple payment rows pointing at it, then invokes the production
 * `delete_bill` MCP tool handler against the real database. It
 * asserts:
 *
 *   1. The MCP tool response reports the deleted bill (matching the
 *      seeded id / billNumber / title).
 *   2. The bill row is gone after the cascade.
 *   3. Every payment row that referenced the bill is gone — i.e. the
 *      DB-level cascade actually fired.
 *   4. An unrelated payment on a sibling bill in the same building is
 *      untouched (regression guard against an over-broad delete).
 *
 * Follows the existing real-Postgres integration pattern
 * (`tests/integration/mcp-delete-residence-cascade.test.ts`): gated on
 * `_INTEGRATION_DB_URL` (auto-populated from `DATABASE_URL` by
 * `jest.polyfills.js`) and skips cleanly when no Postgres is
 * available.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import crypto from 'crypto';
import { eq, inArray } from 'drizzle-orm';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import * as schemaImport from '@shared/schema';

type Schema = typeof schemaImport;
type Db = NeonDatabase<Schema>;

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const TEST_TAG = 'task275-mcp-bill-cascade';
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

describeIfDb('MCP delete_bill cascade — real Postgres (Task #275)', () => {
  let db: Db;
  let schema: Schema;
  let createMcpServer: typeof import('../../server/mcp/server').createMcpServer;

  // Track every row we insert so afterAll can clean up regardless of
  // which assertion (or which prior dev seed) was already in the DB.
  const created = {
    organizationId: null as string | null,
    organizationCreatedByUs: false,
    buildingId: null as string | null,
    billIds: new Set<string>(), // primary + sibling bill
    paymentIds: new Set<string>(), // payments tied to either bill
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

    if (created.paymentIds.size) {
      await db
        .delete(schema.payments)
        .where(inArray(schema.payments.id, [...created.paymentIds]));
    }
    if (created.billIds.size) {
      await db.delete(schema.bills).where(inArray(schema.bills.id, [...created.billIds]));
    }
    if (created.buildingId) {
      await db.delete(schema.buildings).where(eq(schema.buildings.id, created.buildingId));
    }
    if (created.organizationId && created.organizationCreatedByUs) {
      await db
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, created.organizationId));
    }
  }, 60000);

  it('deletes the bill and every dependent payment, leaving sibling rows intact', async () => {
    // 1. Resolve (or seed) an MCP-scoped organization. The MCP scope
    //    check (`getMcpOrgIds`) only allows bills whose building lives
    //    in an org named "MCP-1" or "MCP-2", so reuse the existing
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
      totalUnits: 1,
      totalFloors: 1,
      isActive: true,
    });
    created.buildingId = buildingId;

    // 3. Two bills in the same building:
    //    - primary: the one we'll delete, with multiple payments
    //      attached. Should be hard-deleted, and Postgres' ON DELETE
    //      CASCADE on payments.bill_id should drop the payment rows.
    //    - sibling: an unrelated bill in the same building with its
    //      own payment. Used to verify the delete is scoped — if the
    //      cascade ever broadened to the building (or just dropped
    //      the WHERE clause), this row would be wiped too.
    const billId = crypto.randomUUID();
    const siblingBillId = crypto.randomUUID();
    await db.insert(schema.bills).values([
      {
        id: billId,
        buildingId,
        billNumber: `T275-${billId.slice(0, 8)}`,
        title: `${TEST_TAG}-bill`,
        category: 'utilities',
        paymentType: 'recurrent',
        costs: ['100.00', '100.00', '100.00'],
        totalAmount: '300.00',
        startDate: '2030-01-01',
      },
      {
        id: siblingBillId,
        buildingId,
        billNumber: `T275S-${siblingBillId.slice(0, 8)}`,
        title: `${TEST_TAG}-sibling-bill`,
        category: 'utilities',
        paymentType: 'unique',
        costs: ['50.00'],
        totalAmount: '50.00',
        startDate: '2030-02-01',
      },
    ]);
    created.billIds.add(billId);
    created.billIds.add(siblingBillId);

    // 4. Three payments on the primary bill (covering "at least one row
    //    in every dependent table the cascade touches" from the task
    //    spec — `payments` is the only table with an FK back to bills)
    //    plus one payment on the sibling bill.
    const paymentIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
    const siblingPaymentId = crypto.randomUUID();
    await db.insert(schema.payments).values([
      {
        id: paymentIds[0],
        billId,
        paymentNumber: 1,
        scheduledDate: '2030-01-01',
        amount: '100.00',
      },
      {
        id: paymentIds[1],
        billId,
        paymentNumber: 2,
        scheduledDate: '2030-02-01',
        amount: '100.00',
      },
      {
        id: paymentIds[2],
        billId,
        paymentNumber: 3,
        scheduledDate: '2030-03-01',
        amount: '100.00',
        status: 'paid',
        paidDate: '2030-03-02',
      },
      {
        id: siblingPaymentId,
        billId: siblingBillId,
        paymentNumber: 1,
        scheduledDate: '2030-02-01',
        amount: '50.00',
      },
    ]);
    paymentIds.forEach((id) => created.paymentIds.add(id));
    created.paymentIds.add(siblingPaymentId);

    // ---- Invoke the real MCP `delete_bill` handler ----
    const server = createMcpServer();
    const handler = getToolHandler(server, 'delete_bill');
    const result = await handler({ role: 'admin', billId }, {});
    const parsed = parseToolJson(result);

    // The handler reports the deleted bill summary, a cascade summary
    // whose counts must match the rows we seeded, and a message
    // referencing the cascade.
    expect(parsed.deleted).toEqual({
      id: billId,
      billNumber: `T275-${billId.slice(0, 8)}`,
      title: `${TEST_TAG}-bill`,
    });
    expect(parsed.cascaded).toEqual({ payments: paymentIds.length });
    expect(parsed.message).toMatch(/cascade/i);

    // The bill row itself is gone…
    const remainingBill = await db
      .select({ id: schema.bills.id })
      .from(schema.bills)
      .where(eq(schema.bills.id, billId));
    expect(remainingBill).toHaveLength(0);
    created.billIds.delete(billId);

    // …every payment that pointed at the deleted bill is gone (this
    // is the regression guard: if `payments.bill_id`'s ON DELETE
    // CASCADE is ever dropped, or if the handler stops issuing the
    // cascading delete in a way Postgres can follow, this assertion
    // fails immediately)…
    const remainingPayments = await db
      .select({ id: schema.payments.id })
      .from(schema.payments)
      .where(inArray(schema.payments.id, paymentIds));
    expect(remainingPayments).toHaveLength(0);
    paymentIds.forEach((id) => created.paymentIds.delete(id));

    // Sanity: no payment row anywhere in the DB still references the
    // deleted bill.
    const danglingPayments = await db
      .select({ id: schema.payments.id })
      .from(schema.payments)
      .where(eq(schema.payments.billId, billId));
    expect(danglingPayments).toHaveLength(0);

    // …and the sibling bill + its payment in the same building are
    // untouched. If the cascade ever broadened to the building scope
    // (or dropped its WHERE clause), this would catch it.
    const remainingSiblingBill = await db
      .select({ id: schema.bills.id })
      .from(schema.bills)
      .where(eq(schema.bills.id, siblingBillId));
    expect(remainingSiblingBill).toHaveLength(1);

    const remainingSiblingPayment = await db
      .select({ id: schema.payments.id, billId: schema.payments.billId })
      .from(schema.payments)
      .where(eq(schema.payments.id, siblingPaymentId));
    expect(remainingSiblingPayment).toHaveLength(1);
    expect(remainingSiblingPayment[0].billId).toBe(siblingBillId);
  }, 60000);
});
