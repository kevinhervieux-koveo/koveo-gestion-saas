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
    // Local storage cleanup - TODO: Implement cleanup for local file system
    // GCS functionality has been replaced with local storage
    res.json({ message: 'Storage cleanup temporarily disabled - now using local storage instead of GCS' });
    return;

    // Get all file paths from documents table
    const allDocs = await db
      .select({ filePath: documents.filePath })
      .from(documents)
      .where(isNotNull(documents.filePath));

    // Combine all referenced file URLs and extract object paths from hierarchical structure
    const referencedObjectPaths = new Set();

    allDocs.forEach((doc) => {
      if (doc.filePath) {
        try {
          // Convert URL to object path - handles hierarchical paths
          // objectStorageService is not available in local storage mode
          // const normalizedPath = objectStorageService.normalizeObjectEntityPath(doc.filePath);
          // if (normalizedPath.startsWith('/objects/')) {
          //   const objectPath = normalizedPath.replace('/objects/', '');
          //   referencedObjectPaths.add(objectPath);
          // }
        } catch (err) {
          // Silently ignore errors in local storage mode
        }
      }
    });


    // Get private object directory for hierarchical structure
    // objectStorageService and objectStorageClient are not available in local storage mode
    // const privateDir = objectStorageService.getPrivateObjectDir();
    // const bucketName = privateDir.split('/')[1]; // Extract bucket name from path like "/bucket-name/path"
    // const prefixPath = privateDir.split('/').slice(2).join('/'); // Get path after bucket

    // List all files recursively in the storage bucket under the private directory
    // This will scan the entire hierarchy: organization-*/building-*/buildings_documents/* and residence-*/*
    // const bucket = objectStorageClient.bucket(bucketName);
    // const [files] = await bucket.getFiles({ prefix: prefixPath });
    const files: any[] = [];

    let deletedCount = 0;
    const totalFilesInStorage = files.length;
    const deletedFiles: string[] = [];

    // Check each file in storage across the hierarchical structure
    for (const file of files) {
      // Get the object path relative to the private directory
      let objectPath = file.name;

      // Remove the private directory prefix to get the hierarchical path
      // const prefixPath = ''; // Not available in local storage mode
      // if (objectPath.startsWith(prefixPath)) {
      //   objectPath = objectPath.substring(prefixPath.length);
      //   // Remove leading slash if present
      //   if (objectPath.startsWith('/')) {
      //     objectPath = objectPath.substring(1);
      //   }
      // }

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
        // await file.delete();
        deletedFiles.push(objectPath);
        deletedCount++;
      } catch (err) {
        // Silently ignore errors in local storage mode
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
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup storage: ' + (err as Error).message,
    });
  }
});

/**
 * Get storage statistics.
 */
router.get('/storage-stats', async (req, res) => {
  try {
    // Get database file count
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
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Failed to get storage statistics: ' + (err as Error).message,
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

    res.json({
      success: true,
      message: 'Auto-cleanup completed successfully',
      result,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Auto-cleanup failed: ' + (err as Error).message,
    });
  }
});

export default router;
