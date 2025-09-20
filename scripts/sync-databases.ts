#!/usr/bin/env tsx
/**
 * Database Synchronization Script
 * Ensures schema changes are applied to both development and production databases
 */

import { execFileSync } from 'child_process';
import chalk from 'chalk';

const DEV_DB = process.env.DATABASE_URL;
const PROD_DB = process.env.DATABASE_URL_KOVEO;

if (!DEV_DB || !PROD_DB) {
  console.error(chalk.red('❌ Missing database environment variables'));
  console.error('Required: DATABASE_URL and DATABASE_URL_KOVEO');
  process.exit(1);
}

console.log(chalk.blue('🔄 Starting database synchronization...'));

/**
 * Execute a SQL command on both databases
 */
async function executeDualQuery(sql: string, description: string) {
  console.log(chalk.yellow(`\n📝 ${description}`));
  
  try {
    // Execute on development database using stdin to prevent command injection
    console.log(chalk.cyan('  → Development database...'));
    execFileSync('psql', ['--dbname', DEV_DB, '-f', '-'], { 
      input: sql,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log(chalk.green('    ✓ Development: Success'));
    
    // Execute on production database
    console.log(chalk.cyan('  → Production database...'));
    execFileSync('psql', ['--dbname', PROD_DB, '-f', '-'], { 
      input: sql,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log(chalk.green('    ✓ Production: Success'));
    
    console.log(chalk.green(`  ✅ ${description} completed on both databases`));
  } catch (error) {
    console.error(chalk.red(`  ❌ Error during: ${description}`));
    console.error(chalk.red(`     ${error.message}`));
    throw error;
  }
}

/**
 * Push Drizzle schema to both databases
 */
async function pushDrizzleSchema() {
  console.log(chalk.blue('\n🚀 Pushing Drizzle schema changes...'));
  
  try {
    // Push to development
    console.log(chalk.cyan('  → Pushing to development database...'));
    process.env.DATABASE_URL = DEV_DB;
    execFileSync('npm', ['run', 'db:push'], { stdio: 'inherit' });
    console.log(chalk.green('    ✓ Development schema updated'));
    
    // Push to production
    console.log(chalk.cyan('  → Pushing to production database...'));
    process.env.DATABASE_URL = PROD_DB;
    execFileSync('npm', ['run', 'db:push'], { stdio: 'inherit' });
    console.log(chalk.green('    ✓ Production schema updated'));
    
    // Restore original DATABASE_URL
    process.env.DATABASE_URL = DEV_DB;
    
    console.log(chalk.green('  ✅ Schema synchronization completed'));
  } catch (error) {
    console.error(chalk.red('❌ Schema push failed'));
    console.error(chalk.red(error.message));
    throw error;
  }
}

/**
 * Verify both databases have the same schema structure
 */
async function verifySchemaSync() {
  console.log(chalk.blue('\n🔍 Verifying schema synchronization...'));
  
  const checkQuery = `
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    ORDER BY table_name, ordinal_position;
  `;
  
  try {
    const devResult = execFileSync('psql', ['--dbname', DEV_DB, '-t', '-f', '-'], { 
      input: checkQuery,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    const prodResult = execFileSync('psql', ['--dbname', PROD_DB, '-t', '-f', '-'], { 
      input: checkQuery,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    if (devResult.trim() === prodResult.trim()) {
      console.log(chalk.green('  ✅ Schemas are synchronized'));
      return true;
    } else {
      console.log(chalk.red('  ❌ Schema mismatch detected'));
      return false;
    }
  } catch (error) {
    console.error(chalk.red('❌ Schema verification failed'));
    console.error(chalk.red(error.message));
    return false;
  }
}

/**
 * Main synchronization function
 */
async function main() {
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'push':
        await pushDrizzleSchema();
        await verifySchemaSync();
        break;
        
      case 'verify':
        await verifySchemaSync();
        break;
        
      case 'execute':
        const sql = process.argv[3];
        const description = process.argv[4] || 'Custom SQL execution';
        if (!sql) {
          console.error(chalk.red('❌ SQL command required'));
          console.log('Usage: npm run sync-db execute "SQL_COMMAND" "description"');
          process.exit(1);
        }
        await executeDualQuery(sql, description);
        break;
        
      default:
        console.log(chalk.blue('🔧 Database Synchronization Tool'));
        console.log('\nCommands:');
        console.log('  push    - Push Drizzle schema to both databases');
        console.log('  verify  - Verify schemas are synchronized');
        console.log('  execute - Execute SQL on both databases');
        console.log('\nExamples:');
        console.log('  npm run sync-db push');
        console.log('  npm run sync-db verify');
        console.log('  npm run sync-db execute "ALTER TABLE..." "Add constraint"');
        break;
    }
    
    console.log(chalk.green('\n✅ Database synchronization completed successfully'));
  } catch (error) {
    console.error(chalk.red('\n❌ Database synchronization failed'));
    process.exit(1);
  }
}

// Execute if called directly
main();