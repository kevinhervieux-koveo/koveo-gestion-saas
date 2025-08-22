import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../server/routes';
import { storage } from '../../server/storage';

jest.mock('../../server/storage', () => ({
  storage: {
    getFeatures: jest.fn(),
    getFeaturesByCategory: jest.fn(),
    getFeaturesByStatus: jest.fn(),
    getOrganizations: jest.fn(),
    getUsers: jest.fn(),
    createUser: jest.fn(),
    getPillars: jest.fn(),
    getWorkspaceStatuses: jest.fn(),
    getQualityMetrics: jest.fn(),
    getImprovementSuggestions: jest.fn(),
    getTopImprovementSuggestions: jest.fn(),
  },
}));

const mockStorage = storage as jest.Mocked<typeof storage>;

describe('Routes Integration Tests', () => {
  let app: express.Express;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    await registerRoutes(app);
    jest.clearAllMocks();
  });

  describe('GET /api/features', () => {
    it('should return all features', async () => {
      const mockFeatures = [
        { id: '1', name: 'Feature 1', status: 'completed', category: 'core' },
        { id: '2', name: 'Feature 2', status: 'in-progress', category: 'ui' },
      ];
      mockStorage.getFeatures.mockResolvedValue(mockFeatures as any);

      const response = await request(app).get('/api/features').expect(200);

      expect(response.body).toEqual(mockFeatures);
      expect(mockStorage.getFeatures).toHaveBeenCalledTimes(1);
    });

    it('should filter features by roadmap=true', async () => {
      const mockFeatures = [{ id: '1', name: 'Public Feature', isPublicRoadmap: true }];
      mockStorage.getFeatures.mockResolvedValue(mockFeatures as any);

      await request(app).get('/api/features?roadmap=true').expect(200);

      expect(mockStorage.getFeatures).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /api/organizations', () => {
    it('should return all organizations', async () => {
      const mockOrgs = [
        { id: '1', name: 'Org 1', type: 'management_company' },
        { id: '2', name: 'Org 2', type: 'syndicate' },
      ];
      mockStorage.getOrganizations.mockResolvedValue(mockOrgs as any);

      const response = await request(app).get('/api/organizations').expect(200);

      expect(response.body).toEqual(mockOrgs);
      expect(mockStorage.getOrganizations).toHaveBeenCalledTimes(1);
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.getOrganizations.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/organizations').expect(500);

      expect(response.body).toMatchObject({
        message: 'Failed to fetch organizations',
      });
    });
  });

  describe('GET /api/users', () => {
    it('should return all users', async () => {
      const mockUsers = [
        { id: '1', firstName: 'Marie', lastName: 'Tremblay', email: 'marie@test.ca' },
        { id: '2', firstName: 'Jean', lastName: 'Dupuis', email: 'jean@test.ca' },
      ];
      mockStorage.getUsers.mockResolvedValue(mockUsers as any);

      const response = await request(app).get('/api/users').expect(200);

      expect(response.body).toEqual(mockUsers);
      expect(mockStorage.getUsers).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /api/pillars', () => {
    it('should return development pillars', async () => {
      const mockPillars = [
        { id: '1', name: 'Testing Pillar', status: 'completed', order: '1' },
        { id: '2', name: 'Security Pillar', status: 'in-progress', order: '2' },
      ];
      mockStorage.getPillars.mockResolvedValue(mockPillars as any);

      const response = await request(app).get('/api/pillars').expect(200);

      expect(response.body).toEqual(mockPillars);
    });
  });

  describe('GET /api/workspace-status', () => {
    it('should return workspace status', async () => {
      const mockStatus = [
        { component: 'Environment Setup', status: 'complete' },
        { component: 'Testing Framework', status: 'in-progress' },
      ];
      mockStorage.getWorkspaceStatuses.mockResolvedValue(mockStatus as any);

      const response = await request(app).get('/api/workspace-status').expect(200);

      expect(response.body).toEqual(mockStatus);
    });
  });

  describe('GET /api/quality-metrics', () => {
    it('should return quality metrics', async () => {
      const mockMetrics = [
        { metricType: 'Code Coverage', _value: '95%' },
        { metricType: 'Code Quality', _value: 'A+' },
      ];
      mockStorage.getQualityMetrics.mockResolvedValue(mockMetrics as any);

      const response = await request(app).get('/api/quality-metrics').expect(200);

      expect(response.body).toEqual(mockMetrics);
    });
  });

  describe('GET /api/pillars/suggestions', () => {
    it('should return improvement suggestions', async () => {
      const mockSuggestions = [
        { id: '1', title: 'Improve Testing', priority: 'High', status: 'New' },
        { id: '2', title: 'Add Documentation', priority: 'Medium', status: 'New' },
      ];
      mockStorage.getTopImprovementSuggestions.mockResolvedValue(mockSuggestions as any);

      const response = await request(app).get('/api/pillars/suggestions').expect(200);

      expect(response.body).toEqual(mockSuggestions);
      expect(mockStorage.getTopImprovementSuggestions).toHaveBeenCalledWith(20);
    });
  });
});
