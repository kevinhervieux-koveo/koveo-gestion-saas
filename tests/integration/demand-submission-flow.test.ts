/**
 * @file Demand Submission Integration Tests
 * @description Comprehensive tests for the entire demand submission workflow
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { db } from '../../server/db';
import { demands, users, residences, buildings, organizations, userResidences } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Create test app instance
function createTestApp() {
  const express = require('express');
  const app = express();
  
  // Apply middleware
  app.use(express.json());
  
  // Import and setup routes
  const { registerRoutes } = require('../../server/routes');
  registerRoutes(app);
  
  return app;
}

describe('Demand Submission Integration Tests', () => {
  let app: any;
  let testUser: any;
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

    // Mock authentication
    authCookie = 'test-session-cookie';
  });

  afterEach(async () => {
    // Clean up test data
    try {
      await db.delete(userResidences).where(eq(userResidences.userId, testUser.id));
      await db.delete(demands).where(eq(demands.submitterId, testUser.id));
      await db.delete(users).where(eq(users.id, testUser.id));
      await db.delete(residences).where(eq(residences.id, testResidence.id));
      await db.delete(buildings).where(eq(buildings.id, testBuilding.id));
      await db.delete(organizations).where(eq(organizations.id, testOrganization.id));
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('POST /api/demands', () => {
    it('should successfully create a demand with all fields provided', async () => {
      const demandData = {
        type: 'maintenance',
        description: 'Water leak in bathroom ceiling',
        buildingId: testBuilding.id,
        residenceId: testResidence.id,
        status: 'submitted',
      };

      const response = await request(app)
        .post('/api/demands')
        .set('Cookie', authCookie)
        .send(demandData)
        .expect(201);

      expect(response.body).toMatchObject({
        type: 'maintenance',
        description: 'Water leak in bathroom ceiling',
        buildingId: testBuilding.id,
        residenceId: testResidence.id,
        submitterId: testUser.id,
        status: 'submitted',
      });

      expect(response.body.id).toBeDefined();
      expect(response.body.createdAt).toBeDefined();
    });

    it('should auto-populate building and residence from user data when not provided', async () => {
      const demandData = {
        type: 'complaint',
        description: 'Noise complaint from upstairs neighbor',
        status: 'submitted',
      };

      const response = await request(app)
        .post('/api/demands')
        .set('Cookie', authCookie)
        .send(demandData)
        .expect(201);

      expect(response.body).toMatchObject({
        type: 'complaint',
        description: 'Noise complaint from upstairs neighbor',
        buildingId: testBuilding.id,
        residenceId: testResidence.id,
        submitterId: testUser.id,
        status: 'submitted',
      });
    });

    it('should accept only buildingId and auto-populate residenceId', async () => {
      const demandData = {
        type: 'information',
        description: 'Question about building policies',
        buildingId: testBuilding.id,
        status: 'submitted',
      };

      const response = await request(app)
        .post('/api/demands')
        .set('Cookie', authCookie)
        .send(demandData)
        .expect(201);

      expect(response.body).toMatchObject({
        type: 'information',
        description: 'Question about building policies',
        buildingId: testBuilding.id,
        residenceId: testResidence.id,
        submitterId: testUser.id,
        status: 'submitted',
      });
    });

    it('should accept only residenceId and auto-populate buildingId', async () => {
      const demandData = {
        type: 'other',
        description: 'General inquiry about residence',
        residenceId: testResidence.id,
        status: 'submitted',
      };

      const response = await request(app)
        .post('/api/demands')
        .set('Cookie', authCookie)
        .send(demandData)
        .expect(201);

      expect(response.body).toMatchObject({
        type: 'other',
        description: 'General inquiry about residence',
        buildingId: testBuilding.id,
        residenceId: testResidence.id,
        submitterId: testUser.id,
        status: 'submitted',
      });
    });

    it('should require authentication', async () => {
      const demandData = {
        type: 'maintenance',
        description: 'Test demand without auth',
      };

      await request(app)
        .post('/api/demands')
        .send(demandData)
        .expect(401);
    });

    it('should validate required fields', async () => {
      const invalidDemands = [
        { type: 'maintenance' }, // Missing description
        { description: 'Test' }, // Missing type
        { type: 'invalid_type', description: 'Test' }, // Invalid type
        { type: 'maintenance', description: 'Short' }, // Description too short
      ];

      for (const invalidDemand of invalidDemands) {
        await request(app)
          .post('/api/demands')
          .set('Cookie', authCookie)
          .send(invalidDemand)
          .expect(400);
      }
    });

    it('should handle assignation fields properly', async () => {
      const demandData = {
        type: 'maintenance',
        description: 'Maintenance request with assignation',
        assignationBuildingId: testBuilding.id,
        assignationResidenceId: testResidence.id,
        status: 'submitted',
      };

      const response = await request(app)
        .post('/api/demands')
        .set('Cookie', authCookie)
        .send(demandData)
        .expect(201);

      expect(response.body).toMatchObject({
        type: 'maintenance',
        description: 'Maintenance request with assignation',
        assignationBuildingId: testBuilding.id,
        assignationResidenceId: testResidence.id,
        submitterId: testUser.id,
        status: 'submitted',
      });
    });

    it('should handle special characters in description', async () => {
      const demandData = {
        type: 'maintenance',
        description: 'Réparation nécessaire avec caractères spéciaux: éàùç! 🏠',
        status: 'submitted',
      };

      const response = await request(app)
        .post('/api/demands')
        .set('Cookie', authCookie)
        .send(demandData)
        .expect(201);

      expect(response.body.description).toBe('Réparation nécessaire avec caractères spéciaux: éàùç! 🏠');
    });

    it('should default to submitted status when not provided', async () => {
      const demandData = {
        type: 'maintenance',
        description: 'Test demand without status',
      };

      const response = await request(app)
        .post('/api/demands')
        .set('Cookie', authCookie)
        .send(demandData)
        .expect(201);

      expect(response.body.status).toBe('submitted');
    });

    it('should validate description length boundaries', async () => {
      const validMinDescription = 'a'.repeat(10); // Minimum valid
      const validMaxDescription = 'a'.repeat(2000); // Maximum valid
      const invalidShortDescription = 'a'.repeat(9); // Too short
      const invalidLongDescription = 'a'.repeat(2001); // Too long

      // Valid cases
      for (const description of [validMinDescription, validMaxDescription]) {
        await request(app)
          .post('/api/demands')
          .set('Cookie', authCookie)
          .send({
            type: 'maintenance',
            description,
          })
          .expect(201);
      }

      // Invalid cases
      for (const description of [invalidShortDescription, invalidLongDescription]) {
        await request(app)
          .post('/api/demands')
          .set('Cookie', authCookie)
          .send({
            type: 'maintenance',
            description,
          })
          .expect(400);
      }
    });
  });

  describe('GET /api/demands', () => {
    it('should retrieve user demands after creation', async () => {
      // Create a demand first
      const demandData = {
        type: 'maintenance',
        description: 'Test demand for retrieval',
        status: 'submitted',
      };

      const createResponse = await request(app)
        .post('/api/demands')
        .set('Cookie', authCookie)
        .send(demandData)
        .expect(201);

      // Retrieve demands
      const getResponse = await request(app)
        .get('/api/demands')
        .set('Cookie', authCookie)
        .expect(200);

      expect(getResponse.body).toBeInstanceOf(Array);
      expect(getResponse.body.length).toBeGreaterThan(0);
      
      const retrievedDemand = getResponse.body.find((d: any) => d.id === createResponse.body.id);
      expect(retrievedDemand).toMatchObject({
        type: 'maintenance',
        description: 'Test demand for retrieval',
        submitterId: testUser.id,
        status: 'submitted',
      });
    });

    it('should include related data in demand retrieval', async () => {
      // Create a demand
      await request(app)
        .post('/api/demands')
        .set('Cookie', authCookie)
        .send({
          type: 'maintenance',
          description: 'Test demand with relations',
        })
        .expect(201);

      // Retrieve demands
      const response = await request(app)
        .get('/api/demands')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      const demand = response.body[0];

      // Check related data is included
      expect(demand.submitter).toBeDefined();
      expect(demand.submitter.email).toBe(testUser.email);
      expect(demand.building).toBeDefined();
      expect(demand.building.name).toBe(testBuilding.name);
      expect(demand.residence).toBeDefined();
      expect(demand.residence.unitNumber).toBe(testResidence.unitNumber);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Test with invalid UUID format
      const demandData = {
        type: 'maintenance',
        description: 'Test with invalid UUID',
        buildingId: 'invalid-uuid',
      };

      await request(app)
        .post('/api/demands')
        .set('Cookie', authCookie)
        .send(demandData)
        .expect(400);
    });

    it('should handle user without residence assignment', async () => {
      // Remove user-residence association
      await db.delete(userResidences).where(eq(userResidences.userId, testUser.id));

      const demandData = {
        type: 'maintenance',
        description: 'Test without residence',
      };

      const response = await request(app)
        .post('/api/demands')
        .set('Cookie', authCookie)
        .send(demandData)
        .expect(400);

      expect(response.body.message).toContain('residence');
    });
  });

  describe('Frontend Form Compatibility', () => {
    it('should handle empty string fields like frontend forms', async () => {
      const demandData = {
        type: 'maintenance',
        description: 'Test with empty string fields',
        buildingId: '', // Empty string should be treated as undefined
        residenceId: '',
        assignationBuildingId: '',
        assignationResidenceId: '',
        status: 'submitted',
      };

      const response = await request(app)
        .post('/api/demands')
        .set('Cookie', authCookie)
        .send(demandData)
        .expect(201);

      // Should auto-populate building and residence
      expect(response.body.buildingId).toBe(testBuilding.id);
      expect(response.body.residenceId).toBe(testResidence.id);
    });

    it('should handle undefined optional fields', async () => {
      const demandData = {
        type: 'maintenance',
        description: 'Test with undefined fields',
        buildingId: undefined,
        residenceId: undefined,
        assignationBuildingId: undefined,
        assignationResidenceId: undefined,
      };

      const response = await request(app)
        .post('/api/demands')
        .set('Cookie', authCookie)
        .send(demandData)
        .expect(201);

      expect(response.body.buildingId).toBe(testBuilding.id);
      expect(response.body.residenceId).toBe(testResidence.id);
    });
  });
});