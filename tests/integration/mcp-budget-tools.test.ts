/**
 * @jest-environment node
 *
 * Task #599: Integration coverage for the 14 budget MCP tools.
 *
 * The mocked unit suite at `tests/unit/api/mcp-budget-tools.test.ts`
 * already pins call-shape and Zod validation behavior. What it cannot
 * prove is the actual round-trip through Drizzle and Postgres:
 *
 *   - the merge-don't-clobber behavior on the `amenities` jsonb
 *     document when `update_budget_settings` rewrites the whole
 *     extended-config,
 *   - the `capital_investments.type` enum guard that prevents MCP from
 *     mutating auto-generated rows,
 *   - the `ownershipType` enum (`residences`/`owner`) plus the
 *     UUID-typed `buildingId` column on capital investments,
 *   - role enforcement (tenants cannot reach any write tool),
 *   - parity between the `get_budget_forecast` MCP tool and a direct
 *     call to `forecastHandler` — the tool delegates to the canonical
 *     handler, so any divergence in the in-process adapter or the
 *     forecast handler's body parsing will show up as a diff.
 *
 * Pattern mirrors `tests/integration/mcp-delete-bill-cascade.test.ts`:
 * gated on `_INTEGRATION_DB_URL` (auto-populated from `DATABASE_URL`
 * by `jest.polyfills.js`) and skips cleanly when no Postgres is
 * available.
 */

// Stub the modules that `server/mcp/server.ts` imports at the top but
// that the budget tools never use. Loading the real implementations
// pulls in the ESM-only `uuid` package which Jest's ts-jest transformer
// cannot parse without project-wide config changes.
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
import express from 'express';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import * as schemaImport from '@shared/schema';

type Schema = typeof schemaImport;
type Db = NeonDatabase<Schema>;

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const TEST_TAG = 'task599-mcp-budget-tools';
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

function parseJson<T = Record<string, unknown>>(result: ToolResult): T {
  return JSON.parse(textOf(result)) as T;
}

