import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { registerBillRoutes } from '../../server/api/bills';

// Mock the database and auth
const mockDb = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  values: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
};

jest.mock('../../server/db', () => ({
  db: mockDb,
}));

jest.mock('../../server/auth', () => ({
  requireAuth: (req: unknown, res: unknown, next: unknown) => {
    req.user = {
      id: 'test-user-id',
      role: 'manager',
      organizationId: 'test-org-id',
    };
    next();
  },
}));

describe('Bills Workflow Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerBillRoutes(app);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Bill Management Workflow', () => {
    const buildingId = '123e4567-e89b-12d3-a456-426614174000';
    const mockBuilding = { name: 'Test Building' };

    beforeEach(() => {
      // Mock building lookup
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockBuilding]),
          }),
        }),
      });
    });

    it('should handle complete bill lifecycle: create -> read -> update -> delete', async () => {
      const billData = {
        buildingId,
        title: 'Integration Test Bill',
        description: 'Test bill for integration testing',
        category: 'maintenance',
        vendor: 'Test Vendor Co.',
        paymentType: 'unique',
        costs: [500.0],
        totalAmount: 500.0,
        startDate: '2024-01-15',
        status: 'draft',
        notes: 'Integration test notes',
      };

      // Step 1: Create bill
      const createResponse = await request(app).post('/api/bills').send(billData);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body).toHaveProperty('id');
      expect(createResponse.body.title).toBe(billData.title);
      expect(createResponse.body.billNumber).toMatch(/^BILL-/);

      const billId = createResponse.body.id;

      // Step 2: Read bill
      const readResponse = await request(app).get(`/api/bills/${billId}`);

      expect(readResponse.status).toBe(200);
      expect(readResponse.body.id).toBe(billId);
      expect(readResponse.body.title).toBe(billData.title);

      // Step 3: Update bill
      const updateData = {
        title: 'Updated Integration Test Bill',
        status: 'sent',
        notes: 'Updated notes',
      };

      const updateResponse = await request(app).put(`/api/bills/${billId}`).send(updateData);

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.title).toBe(updateData.title);
      expect(updateResponse.body.status).toBe(updateData.status);

      // Step 4: Delete bill
      const deleteResponse = await request(app).delete(`/api/bills/${billId}`);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.message).toBe('Bill deleted successfully');

      // Step 5: Verify deletion
      const verifyResponse = await request(app).get(`/api/bills/${billId}`);

      expect(verifyResponse.status).toBe(404);
    });

    it('should handle bill filtering workflow correctly', async () => {
      // Test filtering by building
      const buildingFilterResponse = await request(app).get('/api/bills').query({ buildingId });

      expect(buildingFilterResponse.status).toBe(200);
      expect(Array.isArray(buildingFilterResponse.body)).toBe(true);

      // Test filtering by category
      const categoryFilterResponse = await request(app)
        .get('/api/bills')
        .query({ buildingId, category: 'insurance' });

      expect(categoryFilterResponse.status).toBe(200);
      categoryFilterResponse.body.forEach((bill: unknown) => {
        expect(bill.category).toBe('insurance');
      });

      // Test filtering by status
      const statusFilterResponse = await request(app)
        .get('/api/bills')
        .query({ buildingId, status: 'paid' });

      expect(statusFilterResponse.status).toBe(200);
      statusFilterResponse.body.forEach((bill: unknown) => {
        expect(bill.status).toBe('paid');
      });

      // Test filtering by year
      const yearFilterResponse = await request(app)
        .get('/api/bills')
        .query({ buildingId, year: '2024' });

      expect(yearFilterResponse.status).toBe(200);
      yearFilterResponse.body.forEach((bill: unknown) => {
        expect(bill.startDate).toMatch(/^2024/);
      });

      // Test combined filters
      const combinedFilterResponse = await request(app).get('/api/bills').query({
        buildingId,
        category: 'maintenance',
        status: 'sent',
        year: '2024',
      });

      expect(combinedFilterResponse.status).toBe(200);
      combinedFilterResponse.body.forEach((bill: unknown) => {
        expect(bill.category).toBe('maintenance');
        expect(bill.status).toBe('sent');
        expect(bill.startDate).toMatch(/^2024/);
      });
    });

    it('should validate bill categories correctly', async () => {
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

      // Test each valid category
      for (const category of validCategories) {
        const billData = {
          buildingId,
          title: `Test ${category} Bill`,
          category,
          paymentType: 'unique',
          costs: [100],
          totalAmount: 100,
          startDate: '2024-01-01',
        };

        const response = await request(app).post('/api/bills').send(billData);

        expect(response.status).toBe(201);
        expect(response.body.category).toBe(category);
      }

      // Test invalid category
      const invalidBillData = {
        buildingId,
        title: 'Invalid Category Bill',
        category: 'invalid_category',
        paymentType: 'unique',
        costs: [100],
        totalAmount: 100,
        startDate: '2024-01-01',
      };

      const invalidResponse = await request(app).post('/api/bills').send(invalidBillData);

      expect(invalidResponse.status).toBe(400);
      expect(invalidResponse.body).toHaveProperty('errors');
    });

    it('should validate payment types and schedules correctly', async () => {
      // Test unique payment type
      const uniqueBillData = {
        buildingId,
        title: 'Unique Payment Bill',
        category: 'maintenance',
        paymentType: 'unique',
        costs: [500],
        totalAmount: 500,
        startDate: '2024-01-01',
      };

      const uniqueResponse = await request(app).post('/api/bills').send(uniqueBillData);

      expect(uniqueResponse.status).toBe(201);
      expect(uniqueResponse.body.paymentType).toBe('unique');

      // Test recurrent payment type with schedule
      const recurrentBillData = {
        buildingId,
        title: 'Recurrent Payment Bill',
        category: 'utilities',
        paymentType: 'recurrent',
        schedulePayment: 'monthly',
        costs: [200],
        totalAmount: 200,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };

      const recurrentResponse = await request(app).post('/api/bills').send(recurrentBillData);

      expect(recurrentResponse.status).toBe(201);
      expect(recurrentResponse.body.paymentType).toBe('recurrent');
      expect(recurrentResponse.body.schedulePayment).toBe('monthly');

      // Test custom schedule
      const customBillData = {
        buildingId,
        title: 'Custom Schedule Bill',
        category: 'insurance',
        paymentType: 'recurrent',
        schedulePayment: 'custom',
        scheduleCustom: ['2024-03-15', '2024-06-15', '2024-09-15', '2024-12-15'],
        costs: [1000, 1000, 1000, 1000],
        totalAmount: 4000,
        startDate: '2024-01-01',
      };

      const customResponse = await request(app).post('/api/bills').send(customBillData);

      expect(customResponse.status).toBe(201);
      expect(customResponse.body.schedulePayment).toBe('custom');
      expect(customResponse.body.scheduleCustom).toEqual(customBillData.scheduleCustom);
    });

    it('should handle error scenarios gracefully', async () => {
      // Test missing required fields
      const incompleteData = {
        buildingId,
        title: 'Incomplete Bill',
        // Missing required fields
      };

      const incompleteResponse = await request(app).post('/api/bills').send(incompleteData);

      expect(incompleteResponse.status).toBe(400);
      expect(incompleteResponse.body).toHaveProperty('errors');

      // Test invalid UUID format
      const invalidUuidResponse = await request(app)
        .get('/api/bills')
        .query({ buildingId: 'invalid-uuid' });

      expect(invalidUuidResponse.status).toBe(400);

      // Test negative amounts
      const negativeAmountData = {
        buildingId,
        title: 'Negative Amount Bill',
        category: 'maintenance',
        paymentType: 'unique',
        costs: [-100],
        totalAmount: -100,
        startDate: '2024-01-01',
      };

      const negativeResponse = await request(app).post('/api/bills').send(negativeAmountData);

      expect(negativeResponse.status).toBe(400);
      expect(negativeResponse.body).toHaveProperty('errors');
    });

    it('should return correct bill categories endpoint', async () => {
      const categoriesResponse = await request(app).get('/api/bills/categories');

      expect(categoriesResponse.status).toBe(200);
      expect(Array.isArray(categoriesResponse.body)).toBe(true);

      const expectedCategories = [
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

      const categoryValues = categoriesResponse.body.map((cat: unknown) => cat._value);
      expectedCategories.forEach((category) => {
        expect(categoryValues).toContain(category);
      });

      // Verify category structure
      categoriesResponse.body.forEach((category: unknown) => {
        expect(category).toHaveProperty('value');
        expect(category).toHaveProperty('label');
        expect(typeof category._value).toBe('string');
        expect(typeof category.label).toBe('string');
      });
    });

    it('should handle concurrent bill operations correctly', async () => {
      const billData1 = {
        buildingId,
        title: 'Concurrent Bill 1',
        category: 'maintenance',
        paymentType: 'unique',
        costs: [300],
        totalAmount: 300,
        startDate: '2024-01-01',
      };

      const billData2 = {
        buildingId,
        title: 'Concurrent Bill 2',
        category: 'utilities',
        paymentType: 'unique',
        costs: [400],
        totalAmount: 400,
        startDate: '2024-01-01',
      };

      // Create bills concurrently
      const [response1, response2] = await Promise.all([
        request(app).post('/api/bills').send(billData1),
        request(app).post('/api/bills').send(billData2),
      ]);

      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);
      expect(response1.body.title).toBe(billData1.title);
      expect(response2.body.title).toBe(billData2.title);
      expect(response1.body.billNumber).not.toBe(response2.body.billNumber);
    });
  });
});
