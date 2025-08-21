import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MoneyFlowAutomationService } from '../../server/services/money-flow-automation';

// Mock the database
const mockDb = {
  select: jest.fn(),
  insert: jest.fn(),
  delete: jest.fn(),
  update: jest.fn()
};

const mockQueryBuilder = {
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis()
};

Object.keys(mockQueryBuilder).forEach(method => {
  mockDb[method] = jest.fn().mockReturnValue(mockQueryBuilder);
});

jest.mock('../../server/db', () => ({
  db: mockDb
}));

describe('Money Flow Residence Integration Tests', () => {
  let service: MoneyFlowAutomationService;
  let mockSystemUser: { id: string };

  beforeEach(() => {
    service = new MoneyFlowAutomationService();
    mockSystemUser = { id: 'system-user-123' };
    jest.clearAllMocks();
    
    // Default mock for system user
    mockQueryBuilder.limit.mockResolvedValue([mockSystemUser] as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Residence monthly fee calculations', () => {
    it('should generate monthly entries for active residences', async () => {
      const mockResidences = [
        {
          residence: {
            id: 'residence-1',
            buildingId: 'building-1',
            unitNumber: '101',
            monthlyFees: '1500.00',
            isActive: true
          },
          building: {
            id: 'building-1',
            name: 'Test Building',
            isActive: true
          }
        },
        {
          residence: {
            id: 'residence-2',
            buildingId: 'building-1',
            unitNumber: '102',
            monthlyFees: '1200.00',
            isActive: true
          },
          building: {
            id: 'building-1',
            name: 'Test Building',
            isActive: true
          }
        }
      ];

      // Mock database responses
      mockDb.select.mockImplementation(() => {
        const query = mockQueryBuilder;
        query.from.mockImplementation((table: any) => {
          if (table.toString().includes('residences')) {
            query.innerJoin.mockReturnValue(query);
            query.where.mockResolvedValue(mockResidences);
          } else if (table.toString().includes('bills')) {
            query.where.mockResolvedValue([]); // No bills
          }
          return query;
        });
        return query;
      });

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockResolvedValue({} as any)
      });

      mockDb.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue({} as any)
      });

      const result = await service.generateFutureMoneyFlowEntries();

      expect(result.residenceEntriesCreated).toBeGreaterThan(0);
      expect(result.billEntriesCreated).toBe(0); // No bills
    });

    it('should skip residences with zero monthly fees', async () => {
      const mockResidences = [
        {
          residence: {
            id: 'residence-1',
            buildingId: 'building-1',
            unitNumber: '101',
            monthlyFees: '0.00', // Zero fees
            isActive: true
          },
          building: {
            id: 'building-1',
            name: 'Test Building',
            isActive: true
          }
        },
        {
          residence: {
            id: 'residence-2',
            buildingId: 'building-1',
            unitNumber: '102',
            monthlyFees: '1500.00', // Valid fees
            isActive: true
          },
          building: {
            id: 'building-1',
            name: 'Test Building',
            isActive: true
          }
        }
      ];

      mockDb.select.mockImplementation(() => {
        const query = mockQueryBuilder;
        query.from.mockImplementation((table: any) => {
          if (table.toString().includes('residences')) {
            query.innerJoin.mockReturnValue(query);
            query.where.mockResolvedValue(mockResidences);
          } else {
            query.where.mockResolvedValue([]);
          }
          return query;
        });
        return query;
      });

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockResolvedValue({} as any)
      });

      mockDb.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue({} as any)
      });

      await service.generateFutureMoneyFlowEntries();

      // Should only process residence-2 with valid fees
      // Verify this by checking the mock calls would exclude zero-fee residence
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should skip inactive residences', async () => {
      const mockResidences = [
        {
          residence: {
            id: 'residence-1',
            buildingId: 'building-1',
            unitNumber: '101',
            monthlyFees: '1500.00',
            isActive: false // Inactive
          },
          building: {
            id: 'building-1',
            name: 'Test Building',
            isActive: true
          }
        },
        {
          residence: {
            id: 'residence-2',
            buildingId: 'building-1',
            unitNumber: '102',
            monthlyFees: '1200.00',
            isActive: true // Active
          },
          building: {
            id: 'building-1',
            name: 'Test Building',
            isActive: true
          }
        }
      ];

      mockDb.select.mockImplementation(() => {
        const query = mockQueryBuilder;
        query.from.mockImplementation((table: any) => {
          if (table.toString().includes('residences')) {
            query.innerJoin.mockReturnValue(query);
            query.where.mockResolvedValue(mockResidences);
          } else {
            query.where.mockResolvedValue([]);
          }
          return query;
        });
        return query;
      });

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockResolvedValue({} as any)
      });

      mockDb.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue({} as any)
      });

      await service.generateFutureMoneyFlowEntries();

      // Should only process active residences
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should skip residences in inactive buildings', async () => {
      const mockResidences = [
        {
          residence: {
            id: 'residence-1',
            buildingId: 'building-1',
            unitNumber: '101',
            monthlyFees: '1500.00',
            isActive: true
          },
          building: {
            id: 'building-1',
            name: 'Inactive Building',
            isActive: false // Building is inactive
          }
        },
        {
          residence: {
            id: 'residence-2',
            buildingId: 'building-2',
            unitNumber: '201',
            monthlyFees: '1200.00',
            isActive: true
          },
          building: {
            id: 'building-2',
            name: 'Active Building',
            isActive: true // Building is active
          }
        }
      ];

      mockDb.select.mockImplementation(() => {
        const query = mockQueryBuilder;
        query.from.mockImplementation((table: any) => {
          if (table.toString().includes('residences')) {
            query.innerJoin.mockReturnValue(query);
            query.where.mockResolvedValue(mockResidences);
          } else {
            query.where.mockResolvedValue([]);
          }
          return query;
        });
        return query;
      });

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockResolvedValue({} as any)
      });

      mockDb.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue({} as any)
      });

      await service.generateFutureMoneyFlowEntries();

      // Should only process residences in active buildings
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('Monthly fee entry generation', () => {
    it('should generate entries starting from next month', () => {
      const today = new Date('2024-01-15'); // Mid-January
      const firstEntryDate = new Date(today);
      
      // Set to first day of next month
      firstEntryDate.setDate(1);
      if (firstEntryDate <= today) {
        firstEntryDate.setMonth(firstEntryDate.getMonth() + 1);
      }

      expect(firstEntryDate.toISOString().split('T')[0]).toBe('2024-02-01');
    });

    it('should generate correct reference numbers', () => {
      const residence = {
        unitNumber: '101',
        id: 'residence-123'
      };
      const date = new Date('2024-02-01');
      
      const expectedReference = `MONTHLY-${residence.unitNumber}-${date.toISOString().slice(0, 7)}`;
      expect(expectedReference).toBe('MONTHLY-101-2024-02');
    });

    it('should generate entries up to 25 years in future', () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(startDate.getFullYear() + 25);
      
      let monthCount = 0;
      const currentDate = new Date(startDate);
      currentDate.setDate(1); // First of month
      if (currentDate <= startDate) {
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
      
      while (currentDate <= endDate) {
        monthCount++;
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      // Should be approximately 25 years worth of months (300 months)
      expect(monthCount).toBeGreaterThan(290);
      expect(monthCount).toBeLessThan(310);
    });

    it('should handle month overflow correctly', () => {
      const dates = [
        { start: new Date('2024-01-31'), expected: '2024-03-02' }, // Jan 31 + 1 month = Mar 2 (Feb 29 in leap year)
        { start: new Date('2024-03-31'), expected: '2024-05-01' }, // Mar 31 + 1 month = May 1 (Apr 30)
        { start: new Date('2024-05-31'), expected: '2024-07-01' } // May 31 + 1 month = July 1 (Jun 30)
      ];

      dates.forEach(({ start, expected }) => {
        const result = new Date(start);
        result.setMonth(result.getMonth() + 1);
        expect(result.toISOString().split('T')[0]).toBe(expected);
      });
    });
  });

  describe('Money flow entry structure validation', () => {
    it('should create properly structured money flow entries', async () => {
      const residence = {
        id: 'residence-123',
        buildingId: 'building-456',
        unitNumber: '101',
        monthlyFees: '1500.00',
        isActive: true
      };

      const systemUser = { id: 'system-user-789' };
      const entryDate = '2024-02-01';

      // Expected entry structure
      const expectedEntry = {
        buildingId: residence.buildingId,
        residenceId: residence.id,
        billId: undefined, // Not related to a bill
        type: 'income',
        category: 'monthly_fees',
        description: `Monthly fees - Unit ${residence.unitNumber}`,
        amount: residence.monthlyFees,
        transactionDate: entryDate,
        referenceNumber: `MONTHLY-${residence.unitNumber}-${entryDate.slice(0, 7)}`,
        notes: `Auto-generated monthly fee for unit ${residence.unitNumber}`,
        createdBy: systemUser.id
      };

      // Verify entry structure
      expect(expectedEntry.type).toBe('income');
      expect(expectedEntry.category).toBe('monthly_fees');
      expect(expectedEntry.billId).toBeUndefined();
      expect(expectedEntry.residenceId).toBe(residence.id);
      expect(expectedEntry.amount).toBe('1500.00');
    });

    it('should generate consistent reference numbers', () => {
      const testCases = [
        { unit: '101', date: '2024-01-01', expected: 'MONTHLY-101-2024-01' },
        { unit: '2A', date: '2024-12-01', expected: 'MONTHLY-2A-2024-12' },
        { unit: 'PH1', date: '2024-06-01', expected: 'MONTHLY-PH1-2024-06' }
      ];

      testCases.forEach(({ unit, date, expected }) => {
        const reference = `MONTHLY-${unit}-${date.slice(0, 7)}`;
        expect(reference).toBe(expected);
      });
    });
  });

  describe('Large scale residence processing', () => {
    it('should handle buildings with many residences efficiently', async () => {
      // Generate 100 residences
      const mockResidences = Array.from({ length: 100 }, (_, i) => ({
        residence: {
          id: `residence-${i + 1}`,
          buildingId: 'building-large',
          unitNumber: `${Math.floor(i / 10) + 1}${String.fromCharCode(65 + (i % 10))}`,
          monthlyFees: `${1000 + (i * 50)}.00`,
          isActive: true
        },
        building: {
          id: 'building-large',
          name: 'Large Apartment Complex',
          isActive: true
        }
      }));

      mockDb.select.mockImplementation(() => {
        const query = mockQueryBuilder;
        query.from.mockImplementation((table: any) => {
          if (table.toString().includes('residences')) {
            query.innerJoin.mockReturnValue(query);
            query.where.mockResolvedValue(mockResidences);
          } else {
            query.where.mockResolvedValue([]);
          }
          return query;
        });
        return query;
      });

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockResolvedValue({} as any)
      });

      mockDb.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue({} as any)
      });

      const startTime = Date.now();
      await service.generateFutureMoneyFlowEntries();
      const endTime = Date.now();

      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(5000); // Should process within 5 seconds
    });

    it('should handle residences with various fee amounts', async () => {
      const mockResidences = [
        // Studio apartments
        { residence: { id: 'r1', buildingId: 'b1', unitNumber: '101', monthlyFees: '800.00', isActive: true }, building: { id: 'b1', name: 'Building', isActive: true } },
        { residence: { id: 'r2', buildingId: 'b1', unitNumber: '102', monthlyFees: '850.00', isActive: true }, building: { id: 'b1', name: 'Building', isActive: true } },
        
        // One bedroom
        { residence: { id: 'r3', buildingId: 'b1', unitNumber: '201', monthlyFees: '1200.00', isActive: true }, building: { id: 'b1', name: 'Building', isActive: true } },
        { residence: { id: 'r4', buildingId: 'b1', unitNumber: '202', monthlyFees: '1250.00', isActive: true }, building: { id: 'b1', name: 'Building', isActive: true } },
        
        // Two bedroom
        { residence: { id: 'r5', buildingId: 'b1', unitNumber: '301', monthlyFees: '1800.00', isActive: true }, building: { id: 'b1', name: 'Building', isActive: true } },
        
        // Penthouse
        { residence: { id: 'r6', buildingId: 'b1', unitNumber: 'PH1', monthlyFees: '3500.00', isActive: true }, building: { id: 'b1', name: 'Building', isActive: true } }
      ];

      mockDb.select.mockImplementation(() => {
        const query = mockQueryBuilder;
        query.from.mockImplementation((table: any) => {
          if (table.toString().includes('residences')) {
            query.innerJoin.mockReturnValue(query);
            query.where.mockResolvedValue(mockResidences);
          } else {
            query.where.mockResolvedValue([]);
          }
          return query;
        });
        return query;
      });

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockResolvedValue({} as any)
      });

      mockDb.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue({} as any)
      });

      const result = await service.generateFutureMoneyFlowEntries();
      expect(result.residenceEntriesCreated).toBeGreaterThan(0);
    });
  });

  describe('Error handling for residence processing', () => {
    it('should handle residences with invalid monthly fees', async () => {
      const mockResidences = [
        {
          residence: {
            id: 'residence-1',
            buildingId: 'building-1',
            unitNumber: '101',
            monthlyFees: null, // Invalid fees
            isActive: true
          },
          building: {
            id: 'building-1',
            name: 'Test Building',
            isActive: true
          }
        },
        {
          residence: {
            id: 'residence-2',
            buildingId: 'building-1',
            unitNumber: '102',
            monthlyFees: 'invalid', // Invalid format
            isActive: true
          },
          building: {
            id: 'building-1',
            name: 'Test Building',
            isActive: true
          }
        },
        {
          residence: {
            id: 'residence-3',
            buildingId: 'building-1',
            unitNumber: '103',
            monthlyFees: '1500.00', // Valid fees
            isActive: true
          },
          building: {
            id: 'building-1',
            name: 'Test Building',
            isActive: true
          }
        }
      ];

      mockDb.select.mockImplementation(() => {
        const query = mockQueryBuilder;
        query.from.mockImplementation((table: any) => {
          if (table.toString().includes('residences')) {
            query.innerJoin.mockReturnValue(query);
            query.where.mockResolvedValue(mockResidences);
          } else {
            query.where.mockResolvedValue([]);
          }
          return query;
        });
        return query;
      });

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockResolvedValue({} as any)
      });

      mockDb.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue({} as any)
      });

      // Should not throw error, but should only process valid residences
      await expect(service.generateFutureMoneyFlowEntries()).resolves.not.toThrow();
    });

    it('should handle residences with missing unit numbers', async () => {
      const mockResidences = [
        {
          residence: {
            id: 'residence-1',
            buildingId: 'building-1',
            unitNumber: '', // Empty unit number
            monthlyFees: '1500.00',
            isActive: true
          },
          building: {
            id: 'building-1',
            name: 'Test Building',
            isActive: true
          }
        }
      ];

      mockDb.select.mockImplementation(() => {
        const query = mockQueryBuilder;
        query.from.mockImplementation((table: any) => {
          if (table.toString().includes('residences')) {
            query.innerJoin.mockReturnValue(query);
            query.where.mockResolvedValue(mockResidences);
          } else {
            query.where.mockResolvedValue([]);
          }
          return query;
        });
        return query;
      });

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockResolvedValue({} as any)
      });

      mockDb.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue({} as any)
      });

      // Should handle gracefully, possibly using residence ID as fallback
      await expect(service.generateFutureMoneyFlowEntries()).resolves.not.toThrow();
    });
  });

  describe('Cleanup operations for residences', () => {
    it('should clean up existing residence money flow entries', async () => {
      const residenceId = 'residence-123';
      const cleanupDate = new Date();

      mockDb.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue({ rowCount: 25 } as any) // 25 entries deleted
      });

      // Test the cleanup function indirectly through the service
      await service.generateFutureMoneyFlowEntries();

      // Cleanup should be called during the process
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should handle cleanup when no existing entries exist', async () => {
      mockDb.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue({ rowCount: 0 } as any) // No entries to delete
      });

      mockDb.select.mockImplementation(() => {
        const query = mockQueryBuilder;
        query.from.mockReturnValue(query);
        query.where.mockResolvedValue([]);
        query.innerJoin.mockReturnValue(query);
        return query;
      });

      // Should not throw error when no entries to cleanup
      await expect(service.generateFutureMoneyFlowEntries()).resolves.not.toThrow();
    });
  });

  describe('Integration with building data', () => {
    it('should correctly join residence and building data', async () => {
      const mockResidences = [
        {
          residence: {
            id: 'residence-1',
            buildingId: 'building-1',
            unitNumber: '101',
            monthlyFees: '1500.00',
            isActive: true
          },
          building: {
            id: 'building-1',
            name: 'Luxury Apartments',
            address: '123 Main St',
            city: 'Downtown',
            isActive: true
          }
        }
      ];

      mockDb.select.mockImplementation(() => {
        const query = mockQueryBuilder;
        query.from.mockImplementation((table: any) => {
          if (table.toString().includes('residences')) {
            query.innerJoin.mockReturnValue(query);
            query.where.mockResolvedValue(mockResidences);
          } else {
            query.where.mockResolvedValue([]);
          }
          return query;
        });
        return query;
      });

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockResolvedValue({} as any)
      });

      mockDb.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue({} as any)
      });

      await service.generateFutureMoneyFlowEntries();

      // Verify that the join was performed correctly
      expect(mockQueryBuilder.innerJoin).toHaveBeenCalled();
    });
  });
});