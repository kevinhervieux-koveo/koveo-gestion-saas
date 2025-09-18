/**
 * @file Test Utilities for Budget Integration Tests
 * @description Shared utilities for test data creation, cleanup, mocking, and assertions
 */

import { sql } from '../../server/db';
import { v4 as uuidv4 } from 'uuid';

// Types for test data
export interface TestOrganization {
  id: string;
  name: string;
  domain: string;
}

export interface TestUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'demo_manager' | 'tenant' | 'resident';
}

export interface TestBuilding {
  id: string;
  organizationId: string;
  name: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  buildingType: 'apartment' | 'appartement' | 'condo' | 'rental';
  totalUnits: number;
  bankAccountStartAmount?: number;
  bankAccountMinimums?: string;
  generalInflationRate?: number;
  revenueInflationRate?: number;
  unplannedBillsAmount?: number;
  financialYearStart?: string;
  inflationSettings?: string;
  amenities?: any;
}

export interface TestResidence {
  id: string;
  buildingId: string;
  unitNumber: string;
  monthlyFees: number;
  isActive: boolean;
}

export interface TestCapitalInvestment {
  id: string;
  buildingId: string;
  title: string;
  description?: string;
  amount: number;
  targetDate: string;
  urgency: 'not_urgent' | 'urgent' | 'suggested';
  type: 'auto_generated' | 'custom';
  ownershipType: 'residences' | 'owner';
  category: string;
}

export interface TestBill {
  id: string;
  buildingId: string;
  billNumber: string;
  title: string;
  category: string;
  paymentType: 'unique' | 'recurrent';
  schedulePayment?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  costs: string[];
  totalAmount: number;
  startDate: string;
  endDate?: string;
  status: string;
  createdBy: string;
}

export interface TestMonthlyBudget {
  id: string;
  buildingId: string;
  year: number;
  month: number;
  incomeTypes: string[];
  incomes: string[];
  spendingTypes: string[];
  spendings: string[];
  approved: boolean;
}

/**
 * Test Data Factory - Creates realistic test data
 */
export class TestDataFactory {
  private static idCounter = 1;

  /**
   * Create a test organization
   */
  static createOrganization(overrides: Partial<TestOrganization> = {}): TestOrganization {
    const counter = this.idCounter++;
    return {
      id: uuidv4(),
      name: `Test Organization ${counter}`,
      domain: `test-org-${counter}.com`,
      ...overrides,
    };
  }

  /**
   * Create a test user
   */
  static createUser(overrides: Partial<TestUser> = {}): TestUser {
    const counter = this.idCounter++;
    return {
      id: uuidv4(),
      username: `testuser${counter}`,
      email: `testuser${counter}@example.com`,
      firstName: `Test`,
      lastName: `User${counter}`,
      role: 'admin',
      ...overrides,
    };
  }

  /**
   * Create a test building with realistic configuration
   */
  static createBuilding(organizationId: string, overrides: Partial<TestBuilding> = {}): TestBuilding {
    const counter = this.idCounter++;
    return {
      id: uuidv4(),
      organizationId,
      name: `Test Building ${counter}`,
      address: `${counter} Test Street`,
      city: 'Montreal',
      province: 'QC',
      postalCode: `H${counter}T ${counter}T${counter}`,
      buildingType: 'apartment',
      totalUnits: 50,
      bankAccountStartAmount: 200000,
      bankAccountMinimums: JSON.stringify({ emergencyFund: 20000, operatingCash: 10000 }),
      generalInflationRate: 2.5,
      revenueInflationRate: 3.0,
      unplannedBillsAmount: 2000,
      financialYearStart: '2024-01-01',
      inflationSettings: JSON.stringify({
        useGlobalBillsInflation: true,
        globalBillsInflationRate: 2.8,
        categoryInflationRates: {
          monthly_fees: 3.2,
          utilities: 2.7,
          maintenance: 3.0,
        },
      }),
      amenities: {
        emergencyFundMinimum: 20000,
        operatingCashMinimum: 10000,
        customBankFields: {
          reserveFund: 15000,
          maintenanceFund: 8000,
        },
        customRevenueLines: [
          { id: 'parking', description: 'Parking fees', monthlyAmount: 1500 },
          { id: 'laundry', description: 'Laundry income', monthlyAmount: 500 },
        ],
      },
      ...overrides,
    };
  }

