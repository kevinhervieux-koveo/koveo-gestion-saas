/**
 * Clean Production Server for Koveo Gestion
 * Simple, reliable production deployment without complex timing or delays
 */
import express from 'express';
import path from 'path';
import fs from 'fs';
import compression from 'compression';

const app = express();
const port = parseInt(process.env.PORT || '5000', 10);

// Trust proxy for production deployment
app.set('trust proxy', true);

// Basic middleware
app.use(compression()); // Enable gzip compression
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoints (simple and fast)
app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/healthz', (req, res) => res.status(200).send('OK'));
app.get('/ready', (req, res) => res.status(200).send('OK'));
app.get('/ping', (req, res) => res.status(200).send('pong'));

// API status endpoint
app.get('/api', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Koveo Gestion API is running',
    version: '1.0.0'
  });
});

// Static file serving - FIRST PRIORITY
const publicPath = path.resolve(process.cwd(), 'dist', 'public');

if (fs.existsSync(publicPath)) {
  console.log(`✅ Serving static files from: ${publicPath}`);
  
  // Serve static assets with proper caching
  app.use('/assets', express.static(path.join(publicPath, 'assets'), {
    maxAge: '1y', // Cache assets for 1 year
    immutable: true
  }));
  
  // Serve other static files
  app.use(express.static(publicPath, {
    maxAge: '1h' // Cache other files for 1 hour
  }));
  
  console.log('✅ Static file serving configured');
} else {
  console.error(`❌ Public directory not found: ${publicPath}`);
  process.exit(1);
}

// Load API routes
async function loadAPIRoutes() {
  try {
    const { registerRoutes } = await import('./routes-minimal');
    await registerRoutes(app);
    console.log('✅ API routes loaded');
  } catch (error: any) {
    console.error('❌ Failed to load API routes:', error.message);
  }
}

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  const indexPath = path.join(publicPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Application not found');
  }
});

// Error handling
app.use((error: any, req: any, res: any, next: any) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(port, '0.0.0.0', async () => {
  console.log(`🚀 Production server running on http://0.0.0.0:${port}`);
  console.log(`📁 Serving from: ${publicPath}`);
  
  // Load API routes after server starts
  await loadAPIRoutes();
  
  console.log('🎉 Production server ready!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { app, server };