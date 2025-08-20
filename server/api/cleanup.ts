import { Router } from 'express';
import { documentsBuildings, documentsResidents } from '../../shared/schema';
import { ObjectStorageService } from '../objectStorage';
import { db } from '../db';
import { isNotNull } from 'drizzle-orm';

const router = Router();

/**
 * Clean up orphaned files in object storage that are not referenced in the database
 */
router.post('/cleanup-storage', async (req, res) => {
  try {
    const objectStorageService = new ObjectStorageService();
    
    // Get all file URLs from both document tables
    const buildingDocs = await db.select({ fileUrl: documentsBuildings.fileUrl })
      .from(documentsBuildings)
      .where(isNotNull(documentsBuildings.fileUrl));
      
    const residentDocs = await db.select({ fileUrl: documentsResidents.fileUrl })
      .from(documentsResidents)
      .where(isNotNull(documentsResidents.fileUrl));

    // Combine all referenced file URLs
    const referencedFiles = new Set([
      ...buildingDocs.map(doc => doc.fileUrl).filter(Boolean),
      ...residentDocs.map(doc => doc.fileUrl).filter(Boolean)
    ]);

    console.log(`Found ${referencedFiles.size} files referenced in database:`, Array.from(referencedFiles));

    // Get private object directory for cleanup
    const privateDir = objectStorageService.getPrivateObjectDir();
    
    // For now, just return the analysis - actual cleanup would be more complex
    // as we'd need to list all files in storage and compare
    
    res.json({
      success: true,
      message: `Analysis complete. Found ${referencedFiles.size} files in database that should exist in storage.`,
      referencedFiles: Array.from(referencedFiles),
      recommendation: 'Files in storage not referenced by these URLs can be considered orphaned.'
    });

  } catch (error) {
    console.error('Error during storage cleanup analysis:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to analyze storage cleanup' 
    });
  }
});

/**
 * Get storage statistics
 */
router.get('/storage-stats', async (req, res) => {
  try {
    // Get database file counts
    const buildingDocs = await db.select({ id: documentsBuildings.id })
      .from(documentsBuildings)
      .where(isNotNull(documentsBuildings.fileUrl));
      
    const residentDocs = await db.select({ id: documentsResidents.id })
      .from(documentsResidents)
      .where(isNotNull(documentsResidents.fileUrl));

    const totalDbFiles = buildingDocs.length + residentDocs.length;

    res.json({
      database: {
        buildingDocuments: buildingDocs.length,
        residentDocuments: residentDocs.length,
        total: totalDbFiles
      },
      message: `Database contains ${totalDbFiles} documents with attached files`
    });

  } catch (error) {
    console.error('Error getting storage stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get storage statistics' 
    });
  }
});

export default router;