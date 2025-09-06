import type { Express, Request, Response } from 'express';
import { eq, desc, and, sql, isNull } from 'drizzle-orm';
import { db } from '../db';
import { requireAuth } from '../auth';
import { storage } from '../storage';
import { z } from 'zod';
import { moneyFlowJob } from '../jobs/money_flow_job';
import { billGenerationService } from '../services/bill-generation-service';
import { delayedUpdateService } from '../services/delayed-update-service';
import { geminiBillAnalyzer } from '../services/gemini-bill-analyzer';
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
  paymentType: z.enum(['unique', 'recurrent']),
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
   * Get all bills with optional filtering
   * GET /api/bills?buildingId=uuid&category=insurance&year=2024&status=draft&months=1,3,6.
   */
  app.get('/api/bills', requireAuth, async (req: any, res: any) => {
    try {
      const { buildingId, category, year, status = 'all', months } = req.query;

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
      console.log('💰 [SERVER DEBUG] Creating new bill with data:', req.body);
      const validation = createBillSchema.safeParse(req.body);

      if (!validation.success) {
        console.error('❌ [SERVER DEBUG] Bill validation failed:', validation.error.issues);
        return res.status(400).json({
          message: 'Invalid bill data',
          errors: validation.error.issues,
        });
      }

      const billData = validation.data;
      console.log('✅ [SERVER DEBUG] Bill validation successful:', billData);

      console.log('📝 [SERVER DEBUG] Inserting bill into database...');
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
          endDate: billData.endDate,
          status: billData.status,
          notes: billData.notes,
          createdBy: req.user.id,
        })
        .returning();
      
      console.log('🎉 [SERVER DEBUG] Bill created successfully:', newBill[0]);

      // Schedule delayed money flow and budget update for the new bill
      try {
        delayedUpdateService.scheduleBillUpdate(newBill[0].id);
      } catch (schedulingError) {
        console.warn('⚠️ Failed to schedule bill update:', schedulingError);
        // Don't fail the bill creation if scheduling fails
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

      const updateData: unknown = {};
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

      const updateData: unknown = {};
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

      // Schedule delayed money flow and budget update for the updated bill
      try {
        delayedUpdateService.scheduleBillUpdate(id);
      } catch (schedulingError) {
        console.warn('⚠️ Failed to schedule bill update:', schedulingError);
        // Don't fail the bill update if scheduling fails
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

      const deletedBill = await db.delete(bills).where(eq(bills.id, id)).returning();

      if (deletedBill.length === 0) {
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
      try {
        console.log('📤 [SERVER DEBUG] Document upload started for bill ID:', req.params.id);
        console.log('📋 [SERVER DEBUG] File info:', req.file ? {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          path: req.file.path
        } : 'No file');
        
        const { id } = req.params;

        if (!req.file) {
          console.error('❌ [SERVER DEBUG] No file uploaded');
          return res.status(400).json({ message: 'No file uploaded' });
        }

        // Get organization ID for document organization
        const organizations = await storage.getUserOrganizations(req.user.id);
        const organizationId =
          organizations.length > 0 ? organizations[0].organizationId : 'default';

        // Note: File upload to external storage removed

        // Create document path in the expected format
        const documentPath = `prod_org_${organizationId}/${req.file.originalname}`;

        // Analyze document with Gemini AI (only for images)
        let analysisResult = null;
        if (req.file.mimetype.startsWith('image/')) {
          console.log('🤖 [SERVER DEBUG] Starting AI analysis for image file...');
          try {
            analysisResult = await geminiBillAnalyzer.analyzeBillDocument(req.file.path);
            console.log('✅ [SERVER DEBUG] AI analysis completed successfully:', analysisResult);
          } catch (aiError) {
            console.error('❌ [SERVER DEBUG] AI analysis failed:', aiError);
            console.warn('⚠️ AI analysis failed, continuing without analysis:', aiError);
            // Continue without AI analysis
          }
        } else {
          console.log('📄 [SERVER DEBUG] File is not an image, skipping AI analysis. MIME type:', req.file.mimetype);
        }

        // Update bill with document info and AI analysis
        console.log('📏 [SERVER DEBUG] Updating bill with document info and AI analysis...');
        const updateData: unknown = {
          documentPath,
          documentName: req.file.originalname,
          isAiAnalyzed: !!analysisResult,
          aiAnalysisData: analysisResult,
          updatedAt: new Date(),
        };
        console.log('📊 [SERVER DEBUG] Update data:', updateData);

        const updatedBill = await db
          .update(bills)
          .set(updateData)
          .where(eq(bills.id, id))
          .returning();
        
        console.log('✅ [SERVER DEBUG] Bill updated successfully:', updatedBill[0]);

        // Clean up temporary file
        console.log('🗑️ [SERVER DEBUG] Cleaning up temporary file:', req.file.path);
        fs.unlinkSync(req.file.path);

        const response = {
          message: 'Document uploaded and analyzed successfully',
          bill: updatedBill[0],
          analysisResult,
        };
        console.log('🎉 [SERVER DEBUG] Sending successful response:', response);
        res.json(response);
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
    try {
      console.log('📱 [SERVER DEBUG] Document download requested for bill ID:', req.params.id);
      const { id } = req.params;

      // Get the bill to check if it has a document
      const bill = await db.select().from(bills).where(eq(bills.id, id)).limit(1);

      if (bill.length === 0) {
        console.error('❌ [SERVER DEBUG] Bill not found for document download:', id);
        return res.status(404).json({ message: 'Bill not found' });
      }

      const billData = bill[0];
      console.log('📄 [SERVER DEBUG] Bill found for document download:', {
        id: billData.id,
        documentPath: billData.documentPath,
        documentName: billData.documentName,
        hasDocument: !!(billData.documentPath && billData.documentName)
      });

      if (!billData.documentPath || !billData.documentName) {
        console.error('❌ [SERVER DEBUG] No document associated with this bill:', id);
        return res.status(404).json({ message: 'No document associated with this bill' });
      }

      // Get organization ID for document access
      const organizations = await storage.getUserOrganizations(req.user.id);
      const organizationId = organizations.length > 0 ? organizations[0].organizationId : 'default';

      // Document download functionality removed (no external storage)
      res.status(404).json({
        message: 'Document download functionality has been disabled',
      });
    } catch (_error: any) {
      console.error('❌ Error downloading document:', _error);
      res.status(500).json({
        message: 'Failed to generate document download URL',
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
      const result = await billGenerationService.generateFutureBillInstances(bill[0] as any);

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
}
