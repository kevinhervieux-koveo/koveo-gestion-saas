#!/usr/bin/env node

/**
 * Production build script for deployment
 * This ensures the server entry point is created at the correct location
 */

import { execSync } from 'child_process';
import { copyFileSync, existsSync } from 'fs';

console.log('🔨 Building for production deployment...');

try {
  // Run the standard build command
  console.log('📦 Building client and server...');
  execSync('npm run build', { stdio: 'inherit' });

  // Ensure server/index.js exists for deployment
  if (existsSync('dist/index.js')) {
    console.log('📋 Copying server file to expected location...');
    copyFileSync('dist/index.js', 'server/index.js');
    console.log('✅ Server entry point created at server/index.js');
  } else {
    throw new Error('Built server file not found at dist/index.js');
  }

  console.log('🚀 Production build completed successfully!');
  console.log('✅ Ready for deployment');
  
} catch (error) {
  console.error('❌ Production build failed:', error.message);
  process.exit(1);
}