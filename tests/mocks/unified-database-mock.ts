/**
 * Unified Database Mock for Koveo Gestion Test Suite
 * Provides centralized mock implementation for all database operations
 * Used by unit tests to prevent real database connections
 */

import { jest } from '@jest/globals';

// Mock drizzle-orm operators
export const eq = jest.fn().mockImplementation((column, value) => ({
  type: 'eq', 
  column, 
  value
}));

export const and = jest.fn().mockImplementation((...conditions) => ({
  type: 'and', 
  conditions
}));

export const or = jest.fn().mockImplementation((...conditions) => ({
  type: 'or', 
  conditions
}));

export const sql = jest.fn().mockImplementation((strings, ...values) => ({
  sql: Array.isArray(strings) ? strings.join('?') : strings,
  params: values
}));

export const gte = jest.fn().mockImplementation((column, value) => ({
  type: 'gte',
  column,
  value
}));

export const lte = jest.fn().mockImplementation((column, value) => ({
  type: 'lte', 
  column,
  value
}));

// Mock database query interface
export const mockDb = {
  // Query interface for table operations
  query: {
    users: {
      findFirst: jest.fn<() => Promise<any>>().mockResolvedValue(null),
      findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    },
    organizations: {
      findFirst: jest.fn<() => Promise<any>>().mockResolvedValue(null),
      findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    },
    buildings: {
      findFirst: jest.fn<() => Promise<any>>().mockImplementation(() => {
        return Promise.resolve(mockBudgetData.buildings[0] || null);
      }),
      findMany: jest.fn<() => Promise<any[]>>().mockImplementation(() => {
        return Promise.resolve(mockBudgetData.buildings);
      }),
    },
    residences: {
      findFirst: jest.fn<() => Promise<any>>().mockResolvedValue(null),
      findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    },
    bills: {
      findFirst: jest.fn<() => Promise<any>>().mockImplementation(() => {
        const allBills = [...mockBudgetData.recurrentBills, ...mockBudgetData.uniqueBills];
        return Promise.resolve(allBills[0] || null);
      }),
      findMany: jest.fn<() => Promise<any[]>>().mockImplementation(() => {
        return Promise.resolve([...mockBudgetData.recurrentBills, ...mockBudgetData.uniqueBills]);
      }),
    },
    budgets: {
      findFirst: jest.fn<() => Promise<any>>().mockImplementation(() => {
        return Promise.resolve(mockBudgetData.budgets[0] || null);
      }),
      findMany: jest.fn<() => Promise<any[]>>().mockImplementation(() => {
        return Promise.resolve(mockBudgetData.budgets);
      }),
    },
    monthlyBudgets: {
      findFirst: jest.fn<() => Promise<any>>().mockResolvedValue(null),
      findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    },
    invitations: {
      findFirst: jest.fn<() => Promise<any>>().mockResolvedValue(null),
      findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    },
    userOrganizations: {
      findFirst: jest.fn<() => Promise<any>>().mockResolvedValue(null),
      findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    },
    documents: {
      findFirst: jest.fn<() => Promise<any>>().mockResolvedValue(null),
      findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    },
    maintenanceRequests: {
      findFirst: jest.fn<() => Promise<any>>().mockResolvedValue(null),
      findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    },
  },
  
  // Direct operation methods  
  select: jest.fn<() => any>().mockImplementation(() => ({
    from: jest.fn<() => any>().mockImplementation((table: any) => {
      const tableName = table?._?.name || table?.name || 'unknown';
      
      return {
        where: jest.fn<() => any>().mockImplementation((condition: any) => ({
          limit: jest.fn<() => Promise<any[]>>().mockImplementation((limitCount: number = 1) => {
            // Return appropriate mock data based on table
            if (tableName === 'buildings') {
              return Promise.resolve(mockBudgetData.buildings.slice(0, limitCount));
            }
            if (tableName === 'budgets') {
              return Promise.resolve(mockBudgetData.budgets.slice(0, limitCount));
            }
            if (tableName === 'bills') {
              // Check if looking for recurrent or unique bills based on condition
              if (condition && condition.column && condition.column.name === 'isRecurrent' && condition.value === true) {
                return Promise.resolve(mockBudgetData.recurrentBills.slice(0, limitCount));
              }
              if (condition && condition.column && condition.column.name === 'isRecurrent' && condition.value === false) {
                return Promise.resolve(mockBudgetData.uniqueBills.slice(0, limitCount));
              }
              return Promise.resolve([...mockBudgetData.recurrentBills, ...mockBudgetData.uniqueBills].slice(0, limitCount));
            }
            return Promise.resolve([]);
          }),
          orderBy: jest.fn<() => any>().mockReturnValue({
            limit: jest.fn<() => Promise<any[]>>().mockImplementation((limitCount: number = 1) => {
              if (tableName === 'buildings') {
                return Promise.resolve(mockBudgetData.buildings.slice(0, limitCount));
              }
              if (tableName === 'budgets') {
                return Promise.resolve(mockBudgetData.budgets.slice(0, limitCount));
              }
              if (tableName === 'bills') {
                return Promise.resolve([...mockBudgetData.recurrentBills, ...mockBudgetData.uniqueBills].slice(0, limitCount));
              }
              return Promise.resolve([]);
            })
          })
        })),
        limit: jest.fn<() => Promise<any[]>>().mockImplementation((limitCount: number = 1) => {
          if (tableName === 'buildings') {
            return Promise.resolve(mockBudgetData.buildings.slice(0, limitCount));
          }
          if (tableName === 'budgets') {
            return Promise.resolve(mockBudgetData.budgets.slice(0, limitCount));
          }
          if (tableName === 'bills') {
            return Promise.resolve([...mockBudgetData.recurrentBills, ...mockBudgetData.uniqueBills].slice(0, limitCount));
          }
          return Promise.resolve([]);
        }),
        orderBy: jest.fn<() => any>().mockReturnValue({
          limit: jest.fn<() => Promise<any[]>>().mockImplementation((limitCount: number = 1) => {
            if (tableName === 'buildings') {
              return Promise.resolve(mockBudgetData.buildings.slice(0, limitCount));
            }
            if (tableName === 'budgets') {
              return Promise.resolve(mockBudgetData.budgets.slice(0, limitCount));
            }
            if (tableName === 'bills') {
              return Promise.resolve([...mockBudgetData.recurrentBills, ...mockBudgetData.uniqueBills].slice(0, limitCount));
            }
            return Promise.resolve([]);
          })
        })
      };
    })
  })),
  
  insert: jest.fn<(table: any) => any>().mockReturnValue({
    values: jest.fn<(values: any) => any>().mockReturnValue({
      returning: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
      onConflictDoUpdate: jest.fn<() => any>().mockReturnValue({
        returning: jest.fn<() => Promise<any[]>>().mockResolvedValue([])
      })
    }),
    returning: jest.fn<() => Promise<any[]>>().mockResolvedValue([])
  }),
  
  update: jest.fn<() => any>().mockReturnValue({
    set: jest.fn<() => any>().mockReturnValue({
      where: jest.fn<() => any>().mockReturnValue({
        returning: jest.fn<() => Promise<any[]>>().mockResolvedValue([])
      })
    })
  }),
  
  delete: jest.fn<() => any>().mockReturnValue({
    where: jest.fn<() => Promise<any[]>>().mockResolvedValue([])
  }),

  // Transaction support
  transaction: jest.fn<(callback: any) => Promise<any>>().mockImplementation(async (callback: any) => {
    return await callback(mockDb);
  })
};

