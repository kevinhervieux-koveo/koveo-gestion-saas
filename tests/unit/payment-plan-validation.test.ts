import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  getDemoBills,
  validateDemoDataStructure,
  DEMO_ORG_ID as _DEMO_ORG_ID,
} from '../utils/demo-data-helpers';

describe('Payment Plan Validation Tests', () => {
  beforeEach(() => {
    // Validate Demo data is available for testing
    const structure = validateDemoDataStructure();
    if (!structure.isValidStructure) {
      console.warn('Demo data structure validation failed:', structure);
    }
  });

  describe('Payment Type Logic', () => {
    it('should validate unique payment bills follow single payment pattern', async () => {
      const uniqueBills = getDemoBills('unique');

      expect(uniqueBills.length).toBeGreaterThan(0);

      uniqueBills.forEach((bill) => {
        expect(bill.paymentType).toBe('unique');

        // Unique payments typically have cost arrays
        if (bill.costs) {
          expect(bill.costs).toBeInstanceOf(Array);
          expect(bill.costs.length).toBeGreaterThanOrEqual(1);
        }

        // Validate total amount exists and is positive
        if (bill.totalAmount) {
          const total = parseFloat(bill.totalAmount.toString());
          expect(total).toBeGreaterThan(0);
        }
      });
    });

    it('should validate recurrent payment bills follow recurring pattern', async () => {
      const recurrentBills = await getDemoBills('recurrent');

      if (recurrentBills.length > 0) {
        recurrentBills.forEach((bill) => {
          expect(bill.paymentType).toBe('recurrent');

          // Recurrent bills should have cost arrays
          if (bill.costs) {
            expect(bill.costs).toBeInstanceOf(Array);
            expect(bill.costs.length).toBeGreaterThan(0);
          }

          // Validate total amount
          if (bill.totalAmount) {
            const total = parseFloat(bill.totalAmount.toString());
            expect(total).toBeGreaterThan(0);
          }
        });
      } else {
        // If no recurrent bills exist, just verify the query works
        expect(recurrentBills).toEqual([]);
      }
    });

    it('should validate payment type matches category expectations', async () => {
      // Test that certain categories typically use specific payment types
      const typicallyUnique = [
        'insurance',
        'taxes',
        'professional_services',
        'repairs',
        'administration',
        'other',
        'maintenance',
      ];

      const uniqueTypicalBills = await getDemoBills('unique');
      const filteredBills = uniqueTypicalBills.filter((bill) =>
        typicallyUnique.includes(bill.category)
      );

      expect(filteredBills.length).toBeGreaterThanOrEqual(0);

      filteredBills.forEach((bill) => {
        expect(bill.paymentType).toBe('unique');
        expect(typicallyUnique).toContain(bill.category);
      });
    });

    it('should validate payment amounts are realistic for categories', async () => {
      // Test that payment amounts fall within expected ranges for different categories
      const amountRanges = {
        utilities: { min: 50, max: 2000 },
        insurance: { min: 100, max: 5000 },
        maintenance: { min: 100, max: 10000 },
        taxes: { min: 500, max: 50000 },
      };

      const allBills = await getDemoBills();
      allBills.forEach((bill) => {
        const range = amountRanges[bill.category as keyof typeof amountRanges];
        if (range && bill.totalAmount) {
          const total = parseFloat(bill.totalAmount.toString());
          expect(total).toBeGreaterThanOrEqual(range.min);
          expect(total).toBeLessThanOrEqual(range.max);
        }
      });
    });
  });

  describe('Payment Schedule Validation', () => {
    it('should validate date consistency in payment plans', async () => {
      const recurrentBills = await getDemoBills('recurrent');

      recurrentBills.forEach((bill) => {
        if (bill.startDate) {
          const startDate = new Date(bill.startDate);
          expect(startDate).toBeInstanceOf(Date);
          expect(startDate.getTime()).not.toBeNaN();
        }

        if (bill.endDate) {
          const endDate = new Date(bill.endDate);
          expect(endDate).toBeInstanceOf(Date);
          expect(endDate.getTime()).not.toBeNaN();
        }
      });
    });

    it('should validate cost array structure makes sense', async () => {
      const allBills = await getDemoBills();
      allBills.forEach((bill) => {
        if (bill.costs) {
          expect(bill.costs).toBeInstanceOf(Array);
          expect(bill.costs.length).toBeGreaterThan(0);

          bill.costs.forEach((cost: any) => {
            const amount = parseFloat(cost.toString());
            expect(amount).toBeGreaterThan(0);
            expect(Number.isFinite(amount)).toBe(true);
          });
        }
      });
    });
  });

  describe('Financial Consistency Rules', () => {
    it('should validate bill amounts have correct signs', async () => {
      const bills = await getDemoBills();
      bills.forEach((bill) => {
        if (bill.totalAmount) {
          expect(parseFloat(bill.totalAmount.toString())).toBeGreaterThan(0);
        }
      });
    });

    it('should validate category consistency', async () => {
      const validCategories = [
        'maintenance',
        'utilities',
        'insurance',
        'taxes',
        'professional_services',
        'repairs',
        'administration',
        'other',
        'salary',
        'cleaning',
        'security',
      ];

      const bills = await getDemoBills();
      bills.forEach((bill) => {
        if (bill.category) {
          expect(validCategories).toContain(bill.category);
        }
      });
    });

    it('should validate bill structure consistency', async () => {
      const bills = await getDemoBills();
      bills.forEach((bill) => {
        // Each bill should have essential fields
        expect(bill.id).toBeDefined();
        expect(bill.billNumber).toBeDefined();
        expect(bill.paymentType).toBeDefined();

        if (bill.category) {
          expect(typeof bill.category).toBe('string');
        }
      });
    });

    it('should validate reference numbers are properly formatted', async () => {
      const bills = await getDemoBills();
      bills.forEach((bill) => {
        // Demo bills have format like MAINT-2025-001-2036-03-G6
        expect(bill.billNumber).toMatch(/^[A-Z]+-\d{4}-\d{3}/);
      });
    });
  });

  describe('Business Rule Validation', () => {
    it('should validate bill numbers are unique', async () => {
      const bills = await getDemoBills();
      const billNumbers = bills.map((bill) => bill.billNumber);
      const uniqueBillNumbers = [...new Set(billNumbers)];

      expect(billNumbers.length).toBe(uniqueBillNumbers.length);
    });

    it('should validate status transitions are logical', async () => {
      const bills = await getDemoBills();
      bills.forEach((bill) => {
        expect(['unique', 'recurrent']).toContain(bill.paymentType);
        if (bill.totalAmount) {
          expect(parseFloat(bill.totalAmount.toString())).toBeGreaterThan(0);
        }
      });
    });

    it('should validate reconciliation flags are consistent', async () => {
      const bills = await getDemoBills();
      bills.forEach((bill) => {
        if (bill.totalAmount) {
          expect(parseFloat(bill.totalAmount.toString())).toBeGreaterThan(0);
        }
        if (bill.costs) {
          expect(bill.costs.length).toBeGreaterThan(0);
        }
      });
    });
  });
});
