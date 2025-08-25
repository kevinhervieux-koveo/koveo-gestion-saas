/**
 * @file Comprehensive RBAC Unit Tests for Koveo Gestion.
 * @description Complete test coverage for Role-Based Access Control system
 * focusing on Quebec property management business logic and edge cases.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  getUserAccessibleOrganizations,
  canUserAccessOrganization, 
  canUserAccessBuilding,
  canUserAccessResidence,
  canUserPerformWriteOperation,
  isOpenDemoUser
} from '../../../server/rbac';
import { db } from '../../../server/db';

// Mock database functions for testing
jest.mock('../../../server/db', () => ({
  db: {
    query: {
      userOrganizations: {
        findMany: jest.fn(),
      },
      organizations: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      buildings: {
        findFirst: jest.fn(),
      },
      residences: {
        findFirst: jest.fn(),
      },
      userResidences: {
        findMany: jest.fn(),
      },
      users: {
        findFirst: jest.fn(),
      },
    },
  },
}));

// Test data for Quebec property management scenarios
const testUsers = {
  admin: {
    id: 'admin-user-id',
    username: 'admin@koveo.com',
    email: 'admin@koveo.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin' as const,
    isActive: true,
    canAccessAllOrganizations: true,
  },
  manager: {
    id: 'manager-user-id', 
    username: 'manager@property.qc.ca',
    email: 'manager@property.qc.ca',
    firstName: 'Gestionnaire',
    lastName: 'Propriété',
    role: 'manager' as const,
    isActive: true,
  },
  tenant: {
    id: 'tenant-user-id',
    username: 'locataire@email.com', 
    email: 'locataire@email.com',
    firstName: 'Jean',
    lastName: 'Locataire',
    role: 'tenant' as const,
    isActive: true,
  },
  demoUser: {
    id: 'demo-user-id',
    username: 'demo@openplatform.com',
    email: 'demo@openplatform.com', 
    firstName: 'Demo',
    lastName: 'Utilisateur',
    role: 'resident' as const,
    isActive: true,
  },
  koveoUser: {
    id: 'koveo-user-id',
    username: 'employee@koveo.com',
    email: 'employee@koveo.com',
    firstName: 'Koveo',
    lastName: 'Employee',
    role: 'admin' as const,
    isActive: true,
  }
};

const testOrganizations = {
  demo: { id: 'demo-org-id', name: 'Demo', isActive: true },
  koveo: { id: 'koveo-org-id', name: 'Koveo', isActive: true },
  regular: { id: 'regular-org-id', name: 'Gestion Immobilière Québec', isActive: true },
  openDemo: { id: 'open-demo-org-id', name: 'Open Demo', isActive: true },
  montreal: { id: 'montreal-org-id', name: 'Immobilier Montréal', isActive: true },
  quebec: { id: 'quebec-org-id', name: 'Propriétés Québec', isActive: true },
};

const testBuildings = {
  demo: { 
    id: 'demo-building-id', 
    organizationId: testOrganizations.demo.id,
    name: 'Demo Building - Test Facility',
    address: '123 Rue Demo, Montreal, QC',
    isActive: true 
  },
  montreal: { 
    id: 'montreal-building-id', 
    organizationId: testOrganizations.montreal.id,
    name: 'Tour Résidentielle Montréal',
    address: '456 Rue Sherbrooke, Montreal, QC',
    isActive: true 
  },
  quebec: { 
    id: 'quebec-building-id', 
    organizationId: testOrganizations.quebec.id,
    name: 'Complexe Résidentiel Québec',
    address: '789 Boulevard René-Lévesque, Quebec, QC',
    isActive: true 
  },
};

const testResidences = {
  demo: {
    id: 'demo-residence-id',
    buildingId: testBuildings.demo.id,
    unitNumber: '101',
    floor: 1,
    isActive: true,
  },
  montreal: {
    id: 'montreal-residence-id', 
    buildingId: testBuildings.montreal.id,
    unitNumber: '2A',
    floor: 2,
    isActive: true,
  },
  quebec: {
    id: 'quebec-residence-id',
    buildingId: testBuildings.quebec.id,
    unitNumber: '15B',
    floor: 15,
    isActive: true,
  },
};

describe('Comprehensive RBAC Tests - Quebec Property Management', () => {
  let mockDb: jest.Mocked<typeof db>;

  beforeEach(() => {
    mockDb = db as jest.Mocked<typeof db>;
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getUserAccessibleOrganizations - Core Access Control', () => {
    it('should always include Demo organization for any user (Quebec business rule)', async () => {
      mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([]);
      
      const result = await getUserAccessibleOrganizations(testUsers.tenant.id);
      
      expect(result).toContain(testOrganizations.demo.id);
      expect(mockDb.query.organizations.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({})
      });
    });

    it('should grant global access to Koveo organization members', async () => {
      mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: testOrganizations.koveo.id,
          canAccessAllOrganizations: false,
          organization: testOrganizations.koveo
        }
      ]);
      mockDb.query.organizations.findMany.mockResolvedValueOnce([
        testOrganizations.demo,
        testOrganizations.koveo,
        testOrganizations.montreal,
        testOrganizations.quebec
      ]);
      
      const result = await getUserAccessibleOrganizations(testUsers.koveoUser.id);
      
      expect(result).toHaveLength(4);
      expect(result).toContain(testOrganizations.koveo.id);
      expect(result).toContain(testOrganizations.montreal.id);
      expect(result).toContain(testOrganizations.quebec.id);
    });

    it('should limit regular users to their specific organizations plus Demo', async () => {
      mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: testOrganizations.montreal.id,
          canAccessAllOrganizations: false,
          organization: testOrganizations.montreal
        }
      ]);
      
      const result = await getUserAccessibleOrganizations(testUsers.manager.id);
      
      expect(result).toHaveLength(2);
      expect(result).toContain(testOrganizations.demo.id);
      expect(result).toContain(testOrganizations.montreal.id);
      expect(result).not.toContain(testOrganizations.quebec.id);
    });

    it('should handle users with explicit canAccessAllOrganizations flag', async () => {
      mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: testOrganizations.regular.id,
          canAccessAllOrganizations: true,
          organization: testOrganizations.regular
        }
      ]);
      mockDb.query.organizations.findMany.mockResolvedValueOnce([
        testOrganizations.demo,
        testOrganizations.koveo,
        testOrganizations.montreal,
        testOrganizations.quebec,
        testOrganizations.regular
      ]);
      
      const result = await getUserAccessibleOrganizations(testUsers.admin.id);
      
      expect(result).toHaveLength(5);
    });

    it('should handle database errors gracefully', async () => {
      mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockRejectedValueOnce(new Error('Connection failed'));
      
      const result = await getUserAccessibleOrganizations('invalid-user-id');
      
      expect(result).toEqual([]);
    });

    it('should handle missing Demo organization scenario', async () => {
      mockDb.query.organizations.findFirst.mockResolvedValueOnce(null);
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: testOrganizations.montreal.id,
          canAccessAllOrganizations: false,
          organization: testOrganizations.montreal
        }
      ]);
      
      const result = await getUserAccessibleOrganizations(testUsers.manager.id);
      
      expect(result).toHaveLength(1);
      expect(result).toContain(testOrganizations.montreal.id);
    });
  });

  describe('canUserAccessOrganization - Organization Access Validation', () => {
    it('should validate access based on getUserAccessibleOrganizations result', async () => {
      mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: testOrganizations.montreal.id,
          canAccessAllOrganizations: false,
          organization: testOrganizations.montreal
        }
      ]);
      
      const hasAccess = await canUserAccessOrganization(
        testUsers.manager.id,
        testOrganizations.montreal.id
      );
      
      expect(hasAccess).toBe(true);
    });

    it('should deny access to non-accessible organizations', async () => {
      mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: testOrganizations.montreal.id,
          canAccessAllOrganizations: false,
          organization: testOrganizations.montreal
        }
      ]);
      
      const hasAccess = await canUserAccessOrganization(
        testUsers.tenant.id,
        testOrganizations.quebec.id
      );
      
      expect(hasAccess).toBe(false);
    });
  });

  describe('canUserAccessBuilding - Building Access Through Organization', () => {
    it('should allow building access if user can access its organization', async () => {
      mockDb.query.buildings.findFirst.mockResolvedValueOnce(testBuildings.montreal);
      mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: testOrganizations.montreal.id,
          canAccessAllOrganizations: false,
          organization: testOrganizations.montreal
        }
      ]);
      
      const hasAccess = await canUserAccessBuilding(
        testUsers.manager.id,
        testBuildings.montreal.id
      );
      
      expect(hasAccess).toBe(true);
    });

    it('should deny access to non-existent buildings', async () => {
      mockDb.query.buildings.findFirst.mockResolvedValueOnce(null);
      
      const hasAccess = await canUserAccessBuilding(
        testUsers.manager.id,
        'non-existent-building-id'
      );
      
      expect(hasAccess).toBe(false);
    });

    it('should handle database errors in building lookup', async () => {
      mockDb.query.buildings.findFirst.mockRejectedValueOnce(new Error('Building query failed'));
      
      const hasAccess = await canUserAccessBuilding(
        testUsers.manager.id,
        testBuildings.montreal.id
      );
      
      expect(hasAccess).toBe(false);
    });
  });

  describe('canUserAccessResidence - Role-Based Residence Access', () => {
    it('should allow admin users access to any residence in accessible organizations', async () => {
      mockDb.query.users.findFirst.mockResolvedValueOnce(testUsers.admin);
      mockDb.query.residences.findFirst.mockResolvedValueOnce({
        ...testResidences.montreal,
        building: testBuildings.montreal
      });
      mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: testOrganizations.montreal.id,
          canAccessAllOrganizations: true,
          organization: testOrganizations.montreal
        }
      ]);
      mockDb.query.organizations.findMany.mockResolvedValueOnce([
        testOrganizations.demo,
        testOrganizations.montreal
      ]);
      
      const hasAccess = await canUserAccessResidence(
        testUsers.admin.id,
        testResidences.montreal.id
      );
      
      expect(hasAccess).toBe(true);
    });

    it('should allow managers access to residences in their organizations', async () => {
      mockDb.query.users.findFirst.mockResolvedValueOnce(testUsers.manager);
      mockDb.query.residences.findFirst.mockResolvedValueOnce({
        ...testResidences.montreal,
        building: testBuildings.montreal
      });
      mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: testOrganizations.montreal.id,
          canAccessAllOrganizations: false,
          organization: testOrganizations.montreal
        }
      ]);
      
      const hasAccess = await canUserAccessResidence(
        testUsers.manager.id,
        testResidences.montreal.id
      );
      
      expect(hasAccess).toBe(true);
    });

    it('should restrict tenants to only their assigned residences', async () => {
      mockDb.query.users.findFirst.mockResolvedValueOnce(testUsers.tenant);
      mockDb.query.userResidences.findMany.mockResolvedValueOnce([
        {
          userId: testUsers.tenant.id,
          residenceId: testResidences.demo.id,
          isActive: true,
          relationshipType: 'tenant'
        }
      ]);
      
      const hasAccess = await canUserAccessResidence(
        testUsers.tenant.id,
        testResidences.demo.id
      );
      
      expect(hasAccess).toBe(true);
    });

    it('should deny tenant access to non-assigned residences', async () => {
      mockDb.query.users.findFirst.mockResolvedValueOnce(testUsers.tenant);
      mockDb.query.userResidences.findMany.mockResolvedValueOnce([]);
      
      const hasAccess = await canUserAccessResidence(
        testUsers.tenant.id,
        testResidences.montreal.id
      );
      
      expect(hasAccess).toBe(false);
    });

    it('should handle non-existent users gracefully', async () => {
      mockDb.query.users.findFirst.mockResolvedValueOnce(null);
      
      const hasAccess = await canUserAccessResidence(
        'non-existent-user',
        testResidences.demo.id
      );
      
      expect(hasAccess).toBe(false);
    });

    it('should handle non-existent residences gracefully', async () => {
      mockDb.query.users.findFirst.mockResolvedValueOnce(testUsers.admin);
      mockDb.query.residences.findFirst.mockResolvedValueOnce(null);
      
      const hasAccess = await canUserAccessResidence(
        testUsers.admin.id,
        'non-existent-residence'
      );
      
      expect(hasAccess).toBe(false);
    });
  });

  describe('canUserPerformWriteOperation - Write Access Control', () => {
    it('should allow regular users to perform all write operations', async () => {
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: testOrganizations.montreal.id,
          organization: testOrganizations.montreal
        }
      ]);
      
      const writeOperations = ['create', 'update', 'delete', 'manage', 'approve', 'assign', 'share', 'export', 'backup', 'restore'] as const;
      
      for (const operation of writeOperations) {
        const canWrite = await canUserPerformWriteOperation(testUsers.manager.id, operation);
        expect(canWrite).toBe(true);
      }
    });

    it('should deny all write operations for Open Demo users', async () => {
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: testOrganizations.openDemo.id,
          organization: testOrganizations.openDemo
        }
      ]);
      
      const writeOperations = ['create', 'update', 'delete', 'manage', 'approve', 'assign', 'share', 'export', 'backup', 'restore'] as const;
      
      for (const operation of writeOperations) {
        const canWrite = await canUserPerformWriteOperation(testUsers.demoUser.id, operation);
        expect(canWrite).toBe(false);
      }
    });

    it('should handle database errors in write permission checks', async () => {
      mockDb.query.userOrganizations.findMany.mockRejectedValueOnce(new Error('Permission check failed'));
      
      const canWrite = await canUserPerformWriteOperation(testUsers.manager.id, 'create');
      
      expect(canWrite).toBe(false);
    });
  });

  describe('isOpenDemoUser - Demo User Identification', () => {
    it('should correctly identify Open Demo users', async () => {
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: testOrganizations.openDemo.id,
          organization: testOrganizations.openDemo
        }
      ]);
      
      const isDemo = await isOpenDemoUser(testUsers.demoUser.id);
      
      expect(isDemo).toBe(true);
    });

    it('should correctly identify regular users as non-demo', async () => {
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: testOrganizations.montreal.id,
          organization: testOrganizations.montreal
        }
      ]);
      
      const isDemo = await isOpenDemoUser(testUsers.manager.id);
      
      expect(isDemo).toBe(false);
    });

    it('should handle users with no organization memberships', async () => {
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([]);
      
      const isDemo = await isOpenDemoUser(testUsers.tenant.id);
      
      expect(isDemo).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      mockDb.query.userOrganizations.findMany.mockRejectedValueOnce(new Error('User lookup failed'));
      
      const isDemo = await isOpenDemoUser('error-user-id');
      
      expect(isDemo).toBe(false);
    });
  });

  describe('Edge Cases and Security Testing', () => {
    it('should handle malformed user IDs safely', async () => {
      const malformedIds = ['', null, undefined, 'invalid-uuid', '123', 'DROP TABLE users'];
      
      for (const id of malformedIds) {
        mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.demo);
        mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([]);
        
        const result = await getUserAccessibleOrganizations(id as string);
        expect(Array.isArray(result)).toBe(true);
      }
    });

    it('should handle SQL injection attempts in organization names', async () => {
      const maliciousOrg = {
        id: 'malicious-org-id',
        name: "'; DROP TABLE organizations; --",
        isActive: true
      };
      
      mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: maliciousOrg.id,
          canAccessAllOrganizations: false,
          organization: maliciousOrg
        }
      ]);
      
      const result = await getUserAccessibleOrganizations(testUsers.manager.id);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result).toContain(testOrganizations.demo.id);
    });

    it('should prevent unauthorized escalation through concurrent requests', async () => {
      mockDb.query.organizations.findFirst.mockResolvedValue(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValue([
        {
          organizationId: testOrganizations.montreal.id,
          canAccessAllOrganizations: false,
          organization: testOrganizations.montreal
        }
      ]);
      
      // Simulate concurrent access attempts
      const promises = [
        canUserAccessOrganization(testUsers.tenant.id, testOrganizations.montreal.id),
        canUserAccessOrganization(testUsers.tenant.id, testOrganizations.quebec.id),
        canUserAccessOrganization(testUsers.tenant.id, testOrganizations.koveo.id)
      ];
      
      const results = await Promise.all(promises);
      
      expect(results[0]).toBe(true); // Should have access to Montreal
      expect(results[1]).toBe(false); // Should not have access to Quebec
      expect(results[2]).toBe(false); // Should not have access to Koveo
    });

    it('should maintain consistent state across function calls', async () => {
      // Setup consistent mock responses
      mockDb.query.organizations.findFirst.mockResolvedValue(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValue([
        {
          organizationId: testOrganizations.montreal.id,
          canAccessAllOrganizations: false,
          organization: testOrganizations.montreal
        }
      ]);
      
      // Get accessible organizations
      const accessibleOrgs = await getUserAccessibleOrganizations(testUsers.manager.id);
      
      // Verify consistent access for each accessible org
      for (const orgId of accessibleOrgs) {
        const hasAccess = await canUserAccessOrganization(testUsers.manager.id, orgId);
        expect(hasAccess).toBe(true);
      }
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle large datasets efficiently', async () => {
      const largeOrgSet = Array.from({ length: 500 }, (_, i) => ({
        id: `org-${i}`,
        name: `Organization ${i}`,
        isActive: true
      }));
      
      mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: testOrganizations.koveo.id,
          canAccessAllOrganizations: false,
          organization: testOrganizations.koveo
        }
      ]);
      mockDb.query.organizations.findMany.mockResolvedValueOnce(largeOrgSet);
      
      const startTime = Date.now();
      const result = await getUserAccessibleOrganizations(testUsers.koveoUser.id);
      const endTime = Date.now();
      
      expect(result.length).toBe(500);
      expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
    });

    it('should handle rapid sequential checks efficiently', async () => {
      mockDb.query.organizations.findFirst.mockResolvedValue(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValue([
        {
          organizationId: testOrganizations.montreal.id,
          canAccessAllOrganizations: false,
          organization: testOrganizations.montreal
        }
      ]);
      
      const startTime = Date.now();
      
      // Perform 50 rapid access checks
      const promises = Array.from({ length: 50 }, () => 
        canUserAccessOrganization(testUsers.manager.id, testOrganizations.montreal.id)
      );
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      expect(results.every(result => result === true)).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Quebec-Specific Business Rules', () => {
    it('should enforce bilingual support in organization access', async () => {
      const quebecOrgs = [
        { id: 'org-fr-1', name: 'Gestion Immobilière Québec', isActive: true },
        { id: 'org-fr-2', name: 'Propriétés Résidentielles MTL', isActive: true },
        { id: 'org-en-1', name: 'Quebec Property Management', isActive: true }
      ];
      
      mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: 'org-fr-1',
          canAccessAllOrganizations: false,
          organization: quebecOrgs[0]
        }
      ]);
      
      const result = await getUserAccessibleOrganizations(testUsers.manager.id);
      
      expect(result).toContain(testOrganizations.demo.id);
      expect(result).toContain('org-fr-1');
    });

    it('should handle Quebec property management hierarchy correctly', async () => {
      // Test the hierarchy: Organization -> Building -> Residence -> User Assignment
      mockDb.query.users.findFirst.mockResolvedValueOnce(testUsers.tenant);
      mockDb.query.userResidences.findMany.mockResolvedValueOnce([
        {
          userId: testUsers.tenant.id,
          residenceId: testResidences.montreal.id,
          isActive: true,
          relationshipType: 'tenant',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31')
        }
      ]);
      
      const hasResidenceAccess = await canUserAccessResidence(
        testUsers.tenant.id,
        testResidences.montreal.id
      );
      
      expect(hasResidenceAccess).toBe(true);
    });

    it('should respect Quebec tenant protection laws in access control', async () => {
      // Tenants should always have access to their assigned residences
      // even if organization membership changes
      mockDb.query.users.findFirst.mockResolvedValueOnce(testUsers.tenant);
      mockDb.query.userResidences.findMany.mockResolvedValueOnce([
        {
          userId: testUsers.tenant.id,
          residenceId: testResidences.montreal.id,
          isActive: true,
          relationshipType: 'tenant',
          startDate: new Date('2024-01-01'),
          endDate: null // Ongoing tenancy
        }
      ]);
      
      const hasAccess = await canUserAccessResidence(
        testUsers.tenant.id,
        testResidences.montreal.id
      );
      
      expect(hasAccess).toBe(true);
    });
  });
});

describe('RBAC Integration Scenarios', () => {
  let mockDb: jest.Mocked<typeof db>;

  beforeEach(() => {
    mockDb = db as jest.Mocked<typeof db>;
    jest.clearAllMocks();
  });

  describe('Real-world Quebec Property Management Scenarios', () => {
    it('should handle property manager switching organizations', async () => {
      // Scenario: Property manager moves from one company to another
      const oldOrg = testOrganizations.montreal;
      const newOrg = testOrganizations.quebec;
      
      // First, user has access to old organization
      mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: oldOrg.id,
          canAccessAllOrganizations: false,
          organization: oldOrg
        }
      ]);
      
      let accessibleOrgs = await getUserAccessibleOrganizations(testUsers.manager.id);
      expect(accessibleOrgs).toContain(oldOrg.id);
      expect(accessibleOrgs).not.toContain(newOrg.id);
      
      // After organization change
      mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: newOrg.id,
          canAccessAllOrganizations: false,
          organization: newOrg
        }
      ]);
      
      accessibleOrgs = await getUserAccessibleOrganizations(testUsers.manager.id);
      expect(accessibleOrgs).toContain(newOrg.id);
      expect(accessibleOrgs).not.toContain(oldOrg.id);
    });

    it('should handle tenant moving between residences', async () => {
      // Scenario: Tenant moves from one residence to another
      const oldResidence = testResidences.montreal;
      const newResidence = testResidences.quebec;
      
      // Initially tenant has access to old residence
      mockDb.query.users.findFirst.mockResolvedValue(testUsers.tenant);
      mockDb.query.userResidences.findMany.mockResolvedValueOnce([
        {
          userId: testUsers.tenant.id,
          residenceId: oldResidence.id,
          isActive: true,
          relationshipType: 'tenant'
        }
      ]);
      
      let hasAccess = await canUserAccessResidence(testUsers.tenant.id, oldResidence.id);
      expect(hasAccess).toBe(true);
      
      hasAccess = await canUserAccessResidence(testUsers.tenant.id, newResidence.id);
      expect(hasAccess).toBe(false);
      
      // After moving to new residence
      mockDb.query.userResidences.findMany.mockResolvedValueOnce([
        {
          userId: testUsers.tenant.id,
          residenceId: newResidence.id,
          isActive: true,
          relationshipType: 'tenant'
        }
      ]);
      
      hasAccess = await canUserAccessResidence(testUsers.tenant.id, newResidence.id);
      expect(hasAccess).toBe(true);
    });

    it('should handle Koveo employee promotion to admin', async () => {
      // Scenario: Regular Koveo employee gets promoted to admin
      const koveoEmployee = {
        ...testUsers.koveoUser,
        role: 'manager' as const
      };
      
      // Before promotion - limited to Koveo organization access
      mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: testOrganizations.koveo.id,
          canAccessAllOrganizations: false,
          organization: testOrganizations.koveo
        }
      ]);
      mockDb.query.organizations.findMany.mockResolvedValueOnce([
        testOrganizations.demo,
        testOrganizations.koveo,
        testOrganizations.montreal,
        testOrganizations.quebec
      ]);
      
      const accessibleOrgs = await getUserAccessibleOrganizations(koveoEmployee.id);
      expect(accessibleOrgs.length).toBeGreaterThanOrEqual(4); // Koveo gets global access
      
      // After promotion - should still have global access as admin
      const adminUser = {
        ...koveoEmployee,
        role: 'admin' as const
      };
      
      mockDb.query.users.findFirst.mockResolvedValueOnce(adminUser);
      mockDb.query.residences.findFirst.mockResolvedValueOnce({
        ...testResidences.montreal,
        building: testBuildings.montreal
      });
      mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: testOrganizations.koveo.id,
          canAccessAllOrganizations: true,
          organization: testOrganizations.koveo
        }
      ]);
      mockDb.query.organizations.findMany.mockResolvedValueOnce([
        testOrganizations.demo,
        testOrganizations.koveo,
        testOrganizations.montreal,
        testOrganizations.quebec
      ]);
      
      const hasResidenceAccess = await canUserAccessResidence(
        adminUser.id,
        testResidences.montreal.id
      );
      expect(hasResidenceAccess).toBe(true);
    });
  });
});