/**
 * @file AI Monitoring API tests.
 * @description Test suite for AI monitoring endpoints and functionality.
 */

import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../server/routes';

// Mock database
jest.mock('../../server/db', () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    onConflictDoUpdate: jest.fn().mockReturnThis(),
  },
}));

// Mock schema
jest.mock('@shared/schema', () => ({
  aiInteractions: {},
  aiInsights: {},
  aiMetrics: {},
}));

describe('AI Monitoring API Tests', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerRoutes(app);
    jest.clearAllMocks();
  });

  describe('GET /api/ai/metrics', () => {
    it('should return AI metrics', async () => {
      const mockMetrics = {
        totalInteractions: 150,
        successRate: 95.5,
        avgResponseTime: 1250,
        improvementsSuggested: 12,
        improvementsImplemented: 8,
        categoriesAnalyzed: ['Replit App', 'Performance'],
        lastAnalysis: new Date().toISOString(),
        aiEfficiency: 87.3,
      };

      // Mock database response
      require('../../server/db').db.select.mockResolvedValueOnce([mockMetrics]);

      const response = await request(app)
        .get('/api/ai/metrics')
        .expect(200);

      expect(response.body).toMatchObject({
        totalInteractions: expect.any(Number),
        successRate: expect.any(Number),
        avgResponseTime: expect.any(Number),
      });
    });

    it('should handle missing metrics gracefully', async () => {
      // Mock empty database response
      require('../../server/db').db.select.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/ai/metrics')
        .expect(200);

      expect(response.body.totalInteractions).toBe(0);
      expect(response.body.successRate).toBe(0);
    });
  });

  describe('GET /api/ai/interactions', () => {
    it('should return recent AI interactions', async () => {
      const mockInteractions = [
        {
          id: 'test-id',
          action: 'Full System Analysis',
          category: 'Replit App',
          duration: 2500,
          status: 'success',
          improvement: 'Optimized query performance',
          impact: 'high',
          timestamp: new Date().toISOString(),
        },
      ];

      require('../../server/db').db.select.mockResolvedValueOnce(mockInteractions);

      const response = await request(app)
        .get('/api/ai/interactions')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        action: 'Full System Analysis',
        category: 'Replit App',
        status: 'success',
      });
    });
  });

  describe('POST /api/ai/analyze', () => {
    it('should trigger AI analysis successfully', async () => {
      // Mock database operations
      require('../../server/db').db.insert.mockResolvedValueOnce([{}]);

      const response = await request(app)
        .post('/api/ai/analyze')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'AI analysis triggered successfully',
        insightsGenerated: expect.any(Number),
      });
    });

    it('should handle analysis errors', async () => {
      // Mock database error
      require('../../server/db').db.insert.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/ai/analyze')
        .expect(500);

      expect(response.body._error).toBe('Failed to trigger AI analysis');
    });
  });

  describe('POST /api/ai/insights/:id/apply', () => {
    it('should apply AI suggestion successfully', async () => {
      const mockInsight = {
        id: 'test-insight-id',
        title: 'Optimize Database Queries',
        status: 'completed',
        implementedAt: new Date(),
      };

      require('../../server/db').db.update.mockResolvedValueOnce([mockInsight]);

      const response = await request(app)
        .post('/api/ai/insights/test-insight-id/apply')
        .expect(200);

      expect(response.body.message).toBe('Suggestion applied successfully');
      expect(response.body.insight.status).toBe('completed');
    });

    it('should handle missing insight', async () => {
      require('../../server/db').db.update.mockResolvedValueOnce([]);

      const response = await request(app)
        .post('/api/ai/insights/nonexistent/apply')
        .expect(404);

      expect(response.body._error).toBe('Insight not found');
    });
  });
});