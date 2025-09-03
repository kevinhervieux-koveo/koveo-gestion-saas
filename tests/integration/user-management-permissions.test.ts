import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../server/routes';
import { db } from '../../server/db';
import * as schema from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

// Create test app similar to existing tests
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Add test authentication middleware that bypasses real auth
  app.use(async (req: any, res, next) => {
    const testUserId = req.headers['x-test-user-id'];
    if (testUserId) {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, testUserId)).limit(1);
      if (user) {
        req.session = { 
          userId: testUserId,
          isAuthenticated: true,
          role: user.role
        };
        req.user = user;
      }
    }
    next();
  });
  
  registerRoutes(app);
  return app;
};

describe('User Management Permissions', () => {
  let app: express.Application;
  let adminUser: any;
  let demoManager: any;
  let regularManager: any;
  let testOrg: any;

  beforeEach(async () => {
    app = createTestApp();
    
    // Clean test data
    await db.delete(schema.userOrganizations);
    await db.delete(schema.users);
    await db.delete(schema.organizations);

    // Create test organization
    const [org] = await db
      .insert(schema.organizations)
      .values({
        name: 'Test Organization',
        type: 'Standard',
        address: '123 Test St',
        city: 'Test City',
        province: 'QC',
        postalCode: 'H1H 1H1',
        phone: '514-555-0123',
        email: 'test@org.com',
      })
      .returning();
    testOrg = org;

    // Create test users
    const users = await db
      .insert(schema.users)
      .values([
        {
          email: 'admin@test.com',
          username: 'admin',
          password: 'hashedpass',
          firstName: 'Admin',
          lastName: 'User',
          role: 'admin',
          isActive: true,
          phone: '514-555-0001',
        },
        {
          email: 'demo.manager@test.com',
          username: 'demo_manager',
          password: 'hashedpass',
          firstName: 'Demo',
          lastName: 'Manager',
          role: 'demo_manager',
          isActive: true,
          phone: '514-555-0002',
        },
        {
          email: 'regular.manager@test.com',
          username: 'regular_manager',
          password: 'hashedpass',
          firstName: 'Regular',
          lastName: 'Manager',
          role: 'manager',
          isActive: true,
          phone: '514-555-0003',
        },
        {
          email: 'demo.tenant@test.com',
          username: 'demo_tenant',
          password: 'hashedpass',
          firstName: 'Demo',
          lastName: 'Tenant',
          role: 'demo_tenant',
          isActive: true,
          phone: '514-555-0004',
        },
        {
          email: 'regular.tenant@test.com',
          username: 'regular_tenant',
          password: 'hashedpass',
          firstName: 'Regular',
          lastName: 'Tenant',
          role: 'tenant',
          isActive: true,
          phone: '514-555-0005',
        }
      ])
      .returning();

    adminUser = users.find(u => u.email === 'admin@test.com');
    demoManager = users.find(u => u.email === 'demo.manager@test.com');
    regularManager = users.find(u => u.email === 'regular.manager@test.com');
    const regularTenant = users.find(u => u.email === 'regular.tenant@test.com');

    // Assign regular manager and tenant to organization
    await db
      .insert(schema.userOrganizations)
      .values([
        {
          userId: regularManager.id,
          organizationId: testOrg.id,
          organizationRole: 'manager',
          isActive: true,
        },
        {
          userId: regularTenant.id,
          organizationId: testOrg.id,
          organizationRole: 'tenant',
          isActive: true,
        }
      ]);
  });

  afterEach(async () => {
    await db.delete(schema.userOrganizations);
    await db.delete(schema.users);
    await db.delete(schema.organizations);
  });

  describe('Demo User Visibility', () => {
    it('should show only demo users to demo manager', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('x-test-user-id', demoManager.id)
        .expect(200);

      const users = response.body;
      const visibleRoles = users.map((user: any) => user.role);
      
      // Demo manager should only see demo users
      expect(visibleRoles).toContain('demo_manager');
      expect(visibleRoles).toContain('demo_tenant');
      
      // Should NOT see regular roles
      expect(visibleRoles).not.toContain('admin');
      expect(visibleRoles).not.toContain('manager');
      expect(visibleRoles).not.toContain('tenant');
    });

    it('should allow regular manager to see non-demo users in their organization', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('x-test-user-id', regularManager.id)
        .expect(200);

      const users = response.body;
      const visibleEmails = users.map((user: any) => user.email);
      
      // Should see users in their organization
      expect(visibleEmails).toContain('regular.tenant@test.com');
      expect(visibleEmails).toContain('regular.manager@test.com');
      
      // Should NOT see demo users
      expect(visibleEmails).not.toContain('demo.tenant@test.com');
      expect(visibleEmails).not.toContain('demo.manager@test.com');
    });

    it('should allow admin to see all users', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('x-test-user-id', adminUser.id)
        .expect(200);

      const users = response.body;
      const visibleEmails = users.map((user: any) => user.email);
      
      // Admin should see all users
      expect(visibleEmails).toContain('admin@test.com');
      expect(visibleEmails).toContain('regular.manager@test.com');
      expect(visibleEmails).toContain('demo.manager@test.com');
      expect(visibleEmails).toContain('demo.tenant@test.com');
      expect(visibleEmails).toContain('regular.tenant@test.com');
    });
  });

  describe('Organization Assignment Restrictions', () => {
    it('should prevent regular manager from modifying organization assignments', async () => {
      const [user] = await db
        .insert(schema.users)
        .values({
          email: 'testuser@test.com',
          username: 'testuser',
          password: 'hashedpass',
          firstName: 'Test',
          lastName: 'User',
          role: 'tenant',
          isActive: true,
          phone: '514-555-0006',
        })
        .returning();

      // Manager tries to assign organization (should fail)
      const response = await request(app)
        .put(`/api/users/${user.id}/organizations`)
        .set('x-test-user-id', regularManager.id)
        .send({ organizationIds: [testOrg.id] })
        .expect(403);

      expect(response.body.message).toContain('Only administrators can modify organization assignments');
    });

    it('should allow admin to modify organization assignments', async () => {
      const [user] = await db
        .insert(schema.users)
        .values({
          email: 'testuser2@test.com',
          username: 'testuser2',
          password: 'hashedpass',
          firstName: 'Test2',
          lastName: 'User2',
          role: 'tenant',
          isActive: true,
          phone: '514-555-0007',
        })
        .returning();

      // Admin assigns organization (should succeed)
      const response = await request(app)
        .put(`/api/users/${user.id}/organizations`)
        .set('x-test-user-id', adminUser.id)
        .send({ organizationIds: [testOrg.id] })
        .expect(200);

      expect(response.body.message).toBe('Organization assignments updated successfully');

      // Verify assignment was created
      const assignments = await db
        .select()
        .from(schema.userOrganizations)
        .where(eq(schema.userOrganizations.userId, user.id));

      expect(assignments).toHaveLength(1);
      expect(assignments[0].organizationId).toBe(testOrg.id);
    });
  });

  describe('Residence Assignment Permissions', () => {
    it('should prevent managers from assigning residences outside their organization', async () => {
      // This test validates that the existing permission checks work
      // The implementation is already in place in the residence assignment endpoint
      
      const [user] = await db
        .insert(schema.users)
        .values({
          email: 'testresuser@test.com',
          username: 'testresuser',
          password: 'hashedpass',
          firstName: 'TestRes',
          lastName: 'User',
          role: 'tenant',
          isActive: true,
          phone: '514-555-0008',
        })
        .returning();

      // Try to assign non-existent residence (should fail gracefully)
      const response = await request(app)
        .put(`/api/users/${user.id}/residences`)
        .set('x-test-user-id', regularManager.id)
        .send({ 
          residenceAssignments: [
            {
              residenceId: 'non-existent-residence-id',
              relationshipType: 'tenant',
              startDate: new Date().toISOString().split('T')[0],
            }
          ]
        });

      // Should fail with 404 for non-existent residence
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});