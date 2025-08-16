/**
 * @file Feature Management tests
 * @description Test suite for feature status and strategic path functionality
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
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
  },
}));

jest.mock('@shared/schema', () => ({
  features: {},
  actionableItems: {},
}));

describe('Feature Management API Tests', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerRoutes(app);
    jest.clearAllMocks();
  });

  describe('POST /api/features/:id/update-status', () => {
    it('should update feature status successfully', async () => {
      const mockFeature = {
        id: 'test-feature-id',
        name: 'Test Feature',
        status: 'in-progress',
        updatedAt: new Date(),
      };

      require('../../server/db').db.update.mockResolvedValueOnce([mockFeature]);

      const response = await request(app)
        .post('/api/features/test-feature-id/update-status')
        .send({ status: 'in-progress' })
        .expect(200);

      expect(response.body.status).toBe('in-progress');
      expect(response.body.id).toBe('test-feature-id');
    });

    it('should reject invalid status values', async () => {
      const response = await request(app)
        .post('/api/features/test-feature-id/update-status')
        .send({ status: 'invalid-status' })
        .expect(400);

      expect(response.body.message).toBe('Invalid status');
    });

    it('should handle feature not found', async () => {
      require('../../server/db').db.update.mockResolvedValueOnce([]);

      const response = await request(app)
        .post('/api/features/test-feature-id/update-status')
        .send({ status: 'completed' })
        .expect(404);

      expect(response.body.message).toBe('Feature not found');
    });

    it('should accept all valid status values', async () => {
      const validStatuses = ['submitted', 'planned', 'in-progress', 'ai-analyzed', 'completed', 'cancelled'];
      
      for (const status of validStatuses) {
        const mockFeature = { id: 'test-id', status, updatedAt: new Date() };
        require('../../server/db').db.update.mockResolvedValueOnce([mockFeature]);

        await request(app)
          .post('/api/features/test-id/update-status')
          .send({ status })
          .expect(200);
      }
    });
  });

  describe('POST /api/features/:id/toggle-strategic', () => {
    it('should toggle strategic path to true', async () => {
      const mockFeature = {
        id: 'test-feature-id',
        name: 'Test Feature',
        isStrategicPath: true,
        updatedAt: new Date(),
      };

      require('../../server/db').db.update.mockResolvedValueOnce([mockFeature]);

      const response = await request(app)
        .post('/api/features/test-feature-id/toggle-strategic')
        .send({ isStrategicPath: true })
        .expect(200);

      expect(response.body.isStrategicPath).toBe(true);
    });

    it('should toggle strategic path to false', async () => {
      const mockFeature = {
        id: 'test-feature-id',
        name: 'Test Feature',
        isStrategicPath: false,
        updatedAt: new Date(),
      };

      require('../../server/db').db.update.mockResolvedValueOnce([mockFeature]);

      const response = await request(app)
        .post('/api/features/test-feature-id/toggle-strategic')
        .send({ isStrategicPath: false })
        .expect(200);

      expect(response.body.isStrategicPath).toBe(false);
    });

    it('should reject non-boolean values', async () => {
      const response = await request(app)
        .post('/api/features/test-feature-id/toggle-strategic')
        .send({ isStrategicPath: 'invalid' })
        .expect(400);

      expect(response.body.message).toBe('isStrategicPath must be a boolean');
    });

    it('should handle feature not found', async () => {
      require('../../server/db').db.update.mockResolvedValueOnce([]);

      const response = await request(app)
        .post('/api/features/test-feature-id/toggle-strategic')
        .send({ isStrategicPath: true })
        .expect(404);

      expect(response.body.message).toBe('Feature not found');
    });

    it('should handle database errors gracefully', async () => {
      require('../../server/db').db.update.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/features/test-feature-id/toggle-strategic')
        .send({ isStrategicPath: true })
        .expect(500);

      expect(response.body.message).toBe('Failed to update strategic path');
    });
  });

  describe('Feature Analysis Integration', () => {
    it('should analyze feature with proper status', async () => {
      const mockFeature = {
        id: 'test-feature-id',
        name: 'SSL Management',
        status: 'in-progress',
        businessObjective: 'Secure connections',
        targetUsers: 'Property managers',
        successMetrics: 'Auto renewal',
        technicalComplexity: 'Medium',
        dependencies: 'Certificate authorities',
        userFlow: 'Automatic process',
      };

      require('../../server/db').db.select.mockResolvedValueOnce([mockFeature]);

      // Mock Gemini analysis
      jest.doMock('../../server/services/gemini-analysis', () => ({
        analyzeFeatureWithGemini: jest.fn().mockResolvedValue({
          summary: 'SSL certificate management feature',
          actionableItems: [
            {
              title: '1. Create SSL Certificate Database Table',
              description: 'Database table for certificates',
              technicalDetails: 'Use Drizzle ORM',
              implementationPrompt: 'Add ssl_certificates table',
              testingRequirements: 'Migration tests',
              estimatedEffort: '1 day',
            },
          ],
          recommendations: ['Use certificate manager'],
          estimatedTotalEffort: '8 days',
        }),
        formatActionableItemsForDatabase: jest.fn().mockReturnValue([]),
        getDocumentationContext: jest.fn().mockResolvedValue('Koveo Gestion context'),
      }));

      const response = await request(app)
        .post('/api/features/test-feature-id/analyze')
        .expect(200);

      expect(response.body.message).toBe('Analysis completed successfully');
    });

    it('should reject analysis for wrong status', async () => {
      const mockFeature = {
        id: 'test-feature-id',
        status: 'submitted', // Wrong status
      };

      require('../../server/db').db.select.mockResolvedValueOnce([mockFeature]);

      const response = await request(app)
        .post('/api/features/test-feature-id/analyze')
        .expect(400);

      expect(response.body.message).toContain('must be in "in-progress" status');
    });
  });
});