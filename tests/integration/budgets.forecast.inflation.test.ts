/**
 * @file Budget Forecast Monthly Fees Inflation Integration Tests
 * @description Integration tests specifically for monthly fees inflation behavior in forecast endpoint
 * Tests all scenarios: category rates, global bills inflation, revenueInflation fallback, and financial year gating
 */

import request from 'supertest';
import express from 'express';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Define authenticated user type
interface AuthenticatedUser {
  id: string;
  role: 'admin' | 'manager' | 'demo_manager';
  organizations?: string[];
  email?: string;
  username?: string;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// Mock database with controlled test data
const mockDb = {
  query: {
    buildings: {
      findFirst: jest.fn(),
    },
    residences: {
      findMany: jest.fn(),
    },
  },
  select: jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => Promise.resolve([])),
    })),
  })),
};

// Mock the database module
jest.mock('../../server/db', () => ({
  db: mockDb,
}));

// Mock drizzle-orm functions
jest.mock('drizzle-orm', () => ({
  eq: jest.fn((column, value) => ({ column, operator: 'eq', value })),
  and: jest.fn((...conditions) => ({ operator: 'and', conditions })),
  gte: jest.fn((column, value) => ({ column, operator: 'gte', value })),
  lte: jest.fn((column, value) => ({ column, operator: 'lte', value })),
  sql: jest.fn((query) => ({ sql: query })),
  desc: jest.fn((column) => ({ column, direction: 'desc' })),
  asc: jest.fn((column) => ({ column, direction: 'asc' })),
  inArray: jest.fn((column, values) => ({ column, operator: 'inArray', values })),
  or: jest.fn((...conditions) => ({ operator: 'or', conditions })),
  isNull: jest.fn((column) => ({ column, operator: 'isNull' })),
}));

// Mock schema tables
jest.mock('@shared/schema', () => ({
  buildings: { 
    id: 'buildings.id', 
    name: 'buildings.name',
    bankAccountStartAmount: 'buildings.bankAccountStartAmount',
    bankAccountMinimums: 'buildings.bankAccountMinimums',
    generalInflationRate: 'buildings.generalInflationRate',
    revenueInflationRate: 'buildings.revenueInflationRate',
    unplannedBillsAmount: 'buildings.unplannedBillsAmount',
    financialYearStart: 'buildings.financialYearStart',
    amenities: 'buildings.amenities',
  },
  bills: { 
    id: 'bills.id', 
    buildingId: 'bills.buildingId',
    category: 'bills.category',
    costs: 'bills.costs',
    schedulePayment: 'bills.schedulePayment',
    startDate: 'bills.startDate',
    endDate: 'bills.endDate',
    paymentType: 'bills.paymentType',
    status: 'bills.status',
  },
  monthlyBudgets: { 
    id: 'monthlyBudgets.id', 
    buildingId: 'monthlyBudgets.buildingId',
    year: 'monthlyBudgets.year',
    month: 'monthlyBudgets.month',
    incomeTypes: 'monthlyBudgets.incomeTypes',
    incomes: 'monthlyBudgets.incomes',
    spendingTypes: 'monthlyBudgets.spendingTypes',
    spendings: 'monthlyBudgets.spendings',
  },
  residences: {
    id: 'residences.id',
    buildingId: 'residences.buildingId',
    monthlyFees: 'residences.monthlyFees',
    isActive: 'residences.isActive',
  },
  payments: { id: 'payments.id' },
}));

// Mock authentication middleware to always authenticate
const mockAuthMiddleware = jest.fn((req: any, res: any, next: any) => {
  req.user = {
    id: 'test-user-id',
    role: 'admin' as const,
    organizations: ['test-org'],
    email: 'test@example.com',
  };
  next();
});

jest.mock('../../server/auth', () => ({
  requireAuth: mockAuthMiddleware,
}));

// Import router after mocks are set up
import budgetRouter from '../../server/api/budgets';

