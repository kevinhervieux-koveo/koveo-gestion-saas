import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { billGenerationService } from '../../server/services/bill-generation-service';

/**
 * Comprehensive test suite for Advanced Bill API Endpoints
 * Tests all new sophisticated bill management features including:
 * - Generate future bill instances
 * - Mark bills as paid
 * - Get generated bill statistics
 * - Update generated bills from parent
 * - Delete generated bills with cascade options.
 */

// Mock the bill generation service
jest.mock('../../server/services/bill-generation-service', () => ({
  billGenerationService: {
    generateFutureBillInstances: jest.fn(),
    markBillAsPaid: jest.fn(),
    getGeneratedBillsStats: jest.fn(),
    updateGeneratedBillsFromParent: jest.fn(),
    deleteGeneratedBills: jest.fn()
  }
}));

// Mock database
const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnValue([{ organizationId: 'test-org-123' }])
};

jest.mock('../../server/db', () => ({ db: mockDb }));

// Mock auth middleware
jest.mock('../../server/auth', () => ({
  requireAuth: (req: unknown, res: unknown, next: unknown) => {
    req.user = { 
      id: 'test-user-123', 
      role: 'admin',
      canAccessAllOrganizations: true,
      organizations: ['test-org-123']
    };
    next();
  }
}));

// Import and setup the API routes
import { registerBillRoutes } from '../../server/api/bills';

