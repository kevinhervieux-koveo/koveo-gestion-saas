#!/usr/bin/env node
/**
 * Production Database Migration Script
 * This script automatically handles interactive prompts from drizzle-kit push
 */

import { spawn } from 'child_process';

console.log('🚀 Starting production database migration...');
console.log('📋 This will sync your production database with the current schema');

const child = spawn('npx', ['drizzle-kit', 'push', '--config', 'drizzle.production.config.ts'], {
  stdio: ['pipe', 'inherit', 'inherit']
});

// Handle the construction_date column prompt
child.stdin.write('create column\n');

child.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Production database migration completed successfully!');
    console.log('🌐 Your site https://koveo-gestion.com should now be working');
  } else {
    console.error('❌ Migration failed with exit code:', code);
    console.error('💡 Try running the SQL script directly instead');
  }
});

child.on('error', (error) => {
  console.error('❌ Failed to start migration:', error.message);
  console.error('💡 Make sure you have DATABASE_URL_KOVEO environment variable set');
});