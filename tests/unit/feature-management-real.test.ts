/**
 * @file Feature Management tests with real data.
 * @description Test suite for feature status and strategic path functionality using Demo Organization data.
 */

import request from 'supertest';
import express from 'express';
import { registerFeatureManagementRoutes } from '../../server/api/feature-management';
import { db } from '../../server/db';
import { features } from '../../shared/schemas/development';
import { eq } from 'drizzle-orm';

// Mock only auth middleware to use test user
jest.mock('../../server/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user', role: 'admin' };
    next();
  },
}));

describe('Feature Management API Tests (Real Data)', () => {
  let app: express.Express;
  let testFeatureIds: string[] = [];

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    registerFeatureManagementRoutes(app);

    // Create test features for testing
    const testFeatures = await db
      .insert(features)
      .values([
        {
          name: 'Test Feature Status Update',
          description: 'Test feature for status updates',
          category: 'Property Management',
          status: 'submitted',
          isPublicRoadmap: false,
          isStrategicPath: false,
          businessObjective: 'Test API functionality',
          targetUsers: 'Development team',
          successMetrics: 'All tests passing',
        },
        {
          name: 'Test Feature Strategic Path',
          description: 'Test feature for strategic path testing',
          category: 'Property Management',
          status: 'in-progress',
          isPublicRoadmap: false,
          isStrategicPath: false,
          businessObjective: 'Test strategic path functionality',
          targetUsers: 'Development team',
          successMetrics: 'Strategic path toggles correctly',
        },
      ])
      .returning({ id: features.id });

    testFeatureIds = testFeatures.map((f) => f.id);
  });

  afterAll(async () => {
    // Clean up test data
    for (const featureId of testFeatureIds) {
      await db.delete(features).where(eq(features.id, featureId));
    }
  });

  describe('POST /api/features/:id/update-status', () => {
    it('should update feature status successfully', async () => {
      const featureId = testFeatureIds[0];

      const response = await request(app)
        .post(`/api/features/${featureId}/update-status`)
        .send({ status: 'in-progress' })
        .expect(200);

      expect(response.body.status).toBe('in-progress');
      expect(response.body.id).toBe(featureId);

      // Verify in database
      const [updatedFeature] = await db.select().from(features).where(eq(features.id, featureId));
      expect(updatedFeature.status).toBe('in-progress');
    });

    it('should reject invalid status values', async () => {
      const featureId = testFeatureIds[0];

      const response = await request(app)
        .post(`/api/features/${featureId}/update-status`)
        .send({ status: 'invalid-status' })
        .expect(400);

      expect(response.body.message).toBe('Invalid status');
    });

    it('should handle feature not found', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .post(`/api/features/${nonExistentId}/update-status`)
        .send({ status: 'completed' })
        .expect(404);

      expect(response.body.message).toBe('Feature not found');
    });

    it('should accept all valid status values', async () => {
      const featureId = testFeatureIds[0];
      const validStatuses = [
        'submitted',
        'planned',
        'in-progress',
        'ai-analyzed',
        'completed',
        'cancelled',
      ];

      for (const status of validStatuses) {
        await request(app)
          .post(`/api/features/${featureId}/update-status`)
          .send({ status })
          .expect(200);

        // Verify in database
        const [updatedFeature] = await db.select().from(features).where(eq(features.id, featureId));
        expect(updatedFeature.status).toBe(status);
      }
    });
  });

  describe('POST /api/features/:id/toggle-strategic', () => {
    it('should toggle strategic path to true', async () => {
      const featureId = testFeatureIds[1];

      const response = await request(app)
        .post(`/api/features/${featureId}/toggle-strategic`)
        .send({ isStrategicPath: true })
        .expect(200);

      expect(response.body.isStrategicPath).toBe(true);

      // Verify in database
      const [updatedFeature] = await db.select().from(features).where(eq(features.id, featureId));
      expect(updatedFeature.isStrategicPath).toBe(true);
    });

    it('should toggle strategic path to false', async () => {
      const featureId = testFeatureIds[1];

      const response = await request(app)
        .post(`/api/features/${featureId}/toggle-strategic`)
        .send({ isStrategicPath: false })
        .expect(200);

      expect(response.body.isStrategicPath).toBe(false);

      // Verify in database
      const [updatedFeature] = await db.select().from(features).where(eq(features.id, featureId));
      expect(updatedFeature.isStrategicPath).toBe(false);
    });

    it('should reject non-boolean values', async () => {
      const featureId = testFeatureIds[1];

      const response = await request(app)
        .post(`/api/features/${featureId}/toggle-strategic`)
        .send({ isStrategicPath: 'invalid' })
        .expect(400);

      expect(response.body.message).toBe('isStrategicPath must be a boolean');
    });

    it('should handle feature not found', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .post(`/api/features/${nonExistentId}/toggle-strategic`)
        .send({ isStrategicPath: true })
        .expect(404);

      expect(response.body.message).toBe('Feature not found');
    });
  });

  describe('POST /api/features/:id/analyze', () => {
    it('should analyze feature with proper status', async () => {
      const featureId = testFeatureIds[1]; // This one is in 'in-progress' status

      // Make sure it's in correct status
      await request(app)
        .post(`/api/features/${featureId}/update-status`)
        .send({ status: 'in-progress' })
        .expect(200);

      const response = await request(app).post(`/api/features/${featureId}/analyze`).expect(200);

      expect(response.body.message).toBe('Analysis completed successfully');
      expect(response.body.feature.status).toBe('ai-analyzed');

      // Verify in database
      const [updatedFeature] = await db.select().from(features).where(eq(features.id, featureId));
      expect(updatedFeature.status).toBe('ai-analyzed');
    });

    it('should reject analysis for wrong status', async () => {
      const featureId = testFeatureIds[0];

      // Set to wrong status first
      await request(app)
        .post(`/api/features/${featureId}/update-status`)
        .send({ status: 'submitted' })
        .expect(200);

      const response = await request(app).post(`/api/features/${featureId}/analyze`).expect(400);

      expect(response.body.message).toContain('must be in "in-progress" status');
    });

    it('should handle feature not found', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .post(`/api/features/${nonExistentId}/analyze`)
        .expect(404);

      expect(response.body.message).toBe('Feature not found');
    });
  });
});
