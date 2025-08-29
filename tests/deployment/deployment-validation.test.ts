/**
 * Deployment Validation Tests
 *
 * Tests to ensure the application is properly configured for deployment
 * and catches issues that would cause 500 errors in production.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../../server/index';

describe('Deployment Validation', () => {
  let server: any;

  beforeAll(async () => {
    // Start server for testing
    server = app.listen(0); // Use random port
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('Health Checks', () => {
    test('should respond to basic health check', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.text).toBe('OK');
    });

    test('should respond to Kubernetes health check', async () => {
      const response = await request(app).get('/healthz');
      expect(response.status).toBe(200);
      expect(response.text).toBe('OK');
    });

    test('should respond to readiness probe', async () => {
      const response = await request(app).get('/ready');
      expect(response.status).toBe(200);
      expect(response.text).toBe('OK');
    });

    test('should respond to API health endpoint', async () => {
      const response = await request(app).get('/api/health');
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'ok',
        message: 'Koveo Gestion API is running',
        version: '1.0.0',
        port: expect.any(Number),
      });
    });

    test('should respond to detailed health endpoint', async () => {
      const response = await request(app).get('/api/health/detailed');
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'healthy',
        uptime: expect.any(Number),
        memory: expect.any(Object),
        pid: expect.any(Number),
        nodeVersion: expect.any(String),
        port: expect.any(Number),
        env: expect.any(String),
      });
    });
  });

  describe('API Endpoints', () => {
    test('should handle auth endpoint without error', async () => {
      const response = await request(app).get('/api/auth/user');
      // Should return 401 (unauthorized) not 500 (server error)
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        message: 'Authentication required',
      });
    });

    test('should handle features endpoint without error', async () => {
      const response = await request(app).get('/api/features');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should handle roadmap endpoint without error', async () => {
      const response = await request(app).get('/api/features?roadmap=true');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Static File Serving', () => {
    test('should serve root path without error', async () => {
      const response = await request(app).get('/');
      // Should return either HTML (200) or proper error, not 500
      expect([200, 404]).toContain(response.status);
    });

    test('should handle SPA routes without error', async () => {
      const response = await request(app).get('/dashboard');
      // Should return either HTML (200) or proper error, not 500
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent API routes', async () => {
      const response = await request(app).get('/api/non-existent-route');
      expect(response.status).toBe(404);
    });

    test('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .post('/api/features/invalid-id/update-status')
        .send({ status: 'invalid-status' });

      // Should return 400 (bad request) or 404 (not found), not 500
      expect([400, 404]).toContain(response.status);
    });
  });

  describe('Security Headers', () => {
    test('should include security headers', async () => {
      const response = await request(app).get('/api/health');

      expect(response.headers).toMatchObject({
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'x-xss-protection': '1; mode=block',
        'strict-transport-security': expect.stringContaining('max-age'),
        'x-quebec-law25-compliant': 'true',
      });
    });
  });

  describe('Database Connectivity', () => {
    test('should connect to database without errors', async () => {
      // This test ensures database operations don't cause 500 errors
      const response = await request(app).get('/api/health/detailed');
      expect(response.status).toBe(200);

      // If database connectivity is broken, this would likely return 500
      expect(response.body.status).toBe('healthy');
    });
  });
});
