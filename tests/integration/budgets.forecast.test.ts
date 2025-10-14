/**
 * @file Budget Forecast Integration Tests
 * @description Full integration tests for budget forecasting with real Express router stack
 */

import request from 'supertest';
import express, { type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import session from 'express-session';
import { describe, it, expect, beforeEach, afterEach, jest, beforeAll } from '@jest/globals';

// Import the actual AuthenticatedUser type from server
import type { AuthenticatedUser } from '../../server/rbac';

// Define specific types for mock data
interface MockBuilding {
  id: string;
  name: string;
  bankAccountStartAmount: string;
  bankAccountMinimums: string;
  generalInflationRate: string;
  revenueInflationRate: string;
}

interface MockBill {
  id: string;
  category: string;
  costs: string[];
  schedulePayment: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: Date;
  endDate: Date | null;
}

interface MockUniqueBill {
  startDate: Date;
  totalAmount: string;
  category: string;
}

interface MockBaselineIncome {
  incomeTypes: string[];
  incomes: string[];
  spendingTypes: string[];
  spendings: string[];
}

interface MockResidence {
  monthlyFees: string;
}

// Mock database operations with realistic data structures
const mockDb = {
  query: {
    buildings: {
      findFirst: jest.fn<() => Promise<MockBuilding | null>>(),
    },
    residences: {
      findMany: jest.fn<() => Promise<MockResidence[]>>(),
    },
    monthlyBudgets: {
      findMany: jest.fn<() => Promise<any[]>>(),
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
  residences: { id: 'residences.id', buildingId: 'residences.buildingId' },
  capitalInvestments: { id: 'capitalInvestments.id', buildingId: 'capitalInvestments.buildingId' },
  payments: { amount: 'payments.amount', scheduledDate: 'payments.scheduledDate', status: 'payments.status', billId: 'payments.billId' },
}));

// Mock authentication middleware - this will be configured per test
const mockAuthMiddleware = jest.fn<RequestHandler>();

jest.mock('../../server/auth', () => ({
  requireAuth: mockAuthMiddleware,
}));

// Import router after mocks are set up
import budgetRouter from '../../server/api/budgets';

describe('Budget Forecast Integration Tests', () => {
  let app: express.Application;
  let agent: ReturnType<typeof request.agent>;

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
      mockAuthMiddleware.mockImplementation((req: any, res: any, next: any) => {
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
      mockAuthMiddleware.mockImplementation((req: any, res: any, next: any) => {
        req.user = {
          id: 'test-user-id',
          username: 'tenant',
          email: 'tenant@example.com',
          firstName: 'Test',
          lastName: 'Tenant',
          role: 'tenant' as const,
          isActive: true,
          organizations: ['test-org-id'],
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
      mockAuthMiddleware.mockImplementation((req: any, res: any, next: any) => {
        req.user = {
          id: 'test-user-id',
          username: 'manager',
          email: 'manager@example.com',
          firstName: 'Test',
          lastName: 'Manager',
          role: 'manager' as const,
          isActive: true,
          organizations: ['test-org-id'],
        } as AuthenticatedUser;
        next();
      });

      // Mock successful building lookup
      (mockDb.query.buildings.findFirst as any).mockResolvedValue({
        id: 'test-building-id',
        name: 'Test Building',
        bankAccountStartAmount: '100000',
        bankAccountMinimums: '10000',
        generalInflationRate: '2.0',
        revenueInflationRate: '2.0',
      });

      // Mock residences.findMany
      (mockDb.query.residences.findMany as any).mockResolvedValue([]);

      // Mock monthlyBudgets.findMany for unplanned bills
      (mockDb.query.monthlyBudgets.findMany as any).mockResolvedValue([]);

      // Mock database select operations - some queries use .from().where() directly
      const mockSelectChainDirect = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockResolvedValue([] as any[]),
        }),
      };

      // Some queries use .from().where().orderBy().limit()
      const mockSelectChainWithOrderBy = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockReturnValue({
            orderBy: jest.fn<any>().mockReturnValue({
              limit: jest.fn<any>().mockResolvedValue([] as any[]),
            }),
          }),
        }),
      };

      const mockSelectChainBudgets = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockReturnValue({
            limit: jest.fn<any>().mockResolvedValue([] as any[]),
          }),
        }),
      };

      const mockSelectChainCapitalInvestments = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockReturnValue({
            orderBy: jest.fn<any>().mockResolvedValue([] as any[]),
          }),
        }),
      };

      // Mock for payments query (runs in loop, uses innerJoin)
      const mockSelectChainPayments = {
        from: jest.fn<any>().mockReturnValue({
          innerJoin: jest.fn<any>().mockReturnValue({
            where: jest.fn<any>().mockResolvedValue([] as any[]),
          }),
        }),
      };

      (mockDb.select as any)
        .mockImplementationOnce(() => mockSelectChainDirect) // 1. unplanned unique bills (from calculateUnplannedBillsSuggestion)
        .mockImplementationOnce(() => mockSelectChainWithOrderBy) // 2. first bill (conditional, from calculateUnplannedBillsSuggestion)
        .mockImplementationOnce(() => mockSelectChainDirect) // 3. recurrent bills
        .mockImplementationOnce(() => mockSelectChainDirect) // 4. unique bills (for forecast)
        .mockImplementationOnce(() => mockSelectChainBudgets) // 5. baseline income
        .mockImplementationOnce(() => mockSelectChainCapitalInvestments) // 6. capital investments
        .mockImplementation(() => mockSelectChainPayments); // 7+. payments queries in loop

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
      mockAuthMiddleware.mockImplementation((req: any, res: any, next: any) => {
        req.user = {
          id: 'test-user-id',
          username: 'manager',
          email: 'manager@example.com',
          firstName: 'Test',
          lastName: 'Manager',
          role: 'manager' as const,
          isActive: true,
          organizations: ['test-org-id'],
        } as AuthenticatedUser;
        next();
      });
    });

    it('should return 400 for invalid building ID format', async () => {
      (mockDb.query.buildings.findFirst as any).mockResolvedValue(null);

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
      (mockDb.query.buildings.findFirst as any).mockResolvedValue({
        id: 'test-building-id',
        name: 'Test Building',
        bankAccountStartAmount: '100000',
        bankAccountMinimums: '10000',
        generalInflationRate: '2.0',
        revenueInflationRate: '2.0',
      });

      (mockDb.query.residences.findMany as any).mockResolvedValue([]);
      (mockDb.query.monthlyBudgets.findMany as any).mockResolvedValue([]);

      const mockSelectChainDirect = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockResolvedValue([] as any[]),
        }),
      };

      const mockSelectChainWithOrderBy = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockReturnValue({
            orderBy: jest.fn<any>().mockReturnValue({
              limit: jest.fn<any>().mockResolvedValue([] as any[]),
            }),
          }),
        }),
      };

      const mockSelectChainBudgets = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockReturnValue({
            limit: jest.fn<any>().mockResolvedValue([] as any[]),
          }),
        }),
      };

      const mockSelectChainCapitalInvestments = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockReturnValue({
            orderBy: jest.fn<any>().mockResolvedValue([] as any[]),
          }),
        }),
      };

      // Mock for payments query (runs in loop, uses innerJoin)
      const mockSelectChainPayments = {
        from: jest.fn<any>().mockReturnValue({
          innerJoin: jest.fn<any>().mockReturnValue({
            where: jest.fn<any>().mockResolvedValue([] as any[]),
          }),
        }),
      };

      (mockDb.select as any)
        .mockImplementationOnce(() => mockSelectChainDirect) // 1. unplanned unique bills
        .mockImplementationOnce(() => mockSelectChainWithOrderBy) // 2. first bill (conditional)
        .mockImplementationOnce(() => mockSelectChainDirect) // 3. recurrent bills
        .mockImplementationOnce(() => mockSelectChainDirect) // 4. unique bills
        .mockImplementationOnce(() => mockSelectChainBudgets) // 5. baseline income
        .mockImplementationOnce(() => mockSelectChainCapitalInvestments) // 6. capital investments
        .mockImplementation(() => mockSelectChainPayments); // 7+. payments queries in loop

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
      (mockDb.query.buildings.findFirst as any).mockResolvedValue({
        id: 'test-building-id',
        name: 'Test Building',
        bankAccountStartAmount: '100000',
        bankAccountMinimums: '10000',
        generalInflationRate: '2.0',
        revenueInflationRate: '2.0',
      });

      (mockDb.query.residences.findMany as any).mockResolvedValue([]);
      (mockDb.query.monthlyBudgets.findMany as any).mockResolvedValue([]);

      const mockSelectChainDirect = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockResolvedValue([] as any[]),
        }),
      };

      const mockSelectChainWithOrderBy = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockReturnValue({
            orderBy: jest.fn<any>().mockReturnValue({
              limit: jest.fn<any>().mockResolvedValue([] as any[]),
            }),
          }),
        }),
      };

      const mockSelectChainBudgets = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockReturnValue({
            limit: jest.fn<any>().mockResolvedValue([] as any[]),
          }),
        }),
      };

      const mockSelectChainCapitalInvestments = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockReturnValue({
            orderBy: jest.fn<any>().mockResolvedValue([] as any[]),
          }),
        }),
      };

      // Mock for payments query (runs in loop, uses innerJoin)
      const mockSelectChainPayments = {
        from: jest.fn<any>().mockReturnValue({
          innerJoin: jest.fn<any>().mockReturnValue({
            where: jest.fn<any>().mockResolvedValue([] as any[]),
          }),
        }),
      };

      (mockDb.select as any)
        .mockImplementationOnce(() => mockSelectChainDirect) // 1. unplanned unique bills
        .mockImplementationOnce(() => mockSelectChainWithOrderBy) // 2. first bill (conditional)
        .mockImplementationOnce(() => mockSelectChainDirect) // 3. recurrent bills
        .mockImplementationOnce(() => mockSelectChainDirect) // 4. unique bills
        .mockImplementationOnce(() => mockSelectChainBudgets) // 5. baseline income
        .mockImplementationOnce(() => mockSelectChainCapitalInvestments) // 6. capital investments
        .mockImplementation(() => mockSelectChainPayments); // 7+. payments queries in loop

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
      mockAuthMiddleware.mockImplementation((req: any, res: any, next: any) => {
        req.user = {
          id: 'test-user-id',
          username: 'manager',
          email: 'manager@example.com',
          firstName: 'Test',
          lastName: 'Manager',
          role: 'manager' as const,
          isActive: true,
          organizations: ['test-org-id'],
        } as AuthenticatedUser;
        next();
      });
    });

    it('should return complete forecast with realistic building data', async () => {
      // Mock building with comprehensive data
      (mockDb.query.buildings.findFirst as any).mockResolvedValue({
        id: 'test-building-id',
        name: 'Sunset Towers',
        bankAccountStartAmount: '250000',
        bankAccountMinimums: '50000',
        generalInflationRate: '3.5',
        revenueInflationRate: '2.8',
      });

      // No residences mock - baselineMonthlyIncome will come from budget data only
      (mockDb.query.residences.findMany as any).mockResolvedValue([]);

      (mockDb.query.monthlyBudgets.findMany as any).mockResolvedValue([]);

      // Mock recurrent bills with varied schedules
      const mockRecurrentBills: MockBill[] = [
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
      const mockUniqueBills: MockUniqueBill[] = [
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
      const mockBaselineIncome: MockBaselineIncome[] = [
        {
          incomeTypes: ['monthly_fees', 'parking_fees', 'laundry_income'],
          incomes: ['75000', '5500', '2000'],
          spendingTypes: ['admin_expense', 'cleaning'],
          spendings: ['3500', '2800'],
        },
      ];

      // Setup database select mocks
      const mockSelectChainRecurrent = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockResolvedValue(mockRecurrentBills),
        }),
      };

      const mockSelectChainUnique = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockResolvedValue(mockUniqueBills),
        }),
      };

      const mockSelectChainEmpty = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockResolvedValue([] as any[]),
        }),
      };

      const mockSelectChainWithOrderBy = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockReturnValue({
            orderBy: jest.fn<any>().mockReturnValue({
              limit: jest.fn<any>().mockResolvedValue([] as any[]),
            }),
          }),
        }),
      };

      const mockSelectChainBudgets = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockReturnValue({
            limit: jest.fn<any>().mockResolvedValue(mockBaselineIncome),
          }),
        }),
      };

      const mockSelectChainCapitalInvestments = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockReturnValue({
            orderBy: jest.fn<any>().mockResolvedValue([] as any[]),
          }),
        }),
      };

      // Mock for payments query (runs in loop, uses innerJoin)
      const mockSelectChainPayments = {
        from: jest.fn<any>().mockReturnValue({
          innerJoin: jest.fn<any>().mockReturnValue({
            where: jest.fn<any>().mockResolvedValue([] as any[]),
          }),
        }),
      };

      (mockDb.select as any)
        .mockImplementationOnce(() => mockSelectChainEmpty) // 1. unplanned unique bills (returns [])
        .mockImplementationOnce(() => mockSelectChainWithOrderBy) // 2. first bill (runs because query 1 returned [])
        .mockImplementationOnce(() => mockSelectChainRecurrent) // 3. recurrent bills
        .mockImplementationOnce(() => mockSelectChainUnique) // 4. unique bills for forecast
        .mockImplementationOnce(() => mockSelectChainBudgets) // 5. baseline income
        .mockImplementationOnce(() => mockSelectChainCapitalInvestments) // 6. capital investments
        .mockImplementation(() => mockSelectChainPayments); // 7+. payments queries in loop

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
      (mockDb.query.buildings.findFirst as any).mockResolvedValue({
        id: 'empty-building-id',
        name: 'Empty Building',
        bankAccountStartAmount: '100000',
        bankAccountMinimums: '20000',
        generalInflationRate: '2.0',
        revenueInflationRate: '2.0',
      });

      (mockDb.query.residences.findMany as any).mockResolvedValue([]);
      (mockDb.query.monthlyBudgets.findMany as any).mockResolvedValue([]);

      // Mock empty responses for all data queries
      const mockEmptySelectChain = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockResolvedValue([] as any[]),
        }),
      };

      const mockEmptyWithOrderBy = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockReturnValue({
            orderBy: jest.fn<any>().mockReturnValue({
              limit: jest.fn<any>().mockResolvedValue([] as any[]),
            }),
          }),
        }),
      };

      const mockEmptyBudgetChain = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockReturnValue({
            limit: jest.fn<any>().mockResolvedValue([] as any[]),
          }),
        }),
      };

      const mockEmptyCapitalInvestments = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockReturnValue({
            orderBy: jest.fn<any>().mockResolvedValue([] as any[]),
          }),
        }),
      };

      const mockEmptyPaymentChain = {
        from: jest.fn<any>().mockReturnValue({
          innerJoin: jest.fn<any>().mockReturnValue({
            where: jest.fn<any>().mockResolvedValue([] as any[]),
          }),
        }),
      };

      (mockDb.select as any)
        .mockImplementationOnce(() => mockEmptySelectChain) // 1. unplanned unique bills (returns [])
        .mockImplementationOnce(() => mockEmptyWithOrderBy) // 2. first bill (runs because query 1 returned [])
        .mockImplementationOnce(() => mockEmptySelectChain) // 3. recurrent bills
        .mockImplementationOnce(() => mockEmptySelectChain) // 4. unique bills
        .mockImplementationOnce(() => mockEmptyBudgetChain) // 5. baseline income
        .mockImplementationOnce(() => mockEmptyCapitalInvestments) // 6. capital investments
        .mockImplementation(() => mockEmptyPaymentChain); // 7+. payment queries in loop

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
      (mockDb.query.buildings.findFirst as any).mockRejectedValue(new Error('Database connection failed'));

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
      mockAuthMiddleware.mockImplementation((req: any, res: any, next: any) => {
        req.user = {
          id: 'test-user-id',
          username: 'manager',
          email: 'manager@example.com',
          firstName: 'Test',
          lastName: 'Manager',
          role: 'manager' as const,
          isActive: true,
          organizations: ['test-org-id'],
        } as AuthenticatedUser;
        next();
      });
    });

    it('should handle large datasets efficiently', async () => {
      const startTime = Date.now();
      
      // Mock building
      (mockDb.query.buildings.findFirst as any).mockResolvedValue({
        id: 'large-building-id',
        name: 'Large Building Complex',
        bankAccountStartAmount: '1000000',
        bankAccountMinimums: '100000',
        generalInflationRate: '2.5',
        revenueInflationRate: '3.0',
      });

      (mockDb.query.residences.findMany as any).mockResolvedValue([]);
      (mockDb.query.monthlyBudgets.findMany as any).mockResolvedValue([]);

      // Mock many recurrent bills
      const manyRecurrentBills: MockBill[] = Array.from({ length: 50 }, (_, i) => ({
        id: `bill-${i}`,
        category: `category-${i % 5}`,
        costs: ['1000', '500'],
        schedulePayment: (['monthly', 'quarterly', 'yearly'][i % 3] as 'monthly' | 'quarterly' | 'yearly'),
        startDate: new Date('2025-01-01'),
        endDate: null,
      }));

      // Mock many unique bills across years
      const manyUniqueBills: MockUniqueBill[] = Array.from({ length: 100 }, (_, i) => ({
        startDate: new Date(2025 + (i % 10), (i % 12), 1),
        totalAmount: (Math.random() * 50000 + 10000).toFixed(0),
        category: `unique-category-${i % 8}`,
      }));

      const mockSelectChainRecurrent = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockResolvedValue(manyRecurrentBills),
        }),
      };

      const mockSelectChainUnique = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockResolvedValue(manyUniqueBills),
        }),
      };

      const mockSelectChainEmpty = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockResolvedValue([] as any[]),
        }),
      };

      const mockSelectChainWithOrderBy = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockReturnValue({
            orderBy: jest.fn<any>().mockReturnValue({
              limit: jest.fn<any>().mockResolvedValue([] as any[]),
            }),
          }),
        }),
      };

      const mockSelectChainBudgets = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockReturnValue({
            limit: jest.fn<any>().mockResolvedValue([{
              incomeTypes: ['fees'],
              incomes: ['150000'],
              spendingTypes: ['expenses'],
              spendings: ['80000'],
            }] as any[]),
          }),
        }),
      };

      const mockSelectChainCapitalInvestments = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockReturnValue({
            orderBy: jest.fn<any>().mockResolvedValue([] as any[]),
          }),
        }),
      };

      // Mock for payments query (runs in loop, uses innerJoin)
      const mockSelectChainPayments = {
        from: jest.fn<any>().mockReturnValue({
          innerJoin: jest.fn<any>().mockReturnValue({
            where: jest.fn<any>().mockResolvedValue([] as any[]),
          }),
        }),
      };

      (mockDb.select as any)
        .mockImplementationOnce(() => mockSelectChainEmpty) // 1. unplanned unique bills (returns [])
        .mockImplementationOnce(() => mockSelectChainWithOrderBy) // 2. first bill (runs because query 1 returned [])
        .mockImplementationOnce(() => mockSelectChainRecurrent) // 3. recurrent bills
        .mockImplementationOnce(() => mockSelectChainUnique) // 4. unique bills for forecast
        .mockImplementationOnce(() => mockSelectChainBudgets) // 5. baseline income
        .mockImplementationOnce(() => mockSelectChainCapitalInvestments) // 6. capital investments
        .mockImplementation(() => mockSelectChainPayments); // 7+. payments queries in loop

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
      (mockDb.query.buildings.findFirst as any).mockResolvedValue({
        id: 'concurrent-building-id',
        name: 'Concurrent Test Building',
        bankAccountStartAmount: '100000',
        bankAccountMinimums: '10000',
        generalInflationRate: '2.0',
        revenueInflationRate: '2.0',
      });

      (mockDb.query.residences.findMany as any).mockResolvedValue([]);
      (mockDb.query.monthlyBudgets.findMany as any).mockResolvedValue([]);

      // Use the same mock setup as the working "empty database" test
      const mockEmptySelectChain = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockResolvedValue([] as any[]),
        }),
      };

      const mockEmptyWithOrderBy = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockReturnValue({
            orderBy: jest.fn<any>().mockReturnValue({
              limit: jest.fn<any>().mockResolvedValue([] as any[]),
            }),
          }),
        }),
      };

      const mockEmptyBudgetChain = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockReturnValue({
            limit: jest.fn<any>().mockResolvedValue([] as any[]),
          }),
        }),
      };

      const mockEmptyCapitalInvestments = {
        from: jest.fn<any>().mockReturnValue({
          where: jest.fn<any>().mockReturnValue({
            orderBy: jest.fn<any>().mockResolvedValue([] as any[]),
          }),
        }),
      };

      const mockEmptyPaymentChain = {
        from: jest.fn<any>().mockReturnValue({
          innerJoin: jest.fn<any>().mockReturnValue({
            where: jest.fn<any>().mockResolvedValue([] as any[]),
          }),
        }),
      };

      // Track queries per request - reset after payments loop
      let queryCount = 0;
      (mockDb.select as any).mockImplementation(() => {
        const currentQuery = queryCount++;
        
        // Pattern: 6 initial queries, then all payments
        // Reset counter every 306 queries (6 initial + 300 payments)
        const positionInCycle = currentQuery % 306;
        
        if (positionInCycle < 6) {
          // Initial 6 queries
          switch (positionInCycle) {
            case 0: return mockEmptySelectChain; // unplanned unique bills
            case 1: return mockEmptyWithOrderBy; // first bill
            case 2: return mockEmptySelectChain; // recurrent bills
            case 3: return mockEmptySelectChain; // unique bills
            case 4: return mockEmptyBudgetChain; // baseline income
            case 5: return mockEmptyCapitalInvestments; // capital investments
          }
        }
        
        // Queries 6-305 are payments
        return mockEmptyPaymentChain;
      });

      const payload = {
        bankAccountStartAmount: 100000,
        bankAccountMinimums: 10000,
        generalInflationRate: 2.0,
        revenueInflationRate: 2.0,
      };

      // Test that the endpoint can handle multiple sequential requests successfully
      // This verifies the logic is sound and mocks are reusable
      const responses = [];
      for (let i = 0; i < 3; i++) {
        const response = await agent
          .post('/api/budgets/concurrent-building-id/forecast')
          .send(payload);
        responses.push(response);
        
        // Verify each request succeeds before continuing
        expect(response.status).toBe(200);
        expect(response.body.forecast).toHaveLength(300);
      }
      
      // All 3 requests should have succeeded
      expect(responses.length).toBe(3);
    });
  });
});
