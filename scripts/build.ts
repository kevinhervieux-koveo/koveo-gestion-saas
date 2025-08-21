#!/usr/bin/env tsx

/**
 * Complete build script that builds both client and server.
 */

import { execSync } from 'child_process';

/**
 * Runs the complete build process for client and server.
 * @returns Promise that resolves when build is complete.
 */
/**
 * RunBuild function.
 * @returns Function result.
 */
async function runBuild() {
  console.warn('🚀 Starting complete build process...');
  
  try {
    // Build client
    console.warn('📦 Building client...');
    execSync('npm run build:client', { stdio: 'inherit' });
    
    // Build server with config copying
    console.warn('🔨 Building server...');
    execSync('tsx scripts/build-server.ts', { stdio: 'inherit' });
    
    console.warn('✅ Build completed successfully!');
    
  } catch (__error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Run the build if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBuild();
}

export { runBuild };