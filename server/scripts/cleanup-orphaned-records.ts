#!/usr/bin/env tsx

/**
 * Cleanup Orphaned Records Script.
 *
 * This script identifies and removes orphaned records from the database.
 * It should be run periodically or after major database operations to ensure data integrity.
 *
 * Usage: npm run cleanup:orphans.
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import chalk from 'chalk';

/**
 *
 */
interface OrphanReport {
  entity: string;
  count: number;
  records?: any[];
}

/**
 *
 */
async function detectOrphans(): Promise<OrphanReport[]> {
  console.log(chalk.blue('🔍 Scanning database for orphaned records...'));

  const reports: OrphanReport[] = [];

  // Check for orphaned residences (both non-existent and inactive buildings)
  const orphanedResidences = await db.execute(sql`
    SELECT 
      r.id, r.unit_number, r.building_id, 'no_building' as orphan_type
    FROM residences r 
    LEFT JOIN buildings b ON r.building_id = b.id 
    WHERE b.id IS NULL AND r.is_active = true
    
    UNION ALL
    
    SELECT 
      r.id, r.unit_number, r.building_id, 'inactive_building' as orphan_type
    FROM residences r 
    JOIN buildings b ON r.building_id = b.id 
    WHERE r.is_active = true AND b.is_active = false
  `);

  if (orphanedResidences.rows.length > 0) {
    reports.push({
      entity: 'residences',
      count: orphanedResidences.rows.length,
      records: orphanedResidences.rows,
    });
  }

  // Check for orphaned user-residence assignments
  const orphanedUserResidences = await db.execute(sql`
    SELECT 
      ur.user_id, ur.residence_id
    FROM user_residences ur 
    LEFT JOIN users u ON ur.user_id = u.id 
    LEFT JOIN residences r ON ur.residence_id = r.id 
    WHERE u.id IS NULL OR r.id IS NULL
  `);

  if (orphanedUserResidences.rows.length > 0) {
    reports.push({
      entity: 'user_residences',
      count: orphanedUserResidences.rows.length,
      records: orphanedUserResidences.rows,
    });
  }

  // Check for orphaned buildings
  const orphanedBuildings = await db.execute(sql`
    SELECT 
      b.id, b.name, b.organization_id
    FROM buildings b 
    LEFT JOIN organizations o ON b.organization_id = o.id 
    WHERE o.id IS NULL
  `);

  if (orphanedBuildings.rows.length > 0) {
    reports.push({
      entity: 'buildings',
      count: orphanedBuildings.rows.length,
      records: orphanedBuildings.rows,
    });
  }

  // Check for orphaned demands
  const orphanedDemands = await db.execute(sql`
    SELECT 
      d.id, d.description, d.submitter_id, d.residence_id, d.building_id
    FROM demands d 
    LEFT JOIN users u ON d.submitter_id = u.id 
    LEFT JOIN residences r ON d.residence_id = r.id 
    LEFT JOIN buildings b ON d.building_id = b.id
    WHERE u.id IS NULL OR r.id IS NULL OR b.id IS NULL
  `);

  if (orphanedDemands.rows.length > 0) {
    reports.push({
      entity: 'demands',
      count: orphanedDemands.rows.length,
      records: orphanedDemands.rows,
    });
  }

  // Check for orphaned contacts
  const orphanedContacts = await db.execute(sql`
    SELECT 
      c.id, c.entity, c.entity_id, c.name
    FROM contacts c 
    LEFT JOIN buildings b ON c.entity = 'building' AND c.entity_id = b.id
    LEFT JOIN residences r ON c.entity = 'residence' AND c.entity_id = r.id
    LEFT JOIN users u ON c.entity = 'user' AND c.entity_id = u.id
    WHERE 
      (c.entity = 'building' AND b.id IS NULL) OR
      (c.entity = 'residence' AND r.id IS NULL) OR
      (c.entity = 'user' AND u.id IS NULL)
  `);

  if (orphanedContacts.rows.length > 0) {
    reports.push({
      entity: 'contacts',
      count: orphanedContacts.rows.length,
      records: orphanedContacts.rows,
    });
  }

  // Check for orphaned bills
  const orphanedBills = await db.execute(sql`
    SELECT 
      b.id, b.bill_number, b.residence_id
    FROM bills b 
    LEFT JOIN residences r ON b.residence_id = r.id 
    WHERE r.id IS NULL
  `);

  if (orphanedBills.rows.length > 0) {
    reports.push({
      entity: 'bills',
      count: orphanedBills.rows.length,
      records: orphanedBills.rows,
    });
  }

  // Check for orphaned maintenance requests
  const orphanedMaintenance = await db.execute(sql`
    SELECT 
      m.id, m.title, m.residence_id, m.submitted_by
    FROM maintenance_requests m 
    LEFT JOIN residences r ON m.residence_id = r.id 
    LEFT JOIN users u ON m.submitted_by = u.id
    WHERE r.id IS NULL OR u.id IS NULL
  `);

  if (orphanedMaintenance.rows.length > 0) {
    reports.push({
      entity: 'maintenance_requests',
      count: orphanedMaintenance.rows.length,
      records: orphanedMaintenance.rows,
    });
  }

  return reports;
}

