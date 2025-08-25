#!/usr/bin/env tsx

/**
 * Demo System Integration Test Script.
 * 
 * This script performs a complete integration test of the demo organizations system.
 * It verifies that all components work together correctly by running through
 * the entire demo lifecycle.
 * 
 * Usage: tsx scripts/test-demo-system.ts.
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq } from 'drizzle-orm';
import * as schema from '../shared/schema';
import { createComprehensiveDemo } from './create-comprehensive-demo';
import { duplicateDemoToOpenDemo } from './duplicate-demo-to-open-demo';
import { productionDemoSync, healthCheck } from './production-demo-sync';
import DemoManagementService from '../server/services/demo-management-service';
import ws from 'ws';

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
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

/**
 * Main test runner.
 */
async function runIntegrationTests(): Promise<void> {
  console.log('🧪 Starting Demo System Integration Tests...\n');

  const results: TestResult[] = [];
  const startTime = Date.now();

  try {
    // Clean up any existing demo data first
    await cleanupDemoData();

    // Test 1: Health check when no organizations exist
    results.push(await runTest('Health Check (No Orgs)', async () => {
      const health = await healthCheck();
      if (health.healthy) {
        throw new Error('Expected unhealthy status when no demo orgs exist');
      }
      console.log('  ✓ Correctly reports unhealthy when no demo orgs exist');
    }));

    // Test 2: Comprehensive demo creation
    results.push(await runTest('Comprehensive Demo Creation', async () => {
      await createComprehensiveDemo();
      
      // Verify organizations were created
      const demoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Demo')
      });
      const openDemoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Open Demo')
      });

      if (!demoOrg || !openDemoOrg) {
        throw new Error('Demo organizations were not created');
      }

      // Verify buildings were created
      const buildings = await db.query.buildings.findMany({
        where: eq(schema.buildings.organizationId, demoOrg.id)
      });

      if (buildings.length < 3) {
        throw new Error(`Expected at least 3 buildings, got ${buildings.length}`);
      }

      // Verify users were created
      const userOrgs = await db.query.userOrganizations.findMany({
        where: eq(schema.userOrganizations.organizationId, demoOrg.id)
      });

      if (userOrgs.length < 10) {
        throw new Error(`Expected at least 10 users, got ${userOrgs.length}`);
      }

      console.log(`  ✓ Created Demo organization with ${buildings.length} buildings and ${userOrgs.length} users`);
    }));

    // Test 3: Demo to Open Demo duplication
    results.push(await runTest('Demo to Open Demo Duplication', async () => {
      await duplicateDemoToOpenDemo();

      const demoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Demo')
      });
      const openDemoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Open Demo')
      });

      if (!demoOrg || !openDemoOrg) {
        throw new Error('Organizations not found after duplication');
      }

      // Verify building counts match
      const demoBuildings = await db.query.buildings.findMany({
        where: eq(schema.buildings.organizationId, demoOrg.id)
      });
      const openDemoBuildings = await db.query.buildings.findMany({
        where: eq(schema.buildings.organizationId, openDemoOrg.id)
      });

      if (demoBuildings.length !== openDemoBuildings.length) {
        throw new Error(`Building count mismatch: Demo=${demoBuildings.length}, Open Demo=${openDemoBuildings.length}`);
      }

      // Verify user counts match
      const demoUserOrgs = await db.query.userOrganizations.findMany({
        where: eq(schema.userOrganizations.organizationId, demoOrg.id)
      });
      const openDemoUserOrgs = await db.query.userOrganizations.findMany({
        where: eq(schema.userOrganizations.organizationId, openDemoOrg.id)
      });

      if (demoUserOrgs.length !== openDemoUserOrgs.length) {
        throw new Error(`User count mismatch: Demo=${demoUserOrgs.length}, Open Demo=${openDemoUserOrgs.length}`);
      }

      console.log(`  ✓ Successfully duplicated ${demoBuildings.length} buildings and ${demoUserOrgs.length} users to Open Demo`);
    }));

    // Test 4: Health check when organizations exist
    results.push(await runTest('Health Check (With Orgs)', async () => {
      const health = await healthCheck();
      if (!health.healthy) {
        throw new Error(`Expected healthy status, got: ${health.message}`);
      }
      console.log('  ✓ Correctly reports healthy when demo orgs exist with data');
    }));

    // Test 5: Demo Management Service
    results.push(await runTest('Demo Management Service', async () => {
      // Test health check
      const health = await DemoManagementService.checkDemoHealth();
      if (!health.healthy) {
        throw new Error('Demo management service reports unhealthy');
      }

      // Test organization info
      const info = await DemoManagementService.getDemoOrganizationInfo();
      if (!info.demo || !info.openDemo) {
        throw new Error('Demo management service did not return organization info');
      }

      if (info.stats.demoBuildings === 0 || info.stats.openDemoBuildings === 0) {
        throw new Error('Demo management service reports no buildings');
      }

      // Test scheduled maintenance
      const maintenance = await DemoManagementService.scheduledMaintenance();
      if (!maintenance.success) {
        throw new Error(`Scheduled maintenance failed: ${maintenance.message}`);
      }

      console.log(`  ✓ Demo Management Service working correctly`);
      console.log(`    - Demo: ${info.stats.demoBuildings} buildings, ${info.stats.demoUsers} users`);
      console.log(`    - Open Demo: ${info.stats.openDemoBuildings} buildings, ${info.stats.openDemoUsers} users`);
    }));

    // Test 6: Production Sync
    results.push(await runTest('Production Sync', async () => {
      // Clean up first
      await cleanupDemoData();

      // Run production sync
      await productionDemoSync({ silent: true });

      // Verify organizations were recreated
      const demoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Demo')
      });
      const openDemoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Open Demo')
      });

      if (!demoOrg || !openDemoOrg) {
        throw new Error('Production sync did not recreate organizations');
      }

      // Verify data was created
      const buildings = await db.query.buildings.findMany({
        where: eq(schema.buildings.organizationId, demoOrg.id)
      });

      if (buildings.length === 0) {
        throw new Error('Production sync did not create building data');
      }

      console.log(`  ✓ Production sync successfully recreated demo organizations with ${buildings.length} buildings`);
    }));

    // Test 7: Data Integrity Check
    results.push(await runTest('Data Integrity Check', async () => {
      const demoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Demo')
      });

      if (!demoOrg) {
        throw new Error('Demo organization not found');
      }

      // Check building-residence relationships
      const buildings = await db.query.buildings.findMany({
        where: eq(schema.buildings.organizationId, demoOrg.id)
      });

      let totalResidences = 0;
      for (const building of buildings) {
        const residences = await db.query.residences.findMany({
          where: eq(schema.residences.buildingId, building.id)
        });

        if (residences.length !== building.totalUnits) {
          throw new Error(`Building ${building.name} has ${residences.length} residences but claims ${building.totalUnits} units`);
        }

        totalResidences += residences.length;
      }

      // Check financial data exists
      const bills = await db.query.bills.findMany({
        where: eq(schema.bills.buildingId, buildings[0].id)
      });

      if (bills.length === 0) {
        throw new Error('No bills found for demo buildings');
      }

      // Check user-residence relationships
      const userResidences = await db.query.userResidences.findMany();
      if (userResidences.length === 0) {
        throw new Error('No user-residence relationships found');
      }

      console.log(`  ✓ Data integrity verified: ${buildings.length} buildings, ${totalResidences} residences, ${bills.length} bills, ${userResidences.length} user relationships`);
    }));

    // Test 8: Email Domain Verification
    results.push(await runTest('Email Domain Verification', async () => {
      const openDemoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Open Demo')
      });

      if (!openDemoOrg) {
        throw new Error('Open Demo organization not found');
      }

      const openDemoUserOrgs = await db.query.userOrganizations.findMany({
        where: eq(schema.userOrganizations.organizationId, openDemoOrg.id),
        with: { user: true }
      });

      let openDemoEmailCount = 0;
      for (const userOrg of openDemoUserOrgs) {
        if (userOrg.user.email.includes('@opendemo.com')) {
          openDemoEmailCount++;
        } else if (userOrg.user.email.includes('@demo.com')) {
          throw new Error(`Found @demo.com email in Open Demo: ${userOrg.user.email}`);
        }
      }

      if (openDemoEmailCount === 0) {
        throw new Error('No @opendemo.com emails found in Open Demo organization');
      }

      console.log(`  ✓ Email domains correctly changed: ${openDemoEmailCount} users with @opendemo.com emails`);
    }));

  } catch (error) {
    console.error('❌ Test execution failed:', error);
    results.push({
      name: 'Test Execution',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: 0
    });
  } finally {
    await pool.end();
  }

  // Print results summary
  const totalTime = Date.now() - startTime;
  printResults(results, totalTime);
}

