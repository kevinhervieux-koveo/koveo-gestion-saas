import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { registerRoutes } from '../../../server/routes';
import { db } from '../../../server/db';
import * as schema from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

/**
 * User Deletion Test Suite
 * 
 * Tests complete user deletion functionality including:
 * - Complete record removal (not marking inactive)
 * - Authentication requirements
 * - Admin vs self-deletion permissions
 * - Related data cleanup
 * - Error handling for non-existent users
 */

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  registerRoutes(app);
  return app;
};

describe('User Deletion', () => {
  let app: express.Application;
  let testUser: any;
  let adminUser: any;
  let testOrganization: any;
  let authCookie: string;

  beforeEach(async () => {
    app = createTestApp();
    
    // Clean up any existing test data
    await db.delete(schema.users).where(eq(schema.users.email, 'test-deletion@example.com'));
    await db.delete(schema.users).where(eq(schema.users.email, 'admin-test@example.com'));

    // Create test organization
    testOrganization = await db
      .insert(schema.organizations)
      .values({
        name: 'Test Deletion Org',
        type: 'syndicate',
        address: '456 Delete St',
        city: 'Quebec City',
        province: 'QC',
        postalCode: 'G1A 1A1',
      })
      .returning();

    // Create admin user for testing admin deletion
    adminUser = await db
      .insert(schema.users)
      .values({
        username: 'admintest',
        email: 'admin-test@example.com',
        firstName: 'Admin',
        lastName: 'Test',
        password: await bcrypt.hash('AdminPass123!', 12),
        role: 'admin',
      })
      .returning();

    // Create test user to be deleted
    testUser = await db
      .insert(schema.users)
      .values({
        username: 'testdeletion',
        email: 'test-deletion@example.com',
        firstName: 'Delete',
        lastName: 'Me',
        password: await bcrypt.hash('DeletePass123!', 12),
        role: 'manager',
      })
      .returning();

    // Create user-organization relationship
    await db.insert(schema.userOrganizations).values({
      userId: testUser[0].id,
      organizationId: testOrganization[0].id,
    });

    // Authenticate as admin for admin deletion tests
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin-test@example.com',
        password: 'AdminPass123!',
      });

    authCookie = loginResponse.headers['set-cookie'][0];
  });

  afterEach(async () => {
    // Clean up test data
    if (testUser?.[0]?.id) {
      await db.delete(schema.userOrganizations).where(eq(schema.userOrganizations.userId, testUser[0].id));
    }
    await db.delete(schema.users).where(eq(schema.users.email, 'test-deletion@example.com'));
    await db.delete(schema.users).where(eq(schema.users.email, 'admin-test@example.com'));
    if (testOrganization?.[0]?.id) {
      await db.delete(schema.organizations).where(eq(schema.organizations.id, testOrganization[0].id));
    }
  });

  describe('Admin User Deletion', () => {
    it('should completely remove user record from database', async () => {
      const response = await request(app)
        .post(`/api/users/${testUser[0].id}/delete-account`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'User account deleted successfully',
        success: true,
      });

      // Verify user is completely removed from database
      const deletedUser = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, testUser[0].id))
        .limit(1);

      expect(deletedUser).toHaveLength(0);
    });

    it('should remove user-organization relationships', async () => {
      await request(app)
        .post(`/api/users/${testUser[0].id}/delete-account`)
        .set('Cookie', authCookie)
        .expect(200);

      // Verify user-organization relationships are removed
      const userOrgs = await db
        .select()
        .from(schema.userOrganizations)
        .where(eq(schema.userOrganizations.userId, testUser[0].id));

      expect(userOrgs).toHaveLength(0);
    });

    it('should require authentication for admin deletion', async () => {
      const response = await request(app)
        .post(`/api/users/${testUser[0].id}/delete-account`)
        .expect(401);

      expect(response.body).toMatchObject({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    });

    it('should return error for non-existent user deletion', async () => {
      const response = await request(app)
        .post('/api/users/non-existent-user-id/delete-account')
        .set('Cookie', authCookie)
        .expect(404);

      expect(response.body).toMatchObject({
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    });

    it('should require valid user ID parameter', async () => {
      const response = await request(app)
        .post('/api/users//delete-account')
        .set('Cookie', authCookie)
        .expect(400);

      expect(response.body).toMatchObject({
        message: 'User ID is required',
        code: 'MISSING_USER_ID',
      });
    });
  });

  describe('Self Deletion', () => {
    let userAuthCookie: string;

    beforeEach(async () => {
      // Login as the test user for self-deletion tests
      const userLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test-deletion@example.com',
          password: 'DeletePass123!',
        });

      userAuthCookie = userLoginResponse.headers['set-cookie'][0];
    });

    it('should allow user to delete their own account', async () => {
      const response = await request(app)
        .post('/api/users/me/delete-account')
        .set('Cookie', userAuthCookie)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Your account has been deleted successfully',
        success: true,
      });

      // Verify user is completely removed
      const deletedUser = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, testUser[0].id))
        .limit(1);

      expect(deletedUser).toHaveLength(0);
    });

    it('should require authentication for self deletion', async () => {
      const response = await request(app)
        .post('/api/users/me/delete-account')
        .expect(401);

      expect(response.body).toMatchObject({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    });

    it('should clear session after self deletion', async () => {
      await request(app)
        .post('/api/users/me/delete-account')
        .set('Cookie', userAuthCookie)
        .expect(200);

      // Try to access protected endpoint with same cookie
      const protectedResponse = await request(app)
        .get('/api/users/me/organizations')
        .set('Cookie', userAuthCookie)
        .expect(401);

      expect(protectedResponse.body).toMatchObject({
        message: 'Authentication required',
      });
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity after user deletion', async () => {
      // Create some related data
      const invitation = await db
        .insert(schema.invitations)
        .values({
          email: 'related-invite@example.com',
          token: 'related-token',
          tokenHash: 'hash123',
          role: 'tenant',
          organizationId: testOrganization[0].id,
          invitedByUserId: testUser[0].id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: 'pending',
        })
        .returning();

      // Delete the user
      await request(app)
        .post(`/api/users/${testUser[0].id}/delete-account`)
        .set('Cookie', authCookie)
        .expect(200);

      // Verify related invitation still exists but references are handled properly
      const relatedInvitation = await db
        .select()
        .from(schema.invitations)
        .where(eq(schema.invitations.id, invitation[0].id))
        .limit(1);

      expect(relatedInvitation).toHaveLength(1);
      expect(relatedInvitation[0].invitedByUserId).toBe(testUser[0].id);

      // Clean up
      await db.delete(schema.invitations).where(eq(schema.invitations.id, invitation[0].id));
    });
  });

  describe('Edge Cases', () => {
    it('should handle deletion of user with no organization assignments', async () => {
      // Remove organization assignments
      await db
        .delete(schema.userOrganizations)
        .where(eq(schema.userOrganizations.userId, testUser[0].id));

      const response = await request(app)
        .post(`/api/users/${testUser[0].id}/delete-account`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify user is deleted
      const deletedUser = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, testUser[0].id))
        .limit(1);

      expect(deletedUser).toHaveLength(0);
    });

    it('should prevent deletion of the last admin user', async () => {
      // Make test user the only admin
      await db
        .update(schema.users)
        .set({ role: 'admin' })
        .where(eq(schema.users.id, testUser[0].id));

      // Delete the current admin user
      await db.delete(schema.users).where(eq(schema.users.id, adminUser[0].id));

      const response = await request(app)
        .post(`/api/users/${testUser[0].id}/delete-account`)
        .set('Cookie', authCookie)
        .expect(403);

      expect(response.body).toMatchObject({
        message: 'Cannot delete the last admin user',
        code: 'CANNOT_DELETE_LAST_ADMIN',
      });
    });
  });
});