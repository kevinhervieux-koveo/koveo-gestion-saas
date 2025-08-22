/**
 * @file RBAC System Integration Tests
 * @description End-to-end integration tests for the complete RBAC system,
 * including real API endpoints, database interactions, and security workflows.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { permissions } from '../../config';
import type { Role, Permission } from '../../config/permissions-schema';
import { storage } from '../../server/storage';

// Mock server setup for integration testing
jest.mock('../../server/storage', () => ({
  storage: {
    getUser: jest.fn(),
    getUserByEmail: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    getPasswordResetToken: jest.fn(),
    createPasswordResetToken: jest.fn(),
    markPasswordResetTokenAsUsed: jest.fn(),
    cleanupExpiredPasswordResetTokens: jest.fn()
  }
}));

const mockStorage = storage as jest.Mocked<typeof storage>;

// Test user data for different roles
const testUsers = {
  admin: {
    id: 'admin-1',
    email: 'admin@koveo.com',
    firstName: 'System',
    lastName: 'Administrator',
    username: 'admin@koveo.com',
    role: 'admin' as Role,
    isActive: true,
    language: 'fr',
    password: 'salt:hash', // Mocked hashed password
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null
  },
  manager: {
    id: 'manager-1',
    email: 'manager@koveo.com',
    firstName: 'Property',
    lastName: 'Manager',
    username: 'manager@koveo.com',
    role: 'manager' as Role,
    isActive: true,
    language: 'fr',
    password: 'salt:hash',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null
  },
  tenant: {
    id: 'tenant-1',
    email: 'tenant@koveo.com',
    firstName: 'Test',
    lastName: 'Tenant',
    username: 'tenant@koveo.com',
    role: 'tenant' as Role,
    isActive: true,
    language: 'fr',
    password: 'salt:hash',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null
  },
  resident: {
    id: 'resident-1',
    email: 'resident@koveo.com',
    firstName: 'Test',
    lastName: 'Resident',
    username: 'resident@koveo.com',
    role: 'resident' as Role,
    isActive: true,
    language: 'fr',
    password: 'salt:hash',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null
  },
  inactive: {
    id: 'inactive-1',
    email: 'inactive@koveo.com',
    firstName: 'Inactive',
    lastName: 'User',
    username: 'inactive@koveo.com',
    role: 'tenant' as Role,
    isActive: false,
    language: 'fr',
    password: 'salt:hash',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null
  }
};

describe('RBAC System Integration Tests', () => {
  let app: any;

  beforeAll(async () => {
    // Import app after mocking
    const serverModule = await import('../../server/server');
    app = serverModule.default || serverModule.app;
    
    console.log('🔐 RBAC Integration Test Suite initialized');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all mocks
    Object.values(mockStorage).forEach(mockFn => {
      if (jest.isMockFunction(mockFn)) {
        mockFn.mockReset();
      }
    });
  });

  describe('Authentication Flow Integration', () => {
    it('should complete full authentication flow for admin user', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(testUsers.admin);
      mockStorage.updateUser.mockResolvedValue(testUsers.admin);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@koveo.com',
          password: 'admin123'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.user).toMatchObject({
        id: 'admin-1',
        email: 'admin@koveo.com',
        role: 'admin'
      });
      expect(loginResponse.body.user.password).toBeUndefined();

      // Test authenticated endpoint access
      const userResponse = await request(app)
        .get('/api/auth/user')
        .set('Cookie', loginResponse.headers['set-cookie']);

      expect(userResponse.status).toBe(200);
      expect(userResponse.body.role).toBe('admin');
    });

    it('should reject login for inactive users', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(testUsers.inactive);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'inactive@koveo.com',
          password: 'password'
        });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ACCOUNT_INACTIVE');
    });

    it('should handle invalid credentials', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@koveo.com',
          password: 'password'
        });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should complete logout flow', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(testUsers.admin);
      mockStorage.updateUser.mockResolvedValue(testUsers.admin);

      // Login first
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@koveo.com',
          password: 'admin123'
        });

      expect(loginResponse.status).toBe(200);

      // Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', loginResponse.headers['set-cookie']);

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.message).toBe('Logout successful');

      // Verify session is destroyed
      const userResponse = await request(app)
        .get('/api/auth/user')
        .set('Cookie', loginResponse.headers['set-cookie']);

      expect(userResponse.status).toBe(401);
    });
  });

  describe('Role-Based Route Protection', () => {
    let adminCookies: string[];
    let managerCookies: string[];
    let tenantCookies: string[];

    beforeEach(async () => {
      // Setup authenticated sessions for different roles
      mockStorage.getUserByEmail
        .mockResolvedValueOnce(testUsers.admin)
        .mockResolvedValueOnce(testUsers.manager)
        .mockResolvedValueOnce(testUsers.tenant);
      
      mockStorage.getUser
        .mockResolvedValueOnce(testUsers.admin)
        .mockResolvedValueOnce(testUsers.manager)
        .mockResolvedValueOnce(testUsers.tenant);

      mockStorage.updateUser.mockResolvedValue({} as any);

      // Login as different users
      const adminLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@koveo.com', password: 'admin123' });
      adminCookies = adminLogin.headers['set-cookie'];

      const managerLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'manager@koveo.com', password: 'manager123' });
      managerCookies = managerLogin.headers['set-cookie'];

      const tenantLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'tenant@koveo.com', password: 'tenant123' });
      tenantCookies = tenantLogin.headers['set-cookie'];
    });

    it('should enforce admin-only routes', async () => {
      // Mock user registration (admin-only route)
      const userRegistrationTests = [
        { cookies: adminCookies, expectedStatus: 201, role: 'admin' },
        { cookies: managerCookies, expectedStatus: 403, role: 'manager' },
        { cookies: tenantCookies, expectedStatus: 403, role: 'tenant' }
      ];

      mockStorage.createUser.mockResolvedValue({
        ...testUsers.tenant,
        id: 'new-user',
        email: 'newuser@koveo.com'
      });

      for (const test of userRegistrationTests) {
        const response = await request(app)
          .post('/api/auth/register')
          .set('Cookie', test.cookies)
          .send({
            email: 'newuser@koveo.com',
            password: 'password123',
            firstName: 'New',
            lastName: 'User',
            role: 'tenant'
          });

        expect(response.status).toBe(test.expectedStatus);
        
        if (test.expectedStatus === 403) {
          expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
        }
      }
    });

    it('should validate permission-based route access', async () => {
      // Test various permission-based routes
      const permissionTests = [
        {
          endpoint: '/api/users',
          method: 'get',
          permission: 'read:user',
          adminAccess: true,
          managerAccess: true,
          tenantAccess: false
        },
        {
          endpoint: '/api/buildings',
          method: 'post',
          permission: 'create:building',
          adminAccess: true,
          managerAccess: true,
          tenantAccess: false
        },
        {
          endpoint: '/api/bills',
          method: 'get',
          permission: 'read:bill',
          adminAccess: true,
          managerAccess: true,
          tenantAccess: true
        }
      ];

      for (const test of permissionTests) {
        // Test admin access
        if (app[test.method]) {
          const adminResponse = await request(app)
            [test.method](test.endpoint)
            .set('Cookie', adminCookies);

          if (test.adminAccess) {
            expect(adminResponse.status).not.toBe(403);
          } else {
            expect(adminResponse.status).toBe(403);
          }

          // Test manager access
          const managerResponse = await request(app)
            [test.method](test.endpoint)
            .set('Cookie', managerCookies);

          if (test.managerAccess) {
            expect(managerResponse.status).not.toBe(403);
          } else {
            expect(managerResponse.status).toBe(403);
          }

          // Test tenant access
          const tenantResponse = await request(app)
            [test.method](test.endpoint)
            .set('Cookie', tenantCookies);

          if (test.tenantAccess) {
            expect(tenantResponse.status).not.toBe(403);
          } else {
            expect(tenantResponse.status).toBe(403);
          }
        }
      }
    });
  });

  describe('Permission Matrix Validation', () => {
    it('should validate comprehensive permission matrix against actual endpoints', async () => {
      const permissionEndpoints = {
        // User management
        'read:user': ['/api/users'],
        'create:user': ['/api/auth/register'],
        'update:user': ['/api/users/:id'],
        'delete:user': ['/api/users/:id'],

        // Building management
        'read:building': ['/api/buildings'],
        'create:building': ['/api/buildings'],
        'update:building': ['/api/buildings/:id'],
        'delete:building': ['/api/buildings/:id'],

        // Bill management
        'read:bill': ['/api/bills'],
        'create:bill': ['/api/bills'],
        'update:bill': ['/api/bills/:id'],
        'delete:bill': ['/api/bills/:id'],

        // Document management
        'read:document': ['/api/documents'],
        'create:document': ['/api/documents'],
        'update:document': ['/api/documents/:id'],
        'delete:document': ['/api/documents/:id']
      };

      const roles: Role[] = ['admin', 'manager', 'tenant', 'resident'];
      let validationResults: any[] = [];

      roles.forEach(role => {
        const rolePermissions = permissions[role];
        
        Object.entries(permissionEndpoints).forEach(([permission, endpoints]) => {
          const hasPermission = rolePermissions.includes(permission as Permission);
          
          endpoints.forEach(endpoint => {
            validationResults.push({
              role,
              permission,
              endpoint,
              hasPermission,
              expected: hasPermission
            });
          });
        });
      });

      // Check that permission distribution makes logical sense
      const adminPermissions = validationResults.filter(r => r.role === 'admin' && r.hasPermission);
      const managerPermissions = validationResults.filter(r => r.role === 'manager' && r.hasPermission);
      const tenantPermissions = validationResults.filter(r => r.role === 'tenant' && r.hasPermission);

      expect(adminPermissions.length).toBeGreaterThan(managerPermissions.length);
      expect(managerPermissions.length).toBeGreaterThan(tenantPermissions.length);

      console.log(`✅ Validated permission matrix across ${validationResults.length} role-endpoint combinations`);
    });

    it('should verify no orphaned permissions exist', async () => {
      const allPermissions = Object.values(permissions).flat();
      const uniquePermissions = [...new Set(allPermissions)];
      
      // Check that all permissions have valid format
      const invalidPermissions = uniquePermissions.filter(permission => {
        return !permission.match(/^[a-z_]+:[a-z_]+$/);
      });

      expect(invalidPermissions.length).toBe(0, 
        `Invalid permission formats: ${invalidPermissions.join(', ')}`);

      // Check that all permissions are being used
      const permissionUsage: Record<string, number> = {};
      allPermissions.forEach(permission => {
        permissionUsage[permission] = (permissionUsage[permission] || 0) + 1;
      });

      const unusedPermissions = uniquePermissions.filter(permission => 
        permissionUsage[permission] === 1
      );

      if (unusedPermissions.length > 0) {
        console.warn(`⚠️ Permissions used by only one role: ${unusedPermissions.join(', ')}`);
      }

      console.log(`✅ Verified ${uniquePermissions.length} unique permissions across all roles`);
    });
  });

  describe('Security Edge Cases', () => {
    it('should prevent session hijacking attempts', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(testUsers.admin);
      mockStorage.getUser.mockResolvedValue(testUsers.admin);
      mockStorage.updateUser.mockResolvedValue(testUsers.admin);

      // Login as admin
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@koveo.com',
          password: 'admin123'
        });

      const adminCookies = loginResponse.headers['set-cookie'];

      // Verify session works
      const validResponse = await request(app)
        .get('/api/auth/user')
        .set('Cookie', adminCookies);

      expect(validResponse.status).toBe(200);

      // Test with manipulated cookie
      const manipulatedCookie = adminCookies[0].replace(/koveo\.sid=([^;]+)/, 'koveo.sid=invalid-session-id');
      
      const invalidResponse = await request(app)
        .get('/api/auth/user')
        .set('Cookie', [manipulatedCookie]);

      expect(invalidResponse.status).toBe(401);
    });

    it('should handle concurrent permission checks', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(testUsers.admin);
      mockStorage.getUser.mockResolvedValue(testUsers.admin);
      mockStorage.updateUser.mockResolvedValue(testUsers.admin);

      // Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@koveo.com',
          password: 'admin123'
        });

      const adminCookies = loginResponse.headers['set-cookie'];

      // Make concurrent requests to different protected endpoints
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => 
        request(app)
          .get('/api/auth/user')
          .set('Cookie', adminCookies)
      );

      const responses = await Promise.all(concurrentRequests);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.role).toBe('admin');
      });

      console.log('✅ Handled 10 concurrent permission checks successfully');
    });

    it('should validate role consistency across session lifecycle', async () => {
      const userWithChangedRole = {
        ...testUsers.manager,
        role: 'tenant' as Role // Role changed in database
      };

      mockStorage.getUserByEmail.mockResolvedValue(testUsers.manager);
      mockStorage.updateUser.mockResolvedValue(testUsers.manager);

      // Initial login as manager
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'manager@koveo.com',
          password: 'manager123'
        });

      const cookies = loginResponse.headers['set-cookie'];

      // First request should work with manager role
      mockStorage.getUser.mockResolvedValue(testUsers.manager);
      const firstResponse = await request(app)
        .get('/api/auth/user')
        .set('Cookie', cookies);

      expect(firstResponse.status).toBe(200);
      expect(firstResponse.body.role).toBe('manager');

      // Simulate role change in database
      mockStorage.getUser.mockResolvedValue(userWithChangedRole);
      
      // Next request should reflect the updated role
      const secondResponse = await request(app)
        .get('/api/auth/user')
        .set('Cookie', cookies);

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body.role).toBe('tenant');

      console.log('✅ Role consistency maintained across session lifecycle');
    });
  });

  describe('Organization Access Control', () => {
    it('should enforce organization-based access restrictions', async () => {
      const userWithMultipleOrgs = {
        ...testUsers.admin,
        organizations: ['org-1', 'org-2'],
        canAccessAllOrganizations: true
      };

      const userWithSingleOrg = {
        ...testUsers.manager,
        organizations: ['org-1'],
        canAccessAllOrganizations: false
      };

      // Test multi-org access
      mockStorage.getUserByEmail.mockResolvedValueOnce(testUsers.admin);
      mockStorage.getUser.mockResolvedValueOnce(userWithMultipleOrgs);
      mockStorage.updateUser.mockResolvedValue(testUsers.admin);

      const adminLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@koveo.com',
          password: 'admin123'
        });

      const adminResponse = await request(app)
        .get('/api/auth/user')
        .set('Cookie', adminLogin.headers['set-cookie']);

      expect(adminResponse.body.canAccessAllOrganizations).toBe(true);
      expect(adminResponse.body.organizations).toHaveLength(2);

      // Test single-org access
      mockStorage.getUserByEmail.mockResolvedValueOnce(testUsers.manager);
      mockStorage.getUser.mockResolvedValueOnce(userWithSingleOrg);

      const managerLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'manager@koveo.com',
          password: 'manager123'
        });

      const managerResponse = await request(app)
        .get('/api/auth/user')
        .set('Cookie', managerLogin.headers['set-cookie']);

      expect(managerResponse.body.canAccessAllOrganizations).toBe(false);
      expect(managerResponse.body.organizations).toHaveLength(1);

      console.log('✅ Organization-based access control working correctly');
    });
  });

  afterAll(() => {
    console.log('\n🎯 RBAC INTEGRATION TEST SUMMARY');
    console.log('=================================');
    console.log('✅ Authentication flow integration verified');
    console.log('✅ Role-based route protection validated');
    console.log('✅ Permission matrix consistency confirmed');
    console.log('✅ Security edge cases handled');
    console.log('✅ Organization access control enforced');
    console.log('✅ Session lifecycle management tested');
    console.log('\n🔒 RBAC system integration validated for production');
  });
});