  /**
   * Create a test residence
   */
  static createResidence(buildingId: string, overrides: Partial<TestResidence> = {}): TestResidence {
    const counter = this.idCounter++;
    return {
      id: uuidv4(),
      buildingId,
      unitNumber: `A${counter.toString().padStart(3, '0')}`,
      monthlyFees: 1500 + (counter % 5) * 100, // Vary between 1500-1900
      isActive: true,
      ...overrides,
    };
  }

  /**
   * Create a test capital investment
   */
  static createCapitalInvestment(buildingId: string, overrides: Partial<TestCapitalInvestment> = {}): TestCapitalInvestment {
    const counter = this.idCounter++;
    const urgencies: Array<'not_urgent' | 'urgent' | 'suggested'> = ['not_urgent', 'urgent', 'suggested'];
    const categories = ['maintenance', 'improvement', 'emergency_repair', 'upgrade'];
    
    return {
      id: uuidv4(),
      buildingId,
      title: `Test Investment ${counter}`,
      description: `Description for test investment ${counter}`,
      amount: 50000 + (counter % 10) * 10000, // Vary between 50k-140k
      targetDate: `202${4 + (counter % 3)}-0${(counter % 9) + 1}-01`, // Vary dates
      urgency: urgencies[counter % urgencies.length],
      type: counter % 2 === 0 ? 'auto_generated' : 'custom',
      ownershipType: 'residences',
      category: categories[counter % categories.length],
      ...overrides,
    };
  }

  /**
   * Create a test bill
   */
  static createBill(buildingId: string, createdBy: string, overrides: Partial<TestBill> = {}): TestBill {
    const counter = this.idCounter++;
    const categories = ['utilities', 'maintenance', 'insurance', 'administration', 'cleaning'];
    const schedules: Array<'weekly' | 'monthly' | 'quarterly' | 'yearly'> = ['monthly', 'quarterly', 'yearly'];
    
    return {
      id: uuidv4(),
      buildingId,
      billNumber: `TEST-BILL-${counter.toString().padStart(4, '0')}`,
      title: `Test Bill ${counter}`,
      category: categories[counter % categories.length],
      paymentType: 'recurrent',
      schedulePayment: schedules[counter % schedules.length],
      costs: [(5000 + (counter % 5) * 1000).toString()], // 5k-9k
      totalAmount: 5000 + (counter % 5) * 1000,
      startDate: '2024-01-01',
      status: 'draft',
      createdBy,
      ...overrides,
    };
  }

  /**
   * Create a test monthly budget
   */
  static createMonthlyBudget(buildingId: string, overrides: Partial<TestMonthlyBudget> = {}): TestMonthlyBudget {
    const counter = this.idCounter++;
    const currentYear = new Date().getFullYear();
    
    return {
      id: uuidv4(),
      buildingId,
      year: currentYear + (counter % 2), // Current or next year
      month: (counter % 12) + 1,
      incomeTypes: ['monthly_fees', 'parking_fees', 'laundry_income'],
      incomes: ['45000', '1500', '500'],
      spendingTypes: ['maintenance', 'utilities', 'insurance', 'administration'],
      spendings: ['12000', '8000', '4500', '3000'],
      approved: counter % 2 === 0,
      ...overrides,
    };
  }
}

/**
 * Database Test Utilities - Handles test data persistence
 */
