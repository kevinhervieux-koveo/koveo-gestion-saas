/**
 * Production Server with Fixed API Routing
 * This ensures API routes are handled before static files
 */
import express from 'express';
import path from 'path';
import fs from 'fs';
import compression from 'compression';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '5000', 10);

// Trust proxy for production deployment
app.set('trust proxy', true);

// Basic middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoints - these must work immediately
app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/healthz', (req, res) => res.status(200).send('OK'));
app.get('/ready', (req, res) => res.status(200).send('OK'));
app.get('/ping', (req, res) => res.status(200).send('pong'));
app.get('/api', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Koveo Gestion API is running',
    version: '1.0.0'
  });
});

// Load and register API routes BEFORE static files
async function startServer() {
  try {
    // Load API routes FIRST - this is critical for production
    console.log('📌 Loading API routes...');
    const { registerRoutes } = await import('./routes-minimal.js');
    await registerRoutes(app);
    console.log('✅ API routes registered successfully');

    // Now setup static file serving AFTER API routes
    const publicPath = path.resolve(process.cwd(), 'dist', 'public');
    
    if (!fs.existsSync(publicPath)) {
      console.error(`❌ Public directory not found: ${publicPath}`);
      console.error('Please run "npm run build" first');
      process.exit(1);
    }

    console.log(`📁 Serving static files from: ${publicPath}`);
    
    // Serve static assets with proper caching
    app.use('/assets', express.static(path.join(publicPath, 'assets'), {
      maxAge: '1y',
      immutable: true
    }));
    
    // CRITICAL: Custom static middleware that skips API routes
    app.use((req, res, next) => {
      // Skip static file serving for ALL API routes
      if (req.path.startsWith('/api/')) {
        return next();
      }
      
      // For non-API routes, serve static files
      express.static(publicPath, {
        maxAge: '1h',
        index: false // Don't serve index.html automatically
      })(req, res, next);
    });

    // SPA fallback - serve index.html for client routes
    app.get('*', (req, res) => {
      // IMPORTANT: Don't serve index.html for API routes
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ 
          error: 'API endpoint not found',
          path: req.path 
        });
      }
      
      const indexPath = path.join(publicPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Application not found');
      }
    });

    // Error handling
    app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Server error:', error);
      
      // Make sure to return JSON for API errors
      if (req.path.startsWith('/api/')) {
        res.status(500).json({ 
          error: 'Internal server error',
          message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
        });
      } else {
        res.status(500).send('Internal server error');
      }
    });

    // Start the server
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Production server running on http://0.0.0.0:${port}`);
      console.log(`✅ API routes are protected from static file conflicts`);
      console.log(`📍 Test endpoints:`);
      console.log(`   - Health: http://0.0.0.0:${port}/health`);
      console.log(`   - API Status: http://0.0.0.0:${port}/api`);
      console.log(`   - Login API: http://0.0.0.0:${port}/api/auth/login`);
      console.log('🎉 Server ready for production traffic!');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

  } catch (error: any) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

export { app };