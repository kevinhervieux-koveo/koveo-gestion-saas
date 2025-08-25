import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';

// Bill validation schemas (would normally be imported from the API)
const billCategorySchema = z.enum([
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
  'other',
]);

const paymentTypeSchema = z.enum(['unique', 'recurrent']);

const schedulePaymentSchema = z.enum(['weekly', 'monthly', 'quarterly', 'yearly', 'custom']);

const billStatusSchema = z.enum(['draft', 'sent', 'overdue', 'paid', 'cancelled']);

const createBillSchema = z.object({
  buildingId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  category: billCategorySchema,
  vendor: z.string().optional(),
  paymentType: paymentTypeSchema,
  schedulePayment: schedulePaymentSchema.optional(),
  scheduleCustom: z.array(z.string()).optional(),
  costs: z.array(z.number().positive()).min(1),
  totalAmount: z.number().positive(),
  startDate: z.string(),
  endDate: z.string().optional(),
  status: billStatusSchema.optional(),
  notes: z.string().optional(),
});

const billFilterSchema = z.object({
  buildingId: z.string().uuid(),
  category: z.string().optional(),
  year: z.string().optional(),
  status: billStatusSchema.optional(),
});

describe('Bills Validation Tests', () => {
  describe('Bill Category Validation', () => {
    it('should accept all valid bill categories', () => {
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
        'other',
      ];

      validCategories.forEach((category) => {
        const result = billCategorySchema.safeParse(category);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result._data).toBe(category);
        }
      });
    });

    it('should reject invalid bill categories', () => {
      const invalidCategories = [
        'invalid_category',
        'INSURANCE', // wrong case
        'misc',
        '',
        null,
        undefined,
        123,
      ];

      invalidCategories.forEach((category) => {
        const result = billCategorySchema.safeParse(category);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Payment Type Validation', () => {
    it('should accept valid payment types', () => {
      const validTypes = ['unique', 'recurrent'];

      validTypes.forEach((type) => {
        const result = paymentTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result._data).toBe(type);
        }
      });
    });

    it('should reject invalid payment types', () => {
      const invalidTypes = ['one_time', 'recurring', 'UNIQUE', '', null, undefined];

      invalidTypes.forEach((type) => {
        const result = paymentTypeSchema.safeParse(type);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Schedule Payment Validation', () => {
    it('should accept valid schedule payment options', () => {
      const validSchedules = ['weekly', 'monthly', 'quarterly', 'yearly', 'custom'];

      validSchedules.forEach((schedule) => {
        const result = schedulePaymentSchema.safeParse(schedule);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result._data).toBe(schedule);
        }
      });
    });

    it('should reject invalid schedule payment options', () => {
      const invalidSchedules = ['daily', 'biweekly', 'annually', 'MONTHLY', '', null];

      invalidSchedules.forEach((schedule) => {
        const result = schedulePaymentSchema.safeParse(schedule);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Bill Status Validation', () => {
    it('should accept valid bill statuses', () => {
      const validStatuses = ['draft', 'sent', 'overdue', 'paid', 'cancelled'];

      validStatuses.forEach((status) => {
        const result = billStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result._data).toBe(status);
        }
      });
    });

    it('should reject invalid bill statuses', () => {
      const invalidStatuses = ['pending', 'completed', 'PAID', 'active', '', null];

      invalidStatuses.forEach((status) => {
        const result = billStatusSchema.safeParse(status);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Create Bill Schema Validation', () => {
    const validBillData = {
      buildingId: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Test Bill',
      description: 'Test description',
      category: 'maintenance' as const,
      vendor: 'Test Vendor',
      paymentType: 'unique' as const,
      costs: [100.5],
      totalAmount: 100.5,
      startDate: '2024-01-01',
      status: 'draft' as const,
    };

    it('should accept valid bill data', () => {
      const result = createBillSchema.safeParse(validBillData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Test Bill');
        expect(result.data.category).toBe('maintenance');
      }
    });

    it('should require buildingId to be a valid UUID', () => {
      const invalidData = { ...validBillData, buildingId: 'invalid-uuid' };
      const result = createBillSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should require title to be non-empty', () => {
      const invalidData = { ...validBillData, title: '' };
      const result = createBillSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should require costs to be positive numbers', () => {
      const invalidData = { ...validBillData, costs: [-100, 0] };
      const result = createBillSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should require totalAmount to be positive', () => {
      const invalidData = { ...validBillData, totalAmount: -100 };
      const result = createBillSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept optional fields', () => {
      const minimalData = {
        buildingId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Minimal Bill',
        category: 'other' as const,
        paymentType: 'unique' as const,
        costs: [50],
        totalAmount: 50,
        startDate: '2024-01-01',
      };

      const result = createBillSchema.safeParse(minimalData);
      expect(result.success).toBe(true);
    });

    it('should validate recurrent bill with schedule', () => {
      const recurrentData = {
        ...validBillData,
        paymentType: 'recurrent' as const,
        schedulePayment: 'monthly' as const,
        endDate: '2024-12-31',
      };

      const result = createBillSchema.safeParse(recurrentData);
      expect(result.success).toBe(true);
    });

    it('should validate custom schedule with dates array', () => {
      const customData = {
        ...validBillData,
        paymentType: 'recurrent' as const,
        schedulePayment: 'custom' as const,
        scheduleCustom: ['2024-01-15', '2024-04-15', '2024-07-15', '2024-10-15'],
      };

      const result = createBillSchema.safeParse(customData);
      expect(result.success).toBe(true);
    });
  });

  describe('Bill Filter Schema Validation', () => {
    it('should accept valid filter data', () => {
      const validFilters = {
        buildingId: '123e4567-e89b-12d3-a456-426614174000',
        category: 'insurance',
        year: '2024',
        status: 'paid' as const,
      };

      const result = billFilterSchema.safeParse(validFilters);
      expect(result.success).toBe(true);
    });

    it('should require buildingId to be UUID', () => {
      const invalidFilters = {
        buildingId: 'invalid-uuid',
        category: 'insurance',
      };

      const result = billFilterSchema.safeParse(invalidFilters);
      expect(result.success).toBe(false);
    });

    it('should accept minimal filter with only buildingId', () => {
      const minimalFilters = {
        buildingId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = billFilterSchema.safeParse(minimalFilters);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status in filters', () => {
      const invalidFilters = {
        buildingId: '123e4567-e89b-12d3-a456-426614174000',
        status: 'invalid_status',
      };

      const result = billFilterSchema.safeParse(invalidFilters);
      expect(result.success).toBe(false);
    });
  });

  describe('Edge Cases and Data Integrity', () => {
    it('should handle very large cost amounts', () => {
      const largeCostData = {
        buildingId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Large Cost Bill',
        category: 'other' as const,
        paymentType: 'unique' as const,
        costs: [999999.99],
        totalAmount: 999999.99,
        startDate: '2024-01-01',
      };

      const result = createBillSchema.safeParse(largeCostData);
      expect(result.success).toBe(true);
    });

    it('should handle multiple costs in array', () => {
      const multiCostData = {
        buildingId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Multi-Cost Bill',
        category: 'maintenance' as const,
        paymentType: 'recurrent' as const,
        schedulePayment: 'quarterly' as const,
        costs: [500, 600, 700, 800],
        totalAmount: 2600,
        startDate: '2024-01-01',
      };

      const result = createBillSchema.safeParse(multiCostData);
      expect(result.success).toBe(true);
    });

    it('should reject empty costs array', () => {
      const emptyCostsData = {
        buildingId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Empty Costs Bill',
        category: 'other' as const,
        paymentType: 'unique' as const,
        costs: [],
        totalAmount: 100,
        startDate: '2024-01-01',
      };

      const result = createBillSchema.safeParse(emptyCostsData);
      expect(result.success).toBe(false);
    });

    it('should handle very long title and description', () => {
      const longTextData = {
        buildingId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'A'.repeat(1000), // Very long title
        description: 'B'.repeat(5000), // Very long description
        category: 'other' as const,
        paymentType: 'unique' as const,
        costs: [100],
        totalAmount: 100,
        startDate: '2024-01-01',
      };

      const result = createBillSchema.safeParse(longTextData);
      expect(result.success).toBe(true); // Schema doesn't enforce max length currently
    });
  });
});
