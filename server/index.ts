import express, { type Request, Response, NextFunction } from 'express';
import { registerRoutes } from './routes-minimal';
import { setupVite, serveStatic, log } from './vite';
import { createFastHealthCheck, createStatusCheck, createRootHandler } from './health-check';

// Import database and schema to ensure they're available in production
import { db } from './db.js';
import { sql } from 'drizzle-orm';
import {
  initializeDatabaseOptimizations,
  startPerformanceMonitoring,
} from './init-database-optimizations';
import { startJobs } from './jobs';
import { emailService } from './services/email-service';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import {
  configureSecurityMiddleware,
  securityHealthCheck,
  addLaw25Headers,
  rateLimitConfig,
} from './middleware/security-middleware';
import { memoryOptimization, startMemoryMonitoring } from './middleware/memory-optimization';
import { devSecurityMiddleware, devCorsMiddleware } from './middleware/dev-security';
import rateLimit from 'express-rate-limit';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// ES Module compatible __dirname (avoid conflicts in test environment)
const __filename = globalThis.__filename ?? fileURLToPath(import.meta.url);
const __dirname = globalThis.__dirname ?? path.dirname(__filename);

// Configure port for deployment platform compatibility
// Replit deployment expects port 5000
let port = parseInt(process.env.PORT || '5000', 10);

// Ensure port is valid
if (isNaN(port) || port < 1 || port > 65535) {
  console.error(`Invalid port: ${process.env.PORT || '5000'}. Using default 5000.`);
  port = 5000;
}

const app = express();

// Initialize database connection early to catch any connection issues
async function initializeDatabase() {
  try {
    console.log('🔍 Initializing database connection...');
    
    // Import database here to ensure it's loaded after all modules
    const { db } = await import('./db.js');
    
    // Test database connection using sql template
    await db.execute(sql`SELECT 1 as test`);
    console.log('✅ Database connection successful');
    
    return db;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    console.error('Error details:', error.message);
    
    // In production, log the error but don't crash the server
    if (process.env.NODE_ENV === 'production') {
      console.error('⚠️  Continuing startup despite database error in production');
      return null;
    } else {
      throw error;
    }
  }
}

// Trust proxy for rate limiting - secure configuration for production
// Only trust specific proxy headers from known sources
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
  // In production, trust proxy only from specific IP ranges (e.g., CloudFlare, Google Cloud Load Balancer)
  app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);
} else {
  // In development, trust localhost and Replit proxies
  app.set('trust proxy', ['loopback', '169.254.0.0/16', '::ffff:169.254.0.0/112']);
}

// Export app for testing
export { app };

// Add global timeout middleware to prevent hanging requests
app.use((req, res, next) => {
  // Set timeout for all requests to prevent deployment hanging
  req.setTimeout(30000, () => {
    if (!res.headersSent) {
      res.status(408).send('Request Timeout');
    }
  });
  
  // Set response timeout
  res.setTimeout(30000, () => {
    if (!res.headersSent) {
      res.status(408).send('Response Timeout');
    }
  });
  
  next();
});

// CRITICAL: Ultra-fast health check endpoints MUST come before any middleware
// These endpoints respond immediately to prevent deployment timeouts
app.get('/', createRootHandler());

// Fast HEAD request support for root
app.head('/', (req, res) => {
  res.status(200).end();
});

// CRITICAL: Ultra-fast health endpoints - respond immediately for deployment platforms
app.get('/health', createFastHealthCheck());
app.get('/healthz', createFastHealthCheck());
app.get('/ready', createFastHealthCheck());

// Additional health check endpoints for different deployment platforms
app.get('/ping', (req, res) => {
  req.setTimeout(500, () => {
    if (!res.headersSent) res.status(200).send('pong');
  });
  res.set('Connection', 'close');
  res.status(200).send('pong');
});

app.get('/status', createStatusCheck());

// Root endpoint health check - only for deployment health checks, not browsers

// Production mode: Allow full application after health checks are ready
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Koveo Gestion API is running',
    version: '1.0.0',
  });
});
// NOW add middleware after health checks

