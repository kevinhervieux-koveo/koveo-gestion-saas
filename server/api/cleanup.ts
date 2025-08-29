import { Router } from 'express';
import { documents } from '../../shared/schema';
import { db } from '../db';
import { isNotNull } from 'drizzle-orm';

const router = Router();

/**
 * Clean up orphaned files in object storage that are not referenced in the database.
 */
router.post('/cleanup-storage', async (req, res) => {
  try {
    // Storage cleanup temporarily disabled - needs update for new GCS system
    res.json({ 
      message: 'Storage cleanup temporarily disabled - needs update for new GCS system',
      results: {
        referencedFiles: 0,
        orphanedFiles: 0,
        deletedFiles: 0,
        failures: 0,
      },
    });
  } catch (error: any) {
    console.error('Error during storage cleanup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup storage: ' + error.message,
    });
  }
});

/**
 * Get storage statistics.
 */
router.get('/storage-stats', async (req, res) => {
  try {
    // Get database file counts from unified documents table
    const allDocs = await db
      .select({ id: documents.id })
      .from(documents)
      .where(isNotNull(documents.filePath));

    const totalDbFiles = allDocs.length;

    res.json({
      database: {
        totalDocuments: allDocs.length,
        total: totalDbFiles,
      },
      message: `Database contains ${totalDbFiles} documents with attached files`,
    });
  } catch (error: any) {
    console.error('Error getting storage stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get storage statistics',
    });
  }
});

/**
 * Auto-cleanup endpoint that runs automatically.
 */
router.post('/auto-cleanup', async (req, res) => {
  try {
    // Call the cleanup storage function
    const cleanupResponse = await fetch('http://localhost:5000/api/admin/cleanup-storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await cleanupResponse.json();

    console.warn('Auto-cleanup completed:', result);

    res.json({
      success: true,
      message: 'Auto-cleanup completed successfully',
      result,
    });
  } catch (error: any) {
    console.error('Auto-cleanup failed:', error);
    res.status(500).json({
      success: false,
      error: 'Auto-cleanup failed: ' + error.message,
    });
  }
});

export default router;
