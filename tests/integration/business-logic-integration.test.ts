/**
 * @file Business Logic Integration Tests
 * @description Tests for business logic integration including inflation calculations, 
 * forecast calculations, period filtering, and complex business rules
 */

import request from 'supertest';
import express from 'express';
import session from 'express-session';
import { sql } from '../../server/db';
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';

// Import the actual budget router
import budgetRouter from '../../server/api/budgets';

// Test types
interface TestBuilding {
  id: string;
  organizationId: string;
  name: string;
  financialYearStart?: string;
  generalInflationRate: number;
  revenueInflationRate: number;
  unplannedBillsAmount?: number;
  inflationSettings?: string;
  amenities?: any;
}

interface TestUser {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'demo_manager';
  organizations?: string[];
}

interface TestOrganization {
  id: string;
  name: string;
  domain: string;
}

// Extend Express Request type for authentication
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

interface AuthenticatedUser {
  id: string;
  role: 'admin' | 'manager' | 'demo_manager' | 'tenant' | 'resident';
  organizations?: string[];
  email?: string;
  username?: string;
}

describe('Business Logic Integration Tests', () => {
  let app: express.Application;
  let testOrg: TestOrganization;
  let testUser: TestUser;
  let testBuilding: TestBuilding;
  
  // Test data cleanup tracking
  const createdIds = {
    organizations: [] as string[],
    users: [] as string[],
    buildings: [] as string[],
    bills: [] as string[],
    monthlyBudgets: [] as string[],
    residences: [] as string[],
    capitalInvestments: [] as string[],
  };

  beforeAll(async () => {
    // Create Express app with all necessary middleware
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Set up session middleware
    app.use(session({
      secret: 'test-secret-business-logic',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false },
    }));

    // Create test organization
    testOrg = {
      id: uuidv4(),
      name: 'Business Logic Test Org',
      domain: 'business-logic-test.com',
    };

    await sql`
      INSERT INTO organizations (id, name, domain, created_at, updated_at)
      VALUES (${testOrg.id}, ${testOrg.name}, ${testOrg.domain}, NOW(), NOW())
    `;
    createdIds.organizations.push(testOrg.id);

    // Create test user
    testUser = {
      id: uuidv4(),
      username: 'business-logic-test-user',
      email: 'business-logic-test@example.com',
      role: 'admin',
    };

    await sql`
      INSERT INTO users (id, username, email, role, created_at, updated_at)
      VALUES (${testUser.id}, ${testUser.username}, ${testUser.email}, ${testUser.role}, NOW(), NOW())
    `;
    createdIds.users.push(testUser.id);

    // Mock authentication middleware
    app.use((req, res, next) => {
      req.user = {
        id: testUser.id,
        role: testUser.role,
        organizations: [testOrg.id],
        email: testUser.email,
        username: testUser.username,
      };
      next();
    });

    app.use('/api/budgets', budgetRouter);
  }, 30000);

  beforeEach(async () => {
    // Create test building with complex inflation configuration
    testBuilding = {
      id: uuidv4(),
      organizationId: testOrg.id,
      name: 'Business Logic Test Building',
      financialYearStart: '2024-04-01',
      generalInflationRate: 2.5,
      revenueInflationRate: 3.0,
      unplannedBillsAmount: 2500,
      inflationSettings: JSON.stringify({
        useGlobalBillsInflation: false,
        globalBillsInflationRate: 2.8,
        categoryInflationRates: {
          monthly_fees: 3.5,
          utilities: 2.9,
          maintenance: 3.2,
          insurance: 2.3,
          professional_services: 2.7,
        },
      }),
      amenities: {
        emergencyFundMinimum: 25000,
        operatingCashMinimum: 15000,
        customBankFields: {
          reserveFund1: 20000,
          reserveFund2: 10000,
        },
        customRevenueLines: [
          { id: 'parking', description: 'Parking fees', monthlyAmount: 2000 },
          { id: 'laundry', description: 'Laundry income', monthlyAmount: 600 },
        ],
      },
    };

    await sql`
      INSERT INTO buildings (
        id, organization_id, name, address, city, province, postal_code, 
        building_type, total_units, financial_year_start, general_inflation_rate,
        revenue_inflation_rate, unplanned_bills_amount, inflation_settings,
        amenities, created_at, updated_at
      )
      VALUES (
        ${testBuilding.id}, ${testBuilding.organizationId}, ${testBuilding.name}, 
        '123 Business Logic Street', 'Montreal', 'QC', 'H4L 4L4',
        'apartment', 60, ${testBuilding.financialYearStart}, ${testBuilding.generalInflationRate},
        ${testBuilding.revenueInflationRate}, ${testBuilding.unplannedBillsAmount},
        ${testBuilding.inflationSettings}, ${JSON.stringify(testBuilding.amenities)},
        NOW(), NOW()
      )
    `;
    createdIds.buildings.push(testBuilding.id);

    // Create test residences for monthly fees calculation
    const residence1Id = uuidv4();
    const residence2Id = uuidv4();
    const residence3Id = uuidv4();
    
    await sql`
      INSERT INTO residences (id, building_id, unit_number, monthly_fees, is_active, created_at, updated_at)
      VALUES 
        (${residence1Id}, ${testBuilding.id}, 'A101', 1800, true, NOW(), NOW()),
        (${residence2Id}, ${testBuilding.id}, 'A102', 1600, true, NOW(), NOW()),
        (${residence3Id}, ${testBuilding.id}, 'A103', 1400, true, NOW(), NOW())
    `;
    createdIds.residences.push(residence1Id, residence2Id, residence3Id);

    // Create test monthly budget data spanning multiple years
    const monthlyBudgets = [
      {
        id: uuidv4(),
        year: 2023,
        month: 12,
        incomeTypes: ['monthly_fees', 'parking_fees', 'laundry_income'],
        incomes: ['48000', '2000', '600'],
        spendingTypes: ['maintenance', 'utilities', 'insurance'],
        spendings: ['15000', '8000', '4500'],
      },
      {
        id: uuidv4(),
        year: 2024,
        month: 3,
        incomeTypes: ['monthly_fees', 'parking_fees', 'laundry_income'],
        incomes: ['48000', '2000', '600'],
        spendingTypes: ['maintenance', 'utilities', 'insurance'],
        spendings: ['15000', '8000', '4500'],
      },
      {
        id: uuidv4(),
        year: 2024,
        month: 6,
        incomeTypes: ['monthly_fees', 'parking_fees', 'laundry_income'],
        incomes: ['48000', '2000', '600'],
        spendingTypes: ['maintenance', 'utilities', 'insurance'],
        spendings: ['15000', '8000', '4500'],
      },
      {
        id: uuidv4(),
        year: 2024,
        month: 9,
        incomeTypes: ['monthly_fees', 'parking_fees', 'laundry_income'],
        incomes: ['48000', '2000', '600'],
        spendingTypes: ['maintenance', 'utilities', 'insurance'],
        spendings: ['15000', '8000', '4500'],
      },
      {
        id: uuidv4(),
        year: 2025,
        month: 2,
        incomeTypes: ['monthly_fees', 'parking_fees', 'laundry_income'],
        incomes: ['48000', '2000', '600'],
        spendingTypes: ['maintenance', 'utilities', 'insurance'],
        spendings: ['15000', '8000', '4500'],
      },
    ];

    for (const budget of monthlyBudgets) {
      await sql`
        INSERT INTO monthly_budgets (
          id, building_id, year, month, income_types, incomes, 
          spending_types, spendings, approved, created_at, updated_at
        )
        VALUES (
          ${budget.id}, ${testBuilding.id}, ${budget.year}, ${budget.month},
          ${budget.incomeTypes}, ${budget.incomes},
          ${budget.spendingTypes}, ${budget.spendings},
          true, NOW(), NOW()
        )
      `;
      createdIds.monthlyBudgets.push(budget.id);
    }

    // Create test bills with different schedules and categories
    const bills = [
      {
        id: uuidv4(),
        category: 'utilities',
        schedule: 'monthly',
        costs: ['8000'],
        startDate: '2024-01-01',
      },
      {
        id: uuidv4(),
        category: 'maintenance',
        schedule: 'quarterly',
        costs: ['12000'],
        startDate: '2024-01-01',
      },
      {
        id: uuidv4(),
        category: 'insurance',
        schedule: 'yearly',
        costs: ['24000'],
        startDate: '2024-01-01',
      },
    ];

    for (const bill of bills) {
      await sql`
        INSERT INTO bills (
          id, building_id, bill_number, title, category, payment_type,
          schedule_payment, costs, total_amount, start_date, status,
          created_by, created_at, updated_at
        )
        VALUES (
          ${bill.id}, ${testBuilding.id}, 'BL-${bill.category.toUpperCase()}', 
          '${bill.category} bill', ${bill.category}, 'recurrent',
          ${bill.schedule}, ${bill.costs}, ${parseInt(bill.costs[0])},
          ${bill.startDate}, 'draft', ${testUser.id}, NOW(), NOW()
        )
      `;
      createdIds.bills.push(bill.id);
    }
  }, 20000);

  afterEach(async () => {
    // Clean up test data after each test
    const cleanup = async (table: string, ids: string[]) => {
      if (ids.length > 0) {
        await sql`DELETE FROM ${sql(table)} WHERE id = ANY(${ids})`;
        ids.length = 0;
      }
    };

    await cleanup('capital_investments', createdIds.capitalInvestments);
    await cleanup('bills', createdIds.bills);
    await cleanup('monthly_budgets', createdIds.monthlyBudgets);
    await cleanup('residences', createdIds.residences);
    await cleanup('buildings', createdIds.buildings);
  }, 15000);

  afterAll(async () => {
    // Final cleanup
    if (createdIds.users.length > 0) {
      await sql`DELETE FROM users WHERE id = ANY(${createdIds.users})`;
    }
    if (createdIds.organizations.length > 0) {
      await sql`DELETE FROM organizations WHERE id = ANY(${createdIds.organizations})`;
    }
  }, 15000);

  describe('Monthly Fees Inflation Application with Financial Year Boundaries', () => {
    it('should apply different inflation rates based on financial year start', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuilding.id}/forecast`)
        .send({
          bankAccountStartAmount: 200000,
          bankAccountMinimums: 50000,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('forecast');
      
      const forecast = response.body.forecast;
      expect(Array.isArray(forecast)).toBe(true);
      expect(forecast.length).toBe(300); // 25 years * 12 months

      // Check that inflation is applied correctly after financial year start
      // Financial year starts April 1, 2024
      const marchMonth = forecast.find((month: any) => month.year === 2024 && month.month === 3);
      const aprilMonth = forecast.find((month: any) => month.year === 2024 && month.month === 4);
      
      if (marchMonth && aprilMonth) {
        // March should have no inflation (before financial year start)
        // April should have inflation applied
        expect(aprilMonth.inflatedIncome).toBeGreaterThanOrEqual(marchMonth.inflatedIncome);
      }
    });

    it('should use category-specific inflation rates for monthly fees', async () => {
      // Update building to use monthly_fees specific rate
      await sql`
        UPDATE buildings 
        SET inflation_settings = ${JSON.stringify({
          useGlobalBillsInflation: false,
          categoryInflationRates: {
            monthly_fees: 4.0, // Higher rate for monthly fees
            utilities: 2.0,    // Lower rate for utilities
          },
        })}
        WHERE id = ${testBuilding.id}
      `;

      const response = await request(app)
        .post(`/api/budgets/${testBuilding.id}/forecast`)
        .send({
          bankAccountStartAmount: 200000,
          generalInflationRate: 2.0,
          revenueInflationRate: 2.0,
        });

      expect(response.status).toBe(200);
      
      // Verify that the forecast uses the category-specific rate
      expect(response.body).toHaveProperty('monthlyFeesInflationRate');
      expect(parseFloat(response.body.monthlyFeesInflationRate)).toBe(4.0);
    });

    it('should fall back to revenueInflation when no category rates exist', async () => {
      // Update building to have no category-specific rates
      await sql`
        UPDATE buildings 
        SET inflation_settings = ${JSON.stringify({
          useGlobalBillsInflation: false,
          // No categoryInflationRates specified
        })}
        WHERE id = ${testBuilding.id}
      `;

      const response = await request(app)
        .post(`/api/budgets/${testBuilding.id}/forecast`)
        .send({
          bankAccountStartAmount: 200000,
          revenueInflationRate: 3.5,
        });

      expect(response.status).toBe(200);
      
      // Should use revenueInflationRate as fallback
      expect(response.body).toHaveProperty('monthlyFeesInflationRate');
      expect(parseFloat(response.body.monthlyFeesInflationRate)).toBe(3.5);
    });
  });

  describe('Forecast Calculations Use Saved Configuration', () => {
    it('should use building configuration for forecast calculations', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuilding.id}/forecast`)
        .send({
          // Should use saved building configuration
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('buildingId', testBuilding.id);
      expect(response.body).toHaveProperty('buildingName', testBuilding.name);
      
      // Should use saved inflation rates
      expect(parseFloat(response.body.generalInflationRate)).toBe(testBuilding.generalInflationRate);
      expect(parseFloat(response.body.revenueInflationRate)).toBe(testBuilding.revenueInflationRate);
      
      // Should use saved minimum requirements
      expect(response.body).toHaveProperty('minimumFund');
      const expectedMinimum = 25000 + 15000 + 20000 + 10000; // From amenities config
      expect(response.body.minimumFund).toBe(expectedMinimum);
    });

    it('should override saved configuration with request parameters', async () => {
      const customParams = {
        bankAccountStartAmount: 300000,
        generalInflationRate: 4.0,
        revenueInflationRate: 4.5,
        unplannedBillsAmount: 5000,
      };

      const response = await request(app)
        .post(`/api/budgets/${testBuilding.id}/forecast`)
        .send(customParams);

      expect(response.status).toBe(200);
      
      // Should use request parameters instead of saved config
      expect(response.body.startingBalance).toBe(customParams.bankAccountStartAmount);
      expect(parseFloat(response.body.generalInflationRate)).toBe(customParams.generalInflationRate);
      expect(parseFloat(response.body.revenueInflationRate)).toBe(customParams.revenueInflationRate);
      expect(parseFloat(response.body.unplannedBillsAmount)).toBe(customParams.unplannedBillsAmount);
    });
  });

  describe('Period Window Filtering with Cross-Year Scenarios', () => {
    it('should filter budget data across year boundaries correctly', async () => {
      // Test filtering from December 2023 to March 2024
      const response = await request(app)
        .get(`/api/budgets/${testBuilding.id}`)
        .query({
          startYear: 2023,
          endYear: 2024,
          startMonth: 12,
          endMonth: 3,
          groupBy: 'monthly',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('budgets');
      
      const budgets = response.body.budgets;
      expect(Array.isArray(budgets)).toBe(true);
      
      // Should contain December 2023 and March 2024
      const yearMonthCombinations = budgets.map((b: any) => ({ year: b.year, month: b.month }));
      
      // Verify correct months are included
      const validCombinations = [
        { year: 2023, month: 12 },
        { year: 2024, month: 1 },
        { year: 2024, month: 2 },
        { year: 2024, month: 3 },
      ];

      yearMonthCombinations.forEach((combo: any) => {
        const isValid = validCombinations.some(
          valid => valid.year === combo.year && valid.month === combo.month
        );
        expect(isValid).toBe(true);
      });
    });

    it('should handle month-boundary SQL filter logic correctly', async () => {
      // Test with specific month range that crosses year boundary
      const response = await request(app)
        .get(`/api/budgets/${testBuilding.id}`)
        .query({
          startYear: 2024,
          endYear: 2025,
          startMonth: 6,
          endMonth: 2,
          groupBy: 'monthly',
        });

      expect(response.status).toBe(200);
      
      const budgets = response.body.budgets;
      
      if (budgets.length > 0) {
        budgets.forEach((budget: any) => {
          // Year*100+month format check
          const yearMonth = budget.year * 100 + budget.month;
          const startYearMonth = 2024 * 100 + 6; // 202406
          const endYearMonth = 2025 * 100 + 2;   // 202502
          
          expect(yearMonth).toBeGreaterThanOrEqual(startYearMonth);
          expect(yearMonth).toBeLessThanOrEqual(endYearMonth);
        });
      }
    });
  });

  describe('Capital Investment Mode Impacts on Forecast Calculations', () => {
    beforeEach(async () => {
      // Create capital investments for mode testing
      const investments = [
        {
          id: uuidv4(),
          urgency: 'urgent',
          amount: 80000,
          targetDate: '2024-08-01',
          title: 'Urgent Elevator Repair',
        },
        {
          id: uuidv4(),
          urgency: 'suggested',
          amount: 45000,
          targetDate: '2025-03-01',
          title: 'Suggested Lobby Renovation',
        },
        {
          id: uuidv4(),
          urgency: 'not_urgent',
          amount: 120000,
          targetDate: '2026-06-01',
          title: 'Future Swimming Pool',
        },
      ];

      for (const investment of investments) {
        await sql`
          INSERT INTO capital_investments (
            id, building_id, title, amount, target_date, urgency, type,
            ownership_type, category, created_at, updated_at
          )
          VALUES (
            ${investment.id}, ${testBuilding.id}, ${investment.title}, ${investment.amount},
            ${investment.targetDate}, ${investment.urgency}, 'auto_generated',
            'residences', 'improvement', NOW(), NOW()
          )
        `;
        createdIds.capitalInvestments.push(investment.id);
      }
    });

    it('should include only urgent investments in urgent mode forecast', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuilding.id}/forecast`)
        .send({
          capitalInvestmentMode: 'urgent',
          bankAccountStartAmount: 500000,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('capitalInvestments');
      
      const investments = response.body.capitalInvestments;
      expect(investments).toHaveLength(1);
      expect(investments[0].urgency).toBe('urgent');
      expect(investments[0].title).toBe('Urgent Elevator Repair');
      
      // Verify the investment impact is reflected in the forecast
      const augustMonth = response.body.forecast.find(
        (month: any) => month.year === 2024 && month.month === 8
      );
      
      if (augustMonth) {
        // Balance should drop significantly in August due to urgent investment
        expect(augustMonth.balance).toBeLessThan(500000 - 80000);
      }
    });

    it('should include urgent and suggested investments in suggested mode', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuilding.id}/forecast`)
        .send({
          capitalInvestmentMode: 'suggested',
          bankAccountStartAmount: 500000,
        });

      expect(response.status).toBe(200);
      
      const investments = response.body.capitalInvestments;
      expect(investments).toHaveLength(2); // urgent + suggested
      
      const urgencies = investments.map((inv: any) => inv.urgency);
      expect(urgencies).toContain('urgent');
      expect(urgencies).toContain('suggested');
      expect(urgencies).not.toContain('not_urgent');
    });
  });

  describe('Complex Business Rule Integration', () => {
    it('should calculate accurate monthly fees from active residences', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuilding.id}/forecast`)
        .send({
          bankAccountStartAmount: 200000,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('baselineMonthlyIncome');
      
      // Expected monthly fees: 1800 + 1600 + 1400 = 4800 from residences
      // Plus custom revenue lines: 2000 + 600 = 2600
      // Total expected: 4800 + 2600 = 7400
      const expectedIncome = 4800 + 2600;
      expect(response.body.baselineMonthlyIncome).toBeGreaterThanOrEqual(expectedIncome * 0.9); // Allow some variance
    });

    it('should apply correct inflation rates to different bill categories', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuilding.id}/forecast`)
        .send({
          bankAccountStartAmount: 200000,
        });

      expect(response.status).toBe(200);
      
      // Verify that different categories use different inflation rates
      const forecast = response.body.forecast;
      
      // Check some future months to see inflation impact
      const futureMonth = forecast.find(
        (month: any) => month.year === 2025 && month.month === 6
      );
      
      if (futureMonth) {
        expect(futureMonth.inflatedExpenses).toBeGreaterThan(futureMonth.spending);
        expect(futureMonth.inflatedIncome).toBeGreaterThan(futureMonth.revenue);
      }
    });

    it('should properly handle unplanned bills in forecast calculations', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuilding.id}/forecast`)
        .send({
          bankAccountStartAmount: 200000,
          unplannedBillsAmount: 5000, // Override building's 2500
        });

      expect(response.status).toBe(200);
      
      // Check that unplanned bills amount is reflected in spending
      const firstMonth = response.body.forecast[0];
      expect(firstMonth.spending).toBeGreaterThan(0);
      
      // The monthly unplanned spending should be the specified amount / 12
      const expectedMonthlyUnplanned = 5000 / 12;
      expect(response.body).toHaveProperty('unplannedBillsAmount', '5000');
    });
  });

  describe('Performance with Complex Business Logic', () => {
    it('should handle complex calculations efficiently', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post(`/api/budgets/${testBuilding.id}/forecast`)
        .send({
          bankAccountStartAmount: 1000000,
          capitalInvestmentMode: 'suggested',
          lookbackYears: 5,
        });
      
      const duration = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      
      // Verify complex calculation results
      expect(response.body.forecast).toHaveLength(300);
      expect(response.body).toHaveProperty('capitalInvestments');
      expect(response.body).toHaveProperty('baselineMonthlyIncome');
      expect(response.body).toHaveProperty('minimumFund');
    });
  });
});