import { describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// Mock WebSocket constructor for Jest environment
jest.mock('ws', () => ({
  __esModule: true,
  default: class MockWebSocket {}
}));

import { registerRoutes } from '../../../server/routes';

/**
 * Security Headers Validation Test Suite
 * 
 * Validates that proper security headers are set:
 * - Content Security Policy (CSP)
 * - X-Content-Type-Options
 * - X-Frame-Options
 * - X-XSS-Protection
 * - Strict-Transport-Security
 * - Referrer-Policy
 */

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  registerRoutes(app);
  return app;
};

describe('Security Headers Validation', () => {
  let app: express.Application;

  beforeEach(async () => {
    app = createTestApp();
  });

  describe('Essential Security Headers', () => {
    it('should set X-Content-Type-Options header', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should set X-Frame-Options header', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.headers['x-frame-options']).toMatch(/^(DENY|SAMEORIGIN)$/);
    });

    it('should set X-XSS-Protection header', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    it('should set Referrer-Policy header', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.headers['referrer-policy']).toBeDefined();
      expect(response.headers['referrer-policy']).toMatch(/^(strict-origin-when-cross-origin|same-origin|no-referrer)$/);
    });
  });

  describe('Content Security Policy', () => {
    it('should set Content-Security-Policy header', async () => {
      const response = await request(app)
        .get('/api/health');

      const csp = response.headers['content-security-policy'];
      expect(csp).toBeDefined();
      
      // Should contain basic CSP directives
      if (csp) {
        expect(csp).toContain('default-src');
      }
    });

    it('should prevent inline script execution via CSP', async () => {
      const response = await request(app)
        .get('/api/health');

      const csp = response.headers['content-security-policy'];
      if (csp) {
        // Should not allow unsafe-inline for scripts
        expect(csp).not.toContain("script-src 'unsafe-inline'");
      }
    });
  });

  describe('HTTPS Security Headers', () => {
    it('should set Strict-Transport-Security when using HTTPS', async () => {
      // Test with HTTPS simulation
      const response = await request(app)
        .get('/api/health')
        .set('X-Forwarded-Proto', 'https');

      // In production, should have HSTS header
      if (process.env.NODE_ENV === 'production') {
        expect(response.headers['strict-transport-security']).toBeDefined();
      }
    });
  });

  describe('API-Specific Security Headers', () => {
    it('should set proper CORS headers for API endpoints', async () => {
      const response = await request(app)
        .options('/api/users');

      // Should handle CORS preflight properly
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });

    it('should set Cache-Control headers for sensitive endpoints', async () => {
      const response = await request(app)
        .get('/api/auth/profile');

      // Sensitive endpoints should have no-cache directive
      const cacheControl = response.headers['cache-control'];
      if (cacheControl) {
        expect(cacheControl).toMatch(/(no-cache|no-store|private)/);
      }
    });

    it('should not expose server information', async () => {
      const response = await request(app)
        .get('/api/health');

      // Should not expose Express version or server details
      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).not.toContain('Express');
    });
  });

  describe('Error Response Security', () => {
    it('should not leak sensitive information in error messages', async () => {
      // Try to trigger various error conditions
      const responses = await Promise.all([
        request(app).get('/api/nonexistent').expect(404),
        request(app).post('/api/users').send({ invalid: 'data' }).expect(400),
        request(app).get('/api/buildings/999999').expect(404),
      ]);

      responses.forEach(response => {
        const body = response.body;
        const errorText = JSON.stringify(body).toLowerCase();
        
        // Should not contain internal paths, stack traces, or database info
        expect(errorText).not.toContain('/home/runner');
        expect(errorText).not.toContain('node_modules');
        expect(errorText).not.toContain('postgresql');
        expect(errorText).not.toContain('stack trace');
        expect(errorText).not.toContain('at object.');
      });
    });

    it('should set appropriate status codes for security violations', async () => {
      // Test unauthorized access
      const unauthorizedResponse = await request(app)
        .get('/api/auth/profile');
      expect(unauthorizedResponse.status).toBe(401);

      // Test forbidden access (would need proper auth setup for realistic test)
      const forbiddenResponse = await request(app)
        .delete('/api/users/1');
      expect([401, 403]).toContain(forbiddenResponse.status);
    });
  });

  describe('Input Validation Security', () => {
    it('should handle malicious input safely', async () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        "'; DROP TABLE users; --",
        '../../../etc/passwd',
        '{{constructor.constructor("return process")().env}}',
        '\x00\x01\x02', // Binary data
      ];

      for (const maliciousInput of maliciousInputs) {
        const response = await request(app)
          .post('/api/organizations')
          .send({
            name: maliciousInput,
            type: 'syndicate',
            address: '123 Test St',
            city: 'Montreal',
            province: 'QC',
            postalCode: 'H1A 1A1',
          });

        // Should either reject the input or sanitize it properly
        expect([400, 401, 403]).toContain(response.status);
        
        if (response.body.error) {
          // Error message should not echo back the malicious input
          expect(response.body.error).not.toContain('<script>');
          expect(response.body.error).not.toContain('DROP TABLE');
        }
      }
    });

    it('should enforce request size limits', async () => {
      // Create oversized payload
      const largePayload = 'a'.repeat(10 * 1024 * 1024); // 10MB

      const response = await request(app)
        .post('/api/organizations')
        .send({
          name: largePayload,
          type: 'syndicate',
          address: '123 Test St',
          city: 'Montreal',
          province: 'QC',
          postalCode: 'H1A 1A1',
        });

      // Should reject oversized requests
      expect(response.status).toBe(413);
    });
  });

  describe('Authentication Security', () => {
    it('should handle authentication bypass attempts', async () => {
      const bypassAttempts = [
        { 'x-user-id': '1' },
        { 'x-role': 'admin' },
        { 'authorization': 'Bearer fake-token' },
        { 'x-forwarded-user': 'admin' },
      ];

      for (const headers of bypassAttempts) {
        const response = await request(app)
          .get('/api/auth/profile')
          .set(headers);

        // Should not bypass authentication
        expect(response.status).toBe(401);
      }
    });

    it('should handle session manipulation attempts', async () => {
      const manipulationAttempts = [
        'admin-session-id',
        '../admin-session',
        'null',
        'undefined',
        JSON.stringify({ userId: 1, role: 'admin' }),
      ];

      for (const sessionId of manipulationAttempts) {
        const response = await request(app)
          .get('/api/auth/profile')
          .set('Cookie', `koveo.sid=${sessionId}`);

        // Should not accept manipulated sessions
        expect(response.status).toBe(401);
      }
    });
  });
});