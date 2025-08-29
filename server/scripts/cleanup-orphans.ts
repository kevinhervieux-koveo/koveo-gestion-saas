#!/usr/bin/env tsx

/**
 * Orphan Cleanup Script
 *
 * Fixes referential integrity issues by cleaning up orphaned records
 * that could cause foreign key constraint violations during deployment.
 *
 * Run this script before deployment to ensure database integrity.
 */

import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import {
  users,
  organizations,
  buildings,
  residences,
  userOrganizations,
  userResidences,
  bills,
  notifications,
} from '../../shared/schema';
import { and, eq, isNull } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

async function cleanupOrphans() {
  console.log('🔧 Starting orphan cleanup process...');

  try {
    const db = drizzle(new Pool({ connectionString: DATABASE_URL }));

    // 1. Clean up user_organizations with deleted users
    console.log('🧹 Cleaning up orphaned user_organizations...');
    const orphanedUserOrgs = await db
      .select()
      .from(userOrganizations)
      .leftJoin(users, eq(userOrganizations.userId, users.id))
      .where(isNull(users.id));

    if (orphanedUserOrgs.length > 0) {
      await db
        .delete(userOrganizations)
        .where(eq(userOrganizations.userId, orphanedUserOrgs[0].user_organizations.userId));
      console.log(`✅ Cleaned up ${orphanedUserOrgs.length} orphaned user_organizations`);
    }

    // 2. Clean up user_residences with deleted users or residences
    console.log('🧹 Cleaning up orphaned user_residences...');
    const orphanedUserRes = await db
      .select()
      .from(userResidences)
      .leftJoin(users, eq(userResidences.userId, users.id))
      .leftJoin(residences, eq(userResidences.residenceId, residences.id))
      .where(and(isNull(users.id), isNull(residences.id)));

    if (orphanedUserRes.length > 0) {
      for (const orphan of orphanedUserRes) {
        await db.delete(userResidences).where(eq(userResidences.id, orphan.user_residences.id));
      }
      console.log(`✅ Cleaned up ${orphanedUserRes.length} orphaned user_residences`);
    }

    // 3. Clean up buildings with deleted organizations
    console.log('🧹 Cleaning up orphaned buildings...');
    const orphanedBuildings = await db
      .select()
      .from(buildings)
      .leftJoin(organizations, eq(buildings.organizationId, organizations.id))
      .where(isNull(organizations.id));

    if (orphanedBuildings.length > 0) {
      console.log(`⚠️  Found ${orphanedBuildings.length} buildings with deleted organizations`);
      console.log('This should be handled by CASCADE constraints, but cleaning up manually...');

      for (const building of orphanedBuildings) {
        await db.delete(buildings).where(eq(buildings.id, building.buildings.id));
      }
      console.log(`✅ Cleaned up ${orphanedBuildings.length} orphaned buildings`);
    }

    // 4. Clean up residences with deleted buildings
    console.log('🧹 Cleaning up orphaned residences...');
    const orphanedResidences = await db
      .select()
      .from(residences)
      .leftJoin(buildings, eq(residences.buildingId, buildings.id))
      .where(isNull(buildings.id));

    if (orphanedResidences.length > 0) {
      console.log(`⚠️  Found ${orphanedResidences.length} residences with deleted buildings`);

      for (const residence of orphanedResidences) {
        await db.delete(residences).where(eq(residences.id, residence.residences.id));
      }
      console.log(`✅ Cleaned up ${orphanedResidences.length} orphaned residences`);
    }

    // 5. Clean up notifications for deleted users
    console.log('🧹 Cleaning up orphaned notifications...');
    const orphanedNotifications = await db
      .select()
      .from(notifications)
      .leftJoin(users, eq(notifications.userId, users.id))
      .where(isNull(users.id));

    if (orphanedNotifications.length > 0) {
      for (const notification of orphanedNotifications) {
        await db.delete(notifications).where(eq(notifications.id, notification.notifications.id));
      }
      console.log(`✅ Cleaned up ${orphanedNotifications.length} orphaned notifications`);
    }

    // 6. Verify cleanup
    console.log('🔍 Verifying cleanup results...');
    const verificationResults = await Promise.all([
      db
        .select()
        .from(userOrganizations)
        .leftJoin(users, eq(userOrganizations.userId, users.id))
        .where(isNull(users.id)),
      db
        .select()
        .from(userResidences)
        .leftJoin(users, eq(userResidences.userId, users.id))
        .where(isNull(users.id)),
      db
        .select()
        .from(buildings)
        .leftJoin(organizations, eq(buildings.organizationId, organizations.id))
        .where(isNull(organizations.id)),
      db
        .select()
        .from(residences)
        .leftJoin(buildings, eq(residences.buildingId, buildings.id))
        .where(isNull(buildings.id)),
      db
        .select()
        .from(notifications)
        .leftJoin(users, eq(notifications.userId, users.id))
        .where(isNull(users.id)),
    ]);

    const remainingOrphans = verificationResults.reduce((sum, result) => sum + result.length, 0);

    if (remainingOrphans === 0) {
      console.log('✅ Orphan cleanup completed successfully - no orphaned records remaining');
    } else {
      console.warn(`⚠️  ${remainingOrphans} orphaned records still remain after cleanup`);
    }

    console.log('🎉 Database cleanup complete - ready for deployment!');
  } catch (error) {
    console.error('❌ Orphan cleanup failed:', error);
    process.exit(1);
  }
}

// Run the cleanup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupOrphans()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

export { cleanupOrphans };
