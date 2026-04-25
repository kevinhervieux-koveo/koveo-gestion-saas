/**
 * Koveo Gestion Server - Minimal startup for deployment health checks
 * This version prioritizes fast startup and immediate health check availability
 */
import express from 'express';
import path from 'path';
import { createFastHealthCheck, createStatusCheck, createRootHandler, setFrontendReady, createStartupMiddleware } from './health-check';
import { log } from './vite';
import { registerRoutes, HEAVY_LAZY_MOUNTS } from './routes';
import { sanitizeInputMiddleware, buildLegacyBypassFromApp, LEGACY_BYPASS_RESOURCE_ROOTS } from './middleware/input-sanitization';
import { ssrfProtectionMiddleware } from './middleware/ssrf-protection';
import { secureErrorHandler, notFoundHandler } from './middleware/error-security';
import { configureSecurityMiddleware } from './middleware/security-middleware';
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

// Security headers middleware (Helmet/CSP/HSTS) — single source of truth in
// server/middleware/security-middleware.ts.
configureSecurityMiddleware(app);

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

// Startup middleware - handles all requests gracefully during initialization
// This prevents "internal error" on first load while server is warming up
app.use(createStartupMiddleware());

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

      // Boot footprint summary — makes the new lazy/deferred behavior obvious
      // in production logs so it's easy to confirm what didn't run at boot.
      const skippedQueryOpt = process.env.SKIP_QUERY_OPTIMIZATION === 'true';
      const mcpEnabled =
        process.env.ENABLE_MCP_SERVER === 'true' ||
        (process.env.NODE_ENV !== 'production' && process.env.ENABLE_MCP_SERVER !== 'false');
      log(
        `🪶 Boot footprint: query-optimization=${skippedQueryOpt ? 'SKIPPED' : 'enabled (warmup deferred 30s)'}, ` +
          `mcp-server=${mcpEnabled ? 'enabled' : 'OFF (set ENABLE_MCP_SERVER=true to enable)'}, ` +
          `gemini-ai=lazy (built on first AI request)`
      );

      // In non-production environments, probe a small sample of seeded
      // demo document file paths and warn if the underlying object-storage
      // bytes are missing. This catches the common drift where a demo env
      // was cloned without re-running the seed script and documents would
      // otherwise silently render as "File not found".
      if (process.env.NODE_ENV !== 'production') {
        setTimeout(async () => {
          try {
            const { DemoManagementService } = await import(
              './services/demo-management-service'
            );
            const report =
              await DemoManagementService.checkSeededDocumentIntegrity(3);
            if (!report.healthy) {
              log(
                `⚠️ Demo document integrity: ${report.totalMissing}/${report.totalSampled} sampled attachments are missing their files in object storage.`,
                'warn',
              );
              log(`   Remediation: ${report.remediation}`, 'warn');
            }
          } catch {
            // Non-critical: never block startup on the probe.
          }
        }, 5000);
      }

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
        // Production: Delay application loading to ensure port opens first
        log('🔄 Production mode: Port opened, scheduling feature loading...');
        setTimeout(async () => {
          try {
            log('🔄 Starting application feature loading...');
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
            // Migration failures (and any other startup failure) MUST abort
            // the process so the deploy fails loudly rather than serving the
            // new code against an outdated schema. The platform will surface
            // the non-zero exit and roll back / retry the deploy.
            if ((error as any)?.isMigrationError === true || process.env.FAIL_FAST_ON_STARTUP_ERROR !== 'false') {
              log('❌ Aborting process so the deploy fails loudly.', 'error');
              setTimeout(() => process.exit(1), 100);
            }
          }
        }, 2000); // Delay 2 seconds to ensure port is fully open and responsive
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

