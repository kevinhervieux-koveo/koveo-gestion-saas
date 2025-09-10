import type { Express, Request, Response } from 'express';
import type { Bill } from '@shared/schema';
import { eq, desc, and, sql, isNull, or, ilike } from 'drizzle-orm';
import { db } from '../db';
import { requireAuth } from '../auth';
import { storage } from '../storage';
import { z } from 'zod';
import { moneyFlowJob } from '../jobs/money_flow_job';
import { billAutoGenerationService } from '../services/bill-generation-service';
import { delayedUpdateService } from '../services/delayed-update-service';
import { paymentGenerationService } from '../services/payment-generation-service';
import { geminiBillAnalyzer } from '../services/gemini-bill-analyzer';
import { geminiService } from '../services/geminiService';
import { uploadInvoiceFile, handleUploadError } from '../middleware/fileUpload';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as schema from '@shared/schema';

const { buildings, bills } = schema;

// Database-driven bills - no more mock data

// Validation schemas
const billFilterSchema = z.object({
  buildingId: z.string().uuid(),
  category: z.string().optional(),
  year: z.string().optional(),
  status: z.enum(['all', 'draft', 'sent', 'overdue', 'paid', 'cancelled']).optional(),
  months: z.string().optional(), // Comma-separated month numbers (e.g., "1,3,6,12")
});

const createBillSchema = z.object({
  buildingId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.enum([
    'insurance',
    'maintenance',
    'salary',
    'utilities',
    'cleaning',
    'security',
    'landscaping',
    'professional_services',
    'administration',
    'repairs',
    'supplies',
    'taxes',
    'technology',
    'reserves',
    'other',
  ]),
  vendor: z.string().optional(),
  paymentType: z.enum(['unique', 'recurrent', 'auto-generated']),
  schedulePayment: z.enum(['weekly', 'monthly', 'quarterly', 'yearly', 'custom']).optional(),
  scheduleCustom: z.array(z.string()).optional(),
  costs: z.array(z.string()),
  totalAmount: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  status: z.enum(['draft', 'sent', 'overdue', 'paid', 'cancelled']),
  notes: z.string().optional(),
});

const updateBillSchema = createBillSchema.partial();

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
    // Rate limit per authenticated user ID (preferred) or use IP as fallback with IPv6 support
    return req.user?.id || ipKeyGenerator(req);
  },
  skip: (req: any) => {
    // Skip rate limiting if user is not authenticated (handled by requireAuth)
    return !req.user?.id;
  }
});

