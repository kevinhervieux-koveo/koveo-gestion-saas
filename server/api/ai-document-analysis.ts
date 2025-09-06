/**
 * AI Document Analysis API
 * 
 * Provides AI-powered document analysis for different upload contexts
 * using the universal upload configuration system.
 */

import type { Express } from 'express';
import { requireAuth } from '../auth';
import multer from 'multer';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { geminiService } from '../services/geminiService';
import { secureFileStorage } from '../services/secure-file-storage';
import { getUploadConfig, type UploadContext } from '@shared/config/upload-config';
import { z } from 'zod';

// Rate limiting for AI analysis (expensive operation)
const aiAnalysisRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each user to 20 analysis requests per windowMs
  message: {
    error: 'Too many AI analysis requests',
    message: 'Please wait before making another analysis request',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  keyGenerator: (req: any) => {
    return req.user?.id || ipKeyGenerator(req);
  }
});

// Configure multer for memory storage (temporary processing)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  }
});

// Validation schema for AI analysis request
const aiAnalysisSchema = z.object({
  formType: z.string(),
  uploadContext: z.string().optional().transform(val => {
    if (!val) return undefined;
    try {
      return JSON.parse(val) as UploadContext;
    } catch {
      return undefined;
    }
  })
});

/**
 * Generate context-specific AI prompt based on form type
 */
function generateContextPrompt(formType: string, uploadContext?: UploadContext): string {
  const basePrompt = "Analyze this document and extract relevant information.";
  
  switch (formType) {
    case 'bills':
      return `${basePrompt} This is a bill or invoice document. Extract:
      - Vendor/company name
      - Bill/invoice number
      - Amount(s) and currency
      - Due date or service period
      - Category (utilities, maintenance, insurance, etc.)
      - Payment details
      - Any recurring payment information
      Return the data as a structured JSON object with these fields.`;
      
    case 'buildings':
      return `${basePrompt} This is a building-related document. Extract:
      - Document type (inspection report, maintenance record, permit, etc.)
      - Building information (name, address, details)
      - Date and any deadlines
      - Key findings or recommendations
      - Contact information
      - Any compliance or regulatory information
      Return the data as a structured JSON object.`;
      
    case 'residences':
      return `${basePrompt} This is a residence-related document. Extract:
      - Unit or apartment details
      - Resident information
      - Document type (lease, inspection, maintenance, etc.)
      - Dates and deadlines
      - Key details or issues
      - Any fees or charges mentioned
      Return the data as a structured JSON object.`;
      
    case 'bugs':
      return `${basePrompt} This is a bug report or technical issue document. Extract:
      - Issue description and symptoms
      - Steps to reproduce
      - Expected vs actual behavior
      - Error messages or codes
      - System or component affected
      - Severity or priority indicators
      - Any suggested solutions
      Return the data as a structured JSON object.`;
      
    case 'maintenance':
      return `${basePrompt} This is a maintenance-related document. Extract:
      - Type of maintenance (preventive, corrective, emergency)
      - Equipment or system affected
      - Issue description
      - Work performed or required
      - Parts or materials needed
      - Timeline and priorities
      - Safety considerations
      Return the data as a structured JSON object.`;
      
    default:
      return `${basePrompt} Extract any structured information including:
      - Document type and purpose
      - Key dates and deadlines  
      - Important details and findings
      - Contact information
      - Action items or next steps
      Return the data as a structured JSON object.`;
  }
}

/**
 * Register AI document analysis routes
 */
