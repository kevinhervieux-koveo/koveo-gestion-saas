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

  describe('Foreign Key Constraint Handling', () => {
    let testBuilding: any;
    let testResidence: any;

    beforeEach(async () => {
      // Create test building
      testBuilding = await db
        .insert(schema.buildings)
        .values({
          name: 'Test Building',
          address: '123 Test St',
          city: 'Test City',
          province: 'QC',
          postalCode: 'H1A 1A1',
          buildingType: 'apartment',
          totalUnits: 100,
          organizationId: testOrganization[0].id,
        })
        .returning();

      // Create test residence
      testResidence = await db
        .insert(schema.residences)
        .values({
          unitNumber: '101',
          buildingId: testBuilding[0].id,
        })
        .returning();
    });

    afterEach(async () => {
      // Clean up test data
      if (testResidence?.[0]?.id) {
        await db.delete(schema.residences).where(eq(schema.residences.id, testResidence[0].id));
      }
      if (testBuilding?.[0]?.id) {
        await db.delete(schema.buildings).where(eq(schema.buildings.id, testBuilding[0].id));
      }
    });

    it('should handle user deletion with demands and demand comments', async () => {
      // Create a demand submitted by the test user
      const demand = await db
        .insert(schema.demands)
        .values({
          submitterId: testUser[0].id,
          type: 'maintenance',
          description: 'Test demand for deletion',
          buildingId: testBuilding[0].id,
          residenceId: testResidence[0].id,
          status: 'submitted',
        })
        .returning();

      // Create a comment on the demand
      const comment = await db
        .insert(schema.demandComments)
        .values({
          demandId: demand[0].id,
          commenterId: testUser[0].id,
          commentText: 'Test comment for deletion',
          commentType: 'general',
        })
        .returning();

      // Verify the demand and comment exist
      const existingDemand = await db
        .select()
        .from(schema.demands)
        .where(eq(schema.demands.id, demand[0].id))
        .limit(1);
      
      const existingComment = await db
        .select()
        .from(schema.demandComments)
        .where(eq(schema.demandComments.id, comment[0].id))
        .limit(1);

      expect(existingDemand).toHaveLength(1);
      expect(existingComment).toHaveLength(1);

      // Delete the user - this should now succeed
      const response = await request(app)
        .post(`/api/users/${testUser[0].id}/delete-account`)
        .set('Cookie', authCookie)
        .send({
          confirmEmail: testUser[0].email,
          reason: 'Testing foreign key constraint handling',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'User account and all associated data have been permanently deleted',
        deletedUserId: testUser[0].id,
        deletedUserEmail: testUser[0].email,
      });

      // Verify the user is deleted
      const deletedUser = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, testUser[0].id))
        .limit(1);

      expect(deletedUser).toHaveLength(0);

      // Verify the demand and comment are also deleted
      const deletedDemand = await db
        .select()
        .from(schema.demands)
        .where(eq(schema.demands.id, demand[0].id))
        .limit(1);
      
      const deletedComment = await db
        .select()
        .from(schema.demandComments)
        .where(eq(schema.demandComments.id, comment[0].id))
        .limit(1);

      expect(deletedDemand).toHaveLength(0);
      expect(deletedComment).toHaveLength(0);
    });

    it('should handle user deletion with bugs and feature requests', async () => {
      // Create a bug submitted by the test user
      const bug = await db
        .insert(schema.bugs)
        .values({
          createdBy: testUser[0].id,
          title: 'Test Bug',
          description: 'Test bug for deletion',
          category: 'functionality',
          page: '/test-page',
          priority: 'medium',
          status: 'new',
        })
        .returning();

      // Create a feature request submitted by the test user
      const featureRequest = await db
        .insert(schema.featureRequests)
        .values({
          createdBy: testUser[0].id,
          title: 'Test Feature Request',
          description: 'Test feature request for deletion',
          need: 'Testing feature deletion',
          category: 'dashboard',
          page: '/test-page',
          status: 'submitted',
        })
        .returning();

      // Create an upvote by the test user
      const upvote = await db
        .insert(schema.featureRequestUpvotes)
        .values({
          featureRequestId: featureRequest[0].id,
          userId: testUser[0].id,
        })
        .returning();

      // Verify they exist
      const existingBug = await db
        .select()
        .from(schema.bugs)
        .where(eq(schema.bugs.id, bug[0].id))
        .limit(1);
      
      const existingFeatureRequest = await db
        .select()
        .from(schema.featureRequests)
        .where(eq(schema.featureRequests.id, featureRequest[0].id))
        .limit(1);

      const existingUpvote = await db
        .select()
        .from(schema.featureRequestUpvotes)
        .where(eq(schema.featureRequestUpvotes.id, upvote[0].id))
        .limit(1);

      expect(existingBug).toHaveLength(1);
      expect(existingFeatureRequest).toHaveLength(1);
      expect(existingUpvote).toHaveLength(1);

      // Delete the user
      const response = await request(app)
        .post(`/api/users/${testUser[0].id}/delete-account`)
        .set('Cookie', authCookie)
        .send({
          confirmEmail: testUser[0].email,
          reason: 'Testing bug and feature request deletion',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'User account and all associated data have been permanently deleted',
      });

      // Verify the user is deleted
      const deletedUser = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, testUser[0].id))
        .limit(1);

      expect(deletedUser).toHaveLength(0);

      // Verify the bug, feature request, and upvote are also deleted
      const deletedBug = await db
        .select()
        .from(schema.bugs)
        .where(eq(schema.bugs.id, bug[0].id))
        .limit(1);
      
      const deletedFeatureRequest = await db
        .select()
        .from(schema.featureRequests)
        .where(eq(schema.featureRequests.id, featureRequest[0].id))
        .limit(1);

      const deletedUpvote = await db
        .select()
        .from(schema.featureRequestUpvotes)
        .where(eq(schema.featureRequestUpvotes.id, upvote[0].id))
        .limit(1);

      expect(deletedBug).toHaveLength(0);
      expect(deletedFeatureRequest).toHaveLength(0);
      expect(deletedUpvote).toHaveLength(0);
    });

    it('should reproduce the original error scenario and verify fix', async () => {
      // This test reproduces the exact scenario from the user's screenshot
      // Create a demand that would cause the foreign key constraint error
      const demand = await db
        .insert(schema.demands)
        .values({
          submitterId: testUser[0].id,
          type: 'complaint',
          description: 'This demand will test the foreign key constraint fix',
          buildingId: testBuilding[0].id,
          status: 'submitted',
        })
        .returning();

      // Verify the demand exists and references the user
      const existingDemand = await db
        .select()
        .from(schema.demands)
        .where(eq(schema.demands.submitterId, testUser[0].id))
        .limit(1);

      expect(existingDemand).toHaveLength(1);
      expect(existingDemand[0].submitterId).toBe(testUser[0].id);

      // This deletion should now succeed (previously would fail with foreign key constraint error)
      const response = await request(app)
        .post(`/api/users/${testUser[0].id}/delete-account`)
        .set('Cookie', authCookie)
        .send({
          confirmEmail: testUser[0].email,
          reason: 'Testing the fix for demands_submitter_id_users_id_fk constraint violation',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'User account and all associated data have been permanently deleted',
        deletedUserId: testUser[0].id,
        deletedUserEmail: testUser[0].email,
      });

      // Verify the demand is also deleted (no orphaned records)
      const deletedDemand = await db
        .select()
        .from(schema.demands)
        .where(eq(schema.demands.id, demand[0].id))
        .limit(1);

      expect(deletedDemand).toHaveLength(0);

      // Verify the user is completely removed
      const deletedUser = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, testUser[0].id))
        .limit(1);

      expect(deletedUser).toHaveLength(0);
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