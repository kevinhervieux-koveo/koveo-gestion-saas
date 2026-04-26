/**
 * Task #1132 — Regression coverage for the "financialYearStart is never null
 * in budget settings" guarantee. The fix backfilled every existing row in
 * `migrations/0018_buildings_financial_year_start_backfill.sql`, hardened
 * `MemStorage.createBuilding` to default the column when none is supplied,
 * and made `financialYearStart` a REQUIRED key on the MCP
 * `update_budget_settings` payload (no `.optional()`, no `.nullable()`). All
 * three behaviours are defensive — without dedicated tests a future refactor
 * could quietly re-introduce the null and the budget UI would silently
 * regress to incorrect inflation timing.
 *
 * The three checks below mirror the "Done looks like" bullets in the task:
 *   1. `MemStorage.createBuilding` returns a row with a non-null
 *      `financialYearStart`, even when the caller omits the field. Exercises
 *      the in-memory storage that the unit-test tier defaults to.
 *   2. The MCP `update_budget_settings` zod input schema rejects calls that
 *      omit (or null out) `financialYearStart`, with a clear error path
 *      naming the missing key.
 *   3. The MCP `get_budget_settings` tool surfaces the building's
 *      `financialYearStart` as a non-null string in the response payload
 *      (the bank-account GET handler echoes the column directly, so any
 *      regression that re-introduces nullability would show up here too).
 */

import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Hermetic db + service mocks. Mirrors the setup used by the companion
// `mcp-budget-tools.test.ts` so the MCP server can boot without touching a
// real Postgres, object storage, or Gemini. The relational query syntax
// (`db.query.<table>.findFirst`) and the chain syntax
// (`db.select().from().where()`, `db.update().set().where()`) are both
// supported because both budget tools under test reach into both shapes.
// ---------------------------------------------------------------------------

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
  orderBy: jest.fn(() => thenable<unknown[]>([])),
  limit: jest.fn().mockResolvedValue([]),
  groupBy: jest.fn().mockReturnThis(),
  having: jest.fn().mockReturnThis(),
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
  buildings: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
  bills: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
  residences: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
  capitalInvestments: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
  monthlyBudgets: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
  budgets: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
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
// `tests/unit/api/...` does not match any of the moduleNameMapper patterns
// for storage (`^server/storage`, `^./storage`, `^../storage`), so this
// pulls in the real `MemStorage` class instead of the test scaffold in
// `__mocks__/server/storage.ts`. That is intentional — this test exists to
// pin down the production createBuilding default.
import { MemStorage } from '../../../server/storage';

interface ToolResult {
  content?: Array<{ type?: string; text?: string }>;
}

interface RegisteredTool {
  handler?: unknown;
  callback?: unknown;
  inputSchema?: { safeParse: (input: unknown) => { success: boolean; error?: { issues: Array<{ path: Array<string | number>; message: string; code?: string }> } } };
}

function getRegisteredTool(
  server: ReturnType<typeof createMcpServer>,
  toolName: string,
): RegisteredTool {
  const tools = (server as unknown as {
    _registeredTools: Record<string, RegisteredTool>;
  })._registeredTools;
  if (!tools || !tools[toolName]) throw new Error(`Tool "${toolName}" not registered`);
  return tools[toolName];
}

function getToolHandler(
  server: ReturnType<typeof createMcpServer>,
  toolName: string,
): (args: Record<string, unknown>, extra?: unknown) => Promise<ToolResult> {
  const tool = getRegisteredTool(server, toolName);
  const fn = (tool.handler ?? tool.callback) as
    | ((args: Record<string, unknown>, extra?: unknown) => Promise<ToolResult>)
    | undefined;
  if (typeof fn !== 'function') throw new Error(`Tool "${toolName}" handler missing`);
  return fn;
}

function textOf(result: ToolResult): string {
  return result?.content?.[0]?.text ?? '';
}

const ORG_ID = 'mcp-org-1';
const BUILDING_ID = '11111111-1111-1111-1111-111111111111';

/**
 * Reset every chain mock between tests so a leftover `mockImplementationOnce`
 * queue from one test cannot bleed into the next and silently shift the
 * call sequence (the get-handler issues several selects in order).
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
}

/**
 * Seed the two `db.select().from(...).where(...)` calls every budget tool
 * makes through `loadScopedBuilding`: (1) `getMcpOrgIds()` returns the
 * MCP-allowlisted org id, (2) `loadScopedBuilding()` returns the building
 * row whose org matches that allowlist.
 */
function seedScopedBuildingLookup(building: Record<string, unknown>) {
  mockSelectChain.where
    .mockImplementationOnce(() => thenable([{ id: ORG_ID }]))
    .mockImplementationOnce(() => thenable([building]));
}

