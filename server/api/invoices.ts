// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
import { Express, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../auth/index';
import { uploadInvoiceFile, handleUploadError } from '../middleware/fileUpload';
import { aiService } from '../services/consolidated-ai-service';
import { aiExtractionResponseSchema, insertInvoiceSchema } from '@shared/schema';
import { storage } from '../storage';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { assertBuildingWriteAccess } from '../utils/org-scope';
import { db } from '../db';
import * as schema from '@shared/schema';

/**
 * Invoice management API routes.
 * Handles AI-powered invoice data extraction and form processing.
 */

// Rate limiting for AI extraction endpoint (expensive operation)
const extractionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each user to 10 extraction requests per windowMs
  message: {
    error: 'Too many extraction requests',
    message: 'Please wait before making another extraction request',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req: any) => {
    return req.user?.id || ipKeyGenerator(req);
  },
  skip: (req: any) => {
    return !req.user?.id;
  },
  validate: { keyGeneratorIpFallback: false },
});

export function registerInvoiceRoutes(app: Express) {

  /**
   * POST /api/invoices/extract-data
   * Extract invoice data from uploaded file using Gemini AI.
   * 
   * Security: Requires authentication, rate limiting, and file validation.
   * File Types: PDF, JPEG, PNG, WebP, HEIC, HEIF
   * Max Size: 25MB
   */
  app.post('/api/invoices/extract-data', 
    requireAuth,
    extractionRateLimit,
    uploadInvoiceFile,
    handleUploadError,
    async (req: any, res: Response) => {
      const startTime = Date.now();
      const userId = req.user.id;
      const userRole = req.user.role;

      try {
        // Validate file upload
        if (!req.file) {
          return res.status(400).json({
            error: 'No file uploaded',
            message: 'Please upload an invoice file',
            code: 'NO_FILE'
          });
        }

        const { buffer, mimetype, originalname, size } = req.file;
        
        // Validate GEMINI_API_KEY is configured
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          return res.status(500).json({
            error: 'AI service not configured',
            message: 'Invoice extraction service is not available',
            code: 'SERVICE_UNAVAILABLE'
          });
        }

        // Extract invoice data using AI service
        const extractionData = await aiService.extractInvoiceData(buffer, mimetype);
        
        // Calculate confidence score
        const confidenceScore = aiService.calculateConfidenceScore(extractionData);
        
        // Validate extracted data structure
        const validatedData = aiExtractionResponseSchema.parse(extractionData);
        
        const processingTime = Date.now() - startTime;
        
        // Return structured response
        res.json({
          success: true,
          data: validatedData,
          metadata: {
            confidence: confidenceScore,
            processingTime,
            filename: originalname,
            fileSize: size,
            extractedAt: new Date().toISOString()
          }
        });

      } catch (error: any) {
        // Handle specific error types
        if (error.message.includes('GEMINI_API_KEY')) {
          return res.status(500).json({
            error: 'AI service configuration error',
            message: 'Invoice extraction service is not properly configured',
            code: 'CONFIG_ERROR'
          });
        }

        if (error.message.includes('Unsupported file type')) {
          return res.status(400).json({
            error: 'Unsupported file type',
            message: 'internal_error',
            code: 'UNSUPPORTED_FILE_TYPE'
          });
        }

        if (error.message.includes('JSON parse')) {
          return res.status(500).json({
            error: 'AI response parsing error',
            message: 'Failed to parse AI response. Please try again.',
            code: 'AI_PARSE_ERROR'
          });
        }

        // Generic error response
        return res.status(500).json({
          error: 'Extraction failed',
          message: 'Failed to extract invoice data. Please try again.',
          code: 'EXTRACTION_ERROR'
        });
      }
    }
  );

  /**
   * GET /api/invoices/health
   * Health check for invoice services including Gemini API validation.
   */
  app.get('/api/invoices/health', requireAuth, async (req: any, res: Response) => {
    try {
      const checks: any = {
        apiKeyConfigured: !!process.env.GEMINI_API_KEY,
        serviceInitialized: !!aiService,
        timestamp: new Date().toISOString()
      };

      // If API key is configured, test the connection
      if (checks.apiKeyConfigured && checks.serviceInitialized) {
        try {
          checks.apiConnected = await aiService.validateApiKey();
        } catch (error) {
          checks.apiConnected = false;
          checks.apiError = 'Connection test failed';
        }
      }

      const isHealthy = checks.apiKeyConfigured && checks.serviceInitialized && (checks.apiConnected !== false);

      res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'healthy' : 'unhealthy',
        service: 'invoice-extraction',
        checks
      });

    } catch (error: any) {
      res.status(503).json({
        status: 'unhealthy',
        service: 'invoice-extraction',
        error: 'internal_error',
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * GET /api/invoices
   * Get all invoices with role-based filtering.
   */
  app.get('/api/invoices', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const { buildingId, residenceId } = req.query;

      const filters = {
        buildingId: buildingId as string,
        residenceId: residenceId as string,
        userId,
        userRole
      };

      const invoices = await storage.getInvoices(filters);
      
      res.json({
        success: true,
        data: invoices,
        count: invoices.length
      });

    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to fetch invoices',
        message: 'internal_error'
      });
    }
  });

  /**
   * GET /api/invoices/:id
   * Get a specific invoice by ID.
   */
  app.get('/api/invoices/:id', requireAuth, async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const invoice = await storage.getInvoice(id);

      if (!invoice) {
        return res.status(404).json({
          error: 'Invoice not found',
          message: 'The requested invoice does not exist'
        });
      }

      res.json({
        success: true,
        data: invoice
      });

    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to fetch invoice',
        message: 'internal_error'
      });
    }
  });

  /**
   * POST /api/invoices
   * Create a new invoice.
   * Org-scope: buildingId must belong to the caller's organization.
   * Residence-scope: residenceId (if supplied) must belong to the same building.
   */
  app.post('/api/invoices', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;

      // Validate user permissions
      if (userRole !== 'admin' && userRole !== 'manager') {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Only admins and managers can create invoices'
        });
      }

      // Validate request body
      const invoiceData = {
        ...req.body,
        createdBy: userId,
        // Set defaults for required fields if not provided (for testing)
        paymentType: req.body.paymentType || 'one-time',
        // Only include documentId if provided (now optional)
        ...(req.body.documentId && { documentId: req.body.documentId }),
      };
      
      const validatedData = insertInvoiceSchema.parse(invoiceData);

      // Org-scope guard: verify the caller can write to this building.
      if (validatedData.buildingId) {
        const buildingAccess = await assertBuildingWriteAccess(res, userId, validatedData.buildingId);
        if (!buildingAccess.ok) return;

        // Residence-scope guard: residenceId must belong to the invoice's building.
        if (validatedData.residenceId) {
          const residenceRows = await db
            .select({ buildingId: schema.residences.buildingId })
            .from(schema.residences)
            .where(eq(schema.residences.id, validatedData.residenceId))
            .limit(1);

          if (residenceRows.length === 0) {
            return res.status(404).json({
              error: 'Residence not found',
              message: 'The specified residence does not exist',
              code: 'RESIDENCE_NOT_FOUND',
            });
          }

          if (residenceRows[0].buildingId !== validatedData.buildingId) {
            return res.status(422).json({
              error: 'Residence does not belong to the specified building',
              message: 'The residenceId must be a unit within the invoice\'s building',
              code: 'RESIDENCE_BUILDING_MISMATCH',
            });
          }
        }
      }

      const invoice = await storage.createInvoice(validatedData);

      res.status(201).json({
        success: true,
        data: invoice,
        message: 'Invoice created successfully'
      });

    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Invalid invoice data',
          details: error.errors
        });
      }

      res.status(500).json({
        error: 'Failed to create invoice',
        message: 'internal_error'
      });
    }
  });

  /**
   * PUT /api/invoices/:id
   * Update an existing invoice.
   * Org-scope: the invoice's building must belong to the caller's organization.
   */
  app.put('/api/invoices/:id', requireAuth, async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      // Check if invoice exists
      const existingInvoice = await storage.getInvoice(id);
      if (!existingInvoice) {
        return res.status(404).json({
          error: 'Invoice not found',
          message: 'The requested invoice does not exist'
        });
      }

      // Validate user permissions
      if (userRole !== 'admin' && userRole !== 'manager' && existingInvoice.createdBy !== userId) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'You can only edit your own invoices'
        });
      }

      // Org-scope guard on the existing invoice's building.
      if (existingInvoice.buildingId) {
        const buildingAccess = await assertBuildingWriteAccess(res, userId, existingInvoice.buildingId);
        if (!buildingAccess.ok) return;
      }

      // Validate request body (partial update)
      const updateData = insertInvoiceSchema.partial().parse(req.body);

      // If the update reassigns the invoice to a different building, verify access to that target building too.
      if (updateData.buildingId && updateData.buildingId !== existingInvoice.buildingId) {
        const targetBuildingAccess = await assertBuildingWriteAccess(res, userId, updateData.buildingId);
        if (!targetBuildingAccess.ok) return;
      }

      // If the update supplies a residenceId, verify it belongs to the invoice's building.
      const effectiveBuildingId = updateData.buildingId ?? existingInvoice.buildingId;
      if (updateData.residenceId && effectiveBuildingId) {
        const residenceRows = await db
          .select({ buildingId: schema.residences.buildingId })
          .from(schema.residences)
          .where(eq(schema.residences.id, updateData.residenceId))
          .limit(1);

        if (residenceRows.length === 0) {
          return res.status(404).json({
            error: 'Residence not found',
            message: 'The specified residence does not exist',
            code: 'RESIDENCE_NOT_FOUND',
          });
        }

        if (residenceRows[0].buildingId !== effectiveBuildingId) {
          return res.status(422).json({
            error: 'Residence does not belong to the specified building',
            message: 'The residenceId must be a unit within the invoice\'s building',
            code: 'RESIDENCE_BUILDING_MISMATCH',
          });
        }
      }

      const updatedInvoice = await storage.updateInvoice(id, updateData);

      if (!updatedInvoice) {
        return res.status(404).json({
          error: 'Invoice not found',
          message: 'The requested invoice does not exist'
        });
      }

      res.json({
        success: true,
        data: updatedInvoice,
        message: 'Invoice updated successfully'
      });

    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Invalid invoice data',
          details: error.errors
        });
      }

      res.status(500).json({
        error: 'Failed to update invoice',
        message: 'internal_error'
      });
    }
  });

  /**
   * DELETE /api/invoices/:id
   * Delete an invoice.
   * Org-scope: the invoice's building must belong to the caller's organization.
   */
  app.delete('/api/invoices/:id', requireAuth, async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      // Check if invoice exists
      const existingInvoice = await storage.getInvoice(id);
      if (!existingInvoice) {
        return res.status(404).json({
          error: 'Invoice not found',
          message: 'The requested invoice does not exist'
        });
      }

      // Validate user permissions
      if (userRole !== 'admin' && userRole !== 'manager' && existingInvoice.createdBy !== userId) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'You can only delete your own invoices'
        });
      }

      // Org-scope guard on the existing invoice's building.
      if (existingInvoice.buildingId) {
        const buildingAccess = await assertBuildingWriteAccess(res, userId, existingInvoice.buildingId);
        if (!buildingAccess.ok) return;
      }

      const deleted = await storage.deleteInvoice(id);

      if (!deleted) {
        return res.status(404).json({
          error: 'Invoice not found',
          message: 'The requested invoice does not exist'
        });
      }

      res.json({
        success: true,
        message: 'Invoice deleted successfully'
      });

    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to delete invoice',
        message: 'internal_error'
      });
    }
  });
}
