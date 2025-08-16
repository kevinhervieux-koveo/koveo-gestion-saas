import express, { type Request, Response, NextFunction } from 'express';
import { registerRoutes } from './routes';
import { setupVite, serveStatic, log } from './vite';
import { initializeDatabaseOptimizations, startPerformanceMonitoring } from './init-database-optimizations';
import { startJobs } from './jobs';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add immediate health check endpoints before any other middleware
// These respond instantly without any database or external dependencies
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Koveo Gestion API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
    pid: process.pid,
    nodeVersion: process.version
  });
});

app.get('/healthz', (req, res) => {
  // Kubernetes-style health check endpoint
  res.status(200).send('OK');
});

app.get('/ready', (req, res) => {
  // Readiness probe endpoint - always ready to serve traffic
  res.status(200).json({ ready: true });
});

// Add global error handlers to prevent application crashes
process.on('uncaughtException', (error) => {
  log(`Uncaught Exception: ${error.message}`, 'error');
  log(error.stack || '', 'error');
  // Don't exit in production to maintain uptime
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled Rejection at: ${promise}, reason: ${reason}`, 'error');
  // Don't exit in production to maintain uptime
});

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

// Start the server immediately with health checks first
const port = parseInt(process.env.PORT || '5000', 10);
const server = app.listen(
  {
    port,
    host: '0.0.0.0',
    reusePort: true,
  },
  () => {
    log(`server ready and health checks available on port ${port}`);
    
    // Initialize everything else in background after server is listening
    setTimeout(() => initializeApplication(), 100);
  }
);

// Initialize application components after server starts
async function initializeApplication() {
  try {
    log('🚀 Starting application initialization...');
    
    // Register API routes - don't need to pass server here
    await registerRoutes(app);

    // Setup error handling
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || 'Internal Server Error';

      res.status(status).json({ message });
      // Don't throw in production to maintain uptime
      if (process.env.NODE_ENV !== 'production') {
        throw err;
      }
    });

    // Setup static file serving based on environment
    if (app.get('env') === 'development') {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Initialize database optimizations in background after server starts
    // This prevents blocking the health check endpoints
    initializeDatabaseOptimizationsInBackground();
    
    // Initialize background jobs after server starts
    initializeBackgroundJobsInBackground();
    
    log(`🎯 Application fully initialized on port ${port}`);
  } catch (error) {
    log(`⚠️ Application initialization failed: ${error}`, 'error');
    // Don't crash - health checks will still work
  }
}
  
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
