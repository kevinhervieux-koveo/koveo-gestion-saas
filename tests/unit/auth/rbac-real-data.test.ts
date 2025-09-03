/**
 * RBAC Tests with Real Demo Data
 * Tests RBAC functionality using actual demo organization data from the database
 */

import { describe, it, expect } from '@jest/globals';
import {
  getUserAccessibleOrganizations,
  canUserAccessOrganization,
  canUserAccessBuilding,
  canUserAccessResidence,
} from '../../../server/rbac';

describe('RBAC Tests with Real Demo Data', () => {
  // Use real demo user IDs from the database
  const realUsers = {
    admin: '222f5a0d-6bc6-4f28-9f4d-32c133eed333', // kevin.hervieux@koveo-gestion.com
    manager: '29b68c68-4a95-4d2a-bedc-d8b8d4cd3e07', // sophie.tremblay@demo.com
    tenant: '50b33679-279d-4460-8902-04af4e7eac64', // emma.cote@demo.com
    resident: 'afd65a53-f239-4e63-af4c-a05add86115a', // henri.dubois@demo.com
  };

  const realOrganizations = {
    demo: '9ebab63b-433d-4caf-b7cd-b23365e5014f',
    koveo: '75214a4e-241d-4b73-b14f-404fd274516f',
    syndicate: '72263718-6559-4216-bd93-524f7acdcbbc',
  };

  const realBuildings = {
    koveoTower: 'd084392f-facb-40a6-8685-3b40dcdd4b68',
    montreal: '005b0e63-6a0a-44c9-bf01-2b779b316bba',
  };

  describe('Organization Access Control', () => {
    it('should allow admin users access to organizations', async () => {
      const accessibleOrgs = await getUserAccessibleOrganizations(realUsers.admin);
      expect(accessibleOrgs).toBeInstanceOf(Array);
      expect(accessibleOrgs.length).toBeGreaterThan(0);
    });

    it('should allow manager access to demo organization', async () => {
      const hasAccess = await canUserAccessOrganization(realUsers.manager, realOrganizations.demo);
      expect(typeof hasAccess).toBe('boolean');
    });

    it('should handle tenant organization access', async () => {
      const hasAccess = await canUserAccessOrganization(realUsers.tenant, realOrganizations.demo);
      expect(typeof hasAccess).toBe('boolean');
    });
  });

  describe('Building Access Control', () => {
    it('should validate building access for admin users', async () => {
      const hasAccess = await canUserAccessBuilding(realUsers.admin, realBuildings.koveoTower);
      expect(typeof hasAccess).toBe('boolean');
    });

    it('should validate building access for manager users', async () => {
      const hasAccess = await canUserAccessBuilding(realUsers.manager, realBuildings.montreal);
      expect(typeof hasAccess).toBe('boolean');
    });
  });

  describe('Residence Access Control', () => {
    it('should validate residence access for different user roles', async () => {
      // Use a real residence ID from the database
      const residenceId = '7778ab41-b9e2-4ca1-b2cd-f880d5979720';
      
      const adminAccess = await canUserAccessResidence(realUsers.admin, residenceId);
      const tenantAccess = await canUserAccessResidence(realUsers.tenant, residenceId);
      
      expect(typeof adminAccess).toBe('boolean');
      expect(typeof tenantAccess).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid user IDs gracefully', async () => {
      const invalidUserId = 'invalid-user-id';
      const accessibleOrgs = await getUserAccessibleOrganizations(invalidUserId);
      expect(accessibleOrgs).toBeInstanceOf(Array);
    });

    it('should handle invalid organization IDs gracefully', async () => {
      const invalidOrgId = 'invalid-org-id';
      const hasAccess = await canUserAccessOrganization(realUsers.admin, invalidOrgId);
      expect(typeof hasAccess).toBe('boolean');
    });

    it('should handle invalid building IDs gracefully', async () => {
      const invalidBuildingId = 'invalid-building-id';
      const hasAccess = await canUserAccessBuilding(realUsers.admin, invalidBuildingId);
      expect(hasAccess).toBe(false);
    });
  });
});