/**
 * Cleanup functions for orphaned records in the database
 * These functions help identify and remove records that have lost their parent relationships.
 */

import { db } from '../db';
import { eq, and, isNull } from 'drizzle-orm';
import {
  buildings,
  organizations,
  residences,
  userOrganizations,
  userResidences,
} from '../../shared/schema';

/**
 *
 */
export interface OrphanCleanupReport {
  orphanBuildings: number;
  orphanResidences: number;
  orphanUserOrganizations: number;
  orphanUserResidences: number;
  cleanedUp: boolean;
}

/**
 * Find buildings that reference non-existent organizations.
 */
async function findOrphanBuildings() {
  const orphanBuildings = await db
    .select({
      id: buildings.id,
      name: buildings.name,
      organizationId: buildings.organizationId,
    })
    .from(buildings)
    .leftJoin(organizations, eq(buildings.organizationId, organizations.id))
    .where(and(eq(buildings.isActive, true), isNull(organizations.id)));

  return orphanBuildings;
}

/**
 * Find residences that reference non-existent buildings.
 */
async function findOrphanResidences() {
  const orphanResidences = await db
    .select({
      id: residences.id,
      unitNumber: residences.unitNumber,
      buildingId: residences.buildingId,
    })
    .from(residences)
    .leftJoin(buildings, eq(residences.buildingId, buildings.id))
    .where(and(eq(residences.isActive, true), isNull(buildings.id)));

  return orphanResidences;
}

/**
 * Clean up all orphaned records.
 */
export async function cleanupOrphans(): Promise<OrphanCleanupReport> {
  console.log('🧹 Starting orphan cleanup process...');

  const orphanBuildings = await findOrphanBuildings();
  const orphanResidences = await findOrphanResidences();

  console.log(`Found ${orphanBuildings.length} orphan buildings`);
  console.log(`Found ${orphanResidences.length} orphan residences`);

  let cleanedUp = false;

  try {
    // Since Neon HTTP driver doesn't support transactions, do cleanup without transaction
    // Clean up orphan buildings
    if (orphanBuildings.length > 0) {
      const buildingIds = orphanBuildings.map((b) => b.id);
      console.log(`🗑️ Removing ${buildingIds.length} orphan buildings:`, buildingIds);

      // Clean up each building individually
      for (const buildingId of buildingIds) {
        await db
          .update(buildings)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(buildings.id, buildingId));
      }
    }

    // Clean up orphan residences
    if (orphanResidences.length > 0) {
      const residenceIds = orphanResidences.map((r) => r.id);
      console.log(`🗑️ Removing ${residenceIds.length} orphan residences:`, residenceIds);

      // Clean up each residence individually
      for (const residenceId of residenceIds) {
        await db
          .update(residences)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(residences.id, residenceId));
      }
    }

    cleanedUp = true;
    console.log('✅ Orphan cleanup completed successfully');
  } catch (error) {
    console.error('❌ Failed to clean up orphans:', error);
  }

  return {
    orphanBuildings: orphanBuildings.length,
    orphanResidences: orphanResidences.length,
    orphanUserOrganizations: 0,
    orphanUserResidences: 0,
    cleanedUp,
  };
}

/**
 * Generate a report of orphaned records without cleaning them up.
 */
export async function generateOrphanReport(): Promise<OrphanCleanupReport> {
  console.log('📊 Generating orphan report...');

  const orphanBuildings = await findOrphanBuildings();
  const orphanResidences = await findOrphanResidences();

  return {
    orphanBuildings: orphanBuildings.length,
    orphanResidences: orphanResidences.length,
    orphanUserOrganizations: 0,
    orphanUserResidences: 0,
    cleanedUp: false,
  };
}