// Mock schema objects - simple objects that behave like drizzle tables
export const mockSchema = {
  users: {
    id: { name: 'id' },
    email: { name: 'email' },
    username: { name: 'username' },
    firstName: { name: 'firstName' },
    lastName: { name: 'lastName' },
    role: { name: 'role' },
    organizationId: { name: 'organizationId' },
    isActive: { name: 'isActive' },
    createdAt: { name: 'createdAt' },
    updatedAt: { name: 'updatedAt' }
  },
  
  organizations: {
    id: { name: 'id' },
    name: { name: 'name' },
    type: { name: 'type' },
    address: { name: 'address' },
    city: { name: 'city' },
    province: { name: 'province' },
    postalCode: { name: 'postalCode' },
    createdAt: { name: 'createdAt' }
  },
  
  buildings: {
    id: { name: 'id' },
    name: { name: 'name' },
    organizationId: { name: 'organizationId' },
    address: { name: 'address' },
    city: { name: 'city' },
    province: { name: 'province' },
    postalCode: { name: 'postalCode' },
    bankAccountStartAmount: { name: 'bankAccountStartAmount' },
    bankAccountMinimums: { name: 'bankAccountMinimums' },
    generalInflationRate: { name: 'generalInflationRate' },
    revenueInflationRate: { name: 'revenueInflationRate' },
    createdAt: { name: 'createdAt' }
  },
  
  residences: {
    id: { name: 'id' },
    buildingId: { name: 'buildingId' },
    unit: { name: 'unit' },
    floor: { name: 'floor' },
    type: { name: 'type' },
    squareFootage: { name: 'squareFootage' },
    createdAt: { name: 'createdAt' }
  },
  
  bills: {
    id: { name: 'id' },
    buildingId: { name: 'buildingId' },
    name: { name: 'name' },
    description: { name: 'description' },
    amount: { name: 'amount' },
    dueDate: { name: 'dueDate' },
    isRecurrent: { name: 'isRecurrent' },
    frequency: { name: 'frequency' },
    createdAt: { name: 'createdAt' }
  },
  
  budgets: {
    id: { name: 'id' },
    buildingId: { name: 'buildingId' },
    year: { name: 'year' },
    totalBudget: { name: 'totalBudget' },
    createdAt: { name: 'createdAt' }
  },
  
  monthlyBudgets: {
    id: { name: 'id' },
    budgetId: { name: 'budgetId' },
    month: { name: 'month' },
    year: { name: 'year' },
    plannedRevenue: { name: 'plannedRevenue' },
    actualRevenue: { name: 'actualRevenue' },
    plannedExpenses: { name: 'plannedExpenses' },
    actualExpenses: { name: 'actualExpenses' },
    bankAccountBalance: { name: 'bankAccountBalance' },
    createdAt: { name: 'createdAt' }
  },
  
  invitations: {
    id: { name: 'id' },
    email: { name: 'email' },
    token: { name: 'token' },
    tokenHash: { name: 'tokenHash' },
    role: { name: 'role' },
    status: { name: 'status' },
    organizationId: { name: 'organizationId' },
    invitedByUserId: { name: 'invitedByUserId' },
    expiresAt: { name: 'expiresAt' },
    acceptedAt: { name: 'acceptedAt' },
    createdAt: { name: 'createdAt' }
  },
  
  userOrganizations: {
    id: { name: 'id' },
    userId: { name: 'userId' },
    organizationId: { name: 'organizationId' },
    createdAt: { name: 'createdAt' }
  }
};

