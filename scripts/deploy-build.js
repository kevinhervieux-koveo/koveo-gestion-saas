#!/usr/bin/env node

/**
 * Complete deployment build script
 * This script ensures all deployment requirements are met
 */

import { execSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

console.log('🚀 Starting deployment build process...');

try {
  // Step 1: Clean previous builds
  console.log('🧹 Cleaning previous builds...');
  try {
    execSync('rm -rf dist/', { stdio: 'inherit' });
    execSync('rm -f server/index.js', { stdio: 'inherit' });
  } catch (error) {
    console.log('No previous builds to clean');
  }

  // Step 2: Build client and server
  console.log('📦 Building client and server...');
  execSync('npm run build', { stdio: 'inherit' });

  // Step 3: Verify build outputs
  if (!existsSync('dist/public/index.html')) {
    throw new Error('Client build failed: dist/public/index.html not found');
  }
  
  if (!existsSync('dist/index.js')) {
    throw new Error('Server build failed: dist/index.js not found');
  }

  // Step 4: Create server/index.js for deployment
  console.log('📋 Setting up server entry point...');
  copyFileSync('dist/index.js', 'server/index.js');

  // Step 5: Create necessary config directories in dist
  const distConfigDir = join('dist', 'config');
  if (!existsSync(distConfigDir)) {
    mkdirSync(distConfigDir, { recursive: true });
  }

  // Step 6: Copy configuration files if they exist
  if (existsSync(join('config', 'permissions.json'))) {
    copyFileSync(join('config', 'permissions.json'), join('dist', 'config', 'permissions.json'));
    console.log('📋 Copied configuration files');
  }

  // Step 7: Verify deployment readiness
  console.log('🔍 Verifying deployment readiness...');
  const checks = [
    { file: 'server/index.js', description: 'Server entry point' },
    { file: 'dist/public/index.html', description: 'Client build' },
    { file: 'dist/index.js', description: 'Server build' }
  ];

  for (const check of checks) {
    if (existsSync(check.file)) {
      console.log(`✅ ${check.description} ready`);
    } else {
      throw new Error(`❌ ${check.description} missing: ${check.file}`);
    }
  }

  console.log('\n🎉 Deployment build completed successfully!');
  console.log('📄 Build summary:');
  console.log('   ✓ Client built to dist/public/');
  console.log('   ✓ Server built to dist/index.js');
  console.log('   ✓ Server entry point created at server/index.js');
  console.log('   ✓ Ready for deployment with npm start');

} catch (error) {
  console.error('\n❌ Deployment build failed:');
  console.error(error.message);
  process.exit(1);
}