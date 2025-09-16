/**
 * @file Manager and Admin Comment Access Tests
 * @description Tests verifying that managers and admins can add comments to demands they have access to
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { db } from '../../server/db';
import { 
  demands, 
  demandComments, 
  users, 
  residences, 
  buildings, 
  organizations, 
  userResidences,
  userOrganizations
} from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Mock Express app setup
function createTestApp() {
  const express = require('express');
  const app = express();
  
  app.use(express.json());
  
  // Mock session middleware for testing - this will be overridden in tests
  app.use((req: any, res: any, next: any) => {
    // Default user - will be overridden in individual tests
    req.user = { id: 'user-123', role: 'resident' }; 
    next();
  });
  
  const { registerDemandRoutes } = require('../../server/api/demands');
  registerDemandRoutes(app);
  
  return app;
}

describe('Manager and Admin Comment Access Tests', () => {
  let app: any;
  let testOrganization: any;
  let testBuilding: any;
  let testResidence: any;
  let testDemand: any;
  
  // Test users
  let adminUser: any;
  let managerUser: any;
  let residentUser: any;
  let otherManagerUser: any;
  let otherOrganization: any;

  beforeEach(async () => {
    app = createTestApp();

    // Create test organization
    const orgResult = await db.insert(organizations).values({
      name: 'Test Organization',
      type: 'residential',
      address: '123 Test St',
      city: 'Test City',
      province: 'QC',
      postalCode: 'H1H 1H1',
      isActive: true,
    }).returning();
    testOrganization = orgResult[0];

    // Create another organization for testing cross-organization access
    const otherOrgResult = await db.insert(organizations).values({
      name: 'Other Organization',
      type: 'residential',
      address: '456 Other St',
      city: 'Other City',
      province: 'QC',
      postalCode: 'H2H 2H2',
      isActive: true,
    }).returning();
    otherOrganization = otherOrgResult[0];

    // Create test building
    const buildingResult = await db.insert(buildings).values({
      name: 'Test Building',
      address: '456 Test Ave',
      city: 'Test City',
      province: 'QC',
      postalCode: 'H2H 2H2',
      buildingType: 'condo',
      organizationId: testOrganization.id,
      totalUnits: 10,
      isActive: true,
    }).returning();
    testBuilding = buildingResult[0];

    // Create test residence
    const residenceResult = await db.insert(residences).values({
      buildingId: testBuilding.id,
      unitNumber: '101',
      floor: 1,
      squareFootage: '1000',
      bedrooms: 2,
      bathrooms: '1',
      balcony: false,
      isActive: true,
    }).returning();
    testResidence = residenceResult[0];

    // Create test users
    const adminResult = await db.insert(users).values({
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
      password: 'hashed_password',
      role: 'admin',
      isActive: true,
    }).returning();
    adminUser = adminResult[0];

    const managerResult = await db.insert(users).values({
      username: 'manager',
      firstName: 'Manager',
      lastName: 'User',
      email: 'manager@example.com',
      password: 'hashed_password',
      role: 'manager',
      isActive: true,
    }).returning();
    managerUser = managerResult[0];

    const residentResult = await db.insert(users).values({
      username: 'resident',
      firstName: 'Resident',
      lastName: 'User',
      email: 'resident@example.com',
      password: 'hashed_password',
      role: 'resident',
      isActive: true,
    }).returning();
    residentUser = residentResult[0];

    const otherManagerResult = await db.insert(users).values({
      username: 'othermanager',
      firstName: 'Other Manager',
      lastName: 'User',
      email: 'othermanager@example.com',
      password: 'hashed_password',
      role: 'manager',
      isActive: true,
    }).returning();
    otherManagerUser = otherManagerResult[0];

    // Associate manager with organization
    await db.insert(userOrganizations).values({
      userId: managerUser.id,
      organizationId: testOrganization.id,
      relationshipType: 'employee',
      isActive: true,
    });

    // Associate other manager with different organization
    await db.insert(userOrganizations).values({
      userId: otherManagerUser.id,
      organizationId: otherOrganization.id,
      relationshipType: 'employee',
      isActive: true,
    });

    // Associate resident with residence
    await db.insert(userResidences).values({
      userId: residentUser.id,
      residenceId: testResidence.id,
      relationshipType: 'resident',
      startDate: new Date().toISOString().split('T')[0],
      isActive: true,
    });

    // Create test demand from resident
    const demandResult = await db.insert(demands).values({
      submitterId: residentUser.id,
      type: 'maintenance',
      description: 'Test demand for comment access testing',
      buildingId: testBuilding.id,
      residenceId: testResidence.id,
      status: 'submitted',
    }).returning();
    testDemand = demandResult[0];
  });

  afterEach(async () => {
    // Clean up test data in proper order
    try {
      await db.delete(demandComments).where(eq(demandComments.demandId, testDemand.id));
      await db.delete(demands).where(eq(demands.id, testDemand.id));
      await db.delete(userResidences).where(eq(userResidences.userId, residentUser.id));
      await db.delete(userOrganizations).where(eq(userOrganizations.userId, managerUser.id));
      await db.delete(userOrganizations).where(eq(userOrganizations.userId, otherManagerUser.id));
      await db.delete(users).where(eq(users.id, adminUser.id));
      await db.delete(users).where(eq(users.id, managerUser.id));
      await db.delete(users).where(eq(users.id, residentUser.id));
      await db.delete(users).where(eq(users.id, otherManagerUser.id));
      await db.delete(residences).where(eq(residences.id, testResidence.id));
      await db.delete(buildings).where(eq(buildings.id, testBuilding.id));
      await db.delete(organizations).where(eq(organizations.id, testOrganization.id));
      await db.delete(organizations).where(eq(organizations.id, otherOrganization.id));
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('Admin Comment Access', () => {
    it('should allow admin to add comments to any demand', async () => {
      // Override app middleware to use admin user
      app._router.stack.forEach((layer: any) => {
        if (layer.name === 'anonymous') {
          layer.handle = (req: any, res: any, next: any) => {
            req.user = adminUser;
            next();
          };
        }
      });

      const commentData = {
        commentText: 'Admin comment on resident demand',
        commentType: 'status_update',
      };

      const response = await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .send(commentData)
        .expect(201);

      expect(response.body).toMatchObject({
        demandId: testDemand.id,
        commenterId: adminUser.id,
        commentText: 'Admin comment on resident demand',
        commentType: 'status_update',
      });

      expect(response.body.id).toBeDefined();
      expect(response.body.createdAt).toBeDefined();
    });

    it('should allow admin to add internal comments', async () => {
      // Override app middleware to use admin user
      app._router.stack.forEach((layer: any) => {
        if (layer.name === 'anonymous') {
          layer.handle = (req: any, res: any, next: any) => {
            req.user = adminUser;
            next();
          };
        }
      });

      const commentData = {
        commentText: 'Internal admin comment',
        isInternal: true,
      };

      const response = await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .send(commentData)
        .expect(201);

      expect(response.body.isInternal).toBe(true);
      expect(response.body.commentText).toBe('Internal admin comment');
    });

    it('should allow admin to retrieve comments on any demand', async () => {
      // First create a comment
      await db.insert(demandComments).values({
        demandId: testDemand.id,
        commenterId: adminUser.id,
        commentText: 'Admin created comment',
        isInternal: false,
      });

      // Override app middleware to use admin user
      app._router.stack.forEach((layer: any) => {
        if (layer.name === 'anonymous') {
          layer.handle = (req: any, res: any, next: any) => {
            req.user = adminUser;
            next();
          };
        }
      });

      const response = await request(app)
        .get(`/api/demands/${testDemand.id}/comments`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      
      const comment = response.body.find((c: any) => c.commentText === 'Admin created comment');
      expect(comment).toBeDefined();
      expect(comment.commenterId).toBe(adminUser.id);
    });
  });

  describe('Manager Comment Access', () => {
    it('should allow manager to add comments to demands from their organization', async () => {
      // Override app middleware to use manager user
      app._router.stack.forEach((layer: any) => {
        if (layer.name === 'anonymous') {
          layer.handle = (req: any, res: any, next: any) => {
            req.user = managerUser;
            next();
          };
        }
      });

      const commentData = {
        commentText: 'Manager comment on organization demand',
        commentType: 'update',
      };

      const response = await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .send(commentData)
        .expect(201);

      expect(response.body).toMatchObject({
        demandId: testDemand.id,
        commenterId: managerUser.id,
        commentText: 'Manager comment on organization demand',
        commentType: 'update',
      });

      expect(response.body.id).toBeDefined();
      expect(response.body.createdAt).toBeDefined();
    });

    it('should allow manager to add internal comments to their organization demands', async () => {
      // Override app middleware to use manager user
      app._router.stack.forEach((layer: any) => {
        if (layer.name === 'anonymous') {
          layer.handle = (req: any, res: any, next: any) => {
            req.user = managerUser;
            next();
          };
        }
      });

      const commentData = {
        commentText: 'Internal manager comment',
        isInternal: true,
      };

      const response = await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .send(commentData)
        .expect(201);

      expect(response.body.isInternal).toBe(true);
      expect(response.body.commentText).toBe('Internal manager comment');
      expect(response.body.commenterId).toBe(managerUser.id);
    });

    it('should deny manager access to demands from other organizations', async () => {
      // Override app middleware to use other manager user (from different organization)
      app._router.stack.forEach((layer: any) => {
        if (layer.name === 'anonymous') {
          layer.handle = (req: any, res: any, next: any) => {
            req.user = otherManagerUser;
            next();
          };
        }
      });

      const commentData = {
        commentText: 'Unauthorized manager comment',
      };

      await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .send(commentData)
        .expect(403);
    });

    it('should allow manager to retrieve comments from their organization demands', async () => {
      // First create a comment
      await db.insert(demandComments).values({
        demandId: testDemand.id,
        commenterId: managerUser.id,
        commentText: 'Manager created comment',
        isInternal: false,
      });

      // Override app middleware to use manager user
      app._router.stack.forEach((layer: any) => {
        if (layer.name === 'anonymous') {
          layer.handle = (req: any, res: any, next: any) => {
            req.user = managerUser;
            next();
          };
        }
      });

      const response = await request(app)
        .get(`/api/demands/${testDemand.id}/comments`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      
      const comment = response.body.find((c: any) => c.commentText === 'Manager created comment');
      expect(comment).toBeDefined();
      expect(comment.commenterId).toBe(managerUser.id);
    });
  });

  describe('Resident Comment Access', () => {
    it('should allow resident to add comments to their own demands', async () => {
      // Override app middleware to use resident user
      app._router.stack.forEach((layer: any) => {
        if (layer.name === 'anonymous') {
          layer.handle = (req: any, res: any, next: any) => {
            req.user = residentUser;
            next();
          };
        }
      });

      const commentData = {
        commentText: 'Resident comment on own demand',
      };

      const response = await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .send(commentData)
        .expect(201);

      expect(response.body).toMatchObject({
        demandId: testDemand.id,
        commenterId: residentUser.id,
        commentText: 'Resident comment on own demand',
      });
    });

    it('should deny resident access to add comments on other users demands', async () => {
      // Create a demand from a different user
      const otherUserResult = await db.insert(users).values({
        username: 'otherresident',
        firstName: 'Other',
        lastName: 'Resident',
        email: 'other@example.com',
        password: 'hashed_password',
        role: 'resident',
        isActive: true,
      }).returning();
      const otherUser = otherUserResult[0];

      const otherDemandResult = await db.insert(demands).values({
        submitterId: otherUser.id,
        type: 'complaint',
        description: 'Other user demand',
        buildingId: testBuilding.id,
        residenceId: testResidence.id,
        status: 'submitted',
      }).returning();
      const otherDemand = otherDemandResult[0];

      // Override app middleware to use resident user
      app._router.stack.forEach((layer: any) => {
        if (layer.name === 'anonymous') {
          layer.handle = (req: any, res: any, next: any) => {
            req.user = residentUser;
            next();
          };
        }
      });

      const commentData = {
        commentText: 'Unauthorized resident comment',
      };

      await request(app)
        .post(`/api/demands/${otherDemand.id}/comments`)
        .send(commentData)
        .expect(403);

      // Cleanup
      await db.delete(demands).where(eq(demands.id, otherDemand.id));
      await db.delete(users).where(eq(users.id, otherUser.id));
    });
  });

  describe('Comment Validation for Managers and Admins', () => {
    it('should validate comment text length for managers', async () => {
      // Override app middleware to use manager user
      app._router.stack.forEach((layer: any) => {
        if (layer.name === 'anonymous') {
          layer.handle = (req: any, res: any, next: any) => {
            req.user = managerUser;
            next();
          };
        }
      });

      // Test empty comment
      await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .send({ commentText: '' })
        .expect(400);

      // Test too long comment
      const tooLongComment = 'A'.repeat(1001);
      await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .send({ commentText: tooLongComment })
        .expect(400);

      // Test valid length comment
      const validComment = 'A'.repeat(1000);
      await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .send({ commentText: validComment })
        .expect(201);
    });

    it('should validate comment text length for admins', async () => {
      // Override app middleware to use admin user
      app._router.stack.forEach((layer: any) => {
        if (layer.name === 'anonymous') {
          layer.handle = (req: any, res: any, next: any) => {
            req.user = adminUser;
            next();
          };
        }
      });

      // Test exact maximum length
      const maxLengthComment = 'A'.repeat(1000);
      await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .send({ commentText: maxLengthComment })
        .expect(201);

      // Test one character over maximum
      const overLimitComment = 'A'.repeat(1001);
      await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .send({ commentText: overLimitComment })
        .expect(400);
    });

    it('should handle French characters for manager comments', async () => {
      // Override app middleware to use manager user
      app._router.stack.forEach((layer: any) => {
        if (layer.name === 'anonymous') {
          layer.handle = (req: any, res: any, next: any) => {
            req.user = managerUser;
            next();
          };
        }
      });

      const commentData = {
        commentText: 'Commentaire du gestionnaire avec caractères spéciaux: éàùç! 🏠',
      };

      const response = await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .send(commentData)
        .expect(201);

      expect(response.body.commentText).toBe(commentData.commentText);
      expect(response.body.commenterId).toBe(managerUser.id);
    });
  });

  describe('Cross-Role Comment Interaction', () => {
    it('should allow admin and manager to comment on the same demand', async () => {
      // First, admin adds a comment
      app._router.stack.forEach((layer: any) => {
        if (layer.name === 'anonymous') {
          layer.handle = (req: any, res: any, next: any) => {
            req.user = adminUser;
            next();
          };
        }
      });

      await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .send({ commentText: 'Admin comment first' })
        .expect(201);

      // Then, manager adds a comment
      app._router.stack.forEach((layer: any) => {
        if (layer.name === 'anonymous') {
          layer.handle = (req: any, res: any, next: any) => {
            req.user = managerUser;
            next();
          };
        }
      });

      await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .send({ commentText: 'Manager comment second' })
        .expect(201);

      // Verify both comments exist
      const response = await request(app)
        .get(`/api/demands/${testDemand.id}/comments`)
        .expect(200);

      expect(response.body.length).toBe(2);
      
      const adminComment = response.body.find((c: any) => c.commentText === 'Admin comment first');
      const managerComment = response.body.find((c: any) => c.commentText === 'Manager comment second');
      
      expect(adminComment).toBeDefined();
      expect(managerComment).toBeDefined();
      expect(adminComment.commenterId).toBe(adminUser.id);
      expect(managerComment.commenterId).toBe(managerUser.id);
    });

    it('should maintain comment thread integrity with multiple authorized users', async () => {
      const comments = [
        { user: residentUser, text: 'Initial resident comment' },
        { user: managerUser, text: 'Manager response' },
        { user: adminUser, text: 'Admin final decision' },
      ];

      for (const comment of comments) {
        app._router.stack.forEach((layer: any) => {
          if (layer.name === 'anonymous') {
            layer.handle = (req: any, res: any, next: any) => {
              req.user = comment.user;
              next();
            };
          }
        });

        await request(app)
          .post(`/api/demands/${testDemand.id}/comments`)
          .send({ commentText: comment.text })
          .expect(201);
      }

      // Get comments as admin to see all
      app._router.stack.forEach((layer: any) => {
        if (layer.name === 'anonymous') {
          layer.handle = (req: any, res: any, next: any) => {
            req.user = adminUser;
            next();
          };
        }
      });

      const response = await request(app)
        .get(`/api/demands/${testDemand.id}/comments`)
        .expect(200);

      expect(response.body.length).toBe(3);
      
      // Verify all comments are linked to the correct demand
      response.body.forEach((comment: any) => {
        expect(comment.demandId).toBe(testDemand.id);
      });

      // Verify chronological order
      expect(response.body[0].commentText).toBe('Initial resident comment');
      expect(response.body[1].commentText).toBe('Manager response');
      expect(response.body[2].commentText).toBe('Admin final decision');
    });
  });
});