#!/usr/bin/env tsx

/**
 * Import Demo Organization Script
 * 
 * This script imports Demo organization data from a JSON export file.
 * Used in production to import development Demo data.
 * 
 * Usage: tsx scripts/import-demo-organization.ts
 */

import { execSync } from 'child_process';

console.log('🔄 Starting Demo organization import...');

try {
  // Run the sync script in import mode
  execSync('tsx scripts/sync-demo-organization.ts import', { 
    stdio: 'inherit',
    env: process.env 
  });
  console.log('✅ Demo organization import completed');
} catch (error) {
  console.error('❌ Demo organization import failed:', error);
  process.exit(1);
}