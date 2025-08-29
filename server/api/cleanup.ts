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
    // ObjectStorageService has been replaced with Python GCS functions
    // TODO: Implement cleanup using new Python functions
    res.json({ message: 'Storage cleanup temporarily disabled - needs update for new GCS system' });
    return;

    // Get all file paths from the unified documents table
    const allDocs = await db
      .select({ filePath: documents.filePath })
      .from(documents)
      .where(isNotNull(documents.filePath));

    // Extract object paths from GCS paths
    const referencedObjectPaths = new Set();

    allDocs.forEach((doc) => {
      if (doc.filePath) {
        try {
          // Convert GCS path to object path - handles hierarchical paths
          const normalizedPath = objectStorageService.normalizeObjectEntityPath(doc.filePath);
          if (normalizedPath.startsWith('/objects/')) {
            const objectPath = normalizedPath.replace('/objects/', '');
            referencedObjectPaths.add(objectPath);
          }
        } catch (_error) {
          console.warn(`Could not normalize path for ${doc.fileUrl}`);
        }
      }
    });

    console.warn(`Found ${referencedObjectPaths.size} files referenced in database`);

    // Get private object directory for hierarchical structure
    const privateDir = objectStorageService.getPrivateObjectDir();
    const bucketName = privateDir.split('/')[1]; // Extract bucket name from path like "/bucket-name/path"
    const prefixPath = privateDir.split('/').slice(2).join('/'); // Get path after bucket

    // List all files recursively in the storage bucket under the private directory
    // This will scan the entire hierarchy: organization-*/building-*/buildings_documents/* and residence-*/*
    const bucket = objectStorageClient.bucket(bucketName);
    const [files] = await bucket.getFiles({ prefix: prefixPath });

    let deletedCount = 0;
    const totalFilesInStorage = files.length;
    const deletedFiles: string[] = [];

    // Check each file in storage across the hierarchical structure
    for (const file of files) {
      // Get the object path relative to the private directory
      let objectPath = file.name;

      // Remove the private directory prefix to get the hierarchical path
      if (objectPath.startsWith(prefixPath)) {
        objectPath = objectPath.substring(prefixPath.length);
        // Remove leading slash if present
        if (objectPath.startsWith('/')) {
          objectPath = objectPath.substring(1);
        }
      }

      // Skip if this file is referenced in the database
      if (referencedObjectPaths.has(objectPath)) {
        continue;
      }

      // Skip directory markers, empty paths, and folders
      if (file.name.endsWith('/') || !objectPath || objectPath.split('/').length < 4) {
        // Hierarchical files should have at least: organization-id/building-id/type/filename
        continue;
      }

      try {
        // Delete orphaned file
        await file.delete();
        deletedFiles.push(objectPath);
        deletedCount++;
        console.warn(`Deleted orphaned file: ${objectPath}`);
      } catch (_error) {
        console.error(`Failed to delete ${objectPath}:`, _error);
      }
    }

    res.json({
      success: true,
      message: `Cleanup complete. Deleted ${deletedCount} orphaned files.`,
      details: {
        totalFilesInStorage,
        referencedInDatabase: referencedObjectPaths.size,
        deletedOrphaned: deletedCount,
        deletedFiles,
      },
    });
  } catch (_error) {
    console.error('Error during storage cleanup:', _error);
    res.status(500).json({
      success: false,
      _error: 'Failed to cleanup storage: ' + error.message,
    });
  }
});

/**
 * Get storage statistics.
 */
router.get('/storage-stats', async (req, res) => {
  try {
    // Get database file counts
    const buildingDocs = await db
      .select({ id: documentsBuildings.id })
      .from(documentsBuildings)
      .where(isNotNull(documentsBuildings.fileUrl));

    const residentDocs = await db
      .select({ id: documentsResidents.id })
      .from(documentsResidents)
      .where(isNotNull(documentsResidents.fileUrl));

    const totalDbFiles = buildingDocs.length + residentDocs.length;

    res.json({
      database: {
        buildingDocuments: buildingDocs.length,
        residentDocuments: residentDocs.length,
        total: totalDbFiles,
      },
      message: `Database contains ${totalDbFiles} documents with attached files`,
    });
  } catch (_error) {
    console.error('Error getting storage stats:', _error);
    res.status(500).json({
      success: false,
      _error: 'Failed to get storage statistics',
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

    console.warn('Auto-cleanup completed:', _result);

    res.json({
      success: true,
      message: 'Auto-cleanup completed successfully',
      result,
    });
  } catch (_error) {
    console.error('Auto-cleanup failed:', _error);
    res.status(500).json({
      success: false,
      _error: 'Auto-cleanup failed: ' + error.message,
    });
  }
});

export default router;
