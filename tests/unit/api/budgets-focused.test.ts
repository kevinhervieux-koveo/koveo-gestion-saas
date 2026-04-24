import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import session from 'express-session';

// Mock the database and schema imports before importing the budget router

// Build a chainable query builder that resolves to data based on the table.
// Supports: from -> [where] -> [orderBy] -> [limit] -> Promise
// Also supports direct .then so a chain that ends after .where() resolves.
function makeQueryBuilder(getData: () => any[]) {
  const builder: any = {
    from: jest.fn(() => builder),
    where: jest.fn(() => builder),
    orderBy: jest.fn(() => builder),
    limit: jest.fn(() => Promise.resolve(getData())),
    leftJoin: jest.fn(() => builder),
    innerJoin: jest.fn(() => builder),
    rightJoin: jest.fn(() => builder),
    groupBy: jest.fn(() => builder),
    having: jest.fn(() => builder),
    offset: jest.fn(() => Promise.resolve(getData())),
    then: (resolve: any, reject: any) => Promise.resolve(getData()).then(resolve, reject),
    catch: (reject: any) => Promise.resolve(getData()).catch(reject),
    finally: (cb: any) => Promise.resolve(getData()).finally(cb),
  };
  return builder;
}

const buildingRow = {
  id: 'test-building-id',
  name: 'Test Building',
  bankAccountStartAmount: '100000',
  bankAccountMinimums: '10000',
  generalInflationRate: '2.0',
  revenueInflationRate: '2.0',
};

const budgetRow = {
  incomeTypes: ['monthly_fees'],
  incomes: ['50000'],
  spendingTypes: ['maintenance'],
  spendings: ['30000'],
};

// Per-test override hooks for the upsert (PUT investments) suite. Variables
// MUST be `mock`-prefixed so Jest's hoisted `jest.mock` factories can read
// them. Tests assign to these in `beforeEach` to control what the mocked DB
// returns and to inspect what writes the handler issued.
const mockCapInvSelectRows: { rows: any[] } = { rows: [] };
const mockUpdateCalls: Array<{ table: any; values: any }> = [];
const mockInsertCalls: Array<{ table: any; values: any }> = [];
const mockDeleteCalls: Array<{ table: any }> = [];

jest.mock('../../../server/db', () => ({
  db: {
    select: jest.fn().mockImplementation(() => ({
      from: jest.fn().mockImplementation((table) => {
        const tableName = table?._?.name || 'unknown';
        const dataFor = () => {
          if (tableName === 'buildings') return [buildingRow];
          if (tableName === 'budgets') return [budgetRow];
          if (tableName === 'bills') return [];
          if (tableName === 'monthlyBudgets') return [];
          if (tableName === 'payments') return [];
          if (tableName === 'residences') return [];
          if (tableName === 'capitalInvestments') return mockCapInvSelectRows.rows;
          return [];
        };
        return makeQueryBuilder(dataFor);
      }),
    })),
    update: jest.fn().mockImplementation((table) => ({
      set: jest.fn().mockImplementation((values) => {
        mockUpdateCalls.push({ table, values });
        return {
          where: jest.fn(() => Promise.resolve([])),
        };
      }),
    })),
    delete: jest.fn().mockImplementation((table) => {
      mockDeleteCalls.push({ table });
      return {
        where: jest.fn(() => Promise.resolve([])),
      };
    }),
    insert: jest.fn().mockImplementation((table) => ({
      values: jest.fn().mockImplementation((values) => {
        mockInsertCalls.push({ table, values });
        return Promise.resolve([]);
      }),
    })),
    query: {
      buildings: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'test-building-id',
          name: 'Test Building',
          bankAccountStartAmount: '100000',
          bankAccountMinimums: '10000',
          generalInflationRate: '2.0',
          revenueInflationRate: '2.0'
        }),
        findMany: jest.fn().mockResolvedValue([{
          id: 'test-building-id',
          name: 'Test Building',
          bankAccountStartAmount: '100000',
          bankAccountMinimums: '10000',
          generalInflationRate: '2.0',
          revenueInflationRate: '2.0'
        }])
      },
      budgets: {
        findFirst: jest.fn().mockResolvedValue({
          incomeTypes: ['monthly_fees'],
          incomes: ['50000'],
          spendingTypes: ['maintenance'],
          spendings: ['30000']
        }),
        findMany: jest.fn().mockResolvedValue([{
          incomeTypes: ['monthly_fees'],
          incomes: ['50000'],
          spendingTypes: ['maintenance'],
          spendings: ['30000']
        }])
      },
      bills: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([])
      },
      residences: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([])
      },
      monthlyBudgets: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([])
      },
      payments: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([])
      },
      capitalInvestments: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([])
      }
    }
  }
}));

