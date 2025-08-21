/**
 * Comprehensive tests for Dynamic Financial Calculator
 * Tests data accuracy, edge cases, performance, and caching behavior
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DynamicFinancialCalculator } from '../../server/services/dynamic-financial-calculator';
import { db } from '../../server/db';
import { sql } from 'drizzle-orm';

// Mock the database
jest.mock('../../server/db', () => ({
  db: {
    select: jest.fn(),
    execute: jest.fn(),
  },
}));

const mockDb = db as jest.Mocked<typeof db>;

describe('DynamicFinancialCalculator', () => {
  let calculator: DynamicFinancialCalculator;

  beforeEach(() => {
    calculator = new DynamicFinancialCalculator();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Financial Data Calculation', () => {
    const mockBuildingId = 'test-building-123';
    const mockStartDate = '2024-01-01';
    const mockEndDate = '2024-12-31';

    const mockBills = [
      {
        id: 'bill-1',
        buildingId: mockBuildingId,
        title: 'Monthly Utilities',
        category: 'utilities',
        totalAmount: '2500.00',
        costs: ['2500.00'],
        schedulePayment: 'monthly',
        scheduleCustom: null,
        startDate: '2024-01-01',
        endDate: null,
        paymentType: 'recurrent'
      },
      {
        id: 'bill-2', 
        buildingId: mockBuildingId,
        title: 'Quarterly Insurance',
        category: 'insurance',
        totalAmount: '6000.00',
        costs: ['6000.00'],
        schedulePayment: 'quarterly',
        scheduleCustom: null,
        startDate: '2024-01-01',
        endDate: null,
        paymentType: 'recurrent'
      }
    ];

    const mockResidences = [
      {
        id: 'res-1',
        buildingId: mockBuildingId,
        unitNumber: '101',
        monthlyFees: '1800.00',
        isActive: true
      },
      {
        id: 'res-2',
        buildingId: mockBuildingId, 
        unitNumber: '102',
        monthlyFees: '1650.00',
        isActive: true
      }
    ];

    beforeEach(() => {
      // Mock successful cache miss
      mockDb.execute
        .mockResolvedValueOnce({ rows: [] }) // Cache lookup returns no results
        .mockResolvedValueOnce({ rows: [{ success: true }] }); // Cache insert succeeds
      
      // Mock data retrieval
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
      };

      mockDb.select
        .mockReturnValueOnce(mockSelect as any)
        .mockReturnValueOnce(mockSelect as any);

      // First call returns bills, second call returns residences
      mockSelect.from
        .mockResolvedValueOnce(mockBills)
        .mockResolvedValueOnce(mockResidences);
    });

    it('should calculate monthly financial data correctly', async () => {
      const result = await calculator.getFinancialData(
        mockBuildingId,
        mockStartDate,
        mockEndDate
      );

      expect(result).toBeDefined();
      expect(result.buildingId).toBe(mockBuildingId);
      expect(result.startDate).toBe(mockStartDate);
      expect(result.endDate).toBe(mockEndDate);
      expect(result.monthlyData).toHaveLength(12);

      // Test first month calculations
      const firstMonth = result.monthlyData[0];
      expect(firstMonth.year).toBe(2024);
      expect(firstMonth.month).toBe(1);
      
      // Income should be sum of all residence monthly fees
      expect(firstMonth.totalIncome).toBe(3450); // 1800 + 1650
      expect(firstMonth.incomeByCategory.monthly_fees).toBe(3450);
      
      // Expenses should include monthly utilities + quarterly insurance (Jan, Apr, Jul, Oct)
      expect(firstMonth.totalExpenses).toBe(8500); // 2500 (utilities) + 6000 (insurance Q1)
      expect(firstMonth.expensesByCategory.utilities).toBe(2500);
      expect(firstMonth.expensesByCategory.insurance).toBe(6000);
      
      // Net cash flow calculation
      expect(firstMonth.netCashFlow).toBe(-5050); // 3450 - 8500
    });

    it('should handle quarterly billing correctly', async () => {
      const result = await calculator.getFinancialData(
        mockBuildingId,
        mockStartDate,
        mockEndDate
      );

      // Check January (Q1 - should have quarterly charge)
      const january = result.monthlyData[0];
      expect(january.expensesByCategory.insurance).toBe(6000);

      // Check February (should not have quarterly charge)
      const february = result.monthlyData[1];
      expect(february.expensesByCategory.insurance).toBeUndefined();

      // Check April (Q2 - should have quarterly charge)  
      const april = result.monthlyData[3];
      expect(april.expensesByCategory.insurance).toBe(6000);

      // Check May (should not have quarterly charge)
      const may = result.monthlyData[4];
      expect(may.expensesByCategory.insurance).toBeUndefined();
    });

    it('should calculate yearly summary correctly', async () => {
      const result = await calculator.getFinancialData(
        mockBuildingId,
        mockStartDate,
        mockEndDate
      );

      // Annual income: 3450 * 12 = 41,400
      expect(result.summary.totalIncome).toBe(41400);
      
      // Annual expenses: Utilities (2500 * 12) + Insurance (6000 * 4) = 30,000 + 24,000 = 54,000
      expect(result.summary.totalExpenses).toBe(54000);
      
      // Net cash flow: 41,400 - 54,000 = -12,600
      expect(result.summary.netCashFlow).toBe(-12600);
      
      // Average monthly income: 41,400 / 12 = 3,450
      expect(result.summary.averageMonthlyIncome).toBe(3450);
      
      // Average monthly expenses: 54,000 / 12 = 4,500
      expect(result.summary.averageMonthlyExpenses).toBe(4500);
    });
  });

  describe('Caching Behavior', () => {
    const mockBuildingId = 'cache-test-building';
    const mockCacheKey = 'financial_2024-01-01_2024-12-31';
    const mockCachedData = {
      buildingId: mockBuildingId,
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      monthlyData: [],
      summary: {
        totalIncome: 1000,
        totalExpenses: 800,
        netCashFlow: 200,
        averageMonthlyIncome: 83.33,
        averageMonthlyExpenses: 66.67
      }
    };

    it('should return cached data when available', async () => {
      // Mock successful cache hit
      mockDb.execute.mockResolvedValueOnce({
        rows: [{ cache_data: mockCachedData }]
      });

      const result = await calculator.getFinancialData(
        mockBuildingId,
        '2024-01-01',
        '2024-12-31'
      );

      expect(result).toEqual(mockCachedData);
      expect(mockDb.execute).toHaveBeenCalledTimes(1); // Only cache lookup, no calculation
    });

    it('should force refresh when requested', async () => {
      // Mock cache miss and successful calculation
      mockDb.execute
        .mockResolvedValueOnce({ rows: [] }) // Cache lookup (skipped due to force refresh)
        .mockResolvedValueOnce({ rows: [{ success: true }] }); // Cache insert

      // Mock data retrieval for calculation
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
      };

      mockDb.select
        .mockReturnValueOnce(mockSelect as any)
        .mockReturnValueOnce(mockSelect as any);

      mockSelect.from
        .mockResolvedValueOnce([]) // Empty bills
        .mockResolvedValueOnce([]); // Empty residences

      const result = await calculator.getFinancialData(
        mockBuildingId,
        '2024-01-01',
        '2024-12-31',
        true // Force refresh
      );

      expect(result).toBeDefined();
      // Should skip cache lookup and perform calculation
      expect(mockDb.select).toHaveBeenCalledTimes(2); // Bills and residences queries
    });

    it('should invalidate cache when requested', async () => {
      mockDb.execute.mockResolvedValueOnce({ rows: [] });

      await calculator.invalidateCache(mockBuildingId, 'test invalidation');

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          queryChunks: expect.arrayContaining([
            expect.objectContaining({
              value: expect.arrayContaining([
                expect.stringContaining('DELETE FROM financial_cache WHERE building_id')
              ])
            })
          ])
        })
      );
    });

    it('should get cache statistics correctly', async () => {
      const mockStats = {
        total_entries: '150',
        expired_entries: '12', 
        oldest_entry: '2024-01-01T10:00:00Z',
        newest_entry: '2024-12-20T15:30:00Z'
      };

      mockDb.execute.mockResolvedValueOnce({ rows: [mockStats] });

      const stats = await calculator.getCacheStatistics();

      expect(stats).toEqual({
        totalEntries: 150,
        expiredEntries: 12,
        cacheHitRate: 0,
        oldestEntry: '2024-01-01T10:00:00Z',
        newestEntry: '2024-12-20T15:30:00Z'
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty bills and residences', async () => {
      const mockBuildingId = 'empty-building';
      
      // Mock cache miss
      mockDb.execute
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ success: true }] });

      // Mock empty data
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
      };

      mockDb.select
        .mockReturnValueOnce(mockSelect as any)
        .mockReturnValueOnce(mockSelect as any);

      mockSelect.from
        .mockResolvedValueOnce([]) // Empty bills
        .mockResolvedValueOnce([]); // Empty residences

      const result = await calculator.getFinancialData(
        mockBuildingId,
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.monthlyData).toHaveLength(12);
      expect(result.summary.totalIncome).toBe(0);
      expect(result.summary.totalExpenses).toBe(0);
      expect(result.summary.netCashFlow).toBe(0);
    });

    it('should handle bills with null/invalid amounts', async () => {
      const mockBills = [
        {
          id: 'bill-invalid',
          buildingId: 'test-building',
          title: 'Invalid Bill',
          category: 'utilities',
          totalAmount: null,
          costs: [null, ''],
          schedulePayment: 'monthly',
          scheduleCustom: null,
          startDate: '2024-01-01',
          endDate: null,
          paymentType: 'recurrent'
        }
      ];

      mockDb.execute
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ success: true }] });

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
      };

      mockDb.select
        .mockReturnValueOnce(mockSelect as any)
        .mockReturnValueOnce(mockSelect as any);

      mockSelect.from
        .mockResolvedValueOnce(mockBills)
        .mockResolvedValueOnce([]);

      const result = await calculator.getFinancialData(
        'test-building',
        '2024-01-01',
        '2024-12-31'
      );

      // Should handle null amounts gracefully
      expect(result.monthlyData[0].totalExpenses).toBe(0);
      expect(result.summary.totalExpenses).toBe(0);
    });

    it('should handle residences with zero/null monthly fees', async () => {
      const mockResidences = [
        {
          id: 'res-zero',
          buildingId: 'test-building',
          unitNumber: '101',
          monthlyFees: '0.00',
          isActive: true
        },
        {
          id: 'res-null',
          buildingId: 'test-building', 
          unitNumber: '102',
          monthlyFees: null,
          isActive: true
        }
      ];

      mockDb.execute
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ success: true }] });

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
      };

      mockDb.select
        .mockReturnValueOnce(mockSelect as any)
        .mockReturnValueOnce(mockSelect as any);

      mockSelect.from
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockResidences);

      const result = await calculator.getFinancialData(
        'test-building',
        '2024-01-01',
        '2024-12-31'
      );

      // Should handle zero/null fees gracefully
      expect(result.monthlyData[0].totalIncome).toBe(0);
      expect(result.summary.totalIncome).toBe(0);
    });

    it('should handle custom schedule with missing dates', async () => {
      const mockBills = [
        {
          id: 'bill-custom',
          buildingId: 'test-building',
          title: 'Custom Schedule Bill',
          category: 'maintenance',
          totalAmount: '5000.00',
          costs: ['5000.00'],
          schedulePayment: 'custom',
          scheduleCustom: ['2024-03-15', '2024-09-15'],
          startDate: '2024-01-01',
          endDate: null,
          paymentType: 'recurrent'
        }
      ];

      mockDb.execute
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ success: true }] });

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
      };

      mockDb.select
        .mockReturnValueOnce(mockSelect as any)
        .mockReturnValueOnce(mockSelect as any);

      mockSelect.from
        .mockResolvedValueOnce(mockBills)
        .mockResolvedValueOnce([]);

      const result = await calculator.getFinancialData(
        'test-building',
        '2024-01-01',
        '2024-12-31'
      );

      // Should only charge in March and September
      expect(result.monthlyData[2].expensesByCategory.maintenance_expense).toBe(5000); // March
      expect(result.monthlyData[8].expensesByCategory.maintenance_expense).toBe(5000); // September
      expect(result.monthlyData[0].expensesByCategory.maintenance_expense).toBeUndefined(); // January
      expect(result.monthlyData[4].expensesByCategory.maintenance_expense).toBeUndefined(); // May
    });
  });

  describe('Performance Tests', () => {
    it('should complete calculation within reasonable time', async () => {
      const startTime = Date.now();

      // Mock large dataset
      const largeBillsDataset = Array.from({ length: 50 }, (_, i) => ({
        id: `bill-${i}`,
        buildingId: 'perf-test-building',
        title: `Bill ${i}`,
        category: 'utilities',
        totalAmount: '1000.00',
        costs: ['1000.00'],
        schedulePayment: 'monthly',
        scheduleCustom: null,
        startDate: '2024-01-01',
        endDate: null,
        paymentType: 'recurrent'
      }));

      const largeResidencesDataset = Array.from({ length: 200 }, (_, i) => ({
        id: `res-${i}`,
        buildingId: 'perf-test-building',
        unitNumber: `${i + 101}`,
        monthlyFees: '1500.00',
        isActive: true
      }));

      mockDb.execute
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ success: true }] });

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
      };

      mockDb.select
        .mockReturnValueOnce(mockSelect as any)
        .mockReturnValueOnce(mockSelect as any);

      mockSelect.from
        .mockResolvedValueOnce(largeBillsDataset)
        .mockResolvedValueOnce(largeResidencesDataset);

      const result = await calculator.getFinancialData(
        'perf-test-building',
        '2024-01-01',
        '2024-12-31'
      );

      const executionTime = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(result.monthlyData).toHaveLength(12);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle multi-year calculations efficiently', async () => {
      mockDb.execute
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ success: true }] });

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
      };

      mockDb.select
        .mockReturnValueOnce(mockSelect as any)
        .mockReturnValueOnce(mockSelect as any);

      mockSelect.from
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await calculator.getFinancialData(
        'multi-year-building',
        '2020-01-01',
        '2029-12-31' // 10 years
      );

      expect(result.monthlyData).toHaveLength(120); // 12 months * 10 years
      expect(result.summary).toBeDefined();
    });
  });

  describe('Data Validation', () => {
    it('should validate date ranges', async () => {
      await expect(
        calculator.getFinancialData(
          'test-building',
          '2024-12-31', // End date before start date
          '2024-01-01'
        )
      ).resolves.toBeDefined(); // Should handle gracefully, not throw

      const result = await calculator.getFinancialData(
        'test-building',
        '2024-12-31',
        '2024-01-01'
      );
      
      expect(result.monthlyData).toHaveLength(0); // No months in invalid range
    });

    it('should validate building ID format', async () => {
      mockDb.execute
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ success: true }] });

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
      };

      mockDb.select
        .mockReturnValueOnce(mockSelect as any)
        .mockReturnValueOnce(mockSelect as any);

      mockSelect.from
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // Should handle empty or malformed building IDs
      const result = await calculator.getFinancialData(
        '', // Empty building ID
        '2024-01-01',
        '2024-12-31'
      );

      expect(result).toBeDefined();
      expect(result.buildingId).toBe('');
    });
  });
});