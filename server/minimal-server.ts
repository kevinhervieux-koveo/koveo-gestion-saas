/**
 * Ultra-minimal server for deployment health checks
 * This completely bypasses all heavy initialization
 */
import express from 'express';
import { createFastHealthCheck, createStatusCheck, createRootHandler } from './health-check';
import { createUltraHealthEndpoints } from './ultra-health';
import { log } from './vite';

const app = express();
const port = parseInt(process.env.PORT || '5000', 10);

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

// Ultra-fast health endpoints FIRST
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
    version: '1.0.0',
  });
});

// Start server immediately
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(port, '0.0.0.0', () => {
    log(`🚀 MINIMAL SERVER ready on port ${port}`);
    log(`✅ Health checks available immediately`);
    log(`🌐 Deployment-ready - no heavy operations`);

    // Only load full application if explicitly requested
    if (process.env.LOAD_FULL_APP === 'true') {
      setTimeout(async () => {
        try {
          log('🔄 Loading full application...');
          const { initializeApplicationAsync } = await import('./index');
          await initializeApplicationAsync();
          log('✅ Full application loaded');
        } catch (error: any) {
          log(`⚠️ Full application load failed: ${error.message}`, 'error');
        }
      }, 10000); // 10 second delay
    }
  });

  // Optimized timeouts for deployment
  server.keepAliveTimeout = 30000;
  server.headersTimeout = 35000;
  server.requestTimeout = 10000;
  server.timeout = 15000;

  // Graceful shutdown
  process.on('SIGTERM', () => {
    log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      log('Server closed');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
  });

  export { server };
}

export { app };
