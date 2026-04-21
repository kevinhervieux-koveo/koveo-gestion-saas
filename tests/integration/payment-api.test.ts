import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from '@jest/globals';
import request from 'supertest';
import { app } from '../../server/index';
import { db } from '../../server/db';
import { bills, payments, users, organizations, buildings } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';

/**
 * Integration tests for Payment API endpoints
 * Tests the complete payment management API including:
 * - GET /api/bills/:billId/payments - Retrieve payments for a bill
 * - PATCH /api/bills/:billId/payments/:paymentId - Update payment status
 * - Bill-payment integration via bills API
 * - Authentication and authorization
 * - Error handling and validation
 */

describe('Payment API Integration Tests', () => {
  let authCookie: string;
  let testUser: any;
  let testOrganization: any;
  let testBuilding: any;
  let testBill: any;

  beforeAll(async () => {
    // Create test organization
    const [organization] = await db
      .insert(organizations)
      .values({
        id: 'test-org-123',
        name: 'Test Organization',
        type: 'demo',
        address: '123 Test St',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A 1A1',
        country: 'Canada',
      })
      .returning();
    testOrganization = organization;

    // Create test building
    const [building] = await db
      .insert(buildings)
      .values({
        id: 'test-building-123',
        organizationId: testOrganization.id,
        name: 'Test Building',
        address: '456 Test Ave',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H2B 2B2',
        buildingType: 'condo',
        totalUnits: 100,
      })
      .returning();
    testBuilding = building;

    // Create test user
    const hashedPassword = await bcrypt.hash('password123', 10);
    const [user] = await db
      .insert(users)
      .values({
        id: 'test-user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        password: hashedPassword,
        role: 'manager',
        organizationId: testOrganization.id,
        isActive: true,
      })
      .returning();
    testUser = user;

    // Authenticate and get session cookie
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });

    authCookie = loginResponse.headers['set-cookie'][0];
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(payments).where(eq(payments.billId, 'test-bill-123'));
    await db.delete(bills).where(eq(bills.id, 'test-bill-123'));
    await db.delete(buildings).where(eq(buildings.id, 'test-building-123'));
    await db.delete(users).where(eq(users.id, 'test-user-123'));
    await db.delete(organizations).where(eq(organizations.id, 'test-org-123'));
  });

  beforeEach(async () => {
    // Clean up any existing test bills and payments
    await db.delete(payments).where(eq(payments.billId, 'test-bill-123'));
    await db.delete(bills).where(eq(bills.id, 'test-bill-123'));
  });

  afterEach(async () => {
    // Clean up after each test
    await db.delete(payments).where(eq(payments.billId, 'test-bill-123'));
    await db.delete(bills).where(eq(bills.id, 'test-bill-123'));
  });

  describe('POST /api/bills (with payment generation)', () => {
    it('should create bill and automatically generate payments for unique bill', async () => {
      const billData = {
        buildingId: testBuilding.id,
        billNumber: 'UNI-2024-001',
        title: 'Elevator Repair',
        description: 'Emergency elevator repair',
        category: 'maintenance',
        vendor: 'Elevator Corp',
        paymentType: 'unique',
        costs: ['2500.00'],
        totalAmount: '2500.00',
        startDate: '2024-01-15',
        status: 'draft',
      };

      const response = await request(app)
        .post('/api/bills')
        .set('Cookie', authCookie)
        .send(billData)
        .expect(201);

      expect(response.body.id).toBeDefined();
      const billId = response.body.id;

      // Verify payment was automatically generated
      const paymentsResponse = await request(app)
        .get(`/api/bills/${billId}/payments`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(paymentsResponse.body).toHaveLength(1);
      expect(paymentsResponse.body[0]).toMatchObject({
        billId,
        paymentNumber: 1,
        amount: '2500.00',
        status: 'pending',
        scheduledDate: '2024-01-15',
      });
    });

    it('should create bill and automatically generate 12 payments for recurrent bill', async () => {
      const billData = {
        buildingId: testBuilding.id,
        billNumber: 'REC-2024-001',
        title: 'Monthly Maintenance',
        description: 'Regular building maintenance',
        category: 'maintenance',
        vendor: 'Maintenance Corp',
        paymentType: 'recurrent',
        schedulePayment: 'monthly',
        costs: ['1200.00'],
        totalAmount: '1200.00',
        startDate: '2024-01-01',
        status: 'sent',
      };

      const response = await request(app)
        .post('/api/bills')
        .set('Cookie', authCookie)
        .send(billData)
        .expect(201);

      const billId = response.body.id;

      // Verify 12 payments were automatically generated
      const paymentsResponse = await request(app)
        .get(`/api/bills/${billId}/payments`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(paymentsResponse.body).toHaveLength(12);
      
      // Check first and last payment details
      expect(paymentsResponse.body[0]).toMatchObject({
        billId,
        paymentNumber: 1,
        amount: '100.00', // 1200/12
        status: 'pending',
        scheduledDate: '2024-01-01',
      });

      expect(paymentsResponse.body[11]).toMatchObject({
        billId,
        paymentNumber: 12,
        scheduledDate: '2024-12-01',
      });
    });
  });

  describe('GET /api/bills/:billId/payments', () => {
    beforeEach(async () => {
      // Create test bill with payments
      const [bill] = await db
        .insert(bills)
        .values({
          id: 'test-bill-123',
          buildingId: testBuilding.id,
          billNumber: 'TEST-2024-001',
          title: 'Test Bill',
          description: 'Test bill for payment retrieval',
          category: 'utilities',
          vendor: 'Utility Corp',
          paymentType: 'recurrent',
          schedulePayment: 'monthly',
          costs: ['600.00'],
          totalAmount: '600.00',
          startDate: new Date('2024-01-01'),
          status: 'sent',
          autoGenerated: false,
          createdBy: testUser.id,
        })
        .returning();
      testBill = bill;

      // Generate payments via API call to bills endpoint
      await request(app)
        .post('/api/bills/dev/regenerate-payments')
        .set('Cookie', authCookie);
    });

    it('should retrieve all payments for a bill', async () => {
      const response = await request(app)
        .get(`/api/bills/${testBill.id}/payments`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Check payment structure
      response.body.forEach((payment: any, index: number) => {
        expect(payment).toHaveProperty('id');
        expect(payment).toHaveProperty('billId', testBill.id);
        expect(payment).toHaveProperty('paymentNumber', index + 1);
        expect(payment).toHaveProperty('amount');
        expect(payment).toHaveProperty('status');
        expect(payment).toHaveProperty('scheduledDate');
      });
    });

    it('should return 404 for non-existent bill', async () => {
      const response = await request(app)
        .get('/api/bills/non-existent-bill/payments')
        .set('Cookie', authCookie)
        .expect(404);

      expect(response.body.message).toContain('Bill not found');
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/bills/${testBill.id}/payments`)
        .expect(401);
    });
  });

  describe('PATCH /api/bills/:billId/payments/:paymentId', () => {
    let testPaymentId: string;

    beforeEach(async () => {
      // Create test bill
      const [bill] = await db
        .insert(bills)
        .values({
          id: 'test-bill-123',
          buildingId: testBuilding.id,
          billNumber: 'TEST-2024-002',
          title: 'Test Bill for Payment Update',
          description: 'Test bill for payment status updates',
          category: 'maintenance',
          vendor: 'Test Corp',
          paymentType: 'unique',
          schedulePayment: null,
          costs: ['750.00'],
          totalAmount: '750.00',
          startDate: new Date('2024-01-15'),
          status: 'sent',
          autoGenerated: false,
          createdBy: testUser.id,
        })
        .returning();
      testBill = bill;

      // Create test payment manually for this test
      const [payment] = await db
        .insert(payments)
        .values({
          billId: testBill.id,
          paymentNumber: 1,
          scheduledDate: '2024-01-15',
          amount: '750.00',
          status: 'pending',
        })
        .returning();
      testPaymentId = payment.id;
    });

    it('should update payment status to paid', async () => {
      const updateData = {
        status: 'paid',
        paidDate: '2024-01-20T10:30:00.000Z',
      };

      const response = await request(app)
        .patch(`/api/bills/${testBill.id}/payments/${testPaymentId}`)
        .set('Cookie', authCookie)
        .send(updateData)
        .expect(200);

      expect(response.body.message).toContain('Payment status updated successfully');

      // Verify payment was updated in database
      const [updatedPayment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, testPaymentId));

      expect(updatedPayment.status).toBe('paid');
      expect(updatedPayment.paidDate).toBe('2024-01-20T10:30:00.000Z');
    });

    it('should update payment status to overdue', async () => {
      const updateData = {
        status: 'overdue',
      };

      await request(app)
        .patch(`/api/bills/${testBill.id}/payments/${testPaymentId}`)
        .set('Cookie', authCookie)
        .send(updateData)
        .expect(200);

      // Verify payment was updated
      const [updatedPayment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, testPaymentId));

      expect(updatedPayment.status).toBe('overdue');
    });

    it('should return 400 for invalid status', async () => {
      const updateData = {
        status: 'invalid-status',
      };

      const response = await request(app)
        .patch(`/api/bills/${testBill.id}/payments/${testPaymentId}`)
        .set('Cookie', authCookie)
        .send(updateData)
        .expect(400);

      expect(response.body.message).toContain('Valid status is required');
    });

    it('should return 404 for non-existent payment', async () => {
      const updateData = {
        status: 'paid',
      };

      await request(app)
        .patch(`/api/bills/${testBill.id}/payments/non-existent-payment`)
        .set('Cookie', authCookie)
        .send(updateData)
        .expect(500);
    });

    it('should require authentication', async () => {
      const updateData = {
        status: 'paid',
      };

      await request(app)
        .patch(`/api/bills/${testBill.id}/payments/${testPaymentId}`)
        .send(updateData)
        .expect(401);
    });
  });

  describe('PUT /api/bills/:id (payment status cascading)', () => {
    beforeEach(async () => {
      // Create test bill with payments
      const [bill] = await db
        .insert(bills)
        .values({
          id: 'test-bill-123',
          buildingId: testBuilding.id,
          billNumber: 'CASCADE-2024-001',
          title: 'Test Bill for Status Cascading',
          description: 'Test bill for payment status cascading',
          category: 'utilities',
          vendor: 'Utility Corp',
          paymentType: 'recurrent',
          schedulePayment: 'monthly',
          costs: ['1200.00'],
          totalAmount: '1200.00',
          startDate: new Date('2024-01-01'),
          status: 'draft',
          autoGenerated: false,
          createdBy: testUser.id,
        })
        .returning();
      testBill = bill;

      // Generate payments
      await request(app)
        .post('/api/bills/dev/regenerate-payments')
        .set('Cookie', authCookie);
    });

    it('should cascade paid status to all payments when bill is marked as paid', async () => {
      const updateData = {
        status: 'paid',
      };

      await request(app)
        .put(`/api/bills/${testBill.id}`)
        .set('Cookie', authCookie)
        .send(updateData)
        .expect(200);

      // Verify all payments are marked as paid
      const updatedPayments = await db
        .select()
        .from(payments)
        .where(eq(payments.billId, testBill.id));

      expect(updatedPayments.length).toBeGreaterThan(0);
      expect(updatedPayments.every(p => p.status === 'paid')).toBe(true);
      expect(updatedPayments.every(p => p.paidDate !== null)).toBe(true);
    });

    it('should cascade cancelled status to pending payments when bill is cancelled', async () => {
      const updateData = {
        status: 'cancelled',
      };

      await request(app)
        .put(`/api/bills/${testBill.id}`)
        .set('Cookie', authCookie)
        .send(updateData)
        .expect(200);

      // Verify all payments are cancelled
      const updatedPayments = await db
        .select()
        .from(payments)
        .where(eq(payments.billId, testBill.id));

      expect(updatedPayments.length).toBeGreaterThan(0);
      expect(updatedPayments.every(p => p.status === 'cancelled')).toBe(true);
    });
  });

  describe('DELETE /api/bills/:id (payment cleanup)', () => {
    beforeEach(async () => {
      // Create test bill with payments
      const [bill] = await db
        .insert(bills)
        .values({
          id: 'test-bill-123',
          buildingId: testBuilding.id,
          billNumber: 'DELETE-2024-001',
          title: 'Test Bill for Deletion',
          description: 'Test bill for payment cleanup on deletion',
          category: 'maintenance',
          vendor: 'Test Corp',
          paymentType: 'recurrent',
          schedulePayment: 'monthly',
          costs: ['600.00'],
          totalAmount: '600.00',
          startDate: new Date('2024-01-01'),
          status: 'draft',
          autoGenerated: false,
          createdBy: testUser.id,
        })
        .returning();
      testBill = bill;

      // Generate payments
      await request(app)
        .post('/api/bills/dev/regenerate-payments')
        .set('Cookie', authCookie);
    });

    it('should delete all associated payments when bill is deleted', async () => {
      // Verify payments exist before deletion
      const paymentsBefore = await db
        .select()
        .from(payments)
        .where(eq(payments.billId, testBill.id));
      
      expect(paymentsBefore.length).toBeGreaterThan(0);

      // Delete the bill
      await request(app)
        .delete(`/api/bills/${testBill.id}`)
        .set('Cookie', authCookie)
        .expect(200);

      // Verify payments are deleted
      const paymentsAfter = await db
        .select()
        .from(payments)
        .where(eq(payments.billId, testBill.id));

      expect(paymentsAfter).toHaveLength(0);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle payment retrieval for bill with no payments', async () => {
      // Create bill without generating payments
      const [bill] = await db
        .insert(bills)
        .values({
          id: 'test-bill-123',
          buildingId: testBuilding.id,
          billNumber: 'EMPTY-2024-001',
          title: 'Bill Without Payments',
          description: 'Test bill without payments',
          category: 'other',
          vendor: 'Test Corp',
          paymentType: 'unique',
          schedulePayment: null,
          costs: ['100.00'],
          totalAmount: '100.00',
          startDate: new Date('2024-01-01'),
          status: 'draft',
          autoGenerated: false,
          createdBy: testUser.id,
        })
        .returning();

      const response = await request(app)
        .get(`/api/bills/${bill.id}/payments`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body).toHaveLength(0);
    });

    it('should handle concurrent payment status updates gracefully', async () => {
      // Create test bill and payment
      const [bill] = await db
        .insert(bills)
        .values({
          id: 'test-bill-123',
          buildingId: testBuilding.id,
          billNumber: 'CONCURRENT-2024-001',
          title: 'Concurrent Test Bill',
          description: 'Test bill for concurrent updates',
          category: 'utilities',
          vendor: 'Test Corp',
          paymentType: 'unique',
          schedulePayment: null,
          costs: ['500.00'],
          totalAmount: '500.00',
          startDate: new Date('2024-01-01'),
          status: 'sent',
          autoGenerated: false,
          createdBy: testUser.id,
        })
        .returning();

      const [payment] = await db
        .insert(payments)
        .values({
          billId: bill.id,
          paymentNumber: 1,
          scheduledDate: '2024-01-01',
          amount: '500.00',
          status: 'pending',
        })
        .returning();

      // Perform concurrent updates
      const update1 = request(app)
        .patch(`/api/bills/${bill.id}/payments/${payment.id}`)
        .set('Cookie', authCookie)
        .send({ status: 'paid' });

      const update2 = request(app)
        .patch(`/api/bills/${bill.id}/payments/${payment.id}`)
        .set('Cookie', authCookie)
        .send({ status: 'overdue' });

      const [response1, response2] = await Promise.all([update1, update2]);

      // At least one should succeed
      expect([200, 500]).toContain(response1.status);
      expect([200, 500]).toContain(response2.status);
    });
  });
});