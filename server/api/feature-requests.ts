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
import { v4 as uuidv4 } from 'uuid';
import { ObjectStorageService } from '../objectStorage';
import { normalizeFilename } from '../utils/filenameNormalization';

import { asyncHandler } from '../utils/async-handler';
const objectStorageService = new ObjectStorageService();

// Configure multer for memory storage (files go to object storage)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Helper function to upload file to object storage
async function uploadToObjectStorage(
  buffer: Buffer, 
  path: string, 
  contentType: string,
  userId?: string
): Promise<string> {
  try {
    // Get presigned URL for upload
    const uploadUrl = await objectStorageService.getCustomPathUploadURL(path);
    
    // Upload file buffer to object storage
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: buffer,
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString(),
      },
    });
    
    if (!response.ok) {
      throw new Error(`Upload failed with status: ${response.status}`);
    }
    
    // Normalized path with /objects/ prefix
    const normalizedPath = `/objects/${path}`;
    
    // Set ACL on the uploaded file
    if (userId) {
      try {
        await objectStorageService.trySetObjectEntityAclPolicy(normalizedPath, {
          visibility: 'private',
          owner: userId,
        });
      } catch (aclError) {
        console.error('Failed to set ACL on feature request file:', aclError);
      }
    }
    
    return normalizedPath;
  } catch (error) {
    console.error('Failed to upload to object storage:', error);
    throw error;
  }
}

/**
 * Registers all feature request related API endpoints.
 *
 * @param app - Express application instance.
 */