// Mock data store for budget API tests
const mockBudgetData = {
  // Test buildings with proper financial configuration
  buildings: [
    {
      id: 'test-building-id',
      name: 'Test Building',
      organizationId: 'test-org-id',
      address: '123 Test St',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A 1A1',
      bankAccountStartAmount: '100000',
      bankAccountMinimums: '10000',
      generalInflationRate: '2.0',
      revenueInflationRate: '2.0',
      createdAt: new Date('2024-01-01'),
    },
    {
      id: 'negative-balance-building',
      name: 'Negative Balance Test Building',
      organizationId: 'test-org-id',
      address: '456 Test Ave',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1B 1B1',
      bankAccountStartAmount: '50000',
      bankAccountMinimums: '100000',
      generalInflationRate: '5.0',
      revenueInflationRate: '1.0',
      createdAt: new Date('2024-01-01'),
    }
  ],
  
  // Test budgets with income and spending data
  budgets: [
    {
      id: 'budget-1',
      buildingId: 'test-building-id',
      year: 2024,
      incomeTypes: ['monthly_fees'],
      incomes: ['50000'],
      spendingTypes: ['maintenance'],
      spendings: ['30000'],
      totalBudget: '20000',
      createdAt: new Date('2024-01-01'),
    },
    {
      id: 'budget-2',
      buildingId: 'test-building-id',
      year: 2025,
      incomeTypes: ['monthly_fees'],
      incomes: ['60000'],
      spendingTypes: ['utilities'],
      spendings: ['20000'],
      totalBudget: '40000',
      createdAt: new Date('2024-01-01'),
    },
    {
      id: 'budget-negative',
      buildingId: 'negative-balance-building',
      year: 2025,
      incomeTypes: ['monthly_fees'],
      incomes: ['60000'],
      spendingTypes: ['maintenance'],
      spendings: ['80000'],
      totalBudget: '-20000',
      createdAt: new Date('2024-01-01'),
    }
  ],
  
  // Test recurrent bills
  recurrentBills: [
    {
      id: 'bill-1',
      buildingId: 'negative-balance-building',
      category: 'maintenance',
      costs: ['80000'],
      schedulePayment: 'monthly',
      startDate: new Date('2025-01-01'),
      endDate: null,
    },
    {
      id: 'yearly-bill',
      buildingId: 'test-building-id',
      category: 'insurance',
      costs: ['12000'],
      schedulePayment: 'yearly',
      startDate: new Date('2025-01-01'),
      endDate: null,
    },
    {
      id: 'quarterly-bill',
      buildingId: 'test-building-id',
      category: 'maintenance',
      costs: ['9000'],
      schedulePayment: 'quarterly',
      startDate: new Date('2025-01-01'),
      endDate: null,
    }
  ],
  
  // Test unique bills (one-time expenses)
  uniqueBills: [
    {
      id: 'unique-1',
      buildingId: 'test-building-id',
      startDate: new Date('2025-01-01'),
      totalAmount: '500000',
      category: 'special_assessment',
    },
    {
      id: 'unique-2',
      buildingId: 'test-building-id',
      startDate: new Date('2026-01-01'),
      totalAmount: '750000',
      category: 'major_renovation',
    }
  ]
};

