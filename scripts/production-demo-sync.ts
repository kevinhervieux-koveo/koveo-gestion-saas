#!/usr/bin/env tsx

/**
 * Production Demo Synchronization Script.
 *
 * This script ensures that Demo and Open Demo organizations are always
 * available and properly populated in the production environment.
 *
 * Features:
 * - Detects if Demo/Open Demo organizations exist
 * - Creates comprehensive demo data if missing
 * - Synchronizes Demo → Open Demo automatically
 * - Production-safe with proper error handling
 * - Can be run during deployment or as a scheduled task.
 *
 * Usage: tsx scripts/production-demo-sync.ts [--force-recreate] [--check-only].
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../shared/schema';
import { eq } from 'drizzle-orm';
import ws from 'ws';
import { createComprehensiveDemo } from './create-comprehensive-demo';
import { duplicateDemoToOpenDemo } from './duplicate-demo-to-open-demo';

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
 *
 */
interface SyncOptions {
  forceRecreate?: boolean;
  checkOnly?: boolean;
  silent?: boolean;
}

/**
 *
 */
interface DemoStatus {
  demoExists: boolean;
  openDemoExists: boolean;
  demoHasData: boolean;
  openDemoHasData: boolean;
  lastSyncNeeded: boolean;
}

/**
 * Check the current status of demo organizations.
 */
async function checkDemoStatus(): Promise<DemoStatus> {
  const demoOrg = await db.query.organizations.findFirst({
    where: eq(schema.organizations.name, 'Demo'),
  });

  const openDemoOrg = await db.query.organizations.findFirst({
    where: eq(schema.organizations.name, 'Open Demo'),
  });

  let demoHasData = false;
  let openDemoHasData = false;

  if (demoOrg) {
    const demoBuildings = await db.query.buildings.findMany({
      where: eq(schema.buildings.organizationId, demoOrg.id),
    });
    demoHasData = demoBuildings.length > 0;
  }

  if (openDemoOrg) {
    const openDemoBuildings = await db.query.buildings.findMany({
      where: eq(schema.buildings.organizationId, openDemoOrg.id),
    });
    openDemoHasData = openDemoBuildings.length > 0;
  }

  // Determine if sync is needed
  const lastSyncNeeded = !openDemoOrg || !openDemoHasData || (demoHasData && !openDemoHasData);

  return {
    demoExists: !!demoOrg,
    openDemoExists: !!openDemoOrg,
    demoHasData,
    openDemoHasData,
    lastSyncNeeded,
  };
}

/**
 * Display current demo status.
 * @param status
 * @param options
 */
function displayStatus(status: DemoStatus, options: SyncOptions): void {
  if (options.silent) {
    return;
  }

  console.log('📊 Demo Organizations Status:');
  console.log(`  Demo Organization: ${status.demoExists ? '✅ Exists' : '❌ Missing'}`);
  console.log(`  Demo Data: ${status.demoHasData ? '✅ Populated' : '❌ Empty'}`);
  console.log(`  Open Demo Organization: ${status.openDemoExists ? '✅ Exists' : '❌ Missing'}`);
  console.log(`  Open Demo Data: ${status.openDemoHasData ? '✅ Populated' : '❌ Empty'}`);
  console.log(`  Sync Needed: ${status.lastSyncNeeded ? '⚠️  Yes' : '✅ No'}`);
}

/**
 * Production-safe demo synchronization.
 * @param options
 */
