import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { Request, Response } from 'express';
import { registerBillRoutes } from '../../server/api/bills';

// Mock dependencies
const mockDb = {
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
} as unknown;

jest.mock('../../server/db', () => ({
  db: mockDb
}));

jest.mock('../../server/auth', () => ({
  requireAuth: (req: Request, res: Response, next: () => void) => {
    (req as Request & { user: unknown }).user = { 
      id: 'test-user-id', 
      role: 'manager',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      username: 'testuser',
      phone: '555-0123',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      profileImage: '',
      language: 'en',
      lastLoginAt: new Date(),
      password: 'hashed'
    };
    next();
  }
}));

describe('Bills API', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerBillRoutes(app);
  });

  describe('GET /api/bills', () => {
    it('should return bills for a valid building ID', async () => {
      const response = await request(app)
        .get('/api/bills')
        .query({ buildingId: '123e4567-e89b-12d3-a456-426614174000' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Verify bill structure
      const bill = response.body[0];
      expect(bill).toHaveProperty('id');
      expect(bill).toHaveProperty('billNumber');
      expect(bill).toHaveProperty('title');
      expect(bill).toHaveProperty('category');
      expect(bill).toHaveProperty('totalAmount');
      expect(bill).toHaveProperty('status');
    });

    it('should filter bills by category', async () => {
      const response = await request(app)
        .get('/api/bills')
        .query({ 
          buildingId: '123e4567-e89b-12d3-a456-426614174000',
          category: 'insurance'
        });

      expect(response.status).toBe(200);
      response.body.forEach((bill: unknown) => {
        expect(bill.category).toBe('insurance');
      });
    });

    it('should filter bills by status', async () => {
      const response = await request(app)
        .get('/api/bills')
        .query({ 
          buildingId: '123e4567-e89b-12d3-a456-426614174000',
          status: 'paid'
        });

      expect(response.status).toBe(200);
      response.body.forEach((bill: unknown) => {
        expect(bill.status).toBe('paid');
      });
    });

    it('should filter bills by year', async () => {
      const response = await request(app)
        .get('/api/bills')
        .query({ 
          buildingId: '123e4567-e89b-12d3-a456-426614174000',
          year: '2024'
        });

      expect(response.status).toBe(200);
      response.body.forEach((bill: unknown) => {
        expect(bill.startDate).toMatch(/^2024/);
      });
    });

    it('should return 400 for invalid buildingId', async () => {
      const response = await request(app)
        .get('/api/bills')
        .query({ buildingId: 'invalid-uuid' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('errors');
    });

    it('should return 400 for missing buildingId', async () => {
      const response = await request(app).get('/api/bills');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/bills/:id', () => {
    it('should return a specific bill', async () => {
      const response = await request(app).get('/api/bills/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', '1');
      expect(response.body).toHaveProperty('billNumber');
      expect(response.body).toHaveProperty('title');
    });

    it('should return 404 for non-existent bill', async () => {
      const response = await request(app).get('/api/bills/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'Bill not found');
    });
  });

  describe('POST /api/bills', () => {
    const validBillData = {
      buildingId: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Test Bill',
      description: 'Test description',
      category: 'maintenance',
      vendor: 'Test Vendor',
      paymentType: 'unique',
      costs: [100.50],
      totalAmount: 100.50,
      startDate: '2024-01-01',
      status: 'draft'
    };

    it('should create a new bill with valid data', async () => {
      const response = await request(app)
        .post('/api/bills')
        .send(validBillData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('billNumber');
      expect(response.body.title).toBe(validBillData.title);
      expect(response.body.category).toBe(validBillData.category);
    });

    it('should return 400 for invalid buildingId', async () => {
      const invalidData = { ...validBillData, buildingId: 'invalid-uuid' };
      
      const response = await request(app)
        .post('/api/bills')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });

    it('should return 400 for missing required fields', async () => {
      const invalidData = { buildingId: validBillData.buildingId };
      
      const response = await request(app)
        .post('/api/bills')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });

    it('should return 400 for invalid category', async () => {
      const invalidData = { ...validBillData, category: 'invalid-category' };
      
      const response = await request(app)
        .post('/api/bills')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });

    it('should return 400 for negative costs', async () => {
      const invalidData = { ...validBillData, costs: [-100], totalAmount: -100 };
      
      const response = await request(app)
        .post('/api/bills')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('PUT /api/bills/:id', () => {
    const updateData = {
      title: 'Updated Bill Title',
      status: 'paid'
    };

    it('should update an existing bill', async () => {
      const response = await request(app)
        .put('/api/bills/1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.title).toBe(updateData.title);
      expect(response.body.status).toBe(updateData.status);
    });

    it('should return 404 for non-existent bill', async () => {
      const response = await request(app)
        .put('/api/bills/999')
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'Bill not found');
    });

    it('should return 400 for invalid update data', async () => {
      const invalidData = { category: 'invalid-category' };
      
      const response = await request(app)
        .put('/api/bills/1')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('DELETE /api/bills/:id', () => {
    it('should delete an existing bill', async () => {
      const response = await request(app).delete('/api/bills/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Bill deleted successfully');
    });

    it('should return 404 for non-existent bill', async () => {
      const response = await request(app).delete('/api/bills/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'Bill not found');
    });
  });

  describe('GET /api/bills/categories', () => {
    it('should return all bill categories', async () => {
      const response = await request(app).get('/api/bills/categories');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Verify category structure
      const category = response.body[0];
      expect(category).toHaveProperty('value');
      expect(category).toHaveProperty('label');
      
      // Verify expected categories are present
      const categoryValues = response.body.map((cat: unknown) => cat._value);
      expect(categoryValues).toContain('insurance');
      expect(categoryValues).toContain('maintenance');
      expect(categoryValues).toContain('utilities');
    });
  });

  describe('Money Flow Endpoints', () => {
    it('should return 501 for money flows endpoints (not implemented yet)', async () => {
      const getResponse = await request(app).get('/api/money-flows');
      expect(getResponse.status).toBe(501);
      
      const postResponse = await request(app).post('/api/money-flows').send({});
      expect(postResponse.status).toBe(501);
    });
  });
});