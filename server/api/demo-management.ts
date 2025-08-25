import type { Express, Request, Response } from 'express';
import DemoManagementService from '../services/demo-management-service';
import { requireAuth, requireRole } from '../auth';

/**
 * Demo Management API Routes.
 * 
 * Provides API endpoints for managing demo organizations in production.
 * These endpoints allow for health checks, initialization, and maintenance.
 */

/**
 * Register demo management routes.
 */
export function registerDemoManagementRoutes(app: Express): void {
  
  /**
   * GET /api/demo/health
   * Check the health status of demo organizations.
   * Public endpoint for monitoring.
   */
  app.get('/api/demo/health', async (req: Request, res: Response) => {
    try {
      const health = await DemoManagementService.checkDemoHealth();
      
      res.status(health.healthy ? 200 : 503).json({
        success: true,
        data: health,
      });
      
    } catch (error) {
      console.error('Demo health check failed:', error);
      
      res.status(500).json({
        success: false,
        message: 'Demo health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/demo/status
   * Get detailed status and information about demo organizations.
   * Requires authentication.
   */
  app.get('/api/demo/status', requireAuth, async (req: Request, res: Response) => {
    try {
      const info = await DemoManagementService.getDemoOrganizationInfo();
      
      res.json({
        success: true,
        data: info,
      });
      
    } catch (error) {
      console.error('Failed to get demo status:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to get demo status',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/demo/ensure
   * Ensure demo organizations exist and are properly configured.
   * Requires admin role.
   */
  app.post('/api/demo/ensure', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
    try {
      const result = await DemoManagementService.ensureDemoOrganizations();
      
      res.status(result.success ? 200 : 500).json({
        success: result.success,
        message: result.message,
        data: {
          demoOrgId: result.demoOrgId,
          openDemoOrgId: result.openDemoOrgId,
        },
      });
      
    } catch (error) {
      console.error('Failed to ensure demo organizations:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to ensure demo organizations',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/demo/recreate
   * Force recreation of demo organizations with fresh data.
   * Requires admin role. This is a destructive operation.
   */
  app.post('/api/demo/recreate', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
    try {
      const result = await DemoManagementService.recreateDemoOrganizations();
      
      res.status(result.success ? 200 : 500).json({
        success: result.success,
        message: result.message,
        data: {
          demoOrgId: result.demoOrgId,
          openDemoOrgId: result.openDemoOrgId,
        },
      });
      
    } catch (error) {
      console.error('Failed to recreate demo organizations:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to recreate demo organizations',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/demo/maintenance
   * Run scheduled maintenance on demo organizations.
   * Requires admin role.
   */
  app.post('/api/demo/maintenance', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
    try {
      const result = await DemoManagementService.scheduledMaintenance();
      
      res.status(result.success ? 200 : 500).json({
        success: result.success,
        message: result.message,
        data: {
          actions: result.actions,
        },
      });
      
    } catch (error) {
      console.error('Failed to run demo maintenance:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to run demo maintenance',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  console.log('✅ Demo management API routes registered');
}