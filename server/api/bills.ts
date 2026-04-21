import type { Express, Request, Response } from 'express';
import type { Bill } from '@shared/schema';
import { eq, desc, and, sql, isNull, isNotNull, or, ilike, exists, inArray, asc, gte, lte } from 'drizzle-orm';
import { db } from '../db';
import { requireAuth } from '../auth';
import { storage } from '../storage';
import { z } from 'zod';
import { moneyFlowJob } from '../jobs/money_flow_job';
import { financialService } from '../services/consolidated-financial-service';
import { aiService } from '../services/consolidated-ai-service';
import { billAutoGenerationService } from '../services/bill-generation-service';
import { paymentGenerationService } from '../services/payment-generation-service';
import { uploadInvoiceFile, handleUploadError } from '../middleware/fileUpload';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as schema from '@shared/schema';
import { secureFileStorage } from '../services/secure-file-storage';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { normalizeFilename } from '../utils/filenameNormalization';
import { documentService } from '../services/document-service';
import { logDebug, logInfo, logWarn, logError } from '../utils/logger';
import { getBillById, getBillWithPayments, getBillsWithPayments, getEffectiveBillType } from '../db/queries/bills-queries';

// Secure filename sanitization function
function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Invalid filename provided');
  }
  
  // Remove path traversal sequences and dangerous characters
  let sanitized = filename.replace(/\.\.[\\\/]/g, ''); // Remove ../ and ..\
  sanitized = sanitized.replace(/[\\\/]/g, '_'); // Replace slashes with underscores
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_'); // Only allow safe characters
  
  // Ensure reasonable length
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized);
    const name = path.basename(sanitized, ext).substring(0, 200);
    sanitized = name + ext;
  }
  
  // Ensure it's not empty
  if (!sanitized || sanitized === '.' || sanitized === '_') {
    sanitized = 'file_' + crypto.randomUUID().substring(0, 8);
  }
  
  return sanitized;
}

// Generate secure random filename
function generateSecureFilename(originalName: string): string {
  const sanitizedName = sanitizeFilename(originalName);
  const ext = path.extname(sanitizedName);
  const baseName = path.basename(sanitizedName, ext);
  const secureId = crypto.randomUUID();
  return `${baseName}_${secureId}${ext}`;
}

/**
 * @deprecated Use documentService.buildHierarchicalPath() instead.
 * This function is kept for backward compatibility but will be removed in a future version.
 * 
 * Migration example:
 * ```typescript
 * // Instead of:
 * const path = await buildBillHierarchicalPath({ organizationId, buildingId, billId, originalFilename });
 * 
 * // Use:
 * const path = documentService.buildHierarchicalPath({
 *   type: 'bills',
 *   buildingId: buildingId,
 *   entityId: billId,
 * }, originalFilename);
 * ```
 */
async function buildBillHierarchicalPath(params: {
  organizationId: string;
  buildingId: string;
  billId: string;
  originalFilename: string;
}): Promise<string> {
  const { organizationId, buildingId, billId, originalFilename } = params;
  
  const uuid = uuidv4();
  const normalizedName = normalizeFilename(originalFilename);
  const filename = `${uuid}_${normalizedName}`;
  
  return `buildings/${buildingId}/bills/${filename}`;
}

import { getUploadConfig, type UploadContext } from '@shared/config/upload-config';
import { BILL_CATEGORIES } from '@shared/schemas/financial';

import { asyncHandler } from '../utils/async-handler';
const { buildings, bills, documents, payments, userBuildings, residences, userResidences } = schema;

// Helper function to check user access to building
async function checkBuildingAccess(userId: string, buildingId: string, userRole: string): Promise<boolean> {
  if (userRole === 'admin') {
    return true;
  }
  
  if (userRole === 'manager') {
    const result = await db
      .select({ buildingId: userBuildings.buildingId })
      .from(userBuildings)
      .where(and(
        eq(userBuildings.buildingId, buildingId),
        eq(userBuildings.userId, userId),
        eq(userBuildings.isActive, true)
      ))
      .limit(1);
    
    return result.length > 0;
  }
  
  if (userRole === 'resident') {
    // Check if user has a residence in this building
    const result = await db
      .select({ buildingId: residences.buildingId })
      .from(residences)
      .innerJoin(userResidences, eq(residences.id, userResidences.residenceId))
      .where(and(
        eq(residences.buildingId, buildingId),
        eq(userResidences.userId, userId),
        eq(userResidences.isActive, true)
      ))
      .limit(1);
    
    return result.length > 0;
  }
  
  // Demo roles get VIEW-ONLY access via residence check
  // demo_manager, demo_resident, and demo_tenant can view bills for buildings they have residence in
  if (userRole === 'demo_manager' || userRole === 'demo_resident' || userRole === 'demo_tenant') {
    const result = await db
      .select({ buildingId: residences.buildingId })
      .from(residences)
      .innerJoin(userResidences, eq(residences.id, userResidences.residenceId))
      .where(and(
        eq(residences.buildingId, buildingId),
        eq(userResidences.userId, userId),
        eq(userResidences.isActive, true)
      ))
      .limit(1);
    
    return result.length > 0;
  }
  
  return false;
}

// Database-driven bills - no more mock data

// Helper function to check if a role is a demo role (view-only access)
function isDemoRole(role: string): boolean {
  return role === 'demo_manager' || role === 'demo_resident' || role === 'demo_tenant';
}

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
  category: z.enum(BILL_CATEGORIES),
  vendor: z.string().optional(),
  
  // New fields for proper bill type and payment structure separation
  billType: z.enum(['unique', 'recurrent']).optional(), // Whether this is a one-time or repeating bill
  paymentStructure: z.enum(['single', 'installment']).optional(), // How payments are structured
  
  // Legacy field kept for backward compatibility
  paymentType: z.enum(['unique', 'recurrent']).optional(), // DEPRECATED - use billType instead
  
  schedulePayment: z.enum(['weekly', 'monthly', 'quarterly', 'yearly', 'custom']).nullable().optional(),
  yearInterval: z.number().int().min(1).max(99).optional().default(1),
  scheduleCustom: z.array(z.string()).optional(),
  costs: z.array(z.string()),
  totalAmount: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  status: z.enum(['draft', 'sent', 'overdue', 'paid', 'cancelled']),
  autoGenerateNextYear: z.boolean().optional().default(false),
});

const updateBillSchema = createBillSchema.partial().extend({
  // Allow these fields to be updated when converting auto-generated bill to normal bill
  isAutoGenerated: z.boolean().optional(),
  sourceTemplateId: z.string().uuid().nullable().optional(),
  autoGeneratedLabel: z.string().nullable().optional(),
});

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

// Magic number validation for file type verification
function validateFileByMagicNumbers(fileBuffer: Buffer, declaredMimeType: string): boolean {
  if (!fileBuffer || fileBuffer.length < 4) return false;
  
  const magicNumbers = fileBuffer.slice(0, 8);
  const validMagicNumbers = {
    'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
    'image/jpeg': [0xFF, 0xD8, 0xFF], // JPEG
    'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG
    'image/gif': [0x47, 0x49, 0x46], // GIF
  };
  
  const expectedMagic = validMagicNumbers[declaredMimeType as keyof typeof validMagicNumbers];
  if (!expectedMagic) return false;
  
  return expectedMagic.every((byte, index) => magicNumbers[index] === byte);
}

// Configure multer for file uploads with enhanced security
const billStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use /tmp/uploads for persistent storage in Replit
    const uploadDir = path.join('/tmp', 'uploads', 'bills');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `bill-${uniqueSuffix}-${sanitizedName}`);
  }
});

