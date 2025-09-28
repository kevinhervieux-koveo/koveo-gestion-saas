/**
 * File Migration API Endpoints
 * 
 * Safe migration endpoints for moving from legacy deep directory structure
 * to the optimized file storage system.
 */

import type { Express } from 'express';
import { requireAuth, requireRole } from '../auth';
import { fileMigrationService } from '../services/file-migration-service';

export function registerMigrationRoutes(app: Express): void {
  console.log(`[${new Date().toISOString()}] 🔄 Registering migration routes...`);

  /**
   * Start file migration (dry run by default)
   */
  app.post('/api/migration/start', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      const { dryRun = true } = req.body;
      
      console.log(`🔄 Starting migration${dryRun ? ' (DRY RUN)' : ''}...`);
      
      const result = await fileMigrationService.migrateAllFiles(dryRun);
      
      res.json({
        success: result.success,
        result,
        message: dryRun 
          ? 'Dry run completed - no files were actually moved'
          : 'Migration completed'
      });

    } catch (error) {
      console.error('Migration error:', error);
      res.status(500).json({
        message: 'Migration failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get migration progress
   */
  app.get('/api/migration/progress', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      const progress = fileMigrationService.getMigrationProgress();
      
      res.json({
        success: true,
        progress,
        isActive: progress !== null
      });

    } catch (error) {
      console.error('Error getting migration progress:', error);
      res.status(500).json({
        message: 'Failed to get migration progress',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Rollback migration
   */
  app.post('/api/migration/rollback', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      console.log('🔄 Starting migration rollback...');
      
      const result = await fileMigrationService.rollbackMigration();
      
      res.json({
        success: result.success,
        message: result.success 
          ? 'Migration rollback completed successfully'
          : 'Migration rollback failed',
        error: result.error
      });

    } catch (error) {
      console.error('Rollback error:', error);
      res.status(500).json({
        message: 'Rollback failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Verify migration integrity
   */
  app.get('/api/migration/verify', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      console.log('🔍 Verifying migration integrity...');
      
      const verification = await fileMigrationService.verifyMigration();
      
      res.json({
        success: verification.success,
        verification,
        message: verification.success 
          ? 'Migration verification passed'
          : `Migration verification found ${verification.issues.length} issues`
      });

    } catch (error) {
      console.error('Verification error:', error);
      res.status(500).json({
        message: 'Verification failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  console.log('✅ Migration routes registered successfully');
}