/**
 * Building Access Prevention Test
 * 
 * Prevents the critical issue where admin users cannot access buildings
 * due to missing organization relationships.
 */
import { describe, it, expect } from '@jest/globals';
import { db } from '../../../server/db';
import { users, userOrganizations } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

describe('Building Access Prevention', () => {
  describe('Admin User Organization Validation', () => {
    it('should ensure all active admin users have organization relationships', async () => {
      // Get all active admin users
      const adminUsers = await db.select()
        .from(users)
        .where(and(
          eq(users.role, 'admin'),
          eq(users.isActive, true)
        ));

      console.log(`Found ${adminUsers.length} active admin users`);

      // Check each admin user has at least one organization relationship
      const orphanedAdmins: any[] = [];
      
      for (const user of adminUsers) {
        const userOrgs = await db.select()
          .from(userOrganizations)
          .where(and(
            eq(userOrganizations.userId, user.id),
            eq(userOrganizations.isActive, true)
          ));

        if (userOrgs.length === 0) {
          orphanedAdmins.push({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName
          });
          console.error(`❌ Admin user ${user.email} has no organization relationships`);
        } else {
          const hasGlobalAccess = userOrgs.some(uo => uo.canAccessAllOrganizations);
          console.log(`✅ Admin user ${user.email} has ${userOrgs.length} org(s), global access: ${hasGlobalAccess}`);
        }
      }

      // This test fails if any admin users are orphaned (have no organization relationships)
      if (orphanedAdmins.length > 0) {
        console.error('\\n🚨 CRITICAL ISSUE: The following admin users cannot access buildings:');
        orphanedAdmins.forEach(admin => {
          console.error(`   - ${admin.email} (${admin.firstName} ${admin.lastName})`);
        });
        console.error('\\n💡 To fix: Add entries to user_organizations table for these users');
        
        expect(orphanedAdmins).toHaveLength(0);
      }
    }, 45000);

    it('should validate the previously problematic admin user is now fixed', async () => {
      // Check the specific user that had the issue
      const problemUser = await db.select()
        .from(users)
        .where(eq(users.email, 'kevin.hervieux@koveo-gestion.com'))
        .limit(1);

      if (problemUser.length > 0) {
        const userId = problemUser[0].id;
        
        const userOrgs = await db.select()
          .from(userOrganizations)
          .where(and(
            eq(userOrganizations.userId, userId),
            eq(userOrganizations.isActive, true)
          ));

        expect(userOrgs.length).toBeGreaterThan(0);
        
        const hasGlobalAccess = userOrgs.some(uo => uo.canAccessAllOrganizations);
        console.log(`✅ Previously problematic admin user now has ${userOrgs.length} organization(s)`);
        console.log(`✅ Global access enabled: ${hasGlobalAccess}`);
        
        // Should have global access to prevent this issue from recurring
        expect(hasGlobalAccess).toBe(true);
      } else {
        console.warn('⚠️  Target user kevin.hervieux@koveo-gestion.com not found');
      }
    }, 45000);
  });
});