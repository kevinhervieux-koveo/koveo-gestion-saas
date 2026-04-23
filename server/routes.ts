// Main routes file that loads route definitions  
import express, { Express } from 'express';
import { setupAuthRoutes, sessionConfig } from './auth';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { requireAuth } from './auth/index';
import { secureErrorHandler, notFoundHandler } from './middleware/error-security';
import { enforceDemoSecurity } from './middleware/demo-security';
import { logDebug, logInfo, logWarn, logError } from './utils/logger';

import { registerMcpRoutes, registerOAuthConsentRoutes, koveoMcpOAuthProvider } from './mcp/index';

// Import API route registration functions
import { registerOrganizationRoutes } from './api/organizations';
import { registerUserRoutes } from './api/users';
import { registerBuildingRoutes } from './api/buildings';
import { registerDocumentRoutes } from './api/documents';
import { registerDocumentTagRoutes } from './api/document-tags';
import { seedKoveoDocumentTags } from './api/document-tags-seed';
import { registerBugRoutes } from './api/bugs';
import { registerBillRoutes } from './api/bills';
import budgetRouter from './api/budgets';
import { registerResidenceRoutes } from './api/residences';
import { registerDemandRoutes } from './api/demands';
import { registerFeatureRequestRoutes } from './api/feature-requests';
import { registerContactRoutes } from './api/contacts';
import { registerCommonSpacesRoutes } from './api/common-spaces';
import { registerPermissionsRoutes } from './api/permissions';
import { registerDemoManagementRoutes } from './api/demo-management';
import { registerCommunicationRoutes } from './api/communication';
import { registerTrialRequestRoutes } from './api/trial-request';
import { registerInvoiceRoutes } from './api/invoices';
import { registerAiAnalysisRoutes } from './api/ai-document-analysis';
import { registerDocumentationRoutes } from './api/documentation';
import { registerPillarsSuggestionsRoutes } from './api/pillars-suggestions';
import { registerQualityMetricsRoutes } from './api/quality-metrics';
import { registerFeatureManagementRoutes } from './api/feature-management';
import { registerMaintenanceRoutes } from './api/maintenance';
import law25ComplianceRouter from './routes/law25-compliance';
import { performanceRouter } from './performance-api';
import { webVitalsRouter } from './web-vitals-api';
import { db } from './db';
import * as schema from '@shared/schema';
import { demands } from '../shared/schemas/operations';
import { eq } from 'drizzle-orm';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use /tmp/uploads for persistent storage in Replit
    const uploadDir = path.join('/tmp', 'uploads', 'demands');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `demand-${uniqueSuffix}${extension}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    // Allow images, PDFs, and common document types
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  }
});

export async function registerRoutes(app: Express) {
  
  // Register MCP routes BEFORE session middleware (MCP /mcp endpoints use
  // their own bearer-token / API-key auth, no session needed).
  // A failure here (e.g. a misconfigured MCP_OAUTH_ISSUER in production) must
  // NOT abort the rest of route registration — otherwise the SPA catch-all
  // never gets installed and every browser hit returns "Cannot GET /".
  try {
    await registerMcpRoutes(app);
  } catch (mcpError: any) {
    console.error(
      '[ROUTES] registerMcpRoutes failed — continuing without MCP endpoints:',
      mcpError?.message || mcpError,
      mcpError?.stack || ''
    );
  }
  
  // CRITICAL: Apply session middleware BEFORE authentication routes
  app.use(sessionConfig);

  // OAuth consent UI MUST be mounted AFTER sessionConfig because it reads
  // and writes req.session to detect the signed-in Koveo user.
  registerOAuthConsentRoutes(app, koveoMcpOAuthProvider);
  
  
  // Setup authentication routes - session middleware must be applied first
  setupAuthRoutes(app);
  
  // CRITICAL SECURITY: Apply demo security middleware to all API routes
  // This must come AFTER authentication but BEFORE route registration
  // Auth endpoints are exempted in the middleware itself (login, logout, etc.)
  app.use('/api/*', enforceDemoSecurity());
  
  // Register all API routes
  registerOrganizationRoutes(app);
  registerUserRoutes(app);
  registerBuildingRoutes(app);
  registerDocumentRoutes(app);
  registerDocumentTagRoutes(app);
  // Idempotent seeding of Koveo system tags (safe to run on every startup)
  void seedKoveoDocumentTags();
  registerBugRoutes(app);

  registerBillRoutes(app);
  
  // Budget routes
  app.use('/api/budgets', requireAuth, budgetRouter);
  
  registerResidenceRoutes(app);
  registerDemandRoutes(app);
  registerFeatureRequestRoutes(app);
  registerContactRoutes(app);
  registerCommonSpacesRoutes(app);
  registerPermissionsRoutes(app);
  registerDemoManagementRoutes(app);
  registerCommunicationRoutes(app);
  registerTrialRequestRoutes(app);
  registerInvoiceRoutes(app);
  registerAiAnalysisRoutes(app);
  registerDocumentationRoutes(app);
  registerPillarsSuggestionsRoutes(app);
  registerQualityMetricsRoutes(app);
  registerFeatureManagementRoutes(app);
  registerMaintenanceRoutes(app);
  
  // Performance monitoring routes
  app.use(performanceRouter);
  app.use(webVitalsRouter);
  
  // Law 25 compliance routes
  app.use('/api/law25-compliance', requireAuth, law25ComplianceRouter);
  
  
  // Features API for roadmap
  app.get('/api/features', requireAuth, async (req: any, res) => {
    try {
      const { roadmap } = req.query;
      
      // Database and schema are now imported at the top of the file
      
      // Get all features from the database
      const features = await db.select().from(schema.features).orderBy(schema.features.createdAt);
      
      // Transform database columns to match expected format
      const transformedFeatures = features.map((feature: any) => ({
        ...feature,
        isPublicRoadmap: feature.is_public_roadmap,
        isStrategicPath: feature.is_strategic_path, 
        businessObjective: feature.business_objective,
        targetUsers: feature.target_users,
        successMetrics: feature.success_metrics,
        technicalComplexity: feature.technical_complexity,
        userFlow: feature.user_flow,
        aiAnalysisResult: feature.ai_analysis_result,
        aiAnalyzedAt: feature.ai_analyzed_at,
        syncedAt: feature.synced_at,
        createdAt: feature.created_at,
        updatedAt: feature.updated_at,
        estimatedHours: feature.estimated_hours,
        actualHours: feature.actual_hours,
        startDate: feature.start_date,
        completedDate: feature.completed_date,
        requestedBy: feature.requested_by,
        assignedTo: feature.assigned_to,
      }));
      
      // If roadmap=true, filter to only roadmap-visible features
      if (roadmap === 'true') {
        const roadmapFeatures = transformedFeatures.filter((f: any) => f.isPublicRoadmap !== false);
        return res.json(roadmapFeatures);
      } else {
        return res.json(transformedFeatures);
      }
    } catch (error) {
      res.status(500).json({ 
        message: 'Failed to fetch features',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });
  
  // Sync to production endpoint (should only work during deployment)
  app.post('/api/features/trigger-sync', requireAuth, async (req: any, res) => {
    try {
      // Only allow sync in development environment or during deployment
      if (process.env.NODE_ENV === 'production' && !process.env.DEPLOYMENT_CONTEXT) {
        return res.status(403).json({
          message: 'Production database sync is only allowed during deployment',
          code: 'SYNC_FORBIDDEN_IN_PRODUCTION'
        });
      }
      
      // Mock response for now - this would normally sync to production database
      return res.json({
        success: true,
        message: process.env.NODE_ENV === 'development' 
          ? 'Development environment: Sync simulation completed'
          : 'Features synchronized to production database',
        syncedAt: new Date().toISOString(),
        syncedCount: 0 // Would be actual count in real implementation
      });
    } catch (error) {
      res.status(500).json({
        message: 'Failed to sync to production',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });
  
  // Basic API routes
  // Note: /api/health endpoint is defined in index.ts with deployment-specific error handling
  
  if (process.env.NODE_ENV !== 'production') {
    app.post('/api/test', (req, res) => {
      return res.json({ message: 'API working', body: req.body });
    });
  }

  // File upload endpoint for demands and other general uploads
  app.post('/api/upload', requireAuth, upload.array('file', 5), async (req: any, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ 
          error: 'No files uploaded',
          message: 'Please select at least one file to upload',
          code: 'NO_FILES'
        });
      }

      // Generate file info including original names
      const uploadedFiles = files.map(file => ({
        url: `/uploads/demands/${file.filename}`,
        originalName: file.originalname,
        size: file.size
      }));

      return res.json({ 
        message: 'Files uploaded successfully',
        files: uploadedFiles,
        fileUrls: uploadedFiles.map(f => f.url), // Keep for backward compatibility
        fileCount: files.length
      });
    } catch (error: any) {
      res.status(500).json({ 
        error: 'File upload failed',
        message: 'Unable to process the uploaded files',
        code: 'UPLOAD_ERROR'
      });
    }
  });
  
  // SECURITY FIX: Removed direct static file serving - replaced with two authenticated endpoints:
  // 1. /uploads/demands/* — serves demand-specific attachments (checks demand ownership)
  // 2. /uploads/:orgId/:category/:fileId — serves org-scoped files (checks org membership)
  
  // Demand file access endpoint - handles /uploads/demands/* URLs
  app.get('/uploads/demands/*', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const fileName = req.params[0]; // Everything after /uploads/demands/
      
      logDebug(`[DEMAND FILE] User requesting file`, { userId: user.id, metadata: { role: user.role, fileName } });
      
      // Find the demand with this file by matching against filePath (which contains the server-generated filename)
      // Note: fileName column now stores the original user filename for display
      const requestedPath = `/uploads/demands/${fileName}`;
      const [demand] = await db.select().from(demands).where(eq(demands.filePath, requestedPath)).limit(1);
      
      if (!demand) {
        logDebug(`[DEMAND FILE] No demand found for file`, { metadata: { fileName } });
        return res.status(404).json({ error: 'File not found' });
      }
      
      logDebug(`[DEMAND FILE] Checking access for demand`, { userId: user.id, metadata: { demandId: demand.id, submitterId: demand.submitterId } });
      
      // Access check: user created demand OR is admin/manager
      const hasAccess = 
        demand.submitterId === user.id || 
        user.role === 'admin' || 
        user.role === 'manager' ||
        user.role === 'demo_manager';
      
      if (!hasAccess) {
        logWarn(`[DEMAND FILE] Access DENIED`, { userId: user.id });
        return res.status(403).json({ error: 'Access denied' });
      }
      
      logDebug(`[DEMAND FILE] Access GRANTED`, { userId: user.id });
      
      // Build and verify file path - use /tmp/uploads for persistent storage
      const sanitizedFileName = fileName.replace(/\.\./g, '').replace(/^\/+/, '');
      const safeFilePath = path.join('/tmp', 'uploads', 'demands', sanitizedFileName);
      const uploadsDir = path.resolve('/tmp', 'uploads');
      const resolvedPath = path.resolve(safeFilePath);
      
      if (!resolvedPath.startsWith(uploadsDir)) {
        logWarn(`[DEMAND FILE] Path traversal attempt detected`, { metadata: { resolvedPath } });
        return res.status(403).json({ error: 'Invalid file path' });
      }
      
      if (!fs.existsSync(resolvedPath)) {
        logDebug(`[DEMAND FILE] File not found on disk`, { metadata: { resolvedPath } });
        return res.status(404).json({ error: 'File not found on disk' });
      }
      
      logDebug(`[DEMAND FILE] Serving file`, { metadata: { resolvedPath } });
      res.sendFile(resolvedPath);
      
    } catch (error: any) {
      logError(`[DEMAND FILE] Error serving file`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Secure authenticated file serving endpoint
  app.get('/uploads/:orgId/:category/:fileId', requireAuth, async (req: any, res) => {
    try {
      const { orgId, category, fileId } = req.params;
      const user = req.user;
      
      // Validate parameters to prevent path traversal
      if (!orgId.match(/^[a-zA-Z0-9_-]+$/) || !category.match(/^[a-zA-Z0-9_-]+$/) || !fileId.match(/^[a-zA-Z0-9._-]+$/)) {
        return res.status(400).json({ error: 'Invalid file path parameters' });
      }
      
      // Check if user has access to this organization's files
      // This would need to be implemented based on your organization access logic
      const userOrgs = await import('./storage').then(({ storage }) => storage.getUserOrganizations(user.id));
      const hasOrgAccess = userOrgs.some(org => org.organizationId === orgId);
      
      if (!hasOrgAccess && user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Construct safe file path within uploads directory only - use /tmp/uploads for persistent storage
      const safeFilePath = path.join('/tmp', 'uploads', orgId, category, fileId);
      const uploadsDir = path.resolve('/tmp', 'uploads');
      const requestedPath = path.resolve(safeFilePath);
      
      // Ensure the resolved path is within uploads directory (prevent directory traversal)
      if (!requestedPath.startsWith(uploadsDir)) {
        return res.status(403).json({ error: 'Access denied - invalid file path' });
      }
      
      // Check if file exists
      if (!fs.existsSync(requestedPath)) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Serve the file
      return res.sendFile(requestedPath);
      
    } catch (error: any) {
      logError('Secure file serving error', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  

  if (process.env.NODE_ENV !== 'production') {
    app.get('/api/debug/simple', (req, res) => {
      logDebug('Simple debug endpoint called');
      res.json({ 
        status: 'working',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown',
        databaseUrl: process.env.DATABASE_URL ? 'present' : 'missing'
      });
    });

    app.get('/api/debug/storage', async (req, res) => {
      const timestamp = new Date().toISOString();
      logDebug('Storage debug endpoint called');
      
      try {
        const { storage } = await import('./storage');
        const testResult = await storage.getDocuments({ residenceId: 'e27ac924-8120-4904-a791-d1e9db544d58' });
        
        res.json({ 
          success: true,
          timestamp,
          documentsCount: testResult.length,
          storageType: storage.constructor.name
        });
      } catch (error: any) {
        res.status(500).json({ 
          success: false,
          timestamp,
          error: error.message,
        });
      }
    });

    app.get('/api/debug/user-info', async (req: any, res) => {
      try {
        if (!req.session?.userId && !req.session?.user) {
          return res.status(401).json({
            message: 'No session found',
            session: req.session
          });
        }

        const user = req.user || req.session?.user;
        const userId = req.session?.userId;

      // Get user from database directly
      const { db } = await import('./db');
      const { users, userOrganizations, organizations } = await import('../shared/schema');
      const { eq } = await import('drizzle-orm');

      const userFromDb = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      const userOrgs = await db
        .select({
          organizationId: userOrganizations.organizationId,
          organizationName: organizations.name,
          canAccessAllOrganizations: userOrganizations.canAccessAllOrganizations,
          isActive: userOrganizations.isActive,
        })
        .from(userOrganizations)
        .innerJoin(organizations, eq(userOrganizations.organizationId, organizations.id))
        .where(eq(userOrganizations.userId, userId));

      res.json({
        session: {
          userId: req.session?.userId,
          hasUser: !!user,
          userRole: req.session?.userRole,
        },
        userFromMiddleware: user,
        userFromDatabase: userFromDb[0],
        userOrganizations: userOrgs,
        rawSession: req.session
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message,
      });
    }
  });
  } // end dev-only debug endpoints

  // Object Storage endpoints (from javascript_object_storage blueprint)
  
  // Serve private objects from object storage with ACL check
  app.get('/objects/*', requireAuth, async (req: any, res) => {
    const userId = req.user?.id;
    const { ObjectStorageService, ObjectNotFoundError } = await import('./objectStorage');
    const { ObjectPermission } = await import('./objectAcl');
    
    const objectStorageService = new ObjectStorageService();
    try {
      // Reconstruct full object key from wildcard match (req.params[0] contains everything after /objects/)
      const objectKey = `/objects/${req.params[0]}`;
      const objectFile = await objectStorageService.getObjectEntityFile(objectKey);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(403);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      logError('Error accessing object', error as Error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Get presigned URL for uploading demand files to object storage
  app.post('/api/demands/upload-url', requireAuth, async (req: any, res) => {
    try {
      const { filename } = req.body;
      
      if (!filename) {
        return res.status(400).json({ error: 'Filename is required' });
      }
      
      const { randomUUID } = await import('crypto');
      const demandId = randomUUID();
      // Sanitize filename to prevent path traversal
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const objectPath = `demands/${demandId}/${sanitizedFilename}`;
      
      const { ObjectStorageService } = await import('./objectStorage');
      const objectStorageService = new ObjectStorageService();
      const uploadUrl = await objectStorageService.getCustomPathUploadURL(objectPath);
      
      res.json({ 
        uploadUrl, 
        objectPath: `/objects/${objectPath}`,
        demandId 
      });
    } catch (error: any) {
      logError('Error getting demand upload URL', error);
      res.status(500).json({ 
        error: 'Failed to get upload URL',
        message: error.message 
      });
    }
  });

  
  // SEO routes: robots.txt and sitemap.xml (must be before SPA catch-all)
  const SEO_PUBLIC_PATHS = [
    '/',
    '/features',
    '/pricing',
    '/security',
    '/story',
    '/privacy-policy',
    '/terms-of-service',
  ];

  app.get('/robots.txt', (req, res) => {
    const origin = `${req.protocol}://${req.get('host')}`;
    const body = [
      'User-agent: *',
      'Allow: /',
      'Disallow: /api/',
      'Disallow: /admin/',
      'Disallow: /manager/',
      'Disallow: /residents/',
      'Disallow: /resident/',
      'Disallow: /dashboard/',
      'Disallow: /settings/',
      'Disallow: /auth/',
      'Disallow: /mcp/',
      `Sitemap: ${origin}/sitemap.xml`,
      '',
    ].join('\n');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(body);
  });

  app.get('/sitemap.xml', (req, res) => {
    const origin = `${req.protocol}://${req.get('host')}`;
    const lastmod = new Date().toISOString().slice(0, 10);
    const urls = SEO_PUBLIC_PATHS.flatMap((p) => {
      const base = `${origin}${p === '/' ? '' : p}`;
      const frUrl = `${base}${base.includes('?') ? '&' : '?'}lang=fr`;
      const enUrl = `${base}${base.includes('?') ? '&' : '?'}lang=en`;
      const priority = p === '/' ? '1.0' : '0.7';
      const renderEntry = (loc: string) =>
        `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n    <xhtml:link rel="alternate" hreflang="fr-CA" href="${frUrl}" />\n    <xhtml:link rel="alternate" hreflang="en-CA" href="${enUrl}" />\n    <xhtml:link rel="alternate" hreflang="x-default" href="${base}" />\n  </url>`;
      return [renderEntry(base), renderEntry(frUrl), renderEntry(enUrl)];
    }).join('\n');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  });

  // Static file serving - MUST come after API routes to prevent conflicts
  // In development mode, Vite middleware handles frontend - skip static file setup entirely
  const isDevMode = process.env.NODE_ENV === 'development';
  const distPath = path.resolve(process.cwd(), 'dist', 'public');
  
  if (isDevMode) {
    logDebug('Development mode: Vite will handle frontend serving');
    // In development mode, Vite middleware is added AFTER this function returns (in index.ts)
    // So we DO NOT add any catch-all routes or error handlers here
    // Vite will handle all non-API routes and error handling
  } else if (fs.existsSync(distPath)) {
    logInfo('Setting up static file serving from ' + distPath);
    
    // Serve static assets with appropriate cache headers
    app.use(express.static(distPath, {
      // Disable caching for development to ensure fresh files
      setHeaders: (res, filepath) => {
        if (process.env.NODE_ENV === 'development') {
          // Development: disable all caching for immediate updates
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else {
          // Production: cache assets based on type
          if (filepath.endsWith('.html')) {
            // HTML files should not be cached to ensure routing works
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
          } else if (filepath.includes('/assets/') && /\-[A-Za-z0-9_-]{8,}\.(js|css)$/.test(filepath)) {
            // Hashed assets (Vite content-hashed chunks) are immutable - cache for 1 year
            // This prevents 429 errors from repeated chunk loading
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            // Other assets (images, fonts, etc.) cached with revalidation
            res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
          }
        }
      }
    }));
    
    // SPA fallback - serve index.html for non-API routes
    app.get('*', (req, res) => {
      // Don't serve index.html for API routes
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ message: 'API endpoint not found', error: 'API endpoint not found' });
      }
      
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        // Ensure index.html is never cached
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Application not found - build missing');
      }
    });
    
    // Add error handlers at the end
    app.use(notFoundHandler);
    app.use(secureErrorHandler);
  } else {
    logWarn('Static files not found, only API routes available');
    
    // Fallback for missing static files
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ message: 'API endpoint not found', error: 'API endpoint not found' });
      }
      res.status(503).send('Application is starting up...');
    });
    
    // Add error handlers at the end
    app.use(notFoundHandler);
    app.use(secureErrorHandler);
  }
  
  logInfo('All routes registered successfully');
}