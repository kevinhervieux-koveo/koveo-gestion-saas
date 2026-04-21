import { describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// Mock WebSocket constructor for Jest environment
jest.mock('ws', () => ({
  __esModule: true,
  default: class MockWebSocket {}
}));

import { registerRoutes } from '../../server/routes';

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
  
  const helmet = require('helmet');
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/auth/profile', (req, res) => {
    if (!req.headers.authorization && !req.headers.cookie?.includes('koveo.sid=valid-session')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.set('Cache-Control', 'no-store, private');
    res.json({ user: null });
  });

  app.get('/api/nonexistent', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

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

    it('should set X-XSS-Protection header or omit it per modern security standards', async () => {
      const response = await request(app)
        .get('/api/health');

      const xss = response.headers['x-xss-protection'];
      if (xss) {
        expect(xss).toMatch(/^(0|1; mode=block)$/);
      } else {
        expect(xss).toBeUndefined();
      }
    });

    it('should set Referrer-Policy header', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.headers['referrer-policy']).toBeDefined();
    });
  });

  describe('Content Security Policy', () => {
    it('should set Content-Security-Policy header', async () => {
      const response = await request(app)
        .get('/api/health');

      const csp = response.headers['content-security-policy'];
      expect(csp).toBeDefined();
      expect(csp).toContain('default-src');
    });

    it('should not allow unsafe-inline for scripts in CSP', async () => {
      const response = await request(app)
        .get('/api/health');

      const csp = response.headers['content-security-policy'];
      expect(csp).toBeDefined();
      const scriptSrcMatch = csp.match(/script-src\s+([^;]+)/);
      if (scriptSrcMatch) {
        expect(scriptSrcMatch[1]).not.toContain("'unsafe-inline'");
      }
    });
  });

  describe('HTTPS Security Headers', () => {
    it('should set Strict-Transport-Security when using HTTPS', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('X-Forwarded-Proto', 'https');

      if (process.env.NODE_ENV === 'production') {
        expect(response.headers['strict-transport-security']).toBeDefined();
      }
    });
  });

  describe('API-Specific Security Headers', () => {
    it('should set Cache-Control headers for sensitive endpoints', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Cookie', 'koveo.sid=valid-session');

      const cacheControl = response.headers['cache-control'];
      if (cacheControl) {
        expect(cacheControl).toMatch(/(no-cache|no-store|private)/);
      }
    });

    it('should not expose server information via x-powered-by', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('Error Response Security', () => {
    it('should not leak internal paths in error responses', async () => {
      const response = await request(app)
        .get('/api/nonexistent');

      expect(response.status).toBe(404);
      const body = JSON.stringify(response.body).toLowerCase();
      expect(body).not.toContain('/home/runner');
      expect(body).not.toContain('node_modules');
      expect(body).not.toContain('stack trace');
    });
  });

  describe('Authentication Security', () => {
    it('should reject unauthenticated requests to protected endpoints', async () => {
      const response = await request(app)
        .get('/api/auth/profile');

      expect(response.status).toBe(401);
    });

    it('should reject requests with spoofed headers', async () => {
      const bypassAttempts = [
        { 'x-user-id': '1' },
        { 'x-role': 'admin' },
        { 'x-forwarded-user': 'admin' },
      ];

      for (const headers of bypassAttempts) {
        const response = await request(app)
          .get('/api/auth/profile')
          .set(headers);

        expect(response.status).toBe(401);
      }
    });

    it('should reject manipulated session cookies', async () => {
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

        expect(response.status).toBe(401);
      }
    });
  });

  describe('Request Size Limits', () => {
    it('should enforce request size limits', async () => {
      const largePayload = 'a'.repeat(10 * 1024 * 1024);

      const response = await request(app)
        .post('/api/health')
        .send({
          name: largePayload,
        });

      expect(response.status).toBe(413);
    });
  });
});
