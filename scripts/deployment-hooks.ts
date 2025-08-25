#!/usr/bin/env tsx

/**
 * Deployment Hooks Script.
 * 
 * This script runs deployment-specific tasks including Demo organization sync.
 * Should be executed during the deployment process.
 * 
 * Usage: tsx scripts/deployment-hooks.ts.
 */

import { execSync } from 'child_process';

/**
 * Executes a shell command and logs the output.
 * @param command
 * @param description
 */
/**
 * RunCommand function.
 * @param command
 * @param description
 * @returns Function result.
 */
function runCommand(command: string, description: string): void {
  console.warn(`🔄 ${description}...`);
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    if (output.trim()) {
      console.warn(output);
    }
    console.warn(`✅ ${description} completed`);
  } catch (_error: unknown) {
    console.error(`❌ ${description} failed:`, _error);
    if ((_error as any).stdout) {console.warn('STDOUT:', (_error as any).stdout);}
    if ((_error as any).stderr) {console.warn('STDERR:', (_error as any).stderr);}
    throw _error;
  }
}

/**
 * Main deployment hook execution.
 */
/**
 * RunDeploymentHooks function.
 * @returns Function result.
 */
async function runDeploymentHooks(): Promise<void> {
  console.warn('🚀 Starting deployment hooks...\n');

  try {
    // 1. Run database migrations
    runCommand('npm run db:push', 'Running database migrations');

    // 2. Check if we need to sync Demo organization
    if (process.env.SYNC_DEMO_ON_DEPLOY === 'true') {
      console.warn('\n📋 Demo organization sync enabled');
      
      if (process.env.NODE_ENV === 'production') {
        // In production, import from file
        runCommand('tsx scripts/import-demo-organization.ts', 'Importing Demo organization data');
      } else {
        // In development/staging, sync to production if configured
        runCommand('tsx scripts/sync-demo-organization.ts', 'Syncing Demo organization to production');
      }
    } else {
      console.warn('\n⏭️  Demo organization sync disabled (set SYNC_DEMO_ON_DEPLOY=true to enable)');
    }

    // 3. Sync features table to production
    console.warn('\n📊 Features sync to production');
    try {
      runCommand('tsx scripts/sync-features-to-production.ts', 'Syncing features table to production');
    } catch (syncError) {
      console.warn('⚠️  Features sync failed but deployment continues:', syncError);
    }

    // 4. Warm up the application
    if (process.env.WARMUP_ON_DEPLOY === 'true') {
      let port = parseInt(process.env.PORT || '8080', 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        console.warn('⚠️  Invalid PORT value, using default 8080');
        port = 8080;
      }
      runCommand(`curl -f http://localhost:${port}/health || echo "Warmup skipped - server not ready"`, 'Warming up application');
    }

    console.warn('\n✅ All deployment hooks completed successfully!');

  } catch (_error) {
    console.error('\n❌ Deployment hooks failed:', _error);
    process.exit(1);
  }
}

// Run deployment hooks
if (import.meta.url === `file://${process.argv[1]}`) {
  runDeploymentHooks().catch(console.error);
}