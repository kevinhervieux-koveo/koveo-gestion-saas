// Main routes file that loads route definitions
import express from 'express';
import { setupAuthRoutes, sessionConfig } from './auth';
import path from 'path';
import fs from 'fs';

export async function registerRoutes(app: express.Application) {
  console.log('🔄 Setting up session middleware...');
  
  // CRITICAL: Apply session middleware BEFORE authentication routes
  app.use(sessionConfig);
  console.log('✅ Session middleware configured');
  
  console.log('🔄 Loading authentication routes...');
  
  // Setup authentication routes - session middleware must be applied first
  setupAuthRoutes(app);
  console.log('✅ Authentication routes loaded on /api/auth/');
  
  // Basic API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  app.post('/api/test', (req, res) => {
    res.json({ message: 'API working', body: req.body });
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