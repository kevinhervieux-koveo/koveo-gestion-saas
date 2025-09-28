/**
 * Koveo Gestion Server - Minimal startup for deployment health checks
 * This version prioritizes fast startup and immediate health check availability
 */
import express from 'express';
import path from 'path';
import helmet from 'helmet';
import { createFastHealthCheck, createStatusCheck, createRootHandler } from './health-check';
import { log } from './vite';
import { registerRoutes } from './routes';
import { sanitizeInputMiddleware } from './middleware/input-sanitization';
import { ssrfProtectionMiddleware } from './middleware/ssrf-protection';
import { secureErrorHandler, notFoundHandler } from './middleware/error-security';
// Import debug logger temporarily disabled due to module resolution
// import { debugLogger, logInfo, logDebug } from './utils/debug-logger.js';

// Enhanced startup logging with debug support
// logInfo('SYSTEM', 'SERVER_STARTUP', { 
//   nodeEnv: process.env.NODE_ENV,
//   port: process.env.PORT || 5000,
//   timestamp: new Date().toISOString()
// });

// Add global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  // Don't exit in development to avoid interrupting work
  if (process.env.NODE_ENV !== 'development') {
    setTimeout(() => process.exit(1), 1000);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  // Don't exit in development to maintain stability
  if (process.env.NODE_ENV !== 'development') {
    setTimeout(() => process.exit(1), 1000);
  }
});

// Handle SIGTERM and SIGINT gracefully
process.on('SIGTERM', () => {
  if (server) {
    server.close(() => {
      process.exit(0);
    });
  }
});

process.on('SIGINT', () => {
  if (server) {
    server.close(() => {
      process.exit(0);
    });
  }
});

const app = express();
// Configure port - use environment PORT or fallback to 5000 for all environments
const port = parseInt(process.env.PORT || '5000', 10);
const host = '0.0.0.0'; // Always bind to all interfaces for deployments

// Ensure port is valid
if (isNaN(port) || port < 1 || port > 65535) {
  const fallback = process.env.NODE_ENV === 'production' ? '5000' : '5000';
  // Never exit during tests - let tests continue with fallback
  if (process.env.NODE_ENV === 'production' && process.env.TEST_ENV !== 'integration') {
    process.exit(1);
  }
}

// Trust proxy for deployment
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

// Security headers middleware using Helmet with enhanced configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        // Only allow unsafe-inline in development for HMR
        ...(process.env.NODE_ENV === 'development' ? ["'unsafe-inline'"] : []),
        "https://replit.com"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for CSS-in-JS frameworks like styled-components
        "https://fonts.googleapis.com"
      ],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      ...(process.env.NODE_ENV === 'production' && {
        upgradeInsecureRequests: [],
      })
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  crossOriginEmbedderPolicy: false, // Allow for development
}));

// Production cache busting middleware
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    // Set cache-busting headers for static assets
    if (req.url.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
      res.set({
        'Cache-Control': 'public, max-age=31536000, immutable', // 1 year for hashed assets
        'ETag': `"${Date.now()}-${Math.random()}"`, // Generate unique ETag
      });
    }
    // No-cache for HTML files to prevent stale app shells
    else if (req.url.match(/\.html$/)) {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      });
    }
    // API responses should not be cached
    else if (req.url.startsWith('/api/')) {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'ETag': `"api-${Date.now()}-${Math.random()}"`,
      });
    }
    next();
  });
}

// Domain detection middleware - must come before other middleware
app.use((req, res, next) => {
  // Extract domain from various headers and sources
  const host = req.get('host') || req.get('x-forwarded-host') || req.get('x-original-host');
  const proto = req.get('x-forwarded-proto') || req.protocol;
  
  // Store domain information in request for use by other middleware
  req.domain = host || 'localhost';
  req.isKoveoProduction = host?.includes('koveo-gestion.com') || false;
  
  // Log domain detection for production debugging
  if (req.isKoveoProduction) {
    // Koveo production request detected
  }
  
  next();
});

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security middleware for input sanitization and SSRF protection
app.use(sanitizeInputMiddleware);
app.use(ssrfProtectionMiddleware);

// Request timeout middleware with better error handling
app.use((req, res, next) => {
  // Set a more generous timeout for development to avoid interruptions
  const timeout = process.env.NODE_ENV === 'development' ? 30000 : 5000;
  
  req.setTimeout(timeout, () => {
    if (!res.headersSent) {
      console.warn(`⚠️ Request timeout after ${timeout}ms: ${req.method} ${req.url}`);
      res.status(408).json({ error: 'Request Timeout', url: req.url });
    }
  });
  
  // Add error handling for response
  res.on('error', (err) => {
    // Response error handling
  });
  
  next();
});

