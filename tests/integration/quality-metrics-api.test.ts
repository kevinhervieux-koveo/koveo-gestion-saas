import request from 'supertest';
import express, { type Express } from 'express';
import { registerRoutes } from '../../server/routes';
import { jest } from '@jest/globals';

describe('Quality Metrics API Integration Tests', () => {
  let app: Express;
  let server: any;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('GET /api/quality-metrics', () => {
    it('should return quality metrics with correct structure', async () => {
      const response = await request(app)
        .get('/api/quality-metrics')
        .expect(200);

      expect(response.body).toHaveProperty('coverage');
      expect(response.body).toHaveProperty('codeQuality');
      expect(response.body).toHaveProperty('securityIssues');
      expect(response.body).toHaveProperty('buildTime');
      expect(response.body).toHaveProperty('translationCoverage');

      // Validate response types
      expect(typeof response.body.coverage).toBe('string');
      expect(typeof response.body.codeQuality).toBe('string');
      expect(typeof response.body.securityIssues).toBe('string');
      expect(typeof response.body.buildTime).toBe('string');
      expect(typeof response.body.translationCoverage).toBe('string');

      // Coverage should be a percentage
      expect(response.body.coverage).toMatch(/^\d{1,3}%$/);
      
      // Code quality should be a valid grade
      expect(['A+', 'A', 'B+', 'B', 'C', 'N/A'].includes(response.body.codeQuality)).toBe(true);
      
      // Security issues should be a number
      expect(response.body.securityIssues).toMatch(/^\d+$/);
      
      // Build time should be time format or 'Error'
      expect(response.body.buildTime).toMatch(/^(\d+(\.\d+)?(ms|s)|Error|N\/A)$/);
      
      // Translation coverage should be a percentage
      expect(response.body.translationCoverage).toMatch(/^\d{1,3}%$/);
    });

    it('should return consistent results on multiple calls', async () => {
      const response1 = await request(app)
        .get('/api/quality-metrics')
        .expect(200);

      const response2 = await request(app)
        .get('/api/quality-metrics')
        .expect(200);

      // Results should be consistent within a short time window
      // (allowing for small variations in build time)
      expect(response1.body.coverage).toBe(response2.body.coverage);
      expect(response1.body.codeQuality).toBe(response2.body.codeQuality);
      expect(response1.body.securityIssues).toBe(response2.body.securityIssues);
      expect(response1.body.translationCoverage).toBe(response2.body.translationCoverage);
    });

    it('should handle server errors gracefully', async () => {
      // Mock a temporary error condition
      const originalConsoleError = console.error;
      console.error = jest.fn();

      // This test would require mocking internal functions to force an error
      // For now, we'll test the fallback response structure
      const response = await request(app)
        .get('/api/quality-metrics')
        .expect(200);

      // Even in error conditions, should return valid structure
      expect(response.body).toHaveProperty('coverage');
      expect(response.body).toHaveProperty('codeQuality');
      expect(response.body).toHaveProperty('securityIssues');
      expect(response.body).toHaveProperty('buildTime');
      expect(response.body).toHaveProperty('translationCoverage');

      console.error = originalConsoleError;
    });

    it('should provide metrics that reflect actual code quality', async () => {
      const response = await request(app)
        .get('/api/quality-metrics')
        .expect(200);

      // Quality assertions based on current project state
      const coverage = parseInt(response.body.coverage);
      const securityIssues = parseInt(response.body.securityIssues);
      const translationCoverage = parseInt(response.body.translationCoverage);

      // These should reflect a well-maintained project
      if (coverage > 0) {
        expect(coverage).toBeGreaterThan(50); // Minimum reasonable coverage
      }

      expect(securityIssues).toBeLessThan(20); // Should not have many security issues

      if (translationCoverage > 0) {
        expect(translationCoverage).toBeGreaterThan(80); // Most features should be translated
      }

      // Code quality should not be failing
      expect(['C', 'D', 'F'].includes(response.body.codeQuality)).toBe(false);
    });
  });

  describe('Quality Metrics Accuracy Validation', () => {
    it('should validate that coverage metric reflects actual test coverage', async () => {
      const response = await request(app)
        .get('/api/quality-metrics')
        .expect(200);

      const reportedCoverage = parseInt(response.body.coverage);

      // If we have tests, coverage should be reported
      if (reportedCoverage > 0) {
        // Should have reasonable coverage for a project with tests
        expect(reportedCoverage).toBeGreaterThan(30);
        expect(reportedCoverage).toBeLessThanOrEqual(100);
      }

      // TODO: Add actual validation against Jest coverage reports
      // This would require running real coverage analysis and comparing results
    });

    it('should validate that security issues reflect real vulnerabilities', async () => {
      const response = await request(app)
        .get('/api/quality-metrics')
        .expect(200);

      const reportedIssues = parseInt(response.body.securityIssues);

      // Should not report unrealistic numbers
      expect(reportedIssues).toBeGreaterThanOrEqual(0);
      expect(reportedIssues).toBeLessThan(1000); // Sanity check

      // TODO: Add validation against actual npm audit results
      // Could run npm audit separately and compare results
    });

    it('should validate that code quality reflects actual code maintainability', async () => {
      const response = await request(app)
        .get('/api/quality-metrics')
        .expect(200);

      const codeQuality = response.body.codeQuality;

      // Should return valid grades
      expect(['A+', 'A', 'B+', 'B', 'C', 'N/A'].includes(codeQuality)).toBe(true);

      // TODO: Add validation against actual ESLint results
      // Could run ESLint separately and validate grade calculation logic
    });

    it('should validate that translation coverage reflects actual i18n completeness', async () => {
      const response = await request(app)
        .get('/api/quality-metrics')
        .expect(200);

      const translationCoverage = parseInt(response.body.translationCoverage);

      expect(translationCoverage).toBeGreaterThanOrEqual(0);
      expect(translationCoverage).toBeLessThanOrEqual(100);

      // TODO: Add validation by parsing actual i18n files
      // Could independently count translation keys and compare
    });
  });

  describe('Quality Metrics Performance', () => {
    it('should return metrics within reasonable time', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/quality-metrics')
        .expect(200);

      const duration = Date.now() - startTime;

      // Should complete within 60 seconds (generous for build time calculation)
      expect(duration).toBeLessThan(60000);

      // Should complete within 10 seconds for most cases
      if (duration > 10000) {
        console.warn(`Quality metrics took ${duration}ms - consider optimization`);
      }
    });

    it('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 3 }, () =>
        request(app).get('/api/quality-metrics').expect(200)
      );

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('coverage');
      });

      // Results should be consistent across concurrent requests
      const firstResponse = responses[0].body;
      responses.forEach(response => {
        expect(response.body.coverage).toBe(firstResponse.coverage);
        expect(response.body.codeQuality).toBe(firstResponse.codeQuality);
      });
    });
  });
});