export class DatabaseTestUtils {
  /**
   * Insert organization into database
   */
  static async insertOrganization(org: TestOrganization): Promise<void> {
    await sql`
      INSERT INTO organizations (id, name, domain, created_at, updated_at)
      VALUES (${org.id}, ${org.name}, ${org.domain}, NOW(), NOW())
    `;
  }

  /**
   * Insert user into database
   */
  static async insertUser(user: TestUser): Promise<void> {
    await sql`
      INSERT INTO users (id, username, email, first_name, last_name, role, created_at, updated_at)
      VALUES (${user.id}, ${user.username}, ${user.email}, ${user.firstName}, ${user.lastName}, ${user.role}, NOW(), NOW())
    `;
  }

  /**
   * Insert building into database
   */
  static async insertBuilding(building: TestBuilding): Promise<void> {
    await sql`
      INSERT INTO buildings (
        id, organization_id, name, address, city, province, postal_code, 
        building_type, total_units, bank_account_start_amount, bank_account_minimums,
        general_inflation_rate, revenue_inflation_rate, unplanned_bills_amount,
        financial_year_start, inflation_settings, amenities, created_at, updated_at
      )
      VALUES (
        ${building.id}, ${building.organizationId}, ${building.name}, ${building.address}, 
        ${building.city}, ${building.province}, ${building.postalCode}, ${building.buildingType}, 
        ${building.totalUnits}, ${building.bankAccountStartAmount}, ${building.bankAccountMinimums},
        ${building.generalInflationRate}, ${building.revenueInflationRate}, ${building.unplannedBillsAmount},
        ${building.financialYearStart}, ${building.inflationSettings}, ${JSON.stringify(building.amenities)},
        NOW(), NOW()
      )
    `;
  }

  /**
   * Insert residence into database
   */
  static async insertResidence(residence: TestResidence): Promise<void> {
    await sql`
      INSERT INTO residences (id, building_id, unit_number, monthly_fees, is_active, created_at, updated_at)
      VALUES (${residence.id}, ${residence.buildingId}, ${residence.unitNumber}, ${residence.monthlyFees}, ${residence.isActive}, NOW(), NOW())
    `;
  }

  /**
   * Insert capital investment into database
   */
  static async insertCapitalInvestment(investment: TestCapitalInvestment): Promise<void> {
    await sql`
      INSERT INTO capital_investments (
        id, building_id, title, description, amount, target_date, urgency, 
        type, ownership_type, category, created_at, updated_at
      )
      VALUES (
        ${investment.id}, ${investment.buildingId}, ${investment.title}, ${investment.description},
        ${investment.amount}, ${investment.targetDate}, ${investment.urgency}, ${investment.type},
        ${investment.ownershipType}, ${investment.category}, NOW(), NOW()
      )
    `;
  }

  /**
   * Insert bill into database
   */
  static async insertBill(bill: TestBill): Promise<void> {
    await sql`
      INSERT INTO bills (
        id, building_id, bill_number, title, category, payment_type, schedule_payment,
        costs, total_amount, start_date, end_date, status, created_by, created_at, updated_at
      )
      VALUES (
        ${bill.id}, ${bill.buildingId}, ${bill.billNumber}, ${bill.title}, ${bill.category},
        ${bill.paymentType}, ${bill.schedulePayment}, ${bill.costs}, ${bill.totalAmount},
        ${bill.startDate}, ${bill.endDate || null}, ${bill.status}, ${bill.createdBy}, NOW(), NOW()
      )
    `;
  }

  /**
   * Insert monthly budget into database
   */
  static async insertMonthlyBudget(budget: TestMonthlyBudget): Promise<void> {
    await sql`
      INSERT INTO monthly_budgets (
        id, building_id, year, month, income_types, incomes, spending_types, spendings, approved, created_at, updated_at
      )
      VALUES (
        ${budget.id}, ${budget.buildingId}, ${budget.year}, ${budget.month},
        ${budget.incomeTypes}, ${budget.incomes}, ${budget.spendingTypes}, ${budget.spendings},
        ${budget.approved}, NOW(), NOW()
      )
    `;
  }

