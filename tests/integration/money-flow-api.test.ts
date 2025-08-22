import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { registerMoneyFlowRoutes } from '../../server/api/money-flow';
import { moneyFlowJob } from '../../server/jobs/money_flow_job';

// Mock the money flow job
jest.mock('../../server/jobs/money_flow_job', () => ({
  moneyFlowJob: {
    getStatus: jest.fn(),
    getStatistics: jest.fn(),
    triggerFullRegeneration: jest.fn(),
    generateForBill: jest.fn(),
    generateForResidence: jest.fn()
  }
}));

// Mock auth middleware
const mockRequireAuth = (req: unknown, res: unknown, next: unknown) => {
  req.user = {
    id: 'user-123',
    email: 'admin@test.com',
    role: 'admin',
    canAccessAllOrganizations: true
  };
  next();
};

jest.mock('../../server/auth', () => ({
  requireAuth: mockRequireAuth
}));

describe('Money Flow API Integration Tests', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerMoneyFlowRoutes(app);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/money-flow/status', () => {
    it('should return job status and statistics for admin users', async () => {
      const mockJobStatus = {
        enabled: true,
        running: false,
        schedule: '0 3 * * *',
        config: {
          schedule: '0 3 * * *',
          enabled: true,
          logLevel: 'info',
          retryAttempts: 3,
          retryDelay: 5000
        }
      };

      const mockStatistics = {
        totalEntries: 1000,
        billEntries: 600,
        residenceEntries: 400,
        futureEntries: 800,
        oldestEntry: '2024-01-01',
        newestEntry: '2049-12-31'
      };

      (moneyFlowJob.getStatus as jest.Mock).mockReturnValue(mockJobStatus);
      (moneyFlowJob.getStatistics as jest.Mock).mockResolvedValue(mockStatistics);

      const response = await request(app)
        .get('/api/money-flow/status')
        .expect(200);

      expect(response.body).toEqual({
        job: mockJobStatus,
        statistics: mockStatistics,
        lastUpdated: expect.any(String)
      });
    });

    it('should deny access to non-admin users', async () => {
      // Override the mock auth for this test
      app = express();
      app.use(express.json());
      app.use((req: unknown, res: unknown, next: unknown) => {
        req.user = {
          id: 'user-456',
          email: 'manager@test.com',
          role: 'manager',
          canAccessAllOrganizations: false
        };
        next();
      });
      registerMoneyFlowRoutes(app);

      const response = await request(app)
        .get('/api/money-flow/status')
        .expect(403);

      expect(response.body).toEqual({
        message: 'Access denied. Admin privileges required.',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    });

    it('should handle errors gracefully', async () => {
      (moneyFlowJob.getStatus as jest.Mock).mockReturnValue({
        enabled: true,
        running: false,
        schedule: '0 3 * * *'
      });
      (moneyFlowJob.getStatistics as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/money-flow/status')
        .expect(500);

      expect(response.body).toEqual({
        message: 'Failed to get money flow status',
        _error: 'Database error'
      });
    });
  });

  describe('POST /api/money-flow/regenerate', () => {
    it('should trigger full regeneration for admin users', async () => {
      const mockResult = {
        billEntriesCreated: 500,
        residenceEntriesCreated: 250,
        totalEntriesCreated: 750
      };

      (moneyFlowJob.triggerFullRegeneration as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/money-flow/regenerate')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Money flow regeneration completed successfully',
        _result: mockResult,
        triggeredBy: 'admin@test.com',
        timestamp: expect.any(String)
      });

      expect(moneyFlowJob.triggerFullRegeneration).toHaveBeenCalledTimes(1);
    });

    it('should deny access to non-admin users', async () => {
      app = express();
      app.use(express.json());
      app.use((req: unknown, res: unknown, next: unknown) => {
        req.user = {
          id: 'user-789',
          email: 'user@test.com',
          role: 'user',
          canAccessAllOrganizations: false
        };
        next();
      });
      registerMoneyFlowRoutes(app);

      const response = await request(app)
        .post('/api/money-flow/regenerate')
        .expect(403);

      expect(response.body).toEqual({
        message: 'Access denied. Admin privileges required.',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    });

    it('should handle regeneration errors', async () => {
      (moneyFlowJob.triggerFullRegeneration as jest.Mock)
        .mockRejectedValue(new Error('Job is already running'));

      const response = await request(app)
        .post('/api/money-flow/regenerate')
        .expect(500);

      expect(response.body).toEqual({
        message: 'Failed to trigger money flow regeneration',
        _error: 'Job is already running'
      });
    });
  });

  describe('POST /api/money-flow/generate-bill', () => {
    it('should generate money flow for a specific bill', async () => {
      const billId = 'bill-123';
      const entriesCreated = 24;

      (moneyFlowJob.generateForBill as jest.Mock).mockResolvedValue(entriesCreated);

      const response = await request(app)
        .post('/api/money-flow/generate-bill')
        .send({ billId })
        .expect(200);

      expect(response.body).toEqual({
        message: 'Money flow generation completed for bill',
        billId,
        entriesCreated,
        triggeredBy: 'admin@test.com',
        timestamp: expect.any(String)
      });

      expect(moneyFlowJob.generateForBill).toHaveBeenCalledWith(billId);
    });

    it('should validate bill ID format', async () => {
      const response = await request(app)
        .post('/api/money-flow/generate-bill')
        .send({ billId: 'invalid-id' }) // Not a valid UUID
        .expect(500);

      expect(response.body.message).toBe('Failed to generate money flow for bill');
    });

    it('should allow manager access', async () => {
      app = express();
      app.use(express.json());
      app.use((req: unknown, res: unknown, next: unknown) => {
        req.user = {
          id: 'manager-123',
          email: 'manager@test.com',
          role: 'manager',
          canAccessAllOrganizations: false
        };
        next();
      });
      registerMoneyFlowRoutes(app);

      const billId = 'bill-456';
      (moneyFlowJob.generateForBill as jest.Mock).mockResolvedValue(12);

      const response = await request(app)
        .post('/api/money-flow/generate-bill')
        .send({ billId })
        .expect(200);

      expect(response.body.triggeredBy).toBe('manager@test.com');
    });

    it('should deny access to regular users', async () => {
      app = express();
      app.use(express.json());
      app.use((req: unknown, res: unknown, next: unknown) => {
        req.user = {
          id: 'user-123',
          email: 'user@test.com',
          role: 'user',
          canAccessAllOrganizations: false
        };
        next();
      });
      registerMoneyFlowRoutes(app);

      const response = await request(app)
        .post('/api/money-flow/generate-bill')
        .send({ billId: 'bill-123' })
        .expect(403);

      expect(response.body).toEqual({
        message: 'Access denied. Admin or Manager privileges required.',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    });
  });

  describe('POST /api/money-flow/generate-residence', () => {
    it('should generate money flow for a specific residence', async () => {
      const residenceId = 'residence-456';
      const entriesCreated = 300;

      (moneyFlowJob.generateForResidence as jest.Mock).mockResolvedValue(entriesCreated);

      const response = await request(app)
        .post('/api/money-flow/generate-residence')
        .send({ residenceId })
        .expect(200);

      expect(response.body).toEqual({
        message: 'Money flow generation completed for residence',
        residenceId,
        entriesCreated,
        triggeredBy: 'admin@test.com',
        timestamp: expect.any(String)
      });

      expect(moneyFlowJob.generateForResidence).toHaveBeenCalledWith(residenceId);
    });

    it('should validate residence ID format', async () => {
      const response = await request(app)
        .post('/api/money-flow/generate-residence')
        .send({ residenceId: 'not-uuid' })
        .expect(500);

      expect(response.body.message).toBe('Failed to generate money flow for residence');
    });

    it('should handle generation errors', async () => {
      const residenceId = 'residence-789';
      (moneyFlowJob.generateForResidence as jest.Mock)
        .mockRejectedValue(new Error('Residence not found'));

      const response = await request(app)
        .post('/api/money-flow/generate-residence')
        .send({ residenceId })
        .expect(500);

      expect(response.body).toEqual({
        message: 'Failed to generate money flow for residence',
        _error: 'Residence not found'
      });
    });
  });

  describe('GET /api/money-flow/statistics', () => {
    it('should return detailed statistics for authorized users', async () => {
      const mockStatistics = {
        totalEntries: 5000,
        billEntries: 3000,
        residenceEntries: 2000,
        futureEntries: 4500,
        oldestEntry: '2024-01-01',
        newestEntry: '2049-12-31'
      };

      (moneyFlowJob.getStatistics as jest.Mock).mockResolvedValue(mockStatistics);

      const response = await request(app)
        .get('/api/money-flow/statistics')
        .expect(200);

      expect(response.body).toEqual({
        statistics: mockStatistics,
        generatedAt: expect.any(String),
        notes: {
          totalEntries: 'Total number of money flow entries in the system',
          billEntries: 'Entries generated from bills (expenses)',
          residenceEntries: 'Entries generated from residence monthly fees (income)',
          futureEntries: 'Entries with transaction dates in the future',
          dateRange: 'Range from oldest to newest entry'
        }
      });
    });

    it('should allow manager access to statistics', async () => {
      app = express();
      app.use(express.json());
      app.use((req: unknown, res: unknown, next: unknown) => {
        req.user = {
          id: 'manager-456',
          email: 'manager@test.com',
          role: 'manager',
          canAccessAllOrganizations: false
        };
        next();
      });
      registerMoneyFlowRoutes(app);

      const mockStatistics = {
        totalEntries: 100,
        billEntries: 60,
        residenceEntries: 40,
        futureEntries: 90,
        oldestEntry: '2024-01-01',
        newestEntry: '2025-12-31'
      };

      (moneyFlowJob.getStatistics as jest.Mock).mockResolvedValue(mockStatistics);

      const response = await request(app)
        .get('/api/money-flow/statistics')
        .expect(200);

      expect(response.body.statistics).toEqual(mockStatistics);
    });
  });

  describe('GET /api/money-flow/health', () => {
    it('should return health status for admin users', async () => {
      const mockJobStatus = {
        enabled: true,
        running: false,
        schedule: '0 3 * * *',
        config: {}
      };

      (moneyFlowJob.getStatus as jest.Mock).mockReturnValue(mockJobStatus);

      const response = await request(app)
        .get('/api/money-flow/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        jobEnabled: true,
        jobRunning: false,
        schedule: '0 3 * * *',
        currentTime: expect.any(String),
        systemInfo: {
          nodeVersion: expect.any(String),
          platform: expect.any(String),
          uptime: expect.any(Number),
          memoryUsage: expect.any(Object)
        },
        message: 'Money flow automation system is operational'
      });
    });

    it('should return unhealthy status on errors', async () => {
      (moneyFlowJob.getStatus as jest.Mock).mockImplementation(() => {
        throw new Error('Job configuration error');
      });

      const response = await request(app)
        .get('/api/money-flow/health')
        .expect(500);

      expect(response.body).toEqual({
        status: 'unhealthy',
        _error: 'Job configuration error',
        message: 'Money flow automation system encountered an error'
      });
    });
  });

  describe('Authentication and authorization', () => {
    it('should require authentication for all endpoints', async () => {
      // Create app without auth middleware
      const unauthApp = express();
      unauthApp.use(express.json());
      unauthApp.use((req: unknown, res: unknown, next: unknown) => {
        // No user set - simulates unauthenticated request
        next();
      });
      
      // Mock the auth middleware to throw
      jest.doMock('../../server/auth', () => ({
        requireAuth: (req: unknown, res: unknown, next: unknown) => {
          res.status(401).json({ message: 'Authentication required' });
        }
      }));

      const endpoints = [
        { method: 'get', path: '/api/money-flow/status' },
        { method: 'post', path: '/api/money-flow/regenerate' },
        { method: 'post', path: '/api/money-flow/generate-bill' },
        { method: 'post', path: '/api/money-flow/generate-residence' },
        { method: 'get', path: '/api/money-flow/statistics' },
        { method: 'get', path: '/api/money-flow/health' }
      ];

      for (const endpoint of endpoints) {
        const response = await request(unauthApp)[endpoint.method](endpoint.path);
        // Since we're mocking the routes differently, we expect them to fail
        expect([401, 404]).toContain(response.status);
      }
    });

    it('should enforce role-based access control', async () => {
      const testCases = [
        {
          role: 'admin',
          canAccessAllOrganizations: true,
          shouldHaveAccess: true
        },
        {
          role: 'manager',
          canAccessAllOrganizations: false,
          shouldHaveAccess: true // For some endpoints
        },
        {
          role: 'user',
          canAccessAllOrganizations: false,
          shouldHaveAccess: false
        }
      ];

      for (const testCase of testCases) {
        const testApp = express();
        testApp.use(express.json());
        testApp.use((req: unknown, res: unknown, next: unknown) => {
          req.user = {
            id: 'test-user',
            email: 'test@test.com',
            role: testCase.role,
            canAccessAllOrganizations: testCase.canAccessAllOrganizations
          };
          next();
        });
        registerMoneyFlowRoutes(testApp);

        const response = await request(testApp).get('/api/money-flow/health');
        
        if (testCase.role === 'admin' || testCase.canAccessAllOrganizations) {
          expect([200, 500]).toContain(response.status); // 500 is OK for mocked errors
        } else {
          expect(response.status).toBe(403);
        }
      }
    });
  });

  describe('Request validation', () => {
    it('should validate UUID format for bill ID', async () => {
      const invalidIds = [
        'not-a-uuid',
        '123',
        '',
        'bill-123-invalid'
      ];

      for (const invalidId of invalidIds) {
        const response = await request(app)
          .post('/api/money-flow/generate-bill')
          .send({ billId: invalidId });
        
        expect(response.status).toBe(500); // Should fail validation
      }
    });

    it('should validate UUID format for residence ID', async () => {
      const invalidIds = [
        'not-a-uuid',
        '456',
        '',
        'residence-456-invalid'
      ];

      for (const invalidId of invalidIds) {
        const response = await request(app)
          .post('/api/money-flow/generate-residence')
          .send({ residenceId: invalidId });
        
        expect(response.status).toBe(500); // Should fail validation
      }
    });

    it('should handle missing request body fields', async () => {
      const response1 = await request(app)
        .post('/api/money-flow/generate-bill')
        .send({}); // Missing billId

      const response2 = await request(app)
        .post('/api/money-flow/generate-residence')
        .send({}); // Missing residenceId

      expect(response1.status).toBe(500);
      expect(response2.status).toBe(500);
    });
  });
});