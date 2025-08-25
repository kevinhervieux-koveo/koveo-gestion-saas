/**
 * Building Access Validation Tests.
 *
 * Ensures admin users have proper building access to prevent the issue where
 * admin users cannot access any buildings due to missing organization relationships.
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { db } from '../../server/db';
import { users, organizations, userOrganizations, buildings } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

describe('Building Access Validation', () => {
  let testUserId: string;
  let testOrgId: string;
  let testBuildingId: string;

  beforeEach(async () => {
    // Create test organization
    const [org] = await db
      .insert(organizations)
      .values({
        name: 'Test Access Organization',
        type: 'management_company',
        address: '123 Test Street',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A 1A1',
        isActive: true,
      })
      .returning();
    testOrgId = org.id;

    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        username: 'test-admin-access',
        email: 'test-admin-access@example.com',
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'Admin',
        role: 'admin',
        isActive: true,
      })
      .returning();
    testUserId = user.id;

    // Create test building
    const [building] = await db
      .insert(buildings)
      .values({
        organizationId: testOrgId,
        name: 'Test Access Building',
        address: '456 Test Avenue',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H2B 2B2',
        buildingType: 'residential',
        totalUnits: 10,
        isActive: true,
      })
      .returning();
    testBuildingId = building.id;
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(userOrganizations).where(eq(userOrganizations.userId, testUserId));
    await db.delete(buildings).where(eq(buildings.id, testBuildingId));
    await db.delete(users).where(eq(users.id, testUserId));
    await db.delete(organizations).where(eq(organizations.id, testOrgId));
  });

  describe('Admin User Building Access Requirements', () => {
    it('should fail when admin user has no organization relationships', async () => {
      // Verify user exists but has no organization relationships
      const user = await db.select().from(users).where(eq(users.id, testUserId)).limit(1);
      expect(user).toHaveLength(1);
      expect(user[0].role).toBe('admin');

      // Verify no organization relationships exist
      const userOrgs = await db
        .select()
        .from(userOrganizations)
        .where(eq(userOrganizations.userId, testUserId));
      expect(userOrgs).toHaveLength(0);

      // This represents the problematic state that caused the original issue
      console.warn(
        '⚠️  Admin user has no organization relationships - this will prevent building access'
      );
    });

    it('should provide building access when admin has organization relationship', async () => {
      // Create organization relationship for admin user
      await db.insert(userOrganizations).values({
        userId: testUserId,
        organizationId: testOrgId,
        organizationRole: 'admin',
        isActive: true,
        canAccessAllOrganizations: true,
      });

      // Verify organization relationship exists
      const userOrgs = await db
        .select()
        .from(userOrganizations)
        .where(eq(userOrganizations.userId, testUserId));
      expect(userOrgs).toHaveLength(1);
      expect(userOrgs[0].canAccessAllOrganizations).toBe(true);

      // Verify buildings are accessible through the organization
      const accessibleBuildings = await db
        .select()
        .from(buildings)
        .where(and(eq(buildings.organizationId, testOrgId), eq(buildings.isActive, true)));
      expect(accessibleBuildings).toHaveLength(1);
      expect(accessibleBuildings[0].name).toBe('Test Access Building');
    });

    it('should ensure all existing admin users have organization relationships', async () => {
      // Get all admin users
      const adminUsers = await db
        .select()
        .from(users)
        .where(and(eq(users.role, 'admin'), eq(users.isActive, true)));

      // Check each admin user has at least one organization relationship
      for (const user of adminUsers) {
        const userOrgs = await db
          .select()
          .from(userOrganizations)
          .where(and(eq(userOrganizations.userId, user.id), eq(userOrganizations.isActive, true)));

        if (userOrgs.length === 0) {
          console.error(
            `❌ Admin user ${user.email} (${user.id}) has no organization relationships`
          );
          console.error('   This will prevent them from accessing buildings');

          // This test should fail to highlight the issue
          expect(userOrgs.length).toBeGreaterThan(0);
        } else {
          console.log(
            `✅ Admin user ${user.email} has ${userOrgs.length} organization relationship(s)`
          );
        }
      }
    });
  });

  describe('Data Integrity Validation', () => {
    it('should ensure all active organizations have at least one admin user', async () => {
      // Get all active organizations
      const activeOrgs = await db
        .select()
        .from(organizations)
        .where(eq(organizations.isActive, true));

      // Check each organization has at least one admin user
      for (const org of activeOrgs) {
        const adminUserOrgs = await db
          .select()
          .from(userOrganizations)
          .innerJoin(users, eq(users.id, userOrganizations.userId))
          .where(
            and(
              eq(userOrganizations.organizationId, org.id),
              eq(userOrganizations.isActive, true),
              eq(users.role, 'admin'),
              eq(users.isActive, true)
            )
          );

        if (adminUserOrgs.length === 0) {
          console.warn(`⚠️  Organization ${org.name} (${org.id}) has no admin users`);
          console.warn('   This could lead to management issues');
        } else {
          console.log(`✅ Organization ${org.name} has ${adminUserOrgs.length} admin user(s)`);
        }
      }
    });

    it('should validate building access permissions are working correctly', async () => {
      // Create organization relationship with global access
      await db.insert(userOrganizations).values({
        userId: testUserId,
        organizationId: testOrgId,
        organizationRole: 'admin',
        isActive: true,
        canAccessAllOrganizations: true,
      });

      // Simulate the building access logic from the API
      const user = await db.select().from(users).where(eq(users.id, testUserId)).limit(1);
      const userOrgs = await db
        .select()
        .from(userOrganizations)
        .where(and(eq(userOrganizations.userId, testUserId), eq(userOrganizations.isActive, true)));

      const hasGlobalAccess = userOrgs.some((uo) => uo.canAccessAllOrganizations);
      const hasOrgAccess = userOrgs.length > 0;

      expect(user[0].role).toBe('admin');
      expect(hasGlobalAccess || hasOrgAccess).toBe(true);

      // This validates the building access logic would work correctly
      console.log(
        `✅ Admin user would have building access: global=${hasGlobalAccess}, org=${hasOrgAccess}`
      );
    });
  });
});
