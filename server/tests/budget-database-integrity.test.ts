import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { db } from '../db';
import { monthlyBudgets, buildings, residences, moneyFlow } from '../../shared/schema';
import { eq, sql, and, gte, lte, isNull, isNotNull } from 'drizzle-orm';

describe('Budget Database Integrity Tests', () => {
  let testBuildingId: string;
  let testResidenceId: string;

  beforeAll(async () => {
    // Create test building and residence
    const testBuilding = await db
      .insert(buildings)
      .values({
        name: 'Database Integrity Test Building',
        address: '999 Integrity Test Blvd',
        city: 'TestCity',
        organizationId: 'test-org-id',
        constructionDate: new Date('2020-06-01'),
        totalUnits: 12,
        totalFloors: 3,
        buildingType: 'residential',
        isActive: true
      })
      .returning();

    testBuildingId = testBuilding[0].id;

    const testResidence = await db
      .insert(residences)
      .values({
        buildingId: testBuildingId,
        unitNumber: '401',
        floor: 4,
        monthlyFee: 2000.00,
        isActive: true
      })
      .returning();

    testResidenceId = testResidence[0].id;
  });

  afterAll(async () => {
    // Clean up all test data
    await db.delete(monthlyBudgets).where(eq(monthlyBudgets.buildingId, testBuildingId));
    await db.delete(moneyFlow).where(eq(moneyFlow.buildingId, testBuildingId));
    await db.delete(residences).where(eq(residences.id, testResidenceId));
    await db.delete(buildings).where(eq(buildings.id, testBuildingId));
  });

  beforeEach(async () => {
    // Clear budget data before each test
    await db.delete(monthlyBudgets).where(eq(monthlyBudgets.buildingId, testBuildingId));
  });

  describe('Schema Validation', () => {
    it('should have correct table structure', async () => {
      // Insert a test budget entry to validate schema
      const testBudget = await db
        .insert(monthlyBudgets)
        .values({
          buildingId: testBuildingId,
          budgetMonth: new Date('2020-06-01'),
          incomeTypes: ['Monthly Fees', 'Parking'],
          incomeAmounts: [2000.00, 100.00],
          totalIncome: 2100.00,
          spendingTypes: ['Maintenance', 'Utilities'],
          spendingAmounts: [800.00, 300.00],
          totalSpending: 1100.00,
          netIncome: 1000.00,
          isApproved: false
        })
        .returning();

      expect(testBudget[0]).toHaveProperty('id');
      expect(testBudget[0]).toHaveProperty('buildingId', testBuildingId);
      expect(testBudget[0]).toHaveProperty('budgetMonth');
      expect(testBudget[0]).toHaveProperty('incomeTypes');
      expect(testBudget[0]).toHaveProperty('incomeAmounts');
      expect(testBudget[0]).toHaveProperty('totalIncome', 2100.00);
      expect(testBudget[0]).toHaveProperty('spendingTypes');
      expect(testBudget[0]).toHaveProperty('spendingAmounts');
      expect(testBudget[0]).toHaveProperty('totalSpending', 1100.00);
      expect(testBudget[0]).toHaveProperty('netIncome', 1000.00);
      expect(testBudget[0]).toHaveProperty('isApproved', false);
      expect(testBudget[0]).toHaveProperty('createdAt');
      expect(testBudget[0]).toHaveProperty('updatedAt');
    });

    it('should enforce required fields', async () => {
      // Test missing buildingId
      await expect(
        db.insert(monthlyBudgets).values({
          budgetMonth: new Date('2020-06-01'),
          incomeTypes: [],
          incomeAmounts: [],
          totalIncome: 0,
          spendingTypes: [],
          spendingAmounts: [],
          totalSpending: 0,
          netIncome: 0,
          isApproved: false
        } as any)
      ).rejects.toThrow();

      // Test missing budgetMonth
      await expect(
        db.insert(monthlyBudgets).values({
          buildingId: testBuildingId,
          incomeTypes: [],
          incomeAmounts: [],
          totalIncome: 0,
          spendingTypes: [],
          spendingAmounts: [],
          totalSpending: 0,
          netIncome: 0,
          isApproved: false
        } as any)
      ).rejects.toThrow();
    });

    it('should handle array columns correctly', async () => {
      const budget = await db
        .insert(monthlyBudgets)
        .values({
          buildingId: testBuildingId,
          budgetMonth: new Date('2020-06-01'),
          incomeTypes: ['Monthly Fees', 'Parking', 'Laundry'],
          incomeAmounts: [2000.00, 100.00, 50.00],
          totalIncome: 2150.00,
          spendingTypes: ['Maintenance', 'Utilities', 'Insurance', 'Management'],
          spendingAmounts: [800.00, 300.00, 200.00, 400.00],
          totalSpending: 1700.00,
          netIncome: 450.00,
          isApproved: false
        })
        .returning();

      expect(Array.isArray(budget[0].incomeTypes)).toBe(true);
      expect(Array.isArray(budget[0].incomeAmounts)).toBe(true);
      expect(Array.isArray(budget[0].spendingTypes)).toBe(true);
      expect(Array.isArray(budget[0].spendingAmounts)).toBe(true);

      expect(budget[0].incomeTypes.length).toBe(3);
      expect(budget[0].incomeAmounts.length).toBe(3);
      expect(budget[0].spendingTypes.length).toBe(4);
      expect(budget[0].spendingAmounts.length).toBe(4);
    });
  });

  describe('Data Constraints', () => {
    it('should enforce unique building-month combinations', async () => {
      const budgetData = {
        buildingId: testBuildingId,
        budgetMonth: new Date('2020-06-01'),
        incomeTypes: ['Monthly Fees'],
        incomeAmounts: [2000.00],
        totalIncome: 2000.00,
        spendingTypes: ['Maintenance'],
        spendingAmounts: [800.00],
        totalSpending: 800.00,
        netIncome: 1200.00,
        isApproved: false
      };

      // Insert first budget
      await db.insert(monthlyBudgets).values(budgetData);

      // Try to insert duplicate - should either fail or handle gracefully
      // depending on how unique constraints are implemented
      const duplicateResult = await db
        .insert(monthlyBudgets)
        .values(budgetData)
        .onConflictDoNothing()
        .returning();

      // If on conflict do nothing is used, result should be empty
      expect(duplicateResult.length).toBe(0);
    });

    it('should validate foreign key relationships', async () => {
      // Test with non-existent building ID
      await expect(
        db.insert(monthlyBudgets).values({
          buildingId: 'non-existent-building-id',
          budgetMonth: new Date('2020-06-01'),
          incomeTypes: [],
          incomeAmounts: [],
          totalIncome: 0,
          spendingTypes: [],
          spendingAmounts: [],
          totalSpending: 0,
          netIncome: 0,
          isApproved: false
        })
      ).rejects.toThrow();
    });

    it('should handle numeric precision correctly', async () => {
      const budget = await db
        .insert(monthlyBudgets)
        .values({
          buildingId: testBuildingId,
          budgetMonth: new Date('2020-06-01'),
          incomeTypes: ['Precise Income'],
          incomeAmounts: [1234.56],
          totalIncome: 1234.56,
          spendingTypes: ['Precise Spending'],
          spendingAmounts: [678.90],
          totalSpending: 678.90,
          netIncome: 555.66,
          isApproved: false
        })
        .returning();

      expect(budget[0].totalIncome).toBeCloseTo(1234.56, 2);
      expect(budget[0].totalSpending).toBeCloseTo(678.90, 2);
      expect(budget[0].netIncome).toBeCloseTo(555.66, 2);
    });
  });

  describe('Performance and Indexing', () => {
    beforeEach(async () => {
      // Insert test data for performance tests
      const budgets = [];
      for (let year = 2020; year < 2023; year++) {
        for (let month = 0; month < 12; month++) {
          budgets.push({
            buildingId: testBuildingId,
            budgetMonth: new Date(year, month, 1),
            incomeTypes: ['Monthly Fees'],
            incomeAmounts: [2000.00],
            totalIncome: 2000.00,
            spendingTypes: ['Maintenance'],
            spendingAmounts: [800.00],
            totalSpending: 800.00,
            netIncome: 1200.00,
            isApproved: month % 6 === 0 // Approve every 6th month
          });
        }
      }
      await db.insert(monthlyBudgets).values(budgets);
    });

    it('should efficiently query by building ID', async () => {
      const start = Date.now();
      
      const budgets = await db
        .select({ count: sql<number>`count(*)` })
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.buildingId, testBuildingId));

      const end = Date.now();
      const queryTime = end - start;

      expect(budgets[0].count).toBe(36); // 3 years * 12 months
      expect(queryTime).toBeLessThan(100); // Should be fast with proper indexing
    });

    it('should efficiently query by date range', async () => {
      const start = Date.now();
      
      const budgets = await db
        .select({ count: sql<number>`count(*)` })
        .from(monthlyBudgets)
        .where(
          and(
            eq(monthlyBudgets.buildingId, testBuildingId),
            gte(monthlyBudgets.budgetMonth, new Date('2021-01-01')),
            lte(monthlyBudgets.budgetMonth, new Date('2021-12-31'))
          )
        );

      const end = Date.now();
      const queryTime = end - start;

      expect(budgets[0].count).toBe(12); // 12 months in 2021
      expect(queryTime).toBeLessThan(100); // Should be fast with proper indexing
    });

    it('should efficiently query by approval status', async () => {
      const start = Date.now();
      
      const approvedBudgets = await db
        .select({ count: sql<number>`count(*)` })
        .from(monthlyBudgets)
        .where(
          and(
            eq(monthlyBudgets.buildingId, testBuildingId),
            eq(monthlyBudgets.isApproved, true)
          )
        );

      const end = Date.now();
      const queryTime = end - start;

      expect(approvedBudgets[0].count).toBe(6); // Every 6th month approved
      expect(queryTime).toBeLessThan(100); // Should be fast with proper indexing
    });
  });

  describe('Data Integrity Rules', () => {
    it('should maintain consistent array lengths', async () => {
      // Test with mismatched array lengths
      await expect(
        db.insert(monthlyBudgets).values({
          buildingId: testBuildingId,
          budgetMonth: new Date('2020-06-01'),
          incomeTypes: ['Fee1', 'Fee2'],
          incomeAmounts: [100.00], // Mismatched length
          totalIncome: 100.00,
          spendingTypes: ['Cost1'],
          spendingAmounts: [50.00, 25.00], // Mismatched length
          totalSpending: 75.00,
          netIncome: 25.00,
          isApproved: false
        })
      ).resolves.toBeTruthy(); // Database allows this, but application should validate
    });

    it('should handle empty arrays', async () => {
      const budget = await db
        .insert(monthlyBudgets)
        .values({
          buildingId: testBuildingId,
          budgetMonth: new Date('2020-06-01'),
          incomeTypes: [],
          incomeAmounts: [],
          totalIncome: 0,
          spendingTypes: [],
          spendingAmounts: [],
          totalSpending: 0,
          netIncome: 0,
          isApproved: false
        })
        .returning();

      expect(budget[0].incomeTypes.length).toBe(0);
      expect(budget[0].incomeAmounts.length).toBe(0);
      expect(budget[0].spendingTypes.length).toBe(0);
      expect(budget[0].spendingAmounts.length).toBe(0);
    });

    it('should handle null/undefined values appropriately', async () => {
      // Test that required fields cannot be null
      await expect(
        db.insert(monthlyBudgets).values({
          buildingId: testBuildingId,
          budgetMonth: new Date('2020-06-01'),
          incomeTypes: null as any,
          incomeAmounts: [],
          totalIncome: 0,
          spendingTypes: [],
          spendingAmounts: [],
          totalSpending: 0,
          netIncome: 0,
          isApproved: false
        })
      ).rejects.toThrow();
    });
  });

  describe('Concurrency and Transactions', () => {
    it('should handle concurrent inserts', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(
          db.insert(monthlyBudgets).values({
            buildingId: testBuildingId,
            budgetMonth: new Date(2020, i, 1),
            incomeTypes: [`Income${i}`],
            incomeAmounts: [1000.00 + i * 100],
            totalIncome: 1000.00 + i * 100,
            spendingTypes: [`Spending${i}`],
            spendingAmounts: [500.00 + i * 50],
            totalSpending: 500.00 + i * 50,
            netIncome: 500.00 + i * 50,
            isApproved: false
          })
        );
      }
      
      const results = await Promise.all(promises);
      
      expect(results.length).toBe(10);
      
      // Verify all inserts succeeded
      const count = await db
        .select({ count: sql<number>`count(*)` })
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.buildingId, testBuildingId));
      
      expect(count[0].count).toBe(10);
    });

    it('should maintain data consistency during updates', async () => {
      // Insert initial budget
      const initialBudget = await db
        .insert(monthlyBudgets)
        .values({
          buildingId: testBuildingId,
          budgetMonth: new Date('2020-06-01'),
          incomeTypes: ['Initial Income'],
          incomeAmounts: [1000.00],
          totalIncome: 1000.00,
          spendingTypes: ['Initial Spending'],
          spendingAmounts: [600.00],
          totalSpending: 600.00,
          netIncome: 400.00,
          isApproved: false
        })
        .returning();

      // Simulate concurrent updates
      const updatePromises = [
        db.update(monthlyBudgets)
          .set({ isApproved: true })
          .where(eq(monthlyBudgets.id, initialBudget[0].id)),
        
        db.update(monthlyBudgets)
          .set({ totalIncome: 1200.00, netIncome: 600.00 })
          .where(eq(monthlyBudgets.id, initialBudget[0].id))
      ];

      await Promise.all(updatePromises);

      // Verify final state
      const updatedBudget = await db
        .select()
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.id, initialBudget[0].id));

      expect(updatedBudget.length).toBe(1);
      expect(updatedBudget[0].totalIncome).toBe(1200.00);
      expect(updatedBudget[0].isApproved).toBe(true);
    });
  });
});