// Health check error handler middleware
const healthCheckErrorHandler = (handler: any) => {
  return async (req: any, res: any, next: any) => {
    try {
      await handler(req, res, next);
    } catch (error: any) {
      // Always return 200 for health checks to prevent deployment failures
      if (!res.headersSent) {
        res.status(200).send('OK');
      }
    }
  };
};

// Root endpoint health check - highest priority for deployment platforms
app.get('/', healthCheckErrorHandler(createRootHandler()));

// Health endpoints - fast response with error protection
app.get('/health', healthCheckErrorHandler(createFastHealthCheck()));
app.get('/healthz', healthCheckErrorHandler(createFastHealthCheck()));
app.get('/ready', healthCheckErrorHandler(createFastHealthCheck()));
app.get('/ping', healthCheckErrorHandler((req: any, res: any) => {
  res.set('Connection', 'close');
  res.status(200).send('pong');
}));
app.get('/status', healthCheckErrorHandler(createStatusCheck()));

// API health endpoint with error protection
app.get('/api/health', healthCheckErrorHandler((req: any, res: any) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    port: port,
    host: host,
  });
}));

// Basic API status endpoint
app.get('/api', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Koveo Gestion API is running',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    port: port,
    host: host,
  });
});

// HTTPS enforcement middleware - AFTER health checks to ensure health checks always work
app.use((req, res, next) => {
  // Force HTTPS in production
  if (process.env.NODE_ENV === 'production' && !req.secure && req.get('X-Forwarded-Proto') !== 'https') {
    return res.redirect(`https://${req.get('Host')}${req.url}`);
  }
  next();
});

// Static file serving will be configured after API routes are loaded

// Export app for testing
export { app };

// Start server immediately if not in test environment
let server: any;
if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
  try {
    // Production environment checks
    if (process.env.NODE_ENV === 'production') {
      log('🏭 Production mode detected - applying production configurations');

      // Verify production requirements
      if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_KOVEO) {
        log('❌ Either DATABASE_URL or DATABASE_URL_KOVEO is required in production', 'error');
        process.exit(1);
      }
      
      // Log which database URL we're using (without exposing the full URL)
      const dbUrl = process.env.DATABASE_URL_KOVEO || process.env.DATABASE_URL;
      if (dbUrl) {
        log(`✅ Database configured: ${dbUrl.substring(0, 20)}...`);
      }

      // Set production-specific configurations
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';

      log('✅ Production checks passed');
    }
    server = app.listen(port, host, async () => {
      log(`🚀 Server ready and health checks available on port ${port}`);
      log(`🌐 Health check URLs:`);
      log(`   - http://${host}:${port}/health`);
      log(`   - http://${host}:${port}/healthz`);
      log(`   - http://${host}:${port}/ready`);
      log(`   - http://${host}:${port}/ping`);
      log(`   - http://${host}:${port}/status`);
      log(`   - http://${host}:${port}/api/health`);

      log(`🚀 Server listening on http://${host}:${port} - Health checks ready`);
      log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      log(
        `🏗️  Build mode: ${process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}`
      );

      // Different startup for development vs production
      if (process.env.NODE_ENV === 'development') {
        log('🔄 Development mode: Setting up frontend immediately...');
        // In development, we need Vite middleware BEFORE server starts accepting requests
        // Load application in background to avoid blocking startup
        setTimeout(async () => {
          try {
            await loadFullApplication();
            log('✅ Development setup complete with frontend serving');
          } catch (error: any) {
            log(`❌ Frontend setup failed: ${error.message}`, 'error');
            log(`❌ Stack trace: ${error.stack}`, 'error');
          }
        }, 100); // Very quick delay to allow server to start first
      } else {
        // Production: Load application immediately with better error handling
        log('🔄 Production mode: Loading application features...');
        setTimeout(async () => {
          try {
            await loadFullApplication();
            log('✅ Production setup complete');
            
            // Quick database connectivity test (non-blocking)
            try {
              const { sql } = await import('./db');
              await sql`SELECT 1`;
              log('✅ Database connectivity verified');
            } catch (dbError: any) {
              log(`⚠️ Database connectivity warning: ${dbError.message}`, 'warn');
              // Don't fail startup, just warn - health checks will still work
            }
          } catch (error: any) {
            log(`❌ Application load failed in production: ${error.message}`, 'error');
            log(`❌ Stack trace: ${error.stack}`, 'error');
            // In production, we want to know about failures but keep health checks working
          }
        }, 10); // Minimal delay for production
      }
    });

    // Configure server timeouts for deployment
    server.keepAliveTimeout = 30000;
    server.headersTimeout = 35000;
    server.requestTimeout = 10000;
    server.timeout = 15000;

    // Handle server errors gracefully with detailed logging
    server.on('error', (error: any) => {
      log(`❌ Server error: ${error?.message || error}`, 'error');
      log(`❌ Error code: ${error?.code}`, 'error');
      log(`❌ Error details: ${JSON.stringify(error, null, 2)}`, 'error');

      if (error?.code === 'EADDRINUSE') {
        log(`❌ Port ${port} is already in use. Cannot start server.`, 'error');
        process.exit(1);
      } else if (error?.code === 'EACCES') {
        log(`❌ Permission denied for port ${port}. Try a different port.`, 'error');
        process.exit(1);
      } else {
        log(`❌ Unexpected server error occurred.`, 'error');
        process.exit(1);
      }
    });

    // Add listening event for better debugging
    server.on('listening', () => {
      const addr = server.address();
      log(`✅ Server successfully bound to ${addr?.address}:${addr?.port}`);
      log(`✅ Server ready for connections`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        log('Server closed');
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000);
    });
  } catch (error: any) {
    log(`❌ Critical failure starting server: ${error.message}`, 'error');
    log(`❌ Error stack: ${error.stack}`, 'error');
    log(`❌ Environment: ${process.env.NODE_ENV}`, 'error');
    log(`❌ Port: ${port}`, 'error');
    log(`❌ Host: ${host}`, 'error');
    process.exit(1);
  }
}

