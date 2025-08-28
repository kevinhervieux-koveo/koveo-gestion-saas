import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../../server/index';
import { db } from '../../server/db';
import { buildings, organizations, users } from '../../shared/schema';

describe('Building Form Integration Tests', () => {
  let authCookie: string;
  let testOrganizationId: string;
  let testUserId: string;

  beforeEach(async () => {
    // Clean up test data
    await db.delete(buildings);
    await db.delete(organizations);
    await db.delete(users);

    // Create test organization
    const [organization] = await db.insert(organizations).values({
      id: 'test-org-id',
      name: 'Test Organization',
      type: 'property_management',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    testOrganizationId = organization.id;

    // Create test admin user
    const [user] = await db.insert(users).values({
      id: 'test-admin-id',
      username: 'test-admin',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'Admin',
      phone: '',
      profileImage: '',
      language: 'en',
      role: 'admin',
      isActive: true,
      canAccessAllOrganizations: true,
      passwordHash: 'test-hash',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    testUserId = user.id;

    // Create authenticated session
    const loginResponse = await request(app)
      .post('/api/login')
      .send({
        email: 'test@example.com',
        password: 'test-password'
      });

    authCookie = loginResponse.headers['set-cookie'];
  });

  describe('POST /api/admin/buildings', () => {
    it('should create a new building successfully', async () => {
      const buildingData = {
        name: 'Test Building',
        address: '123 Test Street',
        city: 'Montreal',
        province: 'Quebec',
        postalCode: 'H1A 1A1',
        buildingType: 'condo',
        totalUnits: 50,
        organizationId: testOrganizationId,
      };

      const response = await request(app)
        .post('/api/admin/buildings')
        .set('Cookie', authCookie)
        .send(buildingData)
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Test Building',
        address: '123 Test Street',
        city: 'Montreal',
        province: 'Quebec',
        postalCode: 'H1A 1A1',
        buildingType: 'condo',
        totalUnits: 50,
        organizationId: testOrganizationId,
      });

      expect(response.body.id).toBeDefined();
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();
    });

    it('should reject invalid building data', async () => {
      const invalidBuildingData = {
        name: '', // Empty name should fail
        address: '123 Test Street',
        city: 'Montreal',
        province: 'Quebec',
        postalCode: 'H1A 1A1',
        buildingType: 'invalid_type', // Invalid building type
        totalUnits: -1, // Negative units should fail
        organizationId: testOrganizationId,
      };

      const response = await request(app)
        .post('/api/admin/buildings')
        .set('Cookie', authCookie)
        .send(invalidBuildingData)
        .expect(400);

      expect(response.body.message).toContain('validation');
    });

    it('should require authentication', async () => {
      const buildingData = {
        name: 'Test Building',
        address: '123 Test Street',
        city: 'Montreal',
        province: 'Quebec',
        postalCode: 'H1A 1A1',
        buildingType: 'condo',
        totalUnits: 50,
        organizationId: testOrganizationId,
      };

      await request(app)
        .post('/api/admin/buildings')
        .send(buildingData)
        .expect(401);
    });

    it('should validate required fields', async () => {
      const incompleteData = {
        name: 'Test Building',
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/admin/buildings')
        .set('Cookie', authCookie)
        .send(incompleteData)
        .expect(400);

      expect(response.body.message).toContain('validation');
    });

    it('should enforce unit limits', async () => {
      const buildingWithTooManyUnits = {
        name: 'Large Building',
        address: '123 Test Street',
        city: 'Montreal',
        province: 'Quebec',
        postalCode: 'H1A 1A1',
        buildingType: 'condo',
        totalUnits: 500, // Above 300 limit
        organizationId: testOrganizationId,
      };

      const response = await request(app)
        .post('/api/admin/buildings')
        .set('Cookie', authCookie)
        .send(buildingWithTooManyUnits)
        .expect(400);

      expect(response.body.message).toContain('validation');
    });
  });

  describe('PUT /api/admin/buildings/:id', () => {
    let testBuildingId: string;

    beforeEach(async () => {
      // Create a test building to update
      const [building] = await db.insert(buildings).values({
        id: 'test-building-id',
        name: 'Original Building',
        address: '123 Original Street',
        city: 'Montreal',
        province: 'Quebec',
        postalCode: 'H1A 1A1',
        buildingType: 'condo',
        totalUnits: 25,
        organizationId: testOrganizationId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      testBuildingId = building.id;
    });

    it('should update building successfully', async () => {
      const updateData = {
        name: 'Updated Building',
        address: '456 Updated Street',
        city: 'Quebec City',
        province: 'Quebec',
        postalCode: 'G1A 1A1',
        buildingType: 'apartment',
        totalUnits: 75,
        organizationId: testOrganizationId,
      };

      const response = await request(app)
        .put(`/api/admin/buildings/${testBuildingId}`)
        .set('Cookie', authCookie)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testBuildingId,
        name: 'Updated Building',
        address: '456 Updated Street',
        city: 'Quebec City',
        buildingType: 'apartment',
        totalUnits: 75,
      });
    });

    it('should return 404 for non-existent building', async () => {
      const updateData = {
        name: 'Updated Building',
        address: '456 Updated Street',
        city: 'Quebec City',
        province: 'Quebec',
        postalCode: 'G1A 1A1',
        buildingType: 'apartment',
        totalUnits: 75,
        organizationId: testOrganizationId,
      };

      await request(app)
        .put('/api/admin/buildings/non-existent-id')
        .set('Cookie', authCookie)
        .send(updateData)
        .expect(404);
    });
  });

  describe('DELETE /api/admin/buildings/:id', () => {
    let testBuildingId: string;

    beforeEach(async () => {
      // Create a test building to delete
      const [building] = await db.insert(buildings).values({
        id: 'test-building-delete-id',
        name: 'Building to Delete',
        address: '789 Delete Street',
        city: 'Montreal',
        province: 'Quebec',
        postalCode: 'H1A 1A1',
        buildingType: 'condo',
        totalUnits: 10,
        organizationId: testOrganizationId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      testBuildingId = building.id;
    });

    it('should delete building successfully', async () => {
      await request(app)
        .delete(`/api/admin/buildings/${testBuildingId}`)
        .set('Cookie', authCookie)
        .expect(204);

      // Verify building is marked as inactive (soft delete)
      const deletedBuilding = await db.query.buildings.findFirst({
        where: (buildings, { eq }) => eq(buildings.id, testBuildingId)
      });

      expect(deletedBuilding?.isActive).toBe(false);
    });

    it('should return 404 for non-existent building', async () => {
      await request(app)
        .delete('/api/admin/buildings/non-existent-id')
        .set('Cookie', authCookie)
        .expect(404);
    });
  });
});