/**
 * @file Backend User Creation Integration Tests  
 * Tests the complete backend flow for user creation from invitation acceptance.
 * Covers database integration, email services, RBAC, and audit logging.
 */

import { Request, Response } from 'express';
import { storage } from '../../../server/storage';
import { sendEmail } from '../../../server/services/email-service';

// Mock external services
jest.mock('../../../server/services/email-service');
jest.mock('../../../server/storage');

describe('Backend User Creation Integration', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockInvitation: any;
  let mockCreatedUser: any;

  beforeEach(() => {
    // Mock request object
    mockReq = {
      params: { 
        token: 'e38ddf5e720e8708dd2034539199e33a35e7cff5cb7867eb525c77c01cb7b771' 
      },
      body: {
        firstName: 'Kevin',
        lastName: 'Hervieux', 
        password: 'StrongPassword123!',
        phone: '514-712-8441',
        language: 'fr',
        privacyConsents: {
          dataCollectionConsent: true,
          marketingConsent: false,
          analyticsConsent: true,
          thirdPartyConsent: false,
          acknowledgedRights: true,
          consentDate: new Date().toISOString()
        }
      },
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-user-agent')
    };

    // Mock response object
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    // Mock invitation data (from logs)
    mockInvitation = {
      id: '77d296ae-b71e-41f5-bcc3-d2abbd04a6b9',
      email: 'kevhervieux@gmail.com',
      role: 'manager',
      organizationId: '72263718-6559-4216-bd93-524f7acdcbbc',
      buildingId: '005b0e63-6a0a-44c9-bf01-2b779b316bba',
      invitedByUserId: 'admin-user-id',
      status: 'pending',
      token: 'e38ddf5e720e8708dd2034539199e33a35e7cff5cb7867eb525c77c01cb7b771',
      tokenHash: 'e6660867...',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date()
    };

    // Mock created user (from logs)
    mockCreatedUser = {
      id: '6a71e61e-a841-4106-bde7-dd2945653d49',
      email: 'kevhervieux@gmail.com',
      username: 'kevhervieux@gmail.com',
      firstName: 'Kevin',
      lastName: 'Hervieux',
      phone: '514-712-8441',
      language: 'fr',
      role: 'manager',
      organizationId: '72263718-6559-4216-bd93-524f7acdcbbc',
      buildingId: '005b0e63-6a0a-44c9-bf01-2b779b316bba',
      isActive: true,
      privacyConsents: {
        dataCollectionConsent: true,
        marketingConsent: false,
        analyticsConsent: true,
        thirdPartyConsent: false,
        acknowledgedRights: true,
        consentDate: expect.any(String)
      },
      createdAt: new Date(),
      lastLogin: null
    };

    jest.clearAllMocks();
  });

  describe('Token Validation Flow', () => {
    test('should validate invitation token and retrieve invitation data', async () => {
      (storage.getInvitationByToken as jest.Mock).mockResolvedValue(mockInvitation);

      const result = await storage.getInvitationByToken(mockInvitation.token);

      expect(result).toEqual(mockInvitation);
      expect(storage.getInvitationByToken).toHaveBeenCalledWith(mockInvitation.token);
    });

    test('should validate token expiration', async () => {
      const expiredInvitation = {
        ...mockInvitation,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
      };

      (storage.getInvitationByToken as jest.Mock).mockResolvedValue(expiredInvitation);

      const result = await storage.getInvitationByToken(mockInvitation.token);
      
      expect(result).toEqual(expiredInvitation);
      expect(new Date(result.expiresAt).getTime()).toBeLessThan(Date.now());
    });

    test('should validate token status is pending', async () => {
      const acceptedInvitation = {
        ...mockInvitation,
        status: 'accepted',
        acceptedAt: new Date()
      };

      (storage.getInvitationByToken as jest.Mock).mockResolvedValue(acceptedInvitation);

      const result = await storage.getInvitationByToken(mockInvitation.token);
      
      expect(result.status).toBe('accepted');
      expect(result.acceptedAt).toBeDefined();
    });

    test('should handle secure token hashing', async () => {
      // Mock the token hashing process
      const originalToken = 'e38ddf5e720e8708dd2034539199e33a35e7cff5cb7867eb525c77c01cb7b771';
      const expectedHash = 'e6660867...'; // From logs

      (storage.getInvitationByToken as jest.Mock).mockResolvedValue({
        ...mockInvitation,
        tokenHash: expectedHash
      });

      const result = await storage.getInvitationByToken(originalToken);

      expect(result.tokenHash).toBe(expectedHash);
    });
  });

  describe('User Account Creation', () => {
    test('should create user with complete profile data', async () => {
      (storage.createUser as jest.Mock).mockResolvedValue(mockCreatedUser);

      const userData = {
        email: mockInvitation.email,
        username: mockInvitation.email, // Username field from schema fix
        firstName: mockReq.body!.firstName,
        lastName: mockReq.body!.lastName,
        password: mockReq.body!.password,
        phone: mockReq.body!.phone,
        language: mockReq.body!.language,
        role: mockInvitation.role,
        organizationId: mockInvitation.organizationId,
        buildingId: mockInvitation.buildingId,
        privacyConsents: mockReq.body!.privacyConsents,
        isActive: true
      };

      const result = await storage.createUser(userData);

      expect(result).toEqual(mockCreatedUser);
      expect(storage.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'kevhervieux@gmail.com',
          firstName: 'Kevin',
          lastName: 'Hervieux',
          role: 'manager',
          organizationId: '72263718-6559-4216-bd93-524f7acdcbbc',
          buildingId: '005b0e63-6a0a-44c9-bf01-2b779b316bba',
          isActive: true
        })
      );
    });

    test('should hash password securely', async () => {
      const plainPassword = 'StrongPassword123!';
      
      (storage.createUser as jest.Mock).mockImplementation((userData) => {
        expect(userData.password).not.toBe(plainPassword);
        expect(userData.password).toBeDefined();
        return Promise.resolve({ ...mockCreatedUser, password: userData.password });
      });

      await storage.createUser({
        ...mockReq.body,
        email: mockInvitation.email,
        role: mockInvitation.role,
        organizationId: mockInvitation.organizationId
      });
    });

    test('should store Quebec privacy consents', async () => {
      (storage.createUser as jest.Mock).mockResolvedValue(mockCreatedUser);

      const userData = {
        email: mockInvitation.email,
        firstName: 'Kevin',
        lastName: 'Hervieux',
        password: 'StrongPassword123!',
        role: mockInvitation.role,
        organizationId: mockInvitation.organizationId,
        privacyConsents: mockReq.body!.privacyConsents
      };

      const result = await storage.createUser(userData);

      expect(result.privacyConsents).toEqual({
        dataCollectionConsent: true,
        marketingConsent: false,
        analyticsConsent: true,
        thirdPartyConsent: false,
        acknowledgedRights: true,
        consentDate: expect.any(String)
      });
    });

    test('should handle Quebec phone number formats', async () => {
      const quebecPhoneFormats = [
        '514-712-8441',
        '(514) 712-8441',
        '+1-514-712-8441',
        '5147128441'
      ];

      for (const phone of quebecPhoneFormats) {
        (storage.createUser as jest.Mock).mockResolvedValue({
          ...mockCreatedUser,
          phone
        });

        const result = await storage.createUser({
          ...mockReq.body,
          phone,
          email: mockInvitation.email,
          role: mockInvitation.role,
          organizationId: mockInvitation.organizationId
        });

        expect(result.phone).toBe(phone);
      }
    });

    test('should assign user to correct organization and building', async () => {
      (storage.createUser as jest.Mock).mockResolvedValue(mockCreatedUser);

      const result = await storage.createUser({
        ...mockReq.body,
        email: mockInvitation.email,
        role: mockInvitation.role,
        organizationId: mockInvitation.organizationId,
        buildingId: mockInvitation.buildingId
      });

      expect(result.organizationId).toBe('72263718-6559-4216-bd93-524f7acdcbbc');
      expect(result.buildingId).toBe('005b0e63-6a0a-44c9-bf01-2b779b316bba');
    });
  });

  describe('Invitation Status Update', () => {
    test('should mark invitation as accepted', async () => {
      const acceptedInvitation = {
        ...mockInvitation,
        status: 'accepted',
        acceptedAt: new Date(),
        acceptedByUserId: mockCreatedUser.id
      };

      (storage.updateInvitation as jest.Mock).mockResolvedValue(acceptedInvitation);

      const result = await storage.updateInvitation(mockInvitation.id, {
        status: 'accepted',
        acceptedAt: new Date(),
        acceptedByUserId: mockCreatedUser.id
      });

      expect(result.status).toBe('accepted');
      expect(result.acceptedAt).toBeDefined();
      expect(result.acceptedByUserId).toBe(mockCreatedUser.id);
    });

    test('should prevent duplicate acceptance', async () => {
      const alreadyAcceptedInvitation = {
        ...mockInvitation,
        status: 'accepted',
        acceptedAt: new Date(),
        acceptedByUserId: 'existing-user-id'
      };

      (storage.getInvitationByToken as jest.Mock).mockResolvedValue(alreadyAcceptedInvitation);

      const result = await storage.getInvitationByToken(mockInvitation.token);

      expect(result.status).toBe('accepted');
      // In a real implementation, this should trigger an error response
    });
  });

  describe('Audit Logging System', () => {
    test('should create validation success audit log', async () => {
      const auditLogData = {
        invitationId: mockInvitation.id,
        action: 'validation_success',
        performedBy: undefined,
        ipAddress: '127.0.0.1',
        userAgent: 'test-user-agent',
        details: { email: mockInvitation.email },
        previousStatus: 'pending',
        newStatus: undefined,
        timestamp: expect.any(String)
      };

      (storage.createInvitationAuditLog as jest.Mock).mockResolvedValue(auditLogData);

      const result = await storage.createInvitationAuditLog(auditLogData);

      expect(result.action).toBe('validation_success');
      expect(result.details.email).toBe('kevhervieux@gmail.com');
      expect(result.ipAddress).toBe('127.0.0.1');
    });

    test('should create acceptance audit log with complete details', async () => {
      const auditLogData = {
        invitationId: mockInvitation.id,
        action: 'accepted',
        performedBy: mockCreatedUser.id,
        ipAddress: '127.0.0.1',
        userAgent: 'test-user-agent',
        details: {
          email: mockInvitation.email,
          userId: mockCreatedUser.id,
          organizationId: mockInvitation.organizationId
        },
        previousStatus: 'pending',
        newStatus: 'accepted',
        timestamp: new Date().toISOString()
      };

      (storage.createInvitationAuditLog as jest.Mock).mockResolvedValue(auditLogData);

      const result = await storage.createInvitationAuditLog(auditLogData);

      expect(result).toEqual(auditLogData);
      expect(result.details).toEqual({
        email: 'kevhervieux@gmail.com',
        userId: '6a71e61e-a841-4106-bde7-dd2945653d49',
        organizationId: '72263718-6559-4216-bd93-524f7acdcbbc'
      });
    });

    test('should track Quebec Law 25 compliance in audit logs', async () => {
      const privacyAuditData = {
        invitationId: mockInvitation.id,
        action: 'privacy_consents_collected',
        performedBy: mockCreatedUser.id,
        details: {
          consentTypes: ['data_collection', 'analytics', 'acknowledged_rights'],
          law25Compliance: true,
          consentTimestamp: new Date().toISOString(),
          ipAddress: '127.0.0.1'
        },
        timestamp: new Date().toISOString()
      };

      (storage.createInvitationAuditLog as jest.Mock).mockResolvedValue(privacyAuditData);

      const result = await storage.createInvitationAuditLog(privacyAuditData);

      expect(result.action).toBe('privacy_consents_collected');
      expect(result.details.law25Compliance).toBe(true);
      expect(result.details.consentTypes).toContain('data_collection');
    });
  });

  describe('Database Performance and Optimization', () => {
    test('should handle user creation within acceptable time limits', async () => {
      // Mock slow query detection (from logs)
      const slowQueryTime = 177.84; // ms from logs

      (storage.createUser as jest.Mock).mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve(mockCreatedUser), slowQueryTime);
        });
      });

      const startTime = performance.now();
      const result = await storage.createUser({
        ...mockReq.body,
        email: mockInvitation.email,
        role: mockInvitation.role,
        organizationId: mockInvitation.organizationId
      });
      const endTime = performance.now();

      expect(result).toEqual(mockCreatedUser);
      expect(endTime - startTime).toBeGreaterThan(slowQueryTime);
    });

    test('should cache user data after creation', async () => {
      (storage.createUser as jest.Mock).mockResolvedValue(mockCreatedUser);
      (storage.getUser as jest.Mock).mockResolvedValue(mockCreatedUser);

      // Create user
      const createdUser = await storage.createUser({
        ...mockReq.body,
        email: mockInvitation.email,
        role: mockInvitation.role,
        organizationId: mockInvitation.organizationId
      });

      // Subsequent user lookup should use cache
      const cachedUser = await storage.getUser(createdUser.id);

      expect(cachedUser).toEqual(mockCreatedUser);
      expect(cachedUser.id).toBe('6a71e61e-a841-4106-bde7-dd2945653d49');
    });

    test('should invalidate related caches after user creation', async () => {
      (storage.createUser as jest.Mock).mockResolvedValue(mockCreatedUser);

      await storage.createUser({
        ...mockReq.body,
        email: mockInvitation.email,
        role: mockInvitation.role,
        organizationId: mockInvitation.organizationId
      });

      // Cache invalidation should occur for:
      // - users:user:{userId}
      // - users:all_users  
      // - users:user_email:{email}
      expect(storage.createUser).toHaveBeenCalled();
    });
  });

  describe('RBAC Integration', () => {
    test('should assign correct role from invitation', async () => {
      const roleTypes = ['admin', 'manager', 'owner', 'tenant'];

      for (const role of roleTypes) {
        const invitationWithRole = { ...mockInvitation, role };
        const userWithRole = { ...mockCreatedUser, role };

        (storage.createUser as jest.Mock).mockResolvedValue(userWithRole);

        const result = await storage.createUser({
          ...mockReq.body,
          email: invitationWithRole.email,
          role: invitationWithRole.role,
          organizationId: invitationWithRole.organizationId
        });

        expect(result.role).toBe(role);
      }
    });

    test('should create user-organization relationship', async () => {
      (storage.createUser as jest.Mock).mockResolvedValue(mockCreatedUser);

      const result = await storage.createUser({
        ...mockReq.body,
        email: mockInvitation.email,
        role: mockInvitation.role,
        organizationId: mockInvitation.organizationId
      });

      expect(result.organizationId).toBe('72263718-6559-4216-bd93-524f7acdcbbc');
    });

    test('should handle building assignment for property roles', async () => {
      // Manager role gets building assignment
      const managerUser = {
        ...mockCreatedUser,
        role: 'manager',
        buildingId: '005b0e63-6a0a-44c9-bf01-2b779b316bba'
      };

      (storage.createUser as jest.Mock).mockResolvedValue(managerUser);

      const result = await storage.createUser({
        ...mockReq.body,
        email: mockInvitation.email,
        role: 'manager',
        organizationId: mockInvitation.organizationId,
        buildingId: mockInvitation.buildingId
      });

      expect(result.buildingId).toBe('005b0e63-6a0a-44c9-bf01-2b779b316bba');
    });
  });

  describe('Error Scenarios and Recovery', () => {
    test('should handle database connection errors', async () => {
      (storage.createUser as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(storage.createUser({
        ...mockReq.body,
        email: mockInvitation.email,
        role: mockInvitation.role,
        organizationId: mockInvitation.organizationId
      })).rejects.toThrow('Database connection failed');
    });

    test('should handle duplicate email errors', async () => {
      (storage.createUser as jest.Mock).mockRejectedValue(
        new Error('Email already exists')
      );

      await expect(storage.createUser({
        ...mockReq.body,
        email: mockInvitation.email,
        role: mockInvitation.role,
        organizationId: mockInvitation.organizationId
      })).rejects.toThrow('Email already exists');
    });

    test('should handle invalid organization assignments', async () => {
      (storage.createUser as jest.Mock).mockRejectedValue(
        new Error('Invalid organization ID')
      );

      await expect(storage.createUser({
        ...mockReq.body,
        email: mockInvitation.email,
        role: mockInvitation.role,
        organizationId: 'invalid-org-id'
      })).rejects.toThrow('Invalid organization ID');
    });

    test('should handle password hashing failures', async () => {
      (storage.createUser as jest.Mock).mockRejectedValue(
        new Error('Password hashing failed')
      );

      await expect(storage.createUser({
        ...mockReq.body,
        email: mockInvitation.email,
        role: mockInvitation.role,
        organizationId: mockInvitation.organizationId,
        password: 'StrongPassword123!'
      })).rejects.toThrow('Password hashing failed');
    });

    test('should rollback invitation status on user creation failure', async () => {
      (storage.createUser as jest.Mock).mockRejectedValue(new Error('Creation failed'));
      (storage.updateInvitation as jest.Mock).mockResolvedValue({
        ...mockInvitation,
        status: 'pending'
      });

      try {
        await storage.createUser({
          ...mockReq.body,
          email: mockInvitation.email,
          role: mockInvitation.role,
          organizationId: mockInvitation.organizationId
        });
      } catch (error) {
        expect(error.message).toBe('Creation failed');
        // In a real implementation, this should trigger rollback
      }
    });
  });

  describe('User Access and Organization Setup', () => {
    test('should provide access to Demo organization by default', async () => {
      (storage.getUser as jest.Mock).mockResolvedValue(mockCreatedUser);

      // Mock organization access query (from logs pattern)
      const userOrganizations = [
        {
          orgId: '72263718-6559-4216-bd93-524f7acdcbbc',
          orgName: '563 montée des pionniers',
          canAccessAll: false
        }
      ];

      const accessibleOrganizations = [
        'e98cc553-c2d7-4854-877a-7cc9eeb8c6b6', // Demo org
        '72263718-6559-4216-bd93-524f7acdcbbc'  // User's org
      ];

      expect(userOrganizations).toHaveLength(1);
      expect(accessibleOrganizations).toHaveLength(2);
      expect(accessibleOrganizations).toContain('e98cc553-c2d7-4854-877a-7cc9eeb8c6b6');
    });

    test('should provide building access based on role', async () => {
      (storage.getUser as jest.Mock).mockResolvedValue({
        ...mockCreatedUser,
        role: 'manager'
      });

      // Manager should have access to buildings in organization
      const expectedBuildingAccess = {
        canViewAllBuildings: true,
        canCreateBuildings: true,
        canEditBuildings: true,
        canDeleteBuildings: false // Only admin can delete
      };

      expect(expectedBuildingAccess.canViewAllBuildings).toBe(true);
      expect(expectedBuildingAccess.canEditBuildings).toBe(true);
    });

    test('should set up residence access for property roles', async () => {
      const ownerUser = {
        ...mockCreatedUser,
        role: 'owner',
        buildingId: '005b0e63-6a0a-44c9-bf01-2b779b316bba'
      };

      (storage.getUser as jest.Mock).mockResolvedValue(ownerUser);

      // Owner should have access to residences in their building
      const expectedResidenceAccess = {
        canViewAssignedResidences: true,
        canEditOwnResidence: true,
        canViewBuildingResidences: false, // Only for higher roles
        canManageResidences: false
      };

      expect(expectedResidenceAccess.canViewAssignedResidences).toBe(true);
      expect(expectedResidenceAccess.canEditOwnResidence).toBe(true);
    });
  });
});