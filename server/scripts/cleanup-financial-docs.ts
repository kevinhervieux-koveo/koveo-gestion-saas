#!/usr/bin/env tsx

/**
 * Financial Documents Cleanup Script
 * 
 * Removes financial documents containing 'Receipt' or 'invoice' in their names
 * from the production database.
 */

import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import { documents } from '../../shared/schema';
import { and, eq, ilike, or } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';

// Use production database for this cleanup
const DATABASE_URL = process.env.DATABASE_URL_KOVEO;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL_KOVEO environment variable is required for production cleanup');
  process.exit(1);
}

async function findFinancialDocuments() {
  console.log('🔍 Searching for financial documents with "Receipt" or "invoice" in production database...');
  
  try {
    const db = drizzle(new Pool({ connectionString: DATABASE_URL }));

    // Find documents in financial category with Receipt or invoice in name (case insensitive)
    const matchingDocs = await db
      .select({
        id: documents.id,
        title: documents.title,
        fileName: documents.fileName,
        category: documents.category,
        filePath: documents.filePath,
        organizationId: documents.organizationId,
        buildingId: documents.buildingId,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(
        and(
          eq(documents.category, 'financial'),
          or(
            ilike(documents.title, '%receipt%'),
            ilike(documents.title, '%invoice%'),
            ilike(documents.fileName, '%receipt%'),
            ilike(documents.fileName, '%invoice%')
          )
        )
      )
      .orderBy(documents.createdAt);

    return matchingDocs;
  } catch (error) {
    console.error('❌ Error querying database:', error);
    throw error;
  }
}

async function deleteFinancialDocuments(docIds: string[]) {
  console.log('🗑️  Deleting documents from database...');
  
  try {
    const db = drizzle(new Pool({ connectionString: DATABASE_URL }));
    
    // Delete documents from database
    const deletedCount = await db
      .delete(documents)
      .where(
        and(
          eq(documents.category, 'financial'),
          or(
            ilike(documents.title, '%receipt%'),
            ilike(documents.title, '%invoice%'),
            ilike(documents.fileName, '%receipt%'),
            ilike(documents.fileName, '%invoice%')
          )
        )
      );

    return deletedCount;
  } catch (error) {
    console.error('❌ Error deleting from database:', error);
    throw error;
  }
}

async function deletePhysicalFiles(filePaths: string[]) {
  console.log('🗑️  Deleting physical files...');
  
  let deletedFiles = 0;
  let failedFiles = 0;
  
  for (const filePath of filePaths) {
    if (filePath) {
      try {
        // Convert URL path to actual file path
        const actualPath = filePath.startsWith('/') ? path.join(process.cwd(), 'dist', filePath) : filePath;
        
        await fs.unlink(actualPath);
        deletedFiles++;
        console.log(`   ✅ Deleted: ${actualPath}`);
      } catch (error: any) {
        failedFiles++;
        if (error.code !== 'ENOENT') {
          console.log(`   ❌ Failed to delete: ${filePath} - ${error.message}`);
        } else {
          console.log(`   ⚠️  File not found (already deleted): ${filePath}`);
        }
      }
    }
  }
  
  return { deletedFiles, failedFiles };
}

async function cleanupFinancialDocs() {
  console.log('🧹 Starting financial documents cleanup (Production Database)...');
  console.log('📋 Target: Financial documents containing "Receipt" or "invoice" (case insensitive)');
  console.log('');

  try {
    // Step 1: Find matching documents
    const matchingDocs = await findFinancialDocuments();
    
    if (matchingDocs.length === 0) {
      console.log('✅ No financial documents found with "Receipt" or "invoice" in their names.');
      return;
    }

    // Step 2: Display what will be deleted
    console.log(`📋 Found ${matchingDocs.length} documents to delete:`);
    console.log('─'.repeat(80));
    
    matchingDocs.forEach((doc, index) => {
      console.log(`${index + 1}. ${doc.title || doc.fileName}`);
      console.log(`   Category: ${doc.category}`);
      console.log(`   File: ${doc.fileName || 'N/A'}`);
      console.log(`   Path: ${doc.filePath || 'N/A'}`);
      console.log(`   Created: ${doc.createdAt?.toISOString() || 'N/A'}`);
      console.log('');
    });

    console.log('─'.repeat(80));
    console.log(`⚠️  WARNING: This will permanently delete ${matchingDocs.length} documents!`);
    console.log('');

    // Step 3: For now, just show what would be deleted (safety measure)
    console.log('📝 Documents identified for deletion. Run with --confirm flag to proceed.');
    
    // Check if --confirm flag is provided
    const confirmFlag = process.argv.includes('--confirm');
    
    if (!confirmFlag) {
      console.log('');
      console.log('To proceed with deletion, run:');
      console.log('npx tsx server/scripts/cleanup-financial-docs.ts --confirm');
      return;
    }

    // Step 4: Proceed with deletion if confirmed
    console.log('🚀 Proceeding with deletion (--confirm flag detected)...');
    
    const filePaths = matchingDocs.map(doc => doc.filePath).filter(Boolean);
    const docIds = matchingDocs.map(doc => doc.id);

    // Delete from database
    const deletedFromDb = await deleteFinancialDocuments(docIds);
    
    // Delete physical files
    const { deletedFiles, failedFiles } = await deletePhysicalFiles(filePaths);
    
    // Summary
    console.log('');
    console.log('📊 Cleanup Summary:');
    console.log(`   Database records deleted: ${deletedFromDb}`);
    console.log(`   Physical files deleted: ${deletedFiles}`);
    console.log(`   Failed file deletions: ${failedFiles}`);
    console.log('');
    console.log('✅ Financial documents cleanup completed!');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run the cleanup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupFinancialDocs()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { cleanupFinancialDocs };