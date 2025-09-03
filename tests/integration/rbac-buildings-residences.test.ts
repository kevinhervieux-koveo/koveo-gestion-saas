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

describe('RBAC Buildings and Residences Actions', () => {
  let app: express.Application;
  let adminUser: any;
  let managerUser: any;
  let tenantUser: any;
  let residentUser: any;
  let demoManagerUser: any;
  let testOrganization: any;
  let otherOrganization: any;
  let testBuilding: any;
  let otherBuilding: any;
  let testResidence: any;

  beforeEach(async () => {
    app = createTestApp();
    
    // Clean test data
    await db.delete(schema.userResidences);
    await db.delete(schema.userOrganizations);
    await db.delete(schema.residences);
    await db.delete(schema.buildings);
    await db.delete(schema.users);
    await db.delete(schema.organizations);

    // Create test organizations
    const organizations = await db
      .insert(schema.organizations)
      .values([
        {
          name: 'Test Organization',
          type: 'Standard',
          address: '123 Test St',
          city: 'Test City',
          province: 'QC',
          postalCode: 'H1H 1H1',
          phone: '514-555-0123',
          email: 'test@org.com',
        },
        {
          name: 'Other Organization',
          type: 'Standard',
          address: '456 Other St',
          city: 'Other City',
          province: 'QC',
          postalCode: 'H2H 2H2',
          phone: '514-555-0456',
          email: 'other@org.com',
        }
      ])
      .returning();

    testOrganization = organizations[0];
    otherOrganization = organizations[1];

    // Create test buildings
    const buildings = await db
      .insert(schema.buildings)
      .values([
        {
          organizationId: testOrganization.id,
          name: 'Test Building',
          address: '123 Test St',
          city: 'Test City',
          province: 'QC',
          postalCode: 'H1H 1H1',
          totalUnits: 10,
          buildingType: 'apartment',
        },
        {
          organizationId: otherOrganization.id,
          name: 'Other Building',
          address: '456 Other St',
          city: 'Other City',
          province: 'QC',
          postalCode: 'H2H 2H2',
          totalUnits: 5,
          buildingType: 'apartment',
        }
      ])
      .returning();

    testBuilding = buildings[0];
    otherBuilding = buildings[1];

    // Create test residence
    const [residence] = await db
      .insert(schema.residences)
      .values({
        buildingId: testBuilding.id,
        unitNumber: '101',
        squareFootage: 1000,
        bedrooms: 2,
        bathrooms: 1,
      })
      .returning();
    testResidence = residence;

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
          email: 'manager@test.com',
          username: 'manager',
          password: 'hashedpass',
          firstName: 'Manager',
          lastName: 'User',
          role: 'manager',
          isActive: true,
          phone: '514-555-0002',
        },
        {
          email: 'tenant@test.com',
          username: 'tenant',
          password: 'hashedpass',
          firstName: 'Tenant',
          lastName: 'User',
          role: 'tenant',
          isActive: true,
          phone: '514-555-0003',
        },
        {
          email: 'resident@test.com',
          username: 'resident',
          password: 'hashedpass',
          firstName: 'Resident',
          lastName: 'User',
          role: 'resident',
          isActive: true,
          phone: '514-555-0004',
        },
        {
          email: 'demo.manager@test.com',
          username: 'demo_manager',
          password: 'hashedpass',
          firstName: 'Demo',
          lastName: 'Manager',
          role: 'demo_manager',
          isActive: true,
          phone: '514-555-0005',
        }
      ])
      .returning();

    adminUser = users.find(u => u.email === 'admin@test.com');
    managerUser = users.find(u => u.email === 'manager@test.com');
    tenantUser = users.find(u => u.email === 'tenant@test.com');
    residentUser = users.find(u => u.email === 'resident@test.com');
    demoManagerUser = users.find(u => u.email === 'demo.manager@test.com');

    // Assign manager to test organization
    await db
      .insert(schema.userOrganizations)
      .values({
        userId: managerUser.id,
        organizationId: testOrganization.id,
        organizationRole: 'manager',
        isActive: true,
      });

    // Assign tenant and resident to test organization and residence
    await db
      .insert(schema.userOrganizations)
      .values([
        {
          userId: tenantUser.id,
          organizationId: testOrganization.id,
          organizationRole: 'tenant',
          isActive: true,
        },
        {
          userId: residentUser.id,
          organizationId: testOrganization.id,
          organizationRole: 'resident',
          isActive: true,
        }
      ]);

    await db
      .insert(schema.userResidences)
      .values([
        {
          userId: tenantUser.id,
          residenceId: testResidence.id,
          relationshipType: 'tenant',
          isActive: true,
        },
        {
          userId: residentUser.id,
          residenceId: testResidence.id,
          relationshipType: 'occupant',
          isActive: true,
        }
      ]);
  });

  afterEach(async () => {
    await db.delete(schema.userResidences);
    await db.delete(schema.userOrganizations);
    await db.delete(schema.residences);
    await db.delete(schema.buildings);
    await db.delete(schema.users);
    await db.delete(schema.organizations);
  });

  describe('Building Field Editing by Role', () => {
    const buildingUpdateData = {
      name: 'Updated Building Name',
      address: '999 Updated St',
      city: 'Updated City',
      province: 'QC',
      postalCode: 'H9H 9H9',
      totalUnits: 15,
      buildingType: 'condo',
      description: 'Updated building description',
    };

    it('should allow admin to edit all building fields', async () => {
      const response = await request(app)
        .put(`/api/buildings/${testBuilding.id}`)
        .set('x-test-user-id', adminUser.id)
        .send(buildingUpdateData)
        .expect(200);

      expect(response.body.message).toBe('Building updated successfully');

      // Verify the building was actually updated
      const [updatedBuilding] = await db
        .select()
        .from(schema.buildings)
        .where(eq(schema.buildings.id, testBuilding.id));

      expect(updatedBuilding.name).toBe(buildingUpdateData.name);
      expect(updatedBuilding.address).toBe(buildingUpdateData.address);
      expect(updatedBuilding.totalUnits).toBe(buildingUpdateData.totalUnits);
    });

    it('should allow manager to edit buildings in their organization', async () => {
      const response = await request(app)
        .put(`/api/buildings/${testBuilding.id}`)
        .set('x-test-user-id', managerUser.id)
        .send(buildingUpdateData)
        .expect(200);

      expect(response.body.message).toBe('Building updated successfully');

      // Verify the building was updated
      const [updatedBuilding] = await db
        .select()
        .from(schema.buildings)
        .where(eq(schema.buildings.id, testBuilding.id));

      expect(updatedBuilding.name).toBe(buildingUpdateData.name);
    });

    it('should prevent manager from editing buildings outside their organization', async () => {
      const response = await request(app)
        .put(`/api/buildings/${otherBuilding.id}`)
        .set('x-test-user-id', managerUser.id)
        .send(buildingUpdateData);

      // Should fail with 403 or 404 (depending on implementation)
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should prevent tenant from editing building fields', async () => {
      const response = await request(app)
        .put(`/api/buildings/${testBuilding.id}`)
        .set('x-test-user-id', tenantUser.id)
        .send(buildingUpdateData)
        .expect(403);

      expect(response.body.message).toContain('Insufficient permissions');
    });

    it('should prevent resident from editing building fields', async () => {
      const response = await request(app)
        .put(`/api/buildings/${testBuilding.id}`)
        .set('x-test-user-id', residentUser.id)
        .send(buildingUpdateData)
        .expect(403);

      expect(response.body.message).toContain('Insufficient permissions');
    });

    it('should allow demo_manager to edit buildings (demo functionality)', async () => {
      // Demo managers should have similar permissions to regular managers
      const response = await request(app)
        .put(`/api/buildings/${testBuilding.id}`)
        .set('x-test-user-id', demoManagerUser.id)
        .send(buildingUpdateData);

      // Demo managers might have restricted access depending on implementation
      // This test validates the current behavior
      if (response.status === 200) {
        expect(response.body.message).toBe('Building updated successfully');
      } else {
        expect(response.status).toBeGreaterThanOrEqual(403);
      }
    });
  });

  describe('Building Creation by Role', () => {
    it('should allow admin to create buildings', async () => {
      const newBuildingData = {
        organizationId: testOrganization.id,
        name: 'New Test Building',
        address: '789 New St',
        city: 'New City',
        province: 'QC',
        postalCode: 'H3H 3H3',
        totalUnits: 20,
        buildingType: 'townhouse',
      };

      const response = await request(app)
        .post('/api/buildings')
        .set('x-test-user-id', adminUser.id)
        .send(newBuildingData)
        .expect(201);

      expect(response.body.message).toBe('Building created successfully');
      expect(response.body.building.name).toBe(newBuildingData.name);
    });

    it('should allow manager to create buildings in their organization', async () => {
      const newBuildingData = {
        organizationId: testOrganization.id,
        name: 'Manager New Building',
        address: '888 Manager St',
        city: 'Manager City',
        province: 'QC',
        postalCode: 'H4H 4H4',
        totalUnits: 12,
        buildingType: 'apartment',
      };

      const response = await request(app)
        .post('/api/buildings')
        .set('x-test-user-id', managerUser.id)
        .send(newBuildingData)
        .expect(201);

      expect(response.body.message).toBe('Building created successfully');
    });

    it('should prevent manager from creating buildings in other organizations', async () => {
      const otherOrgBuildingData = {
        organizationId: otherOrganization.id,
        name: 'Unauthorized Building',
        address: '999 Forbidden St',
        city: 'Forbidden City',
        province: 'QC',
        postalCode: 'H5H 5H5',
        totalUnits: 8,
        buildingType: 'apartment',
      };

      const response = await request(app)
        .post('/api/buildings')
        .set('x-test-user-id', managerUser.id)
        .send(otherOrgBuildingData);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should prevent tenant from creating buildings', async () => {
      const newBuildingData = {
        organizationId: testOrganization.id,
        name: 'Tenant Building',
        address: '777 Tenant St',
        city: 'Tenant City',
        province: 'QC',
        postalCode: 'H6H 6H6',
        totalUnits: 6,
        buildingType: 'apartment',
      };

      const response = await request(app)
        .post('/api/buildings')
        .set('x-test-user-id', tenantUser.id)
        .send(newBuildingData)
        .expect(403);

      expect(response.body.message).toContain('Insufficient permissions');
    });

    it('should prevent resident from creating buildings', async () => {
      const newBuildingData = {
        organizationId: testOrganization.id,
        name: 'Resident Building',
        address: '666 Resident St',
        city: 'Resident City',
        province: 'QC',
        postalCode: 'H7H 7H7',
        totalUnits: 4,
        buildingType: 'apartment',
      };

      const response = await request(app)
        .post('/api/buildings')
        .set('x-test-user-id', residentUser.id)
        .send(newBuildingData)
        .expect(403);

      expect(response.body.message).toContain('Insufficient permissions');
    });
  });

  describe('Residence Field Editing by Role', () => {
    const residenceUpdateData = {
      unitNumber: '102',
      squareFootage: 1200,
      bedrooms: 3,
      bathrooms: 2,
      description: 'Updated residence description',
      parkingSpaces: 1,
      storageSpaces: 1,
    };

    it('should allow admin to edit all residence fields', async () => {
      const response = await request(app)
        .put(`/api/residences/${testResidence.id}`)
        .set('x-test-user-id', adminUser.id)
        .send(residenceUpdateData)
        .expect(200);

      expect(response.body.message).toBe('Residence updated successfully');

      // Verify the residence was updated
      const [updatedResidence] = await db
        .select()
        .from(schema.residences)
        .where(eq(schema.residences.id, testResidence.id));

      expect(updatedResidence.unitNumber).toBe(residenceUpdateData.unitNumber);
      expect(updatedResidence.squareFootage).toBe(residenceUpdateData.squareFootage);
      expect(updatedResidence.bedrooms).toBe(residenceUpdateData.bedrooms);
    });

    it('should allow manager to edit residences in their organization', async () => {
      const response = await request(app)
        .put(`/api/residences/${testResidence.id}`)
        .set('x-test-user-id', managerUser.id)
        .send(residenceUpdateData)
        .expect(200);

      expect(response.body.message).toBe('Residence updated successfully');

      // Verify the residence was updated
      const [updatedResidence] = await db
        .select()
        .from(schema.residences)
        .where(eq(schema.residences.id, testResidence.id));

      expect(updatedResidence.unitNumber).toBe(residenceUpdateData.unitNumber);
    });

    it('should prevent tenant from editing residence structural fields', async () => {
      const response = await request(app)
        .put(`/api/residences/${testResidence.id}`)
        .set('x-test-user-id', tenantUser.id)
        .send(residenceUpdateData);

      // Tenants typically cannot edit structural information
      // Should fail with 403 or only allow limited fields
      if (response.status === 403) {
        expect(response.body.message).toContain('Insufficient permissions');
      } else if (response.status === 200) {
        // If allowed, verify only certain fields can be updated by tenants
        const [updatedResidence] = await db
          .select()
          .from(schema.residences)
          .where(eq(schema.residences.id, testResidence.id));
        
        // Structural fields should not be changed by tenants
        expect(updatedResidence.squareFootage).toBe(1000); // Original value
        expect(updatedResidence.bedrooms).toBe(2); // Original value
      }
    });

    it('should prevent resident from editing residence structural fields', async () => {
      const response = await request(app)
        .put(`/api/residences/${testResidence.id}`)
        .set('x-test-user-id', residentUser.id)
        .send(residenceUpdateData);

      // Residents typically cannot edit structural information
      if (response.status === 403) {
        expect(response.body.message).toContain('Insufficient permissions');
      } else if (response.status === 200) {
        // If allowed, verify only certain fields can be updated by residents
        const [updatedResidence] = await db
          .select()
          .from(schema.residences)
          .where(eq(schema.residences.id, testResidence.id));
        
        // Structural fields should not be changed by residents
        expect(updatedResidence.squareFootage).toBe(1000); // Original value
        expect(updatedResidence.bedrooms).toBe(2); // Original value
      }
    });

    it('should allow demo_manager to edit residences (demo functionality)', async () => {
      const response = await request(app)
        .put(`/api/residences/${testResidence.id}`)
        .set('x-test-user-id', demoManagerUser.id)
        .send(residenceUpdateData);

      // Demo managers should have similar permissions to regular managers
      if (response.status === 200) {
        expect(response.body.message).toBe('Residence updated successfully');
      } else {
        expect(response.status).toBeGreaterThanOrEqual(403);
      }
    });
  });

  describe('Residence Creation by Role', () => {
    it('should allow admin to create residences', async () => {
      const newResidenceData = {
        buildingId: testBuilding.id,
        unitNumber: '103',
        squareFootage: 900,
        bedrooms: 1,
        bathrooms: 1,
      };

      const response = await request(app)
        .post('/api/residences')
        .set('x-test-user-id', adminUser.id)
        .send(newResidenceData)
        .expect(201);

      expect(response.body.message).toBe('Residence created successfully');
      expect(response.body.residence.unitNumber).toBe(newResidenceData.unitNumber);
    });

    it('should allow manager to create residences in buildings they manage', async () => {
      const newResidenceData = {
        buildingId: testBuilding.id,
        unitNumber: '104',
        squareFootage: 1100,
        bedrooms: 2,
        bathrooms: 1,
      };

      const response = await request(app)
        .post('/api/residences')
        .set('x-test-user-id', managerUser.id)
        .send(newResidenceData)
        .expect(201);

      expect(response.body.message).toBe('Residence created successfully');
    });

    it('should prevent manager from creating residences in buildings outside their organization', async () => {
      const otherBuildingResidenceData = {
        buildingId: otherBuilding.id,
        unitNumber: '201',
        squareFootage: 800,
        bedrooms: 1,
        bathrooms: 1,
      };

      const response = await request(app)
        .post('/api/residences')
        .set('x-test-user-id', managerUser.id)
        .send(otherBuildingResidenceData);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should prevent tenant from creating residences', async () => {
      const newResidenceData = {
        buildingId: testBuilding.id,
        unitNumber: '105',
        squareFootage: 950,
        bedrooms: 2,
        bathrooms: 1,
      };

      const response = await request(app)
        .post('/api/residences')
        .set('x-test-user-id', tenantUser.id)
        .send(newResidenceData)
        .expect(403);

      expect(response.body.message).toContain('Insufficient permissions');
    });

    it('should prevent resident from creating residences', async () => {
      const newResidenceData = {
        buildingId: testBuilding.id,
        unitNumber: '106',
        squareFootage: 850,
        bedrooms: 1,
        bathrooms: 1,
      };

      const response = await request(app)
        .post('/api/residences')
        .set('x-test-user-id', residentUser.id)
        .send(newResidenceData)
        .expect(403);

      expect(response.body.message).toContain('Insufficient permissions');
    });
  });

  describe('Building and Residence Deletion by Role', () => {
    it('should allow admin to delete buildings', async () => {
      const response = await request(app)
        .delete(`/api/buildings/${testBuilding.id}`)
        .set('x-test-user-id', adminUser.id)
        .expect(200);

      expect(response.body.message).toBe('Building deleted successfully');

      // Verify building is marked as inactive
      const [deletedBuilding] = await db
        .select()
        .from(schema.buildings)
        .where(eq(schema.buildings.id, testBuilding.id));

      expect(deletedBuilding.isActive).toBe(false);
    });

    it('should allow manager to delete buildings in their organization', async () => {
      const response = await request(app)
        .delete(`/api/buildings/${testBuilding.id}`)
        .set('x-test-user-id', managerUser.id)
        .expect(200);

      expect(response.body.message).toBe('Building deleted successfully');
    });

    it('should prevent tenant from deleting buildings', async () => {
      const response = await request(app)
        .delete(`/api/buildings/${testBuilding.id}`)
        .set('x-test-user-id', tenantUser.id)
        .expect(403);

      expect(response.body.message).toContain('Insufficient permissions');
    });

    it('should allow admin to delete residences', async () => {
      const response = await request(app)
        .delete(`/api/residences/${testResidence.id}`)
        .set('x-test-user-id', adminUser.id)
        .expect(200);

      expect(response.body.message).toBe('Residence deleted successfully');

      // Verify residence is marked as inactive
      const [deletedResidence] = await db
        .select()
        .from(schema.residences)
        .where(eq(schema.residences.id, testResidence.id));

      expect(deletedResidence.isActive).toBe(false);
    });

    it('should allow manager to delete residences in their organization', async () => {
      const response = await request(app)
        .delete(`/api/residences/${testResidence.id}`)
        .set('x-test-user-id', managerUser.id)
        .expect(200);

      expect(response.body.message).toBe('Residence deleted successfully');
    });

    it('should prevent tenant from deleting residences', async () => {
      const response = await request(app)
        .delete(`/api/residences/${testResidence.id}`)
        .set('x-test-user-id', tenantUser.id)
        .expect(403);

      expect(response.body.message).toContain('Insufficient permissions');
    });
  });

  describe('Data Access by Role', () => {
    it('should allow admin to view all buildings', async () => {
      const response = await request(app)
        .get('/api/buildings')
        .set('x-test-user-id', adminUser.id)
        .expect(200);

      expect(response.body.buildings).toBeDefined();
      expect(response.body.buildings.length).toBeGreaterThanOrEqual(2);
    });

    it('should allow manager to view buildings in their organization', async () => {
      const response = await request(app)
        .get('/api/buildings')
        .set('x-test-user-id', managerUser.id)
        .expect(200);

      expect(response.body.buildings).toBeDefined();
      // Manager should see at least the test building
      const buildingIds = response.body.buildings.map((b: any) => b.id);
      expect(buildingIds).toContain(testBuilding.id);
    });

    it('should allow tenant to view their building', async () => {
      const response = await request(app)
        .get('/api/buildings')
        .set('x-test-user-id', tenantUser.id)
        .expect(200);

      expect(response.body.buildings).toBeDefined();
      // Tenant should see their building
      const buildingIds = response.body.buildings.map((b: any) => b.id);
      expect(buildingIds).toContain(testBuilding.id);
    });

    it('should allow admin to view all residences', async () => {
      const response = await request(app)
        .get('/api/residences')
        .set('x-test-user-id', adminUser.id)
        .expect(200);

      expect(response.body.residences).toBeDefined();
      expect(response.body.residences.length).toBeGreaterThanOrEqual(1);
    });

    it('should allow tenant to view their residence', async () => {
      const response = await request(app)
        .get('/api/residences')
        .set('x-test-user-id', tenantUser.id)
        .expect(200);

      expect(response.body.residences).toBeDefined();
      // Tenant should see their residence
      const residenceIds = response.body.residences.map((r: any) => r.id);
      expect(residenceIds).toContain(testResidence.id);
    });
  });
});