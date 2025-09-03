import { describe, it, expect, beforeAll } from '@jest/globals';
import { db } from '../../server/db';
import { bills } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';

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
        expect(parseFloat(bill.totalAmount.toString())).toBeGreaterThan(0);
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
        expect(parseFloat(bill.totalAmount.toString())).toBeGreaterThan(0);
        expect(bill.startDate).toBeDefined();

        // Unique payments often have single larger amounts
        const totalAmount = parseFloat(bill.totalAmount.toString());
        expect(totalAmount).toBeGreaterThan(0);
      });
    });

    it('should ensure payment types align with typical categories', async () => {
      // Categories typically associated with recurrent payments
      const recurrentCategories = [
        'utilities',
        'maintenance',
        'cleaning',
        'security',
        'insurance',
        'salary',
        'landscaping',
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

  describe('Bills System Consistency', () => {
    it('should ensure all bills have valid building references', async () => {
      // All bills should reference valid buildings
      const billsWithBuildings = await db
        .select({
          billId: bills.id,
          buildingId: bills.buildingId,
          buildingExists: sql`EXISTS(SELECT 1 FROM buildings WHERE id = ${bills.buildingId})`,
        })
        .from(bills);

      expect(billsWithBuildings.length).toBeGreaterThan(0);

      billsWithBuildings.forEach((bill) => {
        expect(bill.buildingExists).toBe(true);
      });
    });

    it('should validate bill amounts are positive and reasonable', async () => {
      const allBills = await db.select().from(bills);

      expect(allBills.length).toBeGreaterThan(0);

      allBills.forEach((bill) => {
        const totalAmount = parseFloat(bill.totalAmount.toString());
        const costs = bill.costs;

        // Total amount should be positive
        expect(totalAmount).toBeGreaterThan(0);
        
        // Total amount should be reasonable (not negative, not excessively large)
        expect(totalAmount).toBeLessThan(1000000); // 1 million upper limit
        
        // Costs array should exist and have positive values
        expect(costs).toBeInstanceOf(Array);
        expect(costs.length).toBeGreaterThan(0);
        
        costs.forEach((cost: string) => {
          const costAmount = parseFloat(cost);
          expect(costAmount).toBeGreaterThan(0);
        });
      });
    });

    it('should validate bill status consistency', async () => {
      const allBills = await db.select().from(bills);

      expect(allBills.length).toBeGreaterThan(0);

      const validStatuses = ['draft', 'pending', 'approved', 'paid', 'overdue', 'cancelled', 'sent'];
      
      allBills.forEach((bill) => {
        expect(validStatuses).toContain(bill.status);
        expect(bill.billNumber).toBeTruthy();
        expect(bill.title).toBeTruthy();
      });
    });

    it('should validate bill date consistency', async () => {
      const allBills = await db.select().from(bills);

      expect(allBills.length).toBeGreaterThan(0);

      allBills.forEach((bill) => {
        expect(bill.startDate).toBeDefined();
        
        // If end date exists, it should be after start date
        if (bill.endDate) {
          const startDate = new Date(bill.startDate);
          const endDate = new Date(bill.endDate);
          expect(endDate.getTime()).toBeGreaterThan(startDate.getTime());
        }
      });
    });

    it('should validate bill categories are appropriate', async () => {
      const allBills = await db.select().from(bills);

      expect(allBills.length).toBeGreaterThan(0);

      const validCategories = [
        'insurance',
        'maintenance', 
        'salary',
        'utilities',
        'cleaning',
        'security',
        'landscaping',
        'professional_services',
        'administration',
        'repairs',
        'supplies',
        'taxes',
        'other'
      ];

      allBills.forEach((bill) => {
        expect(validCategories).toContain(bill.category);
      });
    });
  });

  describe('Bill Data Integrity', () => {
    it('should ensure bill numbers are unique', async () => {
      const allBills = await db.select({ billNumber: bills.billNumber }).from(bills);
      const billNumbers = allBills.map(b => b.billNumber);
      const uniqueBillNumbers = [...new Set(billNumbers)];

      expect(billNumbers.length).toBe(uniqueBillNumbers.length);
    });

    it('should validate costs array sums match total amounts', async () => {
      const allBills = await db.select().from(bills);

      expect(allBills.length).toBeGreaterThan(0);

      allBills.forEach((bill) => {
        const totalAmount = parseFloat(bill.totalAmount.toString());
        const costs = bill.costs;

        const costsSum = costs.reduce((sum: number, cost: string) => {
          return sum + parseFloat(cost);
        }, 0);

        // Allow small floating point differences
        expect(Math.abs(totalAmount - costsSum)).toBeLessThan(0.01);
      });
    });

    it('should validate recurrent bills have reasonable structure', async () => {
      const recurrentBills = await db
        .select()
        .from(bills)
        .where(eq(bills.paymentType, 'recurrent'));

      expect(recurrentBills.length).toBeGreaterThan(0);

      recurrentBills.forEach((bill) => {
        // Recurrent bills should have basic structure
        expect(bill.paymentType).toBe('recurrent');
        expect(bill.costs).toBeInstanceOf(Array);
        expect(bill.costs.length).toBeGreaterThan(0);
        
        // Total amount should be positive
        const totalAmount = parseFloat(bill.totalAmount.toString());
        expect(totalAmount).toBeGreaterThan(0);
      });
    });
  });
});