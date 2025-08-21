import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { db } from '../db';
import { monthlyBudgetService } from '../services/monthly-budget-service';
import { moneyFlowAutomationService } from '../services/money-flow-automation';
import { buildings, residences, monthlyBudgets, moneyFlow } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

describe('Monthly Budget Service', () => {
  let testBuildingId: string;
  let testResidenceId: string;

  beforeAll(async () => {
    // Create test building and residence for testing
    const testBuilding = await db
      .insert(buildings)
      .values({
        name: 'Test Budget Building',
        address: '123 Budget Test St',
        city: 'TestCity',
        organizationId: 'test-org-id',
        constructionDate: new Date('2020-01-01'),
        totalUnits: 10,
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
        unitNumber: '101',
        floor: 1,
        monthlyFee: 1200.00,
        isActive: true
      })
      .returning();

    testResidenceId = testResidence[0].id;

    // Generate some money flow data for testing
    await moneyFlowAutomationService.generateForResidence(testResidenceId);
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(monthlyBudgets).where(eq(monthlyBudgets.buildingId, testBuildingId));
    await db.delete(moneyFlow).where(eq(moneyFlow.buildingId, testBuildingId));
    await db.delete(residences).where(eq(residences.id, testResidenceId));
    await db.delete(buildings).where(eq(buildings.id, testBuildingId));
  });

  beforeEach(async () => {
    // Clear existing budget data before each test
    await db.delete(monthlyBudgets).where(eq(monthlyBudgets.buildingId, testBuildingId));
  });

  describe('populateBudgetsForBuilding', () => {
    it('should create budget entries for 25 years from construction date', async () => {
      const result = await monthlyBudgetService.populateBudgetsForBuilding(testBuildingId);
      
      expect(result).toBeGreaterThan(0);
      
      // Should create 25 years * 12 months = 300 entries
      const budgetCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.buildingId, testBuildingId));
      
      expect(budgetCount[0].count).toBe(300); // 25 years * 12 months
    });

    it('should create budgets starting from construction date', async () => {
      await monthlyBudgetService.populateBudgetsForBuilding(testBuildingId);
      
      const firstBudget = await db
        .select()
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.buildingId, testBuildingId))
        .orderBy(monthlyBudgets.budgetMonth)
        .limit(1);
      
      expect(firstBudget[0].budgetMonth.getFullYear()).toBe(2020);
      expect(firstBudget[0].budgetMonth.getMonth()).toBe(0); // January = 0
    });

    it('should create budgets ending 25 years after construction', async () => {
      await monthlyBudgetService.populateBudgetsForBuilding(testBuildingId);
      
      const lastBudget = await db
        .select()
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.buildingId, testBuildingId))
        .orderBy(sql`${monthlyBudgets.budgetMonth} DESC`)
        .limit(1);
      
      expect(lastBudget[0].budgetMonth.getFullYear()).toBe(2044);
      expect(lastBudget[0].budgetMonth.getMonth()).toBe(11); // December = 11
    });

    it('should not create duplicate budgets for same building and month', async () => {
      // Run twice to test duplicate prevention
      await monthlyBudgetService.populateBudgetsForBuilding(testBuildingId);
      await monthlyBudgetService.populateBudgetsForBuilding(testBuildingId);
      
      const budgetCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.buildingId, testBuildingId));
      
      // Should still be 300, not 600
      expect(budgetCount[0].count).toBe(300);
    });

    it('should set all budgets as not approved by default', async () => {
      await monthlyBudgetService.populateBudgetsForBuilding(testBuildingId);
      
      const approvedCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(monthlyBudgets)
        .where(and(
          eq(monthlyBudgets.buildingId, testBuildingId),
          eq(monthlyBudgets.isApproved, true)
        ));
      
      expect(approvedCount[0].count).toBe(0);
    });
  });

  describe('deriveIncomeAndSpendingTypes', () => {
    it('should derive income types from money flow data', async () => {
      await monthlyBudgetService.populateBudgetsForBuilding(testBuildingId);
      
      const budgetWithIncome = await db
        .select()
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.buildingId, testBuildingId))
        .limit(1);
      
      expect(budgetWithIncome[0].incomeTypes.length).toBeGreaterThan(0);
      expect(budgetWithIncome[0].incomeAmounts.length).toBe(budgetWithIncome[0].incomeTypes.length);
    });

    it('should derive spending types from money flow data', async () => {
      await monthlyBudgetService.populateBudgetsForBuilding(testBuildingId);
      
      const budgetWithSpending = await db
        .select()
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.buildingId, testBuildingId))
        .limit(1);
      
      expect(budgetWithSpending[0].spendingTypes.length).toBeGreaterThan(0);
      expect(budgetWithSpending[0].spendingAmounts.length).toBe(budgetWithSpending[0].spendingTypes.length);
    });

    it('should calculate correct totals', async () => {
      await monthlyBudgetService.populateBudgetsForBuilding(testBuildingId);
      
      const budget = await db
        .select()
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.buildingId, testBuildingId))
        .limit(1);
      
      const expectedIncomeTotal = budget[0].incomeAmounts.reduce((sum, amount) => sum + amount, 0);
      const expectedSpendingTotal = budget[0].spendingAmounts.reduce((sum, amount) => sum + amount, 0);
      
      expect(budget[0].totalIncome).toBeCloseTo(expectedIncomeTotal, 2);
      expect(budget[0].totalSpending).toBeCloseTo(expectedSpendingTotal, 2);
      expect(budget[0].netIncome).toBeCloseTo(expectedIncomeTotal - expectedSpendingTotal, 2);
    });
  });

  describe('repopulateBudgetsForBuilding', () => {
    it('should update existing budgets with new money flow data', async () => {
      // First populate budgets
      await monthlyBudgetService.populateBudgetsForBuilding(testBuildingId);
      
      const originalBudget = await db
        .select()
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.buildingId, testBuildingId))
        .limit(1);
      
      // Add some new money flow data
      await db.insert(moneyFlow).values({
        buildingId: testBuildingId,
        residenceId: testResidenceId,
        flowDate: new Date('2020-01-15'),
        amount: 500.00,
        flowType: 'income',
        category: 'Additional Income',
        description: 'Test additional income',
        isRecurring: false,
        isActive: true
      });
      
      // Repopulate budgets
      await monthlyBudgetService.repopulateBudgetsForBuilding(testBuildingId);
      
      const updatedBudget = await db
        .select()
        .from(monthlyBudgets)
        .where(and(
          eq(monthlyBudgets.buildingId, testBuildingId),
          eq(monthlyBudgets.budgetMonth, originalBudget[0].budgetMonth)
        ))
        .limit(1);
      
      // Income should be higher now
      expect(updatedBudget[0].totalIncome).toBeGreaterThan(originalBudget[0].totalIncome);
    });

    it('should preserve approved status during repopulation', async () => {
      // First populate budgets
      await monthlyBudgetService.populateBudgetsForBuilding(testBuildingId);
      
      // Approve one budget
      const budgetToApprove = await db
        .select()
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.buildingId, testBuildingId))
        .limit(1);
      
      await db
        .update(monthlyBudgets)
        .set({ isApproved: true })
        .where(eq(monthlyBudgets.id, budgetToApprove[0].id));
      
      // Repopulate budgets
      await monthlyBudgetService.repopulateBudgetsForBuilding(testBuildingId);
      
      // Check if approved budget still exists (should be duplicated)
      const approvedBudgets = await db
        .select()
        .from(monthlyBudgets)
        .where(and(
          eq(monthlyBudgets.buildingId, testBuildingId),
          eq(monthlyBudgets.isApproved, true)
        ));
      
      expect(approvedBudgets.length).toBeGreaterThan(0);
    });
  });

  describe('getBudgetsByBuilding', () => {
    it('should return budgets for specific building', async () => {
      await monthlyBudgetService.populateBudgetsForBuilding(testBuildingId);
      
      const budgets = await monthlyBudgetService.getBudgetsByBuilding(testBuildingId);
      
      expect(budgets.length).toBe(300);
      expect(budgets[0].buildingId).toBe(testBuildingId);
    });

    it('should return budgets ordered by date', async () => {
      await monthlyBudgetService.populateBudgetsForBuilding(testBuildingId);
      
      const budgets = await monthlyBudgetService.getBudgetsByBuilding(testBuildingId);
      
      for (let i = 1; i < budgets.length; i++) {
        expect(budgets[i].budgetMonth.getTime()).toBeGreaterThanOrEqual(
          budgets[i - 1].budgetMonth.getTime()
        );
      }
    });

    it('should filter by date range when provided', async () => {
      await monthlyBudgetService.populateBudgetsForBuilding(testBuildingId);
      
      const startDate = new Date('2020-01-01');
      const endDate = new Date('2020-12-31');
      
      const budgets = await monthlyBudgetService.getBudgetsByBuilding(
        testBuildingId,
        startDate,
        endDate
      );
      
      expect(budgets.length).toBe(12); // 12 months in 2020
      
      budgets.forEach(budget => {
        expect(budget.budgetMonth.getFullYear()).toBe(2020);
      });
    });

    it('should filter by approval status when provided', async () => {
      await monthlyBudgetService.populateBudgetsForBuilding(testBuildingId);
      
      // Approve a few budgets
      const budgetsToApprove = await db
        .select()
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.buildingId, testBuildingId))
        .limit(3);
      
      for (const budget of budgetsToApprove) {
        await db
          .update(monthlyBudgets)
          .set({ isApproved: true })
          .where(eq(monthlyBudgets.id, budget.id));
      }
      
      const approvedBudgets = await monthlyBudgetService.getBudgetsByBuilding(
        testBuildingId,
        undefined,
        undefined,
        true
      );
      
      expect(approvedBudgets.length).toBe(3);
      approvedBudgets.forEach(budget => {
        expect(budget.isApproved).toBe(true);
      });
    });
  });

  describe('data integrity', () => {
    it('should maintain consistent array lengths', async () => {
      await monthlyBudgetService.populateBudgetsForBuilding(testBuildingId);
      
      const budgets = await db
        .select()
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.buildingId, testBuildingId))
        .limit(10);
      
      budgets.forEach(budget => {
        expect(budget.incomeTypes.length).toBe(budget.incomeAmounts.length);
        expect(budget.spendingTypes.length).toBe(budget.spendingAmounts.length);
      });
    });

    it('should have valid financial calculations', async () => {
      await monthlyBudgetService.populateBudgetsForBuilding(testBuildingId);
      
      const budgets = await db
        .select()
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.buildingId, testBuildingId))
        .limit(10);
      
      budgets.forEach(budget => {
        const incomeSum = budget.incomeAmounts.reduce((sum, amount) => sum + amount, 0);
        const spendingSum = budget.spendingAmounts.reduce((sum, amount) => sum + amount, 0);
        
        expect(budget.totalIncome).toBeCloseTo(incomeSum, 2);
        expect(budget.totalSpending).toBeCloseTo(spendingSum, 2);
        expect(budget.netIncome).toBeCloseTo(incomeSum - spendingSum, 2);
      });
    });

    it('should handle edge cases gracefully', async () => {
      // Test with building that has no money flow data
      const emptyBuilding = await db
        .insert(buildings)
        .values({
          name: 'Empty Building',
          address: '456 Empty St',
          city: 'TestCity',
          organizationId: 'test-org-id',
          constructionDate: new Date('2023-01-01'),
          totalUnits: 5,
          totalFloors: 1,
          buildingType: 'residential',
          isActive: true
        })
        .returning();
      
      const emptyBuildingId = emptyBuilding[0].id;
      
      try {
        const result = await monthlyBudgetService.populateBudgetsForBuilding(emptyBuildingId);
        expect(result).toBeGreaterThanOrEqual(0);
        
        // Should still create budget entries with zero amounts
        const budgets = await db
          .select()
          .from(monthlyBudgets)
          .where(eq(monthlyBudgets.buildingId, emptyBuildingId))
          .limit(1);
        
        expect(budgets[0].totalIncome).toBe(0);
        expect(budgets[0].totalSpending).toBe(0);
        expect(budgets[0].netIncome).toBe(0);
        
      } finally {
        // Clean up
        await db.delete(monthlyBudgets).where(eq(monthlyBudgets.buildingId, emptyBuildingId));
        await db.delete(buildings).where(eq(buildings.id, emptyBuildingId));
      }
    });
  });
});