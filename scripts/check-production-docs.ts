#!/usr/bin/env tsx

/**
 * Check Production Document Paths
 * 
 * This script checks what paths are stored in production database for failing documents
 */

import chalk from 'chalk';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import * as schema from '../shared/schema.js';

async function checkProductionDocs() {
  console.log(chalk.blue.bold('\n🔍 Production Document Path Checker\n'));

  const dbUrl = process.env.DATABASE_URL_KOVEO;
  if (!dbUrl) {
    console.error(chalk.red('❌ No production database URL found'));
    process.exit(1);
  }

  const sql = neon(dbUrl);
  const db = drizzle(sql);
  
  console.log(chalk.blue('🔗 Connected to production database'));

  try {
    // Check the specific failing document
    const failingDocId = '007e0a64-ed72-4e06-bd86-72bc63095dca';
    
    console.log(chalk.yellow(`\n📄 Checking failing document: ${failingDocId}\n`));
    
    const document = await db.select().from(schema.documents).where(eq(schema.documents.id, failingDocId));
    
    if (document.length === 0) {
      console.log(chalk.red('❌ Document not found in production database'));
      return;
    }

    const doc = document[0];
    console.log(chalk.green('✅ Document found in database:'));
    console.log(`   Name: ${doc.name}`);
    console.log(`   FilePath: ${doc.filePath || 'NULL'}`);
    console.log(`   FileName: ${doc.fileName || 'NULL'}`);
    
    if (doc.filePath) {
      const uploadsPath = path.join(process.cwd(), 'uploads', doc.filePath);
      const directPath = path.join(process.cwd(), doc.filePath);
      
      console.log(chalk.blue('\n📁 Checking file existence:'));
      console.log(`   Expected path 1: ${uploadsPath}`);
      console.log(`   Exists: ${fs.existsSync(uploadsPath) ? '✅' : '❌'}`);
      
      console.log(`   Expected path 2: ${directPath}`);
      console.log(`   Exists: ${fs.existsSync(directPath) ? '✅' : '❌'}`);
      
      // Check current working directory
      console.log(chalk.blue('\n📂 Environment info:'));
      console.log(`   Current working directory: ${process.cwd()}`);
      console.log(`   Uploads directory exists: ${fs.existsSync(path.join(process.cwd(), 'uploads')) ? '✅' : '❌'}`);
      
      // List uploads directory structure
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (fs.existsSync(uploadsDir)) {
        console.log(chalk.blue('\n📋 Uploads directory structure:'));
        const items = fs.readdirSync(uploadsDir);
        items.slice(0, 10).forEach(item => {
          console.log(`   ${item}`);
        });
        if (items.length > 10) {
          console.log(`   ... and ${items.length - 10} more items`);
        }
      }
    }

  } catch (error) {
    console.error(chalk.red('❌ Error checking production document:'), error);
  }
}

// Run the checker
checkProductionDocs().catch(error => {
  console.error(chalk.red('Script failed:'), error);
  process.exit(1);
});