async function productionDemoSync(options: SyncOptions = {}): Promise<void> {
  try {
    if (!options.silent) {
      console.log('🔄 Production Demo Synchronization Starting...\n');
    }

    // Step 1: Check current status
    const status = await checkDemoStatus();
    displayStatus(status, options);

    if (options.checkOnly) {
      console.log('\n📋 Check-only mode: Status check completed.');
      return;
    }

    // Step 2: Determine required actions
    const needsFullCreation = !status.demoExists || !status.demoHasData || options.forceRecreate;
    const needsSync =
      status.demoExists &&
      status.demoHasData &&
      (!status.openDemoExists || !status.openDemoHasData || options.forceRecreate);

    if (!needsFullCreation && !needsSync) {
      if (!options.silent) {
        console.log('\n✅ Demo organizations are already properly configured.');
        console.log('   No action required.');
      }
      return;
    }

    // Step 3: Create comprehensive demo data if needed
    if (needsFullCreation) {
      if (!options.silent) {
        console.log('\n🚀 Creating comprehensive demo data...');
      }

      await createComprehensiveDemo();

      if (!options.silent) {
        console.log('✅ Comprehensive demo data created successfully.');
      }
    }

    // Step 4: Sync Demo → Open Demo if needed
    if (needsSync || needsFullCreation) {
      if (!options.silent) {
        console.log('\n🔄 Synchronizing Demo → Open Demo...');
      }

      await duplicateDemoToOpenDemo();

      if (!options.silent) {
        console.log('✅ Demo → Open Demo synchronization completed.');
      }
    }

    // Step 5: Final status verification
    if (!options.silent) {
      console.log('\n📊 Final Status Verification:');
      const finalStatus = await checkDemoStatus();
      displayStatus(finalStatus, { silent: false });

      if (
        finalStatus.demoExists &&
        finalStatus.demoHasData &&
        finalStatus.openDemoExists &&
        finalStatus.openDemoHasData
      ) {
        console.log('\n🎉 Production demo synchronization completed successfully!');
        console.log('   Both Demo and Open Demo organizations are ready for use.');
      } else {
        console.warn('\n⚠️  Demo synchronization completed with warnings.');
        console.log('   Please check the status above for any issues.');
      }
    }
  } catch (error) {
    console.error('\n❌ Production demo synchronization failed:', error);
    throw error;
  }
}

/**
 * Parse command line arguments.
 */
function parseArguments(): SyncOptions {
  const args = process.argv.slice(2);
  const options: SyncOptions = {};

  for (const arg of args) {
    switch (arg) {
      case '--force-recreate':
      case '-f':
        options.forceRecreate = true;
        break;
      case '--check-only':
      case '-c':
        options.checkOnly = true;
        break;
      case '--silent':
      case '-s':
        options.silent = true;
        break;
      case '--help':
      case '-h':
        displayUsage();
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        displayUsage();
        process.exit(1);
    }
  }

  return options;
}

/**
 * Display usage information.
 */
function displayUsage(): void {
  console.log('📖 Production Demo Synchronization Script');
  console.log('');
  console.log('Ensures Demo and Open Demo organizations are properly configured');
  console.log('in the production environment with comprehensive demo data.');
  console.log('');
  console.log('Usage:');
  console.log('  tsx scripts/production-demo-sync.ts [options]');
  console.log('');
  console.log('Options:');
  console.log('  -f, --force-recreate    Force recreation of demo data');
  console.log('  -c, --check-only        Only check status, do not perform sync');
  console.log('  -s, --silent            Run in silent mode (minimal output)');
  console.log('  -h, --help              Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  tsx scripts/production-demo-sync.ts                 # Normal sync');
  console.log('  tsx scripts/production-demo-sync.ts --check-only    # Check status only');
  console.log('  tsx scripts/production-demo-sync.ts --force-recreate # Force recreation');
  console.log('  tsx scripts/production-demo-sync.ts --silent        # Silent operation');
  console.log('');
}

/**
 * Health check function for monitoring.
 */
export async function healthCheck(): Promise<{
  healthy: boolean;
  status: DemoStatus;
  message: string;
}> {
  try {
    const status = await checkDemoStatus();
    const healthy =
      status.demoExists && status.demoHasData && status.openDemoExists && status.openDemoHasData;

    const message = healthy
      ? 'Demo organizations are healthy and properly configured'
      : 'Demo organizations need attention - missing data or organizations';

    return { healthy, status, message };
  } catch (error) {
    return {
      healthy: false,
      status: {
        demoExists: false,
        openDemoExists: false,
        demoHasData: false,
        openDemoHasData: false,
        lastSyncNeeded: true,
      },
      message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Quick sync function for API endpoints.
 */
export async function quickSync(): Promise<void> {
  await productionDemoSync({ silent: true });
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArguments();

  productionDemoSync(options)
    .then(() => {
      if (!options.silent) {
        console.log('\n🏁 Script execution completed successfully.');
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script execution failed:', error);
      process.exit(1);
    })
    .finally(() => {
      pool.end();
    });
}

export { productionDemoSync };