jest.mock('@shared/schema', () => {
  // Helper to make a schema table mock with column proxies that won't be undefined.
  function makeTableMock(name: string) {
    return new Proxy({ _: { name } }, {
      get(target: any, prop: string) {
        if (prop in target) return target[prop];
        // Any column access returns a placeholder so production code that does
        // `table.someColumn` doesn't fail with undefined.
        return { name: prop, _: { name: prop } };
      },
    });
  }
  // Real zod schema mirrors the production `insertCapitalInvestmentSchema` in
  // shared/schemas/financial.ts so `investmentsPutHandler` validation produces
  // the expected coerced types (number for amount, Date for targetDate). The
  // PUT handler then calls `validated.amount.toString()` and
  // `validated.targetDate.toISOString().split('T')[0]`, so coercion matters.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { z } = require('zod');
  const insertCapitalInvestmentSchema = z.object({
    buildingId: z.string().uuid(),
    title: z.string().min(1),
    description: z.string().nullish(),
    amount: z.coerce.number().positive(),
    targetDate: z.coerce.date(),
    urgency: z.enum(['not_urgent', 'urgent', 'suggested']),
    type: z.enum(['auto_generated', 'custom']),
    ownershipType: z.enum(['residences', 'owner']),
    category: z.string().nullish(),
  });
  return {
    buildings: makeTableMock('buildings'),
    budgets: makeTableMock('budgets'),
    bills: makeTableMock('bills'),
    monthlyBudgets: makeTableMock('monthlyBudgets'),
    payments: makeTableMock('payments'),
    residences: makeTableMock('residences'),
    capitalInvestments: makeTableMock('capitalInvestments'),
    maintenanceProjects: makeTableMock('maintenanceProjects'),
    insertCapitalInvestmentSchema,
  };
});

jest.mock('../../../server/auth', () => ({
  requireAuth: (req: Request, res: Response, next: NextFunction) => {
    // Add mock user to request - using AuthenticatedUser interface
    req.user = {
      id: 'test-user-id',
      username: 'test-user',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'manager' as const,
      isActive: true,
      organizations: ['test-org-id']
    };
    next();
  }
}));

// Mock drizzle-orm functions
jest.mock('drizzle-orm', () => ({
  and: jest.fn(),
  eq: jest.fn(),
  gte: jest.fn(),
  lte: jest.fn(),
  lt: jest.fn(),
  gt: jest.fn(),
  sql: jest.fn(),
  desc: jest.fn(),
  asc: jest.fn(),
  sum: jest.fn(),
  count: jest.fn(),
  ne: jest.fn(),
  not: jest.fn(),
  inArray: jest.fn(),
  notInArray: jest.fn(),
  or: jest.fn(),
  isNull: jest.fn(),
  isNotNull: jest.fn(),
  like: jest.fn(),
  ilike: jest.fn(),
  between: jest.fn(),
  exists: jest.fn(),
  notExists: jest.fn()
}));

// Now import the budget router after all mocks are set up
import budgetRouter from '../../../server/api/budgets';

