import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as schema from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { mockDb, testUtils, mockSchema } from '../../mocks/unified-database-mock';

describe('Invitation Table Integration Tests', () => {
  let adminUser: any;
  let managerUser: any;
  let organization1: any;
  let organization2: any;

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
    } as any).returning() as any[];

    const [org2] = await mockDb.insert(mockSchema.organizations).values({
      name: 'Test Organization 2',
      type: 'syndicate',
      address: '456 Test Ave',
      city: 'Quebec City',
      province: 'QC',
      postalCode: 'G1A 1A1',
    } as any).returning() as any[];

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
    } as any).returning() as any[];

    const [manager] = await mockDb.insert(mockSchema.users).values({
      username: 'manager@test.com',
      email: 'manager@test.com',
      password: hashedPassword,
      firstName: 'Manager',
      lastName: 'User',
      role: 'manager',
    } as any).returning() as any[];

    adminUser = admin;
    managerUser = manager;

    // Assign manager to organization1
    await mockDb.insert(mockSchema.userOrganizations).values({
      userId: managerUser.id,
      organizationId: organization1.id,
      organizationRole: 'manager',
      isActive: true,
    } as any) as any;
  });

  afterEach(async () => {
    // Clean up test data
    await mockDb.delete(mockSchema.invitations) as any;
    await mockDb.delete(mockSchema.userOrganizations) as any;
    await mockDb.delete(mockSchema.users) as any;
    await mockDb.delete(mockSchema.organizations) as any;
  });

  describe('Invitation Data Validation', () => {
    it('should create invitations with required fields', async () => {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7);

      const [invitation] = await mockDb.insert(mockSchema.invitations).values({
        email: 'test@example.com',
        token: 'test-token',
        tokenHash: 'test-hash',
        role: 'tenant',
        status: 'pending',
        organizationId: organization1.id,
        invitedByUserId: adminUser.id,
        expiresAt: expirationDate,
      } as any).returning() as any[];

      expect(invitation).toBeDefined();
      expect(invitation.id).toBeDefined();
      expect(invitation.email).toBe('test@example.com');
      expect(invitation.role).toBe('tenant');
      expect(invitation.status).toBe('pending');
      expect(invitation.organizationId).toBe(organization1.id);
    });

    it('should handle invitations with null building and residence references', async () => {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7);

      const [invitation] = await mockDb.insert(mockSchema.invitations).values({
        email: 'test@example.com',
        token: 'test-token',
        tokenHash: 'test-hash',
        role: 'tenant',
        status: 'pending',
        organizationId: organization1.id,
        buildingId: null,
        residenceId: null,
        invitedByUserId: adminUser.id,
        expiresAt: expirationDate,
      } as any).returning() as any[];

      expect(invitation.buildingId).toBeNull();
      expect(invitation.residenceId).toBeNull();
    });

    it('should validate invitation roles', async () => {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7);

      const validRoles = ['admin', 'manager', 'tenant', 'resident', 'demo_manager', 'demo_tenant', 'demo_resident'];

      for (const role of validRoles) {
        const [invitation] = await mockDb.insert(mockSchema.invitations).values({
          email: `test-${role}@example.com`,
          token: `test-token-${role}`,
          tokenHash: `test-hash-${role}`,
          role: role as any,
          status: 'pending',
          organizationId: organization1.id,
          invitedByUserId: adminUser.id,
          expiresAt: expirationDate,
        } as any).returning() as any[];

        expect(invitation.role).toBe(role);
      }
    });

    it('should validate invitation status values', async () => {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7);

      const validStatuses = ['pending', 'accepted', 'expired', 'cancelled'];

      for (const status of validStatuses) {
        const [invitation] = await mockDb.insert(mockSchema.invitations).values({
          email: `test-${status}@example.com`,
          token: `test-token-${status}`,
          tokenHash: `test-hash-${status}`,
          role: 'tenant',
          status: status as any,
          organizationId: organization1.id,
          invitedByUserId: adminUser.id,
          expiresAt: expirationDate,
        } as any).returning() as any[];

        expect(invitation.status).toBe(status);
      }
    });
  });

  describe('Invitation Queries and Filtering', () => {
    beforeEach(async () => {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7);

      // Create test invitations
      await mockDb.insert(mockSchema.invitations).values([
        {
          email: 'pending1@example.com',
          token: 'token1',
          tokenHash: 'hash1',
          role: 'tenant',
          status: 'pending',
          organizationId: organization1.id,
          invitedByUserId: adminUser.id,
          expiresAt: expirationDate,
        },
        {
          email: 'pending2@example.com',
          token: 'token2',
          tokenHash: 'hash2',
          role: 'resident',
          status: 'pending',
          organizationId: organization2.id,
          invitedByUserId: adminUser.id,
          expiresAt: expirationDate,
        },
        {
          email: 'accepted@example.com',
          token: 'token3',
          tokenHash: 'hash3',
          role: 'tenant',
          status: 'accepted',
          organizationId: organization1.id,
          invitedByUserId: adminUser.id,
          expiresAt: expirationDate,
        },
      ] as any) as any;
    });

    it('should filter pending invitations correctly', async () => {
      const pendingInvitations = await mockDb
        .select()
        .from(mockSchema.invitations)
        .where(eq(mockSchema.invitations.status, 'pending')) as any[];

      expect(pendingInvitations).toHaveLength(2);
      expect(pendingInvitations.every(inv => inv.status === 'pending')).toBe(true);
    });

    it('should join with organizations table for admin view', async () => {
      const invitationsWithOrgs = await mockDb
        .select({
          id: schema.invitations.id,
          email: schema.invitations.email,
          role: schema.invitations.role,
          status: schema.invitations.status,
          organizationName: schema.organizations.name,
        })
        .from(schema.invitations)
        .leftJoin(schema.organizations, eq(schema.invitations.organizationId, schema.organizations.id))
        .where(eq(schema.invitations.status, 'pending')) as any[];

      expect(invitationsWithOrgs).toHaveLength(2);
      
      const org1Invitation = invitationsWithOrgs.find(inv => inv.email === 'pending1@example.com');
      const org2Invitation = invitationsWithOrgs.find(inv => inv.email === 'pending2@example.com');

      expect(org1Invitation?.organizationName).toBe('Test Organization 1');
      expect(org2Invitation?.organizationName).toBe('Test Organization 2');
    });

    it('should filter invitations by organization for manager view', async () => {
      const managerInvitations = await mockDb
        .select()
        .from(mockSchema.invitations)
        .where(
          eq(mockSchema.invitations.organizationId, organization1.id)
        ) as any[];

      expect(managerInvitations).toHaveLength(2); // 1 pending + 1 accepted from org1
      expect(managerInvitations.every(inv => inv.organizationId === organization1.id)).toBe(true);
    });
  });

  describe('Invitation Deletion', () => {
    let testInvitation: any;

    beforeEach(async () => {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7);

      const [invitation] = await mockDb.insert(mockSchema.invitations).values({
        email: 'delete-test@example.com',
        token: 'delete-token',
        tokenHash: 'delete-hash',
        role: 'tenant',
        status: 'pending',
        organizationId: organization1.id,
        invitedByUserId: adminUser.id,
        expiresAt: expirationDate,
      } as any).returning() as any[];

      testInvitation = invitation;
    });

    it('should successfully delete invitation', async () => {
      // Verify invitation exists
      const beforeDelete = await mockDb
        .select()
        .from(mockSchema.invitations)
        .where(eq(mockSchema.invitations.id, testInvitation.id)) as any[];

      expect(beforeDelete).toHaveLength(1);

      // Delete invitation
      await mockDb
        .delete(mockSchema.invitations)
        .where(eq(mockSchema.invitations.id, testInvitation.id)) as any;

      // Verify invitation is deleted
      const afterDelete = await mockDb
        .select()
        .from(mockSchema.invitations)
        .where(eq(mockSchema.invitations.id, testInvitation.id)) as any[];

      expect(afterDelete).toHaveLength(0);
    });

    it('should handle deletion of non-existent invitation', async () => {
      // Try to delete non-existent invitation
      const result = await mockDb
        .delete(mockSchema.invitations)
        .where(eq(mockSchema.invitations.id, 'non-existent-id')) as any;

      // Should not throw error, just return 0 affected rows
      expect(result).toBeDefined();
    });
  });

  describe('Invitation Expiration', () => {
    it('should handle expired invitations', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1); // Yesterday

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7); // Next week

      await mockDb.insert(mockSchema.invitations).values([
        {
          email: 'expired@example.com',
          token: 'expired-token',
          tokenHash: 'expired-hash',
          role: 'tenant',
          status: 'pending',
          organizationId: organization1.id,
          invitedByUserId: adminUser.id,
          expiresAt: expiredDate,
        },
        {
          email: 'valid@example.com',
          token: 'valid-token',
          tokenHash: 'valid-hash',
          role: 'tenant',
          status: 'pending',
          organizationId: organization1.id,
          invitedByUserId: adminUser.id,
          expiresAt: futureDate,
        },
      ] as any) as any;

      // Get all pending invitations
      const allPending = await mockDb
        .select()
        .from(mockSchema.invitations)
        .where(eq(mockSchema.invitations.status, 'pending')) as any[];

      expect(allPending).toHaveLength(2);

      // Check expiration dates
      const expiredInvitation = allPending.find(inv => inv.email === 'expired@example.com');
      const validInvitation = allPending.find(inv => inv.email === 'valid@example.com');

      expect(expiredInvitation?.expiresAt).toBeInstanceOf(Date);
      expect(validInvitation?.expiresAt).toBeInstanceOf(Date);
      expect(expiredInvitation!.expiresAt < new Date()).toBe(true);
      expect(validInvitation!.expiresAt > new Date()).toBe(true);
    });
  });

  describe('Database Constraints', () => {
    it('should enforce unique token constraint', async () => {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7);

      // Create first invitation
      await mockDb.insert(mockSchema.invitations).values({
        email: 'first@example.com',
        token: 'unique-token',
        tokenHash: 'hash1',
        role: 'tenant',
        status: 'pending',
        organizationId: organization1.id,
        invitedByUserId: adminUser.id,
        expiresAt: expirationDate,
      } as any) as any;

      // Try to create second invitation with same token
      await expect(async () => {
        await mockDb.insert(mockSchema.invitations).values({
          email: 'second@example.com',
          token: 'unique-token', // Same token
          tokenHash: 'hash2',
          role: 'tenant',
          status: 'pending',
          organizationId: organization1.id,
          invitedByUserId: adminUser.id,
          expiresAt: expirationDate,
        } as any) as any;
      }).rejects.toThrow();
    });

    it('should allow null values for optional fields', async () => {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7);

      const [invitation] = await mockDb.insert(mockSchema.invitations).values({
        email: 'null-test@example.com',
        token: 'null-token',
        tokenHash: 'null-hash',
        role: 'tenant',
        status: 'pending',
        organizationId: null, // Allow null
        buildingId: null,     // Allow null
        residenceId: null,    // Allow null
        invitedByUserId: adminUser.id,
        expiresAt: expirationDate,
      } as any).returning() as any[];

      expect(invitation.organizationId).toBeNull();
      expect(invitation.buildingId).toBeNull();
      expect(invitation.residenceId).toBeNull();
    });
  });
});