describe('Advanced Bill API Endpoints', () => {
  let app: express.Application;
  const mockBillGenerationService = billGenerationService as jest.Mocked<typeof billGenerationService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerBillRoutes(app);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/bills/:id/generate-future', () => {
    const mockBill = {
      id: 'bill-123',
      buildingId: 'building-123',
      title: 'Test Recurrent Bill',
      paymentType: 'recurrent',
      schedulePayment: 'monthly',
      costs: ['1000.00'],
      totalAmount: '1000.00'
    };

    beforeEach(() => {
      // Mock finding bill in the mock bills array
      global.mockBills = [mockBill];
    });

    it('should generate future bills for a recurrent bill', async () => {
      mockBillGenerationService.generateFutureBillInstances.mockResolvedValue({
        billsCreated: 300,
        generatedUntil: '2049-01-01'
      });

      const response = await request(app)
        .post('/api/bills/bill-123/generate-future')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Future bills generated successfully',
        billsCreated: 300,
        generatedUntil: '2049-01-01',
        parentBill: {
          id: 'bill-123',
          title: 'Test Recurrent Bill',
          paymentType: 'recurrent',
          schedulePayment: 'monthly'
        }
      });

      expect(mockBillGenerationService.generateFutureBillInstances).toHaveBeenCalledWith(mockBill);
    });

    it('should reject non-recurrent bills', async () => {
      const uniqueBill = { ...mockBill, paymentType: 'unique' };
      global.mockBills = [uniqueBill];

      const response = await request(app)
        .post('/api/bills/bill-123/generate-future')
        .expect(400);

      expect(response.body.message).toBe('Only recurrent bills can generate future instances');
      expect(mockBillGenerationService.generateFutureBillInstances).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent bill', async () => {
      global.mockBills = [];

      const response = await request(app)
        .post('/api/bills/non-existent/generate-future')
        .expect(404);

      expect(response.body.message).toBe('Bill not found');
    });

    it('should enforce role-based access control', async () => {
      // Mock user with insufficient permissions
      jest.doMock('../../server/auth', () => ({
        requireAuth: (req: unknown, res: unknown, next: unknown) => {
          req.user = { 
            id: 'resident-user', 
            role: 'resident',
            canAccessAllOrganizations: false,
            organizations: ['other-org']
          };
          next();
        }
      }));

      const response = await request(app)
        .post('/api/bills/bill-123/generate-future')
        .expect(403);

      expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should handle service errors gracefully', async () => {
      mockBillGenerationService.generateFutureBillInstances.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .post('/api/bills/bill-123/generate-future')
        .expect(500);

      expect(response.body.message).toBe('Failed to generate future bills');
      expect(response.body._error).toBe('Database connection failed');
    });

    it('should handle complex recurrent bills with multiple costs', async () => {
      const complexBill = {
        ...mockBill,
        costs: ['6000.00', '4000.00'], // Split payment
        totalAmount: '10000.00',
        schedulePayment: 'yearly'
      };
      global.mockBills = [complexBill];

      mockBillGenerationService.generateFutureBillInstances.mockResolvedValue({
        billsCreated: 50, // 25 years * 2 payments per year
        generatedUntil: '2049-01-01'
      });

      const response = await request(app)
        .post('/api/bills/bill-123/generate-future')
        .expect(200);

      expect(response.body.billsCreated).toBe(50);
      expect(mockBillGenerationService.generateFutureBillInstances).toHaveBeenCalledWith(complexBill);
    });
  });

  describe('POST /api/bills/:id/mark-paid', () => {
    const mockBill = {
      id: 'bill-456',
      buildingId: 'building-123',
      title: 'Test Bill to Pay',
      status: 'sent',
      totalAmount: '500.00'
    };

    beforeEach(() => {
      global.mockBills = [mockBill];
    });

    it('should mark a bill as paid with payment date', async () => {
      mockBillGenerationService.markBillAsPaid.mockResolvedValue(undefined);

      const paymentData = {
        paymentDate: '2024-02-15',
        notes: 'Paid via bank transfer'
      };

      const response = await request(app)
        .post('/api/bills/bill-456/mark-paid')
        .send(paymentData)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Bill marked as paid successfully',
        billId: 'bill-456',
        paymentDate: '2024-02-15',
        status: 'paid'
      });

      expect(mockBillGenerationService.markBillAsPaid).toHaveBeenCalledWith(
        'bill-456',
        new Date('2024-02-15')
      );
    });

    it('should mark a bill as paid without payment date (use current date)', async () => {
      mockBillGenerationService.markBillAsPaid.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/bills/bill-456/mark-paid')
        .send({})
        .expect(200);

      expect(response.body.message).toBe('Bill marked as paid successfully');
      expect(response.body.billId).toBe('bill-456');
      expect(response.body.status).toBe('paid');
      expect(response.body.paymentDate).toBeDefined();

      expect(mockBillGenerationService.markBillAsPaid).toHaveBeenCalledWith(
        'bill-456',
        undefined
      );
    });

    it('should update mock bill status for immediate feedback', async () => {
      mockBillGenerationService.markBillAsPaid.mockResolvedValue(undefined);

      await request(app)
        .post('/api/bills/bill-456/mark-paid')
        .send({ notes: 'Test payment' })
        .expect(200);

      // Verify mock bill was updated
      expect(global.mockBills[0].status).toBe('paid');
      expect(global.mockBills[0].notes).toBe('Test payment');
    });

    it('should handle payment service errors', async () => {
      mockBillGenerationService.markBillAsPaid.mockRejectedValue(
        new Error('Payment processing failed')
      );

      const response = await request(app)
        .post('/api/bills/bill-456/mark-paid')
        .send({ paymentDate: '2024-02-15' })
        .expect(500);

      expect(response.body.message).toBe('Failed to mark bill as paid');
      expect(response.body._error).toBe('Payment processing failed');
    });

    it('should enforce permissions for marking bills as paid', async () => {
      // Test with different role permissions
      jest.doMock('../../server/auth', () => ({
        requireAuth: (req: unknown, res: unknown, next: unknown) => {
          req.user = { 
            id: 'tenant-user', 
            role: 'tenant',
            canAccessAllOrganizations: false,
            organizations: []
          };
          next();
        }
      }));

      const response = await request(app)
        .post('/api/bills/bill-456/mark-paid')
        .send({ paymentDate: '2024-02-15' })
        .expect(403);

      expect(response.body.message).toBe('Access denied to mark bill as paid');
    });
  });

  describe('GET /api/bills/:id/generated-stats', () => {
    const mockParentBill = {
      id: 'parent-bill-789',
      buildingId: 'building-123',
      title: 'Parent Bill',
      paymentType: 'recurrent',
      schedulePayment: 'monthly',
      totalAmount: '1000.00'
    };

    beforeEach(() => {
      global.mockBills = [mockParentBill];
    });

    it('should return comprehensive statistics for generated bills', async () => {
      const mockStats = {
        totalGenerated: 25,
        paidBills: 8,
        pendingBills: 12,
        futureBills: 5,
        totalAmount: 25000,
        paidAmount: 8000
      };

      mockBillGenerationService.getGeneratedBillsStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/bills/parent-bill-789/generated-stats')
        .expect(200);

      expect(response.body).toEqual({
        parentBill: {
          id: 'parent-bill-789',
          title: 'Parent Bill',
          paymentType: 'recurrent',
          schedulePayment: 'monthly',
          totalAmount: '1000.00'
        },
        generatedBills: mockStats
      });

      expect(mockBillGenerationService.getGeneratedBillsStats).toHaveBeenCalledWith('parent-bill-789');
    });

    it('should handle stats for bills with no generated instances', async () => {
      const emptyStats = {
        totalGenerated: 0,
        paidBills: 0,
        pendingBills: 0,
        futureBills: 0,
        totalAmount: 0,
        paidAmount: 0
      };

      mockBillGenerationService.getGeneratedBillsStats.mockResolvedValue(emptyStats);

      const response = await request(app)
        .get('/api/bills/parent-bill-789/generated-stats')
        .expect(200);

      expect(response.body.generatedBills.totalGenerated).toBe(0);
    });

    it('should handle service errors when fetching stats', async () => {
      mockBillGenerationService.getGeneratedBillsStats.mockRejectedValue(
        new Error('Database query failed')
      );

      const response = await request(app)
        .get('/api/bills/parent-bill-789/generated-stats')
        .expect(500);

      expect(response.body.message).toBe('Failed to get generated bills statistics');
      expect(response.body._error).toBe('Database query failed');
    });

    it('should enforce access control for viewing statistics', async () => {
      // Mock user without access to organization
      mockDb.limit.mockReturnValue([{ organizationId: 'different-org' }]);

      jest.doMock('../../server/auth', () => ({
        requireAuth: (req: unknown, res: unknown, next: unknown) => {
          req.user = { 
            id: 'limited-user', 
            role: 'manager',
            canAccessAllOrganizations: false,
            organizations: ['other-org']
          };
          next();
        }
      }));

      const response = await request(app)
        .get('/api/bills/parent-bill-789/generated-stats')
        .expect(403);

      expect(response.body.message).toBe('Access denied to view bill statistics');
    });
  });

  describe('PUT /api/bills/:id/update-generated', () => {
    const mockParentBill = {
      id: 'parent-update-123',
      buildingId: 'building-123',
      title: 'Original Title'
    };

    beforeEach(() => {
      global.mockBills = [mockParentBill];
    });

    it('should update all generated bills when parent is modified', async () => {
      const updates = {
        title: 'Updated Title',
        category: 'utilities',
        vendor: 'New Vendor Corp'
      };

      mockBillGenerationService.updateGeneratedBillsFromParent.mockResolvedValue({
        billsUpdated: 15
      });

      const response = await request(app)
        .put('/api/bills/parent-update-123/update-generated')
        .send(updates)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Generated bills updated successfully',
        billsUpdated: 15,
        parentBill: 'Original Title',
        updatedFields: ['title', 'category', 'vendor']
      });

      expect(mockBillGenerationService.updateGeneratedBillsFromParent).toHaveBeenCalledWith(
        'parent-update-123',
        updates
      );
    });

    it('should handle partial updates', async () => {
      const partialUpdates = { notes: 'Updated notes only' };

      mockBillGenerationService.updateGeneratedBillsFromParent.mockResolvedValue({
        billsUpdated: 3
      });

      const response = await request(app)
        .put('/api/bills/parent-update-123/update-generated')
        .send(partialUpdates)
        .expect(200);

      expect(response.body.billsUpdated).toBe(3);
      expect(response.body.updatedFields).toEqual(['notes']);
    });

    it('should handle empty updates gracefully', async () => {
      mockBillGenerationService.updateGeneratedBillsFromParent.mockResolvedValue({
        billsUpdated: 0
      });

      const response = await request(app)
        .put('/api/bills/parent-update-123/update-generated')
        .send({})
        .expect(200);

      expect(response.body.billsUpdated).toBe(0);
      expect(response.body.updatedFields).toEqual([]);
    });

    it('should handle update service errors', async () => {
      mockBillGenerationService.updateGeneratedBillsFromParent.mockRejectedValue(
        new Error('Update operation failed')
      );

      const response = await request(app)
        .put('/api/bills/parent-update-123/update-generated')
        .send({ title: 'New Title' })
        .expect(500);

      expect(response.body.message).toBe('Failed to update generated bills');
      expect(response.body._error).toBe('Update operation failed');
    });
  });

  describe('DELETE /api/bills/:id/generated-bills', () => {
    const mockParentBill = {
      id: 'parent-delete-456',
      buildingId: 'building-123',
      title: 'Bill to Delete Generated'
    };

    beforeEach(() => {
      global.mockBills = [mockParentBill];
    });

    it('should delete only unpaid bills by default', async () => {
      mockBillGenerationService.deleteGeneratedBills.mockResolvedValue({
        billsDeleted: 8
      });

      const response = await request(app)
        .delete('/api/bills/parent-delete-456/generated-bills')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Generated bills deleted successfully',
        billsDeleted: 8,
        parentBill: 'Bill to Delete Generated',
        deleteAllFuture: false
      });

      expect(mockBillGenerationService.deleteGeneratedBills).toHaveBeenCalledWith(
        'parent-delete-456',
        false
      );
    });

    it('should delete all future bills when deleteAllFuture=true', async () => {
      mockBillGenerationService.deleteGeneratedBills.mockResolvedValue({
        billsDeleted: 25
      });

      const response = await request(app)
        .delete('/api/bills/parent-delete-456/generated-bills')
        .query({ deleteAllFuture: 'true' })
        .expect(200);

      expect(response.body.billsDeleted).toBe(25);
      expect(response.body.deleteAllFuture).toBe(true);

      expect(mockBillGenerationService.deleteGeneratedBills).toHaveBeenCalledWith(
        'parent-delete-456',
        true
      );
    });

    it('should handle deletion service errors', async () => {
      mockBillGenerationService.deleteGeneratedBills.mockRejectedValue(
        new Error('Deletion failed')
      );

      const response = await request(app)
        .delete('/api/bills/parent-delete-456/generated-bills')
        .expect(500);

      expect(response.body.message).toBe('Failed to delete generated bills');
      expect(response.body._error).toBe('Deletion failed');
    });

    it('should enforce admin/manager permissions for deletion', async () => {
      jest.doMock('../../server/auth', () => ({
        requireAuth: (req: unknown, res: unknown, next: unknown) => {
          req.user = { 
            id: 'resident-user', 
            role: 'resident',
            canAccessAllOrganizations: false,
            organizations: ['test-org-123']
          };
          next();
        }
      }));

      const response = await request(app)
        .delete('/api/bills/parent-delete-456/generated-bills')
        .expect(403);

      expect(response.body.message).toBe('Access denied to delete generated bills');
    });

    it('should handle no bills to delete scenario', async () => {
      mockBillGenerationService.deleteGeneratedBills.mockResolvedValue({
        billsDeleted: 0
      });

      const response = await request(app)
        .delete('/api/bills/parent-delete-456/generated-bills')
        .expect(200);

      expect(response.body.billsDeleted).toBe(0);
      expect(response.body.message).toBe('Generated bills deleted successfully');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing building for bill', async () => {
      global.mockBills = [{
        id: 'orphaned-bill',
        buildingId: 'non-existent-building',
        title: 'Orphaned Bill'
      }];

      mockDb.limit.mockReturnValue([]); // No building found

      const response = await request(app)
        .post('/api/bills/orphaned-bill/generate-future')
        .expect(404);

      expect(response.body.message).toBe('Building not found for this bill');
    });

    it('should handle database connection errors', async () => {
      global.mockBills = [{ id: 'test-bill', buildingId: 'building-123' }];
      
      mockDb.limit.mockRejectedValue(new Error('Database unavailable'));

      const response = await request(app)
        .get('/api/bills/test-bill/generated-stats')
        .expect(500);

      expect(response.body.message).toBe('Failed to get generated bills statistics');
    });

    it('should validate bill ID format', async () => {
      const response = await request(app)
        .post('/api/bills/invalid-id-format/generate-future')
        .expect(404);

      expect(response.body.message).toBe('Bill not found');
    });

    it('should handle concurrent requests gracefully', async () => {
      global.mockBills = [{
        id: 'concurrent-bill',
        buildingId: 'building-123',
        paymentType: 'recurrent'
      }];

      mockBillGenerationService.generateFutureBillInstances.mockResolvedValue({
        billsCreated: 100,
        generatedUntil: '2049-01-01'
      });

      // Make concurrent requests
      const [response1, response2] = await Promise.all([
        request(app).post('/api/bills/concurrent-bill/generate-future'),
        request(app).post('/api/bills/concurrent-bill/generate-future')
      ]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(mockBillGenerationService.generateFutureBillInstances).toHaveBeenCalledTimes(2);
    });

    it('should handle large response data efficiently', async () => {
      const largeStats = {
        totalGenerated: 10000,
        paidBills: 3000,
        pendingBills: 5000,
        futureBills: 2000,
        totalAmount: 10000000,
        paidAmount: 3000000
      };

      mockBillGenerationService.getGeneratedBillsStats.mockResolvedValue(largeStats);

      global.mockBills = [{
        id: 'large-data-bill',
        buildingId: 'building-123',
        title: 'Large Dataset Bill'
      }];

      const response = await request(app)
        .get('/api/bills/large-data-bill/generated-stats')
        .expect(200);

      expect(response.body.generatedBills.totalGenerated).toBe(10000);
      expect(response.headers['content-type']).toMatch(/json/);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle bills with large number of generated instances', async () => {
      mockBillGenerationService.generateFutureBillInstances.mockImplementation(
        () => new Promise(resolve => {
          // Simulate processing time for large dataset
          setTimeout(() => {
            resolve({ billsCreated: 5000, generatedUntil: '2049-01-01' });
          }, 10);
        })
      );

      global.mockBills = [{
        id: 'large-bill',
        buildingId: 'building-123',
        paymentType: 'recurrent',
        schedulePayment: 'weekly'
      }];

      const start = Date.now();
      const response = await request(app)
        .post('/api/bills/large-bill/generate-future')
        .expect(200);
      const duration = Date.now() - start;

      expect(response.body.billsCreated).toBe(5000);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle memory efficiently for bulk operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      mockBillGenerationService.updateGeneratedBillsFromParent.mockResolvedValue({
        billsUpdated: 1000
      });

      global.mockBills = [{
        id: 'bulk-update-bill',
        buildingId: 'building-123',
        title: 'Bulk Update Test'
      }];

      await request(app)
        .put('/api/bills/bulk-update-bill/update-generated')
        .send({ title: 'Updated in Bulk' })
        .expect(200);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});