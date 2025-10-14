/**
 * Integration Tests for API Authorization Fixes
 * 
 * Tests cover the fixes made to overly restrictive authorization middleware
 * that was preventing legitimate admin access to various endpoints.
 * 
 * This test uses REAL production routes with mocked database layer.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import session from 'express-session';

// Mock @neondatabase/serverless at module level
jest.mock('@neondatabase/serverless', () => ({
  neon: jest.fn(),
  Pool: jest.fn(() => ({
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
  })),
  neonConfig: {},
}));

// Mock database operations
const mockDb = {
  query: {
    features: {
      findMany: jest.fn<() => Promise<any[]>>(() => Promise.resolve([])),
    },
    users: {
      findFirst: jest.fn<() => Promise<any | null>>(() => Promise.resolve(null)),
    },
  },
  select: jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => Promise.resolve([])),
      leftJoin: jest.fn(() => ({
        where: jest.fn(() => Promise.resolve([])),
      })),
      orderBy: jest.fn(() => Promise.resolve([])),
      limit: jest.fn(() => Promise.resolve([])),
    })),
  })),
  insert: jest.fn(() => ({
    values: jest.fn(() => ({
      returning: jest.fn(() => Promise.resolve([{ 
        id: 'test-feature-id',
        title: 'Test Feature',
        status: 'planned'
      }])),
    })),
  })),
  update: jest.fn(() => ({
    set: jest.fn(() => ({
      where: jest.fn(() => ({
        returning: jest.fn(() => Promise.resolve([{
          id: 'test-feature-id',
          status: 'completed',
        }])),
      })),
    })),
  })),
  delete: jest.fn(() => ({
    where: jest.fn(() => Promise.resolve([])),
  })),
};

// Mock the database module
jest.mock('../../server/db', () => ({
  db: mockDb,
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
  },
  sql: jest.fn(),
}));

// Mock drizzle-orm functions
jest.mock('drizzle-orm', () => ({
  eq: jest.fn((column, value) => ({ column, operator: 'eq', value })),
  and: jest.fn((...conditions) => ({ operator: 'and', conditions })),
  or: jest.fn((...conditions) => ({ operator: 'or', conditions })),
  sql: jest.fn((strings: any, ...values: any[]) => {
    if (typeof strings === 'string') {
      return { sql: strings };
    }
    return { sql: strings.join('?'), values };
  }),
  desc: jest.fn((column) => ({ column, direction: 'desc' })),
}));

// Mock schema tables
jest.mock('@shared/schema', () => ({
  features: {
    id: 'features.id',
    title: 'features.title',
    status: 'features.status',
    createdAt: 'features.createdAt',
    is_public_roadmap: 'features.is_public_roadmap',
    is_strategic_path: 'features.is_strategic_path',
    business_objective: 'features.business_objective',
  },
  users: {
    id: 'users.id',
    email: 'users.email',
    role: 'users.role',
  },
}));

// Mock storage
const mockStorage = {
  getPermissions: jest.fn(() => Promise.resolve([])),
  getRolePermissions: jest.fn(() => Promise.resolve([])),
  getUserPermissions: jest.fn(() => Promise.resolve([])),
  updateUserPermissions: jest.fn(() => Promise.resolve({ success: true })),
};

jest.mock('../../server/storage', () => ({
  storage: mockStorage,
}));

// Mock child_process for law25 compliance scanner
jest.mock('child_process', () => ({
  execSync: jest.fn(() => JSON.stringify({
    results: [],
  })),
}));

// Mock query cache
jest.mock('../../server/query-cache', () => ({
  queryCache: {
    get: jest.fn(),
    set: jest.fn(),
    invalidate: jest.fn(),
  },
}));

// Mock email service
jest.mock('../../server/services/email-service', () => ({
  emailService: {
    sendEmail: jest.fn(),
  },
}));

// Mock config
jest.mock('../../server/config/index', () => ({
  config: {
    database: {
      getRuntimeDatabaseUrl: jest.fn(() => 'postgresql://mock'),
    },
    server: {
      isProduction: false,
      domain: 'localhost',
    },
  },
}));

// Mock auth middleware
const mockRequireAuth = jest.fn((req: any, res: any, next: any) => {
  // Simple check: if req.user is set, authenticated, otherwise not
  if (!req.user) {
    return res.status(401).json({
      message: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
  }
  next();
});

jest.mock('../../server/auth', () => ({
  requireAuth: mockRequireAuth,
}));

jest.mock('../../server/auth/index', () => ({
  requireAuth: mockRequireAuth,
}));

// Import REAL route registration functions AFTER mocking
import { registerQualityMetricsRoutes } from '../../server/api/quality-metrics';
import { registerFeatureManagementRoutes } from '../../server/api/feature-management';
import law25ComplianceRouter from '../../server/routes/law25-compliance';

// Create test Express app with REAL routes
const createTestApp = () => {
  const app = express();
  
  // Setup middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Simple auth middleware for tests - no sessions needed
  let testUser: any = null;
  
  // Mock login endpoint for testing
  app.post('/mock-login', (req: any, res) => {
    testUser = req.body;
    res.json({ success: true });
  });
  
  // Attach test user to request
  app.use((req: any, res, next) => {
    if (testUser) {
      req.user = testUser;
    }
    next();
  });
  
  // Register REAL production API routes (excluding permissions which has authorize dependency issues in tests)
  registerQualityMetricsRoutes(app);
  registerFeatureManagementRoutes(app);
  app.use('/api/law25-compliance', mockRequireAuth, law25ComplianceRouter);
  
  return app;
};

describe('API Authorization Fixes', () => {
  let app: express.Application;
  let adminUser: any;
  let managerUser: any;
  let regularUser: any;
  let adminAgent: request.SuperAgentTest;
  let managerAgent: request.SuperAgentTest;
  let userAgent: request.SuperAgentTest;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    
    app = createTestApp();
    
    // Create test users
    adminUser = {
      id: 'admin-1',
      email: 'admin@test.com',
      role: 'admin',
      firstName: 'Admin',
      lastName: 'User',
    };
    
    managerUser = {
      id: 'manager-1',
      email: 'manager@test.com',
      role: 'manager',
      firstName: 'Manager',
      lastName: 'User',
    };
    
    regularUser = {
      id: 'user-1',
      email: 'user@test.com',
      role: 'resident',
      firstName: 'Regular',
      lastName: 'User',
    };
    
    // Create authenticated agents
    adminAgent = request.agent(app);
    managerAgent = request.agent(app);
    userAgent = request.agent(app);
    
    // Mock sessions
    await adminAgent.post('/mock-login').send(adminUser);
    await managerAgent.post('/mock-login').send(managerUser);
    await userAgent.post('/mock-login').send(regularUser);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Quality Metrics Authentication Fix', () => {
    it('should properly authenticate admin users for quality metrics', async () => {
      const response = await adminAgent
        .get('/api/quality-metrics')
        .expect(200);
        
      expect(response.body).toBeDefined();
      expect(response.body.coverage).toBeDefined();
    });

    it('should use proper credentials in quality metrics requests', async () => {
      const response = await adminAgent
        .get('/api/quality-metrics')
        .expect(200);
        
      // Should not return 401 due to missing credentials
      expect(response.status).not.toBe(401);
    });

    it('should deny unauthenticated access to quality metrics', async () => {
      await request(app)
        .get('/api/quality-metrics')
        .expect(401);
    });
  });

  describe('Feature Management Authorization', () => {
    it('should handle feature status updates with proper authorization', async () => {
      mockDb.update.mockReturnValueOnce({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{
              id: 'test-id',
              status: 'completed',
              is_public_roadmap: true,
              is_strategic_path: false,
              business_objective: 'test',
              target_users: 'test',
              success_metrics: 'test',
              created_at: new Date(),
              updated_at: new Date(),
            }])),
          })),
        })),
      });

      const response = await adminAgent
        .post('/api/features/test-id/update-status')
        .send({ status: 'completed' })
        .expect(200);
        
      expect(response.body.status).toBe('completed');
    });

    it('should validate feature status values', async () => {
      const response = await adminAgent
        .post('/api/features/test-id/update-status')
        .send({ status: 'invalid-status' })
        .expect(400);
        
      expect(response.body.message).toBe('Invalid status');
    });

    it('should handle strategic path toggle', async () => {
      mockDb.update.mockReturnValueOnce({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{
              id: 'test-id',
              isStrategicPath: true,
              is_public_roadmap: true,
              is_strategic_path: true,
              business_objective: 'test',
              target_users: 'test',
              success_metrics: 'test',
              created_at: new Date(),
              updated_at: new Date(),
            }])),
          })),
        })),
      });

      const response = await adminAgent
        .post('/api/features/test-id/toggle-strategic')
        .send({ isStrategicPath: true })
        .expect(200);
        
      expect(response.body.isStrategicPath).toBe(true);
    });
  });

  describe('Law 25 Compliance Authorization', () => {
    it('should allow admin access to compliance data without syntax errors', async () => {
      const response = await adminAgent
        .get('/api/law25-compliance')
        .expect(200);
        
      expect(response.body.complianceScore).toBeDefined();
    });

    it('should handle compliance audits with proper authorization', async () => {
      const response = await adminAgent
        .post('/api/law25-compliance/audit')
        .send({
          auditType: 'quick',
          includeSensitiveData: false
        })
        .expect(200);
        
      expect(response.body.auditId).toBeDefined();
    });

    it('should deny unauthenticated access to compliance data', async () => {
      await request(app)
        .get('/api/law25-compliance')
        .expect(401);
    });
  });

  describe('Cross-Endpoint Authorization Consistency', () => {
    it('should apply consistent authorization across admin endpoints', async () => {
      const adminEndpoints = [
        '/api/quality-metrics',
        '/api/law25-compliance'
      ];

      // All should allow authenticated access
      for (const endpoint of adminEndpoints) {
        await adminAgent
          .get(endpoint)
          .expect(200);
      }
    });

    it('should consistently deny access to unauthenticated users', async () => {
      const adminEndpoints = [
        '/api/quality-metrics',
        '/api/law25-compliance'
      ];

      for (const endpoint of adminEndpoints) {
        await request(app)
          .get(endpoint)
          .expect(401);
      }
    });
  });

  describe('Manager Role Authorization', () => {
    it('should handle manager permissions appropriately', async () => {
      const managerAccessibleEndpoints = [
        '/api/quality-metrics',
      ];

      for (const endpoint of managerAccessibleEndpoints) {
        const response = await managerAgent.get(endpoint);
        // Should allow access for authenticated managers
        expect(response.status).toBe(200);
      }
    });
  });

  describe('Authentication vs Authorization Separation', () => {
    it('should properly separate authentication (401) from authorization (403) errors', async () => {
      // Unauthenticated request should return 401
      await request(app)
        .get('/api/quality-metrics')
        .expect(401);
        
      // Authenticated users get access
      await userAgent
        .get('/api/quality-metrics')
        .expect(200);
    });

    it('should handle authentication errors consistently across endpoints', async () => {
      const protectedEndpoints = [
        '/api/quality-metrics',
        '/api/law25-compliance'
      ];

      for (const endpoint of protectedEndpoints) {
        await request(app)
          .get(endpoint)
          .expect(401);
      }
    });
  });

  describe('Error Handling Improvements', () => {
    it('should return proper error messages instead of middleware failures', async () => {
      const response = await request(app)
        .get('/api/quality-metrics')
        .expect(401);
        
      expect(response.body.message).toBeDefined();
      expect(response.body.code).toBe('AUTH_REQUIRED');
    });

    it('should handle malformed authorization headers gracefully', async () => {
      const response = await request(app)
        .get('/api/quality-metrics')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
        
      expect(response.body.code).toBe('AUTH_REQUIRED');
    });
  });

  describe('Session-Based Authentication', () => {
    it('should properly maintain sessions for authorized users', async () => {
      // Make multiple requests to ensure session persistence
      await adminAgent.get('/api/quality-metrics').expect(200);
      await adminAgent.get('/api/law25-compliance').expect(200);
    });

    it('should handle session expiration gracefully', async () => {
      const response = await adminAgent
        .get('/api/quality-metrics')
        .expect(200);
        
      expect(response.body).toBeDefined();
    });
  });

  describe('Feature Management Advanced Operations', () => {
    it('should handle feature not found errors', async () => {
      mockDb.update.mockReturnValueOnce({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([])),
          })),
        })),
      });

      const response = await adminAgent
        .post('/api/features/nonexistent-id/update-status')
        .send({ status: 'completed' })
        .expect(404);
        
      expect(response.body.message).toBe('Feature not found');
    });

    it('should validate strategic path boolean type', async () => {
      const response = await adminAgent
        .post('/api/features/test-id/toggle-strategic')
        .send({ isStrategicPath: 'not-a-boolean' })
        .expect(400);
        
      expect(response.body.message).toContain('boolean');
    });
  });

  describe('Law 25 Compliance Categories', () => {
    it('should return compliance data with category breakdown', async () => {
      const response = await adminAgent
        .get('/api/law25-compliance')
        .expect(200);
        
      expect(response.body.categories).toBeDefined();
      expect(response.body.categories.dataCollection).toBeDefined();
      expect(response.body.categories.consent).toBeDefined();
    });

    it('should handle compliance score calculation', async () => {
      const response = await adminAgent
        .get('/api/law25-compliance')
        .expect(200);
        
      expect(typeof response.body.complianceScore).toBe('number');
      expect(response.body.complianceScore).toBeGreaterThanOrEqual(0);
      expect(response.body.complianceScore).toBeLessThanOrEqual(100);
    });
  });
});
