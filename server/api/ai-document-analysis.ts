/**
 * AI Document Analysis API
 * 
 * Provides AI-powered document analysis for different upload contexts
 * using the universal upload configuration system.
 */

import type { Express } from 'express';
import { createHash } from 'crypto';
import { requireAuth } from '../auth';
import multer from 'multer';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { aiService, ConsolidatedAIService } from '../services/consolidated-ai-service';
import { secureFileStorage } from '../services/secure-file-storage';
import { getUploadConfig, type UploadContext } from '@shared/config/upload-config';
import { z } from 'zod';

// In-memory TTL cache for tag suggestion results. Repeated uploads of the same
// file (same hash + same candidate tag set + same context) within the TTL skip
// the Gemini round-trip entirely, which makes the upload dialog feel instant
// when users briefly toggle category or reopen the form.
const TAG_SUGGESTION_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const TAG_SUGGESTION_CACHE_MAX_ENTRIES = 200;
interface TagSuggestionCacheEntry {
  tagIds: string[];
  expiresAt: number;
}
const tagSuggestionCache = new Map<string, TagSuggestionCacheEntry>();

function buildTagSuggestionCacheKey(
  fileBuffer: Buffer,
  mimeType: string,
  tags: TagSuggestionTagInput[],
  category: string | undefined,
  scope: string | undefined,
  max: number
): string {
  const fileHash = createHash('sha256').update(fileBuffer).digest('hex');
  // Hash the full tag content (id + name + description), not just IDs: the
  // model prompt is built from names and descriptions, so renaming a tag or
  // editing its description must invalidate any cached suggestions even when
  // the IDs stay the same. Sort entries by id for order-independence so a
  // re-ordered candidate list still hits the same cache entry.
  const tagSerialized = tags
    .map((t) => ({ id: t.id, name: t.name, description: t.description ?? null }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((t) => `${t.id}\x1f${t.name}\x1f${t.description ?? ''}`)
    .join('\x1e');
  const tagFingerprint = createHash('sha256').update(tagSerialized).digest('hex');
  // `v2` key prefix lets us evolve the key format later without colliding with
  // entries written by older code paths still warm in memory.
  return ['v3', fileHash, mimeType, tagFingerprint, category ?? '', scope ?? '', String(max)].join(':');
}

function getCachedTagSuggestion(key: string): string[] | null {
  const entry = tagSuggestionCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    tagSuggestionCache.delete(key);
    return null;
  }
  // Refresh insertion order so the LRU-ish FIFO eviction keeps hot entries.
  tagSuggestionCache.delete(key);
  tagSuggestionCache.set(key, entry);
  return entry.tagIds;
}

function setCachedTagSuggestion(key: string, tagIds: string[]): void {
  tagSuggestionCache.set(key, {
    tagIds,
    expiresAt: Date.now() + TAG_SUGGESTION_CACHE_TTL_MS,
  });
  while (tagSuggestionCache.size > TAG_SUGGESTION_CACHE_MAX_ENTRIES) {
    const oldestKey = tagSuggestionCache.keys().next().value;
    if (oldestKey === undefined) break;
    tagSuggestionCache.delete(oldestKey);
  }
}

// Exposed for tests to reset state between cases.
export function __clearTagSuggestionCacheForTests(): void {
  tagSuggestionCache.clear();
}

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
  },
  validate: { keyGeneratorIpFallback: false },
});

// Configure multer for memory storage (temporary processing)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Union of: types accepted by `extractBillData` (PDF + images) and types
    // accepted by `suggestDocumentTags` (PDF + images + Word + Excel). Keep
    // legacy entries (`image/gif`) for backward compatibility with existing
    // analyze-document callers.
    const allowedTypes = new Set<string>([
      ...ConsolidatedAIService.TAG_SUGGESTION_SUPPORTED_MIME_TYPES,
      'image/gif',
    ]);

    if (allowedTypes.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  }
});

// Validation schema for tag suggestion request
interface TagSuggestionTagInput {
  id: string;
  name: string;
  description?: string | null;
}

const tagSuggestionTagSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
});

const tagSuggestionSchema = z.object({
  tags: z
    .string()
    .transform((val, ctx): TagSuggestionTagInput[] => {
      try {
        const parsed = JSON.parse(val) as unknown;
        const validated = z.array(tagSuggestionTagSchema).max(200).parse(parsed);
        return validated.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description ?? null,
        }));
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid tags payload' });
        return z.NEVER;
      }
    }),
  category: z.string().optional(),
  scope: z.enum(['building', 'residence']).optional(),
  max: z
    .string()
    .optional()
    .transform((v): number => {
      if (!v) return 3;
      const n = parseInt(v, 10);
      if (Number.isNaN(n) || n < 1) return 3;
      return Math.min(n, 10);
    }),
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
            // Analyze image document using AI service
            analysisResult = await aiService.extractBillData(req.file.buffer, req.file.mimetype);
          } else if (req.file.mimetype === 'application/pdf') {
            // For PDF, analyze with AI service
            analysisResult = await aiService.extractBillData(req.file.buffer, req.file.mimetype);
          } else {
            // For other document types, use AI service
            analysisResult = await aiService.extractBillData(req.file.buffer, req.file.mimetype);
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
   * POST /api/ai/suggest-document-tags
   *
   * Suggest the most relevant document tag IDs for an uploaded file by sending
   * the document contents to Gemini along with the candidate tag list. The
   * caller passes the available tags so we don't duplicate org/scope filtering
   * logic here. Falls back to an empty array (callers should then use the
   * client-side keyword scorer) when AI is unavailable.
   */
  app.post('/api/ai/suggest-document-tags',
    requireAuth,
    aiAnalysisRateLimit,
    upload.single('document'),
    async (req: any, res: any) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            error: 'No document uploaded',
          });
        }

        const validation = tagSuggestionSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: 'Invalid request data',
            details: validation.error.issues,
          });
        }

        const { tags, category, scope, max } = validation.data;
        if (tags.length === 0) {
          return res.json({ success: true, tagIds: [], source: 'ai' });
        }

        const cacheKey = buildTagSuggestionCacheKey(
          req.file.buffer,
          req.file.mimetype,
          tags,
          category,
          scope,
          max
        );
        const cachedTagIds = getCachedTagSuggestion(cacheKey);
        if (cachedTagIds) {
          return res.json({
            success: true,
            tagIds: cachedTagIds,
            source: 'ai',
            cached: true,
            metadata: {
              fileName: req.file.originalname,
              mimeType: req.file.mimetype,
              consideredTags: tags.length,
            },
          });
        }

        try {
          const tagIds = await aiService.suggestDocumentTags(
            req.file.buffer,
            req.file.mimetype,
            tags,
            { category, scope },
            max
          );

          setCachedTagSuggestion(cacheKey, tagIds);

          return res.json({
            success: true,
            tagIds,
            source: 'ai',
            cached: false,
            metadata: {
              fileName: req.file.originalname,
              mimeType: req.file.mimetype,
              consideredTags: tags.length,
            },
          });
        } catch (aiError) {
          console.warn(
            '[AI TAG SUGGEST] AI suggestion unavailable, client should fall back:',
            aiError instanceof Error ? aiError.message : aiError
          );
          return res.status(200).json({
            success: false,
            tagIds: [],
            source: 'unavailable',
            error: aiError instanceof Error ? aiError.message : 'AI unavailable',
          });
        }
      } catch (error) {
        console.error('[AI TAG SUGGEST] Unexpected error:', error);
        res.status(500).json({
          success: false,
          tagIds: [],
          error: 'Internal server error during tag suggestion',
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