describe('Budget settings — financialYearStart is never null (Task #1132)', () => {
  let server: ReturnType<typeof createMcpServer>;

  beforeAll(() => {
    server = createMcpServer();
  });

  beforeEach(() => {
    resetMocks();
  });

  // ===========================================================================
  // 1. MemStorage.createBuilding always populates `financialYearStart`.
  // ===========================================================================
  describe('MemStorage.createBuilding', () => {
    it('defaults financialYearStart to a non-null YYYY-MM-DD string when omitted', async () => {
      const storage = new MemStorage();

      // Caller intentionally omits `financialYearStart` — the production
      // default in `MemStorage.createBuilding` must fill it in. We only set
      // the columns that are required by the InsertBuilding shape; every
      // other column is left to the storage default.
      const created = await storage.createBuilding({
        name: 'FY Default Building',
        organizationId: ORG_ID,
        address: '1 Default St',
        city: 'Montreal',
        postalCode: 'H1A1A1',
        buildingType: 'apartment',
      } as Parameters<MemStorage['createBuilding']>[0]);

      expect(created.financialYearStart).toBeDefined();
      expect(created.financialYearStart).not.toBeNull();
      expect(typeof created.financialYearStart).toBe('string');
      // The default is a YYYY-MM-DD literal so downstream callers (forecast
      // input schema, inflation timing, etc.) can parse it without a
      // null-check.
      expect(created.financialYearStart as string).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // ===========================================================================
  // 2. MCP `update_budget_settings` zod schema requires `financialYearStart`.
  // ===========================================================================
  describe('update_budget_settings input validation', () => {
    it('rejects a settings payload that omits financialYearStart', () => {
      const tool = getRegisteredTool(server, 'update_budget_settings');
      expect(tool.inputSchema).toBeDefined();

      const result = tool.inputSchema!.safeParse({
        role: 'admin',
        buildingId: BUILDING_ID,
        // `financialYearStart` is intentionally absent.
        settings: { emergencyFundMinimum: 1000 },
      });

      expect(result.success).toBe(false);
      const issues = result.error?.issues ?? [];
      // The zod error must point at `settings.financialYearStart` so the
      // surfaced message is actionable for the caller.
      const fyIssue = issues.find(
        (i) =>
          i.path.length === 2 &&
          i.path[0] === 'settings' &&
          i.path[1] === 'financialYearStart',
      );
      expect(fyIssue).toBeDefined();
    });

    it('rejects a settings payload that explicitly sets financialYearStart to null', () => {
      const tool = getRegisteredTool(server, 'update_budget_settings');
      const result = tool.inputSchema!.safeParse({
        role: 'admin',
        buildingId: BUILDING_ID,
        settings: { financialYearStart: null },
      });
      expect(result.success).toBe(false);
      const issues = result.error?.issues ?? [];
      const fyIssue = issues.find(
        (i) =>
          i.path.length === 2 &&
          i.path[0] === 'settings' &&
          i.path[1] === 'financialYearStart',
      );
      expect(fyIssue).toBeDefined();
    });

    it('accepts a settings payload that supplies a valid YYYY-MM-DD financialYearStart', () => {
      const tool = getRegisteredTool(server, 'update_budget_settings');
      const result = tool.inputSchema!.safeParse({
        role: 'admin',
        buildingId: BUILDING_ID,
        settings: { financialYearStart: '2026-01-01' },
      });
      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // 3. MCP `get_budget_settings` always returns a non-null `financialYearStart`.
  // ===========================================================================
  describe('get_budget_settings response shape', () => {
    it('returns a non-null financialYearStart sourced from the building row', async () => {
      const buildingRow = {
        id: BUILDING_ID,
        name: 'FY Get Building',
        organizationId: ORG_ID,
        bankAccountNumber: 'ACCT-FY',
        bankAccountNotes: null,
        bankAccountStartDate: '2024-01-01',
        bankAccountStartAmount: '10000',
        bankAccountMinimums: null,
        generalInflationRate: '2.0',
        revenueInflationRate: '2.0',
        unplannedBillsAmount: '0',
        unplannedBillsStartDate: null,
        // Critical assertion: the column is non-null on the seeded row, and
        // the tool must echo it through unchanged.
        financialYearStart: '2026-01-01',
        bankAccountUpdatedAt: new Date('2024-01-01T00:00:00Z'),
        amenities: {},
      };

      // 1. loadScopedBuilding (orgs + building).
      seedScopedBuildingLookup(buildingRow);
      // 2. bankAccountGetHandler → db.query.buildings.findFirst (full row).
      mockQuery.buildings.findFirst.mockResolvedValueOnce(buildingRow);
      // 3. calculateUnplannedBillsSuggestion: 2 bill selects (empty).
      mockSelectChain.where
        .mockImplementationOnce(() => thenable<unknown[]>([]))
        .mockImplementationOnce(() => thenable<unknown[]>([]));
      // 4. getEarliestBillDate: 1 bill select (empty → no earliestFinancialYear).
      mockSelectChain.where.mockImplementationOnce(() => thenable<unknown[]>([]));
      // 5. investmentsGetHandler → db.query.buildings.findFirst (id only) +
      //    1 select on capital_investments (empty list is fine).
      mockQuery.buildings.findFirst.mockResolvedValueOnce({ id: BUILDING_ID });
      mockSelectChain.where.mockImplementationOnce(() => thenable<unknown[]>([]));

      const handler = getToolHandler(server, 'get_budget_settings');
      const result = await handler({ role: 'admin', buildingId: BUILDING_ID }, {});
      const text = textOf(result);
      expect(text).not.toMatch(/Access denied|not found/i);

      const parsed = JSON.parse(text) as Record<string, unknown>;
      expect(parsed.financialYearStart).toBeDefined();
      expect(parsed.financialYearStart).not.toBeNull();
      expect(parsed.financialYearStart).toBe('2026-01-01');
      expect(typeof parsed.financialYearStart).toBe('string');
      expect(parsed.financialYearStart as string).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
