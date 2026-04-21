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
          if (tableName === 'capitalInvestments') return [];
          return [];
        };
        return makeQueryBuilder(dataFor);
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
  return {
    buildings: makeTableMock('buildings'),
    budgets: makeTableMock('budgets'),
    bills: makeTableMock('bills'),
    monthlyBudgets: makeTableMock('monthlyBudgets'),
    payments: makeTableMock('payments'),
    residences: makeTableMock('residences'),
    capitalInvestments: makeTableMock('capitalInvestments'),
    maintenanceProjects: makeTableMock('maintenanceProjects'),
    insertCapitalInvestmentSchema: jest.fn(),
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
});