/**
 * Run a single test and capture its result.
 * @param name
 * @param testFn
 */
async function runTest(name: string, testFn: () => Promise<void>): Promise<TestResult> {
  console.log(`🧪 Running: ${name}...`);
  const startTime = Date.now();

  try {
    await testFn();
    const duration = Date.now() - startTime;
    console.log(`✅ Passed: ${name} (${duration}ms)\n`);
    return { name, passed: true, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`❌ Failed: ${name} - ${errorMessage} (${duration}ms)\n`);
    return { name, passed: false, error: errorMessage, duration };
  }
}

/**
 * Clean up demo data.
 */
async function cleanupDemoData(): Promise<void> {
  try {
    const demoOrg = await db.query.organizations.findFirst({
      where: eq(schema.organizations.name, 'Demo')
    });
    const openDemoOrg = await db.query.organizations.findFirst({
      where: eq(schema.organizations.name, 'Open Demo')
    });

    if (demoOrg) {
      await db.delete(schema.organizations).where(eq(schema.organizations.id, demoOrg.id));
    }
    if (openDemoOrg) {
      await db.delete(schema.organizations).where(eq(schema.organizations.id, openDemoOrg.id));
    }
  } catch (error) {
    console.warn('Cleanup warning:', error);
  }
}

/**
 * Print test results summary.
 * @param results
 * @param totalTime
 */
function printResults(results: TestResult[], totalTime: number): void {
  console.log('📊 Test Results Summary');
  console.log('=' .repeat(80));

  const passed = results.filter(r => r.passed);
  const failed = results.filter(r => !r.passed);

  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`⏱️ Total Time: ${totalTime}ms`);
  console.log('');

  if (failed.length > 0) {
    console.log('❌ Failed Tests:');
    failed.forEach(result => {
      console.log(`  • ${result.name}: ${result.error}`);
    });
    console.log('');
  }

  console.log('📝 Detailed Results:');
  results.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    console.log(`  ${status} ${result.name} (${result.duration}ms)`);
  });

  console.log('');
  if (failed.length === 0) {
    console.log('🎉 All tests passed! Demo system is working correctly.');
  } else {
    console.log('💥 Some tests failed. Please check the errors above.');
    process.exit(1);
  }
}

// Run the tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTests().catch((error) => {
    console.error('Script execution failed:', error);
    process.exit(1);
  });
}

export { runIntegrationTests };