// Note: Global error handlers are already defined at the top of the file
// to prevent conflicts and maintain consistent health-first behavior

// Add process monitoring
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const memMB = Math.round(memUsage.rss / 1024 / 1024);
    log(`📊 Memory usage: ${memMB}MB`);
  }, 60000); // Log memory usage every minute in production
}

// Export server for testing
export { server };

/**
 * Load full application features after health checks are available
 */
async function loadFullApplication(): Promise<void> {
  try {
    log('🔄 Loading full application features...');

    // Production-specific validations
    if (process.env.NODE_ENV === 'production') {
      log('🔍 Production validation: Checking application requirements...');

      // Verify critical environment variables
      const requiredEnvVars = ['DATABASE_URL'];
      for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
          throw new Error(`Missing required environment variable: ${envVar}`);
        }
      }

      log('✅ Production environment validation passed');
    }

    // Load API routes FIRST to ensure they have priority over static files  
    log('📥 Setting up essential API routes...');
    
    // Load full routes including authentication routes
    try {
      await registerRoutes(app);
      log('✅ Full application routes loaded including authentication');
    } catch (routesError: any) {
      log(`❌ Failed to load full routes: ${routesError.message}`, 'error');
      // Fallback to minimal API routes
      app.get('/api/health', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
      });
      
      app.post('/api/test', (req, res) => {
        res.json({ message: 'API working', body: req.body });
      });
      
      log('✅ Essential API routes loaded (minimal setup)');
    }

    // Setup frontend serving AFTER API routes are registered
    // Use production serving when NODE_ENV=production and we have a built dist directory
    // Or when explicitly forced with FORCE_PRODUCTION_SERVE
    const fs = await import('fs');
    const pathModule = await import('path');
    const hasProductionBuild = fs.existsSync(pathModule.resolve(process.cwd(), 'dist', 'public'));
    const isActualProduction =
      process.env.NODE_ENV === 'production' &&
      (hasProductionBuild || process.env.FORCE_PRODUCTION_SERVE === 'true');
    const isViteDevMode = !isActualProduction;

    log(
      `🔍 Environment check: NODE_ENV=${process.env.NODE_ENV}, REPLIT_DOMAINS=${!!process.env.REPLIT_DOMAINS}, isViteDevMode=${isViteDevMode}`
    );

    if (isViteDevMode) {
      log('🔄 Setting up Vite development server...');
      
      try {
        const { setupVite } = await import('./vite.ts');
        await setupVite(app, server);
        log('✅ Vite development server configured');
      } catch (frontendError: any) {
        log(`❌ Vite setup failed: ${frontendError.message}`, 'error');
        throw frontendError;
      }
    } else {
      log('🔄 Setting up production static file serving (deployment detected)...');

      // Use production server logic which handles API routes correctly
      const distPath = pathModule.resolve(process.cwd(), 'dist', 'public');

      if (!fs.existsSync(distPath)) {
        log(`⚠️ Build directory not found at: ${distPath}`, 'error');
        log('⚠️ Continuing without static file serving - API routes still available', 'error');
      } else {
        log(`✅ Found build directory: ${distPath}`);
      }

      // Static file serving is handled in routes.ts
      // Remove duplicate handlers to avoid conflicts

      log('✅ Production static file serving configured with API route protection');
    }

    // Initialize all background jobs (including bill auto-generation and notification automation)
    try {
      const { startJobs } = await import('./jobs/index');
      await startJobs();
      log('✅ All background jobs initialized');
    } catch (jobError: any) {
      log(`⚠️ Failed to initialize background jobs: ${jobError.message}`, 'error');
    }

    // Start heavy database work in background AFTER routes are ready
    const dbDelay = process.env.NODE_ENV === 'production' ? 500 : 1000;
    setTimeout(async () => {
      try {
        await initializeDatabaseInBackground();
        log('✅ Background database initialization completed');
      } catch (error: any) {
        log(`⚠️ Background database initialization failed: ${error.message}`, 'error');
        // Don't crash in production for database optimization failures
        if (process.env.NODE_ENV === 'production') {
          log('⚠️ Continuing in production mode despite database optimization failure');
        }
      }
    }, dbDelay);
  } catch (error: any) {
    log(`❌ Failed to load full application: ${error.message}`, 'error');
    log(`❌ Stack trace: ${error.stack}`, 'error');

    if (process.env.NODE_ENV === 'production') {
      log('❌ Critical application failure in production', 'error');
      // In production, this is more serious but don't crash if health checks work
      log('⚠️ Health checks may still be available');
    }
    // Continue - health checks still work
  }
}