export function registerFeatureRequestRoutes(app: Express): void {
  /**
   * GET /api/feature-requests - Retrieves feature requests based on current user's role and access.
   */
  app.get('/api/feature-requests', requireAuth, asyncHandler(async (req: any, res) => {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // console.log(`📋 Fetching feature requests for user ${currentUser.id} with role ${currentUser.role}`);

      const featureRequests = await storage.getFeatureRequestsForUser(
        currentUser.id,
        currentUser.role,
        currentUser.organizationId
      );

      // console.log(`✅ Found ${featureRequests.length} feature requests for user ${currentUser.id}`);
      res.json(featureRequests);
    }, { errorMessage: 'Failed to fetch feature requests', errorLogPrefix: '❌ Error fetch feature requests', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * GET /api/feature-requests/:id - Retrieves a specific feature request by ID.
   */
  app.get('/api/feature-requests/:id', requireAuth, asyncHandler(async (req: any, res) => {
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
    }, { errorMessage: 'Failed to fetch feature request', errorLogPrefix: '❌ Error fetch feature request', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * POST /api/feature-requests - Creates a new feature request with optional file upload.
   */
  app.post('/api/feature-requests', requireAuth, upload.single('file'), asyncHandler(async (req: any, res) => {
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

      let featureRequestData = validation.data;
      
      // Generate feature request ID first (BEFORE upload)
      const featureId = uuidv4();
      
      // Handle file upload if present
      if (req.file) {
        try {
          // Fix filename encoding issues and sanitize
          const originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
          const sanitizedFilename = normalizeFilename(originalname);
          
          // Generate unique path: features/{featureId}/{uuid}_{sanitized_filename}
          const uniqueId = uuidv4();
          const objectPath = `features/${featureId}/${uniqueId}_${sanitizedFilename}`;
          
          // Upload to object storage BEFORE creating database record
          const normalizedPath = await uploadToObjectStorage(
            req.file.buffer,
            objectPath,
            req.file.mimetype,
            currentUser.id
          );
          
          // Add file information to featureRequestData
          featureRequestData = {
            ...featureRequestData,
            filePath: normalizedPath,
            fileName: sanitizedFilename,
            fileSize: req.file.size,
          };
        } catch (uploadError) {
          console.error('Error uploading feature request attachment:', uploadError);
          return res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to upload attachment' 
          });
        }
      }
      
      // Handle text content if present - save as .txt file to object storage
      if (req.body.file_content && !req.file) {
        try {
          const textBuffer = Buffer.from(req.body.file_content, 'utf8');
          const fileName = `${uuidv4()}_text-document.txt`;
          const objectPath = `features/${featureId}/${fileName}`;
          
          // Upload to object storage BEFORE creating database record
          const normalizedPath = await uploadToObjectStorage(
            textBuffer,
            objectPath,
            'text/plain',
            currentUser.id
          );
          
          // Add file information to featureRequestData
          featureRequestData = {
            ...featureRequestData,
            filePath: normalizedPath,
            fileName: `${featureRequestData.title}-text-content.txt`,
            fileSize: textBuffer.length,
          };
        } catch (uploadError) {
          console.error('Error uploading feature request text content:', uploadError);
          return res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to save text content as file' 
          });
        }
      }

      // Create the feature request with pre-generated ID (AFTER successful upload)
      const featureRequest = await storage.createFeatureRequest({
        ...featureRequestData,
        id: featureId,
      });

      // console.log(`💡 Created new feature request ${featureRequest.id} by user ${currentUser.id}`);
      res.status(201).json(featureRequest);
    }, { errorMessage: 'Failed to create feature request', errorLogPrefix: '❌ Error create feature request', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * PATCH /api/feature-requests/:id - Updates an existing feature request with optional file upload.
   * Users can edit their own feature requests, managers can edit within their org, admins can edit all.
   */
  app.patch('/api/feature-requests/:id', requireAuth, upload.single('file'), asyncHandler(async (req: any, res) => {
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

      let updates = validation.data;
      
      // Handle file upload if present
      if (req.file) {
        try {
          // Fix filename encoding issues and sanitize
          const originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
          const sanitizedFilename = normalizeFilename(originalname);
          
          // Generate unique path: features/{featureId}/{uuid}_{sanitized_filename}
          const uniqueId = uuidv4();
          const objectPath = `features/${id}/${uniqueId}_${sanitizedFilename}`;
          
          // Upload to object storage
          const normalizedPath = await uploadToObjectStorage(
            req.file.buffer,
            objectPath,
            req.file.mimetype,
            currentUser.id
          );
          
          // Add file information to updates
          updates = {
            ...updates,
            filePath: normalizedPath,
            fileName: sanitizedFilename,
            fileSize: req.file.size,
          };
        } catch (uploadError) {
          console.error('Error uploading feature request attachment during update:', uploadError);
          return res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to upload attachment' 
          });
        }
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

      // console.log(`📝 Updated feature request ${id} by user ${currentUser.id}`);
      res.json(featureRequest);
    }, { errorMessage: 'Failed to update feature request', errorLogPrefix: '❌ Error update feature request', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * DELETE /api/feature-requests/:id - Deletes a feature request.
   * Only admins can delete feature requests.
   */
  app.delete('/api/feature-requests/:id', requireAuth, asyncHandler(async (req: any, res) => {
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

      // console.log(`🗑️ Deleted feature request ${id} by user ${currentUser.id}`);
      res.status(204).send();
    }, { errorMessage: 'Failed to delete feature request', errorLogPrefix: '❌ Error delete feature request', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * GET /api/feature-requests/:id/file - Serves the file attachment for a feature request from object storage.
   */
  app.get('/api/feature-requests/:id/file', requireAuth, async (req: any, res) => {
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

      const filePath = featureRequest.filePath;
      
      if (!filePath) {
        return res.status(404).json({
          error: 'No file attachment',
          message: 'This feature request does not have a file attachment',
        });
      }

      // Get file from object storage
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(filePath);
        await objectStorageService.downloadObject(objectFile, res);
      } catch (error) {
        console.error('Error downloading feature request file from object storage:', error);
        return res.status(404).json({
          error: 'File not found',
          message: 'The file attachment could not be found in object storage',
        });
      }
    } catch (error: any) {
      console.error('Error serving feature request file:', error);
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
  app.post('/api/feature-requests/:id/upvote', requireAuth, asyncHandler(async (req: any, res) => {
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

      // console.log(`👍 User ${currentUser.id} upvoted feature request ${id}`);
      res.json(result.data);
    }, { errorMessage: 'Failed to upvote feature request', errorLogPrefix: '❌ Error upvote feature request', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * DELETE /api/feature-requests/:id/upvote - Removes an upvote from a feature request.
   * Users can remove their own upvote.
   */
  app.delete('/api/feature-requests/:id/upvote', requireAuth, asyncHandler(async (req: any, res) => {
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

      // console.log(`👎 User ${currentUser.id} removed upvote from feature request ${id}`);
      res.json(result.data);
    }, { errorMessage: 'Failed to remove upvote from feature request', errorLogPrefix: '❌ Error remove upvote from feature request', extraErrorFields: { error: 'Internal server error' } }));
}
