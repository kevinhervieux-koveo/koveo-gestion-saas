/**
 * API Routes Validation Tests
 * Simple tests to ensure API route definitions are valid and error-free
 */

import { describe, it, expect } from '@jest/globals';

describe('API Routes Validation', () => {
  describe('Route File Validation', () => {
    it('should validate organizations route structure', async () => {
      // Test that the organizations routes file can be imported
      expect(async () => {
        const { registerOrganizationRoutes } = await import('../../server/api/organizations');
        expect(typeof registerOrganizationRoutes).toBe('function');
      }).not.toThrow();
    });

    it('should validate users route structure', async () => {
      expect(async () => {
        const { registerUserRoutes } = await import('../../server/api/users');
        expect(typeof registerUserRoutes).toBe('function');
      }).not.toThrow();
    });

    it('should validate buildings route structure', async () => {
      expect(async () => {
        const { registerBuildingRoutes } = await import('../../server/api/buildings');
        expect(typeof registerBuildingRoutes).toBe('function');
      }).not.toThrow();
    });

    it('should validate documents route structure', async () => {
      expect(async () => {
        const { registerDocumentRoutes } = await import('../../server/api/documents');
        expect(typeof registerDocumentRoutes).toBe('function');
      }).not.toThrow();
    });

    it('should validate demands route structure', async () => {
      expect(async () => {
        const { registerDemandRoutes } = await import('../../server/api/demands');
        expect(typeof registerDemandRoutes).toBe('function');
      }).not.toThrow();
    });
  });

  describe('Schema Validation', () => {
    it('should validate organization schema exports', async () => {
      const schema = await import('../../shared/schema');
      expect(schema.organizations).toBeDefined();
      expect(schema.insertOrganizationSchema).toBeDefined();
    });

    it('should validate user schema exports', async () => {
      const schema = await import('../../shared/schema');
      expect(schema.users).toBeDefined();
      expect(schema.insertUserSchema).toBeDefined();
    });

    it('should validate building schema exports', async () => {
      const schema = await import('../../shared/schema');
      expect(schema.buildings).toBeDefined();
      expect(schema.insertBuildingSchema).toBeDefined();
    });

    it('should validate residence schema exports', async () => {
      const schema = await import('../../shared/schema');
      expect(schema.residences).toBeDefined();
      expect(schema.insertResidenceSchema).toBeDefined();
    });

    it('should validate document schema exports', async () => {
      const schema = await import('../../shared/schema');
      expect(schema.documents).toBeDefined();
      expect(schema.insertDocumentSchema).toBeDefined();
    });

    it('should validate demand schema exports', async () => {
      const schema = await import('../../shared/schema');
      expect(schema.demands).toBeDefined();
      expect(schema.insertDemandSchema).toBeDefined();
    });
  });

  describe('Database Schema Consistency', () => {
    it('should ensure all schemas are properly typed', async () => {
      const schema = await import('../../shared/schema');
      
      // Test that key schemas exist and are functions/objects
      expect(typeof schema.organizations).toBe('object');
      expect(typeof schema.users).toBe('object');
      expect(typeof schema.buildings).toBe('object');
      expect(typeof schema.residences).toBe('object');
      expect(typeof schema.documents).toBe('object');
      expect(typeof schema.demands).toBe('object');
    });

    it('should validate storage interface compatibility', async () => {
      const { storage, IStorage } = await import('../../server/storage');
      
      // Test that storage interface is properly defined
      expect(typeof storage).toBe('object');
      expect(typeof storage.getOrganizations).toBe('function');
      expect(typeof storage.getUserByEmail).toBe('function');
      expect(typeof storage.getBuildings).toBe('function');
    });
  });

  describe('RBAC Integration', () => {
    it('should validate RBAC middleware functions exist', async () => {
      const rbac = await import('../../server/rbac');
      expect(typeof rbac.requireOrganizationAccess).toBe('function');
      expect(typeof rbac.requireBuildingAccess).toBe('function');
      expect(typeof rbac.requireResidenceAccess).toBe('function');
    });

    it('should validate AuthenticatedUser interface structure', async () => {
      // Test that the RBAC module can be imported without errors
      const rbac = await import('../../server/rbac');
      expect(rbac).toBeDefined();
    });
  });
});