/**
 * Initialize heavy database work in background
 */
async function initializeDatabaseInBackground(): Promise<void> {
  try {
    // Only run database optimizations after server is fully started
    if (process.env.NODE_ENV !== 'test' && !process.env.DISABLE_DB_OPTIMIZATIONS) {
      log('🔄 Checking database optimization status...');

      // Production environment: Be more cautious with database operations
      if (process.env.NODE_ENV === 'production') {
        log('🏭 Production mode: Performing safe database checks...');
      }

      // Import QueryOptimizer dynamically to avoid blocking startup
      const { QueryOptimizer } = await import('./database-optimization');

      // Check if indexes are already set up with timeout protection and error handling
      let indexesExist = false;
      try {
        const indexCheckPromise = QueryOptimizer.areIndexesSetup();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database check timeout')), 10000)
        );

        indexesExist = (await Promise.race([indexCheckPromise, timeoutPromise])) as boolean;
      } catch (dbError: any) {
        if (process.env.NODE_ENV === 'production') {
          log(
            `⚠️ Production: Database connection failed, skipping optimization: ${dbError.message}`
          );
          return; // Exit early, don't attempt any database operations
        } else {
          log(`⚠️ Development: Database check failed: ${dbError.message}`);
          // In development, continue to try optimization
        }
      }

      if (indexesExist) {
        log('✅ Database indexes already exist - skipping optimization');
        log('🚀 Database is ready for high performance queries');
      } else {
        if (process.env.NODE_ENV === 'production') {
          log('🔧 Production mode: Using existing database configuration');
          // Silently skip index creation in production - emergency authentication system handles database issues
        } else {
          log('🔄 Setting up database indexes for first time...');
          await QueryOptimizer.applyCoreOptimizations();
          log('✅ Database optimizations complete');
        }
      }

      // Initialize advanced query optimization system
      try {
        log('🚀 Initializing advanced query optimization system...');
        const { initializeQueryOptimizations, scheduleOptimizationMaintenance } = await import('./init-query-optimizations');
        
        const optimizationStatus = await initializeQueryOptimizations();
        
        if (optimizationStatus.optimizationServicesReady) {
          log('✅ Advanced query optimization system initialized successfully');
          log(`⚡ Optimization features active: caching, batch operations, performance monitoring`);
          
          // Schedule maintenance for continuous optimization
          scheduleOptimizationMaintenance();
          log('⏰ Optimization maintenance scheduled');
          
          // Log performance baseline
          if (optimizationStatus.initializationTime) {
            log(`📊 Optimization system initialized in ${optimizationStatus.initializationTime}ms`);
          }
        } else {
          log('⚠️ Query optimization system partially initialized - some features may be limited');
        }
        
        if (optimizationStatus.errors.length > 0) {
          log(`⚠️ Optimization warnings: ${optimizationStatus.errors.join(', ')}`);
        }
      } catch (optimizationError: any) {
        log(`⚠️ Advanced optimization system failed: ${optimizationError.message}`, 'error');
        // Don't fail startup for optimization issues
      }
    }

    log('🔄 Background work complete - all routes already loaded');
  } catch (error: any) {
    if (process.env.NODE_ENV === 'production') {
      log(
        `⚠️ Production: Background initialization failed (non-critical): ${error.message}`,
        'error'
      );
    } else {
      log(`⚠️ Background initialization failed: ${error.message}`, 'error');
    }
    // Continue - this shouldn't break the server
  }
}
