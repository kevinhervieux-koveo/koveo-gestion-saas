/**
 * @file Demand Access Permissions Tests
 * @description Comprehensive tests for role-based access control on demands API endpoints
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { db } from '../../server/db';
import { 
  demands, 
  users, 
  organizations, 
  userOrganizations, 
  buildings, 
  residences,
  userResidences 
} from '../../shared/schema';
import { registerDemandRoutes } from '../../server/api/demands';
import { eq } from 'drizzle-orm';

// Mock authentication middleware
const mockAuth = (user: any) => (req: any, res: any, next: any) => {
  req.user = user;
  next();
};

describe('Demand Access Permissions API Tests', () => {
  let app: express.Application;
  let testUsers: any = {};
  let testOrganizations: any = {};
  let testBuildings: any = {};
  let testResidences: any = {};
  let testDemands: any = {};

  beforeEach(async () => {
    // Setup Express app
    app = express();
    app.use(express.json());

    // Create test organizations
    const orgResults = await db.insert(organizations).values([
      {
        id: 'org-koveo',
        name: 'Koveo Organization',
        domain: 'koveo-gestion.com',
        isActive: true,
      },
      {
        id: 'org-other',
        name: 'Other Organization', 
        domain: 'other.com',
        isActive: true,
      }
    ]).returning();
    
    testOrganizations.koveo = orgResults[0];
    testOrganizations.other = orgResults[1];

    // Create test users
    const userResults = await db.insert(users).values([
      {
        id: 'admin-user',
        email: 'admin@koveo-gestion.com',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        isActive: true,
      },
      {
        id: 'manager-koveo',
        email: 'manager@koveo-gestion.com',
        firstName: 'Manager',
        lastName: 'Koveo',
        role: 'manager',
        isActive: true,
      },
      {
        id: 'manager-other',
        email: 'manager@other.com',
        firstName: 'Manager',
        lastName: 'Other',
        role: 'manager',
        isActive: true,
      },
      {
        id: 'resident-1',
        email: 'resident1@example.com',
        firstName: 'Resident',
        lastName: 'One',
        role: 'resident',
        isActive: true,
      },
      {
        id: 'resident-2',
        email: 'resident2@example.com',
        firstName: 'Resident',
        lastName: 'Two',
        role: 'resident',
        isActive: true,
      }
    ]).returning();

    testUsers.admin = userResults[0];
    testUsers.managerKoveo = userResults[1];
    testUsers.managerOther = userResults[2];
    testUsers.resident1 = userResults[3];
    testUsers.resident2 = userResults[4];

    // Assign managers to organizations
    await db.insert(userOrganizations).values([
      {
        userId: testUsers.managerKoveo.id,
        organizationId: testOrganizations.koveo.id,
        role: 'manager'
      },
      {
        userId: testUsers.managerOther.id,
        organizationId: testOrganizations.other.id,
        role: 'manager'
      }
    ]);

    // Create test buildings
    const buildingResults = await db.insert(buildings).values([
      {
        id: 'building-koveo-1',
        name: 'Koveo Building 1',
        address: '123 Koveo St',
        organizationId: testOrganizations.koveo.id,
      },
      {
        id: 'building-koveo-2',
        name: 'Koveo Building 2', 
        address: '456 Koveo Ave',
        organizationId: testOrganizations.koveo.id,
      },
      {
        id: 'building-other-1',
        name: 'Other Building 1',
        address: '789 Other St',
        organizationId: testOrganizations.other.id,
      }
    ]).returning();

    testBuildings.koveo1 = buildingResults[0];
    testBuildings.koveo2 = buildingResults[1];
    testBuildings.other1 = buildingResults[2];

    // Create test residences
    const residenceResults = await db.insert(residences).values([
      {
        id: 'residence-koveo-1-101',
        unitNumber: '101',
        buildingId: testBuildings.koveo1.id,
      },
      {
        id: 'residence-koveo-2-201',
        unitNumber: '201',
        buildingId: testBuildings.koveo2.id,
      },
      {
        id: 'residence-other-1-301',
        unitNumber: '301',
        buildingId: testBuildings.other1.id,
      }
    ]).returning();

    testResidences.koveo1_101 = residenceResults[0];
    testResidences.koveo2_201 = residenceResults[1];
    testResidences.other1_301 = residenceResults[2];

    // Assign residents to residences
    await db.insert(userResidences).values([
      {
        userId: testUsers.resident1.id,
        residenceId: testResidences.koveo1_101.id,
      },
      {
        userId: testUsers.resident2.id,
        residenceId: testResidences.other1_301.id,
      }
    ]);

    // Create test demands
    const demandResults = await db.insert(demands).values([
      {
        id: 'demand-1',
        submitterId: testUsers.resident1.id,
        type: 'maintenance',
        description: 'Fix broken faucet in Koveo building',
        residenceId: testResidences.koveo1_101.id,
        buildingId: testBuildings.koveo1.id,
        status: 'submitted',
      },
      {
        id: 'demand-2',
        submitterId: testUsers.resident2.id,
        type: 'complaint',
        description: 'Noise complaint in Other building',
        residenceId: testResidences.other1_301.id,
        buildingId: testBuildings.other1.id,
        status: 'under_review',
      },
      {
        id: 'demand-3',
        submitterId: testUsers.resident1.id,
        type: 'information',
        description: 'Question about amenities',
        residenceId: testResidences.koveo1_101.id,
        buildingId: testBuildings.koveo1.id,
        status: 'completed',
      }
    ]).returning();

    testDemands.demand1 = demandResults[0];
    testDemands.demand2 = demandResults[1];
    testDemands.demand3 = demandResults[2];
  });

  afterEach(async () => {
    // Cleanup test data
    await db.delete(demands);
    await db.delete(userResidences);
    await db.delete(residences);
    await db.delete(buildings);
    await db.delete(userOrganizations);
    await db.delete(users);
    await db.delete(organizations);
  });

  describe('GET /api/demands - List Access Control', () => {
    it('admin should see all demands', async () => {
      // Setup route with admin auth
      app.use('/api', mockAuth(testUsers.admin));
      registerDemandRoutes(app);

      const response = await request(app)
        .get('/api/demands')
        .expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body.map((d: any) => d.id)).toContain(testDemands.demand1.id);
      expect(response.body.map((d: any) => d.id)).toContain(testDemands.demand2.id);
      expect(response.body.map((d: any) => d.id)).toContain(testDemands.demand3.id);
    });

    it('manager should only see demands from their organization', async () => {
      // Setup route with Koveo manager auth
      app.use('/api', mockAuth(testUsers.managerKoveo));
      registerDemandRoutes(app);

      const response = await request(app)
        .get('/api/demands')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.map((d: any) => d.id)).toContain(testDemands.demand1.id);
      expect(response.body.map((d: any) => d.id)).toContain(testDemands.demand3.id);
      expect(response.body.map((d: any) => d.id)).not.toContain(testDemands.demand2.id);
    });

    it('manager from other organization should only see their demands', async () => {
      // Setup route with Other organization manager auth
      app.use('/api', mockAuth(testUsers.managerOther));
      registerDemandRoutes(app);

      const response = await request(app)
        .get('/api/demands')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body.map((d: any) => d.id)).toContain(testDemands.demand2.id);
      expect(response.body.map((d: any) => d.id)).not.toContain(testDemands.demand1.id);
      expect(response.body.map((d: any) => d.id)).not.toContain(testDemands.demand3.id);
    });

    it('resident should only see their own demands', async () => {
      // Setup route with resident 1 auth
      app.use('/api', mockAuth(testUsers.resident1));
      registerDemandRoutes(app);

      const response = await request(app)
        .get('/api/demands')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.map((d: any) => d.id)).toContain(testDemands.demand1.id);
      expect(response.body.map((d: any) => d.id)).toContain(testDemands.demand3.id);
      expect(response.body.map((d: any) => d.id)).not.toContain(testDemands.demand2.id);
    });

    it('manager without organization should see no demands', async () => {
      // Create manager without organization assignment
      const managerNoOrg = await db.insert(users).values({
        id: 'manager-no-org',
        email: 'manager-no-org@example.com',
        firstName: 'Manager',
        lastName: 'NoOrg',
        role: 'manager',
        isActive: true,
      }).returning();

      app.use('/api', mockAuth(managerNoOrg[0]));
      registerDemandRoutes(app);

      const response = await request(app)
        .get('/api/demands')
        .expect(200);

      expect(response.body).toHaveLength(0);

      // Cleanup
      await db.delete(users).where(eq(users.id, managerNoOrg[0].id));
    });
  });

  describe('GET /api/demands/:id - Individual Access Control', () => {
    it('admin should access any demand', async () => {
      app.use('/api', mockAuth(testUsers.admin));
      registerDemandRoutes(app);

      const response = await request(app)
        .get(`/api/demands/${testDemands.demand2.id}`)
        .expect(200);

      expect(response.body.id).toBe(testDemands.demand2.id);
    });

    it('manager should access demands from their organization', async () => {
      app.use('/api', mockAuth(testUsers.managerKoveo));
      registerDemandRoutes(app);

      const response = await request(app)
        .get(`/api/demands/${testDemands.demand1.id}`)
        .expect(200);

      expect(response.body.id).toBe(testDemands.demand1.id);
    });

    it('manager should not access demands from other organizations', async () => {
      app.use('/api', mockAuth(testUsers.managerKoveo));
      registerDemandRoutes(app);

      await request(app)
        .get(`/api/demands/${testDemands.demand2.id}`)
        .expect(403);
    });

    it('resident should access their own demands', async () => {
      app.use('/api', mockAuth(testUsers.resident1));
      registerDemandRoutes(app);

      const response = await request(app)
        .get(`/api/demands/${testDemands.demand1.id}`)
        .expect(200);

      expect(response.body.id).toBe(testDemands.demand1.id);
    });

    it('resident should not access other residents demands', async () => {
      app.use('/api', mockAuth(testUsers.resident1));
      registerDemandRoutes(app);

      await request(app)
        .get(`/api/demands/${testDemands.demand2.id}`)
        .expect(403);
    });
  });

  describe('PUT /api/demands/:id - Update Access Control', () => {
    it('admin should update any demand with any field', async () => {
      app.use('/api', mockAuth(testUsers.admin));
      registerDemandRoutes(app);

      const updateData = {
        status: 'approved',
        reviewNotes: 'Approved by admin',
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/demands/${testDemands.demand1.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.status).toBe('approved');
      expect(response.body.reviewNotes).toBe('Approved by admin');
      expect(response.body.reviewedBy).toBe(testUsers.admin.id);
    });

    it('manager should update status and review fields for their organization demands', async () => {
      app.use('/api', mockAuth(testUsers.managerKoveo));
      registerDemandRoutes(app);

      const updateData = {
        status: 'in_progress',
        reviewNotes: 'Under review by manager',
        description: 'This should be ignored'
      };

      const response = await request(app)
        .put(`/api/demands/${testDemands.demand1.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.status).toBe('in_progress');
      expect(response.body.reviewNotes).toBe('Under review by manager');
      expect(response.body.reviewedBy).toBe(testUsers.managerKoveo.id);
      // Description should not change as it's not in allowed fields for managers
      expect(response.body.description).toBe(testDemands.demand1.description);
    });

    it('manager should not update demands from other organizations', async () => {
      app.use('/api', mockAuth(testUsers.managerKoveo));
      registerDemandRoutes(app);

      const updateData = {
        status: 'approved',
        reviewNotes: 'Should not work'
      };

      await request(app)
        .put(`/api/demands/${testDemands.demand2.id}`)
        .send(updateData)
        .expect(403);
    });

    it('resident should update only description and type of their own demands', async () => {
      app.use('/api', mockAuth(testUsers.resident1));
      registerDemandRoutes(app);

      const updateData = {
        description: 'Updated description by resident',
        type: 'complaint',
        status: 'approved' // This should be ignored
      };

      const response = await request(app)
        .put(`/api/demands/${testDemands.demand1.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.description).toBe('Updated description by resident');
      expect(response.body.type).toBe('complaint');
      // Status should not change as it's not in allowed fields for residents
      expect(response.body.status).toBe(testDemands.demand1.status);
    });

    it('resident should not update other residents demands', async () => {
      app.use('/api', mockAuth(testUsers.resident1));
      registerDemandRoutes(app);

      const updateData = {
        description: 'Should not work'
      };

      await request(app)
        .put(`/api/demands/${testDemands.demand2.id}`)
        .send(updateData)
        .expect(403);
    });
  });

  describe('Role-based filtering edge cases', () => {
    it('should handle manager with no buildings correctly', async () => {
      // Create organization with no buildings
      const emptyOrg = await db.insert(organizations).values({
        id: 'empty-org',
        name: 'Empty Organization',
        domain: 'empty.com',
        isActive: true,
      }).returning();

      const emptyManager = await db.insert(users).values({
        id: 'empty-manager',
        email: 'manager@empty.com',
        firstName: 'Empty',
        lastName: 'Manager',
        role: 'manager',
        isActive: true,
      }).returning();

      await db.insert(userOrganizations).values({
        userId: emptyManager[0].id,
        organizationId: emptyOrg[0].id,
        role: 'manager'
      });

      app.use('/api', mockAuth(emptyManager[0]));
      registerDemandRoutes(app);

      const response = await request(app)
        .get('/api/demands')
        .expect(200);

      expect(response.body).toHaveLength(0);

      // Cleanup
      await db.delete(userOrganizations).where(eq(userOrganizations.userId, emptyManager[0].id));
      await db.delete(users).where(eq(users.id, emptyManager[0].id));
      await db.delete(organizations).where(eq(organizations.id, emptyOrg[0].id));
    });

    it('should validate that demands are properly filtered by building organization', async () => {
      app.use('/api', mockAuth(testUsers.managerKoveo));
      registerDemandRoutes(app);

      const response = await request(app)
        .get('/api/demands')
        .expect(200);

      // Ensure all returned demands belong to Koveo organization buildings
      for (const demand of response.body) {
        expect([testBuildings.koveo1.id, testBuildings.koveo2.id]).toContain(demand.buildingId);
      }
    });
  });
});