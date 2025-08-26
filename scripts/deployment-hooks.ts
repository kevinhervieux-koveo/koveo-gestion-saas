#!/usr/bin/env tsx

/**
 * Deployment Hooks Script.
 *
 * This script runs deployment-specific tasks.
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
    if ((_error as any).stdout) {
      console.warn('STDOUT:', (_error as any).stdout);
    }
    if ((_error as any).stderr) {
      console.warn('STDERR:', (_error as any).stderr);
    }
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

    // 2. Warm up the application
    if (process.env.WARMUP_ON_DEPLOY === 'true') {
      let port = parseInt(process.env.PORT || '5000', 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        console.warn('⚠️  Invalid PORT value, using default 5000');
        port = 5000;
      }
      runCommand(
        `curl -f http://localhost:${port}/health || echo "Warmup skipped - server not ready"`,
        'Warming up application'
      );
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
