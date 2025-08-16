import express, { type Request, Response, NextFunction } from 'express';
import { registerRoutes } from './routes';
import { setupVite, serveStatic, log } from './vite';
import { initializeDatabaseOptimizations, startPerformanceMonitoring } from './init-database-optimizations';
import { startJobs } from './jobs';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (path.startsWith('/api')) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + '…';
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Register routes and start server first to handle health checks immediately
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get('env') === 'development') {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen(
    {
      port,
      host: '0.0.0.0',
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      
      // Initialize database optimizations in background after server starts
      // This prevents blocking the health check endpoints
      initializeDatabaseOptimizationsInBackground();
      
      // Initialize background jobs after server starts
      initializeBackgroundJobsInBackground();
    }
  );
  
  /**
   * Runs database optimizations in background with timeout handling
   */
  async function initializeDatabaseOptimizationsInBackground(): Promise<void> {
    try {
      log('🚀 Starting database optimizations in background...');
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database optimization timeout after 30 seconds')), 30000);
      });
      
      const optimizationPromise = (async () => {
        await initializeDatabaseOptimizations();
        startPerformanceMonitoring();
      })();
      
      await Promise.race([optimizationPromise, timeoutPromise]);
      log('🚀 Database optimizations initialized successfully');
    } catch (error) {
      log('⚠️ Database optimization initialization failed:', String(error));
      // Continue running - don't crash the server
    }
  }
  
  /**
   * Runs background jobs initialization with timeout handling
   */
  async function initializeBackgroundJobsInBackground(): Promise<void> {
    try {
      log('🔄 Starting background jobs in background...');
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Background jobs timeout after 20 seconds')), 20000);
      });
      
      await Promise.race([startJobs(), timeoutPromise]);
      log('🔄 Background jobs initialized successfully');
    } catch (error) {
      log('⚠️ Background job initialization failed:', String(error));
      // Continue running - don't crash the server
    }
  }
})();