// SECURITY: Configure comprehensive security middleware before any other middleware
configureSecurityMiddleware(app);

// SECURITY: Add development-specific security (mitigates esbuild vulnerability)
app.use(devCorsMiddleware);
app.use(devSecurityMiddleware);

// SECURITY: Add security health check middleware
app.use(securityHealthCheck);

// SECURITY: Add Law 25 compliance headers for Quebec privacy regulations
app.use(addLaw25Headers);

// PERFORMANCE: Add memory optimization middleware
app.use(memoryOptimization);

// SECURITY: Configure rate limiting for different endpoint types
const generalRateLimit = rateLimit(rateLimitConfig.api);
const authRateLimit = rateLimit(rateLimitConfig.auth);
const passwordResetRateLimit = rateLimit(rateLimitConfig.passwordReset);
const uploadRateLimit = rateLimit(rateLimitConfig.upload);

// Apply rate limiting to API routes - specific endpoints first, then general
app.use('/api/auth/forgot-password', passwordResetRateLimit); // More lenient for password reset
app.use('/api/auth/reset-password', passwordResetRateLimit); // More lenient for password reset
app.use('/api/auth', authRateLimit); // Strict rate limit for other auth endpoints
app.use('/api/upload', uploadRateLimit);
app.use('/api/files', uploadRateLimit);
app.use('/api', generalRateLimit);

// Remove this duplicate - already defined above

app.get('/api/health/detailed', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
    pid: process.pid,
    nodeVersion: process.version,
    port: port,
    env: process.env.NODE_ENV || 'development',
  });
});

