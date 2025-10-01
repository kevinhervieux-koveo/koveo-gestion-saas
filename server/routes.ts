// Main routes file that loads route definitions  
import express, { Express } from 'express';
import { setupAuthRoutes, sessionConfig } from './auth';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { requireAuth } from './auth/index';
import { secureErrorHandler, notFoundHandler } from './middleware/error-security';

// Import API route registration functions
import { registerOrganizationRoutes } from './api/organizations';
import { registerUserRoutes } from './api/users';
import { registerBuildingRoutes } from './api/buildings';
import { registerDocumentRoutes } from './api/documents';
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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'demands');
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
  
  // CRITICAL: Apply session middleware BEFORE authentication routes
  app.use(sessionConfig);
  
  
  // Setup authentication routes - session middleware must be applied first
  setupAuthRoutes(app);
  
  // Register all API routes
  registerOrganizationRoutes(app);
  registerUserRoutes(app);
  registerBuildingRoutes(app);
  registerDocumentRoutes(app);
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
  
  app.post('/api/test', (req, res) => {
    return res.json({ message: 'API working', body: req.body });
  });

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

      // Generate file URLs/paths for the uploaded files
      const fileUrls = files.map(file => {
        return `/uploads/demands/${file.filename}`;
      });


      return res.json({ 
        message: 'Files uploaded successfully',
        fileUrls: fileUrls,
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
  
  // SECURITY FIX: Removed direct static file serving - replaced with authenticated endpoints below
  // Old vulnerable code: app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  
  // Legacy support for simple file access (MUST come before the more specific route)
  app.get('/uploads/demands/*', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const fileName = req.params[0]; // Everything after /uploads/demands/
      
      console.log(`[DEMAND FILE ACCESS] User ${user.id} (${user.role}) requesting: ${fileName}`);
      
      // Query the database to find the demand with this file
      const { db } = await import('./db');
      const { demands } = await import('../shared/schemas/operations');
      const { eq } = await import('drizzle-orm');
      
      const [demand] = await db.select().from(demands).where(eq(demands.fileName, fileName)).limit(1);
      
      if (!demand) {
        console.log(`[DEMAND FILE ACCESS] No demand found with fileName: ${fileName}`);
        return res.status(404).json({ error: 'File not found' });
      }
      
      console.log(`[DEMAND FILE ACCESS] Found demand ${demand.id}, submitter: ${demand.submitterId}, user: ${user.id}, role: ${user.role}`);
      
      // Check if user has access to this demand
      // Users can access demands they submitted or if they're admin/manager for the building
      const hasAccess = 
        demand.submitterId === user.id || // User created the demand
        user.role === 'admin' || // Admin has access to all
        user.role === 'manager'; // Manager has access to all (could be refined by building)
      
      console.log(`[DEMAND FILE ACCESS] Access check result: ${hasAccess}`);
      
      if (!hasAccess) {
        console.log(`[DEMAND FILE ACCESS] Access denied for user ${user.id}`);
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You do not have permission to access this file'
        });
      }
      
      console.log(`[DEMAND FILE ACCESS] Access granted for user ${user.id}`);
      
      // Sanitize and construct safe file path
      const sanitizedFileName = fileName.replace(/\.\.[\\\/]/g, '').replace(/^[\\\/]+/, '');
      const safeFilePath = path.join(process.cwd(), 'uploads', 'demands', sanitizedFileName);
      const uploadsDir = path.resolve(process.cwd(), 'uploads');
      const resolvedPath = path.resolve(safeFilePath);
      
      // Ensure the resolved path is within uploads directory
      if (!resolvedPath.startsWith(uploadsDir)) {
        return res.status(403).json({ error: 'Access denied - invalid file path' });
      }
      
      // Check if file exists
      if (!fs.existsSync(resolvedPath)) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Serve the file
      res.sendFile(resolvedPath);
      
    } catch (error: any) {
      console.error('Demand file serving error:', error);
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
      
      // Construct safe file path within uploads directory only
      const safeFilePath = path.join(process.cwd(), 'uploads', orgId, category, fileId);
      const uploadsDir = path.resolve(process.cwd(), 'uploads');
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
      console.error('Secure file serving error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Legacy support for simple file access (still authenticated)
  app.get('/uploads/*', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const requestedPath = req.params[0]; // Everything after /uploads/
      
      console.log(`[FILE ACCESS] User ${user.id} (${user.role}) requesting: ${requestedPath}`);
      
      // Check if this is a demand file
      const isDemandFile = requestedPath.startsWith('demands/');
      
      // For demand files, verify user has access to the demand
      if (isDemandFile) {
        const fileName = path.basename(requestedPath);
        console.log(`[FILE ACCESS] Demand file detected: ${fileName}`);
        
        // Query the database to find the demand with this file
        const { db } = await import('./db');
        const { demands } = await import('../shared/schemas/operations');
        const { eq } = await import('drizzle-orm');
        
        const [demand] = await db.select().from(demands).where(eq(demands.fileName, fileName)).limit(1);
        
        if (!demand) {
          console.log(`[FILE ACCESS] No demand found with fileName: ${fileName}`);
          return res.status(404).json({ error: 'File not found' });
        }
        
        console.log(`[FILE ACCESS] Found demand ${demand.id}, submitter: ${demand.submitterId}, user: ${user.id}, role: ${user.role}`);
        
        // Check if user has access to this demand
        // Users can access demands they submitted or if they're admin/manager for the building
        const hasAccess = 
          demand.submitterId === user.id || // User created the demand
          user.role === 'admin' || // Admin has access to all
          user.role === 'manager'; // Manager has access to all (could be refined by building)
        
        console.log(`[FILE ACCESS] Access check result: ${hasAccess}`);
        
        if (!hasAccess) {
          console.log(`[FILE ACCESS] Access denied for user ${user.id}`);
          return res.status(403).json({ 
            error: 'Access denied',
            message: 'You do not have permission to access this file'
          });
        }
        
        console.log(`[FILE ACCESS] Access granted for user ${user.id}`);
      } else {
        // For non-demand files, only allow admin access
        if (user.role !== 'admin') {
          return res.status(403).json({ 
            error: 'Direct file access requires admin privileges',
            message: 'Please use the appropriate API endpoints for file access'
          });
        }
      }
      
      // Sanitize the path
      const sanitizedPath = requestedPath.replace(/\.\.[\\\/]/g, '').replace(/^[\\\/]+/, '');
      const safeFilePath = path.join(process.cwd(), 'uploads', sanitizedPath);
      const uploadsDir = path.resolve(process.cwd(), 'uploads');
      const resolvedPath = path.resolve(safeFilePath);
      
      // Ensure the resolved path is within uploads directory
      if (!resolvedPath.startsWith(uploadsDir)) {
        return res.status(403).json({ error: 'Access denied - invalid file path' });
      }
      
      // Check if file exists
      if (!fs.existsSync(resolvedPath)) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Serve the file
      res.sendFile(resolvedPath);
      
    } catch (error: any) {
      console.error('Legacy file serving error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Simple production diagnostic endpoint
  app.get('/api/debug/simple', (req, res) => {
    console.log('🔍 Simple debug endpoint called');
    res.json({ 
      status: 'working',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      databaseUrl: process.env.DATABASE_URL ? 'present' : 'missing'
    });
  });

  // Complex storage test endpoint  
  app.get('/api/debug/storage', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 🔍 Storage debug endpoint called`);
    
    try {
      console.log(`[${timestamp}] 📦 Testing storage import...`);
      const { storage } = await import('./storage');
      console.log(`[${timestamp}] ✅ Storage imported successfully`);
      
      console.log(`[${timestamp}] 🧪 Testing basic storage method...`);
      const testResult = await storage.getDocuments({ residenceId: 'e27ac924-8120-4904-a791-d1e9db544d58' });
      console.log(`[${timestamp}] ✅ Storage test successful`);
      
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
        stack: error.stack
      });
    }
  });

  // User info debug endpoint
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
        stack: error.stack
      });
    }
  });
  
  // Static file serving - MUST come after API routes to prevent conflicts
  const distPath = path.resolve(process.cwd(), 'dist', 'public');
  
  if (fs.existsSync(distPath)) {
    console.log('✅ Setting up static file serving from', distPath);
    
    // Serve static assets with appropriate cache headers
    app.use(express.static(distPath, {
      // Disable caching for development to ensure fresh files
      setHeaders: (res, path) => {
        if (process.env.NODE_ENV === 'development') {
          // Development: disable all caching for immediate updates
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else {
          // Production: cache assets but allow revalidation
          if (path.endsWith('.html')) {
            // HTML files should not be cached to ensure routing works
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
          } else {
            // Other assets can be cached with revalidation
            res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
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
    console.log('⚠️ Static files not found, only API routes available');
    
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
  
  console.log('✅ All routes registered successfully');
}