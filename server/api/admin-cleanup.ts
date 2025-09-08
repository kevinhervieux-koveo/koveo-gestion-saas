import { Router } from 'express';
import { db } from '../db';
import { documents } from '../../shared/schema';
import { and, eq, ilike, or } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';

const router = Router();

/**
 * TEMPORARY ADMIN ENDPOINT: Find financial documents with Receipt/Invoice
 * DELETE after cleanup is complete
 */
router.get('/cleanup-financial-preview', async (req, res) => {
  try {
    console.log('🔍 Admin cleanup: Finding financial documents with Receipt/Invoice...');

    // Find documents in financial category with Receipt or invoice in name (case insensitive)
    const matchingDocs = await db
      .select({
        id: documents.id,
        name: documents.name,
        fileName: documents.fileName,
        documentType: documents.documentType,
        filePath: documents.filePath,
        buildingId: documents.buildingId,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(
        and(
          eq(documents.documentType, 'financial'),
          or(
            ilike(documents.name, '%receipt%'),
            ilike(documents.name, '%invoice%'),
            ilike(documents.fileName, '%receipt%'),
            ilike(documents.fileName, '%invoice%')
          )
        )
      )
      .orderBy(documents.createdAt);

    console.log(`📋 Found ${matchingDocs.length} matching documents`);

    res.json({
      success: true,
      count: matchingDocs.length,
      documents: matchingDocs,
      message: `Found ${matchingDocs.length} financial documents containing 'Receipt' or 'invoice'`
    });

  } catch (error: any) {
    console.error('❌ Error in admin cleanup preview:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to preview documents for cleanup'
    });
  }
});

/**
 * TEMPORARY ADMIN ENDPOINT: Delete financial documents with Receipt/Invoice
 * DELETE after cleanup is complete
 */
router.delete('/cleanup-financial-execute', async (req, res) => {
  try {
    console.log('🗑️  Admin cleanup: Executing deletion of financial Receipt/Invoice documents...');

    // First get the documents to delete for file cleanup
    const docsToDelete = await db
      .select({
        id: documents.id,
        name: documents.name,
        fileName: documents.fileName,
        filePath: documents.filePath,
      })
      .from(documents)
      .where(
        and(
          eq(documents.documentType, 'financial'),
          or(
            ilike(documents.name, '%receipt%'),
            ilike(documents.name, '%invoice%'),
            ilike(documents.fileName, '%receipt%'),
            ilike(documents.fileName, '%invoice%')
          )
        )
      );

    if (docsToDelete.length === 0) {
      return res.json({
        success: true,
        deletedCount: 0,
        filesDeleted: 0,
        message: 'No matching documents found to delete'
      });
    }

    // Delete from database
    const deleteResult = await db
      .delete(documents)
      .where(
        and(
          eq(documents.documentType, 'financial'),
          or(
            ilike(documents.name, '%receipt%'),
            ilike(documents.name, '%invoice%'),
            ilike(documents.fileName, '%receipt%'),
            ilike(documents.fileName, '%invoice%')
          )
        )
      );

    // Delete physical files
    let deletedFiles = 0;
    let failedFiles = 0;
    
    for (const doc of docsToDelete) {
      if (doc.filePath) {
        try {
          // Convert URL path to actual file path
          const actualPath = doc.filePath.startsWith('/') 
            ? path.join(process.cwd(), 'dist', doc.filePath) 
            : doc.filePath;
          
          await fs.unlink(actualPath);
          deletedFiles++;
          console.log(`   ✅ Deleted file: ${actualPath}`);
        } catch (error: any) {
          failedFiles++;
          if (error.code !== 'ENOENT') {
            console.log(`   ❌ Failed to delete: ${doc.filePath} - ${error.message}`);
          } else {
            console.log(`   ⚠️  File not found: ${doc.filePath}`);
          }
        }
      }
    }

    console.log(`📊 Cleanup completed: ${docsToDelete.length} database records, ${deletedFiles} files deleted, ${failedFiles} file failures`);

    res.json({
      success: true,
      deletedCount: docsToDelete.length,
      filesDeleted: deletedFiles,
      failedFiles: failedFiles,
      message: `Successfully deleted ${docsToDelete.length} financial documents containing 'Receipt' or 'invoice'`
    });

  } catch (error: any) {
    console.error('❌ Error in admin cleanup execution:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to execute document cleanup'
    });
  }
});

export default router;