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
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Configure multer for file uploads
const storage_config = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'feature-requests');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${uniqueId}-${originalName}`;
    cb(null, fileName);
  },
});

const upload = multer({ storage: storage_config });

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
    } catch (error: any) {
      console.error('❌ Error fetching feature requests:', error);
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
    } catch (error: any) {
      console.error('❌ Error fetching feature request:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch feature request',
      });
    }
  });

  /**
   * POST /api/feature-requests - Creates a new feature request with optional file upload.
   */
  app.post('/api/feature-requests', requireAuth, upload.single('file'), async (req: any, res) => {
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
      
      // Handle file upload if present
      if (req.file) {
        featureRequestData.filePath = req.file.path;
        featureRequestData.fileName = req.file.originalname;
        featureRequestData.fileSize = req.file.size;
      }
      
      // Handle text content if present
      if (req.body.file_content) {
        featureRequestData.file_content = req.body.file_content;
      }
      
      const featureRequest = await storage.createFeatureRequest(featureRequestData);

      console.log(`💡 Created new feature request ${featureRequest.id} by user ${currentUser.id}`);
      res.status(201).json(featureRequest);
    } catch (error: any) {
      console.error('❌ Error creating feature request:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create feature request',
      });
    }
  });

  /**
   * PATCH /api/feature-requests/:id - Updates an existing feature request with optional file upload.
   * Users can edit their own feature requests, managers can edit within their org, admins can edit all.
   */
  app.patch('/api/feature-requests/:id', requireAuth, upload.single('file'), async (req: any, res) => {
    try {
      const { id } = req.params;
      const currentUser = req.user || req.session?.user;

      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Get the feature request first to check permissions
      const existingFeatureRequest = await storage.getFeatureRequest(
        id,
        currentUser.id,
        currentUser.role,
        currentUser.organizationId
      );

      if (!existingFeatureRequest) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Feature request not found or access denied',
        });
      }

      // Check permissions: users can edit their own, managers can edit within org, admins can edit all
      const canEdit = currentUser.role === 'admin' || 
                     (currentUser.role === 'manager' && existingFeatureRequest.createdBy === currentUser.id) ||
                     existingFeatureRequest.createdBy === currentUser.id;

      if (!canEdit) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You can only edit your own feature requests',
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
      
      // Handle file upload if present
      if (req.file) {
        updates.filePath = req.file.path;
        updates.fileName = req.file.originalname;
        updates.fileSize = req.file.size;
      }
      
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
    } catch (error: any) {
      console.error('❌ Error updating feature request:', error);
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
    } catch (error: any) {
      console.error('❌ Error deleting feature request:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete feature request',
      });
    }
  });

  /**
   * GET /api/feature-requests/:id/file - Serves the file attachment for a feature request.
   */
  app.get('/api/feature-requests/:id/file', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { download } = req.query;
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

      // Get the feature request to check file attachment
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

      // Check if feature request has a file attachment
      if (!featureRequest.filePath || !featureRequest.fileName) {
        return res.status(404).json({
          error: 'No file attachment',
          message: 'This feature request does not have a file attachment',
        });
      }

      const filePath = featureRequest.filePath;
      const fileName = featureRequest.fileName;
      
      // Handle different path formats (absolute vs relative)
      const fullFilePath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(process.cwd(), 'uploads', filePath);

      // Check if file exists on disk
      if (!fs.existsSync(fullFilePath)) {
        console.error(`❌ File not found on disk: ${fullFilePath}`);
        return res.status(404).json({
          error: 'File not found',
          message: 'The file attachment could not be found',
        });
      }

      console.log(`📎 Serving file for feature request ${id}: ${fileName}`);

      // Detect MIME type based on file extension
      const getContentType = (filename: string) => {
        const ext = filename.toLowerCase().split('.').pop();
        switch (ext) {
          case 'pdf': return 'application/pdf';
          case 'jpg': case 'jpeg': return 'image/jpeg';
          case 'png': return 'image/png';
          case 'gif': return 'image/gif';
          case 'doc': return 'application/msword';
          case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          case 'txt': return 'text/plain';
          default: return 'application/octet-stream';
        }
      };

      // Set proper content type for viewing
      const contentType = getContentType(fileName);
      res.setHeader('Content-Type', contentType);
      
      // Properly encode filename for French characters and other special characters
      const encodedFilename = Buffer.from(fileName, 'utf8').toString('binary');
      
      if (download === 'true') {
        res.setHeader('Content-Disposition', `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      } else {
        res.setHeader('Content-Disposition', `inline; filename="${encodedFilename}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      }

      // Stream the file
      const fileStream = fs.createReadStream(fullFilePath);
      fileStream.pipe(res);

      fileStream.on('error', (error) => {
        console.error(`❌ Error streaming file for feature request ${id}:`, error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream file' });
        }
      });
    } catch (error: any) {
      console.error('❌ Error serving feature request file:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to serve file',
        });
      }
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
    } catch (error: any) {
      console.error('❌ Error upvoting feature request:', error);
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
    } catch (error: any) {
      console.error('❌ Error removing upvote from feature request:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to remove upvote from feature request',
      });
    }
  });
}