  /**
   * Clean up test data by table and IDs
   */
  static async cleanup(table: string, ids: string[]): Promise<void> {
    if (ids.length > 0) {
      await sql`DELETE FROM ${sql(table)} WHERE id = ANY(${ids})`;
    }
  }

  /**
   * Clean up all test data for multiple tables
   */
  static async cleanupAll(cleanupMap: Record<string, string[]>): Promise<void> {
    const cleanupOrder = [
      'capital_investments',
      'monthly_budgets', 
      'bills',
      'residences',
      'buildings',
      'users',
      'organizations',
    ];

    for (const table of cleanupOrder) {
      if (cleanupMap[table] && cleanupMap[table].length > 0) {
        await this.cleanup(table, cleanupMap[table]);
        cleanupMap[table].length = 0; // Clear the array
      }
    }
  }
}

/**
 * Test Assertion Utilities - Custom assertions for budget tests
 */
export class TestAssertionUtils {
  /**
   * Assert that forecast data has valid structure
   */
  static assertValidForecastStructure(forecast: any[], expectedLength = 300): void {
    expect(Array.isArray(forecast)).toBe(true);
    expect(forecast.length).toBe(expectedLength);
    
    forecast.forEach((month, index) => {
      expect(month).toHaveProperty('year');
      expect(month).toHaveProperty('month');
      expect(month).toHaveProperty('revenue');
      expect(month).toHaveProperty('spending');
      expect(month).toHaveProperty('netCashFlow');
      expect(month).toHaveProperty('balance');
      expect(month).toHaveProperty('status');
      expect(month).toHaveProperty('inflatedIncome');
      expect(month).toHaveProperty('inflatedExpenses');
      
      // Validate data types
      expect(typeof month.year).toBe('number');
      expect(typeof month.month).toBe('number');
      expect(typeof month.revenue).toBe('number');
      expect(typeof month.spending).toBe('number');
      expect(typeof month.netCashFlow).toBe('number');
      expect(typeof month.balance).toBe('number');
      expect(['red', 'yellow', 'green']).toContain(month.status);
      
      // Validate ranges
      expect(month.month).toBeGreaterThanOrEqual(1);
      expect(month.month).toBeLessThanOrEqual(12);
      expect(month.year).toBeGreaterThanOrEqual(2024);
      expect(month.year).toBeLessThanOrEqual(2050);
    });
  }

  /**
   * Assert that bank account data has valid structure
   */
  static assertValidBankAccountStructure(bankAccount: any): void {
    expect(bankAccount).toHaveProperty('buildingId');
    expect(bankAccount).toHaveProperty('buildingName');
    
    // Optional fields should be null or valid values
    if (bankAccount.bankAccountNumber !== null) {
      expect(typeof bankAccount.bankAccountNumber).toBe('string');
    }
    
    if (bankAccount.bankAccountStartAmount !== null) {
      expect(typeof bankAccount.bankAccountStartAmount).toBe('number');
      expect(bankAccount.bankAccountStartAmount).toBeGreaterThanOrEqual(0);
    }
    
    if (bankAccount.generalInflationRate !== null) {
      const rate = parseFloat(bankAccount.generalInflationRate);
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(100);
    }
    
    if (bankAccount.customBankFields !== null) {
      expect(typeof bankAccount.customBankFields).toBe('object');
    }
    
    if (bankAccount.customRevenueLines !== null) {
      expect(Array.isArray(bankAccount.customRevenueLines)).toBe(true);
      bankAccount.customRevenueLines.forEach((line: any) => {
        expect(line).toHaveProperty('id');
        expect(line).toHaveProperty('description');
        expect(line).toHaveProperty('monthlyAmount');
        expect(typeof line.monthlyAmount).toBe('number');
      });
    }
  }

