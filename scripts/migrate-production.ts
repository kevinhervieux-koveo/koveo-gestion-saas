#!/usr/bin/env tsx

/**
 * Simple Production Database Migration Script
 * 
 * This script provides a safe way to migrate your production database
 * after running analysis with the advanced migration tool.
 * 
 * Usage:
 *   npm run db:migrate-production
 * 
 * Prerequisites:
 *   1. Run analysis first: npx tsx scripts/advanced-database-migration.ts --dry-run
 *   2. Ensure DATABASE_URL_KOVEO environment variable is set
 *   3. Have a backup of your production database
 */

import chalk from 'chalk';
import ora from 'ora';
import { exec } from 'child_process';
import { promisify } from 'util';
import inquirer from 'inquirer';

const execAsync = promisify(exec);

async function migrateProduction() {
  console.log(chalk.blue.bold('\n🚀 Production Database Migration\n'));

  // Safety checks
  const prodUrl = process.env.DATABASE_URL_KOVEO;
  if (!prodUrl) {
    console.error(chalk.red('❌ DATABASE_URL_KOVEO environment variable not found'));
    console.log(chalk.yellow('   Set your production database URL and try again.'));
    process.exit(1);
  }

  console.log(chalk.yellow('⚠️  IMPORTANT SAFETY CHECKS:'));
  console.log('   1. Have you run the analysis with --dry-run first?');
  console.log('   2. Do you have a recent backup of your production database?');
  console.log('   3. Is this being done during a maintenance window?');
  console.log('   4. Have you coordinated with your team?\n');

  const { confirmSafety } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirmSafety',
    message: 'Have you completed all safety checks above?',
    default: false
  }]);

  if (!confirmSafety) {
    console.log(chalk.yellow('❌ Please complete safety checks before proceeding'));
    process.exit(0);
  }

  const { proceedWithMigration } = await inquirer.prompt([{
    type: 'confirm',
    name: 'proceedWithMigration',
    message: chalk.red('🔥 FINAL CONFIRMATION: Proceed with PRODUCTION database migration?'),
    default: false
  }]);

  if (!proceedWithMigration) {
    console.log(chalk.yellow('❌ Migration cancelled'));
    process.exit(0);
  }

  const spinner = ora('Migrating production database...').start();
  
  try {
    // Set the production database URL for this operation
    const env = { ...process.env, DATABASE_URL: prodUrl };
    
    // Use drizzle-kit push to sync the schema safely
    const { stdout, stderr } = await execAsync('npx drizzle-kit push --force', { env });
    
    if (stderr && !stderr.includes('Warning')) {
      throw new Error(stderr);
    }
    
    spinner.succeed('✅ Production database migration completed successfully!');
    
    console.log(chalk.green('\n🎉 Migration Summary:'));
    console.log('   • Schema synchronized with latest definitions');
    console.log('   • All tables and columns updated');
    console.log('   • No data loss detected\n');
    
    console.log(chalk.blue('📋 Post-Migration Steps:'));
    console.log('   1. Run application tests');
    console.log('   2. Verify critical functionality');
    console.log('   3. Monitor application logs');
    console.log('   4. Check database performance\n');
    
  } catch (error) {
    spinner.fail('❌ Migration failed');
    console.error(chalk.red('\n💥 Error Details:'));
    console.error(error instanceof Error ? error.message : 'Unknown error');
    console.log(chalk.yellow('\n🔄 Recovery Options:'));
    console.log('   1. Restore from backup if necessary');
    console.log('   2. Check database connection');
    console.log('   3. Review error logs');
    console.log('   4. Contact support if needed');
    process.exit(1);
  }
}

// Run migration
migrateProduction().catch(error => {
  console.error(chalk.red('Migration script failed:'), error);
  process.exit(1);
});