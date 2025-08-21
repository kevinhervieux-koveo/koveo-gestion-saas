import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import supertest from 'supertest';
import { Express } from 'express';
import { db } from '../db';
import { buildings, residences, bills, monthlyBudgets, moneyFlow, users } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';

// Mock Express app for testing
const createTestApp = async (): Promise<Express> => {
  const express = await import('express');
  const app = express.default();
  
  app.use(express.json());
  
  // Mock authentication middleware
  app.use((req: any, res, next) => {
    req.user = {
      id: 'test-user-id',
      role: 'admin',
      canAccessAllOrganizations: true,
      email: 'test@example.com'
    };
    next();
  });
  
  // Import and register delayed update routes
  const { registerDelayedUpdateRoutes } = await import('../api/delayed-updates');
  registerDelayedUpdateRoutes(app);
  
  return app;
};

describe('Budget API Integration Tests', () => {
  let app: Express;
  let request: supertest.SuperTest<supertest.Test>;
  let testBuildingId: string;
  let testResidenceId: string;
  let testBillId: string;

  beforeAll(async () => {
    app = await createTestApp();
    request = supertest(app);

    // Create test data
    const testBuilding = await db
      .insert(buildings)
      .values({
        name: 'API Test Building',
        address: '456 API Test St',
        city: 'TestCity',
        organizationId: 'test-org-id',
        constructionDate: new Date('2022-01-01'),
        totalUnits: 8,
        totalFloors: 2,
        buildingType: 'residential',
        isActive: true
      })
      .returning();

    testBuildingId = testBuilding[0].id;

    const testResidence = await db
      .insert(residences)
      .values({
        buildingId: testBuildingId,
        unitNumber: '301',
        floor: 3,
        monthlyFee: 1800.00,
        isActive: true
      })
      .returning();

    testResidenceId = testResidence[0].id;

    const testBill = await db
      .insert(bills)
      .values({
        residenceId: testResidenceId,
        billNumber: 'API-TEST-001',
        amount: 1800.00,
        dueDate: new Date('2024-03-01'),
        type: 'monthly_fee',
        status: 'sent',
        isActive: true
      })
      .returning();

    testBillId = testBill[0].id;
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(monthlyBudgets).where(eq(monthlyBudgets.buildingId, testBuildingId));
    await db.delete(moneyFlow).where(eq(moneyFlow.buildingId, testBuildingId));
    await db.delete(bills).where(eq(bills.id, testBillId));
    await db.delete(residences).where(eq(residences.id, testResidenceId));
    await db.delete(buildings).where(eq(buildings.id, testBuildingId));
  });

  beforeEach(async () => {
    // Clear budget and money flow data before each test
    await db.delete(monthlyBudgets).where(eq(monthlyBudgets.buildingId, testBuildingId));
    await db.delete(moneyFlow).where(eq(moneyFlow.buildingId, testBuildingId));
  });

  describe('GET /api/delayed-updates/status', () => {
    it('should return delayed update status', async () => {
      const response = await request
        .get('/api/delayed-updates/status')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('lastChecked');
      expect(response.body).toHaveProperty('info');
      
      expect(response.body.status).toHaveProperty('delayMinutes', 15);
      expect(response.body.status).toHaveProperty('pendingBillUpdates');
      expect(response.body.status).toHaveProperty('pendingResidenceUpdates');
      expect(response.body.status).toHaveProperty('pendingBudgetUpdates');
    });

    it('should include operational info', async () => {
      const response = await request
        .get('/api/delayed-updates/status')
        .expect(200);

      expect(response.body.info).toHaveProperty('description');
      expect(response.body.info).toHaveProperty('triggers');
      expect(Array.isArray(response.body.info.triggers)).toBe(true);
    });
  });

  describe('GET /api/delayed-updates/health', () => {
    it('should return detailed health check', async () => {
      const response = await request
        .get('/api/delayed-updates/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('delayMinutes', 15);
      expect(response.body).toHaveProperty('pendingUpdates');
      expect(response.body).toHaveProperty('currentTime');
      expect(response.body).toHaveProperty('systemInfo');
      expect(response.body).toHaveProperty('message');

      expect(response.body.pendingUpdates).toHaveProperty('bills');
      expect(response.body.pendingUpdates).toHaveProperty('residences');
      expect(response.body.pendingUpdates).toHaveProperty('budgets');

      expect(response.body.systemInfo).toHaveProperty('nodeVersion');
      expect(response.body.systemInfo).toHaveProperty('platform');
      expect(response.body.systemInfo).toHaveProperty('uptime');
      expect(response.body.systemInfo).toHaveProperty('memoryUsage');
    });
  });

  describe('POST /api/delayed-updates/force-bill', () => {
    it('should force immediate bill update', async () => {
      const response = await request
        .post('/api/delayed-updates/force-bill')
        .send({ billId: testBillId })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('billId', testBillId);
      expect(response.body).toHaveProperty('triggeredBy', 'test@example.com');
      expect(response.body).toHaveProperty('timestamp');

      // Verify money flow was generated
      const moneyFlowCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(moneyFlow)
        .where(eq(moneyFlow.buildingId, testBuildingId));

      expect(moneyFlowCount[0].count).toBeGreaterThan(0);

      // Verify budgets were generated
      const budgetCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.buildingId, testBuildingId));

      expect(budgetCount[0].count).toBe(300); // 25 years * 12 months
    });

    it('should return error for missing billId', async () => {
      const response = await request
        .post('/api/delayed-updates/force-bill')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('message', 'billId is required');
    });

    it('should handle non-existent bill gracefully', async () => {
      const response = await request
        .post('/api/delayed-updates/force-bill')
        .send({ billId: 'non-existent-bill-id' })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('billId', 'non-existent-bill-id');
    });
  });

  describe('POST /api/delayed-updates/force-residence', () => {
    it('should force immediate residence update', async () => {
      const response = await request
        .post('/api/delayed-updates/force-residence')
        .send({ residenceId: testResidenceId })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('residenceId', testResidenceId);
      expect(response.body).toHaveProperty('triggeredBy', 'test@example.com');
      expect(response.body).toHaveProperty('timestamp');

      // Verify money flow was generated
      const moneyFlowCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(moneyFlow)
        .where(eq(moneyFlow.buildingId, testBuildingId));

      expect(moneyFlowCount[0].count).toBeGreaterThan(0);

      // Verify budgets were generated
      const budgetCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.buildingId, testBuildingId));

      expect(budgetCount[0].count).toBe(300); // 25 years * 12 months
    });

    it('should return error for missing residenceId', async () => {
      const response = await request
        .post('/api/delayed-updates/force-residence')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('message', 'residenceId is required');
    });
  });

  describe('Authorization', () => {
    beforeEach(() => {
      // Reset the test app with non-admin user
      app.use((req: any, res, next) => {
        req.user = {
          id: 'regular-user-id',
          role: 'user',
          canAccessAllOrganizations: false,
          email: 'user@example.com'
        };
        next();
      });
    });

    it('should deny access to status for non-admin users', async () => {
      // Create a new app instance with regular user
      const nonAdminApp = await createTestApp();
      nonAdminApp.use((req: any, res, next) => {
        req.user = {
          id: 'regular-user-id',
          role: 'user',
          canAccessAllOrganizations: false,
          email: 'user@example.com'
        };
        next();
      });

      const nonAdminRequest = supertest(nonAdminApp);

      const response = await nonAdminRequest
        .get('/api/delayed-updates/status')
        .expect(403);

      expect(response.body).toHaveProperty('message', 'Access denied. Admin or Manager privileges required.');
      expect(response.body).toHaveProperty('code', 'INSUFFICIENT_PERMISSIONS');
    });

    it('should deny force updates for non-admin users', async () => {
      const nonAdminApp = await createTestApp();
      nonAdminApp.use((req: any, res, next) => {
        req.user = {
          id: 'regular-user-id',
          role: 'user',
          canAccessAllOrganizations: false,
          email: 'user@example.com'
        };
        next();
      });

      const nonAdminRequest = supertest(nonAdminApp);

      const response = await nonAdminRequest
        .post('/api/delayed-updates/force-bill')
        .send({ billId: testBillId })
        .expect(403);

      expect(response.body).toHaveProperty('message', 'Access denied. Admin privileges required.');
      expect(response.body).toHaveProperty('code', 'INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('Budget Data Validation', () => {
    it('should create correct budget structure after force update', async () => {
      // Force update to generate budget data
      await request
        .post('/api/delayed-updates/force-bill')
        .send({ billId: testBillId })
        .expect(200);

      // Validate budget data structure
      const budgets = await db
        .select()
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.buildingId, testBuildingId))
        .limit(5);

      budgets.forEach(budget => {
        // Validate required fields
        expect(budget.buildingId).toBe(testBuildingId);
        expect(budget.budgetMonth).toBeInstanceOf(Date);
        expect(typeof budget.totalIncome).toBe('number');
        expect(typeof budget.totalSpending).toBe('number');
        expect(typeof budget.netIncome).toBe('number');
        expect(typeof budget.isApproved).toBe('boolean');

        // Validate arrays
        expect(Array.isArray(budget.incomeTypes)).toBe(true);
        expect(Array.isArray(budget.incomeAmounts)).toBe(true);
        expect(Array.isArray(budget.spendingTypes)).toBe(true);
        expect(Array.isArray(budget.spendingAmounts)).toBe(true);

        // Validate array consistency
        expect(budget.incomeTypes.length).toBe(budget.incomeAmounts.length);
        expect(budget.spendingTypes.length).toBe(budget.spendingAmounts.length);

        // Validate financial calculations
        const incomeSum = budget.incomeAmounts.reduce((sum, amount) => sum + amount, 0);
        const spendingSum = budget.spendingAmounts.reduce((sum, amount) => sum + amount, 0);
        
        expect(budget.totalIncome).toBeCloseTo(incomeSum, 2);
        expect(budget.totalSpending).toBeCloseTo(spendingSum, 2);
        expect(budget.netIncome).toBeCloseTo(incomeSum - spendingSum, 2);
      });
    });

    it('should maintain chronological budget order', async () => {
      await request
        .post('/api/delayed-updates/force-residence')
        .send({ residenceId: testResidenceId })
        .expect(200);

      const budgets = await db
        .select()
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.buildingId, testBuildingId))
        .orderBy(monthlyBudgets.budgetMonth);

      // Verify chronological order
      for (let i = 1; i < Math.min(budgets.length, 50); i++) {
        expect(budgets[i].budgetMonth.getTime()).toBeGreaterThanOrEqual(
          budgets[i - 1].budgetMonth.getTime()
        );
      }

      // Verify 25-year span
      const firstBudget = budgets[0];
      const lastBudget = budgets[budgets.length - 1];
      
      expect(firstBudget.budgetMonth.getFullYear()).toBe(2022);
      expect(lastBudget.budgetMonth.getFullYear()).toBe(2046);
    });

    it('should handle budget repopulation correctly', async () => {
      // Initial population
      await request
        .post('/api/delayed-updates/force-bill')
        .send({ billId: testBillId })
        .expect(200);

      const initialBudget = await db
        .select()
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.buildingId, testBuildingId))
        .limit(1);

      // Add additional money flow data
      await db.insert(moneyFlow).values({
        buildingId: testBuildingId,
        residenceId: testResidenceId,
        flowDate: new Date('2022-01-15'),
        amount: 300.00,
        flowType: 'spending',
        category: 'Maintenance',
        description: 'Test maintenance cost',
        isRecurring: false,
        isActive: true
      });

      // Force update again
      await request
        .post('/api/delayed-updates/force-bill')
        .send({ billId: testBillId })
        .expect(200);

      const updatedBudget = await db
        .select()
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.buildingId, testBuildingId))
        .orderBy(monthlyBudgets.budgetMonth)
        .limit(1);

      // Budget should reflect the additional spending
      expect(updatedBudget[0].totalSpending).toBeGreaterThan(initialBudget[0].totalSpending);
      expect(updatedBudget[0].netIncome).toBeLessThan(initialBudget[0].netIncome);
    });
  });
});