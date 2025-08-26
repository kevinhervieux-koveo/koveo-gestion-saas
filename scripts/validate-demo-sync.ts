#!/usr/bin/env tsx

import { syncDemoOrganizations, setupProductionSync } from './sync-demo-organizations';
import chalk from 'chalk';

/**
 * Demo Organization Sync Validation Script
 * 
 * This script ensures that Demo and Open Demo organizations are properly synchronized
 * and ready for production deployment. It's integrated into the validation pipeline.
 */

async function validateDemoSync() {
  console.log(chalk.blue('🔄 Demo Organization Sync Validation'));
  console.log(chalk.gray('======================================='));

  try {
    // Step 1: Sync Demo organizations
    console.log(chalk.yellow('\n📋 Step 1: Synchronizing Demo Organizations...'));
    await syncDemoOrganizations();

    // Step 2: Setup production sync configuration
    console.log(chalk.yellow('\n🚀 Step 2: Validating Production Sync Configuration...'));
    await setupProductionSync();

    // Step 3: Validate data consistency
    console.log(chalk.yellow('\n✅ Step 3: Validating Data Consistency...'));
    await validateDataConsistency();

    console.log(chalk.green('\n✅ Demo organization sync validation completed successfully!'));
    console.log(chalk.blue('📊 Both Demo and Open Demo organizations are properly synchronized'));
    console.log(chalk.blue('🚀 Ready for production deployment'));

  } catch (error) {
    console.error(chalk.red('\n❌ Demo organization sync validation failed:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

/**
 * Validates that Demo and Open Demo organizations have consistent data
 */
async function validateDataConsistency() {
  console.log('  🔍 Checking data consistency between organizations...');
  
  // Import database connection
  const { db } = await import('../server/db');
  const schema = await import('../shared/schema');
  const { inArray, eq } = await import('drizzle-orm');

  // Get both organizations
  const organizations = await db
    .select()
    .from(schema.organizations)
    .where(inArray(schema.organizations.name, ['Demo', 'Open Demo']));

  if (organizations.length !== 2) {
    throw new Error(`Expected 2 organizations (Demo, Open Demo), found ${organizations.length}`);
  }

  const demoOrg = organizations.find(org => org.name === 'Demo');
  const openDemoOrg = organizations.find(org => org.name === 'Open Demo');

  if (!demoOrg || !openDemoOrg) {
    throw new Error('Demo or Open Demo organization not found');
  }

  // Validate user counts
  const demoUserCount = await db
    .select()
    .from(schema.userOrganizations)
    .where(eq(schema.userOrganizations.organizationId, demoOrg.id));

  const openDemoUserCount = await db
    .select()
    .from(schema.userOrganizations)
    .where(eq(schema.userOrganizations.organizationId, openDemoOrg.id));

  console.log(`    📊 Demo users: ${demoUserCount.length}`);
  console.log(`    📊 Open Demo users: ${openDemoUserCount.length}`);

  if (demoUserCount.length !== openDemoUserCount.length) {
    throw new Error(`User count mismatch: Demo (${demoUserCount.length}) vs Open Demo (${openDemoUserCount.length})`);
  }

  // Validate building counts
  const demoBuildingCount = await db
    .select()
    .from(schema.buildings)
    .where(eq(schema.buildings.organizationId, demoOrg.id));

  const openDemoBuildingCount = await db
    .select()
    .from(schema.buildings)
    .where(eq(schema.buildings.organizationId, openDemoOrg.id));

  console.log(`    🏢 Demo buildings: ${demoBuildingCount.length}`);
  console.log(`    🏢 Open Demo buildings: ${openDemoBuildingCount.length}`);

  if (demoBuildingCount.length !== openDemoBuildingCount.length) {
    throw new Error(`Building count mismatch: Demo (${demoBuildingCount.length}) vs Open Demo (${openDemoBuildingCount.length})`);
  }

  console.log('  ✅ Data consistency validation passed');
}

// Run the validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateDemoSync().catch((error) => {
    console.error(chalk.red('Validation failed:'), error);
    process.exit(1);
  });
}

export default validateDemoSync;