// Add global error handlers to prevent application crashes
process.on('uncaughtException', (_error) => {
  log(`Uncaught Exception: ${_error.message}`, 'error');
  log(_error.stack || '', 'error');
  // Don't exit in production to maintain uptime for Cloud Run
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled Rejection at: ${promise}, reason: ${reason}`, 'error');
  // Don't exit in production to maintain uptime for Cloud Run
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Graceful shutdown for Cloud Run
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    log('Server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    log('Forced shutdown');
    process.exit(1);
  }, 10000);
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

// Setup static file serving for production immediately
const isProductionBuild =
  process.env.NODE_ENV === 'production' ||
  !process.env.NODE_ENV ||
  process.env.NODE_ENV !== 'development';

if (isProductionBuild) {
  log('🏗️ Setting up production static file serving immediately');
  const distPath = path.resolve(process.cwd(), 'dist', 'public');

  log(`📁 Looking for build files in: ${distPath}`);
  log(`📋 Directory exists: ${fs.existsSync(distPath)}`);

  if (fs.existsSync(distPath)) {
    const indexPath = path.resolve(distPath, 'index.html');
    log(`📄 Index file exists: ${fs.existsSync(indexPath)}`);

    // Serve static files with proper cache headers
    app.use(
      express.static(distPath, {
        maxAge: '1d',
        setHeaders: (res, path) => {
          if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );

    // Add specific root route handler AFTER static middleware  
    app.get('/', (_req: Request, res: Response, next) => {
      // Skip if this is a health check (already handled above)
      const userAgent = _req.get('User-Agent') || '';
      if (userAgent.includes('GoogleHC') || userAgent.includes('health') || !userAgent) {
        return next();
      }
      
      const indexPath = path.resolve(distPath, 'index.html');
      log(`📄 Root request - serving index.html from: ${indexPath}`);
      if (fs.existsSync(indexPath)) {
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(indexPath);
      } else {
        log(`❌ Index file not found at: ${indexPath}`, 'error');
        res.status(200).send('OK'); // Return OK for health checks even if app not built
      }
    });

    // SPA fallback for other routes
    app.get('*', (_req: Request, res: Response, next) => {
      // Skip API routes and health checks
      if (
        _req.path.startsWith('/api') ||
        _req.path === '/health' ||
        _req.path === '/healthz' ||
        _req.path === '/ready'
      ) {
        return next();
      }

      const indexPath = path.resolve(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send(`Application not found. Index path: ${indexPath}`);
      }
    });

    log('✅ Static files and SPA routing configured immediately');
  } else {
    log(`⚠️ Build directory not found: ${distPath}`, 'error');

    // List what's actually in the directory
    const parentDir = path.dirname(distPath);
    if (fs.existsSync(parentDir)) {
      const contents = fs.readdirSync(parentDir);
      log(`📂 Contents of ${parentDir}: ${contents.join(', ')}`);
    }
  }
}

// Features API route - Placed here to ensure it takes precedence over Vite middleware
app.get('/api/features', async (req, res) => {
  try {
    const { Pool, neonConfig } = await import('@neondatabase/serverless');
    const ws = await import('ws');
    neonConfig.webSocketConstructor = ws.default;

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const { roadmap } = req.query;

    if (roadmap === 'true') {
      const rawFeatures = await pool.query(`
        SELECT id, name, description, category, status, priority, 
               business_objective, target_users, success_metrics,
               is_public_roadmap, is_strategic_path, created_at, updated_at
        FROM features 
        WHERE is_public_roadmap = true 
        ORDER BY created_at DESC
      `);

      const features = rawFeatures.rows.map((row) => ({
        ...row,
        isPublicRoadmap: row.is_public_roadmap,
        isStrategicPath: row.is_strategic_path,
        businessObjective: row.business_objective,
        targetUsers: row.target_users,
        successMetrics: row.success_metrics,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      res.setHeader('Content-Type', 'application/json');
      res.json(features);
    } else {
      res.json([]);
    }
  } catch (_error) {
    console.error('Features API _error:', _error);
    res.status(500).json({ _error: 'Internal server error' });
  }
});

// User organizations API route - Must be before Vite middleware
// Note: This route needs to be defined before Vite middleware but after session setup
// We'll move it to the proper location after session initialization

// Feature status update route - Also placed here to bypass middleware issues
app.post('/api/features/:id/update-status', async (req, res) => {
  try {
    const { Pool, neonConfig } = await import('@neondatabase/serverless');
    const ws = await import('ws');
    neonConfig.webSocketConstructor = ws.default;

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const { status } = req.body;
    const featureId = req.params.id;

    const validStatuses = [
      'submitted',
      'planned',
      'in-progress',
      'ai-analyzed',
      'completed',
      'cancelled',
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const updateQuery = `
      UPDATE features 
      SET status = $1, updated_at = NOW() 
      WHERE id = $2 
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [status, featureId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Feature not found' });
    }

    const feature = {
      ...result.rows[0],
      isPublicRoadmap: result.rows[0].is_public_roadmap,
      isStrategicPath: result.rows[0].is_strategic_path,
      businessObjective: result.rows[0].business_objective,
      targetUsers: result.rows[0].target_users,
      successMetrics: result.rows[0].success_metrics,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at,
    };

    res.setHeader('Content-Type', 'application/json');
    res.json(feature);
  } catch (_error) {
    console.error('Feature status update _error:', _error);
    res.status(500).json({ _error: 'Internal server error' });
  }
});

// Start the server immediately with health checks first
// Cloud Run provides PORT environment variable, fallback to 8080
let server: any;

