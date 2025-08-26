/**
 * Production Entry Point for Koveo Gestion
 * This file ensures API routes work correctly in production
 */
import express from 'express';
import path from 'path';
import fs from 'fs';
import compression from 'compression';

const app = express();
const port = parseInt(process.env.PORT || '5000', 10);

// Trust proxy
app.set('trust proxy', true);

// Middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health checks
app.get('/health', (req, res) => res.send('OK'));
app.get('/healthz', (req, res) => res.send('OK'));
app.get('/ready', (req, res) => res.send('OK'));
app.get('/ping', (req, res) => res.send('pong'));
app.get('/api', (req, res) => res.json({ status: 'ok', message: 'API is running' }));

// Start server and load features
const server = app.listen(port, '0.0.0.0', async () => {
  console.log(`Server listening on port ${port}`);
  
  try {
    // Load API routes FIRST
    const { registerRoutes } = await import('./routes-minimal.js');
    await registerRoutes(app);
    console.log('API routes loaded');
    
    // Setup static files AFTER API routes
    const publicPath = path.resolve(process.cwd(), 'dist', 'public');
    
    if (fs.existsSync(publicPath)) {
      // Serve assets
      app.use('/assets', express.static(path.join(publicPath, 'assets'), {
        maxAge: '1y',
        immutable: true
      }));
      
      // Serve static files (skip API routes)
      app.use((req, res, next) => {
        if (req.path.startsWith('/api/')) {
          return next();
        }
        express.static(publicPath)(req, res, next);
      });
      
      // SPA fallback
      app.get('*', (req, res) => {
        if (req.path.startsWith('/api/')) {
          return res.status(404).json({ error: 'Not found' });
        }
        res.sendFile(path.join(publicPath, 'index.html'));
      });
      
      console.log('Static files configured');
    }
    
    console.log('Production server ready');
  } catch (error) {
    console.error('Failed to load features:', error);
  }
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

export { app, server };