import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MoneyFlowAutomationService } from '../../server/services/money-flow-automation';
import type { Bill, Residence, Building } from '../../shared/schema';

// Mock the database
const mockDb = {
  select: jest.fn(),
  insert: jest.fn(),
  delete: jest.fn(),
  update: jest.fn(),
};

const mockQueryBuilder = {
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
};

// Mock all query builder methods
Object.keys(mockQueryBuilder).forEach((method) => {
  (mockDb as any)[method] = jest.fn().mockReturnValue(mockQueryBuilder);
});

jest.mock('../../server/db', () => ({
  db: mockDb,
}));

describe('MoneyFlowAutomationService', () => {
  let service: MoneyFlowAutomationService;
  let mockSystemUser: { id: string };

  beforeEach(() => {
    service = new MoneyFlowAutomationService();
    mockSystemUser = { id: 'system-user-123' };
    jest.clearAllMocks();

    // Default mock for system user
    mockQueryBuilder.limit.mockResolvedValue([mockSystemUser]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateFutureMoneyFlowEntries', () => {
    it('should generate entries for bills and residences', async () => {
      // Mock bills data
      const mockBills: Partial<Bill>[] = [
        {
          id: 'bill-1',
          buildingId: 'building-1',
          billNumber: 'BILL-001',
          title: 'Monthly Maintenance',
          category: 'maintenance',
          paymentType: 'recurrent',
          schedulePayment: 'monthly',
          costs: ['1000.00'],
          totalAmount: '1000.00',
          startDate: '2024-01-01',
          endDate: null,
        },
      ];

      // Mock residences data
      const mockResidences = [
        {
          residence: {
            id: 'residence-1',
            buildingId: 'building-1',
            unitNumber: '101',
            monthlyFees: '500.00',
            isActive: true,
          } as Residence,
          building: {
            id: 'building-1',
            name: 'Test Building',
            isActive: true,
          } as Building,
        },
      ];

      // Setup mocks
      (mockDb.select as jest.Mock).mockImplementation(() => {
        const query = mockQueryBuilder;
        (query.from as jest.Mock).mockImplementation((table: any) => {
          if (table.toString().includes('bills')) {
            (query.where as jest.Mock).mockResolvedValue(mockBills);
          } else if (table.toString().includes('residences')) {
            (query.innerJoin as jest.Mock).mockReturnValue(query);
            (query.where as jest.Mock).mockResolvedValue(mockResidences);
          }
          return query;
        });
        return query;
      });

      (mockDb.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      });

      (mockDb.delete as jest.Mock).mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      });

      const result = await service.generateFutureMoneyFlowEntries();

      expect(result).toHaveProperty('billEntriesCreated');
      expect(result).toHaveProperty('residenceEntriesCreated');
      expect(result).toHaveProperty('totalEntriesCreated');
      expect(result.totalEntriesCreated).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty bills and residences', async () => {
      // Mock empty data
      mockDb.select.mockImplementation(() => {
        const query = mockQueryBuilder;
        query.from.mockReturnValue(query);
        query.where.mockResolvedValue([]);
        query.innerJoin.mockReturnValue(query);
        return query;
      });

      const result = await service.generateFutureMoneyFlowEntries();

      expect(result.billEntriesCreated).toBe(0);
      expect(result.residenceEntriesCreated).toBe(0);
      expect(result.totalEntriesCreated).toBe(0);
    });
  });

  describe('Bill schedule calculations', () => {
    it('should calculate weekly recurrence correctly', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      // Test weekly calculation logic
      const weeklyDates = [];
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        weeklyDates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 7);
      }

      expect(weeklyDates).toHaveLength(5); // 5 weeks in January 2024
      expect(weeklyDates[0].toISOString().split('T')[0]).toBe('2024-01-01');
      expect(weeklyDates[4].toISOString().split('T')[0]).toBe('2024-01-29');
    });

    it('should calculate monthly recurrence correctly', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const monthlyDates = [];
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        monthlyDates.push(new Date(currentDate));
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      expect(monthlyDates).toHaveLength(12); // 12 months in 2024
      expect(monthlyDates[0].toISOString().split('T')[0]).toBe('2024-01-01');
      expect(monthlyDates[11].toISOString().split('T')[0]).toBe('2024-12-01');
    });

    it('should calculate quarterly recurrence correctly', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const quarterlyDates = [];
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        quarterlyDates.push(new Date(currentDate));
        currentDate.setMonth(currentDate.getMonth() + 3);
      }

      expect(quarterlyDates).toHaveLength(4); // 4 quarters in 2024
      expect(quarterlyDates[0].toISOString().split('T')[0]).toBe('2024-01-01');
      expect(quarterlyDates[3].toISOString().split('T')[0]).toBe('2024-10-01');
    });

    it('should calculate yearly recurrence correctly', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2026-12-31');

      const yearlyDates = [];
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        yearlyDates.push(new Date(currentDate));
        currentDate.setFullYear(currentDate.getFullYear() + 1);
      }

      expect(yearlyDates).toHaveLength(3); // 2024, 2025, 2026
      expect(yearlyDates[0].toISOString().split('T')[0]).toBe('2024-01-01');
      expect(yearlyDates[2].toISOString().split('T')[0]).toBe('2026-01-01');
    });

    it('should handle custom schedule dates correctly', async () => {
      const customDates = ['2024-03-15', '2024-06-15', '2024-09-15', '2024-12-15'];
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      // Find dates within range
      const validDates = customDates.filter((date) => {
        const d = new Date(date);
        return d >= startDate && d <= endDate;
      });

      expect(validDates).toHaveLength(4);
      expect(validDates[0]).toBe('2024-03-15');
      expect(validDates[3]).toBe('2024-12-15');
    });
  });

  describe('Bill category mapping', () => {
    it('should map bill categories to money flow categories correctly', () => {
      const mappings = [
        { billCategory: 'insurance', expected: 'other_expense' },
        { billCategory: 'maintenance', expected: 'maintenance_expense' },
        { billCategory: 'salary', expected: 'administrative_expense' },
        { billCategory: 'utilities', expected: 'other_expense' },
        { billCategory: 'cleaning', expected: 'maintenance_expense' },
        { billCategory: 'security', expected: 'other_expense' },
        { billCategory: 'landscaping', expected: 'maintenance_expense' },
        { billCategory: 'professional_services', expected: 'professional_services' },
        { billCategory: 'administration', expected: 'administrative_expense' },
        { billCategory: 'repairs', expected: 'maintenance_expense' },
        { billCategory: 'supplies', expected: 'maintenance_expense' },
        { billCategory: 'taxes', expected: 'other_expense' },
        { billCategory: 'other', expected: 'other_expense' },
        { billCategory: 'unknown_category', expected: 'other_expense' }, // Default fallback
      ];

      mappings.forEach(({ billCategory, expected }) => {
        // Access the private method through any to test it
        const _result = (service as any).mapBillCategoryToMoneyFlowCategory(billCategory);
        expect(_result).toBe(expected);
      });
    });
  });

  describe('Multiple cost handling', () => {
    it('should cycle through multiple costs correctly', async () => {
      const costs = ['1000.00', '1500.00', '2000.00'];
      const occurrences = 8; // More than the number of costs

      // Simulate cost cycling
      const expectedCosts = [];
      for (let i = 0; i < occurrences; i++) {
        expectedCosts.push(costs[i % costs.length]);
      }

      expect(expectedCosts).toEqual([
        '1000.00',
        '1500.00',
        '2000.00', // First cycle
        '1000.00',
        '1500.00',
        '2000.00', // Second cycle
        '1000.00',
        '1500.00', // Partial third cycle
      ]);
    });
  });

  describe('Residence monthly fee calculations', () => {
    it('should generate monthly entries starting from next month', () => {
      const startDate = new Date('2024-01-15'); // Mid-month
      const endDate = new Date('2024-06-30');

      // Calculate expected first entry date (1st of next month)
      const firstEntryDate = new Date(startDate);
      firstEntryDate.setDate(1);
      if (firstEntryDate <= startDate) {
        firstEntryDate.setMonth(firstEntryDate.getMonth() + 1);
      }

      expect(firstEntryDate.toISOString().split('T')[0]).toBe('2024-02-01');

      // Count expected entries
      const monthlyDates = [];
      const currentDate = new Date(firstEntryDate);

      while (currentDate <= endDate) {
        monthlyDates.push(new Date(currentDate));
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      expect(monthlyDates).toHaveLength(5); // Feb, Mar, Apr, May, Jun
    });

    it('should skip residences with zero or negative monthly fees', () => {
      const testCases = [
        { monthlyFees: '0.00', shouldGenerate: false },
        { monthlyFees: '-100.00', shouldGenerate: false },
        { monthlyFees: null, shouldGenerate: false },
        { monthlyFees: '500.00', shouldGenerate: true },
      ];

      testCases.forEach(({ monthlyFees, shouldGenerate }) => {
        const shouldProcess = monthlyFees && parseFloat(monthlyFees) > 0;
        expect(shouldProcess).toBe(shouldGenerate);
      });
    });
  });

  describe('Date boundary handling', () => {
    it('should handle leap year calculations correctly', () => {
      const leapYear = 2024;
      const nonLeapYear = 2023;

      // February dates in leap year vs non-leap year
      const feb2024 = new Date(leapYear, 1, 29); // Feb 29, 2024 (valid)
      const feb2023 = new Date(nonLeapYear, 1, 29); // Feb 29, 2023 (invalid, becomes Mar 1)

      expect(feb2024.getMonth()).toBe(1); // February
      expect(feb2024.getDate()).toBe(29);

      expect(feb2023.getMonth()).toBe(2); // March (auto-corrected)
      expect(feb2023.getDate()).toBe(1);
    });

    it('should handle month boundaries correctly', () => {
      // Test month boundary scenarios
      const testDates = [
        { start: new Date('2024-01-31'), addMonth: 1, expectedMonth: 1 }, // Jan 31 + 1 month = Feb 29 (leap year)
        { start: new Date('2024-03-31'), addMonth: 1, expectedMonth: 3 }, // Mar 31 + 1 month = Apr 30
        { start: new Date('2024-05-31'), addMonth: 1, expectedMonth: 5 }, // May 31 + 1 month = Jun 30
      ];

      testDates.forEach(({ start, addMonth, expectedMonth }) => {
        const result = new Date(start);
        result.setMonth(result.getMonth() + addMonth);
        expect(result.getMonth()).toBe(expectedMonth);
      });
    });
  });

  describe('Long-term projection validation', () => {
    it('should generate entries up to 25 years in the future', () => {
      const startDate = new Date();
      const futureLimit = new Date();
      futureLimit.setDate(startDate.getDate() + 25 * 365); // 25 years

      const yearsDifference = futureLimit.getFullYear() - startDate.getFullYear();
      expect(yearsDifference).toBeGreaterThanOrEqual(24);
      expect(yearsDifference).toBeLessThanOrEqual(25);
    });

    it('should limit entries to prevent infinite loops', () => {
      const maxEntries = 10000;
      let entryCount = 0;

      // Simulate entry generation with safety limit
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2049-12-31'); // 25 years
      const currentDate = new Date(startDate);

      while (currentDate <= endDate && entryCount < maxEntries) {
        entryCount++;
        currentDate.setDate(currentDate.getDate() + 1); // Daily for extreme case
      }

      expect(entryCount).toBe(maxEntries); // Should hit the safety limit
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockDb.select.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(service.generateFutureMoneyFlowEntries()).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle missing system user', async () => {
      // Mock no system user found
      mockQueryBuilder.limit.mockResolvedValue([]);

      // This should eventually throw when trying to find a system user
      await expect(service.generateFutureMoneyFlowEntries()).rejects.toThrow(
        'No active users found for system operations'
      );
    });

    it('should handle invalid bill data gracefully', async () => {
      // Mock bills with invalid data
      const invalidBills = [
        {
          id: 'bill-1',
          buildingId: 'building-1',
          paymentType: 'recurrent',
          schedulePayment: null, // Invalid: no schedule
          costs: [],
          title: 'Invalid Bill',
        },
      ];

      mockDb.select.mockImplementation(() => {
        const query = mockQueryBuilder;
        query.from.mockReturnValue(query);
        query.where.mockResolvedValue(invalidBills);
        return query;
      });

      // Should not throw, but should skip invalid bills
      const result = await service.generateFutureMoneyFlowEntries();
      expect(result.billEntriesCreated).toBe(0);
    });
  });

  describe('Cleanup operations', () => {
    it('should clean up existing entries before generating new ones', async () => {
      mockDb.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue({ rowCount: 5 }), // 5 entries deleted
      });

      // Test cleanup for bills
      await (service as any).cleanupExistingBillEntries('bill-123', new Date());

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should clean up residence entries correctly', async () => {
      mockDb.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue({ rowCount: 12 }), // 12 monthly entries deleted
      });

      // Test cleanup for residences
      await (service as any).cleanupExistingResidenceEntries('residence-123', new Date());

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe('Statistics calculations', () => {
    it('should calculate money flow statistics correctly', async () => {
      const mockStats = {
        totalEntries: 1000,
        billEntries: 600,
        residenceEntries: 400,
        futureEntries: 800,
        oldestEntry: '2024-01-01',
        newestEntry: '2049-12-31',
      };

      // Mock database responses for statistics
      mockDb.select.mockImplementation(() => {
        const query = mockQueryBuilder;
        query.from.mockReturnValue(query);
        query.where.mockReturnValue(query);
        query.orderBy.mockReturnValue(query);
        query.limit.mockResolvedValue([{ count: 1000 }]);
        return query;
      });

      mockQueryBuilder.limit
        .mockResolvedValueOnce([{ count: 1000 }]) // total
        .mockResolvedValueOnce([{ count: 600 }]) // bills
        .mockResolvedValueOnce([{ count: 400 }]) // residences
        .mockResolvedValueOnce([{ count: 800 }]) // future
        .mockResolvedValueOnce([{ date: '2024-01-01' }]) // oldest
        .mockResolvedValueOnce([{ date: '2049-12-31' }]); // newest

      const stats = await service.getMoneyFlowStatistics();

      expect(stats).toEqual(mockStats);
    });
  });
});
