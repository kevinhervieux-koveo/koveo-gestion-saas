import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { db } from '../../server/db';
import { invitations, organizations, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

describe('Invitation Validation API', () => {
  let testOrganizationId: string;
  let testUserId: string;
  let testInvitationId: string;
  let testInvitationToken: string;

  beforeEach(async () => {
    // Clean up previous test data
    await cleanup();

    // Create test organization
    const org = await db
      .insert(organizations)
      .values({
        name: 'Test Invitation Validation Org',
        type: 'association',
        address: '123 Test Ave',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1H 1H1',
        phone: '514-555-0123',
        email: 'test@example.com',
        isActive: true,
      })
      .returning();
    testOrganizationId = org[0].id;

    // Create test user (inviter)
    const user = await db
      .insert(users)
      .values({
        username: `inviter.${Date.now()}`,
        email: `inviter.${Date.now()}@example.com`,
        password: 'hashedpassword123',
        firstName: 'Inviter',
        lastName: 'User',
        role: 'admin',
        isActive: true,
      })
      .returning();
    testUserId = user[0].id;

    // Create test invitation
    testInvitationToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(testInvitationToken).digest('hex');
    const invitation = await db
      .insert(invitations)
      .values({
        email: 'newuser@example.com',
        role: 'manager',
        token: testInvitationToken,
        tokenHash: tokenHash,
        organizationId: testOrganizationId,
        invitedByUserId: testUserId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      })
      .returning();
    testInvitationId = invitation[0].id;
  });

  afterEach(async () => {
    await cleanup();
  });

  async function cleanup() {
    if (testInvitationId) {
      await db.delete(invitations).where(eq(invitations.id, testInvitationId));
    }
    if (testUserId) {
      await db.update(users)
        .set({ isActive: false })
        .where(eq(users.id, testUserId));
    }
    if (testOrganizationId) {
      await db.delete(organizations).where(eq(organizations.id, testOrganizationId));
    }
  }

  // Helper function to make API request
  async function validateInvitationToken(token: string) {
    const response = await fetch('http://localhost:5000/api/invitations/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    return {
      status: response.status,
      data: await response.json(),
    };
  }

  describe('Valid Invitation Validation', () => {
    it('should successfully validate a valid invitation token', async () => {
      const result = await validateInvitationToken(testInvitationToken);

      expect(result.status).toBe(200);
      expect(result.data).toEqual({
        isValid: true,
        invitation: {
          id: testInvitationId,
          email: 'newuser@example.com',
          role: 'manager',
          expiresAt: expect.any(String),
          createdAt: expect.any(String),
        },
        organizationName: 'Test Invitation Validation Org',
        inviterName: 'Inviter User',
      });
    });

    it('should return proper invitation details including organization and inviter info', async () => {
      const result = await validateInvitationToken(testInvitationToken);

      expect(result.status).toBe(200);
      expect(result.data.isValid).toBe(true);
      expect(result.data.invitation.email).toBe('newuser@example.com');
      expect(result.data.invitation.role).toBe('manager');
      expect(result.data.organizationName).toBe('Test Invitation Validation Org');
      expect(result.data.inviterName).toBe('Inviter User');
    });
  });

  describe('Invalid Token Scenarios', () => {
    it('should reject missing token', async () => {
      const response = await fetch('http://localhost:5000/api/invitations/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const result = {
        status: response.status,
        data: await response.json(),
      };

      expect(result.status).toBe(400);
      expect(result.data).toEqual({
        isValid: false,
        message: 'Token is required',
        code: 'TOKEN_REQUIRED',
      });
    });

    it('should reject non-existent token', async () => {
      const fakeToken = crypto.randomBytes(32).toString('hex');
      const result = await validateInvitationToken(fakeToken);

      expect(result.status).toBe(404);
      expect(result.data).toEqual({
        isValid: false,
        message: 'Invitation not found or invalid token',
        code: 'INVITATION_NOT_FOUND',
      });
    });
  });

  describe('Expired Invitation Scenarios', () => {
    it('should reject expired invitation', async () => {
      // Create an expired invitation
      const expiredToken = crypto.randomBytes(32).toString('hex');
      const expiredTokenHash = crypto.createHash('sha256').update(expiredToken).digest('hex');
      const expiredInvitation = await db
        .insert(invitations)
        .values({
          email: 'expired@example.com',
          role: 'tenant',
          token: expiredToken,
          tokenHash: expiredTokenHash,
          organizationId: testOrganizationId,
          invitedByUserId: testUserId,
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        })
        .returning();

      const result = await validateInvitationToken(expiredToken);

      expect(result.status).toBe(400);
      expect(result.data).toEqual({
        isValid: false,
        message: 'Invitation has expired',
        code: 'INVITATION_EXPIRED',
      });

      // Cleanup
      await db.delete(invitations).where(eq(invitations.id, expiredInvitation[0].id));
    });
  });

  describe('Used Invitation Scenarios', () => {
    it('should reject already used invitation', async () => {
      // Mark the invitation as used
      await db
        .update(invitations)
        .set({ status: 'accepted' })
        .where(eq(invitations.id, testInvitationId));

      const result = await validateInvitationToken(testInvitationToken);

      expect(result.status).toBe(400);
      expect(result.data).toEqual({
        isValid: false,
        message: 'Invitation has already been used',
        code: 'INVITATION_ALREADY_USED',
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await fetch('http://localhost:5000/api/invitations/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      });

      expect(response.status).toBe(400);
    });

    it('should validate token format constraints', async () => {
      // Test empty string token
      const emptyTokenResult = await validateInvitationToken('');
      expect(emptyTokenResult.status).toBe(400);
      expect(emptyTokenResult.data.code).toBe('TOKEN_REQUIRED');

      // Test very short token
      const shortTokenResult = await validateInvitationToken('abc');
      expect(shortTokenResult.status).toBe(404);
      expect(shortTokenResult.data.code).toBe('INVITATION_NOT_FOUND');
    });

    it('should handle missing organization gracefully', async () => {
      // Create invitation with invalid org ID
      const invalidOrgToken = crypto.randomBytes(32).toString('hex');
      const invalidOrgTokenHash = crypto.createHash('sha256').update(invalidOrgToken).digest('hex');
      const invalidOrgInvitation = await db
        .insert(invitations)
        .values({
          email: 'invalidorg@example.com',
          role: 'tenant',
          token: invalidOrgToken,
          tokenHash: invalidOrgTokenHash,
          organizationId: crypto.randomUUID(), // Non-existent org
          invitedByUserId: testUserId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        })
        .returning();

      const result = await validateInvitationToken(invalidOrgToken);

      expect(result.status).toBe(200);
      expect(result.data.isValid).toBe(true);
      expect(result.data.organizationName).toBe('Unknown Organization');

      // Cleanup
      await db.delete(invitations).where(eq(invitations.id, invalidOrgInvitation[0].id));
    });

    it('should handle missing inviter gracefully', async () => {
      // Create invitation with invalid inviter ID
      const invalidInviterToken = crypto.randomBytes(32).toString('hex');
      const invalidInviterTokenHash = crypto.createHash('sha256').update(invalidInviterToken).digest('hex');
      const invalidInviterInvitation = await db
        .insert(invitations)
        .values({
          email: 'invalidinviter@example.com',
          role: 'tenant',
          token: invalidInviterToken,
          tokenHash: invalidInviterTokenHash,
          organizationId: testOrganizationId,
          invitedByUserId: crypto.randomUUID(), // Non-existent user
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        })
        .returning();

      const result = await validateInvitationToken(invalidInviterToken);

      expect(result.status).toBe(200);
      expect(result.data.isValid).toBe(true);
      expect(result.data.inviterName).toBe('Unknown User');

      // Cleanup
      await db.delete(invitations).where(eq(invitations.id, invalidInviterInvitation[0].id));
    });
  });

  describe('Security and Performance', () => {
    it('should not expose sensitive invitation data', async () => {
      const result = await validateInvitationToken(testInvitationToken);

      expect(result.status).toBe(200);
      expect(result.data.invitation).not.toHaveProperty('token');
      expect(result.data.invitation).not.toHaveProperty('invitedByUserId');
      expect(result.data.invitation).not.toHaveProperty('organizationId');
      expect(result.data.invitation).not.toHaveProperty('status');
    });

    it('should respond within reasonable time limits', async () => {
      const startTime = Date.now();
      const result = await validateInvitationToken(testInvitationToken);
      const endTime = Date.now();

      expect(result.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(5000); // Should respond within 5 seconds
    });
  });

  describe('Integration with Frontend Flow', () => {
    it('should return data structure expected by frontend', async () => {
      const result = await validateInvitationToken(testInvitationToken);

      expect(result.status).toBe(200);
      expect(result.data).toHaveProperty('isValid', true);
      expect(result.data).toHaveProperty('invitation');
      expect(result.data).toHaveProperty('organizationName');
      expect(result.data).toHaveProperty('inviterName');

      // Verify invitation object structure matches frontend expectations
      const invitation = result.data.invitation;
      expect(invitation).toHaveProperty('id');
      expect(invitation).toHaveProperty('email');
      expect(invitation).toHaveProperty('role');
      expect(invitation).toHaveProperty('expiresAt');
      expect(invitation).toHaveProperty('createdAt');
    });

    it('should validate different role types correctly', async () => {
      const roles = ['admin', 'manager', 'tenant', 'resident'];

      for (const role of roles) {
        const roleToken = crypto.randomBytes(32).toString('hex');
        const roleTokenHash = crypto.createHash('sha256').update(roleToken).digest('hex');
        const roleInvitation = await db
          .insert(invitations)
          .values({
            email: `${role}@example.com`,
            role,
            token: roleToken,
            tokenHash: roleTokenHash,
            organizationId: testOrganizationId,
            invitedByUserId: testUserId,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          })
          .returning();

        const result = await validateInvitationToken(roleToken);

        expect(result.status).toBe(200);
        expect(result.data.isValid).toBe(true);
        expect(result.data.invitation.role).toBe(role);
        expect(result.data.invitation.email).toBe(`${role}@example.com`);

        // Cleanup
        await db.delete(invitations).where(eq(invitations.id, roleInvitation[0].id));
      }
    });
  });
});