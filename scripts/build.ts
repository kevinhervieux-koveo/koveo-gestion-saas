#!/usr/bin/env tsx

/**
 * Complete build script that builds both client and server.
 */

import { execSync } from 'child_process';

async function runBuild() {
  console.log('🚀 Starting complete build process...');
  
  try {
    // Build client
    console.log('📦 Building client...');
    execSync('npm run build:client', { stdio: 'inherit' });
    
    // Build server with config copying
    console.log('🔨 Building server...');
    execSync('tsx scripts/build-server.ts', { stdio: 'inherit' });
    
    console.log('✅ Build completed successfully!');
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Run the build if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBuild();
}

export { runBuild };