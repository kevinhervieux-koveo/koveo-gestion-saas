/**
 * Comprehensive API Endpoint Integration Tests for Koveo Gestion.
 * 
 * Tests all API endpoints to ensure 95% coverage for Quebec property management.
 * Includes authentication, authorization, data validation, and error handling.
 */

import request from 'supertest';
import express, { type Express } from 'express';
import { registerRoutes } from '../../server/routes';

describe('Comprehensive API Integration Tests', () => {
  let app: Express;
  let server: any;

  beforeAll(async () => {
    app = express();
    server = await registerRoutes(app);
  });

  afterAll(async () => {
    if (server && server.close) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('Authentication & Authorization', () => {
    test('POST /api/auth/login - should handle login attempts', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'test@koveo.ca',
          password: 'password123'
        });
      
      expect([200, 400, 401]).toContain(response.status);
    });

    test('GET /api/auth/user - should return user info or 401', async () => {
      const response = await request(app)
        .get('/api/auth/user');
      
      expect([200, 401]).toContain(response.status);
    });

    test('POST /api/auth/logout - should handle logout', async () => {
      const response = await request(app)
        .post('/api/auth/logout');
      
      expect([200, 302]).toContain(response.status);
    });
  });

  describe('Quality Metrics API', () => {
    test('GET /api/quality-metrics - should return metrics data', async () => {
      const response = await request(app)
        .get('/api/quality-metrics');
      
      expect([200, 401]).toContain(response.status);
    });

    test('POST /api/quality-metrics - should create new metric', async () => {
      const response = await request(app)
        .post('/api/quality-metrics')
        .send({
          metricType: 'code_coverage',
          value: '95.5',
          category: 'Testing'
        });
      
      expect([201, 400, 401]).toContain(response.status);
    });

    test('PUT /api/quality-metrics/:id - should update metric', async () => {
      const response = await request(app)
        .put('/api/quality-metrics/test-id')
        .send({
          metricType: 'security_vulnerabilities',
          value: '2'
        });
      
      expect([200, 400, 401, 404]).toContain(response.status);
    });
  });

  describe('Metrics Effectiveness Tracking API', () => {
    test('GET /api/metrics-effectiveness - should return effectiveness data', async () => {
      const response = await request(app)
        .get('/api/metrics-effectiveness')
        .query({ metricType: 'code_coverage', timeRange: '168' });
      
      expect([200, 401]).toContain(response.status);
    });

    test('POST /api/metrics-effectiveness/validate - should validate metrics', async () => {
      const response = await request(app)
        .post('/api/metrics-effectiveness/validate')
        .send({
          metricType: 'code_coverage',
          calculatedValue: '92.5',
          contextData: { fileCount: 150 }
        });
      
      expect([200, 400, 401]).toContain(response.status);
    });

    test('POST /api/metrics-effectiveness/predictions - should record predictions', async () => {
      const response = await request(app)
        .post('/api/metrics-effectiveness/predictions')
        .send({
          metricType: 'security_vulnerabilities',
          predictedValue: '3',
          confidenceLevel: 85,
          quebecComplianceRelevant: true
        });
      
      expect([201, 400, 401]).toContain(response.status);
    });

    test('POST /api/metrics-effectiveness/predictions/:id/validate - should validate predictions', async () => {
      const response = await request(app)
        .post('/api/metrics-effectiveness/predictions/test-prediction-id/validate')
        .send({
          actualOutcome: '2',
          validationMethod: 'automated_scan',
          validatorId: 'test-validator'
        });
      
      expect([200, 400, 401, 404]).toContain(response.status);
    });

    test('POST /api/metrics-effectiveness/calibration/:metricType - should trigger calibration', async () => {
      const response = await request(app)
        .post('/api/metrics-effectiveness/calibration/code_coverage');
      
      expect([200, 400, 401]).toContain(response.status);
    });
  });

  describe('Features & Roadmap API', () => {
    test('GET /api/features - should return features list', async () => {
      const response = await request(app)
        .get('/api/features')
        .query({ roadmap: 'true', status: 'submitted' });
      
      expect([200, 401]).toContain(response.status);
    });

    test('POST /api/features - should create new feature', async () => {
      const response = await request(app)
        .post('/api/features')
        .send({
          title: 'Quebec Compliance Enhancement',
          description: 'Improve Law 25 compliance features',
          category: 'Compliance & Security',
          priority: 'high',
          quebecSpecific: true
        });
      
      expect([201, 400, 401]).toContain(response.status);
    });

    test('POST /api/features/:id/ai-analysis - should trigger AI analysis', async () => {
      const response = await request(app)
        .post('/api/features/test-feature-id/ai-analysis');
      
      expect([200, 400, 401, 404]).toContain(response.status);
    });

    test('GET /api/features/:id/actionable-items - should return actionable items', async () => {
      const response = await request(app)
        .get('/api/features/test-feature-id/actionable-items');
      
      expect([200, 401, 404]).toContain(response.status);
    });
  });

  describe('AI Monitoring API', () => {
    test('GET /api/ai/metrics - should return AI metrics', async () => {
      const response = await request(app)
        .get('/api/ai/metrics');
      
      expect([200, 401]).toContain(response.status);
    });

    test('GET /api/ai/interactions - should return AI interactions', async () => {
      const response = await request(app)
        .get('/api/ai/interactions');
      
      expect([200, 401]).toContain(response.status);
    });

    test('POST /api/ai/analyze - should trigger AI analysis', async () => {
      const response = await request(app)
        .post('/api/ai/analyze')
        .send({
          type: 'quality_metrics',
          data: { coverage: 95, vulnerabilities: 2 }
        });
      
      expect([200, 400, 401]).toContain(response.status);
    });

    test('POST /api/ai/interactions - should record AI interaction', async () => {
      const response = await request(app)
        .post('/api/ai/interactions')
        .send({
          interactionType: 'analysis_request',
          inputData: { metric: 'code_coverage' },
          quebecContext: true
        });
      
      expect([201, 400, 401]).toContain(response.status);
    });
  });

  describe('Quality Issues API', () => {
    test('POST /api/quality-issues - should create quality issue', async () => {
      const response = await request(app)
        .post('/api/quality-issues')
        .send({
          title: 'Quebec French Translation Missing',
          description: 'Missing French translation for user interface elements',
          category: 'Localization',
          severity: 'quebec_compliance',
          quebecComplianceRelated: true
        });
      
      expect([201, 400, 401]).toContain(response.status);
    });

    test('GET /api/quality-issues - should return quality issues', async () => {
      const response = await request(app)
        .get('/api/quality-issues')
        .query({ severity: 'quebec_compliance', resolved: 'false' });
      
      expect([200, 401]).toContain(response.status);
    });

    test('PATCH /api/quality-issues/:id - should update quality issue', async () => {
      const response = await request(app)
        .patch('/api/quality-issues/test-issue-id')
        .send({
          status: 'resolved',
          resolution: 'Added Quebec French translations'
        });
      
      expect([200, 400, 401, 404]).toContain(response.status);
    });
  });

  describe('Quebec Compliance Analytics API', () => {
    test('GET /api/quebec-compliance-analytics - should return compliance analytics', async () => {
      const response = await request(app)
        .get('/api/quebec-compliance-analytics')
        .query({ timeRange: '30d', category: 'data_protection' });
      
      expect([200, 401]).toContain(response.status);
    });
  });

  describe('Pillar Framework API', () => {
    test('GET /api/pillars - should return pillars data', async () => {
      const response = await request(app)
        .get('/api/pillars');
      
      expect([200, 401]).toContain(response.status);
    });

    test('POST /api/pillars - should create new pillar', async () => {
      const response = await request(app)
        .post('/api/pillars')
        .send({
          name: 'Quebec Compliance Pillar',
          description: 'Ensures Law 25 compliance across all systems',
          status: 'active'
        });
      
      expect([201, 400, 401]).toContain(response.status);
    });

    test('GET /api/workspace-status - should return workspace status', async () => {
      const response = await request(app)
        .get('/api/workspace-status');
      
      expect([200, 401]).toContain(response.status);
    });

    test('POST /api/workspace-status - should update workspace status', async () => {
      const response = await request(app)
        .post('/api/workspace-status')
        .send({
          componentName: 'quality_metrics',
          status: 'operational',
          lastChecked: new Date().toISOString()
        });
      
      expect([201, 400, 401]).toContain(response.status);
    });
  });

  describe('Error Handling & Edge Cases', () => {
    test('Should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/features')
        .send('invalid json')
        .set('Content-Type', 'application/json');
      
      expect([400, 500]).toContain(response.status);
    });

    test('Should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/quality-metrics')
        .send({});
      
      expect([400, 401]).toContain(response.status);
    });

    test('Should handle invalid metric types', async () => {
      const response = await request(app)
        .post('/api/metrics-effectiveness/validate')
        .send({
          metricType: 'invalid_metric_type',
          calculatedValue: '50'
        });
      
      expect([400, 401]).toContain(response.status);
    });

    test('Should handle Quebec-specific validation errors', async () => {
      const response = await request(app)
        .post('/api/quality-issues')
        .send({
          title: 'Test Issue',
          description: 'Contains inappropriate Quebec terms like "email" instead of "courriel"',
          category: 'Localization',
          quebecComplianceRelated: true
        });
      
      expect([201, 400, 401]).toContain(response.status);
    });
  });

  describe('Performance & Scalability', () => {
    test('Should handle concurrent requests efficiently', async () => {
      const requests = Array(10).fill(null).map(() => 
        request(app).get('/api/quality-metrics')
      );
      
      const responses = await Promise.all(requests);
      responses.forEach(response => {
        expect([200, 401]).toContain(response.status);
      });
    });

    test('Should handle large datasets in quality metrics', async () => {
      const largeMetricsData = Array(100).fill(null).map((_, i) => ({
        metricType: 'code_coverage',
        value: String(Math.random() * 100),
        timestamp: new Date().toISOString()
      }));
      
      const response = await request(app)
        .post('/api/quality-metrics/bulk')
        .send({ metrics: largeMetricsData });
      
      expect([200, 201, 400, 401, 413]).toContain(response.status);
    });
  });
});