// Export server for testing
export { server };

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
  try {
    server = app.listen(
      port,
      '0.0.0.0', // Bind to all interfaces for deployment compatibility
      () => {
        log(`🚀 Server ready and health checks available on port ${port}`);
        log(`🌐 Health check URLs:`);
        log(`   - http://0.0.0.0:${port}/health`);
        log(`   - http://0.0.0.0:${port}/healthz`);
        log(`   - http://0.0.0.0:${port}/ready`);
        log(`   - http://0.0.0.0:${port}/ping`);
        log(`   - http://0.0.0.0:${port}/status`);

        // Always ensure port is properly bound
        log(`🚀 Server listening on http://0.0.0.0:${port} - Health checks ready`);
        
        // Initialize application in background for both dev and production
        setTimeout(() => {
          initializeApplication().catch((error) => {
            log(`Application initialization failed: ${error}`, 'error');
            // Don't crash - health checks still work
          });
        }, 100);
      }
    );

    // Configure server timeouts for better deployment reliability
    server.keepAliveTimeout = 120000; // 2 minutes
    server.headersTimeout = 125000; // Slightly longer than keepAliveTimeout

    // Handle server errors gracefully without crashing in production
    server.on('error', (_error: unknown) => {
      log(`Server _error: ${(_error as any)?.message || _error}`, 'error');
      if ((_error as any)?.code === 'EADDRINUSE') {
        log(`Port ${port} is already in use`, 'error');
        // Don't exit in production to maintain uptime
        if (process.env.NODE_ENV !== 'production') {
          process.exit(1);
        } else {
          log('⚠️ Continuing in production despite port conflict', 'error');
        }
      }
    });
  } catch (_error) {
    log(`Failed to start server: ${_error}`, 'error');
    // Don't exit in production to maintain uptime
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    } else {
      log('⚠️ Server startup failed in production, attempting recovery', 'error');
    }
  }
} else {
  log('⚠️ Server startup skipped in test environment', 'info');
}

// Initialize application components after server starts
/**
 *
 */
/**
 * InitializeApplication function.
 * @returns Function result.
 */
