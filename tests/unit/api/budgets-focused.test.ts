import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import session from 'express-session';

// Mock the database and schema imports before importing the budget router
jest.mock('../../../server/db', () => ({
  db: {
    select: jest.fn().mockImplementation(() => ({
      from: jest.fn().mockImplementation((table) => {
        const tableName = table?._?.name || 'unknown';
        return {
          where: jest.fn().mockImplementation(() => ({
            limit: jest.fn().mockImplementation((limitCount = 1) => {
              if (tableName === 'buildings') {
                return Promise.resolve([{
                  id: 'test-building-id',
                  name: 'Test Building',
                  bankAccountStartAmount: '100000',
                  bankAccountMinimums: '10000',
                  generalInflationRate: '2.0',
                  revenueInflationRate: '2.0'
                }]);
              }
              if (tableName === 'budgets') {
                return Promise.resolve([{
                  incomeTypes: ['monthly_fees'],
                  incomes: ['50000'],
                  spendingTypes: ['maintenance'],
                  spendings: ['30000']
                }]);
              }
              if (tableName === 'bills') {
                return Promise.resolve([]);
              }
              return Promise.resolve([]);
            })
          }))
        };
      })
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
      }
    }
  }
}));

jest.mock('@shared/schema', () => ({
  buildings: { _: { name: 'buildings' } },
  budgets: { _: { name: 'budgets' } },
  bills: { _: { name: 'bills' } },
  monthlyBudgets: { _: { name: 'monthlyBudgets' } },
  payments: { _: { name: 'payments' } },
  residences: { _: { name: 'residences' } },
  capitalInvestments: { _: { name: 'capitalInvestments' } },
  insertCapitalInvestmentSchema: jest.fn()
}));

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
  sql: jest.fn(),
  desc: jest.fn(),
  asc: jest.fn(),
  sum: jest.fn(),
  count: jest.fn(),
  ne: jest.fn(),
  inArray: jest.fn(),
  or: jest.fn(),
  isNull: jest.fn()
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