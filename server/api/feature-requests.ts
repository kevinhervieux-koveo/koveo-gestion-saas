import type { Express } from 'express';
import { storage } from '../storage';
import {
  insertFeatureRequestSchema,
  insertFeatureRequestUpvoteSchema,
  type FeatureRequest,
  type InsertFeatureRequest,
  type FeatureRequestUpvote,
  type InsertFeatureRequestUpvote,
} from '@shared/schema';
import { z } from 'zod';
import { requireAuth } from '../auth';

/**
 * Registers all feature request related API endpoints.
 *
 * @param app - Express application instance.
 */
export function registerFeatureRequestRoutes(app: Express): void {
  /**
   * GET /api/feature-requests - Retrieves feature requests based on current user's role and access.
   */
  app.get('/api/feature-requests', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      console.log(
        `📋 Fetching feature requests for user ${currentUser.id} with role ${currentUser.role}`
      );

      const featureRequests = await storage.getFeatureRequestsForUser(
        currentUser.id,
        currentUser.role,
        currentUser.organizationId
      );

      console.log(`✅ Found ${featureRequests.length} feature requests for user ${currentUser.id}`);
      res.json(featureRequests);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch feature requests',
      });
    }
  });

  /**
   * GET /api/feature-requests/:id - Retrieves a specific feature request by ID.
   */
  app.get('/api/feature-requests/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const currentUser = req.user || req.session?.user;

      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      if (!id) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'Feature request ID is required',
        });
      }

      const featureRequest = await storage.getFeatureRequest(
        id,
        currentUser.id,
        currentUser.role,
        currentUser.organizationId
      );

      if (!featureRequest) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Feature request not found or access denied',
        });
      }

      res.json(featureRequest);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch feature request',
      });
    }
  });

  /**
   * POST /api/feature-requests - Creates a new feature request.
   */
  app.post('/api/feature-requests', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Validate the request body
      const validation = insertFeatureRequestSchema.safeParse({
        ...req.body,
        createdBy: currentUser.id,
      });

      if (!validation.success) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid feature request data',
          details: validation.error.issues,
        });
      }

      const featureRequestData = validation.data;
      const featureRequest = await storage.createFeatureRequest(featureRequestData);

      console.log(`💡 Created new feature request ${featureRequest.id} by user ${currentUser.id}`);
      res.status(201).json(featureRequest);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create feature request',
      });
    }
  });

  /**
   * PATCH /api/feature-requests/:id - Updates an existing feature request.
   * Only admins can edit feature requests.
   */
  app.patch('/api/feature-requests/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const currentUser = req.user || req.session?.user;

      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Only admins can edit feature requests
      if (currentUser.role !== 'admin') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Only administrators can edit feature requests',
        });
      }

      if (!id) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'Feature request ID is required',
        });
      }

      // Validate the request body
      const updateSchema = z.object({
        title: z
          .string()
          .min(1, 'Title is required')
          .max(200, 'Title must not exceed 200 characters')
          .optional(),
        description: z
          .string()
          .min(10, 'Description must be at least 10 characters')
          .max(2000, 'Description must not exceed 2000 characters')
          .optional(),
        need: z
          .string()
          .min(5, 'Need must be at least 5 characters')
          .max(500, 'Need must not exceed 500 characters')
          .optional(),
        category: z
          .enum([
            'dashboard',
            'property_management',
            'resident_management',
            'financial_management',
            'maintenance',
            'document_management',
            'communication',
            'reports',
            'mobile_app',
            'integrations',
            'security',
            'performance',
            'other',
          ])
          .optional(),
        page: z.string().min(1, 'Page is required').optional(),
        status: z
          .enum(['submitted', 'under_review', 'planned', 'in_progress', 'completed', 'rejected'])
          .optional(),
        assignedTo: z.string().uuid().nullable().optional(),
        adminNotes: z.string().optional(),
        mergedIntoId: z.string().uuid().nullable().optional(),
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
      const featureRequest = await storage.updateFeatureRequest(
        id,
        updates,
        currentUser.id,
        currentUser.role
      );

      if (!featureRequest) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Feature request not found or access denied',
        });
      }

      console.log(`📝 Updated feature request ${id} by user ${currentUser.id}`);
      res.json(featureRequest);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update feature request',
      });
    }
  });

  /**
   * DELETE /api/feature-requests/:id - Deletes a feature request.
   * Only admins can delete feature requests.
   */
  app.delete('/api/feature-requests/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const currentUser = req.user || req.session?.user;

      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Only admins can delete feature requests
      if (currentUser.role !== 'admin') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Only administrators can delete feature requests',
        });
      }

      if (!id) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'Feature request ID is required',
        });
      }

      const deleted = await storage.deleteFeatureRequest(id, currentUser.id, currentUser.role);

      if (!deleted) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Feature request not found or access denied',
        });
      }

      console.log(`🗑️ Deleted feature request ${id} by user ${currentUser.id}`);
      res.status(204).send();
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete feature request',
      });
    }
  });

  /**
   * POST /api/feature-requests/:id/upvote - Upvotes a feature request.
   * Users can upvote any feature request (only once per user).
   */
  app.post('/api/feature-requests/:id/upvote', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const currentUser = req.user || req.session?.user;

      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      if (!id) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'Feature request ID is required',
        });
      }

      // Validate the upvote data
      const validation = insertFeatureRequestUpvoteSchema.safeParse({
        featureRequestId: id,
        userId: currentUser.id,
      });

      if (!validation.success) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid upvote data',
          details: validation.error.issues,
        });
      }

      const upvoteData = validation.data;
      const result = await storage.upvoteFeatureRequest(upvoteData);

      if (!result.success) {
        return res.status(400).json({
          error: 'Upvote failed',
          message: result.message,
        });
      }

      console.log(`👍 User ${currentUser.id} upvoted feature request ${id}`);
      res.json(result.data);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to upvote feature request',
      });
    }
  });

  /**
   * DELETE /api/feature-requests/:id/upvote - Removes an upvote from a feature request.
   * Users can remove their own upvote.
   */
  app.delete('/api/feature-requests/:id/upvote', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const currentUser = req.user || req.session?.user;

      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      if (!id) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'Feature request ID is required',
        });
      }

      const result = await storage.removeFeatureRequestUpvote(id, currentUser.id);

      if (!result.success) {
        return res.status(400).json({
          error: 'Remove upvote failed',
          message: result.message,
        });
      }

      console.log(`👎 User ${currentUser.id} removed upvote from feature request ${id}`);
      res.json(result.data);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to remove upvote from feature request',
      });
    }
  });
}
