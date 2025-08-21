import type { Express } from 'express';
import { requireAuth } from '../auth';
import { delayedUpdateService } from '../services/delayed-update-service';

/**
 * Register delayed update monitoring routes.
 * These endpoints allow monitoring and manual triggering of delayed updates.
 * @param app
 */
/**
 * RegisterDelayedUpdateRoutes function.
 * @param app
 * @returns Function result.
 */
export function registerDelayedUpdateRoutes(app: Express) {
  
  // Get delayed update status and pending updates
  app.get('/api/delayed-updates/status', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only admins and managers can access delayed update status
      if (user.role !== 'admin' && user.role !== 'manager' && !user.canAccessAllOrganizations) {
        return res.status(403).json({ 
          message: 'Access denied. Admin or Manager privileges required.',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      const status = delayedUpdateService.getStatus();

      res.json({
        status,
        message: 'Delayed update service is operational',
        lastChecked: new Date().toISOString(),
        info: {
          description: 'Money flow and budget updates are automatically scheduled 15 minutes after dependencies change',
          triggers: [
            'Bill created or updated → Money flow update → Budget update',
            'Residence updated (monthly fees) → Money flow update → Budget update'
          ]
        }
      });

    } catch (__error) {
      console.error('Error getting delayed update status:', error);
      res.status(500).json({ 
        message: 'Failed to get delayed update status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Force immediate update for a specific bill (for testing)
  app.post('/api/delayed-updates/force-bill', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      const { billId } = req.body;
      
      // Only admins can force immediate updates
      if (user.role !== 'admin' && !user.canAccessAllOrganizations) {
        return res.status(403).json({ 
          message: 'Access denied. Admin privileges required.',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      if (!billId) {
        return res.status(400).json({ 
          message: 'billId is required' 
        });
      }

      console.log(`⚡ Force immediate update for bill ${billId} requested by user ${user.id} (${user.email})`);

      // Force immediate update
      await delayedUpdateService.forceImmediateBillUpdate(billId);

      res.json({
        message: 'Immediate update completed for bill',
        billId,
        triggeredBy: user.email,
        timestamp: new Date().toISOString()
      });

    } catch (__error) {
      console.error('Error forcing immediate bill update:', error);
      res.status(500).json({ 
        message: 'Failed to force immediate bill update',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Force immediate update for a specific residence (for testing)
  app.post('/api/delayed-updates/force-residence', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      const { residenceId } = req.body;
      
      // Only admins can force immediate updates
      if (user.role !== 'admin' && !user.canAccessAllOrganizations) {
        return res.status(403).json({ 
          message: 'Access denied. Admin privileges required.',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      if (!residenceId) {
        return res.status(400).json({ 
          message: 'residenceId is required' 
        });
      }

      console.log(`⚡ Force immediate update for residence ${residenceId} requested by user ${user.id} (${user.email})`);

      // Force immediate update
      await delayedUpdateService.forceImmediateResidenceUpdate(residenceId);

      res.json({
        message: 'Immediate update completed for residence',
        residenceId,
        triggeredBy: user.email,
        timestamp: new Date().toISOString()
      });

    } catch (__error) {
      console.error('Error forcing immediate residence update:', error);
      res.status(500).json({ 
        message: 'Failed to force immediate residence update',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Health check for delayed update system
  app.get('/api/delayed-updates/health', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only admins can access health check
      if (user.role !== 'admin' && !user.canAccessAllOrganizations) {
        return res.status(403).json({ 
          message: 'Access denied. Admin privileges required.',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      const status = delayedUpdateService.getStatus();
      const currentTime = new Date().toISOString();

      res.json({
        status: 'healthy',
        delayMinutes: status.delayMinutes,
        pendingUpdates: {
          bills: status.pendingBillUpdates,
          residences: status.pendingResidenceUpdates,
          budgets: status.pendingBudgetUpdates
        },
        currentTime,
        systemInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage()
        },
        message: 'Delayed update system is operational'
      });

    } catch (__error) {
      console.error('Error in delayed update health check:', error);
      res.status(500).json({ 
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Delayed update system encountered an error'
      });
    }
  });
}