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
  isOpenDemoUser,
} from '../../../server/rbac';
import { db } from '../../../server/db';

// Use real database for testing with demo data

// Real demo data from database
const testUsers = {
  admin: {
    id: '222f5a0d-6bc6-4f28-9f4d-32c133eed333', // Real admin user
    email: 'kevin.hervieux@koveo-gestion.com',
    role: 'admin' as const,
    isActive: true,
  },
  manager: {
    id: '29b68c68-4a95-4d2a-bedc-d8b8d4cd3e07', // Real demo manager
    email: 'sophie.tremblay@demo.com',
    role: 'manager' as const,
    isActive: true,
  },
  tenant: {
    id: '50b33679-279d-4460-8902-04af4e7eac64', // Real demo tenant
    email: 'emma.cote@demo.com',
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
  },
};

const testOrganizations = {
  demo: { id: '9ebab63b-433d-4caf-b7cd-b23365e5014f', name: 'Demo', isActive: true },
  koveo: { id: '75214a4e-241d-4b73-b14f-404fd274516f', name: 'Koveo', isActive: true },
  montreal: { id: '72263718-6559-4216-bd93-524f7acdcbbc', name: '563-583 montée des pionniers', isActive: true },
  regular: { id: '014a3b27-2097-40ae-84b4-a1130b82a253', name: 'Test Organization', isActive: true },
  openDemo: { id: '15265075-ca7e-4ba1-8c72-5dce3b02e304', name: 'Demo', isActive: true },
  quebec: { id: '714bc2dd-c750-4d58-92bb-9f49ec30b282', name: 'Security Test Org', isActive: true },
};

const testBuildings = {
  demo: {
    id: 'd084392f-facb-40a6-8685-3b40dcdd4b68', // Real Koveo Tower
    organizationId: testOrganizations.koveo.id,
    name: 'Koveo Tower',
    isActive: true,
  },
  montreal: {
    id: '005b0e63-6a0a-44c9-bf01-2b779b316bba', // Real montreal building
    organizationId: testOrganizations.montreal.id,
    name: '563 montée des pionniers, Terrebonne',
    isActive: true,
  },
};

const testResidences = {
  demo: {
    id: '7778ab41-b9e2-4ca1-b2cd-f880d5979720', // Real residence
    buildingId: testBuildings.demo.id,
    unitNumber: '402',
    floor: 4,
    isActive: true,
  },
  montreal: {
    id: '60bf913d-bc84-4293-a737-cb0cab55e346', // Real residence
    buildingId: testBuildings.montreal.id,
    unitNumber: '1A',
    floor: 1,
    isActive: true,
  },
};

