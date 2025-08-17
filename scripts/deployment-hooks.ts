#!/usr/bin/env tsx

/**
 * Deployment Hooks Script
 * 
 * This script runs deployment-specific tasks including Demo organization sync.
 * Should be executed during the deployment process.
 * 
 * Usage: tsx scripts/deployment-hooks.ts
 */

import { execSync } from 'child_process';

/**
 * Executes a shell command and logs the output
 */
function runCommand(command: string, description: string): void {
  console.log(`🔄 ${description}...`);
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    if (output.trim()) {
      console.log(output);
    }
    console.log(`✅ ${description} completed`);
  } catch (error: any) {
    console.error(`❌ ${description} failed:`, error.message);
    if (error.stdout) console.log('STDOUT:', error.stdout);
    if (error.stderr) console.log('STDERR:', error.stderr);
    throw error;
  }
}

/**
 * Main deployment hook execution
 */
async function runDeploymentHooks(): Promise<void> {
  console.log('🚀 Starting deployment hooks...\n');

  try {
    // 1. Run database migrations
    runCommand('npm run db:push', 'Running database migrations');

    // 2. Check if we need to sync Demo organization
    if (process.env.SYNC_DEMO_ON_DEPLOY === 'true') {
      console.log('\n📋 Demo organization sync enabled');
      
      if (process.env.NODE_ENV === 'production') {
        // In production, import from file
        runCommand('tsx scripts/import-demo-organization.ts', 'Importing Demo organization data');
      } else {
        // In development/staging, sync to production if configured
        runCommand('tsx scripts/sync-demo-organization.ts', 'Syncing Demo organization to production');
      }
    } else {
      console.log('\n⏭️  Demo organization sync disabled (set SYNC_DEMO_ON_DEPLOY=true to enable)');
    }

    // 3. Warm up the application
    if (process.env.WARMUP_ON_DEPLOY === 'true') {
      runCommand('curl -f http://localhost:${PORT:-8080}/health || echo "Warmup skipped - server not ready"', 'Warming up application');
    }

    console.log('\n✅ All deployment hooks completed successfully!');

  } catch (error) {
    console.error('\n❌ Deployment hooks failed:', error);
    process.exit(1);
  }
}

// Run deployment hooks
if (import.meta.url === `file://${process.argv[1]}`) {
  runDeploymentHooks().catch(console.error);
}