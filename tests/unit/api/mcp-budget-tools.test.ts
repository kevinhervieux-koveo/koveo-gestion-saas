/**
 * Task #527 — Mocked unit-test coverage for the budget MCP tools registered
 * in `server/mcp/budget-tools.ts`. The tools delegate to the canonical
 * Express handlers exported from `server/api/budgets.ts` via the in-process
 * `invokeRouteHandler` adapter, so the tests must exercise that path end to
 * end with a fully mocked `db`. Companion real-Postgres coverage will live
 * in `tests/integration/mcp/budget-tools.test.ts` (separate task).
 *
 * Coverage targets (per task brief):
 *   - get_budget_settings              — happy path: full settings shape
 *     stitched together from bank-account + investments handlers.
 *   - update_budget_settings           — partial update preserves untouched
 *     extended-config keys (the bank-account PUT rebuilds the full
 *     `amenities` document, so the MCP layer MUST echo every existing key
 *     back; this regression is the main reason this test exists).
 *   - update_unplanned_bills           — happy path returns the canonical
 *     payload AND a 5xx from the underlying handler surfaces as a
 *     buildWriteErrorResponse, not a raw payload leak.
 *   - list_capital_investments        — happy path returns the
 *     investmentsGetHandler payload verbatim.
 *   - create_capital_investment       — happy path returns the newly
 *     inserted custom row (re-fetched by content match because the PUT
 *     handler regenerates ids).
 */

