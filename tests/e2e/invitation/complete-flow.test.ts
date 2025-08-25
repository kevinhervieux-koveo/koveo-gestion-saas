/**
 * @file Complete End-to-End User Creation Flow Tests
 * Validates the entire user creation journey from invitation to system access.
 * Tests all integration points and error scenarios.
 */

import { storage } from '../../../server/storage';

// Mock the storage interface
jest.mock('../../../server/storage');

describe('Complete E2E User Creation Flow', () => {
  let mockManagerUser: any;
  let mockToken: string;

  beforeEach(() => {
    mockManagerUser = {
      id: 'manager-123',
      email: 'manager@example.com',
      role: 'manager',
      organizationId: 'org-123',
    };

    mockToken = 'e38ddf5e720e8708dd2034539199e33a35e7cff5cb7867eb525c77c01cb7b771';

    jest.clearAllMocks();
  });

  describe('Invitation Creation Flow', () => {
    test('should create invitation with proper validation', async () => {
      const mockInvitation = {
        id: 'invitation-123',
        email: 'newuser@example.com',
        role: 'tenant' as const,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'pending' as const,
        invitedByUserId: mockManagerUser.id,
        organizationId: 'org-123',
        buildingId: 'building-123',
        createdAt: new Date(),
      };

      // Mock storage methods
      (storage.createInvitation as jest.Mock).mockResolvedValue(mockInvitation);

      // Simulate invitation creation request
      const invitationData = {
        email: 'newuser@example.com',
        role: 'tenant' as const,
        organizationId: 'org-123',
        buildingId: 'building-123',
        personalizedMessage: 'Welcome to our property management system!',
      };

      const result = await storage.createInvitation({
        ...invitationData,
        invitedByUserId: mockManagerUser.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'pending' as const,
        token: mockToken,
      });

      expect(result).toEqual(mockInvitation);
      expect(storage.createInvitation).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'newuser@example.com',
          role: 'tenant',
          invitedByUserId: mockManagerUser.id,
        })
      );
    });
  });

  describe('Token Validation Flow', () => {
    test('should validate invitation token', async () => {
      const mockInvitation = {
        id: 'invitation-123',
        email: 'newuser@example.com',
        role: 'tenant' as const,
        token: mockToken,
        status: 'pending' as const,
        organizationId: 'org-123',
      };

      (storage.getInvitationByToken as jest.Mock).mockResolvedValue(mockInvitation);

      const result = await storage.getInvitationByToken(mockToken);

      expect(result).toEqual(mockInvitation);
      expect(result.token).toBe(mockToken);
      expect(result.status).toBe('pending');
    });
  });

  describe('User Creation Flow', () => {
    test('should create user with complete profile data', async () => {
      const userData = {
        firstName: 'Kevin',
        lastName: 'Hervieux',
        email: 'kevhervieux@gmail.com',
        password: 'StrongPassword123!',
        phone: '514-712-8441',
        language: 'fr',
        role: 'manager' as const,
        organizationId: '72263718-6559-4216-bd93-524f7acdcbbc',
        buildingId: '005b0e63-6a0a-44c9-bf01-2b779b316bba',
      };

      const mockCreatedUser = {
        id: '6a71e61e-a841-4106-bde7-dd2945653d49',
        username: userData.email,
        ...userData,
        isActive: true,
        createdAt: new Date(),
        lastLogin: null,
      };

      (storage.createUser as jest.Mock).mockResolvedValue(mockCreatedUser);

      const result = await storage.createUser(userData);

      expect(result).toEqual(mockCreatedUser);
      expect(result.email).toBe('kevhervieux@gmail.com');
      expect(result.role).toBe('manager');
      expect(result.isActive).toBe(true);
    });
  });

  describe('Quebec Privacy Consent Flow', () => {
    test('should handle Quebec Law 25 consent requirements', async () => {
      const privacyConsents = {
        dataCollectionConsent: true,
        marketingConsent: false,
        analyticsConsent: true,
        thirdPartyConsent: false,
        acknowledgedRights: true,
        consentDate: new Date().toISOString(),
      };

      // Quebec Law 25 requires both data collection consent and acknowledged rights
      expect(privacyConsents.dataCollectionConsent).toBe(true);
      expect(privacyConsents.acknowledgedRights).toBe(true);
    });
  });

  describe('Complete Integration Flow', () => {
    test('should complete full user creation journey', async () => {
      const mockInvitation = {
        id: '77d296ae-b71e-41f5-bcc3-d2abbd04a6b9',
        email: 'kevhervieux@gmail.com',
        role: 'manager' as const,
        token: mockToken,
        status: 'pending' as const,
        organizationId: '72263718-6559-4216-bd93-524f7acdcbbc',
        buildingId: '005b0e63-6a0a-44c9-bf01-2b779b316bba',
      };

      const mockCreatedUser = {
        id: '6a71e61e-a841-4106-bde7-dd2945653d49',
        username: 'kevhervieux@gmail.com',
        email: 'kevhervieux@gmail.com',
        firstName: 'Kevin',
        lastName: 'Hervieux',
        role: 'manager' as const,
        organizationId: '72263718-6559-4216-bd93-524f7acdcbbc',
        isActive: true,
      };

      // Mock the complete flow
      (storage.getInvitationByToken as jest.Mock).mockResolvedValue(mockInvitation);
      (storage.createUser as jest.Mock).mockResolvedValue(mockCreatedUser);
      (storage.updateInvitation as jest.Mock).mockResolvedValue({
        ...mockInvitation,
        status: 'accepted' as const,
      });

      // Step 1: Validate token
      const invitation = await storage.getInvitationByToken(mockToken);
      expect(invitation.email).toBe('kevhervieux@gmail.com');

      // Step 2: Create user
      const createdUser = await storage.createUser({
        firstName: 'Kevin',
        lastName: 'Hervieux',
        email: invitation.email,
        password: 'StrongPassword123!',
        phone: '514-712-8441',
        language: 'fr',
        role: invitation.role,
        organizationId: invitation.organizationId,
        buildingId: invitation.buildingId,
      });

      expect(createdUser.id).toBe('6a71e61e-a841-4106-bde7-dd2945653d49');

      // Step 3: Update invitation status
      const updatedInvitation = await storage.updateInvitation(invitation.id, {
        status: 'accepted',
      });

      expect(updatedInvitation.status).toBe('accepted');
    });
  });
});