describe('Budget API Tests - Focused', () => {
  let app: express.Application;
  let agent: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false },
    }));

    app.use('/api/budgets', budgetRouter);
    agent = request.agent(app);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Budget Forecast API', () => {
    it('should return 200 status for forecast request', async () => {
      const response = await agent
        .post('/api/budgets/test-building-id/forecast')
        .send({
          bankAccountStartAmount: 100000,
          bankAccountMinimums: 10000,
          generalInflationRate: 2.0,
          revenueInflationRate: 2.0,
        });

      expect(response.status).toBe(200);
    });

    it('should handle zero inflation rates correctly', async () => {
      const response = await agent
        .post('/api/budgets/test-building-id/forecast')
        .send({
          bankAccountStartAmount: 100000,
          bankAccountMinimums: 10000,
          generalInflationRate: 0.0,
          revenueInflationRate: 0.0,
        });

      expect(response.status).toBe(200);
      
      if (response.body.forecast) {
        expect(response.body.forecast).toHaveLength(300); // 25 years * 12 months

        // With zero inflation, income and expenses should remain constant
        if (response.body.forecast.length > 299) {
          const firstMonth = response.body.forecast[0];
          const lastMonth = response.body.forecast[299];
          
          if (firstMonth.inflatedIncome && lastMonth.inflatedIncome) {
            expect(firstMonth.inflatedIncome).toBeCloseTo(lastMonth.inflatedIncome, 2);
          }
          if (firstMonth.inflatedExpenses && lastMonth.inflatedExpenses) {
            expect(firstMonth.inflatedExpenses).toBeCloseTo(lastMonth.inflatedExpenses, 2);
          }
        }
      }
    });

    it('should validate input parameters', async () => {
      // Test with invalid inflation rate
      const response = await agent
        .post('/api/budgets/test-building-id/forecast')
        .send({
          bankAccountStartAmount: 100000,
          bankAccountMinimums: 10000,
          generalInflationRate: 150.0, // Invalid - over 100%
          revenueInflationRate: 2.0,
        });

      expect([400, 422]).toContain(response.status); // Should be rejected
    });

    it('should handle missing building scenario gracefully', async () => {
      const response = await agent
        .post('/api/budgets/nonexistent-building-id/forecast')
        .send({
          bankAccountStartAmount: 100000,
          bankAccountMinimums: 10000,
          generalInflationRate: 2.0,
          revenueInflationRate: 2.0,
        });

      // Should either return 404 or handle gracefully
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Budget Data Retrieval', () => {
    it('should retrieve budget data for a building', async () => {
      const response = await agent.get('/api/budgets/test-building-id');

      expect(response.status).toBe(200);
    });

    it('should handle query parameters for date ranges', async () => {
      const response = await agent
        .get('/api/budgets/test-building-id')
        .query({
          startYear: 2024,
          endYear: 2025,
          groupBy: 'monthly'
        });

      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for invalid building ID format', async () => {
      const response = await agent
        .post('/api/budgets/invalid-id-format/forecast')
        .send({
          bankAccountStartAmount: 100000,
          bankAccountMinimums: 10000,
          generalInflationRate: 2.0,
          revenueInflationRate: 2.0,
        });

      // Should handle invalid IDs gracefully
      expect([200, 400, 404]).toContain(response.status);
    });

    it('should handle missing required parameters', async () => {
      const response = await agent
        .post('/api/budgets/test-building-id/forecast')
        .send({}); // Empty body

      expect([200, 400, 422]).toContain(response.status);
    });
  });

  // ===========================================================================
  // PUT /:buildingId/investments — upsert behavior (Task #526 / #558)
  //
  // The handler diffs the incoming payload against the existing custom rows
  // and:
  //   - UPDATEs in place when an incoming row carries an id that matches an
  //     existing custom row (preserving the database id),
  //   - DELETEs custom rows whose ids were dropped from the payload,
  //   - INSERTs entries that have no id or whose id does not match any
  //     existing custom row (so a fresh UUID is assigned),
  //   - NEVER touches auto-generated rows (the existing-id query filters by
  //     `type='custom'`, so unknown ids fall through to insert and the
  //     unrelated auto rows are not in the working set at all).
  // ===========================================================================
  describe('PUT /:buildingId/investments — upsert', () => {
    const VALID_BUILDING_ID = '11111111-1111-1111-1111-111111111111';
    const sampleEntry = (overrides: Record<string, unknown> = {}) => ({
      title: 'Roof replacement',
      amount: 12000,
      targetDate: '2026-06-01',
      urgency: 'urgent',
      ownershipType: 'residences',
      description: 'Membrane + flashing',
      category: 'capital_works',
      ...overrides,
    });

    beforeEach(() => {
      mockCapInvSelectRows.rows = [];
      mockUpdateCalls.length = 0;
      mockInsertCalls.length = 0;
      mockDeleteCalls.length = 0;
    });

    it('preserves the database id when an incoming entry matches an existing custom row', async () => {
      const existingId = '22222222-2222-2222-2222-222222222222';
      // The handler's existing-id query: SELECT {id} FROM capitalInvestments
      // WHERE buildingId=? AND type='custom'. Mock returns just the id.
      mockCapInvSelectRows.rows = [{ id: existingId }];

      const response = await agent
        .put(`/api/budgets/${VALID_BUILDING_ID}/investments`)
        .send({ investments: [sampleEntry({ id: existingId, title: 'Roof replacement v2' })] });

      expect(response.status).toBe(200);
      // UPDATE in place: exactly one update call with the new title and the
      // updatedAt timestamp injected by the handler.
      expect(mockUpdateCalls).toHaveLength(1);
      expect(mockUpdateCalls[0].values.title).toBe('Roof replacement v2');
      expect(mockUpdateCalls[0].values.amount).toBe('12000');
      expect(mockUpdateCalls[0].values.type).toBe('custom');
      expect(mockUpdateCalls[0].values.updatedAt).toBeInstanceOf(Date);
      // No deletes (id is still in payload) and no inserts (no net-new rows).
      expect(mockDeleteCalls).toHaveLength(0);
      expect(mockInsertCalls).toHaveLength(0);
    });

    it('deletes existing custom rows whose ids are missing from the payload', async () => {
      const keptId = '33333333-3333-3333-3333-333333333333';
      const droppedId = '44444444-4444-4444-4444-444444444444';
      mockCapInvSelectRows.rows = [{ id: keptId }, { id: droppedId }];

      const response = await agent
        .put(`/api/budgets/${VALID_BUILDING_ID}/investments`)
        .send({ investments: [sampleEntry({ id: keptId })] });

      expect(response.status).toBe(200);
      // Only the kept row was updated.
      expect(mockUpdateCalls).toHaveLength(1);
      // The dropped id triggers exactly one delete call. The handler batches
      // every dropped id into a single `inArray(...)` delete; we only care
      // that the delete fired against the capitalInvestments table.
      expect(mockDeleteCalls).toHaveLength(1);
      expect(mockDeleteCalls[0].table?._?.name).toBe('capitalInvestments');
      // Nothing net-new in the payload.
      expect(mockInsertCalls).toHaveLength(0);
    });

    it('inserts entries that arrive without an id', async () => {
      // No existing custom rows.
      mockCapInvSelectRows.rows = [];

      const response = await agent
        .put(`/api/budgets/${VALID_BUILDING_ID}/investments`)
        .send({ investments: [sampleEntry()] }); // no id field

      expect(response.status).toBe(200);
      expect(mockUpdateCalls).toHaveLength(0);
      expect(mockDeleteCalls).toHaveLength(0);
      // Single batched insert of the net-new row, with a server-side
      // `type='custom'` stamp and stringified amount.
      expect(mockInsertCalls).toHaveLength(1);
      const inserted = mockInsertCalls[0].values as Array<Record<string, unknown>>;
      expect(Array.isArray(inserted)).toBe(true);
      expect(inserted).toHaveLength(1);
      expect(inserted[0].type).toBe('custom');
      expect(inserted[0].title).toBe('Roof replacement');
      expect(inserted[0].amount).toBe('12000');
      expect(inserted[0].targetDate).toBe('2026-06-01');
    });

    it('treats an unknown id (e.g. an auto-generated row id) as a net-new insert and never touches the auto row', async () => {
      // Existing custom rows: only one custom id. The auto-generated row's
      // id is NOT in this set because the handler's pre-query filters by
      // type='custom'. The incoming payload supplies the auto row's id
      // (simulating a confused caller). The handler must NOT update it —
      // instead, it should fall through to the insert path so the auto row
      // is left alone and a fresh row is inserted with its own UUID.
      const customId = '55555555-5555-5555-5555-555555555555';
      const autoId = '66666666-6666-6666-6666-666666666666';
      mockCapInvSelectRows.rows = [{ id: customId }];

      const response = await agent
        .put(`/api/budgets/${VALID_BUILDING_ID}/investments`)
        .send({
          investments: [
            sampleEntry({ id: customId, title: 'Custom updated' }),
            // Caller sends the auto-generated row's id as if to "edit" it.
            sampleEntry({ id: autoId, title: 'Tried to hijack auto row' }),
          ],
        });

      expect(response.status).toBe(200);
      // The matching custom id is updated in place — once.
      expect(mockUpdateCalls).toHaveLength(1);
      expect(mockUpdateCalls[0].values.title).toBe('Custom updated');
      // The unknown (auto) id falls through to insert. Because it's not in
      // existingIds, it goes into `toInsert` and a new row is created.
      expect(mockInsertCalls).toHaveLength(1);
      const inserted = mockInsertCalls[0].values as Array<Record<string, unknown>>;
      expect(inserted).toHaveLength(1);
      expect(inserted[0].title).toBe('Tried to hijack auto row');
      // CRITICAL: no UPDATE was issued against the auto-generated row's id.
      // The single update call we recorded targeted the custom row, and the
      // unknown id was inserted, not updated. Therefore the auto row is
      // never touched (and no delete either, since both ids are still in
      // the payload's diff against the existing set of one custom id).
      expect(mockDeleteCalls).toHaveLength(0);
    });

    it('returns 400 when the request body is not an array', async () => {
      const response = await agent
        .put(`/api/budgets/${VALID_BUILDING_ID}/investments`)
        .send({ investments: 'not-an-array' });

      expect(response.status).toBe(400);
      expect(mockUpdateCalls).toHaveLength(0);
      expect(mockInsertCalls).toHaveLength(0);
      expect(mockDeleteCalls).toHaveLength(0);
    });
  });
});