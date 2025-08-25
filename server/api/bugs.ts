import type { Express } from 'express';
import { storage } from '../storage';
import { insertBugSchema, type Bug, type InsertBug } from '@shared/schema';
import { z } from 'zod';
import { requireAuth } from '../auth';

/**
 * Registers all bug-related API endpoints.
 *
 * @param app - Express application instance.
 */
export function registerBugRoutes(app: Express): void {
  /**
   * GET /api/bugs - Retrieves bugs based on current user's role and access.
   */
  app.get('/api/bugs', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      console.log(`📋 Fetching bugs for user ${currentUser.id} with role ${currentUser.role}`);
      
      const bugs = await storage.getBugsForUser(
        currentUser.id,
        currentUser.role,
        currentUser.organizationId
      );
      
      console.log(`✅ Found ${bugs.length} bugs for user ${currentUser.id}`);
      res.json(bugs);
    } catch (error) {
      console.error('Failed to fetch bugs:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch bugs',
      });
    }
  });

  /**
   * GET /api/bugs/:id - Retrieves a specific bug by ID.
   */
  app.get('/api/bugs/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const currentUser = req.user || req.session?.user;

      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      if (!id) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'Bug ID is required',
        });
      }

      const bug = await storage.getBug(
        id,
        currentUser.id,
        currentUser.role,
        currentUser.organizationId
      );

      if (!bug) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Bug not found or access denied',
        });
      }

      res.json(bug);
    } catch (error) {
      console.error('Failed to fetch bug:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch bug',
      });
    }
  });

  /**
   * POST /api/bugs - Creates a new bug report.
   */
  app.post('/api/bugs', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Validate the request body
      const validation = insertBugSchema.safeParse({
        ...req.body,
        createdBy: currentUser.id,
      });

      if (!validation.success) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid bug data',
          details: validation.error.issues,
        });
      }

      const bugData = validation.data;
      const bug = await storage.createBug(bugData);

      console.log(`🐛 Created new bug ${bug.id} by user ${currentUser.id}`);
      res.status(201).json(bug);
    } catch (error) {
      console.error('Failed to create bug:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create bug',
      });
    }
  });

  /**
   * PATCH /api/bugs/:id - Updates an existing bug.
   * Only admins and managers can update bugs.
   */
  app.patch('/api/bugs/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const currentUser = req.user || req.session?.user;

      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      if (!id) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'Bug ID is required',
        });
      }

      // Validate the request body
      const updateSchema = z.object({
        status: z.enum(['new', 'acknowledged', 'in_progress', 'resolved', 'closed']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        assignedTo: z.string().uuid().nullable().optional(),
        notes: z.string().optional(),
        resolvedBy: z.string().uuid().nullable().optional(),
        resolvedAt: z.date().nullable().optional(),
      });

      const validation = updateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid update data',
          details: validation.error.issues,
        });
      }

      const updates = validation.data;
      const bug = await storage.updateBug(
        id,
        updates,
        currentUser.id,
        currentUser.role
      );

      if (!bug) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Bug not found or access denied',
        });
      }

      console.log(`📝 Updated bug ${id} by user ${currentUser.id}`);
      res.json(bug);
    } catch (error) {
      console.error('Failed to update bug:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update bug',
      });
    }
  });

  /**
   * DELETE /api/bugs/:id - Deletes a bug.
   * Only admins can delete bugs.
   */
  app.delete('/api/bugs/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const currentUser = req.user || req.session?.user;

      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      if (!id) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'Bug ID is required',
        });
      }

      const deleted = await storage.deleteBug(
        id,
        currentUser.id,
        currentUser.role
      );

      if (!deleted) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Bug not found or access denied',
        });
      }

      console.log(`🗑️ Deleted bug ${id} by user ${currentUser.id}`);
      res.status(204).send();
    } catch (error) {
      console.error('Failed to delete bug:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete bug',
      });
    }
  });
}