/**
 * @file Error Handling and Edge Cases Integration Tests
 * @description Comprehensive tests for error scenarios, validation, authorization, and edge cases
 */

import request from 'supertest';
import express from 'express';
import session from 'express-session';
import { sql } from '../../server/db';
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';

// Import test utilities
import { TestDataFactory, DatabaseTestUtils } from '../utils/budget-test-utils';

// Import the actual budget router
import budgetRouter from '../../server/api/budgets';

// Test types
interface AuthenticatedUser {
  id: string;
  role: 'admin' | 'manager' | 'tenant' | 'resident' | 'demo_manager' | 'demo_tenant' | 'demo_resident';
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

describe('Error Handling and Edge Cases Integration Tests', () => {
  let app: express.Application;
  let testOrg: any;
  let testUser: any;
  let testBuilding: any;
  let unauthorizedUser: any;
  
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
    app.use(express.json({ limit: '50mb' })); // Test large payloads
    app.use(express.urlencoded({ extended: true }));
    
    // Set up session middleware
    app.use(session({
      secret: 'test-secret-error-handling',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false },
    }));

    // Create test organization and users
    testOrg = TestDataFactory.createOrganization();
    testUser = TestDataFactory.createUser({ role: 'admin' });
    unauthorizedUser = TestDataFactory.createUser({ role: 'tenant' });

    await DatabaseTestUtils.insertOrganization(testOrg);
    await DatabaseTestUtils.insertUser(testUser);
    await DatabaseTestUtils.insertUser(unauthorizedUser);
    
    createdIds.organizations.push(testOrg.id);
    createdIds.users.push(testUser.id, unauthorizedUser.id);

    // Create test building
    testBuilding = TestDataFactory.createBuilding(testOrg.id);
    await DatabaseTestUtils.insertBuilding(testBuilding);
    createdIds.buildings.push(testBuilding.id);

    // Dynamic authentication middleware for testing different scenarios
    let currentUser: AuthenticatedUser | null = testUser;
    
    app.use((req, res, next) => {
      req.user = currentUser || undefined;
      next();
    });

    // Utility to change current user for tests
    (global as any).setCurrentUser = (user: AuthenticatedUser | null) => {
      currentUser = user;
    };

    app.use('/api/budgets', budgetRouter);
  }, 30000);

  afterAll(async () => {
    // Final cleanup
    await DatabaseTestUtils.cleanupAll(createdIds);
  }, 15000);

  describe('Authentication and Authorization Errors', () => {
    it('should return 401 for unauthenticated requests', async () => {
      (global as any).setCurrentUser(null);

      const response = await request(app)
        .get(`/api/budgets/${testBuilding.id}`);

      expect(response.status).toBe(401);
    });

    it('should return 403 for unauthorized roles on sensitive operations', async () => {
      (global as any).setCurrentUser(unauthorizedUser);

      // Tenant should not be able to modify bank account settings
      const response = await request(app)
        .put(`/api/budgets/${testBuilding.id}/bank-account`)
        .send({
          bankAccountStartAmount: 999999,
          generalInflationRate: 50,
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('_error');
      expect(response.body._error).toContain('permission');
    });

    it('should handle missing authorization headers gracefully', async () => {
      (global as any).setCurrentUser(undefined);

      const response = await request(app)
        .post(`/api/budgets/${testBuilding.id}/forecast`)
        .send({ bankAccountStartAmount: 100000 });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('_error');
    });

    it('should validate user organization access to buildings', async () => {
      // Create user from different organization
      const otherOrg = TestDataFactory.createOrganization();
      const otherUser = TestDataFactory.createUser({ role: 'admin' });
      
      await DatabaseTestUtils.insertOrganization(otherOrg);
      await DatabaseTestUtils.insertUser(otherUser);
      
      createdIds.organizations.push(otherOrg.id);
      createdIds.users.push(otherUser.id);

      (global as any).setCurrentUser(otherUser);

      const response = await request(app)
        .get(`/api/budgets/${testBuilding.id}/bank-account`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('_error');
    });
  });

  describe('Invalid Input Validation', () => {
    beforeEach(() => {
      (global as any).setCurrentUser(testUser);
    });

    it('should reject invalid building IDs', async () => {
      const responses = await Promise.all([
        request(app).get('/api/budgets/invalid-uuid'),
        request(app).get('/api/budgets/'),
        request(app).get('/api/budgets/12345'),
        request(app).get(`/api/budgets/${uuidv4()}`), // Valid UUID but non-existent
      ]);

      responses.forEach((response, index) => {
        if (index < 3) {
          expect(response.status).toBe(400); // Invalid format
        } else {
          expect(response.status).toBe(404); // Valid format but not found
        }
      });
    });

    it('should validate forecast request parameters with zod schema', async () => {
      const invalidRequests = [
        {
          data: { bankAccountStartAmount: -50000 },
          expectedError: 'negative',
        },
        {
          data: { generalInflationRate: -10 },
          expectedError: 'negative',
        },
        {
          data: { revenueInflationRate: 1000 },
          expectedError: 'too high',
        },
        {
          data: { lookbackYears: 0 },
          expectedError: 'minimum',
        },
        {
          data: { lookbackYears: 50 },
          expectedError: 'maximum',
        },
        {
          data: { capitalInvestmentMode: 'invalid_mode' },
          expectedError: 'enum',
        },
        {
          data: { bankAccountStartAmount: 'not-a-number' },
          expectedError: 'type',
        },
      ];

      for (const { data } of invalidRequests) {
        const response = await request(app)
          .post(`/api/budgets/${testBuilding.id}/forecast`)
          .send(data);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('_error');
      }
    });

    it('should validate bank account update data thoroughly', async () => {
      const invalidUpdates = [
        {
          bankAccountStartAmount: 'invalid-number',
          description: 'Invalid number format',
        },
        {
          generalInflationRate: -5,
          description: 'Negative inflation rate',
        },
        {
          customBankFields: 'not-an-object',
          description: 'Invalid object format',
        },
        {
          customRevenueLines: [
            { id: 'valid', description: 'Valid line', monthlyAmount: 'invalid' },
          ],
          description: 'Invalid revenue line amount',
        },
        {
          financialYearStart: 'invalid-date-format',
          description: 'Invalid date format',
        },
        {
          bankAccountMinimums: -1000,
          description: 'Negative minimum amount',
        },
      ];

      for (const update of invalidUpdates) {
        const { description, ...data } = update;
        const response = await request(app)
          .put(`/api/budgets/${testBuilding.id}/bank-account`)
          .send(data);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('_error');
      }
    });

    it('should validate capital investment data comprehensively', async () => {
      const invalidInvestments = [
        {
          // Missing required title
          amount: 50000,
          urgency: 'urgent',
        },
        {
          title: 'Test Investment',
          amount: -10000, // Negative amount
          urgency: 'urgent',
        },
        {
          title: 'Test Investment',
          amount: 50000,
          urgency: 'invalid_urgency', // Invalid enum
        },
        {
          title: 'Test Investment',
          amount: 50000,
          urgency: 'urgent',
          targetDate: 'invalid-date',
        },
        {
          title: '', // Empty title
          amount: 50000,
          urgency: 'urgent',
        },
      ];

      for (const investment of invalidInvestments) {
        const response = await request(app)
          .post(`/api/budgets/${testBuilding.id}/capital-investments`)
          .send(investment);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('_error');
      }
    });
  });

  describe('Malformed Request Bodies', () => {
    beforeEach(() => {
      (global as any).setCurrentUser(testUser);
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuilding.id}/forecast`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });

    it('should handle extremely large payloads', async () => {
      const largeData = {
        customBankFields: {},
        customRevenueLines: [],
        largeArray: new Array(100000).fill('data'),
      };

      // Fill with large data
      for (let i = 0; i < 10000; i++) {
        largeData.customBankFields[`field_${i}`] = Math.random() * 1000000;
        largeData.customRevenueLines.push({
          id: `revenue_${i}`,
          description: `Large revenue line ${i}`.repeat(100),
          monthlyAmount: Math.random() * 10000,
        });
      }

      const response = await request(app)
        .put(`/api/budgets/${testBuilding.id}/bank-account`)
        .send(largeData);

      // Should either reject due to size or handle gracefully
      expect([400, 413, 500]).toContain(response.status);
    });

    it('should handle null and undefined values correctly', async () => {
      const dataWithNulls = {
        bankAccountStartAmount: null,
        generalInflationRate: undefined,
        customBankFields: null,
        customRevenueLines: null,
      };

      const response = await request(app)
        .put(`/api/budgets/${testBuilding.id}/bank-account`)
        .send(dataWithNulls);

      expect(response.status).toBe(200);
    });

    it('should handle circular reference objects', async () => {
      const circularObj: any = { name: 'circular' };
      circularObj.self = circularObj;

      // This should be handled by express.json() middleware
      const response = await request(app)
        .put(`/api/budgets/${testBuilding.id}/bank-account`)
        .send({ customBankFields: circularObj });

      expect([400, 500]).toContain(response.status);
    });
  });

  describe('Database Transaction Atomicity', () => {
    beforeEach(() => {
      (global as any).setCurrentUser(testUser);
    });

    it('should rollback failed multi-field bank account updates', async () => {
      // First, set some initial values
      const initialData = {
        bankAccountNumber: 'INITIAL-ACCOUNT-123',
        bankAccountStartAmount: 100000,
        generalInflationRate: 2.5,
      };

      await request(app)
        .put(`/api/budgets/${testBuilding.id}/bank-account`)
        .send(initialData)
        .expect(200);

      // Attempt update with mixed valid/invalid data
      const mixedData = {
        bankAccountNumber: 'UPDATED-ACCOUNT-456',
        bankAccountStartAmount: 200000,
        generalInflationRate: -999, // This should cause validation failure
        customBankFields: { validField: 15000 },
      };

      const response = await request(app)
        .put(`/api/budgets/${testBuilding.id}/bank-account`)
        .send(mixedData);

      expect(response.status).toBe(400);

      // Verify that none of the changes were applied
      const verifyResponse = await request(app)
        .get(`/api/budgets/${testBuilding.id}/bank-account`);

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.bankAccountNumber).toBe('INITIAL-ACCOUNT-123');
      expect(verifyResponse.body.bankAccountStartAmount).toBe(100000);
      expect(parseFloat(verifyResponse.body.generalInflationRate)).toBe(2.5);
    });

    it('should handle concurrent modification scenarios', async () => {
      // Create a capital investment for concurrent modification
      const investment = TestDataFactory.createCapitalInvestment(testBuilding.id);
      await DatabaseTestUtils.insertCapitalInvestment(investment);
      createdIds.capitalInvestments.push(investment.id);

      // Simulate concurrent modifications
      const update1 = {
        title: 'Concurrent Update 1',
        amount: 75000,
      };

      const update2 = {
        title: 'Concurrent Update 2',
        amount: 80000,
      };

      const [response1, response2] = await Promise.all([
        request(app)
          .put(`/api/budgets/${testBuilding.id}/capital-investments/${investment.id}`)
          .send(update1),
        request(app)
          .put(`/api/budgets/${testBuilding.id}/capital-investments/${investment.id}`)
          .send(update2),
      ]);

      // Both should succeed (last write wins)
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // Verify final state is consistent
      const finalState = await request(app)
        .get(`/api/budgets/${testBuilding.id}/capital-investments/${investment.id}`);

      expect(finalState.status).toBe(200);
      expect(['Concurrent Update 1', 'Concurrent Update 2']).toContain(
        finalState.body.capitalInvestment.title
      );
    });

    it('should handle database constraint violations gracefully', async () => {
      // Try to create capital investment with invalid building ID
      const invalidInvestment = TestDataFactory.createCapitalInvestment('invalid-building-id');

      const response = await request(app)
        .post(`/api/budgets/invalid-building-id/capital-investments`)
        .send({
          title: invalidInvestment.title,
          amount: invalidInvestment.amount,
          urgency: invalidInvestment.urgency,
          type: invalidInvestment.type,
          ownershipType: invalidInvestment.ownershipType,
          category: invalidInvestment.category,
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('_error', 'Building not found');
    });
  });

  describe('Large Dataset and Performance Boundaries', () => {
    beforeEach(() => {
      (global as any).setCurrentUser(testUser);
    });

    it('should handle large budget queries efficiently', async () => {
      // Create many monthly budgets
      const budgets = [];
      for (let year = 2020; year <= 2030; year++) {
        for (let month = 1; month <= 12; month++) {
          const budget = TestDataFactory.createMonthlyBudget(testBuilding.id, {
            year,
            month,
          });
          budgets.push(budget);
        }
      }

      // Insert in batches for performance
      for (let i = 0; i < budgets.length; i += 50) {
        const batch = budgets.slice(i, i + 50);
        await Promise.all(batch.map(budget => DatabaseTestUtils.insertMonthlyBudget(budget)));
        batch.forEach(budget => createdIds.monthlyBudgets.push(budget.id));
      }

      const startTime = Date.now();

      const response = await request(app)
        .get(`/api/budgets/${testBuilding.id}`)
        .query({
          startYear: 2020,
          endYear: 2030,
          groupBy: 'monthly',
        });

      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(response.body.budgets.length).toBeGreaterThan(100);
    });

    it('should handle complex forecast calculations within reasonable time', async () => {
      // Create many bills and capital investments
      const bills = Array.from({ length: 20 }, () =>
        TestDataFactory.createBill(testBuilding.id, testUser.id)
      );

      const investments = Array.from({ length: 30 }, () =>
        TestDataFactory.createCapitalInvestment(testBuilding.id)
      );

      // Insert test data
      await Promise.all([
        ...bills.map(bill => DatabaseTestUtils.insertBill(bill)),
        ...investments.map(investment => DatabaseTestUtils.insertCapitalInvestment(investment)),
      ]);

      bills.forEach(bill => createdIds.bills.push(bill.id));
      investments.forEach(investment => createdIds.capitalInvestments.push(investment.id));

      const startTime = Date.now();

      const response = await request(app)
        .post(`/api/budgets/${testBuilding.id}/forecast`)
        .send({
          bankAccountStartAmount: 500000,
          capitalInvestmentMode: 'suggested',
          lookbackYears: 5,
        });

      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
      expect(response.body.forecast).toHaveLength(300);
      expect(response.body.capitalInvestments.length).toBeGreaterThan(0);
    });

    it('should handle multiple concurrent complex requests', async () => {
      const concurrentRequests = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post(`/api/budgets/${testBuilding.id}/forecast`)
          .send({
            bankAccountStartAmount: 100000 + i * 50000,
            capitalInvestmentMode: i % 2 === 0 ? 'urgent' : 'suggested',
            lookbackYears: 3,
          })
      );

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRequests);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(20000); // All should complete within 20 seconds

      responses.forEach((response, i) => {
        expect(response.status).toBe(200);
        expect(response.body.forecast).toHaveLength(300);
        expect(response.body.startingBalance).toBe(100000 + i * 50000);
      });
    });
  });

  describe('Edge Cases and Corner Scenarios', () => {
    beforeEach(() => {
      (global as any).setCurrentUser(testUser);
    });

    it('should handle extreme inflation rates correctly', async () => {
      const extremeRates = [
        { generalInflationRate: 0, revenueInflationRate: 0 }, // Zero inflation
        { generalInflationRate: 0.001, revenueInflationRate: 0.001 }, // Tiny inflation
        { generalInflationRate: 20, revenueInflationRate: 25 }, // High inflation
      ];

      for (const rates of extremeRates) {
        const response = await request(app)
          .post(`/api/budgets/${testBuilding.id}/forecast`)
          .send({
            bankAccountStartAmount: 100000,
            ...rates,
          });

        expect(response.status).toBe(200);
        expect(response.body.forecast).toHaveLength(300);
        
        // Verify inflation is applied correctly
        const laterMonth = response.body.forecast[100]; // Month 100+
        if (rates.generalInflationRate > 0) {
          expect(laterMonth.inflatedExpenses).toBeGreaterThan(laterMonth.spending);
        } else {
          expect(laterMonth.inflatedExpenses).toBe(laterMonth.spending);
        }
      }
    });

    it('should handle financial year start edge cases', async () => {
      const edgeDates = [
        '2024-01-01', // Beginning of year
        '2024-12-31', // End of year
        '2024-02-29', // Leap year
        '2025-02-28', // Non-leap year
      ];

      for (const date of edgeDates) {
        const response = await request(app)
          .put(`/api/budgets/${testBuilding.id}/bank-account`)
          .send({
            financialYearStart: date,
            generalInflationRate: 3.0,
          });

        expect(response.status).toBe(200);

        // Verify the date was stored correctly
        const getResponse = await request(app)
          .get(`/api/budgets/${testBuilding.id}/bank-account`);

        expect(getResponse.status).toBe(200);
        expect(getResponse.body.financialYearStart).toBe(date);
      }
    });

    it('should handle empty and minimal datasets', async () => {
      // Create a building with no associated data
      const emptyBuilding = TestDataFactory.createBuilding(testOrg.id);
      await DatabaseTestUtils.insertBuilding(emptyBuilding);
      createdIds.buildings.push(emptyBuilding.id);

      const responses = await Promise.all([
        request(app).get(`/api/budgets/${emptyBuilding.id}`),
        request(app).get(`/api/budgets/${emptyBuilding.id}/summary`),
        request(app).post(`/api/budgets/${emptyBuilding.id}/forecast`).send({}),
        request(app).get(`/api/budgets/${emptyBuilding.id}/capital-investments`),
      ]);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        // Should return empty or sample data, not errors
      });
    });

    it('should handle special characters in text fields', async () => {
      const specialCharData = {
        bankAccountNumber: 'SPECIAL-àéü-中文-🏠-123',
        bankAccountNotes: 'Notes with special chars: <>[]{}|\\~`!@#$%^&*()_+-=',
        customBankFields: {
          'field-with-dashes': 5000,
          'field_with_underscores': 3000,
          'field with spaces': 2000,
        },
        customRevenueLines: [
          {
            id: 'special-chars-àéü',
            description: 'Revenue with 中文 and émojis 🏠💰',
            monthlyAmount: 1500,
          },
        ],
      };

      const response = await request(app)
        .put(`/api/budgets/${testBuilding.id}/bank-account`)
        .send(specialCharData);

      expect(response.status).toBe(200);

      // Verify data integrity
      const getResponse = await request(app)
        .get(`/api/budgets/${testBuilding.id}/bank-account`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.bankAccountNumber).toBe(specialCharData.bankAccountNumber);
      expect(getResponse.body.bankAccountNotes).toBe(specialCharData.bankAccountNotes);
      expect(getResponse.body.customBankFields).toEqual(specialCharData.customBankFields);
      expect(getResponse.body.customRevenueLines).toEqual(specialCharData.customRevenueLines);
    });

    it('should handle timezone and date edge cases', async () => {
      const dateEdgeCases = [
        '2024-02-29', // Leap year
        '2023-02-28', // Non-leap year
        '2024-12-31', // End of year
        '2025-01-01', // Beginning of year
      ];

      for (const date of dateEdgeCases) {
        const investment = TestDataFactory.createCapitalInvestment(testBuilding.id, {
          targetDate: date,
        });

        const response = await request(app)
          .post(`/api/budgets/${testBuilding.id}/capital-investments`)
          .send({
            title: investment.title,
            amount: investment.amount,
            targetDate: investment.targetDate,
            urgency: investment.urgency,
            type: investment.type,
            ownershipType: investment.ownershipType,
            category: investment.category,
          });

        expect(response.status).toBe(201);
        expect(response.body.capitalInvestment.targetDate).toBe(date);

        createdIds.capitalInvestments.push(response.body.capitalInvestment.id);
      }
    });
  });

  describe('Rate Limiting and DOS Protection', () => {
    beforeEach(() => {
      (global as any).setCurrentUser(testUser);
    });

    it('should handle rapid sequential requests gracefully', async () => {
      const rapidRequests = Array.from({ length: 20 }, () =>
        request(app).get(`/api/budgets/${testBuilding.id}/bank-account`)
      );

      const responses = await Promise.all(rapidRequests);

      // All should succeed or be handled gracefully
      responses.forEach((response) => {
        expect([200, 429, 503]).toContain(response.status); // Allow rate limiting or service unavailable
      });

      // At least some should succeed
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThan(10);
    });
  });

  afterEach(async () => {
    // Reset authentication for next test
    (global as any).setCurrentUser(testUser);
    
    // Clean up test data created during each test
    const cleanup = async (table: string, ids: string[]) => {
      if (ids.length > 0) {
        await sql`DELETE FROM ${sql(table)} WHERE id = ANY(${ids})`;
        ids.length = 0;
      }
    };

    await cleanup('capital_investments', createdIds.capitalInvestments);
    await cleanup('monthly_budgets', createdIds.monthlyBudgets);
    await cleanup('bills', createdIds.bills);
    await cleanup('residences', createdIds.residences);
  });
});