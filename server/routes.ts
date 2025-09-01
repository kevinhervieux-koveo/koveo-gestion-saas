// Main routes file that loads route definitions
import express, { Express } from 'express';
import { setupAuthRoutes, sessionConfig } from './auth';
import path from 'path';
import fs from 'fs';

// Import API route registration functions
import { registerOrganizationRoutes } from './api/organizations.js';
import { registerUserRoutes } from './api/users.js';
import { registerBuildingRoutes } from './api/buildings.js';
import { registerDocumentRoutes } from './api/documents.js';
import { registerBillRoutes } from './api/bills.js';
import { registerResidenceRoutes } from './api/residences.js';
import { registerDemandRoutes } from './api/demands.js';
import { registerFeatureRequestRoutes } from './api/feature-requests.js';
import { registerContactRoutes } from './api/contacts.js';
import { registerCommonSpacesRoutes } from './api/common-spaces.js';
import { registerPermissionsRoutes } from './api/permissions.js';

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
  registerBillRoutes(app);
  registerResidenceRoutes(app);
  registerDemandRoutes(app);
  registerFeatureRequestRoutes(app);
  registerContactRoutes(app);
  registerCommonSpacesRoutes(app);
  registerPermissionsRoutes(app);
  console.log('✅ All API routes registered');
  
  // Basic API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  app.post('/api/test', (req, res) => {
    res.json({ message: 'API working', body: req.body });
  });

  // Debug endpoint to test production database access
  app.get('/api/debug/documents', async (req, res) => {
    try {
      console.log('🔍 Production debug endpoint called');
      
      const result = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown',
        databaseUrl: process.env.DATABASE_URL ? 'present' : 'missing',
        storageTest: 'attempting...'
      };

      // Import storage here to avoid circular dependencies
      const { storage } = await import('./storage.js');
      
      // Test storage connection
      try {
        const testResult = await storage.getDocuments({ residenceId: 'test-residence-id' });
        result.storageTest = 'success';
        result.documentsTableAccess = 'working';
      } catch (error) {
        result.storageTest = 'failed';
        result.error = error.message;
        console.error('🚨 Storage test failed:', error);
      }

      res.json(result);
    } catch (error) {
      console.error('🚨 Debug endpoint failed:', error);
      res.status(500).json({ 
        error: 'Debug endpoint failed', 
        message: error.message
      });
    }
  });
  
  // Static file serving - MUST come after API routes to prevent conflicts
  const distPath = path.resolve(process.cwd(), 'dist', 'public');
  
  if (fs.existsSync(distPath)) {
    console.log('✅ Setting up static file serving from', distPath);
    app.use(express.static(distPath));
    
    // SPA fallback - serve index.html for non-API routes
    app.get('*', (req, res) => {
      // Don't serve index.html for API routes
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
      }
      
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
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
        return res.status(404).json({ error: 'API endpoint not found' });
      }
      res.status(503).send('Application is starting up...');
    });
  }
  
  console.log('✅ All routes registered successfully');
}