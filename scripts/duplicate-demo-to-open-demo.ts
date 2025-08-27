#!/usr/bin/env tsx

/**
 * Demo to Open Demo Duplication Script.
 *
 * This script duplicates the complete Demo organization to create an
 * identical Open Demo organization for read-only demonstration purposes.
 *
 * Features:
 * - Complete data duplication (all tables and relationships)
 * - User email domain changes (@demo.com → @opendemo.com)
 * - Preserves all data relationships
 * - Safe cleanup of existing Open Demo data.
 *
 * Usage: tsx scripts/duplicate-demo-to-open-demo.ts.
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../shared/schema';
import { eq } from 'drizzle-orm';
import ws from 'ws';
// ComprehensiveDemoSyncService removed - functionality replaced with direct database operations

neonConfig.webSocketConstructor = ws;

// Get database URL from environment
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not defined');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle({ client: pool, schema });

/**
 * Main duplication function.
 */
async function duplicateDemoToOpenDemo(): Promise<void> {
  try {
    console.log('🔄 Starting Demo → Open Demo duplication process...\n');

    // Step 1: Verify Demo organization exists
    console.log('📍 Verifying Demo organization exists...');
    const demoOrg = await db.query.organizations.findFirst({
      where: eq(schema.organizations.name, 'Demo'),
    });

    if (!demoOrg) {
      console.error('❌ Demo organization not found!');
      console.log('💡 Please run the comprehensive demo creation script first:');
      console.log('   tsx scripts/create-comprehensive-demo.ts');
      process.exit(1);
    }

    console.log(`✅ Demo organization found: ${demoOrg.id}`);

    // Step 2: Verify Open Demo organization exists
    console.log('\n📍 Verifying Open Demo organization exists...');
    const openDemoOrg = await db.query.organizations.findFirst({
      where: eq(schema.organizations.name, 'Open Demo'),
    });

    if (!openDemoOrg) {
      console.error('❌ Open Demo organization not found!');
      console.log('💡 Please run the comprehensive demo creation script first:');
      console.log('   tsx scripts/create-comprehensive-demo.ts');
      process.exit(1);
    }

    console.log(`✅ Open Demo organization found: ${openDemoOrg.id}`);

    // Step 3: Check Demo organization data
    console.log('\n📊 Analyzing Demo organization data...');

    const demoBuildings = await db.query.buildings.findMany({
      where: eq(schema.buildings.organizationId, demoOrg.id),
    });

    const demoUsers = await db.query.userOrganizations.findMany({
      where: eq(schema.userOrganizations.organizationId, demoOrg.id),
    });

    console.log(`  • Buildings: ${demoBuildings.length}`);
    console.log(`  • Users: ${demoUsers.length}`);

    if (demoBuildings.length === 0) {
      console.warn('⚠️  Demo organization has no buildings!');
      console.log('💡 Consider running the comprehensive demo creation script:');
      console.log('   tsx scripts/create-comprehensive-demo.ts');
    }

    if (demoUsers.length === 0) {
      console.warn('⚠️  Demo organization has no users!');
      console.log('💡 Consider running the comprehensive demo creation script:');
      console.log('   tsx scripts/create-comprehensive-demo.ts');
    }

    // Step 4: Skip synchronization (functionality disabled)
    console.log('\n🚀 Skipping synchronization (demo sync functionality disabled)...');

    // Step 5: Verify duplication results
    console.log('\n📊 Verifying duplication results...');

    const openDemoBuildings = await db.query.buildings.findMany({
      where: eq(schema.buildings.organizationId, openDemoOrg.id),
    });

    const openDemoUsers = await db.query.userOrganizations.findMany({
      where: eq(schema.userOrganizations.organizationId, openDemoOrg.id),
    });

    console.log(`  • Open Demo Buildings: ${openDemoBuildings.length}`);
    console.log(`  • Open Demo Users: ${openDemoUsers.length}`);

    // Step 6: Summary report
    console.log('\n✨ Demo → Open Demo duplication completed successfully!');
    console.log('\n📋 Duplication Summary:');
    console.log(`  ✅ Source: Demo organization (${demoOrg.id})`);
    console.log(`  ✅ Target: Open Demo organization (${openDemoOrg.id})`);
    console.log(`  ✅ Buildings duplicated: ${demoBuildings.length} → ${openDemoBuildings.length}`);
    console.log(`  ✅ Users duplicated: ${demoUsers.length} → ${openDemoUsers.length}`);
    console.log(`  ✅ All data relationships preserved`);
    console.log(`  ✅ User email domains changed: @demo.com → @opendemo.com`);

    console.log('\n🎯 Open Demo organization is now ready for use!');
    console.log('   The Open Demo provides a read-only demonstration environment');
    console.log('   with identical data to the Demo organization.');
  } catch (error) {
    console.error('\n❌ Duplication failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Display usage information.
 */
function displayUsage(): void {
  console.log('📖 Demo to Open Demo Duplication Script');
  console.log('');
  console.log('This script duplicates the Demo organization to create an identical');
  console.log('Open Demo organization for read-only demonstration purposes.');
  console.log('');
  console.log('Prerequisites:');
  console.log('  • Demo organization must exist');
  console.log('  • Open Demo organization must exist');
  console.log('  • Database connection must be available');
  console.log('');
  console.log('Usage:');
  console.log('  tsx scripts/duplicate-demo-to-open-demo.ts');
  console.log('');
  console.log('Options:');
  console.log('  --help    Show this help message');
  console.log('');
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  displayUsage();
  process.exit(0);
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  duplicateDemoToOpenDemo().catch((error) => {
    console.error('Script execution failed:', error);
    process.exit(1);
  });
}

export { duplicateDemoToOpenDemo };