import { describe, it, expect, beforeEach, beforeAll, jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Hermetic db mock. The budget handlers use BOTH the chain syntax
// (`db.select().from().where()...`, `db.update().set().where()`,
// `db.delete().where()`, `db.insert().values()`) AND the relational query
// syntax (`db.query.<table>.findFirst({ where, columns })`). The mock below
// supports both. Each chain method returns a "thenable" so an awaited chain
// (without a terminal `.returning()` / `.limit()`) resolves cleanly.
// ---------------------------------------------------------------------------

type Resolver<T> = () => T;

function thenable<T>(value: T): Promise<T> & {
  returning: jest.Mock;
  orderBy: jest.Mock;
  limit: jest.Mock;
} {
  const p = Promise.resolve(value) as Promise<T> & {
    returning: jest.Mock;
    orderBy: jest.Mock;
    limit: jest.Mock;
  };
  // `returning()` is used by some chains; default to echoing the value as an
  // array so `await db.update(...).set(...).where(...).returning()` works.
  p.returning = jest.fn().mockResolvedValue(Array.isArray(value) ? value : [value]);
  p.orderBy = jest.fn(() => thenable(value));
  p.limit = jest.fn().mockResolvedValue(value);
  return p;
}

const mockSelectChain = {
  from: jest.fn().mockReturnThis(),
  where: jest.fn(() => thenable<unknown[]>([])),
  innerJoin: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  rightJoin: jest.fn().mockReturnThis(),
  orderBy: jest.fn(() => thenable<unknown[]>([])),
  limit: jest.fn().mockResolvedValue([]),
  groupBy: jest.fn().mockReturnThis(),
  having: jest.fn().mockReturnThis(),
  offset: jest.fn().mockResolvedValue([]),
};

const mockUpdateChain = {
  set: jest.fn().mockReturnThis(),
  where: jest.fn(() => thenable<unknown[]>([])),
  returning: jest.fn().mockResolvedValue([{}]),
};

const mockInsertChain = {
  values: jest.fn(() => thenable<unknown[]>([])),
  returning: jest.fn().mockResolvedValue([{}]),
};

const mockDeleteChain = {
  where: jest.fn(() => thenable<unknown[]>([])),
};

const mockQuery = {
  buildings: {
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
  bills: {
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
  residences: {
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
  capitalInvestments: {
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
  monthlyBudgets: {
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
  budgets: {
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
};

const mockDb = {
  select: jest.fn(() => mockSelectChain),
  insert: jest.fn(() => mockInsertChain),
  update: jest.fn(() => mockUpdateChain),
  delete: jest.fn(() => mockDeleteChain),
  query: mockQuery,
  transaction: jest.fn(),
};

jest.mock('../../../server/db', () => ({ db: mockDb }));

// Heavy services pulled in by `server/mcp/server.ts` at module load — stub
// them out so this unit test can boot without touching object storage or
// Gemini.
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

const ORG_ID = 'mcp-org-1';
// `insertCapitalInvestmentSchema` requires a UUID for buildingId, so use a
// real UUID literal here instead of the usual short test ids.
const BUILDING_ID = '11111111-1111-1111-1111-111111111111';

const buildingRow = {
  id: BUILDING_ID,
  name: 'Test Building',
  organizationId: ORG_ID,
  bankAccountNumber: 'ACCT-001',
  bankAccountNotes: 'Existing notes',
  bankAccountStartDate: '2024-01-01',
  bankAccountStartAmount: '50000',
  bankAccountMinimums: '5000',
  generalInflationRate: '2.5',
  revenueInflationRate: '2.5',
  unplannedBillsAmount: '500',
  unplannedBillsStartDate: '2024-01-01',
  financialYearStart: '2024-01-01',
  bankAccountUpdatedAt: new Date('2024-01-01T00:00:00Z'),
  amenities: {
    emergencyFundMinimum: 1000,
    operatingCashMinimum: 2000,
    revenueGrowthRate: 3,
    revenueInflation: 2,
    reserveFundTarget: 50000,
    utilityInflationRate: 4,
    maintenanceInflationRate: 5,
    costInflationRate: 6,
    specialInvestmentBudget: 10000,
    investmentHorizonYears: 5,
    capitalProjectReserve: 20000,
    customBankFields: { foo: 100 },
    customRevenueLines: [],
    punctualRevenueGrowth: [],
    useGlobalBillsInflation: true,
    globalBillsInflationRate: 2.5,
    categoryInflationRates: { utilities: 3.0 },
  },
};

/**
 * Helper that resets every chain mock so a leftover `mockImplementationOnce`
 * queue from a prior test cannot bleed forward and silently shift the call
 * sequence. Mirrors the pattern used by the project-tools unit test.
 */
function resetMocks() {
  mockSelectChain.from.mockReset().mockReturnThis();
  mockSelectChain.where.mockReset().mockImplementation(() => thenable<unknown[]>([]));
  mockSelectChain.innerJoin.mockReset().mockReturnThis();
  mockSelectChain.leftJoin.mockReset().mockReturnThis();
  mockSelectChain.orderBy.mockReset().mockImplementation(() => thenable<unknown[]>([]));
  mockSelectChain.limit.mockReset().mockResolvedValue([]);
  mockDb.select.mockReset().mockReturnValue(mockSelectChain);

  mockUpdateChain.set.mockReset().mockReturnThis();
  mockUpdateChain.where.mockReset().mockImplementation(() => thenable<unknown[]>([]));
  mockUpdateChain.returning.mockReset().mockResolvedValue([{}]);
  mockDb.update.mockReset().mockReturnValue(mockUpdateChain);

  mockInsertChain.values.mockReset().mockImplementation(() => thenable<unknown[]>([]));
  mockInsertChain.returning.mockReset().mockResolvedValue([{}]);
  mockDb.insert.mockReset().mockReturnValue(mockInsertChain);

  mockDeleteChain.where.mockReset().mockImplementation(() => thenable<unknown[]>([]));
  mockDb.delete.mockReset().mockReturnValue(mockDeleteChain);

  mockQuery.buildings.findFirst.mockReset();
  mockQuery.buildings.findMany.mockReset().mockResolvedValue([]);
  mockQuery.bills.findFirst.mockReset();
  mockQuery.bills.findMany.mockReset().mockResolvedValue([]);
  mockQuery.residences.findFirst.mockReset();
  mockQuery.residences.findMany.mockReset().mockResolvedValue([]);
  mockQuery.capitalInvestments.findFirst.mockReset();
  mockQuery.capitalInvestments.findMany.mockReset().mockResolvedValue([]);
  mockQuery.monthlyBudgets.findFirst.mockReset();
  mockQuery.monthlyBudgets.findMany.mockReset().mockResolvedValue([]);
  mockQuery.budgets.findFirst.mockReset();
  mockQuery.budgets.findMany.mockReset().mockResolvedValue([]);
}

/**
 * Seed the two `db.select().from(...).where(...)` calls common to every
 * budget tool: (1) `getMcpOrgIds()` → orgs and (2) `loadScopedBuilding()`
 * → the building row. After this, callers can layer on additional
 * `mockImplementationOnce` entries for any further selects their tool
 * makes (e.g. bills, capital investments).
 */
function seedScopedBuildingLookup(building: Record<string, unknown> | null = buildingRow) {
  mockSelectChain.where
    .mockImplementationOnce(() => thenable([{ id: ORG_ID }]))
    .mockImplementationOnce(() => thenable(building ? [building] : []));
}

describe('MCP budget tools — Task #527 mocked unit tests', () => {
  let server: ReturnType<typeof createMcpServer>;

  beforeAll(() => {
    server = createMcpServer();
  });

  beforeEach(() => {
    resetMocks();
  });

  // ===========================================================================
  // Tool registration sanity check (regression guard against renames)
  // ===========================================================================
  it('registers all five budget tools covered by this suite', () => {
    const tools = (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools;
    for (const name of [
      'get_budget_settings',
      'update_budget_settings',
      'update_unplanned_bills',
      'list_capital_investments',
      'create_capital_investment',
    ]) {
      expect(tools[name]).toBeDefined();
    }
  });

  // ===========================================================================
  // 1. get_budget_settings — stitches bank-account + investments responses
  // ===========================================================================
  describe('get_budget_settings', () => {
    it('returns the merged settings payload from the underlying handlers', async () => {
      seedScopedBuildingLookup();
      // bankAccountGetHandler → db.query.buildings.findFirst (full row).
      mockQuery.buildings.findFirst.mockResolvedValueOnce(buildingRow);
      // calculateUnplannedBillsSuggestion: 2 bill selects.
      mockSelectChain.where
        .mockImplementationOnce(() => thenable<unknown[]>([])) // unique bills
        .mockImplementationOnce(() => thenable<unknown[]>([])); // first bill
      // getEarliestBillDate: 1 bill select → empty so financialYear stays null.
      mockSelectChain.where.mockImplementationOnce(() => thenable<unknown[]>([]));
      // investmentsGetHandler → db.query.buildings.findFirst (id only) + 1
      // select on capital_investments.
      mockQuery.buildings.findFirst.mockResolvedValueOnce({ id: BUILDING_ID });
      const investmentRow = {
        id: 'inv-1',
        buildingId: BUILDING_ID,
        title: 'Roof replacement',
        amount: '15000',
        targetDate: '2026-06-01',
        urgency: 'urgent',
        type: 'custom',
        ownershipType: 'residences',
        description: null,
        category: null,
      };
      mockSelectChain.where.mockImplementationOnce(() => thenable([investmentRow]));

      const handler = getToolHandler(server, 'get_budget_settings');
      const result = await handler({ role: 'admin', buildingId: BUILDING_ID }, {});
      const text = textOf(result);
      expect(text).not.toMatch(/Access denied/);
      const parsed = JSON.parse(text);
      // Spot-check: top-level identity, bank-account plumbing, extended config
      // keys, and the capital-investments list all flow through.
      expect(parsed.buildingId).toBe(BUILDING_ID);
      expect(parsed.buildingName).toBe('Test Building');
      expect(parsed.bankAccountNumber).toBe('ACCT-001');
      expect(parsed.emergencyFundMinimum).toBe(1000);
      expect(parsed.customBankFields).toEqual({ foo: 100 });
      expect(parsed.categoryInflationRates).toEqual({ utilities: 3.0 });
      expect(parsed.capitalInvestments).toEqual([investmentRow]);
    });

    it('refuses a building outside the MCP scope', async () => {
      // Building belongs to an org the MCP allowlist does not contain.
      seedScopedBuildingLookup({ ...buildingRow, organizationId: 'other-org' });
      const handler = getToolHandler(server, 'get_budget_settings');
      const result = await handler({ role: 'admin', buildingId: BUILDING_ID }, {});
      expect(textOf(result)).toMatch(/Building not found or access denied/);
      // Pre-flight scope check must short-circuit before either delegated
      // handler runs.
      expect(mockQuery.buildings.findFirst).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 2. update_budget_settings — partial update preserves untouched extended-
  //    config keys. The bank-account PUT handler rebuilds the entire
  //    `amenities` document from the request body, so the MCP layer MUST
  //    echo every existing extended-config key back when only a subset is
  //    being updated. This is the regression test for that contract.
  // ===========================================================================
  describe('update_budget_settings', () => {
    it('preserves untouched extended-config keys on a partial update', async () => {
      seedScopedBuildingLookup();
      // bankAccountPutHandler → db.query.buildings.findFirst (id-only check).
      mockQuery.buildings.findFirst.mockResolvedValueOnce({ id: BUILDING_ID });

      const handler = getToolHandler(server, 'update_budget_settings');
      const result = await handler(
        {
          role: 'admin',
          buildingId: BUILDING_ID,
          // ONLY override emergencyFundMinimum — every other extended-config
          // key must survive the round-trip through the bank-account PUT
          // handler that rewrites `amenities` wholesale.
          settings: { emergencyFundMinimum: 9999 },
        },
        {},
      );

      const text = textOf(result);
      expect(text).not.toMatch(/Access denied/);
      const parsed = JSON.parse(text);
      expect(parsed.status).toBe('ok');
      expect(parsed.updated).toEqual(['emergencyFundMinimum']);

      // The bank-account PUT was invoked exactly once with a body that:
      //   - applies the new emergencyFundMinimum,
      //   - preserves every other extended-config key from the existing
      //     building.amenities,
      //   - preserves the existing top-level bank-account fields.
      expect(mockUpdateChain.set).toHaveBeenCalledTimes(1);
      const setArg = (mockUpdateChain.set as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
      expect(setArg.bankAccountNumber).toBe('ACCT-001');
      expect(setArg.bankAccountStartAmount).toBe('50000');
      // `amenities` is the rebuilt extended-config doc. Every original key
      // must still be present and the override must be applied.
      const amenities = setArg.amenities as Record<string, unknown>;
      expect(amenities.emergencyFundMinimum).toBe(9999); // overridden
      expect(amenities.operatingCashMinimum).toBe(2000); // preserved
      expect(amenities.reserveFundTarget).toBe(50000); // preserved
      expect(amenities.maintenanceInflationRate).toBe(5); // preserved
      expect(amenities.customBankFields).toEqual({ foo: 100 }); // preserved
      expect(amenities.categoryInflationRates).toEqual({ utilities: 3.0 }); // preserved
    });

    it('denies tenant role before any DB call', async () => {
      const handler = getToolHandler(server, 'update_budget_settings');
      const result = await handler(
        {
          role: 'tenant',
          buildingId: BUILDING_ID,
          settings: { emergencyFundMinimum: 1 },
        },
        {},
      );
      expect(textOf(result)).toMatch(/tenants cannot update budget settings/i);
      expect(mockDb.select).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('surfaces a buildWriteErrorResponse when the underlying update throws', async () => {
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      seedScopedBuildingLookup();
      // Building lookup inside the handler succeeds…
      mockQuery.buildings.findFirst.mockResolvedValueOnce({ id: BUILDING_ID });
      // …but the actual UPDATE fails. The route handler swallows the error
      // and returns 500 → the MCP layer must wrap it via
      // buildWriteErrorResponse instead of leaking the raw payload.
      mockUpdateChain.where.mockImplementationOnce(() =>
        Promise.reject(new Error('boom')) as unknown as ReturnType<typeof thenable>,
      );

      const handler = getToolHandler(server, 'update_budget_settings');
      const result = await handler(
        {
          role: 'admin',
          buildingId: BUILDING_ID,
          settings: { emergencyFundMinimum: 1 },
        },
        {},
      );
      const text = textOf(result);
      // No SQLSTATE on the error → friendly fallback envelope.
      expect(text).toMatch(/Failed to update budget settings/i);
      expect(text).not.toMatch(/Internal server error/); // raw payload not leaked
      errSpy.mockRestore();
    });
  });

  // ===========================================================================
  // 3. update_unplanned_bills — happy path payload + 4xx surfacing
  // ===========================================================================
  describe('update_unplanned_bills', () => {
    it('returns the canonical payload when the underlying handler succeeds', async () => {
      seedScopedBuildingLookup();
      // unplannedBillsPutHandler → db.query.buildings.findFirst (id only).
      mockQuery.buildings.findFirst.mockResolvedValueOnce({ id: BUILDING_ID });

      const handler = getToolHandler(server, 'update_unplanned_bills');
      const result = await handler(
        {
          role: 'manager',
          buildingId: BUILDING_ID,
          unplannedBillsAmount: 750,
          unplannedBillsStartDate: '2026-01-01',
          notes: 'Reconciled Q1',
        },
        {},
      );

      const parsed = JSON.parse(textOf(result));
      expect(parsed.status).toBe('ok');
      expect(parsed.buildingId).toBe(BUILDING_ID);
      expect(parsed.unplannedBillsAmount).toBe(750);
      expect(parsed.unplannedBillsStartDate).toBe('2026-01-01');
      expect(parsed.notes).toBe('Reconciled Q1');

      // Confirm the underlying handler actually wrote through to db.update
      // with the validated input (notes echoed verbatim, amount stringified).
      expect(mockDb.update).toHaveBeenCalledTimes(1);
      const setArg = (mockUpdateChain.set as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
      expect(setArg.unplannedBillsAmount).toBe('750');
      expect(setArg.unplannedBillsStartDate).toBe('2026-01-01');
      expect(setArg.bankAccountNotes).toBe('Reconciled Q1');
    });

    it('surfaces a 4xx from the underlying handler as an MCP error message', async () => {
      seedScopedBuildingLookup();
      // The underlying handler's building lookup returns null → it returns
      // 404 `{_error: 'Building not found'}`. The MCP layer must NOT pass
      // the raw payload back; it should wrap it via buildWriteErrorResponse.
      mockQuery.buildings.findFirst.mockResolvedValueOnce(null);

      const handler = getToolHandler(server, 'update_unplanned_bills');
      const result = await handler(
        {
          role: 'admin',
          buildingId: BUILDING_ID,
          unplannedBillsAmount: 100,
        },
        {},
      );
      const text = textOf(result);
      // Friendly fallback (no SQLSTATE on the synthesized error).
      expect(text).toMatch(/Failed to update unplanned bills/i);
      // The DB update must NOT have run because the handler bailed at 404.
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 4. list_capital_investments — passthrough of investmentsGetHandler
  // ===========================================================================
  describe('list_capital_investments', () => {
    it('returns the investments array verbatim from the underlying handler', async () => {
      seedScopedBuildingLookup();
      mockQuery.buildings.findFirst.mockResolvedValueOnce({ id: BUILDING_ID });
      const rows = [
        {
          id: 'inv-1',
          buildingId: BUILDING_ID,
          title: 'Boiler',
          amount: '8000',
          targetDate: '2026-03-01',
          urgency: 'not_urgent',
          type: 'custom',
          ownershipType: 'owner',
          description: null,
          category: null,
        },
        {
          id: 'inv-2',
          buildingId: BUILDING_ID,
          title: 'Auto: roof recoat',
          amount: '12000',
          targetDate: '2027-01-01',
          urgency: 'suggested',
          type: 'auto_generated',
          ownershipType: 'residences',
          description: null,
          category: null,
        },
      ];
      mockSelectChain.where.mockImplementationOnce(() => thenable(rows));

      const handler = getToolHandler(server, 'list_capital_investments');
      const result = await handler({ role: 'tenant', buildingId: BUILDING_ID }, {});
      const text = textOf(result);
      expect(text).not.toMatch(/Access denied/);
      // Tenant is intentionally allowed for the read tool — no role gate.
      const parsed = JSON.parse(text);
      expect(parsed).toEqual(rows);
    });

    it('refuses a building outside the MCP scope', async () => {
      seedScopedBuildingLookup({ ...buildingRow, organizationId: 'other-org' });
      const handler = getToolHandler(server, 'list_capital_investments');
      const result = await handler({ role: 'admin', buildingId: BUILDING_ID }, {});
      expect(textOf(result)).toMatch(/Building not found or access denied/);
      expect(mockQuery.buildings.findFirst).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 5. create_capital_investment — happy path returns the newly inserted row
  //    (re-fetched by content match because the PUT handler regenerates ids).
  // ===========================================================================
  describe('create_capital_investment', () => {
    it('returns the newly inserted custom investment with its assigned id', async () => {
      const newInput = {
        title: 'Elevator overhaul',
        amount: 25000,
        targetDate: '2026-09-01',
        urgency: 'urgent' as const,
        ownershipType: 'residences' as const,
        description: 'Mandatory inspection follow-up',
        category: 'capital_works',
      };

      // 1. loadScopedBuilding → orgs + building.
      seedScopedBuildingLookup();
      // 2. Initial investmentsGetHandler call (to read existing custom rows
      //    before the PUT regenerates them):
      //      - db.query.buildings.findFirst → {id}
      //      - db.select().from(capital_investments).where(...).orderBy(...)
      mockQuery.buildings.findFirst.mockResolvedValueOnce({ id: BUILDING_ID });
      const existingCustom = {
        id: 'old-custom-id',
        buildingId: BUILDING_ID,
        title: 'Existing custom',
        amount: '1000',
        targetDate: '2026-12-01',
        urgency: 'not_urgent',
        type: 'custom',
        ownershipType: 'owner',
        description: null,
        category: null,
      };
      mockSelectChain.where.mockImplementationOnce(() => thenable([existingCustom]));

      // 3. investmentsPutHandler (Task #526 upsert flow):
      //      - db.query.buildings.findFirst → {id}
      //      - db.select({id}).from(capital_investments).where(...) →
      //        existing custom-row ids. We return [] here so every incoming
      //        row (existing reposted + new) is treated as net-new and routed
      //        to the toInsert path (no toUpdate, no delete). That keeps the
      //        downstream assertions about `db.insert` simple while still
      //        exercising the create path end-to-end.
      //      - db.insert(capital_investments).values([...])
      mockQuery.buildings.findFirst.mockResolvedValueOnce({ id: BUILDING_ID });
      mockSelectChain.where.mockImplementationOnce(() => thenable<unknown[]>([]));

      // 4. Final re-list (to find the newly inserted row by content match —
      //    the PUT handler doesn't return rows, and ids are regenerated).
      const newAssignedId = 'new-inv-id';
      const finalRows = [
        // Existing row reinserted with a fresh id.
        { ...existingCustom, id: 'regenerated-old-id' },
        // The new row, content-matching the input.
        {
          id: newAssignedId,
          buildingId: BUILDING_ID,
          title: newInput.title,
          amount: newInput.amount.toString(),
          targetDate: newInput.targetDate,
          urgency: newInput.urgency,
          type: 'custom',
          ownershipType: newInput.ownershipType,
          description: newInput.description,
          category: newInput.category,
        },
      ];
      mockQuery.buildings.findFirst.mockResolvedValueOnce({ id: BUILDING_ID });
      mockSelectChain.where.mockImplementationOnce(() => thenable(finalRows));

      const handler = getToolHandler(server, 'create_capital_investment');
      const result = await handler({ role: 'admin', buildingId: BUILDING_ID, ...newInput }, {});
      const text = textOf(result);
      expect(text).not.toMatch(/Access denied/);
      const parsed = JSON.parse(text);
      expect(parsed.id).toBe(newAssignedId);
      expect(parsed.title).toBe(newInput.title);
      expect(parsed.amount).toBe(newInput.amount.toString());
      expect(parsed.targetDate).toBe(newInput.targetDate);
      expect(parsed.urgency).toBe(newInput.urgency);
      expect(parsed.ownershipType).toBe(newInput.ownershipType);
      expect(parsed.type).toBe('custom');

      // The PUT handler must have invoked db.insert with both the
      // re-posted existing row AND the new entry, both as net-new rows
      // (Task #526's id-preservation path is exercised separately by
      // making the existing-id select return [], so toUpdate stays empty
      // and toInsert receives every incoming row). With no idsToDelete,
      // db.delete must NOT have been called.
      expect(mockDb.delete).not.toHaveBeenCalled();
      expect(mockInsertChain.values).toHaveBeenCalledTimes(1);
      const insertedArr = (mockInsertChain.values as jest.Mock).mock
        .calls[0][0] as Array<Record<string, unknown>>;
      expect(insertedArr).toHaveLength(2); // existing reposted + new
      const newlyInserted = insertedArr.find((r) => r.title === newInput.title);
      expect(newlyInserted).toBeDefined();
      expect(newlyInserted!.amount).toBe(newInput.amount.toString());
      expect(newlyInserted!.type).toBe('custom');
    });

    it('denies tenant role before any DB call', async () => {
      const handler = getToolHandler(server, 'create_capital_investment');
      const result = await handler(
        {
          role: 'tenant',
          buildingId: BUILDING_ID,
          title: 'X',
          amount: 1,
          targetDate: '2026-01-01',
          urgency: 'urgent',
          ownershipType: 'owner',
        },
        {},
      );
      expect(textOf(result)).toMatch(/tenants cannot create capital investments/i);
      expect(mockDb.select).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 6. update_capital_investment — routes through investmentsPutHandler so the
  //    existing custom row keeps its database id (Task #526). Mirrors the
  //    create test pattern (mock the whole select/findFirst sequence end to
  //    end). The key behavioral assertions are:
  //      - the matching custom id triggers an UPDATE in place (not insert),
  //      - the response echoes the same id the caller supplied,
  //      - tenant role is denied before any DB work,
  //      - auto-generated rows are refused (caller-friendly accessDenied),
  //      - underlying handler errors surface via buildWriteErrorResponse.
  // ===========================================================================
  describe('update_capital_investment', () => {
    const investmentId = '99999999-9999-9999-9999-999999999999';
    const customInvestment = {
      id: investmentId,
      buildingId: BUILDING_ID,
      title: 'Old roof plan',
      description: null,
      amount: '5000',
      targetDate: '2026-06-01',
      urgency: 'not_urgent',
      type: 'custom',
      ownershipType: 'residences',
      category: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    it('preserves the database id of the updated custom investment', async () => {
      // Call order inside the tool:
      //   1. getMcpOrgIds          → orgs select
      //   2. investment lookup     → custom investment select
      //   3. loadScopedBuilding    → building select
      //   4. investmentsGetHandler → findFirst + select (existing rows)
      //   5. investmentsPutHandler → findFirst + select(existing ids) + update
      //   6. investmentsGetHandler → findFirst + select (post-save rows)
      mockSelectChain.where
        .mockImplementationOnce(() => thenable([{ id: ORG_ID }]))
        .mockImplementationOnce(() => thenable([customInvestment]))
        .mockImplementationOnce(() => thenable([buildingRow]));
      // investmentsGetHandler (initial): findFirst + select → existing rows.
      mockQuery.buildings.findFirst.mockResolvedValueOnce({ id: BUILDING_ID });
      mockSelectChain.where.mockImplementationOnce(() => thenable([customInvestment]));
      // investmentsPutHandler:
      //   - findFirst (building scope)
      //   - select existing custom ids → returns [{id: investmentId}] so the
      //     handler routes the entry to its UPDATE branch (id-preserving).
      mockQuery.buildings.findFirst.mockResolvedValueOnce({ id: BUILDING_ID });
      mockSelectChain.where.mockImplementationOnce(() => thenable([{ id: investmentId }]));
      // Final re-list (to echo canonical post-save row): findFirst + select.
      mockQuery.buildings.findFirst.mockResolvedValueOnce({ id: BUILDING_ID });
      const updatedRow = { ...customInvestment, title: 'New roof plan' };
      mockSelectChain.where.mockImplementationOnce(() => thenable([updatedRow]));

      const handler = getToolHandler(server, 'update_capital_investment');
      const result = await handler(
        {
          role: 'manager',
          investmentId,
          title: 'New roof plan',
        },
        {},
      );

      const text = textOf(result);
      expect(text).not.toMatch(/Access denied/);
      const parsed = JSON.parse(text);
      // The id round-trips unchanged — this is the regression guard for
      // Task #526.
      expect(parsed.id).toBe(investmentId);
      expect(parsed.title).toBe('New roof plan');

      // db.update was invoked exactly once (the existing id matched, so the
      // PUT handler took the UPDATE branch instead of insert).
      expect(mockDb.update).toHaveBeenCalledTimes(1);
      const setArg = (mockUpdateChain.set as jest.Mock).mock
        .calls[0][0] as Record<string, unknown>;
      expect(setArg.title).toBe('New roof plan');
      expect(setArg.type).toBe('custom');
      expect(setArg.updatedAt).toBeInstanceOf(Date);
      // No deletes (id is still in the payload) and no inserts (no net-new).
      expect(mockDb.delete).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('denies tenant role before any DB call', async () => {
      const handler = getToolHandler(server, 'update_capital_investment');
      const result = await handler(
        {
          role: 'tenant',
          investmentId,
          title: 'should-be-blocked',
        },
        {},
      );
      expect(textOf(result)).toMatch(/tenants cannot update capital investments/i);
      expect(mockDb.select).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('refuses to update an auto-generated investment', async () => {
      // Order: orgs → investment lookup. The investment is auto_generated,
      // so the tool short-circuits before loadScopedBuilding or the PUT.
      mockSelectChain.where
        .mockImplementationOnce(() => thenable([{ id: ORG_ID }]))
        .mockImplementationOnce(() => thenable([{ ...customInvestment, type: 'auto_generated' }]));

      const handler = getToolHandler(server, 'update_capital_investment');
      const result = await handler({ role: 'admin', investmentId, title: 'nope' }, {});
      expect(textOf(result)).toMatch(/Refusing to update auto-generated/i);
      // The PUT handler never ran, so no writes were attempted.
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('returns access-denied when the investment id does not exist', async () => {
      // getMcpOrgIds → orgs, then investment lookup → empty.
      mockSelectChain.where
        .mockImplementationOnce(() => thenable([{ id: ORG_ID }]))
        .mockImplementationOnce(() => thenable<unknown[]>([]));
      const handler = getToolHandler(server, 'update_capital_investment');
      const result = await handler(
        { role: 'admin', investmentId, title: 'whatever' },
        {},
      );
      expect(textOf(result)).toMatch(/Capital investment not found/);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('surfaces underlying PUT failures via buildWriteErrorResponse', async () => {
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      // Order: orgs → investment lookup → building lookup → GET → PUT (fails).
      mockSelectChain.where
        .mockImplementationOnce(() => thenable([{ id: ORG_ID }]))
        .mockImplementationOnce(() => thenable([customInvestment]))
        .mockImplementationOnce(() => thenable([buildingRow]));
      // GET handler initial: findFirst + select existing rows.
      mockQuery.buildings.findFirst.mockResolvedValueOnce({ id: BUILDING_ID });
      mockSelectChain.where.mockImplementationOnce(() => thenable([customInvestment]));
      // PUT handler: building.findFirst returns null → the handler returns
      // 404. The MCP layer must wrap that in a friendly write-error envelope
      // instead of leaking the raw `{_error: 'Building not found'}` payload.
      mockQuery.buildings.findFirst.mockResolvedValueOnce(null);

      const handler = getToolHandler(server, 'update_capital_investment');
      const result = await handler(
        { role: 'admin', investmentId, title: 'broken' },
        {},
      );
      const text = textOf(result);
      expect(text).toMatch(/Failed to update capital investment/i);
      expect(text).not.toMatch(/Internal server error/);
      // The handler aborted before any write was attempted.
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockDb.delete).not.toHaveBeenCalled();
      errSpy.mockRestore();
    });
  });

  // ===========================================================================
  // 7. delete_capital_investment — also routes through investmentsPutHandler
  //    (rather than issuing a direct DELETE) so the rest of the building's
  //    custom investments keep their ids.
  // ===========================================================================
  describe('delete_capital_investment', () => {
    const targetId = '88888888-8888-8888-8888-888888888888';
    const otherId = '77777777-7777-7777-7777-777777777777';
    const targetRow = {
      id: targetId,
      buildingId: BUILDING_ID,
      title: 'To remove',
      description: null,
      amount: '1000',
      targetDate: '2026-06-01',
      urgency: 'not_urgent',
      type: 'custom',
      ownershipType: 'residences',
      category: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };
    const otherRow = { ...targetRow, id: otherId, title: 'Should survive' };

    it('routes through the canonical PUT handler so other custom rows keep their ids', async () => {
      // Order: orgs → investment lookup → building lookup → GET → PUT.
      mockSelectChain.where
        .mockImplementationOnce(() => thenable([{ id: ORG_ID }]))
        .mockImplementationOnce(() => thenable([targetRow]))
        .mockImplementationOnce(() => thenable([buildingRow]));
      // GET handler initial: findFirst + select existing rows (target + other).
      mockQuery.buildings.findFirst.mockResolvedValueOnce({ id: BUILDING_ID });
      mockSelectChain.where.mockImplementationOnce(() => thenable([targetRow, otherRow]));
      // PUT handler: building scope check + existing custom ids select.
      // Returning BOTH ids ensures the diff against the payload (which only
      // contains `otherRow`) deletes `targetId` and updates `otherId`. This
      // proves the surviving row took the id-preserving UPDATE branch
      // instead of being torn down and re-inserted with a new id.
      mockQuery.buildings.findFirst.mockResolvedValueOnce({ id: BUILDING_ID });
      mockSelectChain.where.mockImplementationOnce(() =>
        thenable([{ id: targetId }, { id: otherId }]),
      );

      const handler = getToolHandler(server, 'delete_capital_investment');
      const result = await handler({ role: 'manager', investmentId: targetId }, {});
      const text = textOf(result);
      expect(text).not.toMatch(/Access denied/);
      const parsed = JSON.parse(text);
      expect(parsed.status).toBe('ok');
      expect(parsed.deletedId).toBe(targetId);

      // db.delete was invoked exactly once on capital_investments (the
      // dropped id).
      expect(mockDb.delete).toHaveBeenCalledTimes(1);
      // db.update was invoked exactly once for the surviving row — proving
      // the id was preserved instead of regenerated.
      expect(mockDb.update).toHaveBeenCalledTimes(1);
      const setArg = (mockUpdateChain.set as jest.Mock).mock
        .calls[0][0] as Record<string, unknown>;
      expect(setArg.title).toBe('Should survive');
      // No inserts — every payload entry matched an existing id.
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('denies tenant role before any DB call', async () => {
      const handler = getToolHandler(server, 'delete_capital_investment');
      const result = await handler({ role: 'tenant', investmentId: targetId }, {});
      expect(textOf(result)).toMatch(/tenants cannot delete capital investments/i);
      expect(mockDb.select).not.toHaveBeenCalled();
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('refuses to delete an auto-generated investment', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => thenable([{ id: ORG_ID }]))
        .mockImplementationOnce(() => thenable([{ ...targetRow, type: 'auto_generated' }]));

      const handler = getToolHandler(server, 'delete_capital_investment');
      const result = await handler({ role: 'admin', investmentId: targetId }, {});
      expect(textOf(result)).toMatch(/Refusing to delete auto-generated/i);
      expect(mockDb.delete).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('returns access-denied when the investment id does not exist', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => thenable([{ id: ORG_ID }]))
        .mockImplementationOnce(() => thenable<unknown[]>([]));
      const handler = getToolHandler(server, 'delete_capital_investment');
      const result = await handler({ role: 'admin', investmentId: targetId }, {});
      expect(textOf(result)).toMatch(/Capital investment not found/);
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('surfaces underlying PUT failures via buildWriteErrorResponse', async () => {
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      // Order: orgs → investment lookup → building lookup → GET → PUT (fails).
      mockSelectChain.where
        .mockImplementationOnce(() => thenable([{ id: ORG_ID }]))
        .mockImplementationOnce(() => thenable([targetRow]))
        .mockImplementationOnce(() => thenable([buildingRow]));
      // GET handler initial: findFirst + select existing rows.
      mockQuery.buildings.findFirst.mockResolvedValueOnce({ id: BUILDING_ID });
      mockSelectChain.where.mockImplementationOnce(() => thenable([targetRow]));
      // PUT handler: building.findFirst returns null → 404 → wrapped error.
      mockQuery.buildings.findFirst.mockResolvedValueOnce(null);

      const handler = getToolHandler(server, 'delete_capital_investment');
      const result = await handler({ role: 'admin', investmentId: targetId }, {});
      const text = textOf(result);
      expect(text).toMatch(/Failed to delete capital investment/i);
      expect(text).not.toMatch(/Internal server error/);
      expect(mockDb.delete).not.toHaveBeenCalled();
      errSpy.mockRestore();
    });
  });
});
