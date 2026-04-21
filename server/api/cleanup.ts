import { Router } from 'express';
import { documents } from '../../shared/schema';
import { db } from '../db';
import { isNotNull } from 'drizzle-orm';
import { requireAuth, requireRole } from '../auth';
import * as fs from 'fs/promises';
import * as path from 'path';

const router = Router();

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

async function getAllFilesRecursively(dir: string, baseDir: string = dir): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        const subFiles = await getAllFilesRecursively(fullPath, baseDir);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const relativePath = path.relative(baseDir, fullPath);
        files.push(relativePath);
      }
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error(`Error reading directory ${dir}:`, err);
  }
  
  return files;
}

export async function runCleanupStorage(dryRun: boolean = true) {
  const allDocs = await db
    .select({ filePath: documents.filePath })
    .from(documents)
    .where(isNotNull(documents.filePath));

  const referencedPaths = new Set<string>();
  
  allDocs.forEach((doc) => {
    if (doc.filePath) {
      try {
        const urlPath = new URL(doc.filePath, 'http://localhost').pathname;
        const cleanPath = urlPath.replace(/^\/uploads\//, '').replace(/^\//, '');
        if (cleanPath) {
          referencedPaths.add(cleanPath);
        }
      } catch (err) {
        referencedPaths.add(doc.filePath);
      }
    }
  });

  const allFiles = await getAllFilesRecursively(UPLOADS_DIR);
  
  const orphanedFiles: string[] = [];
  
  for (const file of allFiles) {
    const normalizedFile = file.replace(/\\/g, '/');
    
    if (!referencedPaths.has(normalizedFile) && 
        !normalizedFile.startsWith('_quarantine') &&
        !normalizedFile.includes('.gitkeep')) {
      orphanedFiles.push(normalizedFile);
    }
  }

  let deletedCount = 0;
  const deletedFiles: string[] = [];
  
  if (!dryRun) {
    for (const file of orphanedFiles) {
      try {
        const fullPath = path.join(UPLOADS_DIR, file);
        await fs.unlink(fullPath);
        deletedFiles.push(file);
        deletedCount++;
      } catch (err) {
        if (process.env.NODE_ENV === 'development') console.error(`Error deleting file ${file}:`, err);
      }
    }
  }

  return {
    success: true,
    message: dryRun 
      ? `Dry run complete. Found ${orphanedFiles.length} orphaned files.`
      : `Cleanup complete. Deleted ${deletedCount} orphaned files.`,
    details: {
      totalFilesInStorage: allFiles.length,
      referencedInDatabase: referencedPaths.size,
      orphanedFiles: orphanedFiles.length,
      deletedCount: dryRun ? 0 : deletedCount,
      orphanedFilesList: orphanedFiles.slice(0, 100),
      deletedFiles: dryRun ? [] : deletedFiles,
      dryRun,
    },
  };
}

router.post('/cleanup-storage', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { dryRun = true } = req.body;
    const result = await runCleanupStorage(dryRun);
    res.json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup storage: ' + (err as Error).message,
    });
  }
});

router.get('/storage-stats', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
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

router.post('/auto-cleanup', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const result = await runCleanupStorage(true);
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
