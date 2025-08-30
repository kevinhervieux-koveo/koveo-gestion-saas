#!/usr/bin/env tsx

/**
 * Build script for the server with config file copying.
 * This script builds the server using esbuild and copies the necessary config files.
 */

import { execSync } from 'child_process';
import { mkdirSync, copyFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Builds the server using esbuild and copies configuration files.
 */
/**
 * BuildServer function.
 * @returns Function result.
 */
function buildServer() {
  console.warn('🔨 Building server...');

  try {
    // Run esbuild
    console.warn('Running esbuild...');
    execSync(
      'esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist',
      {
        stdio: 'inherit',
      }
    );

    // Create config directory in dist
    const distConfigDir = join('dist', 'config');
    if (!existsSync(distConfigDir)) {
      mkdirSync(distConfigDir, { recursive: true });
    }

    // Copy permissions.json if it exists
    const permissionsPath = join('config', 'permissions.json');
    if (existsSync(permissionsPath)) {
      console.warn('Copying permissions.json...');
      copyFileSync(permissionsPath, join('dist', 'config', 'permissions.json'));
    } else {
      console.warn('permissions.json not found, skipping...');
    }

    console.warn('✅ Server build completed successfully');
  } catch (_error) {
    console.error('❌ Build failed:', _error);
    process.exit(1);
  }
}

// Run the build if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildServer();
}

export { buildServer };
