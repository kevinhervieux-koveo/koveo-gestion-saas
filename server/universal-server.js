/**
 * Universal Server for Koveo Gestion
 * Works for both development and production environments
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
const isDevelopment = process.env.NODE_ENV === 'development';

// Trust proxy
app.set('trust proxy', true);

// Middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health checks - these work immediately
app.get('/health', (req, res) => res.send('OK'));
app.get('/healthz', (req, res) => res.send('OK'));
app.get('/ready', (req, res) => res.send('OK'));
app.get('/ping', (req, res) => res.send('pong'));
app.get('/status', (req, res) => res.json({ status: 'ok', environment: process.env.NODE_ENV }));
app.get('/api', (req, res) => res.json({ status: 'ok', message: 'API is running' }));

// Start server
const server = app.listen(port, '0.0.0.0', async () => {
  console.log(`🚀 Server running on http://0.0.0.0:${port} (${isDevelopment ? 'development' : 'production'} mode)`);
  
  try {
    // Load API routes FIRST - critical for both environments
    console.log('📌 Loading API routes...');
    const routesModule = isDevelopment 
      ? await import('./routes-minimal.js')
      : await import('./routes-minimal.js');
    await routesModule.registerRoutes(app);
    console.log('✅ API routes loaded successfully');
    
    if (isDevelopment) {
      // Development: Use Vite for hot reloading
      console.log('🔄 Setting up Vite development server...');
      const { setupVite } = await import('./vite.js');
      await setupVite(app, server);
      console.log('✅ Vite development server ready');
    } else {
      // Production: Serve static files
      const publicPath = path.resolve(process.cwd(), 'dist', 'public');
      
      if (!fs.existsSync(publicPath)) {
        console.error(`❌ Build directory not found: ${publicPath}`);
        console.error('Run "npm run build" before starting in production');
        process.exit(1);
      }
      
      console.log(`📁 Serving static files from: ${publicPath}`);
      
      // Serve assets with caching
      app.use('/assets', express.static(path.join(publicPath, 'assets'), {
        maxAge: '1y',
        immutable: true
      }));
      
      // Serve static files BUT skip API routes
      app.use((req, res, next) => {
        // Critical: Skip static serving for API routes
        if (req.path.startsWith('/api/')) {
          return next();
        }
        
        // Serve static files for non-API routes
        express.static(publicPath, {
          maxAge: '1h',
          index: false // Don't auto-serve index.html
        })(req, res, next);
      });
      
      // SPA fallback - MUST be last
      app.get('*', (req, res) => {
        // Don't serve index.html for API routes
        if (req.path.startsWith('/api/')) {
          return res.status(404).json({ 
            error: 'API endpoint not found',
            path: req.path 
          });
        }
        
        // Serve index.html for all client routes
        const indexPath = path.join(publicPath, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(404).send('Application not found');
        }
      });
      
      console.log('✅ Production static serving configured');
    }
    
    // Load background services
    setTimeout(async () => {
      try {
        if (isDevelopment) {
          // Load full development features
          const { initializeDatabaseOptimizations } = await import('./init-database-optimizations.js');
          await initializeDatabaseOptimizations();
          
          const { initializeDemoOrganizations } = await import('./services/demo-management-service.js');
          await initializeDemoOrganizations();
          
          const { startCleanupScheduler } = await import('./services/cleanup-scheduler.js');
          await startCleanupScheduler();
          
          console.log('✅ All development services loaded');
        }
      } catch (error) {
        console.error('⚠️ Background service error:', error);
      }
    }, 1000);
    
    console.log('🎉 Server fully initialized and ready!');
    console.log('📍 Available endpoints:');
    console.log(`   - Application: http://0.0.0.0:${port}`);
    console.log(`   - API Status: http://0.0.0.0:${port}/api`);
    console.log(`   - Health: http://0.0.0.0:${port}/health`);
    
  } catch (error) {
    console.error('❌ Server initialization failed:', error);
    process.exit(1);
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  if (req.path.startsWith('/api/')) {
    res.status(500).json({ 
      error: 'Internal server error',
      message: isDevelopment ? err.message : undefined
    });
  } else {
    res.status(500).send('Internal server error');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { app, server };