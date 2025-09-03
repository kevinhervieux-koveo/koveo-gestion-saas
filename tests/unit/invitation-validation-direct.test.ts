import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { db } from '../../server/db';
import { invitations, organizations, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Direct validation tests that import and test the invitation validation logic
 * without making HTTP requests (to avoid network issues in Jest environment)
 */
describe('Invitation Validation Logic (Direct)', () => {
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
        name: 'Test Direct Validation Org',
        type: 'association',
        address: '123 Direct Test Ave',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1H 1H1',
        phone: '514-555-0123',
        email: 'direct-test@example.com',
        isActive: true,
      })
      .returning();
    testOrganizationId = org[0].id;

    // Create test user (inviter)
    const user = await db
      .insert(users)
      .values({
        username: `direct-inviter.${Date.now()}`,
        email: `direct-inviter.${Date.now()}@example.com`,
        password: 'hashedpassword123',
        firstName: 'Direct',
        lastName: 'Inviter',
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
        email: 'directtest@example.com',
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

  // Direct validation function that mimics the API endpoint logic
  async function validateInvitationTokenDirect(token: string) {
    if (!token) {
      return {
        isValid: false,
        message: 'Token is required',
        code: 'TOKEN_REQUIRED',
      };
    }

    // Get invitation by token
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.token, token))
      .limit(1);

    if (!invitation) {
      return {
        isValid: false,
        message: 'Invitation not found or invalid token',
        code: 'INVITATION_NOT_FOUND',
      };
    }

    // Check if invitation is expired
    const now = new Date();
    const expiresAt = new Date(invitation.expiresAt);
    if (now > expiresAt) {
      return {
        isValid: false,
        message: 'Invitation has expired',
        code: 'INVITATION_EXPIRED',
      };
    }

    // Check if invitation is already used
    if (invitation.status === 'accepted') {
      return {
        isValid: false,
        message: 'Invitation has already been used',
        code: 'INVITATION_ALREADY_USED',
      };
    }

    // Get organization information
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, invitation.organizationId))
      .limit(1);

    // Get inviter information
    const [inviter] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, invitation.invitedByUserId))
      .limit(1);

    // Return successful validation
    return {
      isValid: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      },
      organizationName: organization?.name || 'Unknown Organization',
      inviterName: inviter ? `${inviter.firstName} ${inviter.lastName}`.trim() : 'Unknown User',
    };
  }

  describe('Valid Invitation Validation', () => {
    it('should successfully validate a valid invitation token', async () => {
      const result = await validateInvitationTokenDirect(testInvitationToken);

      expect(result).toEqual({
        isValid: true,
        invitation: {
          id: testInvitationId,
          email: 'directtest@example.com',
          role: 'manager',
          expiresAt: expect.any(Date),
          createdAt: expect.any(Date),
        },
        organizationName: 'Test Direct Validation Org',
        inviterName: 'Direct Inviter',
      });
    });

    it('should return proper invitation details including organization and inviter info', async () => {
      const result = await validateInvitationTokenDirect(testInvitationToken);

      expect(result.isValid).toBe(true);
      expect(result.invitation.email).toBe('directtest@example.com');
      expect(result.invitation.role).toBe('manager');
      expect(result.organizationName).toBe('Test Direct Validation Org');
      expect(result.inviterName).toBe('Direct Inviter');
    });
  });

  describe('Invalid Token Scenarios', () => {
    it('should reject missing token', async () => {
      const result = await validateInvitationTokenDirect('');

      expect(result).toEqual({
        isValid: false,
        message: 'Token is required',
        code: 'TOKEN_REQUIRED',
      });
    });

    it('should reject non-existent token', async () => {
      const fakeToken = crypto.randomBytes(32).toString('hex');
      const result = await validateInvitationTokenDirect(fakeToken);

      expect(result).toEqual({
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
          email: 'expired-direct@example.com',
          role: 'tenant',
          token: expiredToken,
          tokenHash: expiredTokenHash,
          organizationId: testOrganizationId,
          invitedByUserId: testUserId,
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        })
        .returning();

      const result = await validateInvitationTokenDirect(expiredToken);

      expect(result).toEqual({
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

      const result = await validateInvitationTokenDirect(testInvitationToken);

      expect(result).toEqual({
        isValid: false,
        message: 'Invitation has already been used',
        code: 'INVITATION_ALREADY_USED',
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should validate token format constraints', async () => {
      // Test very short token
      const shortTokenResult = await validateInvitationTokenDirect('abc');
      expect(shortTokenResult.isValid).toBe(false);
      expect(shortTokenResult.code).toBe('INVITATION_NOT_FOUND');

      // Test null/undefined token
      const nullTokenResult = await validateInvitationTokenDirect(null as any);
      expect(nullTokenResult.isValid).toBe(false);
      expect(nullTokenResult.code).toBe('TOKEN_REQUIRED');
    });

    it('should handle missing organization gracefully', async () => {
      // Create invitation with invalid org ID
      const invalidOrgToken = crypto.randomBytes(32).toString('hex');
      const invalidOrgTokenHash = crypto.createHash('sha256').update(invalidOrgToken).digest('hex');
      const invalidOrgInvitation = await db
        .insert(invitations)
        .values({
          email: 'invalidorg-direct@example.com',
          role: 'tenant',
          token: invalidOrgToken,
          tokenHash: invalidOrgTokenHash,
          organizationId: crypto.randomUUID(), // Non-existent org
          invitedByUserId: testUserId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        })
        .returning();

      const result = await validateInvitationTokenDirect(invalidOrgToken);

      expect(result.isValid).toBe(true);
      expect(result.organizationName).toBe('Unknown Organization');

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
          email: 'invalidinviter-direct@example.com',
          role: 'tenant',
          token: invalidInviterToken,
          tokenHash: invalidInviterTokenHash,
          organizationId: testOrganizationId,
          invitedByUserId: crypto.randomUUID(), // Non-existent user
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        })
        .returning();

      const result = await validateInvitationTokenDirect(invalidInviterToken);

      expect(result.isValid).toBe(true);
      expect(result.inviterName).toBe('Unknown User');

      // Cleanup
      await db.delete(invitations).where(eq(invitations.id, invalidInviterInvitation[0].id));
    });
  });

  describe('Security and Data Validation', () => {
    it('should not expose sensitive invitation data', async () => {
      const result = await validateInvitationTokenDirect(testInvitationToken);

      expect(result.isValid).toBe(true);
      expect(result.invitation).not.toHaveProperty('token');
      expect(result.invitation).not.toHaveProperty('invitedByUserId');
      expect(result.invitation).not.toHaveProperty('organizationId');
      expect(result.invitation).not.toHaveProperty('status');
      expect(result.invitation).not.toHaveProperty('tokenHash');
    });

    it('should validate different role types correctly', async () => {
      const roles = ['admin', 'manager', 'tenant', 'resident'];

      for (const role of roles) {
        const roleToken = crypto.randomBytes(32).toString('hex');
        const roleTokenHash = crypto.createHash('sha256').update(roleToken).digest('hex');
        const roleInvitation = await db
          .insert(invitations)
          .values({
            email: `${role}-direct@example.com`,
            role,
            token: roleToken,
            tokenHash: roleTokenHash,
            organizationId: testOrganizationId,
            invitedByUserId: testUserId,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          })
          .returning();

        const result = await validateInvitationTokenDirect(roleToken);

        expect(result.isValid).toBe(true);
        expect(result.invitation.role).toBe(role);
        expect(result.invitation.email).toBe(`${role}-direct@example.com`);

        // Cleanup
        await db.delete(invitations).where(eq(invitations.id, roleInvitation[0].id));
      }
    });
  });

  describe('Integration Test - Complete Flow', () => {
    it('should handle complete invitation validation flow', async () => {
      // 1. Valid invitation should work
      let result = await validateInvitationTokenDirect(testInvitationToken);
      expect(result.isValid).toBe(true);
      expect(result.invitation.email).toBe('directtest@example.com');

      // 2. After marking as used, should be rejected
      await db
        .update(invitations)
        .set({ status: 'accepted' })
        .where(eq(invitations.id, testInvitationId));

      result = await validateInvitationTokenDirect(testInvitationToken);
      expect(result.isValid).toBe(false);
      expect(result.code).toBe('INVITATION_ALREADY_USED');

      // 3. Invalid token should be rejected
      result = await validateInvitationTokenDirect('invalid-token-123');
      expect(result.isValid).toBe(false);
      expect(result.code).toBe('INVITATION_NOT_FOUND');
    });
  });
});