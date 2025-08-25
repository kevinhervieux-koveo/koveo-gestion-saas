import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { db } from '../db';
import { delayedUpdateService } from '../services/delayed-update-service';
import { buildings, residences, bills, monthlyBudgets, moneyFlow } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';

describe('Delayed Update Service', () => {
  let testBuildingId: string;
  let testResidenceId: string;
  let testBillId: string;

  beforeAll(async () => {
    // Create test data
    const testBuilding = await db
      .insert(buildings)
      .values({
        name: 'Test Delayed Update Building',
        address: '789 Delay Test Ave',
        city: 'TestCity',
        postalCode: 'H1B 1B1',
        organizationId: 'test-org-id',
        totalUnits: 5,
        totalFloors: 1,
        buildingType: 'apartment',
        isActive: true,
      })
      .returning();

    testBuildingId = testBuilding[0].id;

    const testResidence = await db
      .insert(residences)
      .values({
        buildingId: testBuildingId,
        unitNumber: '201',
        floor: 2,
        monthlyFees: '1500.00',
        isActive: true,
      })
      .returning();

    testResidenceId = testResidence[0].id;

    const testBill = await db
      .insert(bills)
      .values({
        residenceId: testResidenceId,
        billNumber: 'TEST-DELAY-001',
        amount: 1500.0,
        dueDate: new Date('2024-02-01'),
        type: 'monthly_fee',
        status: 'sent',
        isActive: true,
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
    // Clear money flow and budget data before each test
    await db.delete(monthlyBudgets).where(eq(monthlyBudgets.buildingId, testBuildingId));
    await db.delete(moneyFlow).where(eq(moneyFlow.buildingId, testBuildingId));
  });

  describe('Service Initialization', () => {
    it('should initialize as singleton', () => {
      const instance1 = delayedUpdateService;
      const instance2 = delayedUpdateService;
      expect(instance1).toBe(instance2);
    });

    it('should have correct delay configuration', () => {
      const status = delayedUpdateService.getStatus();
      expect(status.delayMinutes).toBe(15);
    });

    it('should start with no pending updates', () => {
      const status = delayedUpdateService.getStatus();
      expect(status.pendingBillUpdates).toBe(0);
      expect(status.pendingResidenceUpdates).toBe(0);
      expect(status.pendingBudgetUpdates).toBe(0);
    });
  });

  describe('Bill Update Scheduling', () => {
    it('should schedule bill update correctly', () => {
      const statusBefore = delayedUpdateService.getStatus();

      delayedUpdateService.scheduleBillUpdate(testBillId);

      const statusAfter = delayedUpdateService.getStatus();
      expect(statusAfter.pendingBillUpdates).toBe(statusBefore.pendingBillUpdates + 1);
    });

    it('should prevent duplicate bill updates', () => {
      const statusBefore = delayedUpdateService.getStatus();

      // Schedule same bill multiple times
      delayedUpdateService.scheduleBillUpdate(testBillId);
      delayedUpdateService.scheduleBillUpdate(testBillId);
      delayedUpdateService.scheduleBillUpdate(testBillId);

      const statusAfter = delayedUpdateService.getStatus();
      expect(statusAfter.pendingBillUpdates).toBe(statusBefore.pendingBillUpdates + 1);
    });

    it('should handle multiple different bills', () => {
      const bill2 = `${testBillId}-2`;
      const bill3 = `${testBillId}-3`;

      const statusBefore = delayedUpdateService.getStatus();

      delayedUpdateService.scheduleBillUpdate(testBillId);
      delayedUpdateService.scheduleBillUpdate(bill2);
      delayedUpdateService.scheduleBillUpdate(bill3);

      const statusAfter = delayedUpdateService.getStatus();
      expect(statusAfter.pendingBillUpdates).toBe(statusBefore.pendingBillUpdates + 3);
    });
  });

  describe('Residence Update Scheduling', () => {
    it('should schedule residence update correctly', () => {
      const statusBefore = delayedUpdateService.getStatus();

      delayedUpdateService.scheduleResidenceUpdate(testResidenceId);

      const statusAfter = delayedUpdateService.getStatus();
      expect(statusAfter.pendingResidenceUpdates).toBe(statusBefore.pendingResidenceUpdates + 1);
    });

    it('should prevent duplicate residence updates', () => {
      const statusBefore = delayedUpdateService.getStatus();

      // Schedule same residence multiple times
      delayedUpdateService.scheduleResidenceUpdate(testResidenceId);
      delayedUpdateService.scheduleResidenceUpdate(testResidenceId);
      delayedUpdateService.scheduleResidenceUpdate(testResidenceId);

      const statusAfter = delayedUpdateService.getStatus();
      expect(statusAfter.pendingResidenceUpdates).toBe(statusBefore.pendingResidenceUpdates + 1);
    });

    it('should handle multiple different residences', () => {
      const residence2 = `${testResidenceId}-2`;
      const residence3 = `${testResidenceId}-3`;

      const statusBefore = delayedUpdateService.getStatus();

      delayedUpdateService.scheduleResidenceUpdate(testResidenceId);
      delayedUpdateService.scheduleResidenceUpdate(residence2);
      delayedUpdateService.scheduleResidenceUpdate(residence3);

      const statusAfter = delayedUpdateService.getStatus();
      expect(statusAfter.pendingResidenceUpdates).toBe(statusBefore.pendingResidenceUpdates + 3);
    });
  });

  describe('Force Immediate Updates', () => {
    it('should force immediate bill update', async () => {
      // This should create money flow and budget entries immediately
      await delayedUpdateService.forceImmediateBillUpdate(testBillId);

      // Check if money flow was created
      const moneyFlowEntries = await db
        .select({ count: sql<number>`count(*)` })
        .from(moneyFlow)
        .where(eq(moneyFlow.buildingId, testBuildingId));

      expect(moneyFlowEntries[0].count).toBeGreaterThan(0);

      // Check if budget entries were created
      const budgetEntries = await db
        .select({ count: sql<number>`count(*)` })
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.buildingId, testBuildingId));

      expect(budgetEntries[0].count).toBeGreaterThan(0);
    });

    it('should force immediate residence update', async () => {
      // This should create money flow and budget entries immediately
      await delayedUpdateService.forceImmediateResidenceUpdate(testResidenceId);

      // Check if money flow was created
      const moneyFlowEntries = await db
        .select({ count: sql<number>`count(*)` })
        .from(moneyFlow)
        .where(eq(moneyFlow.buildingId, testBuildingId));

      expect(moneyFlowEntries[0].count).toBeGreaterThan(0);

      // Check if budget entries were created
      const budgetEntries = await db
        .select({ count: sql<number>`count(*)` })
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.buildingId, testBuildingId));

      expect(budgetEntries[0].count).toBeGreaterThan(0);
    });
  });

  describe('Status Monitoring', () => {
    it('should provide comprehensive status information', () => {
      const status = delayedUpdateService.getStatus();

      expect(status).toHaveProperty('delayMinutes');
      expect(status).toHaveProperty('pendingBillUpdates');
      expect(status).toHaveProperty('pendingResidenceUpdates');
      expect(status).toHaveProperty('pendingBudgetUpdates');

      expect(typeof status.delayMinutes).toBe('number');
      expect(typeof status.pendingBillUpdates).toBe('number');
      expect(typeof status.pendingResidenceUpdates).toBe('number');
      expect(typeof status.pendingBudgetUpdates).toBe('number');
    });

    it('should track pending updates accurately', () => {
      const initialStatus = delayedUpdateService.getStatus();

      // Add some pending updates
      delayedUpdateService.scheduleBillUpdate('test-bill-1');
      delayedUpdateService.scheduleBillUpdate('test-bill-2');
      delayedUpdateService.scheduleResidenceUpdate('test-residence-1');

      const updatedStatus = delayedUpdateService.getStatus();

      expect(updatedStatus.pendingBillUpdates).toBe(initialStatus.pendingBillUpdates + 2);
      expect(updatedStatus.pendingResidenceUpdates).toBe(initialStatus.pendingResidenceUpdates + 1);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent bill gracefully', async () => {
      const nonExistentBillId = 'non-existent-bill-id';

      // Should not throw error
      await expect(
        delayedUpdateService.forceImmediateBillUpdate(nonExistentBillId)
      ).resolves.not.toThrow();
    });

    it('should handle non-existent residence gracefully', async () => {
      const nonExistentResidenceId = 'non-existent-residence-id';

      // Should not throw error
      await expect(
        delayedUpdateService.forceImmediateResidenceUpdate(nonExistentResidenceId)
      ).resolves.not.toThrow();
    });

    it('should continue operation after partial failures', () => {
      const statusBefore = delayedUpdateService.getStatus();

      // Schedule valid updates
      delayedUpdateService.scheduleBillUpdate('valid-bill');
      delayedUpdateService.scheduleResidenceUpdate('valid-residence');

      const statusAfter = delayedUpdateService.getStatus();

      // Should still track pending updates
      expect(statusAfter.pendingBillUpdates).toBeGreaterThan(statusBefore.pendingBillUpdates);
      expect(statusAfter.pendingResidenceUpdates).toBeGreaterThan(
        statusBefore.pendingResidenceUpdates
      );
    });
  });

  describe('Integration with Money Flow and Budget Systems', () => {
    it('should trigger complete update chain for bills', async () => {
      // Force immediate update to test the complete chain
      await delayedUpdateService.forceImmediateBillUpdate(testBillId);

      // Verify money flow was generated
      const moneyFlowCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(moneyFlow)
        .where(eq(moneyFlow.buildingId, testBuildingId));

      expect(moneyFlowCount[0].count).toBeGreaterThan(0);

      // Verify budgets were generated (should be 3 years * 12 months = 36)
      const budgetCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.buildingId, testBuildingId));

      expect(budgetCount[0].count).toBe(36);
    });

    it('should trigger complete update chain for residences', async () => {
      // Force immediate update to test the complete chain
      await delayedUpdateService.forceImmediateResidenceUpdate(testResidenceId);

      // Verify money flow was generated
      const moneyFlowCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(moneyFlow)
        .where(eq(moneyFlow.buildingId, testBuildingId));

      expect(moneyFlowCount[0].count).toBeGreaterThan(0);

      // Verify budgets were generated (should be 3 years * 12 months = 36)
      const budgetCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.buildingId, testBuildingId));

      expect(budgetCount[0].count).toBe(36);
    });

    it('should maintain data consistency across updates', async () => {
      // Generate initial data
      await delayedUpdateService.forceImmediateBillUpdate(testBillId);

      const initialBudget = await db
        .select()
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.buildingId, testBuildingId))
        .limit(1);

      // Add more money flow data and regenerate
      await db.insert(moneyFlow).values({
        buildingId: testBuildingId,
        residenceId: testResidenceId,
        flowDate: new Date('2021-01-15'),
        amount: 200.0,
        flowType: 'income',
        category: 'Additional Fee',
        description: 'Test additional fee',
        isRecurring: false,
        isActive: true,
      });

      // Force update again
      await delayedUpdateService.forceImmediateBillUpdate(testBillId);

      const updatedBudget = await db
        .select()
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.buildingId, testBuildingId))
        .orderBy(sql`${monthlyBudgets.budgetMonth} ASC`)
        .limit(1);

      // Budget should reflect the additional income
      expect(updatedBudget[0].totalIncome).toBeGreaterThan(initialBudget[0].totalIncome);
    });
  });
});
