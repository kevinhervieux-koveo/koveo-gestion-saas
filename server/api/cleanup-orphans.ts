import { Express } from 'express';
import { requireAuth } from '../auth';

/**
 * Orphan cleanup endpoints for managing orphaned database records.
 * @param app
 */
export function registerCleanupOrphansRoutes(app: Express) {
  /**
   * POST /api/cleanup/orphans - Cleanup orphaned buildings and residences
   * Admin endpoint to clean up records that have lost their parent relationships.
   */
  app.post('/api/cleanup/orphans', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      if (currentUser.role !== 'admin') {
        return res.status(403).json({
          message: 'Admin access required',
          code: 'ADMIN_REQUIRED',
        });
      }

      console.warn(`🧹 Admin ${currentUser.id} initiated orphan cleanup`);

      const { cleanupOrphans } = await import('../utils/cleanup-orphans');
      const report = await cleanupOrphans();

      console.log(`✅ Orphan cleanup completed:`, report);

      res.json({
        message: 'Orphan cleanup completed',
        report,
      });
    } catch (_error) {
      console.error('❌ Error during orphan cleanup:', _error);
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to cleanup orphans',
      });
    }
  });

  /**
   * GET /api/cleanup/orphan-report - Generate report of orphaned records
   * Admin endpoint to view orphaned records without cleaning them up.
   */
  app.get('/api/cleanup/orphan-report', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      if (currentUser.role !== 'admin') {
        return res.status(403).json({
          message: 'Admin access required',
          code: 'ADMIN_REQUIRED',
        });
      }

      const { generateOrphanReport } = await import('../utils/cleanup-orphans');
      const report = await generateOrphanReport();

      res.json({
        message: 'Orphan report generated',
        report,
      });
    } catch (_error) {
      console.error('❌ Error generating orphan report:', _error);
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to generate orphan report',
      });
    }
  });
}
