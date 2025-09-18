/**
 * @file Bank Account Operations Integration Tests
 * @description Comprehensive tests for bank account GET/PUT operations with database persistence
 * Tests configuration fields, round-trip operations, and validation
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
  buildingType: 'apartment';
  totalUnits: number;
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

describe('Bank Account Operations Integration Tests', () => {
  let app: express.Application;
  let testOrg: TestOrganization;
  let testUser: TestUser;
  let testBuilding: TestBuilding;
  
  // Test data cleanup tracking
  const createdIds = {
    organizations: [] as string[],
    users: [] as string[],
    buildings: [] as string[],
  };

  beforeAll(async () => {
    // Create Express app with all necessary middleware
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Set up session middleware
    app.use(session({
      secret: 'test-secret-key-bank-account-tests',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false },
    }));

    // Create test organization
    testOrg = {
      id: uuidv4(),
      name: 'Bank Account Test Org',
      domain: 'bank-account-test.com',
    };

    await sql`
      INSERT INTO organizations (id, name, domain, created_at, updated_at)
      VALUES (${testOrg.id}, ${testOrg.name}, ${testOrg.domain}, NOW(), NOW())
    `;
    createdIds.organizations.push(testOrg.id);

    // Create test user
    testUser = {
      id: uuidv4(),
      username: 'bank-account-test-user',
      email: 'bank-account-test@example.com',
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
    // Create test building for each test
    testBuilding = {
      id: uuidv4(),
      organizationId: testOrg.id,
      name: 'Bank Account Test Building',
      address: '456 Bank Street',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H2B 2B2',
      buildingType: 'apartment',
      totalUnits: 30,
    };

    await sql`
      INSERT INTO buildings (
        id, organization_id, name, address, city, province, postal_code, 
        building_type, total_units, created_at, updated_at
      )
      VALUES (
        ${testBuilding.id}, ${testBuilding.organizationId}, ${testBuilding.name}, 
        ${testBuilding.address}, ${testBuilding.city}, ${testBuilding.province}, 
        ${testBuilding.postalCode}, ${testBuilding.buildingType}, ${testBuilding.totalUnits}, 
        NOW(), NOW()
      )
    `;
    createdIds.buildings.push(testBuilding.id);
  }, 15000);

  afterEach(async () => {
    // Clean up buildings after each test
    if (createdIds.buildings.length > 0) {
      await sql`DELETE FROM buildings WHERE id = ANY(${createdIds.buildings})`;
      createdIds.buildings.length = 0;
    }
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

  describe('Bank Account GET Operations', () => {
    it('should retrieve bank account data for building without configuration', async () => {
      const response = await request(app)
        .get(`/api/budgets/${testBuilding.id}/bank-account`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('buildingId', testBuilding.id);
      expect(response.body).toHaveProperty('buildingName', testBuilding.name);
      
      // Should have default/empty values
      expect(response.body.bankAccountNumber).toBeNull();
      expect(response.body.bankAccountStartAmount).toBeNull();
      expect(response.body.generalInflationRate).toBe('2.0'); // Default value
      expect(response.body.revenueInflationRate).toBe('2.0'); // Default value
    });

    it('should retrieve bank account data for building with full configuration', async () => {
      // First update the building with comprehensive bank account data
      const fullConfiguration = {
        bankAccountNumber: 'TEST-BANK-123456789',
        bankAccountNotes: 'Integration test bank account',
        bankAccountStartDate: '2024-01-01',
        bankAccountStartAmount: 250000,
        bankAccountMinimums: 35000,
        emergencyFundMinimum: 20000,
        operatingCashMinimum: 15000,
        generalInflationRate: 2.8,
        revenueInflationRate: 3.2,
        unplannedBillsAmount: 4500,
        financialYearStart: '2024-04-01',
        customBankFields: {
          maintenanceReserve: 18000,
          capitalImprovementFund: 12000,
          contingencyFund: 8000,
        },
        customRevenueLines: [
          { id: 'gym', description: 'Gym membership fees', monthlyAmount: 1200 },
          { id: 'storage', description: 'Storage unit rental', monthlyAmount: 800 },
          { id: 'guest_parking', description: 'Guest parking fees', monthlyAmount: 600 },
        ],
        inflationSettings: {
          useGlobalBillsInflation: false,
          categoryInflationRates: {
            monthly_fees: 3.8,
            utilities: 3.0,
            maintenance: 3.5,
            insurance: 2.5,
          },
        },
      };

      // Update building configuration
      await request(app)
        .put(`/api/budgets/${testBuilding.id}/bank-account`)
        .send(fullConfiguration)
        .expect(200);

      // Now retrieve and verify all fields
      const response = await request(app)
        .get(`/api/budgets/${testBuilding.id}/bank-account`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('buildingId', testBuilding.id);
      expect(response.body).toHaveProperty('buildingName', testBuilding.name);
      
      // Verify all configuration fields
      expect(response.body.bankAccountNumber).toBe(fullConfiguration.bankAccountNumber);
      expect(response.body.bankAccountNotes).toBe(fullConfiguration.bankAccountNotes);
      expect(response.body.bankAccountStartDate).toBe(fullConfiguration.bankAccountStartDate);
      expect(response.body.bankAccountStartAmount).toBe(fullConfiguration.bankAccountStartAmount);
      expect(response.body.bankAccountMinimums).toBe(fullConfiguration.bankAccountMinimums);
      expect(response.body.emergencyFundMinimum).toBe(fullConfiguration.emergencyFundMinimum);
      expect(response.body.operatingCashMinimum).toBe(fullConfiguration.operatingCashMinimum);
      expect(parseFloat(response.body.generalInflationRate)).toBe(fullConfiguration.generalInflationRate);
      expect(parseFloat(response.body.revenueInflationRate)).toBe(fullConfiguration.revenueInflationRate);
      expect(parseFloat(response.body.unplannedBillsAmount)).toBe(fullConfiguration.unplannedBillsAmount);
      expect(response.body.financialYearStart).toBe(fullConfiguration.financialYearStart);
      
      // Verify complex objects
      expect(response.body.customBankFields).toEqual(fullConfiguration.customBankFields);
      expect(response.body.customRevenueLines).toEqual(fullConfiguration.customRevenueLines);
      expect(response.body.inflationSettings).toEqual(fullConfiguration.inflationSettings);
    });

    it('should handle invalid building ID', async () => {
      const invalidBuildingId = uuidv4();
      const response = await request(app)
        .get(`/api/budgets/${invalidBuildingId}/bank-account`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('_error', 'Building not found');
    });
  });

  describe('Bank Account PUT Operations', () => {
    it('should update basic bank account information', async () => {
      const basicUpdate = {
        bankAccountNumber: 'BASIC-ACCOUNT-987654321',
        bankAccountNotes: 'Updated basic account information',
        bankAccountStartAmount: 125000,
        generalInflationRate: 2.6,
        revenueInflationRate: 3.1,
      };

      const response = await request(app)
        .put(`/api/budgets/${testBuilding.id}/bank-account`)
        .send(basicUpdate);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Bank account updated successfully');
      expect(response.body).toHaveProperty('buildingId', testBuilding.id);

      // Verify database was updated
      const dbCheck = await sql`
        SELECT bank_account_number, bank_account_notes, bank_account_start_amount,
               general_inflation_rate, revenue_inflation_rate, bank_account_updated_at
        FROM buildings 
        WHERE id = ${testBuilding.id}
      `;

      expect(dbCheck).toHaveLength(1);
      const building = dbCheck[0];
      expect(building.bank_account_number).toBe(basicUpdate.bankAccountNumber);
      expect(building.bank_account_notes).toBe(basicUpdate.bankAccountNotes);
      expect(parseFloat(building.bank_account_start_amount)).toBe(basicUpdate.bankAccountStartAmount);
      expect(parseFloat(building.general_inflation_rate)).toBe(basicUpdate.generalInflationRate);
      expect(parseFloat(building.revenue_inflation_rate)).toBe(basicUpdate.revenueInflationRate);
      expect(building.bank_account_updated_at).toBeTruthy();
    });

    it('should update complex bank account configuration', async () => {
      const complexUpdate = {
        bankAccountNumber: 'COMPLEX-ACCOUNT-456789123',
        bankAccountStartDate: '2024-03-15',
        bankAccountStartAmount: 300000,
        bankAccountMinimums: 50000,
        emergencyFundMinimum: 30000,
        operatingCashMinimum: 20000,
        unplannedBillsAmount: 6000,
        financialYearStart: '2024-07-01',
        customBankFields: {
          legalReserve: 25000,
          emergencyRepairs: 15000,
          futureUpgrades: 20000,
          insuranceDeductible: 5000,
        },
        customRevenueLines: [
          { id: 'concierge', description: 'Concierge services', monthlyAmount: 2000 },
          { id: 'roof_garden', description: 'Roof garden access', monthlyAmount: 500 },
        ],
        inflationSettings: {
          useGlobalBillsInflation: true,
          globalBillsInflationRate: 2.7,
          categoryInflationRates: {
            monthly_fees: 4.0,
            utilities: 3.3,
            maintenance: 3.8,
            professional_services: 2.8,
            insurance: 2.2,
          },
        },
      };

      const response = await request(app)
        .put(`/api/budgets/${testBuilding.id}/bank-account`)
        .send(complexUpdate);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);

      // Verify all complex fields were stored correctly in database
      const dbCheck = await sql`
        SELECT bank_account_number, bank_account_start_date, bank_account_start_amount,
               bank_account_minimums, unplanned_bills_amount, financial_year_start,
               inflation_settings, amenities
        FROM buildings 
        WHERE id = ${testBuilding.id}
      `;

      const building = dbCheck[0];
      expect(building.bank_account_number).toBe(complexUpdate.bankAccountNumber);
      expect(building.bank_account_start_date).toBe(complexUpdate.bankAccountStartDate);
      expect(parseFloat(building.bank_account_start_amount)).toBe(complexUpdate.bankAccountStartAmount);
      expect(building.bank_account_minimums).toBe(complexUpdate.bankAccountMinimums.toString());
      expect(parseFloat(building.unplanned_bills_amount)).toBe(complexUpdate.unplannedBillsAmount);
      expect(building.financial_year_start).toBe(complexUpdate.financialYearStart);
      
      // Verify JSON fields
      const inflationSettings = JSON.parse(building.inflation_settings);
      expect(inflationSettings).toEqual(complexUpdate.inflationSettings);
      
      const amenities = JSON.parse(building.amenities);
      expect(amenities.emergencyFundMinimum).toBe(complexUpdate.emergencyFundMinimum);
      expect(amenities.operatingCashMinimum).toBe(complexUpdate.operatingCashMinimum);
      expect(amenities.customBankFields).toEqual(complexUpdate.customBankFields);
      expect(amenities.customRevenueLines).toEqual(complexUpdate.customRevenueLines);
    });

    it('should validate required fields and data types', async () => {
      const invalidUpdate = {
        bankAccountStartAmount: 'not-a-number',
        generalInflationRate: -5, // Invalid negative rate
        revenueInflationRate: 'invalid-rate',
        financialYearStart: 'invalid-date',
        customBankFields: 'not-an-object',
      };

      const response = await request(app)
        .put(`/api/budgets/${testBuilding.id}/bank-account`)
        .send(invalidUpdate);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('_error');
      expect(response.body._error).toContain('validation');
    });

    it('should handle concurrent updates correctly', async () => {
      // Simulate concurrent updates to the same building
      const update1 = {
        bankAccountNumber: 'CONCURRENT-1',
        bankAccountStartAmount: 100000,
        generalInflationRate: 2.5,
      };

      const update2 = {
        bankAccountNumber: 'CONCURRENT-2',
        bankAccountStartAmount: 200000,
        revenueInflationRate: 3.5,
      };

      // Send both requests simultaneously
      const [response1, response2] = await Promise.all([
        request(app)
          .put(`/api/budgets/${testBuilding.id}/bank-account`)
          .send(update1),
        request(app)
          .put(`/api/budgets/${testBuilding.id}/bank-account`)
          .send(update2),
      ]);

      // Both should succeed (last write wins)
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // Verify final state - should have values from one of the updates
      const finalState = await request(app)
        .get(`/api/budgets/${testBuilding.id}/bank-account`);

      expect(finalState.status).toBe(200);
      // The bankAccountNumber should be from one of the updates
      expect(['CONCURRENT-1', 'CONCURRENT-2']).toContain(finalState.body.bankAccountNumber);
    });
  });

  describe('Round-trip Persistence Tests', () => {
    it('should persist and retrieve all configuration fields correctly', async () => {
      const testConfiguration = {
        bankAccountNumber: 'ROUNDTRIP-TEST-123',
        bankAccountNotes: 'Complete round-trip test configuration',
        bankAccountStartDate: '2024-02-29', // Leap year test
        bankAccountStartAmount: 175500.75,
        bankAccountMinimums: 42500.25,
        emergencyFundMinimum: 25000,
        operatingCashMinimum: 17500.25,
        generalInflationRate: 2.75,
        revenueInflationRate: 3.15,
        unplannedBillsAmount: 5250.50,
        financialYearStart: '2024-10-01',
        customBankFields: {
          snowRemovalReserve: 8000,
          elevatorMaintenanceFund: 12000,
          roofRepairFund: 15000,
          paintingReserve: 6000,
          landscapingFund: 4000,
        },
        customRevenueLines: [
          { id: 'bike_storage', description: 'Bicycle storage fees', monthlyAmount: 250 },
          { id: 'party_room', description: 'Party room rental', monthlyAmount: 400 },
          { id: 'electric_charging', description: 'EV charging stations', monthlyAmount: 300 },
        ],
        inflationSettings: {
          useGlobalBillsInflation: false,
          globalBillsInflationRate: 2.9,
          categoryInflationRates: {
            monthly_fees: 3.6,
            utilities: 3.1,
            maintenance: 3.7,
            insurance: 2.4,
            professional_services: 2.9,
            supplies: 3.2,
            technology: 1.8,
          },
        },
      };

      // Step 1: Save configuration
      const saveResponse = await request(app)
        .put(`/api/budgets/${testBuilding.id}/bank-account`)
        .send(testConfiguration);

      expect(saveResponse.status).toBe(200);
      expect(saveResponse.body.success).toBe(true);

      // Step 2: Retrieve configuration
      const retrieveResponse = await request(app)
        .get(`/api/budgets/${testBuilding.id}/bank-account`);

      expect(retrieveResponse.status).toBe(200);

      // Step 3: Verify all fields match exactly
      const retrieved = retrieveResponse.body;
      expect(retrieved.bankAccountNumber).toBe(testConfiguration.bankAccountNumber);
      expect(retrieved.bankAccountNotes).toBe(testConfiguration.bankAccountNotes);
      expect(retrieved.bankAccountStartDate).toBe(testConfiguration.bankAccountStartDate);
      expect(retrieved.bankAccountStartAmount).toBe(testConfiguration.bankAccountStartAmount);
      expect(retrieved.bankAccountMinimums).toBe(testConfiguration.bankAccountMinimums);
      expect(retrieved.emergencyFundMinimum).toBe(testConfiguration.emergencyFundMinimum);
      expect(retrieved.operatingCashMinimum).toBe(testConfiguration.operatingCashMinimum);
      expect(parseFloat(retrieved.generalInflationRate)).toBe(testConfiguration.generalInflationRate);
      expect(parseFloat(retrieved.revenueInflationRate)).toBe(testConfiguration.revenueInflationRate);
      expect(parseFloat(retrieved.unplannedBillsAmount)).toBe(testConfiguration.unplannedBillsAmount);
      expect(retrieved.financialYearStart).toBe(testConfiguration.financialYearStart);

      // Verify complex objects
      expect(retrieved.customBankFields).toEqual(testConfiguration.customBankFields);
      expect(retrieved.customRevenueLines).toEqual(testConfiguration.customRevenueLines);
      expect(retrieved.inflationSettings).toEqual(testConfiguration.inflationSettings);
    });

    it('should handle partial updates without losing existing data', async () => {
      // Step 1: Create initial full configuration
      const initialConfig = {
        bankAccountNumber: 'PARTIAL-TEST-INITIAL',
        bankAccountStartAmount: 150000,
        generalInflationRate: 2.5,
        customBankFields: {
          reserve1: 10000,
          reserve2: 15000,
        },
        customRevenueLines: [
          { id: 'initial1', description: 'Initial revenue 1', monthlyAmount: 1000 },
          { id: 'initial2', description: 'Initial revenue 2', monthlyAmount: 1500 },
        ],
      };

      await request(app)
        .put(`/api/budgets/${testBuilding.id}/bank-account`)
        .send(initialConfig)
        .expect(200);

      // Step 2: Partial update - only change some fields
      const partialUpdate = {
        bankAccountNumber: 'PARTIAL-TEST-UPDATED',
        revenueInflationRate: 3.2,
        customBankFields: {
          reserve1: 12000, // Modified existing
          reserve3: 8000,  // New field
        },
      };

      await request(app)
        .put(`/api/budgets/${testBuilding.id}/bank-account`)
        .send(partialUpdate)
        .expect(200);

      // Step 3: Verify partial update worked correctly
      const finalState = await request(app)
        .get(`/api/budgets/${testBuilding.id}/bank-account`);

      expect(finalState.status).toBe(200);
      const final = finalState.body;
      
      // Updated fields
      expect(final.bankAccountNumber).toBe('PARTIAL-TEST-UPDATED');
      expect(parseFloat(final.revenueInflationRate)).toBe(3.2);
      expect(final.customBankFields).toEqual({
        reserve1: 12000,
        reserve3: 8000,
      });

      // Fields that should remain unchanged
      expect(final.bankAccountStartAmount).toBe(150000);
      expect(parseFloat(final.generalInflationRate)).toBe(2.5);
      
      // Custom revenue lines should be updated (replace, not merge)
      expect(final.customRevenueLines).toBe(null); // Not included in partial update
    });
  });

  describe('Database Transaction Integrity', () => {
    it('should rollback transaction on partial failure', async () => {
      // This test would require mocking database errors, which is complex with the current setup
      // For now, we'll test a scenario where validation fails and nothing should be saved
      
      const invalidUpdate = {
        bankAccountNumber: 'TRANSACTION-TEST',
        bankAccountStartAmount: 100000,
        generalInflationRate: 2.5,
        financialYearStart: 'invalid-date-format', // This should cause validation error
      };

      const response = await request(app)
        .put(`/api/budgets/${testBuilding.id}/bank-account`)
        .send(invalidUpdate);

      expect(response.status).toBe(400);

      // Verify that nothing was saved to database
      const dbCheck = await sql`
        SELECT bank_account_number, bank_account_start_amount, general_inflation_rate, financial_year_start
        FROM buildings 
        WHERE id = ${testBuilding.id}
      `;

      const building = dbCheck[0];
      expect(building.bank_account_number).toBeNull(); // Should still be null
      expect(building.bank_account_start_amount).toBeNull();
      expect(building.financial_year_start).toBeNull();
    });
  });
});