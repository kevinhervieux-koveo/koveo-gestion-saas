#!/usr/bin/env tsx

/**
 * Clean Up Missing Documents
 * 
 * This script finds documents in the database that have no corresponding files
 * and offers to remove them or mark them as unavailable.
 */

import chalk from 'chalk';
import ora from 'ora';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import * as schema from '../shared/schema.js';
import inquirer from 'inquirer';

async function cleanupMissingDocuments() {
  console.log(chalk.blue.bold('\n🧹 Missing Documents Cleanup Tool\n'));

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
        fileName: schema.documents.fileName
      })
      .from(schema.documents);

    spinner.stop();
    console.log(chalk.green(`✅ Found ${allDocuments.length} documents in database`));

    const uploadsDir = path.join(process.cwd(), 'uploads');
    const missingFiles = [];

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
        missingFiles.push({
          id: doc.id,
          name: doc.name,
          filePath: doc.filePath
        });
      }
    }

    if (missingFiles.length === 0) {
      console.log(chalk.green('\n🎉 All documents have their files present!'));
      return;
    }

    console.log(chalk.yellow(`\n⚠️  Found ${missingFiles.length} documents with missing files:\n`));
    
    missingFiles.slice(0, 10).forEach((doc, index) => {
      console.log(chalk.white(`${index + 1}. ${doc.name}`));
      console.log(chalk.gray(`   ID: ${doc.id}`));
      console.log(chalk.gray(`   Path: ${doc.filePath}`));
      console.log('');
    });

    if (missingFiles.length > 10) {
      console.log(chalk.gray(`   ... and ${missingFiles.length - 10} more documents\n`));
    }

    // Ask user what to do
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do with these missing documents?',
        choices: [
          {
            name: '🗑️  Delete database records (removes them completely)',
            value: 'delete'
          },
          {
            name: '🔒 Mark as quarantined (keeps records but makes them unavailable)',
            value: 'quarantine'
          },
          {
            name: '📋 Just show the list (no changes)',
            value: 'list'
          }
        ]
      }
    ]);

    if (action === 'list') {
      console.log(chalk.blue('\n📋 Full list of missing documents saved to console.'));
      missingFiles.forEach((doc, index) => {
        console.log(`${index + 1}. ${doc.name} (${doc.id})`);
      });
      return;
    }

    if (action === 'delete') {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: chalk.red(`Are you sure you want to DELETE ${missingFiles.length} document records? This cannot be undone.`),
          default: false
        }
      ]);

      if (!confirm) {
        console.log(chalk.yellow('❌ Operation cancelled.'));
        return;
      }

      const deleteSpinner = ora('Deleting missing document records...').start();
      
      for (const doc of missingFiles) {
        await db.delete(schema.documents).where(eq(schema.documents.id, doc.id));
      }

      deleteSpinner.succeed(`✅ Deleted ${missingFiles.length} document records successfully!`);
    }

    if (action === 'quarantine') {
      const quarantineSpinner = ora('Marking documents as quarantined...').start();
      
      for (const doc of missingFiles) {
        await db
          .update(schema.documents)
          .set({ isQuarantined: true })
          .where(eq(schema.documents.id, doc.id));
      }

      quarantineSpinner.succeed(`✅ Marked ${missingFiles.length} documents as quarantined!`);
    }

    console.log(chalk.green('\n🎉 Cleanup completed!'));
    console.log(chalk.blue('Your existing documents should now work without 404 errors.'));

  } catch (error) {
    spinner.fail('❌ Error during cleanup');
    console.error(chalk.red('\n💥 Error Details:'));
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run the cleanup
cleanupMissingDocuments().catch(error => {
  console.error(chalk.red('Script failed:'), error);
  process.exit(1);
});