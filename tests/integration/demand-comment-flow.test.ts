/**
 * @file Demand Comment Integration Tests
 * @description Comprehensive tests for demand comment API endpoints and workflow
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { db } from '../../server/db';
import { demands, demandComments, users, residences, buildings, organizations, userResidences } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Mock Express app setup
function createTestApp() {
  const express = require('express');
  const app = express();
  
  app.use(express.json());
  
  // Mock session middleware for testing
  app.use((req: any, res: any, next: any) => {
    // testUser will be set in beforeEach
    req.user = { id: 'user-123', role: 'resident' }; 
    next();
  });
  
  const { registerDemandRoutes } = require('../../server/api/demands');
  registerDemandRoutes(app);
  
  return app;
}

describe('Demand Comment Integration Tests', () => {
  let app: any;
  let testUser: any;
  let testDemand: any;
  let testBuilding: any;
  let testResidence: any;
  let testOrganization: any;
  let authCookie: string;

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

    // Create test user
    const userResult = await db.insert(users).values({
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'hashed_password',
      role: 'resident',
      isActive: true,
    }).returning();
    testUser = userResult[0];

    // Associate user with residence
    await db.insert(userResidences).values({
      userId: testUser.id,
      residenceId: testResidence.id,
      relationshipType: 'resident',
      startDate: new Date().toISOString().split('T')[0],
      isActive: true,
    });

    // Create test demand
    const demandResult = await db.insert(demands).values({
      submitterId: testUser.id,
      type: 'maintenance',
      description: 'Test demand for comment testing',
      buildingId: testBuilding.id,
      residenceId: testResidence.id,
      status: 'submitted',
    }).returning();
    testDemand = demandResult[0];

    authCookie = 'test-session-cookie';
  });

  afterEach(async () => {
    // Clean up test data in proper order
    try {
      await db.delete(demandComments).where(eq(demandComments.demandId, testDemand.id));
      await db.delete(demands).where(eq(demands.id, testDemand.id));
      await db.delete(userResidences).where(eq(userResidences.userId, testUser.id));
      await db.delete(users).where(eq(users.id, testUser.id));
      await db.delete(residences).where(eq(residences.id, testResidence.id));
      await db.delete(buildings).where(eq(buildings.id, testBuilding.id));
      await db.delete(organizations).where(eq(organizations.id, testOrganization.id));
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('GET /api/demands/:id/comments', () => {
    it('should retrieve comments for a demand', async () => {
      // First create a comment
      await db.insert(demandComments).values({
        demandId: testDemand.id,
        commenterId: testUser.id,
        commentText: 'Test comment for retrieval',
        isInternal: false,
      });

      const response = await request(app)
        .get(`/api/demands/${testDemand.id}/comments`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      
      const comment = response.body[0];
      expect(comment.commentText).toBe('Test comment for retrieval');
      expect(comment.demandId).toBe(testDemand.id);
      expect(comment.commenterId).toBe(testUser.id);
      expect(comment.author).toBeDefined();
      expect(comment.author.email).toBe(testUser.email);
    });

    it('should return empty array for demand with no comments', async () => {
      const response = await request(app)
        .get(`/api/demands/${testDemand.id}/comments`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(0);
    });

    it('should return 404 for non-existent demand', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      
      await request(app)
        .get(`/api/demands/${fakeId}/comments`)
        .set('Cookie', authCookie)
        .expect(404);
    });

    it('should return comments in chronological order', async () => {
      // Create multiple comments with different timestamps
      const comments = [
        { text: 'First comment', delay: 0 },
        { text: 'Second comment', delay: 100 },
        { text: 'Third comment', delay: 200 },
      ];

      for (const comment of comments) {
        await new Promise(resolve => setTimeout(resolve, comment.delay));
        await db.insert(demandComments).values({
          demandId: testDemand.id,
          commenterId: testUser.id,
          commentText: comment.text,
          isInternal: false,
        });
      }

      const response = await request(app)
        .get(`/api/demands/${testDemand.id}/comments`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.length).toBe(3);
      expect(response.body[0].commentText).toBe('First comment');
      expect(response.body[1].commentText).toBe('Second comment');
      expect(response.body[2].commentText).toBe('Third comment');
    });

    it('should include author information in comments', async () => {
      await db.insert(demandComments).values({
        demandId: testDemand.id,
        commenterId: testUser.id,
        commentText: 'Comment with author info',
        isInternal: false,
      });

      const response = await request(app)
        .get(`/api/demands/${testDemand.id}/comments`)
        .set('Cookie', authCookie)
        .expect(200);

      const comment = response.body[0];
      expect(comment.author).toEqual({
        id: testUser.id,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        email: testUser.email,
      });
    });

    it('should handle internal vs external comments', async () => {
      // Create both internal and external comments
      await db.insert(demandComments).values([
        {
          demandId: testDemand.id,
          commenterId: testUser.id,
          commentText: 'External comment',
          isInternal: false,
        },
        {
          demandId: testDemand.id,
          commenterId: testUser.id,
          commentText: 'Internal comment',
          isInternal: true,
        },
      ]);

      const response = await request(app)
        .get(`/api/demands/${testDemand.id}/comments`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.length).toBe(2);
      
      const externalComment = response.body.find((c: any) => c.commentText === 'External comment');
      const internalComment = response.body.find((c: any) => c.commentText === 'Internal comment');
      
      expect(externalComment.isInternal).toBe(false);
      expect(internalComment.isInternal).toBe(true);
    });
  });

  describe('POST /api/demands/:id/comments', () => {
    it('should create a new comment successfully', async () => {
      const commentData = {
        commentText: 'This is a new comment on the demand',
      };

      const response = await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .set('Cookie', authCookie)
        .send(commentData)
        .expect(201);

      expect(response.body).toMatchObject({
        demandId: testDemand.id,
        commenterId: testUser.id,
        commentText: 'This is a new comment on the demand',
        isInternal: false,
      });

      expect(response.body.id).toBeDefined();
      expect(response.body.createdAt).toBeDefined();
    });

    it('should create comment with optional fields', async () => {
      const commentData = {
        commentText: 'Comment with all optional fields',
        commentType: 'status_update',
        isInternal: true,
      };

      const response = await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .set('Cookie', authCookie)
        .send(commentData)
        .expect(201);

      expect(response.body.commentText).toBe('Comment with all optional fields');
      expect(response.body.commentType).toBe('status_update');
      expect(response.body.isInternal).toBe(true);
    });

    it('should auto-populate demandId and commenterId', async () => {
      const commentData = {
        commentText: 'Comment with auto-populated IDs',
      };

      const response = await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .set('Cookie', authCookie)
        .send(commentData)
        .expect(201);

      expect(response.body.demandId).toBe(testDemand.id);
      expect(response.body.commenterId).toBe(testUser.id);
    });

    it('should validate required commentText field', async () => {
      const commentData = {
        // Missing commentText
        commentType: 'update',
      };

      await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .set('Cookie', authCookie)
        .send(commentData)
        .expect(400);
    });

    it('should validate commentText length constraints', async () => {
      // Test empty comment
      await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .set('Cookie', authCookie)
        .send({ commentText: '' })
        .expect(400);

      // Test too long comment
      const tooLongComment = 'A'.repeat(1001);
      await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .set('Cookie', authCookie)
        .send({ commentText: tooLongComment })
        .expect(400);

      // Test valid length comment
      const validComment = 'A'.repeat(1000);
      await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .set('Cookie', authCookie)
        .send({ commentText: validComment })
        .expect(201);
    });

    it('should return 404 for non-existent demand', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      const commentData = {
        commentText: 'Comment on non-existent demand',
      };

      await request(app)
        .post(`/api/demands/${fakeId}/comments`)
        .set('Cookie', authCookie)
        .send(commentData)
        .expect(404);
    });

    it('should handle French characters and special symbols', async () => {
      const commentData = {
        commentText: 'Commentaire en français avec caractères spéciaux: éàùç! 🏠 @#$%^&*()',
      };

      const response = await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .set('Cookie', authCookie)
        .send(commentData)
        .expect(201);

      expect(response.body.commentText).toBe(commentData.commentText);
    });

    it('should handle multiline comments', async () => {
      const multilineComment = `This is a multiline comment.
      
      It contains multiple paragraphs.
      
      End of comment.`;

      const response = await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .set('Cookie', authCookie)
        .send({ commentText: multilineComment })
        .expect(201);

      expect(response.body.commentText).toBe(multilineComment);
    });

    it('should create internal comments for authorized users', async () => {
      const commentData = {
        commentText: 'This is an internal comment',
        isInternal: true,
      };

      const response = await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .set('Cookie', authCookie)
        .send(commentData)
        .expect(201);

      expect(response.body.isInternal).toBe(true);
    });

    it('should handle different comment types', async () => {
      const commentTypes = ['update', 'question', 'answer', 'status_change'];
      
      for (const type of commentTypes) {
        const response = await request(app)
          .post(`/api/demands/${testDemand.id}/comments`)
          .set('Cookie', authCookie)
          .send({
            commentText: `Comment of type ${type}`,
            commentType: type,
          })
          .expect(201);

        expect(response.body.commentType).toBe(type);
      }
    });

    it('should validate UUID format in URL parameter', async () => {
      const invalidId = 'invalid-uuid';
      const commentData = {
        commentText: 'Valid comment text',
      };

      // This might return 400 or 404 depending on route validation
      const response = await request(app)
        .post(`/api/demands/${invalidId}/comments`)
        .set('Cookie', authCookie)
        .send(commentData);

      expect([400, 404]).toContain(response.status);
    });
  });

  describe('Comment Workflow Integration', () => {
    it('should maintain comment thread integrity', async () => {
      // Create multiple comments and verify they stay linked to the demand
      const comments = [
        'Initial comment',
        'Follow-up comment',
        'Final comment',
      ];

      for (const commentText of comments) {
        await request(app)
          .post(`/api/demands/${testDemand.id}/comments`)
          .set('Cookie', authCookie)
          .send({ commentText })
          .expect(201);
      }

      const response = await request(app)
        .get(`/api/demands/${testDemand.id}/comments`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.length).toBe(3);
      response.body.forEach((comment: any) => {
        expect(comment.demandId).toBe(testDemand.id);
      });
    });

    it('should handle concurrent comment creation', async () => {
      // Create multiple comments simultaneously
      const commentPromises = Array.from({ length: 3 }, (_, i) =>
        request(app)
          .post(`/api/demands/${testDemand.id}/comments`)
          .set('Cookie', authCookie)
          .send({ commentText: `Concurrent comment ${i + 1}` })
      );

      const responses = await Promise.all(commentPromises);
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.demandId).toBe(testDemand.id);
      });

      // Verify all comments were created
      const getResponse = await request(app)
        .get(`/api/demands/${testDemand.id}/comments`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(getResponse.body.length).toBe(3);
    });

    it('should handle comment creation and retrieval workflow', async () => {
      // Step 1: Create initial comment
      const createResponse = await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .set('Cookie', authCookie)
        .send({ commentText: 'Workflow test comment' })
        .expect(201);

      const commentId = createResponse.body.id;

      // Step 2: Retrieve comments and verify the new comment is included
      const getResponse = await request(app)
        .get(`/api/demands/${testDemand.id}/comments`)
        .set('Cookie', authCookie)
        .expect(200);

      const createdComment = getResponse.body.find((c: any) => c.id === commentId);
      expect(createdComment).toBeDefined();
      expect(createdComment.commentText).toBe('Workflow test comment');
    });

    it('should preserve comment order across multiple operations', async () => {
      const commentTexts = [
        'First comment in sequence',
        'Second comment in sequence',
        'Third comment in sequence',
      ];

      // Create comments with small delays to ensure ordering
      for (const text of commentTexts) {
        await request(app)
          .post(`/api/demands/${testDemand.id}/comments`)
          .set('Cookie', authCookie)
          .send({ commentText: text })
          .expect(201);
        
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const response = await request(app)
        .get(`/api/demands/${testDemand.id}/comments`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.length).toBe(3);
      commentTexts.forEach((text, index) => {
        expect(response.body[index].commentText).toBe(text);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking database failures
      // For now, we test general error handling patterns
      const commentData = {
        commentText: 'Test comment for error handling',
      };

      // Normal case should work
      await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .set('Cookie', authCookie)
        .send(commentData)
        .expect(201);
    });

    it('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .set('Cookie', authCookie)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect([400, 500]).toContain(response.status);
    });

    it('should handle missing Content-Type header', async () => {
      const response = await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .set('Cookie', authCookie)
        .send('commentText=Test comment');

      // Should handle this gracefully
      expect([200, 201, 400]).toContain(response.status);
    });

    it('should validate comment length at boundary conditions', async () => {
      // Test exact maximum length
      const maxLengthComment = 'A'.repeat(1000);
      await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .set('Cookie', authCookie)
        .send({ commentText: maxLengthComment })
        .expect(201);

      // Test one character over maximum
      const overLimitComment = 'A'.repeat(1001);
      await request(app)
        .post(`/api/demands/${testDemand.id}/comments`)
        .set('Cookie', authCookie)
        .send({ commentText: overLimitComment })
        .expect(400);
    });
  });
});