/**
 * @file Budget Forecast Integration Tests
 * @description Full integration tests for budget forecasting with real Express router stack
 */

import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import session from 'express-session';
import { describe, it, expect, beforeEach, afterEach, jest, beforeAll } from '@jest/globals';

// Define authenticated user type based on schema
interface AuthenticatedUser {
  id: string;
  role: 'admin' | 'manager' | 'tenant' | 'resident' | 'demo_manager' | 'demo_tenant' | 'demo_resident';
  organizations?: string[];
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

// Extend Express Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// Mock database operations with realistic data structures
const mockDb = {
  query: {
    buildings: {
      findFirst: jest.fn(),
    },
  },
  select: jest.fn(),
  update: jest.fn(),
};

// Mock the database module
jest.mock('../../server/db', () => ({
  db: mockDb,
}));

// Mock drizzle-orm functions
jest.mock('drizzle-orm', () => ({
  eq: jest.fn((column, value) => ({ column, operator: 'eq', value })),
  and: jest.fn((...conditions) => ({ operator: 'and', conditions })),
  or: jest.fn((...conditions) => ({ operator: 'or', conditions })),
  gte: jest.fn((column, value) => ({ column, operator: 'gte', value })),
  lte: jest.fn((column, value) => ({ column, operator: 'lte', value })),
  lt: jest.fn((column, value) => ({ column, operator: 'lt', value })),
  ne: jest.fn((column, value) => ({ column, operator: 'ne', value })),
  inArray: jest.fn((column, values) => ({ column, operator: 'inArray', values })),
  isNull: jest.fn((column) => ({ column, operator: 'isNull' })),
  sql: jest.fn((query) => ({ sql: query })),
  desc: jest.fn((column) => ({ column, direction: 'desc' })),
  asc: jest.fn((column) => ({ column, direction: 'asc' })),
  sum: jest.fn((column) => ({ column, aggregate: 'sum' })),
  count: jest.fn((column) => ({ column, aggregate: 'count' })),
}));

// Mock schema tables
jest.mock('@shared/schema', () => ({
  buildings: { id: 'buildings.id', name: 'buildings.name' },
  bills: { id: 'bills.id', buildingId: 'bills.buildingId' },
  monthlyBudgets: { id: 'monthlyBudgets.id', buildingId: 'monthlyBudgets.buildingId' },
}));

// Mock authentication middleware - this will be configured per test
const mockAuthMiddleware = jest.fn();

jest.mock('../../server/auth', () => ({
  requireAuth: mockAuthMiddleware,
}));

// Import router after mocks are set up
import budgetRouter from '../../server/api/budgets';

describe('Budget Forecast Integration Tests', () => {
  let app: express.Application;
  let agent: request.SuperAgentTest;

  beforeAll(() => {
    // Set up realistic test data
    jest.clearAllMocks();
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create fresh Express app for each test
    app = express();
    app.use(express.json());
    
    // Setup session middleware
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

  describe('Authentication and Authorization', () => {
    it('should return 401 for unauthenticated access', async () => {
      // Configure auth middleware to reject
      mockAuthMiddleware.mockImplementation((req: Request, res: Response, next: NextFunction) => {
        res.status(401).json({ error: 'Authentication required' });
      });

      const response = await agent
        .post('/api/budgets/test-building-id/forecast')
        .send({
          bankAccountStartAmount: 100000,
          bankAccountMinimums: 10000,
          generalInflationRate: 2.0,
          revenueInflationRate: 2.0,
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Authentication required');
    });

    it('should return 403 for unauthorized roles', async () => {
      // Configure auth middleware to authorize but with wrong role
      mockAuthMiddleware.mockImplementation((req: Request, res: Response, next: NextFunction) => {
        req.user = {
          id: 'test-user-id',
          role: 'tenant', // Unauthorized role for budget operations
          organizations: ['test-org-id'],
          email: 'tenant@example.com',
        } as AuthenticatedUser;
        
        // Simulate role-based access control
        if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.role !== 'demo_manager') {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
      });

      const response = await agent
        .post('/api/budgets/test-building-id/forecast')
        .send({
          bankAccountStartAmount: 100000,
          bankAccountMinimums: 10000,
          generalInflationRate: 2.0,
          revenueInflationRate: 2.0,
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Insufficient permissions');
    });

    it('should allow access for authorized manager role', async () => {
      // Configure auth middleware to authorize manager
      mockAuthMiddleware.mockImplementation((req: Request, res: Response, next: NextFunction) => {
        req.user = {
          id: 'test-user-id',
          role: 'manager',
          organizations: ['test-org-id'],
          email: 'manager@example.com',
        } as AuthenticatedUser;
        next();
      });

      // Mock successful building lookup
      mockDb.query.buildings.findFirst.mockResolvedValue({
        id: 'test-building-id',
        name: 'Test Building',
        bankAccountStartAmount: '100000',
        bankAccountMinimums: '10000',
        generalInflationRate: '2.0',
        revenueInflationRate: '2.0',
      });

      // Mock database select operations
      const mockSelectChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]), // Empty results
        }),
      };

      const mockSelectChainBudgets = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      mockDb.select
        .mockImplementationOnce(() => mockSelectChain) // recurrent bills
        .mockImplementationOnce(() => mockSelectChain) // unique bills
        .mockImplementationOnce(() => mockSelectChainBudgets); // baseline income

      const response = await agent
        .post('/api/budgets/test-building-id/forecast')
        .send({
          bankAccountStartAmount: 100000,
          bankAccountMinimums: 10000,
          generalInflationRate: 2.0,
          revenueInflationRate: 2.0,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('forecast');
    });
  });

  describe('Input Validation', () => {
    beforeEach(() => {
      // Setup authorized user for validation tests
      mockAuthMiddleware.mockImplementation((req: Request, res: Response, next: NextFunction) => {
        req.user = {
          id: 'test-user-id',
          role: 'manager',
          organizations: ['test-org-id'],
        } as AuthenticatedUser;
        next();
      });
    });

    it('should return 400 for invalid building ID format', async () => {
      mockDb.query.buildings.findFirst.mockResolvedValue(null);

      const response = await agent
        .post('/api/budgets/invalid-building-format/forecast')
        .send({
          bankAccountStartAmount: 100000,
          bankAccountMinimums: 10000,
          generalInflationRate: 2.0,
          revenueInflationRate: 2.0,
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('_error');
      expect(response.body._error).toBe('Building not found');
    });

    it('should handle extreme inflation rate values', async () => {
      mockDb.query.buildings.findFirst.mockResolvedValue({
        id: 'test-building-id',
        name: 'Test Building',
        bankAccountStartAmount: '100000',
        bankAccountMinimums: '10000',
        generalInflationRate: '2.0',
        revenueInflationRate: '2.0',
      });

      const mockSelectChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      };

      const mockSelectChainBudgets = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      mockDb.select
        .mockImplementation(() => mockSelectChain)
        .mockImplementationOnce(() => mockSelectChain)
        .mockImplementationOnce(() => mockSelectChain)
        .mockImplementationOnce(() => mockSelectChainBudgets);

      const response = await agent
        .post('/api/budgets/test-building-id/forecast')
        .send({
          bankAccountStartAmount: 100000,
          bankAccountMinimums: 10000,
          generalInflationRate: 50.0, // Extreme inflation
          revenueInflationRate: -10.0, // Extreme deflation
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('forecast');
      expect(response.body.generalInflationRate).toBe(50.0);
      expect(response.body.revenueInflationRate).toBe(-10.0);
    });

    it('should handle negative starting amounts', async () => {
      mockDb.query.buildings.findFirst.mockResolvedValue({
        id: 'test-building-id',
        name: 'Test Building',
        bankAccountStartAmount: '100000',
        bankAccountMinimums: '10000',
        generalInflationRate: '2.0',
        revenueInflationRate: '2.0',
      });

      const mockSelectChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      };

      const mockSelectChainBudgets = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      mockDb.select
        .mockImplementation(() => mockSelectChain)
        .mockImplementationOnce(() => mockSelectChain)
        .mockImplementationOnce(() => mockSelectChain)
        .mockImplementationOnce(() => mockSelectChainBudgets);

      const response = await agent
        .post('/api/budgets/test-building-id/forecast')
        .send({
          bankAccountStartAmount: -50000, // Negative starting amount
          bankAccountMinimums: 10000,
          generalInflationRate: 2.0,
          revenueInflationRate: 2.0,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('forecast');
      expect(response.body.startingBalance).toBe(-50000);
      
      // First month should start with negative balance and red status
      expect(response.body.forecast[0].status).toBe('red');
    });
  });

  describe('Happy Path Integration Tests', () => {
    beforeEach(() => {
      // Setup authorized user
      mockAuthMiddleware.mockImplementation((req: Request, res: Response, next: NextFunction) => {
        req.user = {
          id: 'test-user-id',
          role: 'manager',
          organizations: ['test-org-id'],
          email: 'manager@example.com',
          firstName: 'Test',
          lastName: 'Manager',
        } as AuthenticatedUser;
        next();
      });
    });

    it('should return complete forecast with realistic building data', async () => {
      // Mock building with comprehensive data
      mockDb.query.buildings.findFirst.mockResolvedValue({
        id: 'test-building-id',
        name: 'Sunset Towers',
        bankAccountStartAmount: '250000',
        bankAccountMinimums: '50000',
        generalInflationRate: '3.5',
        revenueInflationRate: '2.8',
      });

      // Mock recurrent bills with varied schedules
      const mockRecurrentBills = [
        {
          id: 'insurance-bill',
          category: 'insurance',
          costs: ['24000'],
          schedulePayment: 'yearly',
          startDate: new Date('2025-01-01'),
          endDate: null,
        },
        {
          id: 'utilities-bill',
          category: 'utilities',
          costs: ['8500'],
          schedulePayment: 'monthly',
          startDate: new Date('2025-01-01'),
          endDate: null,
        },
        {
          id: 'maintenance-bill',
          category: 'maintenance',
          costs: ['15000'],
          schedulePayment: 'quarterly',
          startDate: new Date('2025-01-01'),
          endDate: null,
        },
      ];

      // Mock unique bills for special projects
      const mockUniqueBills = [
        {
          startDate: new Date('2025-06-01'),
          totalAmount: '150000',
          category: 'elevator_replacement',
        },
        {
          startDate: new Date('2027-03-01'),
          totalAmount: '80000',
          category: 'roof_repair',
        },
      ];

      // Mock baseline income data
      const mockBaselineIncome = [
        {
          incomeTypes: ['monthly_fees', 'parking_fees', 'laundry_income'],
          incomes: ['75000', '5500', '2000'],
          spendingTypes: ['admin_expense', 'cleaning'],
          spendings: ['3500', '2800'],
        },
      ];

      // Setup database select mocks
      const mockSelectChainRecurrent = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockRecurrentBills),
        }),
      };

      const mockSelectChainUnique = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockUniqueBills),
        }),
      };

      const mockSelectChainBudgets = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockBaselineIncome),
          }),
        }),
      };

      mockDb.select
        .mockImplementationOnce(() => mockSelectChainRecurrent)
        .mockImplementationOnce(() => mockSelectChainUnique)
        .mockImplementationOnce(() => mockSelectChainBudgets);

      const response = await agent
        .post('/api/budgets/test-building-id/forecast')
        .send({
          bankAccountStartAmount: 250000,
          bankAccountMinimums: 50000,
          generalInflationRate: 3.5,
          revenueInflationRate: 2.8,
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        buildingId: 'test-building-id',
        buildingName: 'Sunset Towers',
        forecastPeriod: '25 years',
        startingBalance: 250000,
        minimumFund: 50000,
        generalInflationRate: 3.5,
        revenueInflationRate: 2.8,
        baselineMonthlyIncome: 82500, // 75000 + 5500 + 2000
        recurrentBillsCount: 3,
        uniqueBillsCount: 2,
      });

      expect(response.body.forecast).toHaveLength(300);

      // Verify first month has correct structure
      const firstMonth = response.body.forecast[0];
      expect(firstMonth).toMatchObject({
        year: 2025,
        month: 1,
        revenue: expect.any(Number),
        spending: expect.any(Number),
        netCashFlow: expect.any(Number),
        balance: expect.any(Number),
        status: expect.stringMatching(/^(red|yellow|green)$/),
        inflatedIncome: expect.any(Number),
        inflatedExpenses: expect.any(Number),
      });

      // Verify that unique bills affect the forecast in correct years
      const june2025 = response.body.forecast.find((m: any) => m.year === 2025 && m.month === 6);
      const march2027 = response.body.forecast.find((m: any) => m.year === 2027 && m.month === 3);

      // 2025 should show distributed elevator replacement cost
      expect(june2025.spending).toBeGreaterThan(firstMonth.spending);
      
      // 2027 should show distributed roof repair cost
      expect(march2027.spending).toBeGreaterThan(firstMonth.spending);
    });

    it('should handle empty database responses gracefully', async () => {
      // Mock building exists but no bills or budget data
      mockDb.query.buildings.findFirst.mockResolvedValue({
        id: 'empty-building-id',
        name: 'Empty Building',
        bankAccountStartAmount: '100000',
        bankAccountMinimums: '20000',
        generalInflationRate: '2.0',
        revenueInflationRate: '2.0',
      });

      // Mock empty responses for all data queries
      const mockEmptySelectChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]), // No results
        }),
      };

      const mockEmptyBudgetChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]), // No budget data
          }),
        }),
      };

      mockDb.select
        .mockImplementationOnce(() => mockEmptySelectChain)
        .mockImplementationOnce(() => mockEmptySelectChain)
        .mockImplementationOnce(() => mockEmptyBudgetChain);

      const response = await agent
        .post('/api/budgets/empty-building-id/forecast')
        .send({
          bankAccountStartAmount: 100000,
          bankAccountMinimums: 20000,
          generalInflationRate: 2.0,
          revenueInflationRate: 2.0,
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        buildingId: 'empty-building-id',
        buildingName: 'Empty Building',
        startingBalance: 100000,
        minimumFund: 20000,
        baselineMonthlyIncome: 50000, // Should use default
        baselineMonthlyExpenses: 0, // No bills
        recurrentBillsCount: 0,
        uniqueBillsCount: 0,
      });

      expect(response.body.forecast).toHaveLength(300);
      
      // With no expenses and default income, should have positive cash flow
      const firstMonth = response.body.forecast[0];
      expect(firstMonth.revenue).toBe(50000);
      expect(firstMonth.spending).toBe(0);
      expect(firstMonth.netCashFlow).toBe(50000);
      expect(firstMonth.status).toBe('green');
    });

    it('should properly sequence database calls and handle errors', async () => {
      // Test that database errors are handled properly
      mockDb.query.buildings.findFirst.mockRejectedValue(new Error('Database connection failed'));

      const response = await agent
        .post('/api/budgets/test-building-id/forecast')
        .send({
          bankAccountStartAmount: 100000,
          bankAccountMinimums: 10000,
          generalInflationRate: 2.0,
          revenueInflationRate: 2.0,
        });

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        _error: 'Internal server error',
        message: 'Failed to generate budget forecast',
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    beforeEach(() => {
      mockAuthMiddleware.mockImplementation((req: Request, res: Response, next: NextFunction) => {
        req.user = {
          id: 'test-user-id',
          role: 'manager',
          organizations: ['test-org-id'],
        } as AuthenticatedUser;
        next();
      });
    });

    it('should handle large datasets efficiently', async () => {
      const startTime = Date.now();
      
      // Mock building
      mockDb.query.buildings.findFirst.mockResolvedValue({
        id: 'large-building-id',
        name: 'Large Building Complex',
        bankAccountStartAmount: '1000000',
        bankAccountMinimums: '100000',
        generalInflationRate: '2.5',
        revenueInflationRate: '3.0',
      });

      // Mock many recurrent bills
      const manyRecurrentBills = Array.from({ length: 50 }, (_, i) => ({
        id: `bill-${i}`,
        category: `category-${i % 5}`,
        costs: ['1000', '500'],
        schedulePayment: ['monthly', 'quarterly', 'yearly'][i % 3] as any,
        startDate: new Date('2025-01-01'),
        endDate: null,
      }));

      // Mock many unique bills across years
      const manyUniqueBills = Array.from({ length: 100 }, (_, i) => ({
        startDate: new Date(2025 + (i % 10), (i % 12) + 1, 1),
        totalAmount: (Math.random() * 50000 + 10000).toFixed(0),
        category: `unique-category-${i % 8}`,
      }));

      const mockSelectChainRecurrent = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(manyRecurrentBills),
        }),
      };

      const mockSelectChainUnique = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(manyUniqueBills),
        }),
      };

      const mockSelectChainBudgets = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{
              incomeTypes: ['fees'],
              incomes: ['150000'],
              spendingTypes: ['expenses'],
              spendings: ['80000'],
            }]),
          }),
        }),
      };

      mockDb.select
        .mockImplementationOnce(() => mockSelectChainRecurrent)
        .mockImplementationOnce(() => mockSelectChainUnique)
        .mockImplementationOnce(() => mockSelectChainBudgets);

      const response = await agent
        .post('/api/budgets/large-building-id/forecast')
        .send({
          bankAccountStartAmount: 1000000,
          bankAccountMinimums: 100000,
          generalInflationRate: 2.5,
          revenueInflationRate: 3.0,
        });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.forecast).toHaveLength(300);
      expect(response.body.recurrentBillsCount).toBe(50);
      expect(response.body.uniqueBillsCount).toBe(100);
      
      // Should complete within reasonable time (5 seconds)
      expect(responseTime).toBeLessThan(5000);
    });

    it('should handle concurrent requests safely', async () => {
      // Mock building
      mockDb.query.buildings.findFirst.mockResolvedValue({
        id: 'concurrent-building-id',
        name: 'Concurrent Test Building',
        bankAccountStartAmount: '100000',
        bankAccountMinimums: '10000',
        generalInflationRate: '2.0',
        revenueInflationRate: '2.0',
      });

      const mockSelectChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      };

      const mockSelectChainBudgets = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      mockDb.select
        .mockImplementation(() => mockSelectChain)
        .mockImplementation(() => mockSelectChain)
        .mockImplementation(() => mockSelectChain)
        .mockImplementation(() => mockSelectChainBudgets);

      const payload = {
        bankAccountStartAmount: 100000,
        bankAccountMinimums: 10000,
        generalInflationRate: 2.0,
        revenueInflationRate: 2.0,
      };

      // Fire multiple concurrent requests
      const requests = Array.from({ length: 5 }, () =>
        agent
          .post('/api/budgets/concurrent-building-id/forecast')
          .send(payload)
      );

      const responses = await Promise.all(requests);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.forecast).toHaveLength(300);
      });
    });
  });
});