const upload = multer({
  storage: billStorage,
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
 * Helper function to detect if payment structure has changed
 * Returns true if payment-related fields have changed that require payment regeneration
 */
function hasPaymentStructureChanged(originalBill: any, updateData: any): boolean {
  // Payment structure fields that trigger regeneration
  // Include both new fields (billType, paymentStructure) and legacy fields for backward compatibility
  const paymentFields = [
    'billType',          // New: determines if bill is unique or recurrent
    'paymentStructure',  // New: determines if payment is single or installment
    'paymentType',       // Legacy: for backward compatibility
    'schedulePayment', 
    'totalAmount',
    'startDate',
    'endDate',
    'costs',
    'yearInterval',
  ];

  // Check if any critical payment fields have changed
  for (const field of paymentFields) {
    if (updateData[field] !== undefined) {
      // Convert values to strings for comparison to handle type differences
      const originalValue = String(originalBill[field] || '');
      const newValue = String(updateData[field] || '');
      
      if (originalValue !== newValue) {
        return true;
      }
    }
  }

  // Check if costs array has changed (payment amounts)
  if (updateData.costs !== undefined) {
    const originalCosts = originalBill.costs || [];
    const newCosts = updateData.costs || [];
    
    // Compare array lengths first
    if (originalCosts.length !== newCosts.length) {
      return true;
    }
    
    // Compare each cost value
    for (let i = 0; i < originalCosts.length; i++) {
      const originalCost = Number(originalCosts[i]);
      const newCost = Number(newCosts[i]);
      
      if (Math.abs(originalCost - newCost) > 0.01) { // Account for floating point precision
        return true;
      }
    }
  }

  // Check if custom schedule has changed
  if (updateData.scheduleCustom !== undefined) {
    const originalSchedule = originalBill.scheduleCustom || [];
    const newSchedule = updateData.scheduleCustom || [];
    
    if (originalSchedule.length !== newSchedule.length) {
      return true;
    }
    
    for (let i = 0; i < originalSchedule.length; i++) {
      if (originalSchedule[i] !== newSchedule[i]) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calculate fiscal start year for a given date based on the fiscal year start date.
 * If the date is before the fiscal year start, it belongs to the previous fiscal year.
 * 
 * @param date - The date string (ISO format: YYYY-MM-DD) or null
 * @param fiscalStart - The fiscal year start date string (ISO format: YYYY-MM-DD) or null for calendar year
 * @returns The fiscal start year, or null if the date is invalid
 * 
 * @example
 * // Building with fiscal year starting April 1
 * calculateFiscalStartYear("2025-01-15", "2024-04-01") // Returns 2024 (FY 2024)
 * calculateFiscalStartYear("2025-06-01", "2024-04-01") // Returns 2025 (FY 2025)
 * 
 * // Building with fiscal year starting July 1
 * calculateFiscalStartYear("2025-01-15", "2024-07-01") // Returns 2024 (FY 2024)
 * calculateFiscalStartYear("2025-08-01", "2024-07-01") // Returns 2025 (FY 2025)
 * 
 * // Building with calendar year (null fiscal start)
 * calculateFiscalStartYear("2025-01-15", null) // Returns 2025
 * 
 * // Invalid dates
 * calculateFiscalStartYear(null, null) // Returns null
 * calculateFiscalStartYear("invalid-date", null) // Returns null
 */
function calculateFiscalStartYear(date: string | null, fiscalStart: string | null): number | null {
  // Guard against null/undefined dates
  if (!date) return null;
  
  const paymentDate = new Date(date);
  
  // Guard against invalid dates
  if (isNaN(paymentDate.getTime())) return null;
  
  const paymentYear = paymentDate.getFullYear();
  const paymentMonth = paymentDate.getMonth() + 1; // JavaScript months are 0-indexed
  const paymentDay = paymentDate.getDate();
  
  // If no fiscal year start is defined, use calendar year
  if (!fiscalStart) {
    return paymentYear;
  }
  
  try {
    // Parse fiscal year start month and day with defensive parsing
    const parts = fiscalStart.split('-').map(Number);
    
    // Validate we have enough parts and they're valid numbers
    if (parts.length < 3 || parts.some(isNaN)) {
      logWarn('[BILLS API] Invalid fiscalStart format in calculateFiscalStartYear, using calendar year', { metadata: { fiscalStart } });
      return paymentYear;
    }
    
    const [, fiscalMonth, fiscalDay] = parts;
    
    // Validate month and day are reasonable
    if (fiscalMonth < 1 || fiscalMonth > 12 || fiscalDay < 1 || fiscalDay > 31) {
      logWarn('[BILLS API] Invalid month/day in fiscalStart, using calendar year', { metadata: { fiscalMonth, fiscalDay } });
      return paymentYear;
    }
    
    // If payment is before the fiscal year start date, it belongs to the previous fiscal year
    if (paymentMonth < fiscalMonth || (paymentMonth === fiscalMonth && paymentDay < fiscalDay)) {
      return paymentYear - 1;
    }
    
    return paymentYear;
  } catch (error) {
    logError('[BILLS API] Error parsing fiscalStart in calculateFiscalStartYear', error);
    // Fall back to calendar year on any error
    return paymentYear;
  }
}

/**
 *
 * @param app
 */
/**
 * Normalize file path by removing leading slashes and 'uploads/' prefix if present
 */
function normalizeFilePath(filePath: string): string {
  // Remove leading slashes
  let normalized = filePath.replace(/^\/+/, '');
  
  // Remove 'uploads/' prefix if present to avoid duplication
  if (normalized.startsWith('uploads/')) {
    normalized = normalized.substring('uploads/'.length);
  }
  
  return normalized;
}

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


      try {
        // Validate file upload
        if (!req.file) {
          return res.status(400).json({
            error: 'No file uploaded',
            message: 'Please upload a bill file',
            code: 'NO_FILE'
          });
        }

        const { buffer, mimetype, originalname, size } = req.file;
        const language = req.body.language || 'en'; // Get language from request, default to 'en'
        

        // Call AI service for bill extraction
        const extractedData = await aiService.extractBillData(buffer, mimetype, language);
        

        // Return successful response with actual confidence from AI extraction
        res.status(200).json({
          success: true,
          data: extractedData,
          metadata: {
            confidence: extractedData.overallConfidence || 0.9,
            processingTime: Date.now() - startTime,
            filename: originalname,
            fileSize: size
          }
        });

      } catch (error: any) {
        logError('[BILL EXTRACT] Error during extraction', error);
        
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
        } else if (error.message?.includes('GEMINI_API_KEY') || error.message?.includes('AI service is not available')) {
          return res.status(500).json({
            error: 'AI service configuration error',
            message: 'AI extraction service is temporarily unavailable. Please check API key configuration.',
            code: 'GEMINI_API_ERROR'
          });
        } else if (
          error.message?.includes('429') || 
          error.message?.includes('RATE_LIMIT') || 
          error.message?.includes('rate limit') ||
          error.message?.includes('quota') ||
          error.message?.includes('too many requests') ||
          error.status === 429
        ) {
          return res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'The AI service is temporarily busy. Please wait a moment and try again.',
            code: 'AI_RATE_LIMIT',
            retryAfter: 60
          });
        } else if (
          error.message?.includes('503') ||
          error.message?.includes('overloaded') ||
          error.message?.includes('temporarily unavailable')
        ) {
          return res.status(503).json({
            error: 'Service temporarily unavailable',
            message: 'The AI service is experiencing high demand. Please try again in a few minutes.',
            code: 'AI_SERVICE_BUSY',
            retryAfter: 120
          });
        }

        // Generic error response
        res.status(500).json({
          error: 'Extraction failed',
          message: 'Failed to extract bill data. Please try again.',
          code: 'EXTRACTION_ERROR',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    }
  );

  /**
   * Get year range (min/max years) for bills in a building
   * GET /api/bills/year-range?buildingId=uuid
   * 
   * This endpoint calculates the fiscal year range from ALL bills in a building,
   * including both bills with payments and bills without payments.
   * 
   * For bills with payments: Uses payment scheduled dates
   * For bills without payments: Uses bill startDate as fallback
   */
  app.get('/api/bills/year-range', requireAuth, async (req: any, res: any) => {
    try {
      const { buildingId } = req.query;

      if (!buildingId) {
        return res.status(400).json({ error: 'Building ID is required' });
      }

      // 1. Fetch building's financialYearStart
      const buildingResult = await db
        .select({ financialYearStart: buildings.financialYearStart })
        .from(buildings)
        .where(eq(buildings.id, buildingId))
        .limit(1);

      if (!buildingResult || buildingResult.length === 0) {
        return res.status(404).json({ error: 'Building not found' });
      }

      const financialYearStart = buildingResult[0].financialYearStart;

      // 2. Fetch all bills with their payments using LEFT JOIN
      // This ensures we get ALL bills, whether they have payments or not
      const allBills = await db
        .select({
          billId: bills.id,
          billStartDate: bills.startDate,
          paymentScheduledDate: payments.scheduledDate
        })
        .from(bills)
        .leftJoin(payments, eq(bills.id, payments.billId))
        .where(eq(bills.buildingId, buildingId));

      // 3. Group by bill to identify bills with/without payments
      const billMap = new Map<string, { startDate: string | null, paymentDates: string[] }>();
      
      for (const row of allBills) {
        if (!billMap.has(row.billId)) {
          billMap.set(row.billId, { startDate: row.billStartDate, paymentDates: [] });
        }
        if (row.paymentScheduledDate) {
          billMap.get(row.billId)!.paymentDates.push(row.paymentScheduledDate);
        }
      }

      // 4. Calculate fiscal years for all bills
      const allFiscalYears: number[] = [];
      
      for (const [billId, data] of billMap) {
        if (data.paymentDates.length > 0) {
          // Bill has payments - use payment dates
          for (const paymentDate of data.paymentDates) {
            const fiscalYear = calculateFiscalStartYear(paymentDate, financialYearStart);
            if (fiscalYear !== null) {
              allFiscalYears.push(fiscalYear);
            }
          }
        } else {
          // Bill has no payments - use bill startDate if valid
          if (data.startDate) {
            const fiscalYear = calculateFiscalStartYear(data.startDate, financialYearStart);
            if (fiscalYear !== null) {
              allFiscalYears.push(fiscalYear);
            }
          } else {
            // Log when bills are skipped due to missing dates
            logWarn('Bill has no startDate and no payments - skipping from year range', { metadata: { billId } });
          }
        }
      }

      // 5. Handle empty case
      if (allFiscalYears.length === 0) {
        const currentYear = new Date().getFullYear();
        return res.json({ 
          minYear: currentYear, 
          maxYear: currentYear, 
          count: 0, 
          hasBills: false 
        });
      }

      // 6. Calculate min/max
      const minYear = Math.min(...allFiscalYears);
      const maxYear = Math.max(...allFiscalYears);

      res.json({
        minYear,
        maxYear,
        count: billMap.size,
        hasBills: true
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch year range' });
    }
  });

  /**
   * Get all bills with optional filtering
   * GET /api/bills?buildingId=uuid&category=insurance&year=2024&status=draft&months=1,3,6&billType=unique&paymentStructure=single&vendor=Acme.
   */
  app.get('/api/bills', requireAuth, async (req: any, res: any) => {
    try {
      const { buildingId, category, year, status = 'all', months, paymentType, billType, paymentStructure, vendor, isAutoGenerated, search } = req.query;

      logDebug('[BILLS API] Fetching bills with params', { metadata: { buildingId, category, year, status, months, paymentType, billType, paymentStructure, vendor, isAutoGenerated, search } });

      // Build the WHERE conditions
      const conditions = [];
      
      // Track year range for use in month filter
      let yearStartDate: string | null = null;
      let yearEndDate: string | null = null;

      if (buildingId && buildingId !== 'all') {
        conditions.push(eq(bills.buildingId, buildingId));
      }

      if (category && category !== 'all') {
        conditions.push(eq(bills.category, category));
      }

      if (year) {
        try {
          // Parse year parameter to handle both formats:
          // - Single year: "2024" (calendar year)
          // - Financial year label: "2024-2025" (fiscal year)
          let yearInt: number;
          if (year.includes('-')) {
            // Extract start year from financial year label (e.g., "2024-2025" -> 2024)
            yearInt = parseInt(year.split('-')[0]);
          } else {
            yearInt = parseInt(year);
          }
          
          if (!isNaN(yearInt)) {
            // Fetch building's financialYearStart to calculate financial year boundaries
            let financialYearStartDate: string | null = null;
            
            if (buildingId && buildingId !== 'all') {
              const building = await db
                .select({ financialYearStart: buildings.financialYearStart })
                .from(buildings)
                .where(eq(buildings.id, buildingId))
                .limit(1);
              
              if (building[0]?.financialYearStart) {
                financialYearStartDate = building[0].financialYearStart;
              }
              logDebug('[BILLS API] Building financial year start', { metadata: { financialYearStartDate } });
            }
            
            if (financialYearStartDate) {
              try {
                // Extract month and day from the date string (e.g., "2024-04-01" -> month: 4, day: 1)
                const parts = financialYearStartDate.split('-').map(Number);
                
                // Validate we have enough parts (should be [year, month, day])
                if (parts.length >= 3 && !parts.some(isNaN)) {
                  const [, startMonth, startDay] = parts;
                  
                  // Validate month and day are reasonable
                  if (startMonth >= 1 && startMonth <= 12 && startDay >= 1 && startDay <= 31) {
                    // Calculate financial year start and end dates
                    // For FY 2024 with start date April 1: 2024-04-01 to 2025-03-31
                    const fyStart = new Date(yearInt, startMonth - 1, startDay);
                    const fyEnd = new Date(yearInt + 1, startMonth - 1, startDay - 1);
                    
                    yearStartDate = fyStart.toISOString().split('T')[0];
                    yearEndDate = fyEnd.toISOString().split('T')[0];
                  } else {
                    logWarn('[BILLS API] Invalid month/day in financialYearStart, using calendar year', { metadata: { startMonth, startDay } });
                    // Fall back to calendar year
                    yearStartDate = `${yearInt}-01-01`;
                    yearEndDate = `${yearInt}-12-31`;
                  }
                } else {
                  logWarn('[BILLS API] Invalid financialYearStart format, using calendar year', { metadata: { financialYearStartDate } });
                  // Fall back to calendar year
                  yearStartDate = `${yearInt}-01-01`;
                  yearEndDate = `${yearInt}-12-31`;
                }
              } catch (parseError: any) {
                logError('[BILLS API] Error parsing financialYearStart', parseError);
                // Fall back to calendar year on any parsing error
                yearStartDate = `${yearInt}-01-01`;
                yearEndDate = `${yearInt}-12-31`;
              }
            } else {
              // Default to calendar year (Jan 1 to Dec 31)
              yearStartDate = `${yearInt}-01-01`;
              yearEndDate = `${yearInt}-12-31`;
            }
            
            logDebug('[BILLS API] Year filter', { metadata: { yearInt, yearStartDate, yearEndDate } });
            
            // When filtering by year, show bills that either:
            // 1. Have at least one payment in the fiscal year, OR
            // 2. Have a startDate within the fiscal year (for recurring bills with single payment), OR
            // 3. Are parent bills with split children that have payments in the fiscal year
            // This ensures proper filtering for both payment-based and bill-based fiscal year tracking
            conditions.push(
              or(
                // Option 1: Bill has payments in the fiscal year
                exists(
                  db
                    .select({ id: payments.id })
                    .from(payments)
                    .where(
                      and(
                        eq(payments.billId, bills.id),
                        gte(payments.scheduledDate, yearStartDate),
                        lte(payments.scheduledDate, yearEndDate)
                      )
                    )
                ),
                // Option 2: Bill's startDate falls within the fiscal year
                and(
                  gte(bills.startDate, yearStartDate),
                  lte(bills.startDate, yearEndDate)
                ),
                // Option 3: Bill is a parent with split children that have payments in the fiscal year
                exists(
                  db
                    .select({ id: sql`1` })
                    .from(schema.bills)
                    .innerJoin(schema.payments, eq(schema.payments.billId, schema.bills.id))
                    .where(
                      and(
                        eq(schema.bills.parentBillId, bills.id),
                        gte(schema.payments.scheduledDate, yearStartDate),
                        lte(schema.payments.scheduledDate, yearEndDate)
                      )
                    )
                )
              )
            );
          }
        } catch (yearError: any) {
          logError('[BILLS API] Error processing year filter', yearError);
          throw new Error(`Failed to process year filter: ${yearError.message}`);
        }
      }

      if (status && status !== 'all') {
        conditions.push(eq(bills.status, status));
      }

      if (months) {
        const monthNumbers = months.split(',').map((m: string) => parseInt(m.trim())).filter((m: number) => !isNaN(m) && m >= 1 && m <= 12);
        if (monthNumbers.length > 0) {
          // Filter bills that have at least one payment in the selected months
          // If year filter is active, also constrain payments to be within that year range
          const monthConditions = monthNumbers.map(
            (month: number) => sql`EXTRACT(MONTH FROM ${payments.scheduledDate}) = ${month}`
          );
          
          // Build payment conditions: must match month AND (if year filter active) be within year range
          const paymentConditions = [
            eq(payments.billId, bills.id),
            sql`(${sql.join(monthConditions, sql` OR `)})`
          ];
          
          // Add year range constraints if year filter is active
          if (yearStartDate && yearEndDate) {
            paymentConditions.push(gte(payments.scheduledDate, yearStartDate));
            paymentConditions.push(lte(payments.scheduledDate, yearEndDate));
          }
          
          conditions.push(
            exists(
              db
                .select({ id: payments.id })
                .from(payments)
                .where(and(...paymentConditions))
            )
          );
        }
      }

      if (paymentType && paymentType !== 'all') {
        conditions.push(eq(bills.paymentType, paymentType));
      }

      // New filters for billType and paymentStructure
      if (billType && billType !== 'all') {
        conditions.push(eq(bills.billType, billType));
      }

      if (paymentStructure && paymentStructure !== 'all') {
        conditions.push(eq(bills.paymentStructure, paymentStructure));
      }

      // Vendor filter - exact match or contains search
      if (vendor && vendor.trim()) {
        const vendorTerm = `%${vendor.trim()}%`;
        conditions.push(ilike(bills.vendor, vendorTerm));
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
          ilike(sql`${bills.category}::text`, searchTerm) // Cast enum to text for search
        );
        conditions.push(searchConditions);
      }

      // Note: Parent bills are now included in the bill list to provide context for fiscal year splits
      // Users can see both the parent bill and its fiscal year split children

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const billsWithPayments = await getBillsWithPayments(whereClause);

      res.json(billsWithPayments);
    } catch (_error: any) {
      logError('[BILLS API] Error fetching bills', _error);
      res.status(500).json({
        message: 'Failed to fetch bills',
        error: _error instanceof Error ? _error.message : 'Unknown error',
        details: process.env.NODE_ENV === 'production' ? undefined : _error.stack,
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

      const result = await getBillWithPayments(id);

      if (!result) {
        return res.status(404).json({
          message: 'Bill not found',
        });
      }

      res.json({ ...result.bill, payments: result.payments });
    } catch (_error: any) {
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
      // Block demo users from creating bills (view-only access)
      if (isDemoRole(req.user.role)) {
        return res.status(403).json({
          message: 'Demo users have view-only access and cannot create bills',
          code: 'DEMO_USER_RESTRICTED',
        });
      }

      const validation = createBillSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          message: 'Invalid bill data',
          errors: validation.error.issues,
        });
      }

      const billData = validation.data;
      
      // Determine billType and paymentStructure (with backward compatibility)
      let billType: 'unique' | 'recurrent' = billData.billType || 
        (billData.paymentType === 'recurrent' ? 'recurrent' : 'unique');
      let paymentStructure: 'single' | 'installment' = billData.paymentStructure || 
        (billData.costs.length > 1 ? 'installment' : 'single');
      
      // Ensure paymentType is set for backward compatibility
      const paymentType = billData.paymentType || billType;
      
      // Build bill object first to match working pattern from codebase
      // Generate unique bill number using timestamp + UUID approach
      const timestamp = Date.now();
      const timestampStr = timestamp.toString(36).toUpperCase();
      const { v4: uuidv4 } = await import('uuid');
      const shortUuid = uuidv4().split('-')[0].toUpperCase();
      
      const newBillData = {
        buildingId: billData.buildingId,
        billNumber: `BILL-${timestampStr}-${shortUuid}`,
        title: billData.title,
        description: billData.description || null,
        category: billData.category,
        vendor: billData.vendor || null,
        billType,
        paymentStructure,
        paymentType, // Legacy field
        schedulePayment: billData.schedulePayment || null,
        yearInterval: billData.yearInterval || 1,
        scheduleCustom: billData.scheduleCustom || null,
        costs: billData.costs.map((cost) => parseFloat(cost)),
        totalAmount: parseFloat(billData.totalAmount),
        startDate: billData.startDate,
        endDate: billData.endDate || null,
        status: billData.status,
        isAutoGenerated: false,
        autoGenerateNextYear: billData.autoGenerateNextYear || false,
        sourceTemplateId: null,
        autoGeneratedLabel: null,
        createdBy: req.user.id,
        filePath: null,
        fileName: null,
        fileSize: null,
        isAiAnalyzed: false,
        aiAnalysisData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newBill = await db
        .insert(bills)
        .values(newBillData as any)
        .returning();

      // Generate payments for the new bill
      try {
        await financialService.generatePaymentsForBill(newBill[0].id);
      } catch (paymentError) {
        // Don't fail the bill creation if payment generation fails
      }

      // Schedule delayed money flow and budget update for the new bill
      try {
        financialService.scheduleBillUpdate(newBill[0].id);
      } catch (schedulingError) {
        // Don't fail the bill creation if scheduling fails
      }

      // Auto-generation trigger for recurrent bills without end date OR with autoGenerateNextYear flag
      // This creates a template bill for next year (separate from current bill)
      const isCreatedRecurrent = getEffectiveBillType(newBill[0]) === 'recurrent';
      const createdHasNoEndDate = !newBill[0].endDate;
      const createdHasAutoGenFlag = newBill[0].autoGenerateNextYear === true;
      
      if (isCreatedRecurrent && (createdHasNoEndDate || createdHasAutoGenFlag)) {
        try {
          // Use syncAutoGeneratedBill to create next year's auto-generated bill
          await syncAutoGeneratedBill(newBill[0]);
        } catch (autoGenError) {
          logWarn('Failed to generate next year bill template', { metadata: { error: autoGenError.message } });
          // Don't fail the bill creation if auto-generation fails
        }
      }

      res.status(201).json(newBill[0]);
    } catch (_error: any) {
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
      // Block demo users from updating bills (view-only access)
      if (isDemoRole(req.user.role)) {
        return res.status(403).json({
          message: 'Demo users have view-only access and cannot update bills',
          code: 'DEMO_USER_RESTRICTED',
        });
      }

      const { id } = req.params;
      const validation = updateBillSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          message: 'Invalid bill data',
          errors: validation.error.issues,
        });
      }

      const billData = validation.data;

      const originalBillRecord = await getBillById(id);
      
      if (!originalBillRecord) {
        return res.status(404).json({
          message: 'Bill not found',
        });
      }
      const originalBill = [originalBillRecord];

      const wasAutoGenerated = originalBillRecord.isAutoGenerated;
      const sourceTemplateId = originalBill[0].sourceTemplateId;
      
      // Build updateData FIRST - this is used for both template and direct updates
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
      // Handle new billType and paymentStructure fields with backward compatibility
      if (billData.billType) {
        updateData.billType = billData.billType;
      } else if (billData.paymentType) {
        // Infer billType from legacy paymentType if new field not provided
        updateData.billType = billData.paymentType;
      }
      
      if (billData.paymentStructure) {
        updateData.paymentStructure = billData.paymentStructure;
      } else if (billData.costs) {
        // Infer paymentStructure from costs array if new field not provided
        updateData.paymentStructure = billData.costs.length > 1 ? 'installment' : 'single';
      }
      
      // Keep legacy paymentType for backward compatibility
      if (billData.paymentType) {
        updateData.paymentType = billData.paymentType;
      } else if (billData.billType) {
        updateData.paymentType = billData.billType;
      }
      // Only update schedulePayment if explicitly provided in the request
      if ('schedulePayment' in req.body) {
        updateData.schedulePayment = billData.schedulePayment || null;
      } else {
        // Determine final state using billData (validated request) OR originalBill
        const finalPaymentType = billData.paymentType || originalBill[0].paymentType;
        const finalCosts = billData.costs ? billData.costs.map((c: string) => parseFloat(c)) : originalBill[0].costs;
        
        // Clear schedulePayment for single payment recurrent bills
        if (finalPaymentType === 'recurrent' && finalCosts && finalCosts.length === 1) {
          updateData.schedulePayment = null;
        }
      }
      // Handle scheduleCustom - can be set or cleared
      if ('scheduleCustom' in req.body) {
        updateData.scheduleCustom = billData.scheduleCustom || null;
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
      // Handle endDate - can be set or cleared
      if ('endDate' in req.body) {
        updateData.endDate = billData.endDate || null;
      }
      if (billData.status) {
        updateData.status = billData.status;
      }
      // Handle autoGenerateNextYear for recurrent bills
      if ('autoGenerateNextYear' in req.body) {
        updateData.autoGenerateNextYear = billData.autoGenerateNextYear || false;
      }
      // Handle yearInterval for multi-year recurrent bills
      if ('yearInterval' in req.body) {
        updateData.yearInterval = billData.yearInterval || 1;
      }
      updateData.updatedAt = new Date();

      // If this is an auto-generated bill with a source template, update the template instead
      if (wasAutoGenerated && sourceTemplateId) {
        logDebug('[BILLS API] Auto-generated bill being updated - updating source template', { metadata: { sourceTemplateId } });
        
        // Get the source template to detect payment structure changes
        const sourceTemplate = await db.select().from(bills).where(eq(bills.id, sourceTemplateId)).limit(1);
        if (sourceTemplate.length === 0) {
          logError('[BILLS API] Source template not found', new Error('Template not found'));
          return res.status(404).json({
            message: 'Source template not found',
          });
        }
        
        // Detect if payment structure has changed on the template
        const templatePaymentStructureChanged = hasPaymentStructureChanged(sourceTemplate[0], updateData);
        
        // Update the source template with all the updateData
        const templateUpdateResult = await db
          .update(bills)
          .set(updateData)
          .where(eq(bills.id, sourceTemplateId))
          .returning();
        
        logInfo('[BILLS API] Source template updated successfully');
        
        // Regenerate payments for the template if payment structure changed
        let paymentRegenerationInfo = null;
        if (templatePaymentStructureChanged) {
          logInfo('[BILLS API] Payment structure changed on template, regenerating payments');
          paymentRegenerationInfo = await financialService.regenerateCompletePaymentSchedule(sourceTemplateId);
        } else {
          await financialService.updatePaymentsForBill(sourceTemplateId);
        }
        
        // Sync the auto-generated bill from the updated template
        await syncAutoGeneratedBill(templateUpdateResult[0]);
        
        // Fetch the refreshed auto-generated bill
        const refreshedAutoGenBill = await db.select().from(bills).where(eq(bills.id, id)).limit(1);
        
        // Also update payments for the auto-generated bill itself
        if (refreshedAutoGenBill.length > 0 && templatePaymentStructureChanged) {
          logInfo('[BILLS API] Regenerating payments for auto-generated bill', { metadata: { billId: id } });
          await financialService.regenerateCompletePaymentSchedule(id);
        } else if (refreshedAutoGenBill.length > 0) {
          await financialService.updatePaymentsForBill(id);
        }
        
        const response: any = {
          ...refreshedAutoGenBill[0],
          templateUpdated: true,
          templateId: sourceTemplateId,
          paymentScheduleRegenerated: templatePaymentStructureChanged,
          message: 'Les modifications ont été appliquées au modèle source. Les futures factures générées automatiquement refléteront ces changements.'
        };
        
        if (paymentRegenerationInfo) {
          response.paymentRegenerationInfo = {
            deletedPayments: paymentRegenerationInfo.deletedCount,
            createdPayments: paymentRegenerationInfo.createdCount,
            message: `Payment schedule completely regenerated: ${paymentRegenerationInfo.deletedCount} payments deleted, ${paymentRegenerationInfo.createdCount} new payments created.`
          };
        }
        
        return res.json(response);
      }

      // Detect if payment structure has changed for recurrent bills
      const paymentStructureChanged = hasPaymentStructureChanged(originalBill[0], updateData);

      let updatedBill: any = null;
      let paymentRegenerationInfo = null;

      // Note: Neon HTTP driver doesn't support transactions, so we execute operations sequentially
      // Update the bill first
      const billUpdateResult = await db
        .update(bills)
        .set(updateData)
        .where(eq(bills.id, id))
        .returning();

      if (billUpdateResult.length === 0) {
        throw new Error('Bill not found after update');
      }

      updatedBill = billUpdateResult[0];

      // Update payments for the edited bill (without transaction context)
      if (paymentStructureChanged) {
        // Complete regeneration for recurrent bills with payment structure changes
        paymentRegenerationInfo = await financialService.regenerateCompletePaymentSchedule(id); // Regenerated complete schedule
      } else {
        // Standard update that preserves paid payments and prevents duplicates
        await financialService.updatePaymentsForBill(id);
      }
      
      // If status was updated, cascade status changes to payments
      if (billData.status) {
        await paymentGenerationService.updatePaymentStatusFromBillStatus(id, billData.status);
      }

      // Handle any failures
      if (!updatedBill) {
        return res.status(404).json({
          message: 'Bill not found after update',
        });
      }

      // Sync auto-generated bill (for non-auto-generated bills, this syncs their children)
      await syncAutoGeneratedBill(updatedBill);

      // Include payment regeneration info in response for user feedback
      const response: any = {
        ...updatedBill,
        paymentScheduleRegenerated: paymentStructureChanged,
      };

      if (paymentRegenerationInfo) {
        response.paymentRegenerationInfo = {
          deletedPayments: paymentRegenerationInfo.deletedCount,
          createdPayments: paymentRegenerationInfo.createdCount,
          message: `Payment schedule completely regenerated: ${paymentRegenerationInfo.deletedCount} payments deleted, ${paymentRegenerationInfo.createdCount} new payments created. Please manually mark any payments that have already been paid.`
        };
      }

      res.json(response);
    } catch (_error: any) {
      // console.error('❌ Error updating bill (PATCH):', _error);
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
      // Block demo users from updating bills (view-only access)
      if (isDemoRole(req.user.role)) {
        return res.status(403).json({
          message: 'Demo users have view-only access and cannot update bills',
          code: 'DEMO_USER_RESTRICTED',
        });
      }

      const { id } = req.params;
      const validation = updateBillSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          message: 'Invalid bill data',
          errors: validation.error.issues,
        });
      }

      const billData = validation.data;

      const originalBillRecord2 = await getBillById(id);
      
      if (!originalBillRecord2) {
        return res.status(404).json({
          message: 'Bill not found',
        });
      }
      const originalBill = [originalBillRecord2];

      const updateData: any = {};
      
      // Automatically convert auto-generated bills to manual bills on any edit
      // This is the expected behavior when a user edits an auto-generated template
      if (originalBill[0].isAutoGenerated) {
        updateData.isAutoGenerated = false;
        updateData.autoGeneratedLabel = null;
        // Keep sourceTemplateId for reference but bill is no longer auto-generated
      }
      
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
      // Handle new billType and paymentStructure fields with backward compatibility
      if (billData.billType) {
        updateData.billType = billData.billType;
      } else if (billData.paymentType) {
        // Infer billType from legacy paymentType if new field not provided
        updateData.billType = billData.paymentType;
      }
      
      if (billData.paymentStructure) {
        updateData.paymentStructure = billData.paymentStructure;
      } else if (billData.costs) {
        // Infer paymentStructure from costs array if new field not provided
        updateData.paymentStructure = billData.costs.length > 1 ? 'installment' : 'single';
      }
      
      // Keep legacy paymentType for backward compatibility
      if (billData.paymentType) {
        updateData.paymentType = billData.paymentType;
      } else if (billData.billType) {
        updateData.paymentType = billData.billType;
      }
      // Only update schedulePayment if explicitly provided in the request
      if ('schedulePayment' in req.body) {
        updateData.schedulePayment = billData.schedulePayment || null;
      } else {
        // Determine final state using billData (validated request) OR originalBill
        const finalPaymentType = billData.paymentType || originalBill[0].paymentType;
        const finalCosts = billData.costs ? billData.costs.map((c: string) => parseFloat(c)) : originalBill[0].costs;
        
        // Clear schedulePayment for single payment recurrent bills
        if (finalPaymentType === 'recurrent' && finalCosts && finalCosts.length === 1) {
          updateData.schedulePayment = null;
        }
      }
      if (billData.scheduleCustom) {
        updateData.scheduleCustom = billData.scheduleCustom;
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
      // Handle autoGenerateNextYear for single payment recurrent bills
      if ('autoGenerateNextYear' in req.body) {
        updateData.autoGenerateNextYear = billData.autoGenerateNextYear || false;
      }
      
      // Handle isAutoGenerated flag - when editing auto-generated bill, convert to normal bill
      if ('isAutoGenerated' in req.body) {
        updateData.isAutoGenerated = billData.isAutoGenerated ?? false;
      }
      
      // Handle sourceTemplateId - clear when converting auto-generated bill to normal
      if ('sourceTemplateId' in req.body) {
        updateData.sourceTemplateId = billData.sourceTemplateId ?? null;
      }
      
      // Handle autoGeneratedLabel - clear when converting auto-generated bill to normal
      if ('autoGeneratedLabel' in req.body) {
        updateData.autoGeneratedLabel = billData.autoGeneratedLabel ?? null;
      }
      
      updateData.updatedAt = new Date();

      // Detect if payment structure has changed for recurrent bills
      const paymentStructureChanged = hasPaymentStructureChanged(originalBill[0], updateData);

      let updatedBill: any = null;
      let paymentRegenerationInfo = null;

      // Note: Neon HTTP driver doesn't support transactions, so we execute operations sequentially
      // Update the bill first
      const billUpdateResult = await db
        .update(bills)
        .set(updateData)
        .where(eq(bills.id, id))
        .returning();

      if (billUpdateResult.length === 0) {
        throw new Error('Bill not found after update');
      }

      updatedBill = billUpdateResult[0];

      // Update payments for the edited bill (without transaction context)
      if (paymentStructureChanged) {
        // Complete regeneration for recurrent bills with payment structure changes
        paymentRegenerationInfo = await financialService.regenerateCompletePaymentSchedule(id); // Regenerated complete schedule
      } else {
        // Standard update that preserves paid payments and prevents duplicates
        await financialService.updatePaymentsForBill(id);
      }
      
      // If status was updated, cascade status changes to payments
      if (billData.status) {
        await paymentGenerationService.updatePaymentStatusFromBillStatus(id, billData.status);
      }

      // Handle any failures
      if (!updatedBill) {
        return res.status(404).json({
          message: 'Bill not found after update',
        });
      }

      // Schedule delayed money flow and budget update for the updated bill
      try {
        financialService.scheduleBillUpdate(id);
      } catch (schedulingError) {
        // console.warn('⚠️ Failed to schedule bill update:', schedulingError);
        // Don't fail the bill update if scheduling fails
      }

      // Sync auto-generated bill
      await syncAutoGeneratedBill(updatedBill);

      // Include payment regeneration info in response for user feedback
      const response: any = {
        ...updatedBill,
        paymentScheduleRegenerated: paymentStructureChanged,
      };

      if (paymentRegenerationInfo) {
        response.paymentRegenerationInfo = {
          deletedPayments: paymentRegenerationInfo.deletedCount,
          createdPayments: paymentRegenerationInfo.createdCount,
          message: `Payment schedule completely regenerated: ${paymentRegenerationInfo.deletedCount} payments deleted, ${paymentRegenerationInfo.createdCount} new payments created. Please manually mark any payments that have already been paid.`
        };
      }

      res.json(response);
    } catch (_error: any) {
      // console.error('❌ Error updating bill (PUT):', _error);
      res.status(500).json({
        message: 'Failed to update bill',
        _error: _error instanceof Error ? _error.message : 'Unknown error',
      });
    }
  });

  /**
   * Sync auto-generated bill for a source bill.
   * Creates/updates/deletes the auto-generated bill based on source bill's recurrence status.
   */
  async function syncAutoGeneratedBill(sourceBill: Bill): Promise<void> {
    try {
      const billType = getEffectiveBillType(sourceBill);
      
      // Skip if this bill is not a candidate for auto-generation:
      // - Skip auto-generated bills (they don't generate children)
      // - Skip if not recurrent
      // - Skip if has endDate AND autoGenerateNextYear is false
      const isRecurrent = billType === 'recurrent';
      const hasNoEndDate = !sourceBill.endDate;
      const hasAutoGenFlag = sourceBill.autoGenerateNextYear === true;
      
      // A bill should trigger auto-generation sync if it's recurrent AND (has no end date OR has the flag)
      const isAutoGenerationCandidate = isRecurrent && (hasNoEndDate || hasAutoGenFlag);
      
      // Skip entirely if this bill is auto-generated itself or not a candidate
      if (sourceBill.isAutoGenerated || (!isAutoGenerationCandidate && !sourceBill.sourceTemplateId)) {
        return;
      }
      
      // Find existing auto-generated bill
      const existingAutoGenerated = await db
        .select()
        .from(bills)
        .where(
          and(
            eq(bills.sourceTemplateId, sourceBill.id),
            eq(bills.isAutoGenerated, true)
          )
        )
        .limit(1);

      const hasAutoGenerated = existingAutoGenerated.length > 0;

      // Check if auto-generation should happen:
      // Recurrent bills with no end date OR with autoGenerateNextYear flag
      const shouldHaveAutoGenerated = isAutoGenerationCandidate;

      if (shouldHaveAutoGenerated) {
        // Should have auto-generated bill
        const generatedBills = billAutoGenerationService.generateForNextYear(sourceBill);
        
        if (generatedBills.length > 0) {
          const autoGenBillData = generatedBills[0];
          
          if (hasAutoGenerated) {
            // Update existing - copy all fields from generated bill except immutable ones
            // Also copy document info from source template
            await db.update(bills)
              .set({
                billNumber: autoGenBillData.billNumber,
                title: autoGenBillData.title,
                description: autoGenBillData.description,
                category: autoGenBillData.category,
                vendor: autoGenBillData.vendor,
                paymentType: autoGenBillData.paymentType, // Always 'unique' for auto-generated
                schedulePayment: autoGenBillData.schedulePayment,
                scheduleCustom: autoGenBillData.scheduleCustom,
                costs: autoGenBillData.costs,
                totalAmount: autoGenBillData.totalAmount,
                startDate: autoGenBillData.startDate,
                endDate: autoGenBillData.endDate,
                status: autoGenBillData.status,
                isAutoGenerated: autoGenBillData.isAutoGenerated, // Keep as true
                sourceTemplateId: autoGenBillData.sourceTemplateId, // Keep linked to source
                autoGeneratedLabel: autoGenBillData.autoGeneratedLabel,
                filePath: sourceBill.filePath,
                fileName: sourceBill.fileName,
                fileSize: sourceBill.fileSize,
                updatedAt: new Date(),
              })
              .where(eq(bills.id, existingAutoGenerated[0].id));
          } else {
            // Create new - omit id field to let database generate UUID
            // Also copy document info from source template
            const { id, createdAt, updatedAt, ...insertData } = autoGenBillData;
            await db.insert(bills).values({
              ...insertData,
              filePath: sourceBill.filePath,
              fileName: sourceBill.fileName,
              fileSize: sourceBill.fileSize,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }
      } else {
        // Should not have auto-generated bill - delete if exists
        if (hasAutoGenerated) {
          await db.delete(bills)
            .where(eq(bills.id, existingAutoGenerated[0].id));
        }
      }
    } catch (error) {
      logError('Error syncing auto-generated bill', error);
      // Don't throw - this is a background sync operation
    }
  }

  /**
   * Delete a bill
   * DELETE /api/bills/:id.
   */
  app.delete('/api/bills/:id', requireAuth, async (req: any, res: any) => {
    try {
      // Block demo users from deleting bills (view-only access)
      if (isDemoRole(req.user.role)) {
        return res.status(403).json({
          message: 'Demo users have view-only access and cannot delete bills',
          code: 'DEMO_USER_RESTRICTED',
        });
      }

      const { id } = req.params;

      // Get bill info before deletion for auto-generation cleanup and file deletion
      const billToDelete = await db
        .select()
        .from(bills)
        .where(eq(bills.id, id))
        .limit(1);

      if (billToDelete.length === 0) {
        return res.status(404).json({
          message: 'Bill not found',
        });
      }

      const filePath = billToDelete[0].filePath;

      // Delete attached file before deleting the bill
      if (filePath) {
        try {
          if (filePath.startsWith('/objects/')) {
            // File is in object storage
            logInfo('[BILL DELETE] Deleting object storage file', { metadata: { filePath } });
            const { ObjectStorageService } = await import('../objectStorage');
            const objectStorageService = new ObjectStorageService();
            const fileDeleted = await objectStorageService.deleteObject(filePath);
            
            if (fileDeleted) {
              logInfo('[BILL DELETE] Successfully deleted object storage file', { metadata: { filePath } });
            } else {
              logWarn('[BILL DELETE] Failed to delete object storage file', { metadata: { filePath } });
            }
          } else {
            // File is in local filesystem
            logInfo('[BILL DELETE] Deleting local filesystem file', { metadata: { filePath } });
            const fsPromises = await import('fs/promises');
            const pathModule = await import('path');
            const normalizedPath = normalizeFilePath(filePath);
            const fullPath = pathModule.join(process.cwd(), 'uploads', normalizedPath);
            
            try {
              await fsPromises.unlink(fullPath);
              logInfo('[BILL DELETE] Successfully deleted local file', { metadata: { filePath } });
            } catch (unlinkError: any) {
              if (unlinkError.code === 'ENOENT') {
                logWarn('[BILL DELETE] File not found (may already be deleted)', { metadata: { filePath } });
              } else {
                throw unlinkError;
              }
            }
          }
        } catch (fileError: any) {
          // Log file deletion error but continue with bill deletion
          logWarn('[BILL DELETE] Error deleting file', { metadata: { filePath, error: fileError.message } });
        }
      }

      // Delete associated payments first
      try {
        // Payment deletion handled by financial service when bill is deleted
      } catch (paymentError) {
        // console.warn('⚠️ Failed to delete payments for bill:', paymentError);
        // Continue with bill deletion even if payment deletion fails
      }

      // Auto-generation cleanup for recurrent bills
      if (getEffectiveBillType(billToDelete[0]) === 'recurrent') {
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
          // console.log(`✅ Deleted auto-generated bills for recurrent bill ${id}`);
        } catch (autoGenError) {
          // console.warn('⚠️ Failed to delete auto-generated bills:', autoGenError);
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
      // console.error('❌ Error deleting bill:', _error);
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
      // console.log(`📄 [BILLS UPLOAD] Starting document upload for bill ID: ${req.params.id}`);
      // console.log(`📄 [BILLS UPLOAD] User: ${req.user.id} (${req.user.role})`);
      
      try {
        // Block demo users from uploading documents (view-only access)
        if (isDemoRole(req.user.role)) {
          return res.status(403).json({
            message: 'Demo users have view-only access and cannot upload documents',
            code: 'DEMO_USER_RESTRICTED',
          });
        }

        const { id } = req.params;
        const userId = req.user.id;

        if (!req.file) {
          // console.log('❌ [BILLS UPLOAD] No file provided in request');
          return res.status(400).json({ message: 'No file uploaded' });
        }

        // console.log(`📄 [BILLS UPLOAD] File received:`, {
        //   originalName: req.file.originalname,
        //   mimeType: req.file.mimetype,
        //   size: req.file.size,
        //   tempPath: req.file.path
        // });
        
        // SECURITY: Validate file content using magic numbers
        try {
          const fileBuffer = fs.readFileSync(req.file.path);
          const isValidFileType = validateFileByMagicNumbers(fileBuffer, req.file.mimetype);
          
          if (!isValidFileType) {
            // console.log(`❌ [BILLS UPLOAD] File content validation failed - magic numbers don't match declared type`);
            // Clean up temporary file
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ 
              message: 'File content does not match declared file type',
              error: 'Invalid file content'
            });
          }
          // console.log(`✅ [BILLS UPLOAD] File content validated successfully`);
        } catch (validationError: any) {
          // console.error(`❌ [BILLS UPLOAD] File validation error:`, validationError);
          // Clean up temporary file
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(400).json({ 
            message: 'File validation failed',
            error: 'Unable to validate file content'
          });
        }

        // Get the bill first to access buildingId
        const bill = await getBillById(id);
        
        if (!bill) {
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(404).json({ message: 'Bill not found' });
        }

        // Handle auto-generated bills: upload document to source template instead
        let targetBillId = id;
        let isAutoGeneratedBill = bill.isAutoGenerated && bill.sourceTemplateId;
        
        if (isAutoGeneratedBill) {
          logDebug('[BILLS UPLOAD] Auto-generated bill detected, uploading to source template', { metadata: { sourceTemplateId: bill.sourceTemplateId } });
          targetBillId = bill.sourceTemplateId;
        }

        const buildingId = bill.buildingId;
        if (!buildingId) {
          // console.log(`❌ [BILLS UPLOAD] Bill has no buildingId: ${id}`);
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(400).json({ message: 'Bill has no associated building' });
        }

        // Get building to access organizationId
        const building = await storage.getBuilding(buildingId);
        if (!building) {
          // console.log(`❌ [BILLS UPLOAD] Building not found: ${buildingId}`);
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(404).json({ message: 'Building not found' });
        }

        const organizationId = building.organizationId;
        if (!organizationId) {
          // console.log(`❌ [BILLS UPLOAD] Building has no organizationId: ${buildingId}`);
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(400).json({ message: 'Building has no associated organization' });
        }

        // console.log(`📄 [BILLS UPLOAD] Organization ID: ${organizationId}, Building ID: ${buildingId}`);

        // Prepare the permanent file path - try object storage first
        let filePath: string;
        let fileName: string;
        
        logInfo('[BILLS UPLOAD] Starting object storage upload process for bill', { metadata: { targetBillId, isSourceTemplate: isAutoGeneratedBill } });
        
        // Attempt object storage upload FIRST
        try {
          const { ObjectStorageService } = await import('../objectStorage');
          const { ObjectAccessGroupType, ObjectPermission } = await import('../objectAcl');
          const objectStorageService = new ObjectStorageService();

          // Build hierarchical path with normalized filename (use targetBillId for path)
          // Using documentService for consistent path building across all document types
          const hierarchicalPath = documentService.buildHierarchicalPath({
            type: 'bills',
            buildingId: buildingId,
            entityId: targetBillId,
          }, req.file.originalname);
          logInfo('[BILLS UPLOAD] Generated hierarchical path', { metadata: { hierarchicalPath } });

          // Get presigned URL for custom hierarchical path
          const uploadURL = await objectStorageService.getCustomPathUploadURL(hierarchicalPath);
          logDebug('[BILLS UPLOAD] Got presigned upload URL for hierarchical path');

          // Upload file to object storage using presigned URL
          const fileBuffer = fs.readFileSync(req.file.path);
          const uploadResponse = await fetch(uploadURL, {
            method: 'PUT',
            body: fileBuffer,
            headers: {
              'Content-Type': req.file.mimetype,
            },
          });

          if (!uploadResponse.ok) {
            throw new Error(`Failed to upload to object storage: ${uploadResponse.status}`);
          }
          logInfo('[BILLS UPLOAD] File uploaded to object storage');

          // Build ACL policy based on building (building-level access for bills)
          const aclPolicy = {
            owner: userId,
            visibility: 'private' as const,
            aclRules: [{
              group: {
                type: ObjectAccessGroupType.BUILDING,
                id: buildingId
              },
              permission: ObjectPermission.READ
            }]
          };

          // Set ACL policy on the hierarchical path
          const objectStoragePath = await objectStorageService.trySetObjectEntityAclPolicy(uploadURL, aclPolicy);
          logInfo('[BILLS UPLOAD] ACL policy set', { metadata: { normalizedPath: objectStoragePath } });

          // Update filePath to use normalized object storage path (starts with /objects/)
          // This is critical for the document serving endpoint to recognize this as an object storage file
          // Using documentService.normalizePath() for consistent path normalization
          filePath = documentService.normalizePath(
            objectStoragePath.startsWith('/objects/') 
              ? objectStoragePath 
              : hierarchicalPath
          );
          fileName = normalizeFilename(req.file.originalname);
          
          // Clean up temporary file after successful upload
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
        } catch (objectStorageError: any) {
          logError('[BILLS UPLOAD] Object storage error, falling back to local filesystem storage', objectStorageError);
          
          // Fallback to local filesystem
          // SECURITY: Sanitize organization ID to prevent path traversal
          const sanitizedOrgId = organizationId.replace(/[^a-zA-Z0-9_-]/g, '_');
          
          // SECURITY: Generate secure filename instead of using original name
          const secureFilename = generateSecureFilename(req.file.originalname);
          fileName = secureFilename;
          filePath = `prod_org_${sanitizedOrgId}/${secureFilename}`;
          
          // Create uploads directory structure if it doesn't exist
          const uploadsDir = path.resolve(process.cwd(), 'uploads'); // Use resolve for security
          const orgDir = path.join(uploadsDir, `prod_org_${sanitizedOrgId}`);
          
          // SECURITY: Validate that orgDir is within uploads directory
          const resolvedOrgDir = path.resolve(orgDir);
          if (!resolvedOrgDir.startsWith(uploadsDir)) {
            logError('[BILLS UPLOAD] Security violation: org directory outside uploads', new Error('Path traversal detected'));
            if (fs.existsSync(req.file.path)) {
              fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({ message: 'Invalid organization path' });
          }
          
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          if (!fs.existsSync(orgDir)) {
            fs.mkdirSync(orgDir, { recursive: true });
          }

          // Save file to permanent storage
          const permanentFilePath = path.join(uploadsDir, filePath);
          fs.copyFileSync(req.file.path, permanentFilePath);
          fs.unlinkSync(req.file.path); // Clean up temporary file
          logInfo('[BILLS UPLOAD] File saved to local storage (fallback)', { metadata: { filePath } });
        }

        // Analyze document with Gemini AI (images and PDFs)
        // Note: AI analysis uses the original temp file path if it still exists, or we can read from permanent storage
        let analysisResult = null;
        if (req.file.mimetype.startsWith('image/') || req.file.mimetype === 'application/pdf') {
          // console.log(`🤖 [BILLS UPLOAD] Starting AI analysis for ${req.file.mimetype} file`);
          try {
            // Read file content for AI analysis
            let filePathForAnalysis = req.file.path;
            
            // If temp file was already deleted (object storage path), read from object storage or use file buffer
            if (!fs.existsSync(filePathForAnalysis)) {
              // Create temporary file for AI analysis
              const tempFilePath = path.join('/tmp', `bill-analysis-${Date.now()}-${req.file.originalname}`);
              
              if (filePath.startsWith('/objects/')) {
                // Try to read from object storage
                try {
                  const { ObjectStorageService } = await import('../objectStorage');
                  const objectStorageService = new ObjectStorageService();
                  const objectFile = await objectStorageService.getObjectEntityFile(filePath);
                  
                  // Download file to temp location for AI analysis
                  const fileStream = objectFile.createReadStream();
                  const writeStream = fs.createWriteStream(tempFilePath);
                  
                  await new Promise<void>((resolve, reject) => {
                    fileStream.pipe(writeStream);
                    writeStream.on('finish', () => resolve());
                    writeStream.on('error', reject);
                  });
                  
                  filePathForAnalysis = tempFilePath;
                } catch (downloadError) {
                  logWarn('[BILLS UPLOAD] Could not download from object storage for AI analysis');
                  // Skip AI analysis if we can't access the file
                  filePathForAnalysis = null;
                }
              } else {
                // Read from local filesystem
                const permanentFilePath = path.join(process.cwd(), 'uploads', filePath);
                if (fs.existsSync(permanentFilePath)) {
                  fs.copyFileSync(permanentFilePath, tempFilePath);
                  filePathForAnalysis = tempFilePath;
                }
              }
            }
            
            if (filePathForAnalysis && fs.existsSync(filePathForAnalysis)) {
              analysisResult = await aiService.analyzeBillDocument(filePathForAnalysis, req.file.mimetype);
              
              // Clean up temporary analysis file if we created one
              if (filePathForAnalysis !== req.file.path && fs.existsSync(filePathForAnalysis)) {
                fs.unlinkSync(filePathForAnalysis);
              }
              
              // console.log(`🤖 [BILLS UPLOAD] AI analysis successful:`, {
              //   hasResult: !!analysisResult,
              //   analysisKeys: analysisResult ? Object.keys(analysisResult) : []
              // });
            }
          } catch (aiError) {
            logWarn('[BILLS UPLOAD] AI analysis failed, continuing without analysis');
            // Continue without AI analysis
          }
        } else {
          // console.log(`🤖 [BILLS UPLOAD] Skipping AI analysis for unsupported file type: ${req.file.mimetype}`);
        }

        // Update bill (or source template for auto-generated bills) with document info and AI analysis
        const updateData: unknown = {
          filePath,
          fileName,
          fileSize: req.file.size,
          isAiAnalyzed: !!analysisResult,
          aiAnalysisData: analysisResult,
          updatedAt: new Date(),
        };

        // console.log(`📄 [BILLS UPLOAD] Updating bill ${targetBillId} in database with:`, {
        //   filePath,
        //   fileName,
        //   fileSize: req.file.size,
        //   hasAiAnalysis: !!analysisResult
        // });

        const updatedBill = await db
          .update(bills)
          .set(updateData)
          .where(eq(bills.id, targetBillId))
          .returning();

        // console.log(`📄 [BILLS UPLOAD] Database update successful for bill ${targetBillId}`);

        // If this was an auto-generated bill, sync it from the updated template
        if (isAutoGeneratedBill) {
          logInfo('[BILLS UPLOAD] Syncing auto-generated bill from updated template');
          await syncAutoGeneratedBill(updatedBill[0]);
          
          // Fetch the refreshed auto-generated bill
          const refreshedAutoGenBill = await db.select().from(bills).where(eq(bills.id, id)).limit(1);
          
          // Create document record for the original auto-generated bill
          try {
            const documentData = {
              name: fileName,
              description: `AI-analyzed bill document for ${refreshedAutoGenBill[0]?.title || 'Bill'}`,
              documentType: 'attachment',
              filePath,
              fileName,
              fileSize: req.file.size,
              mimeType: req.file.mimetype,
              isVisibleToTenants: false,
              isQuarantined: false,
              buildingId: refreshedAutoGenBill[0]?.buildingId || bill.buildingId,
              uploadedById: userId,
              attachedToType: 'bill',
              attachedToId: id,
            };
            await storage.createDocument(documentData);
          } catch (documentError) {
            logError('[BILLS UPLOAD] Failed to create document record for auto-generated bill', documentError);
          }
          
          return res.json({
            message: 'Document téléversé vers le modèle source. Les futures factures générées automatiquement auront ce document.',
            bill: refreshedAutoGenBill[0],
            analysisResult,
            templateUpdated: true,
            templateId: targetBillId,
          });
        }

        // Create document record in documents table for file attachment (non-auto-generated bills)
        // console.log(`📄 [BILLS UPLOAD] Creating document record for bill ${id}`);
        try {
          const documentData = {
            name: fileName,
            description: `AI-analyzed bill document for ${updatedBill[0].title || 'Bill'}`,
            documentType: 'attachment',
            filePath,
            fileName,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            isVisibleToTenants: false,
            isQuarantined: false,
            buildingId: updatedBill[0].buildingId,
            uploadedById: userId,
            attachedToType: 'bill',
            attachedToId: id,
          };

          const createdDocument = await storage.createDocument(documentData);
          // console.log(`📄 [BILLS UPLOAD] Document record created successfully with ID: ${createdDocument.id}`);
        } catch (documentError) {
          logError('[BILLS UPLOAD] Failed to create document record for bill', documentError);
          // Don't fail the upload if document creation fails, but log the error
        }

        // console.log(`✅ [BILLS UPLOAD] Upload process completed successfully for bill ${id}`);

        res.json({
          message: 'Document uploaded and analyzed successfully',
          bill: updatedBill[0],
          analysisResult,
        });
      } catch (_error: any) {
        logError('Error uploading document', _error);
        
        // Clean up temporary file if it exists
        if (req.file?.path) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (___cleanupError) {
            // console.error('Error cleaning up temp file:', ___cleanupError);
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
   * Download bill document using Object Storage only
   * GET /api/bills/:id/download-document
   * 
   * This endpoint uses Object Storage exclusively for stateless Autoscale deployment.
   * All downloads go through documentService.downloadDocument() which handles
   * path normalization, ACL checks, and streaming.
   */
  app.get('/api/bills/:id/download-document', requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const billData = await getBillById(id);

      if (!billData) {
        return res.status(404).json({ message: 'Bill not found' });
      }

      let filePath = billData.filePath;
      let fileName = billData.fileName;

      if (!filePath || !fileName) {
        // Check documents table for linked attachments
        const linkedDoc = await db
          .select({
            filePath: documents.filePath,
            fileName: documents.fileName,
          })
          .from(documents)
          .where(
            and(
              eq(documents.attachedToType, 'bill'),
              eq(documents.attachedToId, id)
            )
          )
          .limit(1);

        if (linkedDoc.length > 0 && linkedDoc[0].filePath && linkedDoc[0].fileName) {
          filePath = linkedDoc[0].filePath;
          fileName = linkedDoc[0].fileName;
        }
      }

      if (!filePath || !fileName) {
        return res.status(404).json({ 
          message: 'No document associated with this bill',
          code: 'NO_DOCUMENT'
        });
      }

      const accessCheck = await documentService.canUserAccessDocument(
        req.user.id,
        req.user.role,
        filePath
      );
      if (!accessCheck.allowed) {
        logWarn('[BILLS DOWNLOAD] Access denied', { userId: req.user.id, metadata: { reason: accessCheck.reason } });
        return res.status(403).json({ message: 'Access denied to this document' });
      }

      // Check if inline view is requested
      const inline = req.query.inline === 'true';
      
      const downloadSuccess = await documentService.downloadDocument(
        filePath,
        res,
        { filename: fileName, inline }
      );
      
      if (downloadSuccess) {
        return;
      }
      
      if (!res.headersSent) {
        return res.status(404).json({
          message: 'File not found in storage',
          code: 'FILE_NOT_FOUND',
          suggestion: 'The file attachment may be missing from storage. You can delete the attachment and upload a new one.'
        });
      }
    } catch (_error: any) {
      logError('[BILLS DOWNLOAD] Error downloading document', _error);
      if (!res.headersSent) {
        res.status(500).json({
          message: 'Failed to download document',
          code: 'DOWNLOAD_ERROR',
          _error: _error instanceof Error ? _error.message : 'Unknown error',
          suggestion: 'If the file is missing or corrupted, you can delete the attachment and upload a new one.'
        });
      }
    }
  });

  /**
   * Delete bill attachment (remove file from Object Storage and clear filePath/fileName/fileSize)
   * DELETE /api/bills/:id/attachment
   * 
   * This endpoint removes the direct file attachment from a bill without deleting the bill itself.
   * Uses Object Storage only for stateless Autoscale deployment.
   * Handles missing files gracefully by clearing the bill's file fields regardless.
   */
  app.delete('/api/bills/:id/attachment', requireAuth, async (req: any, res: any) => {
    logInfo('[BILLS ATTACHMENT DELETE] Deleting attachment for bill', { metadata: { billId: req.params.id } });
    
    try {
      // Block demo users from deleting attachments (view-only access)
      if (isDemoRole(req.user.role)) {
        return res.status(403).json({
          message: 'Demo users have view-only access and cannot delete attachments',
          code: 'DEMO_USER_RESTRICTED',
        });
      }

      const { id } = req.params;

      const billData = await getBillById(id);

      if (!billData) {
        return res.status(404).json({ message: 'Bill not found' });
      }

      const filePath = billData.filePath;

      if (!filePath) {
        return res.json({ 
          message: 'No attachment to delete',
          bill: billData
        });
      }

      let fileDeleted = false;
      let fileDeleteError: string | null = null;
      
      try {
        fileDeleted = await documentService.deleteDocument(filePath);
        
        if (fileDeleted) {
          logInfo('[BILLS ATTACHMENT DELETE] Successfully deleted from Object Storage', { metadata: { filePath } });
        } else {
          logWarn('[BILLS ATTACHMENT DELETE] File not found in Object Storage (ignoring)', { metadata: { filePath } });
        }
      } catch (fileError: any) {
        logWarn('[BILLS ATTACHMENT DELETE] Error deleting file', { metadata: { filePath, error: fileError.message } });
        fileDeleteError = fileError.message;
      }

      const updatedBill = await db
        .update(bills)
        .set({
          filePath: null,
          fileName: null,
          fileSize: null,
          isAiAnalyzed: false,
          aiAnalysisData: null,
          updatedAt: new Date(),
        })
        .where(eq(bills.id, id))
        .returning();

      if (updatedBill.length === 0) {
        return res.status(500).json({ message: 'Failed to clear attachment from bill' });
      }

      logInfo('[BILLS ATTACHMENT DELETE] Attachment removed from bill', { metadata: { billId: id } });
      
      res.json({
        message: fileDeleted ? 'Attachment deleted successfully' : 'Attachment reference cleared (file was already missing)',
        bill: updatedBill[0],
        fileDeleted,
        fileDeleteError
      });

    } catch (_error: any) {
      logError('[BILLS ATTACHMENT DELETE] Error', _error);
      res.status(500).json({
        message: 'Failed to delete attachment',
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

      const billData = await getBillById(id);

      if (!billData) {
        return res.status(404).json({ message: 'Bill not found' });
      }

      if (!billData.isAiAnalyzed || !billData.aiAnalysisData) {
        return res.status(400).json({ message: 'No AI analysis data available for this bill' });
      }

      const analysis = billData.aiAnalysisData as any;

      // Get payment schedule suggestion
      const scheduleSignestion = await aiService.suggestPaymentSchedule(
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
      // console.error('❌ Error applying AI analysis:', _error);
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

      if (getEffectiveBillType(bill[0]) !== 'recurrent') {
        return res.status(400).json({
          message: 'Only recurrent bills can generate future instances',
        });
      }

      // Generate future bills
      const result = await financialService.createAutoGeneratedBill(bill[0] as any, {}, new Date());

      res.json({
        message: 'Future bills generated successfully',
        billsCreated: result.billsCreated,
        generatedUntil: result.generatedUntil,
      });
    } catch (_error: any) {
      // console.error('❌ Error generating future bills:', _error);
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
      // console.error('❌ Error fetching bill categories:', _error);
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
          createdBy: bills.createdBy,
          createdAt: bills.createdAt,
          updatedAt: bills.updatedAt,
        })
        .from(bills)
        .where(eq(bills.isAutoGenerated, true))
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
      // console.error('❌ Error getting generated bills statistics:', _error);
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

      const analysis = await aiService.analyzeBillDocument(req.file.path, 'application/pdf');
      
      res.json(analysis);
    } catch (_error: any) {
      // console.error('Error analyzing document:', _error);
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

      const bill = await getBillById(id);
      
      if (!bill) {
        return res.status(404).json({
          message: 'Bill not found',
        });
      }

      if (getEffectiveBillType(bill) !== 'recurrent') {
        return res.status(400).json({
          message: 'Only recurrent bills can generate future bills',
        });
      }

      // Generate bills for next year
      const generatedBills = await financialService.createAutoGeneratedBill(bill, {}, new Date(new Date().getFullYear() + 1, 0, 1));

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
      // console.error('❌ Error generating bills for next year:', error);
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
      // console.error('❌ Error getting auto-generated bills:', error);
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

      // Build bill object first to match working pattern from codebase
      // Generate unique bill number using timestamp + UUID approach
      const timestamp = Date.now();
      const timestampStr = timestamp.toString(36).toUpperCase();
      const { v4: uuidv4 } = await import('uuid');
      const shortUuid = uuidv4().split('-')[0].toUpperCase();
      
      const billFromTemplate = {
        buildingId: validatedData.buildingId,
        billNumber: `BILL-${timestampStr}-${shortUuid}`,
        title: validatedData.title,
        description: validatedData.description || null,
        category: validatedData.category,
        vendor: validatedData.vendor || null,
        paymentType: validatedData.paymentType,
        schedulePayment: validatedData.schedulePayment || null,
        scheduleCustom: validatedData.scheduleCustom || null,
        costs: validatedData.costs.map((cost) => parseFloat(cost)),
        totalAmount: parseFloat(validatedData.totalAmount),
        startDate: validatedData.startDate,
        endDate: validatedData.endDate || null,
        status: validatedData.status,
        isAutoGenerated: false, // This is a real bill created from template
        sourceTemplateId: null, // Not linked to template anymore
        autoGeneratedLabel: null, // No longer auto-generated
        createdBy: req.user.id,
        filePath: null,
        fileName: null,
        fileSize: null,
        isAiAnalyzed: false,
        aiAnalysisData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Create the bill
      const insertResult = await db.insert(bills).values(billFromTemplate as any).returning();
      
      const newBill = insertResult[0];

      res.status(201).json({
        message: 'Bill created successfully from template',
        bill: newBill,
      });
    } catch (error: any) {
      // console.error('❌ Error creating bill from template:', error);
      
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

      // Use the bill auto-generation service to perform bulk generation
      const result = await billAutoGenerationService.bulkGenerateForAllBuildings(
        organizationId,
        buildingIds
      );
      
      res.json({
        message: 'Bulk generation completed successfully',
        success: true,
        processedBuildings: result.processedBuildings,
        generatedBills: result.generatedBills,
        errors: result.errors,
        hasErrors: result.errors.length > 0
      });
    } catch (error: any) {
      // console.error('❌ Error triggering bulk generation:', error);
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
      res.json({
        message: 'Scheduled generation handled by financial service automatically',
        success: true,
        summary: 'Scheduled job completed successfully',
        details: 'Auto-generation runs automatically via financial service'
      });
    } catch (error: any) {
      // console.error('❌ Error running scheduled job:', error);
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
        const orgCondition = exists(
          db.select({ id: buildings.id })
            .from(buildings)
            .where(and(
              eq(buildings.organizationId, organizationId as string),
              eq(buildings.id, bills.buildingId)
            ))
        );
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
      // console.error('❌ Error getting generation stats:', error);
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
      const generatedBills = await financialService.createAutoGeneratedBill(template as Bill, {}, new Date(new Date().getFullYear() + 1, 0, 1));
      
      if (generatedBills.length === 0) {
        return res.status(400).json({
          message: 'No bills could be generated from this template',
          error: 'GENERATION_FAILED'
        });
      }
      
      // Prepare the bill for insertion by omitting auto-generated fields
      const billToInsert = {
        ...generatedBills[0],
        id: undefined, // Let database auto-generate
        createdAt: undefined, // Let database auto-generate  
        updatedAt: undefined, // Let database auto-generate
      };
      
      // Insert the first generated bill
      const insertResult = await db.insert(bills).values(billToInsert).returning();
      const result = { bill: insertResult[0] };

      res.status(201).json({
        message: 'Bill generated successfully',
        bill: result.bill,
        sourceTemplate: template,
        generatedAt: new Date().toISOString()
      });

    } catch (error: any) {
      // console.error('❌ Error in auto-generation:', error);
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
      // console.error('❌ Error getting template data:', error);
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
      // console.error('❌ Error getting auto-generated bills:', error);
      res.status(500).json({
        message: 'Failed to get auto-generated bills',
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

      const result = await getBillWithPayments(id);

      if (!result) {
        return res.status(404).json({
          message: 'Bill not found',
        });
      }

      res.json({
        payments: result.payments,
        bill: result.bill,
      });
    } catch (error: any) {
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
      // Block demo users from updating payment status (view-only access)
      if (isDemoRole(req.user.role)) {
        return res.status(403).json({
          message: 'Demo users have view-only access and cannot update payment status',
          code: 'DEMO_USER_RESTRICTED',
        });
      }

      const { billId, paymentId } = req.params;
      const { status, paidDate } = req.body;

      if (!status || !['pending', 'overdue', 'paid', 'cancelled'].includes(status)) {
        return res.status(400).json({
          message: 'Valid status is required (pending, overdue, paid, cancelled)',
        });
      }

      // Update payment status in database
      const updateData: any = {
        status,
        updatedAt: new Date(),
      };

      // Set paid date if status is 'paid'
      if (status === 'paid' && paidDate) {
        updateData.paidDate = new Date(paidDate);
      } else if (status !== 'paid') {
        // Clear paid date if status is changed to not paid
        updateData.paidDate = null;
      }

      const updatedPayment = await db
        .update(payments)
        .set(updateData)
        .where(eq(payments.id, paymentId))
        .returning();

      if (updatedPayment.length === 0) {
        return res.status(404).json({
          message: 'Payment not found',
        });
      }

      // Auto-update bill status based on payment statuses
      try {
        await paymentGenerationService.updateBillStatusBasedOnPayments(billId);
      } catch (statusError) {
        logWarn('Failed to auto-update bill status');
        // Don't fail the payment update if bill status update fails
      }

      res.json({
        message: 'Payment status updated successfully',
        payment: updatedPayment[0],
      });
    } catch (error: any) {
      // console.error('❌ Error updating payment status:', error);
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

      // console.log('🔄 Starting payment regeneration for all bills...');

      // Get all bills
      const allBills = await db.select().from(bills);
      // console.log(`📊 Found ${allBills.length} bills to process`);

      let successCount = 0;
      let errorCount = 0;
      const errors: any[] = [];

      // Process each bill
      for (const bill of allBills) {
        try {
          // console.log(`🔄 Processing bill ${bill.id} (${bill.title})`);
          
          // Delete existing payments for this bill
          // Payment deletion handled by financial service when bill is deleted
          
          // Regenerate payments (clears existing unpaid payments to prevent duplicates)
          await financialService.updatePaymentsForBill(bill.id);
          
          successCount++;
          // console.log(`✅ Regenerated payments for bill ${bill.id}`);
        } catch (error: any) {
          errorCount++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push({
            billId: bill.id,
            billTitle: bill.title,
            error: errorMessage
          });
          // console.error(`❌ Failed to regenerate payments for bill ${bill.id}:`, errorMessage);
        }
      }

      // console.log(`🏁 Payment regeneration complete: ${successCount} successful, ${errorCount} errors`);

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
      // console.error('❌ Error during payment regeneration:', error);
      res.status(500).json({
        message: 'Failed to regenerate payments',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Create a new bill from auto-generated template with file attachments
   * POST /api/bills/from-auto-generated
   * Handles FormData with files and bill data for the auto-generated workflow
   */
  app.post('/api/bills/from-auto-generated', 
    requireAuth, 
    upload.array('files', 10), // Allow up to 10 files
    async (req: any, res: any) => {
      const startTime = Date.now();
      const userId = req.user.id;
      const userRole = req.user.role;

      // console.log(`[AUTO-GENERATED BILL] Starting creation for user ${userId} (${userRole})`);

      try {
        // Parse form data
        const { templateId, suggestedDate, newBillData: rawBillData } = req.body;
        const uploadedFiles = req.files || [];

        // console.log(`[AUTO-GENERATED BILL] Processing request with ${uploadedFiles.length} files`);

        // Validate required fields
        if (!rawBillData) {
          return res.status(400).json({
            error: 'Missing bill data',
            message: 'newBillData is required',
            code: 'MISSING_BILL_DATA'
          });
        }

        // Parse the JSON bill data
        let billData;
        try {
          billData = JSON.parse(rawBillData);
        } catch (error) {
          return res.status(400).json({
            error: 'Invalid bill data format',
            message: 'newBillData must be valid JSON',
            code: 'INVALID_JSON'
          });
        }

        // Validate bill data structure
        const validation = z.object({
          title: z.string().min(1),
          description: z.string().optional(),
          category: z.enum(BILL_CATEGORIES),
          vendor: z.string().optional(),
          totalAmount: z.number(),
          startDate: z.string(),
          endDate: z.string().optional().nullable(),
          status: z.enum(['draft', 'sent', 'overdue', 'paid', 'cancelled']),
          paymentType: z.enum(['unique', 'recurrent']),
          isAiAnalyzed: z.boolean().optional(),
          aiAnalysisData: z.any().optional()
        }).safeParse(billData);

        if (!validation.success) {
          return res.status(400).json({
            error: 'Invalid bill data',
            message: 'Bill data validation failed',
            errors: validation.error.issues,
            code: 'VALIDATION_ERROR'
          });
        }

        const validatedBillData = validation.data;

        // Get building ID from template if provided
        let buildingId = null;
        if (templateId) {
          try {
            const template = await db
              .select({ buildingId: bills.buildingId })
              .from(bills)
              .where(eq(bills.id, templateId))
              .limit(1);
            
            if (template.length > 0) {
              buildingId = template[0].buildingId;
            }
          } catch (error) {
            // console.warn(`[AUTO-GENERATED BILL] Could not fetch template ${templateId}:`, error);
          }
        }

        if (!buildingId) {
          return res.status(400).json({
            error: 'Building ID required',
            message: 'Could not determine building from template or request',
            code: 'MISSING_BUILDING_ID'
          });
        }

        // Begin transaction for atomic bill + document creation
        // Generate unique bill number using timestamp + UUID approach
        const timestamp = Date.now();
        const timestampStr = timestamp.toString(36).toUpperCase();
        const { v4: uuidv4 } = await import('uuid');
        const shortUuid = uuidv4().split('-')[0].toUpperCase();
        
        const newBillData = {
          buildingId,
          billNumber: `BILL-${timestampStr}-${shortUuid}`,
          title: validatedBillData.title,
          description: validatedBillData.description || null,
          category: validatedBillData.category,
          vendor: validatedBillData.vendor || null,
          paymentType: validatedBillData.paymentType,
          schedulePayment: null,
          scheduleCustom: null,
          costs: [validatedBillData.totalAmount.toString()],
          totalAmount: validatedBillData.totalAmount.toString(),
          startDate: validatedBillData.startDate,
          endDate: validatedBillData.endDate || null,
          status: validatedBillData.status,
          isAutoGenerated: true,
          sourceTemplateId: templateId || null,
          autoGeneratedLabel: 'From Auto-Generated Template',
          createdBy: userId,
          isAiAnalyzed: validatedBillData.isAiAnalyzed || false,
          aiAnalysisData: validatedBillData.aiAnalysisData || null,
        };

        // Create the bill
        // console.log(`[AUTO-GENERATED BILL] Creating bill for building ${buildingId}`);
        const newBill = await db.insert(bills).values([newBillData]).returning();

        if (!newBill || (Array.isArray(newBill) && newBill.length === 0)) {
          throw new Error('Failed to create bill');
        }

        const createdBill = newBill[0];
        // console.log(`[AUTO-GENERATED BILL] Bill created successfully: ${createdBill.id}`);

        // Process file attachments
        const attachedDocuments = [];
        
        for (let i = 0; i < uploadedFiles.length; i++) {
          const file = uploadedFiles[i];
          const fileMetadataKey = `fileMetadata_${i}`;
          let fileMetadata = {};

          try {
            if (req.body[fileMetadataKey]) {
              fileMetadata = JSON.parse(req.body[fileMetadataKey]);
            }
          } catch (error) {
            // console.warn(`[AUTO-GENERATED BILL] Invalid file metadata for file ${i}:`, error);
          }

          try {
            // Setup upload context for bill documents
            const uploadContext: UploadContext = {
              type: 'bills',
              organizationId: undefined,
              buildingId: buildingId,
              residenceId: undefined,
              userRole: userRole
            };

            // SECURITY: Validate file content using magic numbers before storing
            const fileBuffer = file.buffer || fs.readFileSync(file.path);
            const isValidFileType = validateFileByMagicNumbers(fileBuffer, file.mimetype);
            
            if (!isValidFileType) {
              throw new Error(`File content does not match declared type: ${file.mimetype}`);
            }
            
            // Use secure file storage to save the file
            const uploadResult = await secureFileStorage.storeFile(
              file,
              uploadContext,
              userRole,
              userId
            );

            if (!uploadResult.success) {
              throw new Error(uploadResult.error || 'File upload failed');
            }

            // Create document record using upload result
            const documentData = {
              name: file.originalname,
              fileName: file.originalname,
              filePath: uploadResult.filePath!,
              fileSize: file.size,
              mimeType: file.mimetype,
              documentType: (fileMetadata as any).category || 'other',
              description: `Document attached to bill: ${createdBill.title}`,
              isVisibleToTenants: false,
              attachedToType: 'bill',
              attachedToId: createdBill.id,
              buildingId: buildingId,
              residenceId: null,
              uploadedById: userId,
              isAiAnalyzed: (fileMetadata as any).aiAnalyzed || false,
              aiAnalysisData: null,
            };

            const newDocument = await db.insert(documents).values([documentData]).returning();
            
            if (newDocument && newDocument.length > 0) {
              attachedDocuments.push(newDocument[0]);
              // console.log(`[AUTO-GENERATED BILL] Document attached: ${newDocument[0].id}`);
            }

            // Clean up temporary file
            try {
              fs.unlinkSync(file.path);
            } catch (cleanupError) {
              // console.warn(`[AUTO-GENERATED BILL] Failed to cleanup temp file:`, cleanupError);
            }

          } catch (fileError) {
            // console.error(`[AUTO-GENERATED BILL] Error processing file ${i}:`, fileError);
            // Continue with other files, don't fail the entire operation
          }
        }

        // Note: Payments are automatically generated by createAutoGeneratedBill method
        // No need to call generatePaymentsForBill separately
        // console.log(`[AUTO-GENERATED BILL] Bill and payments created for bill ${createdBill.id}`);

        // Auto-generation trigger for recurrent bills
        if (getEffectiveBillType(createdBill) === 'recurrent') {
          try {
            await financialService.createAutoGeneratedBill(createdBill, {}, new Date(new Date().getFullYear() + 1, 0, 1));
            // Cleanup handled by financial service: await financialService.cleanupPastAutoGeneratedBills(createdBill.buildingId);
            // console.log(`[AUTO-GENERATED BILL] Auto-generation triggered for recurrent bill ${createdBill.id}`);
          } catch (autoGenError) {
            // console.warn(`[AUTO-GENERATED BILL] Failed to auto-generate next year bill:`, autoGenError);
            // Don't fail the bill creation if auto-generation fails
          }
        }

        const processingTime = Date.now() - startTime;
        // console.log(`[AUTO-GENERATED BILL] Creation completed in ${processingTime}ms`);

        // Return success response
        res.status(201).json({
          success: true,
          bill: createdBill,
          attachedDocuments,
          metadata: {
            processingTime,
            filesProcessed: uploadedFiles.length,
            documentsCreated: attachedDocuments.length,
            templateId,
            fromAutoGenerated: true
          }
        });

      } catch (error: any) {
        // console.error(`[AUTO-GENERATED BILL] Error for user ${userId}:`, error);
        
        // Clean up uploaded files on error
        if (req.files) {
          req.files.forEach((file: any) => {
            try {
              fs.unlinkSync(file.path);
            } catch (cleanupError) {
              // console.warn(`[AUTO-GENERATED BILL] Failed to cleanup temp file on error:`, cleanupError);
            }
          });
        }

        // Handle different error types
        if (error.message?.includes('VALIDATION_ERROR')) {
          return res.status(400).json({
            error: 'Validation failed',
            message: error.message,
            code: 'VALIDATION_ERROR'
          });
        } else if (error.message?.includes('MISSING_')) {
          return res.status(400).json({
            error: 'Missing required data',
            message: error.message,
            code: 'MISSING_DATA'
          });
        }

        // Generic error response
        res.status(500).json({
          error: 'Bill creation failed',
          message: 'Failed to create bill from auto-generated template. Please try again.',
          code: 'CREATION_ERROR'
        });
      }
    }
  );

  /**
   * Get available years with bills/payments for a building
   * GET /api/buildings/:buildingId/bills/available-years
   */
  app.get('/api/buildings/:buildingId/bills/available-years', requireAuth, asyncHandler(async (req: any, res: any) => {
      const { buildingId } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId) {
        return res.status(401).json({ message: 'User authentication required' });
      }

      // Check if user has access to this building
      const hasAccess = await checkBuildingAccess(userId, buildingId, userRole);
      if (!hasAccess) {
        return res.status(403).json({ message: 'You do not have access to this building' });
      }

      // Get distinct years from both payments.scheduledDate and bills start/end dates
      // This ensures auto-generated bills are included even if they don't have payments yet
      const paymentYearsResult = await db
        .selectDistinct({ year: sql<number>`EXTRACT(YEAR FROM ${payments.scheduledDate})::integer` })
        .from(payments)
        .innerJoin(bills, eq(payments.billId, bills.id))
        .where(eq(bills.buildingId, buildingId));

      const billStartYearsResult = await db
        .selectDistinct({ year: sql<number>`EXTRACT(YEAR FROM ${bills.startDate})::integer` })
        .from(bills)
        .where(eq(bills.buildingId, buildingId));

      const billEndYearsResult = await db
        .selectDistinct({ year: sql<number>`EXTRACT(YEAR FROM ${bills.endDate})::integer` })
        .from(bills)
        .where(and(eq(bills.buildingId, buildingId), isNotNull(bills.endDate)));

      // Combine all years and deduplicate
      const allYears = new Set<number>();
      paymentYearsResult.forEach(r => r.year != null && allYears.add(r.year));
      billStartYearsResult.forEach(r => r.year != null && allYears.add(r.year));
      billEndYearsResult.forEach(r => r.year != null && allYears.add(r.year));

      const years = Array.from(allYears).sort((a, b) => a - b);
      
      // If no years found, return current year as default
      if (years.length === 0) {
        years.push(new Date().getFullYear());
      }

      return res.json({ years });
    }, { errorMessage: 'Failed to fetch available years', errorLogPrefix: '❌ [BILLS] Error fetching available years' }));

  /**
   * Get bills summary by month range for a building
   * GET /api/buildings/:buildingId/bills/monthly-summary
   * Query params: lastMonthStart, lastMonthEnd, nextMonthStart, nextMonthEnd
   */
  app.get('/api/buildings/:buildingId/bills/monthly-summary', requireAuth, async (req: any, res: any) => {
    try {
      const { buildingId } = req.params;
      const { lastMonthStart, lastMonthEnd, nextMonthStart, nextMonthEnd } = req.query;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId) {
        return res.status(401).json({
          message: 'User authentication required',
        });
      }

      if (!lastMonthStart || !lastMonthEnd || !nextMonthStart || !nextMonthEnd) {
        return res.status(400).json({
          message: 'Missing required date parameters: lastMonthStart, lastMonthEnd, nextMonthStart, nextMonthEnd',
        });
      }

      // Verify building exists
      const building = await db.select().from(buildings).where(eq(buildings.id, buildingId)).limit(1);
      if (building.length === 0) {
        return res.status(404).json({
          message: 'Building not found',
        });
      }

      // Check if user has access to this building
      const hasAccess = await checkBuildingAccess(userId, buildingId, userRole);
      if (!hasAccess) {
        return res.status(403).json({
          message: 'You do not have access to this building',
        });
      }

      // Tenants and residents have no visibility into building bills.
      // Return an empty summary so the frontend renders cleanly without
      // leaking financial data through this endpoint.
      if (
        userRole === 'tenant' ||
        userRole === 'resident' ||
        userRole === 'demo_tenant' ||
        userRole === 'demo_resident'
      ) {
        return res.json({
          lastMonth: { bills: [], total: 0, paidTotal: 0, count: 0 },
          nextMonth: { bills: [], total: 0, paidTotal: 0, count: 0 },
        });
      }

      // Get bills with payments in last month range
      const lastMonthBills = await db
        .select({
          id: bills.id,
          title: bills.title,
          category: bills.category,
          vendor: bills.vendor,
          totalAmount: bills.totalAmount,
          status: bills.status,
          filePath: bills.filePath,
          fileName: bills.fileName,
          isAutoGenerated: bills.isAutoGenerated,
          autoGeneratedLabel: bills.autoGeneratedLabel,
          paymentId: payments.id,
          paymentAmount: payments.amount,
          paymentStatus: payments.status,
          scheduledDate: payments.scheduledDate,
          paidDate: payments.paidDate,
        })
        .from(bills)
        .innerJoin(payments, eq(payments.billId, bills.id))
        .where(
          and(
            eq(bills.buildingId, buildingId),
            gte(payments.scheduledDate, lastMonthStart as string),
            lte(payments.scheduledDate, lastMonthEnd as string)
          )
        )
        .orderBy(asc(payments.scheduledDate));

      // Get bills with payments in next month range
      const nextMonthBills = await db
        .select({
          id: bills.id,
          title: bills.title,
          category: bills.category,
          vendor: bills.vendor,
          totalAmount: bills.totalAmount,
          status: bills.status,
          filePath: bills.filePath,
          fileName: bills.fileName,
          isAutoGenerated: bills.isAutoGenerated,
          autoGeneratedLabel: bills.autoGeneratedLabel,
          paymentId: payments.id,
          paymentAmount: payments.amount,
          paymentStatus: payments.status,
          scheduledDate: payments.scheduledDate,
          paidDate: payments.paidDate,
        })
        .from(bills)
        .innerJoin(payments, eq(payments.billId, bills.id))
        .where(
          and(
            eq(bills.buildingId, buildingId),
            gte(payments.scheduledDate, nextMonthStart as string),
            lte(payments.scheduledDate, nextMonthEnd as string)
          )
        )
        .orderBy(asc(payments.scheduledDate));

      // Get all unique bill IDs to check for attachments in documents table
      const allBillIds = [...new Set([
        ...lastMonthBills.map(b => b.id),
        ...nextMonthBills.map(b => b.id)
      ])];

      // Fetch attachments from documents table for bills that don't have direct file_path
      const billAttachments = allBillIds.length > 0
        ? await db
            .select({
              attachedToId: documents.attachedToId,
              filePath: documents.filePath,
              fileName: documents.fileName,
            })
            .from(documents)
            .where(
              and(
                eq(documents.attachedToType, 'bill'),
                inArray(documents.attachedToId, allBillIds)
              )
            )
        : [];

      // Create a map of bill ID to attachment
      const attachmentMap = new Map(
        billAttachments.map(a => [a.attachedToId, { filePath: a.filePath, fileName: a.fileName }])
      );

      // Enrich bills with attachment data from documents table if not already present
      const enrichWithAttachment = (bill: typeof lastMonthBills[0]) => ({
        ...bill,
        filePath: bill.filePath || attachmentMap.get(bill.id)?.filePath || null,
        fileName: bill.fileName || attachmentMap.get(bill.id)?.fileName || null,
      });

      const enrichedLastMonthBills = lastMonthBills.map(enrichWithAttachment);
      const enrichedNextMonthBills = nextMonthBills.map(enrichWithAttachment);

      // Calculate totals for each month
      const lastMonthTotal = lastMonthBills.reduce((sum, bill) => sum + parseFloat(bill.paymentAmount || '0'), 0);
      const nextMonthTotal = nextMonthBills.reduce((sum, bill) => sum + parseFloat(bill.paymentAmount || '0'), 0);
      
      const lastMonthPaidTotal = lastMonthBills
        .filter(b => b.paymentStatus === 'paid')
        .reduce((sum, bill) => sum + parseFloat(bill.paymentAmount || '0'), 0);
      const nextMonthPaidTotal = nextMonthBills
        .filter(b => b.paymentStatus === 'paid')
        .reduce((sum, bill) => sum + parseFloat(bill.paymentAmount || '0'), 0);

      res.json({
        lastMonth: {
          bills: enrichedLastMonthBills,
          total: lastMonthTotal,
          paidTotal: lastMonthPaidTotal,
          count: enrichedLastMonthBills.length,
        },
        nextMonth: {
          bills: enrichedNextMonthBills,
          total: nextMonthTotal,
          paidTotal: nextMonthPaidTotal,
          count: enrichedNextMonthBills.length,
        },
      });
    } catch (error: any) {
      logError('Error fetching monthly bills summary:', error);
      res.status(500).json({
        message: 'Failed to fetch monthly bills summary',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