export function registerAiAnalysisRoutes(app: Express) {
  /**
   * POST /api/ai/analyze-document
   * Analyze uploaded document using AI
   */
  app.post('/api/ai/analyze-document',
    requireAuth,
    aiAnalysisRateLimit,
    upload.single('document'),
    async (req: any, res: any) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            error: 'No document uploaded'
          });
        }

        // Validate request data
        const validation = aiAnalysisSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: 'Invalid request data',
            details: validation.error.issues
          });
        }

        const { formType, uploadContext } = validation.data;
        const config = getUploadConfig(formType);

        // Check if AI analysis is enabled for this form type
        if (!config.aiAnalysisEnabled) {
          return res.status(400).json({
            success: false,
            error: `AI analysis is not enabled for ${formType}`
          });
        }

        // Generate context-specific prompt
        const analysisPrompt = generateContextPrompt(formType, uploadContext);

        console.log(`[AI ANALYSIS] Starting analysis for ${formType} document: ${req.file.originalname}`);

        // Analyze document with Gemini
        let analysisResult;
        try {
          if (req.file.mimetype.startsWith('image/')) {
            // Analyze image document
            analysisResult = await geminiService.analyzeImage(req.file.buffer, analysisPrompt);
          } else if (req.file.mimetype === 'application/pdf') {
            // For PDF, we need to convert to image or extract text first
            // For now, treat as image analysis with the buffer
            analysisResult = await geminiService.analyzeDocument(req.file.buffer, analysisPrompt, req.file.mimetype);
          } else {
            // For other document types, extract text and analyze
            analysisResult = await geminiService.analyzeDocument(req.file.buffer, analysisPrompt, req.file.mimetype);
          }
        } catch (aiError) {
          console.error('[AI ANALYSIS] Analysis failed:', aiError);
          return res.status(500).json({
            success: false,
            error: 'AI analysis failed',
            details: aiError instanceof Error ? aiError.message : 'Unknown AI error'
          });
        }

        // Store the file securely if analysis was successful
        let storedFile;
        if (uploadContext) {
          const storageResult = await secureFileStorage.storeFile(
            {
              ...req.file,
              path: '', // Memory storage doesn't have path
            } as Express.Multer.File,
            uploadContext,
            req.user.role,
            req.user.id
          );

          if (storageResult.success) {
            storedFile = {
              path: storageResult.filePath,
              directory: storageResult.directory
            };
          }
        }

        console.log(`[AI ANALYSIS] Analysis completed for ${formType}:`, analysisResult);

        // Return analysis results
        res.json({
          success: true,
          formType,
          analysisResult,
          extractedData: analysisResult,
          confidence: 0.9, // Default confidence score
          storedFile,
          metadata: {
            fileName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            analyzedAt: new Date().toISOString(),
            analysisType: formType
          }
        });

      } catch (error) {
        console.error('[AI ANALYSIS] Unexpected error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error during AI analysis',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * GET /api/ai/analysis-status/:id
   * Get the status of an AI analysis job (for future async processing)
   */
  app.get('/api/ai/analysis-status/:id',
    requireAuth,
    (req: any, res: any) => {
      // Placeholder for future async analysis status checking
      res.json({
        success: true,
        status: 'completed',
        message: 'Synchronous analysis - always completed immediately'
      });
    }
  );

  /**
   * POST /api/ai/reanalyze-document
   * Re-analyze an existing document with different parameters
   */
  app.post('/api/ai/reanalyze-document',
    requireAuth,
    aiAnalysisRateLimit,
    async (req: any, res: any) => {
      try {
        const { filePath, formType, uploadContext } = req.body;

        if (!filePath || !formType) {
          return res.status(400).json({
            success: false,
            error: 'File path and form type are required'
          });
        }

        // Retrieve the file
        const fileResult = await secureFileStorage.retrieveFile(
          filePath,
          req.user.id,
          req.user.role
        );

        if (!fileResult.success) {
          return res.status(404).json({
            success: false,
            error: fileResult.error || 'File not found'
          });
        }

        // Re-analyze the document
        const analysisPrompt = generateContextPrompt(formType, uploadContext);
        
        // Note: This would need file reading and MIME type detection
        // For now, return a placeholder response
        res.json({
          success: true,
          message: 'Re-analysis functionality coming soon',
          formType,
          filePath
        });

      } catch (error) {
        console.error('[AI ANALYSIS] Re-analysis error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error during re-analysis'
        });
      }
    }
  );
}