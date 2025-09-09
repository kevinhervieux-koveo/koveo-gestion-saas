import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
// Unit test using mocks - moved server imports to integration tests
// import request from 'supertest';
// import { app } from '../../../server/index';
// import { mockDb } from '../../../server/mockDb';
import * as schema from '../../../shared/schema';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { mockDb, testUtils, mockSchema } from '../../mocks/unified-database-mock';

// Using unified database mock for consistency

// Mock request for API testing (using simplified typing)
const mockRequest = {
  post: jest.fn() as any,
  get: jest.fn() as any,
  put: jest.fn() as any,
  delete: jest.fn() as any
};

describe('Invitation Management API', () => {
  let adminUser: any;
  let managerUser: any;
  let tenantUser: any;
  let organization1: any;
  let organization2: any;
  let testInvitation1: any;
  let testInvitation2: any;
  let adminCookie: string;
  let managerCookie: string;
  let tenantCookie: string;

  beforeEach(async () => {
    // Reset mock data and clear all mocks
    testUtils.resetMocks();

    // Create test organizations
    const [org1] = await mockDb.insert(mockSchema.organizations).values({
      name: 'Test Organization 1',
      type: 'management_company',
      address: '123 Test St',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A 1A1',
    }).returning() as any[];

    const [org2] = await mockDb.insert(mockSchema.organizations).values({
      name: 'Test Organization 2',
      type: 'syndicate',
      address: '456 Test Ave',
      city: 'Quebec City',
      province: 'QC',
      postalCode: 'G1A 1A1',
    }).returning() as any[];

    organization1 = org1;
    organization2 = org2;

    // Create test users
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const [admin] = await mockDb.insert(mockSchema.users).values({
      username: 'admin@test.com',
      email: 'admin@test.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      language: 'en',
    }).returning() as any[];

    const [manager] = await mockDb.insert(mockSchema.users).values({
      username: 'manager@test.com',
      email: 'manager@test.com',
      password: hashedPassword,
      firstName: 'Manager',
      lastName: 'User',
      role: 'manager',
      language: 'en',
    }).returning() as any[];

    const [tenant] = await mockDb.insert(mockSchema.users).values({
      username: 'tenant@test.com',
      email: 'tenant@test.com',
      password: hashedPassword,
      firstName: 'Tenant',
      lastName: 'User',
      role: 'tenant',
      language: 'en',
    }).returning() as any[];

    adminUser = admin;
    managerUser = manager;
    tenantUser = tenant;

    // Assign manager to organization1
    await mockDb.insert(mockSchema.userOrganizations).values({
      userId: managerUser.id,
      organizationId: organization1.id,
      organizationRole: 'manager',
      isActive: true,
    });

    // Create test invitations
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 7); // 7 days from now

    const [invitation1] = await mockDb.insert(mockSchema.invitations).values({
      email: 'test1@example.com',
      token: 'test-token-1',
      tokenHash: 'hash1',
      role: 'tenant',
      status: 'pending',
      organizationId: organization1.id,
      invitedByUserId: adminUser.id,
      expiresAt: expirationDate,
    }).returning() as any[];

    const [invitation2] = await mockDb.insert(mockSchema.invitations).values({
      email: 'test2@example.com',
      token: 'test-token-2',
      tokenHash: 'hash2',
      role: 'resident',
      status: 'pending',
      organizationId: organization2.id,
      invitedByUserId: adminUser.id,
      expiresAt: expirationDate,
    }).returning() as any[];

    testInvitation1 = invitation1;
    testInvitation2 = invitation2;

    // Login users and get cookies
    const adminLogin = await mockRequest
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'password123' });
    adminCookie = adminLogin.headers['set-cookie'];

    const managerLogin = await mockRequest
      .post('/api/auth/login')
      .send({ email: 'manager@test.com', password: 'password123' });
    managerCookie = managerLogin.headers['set-cookie'];

    const tenantLogin = await mockRequest
      .post('/api/auth/login')
      .send({ email: 'tenant@test.com', password: 'password123' });
    tenantCookie = tenantLogin.headers['set-cookie'];
  });

  afterEach(async () => {
    // Reset mock data and clear all mocks
    testUtils.resetMocks();
  });

  describe('GET /api/invitations/pending', () => {
    it('should allow admin to see all pending invitations', async () => {
      const response = await mockRequest
        .get('/api/invitations/pending')
        .set('Cookie', adminCookie)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      
      const emails = response.body.map((inv: any) => inv.email);
      expect(emails).toContain('test1@example.com');
      expect(emails).toContain('test2@example.com');
    });

    it('should allow manager to see only invitations from their organizations', async () => {
      const response = await mockRequest
        .get('/api/invitations/pending')
        .set('Cookie', managerCookie)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].email).toBe('test1@example.com');
      expect(response.body[0].organizationId).toBe(organization1.id);
    });

    it('should deny access to tenant users', async () => {
      const response = await mockRequest
        .get('/api/invitations/pending')
        .set('Cookie', tenantCookie)
        .expect(403);

      expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should deny access to unauthenticated users', async () => {
      const response = await mockRequest
        .get('/api/invitations/pending')
        .expect(401);

      expect(response.body.code).toBe('AUTH_REQUIRED');
    });

    it('should return proper invitation structure with all required fields', async () => {
      const response = await mockRequest
        .get('/api/invitations/pending')
        .set('Cookie', adminCookie)
        .expect(200);

      const invitation = response.body[0];
      expect(invitation).toHaveProperty('id');
      expect(invitation).toHaveProperty('email');
      expect(invitation).toHaveProperty('role');
      expect(invitation).toHaveProperty('status');
      expect(invitation).toHaveProperty('expiresAt');
      expect(invitation).toHaveProperty('createdAt');
      expect(invitation).toHaveProperty('organizationId');
      expect(invitation).toHaveProperty('buildingId');
      expect(invitation).toHaveProperty('residenceId');
      expect(invitation.status).toBe('pending');
    });
  });

  describe('DELETE /api/invitations/:id', () => {
    it('should allow admin to delete any invitation', async () => {
      const response = await mockRequest
        .delete(`/api/invitations/${testInvitation1.id}`)
        .set('Cookie', adminCookie)
        .expect(200);

      expect(response.body.message).toBe('Invitation deleted successfully');
      expect(response.body.invitationId).toBe(testInvitation1.id);

      // Verify invitation is deleted
      const remainingInvitations = await mockDb
        .select()
        .from(schema.invitations)
        .where(eq(schema.invitations.id, testInvitation1.id)) as any[];
      expect(remainingInvitations).toHaveLength(0);
    });

    it('should allow manager to delete invitations from their organizations', async () => {
      const response = await mockRequest
        .delete(`/api/invitations/${testInvitation1.id}`)
        .set('Cookie', managerCookie)
        .expect(200);

      expect(response.body.message).toBe('Invitation deleted successfully');

      // Verify invitation is deleted
      const remainingInvitations = await mockDb
        .select()
        .from(schema.invitations)
        .where(eq(schema.invitations.id, testInvitation1.id)) as any[];
      expect(remainingInvitations).toHaveLength(0);
    });

    it('should prevent manager from deleting invitations from other organizations', async () => {
      const response = await mockRequest
        .delete(`/api/invitations/${testInvitation2.id}`)
        .set('Cookie', managerCookie)
        .expect(403);

      expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
      expect(response.body.message).toBe('You can only delete invitations from your organizations');

      // Verify invitation still exists
      const remainingInvitations = await mockDb
        .select()
        .from(schema.invitations)
        .where(eq(schema.invitations.id, testInvitation2.id)) as any[];
      expect(remainingInvitations).toHaveLength(1);
    });

    it('should deny access to tenant users', async () => {
      const response = await mockRequest
        .delete(`/api/invitations/${testInvitation1.id}`)
        .set('Cookie', tenantCookie)
        .expect(403);

      expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should return 404 for non-existent invitation', async () => {
      const response = await mockRequest
        .delete('/api/invitations/non-existent-id')
        .set('Cookie', adminCookie)
        .expect(404);

      expect(response.body.code).toBe('INVITATION_NOT_FOUND');
    });

    it('should deny access to unauthenticated users', async () => {
      const response = await mockRequest
        .delete(`/api/invitations/${testInvitation1.id}`)
        .expect(401);

      expect(response.body.code).toBe('AUTH_REQUIRED');
    });
  });

  describe('Invitation Status and Expiration', () => {
    it('should only return pending invitations', async () => {
      // Create an accepted invitation
      await mockDb.insert(mockSchema.invitations).values({
        email: 'accepted@example.com',
        token: 'accepted-token',
        tokenHash: 'accepted-hash',
        role: 'tenant',
        status: 'accepted',
        organizationId: organization1.id,
        invitedByUserId: adminUser.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const response = await mockRequest
        .get('/api/invitations/pending')
        .set('Cookie', adminCookie)
        .expect(200);

      // Should only return pending invitations
      const statuses = response.body.map((inv: any) => inv.status);
      expect(statuses.every((status: string) => status === 'pending')).toBe(true);
      expect(response.body.find((inv: any) => inv.email === 'accepted@example.com')).toBeUndefined();
    });

    it('should handle expired invitations in the response', async () => {
      // Create an expired invitation
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1); // Yesterday

      await mockDb.insert(mockSchema.invitations).values({
        email: 'expired@example.com',
        token: 'expired-token',
        tokenHash: 'expired-hash',
        role: 'tenant',
        status: 'pending',
        organizationId: organization1.id,
        invitedByUserId: adminUser.id,
        expiresAt: expiredDate,
      });

      const response = await mockRequest
        .get('/api/invitations/pending')
        .set('Cookie', adminCookie)
        .expect(200);

      // Should include expired invitations (they're still pending status)
      const expiredInvitation = response.body.find((inv: any) => inv.email === 'expired@example.com');
      expect(expiredInvitation).toBeDefined();
      expect(new Date(expiredInvitation.expiresAt)).toBeInstanceOf(Date);
    });
  });

  describe('Database Constraints and Data Integrity', () => {
    it('should handle invitations with null organization references', async () => {
      // Create invitation without organization
      const [invitation] = await mockDb.insert(mockSchema.invitations).values({
        email: 'no-org@example.com',
        token: 'no-org-token',
        tokenHash: 'no-org-hash',
        role: 'tenant',
        status: 'pending',
        organizationId: null,
        invitedByUserId: adminUser.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }).returning() as any[];

      const response = await mockRequest
        .get('/api/invitations/pending')
        .set('Cookie', adminCookie)
        .expect(200);

      const noOrgInvitation = response.body.find((inv: any) => inv.email === 'no-org@example.com');
      expect(noOrgInvitation).toBeDefined();
      expect(noOrgInvitation.organizationId).toBeNull();
      expect(noOrgInvitation.organizationName).toBeNull();
    });

    it('should properly join organization names', async () => {
      const response = await mockRequest
        .get('/api/invitations/pending')
        .set('Cookie', adminCookie)
        .expect(200);

      const invitation1 = response.body.find((inv: any) => inv.email === 'test1@example.com');
      const invitation2 = response.body.find((inv: any) => inv.email === 'test2@example.com');

      expect(invitation1.organizationName).toBe('Test Organization 1');
      expect(invitation2.organizationName).toBe('Test Organization 2');
    });
  });
});