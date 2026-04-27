// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
// Main routes file that loads route definitions  
import express, { Express } from 'express';
import { setupAuthRoutes, sessionConfig } from './auth';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { requireAuth, requireSuperAdmin } from './auth/index';
import { secureErrorHandler, notFoundHandler } from './middleware/error-security';
import { enforceDemoSecurity } from './middleware/demo-security';
import { logDebug, logInfo, logWarn, logError } from './utils/logger';
import { fixLatin1MisdecodeFilename } from './utils/filenameNormalization';

// NOTE: MCP modules are intentionally NOT imported at the top level. They
// are pulled in via the lazy-mount trampoline (see `lazyMount` calls below)
// only when a real request hits an MCP/OAuth prefix, so the OAuth provider
// singleton, transports, and SDK code never pay their boot cost on a
// production deploy that doesn't actually receive MCP traffic.

// Import API route registration functions
//
// NOTE: The largest registrars (users, budgets, common-spaces, buildings,
// organizations, demands) are intentionally NOT imported at the top level.
// They are wired through `HEAVY_LAZY_MOUNTS` below so their service-layer
// dependencies (bcrypt, AI helpers, drizzle query builders, validators,
// cache stores) only enter `require.cache` on the first matching request.
import { registerDocumentTagRoutes } from './api/document-tags';
import { seedKoveoDocumentTags } from './api/document-tags-seed';
import { registerDocumentLinkFamilyRoutes } from './api/document-link-families';
import { seedKoveoDocumentLinkFamilies } from './api/document-link-families-seed';
import { registerResidenceRoutes } from './api/residences';
import { registerContactRoutes } from './api/contacts';
import { registerPermissionsRoutes } from './api/permissions';
import { registerTrialRequestRoutes } from './api/trial-request';
import { registerInvoiceRoutes } from './api/invoices';
import { registerPillarsSuggestionsRoutes } from './api/pillars-suggestions';
import { registerQualityMetricsRoutes } from './api/quality-metrics';
import { registerFeatureManagementRoutes } from './api/feature-management';
import { lazyMount, type LazyRouteMatcher, type RouteRegistrar } from './utils/lazy-mount';
import { assertHeavyModulesNotEagerlyLoaded } from './utils/heavy-module-guard';
import { registerAutoRoutes } from './api/auto/_register';
import law25ComplianceRouter from './routes/law25-compliance';
import { performanceRouter } from './performance-api';
import { webVitalsRouter } from './web-vitals-api';
import { db } from './db';
import { config } from './config';
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
  // Force utf8 multipart param parsing so French/diacritic filenames survive
  // (multer 2.x defaults to latin1, which mangles "Procès-verbal été 2024.pdf").
  defParamCharset: 'utf8',
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
  
  // The MCP server (OAuth provider, transports, tool registration) is opt-in
  // in production: it costs noticeable boot memory and is not used by the
  // user-facing app. Default OFF in production; default ON in dev/test so
  // local workflows keep working unchanged. Set ENABLE_MCP_SERVER=true on a
  // production deploy to turn it on.
  //
  // Even when enabled, the MCP module graph (OAuth provider singleton,
  // SDK transports, tool registry) is loaded LAZILY via `mountLazyRouter`:
  // the first request to a matching prefix triggers a single dynamic import
  // and route registration; subsequent requests bypass the trampoline. This
  // means a deploy that opts in but never receives an MCP request pays zero
  // boot cost. A misconfiguration (e.g. missing MCP_OAUTH_ISSUER in prod)
  // therefore can no longer abort `registerRoutes` — the SPA catch-all is
  // always installed and any error surfaces only on the first /mcp hit.
  const mcpEnabled =
    process.env.ENABLE_MCP_SERVER === 'true' ||
    (process.env.NODE_ENV !== 'production' && process.env.ENABLE_MCP_SERVER !== 'false');

  // Memoized loader so both the pre-session (MCP + OAuth issuer endpoints)
  // and post-session (OAuth consent UI) lazy mounts share a SINGLE dynamic
  // import. Node's module cache would already dedupe back-to-back imports,
  // but holding the promise ourselves keeps the contract obvious and lets
  // the two registrars use the same `koveoMcpOAuthProvider` singleton.
  const loadMcpModule = (() => {
    let cached: Promise<typeof import('./mcp/index')> | null = null;
    return () => (cached ??= import('./mcp/index'));
  })();

  if (mcpEnabled) {
    // Pre-session: MCP transport endpoints + the SDK's OAuth issuer routes.
    // These must run BEFORE sessionConfig because /mcp uses bearer/API-key
    // auth and intentionally does not touch the user session.
    lazyMount(
      app,
      [
        '/mcp',
        '/register',
        '/authorize',
        '/token',
        '/revoke',
        '/.well-known/oauth-authorization-server',
        '/.well-known/oauth-protected-resource',
      ],
      async () => {
        const mod = await loadMcpModule();
        // The lazy-mount trampoline hands us a `Router`, which structurally
        // satisfies every method `registerMcpRoutes` calls (use/get/post/
        // delete). The cast is safe at runtime; TypeScript just can't narrow
        // a Router to the wider `Express` application type.
        return (registry) =>
          mod.registerMcpRoutes(registry as unknown as Express);
      },
    );
  } else {
    console.log('[ROUTES] MCP server disabled (set ENABLE_MCP_SERVER=true to enable).');
  }

  // CRITICAL: Apply session middleware BEFORE authentication routes
  app.use(sessionConfig);

  if (mcpEnabled) {
    // Post-session: OAuth consent UI reads/writes req.session to detect the
    // signed-in Koveo user, so it MUST be mounted after sessionConfig.
    lazyMount(app, '/oauth/consent', async () => {
      const mod = await loadMcpModule();
      return (registry) => {
        mod.registerOAuthConsentRoutes(
          registry as unknown as Express,
          mod.koveoMcpOAuthProvider,
        );
      };
    });
  }
  
  
  // Setup authentication routes - session middleware must be applied first
  setupAuthRoutes(app);
  
  // CRITICAL SECURITY: Apply demo security middleware to all API routes
  // This must come AFTER authentication but BEFORE route registration
  // Auth endpoints are exempted in the middleware itself (login, logout, etc.)
  app.use('/api/*', enforceDemoSecurity());
  
  // Register all API routes
  registerDocumentTagRoutes(app);
  // Idempotent seeding of Koveo system tags (safe to run on every startup)
  void seedKoveoDocumentTags();
  registerDocumentLinkFamilyRoutes(app);
  void seedKoveoDocumentLinkFamilies();

  registerResidenceRoutes(app);
  registerContactRoutes(app);
  registerPermissionsRoutes(app);
  registerTrialRequestRoutes(app);
  registerInvoiceRoutes(app);
  registerPillarsSuggestionsRoutes(app);
  registerQualityMetricsRoutes(app);
  registerFeatureManagementRoutes(app);

  // Lazy-loaded route modules — heavy modules whose service-layer
  // dependencies (AI helpers, validators, cache stores) are only pulled in
  // on first matching request. See server/utils/lazy-mount.ts. The matcher
  // and loader for each mount lives in `HEAVY_LAZY_MOUNTS` (exported below)
  // so the lazy-mount regression test can iterate the SAME values without
  // copy-paste drift.
  for (const spec of HEAVY_LAZY_MOUNTS) {
    lazyMount(app, spec.matcher, spec.loader);
  }

  // Auto-discovered API modules (drop new files in `server/api/auto/` —
  // see `server/api/auto/README.md`). This is the ONLY hook needed to add
  // new feature endpoints; do NOT add new `register*Routes` calls above.
  await registerAutoRoutes(app);

  // Performance monitoring routes
  app.use(performanceRouter);
  app.use(webVitalsRouter);
  
  // Law 25 compliance routes — restricted to internal Koveo staff because
  // the response surfaces raw file paths, line numbers and Semgrep rule IDs.
  app.use('/api/law25-compliance', requireAuth, requireSuperAdmin, law25ComplianceRouter);
  
  
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
  
  // Sync to production endpoint (should only work during deployment).
  // Super-admin only — features is Koveo's internal product roadmap, no
  // customer admin/manager/resident should be able to trigger a sync.
  app.post('/api/features/trigger-sync', requireAuth, requireSuperAdmin, async (req: any, res) => {
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

      // Generate file info including original names.
      // Apply Latin-1 mis-decode fix so accented filenames (e.g.
      // "Procès-verbal été 2024.pdf") round-trip correctly (Task #1470).
      const uploadedFiles = files.map(file => ({
        url: `/uploads/demands/${file.filename}`,
        originalName: fixLatin1MisdecodeFilename(file.originalname),
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
      
      if (!hasOrgAccess && user.role !== 'super_admin') {
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
        databaseUrl: config.database.url ? 'present' : 'missing',
        database: config.database.url ? config.database.urlMasked : null,
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
      // Sanitize filename to prevent path traversal (shared canonical helper)
      const { normalizeFilename } = await import('./utils/filenameNormalization');
      const sanitizedFilename = normalizeFilename(filename);
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

  // Fail fast (in dev/test) if any module that's supposed to be lazy-mounted
  // ended up in require.cache during route registration. See
  // server/utils/heavy-module-guard.ts for the full rationale.
  assertHeavyModulesNotEagerlyLoaded({ denylist: HEAVY_LAZY_MOUNT_DENYLIST });
}

/**
 * Heavy lazy-mount specs wired into `registerRoutes` above. Exported so the
 * regression test in `tests/integration/heavy-lazy-mounts.test.ts` can iterate
 * the EXACT matchers + loaders that production registers — preventing silent
 * drift if a new lazy mount is added or an existing one is un-lazied.
 *
 * `modulePath` is the repo-relative source path of the module each loader
 * imports. {@link HEAVY_LAZY_MOUNT_DENYLIST} below derives from these so the
 * boot-time guard (see `server/utils/heavy-module-guard.ts`) and the
 * lazy-mount registration share a single source of truth.
 */
export interface HeavyLazyMountSpec {
  /** Stable name used for test labels and diagnostics. */
  name: string;
  matcher: LazyRouteMatcher;
  loader: () => Promise<RouteRegistrar>;
  /** Source path the loader imports (no extension). */
  modulePath: string;
  /**
   * HTTP methods this route group actually serves (e.g. `['GET', 'POST',
   * 'PATCH', 'DELETE']`).  When provided, the sanitisation-bypass rule built
   * by `buildLegacyBypassFromApp` only matches requests whose method is in
   * this set.  Omitting the field falls back to the previous all-methods
   * bypass, which is kept for backward compatibility with route groups that
   * have not yet declared their verbs.
   */
  methods?: readonly string[];
}

// Bills owns /api/bills/* AND a couple of /api/buildings/:id/bills/* endpoints.
// Match the latter by regex so generic /api/buildings traffic doesn't trigger
// the bills module load.
const BILLS_BUILDING_PATTERN = /^\/api\/buildings\/[^/]+\/bills(?:\/|$)/;

// The buildings module also owns the `/api/buildings/:id/bills/*` URL space
// from the bills perspective — but bills is a SEPARATE lazy mount. We must
// NOT load the buildings module just because a request hits a bills sub-URL,
// otherwise the bills regex test (and the boot-cost gain in production) is
// silently undone. The matcher below excludes the bills regex branch.
function buildingsLazyMatcher(path: string): boolean {
  if (BILLS_BUILDING_PATTERN.test(path)) return false;
  return (
    path.startsWith('/api/buildings') ||
    path.startsWith('/api/admin/buildings') ||
    path.startsWith('/api/manager/buildings')
  );
}

export const HEAVY_LAZY_MOUNTS: readonly HeavyLazyMountSpec[] = [
  {
    name: 'documents',
    matcher: '/api/documents',
    loader: async () => (await import('./api/documents')).registerDocumentRoutes,
    modulePath: 'server/api/documents',
  },
  {
    name: 'bills',
    matcher: (path: string) =>
      path.startsWith('/api/bills') || BILLS_BUILDING_PATTERN.test(path),
    loader: async () => (await import('./api/bills')).registerBillRoutes,
    modulePath: 'server/api/bills',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
  {
    name: 'communication',
    matcher: '/api/communication',
    loader: async () => (await import('./api/communication')).registerCommunicationRoutes,
    modulePath: 'server/api/communication',
  },
  {
    name: 'maintenance',
    matcher: '/api/maintenance',
    loader: async () => (await import('./api/maintenance')).registerMaintenanceRoutes,
    modulePath: 'server/api/maintenance',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
  {
    name: 'demo',
    matcher: '/api/demo',
    loader: async () => (await import('./api/demo-management')).registerDemoManagementRoutes,
    modulePath: 'server/api/demo-management',
  },
  {
    name: 'ai',
    matcher: '/api/ai',
    loader: async () => (await import('./api/ai-document-analysis')).registerAiAnalysisRoutes,
    modulePath: 'server/api/ai-document-analysis',
  },
  {
    name: 'admin-bulk-import',
    matcher: '/api/admin/bulk-import',
    loader: async () => (await import('./api/bulk-import')).registerBulkImportRoutes,
    modulePath: 'server/api/bulk-import',
  },
  {
    name: 'admin-kpi',
    matcher: '/api/admin/kpi',
    loader: async () => (await import('./api/kpi')).registerKpiRoutes,
    modulePath: 'server/api/kpi',
  },
  // Task #489: defer the six largest eager registrars. Each one previously
  // sat on `CHEAP_HEAVY_ALLOWLIST` despite pulling in heavy dependency
  // graphs (bcrypt, drizzle query builders, validators, cache stores).
  {
    name: 'users',
    matcher: [
      '/api/users',
      '/api/user-organizations',
      '/api/user-residences',
      '/api/user/permissions',
      '/api/admin/all-user-organizations',
      '/api/admin/all-user-residences',
      '/api/invitations',
    ],
    loader: async () => (await import('./api/users')).registerUserRoutes,
    modulePath: 'server/api/users',
  },
  {
    name: 'organizations',
    matcher: ['/api/organizations', '/api/admin/organizations'],
    loader: async () =>
      (await import('./api/organizations')).registerOrganizationRoutes,
    modulePath: 'server/api/organizations',
  },
  {
    name: 'buildings',
    matcher: buildingsLazyMatcher,
    loader: async () =>
      (await import('./api/buildings')).registerBuildingRoutes,
    modulePath: 'server/api/buildings',
  },
  {
    name: 'demands',
    matcher: '/api/demands',
    loader: async () => (await import('./api/demands')).registerDemandRoutes,
    modulePath: 'server/api/demands',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
  {
    name: 'common-spaces',
    matcher: '/api/common-spaces',
    loader: async () =>
      (await import('./api/common-spaces')).registerCommonSpacesRoutes,
    modulePath: 'server/api/common-spaces',
  },
  {
    name: 'budgets',
    matcher: '/api/budgets',
    loader: async () => {
      // Budgets exports a default `Router` (rather than a `register*Routes`
      // function) and is mounted under `/api/budgets` with `requireAuth`.
      // The lazy registrar just re-applies the same wiring on the
      // trampoline's internal router, so the existing route paths
      // (`/:buildingId`, `/:buildingId/summary`, ...) keep resolving as
      // before — only the import is deferred.
      const { default: budgetRouter } = await import('./api/budgets');
      return (registry) => {
        (registry as Express).use('/api/budgets', requireAuth, budgetRouter);
      };
    },
    modulePath: 'server/api/budgets',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
];

/**
 * Module paths the boot-time guard refuses to see in `require.cache` after
 * `registerRoutes()` returns. Derived from {@link HEAVY_LAZY_MOUNTS} so adding
 * a new lazy mount automatically gets the "stay lazy" enforcement — plus
 * `server/mcp/index`, which is lazy-mounted directly inside `registerRoutes`
 * (it isn't in HEAVY_LAZY_MOUNTS because its mount is gated on
 * ENABLE_MCP_SERVER and split across pre-/post-session blocks).
 */
export const HEAVY_LAZY_MOUNT_DENYLIST: readonly string[] = [
  'server/mcp/index',
  ...HEAVY_LAZY_MOUNTS.map((m) => m.modulePath),
];