  /**
   * Assert that capital investments array has valid structure
   */
  static assertValidCapitalInvestmentsStructure(investments: any[]): void {
    expect(Array.isArray(investments)).toBe(true);
    
    investments.forEach((investment) => {
      expect(investment).toHaveProperty('id');
      expect(investment).toHaveProperty('title');
      expect(investment).toHaveProperty('amount');
      expect(investment).toHaveProperty('urgency');
      expect(investment).toHaveProperty('type');
      expect(investment).toHaveProperty('targetDate');
      
      expect(typeof investment.title).toBe('string');
      expect(typeof investment.amount).toBe('number');
      expect(['not_urgent', 'urgent', 'suggested']).toContain(investment.urgency);
      expect(['auto_generated', 'custom']).toContain(investment.type);
      expect(investment.amount).toBeGreaterThan(0);
    });
  }

  /**
   * Assert that inflation rates are properly applied
   */
  static assertInflationApplication(
    baseAmount: number, 
    inflatedAmount: number, 
    inflationRate: number, 
    yearsElapsed: number,
    tolerance = 0.01
  ): void {
    const expectedAmount = baseAmount * Math.pow(1 + inflationRate, yearsElapsed);
    const difference = Math.abs(inflatedAmount - expectedAmount);
    const relativeError = difference / expectedAmount;
    
    expect(relativeError).toBeLessThanOrEqual(tolerance);
  }

  /**
   * Assert that financial year boundaries are respected
   */
  static assertFinancialYearBoundaries(
    forecast: any[], 
    financialYearStart: Date,
    shouldHaveInflation = true
  ): void {
    const financialYearMonth = financialYearStart.getMonth() + 1;
    const financialYear = financialYearStart.getFullYear();
    
    forecast.forEach((month) => {
      const monthDate = new Date(month.year, month.month - 1, 1);
      const isAfterFinancialYearStart = monthDate >= financialYearStart;
      
      if (shouldHaveInflation && isAfterFinancialYearStart) {
        expect(month.inflatedIncome).toBeGreaterThanOrEqual(month.revenue);
        expect(month.inflatedExpenses).toBeGreaterThanOrEqual(month.spending);
      }
    });
  }
}

/**
 * Mock Utilities - For creating test mocks and stubs
 */
export class MockUtils {
  /**
   * Create a mock Express request object
   */
  static createMockRequest(user: TestUser, params: any = {}, query: any = {}, body: any = {}): any {
    return {
      user,
      params,
      query,
      body,
      session: {},
    };
  }

  /**
   * Create a mock Express response object
   */
  static createMockResponse(): any {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.end = jest.fn().mockReturnValue(res);
    return res;
  }

  /**
   * Create a mock next function
   */
  static createMockNext(): jest.Mock {
    return jest.fn();
  }
}

/**
 * Performance Test Utilities
 */
export class PerformanceTestUtils {
  /**
   * Measure execution time of an async function
   */
  static async measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const startTime = Date.now();
    const result = await fn();
    const duration = Date.now() - startTime;
    return { result, duration };
  }

  /**
   * Assert that execution time is within acceptable bounds
   */
  static assertPerformance(duration: number, maxDurationMs: number): void {
    expect(duration).toBeLessThanOrEqual(maxDurationMs);
  }

  /**
   * Run concurrent operations and measure performance
   */
  static async measureConcurrentOperations<T>(
    operations: Array<() => Promise<T>>,
    maxConcurrency = 10
  ): Promise<{ results: T[]; totalDuration: number; averageDuration: number }> {
    const startTime = Date.now();
    
    // Run operations in batches to control concurrency
    const results: T[] = [];
    for (let i = 0; i < operations.length; i += maxConcurrency) {
      const batch = operations.slice(i, i + maxConcurrency);
      const batchResults = await Promise.all(batch.map(op => op()));
      results.push(...batchResults);
    }
    
    const totalDuration = Date.now() - startTime;
    const averageDuration = totalDuration / operations.length;
    
    return { results, totalDuration, averageDuration };
  }
}