// Test utilities for managing mock state
export const testUtils = {
  // Reset all mocks to clean state
  resetMocks: jest.fn().mockImplementation(() => {
    jest.clearAllMocks();
    
    // Reset all query mocks
    Object.values(mockDb.query).forEach(table => {
      if (typeof table === 'object') {
        Object.values(table).forEach(method => {
          if (jest.isMockFunction(method)) {
            method.mockClear();
          }
        });
      }
    });
    
    // Reset operation method mocks
    if (jest.isMockFunction(mockDb.select)) mockDb.select.mockClear();
    if (jest.isMockFunction(mockDb.insert)) mockDb.insert.mockClear();
    if (jest.isMockFunction(mockDb.update)) mockDb.update.mockClear();
    if (jest.isMockFunction(mockDb.delete)) mockDb.delete.mockClear();
    if (jest.isMockFunction(mockDb.transaction)) mockDb.transaction.mockClear();
  }),
  
  // Setup mock data for specific tables
  setupMockData: jest.fn().mockImplementation((tableName: string, data: any[]) => {
    if (mockDb.query[tableName as keyof typeof mockDb.query]) {
      const table = mockDb.query[tableName as keyof typeof mockDb.query] as any;
      table.findMany.mockResolvedValue(data);
      if (data.length > 0) {
        table.findFirst.mockResolvedValue(data[0]);
      }
    }
  }),
  
  // Setup mock queries with custom implementations
  setupMockQuery: jest.fn().mockImplementation((tableName: string, method: string, implementation: any) => {
    if (mockDb.query[tableName as keyof typeof mockDb.query]) {
      const table = mockDb.query[tableName as keyof typeof mockDb.query] as any;
      if (table[method] && jest.isMockFunction(table[method])) {
        table[method].mockImplementation(implementation);
      }
    }
  }),
  
  // Verify mock calls
  verifyMockCalls: jest.fn().mockImplementation((tableName: string, method: string, expectedCalls: number) => {
    if (mockDb.query[tableName as keyof typeof mockDb.query]) {
      const table = mockDb.query[tableName as keyof typeof mockDb.query] as any;
      if (table[method] && jest.isMockFunction(table[method])) {
        expect(table[method]).toHaveBeenCalledTimes(expectedCalls);
      }
    }
  })
};

// Export all drizzle-orm operators for test compatibility
export * from 'drizzle-orm';

// Default export for convenience
export default {
  mockDb,
  mockSchema,
  testUtils,
  eq,
  and,
  or,
  sql,
  gte,
  lte
};