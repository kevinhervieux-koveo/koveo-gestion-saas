/**
 * Production optimizations to fix static file serving and performance issues
 */
import express from 'express';
import compression from 'compression';
import { log } from './vite';

export function applyProductionOptimizations(app: express.Express) {
  // Add compression middleware for all responses
  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      // Compress all text-based content
      const contentType = res.getHeader('content-type');
      if (contentType && typeof contentType === 'string') {
        return /text|javascript|css|json|xml|svg/.test(contentType);
      }
      return compression.filter(req, res);
    }
  }));

  // Add memory management for large static files
  app.use('/assets/*', (req, res, next) => {
    // Set timeout for large files
    req.setTimeout(30000);
    res.setTimeout(30000);
    
    // Add streaming headers for large files
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    
    next();
  });

  // Error handler for static file serving
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err && req.path.startsWith('/assets/')) {
      log(`Static file error for ${req.path}: ${err.message}`, 'error');
      res.status(503).json({ error: 'Temporary service unavailable', retry: true });
      return;
    }
    next(err);
  });

  log('✅ Production optimizations applied');
}