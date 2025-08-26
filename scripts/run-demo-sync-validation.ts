#!/usr/bin/env tsx

import validateDemoSync from './validate-demo-sync';

/**
 * Standalone script to run demo organization sync validation
 * This is designed to be called from npm scripts or CI/CD pipelines
 */

console.log('🔄 Running Demo Organization Sync Validation...');

validateDemoSync()
  .then(() => {
    console.log('✅ Demo sync validation completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Demo sync validation failed:', error);
    process.exit(1);
  });