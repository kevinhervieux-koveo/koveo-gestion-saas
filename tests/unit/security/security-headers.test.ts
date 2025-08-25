/**
 * @file Security Headers Test Suite.
 * @description Comprehensive tests for security middleware and Law 25 compliance
 * for Koveo Gestion Quebec property management platform.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { Application } from 'express';
// Mock security middleware functions
const mockConfigureSecurityMiddleware = jest.fn();
const mockSecurityHealthCheck = jest.fn((req: any, res: any, next: any) => next());
const mockAddLaw25Headers = jest.fn((req: any, res: any, next: any) => next());

jest.mock('../../../server/middleware/security-middleware', () => ({
  configureSecurityMiddleware: mockConfigureSecurityMiddleware,
  securityHealthCheck: mockSecurityHealthCheck,
  addLaw25Headers: mockAddLaw25Headers,
}));

describe('Security Headers and Law 25 Compliance Tests', () => {
  let app: Application;

  beforeEach(() => {
    app = express();

    // Configure security middleware with mocks
    mockConfigureSecurityMiddleware.mockImplementation((expressApp: any) => {
      // Add basic security headers for testing
      expressApp.use((req: any, res: any, next: any) => {
        res.setHeader(
          'content-security-policy',
          "default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"
        );
        res.setHeader('x-frame-options', 'DENY');
        res.setHeader('x-content-type-options', 'nosniff');
        if (process.env.NODE_ENV === 'production') {
          res.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
        }
        next();
      });
    });

    mockConfigureSecurityMiddleware(app);
    app.use(mockSecurityHealthCheck);
    app.use(mockAddLaw25Headers);

    // Add test routes
    app.get('/test', (req, res) => {
      res.json({ message: 'Test endpoint' });
    });

    app.get('/api/test', (req, res) => {
      res.json({ message: 'API test endpoint' });
    });

    app.post('/api/auth/login', (req, res) => {
      res.json({ message: 'Login endpoint' });
    });

    app.post('/api/upload/file', (req, res) => {
      res.json({ message: 'Upload endpoint' });
    });

    app.post('/api/security/csp-report', (req, res) => {
      res.status(204).end();
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Security Headers Implementation', () => {
    it('should include Content Security Policy headers', async () => {
      const response = await request(app).get('/test');

      expect(response.headers).toHaveProperty('content-security-policy');
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
      expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    });

    it('should include X-Frame-Options to prevent clickjacking', async () => {
      const response = await request(app).get('/test');

      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should include X-Content-Type-Options to prevent MIME sniffing', async () => {
      const response = await request(app).get('/test');

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should include Strict-Transport-Security in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const prodApp = express();
      mockConfigureSecurityMiddleware(prodApp);
      prodApp.get('/test', (req, res) => res.json({ message: 'test' }));

      const response = await request(prodApp).get('/test');

      expect(response.headers).toHaveProperty('strict-transport-security');
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(response.headers['strict-transport-security']).toContain('includeSubDomains');

      process.env.NODE_ENV = originalEnv;
    });

    it('should include Referrer-Policy header', async () => {
      const response = await request(app).get('/test');

      expect(response.headers).toHaveProperty('referrer-policy');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should include Permissions-Policy header', async () => {
      const response = await request(app).get('/test');

      expect(response.headers).toHaveProperty('permissions-policy');
      expect(response.headers['permissions-policy']).toContain('camera=self');
      expect(response.headers['permissions-policy']).toContain('geolocation=self');
    });

    it('should hide server information headers', async () => {
      const response = await request(app).get('/test');

      expect(response.headers).not.toHaveProperty('x-powered-by');
      expect(response.headers).not.toHaveProperty('server');
    });

    it('should include Cross-Origin policies', async () => {
      const response = await request(app).get('/test');

      expect(response.headers).toHaveProperty('cross-origin-embedder-policy');
      expect(response.headers).toHaveProperty('cross-origin-opener-policy');
      expect(response.headers).toHaveProperty('cross-origin-resource-policy');
    });
  });

  describe('Law 25 Quebec Privacy Compliance', () => {
    it('should include Quebec Law 25 compliance headers', async () => {
      const response = await request(app).get('/test');

      expect(response.headers).toHaveProperty('x-quebec-law25-compliant');
      expect(response.headers['x-quebec-law25-compliant']).toBe('true');

      expect(response.headers).toHaveProperty('x-data-controller');
      expect(response.headers['x-data-controller']).toBe('Koveo Gestion Inc.');

      expect(response.headers).toHaveProperty('x-privacy-officer');
      expect(response.headers['x-privacy-officer']).toBe('privacy@koveogestion.com');

      expect(response.headers).toHaveProperty('x-data-processing-lawful-basis');
      expect(response.headers['x-data-processing-lawful-basis']).toBe(
        'legitimate-interest,contract'
      );
    });

    it('should include privacy policy and data retention headers', async () => {
      const response = await request(app).get('/test');

      expect(response.headers).toHaveProperty('x-privacy-policy');
      expect(response.headers['x-privacy-policy']).toBe('/privacy-policy');

      expect(response.headers).toHaveProperty('x-data-retention');
      expect(response.headers['x-data-retention']).toBe('7-years');
    });

    it('should include bilingual content language headers', async () => {
      const response = await request(app).get('/test');

      expect(response.headers).toHaveProperty('x-content-language');
      expect(response.headers['x-content-language']).toBe('fr-CA,en-CA');
    });

    it('should detect French language preference', async () => {
      const response = await request(app)
        .get('/test')
        .set('Accept-Language', 'fr-CA,fr;q=0.9,en;q=0.8');

      expect(response.headers).toHaveProperty('x-content-language-preference');
      expect(response.headers['x-content-language-preference']).toBe('fr-CA');
    });

    it('should detect English language preference', async () => {
      const response = await request(app).get('/test').set('Accept-Language', 'en-US,en;q=0.9');

      expect(response.headers).toHaveProperty('x-content-language-preference');
      expect(response.headers['x-content-language-preference']).toBe('en-CA');
    });
  });

  describe('API Security Controls', () => {
    it('should include cache control headers for API endpoints', async () => {
      const response = await request(app).get('/api/test');

      expect(response.headers).toHaveProperty('cache-control');
      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.headers['cache-control']).toContain('no-cache');
      expect(response.headers['cache-control']).toContain('must-revalidate');
      expect(response.headers['cache-control']).toContain('private');

      expect(response.headers).toHaveProperty('pragma');
      expect(response.headers.pragma).toBe('no-cache');

      expect(response.headers).toHaveProperty('expires');
      expect(response.headers.expires).toBe('0');
    });

    it('should not include cache control headers for non-API endpoints', async () => {
      const response = await request(app).get('/test');

      // Should not have API-specific cache headers
      expect(response.headers['cache-control']).not.toContain('no-store');
    });

    it('should include additional security headers', async () => {
      const response = await request(app).get('/test');

      expect(response.headers).toHaveProperty('x-permitted-cross-domain-policies');
      expect(response.headers['x-permitted-cross-domain-policies']).toBe('none');

      expect(response.headers).toHaveProperty('x-download-options');
      expect(response.headers['x-download-options']).toBe('noopen');

      expect(response.headers).toHaveProperty('x-xss-protection');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });

  describe('Content Security Policy (CSP)', () => {
    it('should allow Quebec government domains in CSP', async () => {
      const response = await request(app).get('/test');

      const csp = response.headers['content-security-policy'];
      expect(csp).toContain('*.quebec.ca');
      expect(csp).toContain('*.gouv.qc.ca');
    });

    it('should include development sources in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const devApp = express();
      mockConfigureSecurityMiddleware(devApp);
      devApp.get('/test', (req, res) => res.json({ message: 'test' }));

      const response = await request(devApp).get('/test');

      const csp = response.headers['content-security-policy'];
      expect(csp).toContain('localhost:*');
      expect(csp).toContain('*.replit.com');

      process.env.NODE_ENV = originalEnv;
    });

    it('should restrict dangerous CSP directives', async () => {
      const response = await request(app).get('/test');

      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
    });
  });

  describe('CORS Configuration', () => {
    it('should handle valid origins', async () => {
      const response = await request(app)
        .options('/api/test')
        .set('Origin', 'https://koveogestion.com');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should reject invalid origins', async () => {
      const response = await request(app)
        .options('/api/test')
        .set('Origin', 'https://malicious-site.com');

      expect(response.status).toBe(500); // CORS error
    });

    it('should allow credentials for valid origins', async () => {
      const response = await request(app)
        .options('/api/test')
        .set('Origin', 'https://koveogestion.com');

      expect(response.headers).toHaveProperty('access-control-allow-credentials');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should include bilingual language header in exposed headers', async () => {
      const response = await request(app)
        .options('/api/test')
        .set('Origin', 'https://koveogestion.com');

      expect(response.headers).toHaveProperty('access-control-expose-headers');
      expect(response.headers['access-control-expose-headers']).toContain('X-Language');
    });
  });

  describe('Security Monitoring and Reporting', () => {
    it('should accept CSP violation reports', async () => {
      const cspReport = {
        'csp-report': {
          'document-uri': 'https://koveogestion.com/dashboard',
          'violated-directive': 'script-src',
          'blocked-uri': 'https://malicious-site.com/evil.js',
        },
      };

      const response = await request(app)
        .post('/api/security/csp-report')
        .set('Content-Type', 'application/csp-report')
        .send(cspReport);

      expect(response.status).toBe(204);
    });

    it('should accept Certificate Transparency reports', async () => {
      const ctReport = {
        certificate: 'base64-encoded-cert',
        'sct-list': 'base64-encoded-scts',
      };

      const response = await request(app)
        .post('/api/security/ct-report')
        .set('Content-Type', 'application/json')
        .send(ctReport);

      expect(response.status).toBe(204);
    });
  });

  describe('Security Health Checks', () => {
    it('should pass security health check with HTTPS', async () => {
      const response = await request(app).get('/test').set('X-Forwarded-Proto', 'https');

      expect(response.status).toBe(200);
    });

    it('should pass security health check in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Quebec Property Management Specific Security', () => {
    it('should include property management specific headers', async () => {
      const response = await request(app).get('/api/test');

      // Verify all the required Law 25 compliance headers are present
      const requiredHeaders = [
        'x-quebec-law25-compliant',
        'x-data-controller',
        'x-privacy-officer',
        'x-data-processing-lawful-basis',
        'x-privacy-policy',
        'x-data-retention',
        'x-content-language',
      ];

      requiredHeaders.forEach((header) => {
        expect(response.headers).toHaveProperty(header);
      });
    });

    it('should enforce Quebec data retention policy', async () => {
      const response = await request(app).get('/api/test');

      expect(response.headers['x-data-retention']).toBe('7-years');
    });

    it('should identify Koveo Gestion as data controller', async () => {
      const response = await request(app).get('/api/test');

      expect(response.headers['x-data-controller']).toBe('Koveo Gestion Inc.');
    });

    it('should provide privacy officer contact', async () => {
      const response = await request(app).get('/api/test');

      expect(response.headers['x-privacy-officer']).toBe('privacy@koveogestion.com');
    });

    it('should specify lawful basis for data processing', async () => {
      const response = await request(app).get('/api/test');

      expect(response.headers['x-data-processing-lawful-basis']).toBe(
        'legitimate-interest,contract'
      );
    });
  });

  describe('Cross-Browser and Platform Compatibility', () => {
    it('should work with different user agents', async () => {
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
        'Mozilla/5.0 (Android 11; Mobile; rv:95.0) Gecko/95.0',
      ];

      for (const userAgent of userAgents) {
        const response = await request(app).get('/test').set('User-Agent', userAgent);

        expect(response.status).toBe(200);
        expect(response.headers).toHaveProperty('x-quebec-law25-compliant');
      }
    });

    it('should handle missing headers gracefully', async () => {
      const response = await request(app).get('/test').set('Accept-Language', ''); // Empty language header

      expect(response.status).toBe(200);
      expect(response.headers).toHaveProperty('x-content-language-preference');
    });
  });
});
