/**
 * Integration Tests for API Authorization Fixes
 * 
 * Tests cover the fixes made to overly restrictive authorization middleware
 * that was preventing legitimate admin access to various endpoints.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import { registerApiRoutes } from '../../server/routes';
import { MemStorage } from '../../server/storage';
import { createTestUser } from '../utils/test-utils';

// Mock storage
const mockStorage = new MemStorage();

// Create test Express app
const createTestApp = () => {
  const app = express();
  
  // Setup middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Session middleware for authentication
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
    })
  );
  
  // Mock auth middleware
  app.use((req: any, res, next) => {
    if (req.session?.user) {
      req.user = req.session.user;
    }
    next();
  });
  
  // Register API routes
  registerApiRoutes(app);
  
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
    app = createTestApp();
    
    // Create test users
    adminUser = await createTestUser({
      email: 'admin@test.com',
      role: 'admin',
      firstName: 'Admin',
      lastName: 'User'
    });
    
    managerUser = await createTestUser({
      email: 'manager@test.com',
      role: 'manager',
      firstName: 'Manager',
      lastName: 'User'
    });
    
    regularUser = await createTestUser({
      email: 'user@test.com',
      role: 'resident',
      firstName: 'Regular',
      lastName: 'User'
    });
    
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

  describe('Admin Permissions Endpoint Fix', () => {
    it('should allow admin access to permissions endpoint without overly restrictive middleware', async () => {
      // This was the main fix - removing overly restrictive authorization
      const response = await adminAgent
        .get('/api/permissions')
        .expect(200);
        
      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should still properly deny access to non-admin users', async () => {
      await userAgent
        .get('/api/permissions')
        .expect(403);
    });

    it('should allow permissions modifications by admin', async () => {
      const permissionUpdate = {
        userId: regularUser.id,
        permissions: ['read_documents'],
        role: 'resident'
      };

      const response = await adminAgent
        .patch('/api/permissions/user')
        .send(permissionUpdate)
        .expect(200);
        
      expect(response.body.success).toBe(true);
    });
  });

  describe('Quality Metrics Authentication Fix', () => {
    it('should properly authenticate admin users for quality metrics', async () => {
      // This was fixed - authentication issues in quality-metrics component
      const response = await adminAgent
        .get('/api/quality-metrics')
        .expect(200);
        
      expect(response.body).toBeDefined();
      expect(response.body.metrics).toBeDefined();
    });

    it('should use proper credentials in quality metrics requests', async () => {
      // Verify the fix for authentication issues
      const response = await adminAgent
        .get('/api/quality-metrics')
        .expect(200);
        
      // Should not return 401 due to missing credentials
      expect(response.status).not.toBe(401);
    });
  });

  describe('Feature Management Authorization', () => {
    it('should allow admin access to feature management without syntax errors', async () => {
      const response = await adminAgent
        .get('/api/feature-management/features')
        .expect(200);
        
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should handle feature operations with proper authorization', async () => {
      const newFeature = {
        title: 'Authorization Test Feature',
        description: 'Testing authorization fixes',
        category: 'enhancement',
        priority: 'medium',
        estimatedEffort: 3,
        targetQuarter: 'Q1 2025',
        status: 'planned'
      };

      const response = await adminAgent
        .post('/api/feature-management/features')
        .send(newFeature)
        .expect(201);
        
      expect(response.body.title).toBe(newFeature.title);
    });
  });

  describe('Law 25 Compliance Authorization', () => {
    it('should allow admin access to compliance data without syntax errors', async () => {
      const response = await adminAgent
        .get('/api/law25-compliance')
        .expect(200);
        
      expect(response.body.overallStatus).toBeDefined();
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
  });

  describe('Cross-Endpoint Authorization Consistency', () => {
    it('should apply consistent authorization across admin endpoints', async () => {
      const adminEndpoints = [
        '/api/permissions',
        '/api/quality-metrics',
        '/api/feature-management/features',
        '/api/law25-compliance'
      ];

      // All should allow admin access
      for (const endpoint of adminEndpoints) {
        await adminAgent
          .get(endpoint)
          .expect(200);
      }
    });

    it('should consistently deny access to unauthorized users', async () => {
      const adminEndpoints = [
        '/api/permissions',
        '/api/quality-metrics',
        '/api/feature-management/features',
        '/api/law25-compliance'
      ];

      // All should deny regular user access
      for (const endpoint of adminEndpoints) {
        await userAgent
          .get(endpoint)
          .expect(403);
      }
    });
  });

  describe('Manager Role Authorization', () => {
    it('should handle manager permissions appropriately', async () => {
      // Managers should have limited access compared to admins
      const managerAccessibleEndpoints = [
        '/api/quality-metrics', // Managers might need this
      ];

      for (const endpoint of managerAccessibleEndpoints) {
        const response = await managerAgent.get(endpoint);
        // Should either allow access (200) or properly deny (403), not fail due to middleware issues
        expect([200, 403]).toContain(response.status);
      }
    });
  });

  describe('Authentication vs Authorization Separation', () => {
    it('should properly separate authentication (401) from authorization (403) errors', async () => {
      // Unauthenticated request should return 401
      await request(app)
        .get('/api/permissions')
        .expect(401);
        
      // Authenticated but unauthorized should return 403
      await userAgent
        .get('/api/permissions')
        .expect(403);
    });

    it('should handle authentication errors consistently across endpoints', async () => {
      const protectedEndpoints = [
        '/api/permissions',
        '/api/quality-metrics',
        '/api/feature-management/features',
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
      const response = await userAgent
        .get('/api/permissions')
        .expect(403);
        
      expect(response.body.error).toBeDefined();
      expect(response.body.message).toBeDefined();
      expect(response.body.error).toBe('Forbidden');
    });

    it('should handle malformed authorization headers gracefully', async () => {
      const response = await request(app)
        .get('/api/permissions')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
        
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Session-Based Authentication', () => {
    it('should properly maintain sessions for authorized users', async () => {
      // Make multiple requests to ensure session persistence
      await adminAgent.get('/api/permissions').expect(200);
      await adminAgent.get('/api/quality-metrics').expect(200);
      await adminAgent.get('/api/feature-management/features').expect(200);
    });

    it('should handle session expiration gracefully', async () => {
      // This would test session timeout scenarios
      // For now, just verify that sessions work as expected
      const response = await adminAgent
        .get('/api/permissions')
        .expect(200);
        
      expect(response.body).toBeDefined();
    });
  });
});