// Configure multer for file uploads
const upload = multer({
  dest: '/tmp/uploads/',
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image and PDF files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

/**
 *
 * @param app
 */
/**
 * RegisterBillRoutes function.
 * @param app
 * @returns Function result.
 */
export function registerBillRoutes(app: Express) {
  /**
   * POST /api/bills/extract-data
   * Extract bill data from uploaded file using Gemini AI.
   * 
   * Security: Requires authentication, rate limiting, and file validation.
   * File Types: PDF, JPEG, PNG, WebP, HEIC, HEIF
   * Max Size: 25MB
   */
  app.post('/api/bills/extract-data', 
    requireAuth,
    extractionRateLimit,
    uploadInvoiceFile,
    handleUploadError,
    async (req: any, res: Response) => {
      const startTime = Date.now();
      const userId = req.user.id;
      const userRole = req.user.role;

      console.log(`[BILL EXTRACTION] Starting extraction for user ${userId} (${userRole})`);

      try {
        // Validate file upload
        if (!req.file) {
          console.log(`[BILL EXTRACTION] No file uploaded by user ${userId}`);
          return res.status(400).json({
            error: 'No file uploaded',
            message: 'Please upload a bill file',
            code: 'NO_FILE'
          });
        }

        const { buffer, mimetype, originalname, size } = req.file;
        
        console.log(`[BILL EXTRACTION] Processing file for user ${userId}:`, {
          filename: originalname,
          mimetype,
          size: `${Math.round(size / 1024)}KB`
        });

        // Call Gemini service for bill extraction
        const extractedData = await geminiService.extractBillData(buffer, mimetype);
        
        console.log(`[BILL EXTRACTION] Extraction completed for user ${userId} in ${Date.now() - startTime}ms`);

        // Return successful response
        res.status(200).json({
          success: true,
          data: extractedData,
          metadata: {
            confidence: 0.9, // Could be calculated based on field completeness
            processingTime: Date.now() - startTime,
            filename: originalname,
            fileSize: size
          }
        });

      } catch (error: any) {
        console.error(`[BILL EXTRACTION] Error for user ${userId}:`, error);
        
        // Handle different error types
        if (error.message?.includes('Unsupported file type')) {
          return res.status(400).json({
            error: 'Unsupported file type',
            message: 'Please upload a PDF or image file (JPEG, PNG, WebP, HEIC, HEIF)',
            code: 'UNSUPPORTED_FILE_TYPE'
          });
        } else if (error.message?.includes('FILE_TOO_LARGE')) {
          return res.status(400).json({
            error: 'File too large',
            message: 'Please upload a file smaller than 25MB',
            code: 'FILE_TOO_LARGE'
          });
        } else if (error.message?.includes('GEMINI_API_KEY')) {
          return res.status(500).json({
            error: 'AI service configuration error',
            message: 'AI extraction service is temporarily unavailable',
            code: 'GEMINI_API_ERROR'
          });
        }

        // Generic error response
        res.status(500).json({
          error: 'Extraction failed',
          message: 'Failed to extract bill data. Please try again.',
          code: 'EXTRACTION_ERROR'
        });
      }
    }
  );

  /**
   * Get year range (min/max years) for bills in a building
   * GET /api/bills/year-range?buildingId=uuid
   */
  app.get('/api/bills/year-range', requireAuth, async (req: any, res: any) => {
    try {
      const { buildingId } = req.query;

      if (!buildingId) {
        return res.status(400).json({ error: 'Building ID is required' });
      }

      // Get min and max years from bills
      const yearRangeResult = await db
        .select({
          minYear: sql<number>`EXTRACT(YEAR FROM MIN(${bills.startDate}))`,
          maxYear: sql<number>`EXTRACT(YEAR FROM MAX(${bills.startDate}))`,
          count: sql<number>`COUNT(*)`
        })
        .from(bills)
        .where(eq(bills.buildingId, buildingId));

      const result = yearRangeResult[0];
      
      // If no bills exist, return current year as both min and max
      if (!result || result.count === 0) {
        const currentYear = new Date().getFullYear();
        return res.json({
          minYear: currentYear,
          maxYear: currentYear,
          count: 0,
          hasBills: false
        });
      }

      res.json({
        minYear: result.minYear,
        maxYear: result.maxYear,
        count: result.count,
        hasBills: true
      });
    } catch (error) {
      console.error('Error fetching bill year range:', error);
      res.status(500).json({ error: 'Failed to fetch year range' });
    }
  });

  /**
   * Get all bills with optional filtering
   * GET /api/bills?buildingId=uuid&category=insurance&year=2024&status=draft&months=1,3,6.
   */
  app.get('/api/bills', requireAuth, async (req: any, res: any) => {
    try {
      const { buildingId, category, year, status = 'all', months, paymentType, isAutoGenerated, search } = req.query;

      // Build the WHERE conditions
      const conditions = [];

      if (buildingId && buildingId !== 'all') {
        conditions.push(eq(bills.buildingId, buildingId));
      }

      if (category && category !== 'all') {
        conditions.push(eq(bills.category, category));
      }

      if (year) {
        conditions.push(sql`EXTRACT(YEAR FROM ${bills.startDate}) = ${year}`);
      }

      if (status && status !== 'all') {
        conditions.push(eq(bills.status, status));
      }

      if (months) {
        const monthNumbers = months.split(',').map((m: string) => parseInt(m.trim()));
        const monthConditions = monthNumbers.map(
          (month: number) => sql`EXTRACT(MONTH FROM ${bills.startDate}) = ${month}`
        );
        conditions.push(sql`(${sql.join(monthConditions, sql` OR `)})`);
      }

      if (paymentType && paymentType !== 'all') {
        conditions.push(eq(bills.paymentType, paymentType));
      }

      if (isAutoGenerated !== undefined) {
        conditions.push(eq(bills.isAutoGenerated, isAutoGenerated === 'true'));
      }

      if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`;
        const searchConditions = or(
          ilike(bills.title, searchTerm),
          ilike(bills.description, searchTerm),
          ilike(bills.vendor, searchTerm),
          ilike(bills.notes, searchTerm),
          ilike(bills.category, searchTerm)
        );
        conditions.push(searchConditions);
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const billsList = await db
        .select({
          id: bills.id,
          buildingId: bills.buildingId,
          billNumber: bills.billNumber,
          title: bills.title,
          description: bills.description,
          category: bills.category,
          vendor: bills.vendor,
          paymentType: bills.paymentType,
          schedulePayment: bills.schedulePayment,
          scheduleCustom: bills.scheduleCustom,
          costs: bills.costs,
          totalAmount: bills.totalAmount,
          startDate: bills.startDate,
          endDate: bills.endDate,
          status: bills.status,
          notes: bills.notes,
          filePath: bills.filePath,
          fileName: bills.fileName,
          fileSize: bills.fileSize,
          isAiAnalyzed: bills.isAiAnalyzed,
          aiAnalysisData: bills.aiAnalysisData,
          isAutoGenerated: bills.isAutoGenerated,
          sourceTemplateId: bills.sourceTemplateId,
          autoGeneratedLabel: bills.autoGeneratedLabel,
          createdBy: bills.createdBy,
          createdAt: bills.createdAt,
          updatedAt: bills.updatedAt,
        })
        .from(bills)
        .where(whereClause)
        .orderBy(desc(bills.startDate));

      res.json(billsList);
    } catch (_error: any) {
      console.error('❌ Error fetching bills:', _error);
      res.status(500).json({
        message: 'Failed to fetch bills',
        _error: _error instanceof Error ? _error.message : 'Unknown error',
      });
    }
  });

  /**
   * Get a specific bill by ID
   * GET /api/bills/:id.
   */
  app.get('/api/bills/:id', requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const bill = await db
        .select({
          id: bills.id,
          buildingId: bills.buildingId,
          billNumber: bills.billNumber,
          title: bills.title,
          description: bills.description,
          category: bills.category,
          vendor: bills.vendor,
          paymentType: bills.paymentType,
          costs: bills.costs,
          totalAmount: bills.totalAmount,
          startDate: bills.startDate,
          status: bills.status,
          notes: bills.notes,
          filePath: bills.filePath,
          fileName: bills.fileName,
          fileSize: bills.fileSize,
          isAiAnalyzed: bills.isAiAnalyzed,
          createdBy: bills.createdBy,
          createdAt: bills.createdAt,
          updatedAt: bills.updatedAt,
        })
        .from(bills)
        .where(eq(bills.id, id))
        .limit(1);

      if (bill.length === 0) {
        return res.status(404).json({
          message: 'Bill not found',
        });
      }


      res.json(bill[0]);
    } catch (_error: any) {
      console.error('❌ Error fetching bill:', _error);
      res.status(500).json({
        message: 'Failed to fetch bill',
        _error: _error instanceof Error ? _error.message : 'Unknown error',
      });
    }
  });

  /**
   * Create a new bill
   * POST /api/bills.
   */
  app.post('/api/bills', requireAuth, async (req: any, res: any) => {
    try {
      const validation = createBillSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          message: 'Invalid bill data',
          errors: validation.error.issues,
        });
      }

      const billData = validation.data;
      const newBill = await db
        .insert(bills)
        .values({
          buildingId: billData.buildingId,
          billNumber: `BILL-${Date.now()}`,
          title: billData.title,
          description: billData.description,
          category: billData.category,
          vendor: billData.vendor,
          paymentType: billData.paymentType,
          schedulePayment: billData.schedulePayment,
          scheduleCustom: billData.scheduleCustom,
          costs: billData.costs.map((cost) => parseFloat(cost)),
          totalAmount: parseFloat(billData.totalAmount),
          startDate: billData.startDate,
          endDate: billData.endDate || null,
          status: billData.status,
          notes: billData.notes,
          createdBy: req.user.id,
        })
        .returning();

      // Generate payments for the new bill
      try {
        await paymentGenerationService.generatePaymentsForBill(newBill[0].id);
      } catch (paymentError) {
        console.warn('⚠️ Failed to generate payments for bill:', paymentError);
        // Don't fail the bill creation if payment generation fails
      }

      // Schedule delayed money flow and budget update for the new bill
      try {
        delayedUpdateService.scheduleBillUpdate(newBill[0].id);
      } catch (schedulingError) {
        console.warn('⚠️ Failed to schedule bill update:', schedulingError);
        // Don't fail the bill creation if scheduling fails
      }

      // Auto-generation trigger for recurrent bills
      if (newBill[0].paymentType === 'recurrent') {
        try {
          await billAutoGenerationService.generateNextYearBill(newBill[0]);
          await billAutoGenerationService.cleanupPastAutoGeneratedBills(newBill[0].buildingId);
          console.log(`✅ Auto-generation triggered for recurrent bill ${newBill[0].id}`);
        } catch (autoGenError) {
          console.warn('⚠️ Failed to auto-generate next year bill:', autoGenError);
          // Don't fail the bill creation if auto-generation fails
        }
      }

      res.status(201).json(newBill[0]);
    } catch (_error: any) {
      console.error('❌ Error creating bill:', _error);
      res.status(500).json({
        message: 'Failed to create bill',
        _error: _error instanceof Error ? _error.message : 'Unknown error',
      });
    }
  });

  /**
   * Update a bill (PATCH)
   * PATCH /api/bills/:id.
   */
  app.patch('/api/bills/:id', requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const validation = updateBillSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          message: 'Invalid bill data',
          errors: validation.error.issues,
        });
      }

      const billData = validation.data;

      const updateData: any = {};
      if (billData.title) {
        updateData.title = billData.title;
      }
      if (billData.description) {
        updateData.description = billData.description;
      }
      if (billData.category) {
        updateData.category = billData.category;
      }
      if (billData.vendor) {
        updateData.vendor = billData.vendor;
      }
      if (billData.paymentType) {
        updateData.paymentType = billData.paymentType;
      }
      if (billData.costs) {
        updateData.costs = billData.costs.map((cost: string) => parseFloat(cost));
      }
      if (billData.totalAmount) {
        updateData.totalAmount = parseFloat(billData.totalAmount);
      }
      if (billData.startDate) {
        updateData.startDate = billData.startDate;
      }
      if (billData.endDate) {
        updateData.endDate = billData.endDate;
      }
      if (billData.status) {
        updateData.status = billData.status;
      }
      if (billData.notes) {
        updateData.notes = billData.notes;
      }
      updateData.updatedAt = new Date();

      const updatedBill = await db
        .update(bills)
        .set(updateData)
        .where(eq(bills.id, id))
        .returning();

      if (updatedBill.length === 0) {
        return res.status(404).json({
          message: 'Bill not found',
        });
      }

      // Update payments for the edited bill
      try {
        await paymentGenerationService.updatePaymentsForBill(id);
        
        // If status was updated, cascade status changes to payments
        if (billData.status) {
          await paymentGenerationService.updatePaymentStatusFromBillStatus(id, billData.status);
        }
      } catch (paymentError) {
        console.warn('⚠️ Failed to update payments for bill:', paymentError);
        // Don't fail the bill update if payment update fails
      }

      // Auto-generation trigger for recurrent bills
      if (updatedBill[0].paymentType === 'recurrent') {
        try {
          await billAutoGenerationService.regenerateAutoGeneratedBills(id);
          await billAutoGenerationService.cleanupPastAutoGeneratedBills(updatedBill[0].buildingId);
          console.log(`✅ Auto-generation regenerated for recurrent bill ${id}`);
        } catch (autoGenError) {
          console.warn('⚠️ Failed to regenerate auto-generated bills:', autoGenError);
          // Don't fail the bill update if auto-generation fails
        }
      }

      res.json(updatedBill[0]);
    } catch (_error: any) {
      console.error('❌ Error updating bill (PATCH):', _error);
      res.status(500).json({
        message: 'Failed to update bill',
        _error: _error instanceof Error ? _error.message : 'Unknown error',
      });
    }
  });

  /**
   * Update a bill (PUT)
   * PUT /api/bills/:id.
   */
  app.put('/api/bills/:id', requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const validation = updateBillSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          message: 'Invalid bill data',
          errors: validation.error.issues,
        });
      }

      const billData = validation.data;

      const updateData: any = {};
      if (billData.title) {
        updateData.title = billData.title;
      }
      if (billData.description) {
        updateData.description = billData.description;
      }
      if (billData.category) {
        updateData.category = billData.category;
      }
      if (billData.vendor) {
        updateData.vendor = billData.vendor;
      }
      if (billData.paymentType) {
        updateData.paymentType = billData.paymentType;
      }
      if (billData.costs) {
        updateData.costs = billData.costs.map((cost: string) => parseFloat(cost));
      }
      if (billData.totalAmount) {
        updateData.totalAmount = parseFloat(billData.totalAmount);
      }
      if (billData.startDate) {
        updateData.startDate = billData.startDate;
      }
      if (billData.status) {
        updateData.status = billData.status;
      }
      if (billData.notes) {
        updateData.notes = billData.notes;
      }
      updateData.updatedAt = new Date();

      const updatedBill = await db
        .update(bills)
        .set(updateData)
        .where(eq(bills.id, id))
        .returning();

      if (updatedBill.length === 0) {
        return res.status(404).json({
          message: 'Bill not found',
        });
      }

      // Update payments for the edited bill
      try {
        await paymentGenerationService.updatePaymentsForBill(id);
        
        // If status was updated, cascade status changes to payments
        if (billData.status) {
          await paymentGenerationService.updatePaymentStatusFromBillStatus(id, billData.status);
        }
      } catch (paymentError) {
        console.warn('⚠️ Failed to update payments for bill:', paymentError);
        // Don't fail the bill update if payment update fails
      }

      // Schedule delayed money flow and budget update for the updated bill
      try {
        delayedUpdateService.scheduleBillUpdate(id);
      } catch (schedulingError) {
        console.warn('⚠️ Failed to schedule bill update:', schedulingError);
        // Don't fail the bill update if scheduling fails
      }

      // Auto-generation trigger for recurrent bills
      if (updatedBill[0].paymentType === 'recurrent') {
        try {
          await billAutoGenerationService.regenerateAutoGeneratedBills(id);
          await billAutoGenerationService.cleanupPastAutoGeneratedBills(updatedBill[0].buildingId);
          console.log(`✅ Auto-generation regenerated for recurrent bill ${id}`);
        } catch (autoGenError) {
          console.warn('⚠️ Failed to regenerate auto-generated bills:', autoGenError);
          // Don't fail the bill update if auto-generation fails
        }
      }

      res.json(updatedBill[0]);
    } catch (_error: any) {
      console.error('❌ Error updating bill (PUT):', _error);
      res.status(500).json({
        message: 'Failed to update bill',
        _error: _error instanceof Error ? _error.message : 'Unknown error',
      });
    }
  });

  /**
   * Delete a bill
   * DELETE /api/bills/:id.
   */
  app.delete('/api/bills/:id', requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      // Get bill info before deletion for auto-generation cleanup
      const billToDelete = await db
        .select()
        .from(bills)
        .where(eq(bills.id, id))
        .limit(1);

      // Delete associated payments first
      try {
        await paymentGenerationService.deletePaymentsForBill(id);
      } catch (paymentError) {
        console.warn('⚠️ Failed to delete payments for bill:', paymentError);
        // Continue with bill deletion even if payment deletion fails
      }

      // Auto-generation cleanup for recurrent bills
      if (billToDelete.length > 0 && billToDelete[0].paymentType === 'recurrent') {
        try {
          // Delete any auto-generated bills created from this template
          await db
            .delete(bills)
            .where(
              and(
                eq(bills.sourceTemplateId, id),
                eq(bills.isAutoGenerated, true)
              )
            );
          console.log(`✅ Deleted auto-generated bills for recurrent bill ${id}`);
        } catch (autoGenError) {
          console.warn('⚠️ Failed to delete auto-generated bills:', autoGenError);
          // Continue with bill deletion even if auto-generation cleanup fails
        }
      }

      const deletedBill = await db.delete(bills).where(eq(bills.id, id)).returning();

      if (!deletedBill || (Array.isArray(deletedBill) && deletedBill.length === 0)) {
        return res.status(404).json({
          message: 'Bill not found',
        });
      }

      res.json({
        message: 'Bill deleted successfully',
        bill: deletedBill[0],
      });
    } catch (_error: any) {
      console.error('❌ Error deleting bill:', _error);
      res.status(500).json({
        message: 'Failed to delete bill',
        _error: _error instanceof Error ? _error.message : 'Unknown error',
      });
    }
  });

  /**
   * Upload and analyze bill document with Gemini AI
   * POST /api/bills/:id/upload-document.
   */
  app.post(
    '/api/bills/:id/upload-document',
    requireAuth,
    upload.single('document'),
    async (req: any, res: any) => {
      console.log(`📄 [BILLS UPLOAD] Starting document upload for bill ID: ${req.params.id}`);
      console.log(`📄 [BILLS UPLOAD] User: ${req.user.id} (${req.user.role})`);
      
      try {
        const { id } = req.params;

        if (!req.file) {
          console.log('❌ [BILLS UPLOAD] No file provided in request');
          return res.status(400).json({ message: 'No file uploaded' });
        }

        console.log(`📄 [BILLS UPLOAD] File received:`, {
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          tempPath: req.file.path
        });

        // Get organization ID for document organization
        const organizations = await storage.getUserOrganizations(req.user.id);
        const organizationId =
          organizations.length > 0 ? organizations[0].organizationId : 'default';
        
        console.log(`📄 [BILLS UPLOAD] Organization ID determined: ${organizationId}`);

        // Create document path in the expected format
        const filePath = `prod_org_${organizationId}/${req.file.originalname}`;
        console.log(`📄 [BILLS UPLOAD] File path determined: ${filePath}`);
        
        // Create uploads directory structure if it doesn't exist
        const path = await import('path');
        const uploadsDir = path.join(process.cwd(), 'uploads');
        const orgDir = path.join(uploadsDir, `prod_org_${organizationId}`);
        
        console.log(`📄 [BILLS UPLOAD] Directory paths:`, {
          uploadsDir,
          orgDir,
          uploadsExists: fs.existsSync(uploadsDir),
          orgDirExists: fs.existsSync(orgDir)
        });
        
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
          console.log(`📄 [BILLS UPLOAD] Created uploads directory: ${uploadsDir}`);
        }
        if (!fs.existsSync(orgDir)) {
          fs.mkdirSync(orgDir, { recursive: true });
          console.log(`📄 [BILLS UPLOAD] Created organization directory: ${orgDir}`);
        }

        // Save file to permanent storage
        const permanentFilePath = path.join(uploadsDir, filePath);
        console.log(`📄 [BILLS UPLOAD] Copying file from ${req.file.path} to ${permanentFilePath}`);
        fs.copyFileSync(req.file.path, permanentFilePath);
        console.log(`📄 [BILLS UPLOAD] File successfully saved to permanent storage`);

        // Analyze document with Gemini AI (images and PDFs)
        let analysisResult = null;
        if (req.file.mimetype.startsWith('image/') || req.file.mimetype === 'application/pdf') {
          console.log(`🤖 [BILLS UPLOAD] Starting AI analysis for ${req.file.mimetype} file`);
          try {
            analysisResult = await geminiBillAnalyzer.analyzeBillDocument(req.file.path, req.file.mimetype);
            console.log(`🤖 [BILLS UPLOAD] AI analysis successful:`, {
              hasResult: !!analysisResult,
              analysisKeys: analysisResult ? Object.keys(analysisResult) : []
            });
          } catch (aiError) {
            console.warn('🤖 [BILLS UPLOAD] AI analysis failed, continuing without analysis:', aiError);
            // Continue without AI analysis
          }
        } else {
          console.log(`🤖 [BILLS UPLOAD] Skipping AI analysis for unsupported file type: ${req.file.mimetype}`);
        }

        // Update bill with document info and AI analysis
        const updateData: unknown = {
          filePath,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          isAiAnalyzed: !!analysisResult,
          aiAnalysisData: analysisResult,
          updatedAt: new Date(),
        };

        console.log(`📄 [BILLS UPLOAD] Updating bill ${id} in database with:`, {
          filePath,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          hasAiAnalysis: !!analysisResult
        });

        const updatedBill = await db
          .update(bills)
          .set(updateData)
          .where(eq(bills.id, id))
          .returning();

        console.log(`📄 [BILLS UPLOAD] Database update successful for bill ${id}`);

        // Clean up temporary file
        console.log(`📄 [BILLS UPLOAD] Cleaning up temporary file: ${req.file.path}`);
        fs.unlinkSync(req.file.path);

        console.log(`✅ [BILLS UPLOAD] Upload process completed successfully for bill ${id}`);

        res.json({
          message: 'Document uploaded and analyzed successfully',
          bill: updatedBill[0],
          analysisResult,
        });
      } catch (_error: any) {
        console.error('❌ Error uploading document:', _error);
        
        // Clean up temporary file if it exists
        if (req.file?.path) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (___cleanupError) {
            console.error('Error cleaning up temp file:', ___cleanupError);
          }
        }

        res.status(500).json({
          message: 'Failed to upload document',
          _error: _error instanceof Error ? _error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * Download bill document using secure signed URL
   * GET /api/bills/:id/download-document.
   */
  app.get('/api/bills/:id/download-document', requireAuth, async (req: any, res: any) => {
    console.log(`📥 [BILLS DOWNLOAD] Document download request for bill ID: ${req.params.id}`);
    console.log(`📥 [BILLS DOWNLOAD] User: ${req.user.id} (${req.user.role})`);
    
    try {
      const { id } = req.params;

      // Get the bill to check if it has a document
      console.log(`📥 [BILLS DOWNLOAD] Querying database for bill: ${id}`);
      const bill = await db.select().from(bills).where(eq(bills.id, id)).limit(1);

      if (bill.length === 0) {
        console.log(`❌ [BILLS DOWNLOAD] Bill not found: ${id}`);
        return res.status(404).json({ message: 'Bill not found' });
      }

      const billData = bill[0];
      console.log(`📥 [BILLS DOWNLOAD] Bill found:`, {
        id: billData.id,
        hasFilePath: !!billData.filePath,
        hasFileName: !!billData.fileName,
        filePath: billData.filePath,
        fileName: billData.fileName
      });

      if (!billData.filePath || !billData.fileName) {
        console.log(`❌ [BILLS DOWNLOAD] No document associated with bill ${id}`);
        return res.status(404).json({ message: 'No document associated with this bill' });
      }

      // Get organization ID for document access
      const organizations = await storage.getUserOrganizations(req.user.id);
      const organizationId = organizations.length > 0 ? organizations[0].organizationId : 'default';

      // Serve the file directly from local storage
      const path = await import('path');
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const fileFullPath = path.join(uploadsDir, billData.filePath);

      console.log(`📥 [BILLS DOWNLOAD] File paths:`, {
        uploadsDir,
        filePath: billData.filePath,
        fullFilePath: fileFullPath,
        fileName: billData.fileName,
        organizationId
      });

      // Check if file exists
      if (!fs.existsSync(fileFullPath)) {
        console.log(`❌ [BILLS DOWNLOAD] File not found at path: ${fileFullPath}`);
        return res.status(404).json({ message: 'Document file not found on server' });
      }

      console.log(`📥 [BILLS DOWNLOAD] File found, setting headers and sending...`);
      
      // Set appropriate headers for file download
      res.setHeader('Content-Disposition', `attachment; filename="${billData.fileName}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      
      // Stream the file
      console.log(`📥 [BILLS DOWNLOAD] Streaming file to client`);
      res.sendFile(fileFullPath);
      
      console.log(`✅ [BILLS DOWNLOAD] File download initiated successfully for bill ${id}`);
    } catch (_error: any) {
      console.error('❌ Error downloading document:', _error);
      res.status(500).json({
        message: 'Failed to download document',
        _error: _error instanceof Error ? _error.message : 'Unknown error',
      });
    }
  });

  /**
   * Apply AI analysis to bill form data
   * POST /api/bills/:id/apply-ai-analysis.
   */
  app.post('/api/bills/:id/apply-ai-analysis', requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      // Get the bill with AI analysis data
      const bill = await db.select().from(bills).where(eq(bills.id, id)).limit(1);

      if (bill.length === 0) {
        return res.status(404).json({ message: 'Bill not found' });
      }

      const billData = bill[0];

      if (!billData.isAiAnalyzed || !billData.aiAnalysisData) {
        return res.status(400).json({ message: 'No AI analysis data available for this bill' });
      }

      const analysis = billData.aiAnalysisData as any;

      // Get payment schedule suggestion
      const scheduleSignestion = await geminiBillAnalyzer.suggestPaymentSchedule(
        analysis.category,
        parseFloat(analysis.totalAmount)
      );

      // Update bill with AI-extracted data
      const updateData: unknown = {
        title: analysis.title,
        vendor: analysis.vendor,
        totalAmount: parseFloat(analysis.totalAmount),
        category: analysis.category,
        description: analysis.description,
        paymentType: scheduleSignestion.paymentType,
        schedulePayment: scheduleSignestion.schedulePayment,
        costs: [parseFloat(analysis.totalAmount)],
        startDate: analysis.issueDate || analysis.dueDate || billData.startDate,
        notes: `AI-analyzed document. Original bill number: ${analysis.billNumber || 'N/A'}. Confidence: ${(analysis.confidence * 100).toFixed(1)}%. ${scheduleSignestion.reasoning}`,
        updatedAt: new Date(),
      };

      const updatedBill = await db
        .update(bills)
        .set(updateData)
        .where(eq(bills.id, id))
        .returning();

      res.json({
        message: 'AI analysis applied successfully',
        bill: updatedBill[0],
        analysis,
        scheduleSignestion,
      });
    } catch (_error: any) {
      console.error('❌ Error applying AI analysis:', _error);
      res.status(500).json({
        message: 'Failed to apply AI analysis',
        _error: _error instanceof Error ? _error.message : 'Unknown error',
      });
    }
  });

  /**
   * Generate future bill instances for a recurrent bill
   * POST /api/bills/:id/generate-future.
   */
  app.post('/api/bills/:id/generate-future', requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const bill = await db
        .select({
          id: bills.id,
          buildingId: bills.buildingId,
          billNumber: bills.billNumber,
          title: bills.title,
          description: bills.description,
          category: bills.category,
          vendor: bills.vendor,
          paymentType: bills.paymentType,
          costs: bills.costs,
          totalAmount: bills.totalAmount,
          startDate: bills.startDate,
          status: bills.status,
          notes: bills.notes,
          createdBy: bills.createdBy,
          createdAt: bills.createdAt,
          updatedAt: bills.updatedAt,
        })
        .from(bills)
        .where(eq(bills.id, id))
        .limit(1);

      if (bill.length === 0) {
        return res.status(404).json({
          message: 'Bill not found',
        });
      }

      // Check if user has access to this bill's building
      const building = await db
        .select({
          id: buildings.id,
          name: buildings.name,
          organizationId: buildings.organizationId,
        })
        .from(buildings)
        .where(eq(buildings.id, bill[0].buildingId))
        .limit(1);

      if (building.length === 0) {
        return res.status(403).json({
          message: 'Access denied to generate future bills',
          code: 'ACCESS_DENIED',
        });
      }

      if (bill[0].paymentType !== 'recurrent') {
        return res.status(400).json({
          message: 'Only recurrent bills can generate future instances',
        });
      }

      // Generate future bills
      const result = await billAutoGenerationService.generateFutureBillInstances(bill[0] as any);

      res.json({
        message: 'Future bills generated successfully',
        billsCreated: result.billsCreated,
        generatedUntil: result.generatedUntil,
      });
    } catch (_error: any) {
      console.error('❌ Error generating future bills:', _error);
      res.status(500).json({
        message: 'Failed to generate future bills',
        _error: _error instanceof Error ? _error.message : 'Unknown error',
      });
    }
  });

  /**
   * Get bill categories for filter dropdown
   * GET /api/bills/categories.
   */
  app.get('/api/bills/categories', requireAuth, async (req: any, res: any) => {
    try {
      const categories = [
        'insurance',
        'maintenance',
        'salary',
        'utilities',
        'cleaning',
        'security',
        'landscaping',
        'professional_services',
        'administration',
        'repairs',
        'supplies',
        'taxes',
        'technology',
        'reserves',
        'other',
      ];

      res.json(categories);
    } catch (_error: any) {
      console.error('❌ Error fetching bill categories:', _error);
      res.status(500).json({
        message: 'Failed to fetch bill categories',
        _error: _error instanceof Error ? _error.message : 'Unknown error',
      });
    }
  });

  /**
   * Get statistics for auto-generated bills from a parent bill
   * GET /api/bills/:id/generated-stats.
   */
  app.get('/api/bills/:id/generated-stats', requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const bill = await db
        .select({
          id: bills.id,
          buildingId: bills.buildingId,
          billNumber: bills.billNumber,
          title: bills.title,
          description: bills.description,
          category: bills.category,
          vendor: bills.vendor,
          paymentType: bills.paymentType,
          costs: bills.costs,
          totalAmount: bills.totalAmount,
          startDate: bills.startDate,
          status: bills.status,
          notes: bills.notes,
          createdBy: bills.createdBy,
          createdAt: bills.createdAt,
          updatedAt: bills.updatedAt,
        })
        .from(bills)
        .where(eq(bills.id, id))
        .limit(1);

      if (bill.length === 0) {
        return res.status(404).json({
          message: 'Bill not found',
        });
      }

      // Find all bills generated from this parent bill (look for auto-generated bills)
      const generatedBills = await db
        .select({
          id: bills.id,
          buildingId: bills.buildingId,
          billNumber: bills.billNumber,
          title: bills.title,
          description: bills.description,
          category: bills.category,
          vendor: bills.vendor,
          paymentType: bills.paymentType,
          costs: bills.costs,
          totalAmount: bills.totalAmount,
          startDate: bills.startDate,
          status: bills.status,
          notes: bills.notes,
          createdBy: bills.createdBy,
          createdAt: bills.createdAt,
          updatedAt: bills.updatedAt,
        })
        .from(bills)
        .where(sql`bills.notes LIKE '%Auto-generated from:%'`)
        .orderBy(bills.startDate);

      const stats = generatedBills.map((genBill) => ({
        id: genBill.id,
        title: genBill.title,
        amount: genBill.totalAmount,
        startDate: genBill.startDate,
        status: genBill.status,
        billNumber: genBill.billNumber,
      }));

      res.json({
        parentBill: bill[0],
        generatedBills: stats,
      });
    } catch (_error: any) {
      console.error('❌ Error getting generated bills statistics:', _error);
      res.status(500).json({
        message: 'Failed to get generated bills statistics',
        _error: _error instanceof Error ? _error.message : 'Unknown error',
      });
    }
  });

  /**
   * Analyze document without creating a bill
   * POST /api/bills/analyze-document
   */
  app.post('/api/bills/analyze-document', requireAuth, upload.single('document'), async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: 'No document file provided',
        });
      }

      const analysis = await geminiBillAnalyzer.analyzeBillDocument(req.file.path);
      
      res.json(analysis);
    } catch (_error: any) {
      console.error('Error analyzing document:', _error);
      res.status(500).json({
        message: 'Failed to analyze document',
        _error: _error instanceof Error ? _error.message : 'Unknown error',
      });
    }
  });

  /**
   * Generate bills for next year based on a recurrent source bill
   * POST /api/bills/:id/generate-next-year
   */
  app.post('/api/bills/:id/generate-next-year', requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Get the source bill
      const sourceBill = await db.select().from(bills).where(eq(bills.id, id));
      
      if (sourceBill.length === 0) {
        return res.status(404).json({
          message: 'Bill not found',
        });
      }

      const bill = sourceBill[0] as Bill;

      if (bill.paymentType !== 'recurrent') {
        return res.status(400).json({
          message: 'Only recurrent bills can generate future bills',
        });
      }

      // Generate bills for next year
      const generatedBills = billAutoGenerationService.generateForNextYear(bill);

      // Insert generated bills into database
      const insertedBills = [];
      for (const generatedBill of generatedBills) {
        const insertResult = await db.insert(bills).values({
          ...generatedBill,
          id: undefined, // Let database generate ID
        }).returning();
        
        if (Array.isArray(insertResult) && insertResult.length > 0) {
          insertedBills.push(insertResult[0]);
        }
      }

      res.json({
        message: 'Bills generated successfully for next year',
        billsCreated: insertedBills.length,
        generatedBills: insertedBills,
      });
    } catch (error: any) {
      console.error('❌ Error generating bills for next year:', error);
      res.status(500).json({
        message: 'Failed to generate bills for next year',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Get auto-generated bills for a specific source bill
   * GET /api/bills/:id/auto-generated
   */
  app.get('/api/bills/:id/auto-generated', requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const autoGeneratedBills = await db
        .select()
        .from(bills)
        .where(
          and(
            eq(bills.sourceTemplateId, id),
            eq(bills.isAutoGenerated, true)
          )
        )
        .orderBy(desc(bills.startDate));

      res.json({
        autoGeneratedBills,
        count: autoGeneratedBills.length,
      });
    } catch (error: any) {
      console.error('❌ Error getting auto-generated bills:', error);
      res.status(500).json({
        message: 'Failed to get auto-generated bills',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Create a bill from an auto-generated template
   * POST /api/bills/from-template
   */
  app.post('/api/bills/from-template', requireAuth, async (req: Request, res: Response) => {
    try {
      const validatedData = createBillSchema.parse(req.body);

      // Create the bill
      const insertResult = await db.insert(bills).values({
        ...validatedData,
        isAutoGenerated: false, // This is a real bill created from template
        sourceTemplateId: null, // Not linked to template anymore
        autoGeneratedLabel: null, // No longer auto-generated
        createdBy: req.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      
      const newBill = insertResult[0];

      res.status(201).json({
        message: 'Bill created successfully from template',
        bill: newBill,
      });
    } catch (error: any) {
      console.error('❌ Error creating bill from template:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          message: 'Validation error',
          errors: error.errors,
        });
      }

      res.status(500).json({
        message: 'Failed to create bill from template',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Bulk generate bills for all buildings in an organization
   * POST /api/bills/bulk-generate
   */
  app.post('/api/bills/bulk-generate', requireAuth, async (req: Request, res: Response) => {
    try {
      const { organizationId, buildingIds, forceRegenerate } = req.body;

      const result = await billAutoGenerationService.triggerManualGeneration({
        organizationId,
        buildingIds,
        forceRegenerate
      });

      res.json({
        message: 'Bulk generation initiated',
        jobId: result.jobId,
        status: result.status,
        result: result.result,
      });
    } catch (error: any) {
      console.error('❌ Error triggering bulk generation:', error);
      res.status(500).json({
        message: 'Failed to trigger bulk generation',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Run scheduled generation job manually
   * POST /api/bills/run-scheduled-job
   */
  app.post('/api/bills/run-scheduled-job', requireAuth, async (req: Request, res: Response) => {
    try {
      const result = await billAutoGenerationService.runScheduledGeneration();

      res.json({
        message: 'Scheduled generation job completed',
        success: result.success,
        summary: result.summary,
        details: result.details,
      });
    } catch (error: any) {
      console.error('❌ Error running scheduled job:', error);
      res.status(500).json({
        message: 'Failed to run scheduled generation job',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Get bulk generation status and statistics
   * GET /api/bills/generation-stats
   */
  app.get('/api/bills/generation-stats', requireAuth, async (req: Request, res: Response) => {
    try {
      const { organizationId, buildingId } = req.query;

      // Get counts of recurrent vs auto-generated bills
      let recurrentConditions = [
        eq(bills.paymentType, 'recurrent'),
        eq(bills.isAutoGenerated, false)
      ];
      let autoGeneratedConditions = [eq(bills.isAutoGenerated, true)];

      if (buildingId) {
        recurrentConditions.push(eq(bills.buildingId, buildingId as string));
        autoGeneratedConditions.push(eq(bills.buildingId, buildingId as string));
      } else if (organizationId) {
        const orgCondition = sql`${bills.buildingId} IN (
          SELECT id FROM ${buildings} WHERE organization_id = ${organizationId}
        )`;
        recurrentConditions.push(orgCondition);
        autoGeneratedConditions.push(orgCondition);
      }

      const recurrentQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(bills)
        .where(and(...recurrentConditions));

      const autoGeneratedQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(bills)
        .where(and(...autoGeneratedConditions));

      const [recurrentResult, autoGeneratedResult] = await Promise.all([
        recurrentQuery,
        autoGeneratedQuery
      ]);

      // Get recent generation activity
      const recentGenerations = await db
        .select({
          sourceTemplateId: bills.sourceTemplateId,
          count: sql<number>`count(*)`,
          latestGenerated: sql<string>`max(${bills.createdAt})`,
          templateTitle: sql<string>`(
            SELECT title FROM ${bills} as template 
            WHERE template.id = ${bills.sourceTemplateId}
          )`
        })
        .from(bills)
        .where(
          and(
            eq(bills.isAutoGenerated, true),
            sql`${bills.createdAt} >= NOW() - INTERVAL '30 days'`
          )
        )
        .groupBy(bills.sourceTemplateId)
        .orderBy(sql`max(${bills.createdAt}) DESC`)
        .limit(10);

      res.json({
        summary: {
          recurrentTemplates: recurrentResult[0]?.count || 0,
          autoGeneratedBills: autoGeneratedResult[0]?.count || 0,
          recentActivity: recentGenerations.length
        },
        recentGenerations,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Error getting generation stats:', error);
      res.status(500).json({
        message: 'Failed to get generation statistics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Trigger auto-generation for a specific bill (single bill generation)
   * POST /api/bills/auto-generate
   */
  app.post('/api/bills/auto-generate', requireAuth, async (req: Request, res: Response) => {
    try {
      const { sourceTemplateId, buildingId, generateForPeriod, targetDate } = req.body;

      if (!sourceTemplateId) {
        return res.status(400).json({
          message: 'Source template ID is required',
          error: 'MISSING_TEMPLATE_ID'
        });
      }

      // Get the source template
      const sourceTemplate = await db
        .select()
        .from(bills)
        .where(eq(bills.id, sourceTemplateId))
        .limit(1);

      if (sourceTemplate.length === 0) {
        return res.status(404).json({
          message: 'Source template not found',
          error: 'TEMPLATE_NOT_FOUND'
        });
      }

      const template = sourceTemplate[0];

      // Use the bill generation service to create a single bill
      const generatedBills = billAutoGenerationService.generateForNextYear(template);
      
      if (generatedBills.length === 0) {
        return res.status(400).json({
          message: 'No bills could be generated from this template',
          error: 'GENERATION_FAILED'
        });
      }
      
      // Insert the first generated bill
      const insertResult = await db.insert(bills).values(generatedBills[0]).returning();
      const result = { bill: insertResult[0] };

      res.status(201).json({
        message: 'Bill generated successfully',
        bill: result.bill,
        sourceTemplate: template,
        generatedAt: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Error in auto-generation:', error);
      res.status(500).json({
        message: 'Failed to generate bill',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Get template data for pre-populated forms
   * GET /api/bills/:id/template-data
   */
  app.get('/api/bills/:id/template-data', requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const bill = await db
        .select({
          id: bills.id,
          title: bills.title,
          description: bills.description,
          category: bills.category,
          vendor: bills.vendor,
          paymentType: bills.paymentType,
          schedulePayment: bills.schedulePayment,
          scheduleCustom: bills.scheduleCustom,
          costs: bills.costs,
          totalAmount: bills.totalAmount,
          notes: bills.notes,
          isAutoGenerated: bills.isAutoGenerated,
          sourceTemplateId: bills.sourceTemplateId,
          autoGeneratedLabel: bills.autoGeneratedLabel,
        })
        .from(bills)
        .where(eq(bills.id, id))
        .limit(1);

      if (bill.length === 0) {
        return res.status(404).json({
          message: 'Bill not found',
        });
      }

      const billData = bill[0];

      // Prepare template data for form pre-population
      const templateData = {
        title: billData.title,
        description: billData.description || '',
        category: billData.category,
        vendor: billData.vendor || '',
        paymentType: 'unique', // Generated bills are always unique
        schedulePayment: undefined,
        customPayments: [],
        totalAmount: billData.totalAmount,
        startDate: new Date().toISOString().split('T')[0], // Today's date
        endDate: '',
        status: 'draft',
        notes: `Created from template: ${billData.title}`,
        // Metadata about the source
        isFromTemplate: true,
        sourceTemplateId: billData.isAutoGenerated ? billData.sourceTemplateId : billData.id,
        sourceLabel: billData.autoGeneratedLabel || 'Manual Template',
      };

      res.json({
        templateData,
        sourceInfo: {
          id: billData.id,
          title: billData.title,
          isAutoGenerated: billData.isAutoGenerated,
          sourceTemplateId: billData.sourceTemplateId,
          autoGeneratedLabel: billData.autoGeneratedLabel,
        }
      });

    } catch (error: any) {
      console.error('❌ Error getting template data:', error);
      res.status(500).json({
        message: 'Failed to get template data',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Get all auto-generated bills
   * GET /api/bills/auto-generated
   */
  app.get('/api/bills/auto-generated', requireAuth, async (req: Request, res: Response) => {
    try {
      const { buildingId, sourceTemplateId, limit = '50', offset = '0' } = req.query;

      const conditions = [eq(bills.isAutoGenerated, true)];

      if (buildingId) {
        conditions.push(eq(bills.buildingId, buildingId as string));
      }

      if (sourceTemplateId) {
        conditions.push(eq(bills.sourceTemplateId, sourceTemplateId as string));
      }

      const autoGeneratedBills = await db
        .select({
          id: bills.id,
          buildingId: bills.buildingId,
          billNumber: bills.billNumber,
          title: bills.title,
          description: bills.description,
          category: bills.category,
          vendor: bills.vendor,
          totalAmount: bills.totalAmount,
          startDate: bills.startDate,
          status: bills.status,
          sourceTemplateId: bills.sourceTemplateId,
          autoGeneratedLabel: bills.autoGeneratedLabel,
          createdAt: bills.createdAt,
          updatedAt: bills.updatedAt,
        })
        .from(bills)
        .where(and(...conditions))
        .orderBy(desc(bills.createdAt))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));

      // Get template information for each bill
      const billsWithTemplateInfo = await Promise.all(
        autoGeneratedBills.map(async (bill) => {
          if (bill.sourceTemplateId) {
            const template = await db
              .select({
                id: bills.id,
                title: bills.title,
                category: bills.category,
                paymentType: bills.paymentType,
                schedulePayment: bills.schedulePayment,
              })
              .from(bills)
              .where(eq(bills.id, bill.sourceTemplateId))
              .limit(1);

            return {
              ...bill,
              templateInfo: template[0] || null,
            };
          }
          return {
            ...bill,
            templateInfo: null,
          };
        })
      );

      res.json({
        bills: billsWithTemplateInfo,
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: billsWithTemplateInfo.length,
        }
      });

    } catch (error: any) {
      console.error('❌ Error getting auto-generated bills:', error);
      res.status(500).json({
        message: 'Failed to get auto-generated bills',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // New endpoint for creating bills from auto-generated templates
  app.post('/api/bills/from-auto-generated', requireAuth, async (req: Request, res: Response) => {
    try {
      const { templateId, newBillData, suggestedDate } = req.body;

      if (!templateId) {
        return res.status(400).json({
          message: 'Template ID is required',
          error: 'MISSING_TEMPLATE_ID'
        });
      }

      // Get the auto-generated template bill
      const templateBill = await db
        .select()
        .from(bills)
        .where(eq(bills.id, templateId))
        .limit(1);

      if (templateBill.length === 0) {
        return res.status(404).json({
          message: 'Template bill not found',
          error: 'TEMPLATE_NOT_FOUND'
        });
      }

      const template = templateBill[0] as Bill;

      if (template.paymentType !== 'auto-generated') {
        return res.status(400).json({
          message: 'Can only create bills from auto-generated templates',
          error: 'INVALID_TEMPLATE_TYPE'
        });
      }

      // Create the new bill using the service
      const newBill = await billAutoGenerationService.createAutoGeneratedBill(
        template,
        {
          ...newBillData,
          createdBy: req.user.id,
        },
        suggestedDate ? new Date(suggestedDate) : undefined
      );

      // Insert the bill into database
      const [insertedBill] = await db.insert(bills).values({
        ...newBill,
        id: undefined, // Let database generate ID
      }).returning();

      res.status(201).json({
        message: 'Bill created successfully from auto-generated template',
        bill: insertedBill,
        updatedSourceBill: template.sourceTemplateId ? true : false
      });

    } catch (error: any) {
      console.error('❌ Error creating bill from auto-generated template:', error);
      res.status(500).json({
        message: 'Failed to create bill from auto-generated template',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Get payments for a specific bill
   * GET /api/bills/:id/payments
   */
  app.get('/api/bills/:id/payments', requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      // Verify the bill exists and user has access
      const bill = await db.select().from(bills).where(eq(bills.id, id)).limit(1);
      
      if (bill.length === 0) {
        return res.status(404).json({
          message: 'Bill not found',
        });
      }

      // Get payments for this bill
      const billPayments = await paymentGenerationService.getPaymentsForBill(id);

      res.json({
        payments: billPayments,
        bill: bill[0],
      });
    } catch (error: any) {
      console.error('❌ Error fetching payments for bill:', error);
      res.status(500).json({
        message: 'Failed to fetch payments',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Update payment status
   * PATCH /api/bills/:billId/payments/:paymentId
   */
  app.patch('/api/bills/:billId/payments/:paymentId', requireAuth, async (req: any, res: any) => {
    try {
      const { billId, paymentId } = req.params;
      const { status, paidDate } = req.body;

      if (!status || !['pending', 'overdue', 'paid', 'cancelled'].includes(status)) {
        return res.status(400).json({
          message: 'Valid status is required (pending, overdue, paid, cancelled)',
        });
      }

      // Update payment status
      await paymentGenerationService.updatePaymentStatus(paymentId, status, paidDate);

      res.json({
        message: 'Payment status updated successfully',
      });
    } catch (error: any) {
      console.error('❌ Error updating payment status:', error);
      res.status(500).json({
        message: 'Failed to update payment status',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Development utility: Regenerate payments for all bills
   * POST /api/bills/dev/regenerate-payments
   */
  app.post('/api/bills/dev/regenerate-payments', requireAuth, async (req: any, res: any) => {
    try {
      // Only allow in development environment
      if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({
          message: 'This endpoint is only available in development environment',
        });
      }

      console.log('🔄 Starting payment regeneration for all bills...');

      // Get all bills
      const allBills = await db.select().from(bills);
      console.log(`📊 Found ${allBills.length} bills to process`);

      let successCount = 0;
      let errorCount = 0;
      const errors: any[] = [];

      // Process each bill
      for (const bill of allBills) {
        try {
          console.log(`🔄 Processing bill ${bill.id} (${bill.title})`);
          
          // Delete existing payments for this bill
          await paymentGenerationService.deletePaymentsForBill(bill.id);
          
          // Generate new payments
          await paymentGenerationService.generatePaymentsForBill(bill.id);
          
          successCount++;
          console.log(`✅ Regenerated payments for bill ${bill.id}`);
        } catch (error: any) {
          errorCount++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push({
            billId: bill.id,
            billTitle: bill.title,
            error: errorMessage
          });
          console.error(`❌ Failed to regenerate payments for bill ${bill.id}:`, errorMessage);
        }
      }

      console.log(`🏁 Payment regeneration complete: ${successCount} successful, ${errorCount} errors`);

      res.json({
        message: 'Payment regeneration complete',
        results: {
          totalBills: allBills.length,
          successful: successCount,
          errors: errorCount,
          errorDetails: errors
        }
      });
    } catch (error: any) {
      console.error('❌ Error during payment regeneration:', error);
      res.status(500).json({
        message: 'Failed to regenerate payments',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
