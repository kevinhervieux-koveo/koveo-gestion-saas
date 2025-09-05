// Main routes file that loads route definitions  
import express, { Express } from 'express';
import { setupAuthRoutes, sessionConfig } from './auth';
import path from 'path';
import fs from 'fs';

// Import API route registration functions
import { registerOrganizationRoutes } from './api/organizations';
import { registerUserRoutes } from './api/users';
import { registerBuildingRoutes } from './api/buildings';
import { registerDocumentRoutes } from './api/documents';
import { registerBugRoutes } from './api/bugs';
import { registerBillRoutes } from './api/bills';
import { registerResidenceRoutes } from './api/residences';
import { registerDemandRoutes } from './api/demands';
import { registerFeatureRequestRoutes } from './api/feature-requests';
import { registerContactRoutes } from './api/contacts';
import { registerCommonSpacesRoutes } from './api/common-spaces';
import { registerPermissionsRoutes } from './api/permissions';
import { registerDemoManagementRoutes } from './api/demo-management';
import { registerTrialRequestRoutes } from './api/trial-request';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth } from './auth/index';

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
  console.log('🔄 Setting up session middleware...');
  
  // CRITICAL: Apply session middleware BEFORE authentication routes
  app.use(sessionConfig);
  console.log('✅ Session middleware configured');
  
  console.log('🔄 Loading authentication routes...');
  
  // Setup authentication routes - session middleware must be applied first
  setupAuthRoutes(app);
  console.log('✅ Authentication routes loaded on /api/auth/');
  
  // Register all API routes
  console.log('🔄 Loading API routes...');
  registerOrganizationRoutes(app);
  registerUserRoutes(app);
  registerBuildingRoutes(app);
  registerDocumentRoutes(app);
  registerBugRoutes(app);
  registerBillRoutes(app);
  registerResidenceRoutes(app);
  registerDemandRoutes(app);
  registerFeatureRequestRoutes(app);
  registerContactRoutes(app);
  registerCommonSpacesRoutes(app);
  registerPermissionsRoutes(app);
  registerDemoManagementRoutes(app);
  registerTrialRequestRoutes(app);
  console.log('✅ All API routes registered');
  
  // Basic API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  app.post('/api/test', (req, res) => {
    res.json({ message: 'API working', body: req.body });
  });

  // File upload endpoint for demands and other general uploads
  app.post('/api/upload', requireAuth, upload.array('file', 5), async (req: any, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
      }

      // Generate file URLs/paths for the uploaded files
      const fileUrls = files.map(file => {
        return `/uploads/demands/${file.filename}`;
      });

      console.log(`✅ Successfully uploaded ${files.length} files for user ${req.user.id}:`, fileUrls);

      res.json({ 
        message: 'Files uploaded successfully',
        fileUrls: fileUrls,
        fileCount: files.length
      });
    } catch (error: any) {
      console.error('❌ File upload error:', error);
      res.status(500).json({ 
        message: 'Failed to upload files',
        error: error.message 
      });
    }
  });

  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

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
  } else {
    console.log('⚠️ Static files not found, only API routes available');
    
    // Fallback for missing static files
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ message: 'API endpoint not found', error: 'API endpoint not found' });
      }
      res.status(503).send('Application is starting up...');
    });
  }
  
  console.log('✅ All routes registered successfully');
}