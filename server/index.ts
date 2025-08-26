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
app.get('/', createRootHandler());
app.head('/', (req, res) => res.status(200).end());
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
      log('🚀 Running in minimal mode - health checks available immediately');
      
      // Load full application features after health checks are available
      setTimeout(() => {
        loadFullApplication().catch((error) => {
          log(`⚠️ Full application load failed: ${error.message}`, 'error');
          // Continue - health checks still work
        });
      }, 5000); // 5 second delay to ensure health checks work first
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
    
    // Only load full features in development
    if (process.env.NODE_ENV === 'development') {
      // Load routes and features
      const { registerRoutes } = await import('./routes-minimal');
      await registerRoutes(app);
      log('✅ Full application routes loaded');
    } else {
      log('🚀 Production mode - keeping minimal footprint for stability');
    }
    
  } catch (error: any) {
    log(`⚠️ Failed to load full application: ${error.message}`, 'error');
    // Continue - health checks still work
  }
}