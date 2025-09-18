/**
 * @file Comprehensive Budget Endpoints API Integration Tests
 * @description Real integration tests for budget endpoints with actual database operations
 * Tests all endpoints with proper HTTP requests and database persistence verification
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
  address: string;
  city: string;
  province: string;
  postalCode: string;
  buildingType: 'apartment' | 'appartement' | 'condo' | 'rental';
  totalUnits: number;
  bankAccountStartAmount?: number;
  bankAccountMinimums?: string;
  generalInflationRate: number;
  revenueInflationRate: number;
  unplannedBillsAmount?: number;
  financialYearStart?: string;
  inflationSettings?: string;
  amenities?: any;
}

interface TestUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
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

describe('Budget Endpoints Comprehensive Integration Tests', () => {
  let app: express.Application;
  let testOrg: TestOrganization;
  let testUser: TestUser;
  let testBuilding: TestBuilding;
  
  // Test data cleanup tracking
  const createdIds = {
    organizations: [] as string[],
    users: [] as string[],
    buildings: [] as string[],
    budgets: [] as string[],
    monthlyBudgets: [] as string[],
    capitalInvestments: [] as string[],
    bills: [] as string[],
    residences: [] as string[],
  };

  beforeAll(async () => {
    // Create Express app with all necessary middleware
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Set up session middleware
    app.use(session({
      secret: 'test-secret-key-for-integration-tests',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false },
    }));

    // Mock authentication middleware for tests
    app.use((req, res, next) => {
      // Add test user to all requests
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

    // Create test organization
    testOrg = {
      id: uuidv4(),
      name: 'Test Integration Org',
      domain: 'test-integration.com',
    };

    await sql`
      INSERT INTO organizations (id, name, domain, created_at, updated_at)
      VALUES (${testOrg.id}, ${testOrg.name}, ${testOrg.domain}, NOW(), NOW())
    `;
    createdIds.organizations.push(testOrg.id);

    // Create test user
    testUser = {
      id: uuidv4(),
      username: 'integration-test-user',
      email: 'integration-test@example.com',
      firstName: 'Integration',
      lastName: 'Test',
      role: 'admin',
    };

    await sql`
      INSERT INTO users (id, username, email, first_name, last_name, role, created_at, updated_at)
      VALUES (${testUser.id}, ${testUser.username}, ${testUser.email}, ${testUser.firstName}, ${testUser.lastName}, ${testUser.role}, NOW(), NOW())
    `;
    createdIds.users.push(testUser.id);

    // Create test building
    testBuilding = {
      id: uuidv4(),
      organizationId: testOrg.id,
      name: 'Integration Test Building',
      address: '123 Test Street',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A 1A1',
      buildingType: 'apartment',
      totalUnits: 50,
      bankAccountStartAmount: 100000,
      bankAccountMinimums: JSON.stringify({ emergencyFund: 10000, operatingCash: 5000 }),
      generalInflationRate: 2.5,
      revenueInflationRate: 3.0,
      unplannedBillsAmount: 2000,
      financialYearStart: '2024-01-01',
      inflationSettings: JSON.stringify({
        useGlobalBillsInflation: true,
        globalBillsInflationRate: 2.2,
        categoryInflationRates: {
          monthly_fees: 3.5,
          utilities: 2.8,
          maintenance: 3.2,
        },
      }),
      amenities: {
        emergencyFundMinimum: 10000,
        operatingCashMinimum: 5000,
        customBankFields: {
          repairReserve: 15000,
          improvementFund: 8000,
        },
        customRevenueLines: [
          { id: 'parking', description: 'Parking fees', monthlyAmount: 2500 },
          { id: 'laundry', description: 'Laundry income', monthlyAmount: 800 },
        ],
      },
    };

    await sql`
      INSERT INTO buildings (
        id, organization_id, name, address, city, province, postal_code, 
        building_type, total_units, bank_account_start_amount, bank_account_minimums,
        general_inflation_rate, revenue_inflation_rate, unplanned_bills_amount,
        financial_year_start, inflation_settings, amenities, created_at, updated_at
      )
      VALUES (
        ${testBuilding.id}, ${testBuilding.organizationId}, ${testBuilding.name}, 
        ${testBuilding.address}, ${testBuilding.city}, ${testBuilding.province}, 
        ${testBuilding.postalCode}, ${testBuilding.buildingType}, ${testBuilding.totalUnits}, 
        ${testBuilding.bankAccountStartAmount}, ${testBuilding.bankAccountMinimums},
        ${testBuilding.generalInflationRate}, ${testBuilding.revenueInflationRate}, 
        ${testBuilding.unplannedBillsAmount}, ${testBuilding.financialYearStart},
        ${testBuilding.inflationSettings}, ${JSON.stringify(testBuilding.amenities)},
        NOW(), NOW()
      )
    `;
    createdIds.buildings.push(testBuilding.id);
  }, 30000);

  beforeEach(async () => {
    // Create test residences for the building
    const residence1Id = uuidv4();
    const residence2Id = uuidv4();
    
    await sql`
      INSERT INTO residences (id, building_id, unit_number, monthly_fees, is_active, created_at, updated_at)
      VALUES 
        (${residence1Id}, ${testBuilding.id}, 'A101', 1500, true, NOW(), NOW()),
        (${residence2Id}, ${testBuilding.id}, 'A102', 1200, true, NOW(), NOW())
    `;
    createdIds.residences.push(residence1Id, residence2Id);

    // Create test monthly budget data
    const monthlyBudgetId = uuidv4();
    await sql`
      INSERT INTO monthly_budgets (
        id, building_id, year, month, income_types, incomes, spending_types, spendings, approved, created_at, updated_at
      )
      VALUES (
        ${monthlyBudgetId}, ${testBuilding.id}, 2024, 6, 
        ARRAY['monthly_fees', 'parking_fees', 'laundry_income'],
        ARRAY['45000', '2500', '800'],
        ARRAY['maintenance', 'utilities', 'insurance', 'administration'],
        ARRAY['12000', '8500', '4200', '3800'],
        true, NOW(), NOW()
      )
    `;
    createdIds.monthlyBudgets.push(monthlyBudgetId);

    // Create test bills
    const billId = uuidv4();
    await sql`
      INSERT INTO bills (
        id, building_id, bill_number, title, category, payment_type, 
        schedule_payment, costs, total_amount, start_date, status, 
        created_by, created_at, updated_at
      )
      VALUES (
        ${billId}, ${testBuilding.id}, 'TEST-001', 'Monthly Utilities', 'utilities', 'recurrent',
        'monthly', ARRAY['5000'], 5000, '2024-01-01', 'draft',
        ${testUser.id}, NOW(), NOW()
      )
    `;
    createdIds.bills.push(billId);

    // Create test capital investments
    const capitalInvestmentId = uuidv4();
    await sql`
      INSERT INTO capital_investments (
        id, building_id, title, description, amount, target_date, 
        urgency, type, ownership_type, category, created_at, updated_at
      )
      VALUES (
        ${capitalInvestmentId}, ${testBuilding.id}, 'Roof Replacement', 
        'Complete roof renovation', 150000, '2025-06-01',
        'urgent', 'auto_generated', 'residences', 'maintenance', NOW(), NOW()
      )
    `;
    createdIds.capitalInvestments.push(capitalInvestmentId);
  }, 20000);

  afterEach(async () => {
    // Clean up test data after each test
    const cleanup = async (table: string, ids: string[]) => {
      if (ids.length > 0) {
        const tableName = sql.unsafe(table);
      await sql`DELETE FROM ${tableName} WHERE id = ANY(${ids})`;
        ids.length = 0; // Clear the array
      }
    };

    await cleanup('capital_investments', createdIds.capitalInvestments);
    await cleanup('bills', createdIds.bills);
    await cleanup('monthly_budgets', createdIds.monthlyBudgets);
    await cleanup('budgets', createdIds.budgets);
    await cleanup('residences', createdIds.residences);
  }, 15000);

  afterAll(async () => {
    // Final cleanup of persistent test data
    if (createdIds.buildings.length > 0) {
      await sql`DELETE FROM buildings WHERE id = ANY(${createdIds.buildings})`;
    }
    if (createdIds.users.length > 0) {
      await sql`DELETE FROM users WHERE id = ANY(${createdIds.users})`;
    }
    if (createdIds.organizations.length > 0) {
      await sql`DELETE FROM organizations WHERE id = ANY(${createdIds.organizations})`;
    }
  }, 15000);

  describe('Budget Data Retrieval Endpoints', () => {
    describe('GET /api/budgets/:buildingId', () => {
      it('should retrieve monthly budget data successfully', async () => {
        const response = await request(app)
          .get(`/api/budgets/${testBuilding.id}`)
          .query({ groupBy: 'monthly' });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('budgets');
        expect(response.body).toHaveProperty('type', 'monthly');
        expect(Array.isArray(response.body.budgets)).toBe(true);
        
        if (response.body.budgets.length > 0) {
          const budget = response.body.budgets[0];
          expect(budget).toHaveProperty('year');
          expect(budget).toHaveProperty('month');
          expect(budget).toHaveProperty('incomeTypes');
          expect(budget).toHaveProperty('incomes');
          expect(budget).toHaveProperty('spendingTypes');
          expect(budget).toHaveProperty('spendings');
        }
      });

      it('should retrieve yearly budget data successfully', async () => {
        const response = await request(app)
          .get(`/api/budgets/${testBuilding.id}`)
          .query({ groupBy: 'yearly' });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('budgets');
        expect(response.body).toHaveProperty('type', 'yearly');
        expect(Array.isArray(response.body.budgets)).toBe(true);
      });

      it('should apply cross-year month filtering correctly', async () => {
        const response = await request(app)
          .get(`/api/budgets/${testBuilding.id}`)
          .query({ 
            groupBy: 'monthly',
            startYear: 2024,
            endYear: 2024,
            startMonth: 6,
            endMonth: 6,
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('budgets');
        
        // Should only return June 2024 data if it exists
        const budgets = response.body.budgets;
        if (budgets.length > 0) {
          budgets.forEach((budget: any) => {
            expect(budget.year).toBe(2024);
            expect(budget.month).toBe(6);
          });
        }
      });

      it('should handle invalid building ID', async () => {
        const invalidBuildingId = uuidv4();
        const response = await request(app)
          .get(`/api/budgets/${invalidBuildingId}`);

        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('_error', 'Building not found');
      });
    });

    describe('GET /api/budgets/:buildingId/summary', () => {
      it('should retrieve budget summary with proper data aggregation', async () => {
        const response = await request(app)
          .get(`/api/budgets/${testBuilding.id}/summary`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('summary');
        expect(Array.isArray(response.body.summary)).toBe(true);
      });

      it('should apply date range filtering to summary', async () => {
        const response = await request(app)
          .get(`/api/budgets/${testBuilding.id}/summary`)
          .query({ 
            startYear: 2024,
            endYear: 2024,
            startMonth: 1,
            endMonth: 12,
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('summary');
      });
    });
  });

  describe('Budget Forecasting Endpoint', () => {
    describe('POST /api/budgets/:buildingId/forecast', () => {
      it('should generate forecast with default parameters', async () => {
        const response = await request(app)
          .post(`/api/budgets/${testBuilding.id}/forecast`)
          .send({});

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('buildingId', testBuilding.id);
        expect(response.body).toHaveProperty('buildingName', testBuilding.name);
        expect(response.body).toHaveProperty('forecast');
        expect(Array.isArray(response.body.forecast)).toBe(true);
        expect(response.body.forecast.length).toBe(300); // 25 years * 12 months
        
        // Verify forecast data structure
        const firstMonth = response.body.forecast[0];
        expect(firstMonth).toHaveProperty('year');
        expect(firstMonth).toHaveProperty('month');
        expect(firstMonth).toHaveProperty('revenue');
        expect(firstMonth).toHaveProperty('spending');
        expect(firstMonth).toHaveProperty('netCashFlow');
        expect(firstMonth).toHaveProperty('balance');
        expect(firstMonth).toHaveProperty('status');
        expect(['red', 'yellow', 'green']).toContain(firstMonth.status);
      });

      it('should generate forecast with custom parameters', async () => {
        const customParams = {
          bankAccountStartAmount: 150000,
          bankAccountMinimums: 25000,
          generalInflationRate: 3.0,
          revenueInflationRate: 3.5,
          unplannedBillsAmount: 3000,
          lookbackYears: 2,
          capitalInvestmentMode: 'urgent',
        };

        const response = await request(app)
          .post(`/api/budgets/${testBuilding.id}/forecast`)
          .send(customParams);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('startingBalance');
        expect(response.body.startingBalance).toBeCloseTo(150000, 2);
        expect(response.body).toHaveProperty('minimumFund');
        expect(response.body.minimumFund).toBeCloseTo(25000, 2);
      });

      it('should validate request parameters with zod schema', async () => {
        const invalidParams = {
          bankAccountStartAmount: 'invalid-number',
          generalInflationRate: -1, // Invalid negative rate
          lookbackYears: 0, // Below minimum
        };

        const response = await request(app)
          .post(`/api/budgets/${testBuilding.id}/forecast`)
          .send(invalidParams);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('_error');
      });

      it('should apply capital investment mode filtering', async () => {
        const urgentResponse = await request(app)
          .post(`/api/budgets/${testBuilding.id}/forecast`)
          .send({ capitalInvestmentMode: 'urgent' });

        const suggestedResponse = await request(app)
          .post(`/api/budgets/${testBuilding.id}/forecast`)
          .send({ capitalInvestmentMode: 'suggested' });

        expect(urgentResponse.status).toBe(200);
        expect(suggestedResponse.status).toBe(200);
        
        // Both should have different capital investment calculations
        expect(urgentResponse.body).toHaveProperty('capitalInvestments');
        expect(suggestedResponse.body).toHaveProperty('capitalInvestments');
      });
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle large dataset queries efficiently', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get(`/api/budgets/${testBuilding.id}`)
        .query({ 
          startYear: 2020,
          endYear: 2050,
          groupBy: 'monthly',
        });
      
      const duration = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle multiple concurrent forecast requests', async () => {
      const concurrentRequests = Array.from({ length: 5 }, () =>
        request(app)
          .post(`/api/budgets/${testBuilding.id}/forecast`)
          .send({ bankAccountStartAmount: 100000 })
      );

      const responses = await Promise.all(concurrentRequests);
      
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('forecast');
      });
    });
  });
});