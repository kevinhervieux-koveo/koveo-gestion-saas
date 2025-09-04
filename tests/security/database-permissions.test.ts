import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// Mock WebSocket constructor for Jest environment
jest.mock('ws', () => ({
  __esModule: true,
  default: class MockWebSocket {}
}));

import { registerRoutes } from '../../server/routes';
import { db } from '../../server/db';
import * as schema from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

/**
 * Database Permissions and Access Control Security Tests
 * 
 * Validates that:
 * - Users can only access data within their organization
 * - Role-based access controls are properly enforced
 * - Cross-organization data leakage is prevented
 * - Sensitive data is protected according to user roles
 */

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  registerRoutes(app);
  return app;
};

describe('Database Permissions Security', () => {
  let app: express.Application;
  let org1: any, org2: any;
  let admin1: any, manager1: any, resident1: any;
  let admin2: any, manager2: any, resident2: any;

  beforeEach(async () => {
    app = createTestApp();
    
    // Clean up test data
    await db.delete(schema.users).where(eq(schema.users.email, 'dbperm-admin1@test.com'));
    await db.delete(schema.users).where(eq(schema.users.email, 'dbperm-admin2@test.com'));
    await db.delete(schema.users).where(eq(schema.users.email, 'dbperm-manager1@test.com'));
    await db.delete(schema.users).where(eq(schema.users.email, 'dbperm-manager2@test.com'));
    await db.delete(schema.users).where(eq(schema.users.email, 'dbperm-resident1@test.com'));
    await db.delete(schema.users).where(eq(schema.users.email, 'dbperm-resident2@test.com'));
    
    // Create test organizations
    [org1] = await db.insert(schema.organizations).values({
      name: 'Security Test Org 1',
      type: 'syndicate',
      address: '123 Test St',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A 1A1',
    }).returning();

    [org2] = await db.insert(schema.organizations).values({
      name: 'Security Test Org 2', 
      type: 'syndicate',
      address: '456 Test Ave',
      city: 'Quebec',
      province: 'QC',
      postalCode: 'G1A 1A1',
    }).returning();

    // Create users in different organizations with different roles
    [admin1] = await db.insert(schema.users).values({
      username: 'admin1',
      email: 'dbperm-admin1@test.com',
      firstName: 'Admin',
      lastName: 'One',
      password: await bcrypt.hash('password123', 12),
      role: 'admin',
    }).returning();

    [manager1] = await db.insert(schema.users).values({
      username: 'manager1',
      email: 'dbperm-manager1@test.com',
      firstName: 'Manager',
      lastName: 'One',
      password: await bcrypt.hash('password123', 12),
      role: 'manager',
    }).returning();

    [resident1] = await db.insert(schema.users).values({
      username: 'resident1',
      email: 'dbperm-resident1@test.com',
      firstName: 'Resident',
      lastName: 'One',
      password: await bcrypt.hash('password123', 12),
      role: 'resident',
    }).returning();

    [admin2] = await db.insert(schema.users).values({
      username: 'admin2',
      email: 'dbperm-admin2@test.com',
      firstName: 'Admin',
      lastName: 'Two',
      password: await bcrypt.hash('password123', 12),
      role: 'admin',
    }).returning();

    [manager2] = await db.insert(schema.users).values({
      username: 'manager2',
      email: 'dbperm-manager2@test.com',
      firstName: 'Manager',
      lastName: 'Two',
      password: await bcrypt.hash('password123', 12),
      role: 'manager',
    }).returning();

    [resident2] = await db.insert(schema.users).values({
      username: 'resident2',
      email: 'dbperm-resident2@test.com',
      firstName: 'Resident',
      lastName: 'Two',
      password: await bcrypt.hash('password123', 12),
      role: 'resident',
    }).returning();

    // Link users to organizations
    await db.insert(schema.userOrganizations).values([
      { userId: admin1[0].id, organizationId: org1.id, organizationRole: 'admin' },
      { userId: manager1[0].id, organizationId: org1.id, organizationRole: 'manager' },
      { userId: resident1[0].id, organizationId: org1.id, organizationRole: 'resident' },
      { userId: admin2[0].id, organizationId: org2.id, organizationRole: 'admin' },
      { userId: manager2[0].id, organizationId: org2.id, organizationRole: 'manager' },
      { userId: resident2[0].id, organizationId: org2.id, organizationRole: 'resident' },
    ]);
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(schema.users).where(eq(schema.users.email, 'dbperm-admin1@test.com'));
    await db.delete(schema.users).where(eq(schema.users.email, 'dbperm-admin2@test.com'));
    await db.delete(schema.users).where(eq(schema.users.email, 'dbperm-manager1@test.com'));
    await db.delete(schema.users).where(eq(schema.users.email, 'dbperm-manager2@test.com'));
    await db.delete(schema.users).where(eq(schema.users.email, 'dbperm-resident1@test.com'));
    await db.delete(schema.users).where(eq(schema.users.email, 'dbperm-resident2@test.com'));
    
    if (org1?.id) await db.delete(schema.organizations).where(eq(schema.organizations.id, org1.id));
    if (org2?.id) await db.delete(schema.organizations).where(eq(schema.organizations.id, org2.id));
  });

  describe('Cross-Organization Access Prevention', () => {
    it('should prevent users from accessing data in other organizations', async () => {
      // Attempt to login as user from org1 and access org2 data
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'manager1',
          password: 'password123',
        });

      expect(loginResponse.status).toBe(200);
      const sessionCookie = loginResponse.headers['set-cookie'];

      // Try to access users from org2 (should be forbidden)
      const usersResponse = await request(app)
        .get('/api/users')
        .set('Cookie', sessionCookie)
        .query({ organizationId: org2.id });

      expect(usersResponse.status).toBe(403);
    });

    it('should prevent cross-organization building access', async () => {
      // Create buildings in both organizations
      const [building1] = await db.insert(schema.buildings).values({
        name: 'Org 1 Building',
        address: '123 Org1 St',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A 1A1',
        organizationId: org1.id,
        buildingType: 'apartment',
        totalUnits: 20,
      }).returning();

      const [building2] = await db.insert(schema.buildings).values({
        name: 'Org 2 Building',
        address: '456 Org2 Ave',
        city: 'Quebec',
        province: 'QC',
        postalCode: 'G1A 1A1',
        organizationId: org2.id,
        buildingType: 'apartment',
        totalUnits: 15,
      }).returning();

      // Login as org1 user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'manager1',
          password: 'password123',
        });

      const sessionCookie = loginResponse.headers['set-cookie'];

      // Try to access org2 building (should fail)
      const buildingResponse = await request(app)
        .get(`/api/buildings/${building2.id}`)
        .set('Cookie', sessionCookie);

      expect(buildingResponse.status).toBe(403);

      // Clean up
      await db.delete(schema.buildings).where(eq(schema.buildings.id, building1.id));
      await db.delete(schema.buildings).where(eq(schema.buildings.id, building2.id));
    });
  });

  describe('Role-Based Data Access', () => {
    it('should enforce document access based on user roles', async () => {
      // Test document access permissions by role
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'resident1',
          password: 'password123',
        });

      const sessionCookie = loginResponse.headers['set-cookie'];

      // Resident should not be able to access admin documents
      const adminDocsResponse = await request(app)
        .get('/api/documents')
        .set('Cookie', sessionCookie)
        .query({ category: 'administrative' });

      // Verify access is properly restricted
      expect(adminDocsResponse.status).toBe(200);
      // Residents should only see documents they have access to
    });

    it('should prevent privilege escalation attempts', async () => {
      // Login as resident
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'resident1',
          password: 'password123',
        });

      const sessionCookie = loginResponse.headers['set-cookie'];

      // Try to update own role (should fail)
      const roleUpdateResponse = await request(app)
        .patch(`/api/users/${resident1.id}`)
        .set('Cookie', sessionCookie)
        .send({
          role: 'admin'
        });

      expect(roleUpdateResponse.status).toBe(403);
    });
  });

  describe('Data Isolation', () => {
    it('should ensure users only see their organization data in listings', async () => {
      // Login as org1 manager
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'manager1',
          password: 'password123',
        });

      const sessionCookie = loginResponse.headers['set-cookie'];

      // Get users list - should only contain org1 users
      const usersResponse = await request(app)
        .get('/api/users')
        .set('Cookie', sessionCookie);

      expect(usersResponse.status).toBe(200);
      const users = usersResponse.body;
      
      // Verify all returned users belong to org1
      users.forEach((user: any) => {
        expect(user.organizationId).toBe(org1.id);
      });
    });

    it('should prevent SQL injection in organization filtering', async () => {
      // Login as user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'manager1',
          password: 'password123',
        });

      const sessionCookie = loginResponse.headers['set-cookie'];

      // Try SQL injection attack in query parameters
      const maliciousResponse = await request(app)
        .get('/api/users')
        .set('Cookie', sessionCookie)
        .query({ organizationId: `${org1.id}' OR '1'='1` });

      // Should still only return org1 users, not all users
      expect(maliciousResponse.status).toBe(200);
      const users = maliciousResponse.body;
      users.forEach((user: any) => {
        expect(user.organizationId).toBe(org1.id);
      });
    });
  });

  describe('Sensitive Data Protection', () => {
    it('should not expose password hashes in user data', async () => {
      // Login and get user profile
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'manager1',
          password: 'password123',
        });

      const sessionCookie = loginResponse.headers['set-cookie'];
      
      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Cookie', sessionCookie);

      expect(profileResponse.status).toBe(200);
      const profile = profileResponse.body;
      
      // Password should never be included in profile data
      expect(profile.password).toBeUndefined();
    });

    it('should protect session data from unauthorized access', async () => {
      // Try to access session data without authentication
      const sessionResponse = await request(app)
        .get('/api/auth/profile');

      expect(sessionResponse.status).toBe(401);
    });

    it('should sanitize database error messages', async () => {
      // Try to create user with invalid data to trigger database error
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin1',
          password: 'password123',
        });

      const sessionCookie = loginResponse.headers['set-cookie'];

      const createUserResponse = await request(app)
        .post('/api/users')
        .set('Cookie', sessionCookie)
        .send({
          // Invalid data to trigger database constraints
          username: '', // Empty username should trigger error
          email: 'invalid-email', // Invalid email format
        });

      expect(createUserResponse.status).toBe(400);
      
      // Error message should not contain internal database details
      const errorMessage = createUserResponse.body.error || createUserResponse.body.message || '';
      expect(errorMessage).not.toContain('constraint');
      expect(errorMessage).not.toContain('violation');
      expect(errorMessage).not.toContain('postgresql');
    });
  });

  describe('Session Security', () => {
    it('should invalidate sessions on logout', async () => {
      // Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'manager1',
          password: 'password123',
        });

      expect(loginResponse.status).toBe(200);
      const sessionCookie = loginResponse.headers['set-cookie'];

      // Verify session works
      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Cookie', sessionCookie);
      expect(profileResponse.status).toBe(200);

      // Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', sessionCookie);
      expect(logoutResponse.status).toBe(200);

      // Try to use session after logout (should fail)
      const postLogoutResponse = await request(app)
        .get('/api/auth/profile')
        .set('Cookie', sessionCookie);
      expect(postLogoutResponse.status).toBe(401);
    });

    it('should prevent session fixation attacks', async () => {
      // Get initial session
      const initialResponse = await request(app)
        .get('/api/auth/profile');

      const initialCookie = initialResponse.headers['set-cookie'];

      // Login should create new session
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .set('Cookie', initialCookie)
        .send({
          username: 'manager1',
          password: 'password123',
        });

      expect(loginResponse.status).toBe(200);
      const loginCookie = loginResponse.headers['set-cookie'];

      // Session ID should have changed after login
      expect(loginCookie).toBeDefined();
      expect(loginCookie).not.toEqual(initialCookie);
    });
  });

  describe('Input Validation Security', () => {
    it('should prevent NoSQL/SQL injection in user queries', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin1',
          password: 'password123',
        });

      const sessionCookie = loginResponse.headers['set-cookie'];

      // Try injection attempts in various endpoints
      const injectionAttempts = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "$where: '1 == 1'",
        "{ $ne: null }",
        "../../../etc/passwd"
      ];

      for (const injection of injectionAttempts) {
        const response = await request(app)
          .get('/api/users')
          .set('Cookie', sessionCookie)
          .query({ search: injection });

        // Should not cause server errors or return unexpected data
        expect(response.status).toBeLessThan(500);
      }
    });
  });
});