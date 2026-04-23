import type { Express } from 'express';
import { storage } from '../storage';
import { insertBugSchema, type Bug, type InsertBug } from '@shared/schema';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth-middleware';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { ObjectStorageService } from '../objectStorage';
import { normalizeFilename } from '../utils/filenameNormalization';

import { asyncHandler } from '../utils/async-handler';
const objectStorageService = new ObjectStorageService();

// Configure multer for memory storage (files go to object storage)
const upload = multer({
  storage: multer.memoryStorage(),
  // Force utf8 multipart param parsing so French/diacritic filenames survive
  // (multer 2.x defaults to latin1, which mangles "Procès-verbal été 2024.pdf").
  defParamCharset: 'utf8',
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
        console.error('Failed to set ACL on bug file:', aclError);
      }
    }
    
    return normalizedPath;
  } catch (error) {
    console.error('Failed to upload to object storage:', error);
    throw error;
  }
}

/**
 * Registers all bug-related API endpoints.
 *
 * @param app - Express application instance.
 */
export function registerBugRoutes(app: Express): void {
  /**
   * GET /api/bugs - Retrieves bugs based on current user's role and access.
   */
  app.get('/api/bugs', requireAuth, asyncHandler(async (req: any, res) => {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // console.log(`📋 Fetching bugs for user ${currentUser.id} with role ${currentUser.role}`);

      const bugs = await storage.getBugsForUser(
        currentUser.id,
        currentUser.role,
        currentUser.organizationId
      );

      // console.log(`✅ Found ${bugs.length} bugs for user ${currentUser.id}`);
      
      // Debug: Log file attachment info for each bug
      bugs.forEach(bug => {
        if (bug.filePath) {
          // console.log(`🔗 Bug ${bug.id} has file: ${bug.fileName} at ${bug.filePath}`);
        }
      });
      
      res.json(bugs);
    }, { errorMessage: 'Failed to fetch bugs', errorLogPrefix: '❌ Error fetch bugs', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * GET /api/bugs/:id - Retrieves a specific bug by ID.
   */
  app.get('/api/bugs/:id', requireAuth, asyncHandler(async (req: any, res) => {
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
    }, { errorMessage: 'Failed to fetch bug', errorLogPrefix: '❌ Error fetch bug', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * POST /api/bugs - Creates a new bug report with optional single file attachment.
   */
  app.post('/api/bugs', requireAuth, upload.single('attachment'), asyncHandler(async (req: any, res) => {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
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

      let bugData = validation.data;

      // Generate bug ID first (BEFORE upload)
      const bugId = uuidv4();
      
      // Handle single file attachment if present
      if (req.file) {
        try {
          // Fix filename encoding issues and sanitize
          const originalname = req.file.originalname; // multer defParamCharset: 'utf8' already decodes to utf8
          const sanitizedFilename = normalizeFilename(originalname);
          
          // Generate unique path: bugs/{bugId}/{uuid}_{sanitized_filename}
          const uniqueId = uuidv4();
          const objectPath = `bugs/${bugId}/${uniqueId}_${sanitizedFilename}`;
          
          // Upload to object storage BEFORE creating database record
          const normalizedPath = await uploadToObjectStorage(
            req.file.buffer,
            objectPath,
            req.file.mimetype,
            currentUser.id
          );
          
          // Add file information to bugData
          bugData = {
            ...bugData,
            filePath: normalizedPath,
            fileName: sanitizedFilename,
            fileSize: req.file.size,
          };
        } catch (uploadError) {
          console.error('Error uploading bug attachment:', uploadError);
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
          const objectPath = `bugs/${bugId}/${fileName}`;
          
          // Upload to object storage BEFORE creating database record
          const normalizedPath = await uploadToObjectStorage(
            textBuffer,
            objectPath,
            'text/plain',
            currentUser.id
          );
          
          // Add file information to bugData
          bugData = {
            ...bugData,
            filePath: normalizedPath,
            fileName: `${bugData.title}-text-content.txt`,
            fileSize: textBuffer.length,
          };
        } catch (uploadError) {
          console.error('Error uploading bug text content:', uploadError);
          return res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to save text content as file' 
          });
        }
      }

      // Create the bug with pre-generated ID (AFTER successful upload)
      const bug = await storage.createBug({
        ...bugData,
        id: bugId,
      });

      // console.log(`✅ Created new bug ${bug.id} by user ${currentUser.id}`);
      res.status(201).json(bug);
    }, { errorMessage: 'Failed to create bug', errorLogPrefix: '❌ Error create bug', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * PATCH /api/bugs/:id - Updates an existing bug with optional file upload.
   * Users can edit their own bugs, admins and managers can edit any bug.
   */
  app.patch('/api/bugs/:id', requireAuth, upload.single('attachment'), asyncHandler(async (req: any, res) => {
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
          message: 'Bug ID is required',
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
        category: z
          .enum([
            'ui_ux',
            'functionality',
            'performance',
            'data',
            'security',
            'integration',
            'other',
          ])
          .optional(),
        page: z.string().min(1, 'Page is required').optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        reproductionSteps: z.string().optional(),
        environment: z.string().optional(),
        status: z.enum(['new', 'acknowledged', 'in_progress', 'resolved', 'closed']).optional(),
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

      let updates = validation.data;
      
      // Handle file upload if present
      if (req.file) {
        try {
          // Fix filename encoding issues and sanitize
          const originalname = req.file.originalname; // multer defParamCharset: 'utf8' already decodes to utf8
          const sanitizedFilename = normalizeFilename(originalname);
          
          // Generate unique path: bugs/{bugId}/{uuid}_{sanitized_filename}
          const uniqueId = uuidv4();
          const objectPath = `bugs/${id}/${uniqueId}_${sanitizedFilename}`;
          
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
          console.error('Error uploading bug attachment during update:', uploadError);
          return res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to upload attachment' 
          });
        }
      }
      
      const bug = await storage.updateBug(id, updates, currentUser.id, currentUser.role);

      if (!bug) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Bug not found or access denied',
        });
      }

      // console.log(`📝 Updated bug ${id} by user ${currentUser.id}`);
      res.json(bug);
    }, { errorMessage: 'Failed to update bug', errorLogPrefix: '❌ Error update bug', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * GET /api/bugs/:id/file - Serves the file attachment for a bug from object storage.
   */
  app.get('/api/bugs/:id/file', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const currentUser = req.user || req.session?.user;

      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Get the bug with file info
      const bug = await storage.getBug(
        id,
        currentUser.id,
        currentUser.role,
        currentUser.organizationId
      );

      if (!bug) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Bug not found',
        });
      }

      const filePath = bug.filePath;
      
      if (!filePath) {
        return res.status(404).json({
          error: 'Not found',
          message: 'No file attached to this bug',
        });
      }

      // Get file from object storage
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(filePath);
        await objectStorageService.downloadObject(objectFile, res);
      } catch (error) {
        console.error('Error downloading bug file from object storage:', error);
        return res.status(404).json({
          error: 'Not found',
          message: 'File not found in object storage',
        });
      }
    } catch (error: any) {
      console.error('Error serving bug file:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to serve file',
        });
      }
    }
  });

  /**
   * DELETE /api/bugs/:id - Deletes a bug.
   * Only admins can delete bugs.
   */
  app.delete('/api/bugs/:id', requireAuth, asyncHandler(async (req: any, res) => {
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
          message: 'Bug ID is required',
        });
      }

      const deleted = await storage.deleteBug(id, currentUser.id, currentUser.role);

      if (!deleted) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Bug not found or access denied',
        });
      }

      // console.log(`🗑️ Deleted bug ${id} by user ${currentUser.id}`);
      res.status(204).send();
    }, { errorMessage: 'Failed to delete bug', errorLogPrefix: '❌ Error delete bug', extraErrorFields: { error: 'Internal server error' } }));
}
