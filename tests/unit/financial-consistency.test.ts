import { describe, it, expect, beforeAll } from '@jest/globals';
import { db } from '../../server/db';
import { bills, moneyFlow } from '../../shared/schema';
import { eq, and, sum, sql } from 'drizzle-orm';

describe('Financial System Consistency Tests', () => {
  beforeAll(async () => {
    // Ensure database is connected before tests
    try {
      await db.select().from(bills).limit(1);
    } catch (_error) {
      console.warn('Database connection issue in tests:', _error);
    }
  });
  describe('Payment Plan Validation', () => {
    it('should validate recurrent payment bills have appropriate structure', async () => {
      const recurrentBills = await db
        .select()
        .from(bills)
        .where(eq(bills.paymentType, 'recurrent'));

      expect(recurrentBills.length).toBeGreaterThan(0);

      recurrentBills.forEach((bill) => {
        expect(bill.paymentType).toBe('recurrent');
        expect(bill.costs).toBeInstanceOf(Array);
        expect(bill.costs.length).toBeGreaterThan(0);
        expect(bill.totalAmount).toBeGreaterThan(0);
        expect(bill.startDate).toBeDefined();

        // Recurrent bills should have realistic monthly/quarterly amounts
        const costAmount = parseFloat(bill.costs[0]);
        expect(costAmount).toBeGreaterThan(0);
        expect(costAmount).toBeLessThan(20000); // Reasonable upper limit
      });
    });

    it('should validate unique payment bills have appropriate structure', async () => {
      const uniqueBills = await db.select().from(bills).where(eq(bills.paymentType, 'unique'));

      expect(uniqueBills.length).toBeGreaterThan(0);

      uniqueBills.forEach((bill) => {
        expect(bill.paymentType).toBe('unique');
        expect(bill.costs).toBeInstanceOf(Array);
        expect(bill.costs.length).toBeGreaterThan(0);
        expect(bill.totalAmount).toBeGreaterThan(0);
        expect(bill.startDate).toBeDefined();

        // Unique payments often have single larger amounts
        const totalAmount = parseFloat(bill.totalAmount.toString());
        expect(totalAmount).toBeGreaterThan(0);
      });
    });

    it('should validate payment plan cost arrays match total amounts', async () => {
      const allBills = await db.select().from(bills);

      allBills.forEach((bill) => {
        const costsSum = bill.costs.reduce((sum, cost) => {
          return sum + parseFloat(cost.toString());
        }, 0);

        const totalAmount = parseFloat(bill.totalAmount.toString());

        // Allow small floating point differences
        expect(Math.abs(costsSum - totalAmount)).toBeLessThan(0.01);
      });
    });

    it('should validate payment categories are appropriate for payment type', async () => {
      // Recurrent payments should typically be operational expenses
      const recurrentCategories = [
        'salary',
        'utilities',
        'cleaning',
        'security',
        'maintenance',
        'landscaping',
        'supplies',
      ];

      const recurrentBills = await db
        .select()
        .from(bills)
        .where(eq(bills.paymentType, 'recurrent'));

      recurrentBills.forEach((bill) => {
        // Most recurrent bills should be operational
        if (recurrentCategories.includes(bill.category)) {
          expect(bill.paymentType).toBe('recurrent');
        }
      });

      // Unique payments often include large one-time expenses
      const uniqueCategories = [
        'insurance',
        'taxes',
        'professional_services',
        'repairs',
        'administration',
      ];

      const uniqueBills = await db.select().from(bills).where(eq(bills.paymentType, 'unique'));

      // At least some unique bills should be in typical unique categories
      const uniqueCategoryBills = uniqueBills.filter((bill) =>
        uniqueCategories.includes(bill.category)
      );
      expect(uniqueCategoryBills.length).toBeGreaterThan(0);
    });
  });

  describe('Money Flow and Bills Consistency', () => {
    it('should ensure money flow expenses correlate with bill payments', async () => {
      // Get all expense money flows related to bills
      const billExpenses = await db
        .select({
          billId: moneyFlow.billId,
          amount: moneyFlow.amount,
          category: moneyFlow.category,
          buildingId: moneyFlow.buildingId,
        })
        .from(moneyFlow)
        .where(and(eq(moneyFlow.type, 'expense'), sql`${moneyFlow.billId} IS NOT NULL`));

      // Verify each expense has a corresponding bill
      for (const expense of billExpenses) {
        if (expense.billId) {
          const correspondingBill = await db
            .select()
            .from(bills)
            .where(eq(bills.id, expense.billId))
            .limit(1);

          expect(correspondingBill.length).toBe(1);
          expect(correspondingBill[0].buildingId).toBe(expense.buildingId);
        }
      }
    });

    it('should validate money flow amounts are consistent with bill totals', async () => {
      // Get bills that have corresponding money flow entries
      const billsWithFlow = await db
        .select({
          billId: bills.id,
          billAmount: bills.totalAmount,
          billCategory: bills.category,
          buildingId: bills.buildingId,
        })
        .from(bills)
        .leftJoin(moneyFlow, eq(moneyFlow.billId, bills.id))
        .where(sql`${moneyFlow.billId} IS NOT NULL`);

      for (const billFlow of billsWithFlow) {
        const relatedFlows = await db
          .select()
          .from(moneyFlow)
          .where(eq(moneyFlow.billId, billFlow.billId));

        if (relatedFlows.length > 0) {
          const totalFlowAmount = relatedFlows.reduce((sum, flow) => {
            return sum + Math.abs(parseFloat(flow.amount.toString()));
          }, 0);

          const billAmount = parseFloat(billFlow.billAmount.toString());

          // Flow amounts should match or be related to bill amounts
          // (allowing for partial payments or installments)
          expect(totalFlowAmount).toBeGreaterThan(0);
          expect(totalFlowAmount).toBeLessThanOrEqual(billAmount * 1.1); // 10% tolerance
        }
      }
    });

    it('should validate money flow building consistency', async () => {
      // All money flows should reference valid buildings
      const flowsWithBuildings = await db
        .select({
          flowBuildingId: moneyFlow.buildingId,
          buildingExists: sql`EXISTS(SELECT 1 FROM buildings WHERE id = ${moneyFlow.buildingId})`,
        })
        .from(moneyFlow);

      flowsWithBuildings.forEach((flow) => {
        expect(flow.buildingExists).toBe(true);
      });
    });

    it('should validate money flow categories align with bill categories', async () => {
      // Define category mappings between bills and money flow
      const categoryMappings: Record<string, string[]> = {
        insurance: ['bill_payment', 'administrative_expense'],
        maintenance: ['maintenance_expense', 'bill_payment'],
        salary: ['administrative_expense', 'bill_payment'],
        utilities: ['bill_payment', 'other_expense'],
        cleaning: ['maintenance_expense', 'bill_payment'],
        security: ['bill_payment', 'administrative_expense'],
        landscaping: ['maintenance_expense', 'bill_payment'],
        professional_services: ['professional_services', 'administrative_expense'],
        administration: ['administrative_expense', 'bill_payment'],
        repairs: ['maintenance_expense', 'bill_payment'],
        supplies: ['administrative_expense', 'bill_payment'],
        taxes: ['bill_payment', 'administrative_expense'],
        other: ['other_expense', 'bill_payment'],
      };

      // Check bills that have associated money flows
      const billsWithFlows = await db
        .select({
          billCategory: bills.category,
          flowCategory: moneyFlow.category,
        })
        .from(bills)
        .innerJoin(moneyFlow, eq(moneyFlow.billId, bills.id));

      billsWithFlows.forEach(({ billCategory, flowCategory }) => {
        const validFlowCategories = categoryMappings[billCategory] || ['bill_payment'];
        expect(validFlowCategories).toContain(flowCategory);
      });
    });

    it('should validate income and expense balance per building', async () => {
      // Get income/expense summary per building
      const buildingSummary = await db
        .select({
          buildingId: moneyFlow.buildingId,
          type: moneyFlow.type,
          totalAmount: sum(moneyFlow.amount),
        })
        .from(moneyFlow)
        .groupBy(moneyFlow.buildingId, moneyFlow.type);

      const buildingBalances: Record<string, { income: number; expense: number }> = {};

      buildingSummary.forEach((summary) => {
        if (!buildingBalances[summary.buildingId]) {
          buildingBalances[summary.buildingId] = { income: 0, expense: 0 };
        }

        const amount = parseFloat(summary.totalAmount?.toString() || '0');

        if (summary.type === 'income') {
          buildingBalances[summary.buildingId].income = amount;
        } else {
          buildingBalances[summary.buildingId].expense = Math.abs(amount);
        }
      });

      // Each building should have some financial activity
      Object.values(buildingBalances).forEach((balance) => {
        expect(balance.income + balance.expense).toBeGreaterThan(0);
      });
    });
  });

  describe('Financial Data Integrity', () => {
    it('should validate all required fields are present', async () => {
      const allBills = await db.select().from(bills);
      const allFlows = await db.select().from(moneyFlow);

      // Bills validation
      allBills.forEach((bill) => {
        expect(bill.id).toBeDefined();
        expect(bill.buildingId).toBeDefined();
        expect(bill.billNumber).toBeDefined();
        expect(bill.title).toBeDefined();
        expect(bill.category).toBeDefined();
        expect(bill.paymentType).toBeDefined();
        expect(bill.costs).toBeDefined();
        expect(bill.totalAmount).toBeDefined();
        expect(bill.startDate).toBeDefined();
        expect(bill.status).toBeDefined();
        expect(bill.createdBy).toBeDefined();
      });

      // Money flow validation
      allFlows.forEach((flow) => {
        expect(flow.id).toBeDefined();
        expect(flow.buildingId).toBeDefined();
        expect(flow.type).toBeDefined();
        expect(flow.category).toBeDefined();
        expect(flow.description).toBeDefined();
        expect(flow.amount).toBeDefined();
        expect(flow.transactionDate).toBeDefined();
        expect(flow.createdBy).toBeDefined();
      });
    });

    it('should validate numeric amounts are reasonable', async () => {
      const allBills = await db.select().from(bills);
      const allFlows = await db.select().from(moneyFlow);

      // Bills should have reasonable amounts (between $1 and $100,000)
      allBills.forEach((bill) => {
        const amount = parseFloat(bill.totalAmount.toString());
        expect(amount).toBeGreaterThan(0);
        expect(amount).toBeLessThan(100000);
      });

      // Money flows should have reasonable amounts
      allFlows.forEach((flow) => {
        const amount = Math.abs(parseFloat(flow.amount.toString()));
        expect(amount).toBeGreaterThan(0);
        expect(amount).toBeLessThan(100000);
      });
    });

    it('should validate date consistency', async () => {
      const allBills = await db.select().from(bills);
      const allFlows = await db.select().from(moneyFlow);

      const currentDate = new Date();
      const minValidDate = new Date('2024-01-01');

      // Bill dates should be reasonable
      allBills.forEach((bill) => {
        const startDate = new Date(bill.startDate);
        expect(startDate).toBeInstanceOf(Date);
        expect(startDate.getTime()).toBeGreaterThan(minValidDate.getTime());
        expect(startDate.getTime()).toBeLessThanOrEqual(
          currentDate.getTime() + 365 * 24 * 60 * 60 * 1000
        ); // Within next year
      });

      // Money flow transaction dates should be reasonable
      allFlows.forEach((flow) => {
        const transDate = new Date(flow.transactionDate);
        expect(transDate).toBeInstanceOf(Date);
        expect(transDate.getTime()).toBeGreaterThan(minValidDate.getTime());
        expect(transDate.getTime()).toBeLessThanOrEqual(
          currentDate.getTime() + 30 * 24 * 60 * 60 * 1000
        ); // Within next month
      });
    });
  });

  describe('Payment Plan Business Logic', () => {
    it('should validate recurrent payments have appropriate frequency patterns', async () => {
      const recurrentBills = await db
        .select()
        .from(bills)
        .where(eq(bills.paymentType, 'recurrent'));

      recurrentBills.forEach((bill) => {
        // Recurrent bills should have consistent cost arrays
        expect(bill.costs.length).toBeGreaterThan(0);

        // For monthly recurrent bills, costs should be similar
        if (bill.costs.length > 1) {
          const firstAmount = parseFloat(bill.costs[0].toString());
          const allSimilar = bill.costs.every((cost) => {
            const amount = parseFloat(cost.toString());
            return Math.abs(amount - firstAmount) / firstAmount < 0.1; // 10% variance allowed
          });

          // Most recurrent payments should have consistent amounts
          if (bill.category === 'salary' || bill.category === 'utilities') {
            expect(allSimilar).toBe(true);
          }
        }
      });
    });

    it('should validate bill status progression makes sense', async () => {
      const allBills = await db.select().from(bills);

      const statusCounts = {
        draft: 0,
        sent: 0,
        overdue: 0,
        paid: 0,
        cancelled: 0,
      };

      allBills.forEach((bill) => {
        statusCounts[bill.status as keyof typeof statusCounts]++;
      });

      // Should have variety of statuses
      expect(
        statusCounts.draft + statusCounts.sent + statusCounts.overdue + statusCounts.paid
      ).toBeGreaterThan(0);

      // Shouldn't have all bills in draft status (some should be processed)
      expect(statusCounts.sent + statusCounts.paid + statusCounts.overdue).toBeGreaterThan(0);
    });

    it('should validate expense flows have negative amounts', async () => {
      const expenseFlows = await db.select().from(moneyFlow).where(eq(moneyFlow.type, 'expense'));

      expenseFlows.forEach((flow) => {
        const amount = parseFloat(flow.amount.toString());
        expect(amount).toBeLessThanOrEqual(0);
      });
    });

    it('should validate income flows have positive amounts', async () => {
      const incomeFlows = await db.select().from(moneyFlow).where(eq(moneyFlow.type, 'income'));

      incomeFlows.forEach((flow) => {
        const amount = parseFloat(flow.amount.toString());
        expect(amount).toBeGreaterThan(0);
      });
    });
  });
});
