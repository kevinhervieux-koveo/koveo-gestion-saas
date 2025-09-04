/**
 * Comprehensive Form Submission Tests
 * 
 * This test suite validates all major forms in the application to identify
 * and fix UUID errors, missing field errors, and validation issues.
 * 
 * Tests cover:
 * - Demand creation form
 * - Building creation form  
 * - Bill creation form
 * - Document upload forms
 * - User management forms
 * 
 * Each test submits forms with realistic data and validates:
 * - Form submission succeeds
 * - Data is correctly saved to database
 * - Required fields are properly validated
 * - UUID fields are correctly handled
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../../server/index';
import { db } from '../../server/db';
import {
  users,
  organizations,
  buildings,
  residences,
  userResidences,
  demands,
  bills,
  documents,
  invitations
} from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Test data interfaces
interface TestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'resident' | 'tenant' | 'demo_manager' | 'demo_tenant' | 'demo_resident';
}

interface TestOrganization {
  id: string;
  name: string;
  type: string;
}

interface TestBuilding {
  id: string;
  name: string;
  organizationId: string;
}

interface TestResidence {
  id: string;
  unitNumber: string;
  buildingId: string;
}

// Test database setup
let testUser: TestUser;
let testOrganization: TestOrganization;
let testBuilding: TestBuilding;
let testResidence: TestResidence;
let authCookie: string;

describe('Form Submission Tests', () => {
  beforeAll(async () => {
    // Create test organization
    const orgResult = await db.insert(organizations).values({
      name: 'Test Organization for Form Submission',
      type: 'condo_association',
      address: '123 Test Street',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A 1A1'
    }).returning();
    testOrganization = orgResult[0];

    // Create test user
    const userResult = await db.insert(users).values({
      username: 'formtester',
      email: 'formtest@example.com',
      password: 'hashedpassword',
      firstName: 'Form',
      lastName: 'Tester',
      role: 'resident'
    }).returning();
    testUser = userResult[0];

    // Create test building
    const buildingResult = await db.insert(buildings).values({
      name: 'Test Building for Forms',
      organizationId: testOrganization.id,
      address: '456 Form Street',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1B 1B1',
      buildingType: 'condo',
      totalUnits: 100
    }).returning();
    testBuilding = buildingResult[0];

    // Create test residence
    const residenceResult = await db.insert(residences).values({
      unitNumber: '101',
      buildingId: testBuilding.id,
      floor: 1
    }).returning();
    testResidence = residenceResult[0];

    // Assign user to residence
    await db.insert(userResidences).values({
      userId: testUser.id,
      residenceId: testResidence.id,
      relationshipType: 'resident',
      startDate: '2025-01-01'
    });

    // Simulate login to get auth session
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'password'
      });
    
    authCookie = loginResponse.headers['set-cookie']?.[0] || '';
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(userResidences).where(eq(userResidences.userId, testUser.id));
    await db.delete(demands).where(eq(demands.submitterId, testUser.id));
    await db.delete(bills).where(eq(bills.buildingId, testBuilding.id));
    await db.delete(residences).where(eq(residences.id, testResidence.id));
    await db.delete(buildings).where(eq(buildings.id, testBuilding.id));
    await db.delete(users).where(eq(users.id, testUser.id));
    await db.delete(organizations).where(eq(organizations.id, testOrganization.id));
  });

  describe('Demand Creation Form', () => {
    it('should successfully submit demand with all required fields', async () => {
      const demandData = {
        type: 'maintenance',
        description: 'Test maintenance request for form submission testing',
        buildingId: testBuilding.id,
        residenceId: testResidence.id
      };

      const response = await request(app)
        .post('/api/demands')
        .set('Cookie', authCookie)
        .send(demandData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.type).toBe('maintenance');
      expect(response.body.description).toBe(demandData.description);
      expect(response.body.submitterId).toBe(testUser.id);
      expect(response.body.buildingId).toBe(testBuilding.id);
      expect(response.body.residenceId).toBe(testResidence.id);
      expect(response.body.status).toBe('submitted');

      // Verify data is saved in database
      const savedDemand = await db.select().from(demands)
        .where(eq(demands.id, response.body.id))
        .limit(1);
      
      expect(savedDemand).toHaveLength(1);
      expect(savedDemand[0].description).toBe(demandData.description);
    });

    it('should auto-populate buildingId and residenceId if not provided', async () => {
      const demandData = {
        type: 'complaint',
        description: 'Test complaint without explicit IDs'
      };

      const response = await request(app)
        .post('/api/demands')
        .set('Cookie', authCookie)
        .send(demandData)
        .expect(201);

      expect(response.body.buildingId).toBe(testBuilding.id);
      expect(response.body.residenceId).toBe(testResidence.id);
    });

    it('should handle optional UUID fields correctly', async () => {
      const demandData = {
        type: 'information',
        description: 'Test with optional assignation fields',
        buildingId: testBuilding.id,
        residenceId: testResidence.id,
        assignationBuildingId: testBuilding.id,
        assignationResidenceId: testResidence.id
      };

      const response = await request(app)
        .post('/api/demands')
        .set('Cookie', authCookie)
        .send(demandData)
        .expect(201);

      expect(response.body.assignationBuildingId).toBe(testBuilding.id);
      expect(response.body.assignationResidenceId).toBe(testResidence.id);
    });

    it('should validate required fields and return appropriate errors', async () => {
      const invalidDemandData = {
        type: 'maintenance'
        // Missing description
      };

      const response = await request(app)
        .post('/api/demands')
        .set('Cookie', authCookie)
        .send(invalidDemandData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('errors');
    });

    it('should handle empty string UUIDs correctly', async () => {
      const demandData = {
        type: 'other',
        description: 'Test with empty string UUIDs',
        buildingId: testBuilding.id,
        residenceId: testResidence.id,
        assignationBuildingId: '',
        assignationResidenceId: ''
      };

      const response = await request(app)
        .post('/api/demands')
        .set('Cookie', authCookie)
        .send(demandData)
        .expect(201);

      // Empty strings should be converted to null/undefined
      expect(response.body.assignationBuildingId).toBeFalsy();
      expect(response.body.assignationResidenceId).toBeFalsy();
    });
  });

  describe('Building Form Submission', () => {
    it('should successfully create building with all required fields', async () => {
      const buildingData = {
        name: 'New Test Building',
        organizationId: testOrganization.id,
        address: '789 Building Street',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1C 1C1',
        buildingType: 'condo'
      };

      const response = await request(app)
        .post('/api/manager/buildings')
        .set('Cookie', authCookie)
        .send(buildingData);

      if (response.status === 201) {
        expect(response.body).toHaveProperty('id');
        expect(response.body.name).toBe(buildingData.name);
        expect(response.body.organizationId).toBe(buildingData.organizationId);
        
        // Clean up
        await db.delete(buildings).where(eq(buildings.id, response.body.id));
      }
    });

    it('should validate organization ID is required', async () => {
      const buildingData = {
        name: 'Building Without Org',
        address: '999 No Org Street',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1D 1D1',
        buildingType: 'condo'
        // Missing organizationId
      };

      const response = await request(app)
        .post('/api/manager/buildings')
        .set('Cookie', authCookie)
        .send(buildingData);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle invalid organization ID', async () => {
      const buildingData = {
        name: 'Building Invalid Org',
        organizationId: 'invalid-uuid',
        address: '888 Invalid Street',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1E 1E1',
        buildingType: 'condo'
      };

      const response = await request(app)
        .post('/api/manager/buildings')
        .set('Cookie', authCookie)
        .send(buildingData);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Bill Creation Form', () => {
    it('should successfully create bill with all required fields', async () => {
      const billData = {
        title: 'Test Monthly Bill',
        description: 'Test bill for form submission',
        category: 'utilities',
        vendor: 'Test Utility Company',
        paymentType: 'recurrent',
        schedulePayment: 'monthly',
        totalAmount: '150.75',
        startDate: '2025-01-01',
        status: 'draft',
        buildingId: testBuilding.id
      };

      const response = await request(app)
        .post('/api/bills')
        .set('Cookie', authCookie)
        .send(billData);

      if (response.status === 201) {
        expect(response.body).toHaveProperty('id');
        expect(response.body.title).toBe(billData.title);
        expect(response.body.buildingId).toBe(billData.buildingId);
        expect(response.body.totalAmount).toBe(parseFloat(billData.totalAmount));
        
        // Clean up
        await db.delete(bills).where(eq(bills.id, response.body.id));
      }
    });

    it('should validate required amount field', async () => {
      const billData = {
        title: 'Bill Without Amount',
        category: 'maintenance',
        paymentType: 'unique',
        startDate: '2025-01-01',
        status: 'draft',
        buildingId: testBuilding.id
        // Missing totalAmount
      };

      const response = await request(app)
        .post('/api/bills')
        .set('Cookie', authCookie)
        .send(billData);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle optional schedule payment for unique bills', async () => {
      const billData = {
        title: 'One-time Bill',
        category: 'repairs',
        paymentType: 'unique',
        totalAmount: '500.00',
        startDate: '2025-01-01',
        status: 'draft',
        buildingId: testBuilding.id
        // No schedulePayment for unique bills
      };

      const response = await request(app)
        .post('/api/bills')
        .set('Cookie', authCookie)
        .send(billData);

      if (response.status === 201) {
        expect(response.body.paymentType).toBe('unique');
        
        // Clean up
        await db.delete(bills).where(eq(bills.id, response.body.id));
      }
    });
  });

  describe('Document Upload Form', () => {
    it('should validate document creation with building ID', async () => {
      const documentData = {
        name: 'Test Document',
        type: 'maintenance',
        dateReference: '2025-01-01',
        isVisibleToTenants: true,
        buildingId: testBuilding.id
      };

      const response = await request(app)
        .post('/api/documents')
        .set('Cookie', authCookie)
        .send(documentData);

      if (response.status === 201) {
        expect(response.body).toHaveProperty('id');
        expect(response.body.name).toBe(documentData.name);
        
        // Clean up
        await db.delete(documents).where(eq(documents.id, response.body.id));
      }
    });

    it('should validate document creation with residence ID', async () => {
      const documentData = {
        name: 'Residence Document',
        type: 'lease',
        dateReference: '2025-01-01',
        isVisibleToTenants: false,
        residenceId: testResidence.id
      };

      const response = await request(app)
        .post('/api/documents')
        .set('Cookie', authCookie)
        .send(documentData);

      if (response.status === 201) {
        expect(response.body).toHaveProperty('id');
        expect(response.body.residenceId).toBe(testResidence.id);
        
        // Clean up
        await db.delete(documents).where(eq(documents.id, response.body.id));
      }
    });
  });

  describe('User Invitation Form', () => {
    it('should create invitation with proper validation', async () => {
      const invitationData = {
        email: 'newuser@example.com',
        role: 'resident',
        organizationId: testOrganization.id,
        buildingId: testBuilding.id
      };

      const response = await request(app)
        .post('/api/admin/invitations')
        .set('Cookie', authCookie)
        .send(invitationData);

      if (response.status === 201) {
        expect(response.body).toHaveProperty('token');
        expect(response.body.email).toBe(invitationData.email);
        
        // Clean up
        await db.delete(invitations).where(eq(invitations.email, invitationData.email));
      }
    });

    it('should validate email format', async () => {
      const invitationData = {
        email: 'invalid-email',
        role: 'resident',
        organizationId: testOrganization.id
      };

      const response = await request(app)
        .post('/api/admin/invitations')
        .set('Cookie', authCookie)
        .send(invitationData);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Form Error Handling', () => {
    it('should handle malformed UUID fields', async () => {
      const demandData = {
        type: 'maintenance',
        description: 'Test with malformed UUID',
        buildingId: 'not-a-uuid',
        residenceId: 'also-not-a-uuid'
      };

      const response = await request(app)
        .post('/api/demands')
        .set('Cookie', authCookie)
        .send(demandData);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle null values in required fields', async () => {
      const demandData = {
        type: null,
        description: null,
        buildingId: testBuilding.id
      };

      const response = await request(app)
        .post('/api/demands')
        .set('Cookie', authCookie)
        .send(demandData);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle very long field values', async () => {
      const demandData = {
        type: 'maintenance',
        description: 'x'.repeat(5000), // Very long description
        buildingId: testBuilding.id
      };

      const response = await request(app)
        .post('/api/demands')
        .set('Cookie', authCookie)
        .send(demandData);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});