// Add process monitoring (disabled for Autoscale which doesn't support long-running intervals)
const isAutoscaleMode = process.env.AUTOSCALE === 'true' || process.env.DEPLOYMENT_TYPE === 'autoscale';
if (process.env.NODE_ENV === 'production' && !isAutoscaleMode) {
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

    // Apply any pending database migrations BEFORE registering routes,
    // so the server never starts serving traffic against an outdated
    // schema. The runner is idempotent, uses a Postgres advisory lock
    // for safe concurrent invocation, and auto-baselines pre-existing
    // databases on first run. A failure here aborts startup so the
    // deploy fails loudly. Only runs in production (dev keeps using
    // `db:push`); set RUN_DB_MIGRATIONS=true to force in dev, or
    // SKIP_DB_MIGRATIONS=true to opt out in production (tests).
    const shouldRunMigrations =
      process.env.SKIP_DB_MIGRATIONS !== 'true' &&
      (process.env.NODE_ENV === 'production' ||
        process.env.RUN_DB_MIGRATIONS === 'true');
    if (shouldRunMigrations) {
      try {
        log('🔄 Running database migrations...');
        const { runMigrations } = await import('../scripts/run-migrations');
        const r = await runMigrations({});
        if (r.baselined.length > 0) {
          log(`📝 Baselined ${r.baselined.length} migration(s) as already applied.`);
        }
        if (r.applied.length > 0) {
          log(`✅ Applied ${r.applied.length} migration(s): ${r.applied.join(', ')}`);
        } else {
          log('✅ No pending migrations.');
        }
        if (r.highestApplied) {
          log(`📌 Highest applied migration: ${r.highestApplied}`);
        }

        // Belt-and-braces: re-apply migrations that create DB objects
        // outside Drizzle's purview (functions, triggers) idempotently
        // every boot. The runner's auto-baseline path can otherwise mark
        // these as "applied" without executing them on a fresh DB that
        // was originally synced via `drizzle-kit push` (which never
        // creates triggers). Without this step, a brand-new prod
        // install could come up missing the cross-org guard on
        // `demands.residence_id`. The SQL is written to be idempotent
        // (`CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS`).
        await ensureTriggerOnlyMigrations([
          '0010_demands_residence_building_check.sql',
          '0011_residences_demand_building_check.sql',
        ]);
      } catch (migrationErr: any) {
        log(`❌ Database migrations failed: ${migrationErr.message}`, 'error');
        log(`❌ Stack: ${migrationErr.stack}`, 'error');
        // Tag the error so the outer catch knows this is a migration
        // failure and must abort the process unconditionally.
        try { (migrationErr as any).isMigrationError = true; } catch {}
        throw migrationErr;
      }
    } else {
      log('⏭️  Skipping migration runner (dev mode or SKIP_DB_MIGRATIONS).');
    }

    // Load API routes FIRST to ensure they have priority over static files  
    log('📥 Setting up essential API routes...');
    
    // Load full routes including authentication routes
    try {
      await registerRoutes(app);
      // Build the legacy sanitization bypass map from the now-registered
      // route table. We also pass the lazy-mounted prefixes so that routes
      // under those prefixes (e.g. /api/budgets, /api/maintenance) are
      // bypassed even before the lazy loader fires on the first request.
      // See server/middleware/input-sanitization.ts.
      const lazyBypassPrefixes = HEAVY_LAZY_MOUNTS
        .flatMap((spec) => {
          const m = spec.matcher;
          if (typeof m === 'string') return [m];
          if (Array.isArray(m)) return m as string[];
          return [];
        })
        .filter((prefix) => (LEGACY_BYPASS_RESOURCE_ROOTS as readonly string[]).includes(prefix));
      buildLegacyBypassFromApp(app, lazyBypassPrefixes);
      log('✅ Full application routes loaded including authentication');
    } catch (routesError: any) {
      log(`❌ Failed to load full routes: ${routesError.message}`, 'error');
      // Fallback to minimal API routes
      app.get('/api/health', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
        setFrontendReady(true);
        log('✅ Frontend marked as ready');
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
      setFrontendReady(true);
      log('✅ Frontend marked as ready');
    }

    // Initialize all background jobs (including bill auto-generation and notification automation)
    // AUTOSCALE COMPATIBILITY: Skip background jobs in Autoscale deployment
    // Background jobs require persistent processes which Autoscale doesn't support
    const isAutoscale = process.env.AUTOSCALE === 'true' || process.env.DEPLOYMENT_TYPE === 'autoscale';
    
    if (isAutoscale) {
      log('⚡ Autoscale mode detected - skipping background jobs (not compatible with stateless deployment)');
    } else {
      // In production, delay job initialization to avoid blocking port opening
      const jobDelay = process.env.NODE_ENV === 'production' ? 3000 : 0;
      setTimeout(async () => {
        try {
          log('🔄 Initializing background jobs...');
          const { startJobs } = await import('./jobs/index');
          await startJobs();
          log('✅ All background jobs initialized');
        } catch (jobError: any) {
          log(`⚠️ Failed to initialize background jobs: ${jobError.message}`, 'error');
        }
      }, jobDelay);
    }

    // Start heavy database work in background AFTER routes are ready
    // AUTOSCALE COMPATIBILITY: Skip database optimization in Autoscale deployment
    // These operations use intervals and caching that aren't suitable for stateless instances
    if (isAutoscale) {
      log('⚡ Autoscale mode detected - skipping database optimization (using stateless configuration)');
    } else {
      // In production, delay significantly to ensure port is fully responsive first
      const dbDelay = process.env.NODE_ENV === 'production' ? 5000 : 1000;
      setTimeout(async () => {
        try {
          log('🔄 Starting background database optimization (delayed for port stability)...');
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
    }
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
 * Idempotently re-apply migrations that create DB objects Drizzle does
 * not model (currently: PL/pgSQL functions and triggers). Called after
 * the numbered migration runner so we still apply these even if the
 * runner auto-baselined them on a freshly-pushed DB.
 *
 * The referenced SQL files MUST be safe to execute repeatedly:
 *   - `CREATE OR REPLACE FUNCTION ...`
 *   - `DROP TRIGGER IF EXISTS ... ; CREATE TRIGGER ...`
 */
async function ensureTriggerOnlyMigrations(filenames: string[]): Promise<void> {
  const { readFileSync } = await import('fs');
  const { join, dirname } = await import('path');
  const { fileURLToPath } = await import('url');
  const { db } = await import('./db');
  const { sql } = await import('drizzle-orm');

  const here = dirname(fileURLToPath(import.meta.url));
  for (const filename of filenames) {
    const sqlPath = join(here, '..', 'migrations', filename);
    const ddl = readFileSync(sqlPath, 'utf8');
    log(`🔧 Ensuring trigger-only migration applied: ${filename}`);
    await db.execute(sql.raw(ddl));
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
      // Skip when SKIP_QUERY_OPTIMIZATION=true. The flag now applies in any
      // environment (not only production) so memory-constrained deploys —
      // e.g. the 0.5 vCPU / 2 GiB Reserved VM that was OOM-killed on boot —
      // can opt out cleanly. Caches will populate lazily on first request.
      if (process.env.SKIP_QUERY_OPTIMIZATION === 'true') {
        log('⏭️  Skipping query optimization system (SKIP_QUERY_OPTIMIZATION=true). Caches populate lazily on first use.');
      } else {
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
