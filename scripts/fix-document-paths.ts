#!/usr/bin/env tsx

/**
 * Fix Document File Paths Script
 * 
 * This script fixes the mismatch between database file paths and actual file locations
 * that occurs after file storage reorganization.
 * 
 * Usage: npx tsx scripts/fix-document-paths.ts
 */

import chalk from 'chalk';
import ora from 'ora';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import * as schema from '../shared/schema.js';
const { documents } = schema;

async function fixDocumentPaths() {
  console.log(chalk.blue.bold('\n🔧 Document Path Fixer for Koveo Gestion\n'));

  // Use production database URL if available
  const dbUrl = process.env.DATABASE_URL_KOVEO || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(chalk.red('❌ No database URL found'));
    process.exit(1);
  }

  const sql = neon(dbUrl);
  const db = drizzle(sql);
  
  const spinner = ora('Analyzing document file paths...').start();

  try {
    // Get all documents with file paths
    const allDocuments = await db
      .select({
        id: documents.id,
        name: documents.name,
        filePath: documents.filePath,
        fileName: documents.fileName
      })
      .from(documents);

    spinner.stop();
    console.log(chalk.green(`✅ Found ${allDocuments.length} documents with file paths`));

    const uploadsDir = path.join(process.cwd(), 'uploads');
    console.log(chalk.blue(`📁 Checking files in: ${uploadsDir}`));
    const fixes = [];

    // Check each document
    for (const doc of allDocuments) {
      if (!doc.filePath) continue;

      const currentPath = path.join(uploadsDir, doc.filePath);
      
      if (!fs.existsSync(currentPath)) {
        // File doesn't exist at expected location - try to find it
        const fileName = path.basename(doc.filePath);
        const possibleLocations = [];

        // Search for file by name in the uploads directory
        const findFileRecursively = (dir: string, targetFile: string): string[] => {
          const found = [];
          try {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            for (const item of items) {
              const fullPath = path.join(dir, item.name);
              if (item.isDirectory()) {
                // Skip quarantine directories
                if (!item.name.includes('quarantine')) {
                  found.push(...findFileRecursively(fullPath, targetFile));
                }
              } else if (item.name === targetFile || item.name.includes(targetFile.replace(/\.[^/.]+$/, ""))) {
                found.push(fullPath);
              }
            }
          } catch (error) {
            // Skip directories we can't read
          }
          return found;
        };

        const foundFiles = findFileRecursively(uploadsDir, fileName);
        
        if (foundFiles.length > 0) {
          // Calculate relative path from uploads directory
          const newPath = path.relative(uploadsDir, foundFiles[0]);
          fixes.push({
            docId: doc.id,
            docName: doc.name,
            oldPath: doc.filePath,
            newPath: newPath,
            fullPath: foundFiles[0]
          });
        } else {
          console.log(chalk.yellow(`⚠️  File not found: ${doc.name} (${fileName})`));
        }
      } else {
        console.log(chalk.green(`✅ File exists: ${doc.name}`));
      }
    }

    if (fixes.length === 0) {
      console.log(chalk.green('\n🎉 All document paths are correct!'));
      return;
    }

    console.log(chalk.blue(`\n📋 Found ${fixes.length} documents that need path fixes:\n`));
    
    fixes.forEach((fix, index) => {
      console.log(chalk.white(`${index + 1}. ${fix.docName}`));
      console.log(chalk.red(`   OLD: ${fix.oldPath}`));
      console.log(chalk.green(`   NEW: ${fix.newPath}`));
      console.log('');
    });

    // Apply fixes
    const updateSpinner = ora('Updating document paths in database...').start();
    
    for (const fix of fixes) {
      await db
        .update(documents)
        .set({ filePath: fix.newPath })
        .where(eq(documents.id, fix.docId));
    }

    updateSpinner.succeed(`✅ Updated ${fixes.length} document paths successfully!`);
    
    console.log(chalk.green('\n🎉 Document path fixing completed!'));
    console.log(chalk.blue('\n📋 Next steps:'));
    console.log('   1. Test document viewing in your application');
    console.log('   2. Verify files are accessible');
    console.log('   3. Consider running a cleanup of orphaned files');

  } catch (error) {
    spinner.fail('❌ Error fixing document paths');
    console.error(chalk.red('\n💥 Error Details:'));
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run the fixer
fixDocumentPaths().catch(error => {
  console.error(chalk.red('Script failed:'), error);
  process.exit(1);
});