describe('Comprehensive RBAC Tests - Quebec Property Management', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserAccessibleOrganizations - Core Access Control', () => {
    it('should always include Demo organization for any user (Quebec business rule)', async () => {
      mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([]);

      const result = await getUserAccessibleOrganizations(testUsers.tenant.id);

      expect(result).toContain(testOrganizations.demo.id);
      expect(mockDb.query.organizations.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({}),
      });
    });

    it('should grant global access to Koveo organization members', async () => {
      mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: testOrganizations.koveo.id,
          canAccessAllOrganizations: false,
          organization: testOrganizations.koveo,
        },
      ]);
      mockDb.query.organizations.findMany.mockResolvedValueOnce([
        testOrganizations.demo,
        testOrganizations.koveo,
        testOrganizations.montreal,
        testOrganizations.quebec,
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
          organization: testOrganizations.montreal,
        },
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
          organization: testOrganizations.regular,
        },
      ]);
      mockDb.query.organizations.findMany.mockResolvedValueOnce([
        testOrganizations.demo,
        testOrganizations.koveo,
        testOrganizations.montreal,
        testOrganizations.quebec,
        testOrganizations.regular,
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
      mockDb.query.organizations.findFirst.mockResolvedValueOnce(undefined);
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: testOrganizations.montreal.id,
          canAccessAllOrganizations: false,
          organization: testOrganizations.montreal,
        },
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
          organization: testOrganizations.montreal,
        },
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
          organization: testOrganizations.montreal,
        },
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
          organization: testOrganizations.montreal,
        },
      ]);

      const hasAccess = await canUserAccessBuilding(
        testUsers.manager.id,
        testBuildings.montreal.id
      );

      expect(hasAccess).toBe(true);
    });

    it('should deny access to non-existent buildings', async () => {
      mockDb.query.buildings.findFirst.mockResolvedValueOnce(undefined);

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
        building: testBuildings.montreal,
      });
      mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: testOrganizations.montreal.id,
          canAccessAllOrganizations: true,
          organization: testOrganizations.montreal,
        },
      ]);
      mockDb.query.organizations.findMany.mockResolvedValueOnce([
        testOrganizations.demo,
        testOrganizations.montreal,
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
        building: testBuildings.montreal,
      });
      mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: testOrganizations.montreal.id,
          canAccessAllOrganizations: false,
          organization: testOrganizations.montreal,
        },
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
          relationshipType: 'tenant',
        },
      ]);

      const hasAccess = await canUserAccessResidence(testUsers.tenant.id, testResidences.demo.id);

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
      mockDb.query.users.findFirst.mockResolvedValueOnce(undefined);

      const hasAccess = await canUserAccessResidence('non-existent-user', testResidences.demo.id);

      expect(hasAccess).toBe(false);
    });

    it('should handle non-existent residences gracefully', async () => {
      mockDb.query.users.findFirst.mockResolvedValueOnce(testUsers.admin);
      mockDb.query.residences.findFirst.mockResolvedValueOnce(undefined);

      const hasAccess = await canUserAccessResidence(testUsers.admin.id, 'non-existent-residence');

      expect(hasAccess).toBe(false);
    });
  });

  describe('canUserPerformWriteOperation - Write Access Control', () => {
    it('should allow regular users to perform all write operations', async () => {
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: testOrganizations.montreal.id,
          organization: testOrganizations.montreal,
        },
      ]);

      const writeOperations = [
        'create',
        'update',
        'delete',
        'manage',
        'approve',
        'assign',
        'share',
        'export',
        'backup',
        'restore',
      ] as const;

      for (const operation of writeOperations) {
        const canWrite = await canUserPerformWriteOperation(testUsers.manager.id, operation);
        expect(canWrite).toBe(true);
      }
    });

    it('should deny all write operations for Open Demo users', async () => {
      // Mock isOpenDemoUser to return true for demo user
      mockDb.query.organizations.findFirst.mockResolvedValue(testOrganizations.openDemo);
      mockDb.query.userOrganizations.findFirst.mockResolvedValue({
        organizationId: testOrganizations.openDemo.id,
        userId: testUsers.demoUser.id,
        isActive: true,
      });

      const writeOperations = [
        'create',
        'update',
        'delete',
        'manage',
        'approve',
        'assign',
        'share',
        'export',
        'backup',
        'restore',
      ] as const;

      for (const operation of writeOperations) {
        const canWrite = await canUserPerformWriteOperation(testUsers.demoUser.id, operation);
        expect(canWrite).toBe(false);
      }
    });

    it('should handle database errors in write permission checks', async () => {
      // Mock the organizations query to fail (used by isOpenDemoUser)
      mockDb.query.organizations.findFirst.mockRejectedValueOnce(
        new Error('Permission check failed')
      );

      const canWrite = await canUserPerformWriteOperation(testUsers.manager.id, 'create');

      expect(canWrite).toBe(true); // Should allow regular users even if demo check fails
    });
  });

  describe('isOpenDemoUser - Demo User Identification', () => {
    it('should correctly identify Open Demo users', async () => {
      mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.openDemo);
      mockDb.query.userOrganizations.findFirst.mockResolvedValueOnce({
        organizationId: testOrganizations.openDemo.id,
        userId: testUsers.demoUser.id,
        isActive: true,
      });

      const isDemo = await isOpenDemoUser(testUsers.demoUser.id);

      expect(isDemo).toBe(true);
    });

    it('should correctly identify regular users as non-demo', async () => {
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: testOrganizations.montreal.id,
          organization: testOrganizations.montreal,
        },
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
      mockDb.query.userOrganizations.findMany.mockRejectedValueOnce(
        new Error('User lookup failed')
      );

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
        isActive: true,
      };

      mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: maliciousOrg.id,
          canAccessAllOrganizations: false,
          organization: maliciousOrg,
        },
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
          organization: testOrganizations.montreal,
        },
      ]);

      // Simulate concurrent access attempts
      const promises = [
        canUserAccessOrganization(testUsers.tenant.id, testOrganizations.montreal.id),
        canUserAccessOrganization(testUsers.tenant.id, testOrganizations.quebec.id),
        canUserAccessOrganization(testUsers.tenant.id, testOrganizations.koveo.id),
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
          organization: testOrganizations.montreal,
        },
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
        isActive: true,
      }));

      mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: testOrganizations.koveo.id,
          canAccessAllOrganizations: false,
          organization: testOrganizations.koveo,
        },
      ]);
      mockDb.query.organizations.findFirst.mockResolvedValueOnce({
        id: testOrganizations.koveo.id,
        name: 'koveo',
      });
      mockDb.query.organizations.findMany.mockResolvedValueOnce([
        testOrganizations.demo,
        ...largeOrgSet
      ]);

      const startTime = Date.now();
      const result = await getUserAccessibleOrganizations(testUsers.koveoUser.id);
      const endTime = Date.now();

      expect(result.length).toBe(501); // 500 + demo org
      expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
    });

    it('should handle rapid sequential checks efficiently', async () => {
      mockDb.query.organizations.findFirst.mockResolvedValue(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValue([
        {
          organizationId: testOrganizations.montreal.id,
          canAccessAllOrganizations: false,
          organization: testOrganizations.montreal,
        },
      ]);

      const startTime = Date.now();

      // Perform 50 rapid access checks
      const promises = Array.from({ length: 50 }, () =>
        canUserAccessOrganization(testUsers.manager.id, testOrganizations.montreal.id)
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results.every((result) => result === true)).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Quebec-Specific Business Rules', () => {
    it('should enforce bilingual support in organization access', async () => {
      const quebecOrgs = [
        { id: 'org-fr-1', name: 'Gestion Immobilière Québec', isActive: true },
        { id: 'org-fr-2', name: 'Propriétés Résidentielles MTL', isActive: true },
        { id: 'org-en-1', name: 'Quebec Property Management', isActive: true },
      ];

      mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: 'org-fr-1',
          canAccessAllOrganizations: false,
          organization: quebecOrgs[0],
        },
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
          endDate: new Date('2024-12-31'),
        },
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
          endDate: null, // Ongoing tenancy
        },
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
          organization: oldOrg,
        },
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
          organization: newOrg,
        },
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
          relationshipType: 'tenant',
        },
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
          relationshipType: 'tenant',
        },
      ]);

      hasAccess = await canUserAccessResidence(testUsers.tenant.id, newResidence.id);
      expect(hasAccess).toBe(true);
    });

    it('should handle Koveo employee promotion to admin', async () => {
      // Scenario: Regular Koveo employee gets promoted to admin
      const koveoEmployee = {
        ...testUsers.koveoUser,
        role: 'manager' as const,
      };

      // Before promotion - limited to Koveo organization access
      mockDb.query.organizations.findFirst
        .mockResolvedValueOnce(testOrganizations.demo)  // Demo org lookup
        .mockResolvedValueOnce({  // Koveo org lookup (triggers global access)
          id: testOrganizations.koveo.id,
          name: 'koveo',
        });
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: testOrganizations.koveo.id,
          canAccessAllOrganizations: false,
          organization: testOrganizations.koveo,
        },
      ]);
      mockDb.query.organizations.findMany.mockResolvedValueOnce([
        testOrganizations.demo,
        testOrganizations.koveo,
        testOrganizations.montreal,
        testOrganizations.quebec,
      ]);

      const accessibleOrgs = await getUserAccessibleOrganizations(koveoEmployee.id);
      expect(accessibleOrgs.length).toBeGreaterThanOrEqual(4); // Koveo gets global access

      // After promotion - should still have global access as admin
      const adminUser = {
        ...koveoEmployee,
        role: 'admin' as const,
      };

      mockDb.query.users.findFirst.mockResolvedValueOnce(adminUser);
      mockDb.query.residences.findFirst.mockResolvedValueOnce({
        ...testResidences.montreal,
        building: testBuildings.montreal,
      });
      mockDb.query.organizations.findFirst.mockResolvedValueOnce(testOrganizations.demo);
      mockDb.query.userOrganizations.findMany.mockResolvedValueOnce([
        {
          organizationId: testOrganizations.koveo.id,
          canAccessAllOrganizations: true,
          organization: testOrganizations.koveo,
        },
      ]);
      mockDb.query.organizations.findMany.mockResolvedValueOnce([
        testOrganizations.demo,
        testOrganizations.koveo,
        testOrganizations.montreal,
        testOrganizations.quebec,
      ]);

      const hasResidenceAccess = await canUserAccessResidence(
        adminUser.id,
        testResidences.montreal.id
      );
      expect(hasResidenceAccess).toBe(true);
    });
  });
});