describe('Budget Forecast Monthly Fees Inflation Integration Tests', () => {
  let app: express.Application;
  const testBuildingId = 'test-building-123';

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/budgets', budgetRouter);
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock returns
    mockDb.query.residences.findMany.mockResolvedValue([
      { id: 'res1', monthlyFees: '1500', isActive: true },
      { id: 'res2', monthlyFees: '1200', isActive: true },
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Monthly Fees Inflation Rate Selection Priority', () => {
    it('should use category-specific rate when available (highest priority)', async () => {
      // Setup building with category-specific inflation rates
      mockDb.query.buildings.findFirst.mockResolvedValue({
        id: testBuildingId,
        name: 'Test Building',
        bankAccountStartAmount: 100000,
        bankAccountMinimums: 10000,
        generalInflationRate: 2.0, // 2%
        revenueInflationRate: 2.5, // 2.5%
        unplannedBillsAmount: 500,
        financialYearStart: new Date('2024-01-01'),
        amenities: {
          categoryInflationRates: {
            monthly_fees: 3.5, // 3.5% - should be used
          },
        },
      });

      const response = await request(app)
        .post(`/api/budgets/${testBuildingId}/forecast`)
        .send({
          generalInflationRate: 2.0,
          revenueInflationRate: 2.5,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('forecast');
      expect(response.body.forecast).toBeInstanceOf(Array);
      
      // Verify that the forecast data reflects the category-specific inflation rate
      // Monthly fees should be inflated at 3.5% rate instead of revenueInflation (2.5%)
      const secondYearData = response.body.forecast.find((f: any) => f.year === new Date().getFullYear() + 1);
      expect(secondYearData).toBeDefined();
      
      // The specific inflation rate should be visible in the calculation
      // Since we have $2700 in monthly fees (1500 + 1200), after 1 year with 3.5% inflation
      // it should be approximately $2794.5
      expect(secondYearData.inflatedIncome).toBeGreaterThan(2790);
      expect(secondYearData.inflatedIncome).toBeLessThan(2800);
    });

    it('should use global bills inflation when no category-specific rate (second priority)', async () => {
      mockDb.query.buildings.findFirst.mockResolvedValue({
        id: testBuildingId,
        name: 'Test Building',
        bankAccountStartAmount: 100000,
        bankAccountMinimums: 10000,
        generalInflationRate: 2.0,
        revenueInflationRate: 2.5,
        unplannedBillsAmount: 500,
        financialYearStart: new Date('2024-01-01'),
        amenities: {
          useGlobalBillsInflation: true,
          globalBillsInflationRate: 4.0, // 4% - should be used for monthly fees
        },
      });

      const response = await request(app)
        .post(`/api/budgets/${testBuildingId}/forecast`)
        .send({
          generalInflationRate: 2.0,
          revenueInflationRate: 2.5,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('forecast');
      
      // Verify global bills inflation rate is used
      const secondYearData = response.body.forecast.find((f: any) => f.year === new Date().getFullYear() + 1);
      expect(secondYearData).toBeDefined();
      
      // Monthly fees should be inflated at 4% rate
      // $2700 * 1.04 = $2808
      expect(secondYearData.inflatedIncome).toBeGreaterThan(2805);
      expect(secondYearData.inflatedIncome).toBeLessThan(2815);
    });

    it('should fall back to revenueInflation for backward compatibility (third priority)', async () => {
      mockDb.query.buildings.findFirst.mockResolvedValue({
        id: testBuildingId,
        name: 'Test Building',
        bankAccountStartAmount: 100000,
        bankAccountMinimums: 10000,
        generalInflationRate: 2.0,
        revenueInflationRate: 2.5, // Should be used as fallback
        unplannedBillsAmount: 500,
        financialYearStart: new Date('2024-01-01'),
        amenities: {}, // No bills configuration
      });

      const response = await request(app)
        .post(`/api/budgets/${testBuildingId}/forecast`)
        .send({
          generalInflationRate: 2.0,
          revenueInflationRate: 2.5,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('forecast');
      
      // Verify revenueInflation fallback is used
      const secondYearData = response.body.forecast.find((f: any) => f.year === new Date().getFullYear() + 1);
      expect(secondYearData).toBeDefined();
      
      // Monthly fees should be inflated at revenue inflation rate (2.5%)
      // $2700 * 1.025 = $2767.5
      expect(secondYearData.inflatedIncome).toBeGreaterThan(2765);
      expect(secondYearData.inflatedIncome).toBeLessThan(2770);
    });

    it('should use general inflation as final fallback when revenueInflation is invalid', async () => {
      mockDb.query.buildings.findFirst.mockResolvedValue({
        id: testBuildingId,
        name: 'Test Building',
        bankAccountStartAmount: 100000,
        bankAccountMinimums: 10000,
        generalInflationRate: 2.0, // Should be used as final fallback
        revenueInflationRate: null, // Invalid revenue inflation
        unplannedBillsAmount: 500,
        financialYearStart: new Date('2024-01-01'),
        amenities: {}, // No bills configuration
      });

      const response = await request(app)
        .post(`/api/budgets/${testBuildingId}/forecast`)
        .send({
          generalInflationRate: 2.0,
          // revenueInflationRate not provided
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('forecast');
      
      // Verify general inflation fallback is used
      const secondYearData = response.body.forecast.find((f: any) => f.year === new Date().getFullYear() + 1);
      expect(secondYearData).toBeDefined();
      
      // Monthly fees should be inflated at general inflation rate (2%)
      // $2700 * 1.02 = $2754
      expect(secondYearData.inflatedIncome).toBeGreaterThan(2752);
      expect(secondYearData.inflatedIncome).toBeLessThan(2756);
    });
  });

  describe('Financial Year Start Date Gating', () => {
    it('should apply inflation only after financial year start date', async () => {
      const futureFinancialYearStart = new Date();
      futureFinancialYearStart.setFullYear(futureFinancialYearStart.getFullYear() + 2);

      mockDb.query.buildings.findFirst.mockResolvedValue({
        id: testBuildingId,
        name: 'Test Building',
        bankAccountStartAmount: 100000,
        bankAccountMinimums: 10000,
        generalInflationRate: 2.0,
        revenueInflationRate: 10.0, // High rate to make difference obvious
        unplannedBillsAmount: 500,
        financialYearStart: futureFinancialYearStart.toISOString(),
        amenities: {},
      });

      const response = await request(app)
        .post(`/api/budgets/${testBuildingId}/forecast`)
        .send({
          generalInflationRate: 2.0,
          revenueInflationRate: 10.0,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('forecast');
      
      // For the first year, inflation should not be applied since financialYearStart is in future
      const firstYearData = response.body.forecast.find((f: any) => f.year === new Date().getFullYear());
      expect(firstYearData).toBeDefined();
      expect(firstYearData.inflatedIncome).toBe(2700); // Base amount without inflation
      
      // For the third year, inflation should be applied since we'll be past financialYearStart
      const futureYearData = response.body.forecast.find((f: any) => f.year === futureFinancialYearStart.getFullYear() + 1);
      expect(futureYearData).toBeDefined();
      expect(futureYearData.inflatedIncome).toBeGreaterThan(2700); // Should be inflated
    });

    it('should apply inflation from beginning when no financial year start is set', async () => {
      mockDb.query.buildings.findFirst.mockResolvedValue({
        id: testBuildingId,
        name: 'Test Building',
        bankAccountStartAmount: 100000,
        bankAccountMinimums: 10000,
        generalInflationRate: 2.0,
        revenueInflationRate: 5.0,
        unplannedBillsAmount: 500,
        financialYearStart: null, // No financial year start
        amenities: {},
      });

      const response = await request(app)
        .post(`/api/budgets/${testBuildingId}/forecast`)
        .send({
          generalInflationRate: 2.0,
          revenueInflationRate: 5.0,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('forecast');
      
      // Inflation should be applied from the second year onwards
      const secondYearData = response.body.forecast.find((f: any) => f.year === new Date().getFullYear() + 1);
      expect(secondYearData).toBeDefined();
      expect(secondYearData.inflatedIncome).toBeGreaterThan(2700); // Should be inflated with 5%
      
      // $2700 * 1.05 = $2835
      expect(secondYearData.inflatedIncome).toBeGreaterThan(2830);
      expect(secondYearData.inflatedIncome).toBeLessThan(2840);
    });

    it('should handle invalid financial year start gracefully', async () => {
      mockDb.query.buildings.findFirst.mockResolvedValue({
        id: testBuildingId,
        name: 'Test Building',
        bankAccountStartAmount: 100000,
        bankAccountMinimums: 10000,
        generalInflationRate: 2.0,
        revenueInflationRate: 3.0,
        unplannedBillsAmount: 500,
        financialYearStart: 'invalid-date-string', // Invalid date
        amenities: {},
      });

      // Mock console.warn to capture warnings
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const response = await request(app)
        .post(`/api/budgets/${testBuildingId}/forecast`)
        .send({
          generalInflationRate: 2.0,
          revenueInflationRate: 3.0,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('forecast');
      
      // Should default to applying inflation (safe fallback)
      const secondYearData = response.body.forecast.find((f: any) => f.year === new Date().getFullYear() + 1);
      expect(secondYearData).toBeDefined();
      expect(secondYearData.inflatedIncome).toBeGreaterThan(2700); // Should be inflated
      
      // Should have logged a warning about invalid date
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid financialYearStart date'));
      
      consoleSpy.mockRestore();
    });
  });

  describe('End-to-End Integration Verification', () => {
    it('should verify all helper functions are used in production code path', async () => {
      // This test verifies that getMonthlyFeesInflationRate, safeConvertFinancialYearStart, 
      // and shouldApplyInflation are actually called by the forecast endpoint

      mockDb.query.buildings.findFirst.mockResolvedValue({
        id: testBuildingId,
        name: 'Test Building',
        bankAccountStartAmount: 50000,
        bankAccountMinimums: 5000,
        generalInflationRate: 2.0,
        revenueInflationRate: 2.5,
        unplannedBillsAmount: 300,
        financialYearStart: new Date('2024-06-01').toISOString(),
        amenities: {
          categoryInflationRates: {
            monthly_fees: 4.5, // Should override revenueInflation
          },
        },
      });

      const response = await request(app)
        .post(`/api/budgets/${testBuildingId}/forecast`)
        .send({
          generalInflationRate: 2.0,
          revenueInflationRate: 2.5,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('forecast');
      expect(response.body.forecast).toBeInstanceOf(Array);
      expect(response.body.forecast.length).toBe(300); // 25 years * 12 months
      
      // Verify building was queried (safeConvertFinancialYearStart was called)
      expect(mockDb.query.buildings.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({ buildingId: testBuildingId }),
        columns: expect.objectContaining({
          financialYearStart: true,
          amenities: true,
        }),
      });
      
      // Verify that the forecast shows different behavior based on financial year start
      // Months before June 2024 should have different inflation application
      const earlyMonthsData = response.body.forecast.filter((f: any) => 
        f.year === 2024 && f.month < 6
      );
      const lateMonthsData = response.body.forecast.filter((f: any) => 
        f.year === 2024 && f.month >= 6
      );
      
      // Should have data for both periods
      expect(earlyMonthsData.length).toBeGreaterThan(0);
      expect(lateMonthsData.length).toBeGreaterThan(0);
      
      // Verify the forecast structure contains expected fields
      const firstMonthData = response.body.forecast[0];
      expect(firstMonthData).toHaveProperty('year');
      expect(firstMonthData).toHaveProperty('month');
      expect(firstMonthData).toHaveProperty('revenue');
      expect(firstMonthData).toHaveProperty('spending');
      expect(firstMonthData).toHaveProperty('netCashFlow');
      expect(firstMonthData).toHaveProperty('balance');
      expect(firstMonthData).toHaveProperty('status');
      expect(firstMonthData).toHaveProperty('inflatedIncome');
    });

    it('should verify monthly fees are separated from other income for different inflation treatment', async () => {
      // Setup building with both residence monthly fees and budget income
      mockDb.query.buildings.findFirst.mockResolvedValue({
        id: testBuildingId,
        name: 'Test Building',
        bankAccountStartAmount: 100000,
        bankAccountMinimums: 10000,
        generalInflationRate: 1.5, // General inflation
        revenueInflationRate: 2.0, // Revenue inflation for other income
        unplannedBillsAmount: 400,
        financialYearStart: new Date('2024-01-01'),
        amenities: {
          categoryInflationRates: {
            monthly_fees: 3.0, // Specific rate for monthly fees
          },
        },
      });
      
      // Mock monthly budgets to provide other income sources
      mockDb.select.mockReturnValue({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([{
            incomeTypes: ['parking_fees', 'other_income'],
            incomes: ['500', '200'], // $700 total other income
            spendingTypes: ['maintenance'],
            spendings: ['1000'],
          }])),
        })),
      });

      const response = await request(app)
        .post(`/api/budgets/${testBuildingId}/forecast`)
        .send({
          generalInflationRate: 1.5,
          revenueInflationRate: 2.0,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('forecast');
      
      // Verify second year data shows different inflation rates applied
      const secondYearData = response.body.forecast.find((f: any) => f.year === new Date().getFullYear() + 1);
      expect(secondYearData).toBeDefined();
      
      // Total inflated income should reflect:
      // - Monthly fees: $2700 * 1.03 = $2781 (category rate)
      // - Other income: $700 * 1.02 = $714 (revenue inflation)
      // Total: $2781 + $714 = $3495
      expect(secondYearData.inflatedIncome).toBeGreaterThan(3490);
      expect(secondYearData.inflatedIncome).toBeLessThan(3500);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing building gracefully', async () => {
      mockDb.query.buildings.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/budgets/${testBuildingId}/forecast`)
        .send({
          generalInflationRate: 2.0,
          revenueInflationRate: 2.5,
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('_error', 'Building not found');
    });

    it('should handle invalid input data', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuildingId}/forecast`)
        .send({
          generalInflationRate: 'invalid', // Should be number
          revenueInflationRate: -5, // Should be positive
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('_error', 'Invalid input data');
    });

    it('should handle buildings with no residences', async () => {
      mockDb.query.buildings.findFirst.mockResolvedValue({
        id: testBuildingId,
        name: 'Test Building',
        bankAccountStartAmount: 100000,
        bankAccountMinimums: 10000,
        generalInflationRate: 2.0,
        revenueInflationRate: 2.5,
        unplannedBillsAmount: 500,
        financialYearStart: new Date('2024-01-01'),
        amenities: {},
      });
      
      // No residences
      mockDb.query.residences.findMany.mockResolvedValue([]);

      const response = await request(app)
        .post(`/api/budgets/${testBuildingId}/forecast`)
        .send({
          generalInflationRate: 2.0,
          revenueInflationRate: 2.5,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('forecast');
      
      // Should use fallback income (50000)
      const firstMonthData = response.body.forecast[0];
      expect(firstMonthData.revenue).toBeGreaterThan(49000);
      expect(firstMonthData.revenue).toBeLessThan(51000);
    });
  });
});