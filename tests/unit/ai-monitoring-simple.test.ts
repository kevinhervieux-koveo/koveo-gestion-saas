/**
 * @file Simple AI Monitoring API tests
 * @description Isolated tests for AI monitoring functionality
 */

import request from 'supertest';
import express from 'express';

// Mock all database dependencies first
jest.mock('@neondatabase/serverless', () => ({
  Pool: jest.fn(),
  neonConfig: { webSocketConstructor: null },
}));

jest.mock('../../server/db', () => ({ 
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
  }
}));

jest.mock('../../server/storage', () => ({ storage: {} }));

// Mock auth middleware
jest.mock('../../server/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user', role: 'admin' };
    next();
  },
  requireRole: (role: string) => (req: any, res: any, next: any) => {
    req.user = { id: 'test-user', role };
    next();
  },
}));

// Import the specific routes we want to test
import { registerAIMonitoringRoutes } from '../../server/api/ai-monitoring';

describe('AI Monitoring API Tests (Isolated)', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Register only the routes we need
    registerAIMonitoringRoutes(app);
    
    jest.clearAllMocks();
  });

  describe('GET /api/ai/metrics', () => {
    it('should return AI metrics successfully', async () => {
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

      const { db } = require('../../server/db');
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockMetrics]),
      });

      const response = await request(app)
        .get('/api/ai/metrics')
        .expect(200);

      expect(response.body.totalInteractions).toBe(150);
      expect(response.body.successRate).toBe(95.5);
    });
  });

  describe('POST /api/ai/analyze', () => {
    it('should trigger AI analysis successfully', async () => {
      const response = await request(app)
        .post('/api/ai/analyze')
        .expect(200);

      expect(response.body.message).toBe('AI analysis triggered successfully');
      expect(response.body.insightsGenerated).toBeGreaterThan(0);
      expect(response.body.insightsGenerated).toBeLessThan(6);
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

      const { db } = require('../../server/db');
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockInsight]),
      });
      db.update.mockReturnValueOnce({
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockInsight]),
      });

      const response = await request(app)
        .post('/api/ai/insights/test-insight-id/apply')
        .expect(200);

      expect(response.body.message).toBe('Suggestion applied successfully');
      expect(response.body.insight.status).toBe('completed');
    });

    it('should handle missing insight', async () => {
      const { db } = require('../../server/db');
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]), // No insight found
      });

      const response = await request(app)
        .post('/api/ai/insights/nonexistent/apply')
        .expect(404);

      expect(response.body._error).toBe('Insight not found');
    });
  });
});