/**
 * Simplified server startup to prevent hanging issues
 */
import express from 'express';
import path from 'path';
import helmet from 'helmet';
import { createFastHealthCheck, createStatusCheck } from './health-check';
import { log } from './vite';

// Production debugging: Log server startup
console.log('🚀 Starting server with simplified startup...');

// Add global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Don't exit in development to avoid interrupting work
  if (process.env.NODE_ENV !== 'development') {
    setTimeout(() => process.exit(1), 1000);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in development to maintain stability
  if (process.env.NODE_ENV !== 'development') {
    setTimeout(() => process.exit(1), 1000);
  }
});

const app = express();
const port = parseInt(process.env.PORT || '5000', 10);
const host = '0.0.0.0';

// Basic security
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Basic timeout handling
app.use((req, res, next) => {
  const timeout = 30000; // 30 second timeout for development
  req.setTimeout(timeout, () => {
    if (!res.headersSent) {
      console.warn(`⚠️ Request timeout after ${timeout}ms: ${req.method} ${req.url}`);
      res.status(408).json({ error: 'Request Timeout', url: req.url });
    }
  });
  next();
});

// Health endpoints - minimal and fast
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/ping', (req, res) => {
  res.send('pong');
});

// Basic API endpoint
app.get('/api', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Koveo Gestion API is running',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

// Simple static file serving for development
if (process.env.NODE_ENV === 'development') {
  // Serve client files from dist/public if it exists
  const publicPath = path.join(process.cwd(), 'dist', 'public');
  try {
    app.use(express.static(publicPath));
    console.log('✅ Serving static files from:', publicPath);
  } catch (err) {
    console.log('ℹ️ Static files not available yet');
  }
}

// Catch-all handler for SPA
app.get('*', (req, res) => {
  const indexPath = path.join(process.cwd(), 'dist', 'public', 'index.html');
  try {
    res.sendFile(indexPath);
  } catch (err) {
    res.status(200).json({ 
      message: 'Koveo Gestion - Server Running',
      status: 'ok',
      note: 'Frontend will be available once built'
    });
  }
});

let server: any;

// Graceful shutdown handlers
const gracefulShutdown = () => {
  console.log('🔄 Graceful shutdown initiated...');
  if (server) {
    server.close(() => {
      console.log('✅ Server closed gracefully');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(port, host, () => {
    console.log(`🚀 Server listening on http://${host}:${port}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('✅ Health endpoints: /health, /healthz, /ping');
    console.log('ℹ️ This is a simplified startup - full features will load separately');
  });

  // Set server timeouts
  server.keepAliveTimeout = 61000;
  server.headersTimeout = 62000;
  server.timeout = 120000;
}

export { app, server };