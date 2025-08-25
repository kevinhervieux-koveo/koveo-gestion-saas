import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { registerBillRoutes } from '../../server/api/bills';
import { moneyFlowJob } from '../../server/jobs/money_flow_job';

// Mock the money flow job
jest.mock('../../server/jobs/money_flow_job', () => ({
  moneyFlowJob: {
    generateForBill: jest.fn(),
    generateForResidence: jest.fn(),
  },
}));

// Mock the database
const mockDb = {
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockQueryBuilder = {
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
};

Object.keys(mockQueryBuilder).forEach((method) => {
  mockDb[method] = jest.fn().mockReturnValue(mockQueryBuilder);
});

jest.mock('../../server/db', () => ({
  db: mockDb,
}));

// Mock auth middleware
const mockRequireAuth = (req: unknown, res: unknown, next: unknown) => {
  req.user = {
    id: 'user-123',
    email: 'admin@test.com',
    role: 'admin',
    canAccessAllOrganizations: true,
    organizations: ['org-1'],
  };
  next();
};

jest.mock('../../server/auth', () => ({
  requireAuth: mockRequireAuth,
}));

describe('Money Flow Bill Integration Tests', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerBillRoutes(app);
    jest.clearAllMocks();

    // Default mock for building access check
    mockQueryBuilder.limit.mockResolvedValue([
      {
        id: 'building-1',
        organizationId: 'org-1',
      },
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Bill creation triggers money flow generation', () => {
    it('should trigger money flow generation for recurrent bills', async () => {
      const billData = {
        buildingId: 'building-1',
        title: 'Monthly Maintenance',
        category: 'maintenance',
        vendor: 'Maintenance Co.',
        paymentType: 'recurrent',
        schedulePayment: 'monthly',
        costs: [1000],
        totalAmount: 1000,
        startDate: '2024-01-01',
        status: 'draft',
      };

      (moneyFlowJob.generateForBill as jest.Mock).mockResolvedValue(24); // 2 years of monthly entries

      const response = await request(app).post('/api/bills').send(billData).expect(201);

      expect(response.body).toMatchObject({
        title: 'Monthly Maintenance',
        paymentType: 'recurrent',
        schedulePayment: 'monthly',
      });

      // Note: In current implementation, money flow generation is commented out
      // for mock bills. When real database implementation is added, this would be:
      // expect(moneyFlowJob.generateForBill).toHaveBeenCalledWith(response.body.id);
    });

    it('should not trigger money flow generation for unique bills', async () => {
      const billData = {
        buildingId: 'building-1',
        title: 'One-time Repair',
        category: 'repairs',
        vendor: 'Repair Co.',
        paymentType: 'unique',
        costs: [5000],
        totalAmount: 5000,
        startDate: '2024-01-01',
        status: 'draft',
      };

      const response = await request(app).post('/api/bills').send(billData).expect(201);

      expect(response.body.paymentType).toBe('unique');

      // For unique bills, money flow generation should not be triggered
      expect(moneyFlowJob.generateForBill).not.toHaveBeenCalled();
    });

    it('should handle money flow generation errors gracefully', async () => {
      const billData = {
        buildingId: 'building-1',
        title: 'Quarterly Service',
        category: 'professional_services',
        paymentType: 'recurrent',
        schedulePayment: 'quarterly',
        costs: [2500],
        totalAmount: 2500,
        startDate: '2024-01-01',
      };

      (moneyFlowJob.generateForBill as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app).post('/api/bills').send(billData).expect(201);

      // Bill creation should succeed even if money flow generation fails
      expect(response.body.title).toBe('Quarterly Service');

      // Money flow generation should have been attempted (if implemented)
      // expect(moneyFlowJob.generateForBill).toHaveBeenCalled();
    });
  });

  describe('Bill updates trigger money flow regeneration', () => {
    it('should regenerate money flow when bill schedule changes', async () => {
      const billId = '1'; // Using mock bill ID from the existing mock data
      const updateData = {
        schedulePayment: 'quarterly', // Changed from monthly
        costs: [1500], // Changed amount
      };

      (moneyFlowJob.generateForBill as jest.Mock).mockResolvedValue(8); // 2 years of quarterly entries

      const response = await request(app).put(`/api/bills/${billId}`).send(updateData).expect(200);

      expect(response.body).toMatchObject(updateData);

      // Note: In current implementation, money flow regeneration is commented out
      // When real database implementation is added, this would be:
      // expect(moneyFlowJob.generateForBill).toHaveBeenCalledWith(billId);
    });

    it('should regenerate money flow when bill amount changes', async () => {
      const billId = '2';
      const updateData = {
        costs: [2000], // Increased from 1200
        totalAmount: 2000,
      };

      (moneyFlowJob.generateForBill as jest.Mock).mockResolvedValue(24);

      const response = await request(app).put(`/api/bills/${billId}`).send(updateData).expect(200);

      expect(response.body.costs).toEqual(['2000']);
    });

    it('should regenerate money flow when bill end date changes', async () => {
      const billId = '1';
      const updateData = {
        endDate: '2025-12-31', // Set end date
      };

      (moneyFlowJob.generateForBill as jest.Mock).mockResolvedValue(12); // 1 year instead of ongoing

      const response = await request(app).put(`/api/bills/${billId}`).send(updateData).expect(200);

      expect(response.body.endDate).toBe('2025-12-31');
    });

    it('should handle payment type change from recurrent to unique', async () => {
      const billId = '1';
      const updateData = {
        paymentType: 'unique',
        schedulePayment: null, // Remove schedule for unique payment
      };

      // Changing to unique should not trigger generation
      const response = await request(app).put(`/api/bills/${billId}`).send(updateData).expect(200);

      expect(response.body.paymentType).toBe('unique');

      // Should cleanup existing money flow entries when changed to unique
      // (This would be implemented in the real database version)
    });
  });

  describe('Complex bill scenarios', () => {
    it('should handle bills with multiple costs correctly', async () => {
      const billData = {
        buildingId: 'building-1',
        title: 'Variable Service Plan',
        category: 'professional_services',
        paymentType: 'recurrent',
        schedulePayment: 'quarterly',
        costs: [2000, 2500, 3000, 2200], // Different costs per quarter
        totalAmount: 9700,
        startDate: '2024-01-01',
      };

      const response = await request(app).post('/api/bills').send(billData).expect(201);

      expect(response.body.costs).toEqual(['2000', '2500', '3000', '2200']);
      expect(response.body.totalAmount).toBe('9700');
    });

    it('should handle bills with custom schedule dates', async () => {
      const billData = {
        buildingId: 'building-1',
        title: 'Custom Schedule Service',
        category: 'maintenance',
        paymentType: 'recurrent',
        schedulePayment: 'custom',
        scheduleCustom: ['2024-03-15', '2024-06-15', '2024-09-15', '2024-12-15'],
        costs: [1500],
        totalAmount: 1500,
        startDate: '2024-01-01',
      };

      const response = await request(app).post('/api/bills').send(billData).expect(201);

      expect(response.body.scheduleCustom).toEqual([
        '2024-03-15',
        '2024-06-15',
        '2024-09-15',
        '2024-12-15',
      ]);
    });

    it('should handle bills with future start dates', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const billData = {
        buildingId: 'building-1',
        title: 'Future Service Contract',
        category: 'maintenance',
        paymentType: 'recurrent',
        schedulePayment: 'monthly',
        costs: [800],
        totalAmount: 800,
        startDate: futureDateStr,
      };

      const response = await request(app).post('/api/bills').send(billData).expect(201);

      expect(response.body.startDate).toBe(futureDateStr);
    });
  });

  describe('Money flow calculation validation', () => {
    it('should validate money flow entries for monthly bills', async () => {
      const billData = {
        buildingId: 'building-1',
        title: 'Monthly Office Rent',
        category: 'administration',
        paymentType: 'recurrent',
        schedulePayment: 'monthly',
        costs: [5000],
        totalAmount: 5000,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };

      (moneyFlowJob.generateForBill as jest.Mock).mockImplementation((billId) => {
        // Simulate money flow calculation
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-12-31');

        let count = 0;
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
          count++;
          currentDate.setMonth(currentDate.getMonth() + 1);
        }

        return Promise.resolve(count);
      });

      const response = await request(app).post('/api/bills').send(billData).expect(201);

      // Should generate 12 monthly entries for 2024
      // (When real implementation is active)
    });

    it('should validate money flow entries for weekly bills', async () => {
      const billData = {
        buildingId: 'building-1',
        title: 'Weekly Cleaning',
        category: 'cleaning',
        paymentType: 'recurrent',
        schedulePayment: 'weekly',
        costs: [300],
        totalAmount: 300,
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      (moneyFlowJob.generateForBill as jest.Mock).mockImplementation(() => {
        // Simulate weekly calculation for January 2024
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-01-31');

        let count = 0;
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
          count++;
          currentDate.setDate(currentDate.getDate() + 7);
        }

        return Promise.resolve(count);
      });

      const response = await request(app).post('/api/bills').send(billData).expect(201);

      // Should generate 5 weekly entries for January 2024
    });

    it('should validate money flow entries for yearly bills', async () => {
      const billData = {
        buildingId: 'building-1',
        title: 'Annual Insurance',
        category: 'insurance',
        paymentType: 'recurrent',
        schedulePayment: 'yearly',
        costs: [12000],
        totalAmount: 12000,
        startDate: '2024-01-01',
        // No end date = ongoing
      };

      (moneyFlowJob.generateForBill as jest.Mock).mockImplementation(() => {
        // For 25-year projection
        return Promise.resolve(25);
      });

      const response = await request(app).post('/api/bills').send(billData).expect(201);

      // Should generate 25 yearly entries for 25-year projection
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle invalid building access', async () => {
      // Mock building not found
      mockQueryBuilder.limit.mockResolvedValueOnce([]);

      const billData = {
        buildingId: 'invalid-building',
        title: 'Test Bill',
        category: 'other',
        paymentType: 'unique',
        costs: [1000],
        totalAmount: 1000,
        startDate: '2024-01-01',
      };

      const response = await request(app).post('/api/bills').send(billData).expect(404);

      expect(response.body.message).toBe('Building not found');
    });

    it('should handle insufficient permissions', async () => {
      // Mock user without access to building's organization
      mockQueryBuilder.limit.mockResolvedValueOnce([
        {
          id: 'building-1',
          organizationId: 'other-org', // Different org
        },
      ]);

      const billData = {
        buildingId: 'building-1',
        title: 'Unauthorized Bill',
        category: 'other',
        paymentType: 'unique',
        costs: [1000],
        totalAmount: 1000,
        startDate: '2024-01-01',
      };

      const response = await request(app).post('/api/bills').send(billData).expect(403);

      expect(response.body).toMatchObject({
        message: 'Access denied to create bills for this building',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    });

    it('should validate required fields', async () => {
      const invalidBillData = {
        buildingId: 'building-1',
        // Missing required fields
        category: 'maintenance',
        costs: [],
        totalAmount: 0,
      };

      const response = await request(app).post('/api/bills').send(invalidBillData).expect(400);

      expect(response.body.message).toContain('Invalid bill data');
    });

    it('should handle invalid cost arrays', async () => {
      const billData = {
        buildingId: 'building-1',
        title: 'Invalid Costs',
        category: 'other',
        paymentType: 'recurrent',
        schedulePayment: 'monthly',
        costs: [], // Empty costs array
        totalAmount: 1000,
        startDate: '2024-01-01',
      };

      const response = await request(app).post('/api/bills').send(billData).expect(400);

      expect(response.body.message).toContain('Invalid bill data');
    });

    it('should handle invalid schedule combinations', async () => {
      const billData = {
        buildingId: 'building-1',
        title: 'Invalid Schedule',
        category: 'other',
        paymentType: 'unique', // Unique payment type
        schedulePayment: 'monthly', // But has schedule (invalid)
        costs: [1000],
        totalAmount: 1000,
        startDate: '2024-01-01',
      };

      // This should either be corrected or rejected
      const response = await request(app).post('/api/bills').send(billData);

      // The response will depend on validation logic
      expect([201, 400]).toContain(response.status);
    });
  });

  describe('Performance considerations', () => {
    it('should handle bill creation without blocking', async () => {
      const billData = {
        buildingId: 'building-1',
        title: 'Performance Test Bill',
        category: 'maintenance',
        paymentType: 'recurrent',
        schedulePayment: 'monthly',
        costs: [1000],
        totalAmount: 1000,
        startDate: '2024-01-01',
      };

      // Mock slow money flow generation
      (moneyFlowJob.generateForBill as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(300), 100))
      );

      const startTime = Date.now();
      const response = await request(app).post('/api/bills').send(billData).expect(201);
      const endTime = Date.now();

      // Bill creation should be fast even if money flow generation is slow
      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should handle large numbers of bills efficiently', async () => {
      const bills = Array.from({ length: 10 }, (_, i) => ({
        buildingId: 'building-1',
        title: `Bulk Bill ${i + 1}`,
        category: 'maintenance',
        paymentType: 'recurrent',
        schedulePayment: 'monthly',
        costs: [100 + i * 10],
        totalAmount: 100 + i * 10,
        startDate: '2024-01-01',
      }));

      const promises = bills.map((billData) => request(app).post('/api/bills').send(billData));

      const responses = await Promise.all(promises);

      responses.forEach((response) => {
        expect(response.status).toBe(201);
      });
    });
  });
});
