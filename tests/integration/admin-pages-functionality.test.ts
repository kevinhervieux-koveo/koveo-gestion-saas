/**
 * Integration Tests for Admin Pages Functionality
 * 
 * Tests cover the fixes made to:
 * - /admin/roadmap page (feature-management.ts syntax errors)
 * - /admin/compliance page (law25-compliance.ts syntax errors)
 * - /admin/quality page (quality-metrics authentication issues)
 * - /admin/permissions page (overly restrictive authorization middleware)
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import { registerApiRoutes } from '../../server/routes';
import { MemStorage } from '../../server/storage';
import { createTestUser, createTestSession } from '../utils/test-utils';

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
  
  // Register API routes
  registerApiRoutes(app);
  
  return app;
};

describe('Admin Pages Functionality', () => {
  let app: express.Application;
  let adminUser: any;
  let regularUser: any;
  let adminAgent: request.SuperAgentTest;
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
    
    regularUser = await createTestUser({
      email: 'user@test.com',
      role: 'resident',
      firstName: 'Regular',
      lastName: 'User'
    });
    
    // Create authenticated agents
    adminAgent = request.agent(app);
    userAgent = request.agent(app);
    
    // Login as admin
    await adminAgent
      .post('/api/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'password123'
      });
      
    // Login as regular user
    await userAgent
      .post('/api/auth/login')
      .send({
        email: 'user@test.com',
        password: 'password123'
      });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Admin Roadmap Page (/admin/roadmap)', () => {
    it('should successfully load roadmap data for admin users', async () => {
      const response = await adminAgent
        .get('/api/feature-management/features')
        .expect(200);
        
      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should deny access to non-admin users', async () => {
      await userAgent
        .get('/api/feature-management/features')
        .expect(403);
    });

    it('should handle feature creation without syntax errors', async () => {
      const newFeature = {
        title: 'Test Feature',
        description: 'Test Description',
        category: 'enhancement',
        priority: 'medium',
        estimatedEffort: 5,
        targetQuarter: 'Q1 2025',
        status: 'planned'
      };

      const response = await adminAgent
        .post('/api/feature-management/features')
        .send(newFeature)
        .expect(201);
        
      expect(response.body.title).toBe(newFeature.title);
      expect(response.body.status).toBe('planned');
    });

    it('should handle feature updates without errors', async () => {
      // First create a feature
      const createResponse = await adminAgent
        .post('/api/feature-management/features')
        .send({
          title: 'Update Test',
          description: 'Test Description',
          category: 'enhancement',
          priority: 'medium',
          estimatedEffort: 3,
          targetQuarter: 'Q2 2025',
          status: 'planned'
        });

      const featureId = createResponse.body.id;
      
      // Then update it
      const updateResponse = await adminAgent
        .patch(`/api/feature-management/features/${featureId}`)
        .send({
          status: 'in_progress',
          priority: 'high'
        })
        .expect(200);
        
      expect(updateResponse.body.status).toBe('in_progress');
      expect(updateResponse.body.priority).toBe('high');
    });
  });

  describe('Admin Compliance Page (/admin/compliance)', () => {
    it('should successfully load compliance data for admin users', async () => {
      const response = await adminAgent
        .get('/api/law25-compliance')
        .expect(200);
        
      expect(response.body).toBeDefined();
      expect(response.body.overallStatus).toBeDefined();
    });

    it('should deny access to non-admin users', async () => {
      await userAgent
        .get('/api/law25-compliance')
        .expect(403);
    });

    it('should return proper compliance status structure', async () => {
      const response = await adminAgent
        .get('/api/law25-compliance')
        .expect(200);
        
      expect(response.body).toHaveProperty('overallStatus');
      expect(response.body).toHaveProperty('categories');
      expect(response.body).toHaveProperty('recommendations');
      expect(typeof response.body.overallStatus).toBe('string');
      expect(Array.isArray(response.body.categories)).toBe(true);
    });

    it('should handle compliance audit requests without syntax errors', async () => {
      const response = await adminAgent
        .post('/api/law25-compliance/audit')
        .send({
          auditType: 'full',
          includeSensitiveData: true
        })
        .expect(200);
        
      expect(response.body.auditId).toBeDefined();
      expect(response.body.status).toBe('initiated');
    });
  });

  describe('Admin Quality Page (/admin/quality)', () => {
    it('should successfully load quality metrics for authenticated admin users', async () => {
      const response = await adminAgent
        .get('/api/quality-metrics')
        .expect(200);
        
      expect(response.body).toBeDefined();
      expect(response.body.metrics).toBeDefined();
    });

    it('should deny access to unauthenticated users', async () => {
      await request(app)
        .get('/api/quality-metrics')
        .expect(401);
    });

    it('should deny access to non-admin users', async () => {
      await userAgent
        .get('/api/quality-metrics')
        .expect(403);
    });

    it('should return properly structured quality metrics', async () => {
      const response = await adminAgent
        .get('/api/quality-metrics')
        .expect(200);
        
      expect(response.body.metrics).toBeDefined();
      expect(response.body.metrics.overall).toBeDefined();
      expect(response.body.metrics.categories).toBeDefined();
      expect(Array.isArray(response.body.metrics.categories)).toBe(true);
    });

    it('should handle quality metric updates without authentication issues', async () => {
      const updateData = {
        category: 'performance',
        metric: 'response_time',
        value: 250,
        threshold: 300
      };

      const response = await adminAgent
        .post('/api/quality-metrics/update')
        .send(updateData)
        .expect(200);
        
      expect(response.body.success).toBe(true);
    });
  });

  describe('Admin Permissions Page (/admin/permissions)', () => {
    it('should successfully load permissions data for admin users', async () => {
      const response = await adminAgent
        .get('/api/permissions')
        .expect(200);
        
      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should allow admin access without overly restrictive middleware', async () => {
      // This test ensures the authorization middleware fix
      const response = await adminAgent
        .get('/api/permissions')
        .expect(200);
        
      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });

    it('should still deny access to non-admin users', async () => {
      await userAgent
        .get('/api/permissions')
        .expect(403);
    });

    it('should handle permission updates for admin users', async () => {
      const permissionUpdate = {
        userId: regularUser.id,
        permissions: ['read_documents', 'create_demands'],
        role: 'resident'
      };

      const response = await adminAgent
        .patch('/api/permissions/user')
        .send(permissionUpdate)
        .expect(200);
        
      expect(response.body.success).toBe(true);
    });

    it('should handle role-based permission queries', async () => {
      const response = await adminAgent
        .get('/api/permissions?role=manager')
        .expect(200);
        
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Cross-Page Error Handling', () => {
    it('should handle malformed requests gracefully across all admin endpoints', async () => {
      const endpoints = [
        '/api/feature-management/features',
        '/api/law25-compliance',
        '/api/quality-metrics',
        '/api/permissions'
      ];

      for (const endpoint of endpoints) {
        const response = await adminAgent
          .post(endpoint)
          .send({ malformed: 'data', invalid: true })
          .expect(400);
          
        expect(response.body.error).toBeDefined();
      }
    });

    it('should return consistent error formats across admin pages', async () => {
      const response = await userAgent
        .get('/api/feature-management/features')
        .expect(403);
        
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.error).toBe('Forbidden');
    });
  });

  describe('Admin Page Authentication Flow', () => {
    it('should require authentication for all admin endpoints', async () => {
      const endpoints = [
        '/api/feature-management/features',
        '/api/law25-compliance',
        '/api/quality-metrics',
        '/api/permissions'
      ];

      for (const endpoint of endpoints) {
        await request(app)
          .get(endpoint)
          .expect(401);
      }
    });

    it('should maintain session across admin page requests', async () => {
      // Make multiple requests to ensure session persistence
      await adminAgent
        .get('/api/feature-management/features')
        .expect(200);
        
      await adminAgent
        .get('/api/law25-compliance')
        .expect(200);
        
      await adminAgent
        .get('/api/quality-metrics')
        .expect(200);
        
      await adminAgent
        .get('/api/permissions')
        .expect(200);
    });
  });
});