import { Express, Request, Response } from 'express';
import { requireAuth } from '../auth/index';
import { uploadInvoiceFile, handleUploadError } from '../middleware/fileUpload';
import { geminiService } from '../services/geminiService';
import { aiExtractionResponseSchema } from '@shared/schema';
import rateLimit from 'express-rate-limit';

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
    // Rate limit per authenticated user ID (preferred) or use IP as fallback
    return req.user?.id || `ip-${req.ip}`;
  },
  skip: (req: any) => {
    // Skip rate limiting if user is not authenticated (handled by requireAuth)
    return !req.user?.id;
  }
});

export function registerInvoiceRoutes(app: Express) {
  console.log('🔄 Loading invoice routes...');

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

      console.log(`[INVOICE EXTRACTION] Starting extraction for user ${userId} (${userRole})`);

      try {
        // Validate file upload
        if (!req.file) {
          console.log(`[INVOICE EXTRACTION] No file uploaded by user ${userId}`);
          return res.status(400).json({
            error: 'No file uploaded',
            message: 'Please upload an invoice file',
            code: 'NO_FILE'
          });
        }

        const { buffer, mimetype, originalname, size } = req.file;
        
        console.log(`[INVOICE EXTRACTION] Processing file for user ${userId}:`, {
          filename: originalname,
          mimetype,
          size: `${Math.round(size / 1024)}KB`
        });

        // Validate GEMINI_API_KEY is configured
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          console.error('[INVOICE EXTRACTION] GEMINI_API_KEY not configured');
          return res.status(500).json({
            error: 'AI service not configured',
            message: 'Invoice extraction service is not available',
            code: 'SERVICE_UNAVAILABLE'
          });
        }

        // Extract invoice data using Gemini AI
        const extractionData = await geminiService.extractInvoiceData(buffer, mimetype);
        
        // Calculate confidence score
        const confidenceScore = geminiService.calculateConfidenceScore(extractionData);
        
        // Validate extracted data structure
        const validatedData = aiExtractionResponseSchema.parse(extractionData);
        
        const processingTime = Date.now() - startTime;
        
        console.log(`[INVOICE EXTRACTION] Extraction completed for user ${userId}:`, {
          processingTime: `${processingTime}ms`,
          confidence: confidenceScore,
          extractedFields: Object.keys(validatedData).filter(key => validatedData[key as keyof typeof validatedData] !== null)
        });

        // Security audit log
        console.log(`[SECURITY AUDIT] INVOICE_EXTRACTION_SUCCESS:`, {
          timestamp: new Date().toISOString(),
          action: 'INVOICE_EXTRACTION_SUCCESS',
          userId,
          userRole,
          filename: originalname,
          fileSize: size,
          confidence: confidenceScore,
          processingTime,
          extractedFieldCount: Object.keys(validatedData).filter(key => validatedData[key as keyof typeof validatedData] !== null).length
        });

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
        const processingTime = Date.now() - startTime;
        
        console.error(`[INVOICE EXTRACTION] Error for user ${userId}:`, {
          error: error.message,
          processingTime,
          filename: req.file?.originalname || 'unknown'
        });

        // Security audit log for errors
        console.log(`[SECURITY AUDIT] INVOICE_EXTRACTION_ERROR:`, {
          timestamp: new Date().toISOString(),
          action: 'INVOICE_EXTRACTION_ERROR',
          userId,
          userRole,
          error: error.message,
          filename: req.file?.originalname || 'unknown',
          processingTime
        });

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
            message: error.message,
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
      const checks = {
        apiKeyConfigured: !!process.env.GEMINI_API_KEY,
        serviceInitialized: !!geminiService,
        timestamp: new Date().toISOString()
      };

      // If API key is configured, test the connection
      if (checks.apiKeyConfigured && checks.serviceInitialized) {
        try {
          checks.apiConnected = await geminiService.validateApiKey();
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
      console.error('[INVOICE HEALTH] Health check error:', error);
      
      res.status(503).json({
        status: 'unhealthy',
        service: 'invoice-extraction',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  console.log('✅ Invoice routes registered on /api/invoices/');
}