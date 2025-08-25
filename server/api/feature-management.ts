import type { Express } from 'express';
import { requireAuth } from '../auth';
import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Register feature management routes
 * @param app Express application
 */
export function registerFeatureManagementRoutes(app: Express): void {
  
  // Feature status update route
  app.post('/api/features/:id/update-status', requireAuth, async (req: any, res) => {
    try {
      const { status } = req.body;
      const featureId = req.params.id;
      
      const validStatuses = ['submitted', 'planned', 'in-progress', 'ai-analyzed', 'completed', 'cancelled'];
      
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
        updatedAt: row.updated_at
      };
      
      res.json(feature);
      
    } catch (error) {
      console.error('Feature status update error:', error);
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
        updatedAt: row.updated_at
      };
      
      res.json(feature);
      
    } catch (error) {
      console.error('Feature strategic toggle error:', error);
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
          message: 'Feature must be in "in-progress" status for analysis' 
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
          updatedAt: row.updated_at
        }
      });
      
    } catch (error) {
      console.error('Feature analysis error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
}