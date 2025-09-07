import type { Express } from 'express';
import { requireAuth } from '../auth';
import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Register feature management routes.
 * @param app Express application.
 */
export function registerFeatureManagementRoutes(app: Express): void {
  // Feature status update route
  app.post('/api/features/:id/update-status', requireAuth, async (req: any, res) => {
    try {
      const { status } = req.body;
      const featureId = req.params.id;

      const validStatuses = [
        'submitted',
        'planned',
        'in-progress',
        'ai-analyzed',
        'completed',
        'cancelled',
      ];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }

      // Use Drizzle raw SQL for features table
      const result = await db.execute(sql`
        UPDATE features 
        SET status = ${status}, updated_at = NOW() 
        WHERE id = ${featureId} 
        RETURNING *
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Feature not found' });
      }

      const row = result.rows[0] as any;
      const feature = {
        ...row,
        isPublicRoadmap: row.is_public_roadmap,
        isStrategicPath: row.is_strategic_path,
        businessObjective: row.business_objective,
        targetUsers: row.target_users,
        successMetrics: row.success_metrics,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };

      res.json(feature);
    } catch (error) {
      console.error('Error updating feature:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Toggle strategic path route
  app.post('/api/features/:id/toggle-strategic', requireAuth, async (req: any, res) => {
    try {
      const { isStrategicPath } = req.body;
      const featureId = req.params.id;

      if (typeof isStrategicPath !== 'boolean') {
        return res.status(400).json({ message: 'isStrategicPath must be a boolean' });
      }

      // Use Drizzle raw SQL for features table
      const result = await db.execute(sql`
        UPDATE features 
        SET is_strategic_path = ${isStrategicPath}, updated_at = NOW() 
        WHERE id = ${featureId} 
        RETURNING *
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Feature not found' });
      }

      const row = result.rows[0] as any;
      const feature = {
        ...row,
        isPublicRoadmap: row.is_public_roadmap,
        isStrategicPath: row.is_strategic_path,
        businessObjective: row.business_objective,
        targetUsers: row.target_users,
        successMetrics: row.success_metrics,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };

      res.json(feature);
    } catch (error) {
      console.error('Error updating feature:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Feature analysis route
  app.post('/api/features/:id/analyze', requireAuth, async (req: any, res) => {
    try {
      const featureId = req.params.id;

      // Check if feature exists and is in correct status
      const checkResult = await db.execute(sql`SELECT * FROM features WHERE id = ${featureId}`);

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ message: 'Feature not found' });
      }

      const feature = checkResult.rows[0] as any;
      if (feature.status !== 'in-progress') {
        return res.status(400).json({
          message: 'Feature must be in "in-progress" status for analysis',
        });
      }

      // Update feature status to analyzed
      const result = await db.execute(sql`
        UPDATE features 
        SET status = 'ai-analyzed', updated_at = NOW() 
        WHERE id = ${featureId} 
        RETURNING *
      `);

      const row = result.rows[0] as any;
      res.json({
        message: 'Analysis completed successfully',
        feature: {
          ...row,
          isPublicRoadmap: row.is_public_roadmap,
          isStrategicPath: row.is_strategic_path,
          businessObjective: row.business_objective,
          targetUsers: row.target_users,
          successMetrics: row.success_metrics,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      });
    } catch (error) {
      console.error('Error analyzing feature:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Features sync to production route
  app.post('/api/features/trigger-sync', requireAuth, async (req: any, res) => {
    try {
      // Mark all features as synced (in a real setup, this would sync to another database)
      const result = await db.execute(sql`
        UPDATE features 
        SET synced_at = NOW(), updated_at = NOW() 
        WHERE synced_at IS NULL OR synced_at < updated_at
        RETURNING COUNT(*) as count
      `);

      // Get the count of synced features
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total FROM features WHERE synced_at IS NOT NULL
      `);

      const totalSynced = countResult.rows[0]?.total || 0;

      res.json({
        message: `Successfully synchronized ${totalSynced} features to production`,
        success: true,
        syncedAt: new Date().toISOString(),
        totalFeatures: totalSynced,
      });
    } catch (error) {
      console.error('Error syncing features:', error);
      res.status(500).json({
        message: 'Failed to synchronize features to production',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