describeIfDb('MCP budget tools — real Postgres (Task #599)', () => {
  let db: Db;
  let schema: Schema;
  let createMcpServer: typeof import('../../server/mcp/server').createMcpServer;
  let app: express.Application;

  // Track every row we insert so afterAll can clean up regardless of
  // which assertion failed (or which prior dev seed was already in the
  // DB). The org is reused if an existing "MCP-1" row is present.
  const created = {
    organizationId: null as string | null,
    organizationCreatedByUs: false,
    buildingId: null as string | null,
    capitalInvestmentIds: new Set<string>(),
  };

  // Seeded once; tests share this building so each one starts from the
  // pristine extended-config the building was created with — except
  // tests that intentionally mutate the config restore it themselves.
  let buildingId: string;
  // The extended-config we seed the building's `amenities` jsonb with.
  // Includes both top-level numeric keys and the nested objects/arrays
  // that the merge-don't-clobber test cares about.
  const initialAmenities = {
    emergencyFundMinimum: 5000,
    operatingCashMinimum: 10000,
    utilityInflationRate: 3,
    maintenanceInflationRate: 4,
    useGlobalBillsInflation: true,
    globalBillsInflationRate: 2.5,
    categoryInflationRates: { utilities: 3.5, insurance: 2.0 },
    customBankFields: { reserve_special: 1500, contingency: 800 },
    customRevenueLines: [
      { id: 'preseed-line-1', description: 'Preseeded parking', monthlyAmount: 200 },
      { id: 'preseed-line-2', description: 'Preseeded laundry', monthlyAmount: 75 },
    ],
    punctualRevenueGrowth: [
      { id: 'preseed-growth-1', year: 2028, month: 1, percentage: 1.5, inflationIncluded: true },
    ],
  } as const;

  async function readBuilding() {
    const [b] = await db
      .select()
      .from(schema.buildings)
      .where(eq(schema.buildings.id, buildingId));
    return b;
  }

  async function resetBuildingAmenities() {
    // Restore the seeded amenities + bank-account columns so each test
    // can rely on a known starting state. The merge test will mutate
    // these, so we re-seed before/after that test.
    await db
      .update(schema.buildings)
      .set({
        amenities: initialAmenities as unknown as Record<string, unknown>,
        bankAccountStartAmount: '100000',
        bankAccountStartDate: new Date('2024-01-01'),
        bankAccountNotes: null,
        generalInflationRate: '2.5',
        revenueInflationRate: '2.5',
        unplannedBillsAmount: '500',
        unplannedBillsStartDate: '2024-01-01',
        financialYearStart: '2024-01-01',
      })
      .where(eq(schema.buildings.id, buildingId));
  }

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    db = require('../../server/db').db as Db;
    schema = require('@shared/schema') as Schema;
    ({ createMcpServer } = require('../../server/mcp/server'));

    // Mount the bare forecast handler so the parity test can call it
    // directly via supertest and compare the JSON to what the MCP tool
    // produced. We bypass `requireAuth` on purpose — the parity check
    // is about handler output, not the auth middleware.
    const { forecastHandler } = require('../../server/api/budgets');
    app = express();
    app.use(express.json());
    app.post('/api/budgets/:buildingId/forecast', forecastHandler);

    // Resolve (or seed) an MCP-scoped organization. `getMcpOrgIds`
    // only returns orgs named "MCP-1" or "MCP-2", so reuse whatever
    // sandbox org is already in the DB rather than always creating a
    // fresh one.
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

    // The capital-investment insert path validates `buildingId` as a
    // UUID (`insertCapitalInvestmentSchema.buildingId.uuid()`), so the
    // building id must be a real UUID rather than an arbitrary slug.
    buildingId = crypto.randomUUID();
    await db.insert(schema.buildings).values({
      id: buildingId,
      organizationId: created.organizationId!,
      name: `${TEST_TAG} bldg`,
      address: '1 Budget Way',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
      buildingType: 'condo',
      totalUnits: 10,
      totalFloors: 2,
      isActive: true,
    });
    created.buildingId = buildingId;

    await resetBuildingAmenities();
  }, 60000);

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;
    if (created.buildingId) {
      // Wipe any custom investments left over by tests. Bills/payments
      // are not seeded by this suite.
      await db
        .delete(schema.capitalInvestments)
        .where(eq(schema.capitalInvestments.buildingId, created.buildingId));
      await db.delete(schema.buildings).where(eq(schema.buildings.id, created.buildingId));
    }
    if (created.organizationCreatedByUs && created.organizationId) {
      await db
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, created.organizationId));
    }
  }, 60000);

  it('get_budget_settings returns the merged building config', async () => {
    const server = createMcpServer();
    const handler = getToolHandler(server, 'get_budget_settings');
    const result = await handler({ role: 'admin', buildingId });
    const json = parseJson<{
      buildingId: string;
      buildingName: string;
      emergencyFundMinimum: number;
      operatingCashMinimum: number;
      customBankFields: Record<string, number>;
      customRevenueLines: Array<{ id: string; description: string }>;
      categoryInflationRates: Record<string, number>;
      capitalInvestments: unknown;
    }>(result);

    expect(json.buildingId).toBe(buildingId);
    expect(json.buildingName).toContain(TEST_TAG);
    expect(json.emergencyFundMinimum).toBe(initialAmenities.emergencyFundMinimum);
    expect(json.operatingCashMinimum).toBe(initialAmenities.operatingCashMinimum);
    expect(json.customBankFields).toEqual(initialAmenities.customBankFields);
    expect(json.customRevenueLines.map((l) => l.id).sort()).toEqual(
      ['preseed-line-1', 'preseed-line-2'].sort(),
    );
    expect(json.categoryInflationRates).toEqual(initialAmenities.categoryInflationRates);
    expect(Array.isArray(json.capitalInvestments)).toBe(true);
  }, 30000);

  it('exercises custom revenue lines, punctual growth, and unplanned bills end-to-end', async () => {
    const server = createMcpServer();

    // tenant cannot add a revenue line — this is the cheapest cross-check
    // that the role gate fires before any DB write happens.
    const tenantBlocked = await getToolHandler(server, 'add_custom_revenue_line')({
      role: 'tenant',
      buildingId,
      description: 'Should fail',
      monthlyAmount: 1,
    });
    expect(textOf(tenantBlocked)).toMatch(/tenants cannot modify revenue lines/i);

    // add_custom_revenue_line — admin
    const addResp = await getToolHandler(server, 'add_custom_revenue_line')({
      role: 'admin',
      buildingId,
      description: 'Vending',
      monthlyAmount: 75,
    });
    const added = parseJson<{
      status: string;
      line: { id: string; description: string; monthlyAmount: number };
    }>(addResp);
    expect(added.status).toBe('ok');
    expect(added.line.description).toBe('Vending');
    expect(added.line.monthlyAmount).toBe(75);
    const newLineId = added.line.id;
    expect(newLineId).toEqual(expect.any(String));

    // The preseeded lines must still be present alongside the new one.
    let row = await readBuilding();
    let lines = (row.amenities as { customRevenueLines: Array<{ id: string }> })
      .customRevenueLines;
    expect(lines.find((l) => l.id === 'preseed-line-1')).toBeTruthy();
    expect(lines.find((l) => l.id === 'preseed-line-2')).toBeTruthy();
    expect(lines.find((l) => l.id === newLineId)).toBeTruthy();

    // update_custom_revenue_line — partial (monthlyAmount only)
    const updResp = await getToolHandler(server, 'update_custom_revenue_line')({
      role: 'manager',
      buildingId,
      id: newLineId,
      monthlyAmount: 99,
    });
    const updated = parseJson<{
      status: string;
      line: { id: string; description: string; monthlyAmount: number };
    }>(updResp);
    expect(updated.status).toBe('ok');
    expect(updated.line.description).toBe('Vending'); // preserved
    expect(updated.line.monthlyAmount).toBe(99);

    // remove_custom_revenue_line
    const removeResp = await getToolHandler(server, 'remove_custom_revenue_line')({
      role: 'admin',
      buildingId,
      id: newLineId,
    });
    const removed = parseJson<{ status: string; removedId: string; remaining: number }>(
      removeResp,
    );
    expect(removed.status).toBe('ok');
    expect(removed.removedId).toBe(newLineId);

    row = await readBuilding();
    lines = (row.amenities as { customRevenueLines: Array<{ id: string }> })
      .customRevenueLines;
    expect(lines.find((l) => l.id === newLineId)).toBeFalsy();
    // Preseeded lines survived the add/update/remove cycle.
    expect(lines.map((l) => l.id).sort()).toEqual(['preseed-line-1', 'preseed-line-2'].sort());

    // add_punctual_growth + update + remove
    const addG = await getToolHandler(server, 'add_punctual_growth')({
      role: 'admin',
      buildingId,
      year: 2027,
      month: 6,
      percentage: 4.5,
      inflationIncluded: false,
    });
    const addedG = parseJson<{
      entry: { id: string; year: number; month: number; percentage: number; inflationIncluded: boolean };
    }>(addG);
    expect(addedG.entry.percentage).toBe(4.5);
    expect(addedG.entry.inflationIncluded).toBe(false);

    const updG = await getToolHandler(server, 'update_punctual_growth')({
      role: 'manager',
      buildingId,
      id: addedG.entry.id,
      percentage: 5.5,
    });
    const updatedG = parseJson<{ entry: { percentage: number; year: number } }>(updG);
    expect(updatedG.entry.percentage).toBe(5.5);
    expect(updatedG.entry.year).toBe(2027); // preserved

    const remG = await getToolHandler(server, 'remove_punctual_growth')({
      role: 'admin',
      buildingId,
      id: addedG.entry.id,
    });
    expect(parseJson<{ status: string }>(remG).status).toBe('ok');

    row = await readBuilding();
    const growth = (row.amenities as {
      punctualRevenueGrowth: Array<{ id: string }>;
    }).punctualRevenueGrowth;
    expect(growth.find((g) => g.id === addedG.entry.id)).toBeFalsy();
    // Preseeded growth entry survived the add/update/remove cycle.
    expect(growth.find((g) => g.id === 'preseed-growth-1')).toBeTruthy();

    // update_unplanned_bills — tenant denied, then a manager update.
    const tDeniedBills = await getToolHandler(server, 'update_unplanned_bills')({
      role: 'tenant',
      buildingId,
      unplannedBillsAmount: 999,
    });
    expect(textOf(tDeniedBills)).toMatch(/tenants cannot update unplanned bills/i);

    const upn = await getToolHandler(server, 'update_unplanned_bills')({
      role: 'manager',
      buildingId,
      unplannedBillsAmount: 1234,
      unplannedBillsStartDate: '2025-03-01',
      notes: 'Q1 reconciliation',
    });
    const upnP = parseJson<{
      status: string;
      unplannedBillsAmount: number | string;
      notes: string | null;
    }>(upn);
    expect(upnP.status).toBe('ok');
    expect(Number(upnP.unplannedBillsAmount)).toBe(1234);
    expect(upnP.notes).toBe('Q1 reconciliation');

    row = await readBuilding();
    expect(Number(row.unplannedBillsAmount)).toBe(1234);
    expect(row.bankAccountNotes).toBe('Q1 reconciliation');

    // Omitting `notes` clears the previously set note (matches the UI
    // endpoint's `notes || null` semantics, which the MCP tool relies
    // on).
    const upnClear = await getToolHandler(server, 'update_unplanned_bills')({
      role: 'admin',
      buildingId,
      unplannedBillsAmount: 1500,
    });
    const cleared = parseJson<{ status: string; notes: string | null }>(upnClear);
    expect(cleared.status).toBe('ok');
    expect(cleared.notes).toBeNull();
    row = await readBuilding();
    expect(row.bankAccountNotes).toBeNull();
  }, 90000);

  it('update_budget_settings merges into amenities and refuses tenant', async () => {
    // Re-seed in case the previous test left the building's amenities
    // in a different shape (the unplanned-bills tool goes through
    // bankAccountPutHandler which rebuilds `amenities`).
    await resetBuildingAmenities();

    const server = createMcpServer();

    // Tenant denied — no DB write happens.
    const tDenied = await getToolHandler(server, 'update_budget_settings')({
      role: 'tenant',
      buildingId,
      settings: { emergencyFundMinimum: 7777 },
    });
    expect(textOf(tDenied)).toMatch(/tenants cannot update budget settings/i);

    const before = await readBuilding();
    const beforeExt = before.amenities as Record<string, unknown>;

    // Partial update: only override emergencyFundMinimum. The other
    // extended-config keys (customBankFields, customRevenueLines,
    // punctualRevenueGrowth, categoryInflationRates, *InflationRate)
    // must survive the rebuild bankAccountPutHandler performs on
    // `amenities`. This is the merge-don't-clobber assertion the task
    // calls out.
    const upd = await getToolHandler(server, 'update_budget_settings')({
      role: 'admin',
      buildingId,
      settings: { emergencyFundMinimum: 7777 },
    });
    const updJson = parseJson<{ status: string; updated: string[]; buildingId: string }>(upd);
    expect(updJson.status).toBe('ok');
    expect(updJson.buildingId).toBe(buildingId);
    expect(updJson.updated).toEqual(['emergencyFundMinimum']);

    const after = await readBuilding();
    const afterExt = after.amenities as Record<string, unknown>;

    expect(afterExt.emergencyFundMinimum).toBe(7777);
    // Every other key the building had before the partial update is
    // preserved verbatim — that is the regression guard.
    expect(afterExt.operatingCashMinimum).toBe(beforeExt.operatingCashMinimum);
    expect(afterExt.utilityInflationRate).toBe(beforeExt.utilityInflationRate);
    expect(afterExt.maintenanceInflationRate).toBe(beforeExt.maintenanceInflationRate);
    expect(afterExt.useGlobalBillsInflation).toBe(beforeExt.useGlobalBillsInflation);
    expect(afterExt.globalBillsInflationRate).toBe(beforeExt.globalBillsInflationRate);
    expect(afterExt.categoryInflationRates).toEqual(beforeExt.categoryInflationRates);
    expect(afterExt.customBankFields).toEqual(beforeExt.customBankFields);
    expect(afterExt.customRevenueLines).toEqual(beforeExt.customRevenueLines);
    expect(afterExt.punctualRevenueGrowth).toEqual(beforeExt.punctualRevenueGrowth);

    // Top-level bank-account columns are also preserved across the
    // partial update (the MCP tool echoes the existing values back).
    expect(after.bankAccountStartAmount).toBe(before.bankAccountStartAmount);
    expect(after.financialYearStart).toEqual(before.financialYearStart);

    // Restore amenities for any subsequent test that runs after this.
    await resetBuildingAmenities();
  }, 60000);

  it('exercises capital investment CRUD (custom only) and refuses tenant writes', async () => {
    const server = createMcpServer();

    // tenant cannot create
    const tCreate = await getToolHandler(server, 'create_capital_investment')({
      role: 'tenant',
      buildingId,
      title: 'Should fail',
      amount: 100,
      targetDate: '2027-01-01',
      urgency: 'urgent',
      ownershipType: 'residences',
    });
    expect(textOf(tCreate)).toMatch(/tenants cannot create capital investments/i);

    // admin creates a custom investment. The MCP tool's response body
    // includes the database `id` of the newly-inserted row so callers
    // can drive a follow-up update or delete without having to look it
    // up themselves (Task #613).
    const cr = await getToolHandler(server, 'create_capital_investment')({
      role: 'admin',
      buildingId,
      title: `${TEST_TAG} roof`,
      amount: 25000,
      targetDate: '2027-06-01',
      urgency: 'urgent',
      ownershipType: 'residences',
      description: 'New flashing',
      category: 'capital_works',
    });
    const createdResp = parseJson<{
      id: string;
      type: string;
      title: string;
      amount: string | number;
      ownershipType: string;
    }>(cr);
    expect(createdResp.id).toBeTruthy();
    expect(createdResp.type).toBe('custom');
    expect(createdResp.title).toBe(`${TEST_TAG} roof`);
    expect(createdResp.ownershipType).toBe('residences');
    expect(String(createdResp.amount)).toBe('25000.00');

    const investmentId = createdResp.id;
    // Sanity-check the row really landed in Postgres with the same id.
    const persistedRows = await db
      .select()
      .from(schema.capitalInvestments)
      .where(eq(schema.capitalInvestments.id, investmentId));
    expect(persistedRows).toHaveLength(1);
    expect(persistedRows[0]!.type).toBe('custom');
    expect(persistedRows[0]!.ownershipType).toBe('residences');
    expect(persistedRows[0]!.amount).toBe('25000.00');
    created.capitalInvestmentIds.add(investmentId);

    // list_capital_investments returns the new row.
    const list = await getToolHandler(server, 'list_capital_investments')({
      role: 'admin',
      buildingId,
    });
    const rows = parseJson<Array<{ id: string; type: string }>>(list);
    expect(rows.find((r) => r.id === investmentId)).toBeTruthy();

    // update_capital_investment changes title + amount; the row's id
    // and the unmentioned fields are preserved (Task #526 upsert-by-id
    // contract).
    const upd = await getToolHandler(server, 'update_capital_investment')({
      role: 'manager',
      investmentId,
      title: `${TEST_TAG} roof v2`,
      amount: 27500,
    });
    const updated = parseJson<{
      id: string;
      title: string;
      amount: string | number;
      ownershipType: string;
    }>(upd);
    expect(updated.id).toBe(investmentId);
    expect(updated.title).toBe(`${TEST_TAG} roof v2`);
    expect(String(updated.amount)).toBe('27500.00');
    expect(updated.ownershipType).toBe('residences'); // preserved

    // tenant cannot delete
    const tDel = await getToolHandler(server, 'delete_capital_investment')({
      role: 'tenant',
      investmentId,
    });
    expect(textOf(tDel)).toMatch(/tenants cannot delete capital investments/i);

    // admin deletes the row, and a follow-up DB read confirms it's gone.
    const del = await getToolHandler(server, 'delete_capital_investment')({
      role: 'admin',
      investmentId,
    });
    const delJson = parseJson<{ status: string; deletedId: string }>(del);
    expect(delJson.status).toBe('ok');
    expect(delJson.deletedId).toBe(investmentId);
    created.capitalInvestmentIds.delete(investmentId);

    const remainingRows = await db
      .select()
      .from(schema.capitalInvestments)
      .where(eq(schema.capitalInvestments.id, investmentId));
    expect(remainingRows).toHaveLength(0);
  }, 60000);

  it('refuses to mutate auto-generated capital investments via MCP', async () => {
    // Seed an `auto_generated` row directly — only the budget UI /
    // maintenance pipeline produces these in production. The MCP layer
    // must refuse to update or delete them, regardless of caller role.
    const autoId = crypto.randomUUID();
    await db.insert(schema.capitalInvestments).values({
      id: autoId,
      buildingId,
      title: `${TEST_TAG} auto`,
      amount: '5000',
      targetDate: new Date('2030-01-01'),
      urgency: 'suggested',
      type: 'auto_generated',
      ownershipType: 'residences',
    });
    created.capitalInvestmentIds.add(autoId);

    try {
      const server = createMcpServer();
      const upd = await getToolHandler(server, 'update_capital_investment')({
        role: 'admin',
        investmentId: autoId,
        title: 'should not happen',
      });
      expect(textOf(upd)).toMatch(/auto-generated/i);

      const del = await getToolHandler(server, 'delete_capital_investment')({
        role: 'admin',
        investmentId: autoId,
      });
      expect(textOf(del)).toMatch(/auto-generated/i);

      // Row is intact — its title was not overwritten, and the row
      // was not deleted.
      const after = await db
        .select()
        .from(schema.capitalInvestments)
        .where(eq(schema.capitalInvestments.id, autoId));
      expect(after).toHaveLength(1);
      expect(after[0].title).toBe(`${TEST_TAG} auto`);
      expect(after[0].type).toBe('auto_generated');
    } finally {
      await db
        .delete(schema.capitalInvestments)
        .where(eq(schema.capitalInvestments.id, autoId));
      created.capitalInvestmentIds.delete(autoId);
    }
  }, 60000);

  it('get_budget_forecast matches a direct call to forecastHandler', async () => {
    // Reset amenities so this test sees a known starting state — the
    // earlier tests may have left the bank-account notes / unplanned
    // bills amount in a different shape, which would still be
    // deterministic but obscures the comparison.
    await resetBuildingAmenities();

    const server = createMcpServer();

    // Use a body that touches every required and most optional fields
    // of `forecastInputSchema` so the parity check actually exercises
    // the full input contract.
    const body = {
      lookbackYears: 3,
      capitalInvestmentMode: 'suggested' as const,
      viewType: 'month' as const,
      periodLength: 12,
      startMonth: 1,
      startYear: 2026,
    };

    const mcpResp = await getToolHandler(server, 'get_budget_forecast')({
      role: 'admin',
      buildingId,
      ...body,
    });
    const mcpJson = parseJson<Record<string, unknown>>(mcpResp);

    const httpResp = await request(app)
      .post(`/api/budgets/${buildingId}/forecast`)
      .send(body);
    expect(httpResp.status).toBe(200);

    // The MCP tool delegates to the same forecastHandler the HTTP
    // route mounts, so the JSON output must be byte-identical. Any
    // divergence (e.g. body coercion in the in-process adapter,
    // accidental Date/now() leak in the handler) shows up here.
    expect(mcpJson).toEqual(httpResp.body);
  }, 60000);
});
