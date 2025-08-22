import { DatabaseStorage } from '../../server/db-storage';

// Mock the entire drizzle setup
jest.mock('@neondatabase/serverless', () => ({
  neon: jest.fn(() => jest.fn()),
}));

jest.mock('drizzle-orm/neon-http', () => ({
  drizzle: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
  })),
}));

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((column, _value) => ({ column, value, type: 'eq' })),
  desc: jest.fn((column) => ({ column, type: 'desc' })),
}));

jest.mock('@shared/schema', () => ({
  users: {
    id: 'users.id',
    email: 'users.email',
  },
  organizations: {
    id: 'organizations.id',
    name: 'organizations.name',
  },
  buildings: {
    id: 'buildings.id',
    organizationId: 'buildings.organizationId',
    isActive: 'buildings.isActive',
  },
  residences: {
    id: 'residences.id',
    buildingId: 'residences.buildingId',
    isActive: 'residences.isActive',
  },
  developmentPillars: {
    id: 'developmentPillars.id',
  },
  workspaceStatus: {
    component: 'workspaceStatus.component',
    status: 'workspaceStatus.status',
    lastUpdated: 'workspaceStatus.lastUpdated',
  },
  qualityMetrics: {},
  frameworkConfiguration: {
    _key: 'frameworkConfiguration.key',
  },
  improvementSuggestions: {
    id: 'improvementSuggestions.id',
    status: 'improvementSuggestions.status',
    priority: 'improvementSuggestions.priority',
    createdAt: 'improvementSuggestions.createdAt',
  },
  features: {
    id: 'features.id',
    status: 'features.status',
    isPublicRoadmap: 'features.isPublicRoadmap',
  },
}));

describe('DatabaseStorage', () => {
  let dbStorage: DatabaseStorage;
  let _mockDb: unknown;

  beforeEach(() => {
    const { drizzle } = require('drizzle-orm/neon-http');
    _mockDb = drizzle();
    dbStorage = new DatabaseStorage();
    jest.clearAllMocks();
  });

  describe('User Operations', () => {
    it('should get all users', async () => {
      const mockUsers = [
        { id: '1', email: 'user1@test.com', firstName: 'User', lastName: 'One' },
        { id: '2', email: 'user2@test.com', firstName: 'User', lastName: 'Two' },
      ];

      // Mock the db chain to return our mock users
      require('drizzle-orm/neon-http').drizzle.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockResolvedValue(mockUsers),
      });

      const result = await dbStorage.getUsers();
      expect(_result).toEqual(mockUsers);
    });

    it('should get user by id', async () => {
      const mockUser = { id: '1', email: 'user@test.com', firstName: 'Test', lastName: 'User' };

      require('drizzle-orm/neon-http').drizzle.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockUser]),
      });

      const result = await dbStorage.getUser('1');
      expect(_result).toEqual(mockUser);
    });

    it('should get user by email', async () => {
      const mockUser = { id: '1', email: 'user@test.com', firstName: 'Test', lastName: 'User' };

      require('drizzle-orm/neon-http').drizzle.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockUser]),
      });

      const result = await dbStorage.getUserByEmail('user@test.com');
      expect(_result).toEqual(mockUser);
    });

    it('should create user', async () => {
      const userData = {
        email: 'new@test.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
      };
      const mockCreatedUser = { id: '1', ...userData };

      require('drizzle-orm/neon-http').drizzle.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockCreatedUser]),
      });

      const result = await dbStorage.createUser(userData as Parameters<typeof dbStorage.createUser>[0]);
      expect(_result).toEqual(mockCreatedUser);
    });

    it('should update user', async () => {
      const updates = { firstName: 'Updated', lastName: 'Name' };
      const mockUpdatedUser = { id: '1', email: 'user@test.com', ...updates };

      require('drizzle-orm/neon-http').drizzle.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockUpdatedUser]),
      });

      const result = await dbStorage.updateUser('1', updates);
      expect(_result).toEqual(mockUpdatedUser);
    });
  });

  describe('Organization Operations', () => {
    it('should get all organizations', async () => {
      const mockOrgs = [
        { id: '1', name: 'Org One', type: 'management_company' },
        { id: '2', name: 'Org Two', type: 'syndicate' },
      ];

      require('drizzle-orm/neon-http').drizzle.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockResolvedValue(mockOrgs),
      });

      const result = await dbStorage.getOrganizations();
      expect(_result).toEqual(mockOrgs);
    });

    it('should get buildings by organization', async () => {
      const mockBuildings = [
        { id: '1', name: 'Building One', organizationId: 'org1' },
        { id: '2', name: 'Building Two', organizationId: 'org1' },
      ];

      require('drizzle-orm/neon-http').drizzle.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(mockBuildings),
      });

      const result = await dbStorage.getBuildingsByOrganization('org1');
      expect(_result).toEqual(mockBuildings);
    });
  });

  describe('Feature Operations', () => {
    it('should get features by status', async () => {
      const mockFeatures = [
        { id: '1', name: 'Feature One', status: 'completed' },
        { id: '2', name: 'Feature Two', status: 'completed' },
      ];

      require('drizzle-orm/neon-http').drizzle.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(mockFeatures),
      });

      const result = await dbStorage.getFeaturesByStatus('completed');
      expect(_result).toEqual(mockFeatures);
    });

    it('should get public roadmap features', async () => {
      const mockFeatures = [{ id: '1', name: 'Public Feature', isPublicRoadmap: true }];

      require('drizzle-orm/neon-http').drizzle.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(mockFeatures),
      });

      const result = await dbStorage.getPublicRoadmapFeatures();
      expect(_result).toEqual(mockFeatures);
    });

    it('should delete feature', async () => {
      require('drizzle-orm/neon-http').drizzle.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: '1' }]),
      });

      const result = await dbStorage.deleteFeature('1');
      expect(_result).toBe(true);
    });
  });

  describe('Improvement Suggestions', () => {
    it('should clear new suggestions', async () => {
      require('drizzle-orm/neon-http').drizzle.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      });

      await expect(dbStorage.clearNewSuggestions()).resolves.toBeUndefined();
    });

    it('should get top suggestions with priority sorting', async () => {
      const mockSuggestions = [
        { id: '1', title: 'Critical Issue', priority: 'Critical', createdAt: new Date() },
        { id: '2', title: 'High Priority', priority: 'High', createdAt: new Date() },
        { id: '3', title: 'Medium Priority', priority: 'Medium', createdAt: new Date() },
      ];

      require('drizzle-orm/neon-http').drizzle.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(mockSuggestions),
      });

      const result = await dbStorage.getTopImprovementSuggestions(2);
      expect(_result).toHaveLength(2);
    });
  });
});
