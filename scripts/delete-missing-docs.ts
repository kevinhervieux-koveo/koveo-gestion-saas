#!/usr/bin/env tsx

/**
 * Delete Missing Documents - Production Fix
 * 
 * This script automatically removes documents from the database 
 * that don't have corresponding files on the server.
 */

import chalk from 'chalk';
import ora from 'ora';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import * as schema from '../shared/schema.js';

async function deleteMissingDocuments() {
  console.log(chalk.blue.bold('\n🗑️  Production Document Cleanup\n'));

  const dbUrl = process.env.DATABASE_URL_KOVEO || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(chalk.red('❌ No database URL found'));
    process.exit(1);
  }

  const sql = neon(dbUrl);
  const db = drizzle(sql);
  
  const spinner = ora('Scanning for missing documents...').start();

  try {
    // Get all documents with file paths
    const allDocuments = await db
      .select({
        id: schema.documents.id,
        name: schema.documents.name,
        filePath: schema.documents.filePath,
      })
      .from(schema.documents);

    spinner.stop();
    console.log(chalk.green(`✅ Found ${allDocuments.length} documents in database`));

    const uploadsDir = path.join(process.cwd(), 'uploads');
    const missingDocuments = [];

    // Check each document
    for (const doc of allDocuments) {
      if (!doc.filePath) continue;

      const possiblePaths = [
        path.join(uploadsDir, doc.filePath),
        path.join(process.cwd(), doc.filePath),
        `/tmp/uploads/${doc.filePath}`
      ];

      const fileExists = possiblePaths.some(p => fs.existsSync(p));
      
      if (!fileExists) {
        missingDocuments.push(doc);
      }
    }

    if (missingDocuments.length === 0) {
      console.log(chalk.green('\n🎉 All documents have their files present!'));
      return;
    }

    console.log(chalk.yellow(`\n⚠️  Found ${missingDocuments.length} documents with missing files`));
    console.log(chalk.blue('🔧 Removing these records from the database...\n'));

    const deleteSpinner = ora('Deleting missing document records...').start();
    
    let deletedCount = 0;
    for (const doc of missingDocuments) {
      try {
        await db.delete(schema.documents).where(eq(schema.documents.id, doc.id));
        deletedCount++;
        console.log(chalk.gray(`   ✓ Deleted: ${doc.name}`));
      } catch (error) {
        console.log(chalk.red(`   ✗ Failed to delete: ${doc.name}`));
      }
    }

    deleteSpinner.succeed(`✅ Successfully deleted ${deletedCount} missing document records!`);
    
    console.log(chalk.green('\n🎉 Production cleanup completed!'));
    console.log(chalk.blue('📋 Results:'));
    console.log(`   • Documents in database: ${allDocuments.length}`);
    console.log(`   • Documents with missing files: ${missingDocuments.length}`);
    console.log(`   • Successfully deleted: ${deletedCount}`);
    console.log(`   • Working documents remaining: ${allDocuments.length - deletedCount}`);
    
    console.log(chalk.green('\n✨ Your document 404 errors should now be resolved!'));

  } catch (error) {
    spinner.fail('❌ Error during cleanup');
    console.error(chalk.red('\n💥 Error Details:'));
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run the cleanup
deleteMissingDocuments().catch(error => {
  console.error(chalk.red('Script failed:'), error);
  process.exit(1);
});