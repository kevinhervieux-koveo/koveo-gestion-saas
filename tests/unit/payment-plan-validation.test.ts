import { describe, it, expect } from '@jest/globals';
import { db } from '../../server/db';
import { bills, moneyFlow } from '../../shared/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';

describe('Payment Plan Validation Tests', () => {
  describe('Payment Type Logic', () => {
    it('should validate unique payment bills follow single payment pattern', async () => {
      const uniqueBills = await db
        .select({
          id: bills.id,
          billNumber: bills.billNumber,
          paymentType: bills.paymentType,
          costs: bills.costs,
          totalAmount: bills.totalAmount,
          category: bills.category
        })
        .from(bills)
        .where(eq(bills.paymentType, 'unique'));

      expect(uniqueBills.length).toBeGreaterThan(0);

      uniqueBills.forEach(bill => {
        expect(bill.paymentType).toBe('unique');
        
        // Unique payments typically have one cost entry
        expect(bill.costs).toBeInstanceOf(Array);
        expect(bill.costs.length).toBeGreaterThanOrEqual(1);
        
        // Total should match sum of costs
        const costsSum = bill.costs.reduce((sum, cost) => sum + parseFloat(cost.toString()), 0);
        const total = parseFloat(bill.totalAmount.toString());
        expect(Math.abs(costsSum - total)).toBeLessThan(0.01);
      });
    });

    it('should validate recurrent payment bills follow recurring pattern', async () => {
      const recurrentBills = await db
        .select({
          id: bills.id,
          billNumber: bills.billNumber,
          paymentType: bills.paymentType,
          costs: bills.costs,
          totalAmount: bills.totalAmount,
          category: bills.category,
          startDate: bills.startDate
        })
        .from(bills)
        .where(eq(bills.paymentType, 'recurrent'));

      expect(recurrentBills.length).toBeGreaterThan(0);

      recurrentBills.forEach(bill => {
        expect(bill.paymentType).toBe('recurrent');
        
        // Recurrent bills should have cost arrays
        expect(bill.costs).toBeInstanceOf(Array);
        expect(bill.costs.length).toBeGreaterThan(0);
        
        // Validate cost consistency for recurrent payments
        if (bill.costs.length > 1) {
          const firstCost = parseFloat(bill.costs[0].toString());
          
          // For most recurrent bills, costs should be consistent
          if (['salary', 'utilities', 'cleaning', 'security'].includes(bill.category)) {
            bill.costs.forEach(cost => {
              const amount = parseFloat(cost.toString());
              const variance = Math.abs(amount - firstCost) / firstCost;
              expect(variance).toBeLessThan(0.2); // Allow 20% variance
            });
          }
        }
        
        // Total should match sum of costs
        const costsSum = bill.costs.reduce((sum, cost) => sum + parseFloat(cost.toString()), 0);
        const total = parseFloat(bill.totalAmount.toString());
        expect(Math.abs(costsSum - total)).toBeLessThan(0.01);
      });
    });

    it('should validate payment type matches category expectations', async () => {
      // Categories that are typically unique payments
      const typicallyUnique = ['insurance', 'taxes', 'professional_services', 'repairs', 'administration', 'other'];
      
      const uniqueTypicalBills = await db
        .select()
        .from(bills)
        .where(and(
          eq(bills.paymentType, 'unique'),
          inArray(bills.category, typicallyUnique)
        ));

      // Should have some bills in these categories as unique
      expect(uniqueTypicalBills.length).toBeGreaterThan(0);

      // Categories that are typically recurrent payments
      const typicallyRecurrent = ['salary', 'utilities', 'cleaning', 'security', 'maintenance', 'landscaping', 'supplies'];
      
      const recurrentTypicalBills = await db
        .select()
        .from(bills)
        .where(and(
          eq(bills.paymentType, 'recurrent'),
          inArray(bills.category, typicallyRecurrent)
        ));

      // Should have some bills in these categories as recurrent
      expect(recurrentTypicalBills.length).toBeGreaterThan(0);
    });

    it('should validate payment amounts are realistic for categories', async () => {
      const allBills = await db.select().from(bills);
      
      const categoryExpectations: Record<string, { min: number; max: number }> = {
        'salary': { min: 2000, max: 8000 }, // Monthly salary range
        'utilities': { min: 200, max: 2000 }, // Monthly utility range
        'insurance': { min: 1000, max: 20000 }, // Annual insurance
        'taxes': { min: 1000, max: 50000 }, // Property taxes
        'cleaning': { min: 300, max: 1500 }, // Monthly cleaning
        'security': { min: 100, max: 1000 }, // Monthly security
        'maintenance': { min: 200, max: 5000 }, // Maintenance work
        'landscaping': { min: 300, max: 2000 }, // Landscaping services
        'professional_services': { min: 1000, max: 10000 }, // Legal, accounting
        'administration': { min: 100, max: 5000 }, // Admin costs
        'repairs': { min: 500, max: 15000 }, // Repair work
        'supplies': { min: 100, max: 1000 }, // Office/maintenance supplies
        'other': { min: 50, max: 5000 } // Miscellaneous
      };

      allBills.forEach(bill => {
        const category = bill.category;
        const amount = parseFloat(bill.totalAmount.toString());
        
        if (categoryExpectations[category]) {
          const { min, max } = categoryExpectations[category];
          expect(amount).toBeGreaterThanOrEqual(min);
          expect(amount).toBeLessThanOrEqual(max);
        }
      });
    });
  });

  describe('Payment Schedule Validation', () => {
    it('should validate date consistency in payment plans', async () => {
      const allBills = await db.select().from(bills);
      const currentDate = new Date();
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(currentDate.getFullYear() + 1);
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(currentDate.getFullYear() - 2);

      allBills.forEach(bill => {
        const startDate = new Date(bill.startDate);
        
        // Start date should be reasonable (not too far in past or future)
        expect(startDate.getTime()).toBeGreaterThan(twoYearsAgo.getTime());
        expect(startDate.getTime()).toBeLessThan(oneYearFromNow.getTime());
        
        // If there's an end date, it should be after start date
        if (bill.endDate) {
          const endDate = new Date(bill.endDate);
          expect(endDate.getTime()).toBeGreaterThan(startDate.getTime());
        }
      });
    });

    it('should validate cost array structure makes sense', async () => {
      const allBills = await db.select().from(bills);

      allBills.forEach(bill => {
        expect(bill.costs).toBeInstanceOf(Array);
        expect(bill.costs.length).toBeGreaterThan(0);
        
        // Each cost should be a positive number
        bill.costs.forEach(cost => {
          const amount = parseFloat(cost.toString());
          expect(amount).toBeGreaterThan(0);
          expect(amount).toBeLessThan(100000); // Reasonable upper limit
        });
        
        // For recurrent bills, having multiple costs makes sense
        if (bill.paymentType === 'recurrent' && bill.costs.length > 1) {
          // Multiple costs should represent payment schedule
          expect(bill.costs.length).toBeLessThanOrEqual(12); // Max monthly for a year
        }
        
        // For unique bills, typically one cost entry
        if (bill.paymentType === 'unique') {
          expect(bill.costs.length).toBeLessThanOrEqual(3); // Allow some flexibility
        }
      });
    });
  });

  describe('Financial Consistency Rules', () => {
    it('should validate money flow entries have correct signs', async () => {
      const allFlows = await db.select().from(moneyFlow);

      allFlows.forEach(flow => {
        const amount = parseFloat(flow.amount.toString());
        
        if (flow.type === 'income') {
          expect(amount).toBeGreaterThan(0);
        } else if (flow.type === 'expense') {
          expect(amount).toBeLessThanOrEqual(0);
        }
      });
    });

    it('should validate money flow categories align with flow types', async () => {
      const incomeCategories = [
        'monthly_fees', 'special_assessment', 'late_fees', 'parking_fees',
        'utility_reimbursement', 'insurance_claim', 'other_income'
      ];
      
      const expenseCategories = [
        'bill_payment', 'maintenance_expense', 'administrative_expense',
        'professional_services', 'other_expense'
      ];

      const incomeFlows = await db
        .select()
        .from(moneyFlow)
        .where(eq(moneyFlow.type, 'income'));

      const expenseFlows = await db
        .select()
        .from(moneyFlow)
        .where(eq(moneyFlow.type, 'expense'));

      incomeFlows.forEach(flow => {
        expect(incomeCategories).toContain(flow.category);
      });

      expenseFlows.forEach(flow => {
        expect(expenseCategories).toContain(flow.category);
      });
    });

    it('should validate bill-linked money flows are consistent', async () => {
      // Get money flows that are linked to bills
      const billLinkedFlows = await db
        .select({
          flowId: moneyFlow.id,
          flowAmount: moneyFlow.amount,
          flowType: moneyFlow.type,
          billId: moneyFlow.billId,
          billAmount: bills.totalAmount,
          billCategory: bills.category
        })
        .from(moneyFlow)
        .innerJoin(bills, eq(moneyFlow.billId, bills.id))
        .where(sql`${moneyFlow.billId} IS NOT NULL`);

      billLinkedFlows.forEach(({ flowAmount, flowType, billAmount, billCategory }) => {
        const flowAmt = Math.abs(parseFloat(flowAmount.toString()));
        const billAmt = parseFloat(billAmount.toString());
        
        // Flow amount should not exceed bill amount by too much
        expect(flowAmt).toBeLessThanOrEqual(billAmt * 1.1); // Allow 10% for fees
        
        // Most bill payments should be expenses
        if (billCategory !== 'other') {
          expect(flowType).toBe('expense');
        }
      });
    });

    it('should validate reference numbers are properly formatted', async () => {
      const allFlows = await db
        .select()
        .from(moneyFlow)
        .where(sql`${moneyFlow.referenceNumber} IS NOT NULL`);

      allFlows.forEach(flow => {
        if (flow.referenceNumber) {
          // Reference numbers should have reasonable format
          expect(flow.referenceNumber.length).toBeGreaterThan(0);
          expect(flow.referenceNumber.length).toBeLessThan(50);
          
          // Should not contain special characters that could cause issues
          expect(flow.referenceNumber).not.toMatch(/[<>'";&]/);
        }
      });
    });
  });

  describe('Business Rule Validation', () => {
    it('should validate bill numbers are unique', async () => {
      const allBills = await db
        .select({ billNumber: bills.billNumber })
        .from(bills);

      const billNumbers = allBills.map(b => b.billNumber);
      const uniqueBillNumbers = [...new Set(billNumbers)];
      
      expect(billNumbers.length).toBe(uniqueBillNumbers.length);
    });

    it('should validate status transitions are logical', async () => {
      const statusPriority = {
        'draft': 1,
        'sent': 2,
        'overdue': 3,
        'paid': 4,
        'cancelled': 0 // Can be cancelled from any state
      };

      const allBills = await db.select().from(bills);
      
      // Bills with paid status should have reasonable patterns
      const paidBills = allBills.filter(b => b.status === 'paid');
      expect(paidBills.length).toBeGreaterThan(0);
      
      // Overdue bills should have start dates in the past
      const overdueBills = allBills.filter(b => b.status === 'overdue');
      if (overdueBills.length > 0) {
        overdueBills.forEach(bill => {
          const startDate = new Date(bill.startDate);
          const currentDate = new Date();
          expect(startDate.getTime()).toBeLessThan(currentDate.getTime());
        });
      }
    });

    it('should validate reconciliation flags are consistent', async () => {
      const reconciledFlows = await db
        .select()
        .from(moneyFlow)
        .where(eq(moneyFlow.isReconciled, true));

      reconciledFlows.forEach(flow => {
        // Reconciled flows should have reconciliation date
        expect(flow.reconciledDate).not.toBeNull();
        
        if (flow.reconciledDate) {
          const reconDate = new Date(flow.reconciledDate);
          const transDate = new Date(flow.transactionDate);
          
          // Reconciliation date should be same or after transaction date
          expect(reconDate.getTime()).toBeGreaterThanOrEqual(transDate.getTime());
        }
      });
    });
  });
});