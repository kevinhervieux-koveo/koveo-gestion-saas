/**
 * @file Simple Feature Management API tests
 * @description Isolated tests for feature management functionality
 */

import request from 'supertest';
import express from 'express';

// Create a mock pool instance first
const mockPool = {
  query: jest.fn(),
};

// Mock all database dependencies first
jest.mock('@neondatabase/serverless', () => ({
  Pool: jest.fn(() => mockPool),
  neonConfig: { webSocketConstructor: null },
}));

jest.mock('../../server/db', () => ({ db: {} }));
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
import { registerFeatureManagementRoutes } from '../../server/api/feature-management';

describe('Feature Management API Tests (Isolated)', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Register only the routes we need
    registerFeatureManagementRoutes(app);
    
    jest.clearAllMocks();
    mockPool.query.mockClear();
  });

  describe('POST /api/features/:id/update-status', () => {
    it('should update feature status successfully', async () => {
      const mockFeature = {
        id: 'test-feature-id',
        status: 'in-progress',
        is_public_roadmap: false,
        is_strategic_path: false,
        business_objective: 'Test objective',
        target_users: 'Test users',  
        success_metrics: 'Test metrics',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockFeature] });

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
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/features/test-feature-id/update-status')
        .send({ status: 'completed' })
        .expect(404);

      expect(response.body.message).toBe('Feature not found');
    });
  });

  describe('POST /api/features/:id/toggle-strategic', () => {
    it('should toggle strategic path to true', async () => {
      const mockFeature = {
        id: 'test-feature-id',
        is_strategic_path: true,
        is_public_roadmap: false,
        status: 'planned',
        business_objective: 'Test',
        target_users: 'Test',
        success_metrics: 'Test',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockFeature] });

      const response = await request(app)
        .post('/api/features/test-feature-id/toggle-strategic')
        .send({ isStrategicPath: true })
        .expect(200);

      expect(response.body.isStrategicPath).toBe(true);
    });

    it('should reject non-boolean values', async () => {
      const response = await request(app)
        .post('/api/features/test-feature-id/toggle-strategic')
        .send({ isStrategicPath: 'invalid' })
        .expect(400);

      expect(response.body.message).toBe('isStrategicPath must be a boolean');
    });
  });

  describe('POST /api/features/:id/analyze', () => {
    it('should analyze feature with proper status', async () => {
      const mockFeature = {
        id: 'test-feature-id',
        status: 'in-progress',
        is_public_roadmap: false,
        is_strategic_path: false,
        business_objective: 'Test',
        target_users: 'Test',
        success_metrics: 'Test',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const analyzedFeature = { ...mockFeature, status: 'ai-analyzed' };

      // Mock check query (feature exists and has correct status)
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockFeature] })  // Check query
        .mockResolvedValueOnce({ rows: [analyzedFeature] }); // Update query

      const response = await request(app)
        .post('/api/features/test-feature-id/analyze')
        .expect(200);

      expect(response.body.message).toBe('Analysis completed successfully');
      expect(response.body.feature.status).toBe('ai-analyzed');
    });

    it('should reject analysis for wrong status', async () => {
      const mockFeature = {
        id: 'test-feature-id',
        status: 'completed', // Wrong status for analysis
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockFeature] });

      const response = await request(app)
        .post('/api/features/test-feature-id/analyze')
        .expect(400);

      expect(response.body.message).toContain('must be in "in-progress" status');
    });
  });
});