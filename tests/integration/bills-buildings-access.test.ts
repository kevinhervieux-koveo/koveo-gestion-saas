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

describe('Bills Page Buildings Access Issue', () => {
  let app: express.Application;
  let adminUser: any;
  let managerUser: any;
  let testOrganization: any;
  let testBuilding: any;

  beforeEach(async () => {
    app = createTestApp();
    
    try {
      // Clean test data
      await db.delete(schema.userOrganizations);
      await db.delete(schema.buildings);
      await db.delete(schema.users);
      await db.delete(schema.organizations);
    } catch (error) {
      console.warn('Test setup warning:', error);
    }

    // Create test organization
    const [organization] = await db
      .insert(schema.organizations)
      .values({
        name: 'Test Organization',
        type: 'Standard',
        address: '123 Test St',
        city: 'Test City',
        province: 'QC',
        postalCode: 'H1H 1H1',
        phone: '514-555-0123',
        email: 'test@org.com',
      })
      .returning();

    testOrganization = organization;

    // Create test building
    const [building] = await db
      .insert(schema.buildings)
      .values({
        organizationId: testOrganization.id,
        name: 'Test Building',
        address: '123 Test St',
        city: 'Test City',
        province: 'QC',
        postalCode: 'H1H 1H1',
        totalUnits: 10,
        buildingType: 'apartment',
      })
      .returning();

    testBuilding = building;

    // Create test users
    const users = await db
      .insert(schema.users)
      .values([
        {
          email: 'admin@koveo-gestion.com',
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
        }
      ])
      .returning();

    adminUser = users.find(u => u.email === 'admin@koveo-gestion.com');
    managerUser = users.find(u => u.email === 'manager@test.com');

    // Assign manager to organization (but NOT admin - this is the bug scenario)
    await db
      .insert(schema.userOrganizations)
      .values({
        userId: managerUser.id,
        organizationId: testOrganization.id,
        organizationRole: 'manager',
        isActive: true,
      });
  });

  afterEach(async () => {
    await db.delete(schema.userOrganizations);
    await db.delete(schema.buildings);
    await db.delete(schema.users);
    await db.delete(schema.organizations);
  });

  describe('Bills Page Buildings API Bug Scenario', () => {
    it('REGRESSION TEST: admin without organization assignments should see all buildings', async () => {
      // This test reproduces the exact bug reported by the user:
      // Admin user Kevin Hervieux has no organization assignments but should see all buildings
      // in the bills page dropdown
      
      // Verify admin has no organization assignments (reproduces bug condition)
      const adminOrgs = await db
        .select()
        .from(schema.userOrganizations)
        .where(eq(schema.userOrganizations.userId, adminUser.id));
      expect(adminOrgs.length).toBe(0);

      // This should return buildings even though admin has no org assignments
      const response = await request(app)
        .get('/api/buildings')
        .set('x-test-user-id', adminUser.id)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].name).toBe('Test Building');
      expect(response.body[0].organizationName).toBe('Test Organization');
    });

    it('manager with organization assignments should see only their buildings', async () => {
      const response = await request(app)
        .get('/api/buildings')
        .set('x-test-user-id', managerUser.id)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].name).toBe('Test Building');
      expect(response.body[0].organizationName).toBe('Test Organization');
    });

    it('manager without organization assignments should see no buildings', async () => {
      // Remove manager's organization assignment
      await db.delete(schema.userOrganizations)
        .where(eq(schema.userOrganizations.userId, managerUser.id));

      const response = await request(app)
        .get('/api/buildings')
        .set('x-test-user-id', managerUser.id)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });
  });

  describe('Bills Page Building Selection Component Data', () => {
    it('should return properly formatted building data for BuildingSelectionGrid component', async () => {
      const response = await request(app)
        .get('/api/buildings')
        .set('x-test-user-id', adminUser.id)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      
      const building = response.body[0];
      
      // Verify all required fields for BuildingSelectionGrid component are present
      expect(building).toHaveProperty('id');
      expect(building).toHaveProperty('name');
      expect(building).toHaveProperty('address');
      expect(building).toHaveProperty('city');
      expect(building).toHaveProperty('buildingType');
      expect(building).toHaveProperty('organizationName');
      
      // Verify data types
      expect(typeof building.id).toBe('string');
      expect(typeof building.name).toBe('string');
      expect(typeof building.address).toBe('string');
      expect(typeof building.organizationName).toBe('string');
    });
  });
});