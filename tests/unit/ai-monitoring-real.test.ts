/**
 * @file AI Monitoring API tests with real data.
 * @description Test suite for AI monitoring endpoints using actual database.
 */

import request from 'supertest';
import express from 'express';
import { registerAIMonitoringRoutes } from '../../server/api/ai-monitoring';

// Mock only auth middleware to use test user
jest.mock('../../server/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user', role: 'admin' };
    next();
  },
}));

describe('AI Monitoring API Tests (Real Data)', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    registerAIMonitoringRoutes(app);
  });

  describe('GET /api/ai/metrics', () => {
    it('should return AI metrics successfully', async () => {
      const response = await request(app).get('/api/ai/metrics').expect(200);

      // Should return metrics structure, even if empty/default values
      expect(response.body).toHaveProperty('totalInteractions');
      expect(response.body).toHaveProperty('successRate');
      expect(response.body).toHaveProperty('avgResponseTime');
      expect(response.body).toHaveProperty('improvementsSuggested');
      expect(response.body).toHaveProperty('improvementsImplemented');

      // Values should be numbers
      expect(typeof response.body.totalInteractions).toBe('number');
      expect(typeof response.body.successRate).toBe('number');
      expect(typeof response.body.avgResponseTime).toBe('number');
    });
  });

  describe('POST /api/ai/analyze', () => {
    it('should trigger AI analysis successfully', async () => {
      const response = await request(app).post('/api/ai/analyze').expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('insightsGenerated');
      expect(response.body.message).toBe('AI analysis triggered successfully');
      expect(typeof response.body.insightsGenerated).toBe('number');
    });
  });

  describe('POST /api/ai/insights/:id/apply', () => {
    it('should apply AI suggestion successfully', async () => {
      // Use a test insight ID
      const testInsightId = 'test-insight-123';

      const response = await request(app)
        .post(`/api/ai/insights/${testInsightId}/apply`)
        .expect(200);

      expect(response.body.message).toBe('Suggestion applied successfully');
      expect(response.body).toHaveProperty('insight');
    });

    it('should handle missing insight', async () => {
      const nonExistentId = 'nonexistent-insight-id';

      const response = await request(app)
        .post(`/api/ai/insights/${nonExistentId}/apply`)
        .expect(404);

      expect(response.body.message).toBe('Insight not found');
    });
  });
});
