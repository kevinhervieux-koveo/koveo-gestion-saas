/**
 * Production-specific server configuration
 * Handles large static files and prevents 503 errors
 */
import express from 'express';
import { log } from './vite';

export function configureProductionServer(app: express.Express) {
  // Increase server limits for large static files
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Set proper timeouts for large file serving
  app.use((req, res, next) => {
    if (req.path.startsWith('/assets/')) {
      // Increase timeout for asset files
      req.setTimeout(60000); // 60 seconds
      res.setTimeout(60000);
      
      // Set proper cache headers for assets
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    next();
  });

  // Memory management for large chunks
  if (process.env.NODE_ENV === 'production') {
    // Optimize garbage collection for large static files
    if (global.gc) {
      setInterval(() => {
        global.gc();
      }, 30000); // Run GC every 30 seconds
    }
  }

  log('✅ Production server configuration applied');
}

export function handleLargeFileErrors(app: express.Express) {
  // Specific error handler for large static files
  app.use('/assets/*', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err) {
      log(`Large file serving error for ${req.path}: ${err.message}`, 'error');
      
      // Return a more informative error for debugging
      res.status(503).json({
        error: 'Temporary service unavailable',
        message: 'Large file serving issue',
        file: req.path,
        retry: true,
        suggestion: 'Try refreshing the page or clearing browser cache'
      });
      return;
    }
    next();
  });
}