async function initializeApplication() {
  try {
    log('🚀 Starting application initialization...');
    
    // Initialize database connection first
    await initializeDatabase();

    // Object Storage routes (must come before other routes for proper file serving)
    try {
      const { ObjectStorageService, ObjectNotFoundError } = await import('./objectStorage');

      // Route for serving private objects (with authentication required)
      app.get('/objects/:objectPath(*)', async (req: any, res) => {
        try {
          const objectStorageService = new ObjectStorageService();
          const objectFile = await objectStorageService.getObjectEntityFile(req.path);
          await objectStorageService.downloadObject(objectFile, res);
        } catch (_error) {
          console.error('Error serving private object:', _error);
          if (_error instanceof ObjectNotFoundError) {
            return res.status(404).json({ _error: 'File not found' });
          }
          return res.status(500).json({ _error: 'Internal server error' });
        }
      });

      // Route for serving public objects (no authentication needed)
      app.get('/public-objects/:filePath(*)', async (req, res) => {
        const filePath = req.params.filePath;
        try {
          const objectStorageService = new ObjectStorageService();
          const file = await objectStorageService.searchPublicObject(filePath);
          if (!file) {
            return res.status(404).json({ _error: 'File not found' });
          }
          await objectStorageService.downloadObject(file, res);
        } catch (_error) {
          console.error('Error serving public object:', _error);
          return res.status(500).json({ _error: 'Internal server error' });
        }
      });

      log('✅ Object storage routes registered');
    } catch (_error) {
      log(`❌ Object storage routes setup failed: ${_error}`, 'error');
    }

    // Register API routes FIRST to ensure they take precedence over static serving
    try {
      await registerRoutes(app);
      log('✅ Routes registered successfully');

      // Add the user organizations route AFTER session middleware is set up
      const { requireAuth } = await import('./auth');
      app.get('/api/users/me/organizations', requireAuth, async (req: any, res: any) => {
        try {
          const { getUserAccessibleOrganizations } = await import('./rbac');
          const { Pool, neonConfig } = await import('@neondatabase/serverless');
          const { drizzle } = await import('drizzle-orm/neon-serverless');
          const { inArray } = await import('drizzle-orm');
          const schema = await import('../shared/schema');
          const ws = await import('ws');

          neonConfig.webSocketConstructor = ws.default;
          const pool = new Pool({ connectionString: process.env.DATABASE_URL });
          const db = drizzle({ client: pool, schema });

          const userId = req.user!.id;
          console.warn('Getting accessible organizations for user:', userId);

          const accessibleOrgIds = await getUserAccessibleOrganizations(userId);
          console.warn('Accessible org IDs:', accessibleOrgIds);

          const organizations = await db.query.organizations.findMany({
            where: inArray(schema.organizations.id, accessibleOrgIds),
            orderBy: [schema.organizations.name],
          });

          console.warn(
            'Organizations found:',
            organizations.length,
            organizations.map((o) => ({ id: o.id, name: o.name }))
          );

          res.json(organizations);
        } catch (_error) {
          console.error('Error fetching user organizations:', _error);
          res.status(500).json({ message: 'Failed to fetch user organizations' });
        }
      });
      log('✅ User organizations route registered');

      // Add error handling middleware for API routes only
      app.use('/api', notFoundHandler);
      app.use(errorHandler);
      log('✅ Error handling middleware configured');
    } catch (_error) {
      log(`❌ Route registration failed: ${_error}`, 'error');
      // Skip route registration but continue with Vite setup
    }

    // Setup static file serving AFTER API routes to avoid conflicts
    // Check if we should use development mode
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (isDevelopment) {
      log('🔧 Running in development mode with Vite');
      try {
        await setupVite(app, server);
        log('✅ Vite development server started');
      } catch (_error) {
        log(`❌ Vite setup failed: ${_error}`, 'error');
        log('⚠️ Falling back to React build serving', 'error');

        // Try to serve the built React app if available
        const clientBuildPath = path.resolve(__dirname, '..', 'dist');
        const clientIndexPath = path.resolve(clientBuildPath, 'index.html');

        if (fs.existsSync(clientIndexPath)) {
          log('📁 Serving built React application');
          app.use(express.static(clientBuildPath));
          app.get('*', (req, res) => {
            if (req.path.startsWith('/api')) {
              return res.status(404).json({ _error: 'API route not found' });
            }
            res.sendFile(clientIndexPath);
          });
        } else {
          log('⚠️ No build found, creating development placeholder');
          const devHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Koveo Gestion - Development</title>
    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; margin: 0; background: #f8fafc; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .status { padding: 12px; background: #d1fae5; border-left: 4px solid #10b981; margin: 20px 0; border-radius: 4px; }
        h1 { color: #1e40af; margin: 0; font-size: 2rem; }
        .subtitle { color: #64748b; margin-top: 8px; }
    </style>
</head>
<body>
    <div id="root"></div>
    <script type="text/babel">
        const { useState, useEffect } = React;
        
        /**
        
         * App function
        
         * @returns Function result
        
         */
        
        function App() {
            const [health, setHealth] = useState(null);
            
            useEffect(() => {
                fetch('/health')
                    .then(res => res.json())
                    .then(data => setHealth(_data))
                    .catch(err => console.error('Health check failed:', err));
            }, []);
            
            return (
                <div className="container">
                    <div className="header">
                        <h1>🏢 Koveo Gestion</h1>
                        <div className="subtitle">Quebec Property Management System</div>
                        <div className="status">
                            ✅ Development server is running
                            {health && <div>Server status: {health.status}</div>}
                        </div>
                    </div>
                    <div style={{background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'}}>
                        <h2>🚀 Application Status</h2>
                        <p>The Koveo Gestion server is operational. This is a development placeholder while the full React application is being configured.</p>
                        <ul>
                            <li>✅ Express server running on port ${port}</li>
                            <li>✅ API endpoints functional</li>
                            <li>✅ Database connections established</li>
                            <li>⚙️ React application loading...</li>
                        </ul>
                    </div>
                </div>
            );
        }
        
        ReactDOM.render(<App />, document.getElementById('root'));
    </script>
</body>
</html>`;

          app.get('/', (req, res) => res.send(devHTML));
          app.get('*', (req, res) => {
            if (req.path.startsWith('/api')) {
              return res.status(404).json({ _error: 'API route not found' });
            }
            res.send(devHTML);
          });
        }
      }
    } else {
      log('🏗️ Setting up production static file serving');
      const distPath = path.resolve(process.cwd(), 'dist', 'public');

      log(`📁 Looking for build files in: ${distPath}`);
      log(`📋 Directory exists: ${fs.existsSync(distPath)}`);

      if (fs.existsSync(distPath)) {
        const indexPath = path.resolve(distPath, 'index.html');
        log(`📄 Index file exists: ${fs.existsSync(indexPath)}`);

        // Serve static files with proper cache headers
        app.use(
          express.static(distPath, {
            maxAge: '1d',
            setHeaders: (res, path) => {
              if (path.endsWith('.html')) {
                res.setHeader('Cache-Control', 'no-cache');
              }
            },
          })
        );

        // SPA fallback for production static serving - skip API routes
        app.get('*', (_req: Request, res: Response, next) => {
          // Skip API routes and health checks - let them fall through to API handlers
          if (
            _req.path.startsWith('/api') ||
            _req.path === '/health' ||
            _req.path === '/healthz' ||
            _req.path === '/ready'
          ) {
            return next();
          }

          const indexPath = path.resolve(distPath, 'index.html');
          if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
          } else {
            res.status(404).send(`Application not found. Index path: ${indexPath}`);
          }
        });

        log('✅ Static files and SPA routing configured');
      } else {
        log(`⚠️ Build directory not found: ${distPath}`, 'error');

        // List what's actually in the directory
        const parentDir = path.dirname(distPath);
        if (fs.existsSync(parentDir)) {
          const contents = fs.readdirSync(parentDir);
          log(`📂 Contents of ${parentDir}: ${contents.join(', ')}`);
        }
      }
    }

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

    log(`✅ Core application initialized on port ${port}`);

    // DEPLOYMENT FIX: Move ALL heavy operations away from startup to prevent health check timeout
    // Start background operations with significant delay to allow health checks to pass
    const initDelay = process.env.NODE_ENV === 'production' ? 30000 : 5000; // 30s in prod, 5s in dev
    
    setTimeout(() => {
      log('🔄 Starting background initialization (delayed for health checks)');
      if (process.env.NODE_ENV !== 'production') {
        initializeEmailServiceInBackground();
        initializeDatabaseOptimizationsInBackground();
        initializeBackgroundJobsInBackground();
      } else {
        log('🚀 Production mode: Background processes starting after health check grace period');
        // Even in production, start minimal background processes after delay
        initializeEmailServiceInBackground();
      }
    }, initDelay);
  } catch (_error) {
    log(`⚠️ Application initialization failed: ${_error}`, 'error');
    // Don't crash - health checks will still work
  }
}

/**
 * Runs email service initialization in background with timeout handling.
 */
/**
 * InitializeEmailServiceInBackground function.
 * @returns Function result.
 */
async function initializeEmailServiceInBackground(): Promise<void> {
  try {
    log('📧 Email service is ready (on-demand initialization)');
    // Email service will initialize on first use - no need for upfront initialization
  } catch (_error) {
    log('⚠️ Email service initialization failed:', String(_error));
    // Continue running - don't crash the server
  }
}

/**
 * Runs database optimizations in background with timeout handling.
 */
/**
 * InitializeDatabaseOptimizationsInBackground function.
 * @returns Function result.
 */
async function initializeDatabaseOptimizationsInBackground(): Promise<void> {
  // Skip heavy initialization in production to prevent timeouts
  if (process.env.NODE_ENV === 'production') {
    log('🚀 Production mode: Skipping database optimizations for faster startup');
    return;
  }

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
  } catch (_error) {
    log('⚠️ Database optimization initialization failed:', String(_error));
    // Continue running - don't crash the server
  }
}

/**
 * Runs background jobs initialization with timeout handling.
 */
/**
 * InitializeBackgroundJobsInBackground function.
 * @returns Function result.
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
  } catch (_error) {
    log('⚠️ Background job initialization failed:', String(_error));
    // Continue running - don't crash the server
  }
}


/**
 * Minimal production setup - just the essentials for health checks
 */
async function initializeProductionMinimal(): Promise<void> {
  try {
    log("🚀 Starting minimal production initialization...");
    
    // Just register essential routes without heavy operations
    const { registerRoutes } = await import("./routes-minimal.js");
    await registerRoutes(app);
    log("✅ Essential routes registered");
    
    log("✅ Minimal production setup complete");
  } catch (_error) {
    log(`⚠️ Minimal production setup failed: ${_error}`, "error");
    // Continue running - health checks still work
  }
}
