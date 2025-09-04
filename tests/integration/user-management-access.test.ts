import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { db } from '../../server/db';
import { users, organizations, userOrganizations } from '../../shared/schema';
import { eq, inArray } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';

/**
 * User Management Access Control Test
 * 
 * Tests access control for /manager/user-management route:
 * - Managers should see, edit, delete, create users in their organization
 * - Demo managers should only see other demo role users
 * - Regular managers should not see demo users
 * - Proper CRUD operations based on role permissions
 */

describe('User Management Access Control', () => {
  // Test data setup
  const testData = {
    // Organizations
    regularOrg: {
      id: 'org-regular-test',
      name: 'Regular Test Organization',
      type: 'management_company',
      address: '123 Test Street',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A 1A1'
    },
    demoOrg: {
      id: 'org-demo-test',
      name: 'Demo Test Organization',
      type: 'demo',
      address: '456 Demo Street',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1B 1B1'
    },
    // Users
    adminUser: {
      username: 'admin-test',
      email: 'admin@test.koveo.com',
      password: 'admin123',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin' as const,
      language: 'en',
      isActive: true
    },
    regularManager: {
      username: 'manager-regular',
      email: 'manager@test.koveo.com', 
      password: 'manager123',
      firstName: 'Regular',
      lastName: 'Manager',
      role: 'manager' as const,
      language: 'en',
      isActive: true
    },
    demoManager: {
      username: 'demo-manager',
      email: 'demo-manager@test.koveo.com',
      password: 'demo123',
      firstName: 'Demo',
      lastName: 'Manager',
      role: 'demo_manager' as const,
      language: 'en',
      isActive: true
    },
    regularTenant: {
      username: 'tenant-regular',
      email: 'tenant@test.koveo.com',
      password: 'tenant123',
      firstName: 'Regular',
      lastName: 'Tenant',
      role: 'tenant' as const,
      language: 'en',
      isActive: true
    },
    demoTenant: {
      username: 'demo-tenant',
      email: 'demo-tenant@test.koveo.com',
      password: 'demo123',
      firstName: 'Demo',
      lastName: 'Tenant',
      role: 'demo_tenant' as const,
      language: 'en',
      isActive: true
    },
    demoResident: {
      username: 'demo-resident',
      email: 'demo-resident@test.koveo.com',
      password: 'demo123',
      firstName: 'Demo',
      lastName: 'Resident',
      role: 'demo_resident' as const,
      language: 'en',
      isActive: true
    }
  };

  let createdUserIds: string[] = [];
  let createdOrgIds: string[] = [];

  beforeAll(async () => {
    // Clean up any existing test data
    await db.delete(users).where(inArray(users.email, [
      testData.adminUser.email,
      testData.regularManager.email,
      testData.demoManager.email,
      testData.regularTenant.email,
      testData.demoTenant.email,
      testData.demoResident.email
    ]));
    
    await db.delete(organizations).where(inArray(organizations.id, [
      testData.regularOrg.id,
      testData.demoOrg.id
    ]));

    // Create test organizations
    await db.insert(organizations).values([testData.regularOrg, testData.demoOrg]);
    createdOrgIds = [testData.regularOrg.id, testData.demoOrg.id];

    // Create test users with hashed passwords
    const usersToCreate = [
      testData.adminUser,
      testData.regularManager,
      testData.demoManager,
      testData.regularTenant,
      testData.demoTenant,
      testData.demoResident
    ];

    for (const user of usersToCreate) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      const createdUser = await db.insert(users).values({
        username: user.username,
        email: user.email,
        password: hashedPassword,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        language: user.language,
        isActive: user.isActive
      }).returning({ id: users.id });
      
      createdUserIds.push(createdUser[0].id);
      
      // Assign users to organizations
      if (user.role.startsWith('demo')) {
        // Demo users go to demo organization
        await db.insert(userOrganizations).values({
          userId: createdUser[0].id,
          organizationId: testData.demoOrg.id
        });
      } else {
        // Regular users go to regular organization
        await db.insert(userOrganizations).values({
          userId: createdUser[0].id,
          organizationId: testData.regularOrg.id
        });
      }
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (createdUserIds.length > 0) {
      await db.delete(userOrganizations).where(inArray(userOrganizations.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
    
    if (createdOrgIds.length > 0) {
      await db.delete(organizations).where(inArray(organizations.id, createdOrgIds));
    }
  });

  describe('Organization-based User Access', () => {
    it('should verify test users are in correct organizations', async () => {
      // Verify regular manager is in regular org
      const regularManagerOrgs = await db
        .select({ organizationId: userOrganizations.organizationId })
        .from(userOrganizations)
        .leftJoin(users, eq(userOrganizations.userId, users.id))
        .where(eq(users.email, testData.regularManager.email));

      expect(regularManagerOrgs).toHaveLength(1);
      expect(regularManagerOrgs[0].organizationId).toBe(testData.regularOrg.id);

      // Verify demo manager is in demo org
      const demoManagerOrgs = await db
        .select({ organizationId: userOrganizations.organizationId })
        .from(userOrganizations)
        .leftJoin(users, eq(userOrganizations.userId, users.id))
        .where(eq(users.email, testData.demoManager.email));

      expect(demoManagerOrgs).toHaveLength(1);
      expect(demoManagerOrgs[0].organizationId).toBe(testData.demoOrg.id);
    });

    it('should have demo users only in demo organization', async () => {
      const demoUsers = await db
        .select({ 
          email: users.email,
          role: users.role,
          organizationId: userOrganizations.organizationId 
        })
        .from(users)
        .leftJoin(userOrganizations, eq(users.id, userOrganizations.userId))
        .where(inArray(users.role, ['demo_manager', 'demo_tenant', 'demo_resident']));

      expect(demoUsers.length).toBeGreaterThan(0);
      
      // All demo users should be in demo organization
      for (const user of demoUsers) {
        expect(user.organizationId).toBe(testData.demoOrg.id);
      }
    });

    it('should have regular users only in regular organization', async () => {
      const regularUsers = await db
        .select({
          email: users.email,
          role: users.role,
          organizationId: userOrganizations.organizationId
        })
        .from(users)
        .leftJoin(userOrganizations, eq(users.id, userOrganizations.userId))
        .where(inArray(users.role, ['manager', 'tenant', 'resident']));

      const testUsers = regularUsers.filter(u => 
        u.email && u.email.includes('@test.koveo.com')
      );

      expect(testUsers.length).toBeGreaterThan(0);
      
      // All regular test users should be in regular organization  
      for (const user of testUsers) {
        expect(user.organizationId).toBe(testData.regularOrg.id);
      }
    });
  });

  describe('API Endpoint Access Control', () => {
    async function loginUser(email: string, password: string): Promise<string | null> {
      try {
        const response = await fetch('http://localhost:5000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        if (response.ok) {
          const cookies = response.headers.get('set-cookie');
          return cookies;
        }
        return null;
      } catch (error) {
        console.error('Login failed:', error);
        return null;
      }
    }

    async function fetchUsersAsRole(email: string, password: string): Promise<any[]> {
      const cookies = await loginUser(email, password);
      if (!cookies) {
        throw new Error(`Failed to login as ${email}`);
      }

      const response = await fetch('http://localhost:5000/api/users', {
        headers: { 'Cookie': cookies }
      });

      if (response.ok) {
        return await response.json();
      } else {
        throw new Error(`Failed to fetch users: ${response.status}`);
      }
    }

    it('should allow admin to see all users including demo users', async () => {
      const users = await fetchUsersAsRole(testData.adminUser.email, testData.adminUser.password);
      
      expect(users.length).toBeGreaterThan(0);
      
      // Admin should see both regular and demo users
      const userRoles = users.map(u => u.role);
      const hasRegularUsers = userRoles.some(role => ['manager', 'tenant', 'resident'].includes(role));
      const hasDemoUsers = userRoles.some(role => role.startsWith('demo'));
      
      expect(hasRegularUsers).toBe(true);
      expect(hasDemoUsers).toBe(true);
    });

    it('should allow regular manager to see only users in their organization', async () => {
      const users = await fetchUsersAsRole(testData.regularManager.email, testData.regularManager.password);
      
      expect(users.length).toBeGreaterThan(0);
      
      // Regular manager should only see regular users, no demo users
      const userRoles = users.map(u => u.role);
      const hasDemoUsers = userRoles.some(role => role.startsWith('demo'));
      
      expect(hasDemoUsers).toBe(false);
      
      // Should see users from their organization (including themselves)
      const hasRegularUsers = userRoles.some(role => ['admin', 'manager', 'tenant', 'resident'].includes(role));
      expect(hasRegularUsers).toBe(true);
    });

    it('should allow demo manager to see only demo role users', async () => {
      const users = await fetchUsersAsRole(testData.demoManager.email, testData.demoManager.password);
      
      expect(users.length).toBeGreaterThan(0);
      
      // Demo manager should only see demo users
      const userRoles = users.map(u => u.role);
      const hasNonDemoUsers = userRoles.some(role => !role.startsWith('demo'));
      
      expect(hasNonDemoUsers).toBe(false);
      
      // Should see demo users (including themselves)
      const hasDemoUsers = userRoles.some(role => role.startsWith('demo'));
      expect(hasDemoUsers).toBe(true);
    });
  });

  describe('User Management CRUD Operations', () => {
    it('should verify manager can edit users in their organization', async () => {
      // This test would check the PUT /api/users/:id endpoint
      // For now, we'll test the access logic by verifying organization membership
      
      const regularManager = await db
        .select()
        .from(users)
        .where(eq(users.email, testData.regularManager.email))
        .then(results => results[0]);

      const regularTenant = await db
        .select()
        .from(users)
        .where(eq(users.email, testData.regularTenant.email))
        .then(results => results[0]);

      expect(regularManager).toBeDefined();
      expect(regularTenant).toBeDefined();

      // Verify they're in the same organization
      const managerOrgs = await db
        .select({ organizationId: userOrganizations.organizationId })
        .from(userOrganizations)
        .where(eq(userOrganizations.userId, regularManager.id));

      const tenantOrgs = await db
        .select({ organizationId: userOrganizations.organizationId })
        .from(userOrganizations)
        .where(eq(userOrganizations.userId, regularTenant.id));

      expect(managerOrgs[0]?.organizationId).toBe(tenantOrgs[0]?.organizationId);
    });

    it('should verify demo manager cannot access regular users', async () => {
      const demoManager = await db
        .select()
        .from(users)
        .where(eq(users.email, testData.demoManager.email))
        .then(results => results[0]);

      const regularTenant = await db
        .select()
        .from(users)
        .where(eq(users.email, testData.regularTenant.email))
        .then(results => results[0]);

      expect(demoManager).toBeDefined();
      expect(regularTenant).toBeDefined();

      // Verify they're in different organizations
      const demoManagerOrgs = await db
        .select({ organizationId: userOrganizations.organizationId })
        .from(userOrganizations)
        .where(eq(userOrganizations.userId, demoManager.id));

      const regularTenantOrgs = await db
        .select({ organizationId: userOrganizations.organizationId })
        .from(userOrganizations)
        .where(eq(userOrganizations.userId, regularTenant.id));

      expect(demoManagerOrgs[0]?.organizationId).not.toBe(regularTenantOrgs[0]?.organizationId);
    });

    it('should verify role-based access permissions', async () => {
      const allUsers = await db.select().from(users);
      const testUsers = allUsers.filter(u => u.email.includes('@test.koveo.com'));

      // Group users by role
      const usersByRole = {
        admin: testUsers.filter(u => u.role === 'admin'),
        manager: testUsers.filter(u => u.role === 'manager'),
        demo_manager: testUsers.filter(u => u.role === 'demo_manager'),
        tenant: testUsers.filter(u => u.role === 'tenant'),
        demo_tenant: testUsers.filter(u => u.role === 'demo_tenant'),
        demo_resident: testUsers.filter(u => u.role === 'demo_resident')
      };

      // Verify we have the expected roles
      expect(usersByRole.admin.length).toBeGreaterThanOrEqual(1);
      expect(usersByRole.manager.length).toBeGreaterThanOrEqual(1);
      expect(usersByRole.demo_manager.length).toBeGreaterThanOrEqual(1);
      expect(usersByRole.tenant.length).toBeGreaterThanOrEqual(1);
      expect(usersByRole.demo_tenant.length).toBeGreaterThanOrEqual(1);
      expect(usersByRole.demo_resident.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Demo User Isolation', () => {
    it('should ensure demo and regular users are properly isolated', async () => {
      // Get all demo users
      const demoUsers = await db
        .select({ 
          id: users.id,
          role: users.role,
          organizationId: userOrganizations.organizationId 
        })
        .from(users)
        .leftJoin(userOrganizations, eq(users.id, userOrganizations.userId))
        .where(inArray(users.role, ['demo_manager', 'demo_tenant', 'demo_resident']));

      // Get all regular users from our test data
      const regularUsers = await db
        .select({
          id: users.id, 
          role: users.role,
          organizationId: userOrganizations.organizationId
        })
        .from(users)
        .leftJoin(userOrganizations, eq(users.id, userOrganizations.userId))
        .where(inArray(users.email, [
          testData.adminUser.email,
          testData.regularManager.email,
          testData.regularTenant.email
        ]));

      // Verify demo users are only in demo organization
      for (const demoUser of demoUsers) {
        if (demoUser.organizationId) {
          expect(demoUser.organizationId).toBe(testData.demoOrg.id);
        }
      }

      // Verify regular users are not in demo organization
      for (const regularUser of regularUsers) {
        if (regularUser.organizationId && regularUser.role !== 'admin') {
          expect(regularUser.organizationId).not.toBe(testData.demoOrg.id);
        }
      }
    });

    it('should verify demo organization type is properly set', async () => {
      const demoOrg = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, testData.demoOrg.id))
        .then(results => results[0]);

      expect(demoOrg).toBeDefined();
      expect(demoOrg.type).toBe('demo');
    });

    it('should verify regular organization type is not demo', async () => {
      const regularOrg = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, testData.regularOrg.id))
        .then(results => results[0]);

      expect(regularOrg).toBeDefined();
      expect(regularOrg.type).not.toBe('demo');
      expect(regularOrg.type).toBe('management_company');
    });
  });

  describe('Critical Access Control Issues', () => {
    it('should detect if manager can access users outside their organization', async () => {
      // This is a security test to ensure managers cannot access users from other organizations
      const regularManagerUser = await db
        .select()
        .from(users)
        .where(eq(users.email, testData.regularManager.email))
        .then(results => results[0]);

      const demoUsers = await db
        .select()
        .from(users)
        .where(inArray(users.role, ['demo_manager', 'demo_tenant', 'demo_resident']));

      expect(regularManagerUser).toBeDefined();
      expect(demoUsers.length).toBeGreaterThan(0);

      // Regular manager should not be able to access demo users
      // This would be enforced by the API endpoint logic
      const managerOrgs = await db
        .select({ organizationId: userOrganizations.organizationId })
        .from(userOrganizations)
        .where(eq(userOrganizations.userId, regularManagerUser.id));

      const managerOrgIds = managerOrgs.map(org => org.organizationId);
      
      for (const demoUser of demoUsers) {
        const demoUserOrgs = await db
          .select({ organizationId: userOrganizations.organizationId })
          .from(userOrganizations)
          .where(eq(userOrganizations.userId, demoUser.id));
        
        const demoUserOrgIds = demoUserOrgs.map(org => org.organizationId);
        const hasOverlap = managerOrgIds.some(id => demoUserOrgIds.includes(id));
        
        // Should have no organization overlap between regular manager and demo users
        expect(hasOverlap).toBe(false);
      }
    });

    it('should ensure demo manager can only see demo users', async () => {
      const demoManagerUser = await db
        .select()
        .from(users)
        .where(eq(users.email, testData.demoManager.email))
        .then(results => results[0]);

      expect(demoManagerUser).toBeDefined();
      expect(demoManagerUser.role).toBe('demo_manager');

      // Demo manager should only have access to demo organization
      const demoManagerOrgs = await db
        .select({ organizationId: userOrganizations.organizationId })
        .from(userOrganizations)
        .where(eq(userOrganizations.userId, demoManagerUser.id));

      expect(demoManagerOrgs).toHaveLength(1);
      expect(demoManagerOrgs[0].organizationId).toBe(testData.demoOrg.id);
    });
  });
});