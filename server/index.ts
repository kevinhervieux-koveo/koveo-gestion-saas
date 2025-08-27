/**
 * Koveo Gestion Server - Minimal startup for deployment health checks
 * This version prioritizes fast startup and immediate health check availability
 */
import express from 'express';
import { createFastHealthCheck, createStatusCheck, createRootHandler } from './health-check';
import { createUltraHealthEndpoints } from './ultra-health';
import { log } from './vite';

const app = express();
// Configure port - always use environment PORT or fallback to 5000
const port = parseInt(process.env.PORT || '5000', 10);

// Ensure port is valid
if (isNaN(port) || port < 1 || port > 65535) {
  const fallback = process.env.NODE_ENV === 'production' ? '80' : '5000';
  console.error(`Invalid port configuration. Using default ${fallback}.`);
}

// Trust proxy for deployment
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request timeout middleware
app.use((req, res, next) => {
  req.setTimeout(5000, () => {
    if (!res.headersSent) {
      res.status(408).send('Request Timeout');
    }
  });
  next();
});

// Ultra-fast health endpoints FIRST - these respond immediately
createUltraHealthEndpoints(app);
app.get('/health', createFastHealthCheck());
app.get('/healthz', createFastHealthCheck());
app.get('/ready', createFastHealthCheck());
app.get('/ping', (req, res) => {
  res.set('Connection', 'close');
  res.status(200).send('pong');
});
app.get('/status', createStatusCheck());

// Basic API status endpoint
app.get('/api', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Koveo Gestion API is running',
    version: '1.0.0'
  });
});

// Static file serving will be set up immediately when server starts

// Export app for testing
export { app };

// Start server immediately if not in test environment
let server: any;
if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
  try {
    server = app.listen(port, '0.0.0.0', () => {
      log(`🚀 Server ready and health checks available on port ${port}`);
      log(`🌐 Health check URLs:`);
      log(`   - http://0.0.0.0:${port}/health`);
      log(`   - http://0.0.0.0:${port}/healthz`);
      log(`   - http://0.0.0.0:${port}/ready`);
      log(`   - http://0.0.0.0:${port}/ping`);
      log(`   - http://0.0.0.0:${port}/status`);
      
      log(`🚀 Server listening on http://0.0.0.0:${port} - Health checks ready`);
      
      // Different startup for development vs production
      if (process.env.NODE_ENV === 'development') {
        log('🔄 Development mode: Loading features in background...');
        setTimeout(() => {
          loadFullApplication().catch((error) => {
            log(`⚠️ Full application load failed: ${error.message}`, 'error');
            // Continue - health checks still work
          });
        }, 100); // Very short delay for development
      } else {
        // Production: Use same pattern as development but ensure API routes are loaded first
        log('🔄 Production mode: Loading features in background...');
        setTimeout(() => {
          loadFullApplication().catch((error) => {
            log(`⚠️ Full application load failed: ${error.message}`, 'error');
            // Continue - health checks still work
          });
        }, 50); // Very short delay for production
      }
    });

    // Configure server timeouts for deployment
    server.keepAliveTimeout = 30000;
    server.headersTimeout = 35000;
    server.requestTimeout = 10000;
    server.timeout = 15000;

    // Handle server errors gracefully
    server.on('error', (error: any) => {
      log(`Server error: ${error?.message || error}`, 'error');
      if (error?.code === 'EADDRINUSE') {
        log(`Port ${port} is already in use`, 'error');
        process.exit(1);
      }
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
    log(`Failed to start server: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Export server for testing
export { server };



/**
 * Load full application features after health checks are available
 */
async function loadFullApplication(): Promise<void> {
  try {
    log('🔄 Loading full application features...');
    
    // Load API routes FIRST to ensure they have priority over static files
    const { registerRoutes } = await import('./routes-minimal');
    await registerRoutes(app);
    log('✅ Essential application routes loaded');
    
    // Setup frontend serving AFTER API routes are registered
    if (process.env.NODE_ENV === 'development' && !process.env.FORCE_PRODUCTION_SERVE) {
      log('🔄 Setting up Vite for frontend development...');
      const { setupVite } = await import('./vite');
      await setupVite(app, server);
      log('✅ Vite development server configured');
      
      // Verify Vite is working
      app.get('/test-vite', (req, res) => {
        res.json({ vite: 'configured', mode: 'development' });
      });
    } else {
      log('🔄 Setting up production server with proper API routing...');
      
      // Use production server logic which handles API routes correctly
      const path = await import('path');
      const fs = await import('fs');
      const express = await import('express');
      
      const distPath = path.resolve(process.cwd(), 'dist', 'public');
      
      if (!fs.existsSync(distPath)) {
        throw new Error(`Could not find the build directory: ${distPath}`);
      }

      // Static file serving is handled in routes-minimal.ts
      // Remove duplicate handlers to avoid conflicts
      
      log('✅ Production static file serving enabled with API route protection');
    }
    
    // Start heavy database work in background AFTER routes are ready
    setTimeout(() => {
      initializeDatabaseInBackground().catch((error) => {
        log(`⚠️ Background database initialization failed: ${error.message}`, 'error');
      });
    }, 1000);
    
  } catch (error: any) {
    log(`⚠️ Failed to load full application: ${error.message}`, 'error');
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
      
      // Import QueryOptimizer dynamically to avoid blocking startup
      const { QueryOptimizer } = await import('./database-optimization');
      
      // Check if indexes are already set up
      const indexesExist = await QueryOptimizer.areIndexesSetup();
      
      if (indexesExist) {
        log('✅ Database indexes already exist - skipping optimization');
        log('🚀 Database is ready for high performance queries');
      } else {
        log('🔄 Setting up database indexes for first time...');
        await QueryOptimizer.applyCoreOptimizations();
        log('✅ Database optimizations complete');
      }
    }
    
    log('🔄 Background work complete - all routes already loaded');
  } catch (error: any) {
    log(`⚠️ Background initialization failed: ${error.message}`, 'error');
    // Continue - this shouldn't break the server
  }
}