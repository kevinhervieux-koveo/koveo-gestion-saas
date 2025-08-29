import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../../server/index';
import { db } from '../../server/db';
import { buildings, organizations, users, residences } from '../../shared/schema';
import { eq } from 'drizzle-orm';

describe('Building Residence Auto-Generation Tests', () => {
  let authCookie: string;
  let testOrganizationId: string;
  let testUserId: string;

  beforeEach(async () => {
    // Clean up test data
    await db.delete(residences);
    await db.delete(buildings);
    await db.delete(organizations);
    await db.delete(users);

    // Create test organization
    const [organization] = await db
      .insert(organizations)
      .values({
        id: 'test-org-residence-gen',
        name: 'Test Organization for Residence Generation',
        type: 'property_management',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    testOrganizationId = organization.id;

    // Create test admin user
    const [user] = await db
      .insert(users)
      .values({
        id: 'test-admin-residence-gen',
        username: 'test-admin-residence',
        email: 'test-residence@example.com',
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
      })
      .returning();
    testUserId = user.id;

    // Create authenticated session
    const loginResponse = await request(app).post('/api/login').send({
      email: 'test-residence@example.com',
      password: 'test-password',
    });

    authCookie = loginResponse.headers['set-cookie'];
  });

  describe('Residence Auto-Generation', () => {
    it('should create 6 residences when building has 6 total units', async () => {
      const buildingData = {
        name: 'Test Building with 6 Units',
        address: '123 Test Street',
        city: 'Montreal',
        province: 'Quebec',
        postalCode: 'H1A 1A1',
        buildingType: 'condo',
        totalUnits: 6,
        organizationId: testOrganizationId,
      };

      // Create the building
      const response = await request(app)
        .post('/api/admin/buildings')
        .set('Cookie', authCookie)
        .send(buildingData)
        .expect(201);

      const buildingId = response.body.building.id;
      expect(buildingId).toBeDefined();

      // Wait a moment for residence generation to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify 6 residences were created
      const createdResidences = await db.query.residences.findMany({
        where: eq(residences.buildingId, buildingId),
      });

      expect(createdResidences).toHaveLength(6);

      // Verify residence properties
      createdResidences.forEach((residence, index) => {
        expect(residence.buildingId).toBe(buildingId);
        expect(residence.isActive).toBe(true);
        expect(residence.unitNumber).toBeDefined();
        expect(residence.floor).toBeGreaterThan(0);
      });

      // Verify unit numbers are properly formatted
      const unitNumbers = createdResidences.map((r) => r.unitNumber).sort();
      expect(unitNumbers).toEqual(['101', '102', '103', '104', '105', '106']);
    });

    it('should create 1 residence when building has 1 total unit', async () => {
      const buildingData = {
        name: 'Single Unit Building',
        address: '456 Single Street',
        city: 'Montreal',
        province: 'Quebec',
        postalCode: 'H1A 1A1',
        buildingType: 'condo',
        totalUnits: 1,
        organizationId: testOrganizationId,
      };

      const response = await request(app)
        .post('/api/admin/buildings')
        .set('Cookie', authCookie)
        .send(buildingData)
        .expect(201);

      const buildingId = response.body.building.id;

      // Wait for residence generation
      await new Promise((resolve) => setTimeout(resolve, 100));

      const createdResidences = await db.query.residences.findMany({
        where: eq(residences.buildingId, buildingId),
      });

      expect(createdResidences).toHaveLength(1);
      expect(createdResidences[0].unitNumber).toBe('101');
      expect(createdResidences[0].floor).toBe(1);
    });

    it('should create 50 residences when building has 50 total units', async () => {
      const buildingData = {
        name: 'Large Building with 50 Units',
        address: '789 Large Street',
        city: 'Montreal',
        province: 'Quebec',
        postalCode: 'H1A 1A1',
        buildingType: 'apartment',
        totalUnits: 50,
        totalFloors: 5,
        organizationId: testOrganizationId,
      };

      const response = await request(app)
        .post('/api/admin/buildings')
        .set('Cookie', authCookie)
        .send(buildingData)
        .expect(201);

      const buildingId = response.body.building.id;

      // Wait for residence generation
      await new Promise((resolve) => setTimeout(resolve, 200));

      const createdResidences = await db.query.residences.findMany({
        where: eq(residences.buildingId, buildingId),
      });

      expect(createdResidences).toHaveLength(50);

      // Verify floors are distributed (should have residences on floors 1-5)
      const floors = [...new Set(createdResidences.map((r) => r.floor))].sort();
      expect(floors).toEqual([1, 2, 3, 4, 5]);

      // Verify unit numbering follows pattern (floor + unit on floor)
      const floor1Units = createdResidences.filter((r) => r.floor === 1);
      expect(floor1Units.length).toBe(10); // 50 units / 5 floors = 10 per floor
    });

    it('should not create residences when totalUnits is 0', async () => {
      const buildingData = {
        name: 'Building with No Units',
        address: '999 Empty Street',
        city: 'Montreal',
        province: 'Quebec',
        postalCode: 'H1A 1A1',
        buildingType: 'commercial',
        totalUnits: 0,
        organizationId: testOrganizationId,
      };

      const response = await request(app)
        .post('/api/admin/buildings')
        .set('Cookie', authCookie)
        .send(buildingData)
        .expect(201);

      const buildingId = response.body.building.id;

      // Wait for potential residence generation
      await new Promise((resolve) => setTimeout(resolve, 100));

      const createdResidences = await db.query.residences.findMany({
        where: eq(residences.buildingId, buildingId),
      });

      expect(createdResidences).toHaveLength(0);
    });

    it('should not create residences when totalUnits exceeds 300', async () => {
      const buildingData = {
        name: 'Oversized Building',
        address: '777 Oversized Street',
        city: 'Montreal',
        province: 'Quebec',
        postalCode: 'H1A 1A1',
        buildingType: 'apartment',
        totalUnits: 350, // Exceeds 300 limit
        organizationId: testOrganizationId,
      };

      const response = await request(app)
        .post('/api/admin/buildings')
        .set('Cookie', authCookie)
        .send(buildingData)
        .expect(201);

      const buildingId = response.body.building.id;

      // Wait for potential residence generation
      await new Promise((resolve) => setTimeout(resolve, 100));

      const createdResidences = await db.query.residences.findMany({
        where: eq(residences.buildingId, buildingId),
      });

      expect(createdResidences).toHaveLength(0);
    });

    it('should handle multi-floor buildings with proper unit numbering', async () => {
      const buildingData = {
        name: 'Multi-Floor Building',
        address: '555 Multi Street',
        city: 'Montreal',
        province: 'Quebec',
        postalCode: 'H1A 1A1',
        buildingType: 'condo',
        totalUnits: 12,
        totalFloors: 3,
        organizationId: testOrganizationId,
      };

      const response = await request(app)
        .post('/api/admin/buildings')
        .set('Cookie', authCookie)
        .send(buildingData)
        .expect(201);

      const buildingId = response.body.building.id;

      // Wait for residence generation
      await new Promise((resolve) => setTimeout(resolve, 100));

      const createdResidences = await db.query.residences.findMany({
        where: eq(residences.buildingId, buildingId),
      });

      expect(createdResidences).toHaveLength(12);

      // 12 units / 3 floors = 4 units per floor
      const floor1Units = createdResidences.filter((r) => r.floor === 1);
      const floor2Units = createdResidences.filter((r) => r.floor === 2);
      const floor3Units = createdResidences.filter((r) => r.floor === 3);

      expect(floor1Units.length).toBe(4);
      expect(floor2Units.length).toBe(4);
      expect(floor3Units.length).toBe(4);

      // Verify unit numbering pattern
      const floor1UnitNumbers = floor1Units.map((r) => r.unitNumber).sort();
      const floor2UnitNumbers = floor2Units.map((r) => r.unitNumber).sort();
      const floor3UnitNumbers = floor3Units.map((r) => r.unitNumber).sort();

      expect(floor1UnitNumbers).toEqual(['101', '102', '103', '104']);
      expect(floor2UnitNumbers).toEqual(['201', '202', '203', '204']);
      expect(floor3UnitNumbers).toEqual(['301', '302', '303', '304']);
    });
  });

  describe('Building Creation with Number Validation', () => {
    it('should handle string input conversion to number for totalUnits', async () => {
      // This simulates what the frontend sends when user types "6" in the form
      const buildingData = {
        name: 'String Number Test Building',
        address: '888 String Street',
        city: 'Montreal',
        province: 'Quebec',
        postalCode: 'H1A 1A1',
        buildingType: 'condo',
        totalUnits: '6', // String instead of number (simulating form input)
        organizationId: testOrganizationId,
      };

      const response = await request(app)
        .post('/api/admin/buildings')
        .set('Cookie', authCookie)
        .send(buildingData)
        .expect(201);

      const buildingId = response.body.building.id;

      // Wait for residence generation
      await new Promise((resolve) => setTimeout(resolve, 100));

      const createdResidences = await db.query.residences.findMany({
        where: eq(residences.buildingId, buildingId),
      });

      // Should still create 6 residences even though totalUnits was sent as string
      expect(createdResidences).toHaveLength(6);
    });
  });
});
