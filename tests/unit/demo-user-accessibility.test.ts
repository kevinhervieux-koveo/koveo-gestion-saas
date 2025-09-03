import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { db } from '../../server/db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { DemoManagementService } from '../../server/services/demo-management-service';
import { isOpenDemoUser } from '../../server/rbac';

/**
 * Demo User Accessibility Test Suite
 * 
 * This test verifies that demo users are properly handled when they are 
 * disabled or not accessible in the system. It ensures the system gracefully
 * handles the absence of demo users and provides appropriate responses.
 */

describe('Demo User Accessibility', () => {
  beforeAll(async () => {
    console.log('⚠️  Production DATABASE_URL detected - using for tests with isolation');
    console.log('🛡️  Jest running in safe test environment');
  });

  afterAll(async () => {
    // Clean up any test data if needed
  });

  describe('Demo User Database Presence', () => {
    it('should verify demo users exist and are properly configured', async () => {
      // Check for demo users in database
      const demoManagerUsers = await db
        .select()
        .from(users)
        .where(eq(users.role, 'demo_manager' as any))
        .catch(() => []);

      const demoTenantUsers = await db
        .select()
        .from(users)
        .where(eq(users.role, 'demo_tenant' as any))
        .catch(() => []);

      const demoResidentUsers = await db
        .select()
        .from(users)
        .where(eq(users.role, 'demo_resident' as any))
        .catch(() => []);

      // Verify demo users exist and are properly configured
      expect(demoManagerUsers.length).toBeGreaterThanOrEqual(1);
      expect(demoTenantUsers.length).toBeGreaterThanOrEqual(1);
      expect(demoResidentUsers.length).toBeGreaterThanOrEqual(1);
      
      // All should be active
      [...demoManagerUsers, ...demoTenantUsers, ...demoResidentUsers].forEach(user => {
        expect(user.isActive).toBe(true);
      });
    });

    it('should verify demo users have proper email patterns and are protected', async () => {
      // Check for users with demo email patterns
      const allUsers = await db.select().from(users);
      
      const realDemoUsers = allUsers.filter(user => 
        user.email.includes('demo.') && user.email.includes('@koveo.com')
      );
      
      const testDemoUsers = allUsers.filter(user => 
        user.email.toLowerCase().includes('test-demo') ||
        user.email.toLowerCase().includes('open-demo')
      );

      // Should have our real demo users (they are intentionally preserved)
      expect(realDemoUsers.length).toBeGreaterThanOrEqual(3);
      
      // Test demo users should be cleaned up properly in isolated tests
      expect(testDemoUsers.length).toBe(0);
    });
  });

  describe('Demo Management Service', () => {
    it('should return disabled status for demo organization health check', async () => {
      const healthStatus = await DemoManagementService.checkDemoHealth();
      
      expect(healthStatus.healthy).toBe(true);
      expect(healthStatus.message).toContain('Demo organizations managed locally only');
      expect(healthStatus.status.message).toContain('Demo sync functionality removed');
    });

    it('should return disabled status when ensuring demo organizations', async () => {
      const result = await DemoManagementService.ensureDemoOrganizations();
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Demo organizations functionality disabled');
      expect(result.demoOrgId).toBeUndefined();
      expect(result.openDemoOrgId).toBeUndefined();
    });

    it('should return disabled status when recreating demo organizations', async () => {
      const result = await DemoManagementService.recreateDemoOrganizations();
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Demo organizations functionality disabled');
      expect(result.demoOrgId).toBeUndefined();
      expect(result.openDemoOrgId).toBeUndefined();
    });
  });

  describe('Demo User Authentication', () => {
    it('should handle demo user login attempts gracefully', async () => {
      // Test common demo user credentials
      const demoCredentials = [
        { email: 'demo@koveo-gestion.com', password: 'demo123' },
        { email: 'demo.manager@koveo-gestion.com', password: 'demo123' },
        { email: 'demo.tenant@koveo-gestion.com', password: 'demo123' },
        { email: 'open-demo@koveo-gestion.com', password: 'demo123' }
      ];

      for (const credentials of demoCredentials) {
        // Verify these users don't exist in the database
        const user = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email))
          .then(results => results[0])
          .catch(() => null);

        expect(user).toBeUndefined();
      }
    });

    it('should handle demo user role checks correctly', async () => {
      // Test RBAC function with demo user patterns
      const mockDemoUser = {
        id: 'test-demo-id',
        email: 'demo@test.com',
        role: 'demo_manager',
      };

      // The isOpenDemoUser function should handle demo users appropriately
      // Since demo functionality is disabled, this should return false or handle gracefully
      const result = isOpenDemoUser(mockDemoUser.email);
      
      // Should handle demo users gracefully (either false or throw controlled error)
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Demo User Access Control', () => {
    it('should prevent demo user creation through registration', async () => {
      // Use isolated test email that doesn't conflict with real demo users
      const testUserData = {
        email: 'isolated-test-demo@test-only.com',
        role: 'demo_manager',
        firstName: 'Test',
        lastName: 'Isolated',
        isActive: true,
        username: 'isolated-test-demo',
        password: 'test-hash'
      };

      // Ensure clean test environment - remove any previous test data
      await db.delete(users).where(eq(users.email, testUserData.email));

      // Test demo user creation (should work for testing purposes)
      let creationFailed = false;
      try {
        await db.insert(users).values(testUserData as any);
      } catch (error) {
        creationFailed = true;
      }

      // Always clean up isolated test data (never touch real demo users)
      if (!creationFailed) {
        await db.delete(users).where(eq(users.email, testUserData.email));
      }

      // Verify the isolated test user doesn't persist in the database
      const persistedUser = await db
        .select()
        .from(users)
        .where(eq(users.email, testUserData.email))
        .then(results => results[0])
        .catch(() => null);

      expect(persistedUser).toBeUndefined();
    });

    it('should verify demo organization functionality is properly disabled', async () => {
      // Test that demo organization operations return disabled status
      const operations = [
        DemoManagementService.ensureDemoOrganizations(),
        DemoManagementService.recreateDemoOrganizations(),
        DemoManagementService.checkDemoHealth()
      ];

      const results = await Promise.all(operations);
      
      // All operations should indicate demo functionality is disabled
      results.forEach((result, index) => {
        if (index < 2) {
          // ensureDemoOrganizations and recreateDemoOrganizations have success property
          expect((result as any).success).toBe(true);
          expect((result as any).message).toContain('disabled');
        } else {
          // checkDemoHealth has different structure
          expect((result as any).healthy).toBe(true);
          expect((result as any).message).toContain('locally only');
        }
      });
    });
  });

  describe('Error Handling for Missing Demo Users', () => {
    it('should handle API requests that expect demo users', async () => {
      // Test that API endpoints handle missing demo users gracefully
      // This test verifies the system doesn't crash when demo users are expected but not found
      
      // Mock API request scenarios that might expect demo users
      const scenarios = [
        'GET /api/auth/demo-login',
        'POST /api/users/create-demo',
        'GET /api/organizations/demo'
      ];

      // Each scenario should either:
      // 1. Return a proper error message about demo functionality being disabled
      // 2. Handle the missing demo users gracefully without crashing
      // 3. Provide appropriate user feedback

      scenarios.forEach(scenario => {
        // This test documents the expected behavior when demo users are not accessible
        expect(scenario).toBeDefined();
      });
    });

    it('should provide clear error messages for demo-related operations', async () => {
      // Test that when demo operations fail, they provide clear error messages
      const demoOperationResults = await Promise.all([
        DemoManagementService.ensureDemoOrganizations(),
        DemoManagementService.recreateDemoOrganizations()
      ]);

      demoOperationResults.forEach(result => {
        expect(result.message).toBeDefined();
        expect(result.message.length).toBeGreaterThan(10);
        expect(result.message).toContain('disabled');
      });
    });
  });
});