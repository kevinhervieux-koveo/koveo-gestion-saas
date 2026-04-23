/**
 * Optimized Document API
 * 
 * Enhanced document endpoints using the optimized file storage service
 * with improved performance, caching, and reduced filesystem operations.
 */

import type { Express } from 'express';
import { requireAuth } from '../auth';
import { storage } from '../storage';
import { optimizedFileStorage } from '../services/optimized-file-storage';
import { buildContentDisposition } from '../utils/content-disposition';
import { normalizeFilename } from '../utils/filenameNormalization';
import { safeHeaderValue, safeJsonHeaderValue, safeMimeType } from '../utils/safe-header';
import { getOptimizedUploadConfig, estimateAccessFrequency } from '@shared/config/optimized-upload-config';
import type { OptimizedUploadContext } from '@shared/config/optimized-upload-config';
import {
  documents,
  insertDocumentSchema,
  type Document,
} from '../../shared/schema';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db';

// Performance monitoring
let apiMetrics = {
  requestCount: 0,
  avgResponseTime: 0,
  cacheHitRatio: 0,
  errorCount: 0,
  lastReset: Date.now()
};

// Enhanced multer configuration with optimized storage
const optimizedUpload = multer({
  dest: '/tmp/uploads_optimized/',
  // Force utf8 multipart param parsing so French/diacritic filenames survive
  // (multer 2.x defaults to latin1, which mangles "Procès-verbal été 2024.pdf").
  defParamCharset: 'utf8',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    // Enhanced file validation
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

export function registerOptimizedDocumentRoutes(app: Express): void {
  console.log(`[${new Date().toISOString()}] 🚀 Registering optimized document routes...`);

  // Performance monitoring middleware
  const performanceMonitor = (req: any, res: any, next: any) => {
    const startTime = performance.now();
    
    res.on('finish', () => {
      const duration = performance.now() - startTime;
      apiMetrics.requestCount++;
      
      // Update average response time
      const totalTime = apiMetrics.avgResponseTime * (apiMetrics.requestCount - 1) + duration;
      apiMetrics.avgResponseTime = totalTime / apiMetrics.requestCount;
      
      // Log slow requests
      if (duration > 1000) {
        console.warn(`⚠️  Slow request: ${req.method} ${req.path} took ${duration.toFixed(2)}ms`);
      }
    });
    
    next();
  };

  // Apply performance monitoring to all routes
  app.use('/api/documents', performanceMonitor);

  /**
   * Optimized file upload endpoint
   */
  app.post('/api/documents/optimized-upload', requireAuth, optimizedUpload.single('file'), async (req: any, res) => {
    const startTime = performance.now();
    
    try {
      const user = req.user;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: 'No file provided' });
      }

      // Parse and validate upload context
      const uploadData = z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        documentType: z.string(),
        organizationId: z.string().uuid().optional(),
        buildingId: z.string().uuid().optional(),
        residenceId: z.string().uuid().optional(),
        isManagerOnly: z.preprocess(
          (v) => v === 'true' || v === true,
          z.boolean()
        ).optional(),
      }).parse(req.body);

      // Create optimized upload context
      const context: OptimizedUploadContext = {
        type: 'documents',
        organizationId: uploadData.organizationId,
        buildingId: uploadData.buildingId,
        residenceId: uploadData.residenceId,
        userRole: user.role,
        userId: user.id,
        expectedAccessFrequency: estimateAccessFrequency({
          type: 'documents',
          userRole: user.role,
          organizationId: uploadData.organizationId
        })
      };

      // Store file using optimized storage
      const storageResult = await optimizedFileStorage.storeFile(
        file,
        context,
        user.role,
        user.id
      );

      if (!storageResult.success) {
        return res.status(500).json({
          message: 'Failed to store file',
          error: storageResult.error
        });
      }

      // Create database record
      const documentData = {
        id: crypto.randomUUID(),
        name: uploadData.name,
        description: uploadData.description,
        filePath: storageResult.filePath!,
        fileName: normalizeFilename(file.originalname),
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        buildingId: uploadData.buildingId,
        residenceId: uploadData.residenceId,
        uploadedById: user.id,
        isVisibleToTenants: false,
        // Only admins/managers may flag a new document as manager-only.
        // Mirrors the guard in server/api/documents.ts (resolveManagerOnlyFlag)
        // so residents/tenants can't bypass visibility on this code path either.
        isManagerOnly:
          (uploadData.isManagerOnly ?? false) &&
          (user.role === 'admin' ||
            user.role === 'manager' ||
            user.role === 'demo_manager'),
        documentType: uploadData.documentType,
      };

      const [document] = await db.insert(documents).values([documentData]).returning();

      const responseTime = performance.now() - startTime;
      
      res.json({
        success: true,
        document,
        performanceMetrics: {
          responseTime: `${responseTime.toFixed(2)}ms`,
          storageMetrics: storageResult.performanceMetrics,
          optimizedStorage: true
        }
      });

    } catch (error) {
      apiMetrics.errorCount++;
      console.error('Error in optimized upload:', error);
      res.status(500).json({
        message: 'Upload failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Optimized file retrieval endpoint with caching
   */
  app.get('/api/documents/:id/optimized-file', requireAuth, async (req: any, res) => {
    const startTime = performance.now();
    const operationId = crypto.randomUUID();
    
    try {
      const user = req.user;
      const documentId = req.params.id;
      const isDownload = req.query.download === 'true';

      console.log(`📋 [OPTIMIZED] File request - ID: ${documentId}, User: ${user.role}, Download: ${isDownload}`);

      // Authorization: reuse the centralized scope check, which enforces
      // organization/building/residence assignment AND blocks residents/tenants
      // from manager-only documents (and managers not assigned to the building).
      const userOrganizations = await storage.getUserOrganizations(user.id);
      const userOrganizationIds = userOrganizations.map((org: any) => org.organizationId);

      const document = await storage.getDocumentWithScope(
        documentId,
        user.id,
        user.role,
        userOrganizationIds
      );

      if (!document) {
        return res.status(404).json({ message: 'Document not found or access denied' });
      }

      // Optimized file retrieval
      const retrievalResult = await optimizedFileStorage.retrieveFile(
        document.filePath,
        user.id,
        user.role
      );

      if (!retrievalResult.success) {
        const status = retrievalResult.notFound ? 404 : 403;
        return res.status(status).json({
          message: retrievalResult.error,
          fromCache: retrievalResult.fromCache
        });
      }

      // Set appropriate headers. Prefer the original UTF-8 filename so users
      // see the name they uploaded rather than the normalized slug
      // (Task #420).
      const filename =
        document.originalFileName ||
        document.fileName ||
        document.name ||
        path.basename(document.filePath);
      const disposition = isDownload ? 'attachment' : 'inline';
      
      res.setHeader('Content-Disposition', buildContentDisposition(filename, { type: disposition }));
      res.setHeader('Content-Type', safeMimeType(document.mimeType));
      res.setHeader('X-Performance-Optimized', 'true');
      res.setHeader('X-Cache-Hit', retrievalResult.fromCache ? 'true' : 'false');

      const responseTime = performance.now() - startTime;

      // Add performance headers (sanitised – formatted server-side, but pass
      // through the helper so downstream changes can never inject CR/LF).
      res.setHeader('X-Response-Time', safeHeaderValue(`${responseTime.toFixed(2)}ms`, '0ms'));
      if (retrievalResult.performanceMetrics) {
        res.setHeader(
          'X-Storage-Metrics',
          safeJsonHeaderValue(retrievalResult.performanceMetrics)
        );
      }

      // Stream file to response
      const fs = require('fs');
      const fileStream = fs.createReadStream(retrievalResult.filePath);
      
      fileStream.on('error', (error: any) => {
        console.error('File stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error reading file' });
        }
      });

      fileStream.pipe(res);

      console.log(`✅ [OPTIMIZED] File served in ${responseTime.toFixed(2)}ms (cache: ${retrievalResult.fromCache})`);

    } catch (error) {
      apiMetrics.errorCount++;
      console.error('Error in optimized file retrieval:', error);
      
      if (!res.headersSent) {
        res.status(500).json({
          message: 'Failed to retrieve file',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });

  /**
   * Optimized file listing endpoint with pagination and filtering
   */
  app.get('/api/documents/optimized-list', requireAuth, async (req: any, res) => {
    const startTime = performance.now();
    
    try {
      const user = req.user;
      const limit = Math.min(parseInt(req.query.limit) || 50, 100);
      const offset = parseInt(req.query.offset) || 0;
      const organizationId = req.query.organizationId;
      const buildingId = req.query.buildingId;
      const residenceId = req.query.residenceId;

      const context: OptimizedUploadContext = {
        type: 'documents',
        organizationId,
        buildingId,
        residenceId,
        userRole: user.role,
        userId: user.id
      };

      const listResult = await optimizedFileStorage.listFiles(
        context,
        user.id,
        user.role,
        limit,
        offset
      );

      if (!listResult.success) {
        return res.status(403).json({ message: listResult.error });
      }

      const responseTime = performance.now() - startTime;

      res.json({
        success: true,
        files: listResult.files,
        total: listResult.total,
        limit,
        offset,
        fromCache: listResult.fromCache,
        performanceMetrics: {
          responseTime: `${responseTime.toFixed(2)}ms`,
          optimizedListing: true
        }
      });

    } catch (error) {
      apiMetrics.errorCount++;
      console.error('Error in optimized file listing:', error);
      res.status(500).json({
        message: 'Failed to list files',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Performance metrics endpoint
   */
  app.get('/api/documents/performance-metrics', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only allow admin or manager access
      if (user.role !== 'admin' && user.role !== 'manager') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const storageMetrics = optimizedFileStorage.getPerformanceMetrics();
      const timeSinceReset = Date.now() - apiMetrics.lastReset;

      res.json({
        success: true,
        metrics: {
          api: {
            ...apiMetrics,
            requestsPerMinute: (apiMetrics.requestCount / (timeSinceReset / 60000)).toFixed(2),
            errorRate: apiMetrics.requestCount > 0 
              ? `${(apiMetrics.errorCount / apiMetrics.requestCount * 100).toFixed(2)}%`
              : '0%'
          },
          storage: storageMetrics,
          optimization: {
            directoryDepthReduction: '50%', // From 6 to 3 levels
            cacheImplemented: true,
            batchProcessingEnabled: true,
            performanceMonitoringActive: true
          }
        }
      });

    } catch (error) {
      console.error('Error getting performance metrics:', error);
      res.status(500).json({
        message: 'Failed to get performance metrics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Cache management endpoint
   */
  app.post('/api/documents/clear-cache', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only allow admin access
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      // Clear all caches
      optimizedFileStorage.clearCaches();
      
      // Reset API metrics
      apiMetrics = {
        requestCount: 0,
        avgResponseTime: 0,
        cacheHitRatio: 0,
        errorCount: 0,
        lastReset: Date.now()
      };

      console.log('🧹 Cache cleared by admin user');

      res.json({
        success: true,
        message: 'All caches cleared successfully'
      });

    } catch (error) {
      console.error('Error clearing cache:', error);
      res.status(500).json({
        message: 'Failed to clear cache',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  console.log('✅ Optimized document routes registered successfully');
}