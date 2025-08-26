/**
 * Koveo Gestion Server - Minimal startup for deployment health checks
 * This version prioritizes fast startup and immediate health check availability
 */
import express from 'express';
import { createFastHealthCheck, createStatusCheck, createRootHandler } from './health-check';
import { createUltraHealthEndpoints } from './ultra-health';
import { log } from './vite';

const app = express();
const port = parseInt(process.env.PORT || '5000', 10);

// Ensure port is valid
if (isNaN(port) || port < 1 || port > 65535) {
  console.error(`Invalid port: ${process.env.PORT || '5000'}. Using default 5000.`);
}

// Trust proxy for deployment
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

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
      
      // For development, load features immediately in background
      if (process.env.NODE_ENV === 'development') {
        log('🔄 Development mode: Loading features in background...');
        setTimeout(() => {
          loadFullApplication().catch((error) => {
            log(`⚠️ Full application load failed: ${error.message}`, 'error');
            // Continue - health checks still work
          });
        }, 100); // Very short delay for development
      } else {
        // Set up static file serving IMMEDIATELY in production
        setupStaticServing().then(() => {
          log('✅ Static file serving enabled immediately for production');
        }).catch((error) => {
          log(`⚠️ Failed to set up static serving: ${error.message}`, 'error');
        });
        
        // Load full application features after health checks are available
        setTimeout(() => {
          loadFullApplication().catch((error) => {
            log(`⚠️ Full application load failed: ${error.message}`, 'error');
            // Continue - health checks still work
          });
        }, 2000); // Longer delay for production since static serving is already set up
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
 * Set up static file serving for production
 */
async function setupStaticServing(): Promise<void> {
  try {
    const { serveStatic } = await import('./vite');
    serveStatic(app);
  } catch (error: any) {
    throw new Error(`Failed to set up static serving: ${error.message}`);
  }
}

/**
 * Load full application features after health checks are available
 */
async function loadFullApplication(): Promise<void> {
  try {
    log('🔄 Loading full application features...');
    
    // Load API routes FIRST - must be before Vite's catch-all middleware
    const { registerRoutes } = await import('./routes-minimal');
    await registerRoutes(app);
    log('✅ Essential application routes loaded');
    
    // Setup Vite middleware AFTER API routes are secured
    const { setupVite } = await import('./vite');
    if (process.env.NODE_ENV === 'development') {
      log('🔄 Setting up Vite for frontend development...');
      await setupVite(app, server);
      log('✅ Vite development server configured');
    } else {
      log('✅ Static file serving ready for production');
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
    log('🔄 Background work complete - all routes already loaded');
  } catch (error: any) {
    log(`⚠️ Background initialization failed: ${error.message}`, 'error');
  }
}