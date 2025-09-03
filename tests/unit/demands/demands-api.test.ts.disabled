/**
 * @file Demands API Unit Tests.
 * @description Comprehensive unit tests for the demands API functionality
 * including CRUD operations, role-based access control, and filtering.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import express, { Express } from 'express';
import request from 'supertest';
import { registerDemandRoutes } from '../../../server/api/demands';
import {
  demands,
  demandComments,
  users,
  organizations,
  buildings,
  residences,
  userOrganizations,
  userResidences,
} from '../../../shared/schema';

// Mock database functions for testing
jest.mock('../../../server/db', () => ({
  db: {
    query: {
      demands: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      demandComments: {
        findMany: jest.fn(),
      },
      users: {
        findFirst: jest.fn(),
      },
      organizations: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      buildings: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      residences: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      userOrganizations: {
        findMany: jest.fn(),
      },
      userResidences: {
        findMany: jest.fn(),
      },
    },
    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        returning: jest.fn(() => Promise.resolve([{ id: 'test-id' }])),
      })),
    })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(() => ({
          returning: jest.fn(() => Promise.resolve([{ id: 'test-id' }])),
        })),
      })),
    })),
    delete: jest.fn(() => ({
      where: jest.fn(() => Promise.resolve()),
    })),
  },
}));

const { db } = require('../../../server/db');

// Mock auth middleware for testing
jest.mock('../../../server/auth/index', () => ({
  requireAuth: jest.fn((req: express.Request, res: express.Response, next: () => void) => {
    // Add test user to request
    (req as express.Request & { user?: unknown; testUser?: unknown }).user = (
      req as express.Request & { testUser?: unknown }
    ).testUser || {
      id: 'test-user-id',
      role: 'resident',
      organizationIds: ['test-org-1'],
      buildingIds: ['test-building-1'],
      residenceIds: ['test-residence-1'],
    };
    next();
  }),
}));

describe('Demands API Unit Tests', () => {
  let app: Express;
  const testUsers: Record<string, unknown>[] = [];
  const testOrganizations: Record<string, unknown>[] = [];
  const testBuildings: Record<string, unknown>[] = [];
  const testResidences: Record<string, unknown>[] = [];
  const testDemands: Record<string, unknown>[] = [];

  beforeAll(async () => {
    // Setup test application
    app = express();
    app.use(express.json());
    registerDemandRoutes(app as express.Application);

    // Setup mock data
    setupMockData();
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setupMockData();
  });

  function setupMockData() {
    // Mock test data
    const mockOrg1 = {
      id: 'test-org-1',
      name: 'Test Organization 1',
      type: 'management_company',
      address: '123 Test St',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A 1A1',
      phone: '514-555-0001',
      email: 'org1@test.com',
    };

      // Create test users with different roles
      const usersData = [
        {
          id: 'admin-user',
          username: 'admin_test',
          email: 'admin@test.com',
          password: 'hashed_password',
          firstName: 'Admin',
          lastName: 'User',
          role: 'admin' as const,
        },
        {
          id: 'manager-user',
          username: 'manager_test',
          email: 'manager@test.com',
          password: 'hashed_password',
          firstName: 'Manager',
          lastName: 'User',
          role: 'manager' as const,
        },
        {
          id: 'resident-user',
          username: 'resident_test',
          email: 'resident@test.com',
          password: 'hashed_password',
          firstName: 'Resident',
          lastName: 'User',
          role: 'resident' as const,
        },
        {
          id: 'tenant-user',
          username: 'tenant_test',
          email: 'tenant@test.com',
          password: 'hashed_password',
          firstName: 'Tenant',
          lastName: 'User',
          role: 'tenant' as const,
        },
      ];

      for (const userData of usersData) {
        const [user] = await db.insert(users).values(userData).returning();
        testUsers.push(user);

        // Link users to organization
        await db.insert(userOrganizations).values({
          userId: user.id,
          organizationId: org1.id,
          organizationRole: userData.role,
        });
      }

      // Create test buildings
      const [building1] = await db
        .insert(buildings)
        .values({
          id: 'test-building-1',
          organizationId: org1.id,
          name: 'Test Building 1',
          address: '456 Building St',
          city: 'Montreal',
          province: 'QC',
          postalCode: 'H1B 1B1',
          buildingType: 'apartment',
          totalUnits: 10,
          yearBuilt: 2020,
          parkingSpaces: 2,
          storageSpaces: 2,
        })
        .returning();
      testBuildings.push(building1);

      // Create test residences
      const residencesData = [
        {
          id: 'test-residence-1',
          buildingId: building1.id,
          unitNumber: '101',
          floor: 1,
          squareFootage: '800',
          bedrooms: 2,
          bathrooms: '1.0',
          parkingSpaceNumbers: ['P1'],
          storageSpaceNumbers: ['S1'],
        },
        {
          id: 'test-residence-2',
          buildingId: building1.id,
          unitNumber: '102',
          floor: 1,
          squareFootage: '900',
          bedrooms: 2,
          bathrooms: '1.0',
          parkingSpaceNumbers: ['P2'],
          storageSpaceNumbers: ['S2'],
        },
      ];

      for (const residenceData of residencesData) {
        const [residence] = await db.insert(residences).values(residenceData).returning();
        testResidences.push(residence);
      }

      // Link users to residences
      const userResidenceData = [
        {
          userId: testUsers[2].id as string,
          residenceId: testResidences[0].id as string,
          relationshipType: 'owner' as const,
          startDate: '2024-01-01',
        },
        {
          userId: testUsers[3].id as string,
          residenceId: testResidences[1].id as string,
          relationshipType: 'tenant' as const,
          startDate: '2024-01-01',
        },
      ];
      await db.insert(userResidences).values(userResidenceData);

      // Create test demands
      const demandsData = [
        {
          id: 'test-demand-1',
          submitterId: testUsers[2].id as string, // resident
          type: 'maintenance' as const,
          description: 'Faucet is leaking in kitchen',
          residenceId: testResidences[0].id as string,
          buildingId: building1.id as string,
          status: 'submitted' as const,
        },
        {
          id: 'test-demand-2',
          submitterId: testUsers[3].id as string, // tenant
          type: 'complaint' as const,
          description: 'Noise from upstairs neighbor',
          residenceId: testResidences[1].id as string,
          buildingId: building1.id as string,
          status: 'approved' as const,
        },
        {
          id: 'test-demand-3',
          submitterId: testUsers[2].id as string, // resident
          type: 'information' as const,
          description: 'Question about parking rules',
          residenceId: testResidences[0].id as string,
          buildingId: building1.id as string,
          status: 'completed' as const,
          reviewedBy: testUsers[1].id as string, // manager
          reviewedAt: new Date(),
          reviewNotes: 'Information provided via email',
        },
      ];

      for (const demandData of demandsData) {
        const [demand] = await db.insert(demands).values([demandData]).returning();
        testDemands.push(demand);
      }
    } catch (_error) {
      console.error('Failed to setup test _data:', _error);
      throw _error;
    }
  }

  /**
   * Cleanup all test data after tests complete.
   */
  /**
   * CleanupTestData function.
   * @returns Function result.
   */
  async function cleanupTestData() {
    try {
      // Delete test-specific data only, in reverse order to respect foreign key constraints

      // Clean up demand comments
      await db.delete(demandComments).where(like(demandComments.id, 'test-%'));

      // Clean up demands
      await db.delete(demands).where(like(demands.id, 'test-%'));

      // Clean up user-residence relationships
      await db.delete(userResidences).where(like(userResidences.userId, 'test-%'));

      // Clean up residences
      await db.delete(residences).where(like(residences.id, 'test-%'));

      // Clean up buildings
      await db.delete(buildings).where(like(buildings.id, 'test-%'));

      // Clean up user-organization relationships
      await db.delete(userOrganizations).where(like(userOrganizations.userId, 'test-%'));

      // Clean up users
      await db.delete(users).where(like(users.id, 'test-%'));

      // Clean up organizations
      await db.delete(organizations).where(like(organizations.id, 'test-%'));

      // Clear test arrays
      testUsers.length = 0;
      testOrganizations.length = 0;
      testBuildings.length = 0;
      testResidences.length = 0;
      testDemands.length = 0;
    } catch (_error) {
      console.error('Failed to cleanup test _data:', _error);
    }
  }

  describe('GET /api/demands', () => {
    it('should return demands for admin user (all demands)', async () => {
      const response = await request(app)
        .get('/api/demands')
        .set(
          'test-user',
          JSON.stringify({
            id: testUsers[0].id,
            role: 'admin',
          })
        );

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
        .set(
          'test-user',
          JSON.stringify({
            id: testUsers[1].id,
            role: 'manager',
          })
        );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // Verify manager can see demands from their organization
      response.body.forEach((demand: Record<string, unknown>) => {
        expect((demand as any).building.id).toBe(testBuildings[0].id);
      });
    });

    it('should return demands for resident user (own demands and building demands)', async () => {
      const response = await request(app)
        .get('/api/demands')
        .set(
          'test-user',
          JSON.stringify({
            id: testUsers[2].id,
            role: 'resident',
          })
        );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // Verify resident can see relevant demands
      response.body.forEach((demand: Record<string, unknown>) => {
        expect(
          demand.submitterId === testUsers[2].id ||
            demand.buildingId === testResidences[0].buildingId
        ).toBe(true);
      });
    });

    it('should return limited demands for tenant user (view only their own)', async () => {
      const response = await request(app)
        .get('/api/demands')
        .set(
          'test-user',
          JSON.stringify({
            id: testUsers[3].id,
            role: 'tenant',
          })
        );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // Verify tenant can only see their own demands
      response.body.forEach((demand: Record<string, unknown>) => {
        expect(demand.submitterId).toBe(testUsers[3].id);
      });
    });

    it('should filter demands by type', async () => {
      const response = await request(app)
        .get('/api/demands?type=maintenance')
        .set(
          'test-user',
          JSON.stringify({
            id: testUsers[0].id,
            role: 'admin',
          })
        );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      response.body.forEach((demand: Record<string, unknown>) => {
        expect(demand.type).toBe('maintenance');
      });
    });

    it('should filter demands by status', async () => {
      const response = await request(app)
        .get('/api/demands?status=pending')
        .set(
          'test-user',
          JSON.stringify({
            id: testUsers[0].id,
            role: 'admin',
          })
        );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      response.body.forEach((demand: Record<string, unknown>) => {
        expect(demand.status).toBe('pending');
      });
    });

    it('should filter demands by building', async () => {
      const response = await request(app)
        .get(`/api/demands?buildingId=${testBuildings[0].id}`)
        .set(
          'test-user',
          JSON.stringify({
            id: testUsers[0].id,
            role: 'admin',
          })
        );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      response.body.forEach((demand: Record<string, unknown>) => {
        expect(demand.buildingId).toBe(testBuildings[0].id);
      });
    });

    it('should search demands by description', async () => {
      const response = await request(app)
        .get('/api/demands?search=faucet')
        .set(
          'test-user',
          JSON.stringify({
            id: testUsers[0].id,
            role: 'admin',
          })
        );

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
        buildingId: testBuildings[0].id,
      };

      const response = await request(app)
        .post('/api/demands')
        .send(newDemand)
        .set(
          'test-user',
          JSON.stringify({
            id: testUsers[2].id,
            role: 'resident',
          })
        );

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
        buildingId: testBuildings[0].id,
      };

      const response = await request(app)
        .post('/api/demands')
        .send(newDemand)
        .set(
          'test-user',
          JSON.stringify({
            id: testUsers[3].id,
            role: 'tenant',
          })
        );

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('not authorized');
    });

    it('should validate required fields', async () => {
      const invalidDemand = {
        type: 'maintenance',
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/demands')
        .send(invalidDemand)
        .set(
          'test-user',
          JSON.stringify({
            id: testUsers[2].id,
            role: 'resident',
          })
        );

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('validation');
    });

    it('should validate demand type enum', async () => {
      const invalidDemand = {
        type: 'invalid_type',
        description: 'Test demand with invalid type',
        residenceId: testResidences[0].id,
        buildingId: testBuildings[0].id,
      };

      const response = await request(app)
        .post('/api/demands')
        .send(invalidDemand)
        .set(
          'test-user',
          JSON.stringify({
            id: testUsers[2].id,
            role: 'resident',
          })
        );

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
        reviewNotes: 'Approved for maintenance work',
      };

      const response = await request(app)
        .patch(`/api/demands/${demandId}/status`)
        .send(statusUpdate)
        .set(
          'test-user',
          JSON.stringify({
            id: testUsers[1].id,
            role: 'manager',
          })
        );

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
        reviewNotes: 'Work completed successfully',
      };

      const response = await request(app)
        .patch(`/api/demands/${demandId}/status`)
        .send(statusUpdate)
        .set(
          'test-user',
          JSON.stringify({
            id: testUsers[0].id,
            role: 'admin',
          })
        );

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('completed');
    });

    it('should prevent residents from updating demand status', async () => {
      const demandId = testDemands[0].id;
      const statusUpdate = {
        status: 'completed',
      };

      const response = await request(app)
        .patch(`/api/demands/${demandId}/status`)
        .send(statusUpdate)
        .set(
          'test-user',
          JSON.stringify({
            id: testUsers[2].id,
            role: 'resident',
          })
        );

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('not authorized');
    });
  });

  describe('DELETE /api/demands/:id', () => {
    it('should allow resident to delete their own demand', async () => {
      // Create a demand to delete
      const [demandToDelete] = await db
        .insert(demands)
        .values({
          submitterId: testUsers[2].id,
          type: 'information',
          description: 'Test demand to delete',
          residenceId: testResidences[0].id,
          buildingId: testBuildings[0].id,
          status: 'submitted',
        })
        .returning();

      const response = await request(app)
        .delete(`/api/demands/${demandToDelete.id}`)
        .set(
          'test-user',
          JSON.stringify({
            id: testUsers[2].id,
            role: 'resident',
          })
        );

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
        .set(
          'test-user',
          JSON.stringify({
            id: testUsers[2].id, // resident user
            role: 'resident',
          })
        );

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('not authorized');
    });

    it('should allow admin to delete any demand', async () => {
      // Create a demand to delete
      const [demandToDelete] = await db
        .insert(demands)
        .values({
          submitterId: testUsers[3].id,
          type: 'other',
          description: 'Admin deletion test',
          residenceId: testResidences[1].id,
          buildingId: testBuildings[0].id,
          status: 'submitted',
        })
        .returning();

      const response = await request(app)
        .delete(`/api/demands/${demandToDelete.id}`)
        .set(
          'test-user',
          JSON.stringify({
            id: testUsers[0].id,
            role: 'admin',
          })
        );

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
      const [comment] = await db
        .insert(demandComments)
        .values({
          demandId: testDemands[0].id,
          createdBy: testUsers[1].id,
          comment: 'This needs immediate attention',
          orderIndex: '1.0',
        })
        .returning();

      const response = await request(app)
        .get(`/api/demands/${testDemands[0].id}/comments`)
        .set(
          'test-user',
          JSON.stringify({
            id: testUsers[2].id,
            role: 'resident',
          })
        );

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
        isInternal: false,
      };

      const response = await request(app)
        .post(`/api/demands/${testDemands[0].id}/comments`)
        .send(newComment)
        .set(
          'test-user',
          JSON.stringify({
            id: testUsers[1].id,
            role: 'manager',
          })
        );

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
        isInternal: false,
      };

      const response = await request(app)
        .post(`/api/demands/${testDemands[0].id}/comments`)
        .send(invalidComment)
        .set(
          'test-user',
          JSON.stringify({
            id: testUsers[1].id,
            role: 'manager',
          })
        );

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent demand ID', async () => {
      const response = await request(app)
        .get('/api/demands/non-existent-id/comments')
        .set(
          'test-user',
          JSON.stringify({
            id: testUsers[0].id,
            role: 'admin',
          })
        );

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle invalid demand ID format', async () => {
      const response = await request(app)
        .patch('/api/demands/invalid-id/status')
        .send({ status: 'approved' })
        .set(
          'test-user',
          JSON.stringify({
            id: testUsers[1].id,
            role: 'manager',
          })
        );

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
        .set(
          'test-user',
          JSON.stringify({
            id: testUsers[0].id,
            role: 'admin',
          })
        );

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('server error');

      // Restore original function
      db.select = originalSelect;
    });
  });
});
