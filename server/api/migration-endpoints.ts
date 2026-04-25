/**
 * File Migration API Endpoints
 * 
 * Safe migration endpoints for moving from legacy deep directory structure
 * to the optimized file storage system.
 */

import type { Express } from 'express';
import { requireAuth, requireRole } from '../auth';
import { fileMigrationService } from '../services/file-migration-service';
import { logError } from '../utils/logger';

export function registerMigrationRoutes(app: Express): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${new Date().toISOString()}] 🔄 Registering migration routes...`);
  }

  /**
   * Start file migration (dry run by default)
   */
  app.post('/api/migration/start', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      const { dryRun = true } = req.body;
      
      if (process.env.NODE_ENV === 'development') console.log(`🔄 Starting migration${dryRun ? ' (DRY RUN)' : ''}...`);
      
      const result = await fileMigrationService.migrateAllFiles(dryRun);
      
      res.json({
        success: result.success,
        result,
        message: dryRun 
          ? 'Dry run completed - no files were actually moved'
          : 'Migration completed'
      });

    } catch (error) {
      logError('[MIGRATION] Migration failed', error);
      res.status(500).json({
        message: 'Migration failed',
        error: 'internal_error'
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
      logError('[MIGRATION] Failed to get migration progress', error);
      res.status(500).json({
        message: 'Failed to get migration progress',
        error: 'internal_error'
      });
    }
  });

  /**
   * Rollback migration
   */
  app.post('/api/migration/rollback', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      if (process.env.NODE_ENV === 'development') console.log('🔄 Starting migration rollback...');
      
      const result = await fileMigrationService.rollbackMigration();
      
      res.json({
        success: result.success,
        message: result.success 
          ? 'Migration rollback completed successfully'
          : 'Migration rollback failed',
        error: result.error
      });

    } catch (error) {
      logError('[MIGRATION] Rollback failed', error);
      res.status(500).json({
        message: 'Rollback failed',
        error: 'internal_error'
      });
    }
  });

  /**
   * Verify migration integrity
   */
  app.get('/api/migration/verify', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      if (process.env.NODE_ENV === 'development') console.log('🔍 Verifying migration integrity...');
      
      const verification = await fileMigrationService.verifyMigration();
      
      res.json({
        success: verification.success,
        verification,
        message: verification.success 
          ? 'Migration verification passed'
          : `Migration verification found ${verification.issues.length} issues`
      });

    } catch (error) {
      logError('[MIGRATION] Verification failed', error);
      res.status(500).json({
        message: 'Verification failed',
        error: 'internal_error'
      });
    }
  });

  if (process.env.NODE_ENV === 'development') console.log('✅ Migration routes registered successfully');
}