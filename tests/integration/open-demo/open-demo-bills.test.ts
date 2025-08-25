import request from 'supertest';
import express from 'express';
import { sessionConfig, setupAuthRoutes } from '../../../server/auth';
import { registerBillRoutes } from '../../../server/api/bills';
import budgetRoutes from '../../../server/api/budgets';
import { storage } from '../../../server/storage';
import { canUserPerformWriteOperation } from '../../../server/rbac';

// Mock dependencies
jest.mock('../../../server/storage');
jest.mock('../../../server/rbac');

const mockStorage = storage as jest.Mocked<typeof storage>;
const mockCanUserPerformWriteOperation = canUserPerformWriteOperation as jest.MockedFunction<
  typeof canUserPerformWriteOperation
>;

describe('Open Demo Bill and Budget Management Restrictions', () => {
  let app: express.Application;
  let agent: any;

  const openDemoManager = {
    id: 'open-demo-manager-id',
    email: 'demo.manager.open@example.com',
    password: 'Demo@123456',
    role: 'manager',
    isActive: true,
    firstName: 'Demo',
    lastName: 'Manager',
    organizations: ['open-demo-org-id'],
  };

  const openDemoTenant = {
    id: 'open-demo-tenant-id',
    email: 'demo.tenant.open@example.com',
    password: 'Demo@123456',
    role: 'tenant',
    isActive: true,
    firstName: 'Demo',
    lastName: 'Tenant',
    organizations: ['open-demo-org-id'],
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(sessionConfig);

    setupAuthRoutes(app as any);
    registerBillRoutes(app as any);
    app.use('/api/budgets', budgetRoutes);

    agent = request.agent(app);
    jest.clearAllMocks();

    // Mock RBAC to restrict Open Demo users
    mockCanUserPerformWriteOperation.mockImplementation(async (userId: string) => {
      return !['open-demo-manager-id', 'open-demo-tenant-id', 'open-demo-resident-id'].includes(
        userId
      );
    });

    mockStorage.getUser.mockImplementation(async (userId: string) => {
      switch (userId) {
        case 'open-demo-manager-id':
          return openDemoManager;
        case 'open-demo-tenant-id':
          return openDemoTenant;
        default:
          return null;
      }
    });
  });

  describe('Bill Creation Restrictions', () => {
    test('should prevent Open Demo manager from creating bills', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);

      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent.post('/api/bills').send({
        residenceId: 'residence-123',
        type: 'monthly_fees',
        amount: 150.0,
        dueDate: '2025-09-01',
        description: 'Monthly maintenance fees',
      });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent Open Demo tenant from creating bills', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoTenant);
      mockStorage.updateUser.mockResolvedValue(openDemoTenant);

      await agent.post('/api/auth/login').send({
        email: 'demo.tenant.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent.post('/api/bills').send({
        residenceId: 'residence-456',
        type: 'utility',
        amount: 85.5,
        dueDate: '2025-09-15',
      });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });
  });

  describe('Bill Modification Restrictions', () => {
    test('should prevent Open Demo users from updating bill amounts', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);

      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent.patch('/api/bills/bill-123').send({
        amount: 200.0,
        description: 'Updated amount',
      });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent Open Demo users from updating bill status', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoTenant);
      mockStorage.updateUser.mockResolvedValue(openDemoTenant);

      await agent.post('/api/auth/login').send({
        email: 'demo.tenant.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent.patch('/api/bills/bill-123').send({
        status: 'paid',
        paidAt: new Date().toISOString(),
      });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent Open Demo users from deleting bills', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);

      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent.delete('/api/bills/bill-123');

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });
  });

  describe('Payment Processing Restrictions', () => {
    test('should prevent Open Demo users from processing payments', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoTenant);
      mockStorage.updateUser.mockResolvedValue(openDemoTenant);

      await agent.post('/api/auth/login').send({
        email: 'demo.tenant.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent.post('/api/bills/bill-123/payment').send({
        amount: 150.0,
        paymentMethod: 'credit_card',
        transactionId: 'txn-12345',
      });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(
        /view.*only|read.*only|demo.*restriction|payment.*not.*allowed/i
      );
    });

    test('should prevent Open Demo users from issuing refunds', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);

      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent.post('/api/bills/bill-123/refund').send({
        amount: 75.0,
        reason: 'Billing error',
      });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });
  });

  describe('Budget Management Restrictions', () => {
    test('should prevent Open Demo manager from creating budgets', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);

      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent.post('/api/budgets').send({
        buildingId: 'building-123',
        year: 2025,
        categories: [
          {
            name: 'Maintenance',
            plannedAmount: 15000,
            description: 'Building maintenance costs',
          },
        ],
      });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent Open Demo users from updating budget allocations', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);

      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent.patch('/api/budgets/budget-123').send({
        categories: [
          {
            name: 'Utilities',
            plannedAmount: 12000,
          },
        ],
      });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent Open Demo users from approving budgets', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);

      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent.post('/api/budgets/budget-123/approve').send();

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });
  });

  describe('Bill Generation Restrictions', () => {
    test('should prevent Open Demo users from generating recurring bills', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);

      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent.post('/api/bills/generate-recurring').send({
        buildingId: 'building-123',
        type: 'monthly_fees',
        month: '2025-09',
      });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent Open Demo users from bulk bill generation', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);

      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent.post('/api/bills/bulk-generate').send({
        residenceIds: ['residence-123', 'residence-456'],
        type: 'special_assessment',
        amount: 500.0,
        dueDate: '2025-10-01',
      });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });
  });

  describe('Financial Reporting Restrictions', () => {
    test('should prevent Open Demo users from generating financial reports', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);

      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent.post('/api/bills/reports/generate').send({
        reportType: 'monthly_summary',
        buildingId: 'building-123',
        period: '2025-08',
      });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });
  });

  describe('Read Access for Bills and Budgets', () => {
    test('should allow Open Demo users to view bills', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoTenant);
      mockStorage.updateUser.mockResolvedValue(openDemoTenant);

      await agent.post('/api/auth/login').send({
        email: 'demo.tenant.open@example.com',
        password: 'Demo@123456',
      });

      mockStorage.getBills = jest.fn().mockResolvedValue([
        {
          id: 'bill-123',
          residenceId: 'residence-456',
          amount: 150.0,
          type: 'monthly_fees',
          status: 'sent',
          dueDate: new Date('2025-09-01'),
        },
      ]);

      const response = await agent.get('/api/bills');

      expect(response.status).toBe(200);
    });

    test('should allow Open Demo users to view budgets', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);

      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456',
      });

      mockStorage.getBudgets = jest.fn().mockResolvedValue([
        {
          id: 'budget-123',
          buildingId: 'building-123',
          year: 2025,
          totalPlanned: 50000,
          totalSpent: 25000,
          status: 'approved',
        },
      ]);

      const response = await agent.get('/api/budgets');

      expect(response.status).toBe(200);
    });

    test('should allow Open Demo users to download bill statements', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoTenant);
      mockStorage.updateUser.mockResolvedValue(openDemoTenant);

      await agent.post('/api/auth/login').send({
        email: 'demo.tenant.open@example.com',
        password: 'Demo@123456',
      });

      mockStorage.getBill = jest.fn().mockResolvedValue({
        id: 'bill-123',
        residenceId: 'residence-456',
        amount: 150.0,
        type: 'monthly_fees',
      });

      const response = await agent.get('/api/bills/bill-123/statement');

      // Should allow downloading (read operation)
      expect(response.status).not.toBe(403);
    });
  });
});