/**
 *
 * @param reports
 */
async function deleteOrphans(reports: OrphanReport[]): Promise<void> {
  console.log(chalk.yellow('🧹 Cleaning up orphaned records...'));

  for (const report of reports) {
    console.log(chalk.red(`Deleting ${report.count} orphaned ${report.entity}...`));

    switch (report.entity) {
      case 'residences':
        await db.execute(sql`
          DELETE FROM residences 
          WHERE id IN (
            SELECT r.id 
            FROM residences r 
            LEFT JOIN buildings b ON r.building_id = b.id 
            WHERE b.id IS NULL AND r.is_active = true
            
            UNION
            
            SELECT r.id 
            FROM residences r 
            JOIN buildings b ON r.building_id = b.id 
            WHERE r.is_active = true AND b.is_active = false
          )
        `);
        break;

      case 'user_residences':
        await db.execute(sql`
          DELETE FROM user_residences 
          WHERE (user_id, residence_id) IN (
            SELECT ur.user_id, ur.residence_id
            FROM user_residences ur 
            LEFT JOIN users u ON ur.user_id = u.id 
            LEFT JOIN residences r ON ur.residence_id = r.id 
            WHERE u.id IS NULL OR r.id IS NULL
          )
        `);
        break;

      case 'buildings':
        await db.execute(sql`
          DELETE FROM buildings 
          WHERE id IN (
            SELECT b.id 
            FROM buildings b 
            LEFT JOIN organizations o ON b.organization_id = o.id 
            WHERE o.id IS NULL
          )
        `);
        break;

      case 'demands':
        await db.execute(sql`
          DELETE FROM demands 
          WHERE id IN (
            SELECT d.id 
            FROM demands d 
            LEFT JOIN users u ON d.submitter_id = u.id 
            LEFT JOIN residences r ON d.residence_id = r.id 
            LEFT JOIN buildings b ON d.building_id = b.id
            WHERE u.id IS NULL OR r.id IS NULL OR b.id IS NULL
          )
        `);
        break;

      case 'contacts':
        await db.execute(sql`
          DELETE FROM contacts 
          WHERE id IN (
            SELECT c.id
            FROM contacts c 
            LEFT JOIN buildings b ON c.entity = 'building' AND c.entity_id = b.id
            LEFT JOIN residences r ON c.entity = 'residence' AND c.entity_id = r.id
            LEFT JOIN users u ON c.entity = 'user' AND c.entity_id = u.id
            WHERE 
              (c.entity = 'building' AND b.id IS NULL) OR
              (c.entity = 'residence' AND r.id IS NULL) OR
              (c.entity = 'user' AND u.id IS NULL)
          )
        `);
        break;

      case 'bills':
        await db.execute(sql`
          DELETE FROM bills 
          WHERE id IN (
            SELECT b.id 
            FROM bills b 
            LEFT JOIN residences r ON b.residence_id = r.id 
            WHERE r.id IS NULL
          )
        `);
        break;

      case 'maintenance_requests':
        await db.execute(sql`
          DELETE FROM maintenance_requests 
          WHERE id IN (
            SELECT m.id 
            FROM maintenance_requests m 
            LEFT JOIN residences r ON m.residence_id = r.id 
            LEFT JOIN users u ON m.submitted_by = u.id
            WHERE r.id IS NULL OR u.id IS NULL
          )
        `);
        break;
    }

    console.log(chalk.green(`✓ Deleted ${report.count} orphaned ${report.entity}`));
  }
}

/**
 *
 */
async function main() {
  try {
    console.log(chalk.blue.bold('🚀 Starting Orphaned Records Cleanup'));
    console.log('==========================================');

    const reports = await detectOrphans();

    if (reports.length === 0) {
      console.log(chalk.green('✅ No orphaned records found! Database integrity is good.'));
      return;
    }

    console.log(chalk.yellow('⚠️  Orphaned records detected:'));
    reports.forEach((report) => {
      console.log(chalk.red(`  - ${report.count} orphaned ${report.entity}`));
    });

    console.log('\n' + chalk.blue('Detailed breakdown:'));
    reports.forEach((report) => {
      console.log(chalk.yellow(`\n${report.entity.toUpperCase()}:`));
      report.records?.slice(0, 5).forEach((record: any) => {
        console.log('  ', JSON.stringify(record, null, 2));
      });
      if (report.records && report.records.length > 5) {
        console.log(chalk.gray(`  ... and ${report.records.length - 5} more`));
      }
    });

    await deleteOrphans(reports);

    console.log('\n' + chalk.green.bold('✅ Cleanup completed successfully!'));
    console.log(chalk.blue('Recommendation: Run the orphan detection tests to verify cleanup.'));
    process.exit(1);
  }
}

// Run the cleanup if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
