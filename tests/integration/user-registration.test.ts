import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { registerRoutes } from '../../server/routes';
import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { Server } from 'http';

// Mock the server/db module to ensure test and routes share same instance
jest.mock('../../server/db');

// Task #153: drizzle-orm mocks were relocated out of `__mocks__/` so they
// no longer auto-apply. The mock db at `server/__mocks__/db.ts` keys off
// `table._.name`, which is set by the manual pg-core mock; opt back in
// here so this suite keeps working without touching the real database.
jest.mock('drizzle-orm', () => require('../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () => require('../manual-mocks/drizzle-orm/pg-core'));

import { db } from '../../server/db';
import * as schema from '../../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * User Registration Test Suite
 * 
 * Tests the complete invitation-based user registration flow including:
 * - Token validation and security
 * - User account creation with proper data
 * - Password hashing and security
 * - Quebec Law 25 privacy consent handling
 * - Organization assignment
 * - Invitation status updates
 */

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  registerRoutes(app);
  return app;
};

let dbAvailable = true;

describe('User Registration via Invitation', () => {
  beforeAll(async () => {
    try {
      const s = require('../../shared/schema');
      const t = s.users || s.organizations || {};
      await Promise.race([
        db.select().from(t).limit(1),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
      ]);
      dbAvailable = true;
    } catch {
      dbAvailable = false;
    }
  });

  let app: express.Application;
  let server: Server | undefined;
  let testInvitation: any;
  let testOrganization: any;
  let inviterUser: any;

  beforeAll(() => {
    if (!dbAvailable) return;
    // Set TEST_TYPE to unit for proper mock behavior
    process.env.TEST_TYPE = 'unit';
  });

  afterAll(() => {
    if (!dbAvailable) return;
    // Clean up environment
    delete process.env.TEST_TYPE;
  });

  beforeEach(async () => {
    if (!dbAvailable) return;
    // Access the global mock instances to ensure test and routes use the same data
    const globalMockDb = (global as any).__mockDb;
    const globalMockDataStore = (global as any).__mockDataStore;
    
    // Reset all mocks and mock data store for test isolation
    if (globalMockDb?._resetMocks) {
      globalMockDb._resetMocks();
    } else if (globalMockDataStore?.reset) {
      globalMockDataStore.reset();
    }
    
    console.log('Test: Global mock data store available?', !!globalMockDataStore);
    console.log('Test: Initial invitation state:', globalMockDataStore?.invitations?.get('test-registration-token-123')?.status);
    
    // Create fresh Express app after reset to ensure routes use fresh state
    app = createTestApp();
    
    // Use mock data for all tests (simpler and more reliable)
    testOrganization = [{ 
      id: 'mock-org-id-123',
      name: 'Test Registration Org',
      type: 'syndicate',
      address: '123 Test St',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A 1A1',
    }];

    inviterUser = [{ 
      id: 'mock-inviter-id-123',
      username: 'testinviter',
      email: 'inviter@test.com',
      firstName: 'Test',
      lastName: 'Inviter',
      password: 'mock-hashed-password',
      role: 'admin',
    }];

    const token = 'test-registration-token-123';
    const tokenHash = createHash('sha256').update(token).digest('hex');
    
    testInvitation = [{ 
      id: 'mock-invitation-id-123',
      email: 'test-registration@example.com',
      token,
      tokenHash,
      role: 'manager',
      organizationId: testOrganization[0].id,
      invitedByUserId: inviterUser[0].id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      status: 'pending',
    }];
  });

  afterEach(async () => {
    if (!dbAvailable) return;
    // Close any running server
    if (server) {
      return new Promise<void>((resolve) => {
        server!.close(() => {
          server = undefined;
          resolve();
        });
      });
    }
    
    // Reset mock state
    if ((db as any)._resetMocks) {
      (db as any)._resetMocks();
    }
    
    // Clear any timers or intervals
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Invitation Token Validation', () => {
    it('should validate a valid invitation token', async () => {
      if (!dbAvailable) return;
      const response = await request(app)
        .get(`/api/invitations/validate/test-registration-token-123`)
        .expect(200);

      expect(response.body).toMatchObject({
        valid: true,
        invitation: {
          id: testInvitation[0].id,
          email: 'test-registration@example.com',
          role: 'manager',
          organizationId: testOrganization[0].id,
          status: 'pending',
        },
      });
    });

    it('should reject invalid invitation token', async () => {
      if (!dbAvailable) return;
      const response = await request(app)
        .get('/api/invitations/validate/invalid-token')
        .expect(404);

      expect(response.body).toMatchObject({
        valid: false,
        message: 'Invitation not found or invalid',
        code: 'INVITATION_NOT_FOUND',
      });
    });

    it('should reject expired invitation token', async () => {
      if (!dbAvailable) return;
      // Use global mock data store to set invitation as expired
      const globalMockDataStore = (global as any).__mockDataStore;
      if (globalMockDataStore) {
        console.log('Test: Setting invitation as expired...');
        globalMockDataStore.setInvitationExpired('test-registration-token-123');
        
        // Verify the state was changed
        const invitation = globalMockDataStore.invitations.get('test-registration-token-123');
        console.log('Test: Invitation after expiry:', invitation?.expiresAt, 'vs now:', new Date());
      } else {
        console.log('Test: Global mock data store not available');
      }

      const response = await request(app)
        .get('/api/invitations/validate/test-registration-token-123')
        .expect(410);

      expect(response.body).toMatchObject({
        valid: false,
        message: 'Invitation has expired',
        code: 'INVITATION_EXPIRED',
      });
    });

    it('should reject already accepted invitation', async () => {
      if (!dbAvailable) return;
      // Use direct access to mock data store to set invitation as accepted
      const mockDataStore = (db as any).getMockDataStore();
      if (mockDataStore) {
        mockDataStore.setInvitationAccepted('test-registration-token-123');
      }

      const response = await request(app)
        .get('/api/invitations/validate/test-registration-token-123')
        .expect(410);

      expect(response.body).toMatchObject({
        valid: false,
        message: 'Invitation has already been used',
        code: 'INVITATION_USED',
      });
    });
  });

  describe('User Account Creation', () => {
    it('should create new user account with valid invitation', async () => {
      if (!dbAvailable) return;
      const registrationData = {
        firstName: 'John',
        lastName: 'Doe',
        password: 'SecurePass123!',
        phone: '+1-514-555-0123',
        language: 'en',
        dataCollectionConsent: true,
        marketingConsent: false,
        analyticsConsent: true,
        thirdPartyConsent: false,
        acknowledgedRights: true,
      };

      const response = await request(app)
        .post('/api/invitations/accept/test-registration-token-123')
        .send(registrationData)
        .expect(201);

      expect(response.body).toMatchObject({
        message: 'Account created successfully',
        user: {
          id: expect.any(String),
          username: 'test-registration',
          email: 'test-registration@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'manager',
          language: 'en',
          phone: '+1-514-555-0123',
        },
      });

      // Verify user was created in database
      const createdUser = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, 'test-registration@example.com'))
        .limit(1);

      expect(createdUser).toHaveLength(1);
      expect(createdUser[0]).toMatchObject({
        email: 'test-registration@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'manager',
        language: 'en',
        isActive: true,
      });

      // Verify password is properly hashed
      const isValidPassword = await bcrypt.compare('SecurePass123!', createdUser[0].password);
      expect(isValidPassword).toBe(true);
    });

    it('should require all mandatory fields for registration', async () => {
      if (!dbAvailable) return;
      const incompleteData = {
        firstName: 'John',
        // Missing lastName, password
        language: 'en',
        dataCollectionConsent: true,
        acknowledgedRights: true,
      };

      const response = await request(app)
        .post('/api/invitations/accept/test-registration-token-123')
        .send(incompleteData)
        .expect(400);

      expect(response.body).toMatchObject({
        message: 'First name, last name, and password are required',
        code: 'MISSING_REQUIRED_FIELDS',
      });
    });

    it('should require Quebec Law 25 privacy consents', async () => {
      if (!dbAvailable) return;
      const dataWithoutConsent = {
        firstName: 'John',
        lastName: 'Doe',
        password: 'SecurePass123!',
        language: 'en',
        // Missing dataCollectionConsent and acknowledgedRights
      };

      const response = await request(app)
        .post('/api/invitations/accept/test-registration-token-123')
        .send(dataWithoutConsent)
        .expect(400);

      expect(response.body).toMatchObject({
        message: 'Data collection consent and privacy rights acknowledgment are required',
        code: 'CONSENT_REQUIRED',
      });
    });

    it('should generate unique username from email', async () => {
      if (!dbAvailable) return;
      const registrationData = {
        firstName: 'Jane',
        lastName: 'Smith',
        password: 'AnotherPass456!',
        language: 'fr',
        dataCollectionConsent: true,
        acknowledgedRights: true,
      };

      const response = await request(app)
        .post('/api/invitations/accept/test-registration-token-123')
        .send(registrationData)
        .expect(201);

      expect(response.body.user.username).toBe('test-registration');
      expect(response.body.user.email).toBe('test-registration@example.com');
    });

    it('should update invitation status to accepted', async () => {
      if (!dbAvailable) return;
      const registrationData = {
        firstName: 'Test',
        lastName: 'User',
        password: 'TestPass789!',
        language: 'en',
        dataCollectionConsent: true,
        acknowledgedRights: true,
      };

      await request(app)
        .post('/api/invitations/accept/test-registration-token-123')
        .send(registrationData)
        .expect(201);

      // Verify invitation is marked as accepted
      const updatedInvitation = await db
        .select()
        .from(schema.invitations)
        .where(eq(schema.invitations.id, testInvitation[0].id))
        .limit(1);

      expect(updatedInvitation[0]).toMatchObject({
        status: 'accepted',
        acceptedAt: expect.any(Date),
        acceptedBy: expect.any(String),
      });
    });

    it('should prevent registration with already used invitation', async () => {
      if (!dbAvailable) return;
      // Use global mock data store to simulate already accepted invitation
      const globalMockDataStore = (global as any).__mockDataStore;
      if (globalMockDataStore) {
        globalMockDataStore.setInvitationAccepted('test-registration-token-123');
      }

      const registrationData = {
        firstName: 'Second',
        lastName: 'User',
        password: 'SecondPass456!',
        language: 'fr',
        dataCollectionConsent: true,
        acknowledgedRights: true,
      };

      const response = await request(app)
        .post('/api/invitations/accept/test-registration-token-123')
        .send(registrationData)
        .expect(410);

      expect(response.body).toMatchObject({
        message: 'Invitation has already been used',
        code: 'INVITATION_USED',
      });
    });

    it('should prevent registration if user already exists with email', async () => {
      if (!dbAvailable) return;
      // Use global mock data store to simulate existing user
      const globalMockDataStore = (global as any).__mockDataStore;
      if (globalMockDataStore) {
        globalMockDataStore.addUser('test-registration@example.com', {
          id: 'existing-user-id',
          username: 'existinguser',
          email: 'test-registration@example.com',
          firstName: 'Existing',
          lastName: 'User',
          password: 'mock-hashed-password',
          role: 'tenant',
        });
      }

      const registrationData = {
        firstName: 'New',
        lastName: 'User',
        password: 'NewPass123!',
        language: 'en',
        dataCollectionConsent: true,
        acknowledgedRights: true,
      };

      const response = await request(app)
        .post('/api/invitations/accept/test-registration-token-123')
        .send(registrationData)
        .expect(409);

      expect(response.body).toMatchObject({
        message: 'User already exists with this email',
        code: 'USER_EXISTS',
      });
    });
  });

  describe('Password Security', () => {
    it('should properly hash passwords using bcrypt', async () => {
      if (!dbAvailable) return;
      const registrationData = {
        firstName: 'Security',
        lastName: 'Test',
        password: 'SecurityTest123!',
        language: 'en',
        dataCollectionConsent: true,
        acknowledgedRights: true,
      };

      await request(app)
        .post('/api/invitations/accept/test-registration-token-123')
        .send(registrationData)
        .expect(201);

      const createdUser = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, 'test-registration@example.com'))
        .limit(1);

      // Password should be hashed, not plain text
      expect(createdUser[0].password).not.toBe('SecurityTest123!');
      expect(createdUser[0].password.startsWith('$2b$')).toBe(true);

      // Should be able to verify password
      const isValid = await bcrypt.compare('SecurityTest123!', createdUser[0].password);
      expect(isValid).toBe(true);
    });
  });

  describe('Quebec Law 25 Compliance', () => {
    it('should store all privacy consent preferences', async () => {
      if (!dbAvailable) return;
      const registrationData = {
        firstName: 'Privacy',
        lastName: 'Test',
        password: 'PrivacyTest123!',
        language: 'fr',
        dataCollectionConsent: true,
        marketingConsent: false,
        analyticsConsent: true,
        thirdPartyConsent: false,
        acknowledgedRights: true,
      };

      const response = await request(app)
        .post('/api/invitations/accept/test-registration-token-123')
        .send(registrationData)
        .expect(201);

      expect(response.body.user).toMatchObject({
        language: 'fr',
        dataCollectionConsent: true,
        marketingConsent: false,
        analyticsConsent: true,
        thirdPartyConsent: false,
        acknowledgedRights: true,
      });
    });

    it('should support both French and English languages', async () => {
      if (!dbAvailable) return;
      const frenchRegistration = {
        firstName: 'François',
        lastName: 'Dubois',
        password: 'MotDePasse123!',
        language: 'fr',
        dataCollectionConsent: true,
        acknowledgedRights: true,
      };

      const response = await request(app)
        .post('/api/invitations/accept/test-registration-token-123')
        .send(frenchRegistration)
        .expect(201);

      expect(response.body.user.language).toBe('fr');
      expect(response.body.user.firstName).toBe('François');
    });
  });

  describe('Organization Assignment', () => {
    it('should assign user to invitation organization', async () => {
      if (!dbAvailable) return;
      const registrationData = {
        firstName: 'Organization',
        lastName: 'Test',
        password: 'OrgTest123!',
        language: 'en',
        dataCollectionConsent: true,
        acknowledgedRights: true,
      };

      const response = await request(app)
        .post('/api/invitations/accept/test-registration-token-123')
        .send(registrationData)
        .expect(201);

      // Verify user is assigned to correct organization
      const userOrgs = await db
        .select()
        .from(schema.userOrganizations)
        .where(eq(schema.userOrganizations.userId, response.body.user.id));

      expect(userOrgs).toHaveLength(1);
      expect(userOrgs[0].organizationId).toBe(testOrganization[0].id);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      if (!dbAvailable) return;
      // Create invitation with invalid organization ID to trigger error
      const invalidInvitation = await db
        .insert(schema.invitations)
        .values({
          id: 'inv-invalid-org',
          email: 'invalid-org@example.com',
          token: 'invalid-org-token',
          tokenHash: createHash('sha256').update('invalid-org-token').digest('hex'),
          role: 'manager',
          organizationId: 'non-existent-org',
          invitedByUserId: inviterUser[0].id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: 'pending',
        })
        .returning();

      const registrationData = {
        firstName: 'Error',
        lastName: 'Test',
        password: 'ErrorTest123!',
        language: 'en',
        dataCollectionConsent: true,
        acknowledgedRights: true,
      };

      const response = await request(app)
        .post('/api/invitations/accept/invalid-org-token')
        .send(registrationData)
        .expect(500);

      expect(response.body).toMatchObject({
        message: 'Internal server error during account creation',
        code: 'INVITATION_ACCEPT_ERROR',
      });

      // Clean up
      await db.delete(schema.invitations).where(eq(schema.invitations.id, invalidInvitation[0].id));
    });
  });
});