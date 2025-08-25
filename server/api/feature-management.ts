import type { Express } from 'express';
import { requireAuth } from '../auth';

/**
 * Register feature management routes
 * @param app Express application
 */
export function registerFeatureManagementRoutes(app: Express): void {
  
  // Feature status update route
  app.post('/api/features/:id/update-status', requireAuth, async (req: any, res) => {
    try {
      const { Pool, neonConfig } = await import('@neondatabase/serverless');
      const ws = await import('ws');
      neonConfig.webSocketConstructor = ws.default;
      
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const { status } = req.body;
      const featureId = req.params.id;
      
      const validStatuses = ['submitted', 'planned', 'in-progress', 'ai-analyzed', 'completed', 'cancelled'];
      
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }

      const updateQuery = `
        UPDATE features 
        SET status = $1, updated_at = NOW() 
        WHERE id = $2 
        RETURNING *
      `;
      
      const result = await pool.query(updateQuery, [status, featureId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Feature not found' });
      }
      
      const feature = {
        ...result.rows[0],
        isPublicRoadmap: result.rows[0].is_public_roadmap,
        isStrategicPath: result.rows[0].is_strategic_path,
        businessObjective: result.rows[0].business_objective,
        targetUsers: result.rows[0].target_users,
        successMetrics: result.rows[0].success_metrics,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at
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
      const { Pool, neonConfig } = await import('@neondatabase/serverless');
      const ws = await import('ws');
      neonConfig.webSocketConstructor = ws.default;
      
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const { isStrategicPath } = req.body;
      const featureId = req.params.id;
      
      if (typeof isStrategicPath !== 'boolean') {
        return res.status(400).json({ message: 'isStrategicPath must be a boolean' });
      }

      const updateQuery = `
        UPDATE features 
        SET is_strategic_path = $1, updated_at = NOW() 
        WHERE id = $2 
        RETURNING *
      `;
      
      const result = await pool.query(updateQuery, [isStrategicPath, featureId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Feature not found' });
      }
      
      const feature = {
        ...result.rows[0],
        isPublicRoadmap: result.rows[0].is_public_roadmap,
        isStrategicPath: result.rows[0].is_strategic_path,
        businessObjective: result.rows[0].business_objective,
        targetUsers: result.rows[0].target_users,
        successMetrics: result.rows[0].success_metrics,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at
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
      const { Pool, neonConfig } = await import('@neondatabase/serverless');
      const ws = await import('ws');
      neonConfig.webSocketConstructor = ws.default;
      
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const featureId = req.params.id;
      
      // Check if feature exists and is in correct status
      const checkQuery = `SELECT * FROM features WHERE id = $1`;
      const checkResult = await pool.query(checkQuery, [featureId]);
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ message: 'Feature not found' });
      }
      
      const feature = checkResult.rows[0];
      if (feature.status !== 'in-progress') {
        return res.status(400).json({ 
          message: 'Feature must be in "in-progress" status for analysis' 
        });
      }
      
      // Update feature status to analyzed
      const updateQuery = `
        UPDATE features 
        SET status = 'ai-analyzed', updated_at = NOW() 
        WHERE id = $1 
        RETURNING *
      `;
      
      const result = await pool.query(updateQuery, [featureId]);
      
      res.json({ 
        message: 'Analysis completed successfully',
        feature: {
          ...result.rows[0],
          isPublicRoadmap: result.rows[0].is_public_roadmap,
          isStrategicPath: result.rows[0].is_strategic_path,
          businessObjective: result.rows[0].business_objective,
          targetUsers: result.rows[0].target_users,
          successMetrics: result.rows[0].success_metrics,
          createdAt: result.rows[0].created_at,
          updatedAt: result.rows[0].updated_at
        }
      });
      
    } catch (error) {
      console.error('Feature analysis error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
}