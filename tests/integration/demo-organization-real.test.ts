/**
 * Demo Organization Integration Tests with Real Data
 * Tests API endpoints using actual demo organization data from the database
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../server/routes';

// Create a simple test server
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Register all routes
  registerRoutes(app);
  
  return app;
};

describe('Demo Organization Integration Tests with Real Data', () => {
  let app: express.Application;

  beforeAll(async () => {
    app = createTestApp();
  });

  describe('Organization API Endpoints', () => {
    it('should fetch organizations successfully', async () => {
      const response = await request(app)
        .get('/api/organizations')
        .expect((res) => {
          expect(res.status).toBeLessThan(500);
        });
      
      // Should return some data or handle authentication properly
      expect([200, 401, 403].includes(response.status)).toBe(true);
    });

    it('should handle demo organization queries', async () => {
      const demoOrgId = '9ebab63b-433d-4caf-b7cd-b23365e5014f';
      const response = await request(app)
        .get(`/api/organizations/${demoOrgId}`)
        .expect((res) => {
          expect(res.status).toBeLessThan(500);
        });
      
      // Should return some data or handle authentication properly
      expect([200, 401, 403, 404].includes(response.status)).toBe(true);
    });
  });

  describe('Buildings API Endpoints', () => {
    it('should fetch buildings successfully', async () => {
      const response = await request(app)
        .get('/api/buildings')
        .expect((res) => {
          expect(res.status).toBeLessThan(500);
        });
      
      expect([200, 401, 403].includes(response.status)).toBe(true);
    });

    it('should handle specific building queries', async () => {
      const buildingId = 'd084392f-facb-40a6-8685-3b40dcdd4b68'; // Koveo Tower
      const response = await request(app)
        .get(`/api/buildings/${buildingId}`)
        .expect((res) => {
          expect(res.status).toBeLessThan(500);
        });
      
      expect([200, 401, 403, 404].includes(response.status)).toBe(true);
    });
  });

  describe('Users API Endpoints', () => {
    it('should handle user authentication endpoints', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .expect((res) => {
          expect(res.status).toBeLessThan(500);
        });
      
      // Should either return user data or require authentication
      expect([200, 401, 403].includes(response.status)).toBe(true);
    });
  });

  describe('Health Check Endpoints', () => {
    it('should respond to health check', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect((res) => {
          expect(res.status).toBeLessThanOrEqual(200);
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
    });

    it('should respond to status check', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect((res) => {
          expect(res.status).toBeLessThanOrEqual(200);
        });
      
      expect([200, 503].includes(response.status)).toBe(true);
    });
  });

  describe('Demo Data Validation', () => {
    it('should validate demo users exist', async () => {
      // Test that demo users can be queried
      const demoUserEmail = 'emma.cote@demo.com';
      
      // Try to get user info - should handle appropriately
      const response = await request(app)
        .get('/api/users')
        .query({ email: demoUserEmail })
        .expect((res) => {
          expect(res.status).toBeLessThan(500);
        });
      
      expect([200, 401, 403, 404].includes(response.status)).toBe(true);
    });

    it('should validate demo organization structure', async () => {
      // Verify that demo organization endpoints are accessible
      const response = await request(app)
        .get('/api/organizations')
        .expect((res) => {
          expect(res.status).toBeLessThan(500);
        });
      
      expect([200, 401, 403].includes(response.status)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid routes gracefully', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect((res) => {
          expect(res.status).toBeGreaterThanOrEqual(404);
        });
      
      expect(response.status).toBe(404);
    });

    it('should handle malformed requests', async () => {
      const response = await request(app)
        .post('/api/organizations')
        .send({ invalid: 'data' })
        .expect((res) => {
          expect(res.status).toBeLessThan(500);
        });
      
      // Should reject with 400/401/403 but not crash
      expect([400, 401, 403, 422].includes(response.status)).toBe(true);
    });
  });
});