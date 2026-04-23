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
 * @param app
 */
export function registerDemoManagementRoutes(app: import('../utils/lazy-mount').RouteRegistry): void {
  /**
   * GET /api/demo/health
   * Check the health status of demo organizations.
   * Admin-only endpoint for monitoring.
   */
  app.get('/api/demo/health', requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
    try {
      const health = await DemoManagementService.checkDemoHealth();

      res.status(health.healthy ? 200 : 503).json({
        success: true,
        data: health,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Demo health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/demo/document-integrity
   *
   * Samples seeded /objects/... file paths across documents, bills, bugs and
   * feature requests and reports how many of them are missing their backing
   * bytes in object storage. When this comes back unhealthy the demo
   * environment was likely cloned without re-running the seed script, and the
   * `remediation` field tells the admin how to fix it.
   */
  app.get(
    '/api/demo/document-integrity',
    requireAuth,
    requireRole(['admin']),
    async (req: Request, res: Response) => {
      try {
        const sampleParam = Number.parseInt(
          typeof req.query.sampleSize === 'string' ? req.query.sampleSize : '',
          10,
        );
        const sampleSize =
          Number.isFinite(sampleParam) && sampleParam > 0 && sampleParam <= 50
            ? sampleParam
            : 5;
        const report =
          await DemoManagementService.checkSeededDocumentIntegrity(sampleSize);
        res.status(report.healthy ? 200 : 503).json({
          success: true,
          data: report,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: 'Document integrity check failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  /**
   * GET /api/demo/users
   * Get demo users for login page.
   * Public endpoint for demo mode.
   */
  app.get('/api/demo/users', async (req: Request, res: Response) => {
    try {
      // Import database connection
      const { db } = await import('../db');
      const { eq, and, inArray } = await import('drizzle-orm');
      const schema = await import('../../shared/schema');

      // Get demo organizations (by type instead of name)
      const demoOrgs = await db.query.organizations.findMany({
        where: eq(schema.organizations.type, 'demo'),
      });

      if (demoOrgs.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No demo organizations found',
        });
      }

      // Get demo users with demo roles
      const demoUsers = await db.query.users.findMany({
        where: and(
          eq(schema.users.isActive, true),
          inArray(schema.users.role, ['demo_manager', 'demo_tenant', 'demo_resident'])
        ),
        columns: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });

      // Group users by role for frontend consumption
      const usersByRole = {
        demo_manager: demoUsers.filter(user => user.role === 'demo_manager'),
        demo_tenant: demoUsers.filter(user => user.role === 'demo_tenant'),
        demo_resident: demoUsers.filter(user => user.role === 'demo_resident'),
      };

      res.json({
        success: true,
        data: usersByRole,
      });
    } catch (error) {
      console.error('❌ Error fetching demo users:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch demo users',
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
  app.post(
    '/api/demo/ensure',
    requireAuth,
    requireRole(['admin']),
    async (req: Request, res: Response) => {
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
        res.status(500).json({
          success: false,
          message: 'Failed to ensure demo organizations',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * POST /api/demo/recreate
   * Force recreation of demo organizations with fresh data.
   * Requires admin role. This is a destructive operation.
   */
  app.post(
    '/api/demo/recreate',
    requireAuth,
    requireRole(['admin']),
    async (req: Request, res: Response) => {
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
        res.status(500).json({
          success: false,
          message: 'Failed to recreate demo organizations',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * POST /api/demo/maintenance
   * Run scheduled maintenance on demo organizations.
   * Requires admin role.
   */
  app.post(
    '/api/demo/maintenance',
    requireAuth,
    requireRole(['admin']),
    async (req: Request, res: Response) => {
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
        res.status(500).json({
          success: false,
          message: 'Failed to run demo maintenance',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

}
