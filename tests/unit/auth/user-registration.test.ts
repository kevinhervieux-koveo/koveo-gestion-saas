import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { registerRoutes } from '../../../server/routes';
import { db } from '../../../server/db';
import * as schema from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

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

describe('User Registration via Invitation', () => {
  let app: express.Application;
  let testInvitation: any;
  let testOrganization: any;
  let inviterUser: any;

  beforeEach(async () => {
    app = createTestApp();
    
    // Skip database operations in test environment - use mock data instead
    if (process.env.TEST_TYPE === 'unit') {
      // Mock test data for unit tests
      testOrganization = [{ 
        id: 'mock-org-id-123',
        name: 'Test Registration Org',
        type: 'syndicate',
        address: '123 Test St',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A 1A1',
      }];
    } else {
      // Real database operations for integration tests
      // Clean up any existing test data
      await db.delete(schema.invitations).where(eq(schema.invitations.email, 'test-registration@example.com'));
      await db.delete(schema.users).where(eq(schema.users.email, 'test-registration@example.com'));

      // Create test organization
      testOrganization = await db
        .insert(schema.organizations)
        .values({
          name: 'Test Registration Org',
          type: 'syndicate',
          address: '123 Test St',
          city: 'Montreal',
          province: 'QC',
          postalCode: 'H1A 1A1',
        })
        .returning();
    }

    // Create inviter user and invitation
    if (process.env.TEST_TYPE === 'unit') {
      // Mock test data for unit tests
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
    } else {
      // Real database operations for integration tests
      inviterUser = await db
        .insert(schema.users)
        .values({
          username: 'testinviter',
          email: 'inviter@test.com',
          firstName: 'Test',
          lastName: 'Inviter',
          password: await bcrypt.hash('password123', 12),
          role: 'admin',
        })
        .returning();

      // Create test invitation
      const token = 'test-registration-token-123';
      const tokenHash = createHash('sha256').update(token).digest('hex');
      
      testInvitation = await db
        .insert(schema.invitations)
        .values({
          email: 'test-registration@example.com',
          token,
          tokenHash,
          role: 'manager',
          organizationId: testOrganization[0].id,
          invitedByUserId: inviterUser[0].id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          status: 'pending',
        })
        .returning();
    }
  });

  afterEach(async () => {
    // Clean up test data
    if (process.env.TEST_TYPE === 'unit') {
      // Skip cleanup for unit tests - no real data was created
      return;
    }
    
    // Real database cleanup for integration tests
    await db.delete(schema.invitations).where(eq(schema.invitations.email, 'test-registration@example.com'));
    await db.delete(schema.users).where(eq(schema.users.email, 'test-registration@example.com'));
    await db.delete(schema.users).where(eq(schema.users.email, 'inviter@test.com'));
    if (testOrganization?.[0]?.id) {
      await db.delete(schema.userOrganizations).where(eq(schema.userOrganizations.organizationId, testOrganization[0].id));
      await db.delete(schema.organizations).where(eq(schema.organizations.id, testOrganization[0].id));
    }
  });

  describe('Invitation Token Validation', () => {
    it('should validate a valid invitation token', async () => {
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
      // Update invitation to be expired
      await db
        .update(schema.invitations)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(schema.invitations.id, testInvitation[0].id));

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
      // Mark invitation as accepted
      await db
        .update(schema.invitations)
        .set({ status: 'accepted', acceptedAt: new Date() })
        .where(eq(schema.invitations.id, testInvitation[0].id));

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
      // First registration
      const firstRegistration = {
        firstName: 'First',
        lastName: 'User',
        password: 'FirstPass123!',
        language: 'en',
        dataCollectionConsent: true,
        acknowledgedRights: true,
      };

      await request(app)
        .post('/api/invitations/accept/test-registration-token-123')
        .send(firstRegistration)
        .expect(201);

      // Second registration attempt with same token
      const secondRegistration = {
        firstName: 'Second',
        lastName: 'User',
        password: 'SecondPass456!',
        language: 'fr',
        dataCollectionConsent: true,
        acknowledgedRights: true,
      };

      const response = await request(app)
        .post('/api/invitations/accept/test-registration-token-123')
        .send(secondRegistration)
        .expect(410);

      expect(response.body).toMatchObject({
        message: 'Invitation has already been used',
        code: 'INVITATION_USED',
      });
    });

    it('should prevent registration if user already exists with email', async () => {
      // Create existing user with same email
      await db.insert(schema.users).values({
        username: 'existinguser',
        email: 'test-registration@example.com',
        firstName: 'Existing',
        lastName: 'User',
        password: await bcrypt.hash('ExistingPass123!', 12),
        role: 'tenant',
      });

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

      // Clean up
      await db.delete(schema.users).where(eq(schema.users.email, 'test-registration@example.com'));
    });
  });

  describe('Password Security', () => {
    it('should properly hash passwords using bcrypt', async () => {
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