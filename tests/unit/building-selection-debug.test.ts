import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { registerRoutes } from '../../server/routes';
import { db } from '../../server/db';
import { users, organizations, userOrganizations, buildings, residences, userResidences } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

// Create test server
const createTestApp = () => {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  registerRoutes(app);
  return app;
};

describe('Building Selection Debug Tests', () => {
  let app: any;
  let testUserId: string;
  let koveoOrgId: string;
  let testOrgId: string;
  let testBuildingId: string;
  let testBuildingId2: string;
  let sessionCookie: string;

  beforeEach(async () => {
    app = createTestApp();

    // Clean up existing test data
    await db.delete(userOrganizations).where(eq(userOrganizations.userId, testUserId));
    await db.delete(userResidences);
    await db.delete(residences);
    await db.delete(buildings);
    await db.delete(organizations);
    await db.delete(users);

    // Create Koveo organization (special global access)
    const koveoOrg = await db.insert(organizations).values({
      name: 'Koveo',
      type: 'property_management',
      isActive: true,
    }).returning();
    koveoOrgId = koveoOrg[0].id;

    // Create test organization
    const testOrg = await db.insert(organizations).values({
      name: 'Test Property Management',
      type: 'property_management',
      isActive: true,
    }).returning();
    testOrgId = testOrg[0].id;

    // Create test admin user
    const testUser = await db.insert(users).values({
      email: 'admin@test.com',
      passwordHash: 'test-hash',
      role: 'admin',
      isActive: true,
    }).returning();
    testUserId = testUser[0].id;

    // Create test buildings in different organizations
    const testBuilding1 = await db.insert(buildings).values({
      name: 'Test Building 1',
      address: '123 Test St',
      city: 'Test City',
      province: 'QC',
      postalCode: 'H1H 1H1',
      organizationId: koveoOrgId,
      totalUnits: 10,
      totalFloors: 3,
      isActive: true,
    }).returning();
    testBuildingId = testBuilding1[0].id;

    const testBuilding2 = await db.insert(buildings).values({
      name: 'Test Building 2',
      address: '456 Test Ave',
      city: 'Test City',
      province: 'QC',
      postalCode: 'H2H 2H2',
      organizationId: testOrgId,
      totalUnits: 20,
      totalFloors: 5,
      isActive: true,
    }).returning();
    testBuildingId2 = testBuilding2[0].id;

    // Login to get session cookie
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'test-password' // This will be compared against 'test-hash'
      });

    if (loginResponse.headers['set-cookie']) {
      sessionCookie = loginResponse.headers['set-cookie'][0];
    }
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(userOrganizations).where(eq(userOrganizations.userId, testUserId));
    await db.delete(userResidences);
    await db.delete(residences);
    await db.delete(buildings);
    await db.delete(organizations);
    await db.delete(users);
  });

  describe('Buildings API Access Control', () => {
    it('should return empty array when admin has no organization relationships', async () => {
      // Test current state - admin with no organization relationships
      const response = await request(app)
        .get('/api/buildings')
        .set('Cookie', sessionCookie);

      console.log('🔍 [TEST] Response status:', response.status);
      console.log('🔍 [TEST] Response body:', response.body);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      // This should return empty array due to missing organization relationship
      expect(response.body).toHaveLength(0);
    });

    it('should return buildings when admin has Koveo organization relationship', async () => {
      // Add user to Koveo organization with global access
      await db.insert(userOrganizations).values({
        userId: testUserId,
        organizationId: koveoOrgId,
        canAccessAllOrganizations: true,
        isActive: true,
      });

      const response = await request(app)
        .get('/api/buildings')
        .set('Cookie', sessionCookie);

      console.log('🔍 [TEST] With Koveo org - Response status:', response.status);
      console.log('🔍 [TEST] With Koveo org - Response body:', response.body);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      // Should now return all buildings since user has global access
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should return organization buildings when admin has organization relationship', async () => {
      // Add user to test organization (no global access)
      await db.insert(userOrganizations).values({
        userId: testUserId,
        organizationId: testOrgId,
        canAccessAllOrganizations: false,
        isActive: true,
      });

      const response = await request(app)
        .get('/api/buildings')
        .set('Cookie', sessionCookie);

      console.log('🔍 [TEST] With test org - Response status:', response.status);
      console.log('🔍 [TEST] With test org - Response body:', response.body);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      // Should return only buildings from test organization
      expect(response.body).toHaveLength(1);
      expect(response.body[0].organizationId).toBe(testOrgId);
    });

    it('should show user organizations and access in debug info', async () => {
      // Check what organizations the user actually has
      const userOrgs = await db
        .select({
          organizationId: userOrganizations.organizationId,
          organizationName: organizations.name,
          canAccessAllOrganizations: userOrganizations.canAccessAllOrganizations,
          isActive: userOrganizations.isActive,
        })
        .from(userOrganizations)
        .innerJoin(organizations, eq(userOrganizations.organizationId, organizations.id))
        .where(eq(userOrganizations.userId, testUserId));

      console.log('🔍 [TEST] User organizations in DB:', userOrgs);

      // Check what the user object looks like from the database
      const userFromDb = await db
        .select()
        .from(users)
        .where(eq(users.id, testUserId));

      console.log('🔍 [TEST] User from DB:', userFromDb[0]);

      expect(userOrgs).toHaveLength(0); // Initially no organizations
    });
  });

  describe('User Organization Relationship Issues', () => {
    it('should identify why admin user has empty organizations array', async () => {
      // Check if the auth middleware is properly loading user organizations
      const response = await request(app)
        .get('/api/debug/user-info')
        .set('Cookie', sessionCookie);

      console.log('🔍 [TEST] User info response:', response.body);
      
      // This endpoint should show us what the auth middleware sees
      expect(response.status).toBe(200);
    });

    it('should verify database has buildings available', async () => {
      // Direct database query to verify buildings exist
      const allBuildings = await db
        .select({
          id: buildings.id,
          name: buildings.name,
          organizationId: buildings.organizationId,
          organizationName: organizations.name,
          isActive: buildings.isActive,
        })
        .from(buildings)
        .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
        .where(eq(buildings.isActive, true));

      console.log('🔍 [TEST] All buildings in DB:', allBuildings);
      
      expect(allBuildings.length).toBeGreaterThan(0);
      expect(allBuildings.some(b => b.organizationName === 'Koveo')).toBe(true);
    });

    it('should test manager buildings endpoint for comparison', async () => {
      const response = await request(app)
        .get('/api/manager/buildings')
        .set('Cookie', sessionCookie);

      console.log('🔍 [TEST] Manager buildings response:', response.status, response.body);
      
      expect(response.status).toBe(200);
      // This endpoint has different logic, let's see what it returns
    });
  });

  describe('Fix Verification', () => {
    it('should work after creating proper user organization relationship', async () => {
      // Create the missing relationship that should exist for Kevin's admin user
      await db.insert(userOrganizations).values({
        userId: testUserId,
        organizationId: koveoOrgId,
        canAccessAllOrganizations: true,
        isActive: true,
      });

      // Test both endpoints
      const buildingsResponse = await request(app)
        .get('/api/buildings')
        .set('Cookie', sessionCookie);

      const managerBuildingsResponse = await request(app)
        .get('/api/manager/buildings')
        .set('Cookie', sessionCookie);

      console.log('🔍 [TEST] After fix - Buildings response:', buildingsResponse.body);
      console.log('🔍 [TEST] After fix - Manager buildings response:', managerBuildingsResponse.body);

      expect(buildingsResponse.status).toBe(200);
      expect(buildingsResponse.body.length).toBeGreaterThan(0);
      
      expect(managerBuildingsResponse.status).toBe(200);
      expect(managerBuildingsResponse.body.length).toBeGreaterThan(0);
    });
  });
});