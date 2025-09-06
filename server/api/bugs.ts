import type { Express } from 'express';
import { storage } from '../storage';
import { insertBugSchema, type Bug, type InsertBug } from '@shared/schema';
import { z } from 'zod';
import { requireAuth } from '../auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Configure multer for file uploads
const storage_config = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'general');
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
          code: 'AUTH_REQUIRED',
        });
      }

      console.log(`📋 Fetching bugs for user ${currentUser.id} with role ${currentUser.role}`);

      const bugs = await storage.getBugsForUser(
        currentUser.id,
        currentUser.role,
        currentUser.organizationId
      );

      console.log(`✅ Found ${bugs.length} bugs for user ${currentUser.id}`);
      
      // Debug: Log file attachment info for each bug
      bugs.forEach(bug => {
        if (bug.file_path) {
          console.log(`🔗 Bug ${bug.id} has file: ${bug.file_name} at ${bug.file_path}`);
        }
      });
      
      res.json(bugs);
    } catch (error: any) {
      console.error('❌ Error fetching bugs:', error);
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
    } catch (error: any) {
      console.error('❌ Error fetching bug:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch bug',
      });
    }
  });

  /**
   * POST /api/bugs - Creates a new bug report with optional single file attachment.
   */
  app.post('/api/bugs', requireAuth, upload.single('attachment'), async (req: any, res) => {
    try {
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

      // Handle single file attachment if present
      if (req.file) {
        // Fix filename encoding issues
        const originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        console.log(`📎 Processing attachment for new bug:`, {
          originalname: originalname,
          filename: req.file.filename,
          size: req.file.size,
          mimetype: req.file.mimetype
        });
        bugData = {
          ...bugData,
          filePath: `general/${req.file.filename}`,
          fileName: originalname,
          fileSize: req.file.size,
        };
        console.log(`✅ File attachment added to bugData`);
      } else {
        console.log(`⚠️ No file attachment in request`);
      }

      // Log the final bugData before saving
      console.log(`🐛 Creating bug with data:`, {
        title: bugData.title,
        hasFile: !!bugData.filePath,
        filePath: bugData.filePath,
        fileName: bugData.fileName,
        fileSize: bugData.fileSize
      });

      const bug = await storage.createBug(bugData);

      console.log(`✅ Created new bug ${bug.id} by user ${currentUser.id}`);
      if (bug.filePath) {
        console.log(`📎 CONFIRMED: Bug ${bug.id} has attached file: ${bug.fileName} at ${bug.filePath}`);
      } else {
        console.log(`⚠️ WARNING: Bug ${bug.id} was created WITHOUT file attachment`);
      }
      res.status(201).json(bug);
    } catch (error: any) {
      console.error('❌ Error creating bug:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create bug',
      });
    }
  });

  /**
   * PATCH /api/bugs/:id - Updates an existing bug.
   * Users can edit their own bugs, admins and managers can edit any bug.
   */
  app.patch('/api/bugs/:id', requireAuth, async (req: any, res) => {
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

      const updates = validation.data;
      const bug = await storage.updateBug(id, updates, currentUser.id, currentUser.role);

      if (!bug) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Bug not found or access denied',
        });
      }

      console.log(`📝 Updated bug ${id} by user ${currentUser.id}`);
      res.json(bug);
    } catch (error: any) {
      console.error('❌ Error updating bug:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update bug',
      });
    }
  });

  /**
   * GET /api/bugs/:id/file - Serves the file attachment for a bug.
   */
  app.get('/api/bugs/:id/file', requireAuth, async (req: any, res) => {
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

      // Debug: Log the request details first
      console.log('🔍 File request details:', {
        bugId: id,
        userId: currentUser.id,
        userRole: currentUser.role
      });

      // Get the bug with file info
      const bug = await storage.getBug(
        id,
        currentUser.id,
        currentUser.role,
        currentUser.organizationId
      );

      // Debug: Log what we got from storage
      console.log('🔍 Bug from storage:', {
        found: !!bug,
        id: bug?.id,
        title: bug?.title,
        filePath: bug?.filePath,
        fileName: bug?.fileName,
        fileSize: bug?.fileSize,
        file_path: (bug as any)?.file_path,
        file_name: (bug as any)?.file_name,
        file_size: (bug as any)?.file_size
      });

      if (!bug || !bug.filePath) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Bug file not found or no file attached',
        });
      }

      const filePath = path.join(process.cwd(), 'uploads', bug.filePath);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          error: 'Not found',
          message: 'File not found on server',
        });
      }

      // Set appropriate headers
      if (download === 'true') {
        res.setHeader('Content-Disposition', `attachment; filename="${bug.fileName || 'attachment'}"`);
      } else {
        res.setHeader('Content-Disposition', `inline; filename="${bug.fileName || 'attachment'}"`);
      }

      // Send file
      res.sendFile(filePath);
    } catch (error: any) {
      console.error('❌ Error serving bug file:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to serve file',
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

      console.log(`🗑️ Deleted bug ${id} by user ${currentUser.id}`);
      res.status(204).send();
    } catch (error: any) {
      console.error('❌ Error deleting bug:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete bug',
      });
    }
  });
}
