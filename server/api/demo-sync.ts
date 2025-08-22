import type { Express } from 'express';
import { requireAuth, requireRole } from '../auth';
import DemoSyncService from '../services/demo-sync-service';

/**
 * Demo Synchronization API Routes.
 * 
 * Provides endpoints for managing Demo → Open Demo synchronization
 * Requires admin role to trigger manual synchronization.
 * @param app
 */
export function registerDemoSyncRoutes(app: Express): void {
  /**
   * POST /api/demo/sync
   * Manually trigger Demo → Open Demo synchronization
   * Requires admin role.
   */
  app.post('/api/demo/sync', requireAuth, requireRole(['admin']), async (req, res) => {
    try {
      console.log('🎯 Manual demo sync triggered by:', req.user?.email);
      
      await DemoSyncService.runSync();
      
      res.json({
        success: true,
        message: 'Demo synchronization completed successfully',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Demo sync API error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Demo synchronization failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * GET /api/demo/sync/status  
   * Get status of demo synchronization.
   */
  app.get('/api/demo/sync/status', requireAuth, async (req, res) => {
    try {
      // Check if Demo and Open Demo organizations exist
      const demoOrgQuery = `SELECT id, name FROM organizations WHERE name = 'Demo'`;
      const openDemoOrgQuery = `SELECT id, name FROM organizations WHERE name = 'Open Demo'`;
      
      // For now, return basic status - could be enhanced with last sync time, etc.
      res.json({
        success: true,
        status: 'available',
        message: 'Demo synchronization service is available',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Demo sync status error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Unable to get demo sync status',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });
}

export default registerDemoSyncRoutes;