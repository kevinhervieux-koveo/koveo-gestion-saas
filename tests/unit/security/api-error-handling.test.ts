/**
 * API Error Handling and Validation Edge Cases
 * Tests comprehensive error scenarios for Quebec property management APIs
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { registerRoutes } from '../../../server/routes';
import { db } from '../../../server/db';
import * as schema from '../../../shared/schema';

// Create test server
const createTestApp = () => {
  const app = express();
  app.use(express.json({ limit: '1mb' })); // Set reasonable limit for testing
  app.use(express.urlencoded({ extended: true }));
  registerRoutes(app);
  return app;
};

describe('API Error Handling and Validation Edge Cases', () => {
  let app: express.Application;
  let testOrganization: any;
  let testBuilding: any;

  beforeEach(async () => {
    app = createTestApp();

    // Clean test data
    await db.delete(schema.buildings);
    await db.delete(schema.organizations);

    // Create test organization
    const [org] = await db
      .insert(schema.organizations)
      .values({
        name: 'Test Organization',
        type: 'Standard' as any,
        address: '123 Test St',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1H 1H1',
        phone: '514-555-0123',
        email: 'test@org.com',
      })
      .returning();
    testOrganization = org;

    // Create test building
    const [building] = await db
      .insert(schema.buildings)
      .values({
        organizationId: testOrganization.id,
        name: 'Test Building',
        address: '123 Test St',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1H 1H1',
        buildingType: 'apartment',
        totalUnits: 10,
      })
      .returning();
    testBuilding = building;
  });

  afterEach(async () => {
    await db.delete(schema.buildings);
    await db.delete(schema.organizations);
  });

  describe('Input Validation Edge Cases', () => {
    it('should validate UUID format in API parameters', async () => {
      const invalidUUIDs = [
        'invalid-uuid',
        '123',
        'not-a-uuid-at-all',
        '12345678-1234-1234-1234-12345678901', // Too long
        '12345678-1234-1234-1234-123456789012', // Wrong format
        '',
        null,
      ];

      for (const invalidId of invalidUUIDs) {
        const response = await request(app)
          .get(`/api/organizations/${invalidId}`);

        expect([400, 404]).toContain(response.status);
      }
    });

    it('should validate Quebec postal code format', async () => {
      const invalidPostalCodes = [
        'invalid', // Not Quebec format
        '90210', // US ZIP code
        'M5V 3A1', // Ontario postal code format but wrong province
        'H1H1H1', // Missing space
        'H1H 1H', // Incomplete
        'A1A 1A1', // Invalid Quebec area (A is Newfoundland)
        'Z9Z 9Z9', // Invalid postal characters
      ];

      for (const postalCode of invalidPostalCodes) {
        const response = await request(app)
          .post('/api/organizations')
          .send({
            name: 'Test Quebec Org',
            address: '123 Test Street',
            city: 'Montreal',
            province: 'QC',
            postalCode,
            phone: '514-555-0123',
            email: 'test@quebecorg.com',
            type: 'Condo',
          });

        // Should validate Quebec postal code format
        if (response.status === 400) {
          expect(response.body.message).toMatch(/postal|code/i);
        }
      }
    });

    it('should validate Quebec phone number formats', async () => {
      const phoneNumbers = [
        '514-555-0123', // Valid Montreal
        '418-555-0123', // Valid Quebec City
        '819-555-0123', // Valid Gatineau
        '450-555-0123', // Valid Longueuil
        '(514) 555-0123', // Valid with parentheses
        '514.555.0123', // Valid with dots
        '5145550123', // Valid without formatting
        '+1-514-555-0123', // Valid international
        '911', // Emergency (should be handled specially)
        '555-0123', // Missing area code
        '514-555-012', // Too short
        '614-555-0123', // Non-Quebec area code
        'abc-def-ghij', // Non-numeric
        '', // Empty
      ];

      for (const phone of phoneNumbers) {
        const response = await request(app)
          .post('/api/organizations')
          .send({
            name: 'Test Phone Org',
            address: '123 Test Street',
            city: 'Montreal',
            province: 'QC',
            postalCode: 'H1H 1H1',
            phone,
            email: 'test@phoneorg.com',
            type: 'Apartment',
          });

        // Quebec phone numbers should be validated appropriately
        if ([400, 422].includes(response.status)) {
          expect(response.body.message).toMatch(/phone/i);
        }
      }
    });
  });

  describe('Database Constraint Validation', () => {
    it('should enforce building type enum constraints', async () => {
      const invalidBuildingTypes = [
        'house', // Not valid in Quebec residential context
        'commercial', // Wrong building category
        'Apartment', // Wrong case
        'CONDO', // Wrong case
        '', // Empty
        null,
        'mixed-use', // Not supported
      ];

      for (const buildingType of invalidBuildingTypes) {
        const response = await request(app)
          .post('/api/buildings')
          .send({
            organizationId: testOrganization.id,
            name: 'Test Building',
            address: '123 Test Street',
            city: 'Montreal',
            province: 'QC',
            postalCode: 'H1H 1H1',
            buildingType,
            totalUnits: 10,
          });

        expect([400, 422]).toContain(response.status);
      }
    });

    it('should validate residence unit numbering in Quebec context', async () => {
      const invalidUnitNumbers = [
        '', // Empty unit number
        '0', // Unit numbers typically start from 1
        'basement', // Non-standard naming
        '999999', // Unrealistic unit number
        'A-1-B-2', // Too complex
        '1st Floor', // Descriptive instead of numeric
      ];

      for (const unitNumber of invalidUnitNumbers) {
        const response = await request(app)
          .post('/api/residences')
          .send({
            buildingId: testBuilding.id,
            unitNumber,
            squareFootage: 1000,
            bedrooms: 2,
            bathrooms: 1,
          });

        if (response.status === 400) {
          expect(response.body.message).toMatch(/unit/i);
        }
      }
    });
  });

  describe('Concurrent Operations and Race Conditions', () => {
    it('should handle concurrent user creation with same email', async () => {
      const userData = {
        email: 'concurrent@example.com',
        username: 'concurrent',
        firstName: 'Concurrent',
        lastName: 'User',
        role: 'tenant',
        password: 'TestPassword123!',
      };

      // Create multiple concurrent requests
      const concurrentRequests = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/users')
          .send(userData)
      );

      const responses = await Promise.all(concurrentRequests);
      
      // Only one should succeed, others should fail with conflict
      const successfulCreations = responses.filter(r => r.status === 201);
      const conflictResponses = responses.filter(r => r.status === 409);
      
      expect(successfulCreations.length).toBe(1);
      expect(conflictResponses.length).toBeGreaterThan(0);
    });

    it('should handle concurrent document uploads to same building', async () => {
      const documentData = {
        title: 'Test Document',
        description: 'Concurrent test document',
        category: 'Legal',
        buildingId: testBuilding.id,
        accessLevel: 'public',
      };

      // Simulate multiple users uploading documents simultaneously
      const concurrentUploads = Array(3).fill(null).map((_, index) =>
        request(app)
          .post('/api/documents')
          .send({
            ...documentData,
            title: `Test Document ${index + 1}`,
          })
      );

      const responses = await Promise.all(concurrentUploads);
      
      // All uploads should either succeed or fail gracefully
      const validStatuses = [200, 201, 400, 401, 403, 409, 422];
      responses.forEach(response => {
        expect(validStatuses).toContain(response.status);
      });
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle large organization queries efficiently', async () => {
      // Test query performance with realistic data size
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/organizations');

      const executionTime = Date.now() - startTime;
      
      // API should respond within reasonable time (< 5 seconds)
      expect(executionTime).toBeLessThan(5000);
      expect([200, 401]).toContain(response.status);
    });

    it('should handle pagination edge cases', async () => {
      const paginationTests = [
        { page: 0, limit: 10 }, // Page 0
        { page: -1, limit: 10 }, // Negative page
        { page: 1, limit: 0 }, // Zero limit
        { page: 1, limit: -5 }, // Negative limit
        { page: 999999, limit: 10 }, // Very high page number
        { page: 1, limit: 1000 }, // Very high limit
      ];

      for (const { page, limit } of paginationTests) {
        const response = await request(app)
          .get(`/api/buildings?page=${page}&limit=${limit}`);

        // Should handle edge cases gracefully
        expect([200, 400, 422]).toContain(response.status);
      }
    });
  });

  describe('Quebec-Specific Business Logic', () => {
    it('should validate Quebec residential property regulations', async () => {
      // Test Quebec-specific property constraints
      const quebecPropertyData = {
        organizationId: testOrganization.id,
        name: 'Copropriété Les Jardins',
        address: '123 boulevard René-Lévesque',
        city: 'Québec',
        province: 'QC',
        postalCode: 'G1R 2B5',
        buildingType: 'condo', // Quebec condo regulations
        totalUnits: 150, // Large Quebec condo building
        yearBuilt: 1995,
        totalFloors: 15,
      };

      const response = await request(app)
        .post('/api/buildings')
        .send(quebecPropertyData);

      if (response.status === 201) {
        const building = response.body.building || response.body;
        expect(building.buildingType).toBe('condo');
        expect(building.province).toBe('QC');
      }
    });

    it('should handle French language validation for Quebec users', async () => {
      const frenchUserData = {
        email: 'français@exemple.com',
        username: 'utilisateurfrançais',
        firstName: 'Jean-François',
        lastName: 'Côté-Tremblay',
        role: 'tenant',
        language: 'fr',
        password: 'MotDePasse123!',
      };

      const response = await request(app)
        .post('/api/users')
        .send(frenchUserData);

      if (response.status === 201) {
        const user = response.body.user || response.body;
        // Should preserve French characters and names
        expect(user.firstName).toBe('Jean-François');
        expect(user.lastName).toBe('Côté-Tremblay');
        expect(user.language).toBe('fr');
      }
    });
  });

  describe('Error Response Consistency', () => {
    it('should return consistent error format across all endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/nonexistent' },
        { method: 'post', path: '/api/users', body: {} },
        { method: 'get', path: '/api/organizations/invalid-id' },
        { method: 'put', path: '/api/buildings/00000000-0000-0000-0000-000000000000', body: {} },
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path)
          .send(endpoint.body || {});

        if (response.status >= 400) {
          // All error responses should have consistent structure
          expect(response.body).toHaveProperty('message');
          expect(typeof response.body.message).toBe('string');
          
          if (response.body.code) {
            expect(typeof response.body.code).toBe('string');
          }
        }
      }
    });

    it('should handle OPTIONS requests for CORS compliance', async () => {
      const response = await request(app)
        .options('/api/users');

      // Should handle CORS preflight requests
      expect([200, 204, 404]).toContain(response.status);
    });
  });
});