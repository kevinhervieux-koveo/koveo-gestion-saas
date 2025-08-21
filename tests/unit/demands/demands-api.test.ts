/**
 * @file Demands API Unit Tests
 * @description Comprehensive unit tests for the demands API functionality
 * including CRUD operations, role-based access control, and filtering.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { db } from '../../../server/db';
import { registerDemandRoutes } from '../../../server/api/demands';
import { requireAuth } from '../../../server/auth/index';
import { 
  demands, 
  demandComments, 
  users, 
  organizations, 
  buildings, 
  residences, 
  userOrganizations,
  userResidences 
} from '../../../shared/schema';
import { eq } from 'drizzle-orm';

// Mock auth middleware for testing
jest.mock('../../../server/auth/index', () => ({
  requireAuth: jest.fn((req: any, res: any, next: any) => {
    // Add test user to request
    req.user = req.testUser || {
      id: 'test-user-id',
      role: 'resident',
      organizationIds: ['test-org-1'],
      buildingIds: ['test-building-1'],
      residenceIds: ['test-residence-1']
    };
    next();
  })
}));

describe('Demands API Unit Tests', () => {
  let app: express.Application;
  let testUsers: any[] = [];
  let testOrganizations: any[] = [];
  let testBuildings: any[] = [];
  let testResidences: any[] = [];
  let testDemands: any[] = [];

  beforeAll(async () => {
    // Setup test application
    app = express();
    app.use(express.json());
    registerDemandRoutes(app);

    // Create test data
    await setupTestData();
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Setup comprehensive test data for demand testing.
   */
  async function setupTestData() {
    try {
      // Create test organizations
      const [org1] = await db.insert(organizations).values({
        id: 'test-org-1',
        name: 'Test Organization 1',
        type: 'management_company',
        address: '123 Test St',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A 1A1',
        phone: '514-555-0001',
        email: 'org1@test.com'
      }).returning();
      testOrganizations.push(org1);

      // Create test users with different roles
      const usersData = [
        {
          id: 'admin-user',
          username: 'admin_test',
          email: 'admin@test.com',
          password: 'hashed_password',
          firstName: 'Admin',
          lastName: 'User',
          role: 'admin' as const
        },
        {
          id: 'manager-user',
          username: 'manager_test',
          email: 'manager@test.com',
          password: 'hashed_password',
          firstName: 'Manager',
          lastName: 'User',
          role: 'manager' as const
        },
        {
          id: 'resident-user',
          username: 'resident_test',
          email: 'resident@test.com',
          password: 'hashed_password',
          firstName: 'Resident',
          lastName: 'User',
          role: 'resident' as const
        },
        {
          id: 'tenant-user',
          username: 'tenant_test',
          email: 'tenant@test.com',
          password: 'hashed_password',
          firstName: 'Tenant',
          lastName: 'User',
          role: 'tenant' as const
        }
      ];

      for (const userData of usersData) {
        const [user] = await db.insert(users).values(userData).returning();
        testUsers.push(user);

        // Link users to organization
        await db.insert(userOrganizations).values({
          userId: user.id,
          organizationId: org1.id,
          organizationRole: userData.role
        });
      }

      // Create test buildings
      const [building1] = await db.insert(buildings).values({
        id: 'test-building-1',
        organizationId: org1.id,
        name: 'Test Building 1',
        address: '456 Building St',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1B 1B1',
        buildingType: 'Apartment',
        totalUnits: 10,
        yearBuilt: 2020,
        parkingSpaces: ['P1', 'P2'],
        storageSpaces: ['S1', 'S2']
      }).returning();
      testBuildings.push(building1);

      // Create test residences
      const residencesData = [
        {
          id: 'test-residence-1',
          buildingId: building1.id,
          unitNumber: '101',
          floor: 1,
          squareFootage: 800,
          bedrooms: 2,
          bathrooms: 1,
          parkingSpots: ['P1'],
          storageSpaces: ['S1']
        },
        {
          id: 'test-residence-2',
          buildingId: building1.id,
          unitNumber: '102',
          floor: 1,
          squareFootage: 900,
          bedrooms: 2,
          bathrooms: 1,
          parkingSpots: ['P2'],
          storageSpaces: ['S2']
        }
      ];

      for (const residenceData of residencesData) {
        const [residence] = await db.insert(residences).values(residenceData).returning();
        testResidences.push(residence);
      }

      // Link users to residences
      await db.insert(userResidences).values([
        {
          userId: testUsers[2].id, // resident
          residenceId: testResidences[0].id,
          residenceRole: 'owner'
        },
        {
          userId: testUsers[3].id, // tenant
          residenceId: testResidences[1].id,
          residenceRole: 'tenant'
        }
      ]);

      // Create test demands
      const demandsData = [
        {
          id: 'test-demand-1',
          submitterId: testUsers[2].id, // resident
          type: 'maintenance' as const,
          description: 'Faucet is leaking in kitchen',
          residenceId: testResidences[0].id,
          buildingId: building1.id,
          status: 'pending' as const
        },
        {
          id: 'test-demand-2',
          submitterId: testUsers[3].id, // tenant
          type: 'complaint' as const,
          description: 'Noise from upstairs neighbor',
          residenceId: testResidences[1].id,
          buildingId: building1.id,
          status: 'approved' as const
        },
        {
          id: 'test-demand-3',
          submitterId: testUsers[2].id, // resident
          type: 'information' as const,
          description: 'Question about parking rules',
          residenceId: testResidences[0].id,
          buildingId: building1.id,
          status: 'completed' as const,
          reviewedBy: testUsers[1].id, // manager
          reviewedAt: new Date(),
          reviewNotes: 'Information provided via email'
        }
      ];

      for (const demandData of demandsData) {
        const [demand] = await db.insert(demands).values(demandData).returning();
        testDemands.push(demand);
      }

    } catch (error) {
      console.error('Failed to setup test data:', error);
      throw error;
    }
  }

  /**
   * Cleanup all test data after tests complete.
   */
  async function cleanupTestData() {
    try {
      // Delete in reverse order to respect foreign key constraints
      if (testDemands.length > 0) {
        await db.delete(demandComments);
        await db.delete(demands);
      }
      
      if (testResidences.length > 0) {
        await db.delete(userResidences);
        await db.delete(residences);
      }

      if (testBuildings.length > 0) {
        await db.delete(buildings);
      }

      if (testUsers.length > 0) {
        await db.delete(userOrganizations);
        await db.delete(users);
      }

      if (testOrganizations.length > 0) {
        await db.delete(organizations);
      }
    } catch (error) {
      console.error('Failed to cleanup test data:', error);
    }
  }

  describe('GET /api/demands', () => {
    it('should return demands for admin user (all demands)', async () => {
      const response = await request(app)
        .get('/api/demands')
        .set('test-user', JSON.stringify({
          id: testUsers[0].id,
          role: 'admin'
        }));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(3); // All demands
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('type');
      expect(response.body[0]).toHaveProperty('description');
      expect(response.body[0]).toHaveProperty('status');
      expect(response.body[0]).toHaveProperty('submitter');
      expect(response.body[0]).toHaveProperty('residence');
      expect(response.body[0]).toHaveProperty('building');
    });

    it('should return demands for manager user (organization demands)', async () => {
      const response = await request(app)
        .get('/api/demands')
        .set('test-user', JSON.stringify({
          id: testUsers[1].id,
          role: 'manager'
        }));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Verify manager can see demands from their organization
      response.body.forEach((demand: any) => {
        expect(demand.building.id).toBe(testBuildings[0].id);
      });
    });

    it('should return demands for resident user (own demands and building demands)', async () => {
      const response = await request(app)
        .get('/api/demands')
        .set('test-user', JSON.stringify({
          id: testUsers[2].id,
          role: 'resident'
        }));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Verify resident can see relevant demands
      response.body.forEach((demand: any) => {
        expect(
          demand.submitterId === testUsers[2].id || 
          demand.buildingId === testResidences[0].buildingId
        ).toBe(true);
      });
    });

    it('should return limited demands for tenant user (view only their own)', async () => {
      const response = await request(app)
        .get('/api/demands')
        .set('test-user', JSON.stringify({
          id: testUsers[3].id,
          role: 'tenant'
        }));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Verify tenant can only see their own demands
      response.body.forEach((demand: any) => {
        expect(demand.submitterId).toBe(testUsers[3].id);
      });
    });

    it('should filter demands by type', async () => {
      const response = await request(app)
        .get('/api/demands?type=maintenance')
        .set('test-user', JSON.stringify({
          id: testUsers[0].id,
          role: 'admin'
        }));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      response.body.forEach((demand: any) => {
        expect(demand.type).toBe('maintenance');
      });
    });

    it('should filter demands by status', async () => {
      const response = await request(app)
        .get('/api/demands?status=pending')
        .set('test-user', JSON.stringify({
          id: testUsers[0].id,
          role: 'admin'
        }));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      response.body.forEach((demand: any) => {
        expect(demand.status).toBe('pending');
      });
    });

    it('should filter demands by building', async () => {
      const response = await request(app)
        .get(`/api/demands?buildingId=${testBuildings[0].id}`)
        .set('test-user', JSON.stringify({
          id: testUsers[0].id,
          role: 'admin'
        }));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      response.body.forEach((demand: any) => {
        expect(demand.buildingId).toBe(testBuildings[0].id);
      });
    });

    it('should search demands by description', async () => {
      const response = await request(app)
        .get('/api/demands?search=faucet')
        .set('test-user', JSON.stringify({
          id: testUsers[0].id,
          role: 'admin'
        }));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Verify search results contain the search term
      const foundMatch = response.body.some((demand: any) => 
        demand.description.toLowerCase().includes('faucet')
      );
      expect(foundMatch).toBe(true);
    });
  });

  describe('POST /api/demands', () => {
    it('should create a new demand as resident', async () => {
      const newDemand = {
        type: 'maintenance',
        description: 'Broken light fixture in living room',
        residenceId: testResidences[0].id,
        buildingId: testBuildings[0].id
      };

      const response = await request(app)
        .post('/api/demands')
        .send(newDemand)
        .set('test-user', JSON.stringify({
          id: testUsers[2].id,
          role: 'resident'
        }));

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.type).toBe(newDemand.type);
      expect(response.body.description).toBe(newDemand.description);
      expect(response.body.status).toBe('pending');
      expect(response.body.submitterId).toBe(testUsers[2].id);

      // Cleanup created demand
      await db.delete(demands).where(eq(demands.id, response.body.id));
    });

    it('should prevent tenant from creating demands (view only)', async () => {
      const newDemand = {
        type: 'maintenance',
        description: 'Test demand from tenant',
        residenceId: testResidences[1].id,
        buildingId: testBuildings[0].id
      };

      const response = await request(app)
        .post('/api/demands')
        .send(newDemand)
        .set('test-user', JSON.stringify({
          id: testUsers[3].id,
          role: 'tenant'
        }));

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('not authorized');
    });

    it('should validate required fields', async () => {
      const invalidDemand = {
        type: 'maintenance'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/demands')
        .send(invalidDemand)
        .set('test-user', JSON.stringify({
          id: testUsers[2].id,
          role: 'resident'
        }));

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('validation');
    });

    it('should validate demand type enum', async () => {
      const invalidDemand = {
        type: 'invalid_type',
        description: 'Test demand with invalid type',
        residenceId: testResidences[0].id,
        buildingId: testBuildings[0].id
      };

      const response = await request(app)
        .post('/api/demands')
        .send(invalidDemand)
        .set('test-user', JSON.stringify({
          id: testUsers[2].id,
          role: 'resident'
        }));

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('type');
    });
  });

  describe('PATCH /api/demands/:id/status', () => {
    it('should allow manager to update demand status', async () => {
      const demandId = testDemands[0].id;
      const statusUpdate = {
        status: 'approved',
        reviewNotes: 'Approved for maintenance work'
      };

      const response = await request(app)
        .patch(`/api/demands/${demandId}/status`)
        .send(statusUpdate)
        .set('test-user', JSON.stringify({
          id: testUsers[1].id,
          role: 'manager'
        }));

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('approved');
      expect(response.body.reviewNotes).toBe(statusUpdate.reviewNotes);
      expect(response.body.reviewedBy).toBe(testUsers[1].id);
      expect(response.body).toHaveProperty('reviewedAt');
    });

    it('should allow admin to update demand status', async () => {
      const demandId = testDemands[0].id;
      const statusUpdate = {
        status: 'completed',
        reviewNotes: 'Work completed successfully'
      };

      const response = await request(app)
        .patch(`/api/demands/${demandId}/status`)
        .send(statusUpdate)
        .set('test-user', JSON.stringify({
          id: testUsers[0].id,
          role: 'admin'
        }));

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('completed');
    });

    it('should prevent residents from updating demand status', async () => {
      const demandId = testDemands[0].id;
      const statusUpdate = {
        status: 'completed'
      };

      const response = await request(app)
        .patch(`/api/demands/${demandId}/status`)
        .send(statusUpdate)
        .set('test-user', JSON.stringify({
          id: testUsers[2].id,
          role: 'resident'
        }));

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('not authorized');
    });
  });

  describe('DELETE /api/demands/:id', () => {
    it('should allow resident to delete their own demand', async () => {
      // Create a demand to delete
      const [demandToDelete] = await db.insert(demands).values({
        submitterId: testUsers[2].id,
        type: 'information',
        description: 'Test demand to delete',
        residenceId: testResidences[0].id,
        buildingId: testBuildings[0].id,
        status: 'pending'
      }).returning();

      const response = await request(app)
        .delete(`/api/demands/${demandToDelete.id}`)
        .set('test-user', JSON.stringify({
          id: testUsers[2].id,
          role: 'resident'
        }));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('deleted');

      // Verify demand was deleted
      const deletedDemand = await db
        .select()
        .from(demands)
        .where(eq(demands.id, demandToDelete.id));
      
      expect(deletedDemand.length).toBe(0);
    });

    it('should prevent residents from deleting others demands', async () => {
      const demandId = testDemands[1].id; // demand by tenant user

      const response = await request(app)
        .delete(`/api/demands/${demandId}`)
        .set('test-user', JSON.stringify({
          id: testUsers[2].id, // resident user
          role: 'resident'
        }));

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('not authorized');
    });

    it('should allow admin to delete any demand', async () => {
      // Create a demand to delete
      const [demandToDelete] = await db.insert(demands).values({
        submitterId: testUsers[3].id,
        type: 'other',
        description: 'Admin deletion test',
        residenceId: testResidences[1].id,
        buildingId: testBuildings[0].id,
        status: 'pending'
      }).returning();

      const response = await request(app)
        .delete(`/api/demands/${demandToDelete.id}`)
        .set('test-user', JSON.stringify({
          id: testUsers[0].id,
          role: 'admin'
        }));

      expect(response.status).toBe(200);

      // Verify demand was deleted
      const deletedDemand = await db
        .select()
        .from(demands)
        .where(eq(demands.id, demandToDelete.id));
      
      expect(deletedDemand.length).toBe(0);
    });
  });

  describe('GET /api/demands/:id/comments', () => {
    it('should return comments for a demand', async () => {
      // First create a comment
      const [comment] = await db.insert(demandComments).values({
        demandId: testDemands[0].id,
        authorId: testUsers[1].id,
        content: 'This needs immediate attention',
        isInternal: false
      }).returning();

      const response = await request(app)
        .get(`/api/demands/${testDemands[0].id}/comments`)
        .set('test-user', JSON.stringify({
          id: testUsers[2].id,
          role: 'resident'
        }));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('content');
      expect(response.body[0]).toHaveProperty('author');

      // Cleanup
      await db.delete(demandComments).where(eq(demandComments.id, comment.id));
    });
  });

  describe('POST /api/demands/:id/comments', () => {
    it('should create a comment on a demand', async () => {
      const newComment = {
        content: 'I can schedule this for next week',
        isInternal: false
      };

      const response = await request(app)
        .post(`/api/demands/${testDemands[0].id}/comments`)
        .send(newComment)
        .set('test-user', JSON.stringify({
          id: testUsers[1].id,
          role: 'manager'
        }));

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.content).toBe(newComment.content);
      expect(response.body.authorId).toBe(testUsers[1].id);
      expect(response.body.demandId).toBe(testDemands[0].id);

      // Cleanup
      await db.delete(demandComments).where(eq(demandComments.id, response.body.id));
    });

    it('should validate comment content', async () => {
      const invalidComment = {
        content: '', // Empty content
        isInternal: false
      };

      const response = await request(app)
        .post(`/api/demands/${testDemands[0].id}/comments`)
        .send(invalidComment)
        .set('test-user', JSON.stringify({
          id: testUsers[1].id,
          role: 'manager'
        }));

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent demand ID', async () => {
      const response = await request(app)
        .get('/api/demands/non-existent-id/comments')
        .set('test-user', JSON.stringify({
          id: testUsers[0].id,
          role: 'admin'
        }));

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle invalid demand ID format', async () => {
      const response = await request(app)
        .patch('/api/demands/invalid-id/status')
        .send({ status: 'approved' })
        .set('test-user', JSON.stringify({
          id: testUsers[1].id,
          role: 'manager'
        }));

      expect(response.status).toBe(400);
    });

    it('should handle database connection errors gracefully', async () => {
      // Mock database error
      const originalSelect = db.select;
      db.select = jest.fn().mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await request(app)
        .get('/api/demands')
        .set('test-user', JSON.stringify({
          id: testUsers[0].id,
          role: 'admin'
        }));

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('server error');

      // Restore original function
      db.select = originalSelect;
    });
  });
});