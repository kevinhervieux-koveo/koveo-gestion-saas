#!/usr/bin/env tsx
/**
 * One-time database index setup script
 * Run this once to create all indexes, then they persist in the database
 */

import { neon } from '@neondatabase/serverless';
import { QueryOptimizer } from '../server/database-optimization.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sql = neon(process.env.DATABASE_URL!);

async function setupDatabaseIndexes() {
  console.log('🗄️ Setting up database indexes (one-time setup)...');

  try {
    // Apply all core database optimizations
    await QueryOptimizer.applyCoreOptimizations();

    console.log('✅ Database indexes created successfully');
    console.log('📝 Indexes are now persistent in your database');
    console.log('🚀 Future deployments will skip index creation for faster startup');
  } catch (error) {
    console.error('❌ Failed to create database indexes:', error);
    process.exit(1);
  }
}

// Run if called directly (ES module check)
const isMainModule =
  import.meta.url === 'file://' + process.argv[1] || import.meta.url.endsWith(process.argv[1]);

if (isMainModule) {
  setupDatabaseIndexes();
}

export { setupDatabaseIndexes };
