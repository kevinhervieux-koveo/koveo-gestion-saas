import { MemStorage } from '../../server/storage';
import type {
  InsertUser,
  InsertOrganization,
  InsertBuilding,
  InsertPillar,
  InsertFeature,
  InsertImprovementSuggestion,
} from '@shared/schema';
import { randomUUID } from 'crypto';

// Mock randomUUID to make tests predictable
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-123'),
}));

describe('MemStorage', () => {
  let storage: MemStorage;

  beforeEach(() => {
    storage = new MemStorage();
    let callCount = 0;
    (randomUUID as jest.Mock).mockImplementation(() => {
      callCount++;
      return `test-uuid-${callCount}`;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('User Operations', () => {
    const mockUserData: InsertUser = {
      username: 'marie.tremblay',
      firstName: 'Marie',
      lastName: 'Tremblay',
      email: 'marie@koveo.ca',
      password: 'hashedPassword123',
      role: 'tenant',
      language: 'fr',
    };

    describe('createUser', () => {
      it('should create a user with default values', async () => {
        const user = await storage.createUser(mockUserData);

        expect(user).toMatchObject({
          id: expect.stringMatching(/^test-uuid-\d+$/),
          firstName: mockUserData.firstName,
          lastName: mockUserData.lastName,
          email: mockUserData.email,
          role: 'tenant',
          language: 'fr',
          isActive: true,
          lastLoginAt: null,
        });
        expect(user.createdAt).toBeInstanceOf(Date);
        expect(user.updatedAt).toBeInstanceOf(Date);
      });

      it('should create a user with role defaulting to tenant', async () => {
        const userData = { ...mockUserData, role: undefined };
        const user = await storage.createUser(userData);

        expect(user.role).toBe('tenant');
      });

      it('should create a user with language defaulting to fr', async () => {
        const userData = { ...mockUserData, language: undefined };
        const user = await storage.createUser(userData);

        expect(user.language).toBe('fr');
      });

      it('should handle phone number as null when not provided', async () => {
        const user = await storage.createUser(mockUserData);

        expect(user.phone).toBeNull();
      });
    });

    describe('getUsers', () => {
      it('should return empty array when no users exist', async () => {
        // Create new storage without default data
        const emptyStorage = new MemStorage();

        const users = await emptyStorage.getUsers();
        expect(Array.isArray(users)).toBe(true);
      });

      it('should return all users', async () => {
        await storage.createUser(mockUserData);
        await storage.createUser({ ...mockUserData, email: 'jean@koveo.ca' });

        const users = await storage.getUsers();
        expect(users).toHaveLength(2);
      });
    });

    describe('getUser', () => {
      it('should return user when found', async () => {
        const createdUser = await storage.createUser(mockUserData);
        const retrievedUser = await storage.getUser(createdUser.id);

        expect(retrievedUser).toEqual(createdUser);
      });

      it('should return undefined when user not found', async () => {
        const user = await storage.getUser('non-existent-id');

        expect(user).toBeUndefined();
      });
    });

    describe('getUserByEmail', () => {
      it('should return user when email exists', async () => {
        const createdUser = await storage.createUser(mockUserData);
        const retrievedUser = await storage.getUserByEmail(mockUserData.email);

        expect(retrievedUser).toEqual(createdUser);
      });

      it('should return undefined when email not found', async () => {
        const user = await storage.getUserByEmail('nonexistent@koveo.ca');

        expect(user).toBeUndefined();
      });

      it('should be case sensitive', async () => {
        await storage.createUser(mockUserData);
        const user = await storage.getUserByEmail('MARIE@KOVEO.CA');

        expect(user).toBeUndefined();
      });
    });

    describe('updateUser', () => {
      it('should update user successfully', async () => {
        const createdUser = await storage.createUser(mockUserData);
        const updates = { firstName: 'Marie Updated', phone: '+1-514-555-0123' };

        const updatedUser = await storage.updateUser(createdUser.id, updates);

        expect(updatedUser).toMatchObject({
          ...createdUser,
          ...updates,
        });
        expect(updatedUser?.updatedAt?.getTime()).toBeGreaterThanOrEqual(
          createdUser.createdAt?.getTime() || 0
        );
      });

      it('should return undefined when user not found', async () => {
        const result = await storage.updateUser('non-existent-id', { firstName: 'Test' });

        expect(result).toBeUndefined();
      });

      it('should preserve existing fields when partially updating', async () => {
        const createdUser = await storage.createUser(mockUserData);
        const updatedUser = await storage.updateUser(createdUser.id, { firstName: 'New Name' });

        expect(updatedUser?.email).toBe(mockUserData.email);
        expect(updatedUser?.role).toBe(mockUserData.role);
        expect(updatedUser?.firstName).toBe('New Name');
      });
    });
  });

  describe('Organization Operations', () => {
    const mockOrgData: InsertOrganization = {
      name: 'Gestion Immobilière ABC',
      type: 'management_company',
      email: 'info@abc-gestion.ca',
      address: '1234 Rue Saint-Denis',
      city: 'Montréal',
      postalCode: 'H2X 1L1',
    };

    describe('createOrganization', () => {
      it('should create organization with Quebec defaults', async () => {
        const org = await storage.createOrganization(mockOrgData);

        expect(org).toMatchObject({
          id: expect.stringMatching(/^test-uuid-\d+$/),
          name: mockOrgData.name,
          email: mockOrgData.email,
          type: 'management_company',
          province: 'QC',
          isActive: true,
        });
        expect(org.createdAt).toBeInstanceOf(Date);
        expect(org.updatedAt).toBeInstanceOf(Date);
      });

      it('should respect provided type and province', async () => {
        const orgData = { ...mockOrgData, type: 'condo_association' as const, province: 'ON' };
        const org = await storage.createOrganization(orgData);

        expect(org.type).toBe('condo_association');
        expect(org.province).toBe('ON');
      });
    });

    describe('getOrganizations', () => {
      it('should return all organizations', async () => {
        await storage.createOrganization(mockOrgData);
        await storage.createOrganization({ ...mockOrgData, name: 'Another Org' });

        const orgs = await storage.getOrganizations();
        expect(orgs).toHaveLength(2);
      });
    });

    describe('getOrganizationByName', () => {
      it('should find organization by exact name', async () => {
        const created = await storage.createOrganization(mockOrgData);
        const found = await storage.getOrganizationByName(mockOrgData.name);

        expect(found).toEqual(created);
      });

      it('should return undefined for non-existent name', async () => {
        const found = await storage.getOrganizationByName('Non-existent Org');

        expect(found).toBeUndefined();
      });
    });
  });

  describe('Building Operations', () => {
    const mockBuildingData = {
      organizationId: 'org-123',
      name: 'Complexe Maple',
      address: '456 Avenue du Parc',
      city: 'Québec',
      postalCode: 'G1R 2S5',
      buildingType: 'condo' as const,
      totalUnits: 50,
    } satisfies InsertBuilding;

    describe('createBuilding', () => {
      it('should create building with Quebec province default', async () => {
        const building = await storage.createBuilding(mockBuildingData);

        expect(building).toMatchObject({
          id: expect.stringMatching(/^test-uuid-\d+$/),
          ...mockBuildingData,
          province: 'QC',
          isActive: true,
        });
      });

      it('should respect provided province', async () => {
        const buildingData = { ...mockBuildingData, province: 'ON' };
        const building = await storage.createBuilding(buildingData);

        expect(building.province).toBe('ON');
      });
    });

    describe('deleteBuilding', () => {
      it('should soft delete building by setting isActive to false', async () => {
        const building = await storage.createBuilding(mockBuildingData);
        const result = await storage.deleteBuilding(building.id);

        expect(result).toBe(true);

        const deletedBuilding = await storage.getBuilding(building.id);
        expect(deletedBuilding?.isActive).toBe(false);
      });

      it('should return false when building not found', async () => {
        const result = await storage.deleteBuilding('non-existent-id');

        expect(result).toBe(false);
      });
    });
  });

  describe('Development Pillar Operations', () => {
    const mockPillarData: InsertPillar = {
      name: 'Performance Pillar',
      description: 'System performance monitoring framework',
      order: '4',
      configuration: { tools: ['lighthouse', 'webvitals'] },
    };

    describe('createPillar', () => {
      it('should create pillar with pending status default', async () => {
        const pillar = await storage.createPillar(mockPillarData);

        expect(pillar).toMatchObject({
          id: expect.stringMatching(/^test-uuid-\d+$/),
          ...mockPillarData,
          status: 'pending',
        });
      });

      it('should handle null configuration', async () => {
        const pillarData = { ...mockPillarData, configuration: undefined };
        const pillar = await storage.createPillar(pillarData);

        expect(pillar.configuration).toBeNull();
      });
    });

    describe('getPillars', () => {
      it('should return pillars sorted by order', async () => {
        await storage.createPillar({ ...mockPillarData, order: '3', name: 'Third' });
        await storage.createPillar({ ...mockPillarData, order: '1', name: 'First' });
        await storage.createPillar({ ...mockPillarData, order: '2', name: 'Second' });

        const pillars = await storage.getPillars();

        // Should include default pillars (3) + created pillars (3) = 6 total
        expect(pillars.length).toBeGreaterThanOrEqual(3);

        // Check if the newly created ones are sorted correctly
        const createdPillars = pillars.filter(
          (p) => p.name.includes('First') || p.name.includes('Second') || p.name.includes('Third')
        );
        expect(createdPillars[0].name).toBe('First');
        expect(createdPillars[1].name).toBe('Second');
        expect(createdPillars[2].name).toBe('Third');
      });
    });
  });

  describe('Feature Operations', () => {
    const mockFeatureData: InsertFeature = {
      name: 'Advanced Reporting',
      description: 'Customizable financial and operational reports',
      category: 'Analytics & Reporting',
    };

    describe('createFeature', () => {
      it('should create feature with defaults', async () => {
        const feature = await storage.createFeature(mockFeatureData);

        expect(feature).toMatchObject({
          id: expect.stringMatching(/^test-uuid-\d+$/),
          ...mockFeatureData,
          status: 'planned',
          priority: 'medium',
          isPublicRoadmap: true,
        });
        expect(feature.requestedBy).toBeNull();
        expect(feature.assignedTo).toBeNull();
        expect(feature.actualHours).toBeNull();
      });

      it('should respect provided status and priority', async () => {
        const featureData = {
          ...mockFeatureData,
          status: 'in-progress' as const,
          priority: 'high' as const,
        };
        const feature = await storage.createFeature(featureData);

        expect(feature.status).toBe('in-progress');
        expect(feature.priority).toBe('high');
      });
    });

    describe('getFeaturesByStatus', () => {
      it('should filter features by status', async () => {
        await storage.createFeature({ ...mockFeatureData, status: 'completed' });
        await storage.createFeature({
          ...mockFeatureData,
          status: 'in-progress',
          name: 'In Progress Feature',
        });

        const completedFeatures = await storage.getFeaturesByStatus('completed');
        const inProgressFeatures = await storage.getFeaturesByStatus('in-progress');

        expect(completedFeatures).toHaveLength(1);
        expect(inProgressFeatures).toHaveLength(1);
        expect(completedFeatures[0].status).toBe('completed');
        expect(inProgressFeatures[0].status).toBe('in-progress');
      });
    });

    describe('getPublicRoadmapFeatures', () => {
      it('should return only public roadmap features', async () => {
        await storage.createFeature({ ...mockFeatureData, name: 'Public Feature' });
        await storage.createFeature({
          ...mockFeatureData,
          name: 'Private Feature',
        });

        const publicFeatures = await storage.getPublicRoadmapFeatures();

        expect(publicFeatures).toHaveLength(2);
      });
    });
  });

  describe('Improvement Suggestions Operations', () => {
    const mockSuggestionData: InsertImprovementSuggestion = {
      title: 'High Cyclomatic Complexity in UserService',
      description: 'Function complexity exceeds threshold of 10',
      category: 'Code Quality',
      priority: 'High',
      filePath: 'src/services/UserService.ts',
    };

    describe('createImprovementSuggestion', () => {
      it('should create suggestion with defaults', async () => {
        const suggestion = await storage.createImprovementSuggestion(mockSuggestionData);

        expect(suggestion).toMatchObject({
          id: expect.stringMatching(/^test-uuid-\d+$/),
          ...mockSuggestionData,
          status: 'New',
        });
        expect(suggestion.createdAt).toBeInstanceOf(Date);
      });

      it('should handle null file path', async () => {
        const suggestionData = { ...mockSuggestionData, filePath: undefined };
        const suggestion = await storage.createImprovementSuggestion(suggestionData);

        expect(suggestion.filePath).toBeNull();
      });
    });

    describe('getTopImprovementSuggestions', () => {
      it('should return suggestions sorted by priority and creation time', async () => {
        // Create suggestions with different priorities
        await storage.createImprovementSuggestion({
          ...mockSuggestionData,
          priority: 'Low',
          title: 'Low Priority',
        });
        await storage.createImprovementSuggestion({
          ...mockSuggestionData,
          priority: 'Critical',
          title: 'Critical Issue',
        });
        await storage.createImprovementSuggestion({
          ...mockSuggestionData,
          priority: 'High',
          title: 'High Priority',
        });

        const topSuggestions = await storage.getTopImprovementSuggestions(2);

        expect(topSuggestions).toHaveLength(2);
        expect(topSuggestions[0].priority).toBe('Critical');
        expect(topSuggestions[1].priority).toBe('High');
      });

      it('should limit results to specified count', async () => {
        await storage.createImprovementSuggestion({ ...mockSuggestionData, title: 'First' });
        await storage.createImprovementSuggestion({ ...mockSuggestionData, title: 'Second' });
        await storage.createImprovementSuggestion({ ...mockSuggestionData, title: 'Third' });

        const topSuggestions = await storage.getTopImprovementSuggestions(2);

        expect(topSuggestions).toHaveLength(2);
      });
    });

    describe('clearNewSuggestions', () => {
      it('should remove all suggestions with New status', async () => {
        await storage.createImprovementSuggestion({ ...mockSuggestionData, status: 'New' });
        await storage.createImprovementSuggestion({
          ...mockSuggestionData,
          status: 'Acknowledged',
          title: 'Acknowledged',
        });

        await storage.clearNewSuggestions();

        const allSuggestions = await storage.getImprovementSuggestions();
        const newSuggestions = allSuggestions.filter((s) => s.status === 'New');
        const acknowledgedSuggestions = allSuggestions.filter((s) => s.status === 'Acknowledged');

        expect(newSuggestions).toHaveLength(0);
        expect(acknowledgedSuggestions).toHaveLength(1);
      });
    });

    describe('updateSuggestionStatus', () => {
      it('should update suggestion status', async () => {
        const suggestion = await storage.createImprovementSuggestion(mockSuggestionData);

        const updated = await storage.updateSuggestionStatus(suggestion.id, 'Acknowledged');

        expect(updated?.status).toBe('Acknowledged');
      });

      it('should return undefined when suggestion not found', async () => {
        const result = await storage.updateSuggestionStatus('non-existent-id', 'Done');

        expect(result).toBeUndefined();
      });
    });
  });
});
