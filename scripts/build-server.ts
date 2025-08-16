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
function buildServer() {
  console.warn('🔨 Building server...');
  
  try {
    // Run esbuild
    console.warn('Running esbuild...');
    execSync('esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', { 
      stdio: 'inherit' 
    });
    
    // Create config directory in dist
    const distConfigDir = join('dist', 'config');
    if (!existsSync(distConfigDir)) {
      mkdirSync(distConfigDir, { recursive: true });
    }
    
    // Copy permissions.json
    console.warn('Copying permissions.json...');
    copyFileSync(
      join('config', 'permissions.json'),
      join('dist', 'config', 'permissions.json')
    );
    
    console.warn('✅ Server build completed successfully');
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Run the build if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildServer();
}

export { buildServer };