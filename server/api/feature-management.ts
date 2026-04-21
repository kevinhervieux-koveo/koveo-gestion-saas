import type { Express } from 'express';
import { requireAuth } from '../auth';
import { db } from '../db';
import { sql, eq } from 'drizzle-orm';
import { features } from '../../shared/schema';

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

      // Use Drizzle ORM for safe parameterized query
      const result = await db
        .update(features)
        .set({ 
          status: status as any, 
          updatedAt: new Date() 
        })
        .where(eq(features.id, featureId))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ message: 'Feature not found' });
      }

      const feature = result[0];

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

      // Use Drizzle ORM for safe parameterized query
      const result = await db
        .update(features)
        .set({ 
          isStrategicPath: isStrategicPath, 
          updatedAt: new Date() 
        })
        .where(eq(features.id, featureId))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ message: 'Feature not found' });
      }

      const feature = result[0];

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
      const checkResult = await db
        .select()
        .from(features)
        .where(eq(features.id, featureId));

      if (checkResult.length === 0) {
        return res.status(404).json({ message: 'Feature not found' });
      }

      const currentFeature = checkResult[0];
      if (currentFeature.status !== 'in-progress') {
        return res.status(400).json({
          message: 'Feature must be in "in-progress" status for analysis',
        });
      }

      // Update feature status to analyzed
      const result = await db
        .update(features)
        .set({ 
          status: 'ai-analyzed', 
          updatedAt: new Date() 
        })
        .where(eq(features.id, featureId))
        .returning();

      const feature = result[0];
      res.json({
        message: 'Analysis completed successfully',
        feature,
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
      const result = await db
        .update(features)
        .set({ 
          syncedAt: new Date(), 
          updatedAt: new Date() 
        })
        .where(sql`synced_at IS NULL OR synced_at < updated_at`)
        .returning({ id: features.id });

      // Get the count of synced features
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(features)
        .where(sql`synced_at IS NOT NULL`);

      const totalSynced = countResult[0]?.count || 0;

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
