/**
 * @file Demands Workflow Integration Tests.
 * @description Integration tests for complete demands workflow from creation to completion.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { db } from '../../../server/db';
import { registerDemandRoutes } from '../../../server/api/demands';
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

describe('Demands Workflow Integration Tests', () => {
  let app: express.Application;
  let testData: {
    admin: any;
    manager: any;
    resident: any;
    tenant: any;
    organization: any;
    building: any;
    residence1: any;
    residence2: any;
    demandId: string;
  };

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    
    // Mock auth middleware
    app.use((req: unknown, res: unknown, next: unknown) => {
      const userHeader = req.get('test-user');
      if (userHeader) {
        req.user = JSON.parse(userHeader);
      }
      next();
    });
    
    registerDemandRoutes(app);
    
    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  /**
   *
   */
  /**
   * SetupTestData function.
   * @returns Function result.
   */
  async function setupTestData() {
    // Create organization
    const [org] = await db.insert(organizations).values({
      name: 'Workflow Test Org',
      type: 'management_company',
      address: '123 Workflow St',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1W 1W1',
      phone: '514-555-0100',
      email: 'workflow@test.com'
    }).returning();

    // Create users
    const [admin] = await db.insert(users).values({
      username: 'admin_workflow',
      email: 'admin.workflow@test.com',
      password: 'hashed_password',
      firstName: 'Admin',
      lastName: 'Workflow',
      role: 'admin'
    }).returning();

    const [manager] = await db.insert(users).values({
      username: 'manager_workflow',
      email: 'manager.workflow@test.com',
      password: 'hashed_password',
      firstName: 'Manager',
      lastName: 'Workflow',
      role: 'manager'
    }).returning();

    const [resident] = await db.insert(users).values({
      username: 'resident_workflow',
      email: 'resident.workflow@test.com',
      password: 'hashed_password',
      firstName: 'Resident',
      lastName: 'Workflow',
      role: 'resident'
    }).returning();

    const [tenant] = await db.insert(users).values({
      username: 'tenant_workflow',
      email: 'tenant.workflow@test.com',
      password: 'hashed_password',
      firstName: 'Tenant',
      lastName: 'Workflow',
      role: 'tenant'
    }).returning();

    // Link users to organization
    await db.insert(userOrganizations).values([
      { userId: admin.id, organizationId: org.id, organizationRole: 'admin' },
      { userId: manager.id, organizationId: org.id, organizationRole: 'manager' },
      { userId: resident.id, organizationId: org.id, organizationRole: 'resident' },
      { userId: tenant.id, organizationId: org.id, organizationRole: 'tenant' }
    ]);

    // Create building
    const [building] = await db.insert(buildings).values({
      organizationId: org.id,
      name: 'Workflow Test Building',
      address: '456 Workflow Ave',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1W 2W2',
      buildingType: 'Apartment',
      totalUnits: 20
    }).returning();

    // Create residences
    const [residence1] = await db.insert(residences).values({
      buildingId: building.id,
      unitNumber: '101',
      floor: 1,
      squareFootage: 850,
      bedrooms: 2,
      bathrooms: 1
    }).returning();

    const [residence2] = await db.insert(residences).values({
      buildingId: building.id,
      unitNumber: '102',
      floor: 1,
      squareFootage: 950,
      bedrooms: 2,
      bathrooms: 1
    }).returning();

    // Link users to residences
    await db.insert(userResidences).values([
      {
        userId: resident.id,
        residenceId: residence1.id,
        residenceRole: 'owner'
      },
      {
        userId: tenant.id,
        residenceId: residence2.id,
        residenceRole: 'tenant'
      }
    ]);

    testData = {
      admin,
      manager,
      resident,
      tenant,
      organization: org,
      building,
      residence1,
      residence2,
      demandId: '' // Will be set during tests
    };
  }

  /**
   *
   */
  /**
   * CleanupTestData function.
   * @returns Function result.
   */
  async function cleanupTestData() {
    if (testData) {
      await db.delete(demandComments);
      await db.delete(demands);
      await db.delete(userResidences);
      await db.delete(residences);
      await db.delete(buildings);
      await db.delete(userOrganizations);
      await db.delete(users);
      await db.delete(organizations);
    }
  }

  describe('Complete Demand Lifecycle', () => {
    it('should complete the full workflow: Create -> Review -> Approve -> Comment -> Complete', async () => {
      // Step 1: Resident creates a maintenance demand
      const demandData = {
        type: 'maintenance',
        description: 'Kitchen sink faucet is leaking and needs immediate repair. Water is dripping constantly.',
        residenceId: testData.residence1.id,
        buildingId: testData.building.id
      };

      const createResponse = await request(app)
        .post('/api/demands')
        .send(demandData)
        .set('test-user', JSON.stringify({
          id: testData.resident.id,
          role: 'resident'
        }));

      expect(createResponse.status).toBe(201);
      expect(createResponse.body).toHaveProperty('id');
      expect(createResponse.body.status).toBe('submitted');
      expect(createResponse.body.type).toBe('maintenance');

      const demandId = createResponse.body.id;
      testData.demandId = demandId;

      // Step 2: Manager reviews the demand and changes status to under_review
      const reviewResponse = await request(app)
        .patch(`/api/demands/${demandId}/status`)
        .send({
          status: 'under_review',
          reviewNotes: 'Reviewing the maintenance request. Scheduling site inspection.'
        })
        .set('test-user', JSON.stringify({
          id: testData.manager.id,
          role: 'manager'
        }));

      expect(reviewResponse.status).toBe(200);
      expect(reviewResponse.body.status).toBe('under_review');
      expect(reviewResponse.body.reviewNotes).toContain('Reviewing');
      expect(reviewResponse.body.reviewedBy).toBe(testData.manager.id);
      expect(reviewResponse.body).toHaveProperty('reviewedAt');

      // Step 3: Manager adds an internal comment
      const internalCommentResponse = await request(app)
        .post(`/api/demands/${demandId}/comments`)
        .send({
          content: 'Plumber contacted. Available tomorrow between 2-4 PM. Estimated cost: $150',
          isInternal: true
        })
        .set('test-user', JSON.stringify({
          id: testData.manager.id,
          role: 'manager'
        }));

      expect(internalCommentResponse.status).toBe(201);
      expect(internalCommentResponse.body.isInternal).toBe(true);

      // Step 4: Manager adds a public comment for the resident
      const publicCommentResponse = await request(app)
        .post(`/api/demands/${demandId}/comments`)
        .send({
          content: 'We have scheduled a plumber for tomorrow between 2-4 PM. Please ensure someone is available to provide access.',
          isInternal: false
        })
        .set('test-user', JSON.stringify({
          id: testData.manager.id,
          role: 'manager'
        }));

      expect(publicCommentResponse.status).toBe(201);
      expect(publicCommentResponse.body.isInternal).toBe(false);

      // Step 5: Manager approves the demand
      const approveResponse = await request(app)
        .patch(`/api/demands/${demandId}/status`)
        .send({
          status: 'approved',
          reviewNotes: 'Approved for immediate repair. Plumber scheduled for tomorrow.'
        })
        .set('test-user', JSON.stringify({
          id: testData.manager.id,
          role: 'manager'
        }));

      expect(approveResponse.status).toBe(200);
      expect(approveResponse.body.status).toBe('approved');

      // Step 6: Resident responds with a comment
      const residentCommentResponse = await request(app)
        .post(`/api/demands/${demandId}/comments`)
        .send({
          content: 'Thank you! I will be available tomorrow afternoon. The building entrance code is 1234.',
          isInternal: false
        })
        .set('test-user', JSON.stringify({
          id: testData.resident.id,
          role: 'resident'
        }));

      expect(residentCommentResponse.status).toBe(201);

      // Step 7: Manager updates status to in_progress
      const progressResponse = await request(app)
        .patch(`/api/demands/${demandId}/status`)
        .send({
          status: 'in_progress',
          reviewNotes: 'Plumber arrived and working on the repair.'
        })
        .set('test-user', JSON.stringify({
          id: testData.manager.id,
          role: 'manager'
        }));

      expect(progressResponse.status).toBe(200);
      expect(progressResponse.body.status).toBe('in_progress');

      // Step 8: Admin completes the demand
      const completeResponse = await request(app)
        .patch(`/api/demands/${demandId}/status`)
        .send({
          status: 'completed',
          reviewNotes: 'Repair completed successfully. New faucet installed. Invoice processed.'
        })
        .set('test-user', JSON.stringify({
          id: testData.admin.id,
          role: 'admin'
        }));

      expect(completeResponse.status).toBe(200);
      expect(completeResponse.body.status).toBe('completed');

      // Step 9: Verify final state by fetching the demand
      const finalResponse = await request(app)
        .get('/api/demands')
        .query({ demandId })
        .set('test-user', JSON.stringify({
          id: testData.admin.id,
          role: 'admin'
        }));

      expect(finalResponse.status).toBe(200);
      const finalDemand = finalResponse.body.find((d: unknown) => d.id === demandId);
      expect(finalDemand).toBeDefined();
      expect(finalDemand.status).toBe('completed');

      // Step 10: Verify all comments were created
      const commentsResponse = await request(app)
        .get(`/api/demands/${demandId}/comments`)
        .set('test-user', JSON.stringify({
          id: testData.admin.id,
          role: 'admin'
        }));

      expect(commentsResponse.status).toBe(200);
      expect(commentsResponse.body.length).toBe(3); // 1 internal + 2 public comments
    });

    it('should handle demand rejection workflow', async () => {
      // Step 1: Resident creates an invalid demand
      const invalidDemandData = {
        type: 'complaint',
        description: 'I don\'t like the color of the hallway walls. Change them to purple.',
        residenceId: testData.residence1.id,
        buildingId: testData.building.id
      };

      const createResponse = await request(app)
        .post('/api/demands')
        .send(invalidDemandData)
        .set('test-user', JSON.stringify({
          id: testData.resident.id,
          role: 'resident'
        }));

      expect(createResponse.status).toBe(201);
      const demandId = createResponse.body.id;

      // Step 2: Manager rejects the demand
      const rejectResponse = await request(app)
        .patch(`/api/demands/${demandId}/status`)
        .send({
          status: 'rejected',
          reviewNotes: 'Personal preferences for common area colors cannot be accommodated. Per building regulations, cosmetic changes require board approval and majority consent.'
        })
        .set('test-user', JSON.stringify({
          id: testData.manager.id,
          role: 'manager'
        }));

      expect(rejectResponse.status).toBe(200);
      expect(rejectResponse.body.status).toBe('rejected');
      expect(rejectResponse.body.reviewNotes).toContain('Personal preferences');

      // Step 3: Manager adds explanation comment
      const explanationComment = await request(app)
        .post(`/api/demands/${demandId}/comments`)
        .send({
          content: 'If you would like to propose changes to common areas, please submit a formal proposal to the building committee for consideration at the next monthly meeting.',
          isInternal: false
        })
        .set('test-user', JSON.stringify({
          id: testData.manager.id,
          role: 'manager'
        }));

      expect(explanationComment.status).toBe(201);

      // Cleanup this test demand
      await db.delete(demands).where(eq(demands.id, demandId));
    });

    it('should handle demand cancellation by resident', async () => {
      // Step 1: Resident creates a demand
      const demandData = {
        type: 'information',
        description: 'What are the pool hours for summer?',
        residenceId: testData.residence1.id,
        buildingId: testData.building.id
      };

      const createResponse = await request(app)
        .post('/api/demands')
        .send(demandData)
        .set('test-user', JSON.stringify({
          id: testData.resident.id,
          role: 'resident'
        }));

      expect(createResponse.status).toBe(201);
      const demandId = createResponse.body.id;

      // Step 2: Resident adds comment saying they found the info
      const residentComment = await request(app)
        .post(`/api/demands/${demandId}/comments`)
        .send({
          content: 'Never mind, I found the information on the building website. Pool hours are 6 AM - 10 PM daily.',
          isInternal: false
        })
        .set('test-user', JSON.stringify({
          id: testData.resident.id,
          role: 'resident'
        }));

      expect(residentComment.status).toBe(201);

      // Step 3: Manager cancels the demand
      const cancelResponse = await request(app)
        .patch(`/api/demands/${demandId}/status`)
        .send({
          status: 'cancelled',
          reviewNotes: 'Cancelled per resident request - information found independently.'
        })
        .set('test-user', JSON.stringify({
          id: testData.manager.id,
          role: 'manager'
        }));

      expect(cancelResponse.status).toBe(200);
      expect(cancelResponse.body.status).toBe('cancelled');

      // Cleanup this test demand
      await db.delete(demands).where(eq(demands.id, demandId));
    });
  });

  describe('Role-Based Access Control in Workflow', () => {
    it('should enforce tenant view-only permissions throughout workflow', async () => {
      // Create a demand as resident first
      const demandData = {
        type: 'other',
        description: 'Request for building-wide WiFi upgrade',
        residenceId: testData.residence1.id,
        buildingId: testData.building.id
      };

      const createResponse = await request(app)
        .post('/api/demands')
        .send(demandData)
        .set('test-user', JSON.stringify({
          id: testData.resident.id,
          role: 'resident'
        }));

      const demandId = createResponse.body.id;

      // Tenant should NOT be able to create demands
      const tenantCreateResponse = await request(app)
        .post('/api/demands')
        .send({
          type: 'maintenance',
          description: 'Tenant trying to create demand',
          residenceId: testData.residence2.id,
          buildingId: testData.building.id
        })
        .set('test-user', JSON.stringify({
          id: testData.tenant.id,
          role: 'tenant'
        }));

      expect(tenantCreateResponse.status).toBe(403);

      // Tenant should NOT be able to update demand status
      const tenantStatusResponse = await request(app)
        .patch(`/api/demands/${demandId}/status`)
        .send({ status: 'completed' })
        .set('test-user', JSON.stringify({
          id: testData.tenant.id,
          role: 'tenant'
        }));

      expect(tenantStatusResponse.status).toBe(403);

      // Tenant should NOT be able to delete demands
      const tenantDeleteResponse = await request(app)
        .delete(`/api/demands/${demandId}`)
        .set('test-user', JSON.stringify({
          id: testData.tenant.id,
          role: 'tenant'
        }));

      expect(tenantDeleteResponse.status).toBe(403);

      // Tenant SHOULD be able to view demands (limited)
      const tenantViewResponse = await request(app)
        .get('/api/demands')
        .set('test-user', JSON.stringify({
          id: testData.tenant.id,
          role: 'tenant'
        }));

      expect(tenantViewResponse.status).toBe(200);

      // Tenant SHOULD be able to comment on demands
      const tenantCommentResponse = await request(app)
        .post(`/api/demands/${demandId}/comments`)
        .send({
          content: 'I support this WiFi upgrade request as well.',
          isInternal: false
        })
        .set('test-user', JSON.stringify({
          id: testData.tenant.id,
          role: 'tenant'
        }));

      expect(tenantCommentResponse.status).toBe(201);

      // Cleanup
      await db.delete(demands).where(eq(demands.id, demandId));
    });

    it('should enforce resident permissions correctly', async () => {
      // Create demand as resident
      const demandData = {
        type: 'complaint',
        description: 'Noise complaint about upstairs neighbor',
        residenceId: testData.residence1.id,
        buildingId: testData.building.id
      };

      const createResponse = await request(app)
        .post('/api/demands')
        .send(demandData)
        .set('test-user', JSON.stringify({
          id: testData.resident.id,
          role: 'resident'
        }));

      const demandId = createResponse.body.id;

      // Resident should NOT be able to update demand status
      const residentStatusResponse = await request(app)
        .patch(`/api/demands/${demandId}/status`)
        .send({ status: 'approved' })
        .set('test-user', JSON.stringify({
          id: testData.resident.id,
          role: 'resident'
        }));

      expect(residentStatusResponse.status).toBe(403);

      // Resident SHOULD be able to comment on their demand
      const residentCommentResponse = await request(app)
        .post(`/api/demands/${demandId}/comments`)
        .send({
          content: 'Additional details: The noise occurs every night after 11 PM.',
          isInternal: false
        })
        .set('test-user', JSON.stringify({
          id: testData.resident.id,
          role: 'resident'
        }));

      expect(residentCommentResponse.status).toBe(201);

      // Resident SHOULD be able to delete their own demand (if not yet approved)
      const residentDeleteResponse = await request(app)
        .delete(`/api/demands/${demandId}`)
        .set('test-user', JSON.stringify({
          id: testData.resident.id,
          role: 'resident'
        }));

      expect(residentDeleteResponse.status).toBe(200);
    });
  });

  describe('Error Handling in Workflow', () => {
    it('should handle invalid status transitions', async () => {
      // Create demand
      const demandData = {
        type: 'maintenance',
        description: 'Test invalid status transition',
        residenceId: testData.residence1.id,
        buildingId: testData.building.id
      };

      const createResponse = await request(app)
        .post('/api/demands')
        .send(demandData)
        .set('test-user', JSON.stringify({
          id: testData.resident.id,
          role: 'resident'
        }));

      const demandId = createResponse.body.id;

      // Try to set invalid status
      const invalidStatusResponse = await request(app)
        .patch(`/api/demands/${demandId}/status`)
        .send({ status: 'invalid_status' })
        .set('test-user', JSON.stringify({
          id: testData.manager.id,
          role: 'manager'
        }));

      expect(invalidStatusResponse.status).toBe(400);

      // Cleanup
      await db.delete(demands).where(eq(demands.id, demandId));
    });

    it('should handle concurrent status updates gracefully', async () => {
      // Create demand
      const demandData = {
        type: 'information',
        description: 'Test concurrent updates',
        residenceId: testData.residence1.id,
        buildingId: testData.building.id
      };

      const createResponse = await request(app)
        .post('/api/demands')
        .send(demandData)
        .set('test-user', JSON.stringify({
          id: testData.resident.id,
          role: 'resident'
        }));

      const demandId = createResponse.body.id;

      // Simulate concurrent updates
      const update1Promise = request(app)
        .patch(`/api/demands/${demandId}/status`)
        .send({ status: 'under_review', reviewNotes: 'First update' })
        .set('test-user', JSON.stringify({
          id: testData.manager.id,
          role: 'manager'
        }));

      const update2Promise = request(app)
        .patch(`/api/demands/${demandId}/status`)
        .send({ status: 'approved', reviewNotes: 'Second update' })
        .set('test-user', JSON.stringify({
          id: testData.admin.id,
          role: 'admin'
        }));

      const [response1, response2] = await Promise.all([update1Promise, update2Promise]);

      // Both should succeed or one should handle conflict gracefully
      expect([200, 409]).toContain(response1.status);
      expect([200, 409]).toContain(response2.status);

      // Cleanup
      await db.delete(demands).where(eq(demands.id, demandId));
    });
  });
});