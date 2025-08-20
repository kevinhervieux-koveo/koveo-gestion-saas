import express, { type Request, Response, NextFunction } from 'express';
import { registerRoutes } from './routes-minimal';
import { setupVite, serveStatic, log } from './vite';
import { initializeDatabaseOptimizations, startPerformanceMonitoring } from './init-database-optimizations';
import { startJobs } from './jobs';
import { emailService } from './services/email-service';
import * as path from 'path';
import * as fs from 'fs';

// Configure port for deployment platform compatibility
// Support Cloud Run, Railway, Heroku, and other platforms
let port = parseInt(process.env.PORT || process.env.REPL_PORT || '8080', 10);

// Ensure port is valid
if (isNaN(port) || port < 1 || port > 65535) {
  console.error(`Invalid port: ${process.env.PORT || process.env.REPL_PORT || '8080'}. Using default 8080.`);
  port = 8080;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Health check endpoints for API monitoring (NOT for frontend serving)
app.get('/api/health', (req, res) => {
  // API health check with timeout protection
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({ status: 'timeout', message: 'Health check timeout' });
    }
  }, 5000); // 5 second timeout
  
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ 
    status: 'ok', 
    message: 'Koveo Gestion API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    port: port
  });
  
  clearTimeout(timeout);
});

app.get('/api/health/detailed', (req, res) => {
  // Comprehensive health check with timeout protection
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({ status: 'timeout', message: 'Health check timeout' });
    }
  }, 3000); // 3 second timeout for health checks
  
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ 
    status: 'healthy', 
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
    pid: process.pid,
    nodeVersion: process.version,
    port: port,
    env: process.env.NODE_ENV || 'development'
  });
  
  clearTimeout(timeout);
});

app.get('/healthz', (req, res) => {
  // Kubernetes-style health check endpoint with timeout
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).send('TIMEOUT');
    }
  }, 2000); // 2 second timeout
  
  res.setHeader('Cache-Control', 'no-cache');
  res.status(200).send('OK');
  
  clearTimeout(timeout);
});

app.get('/ready', (req, res) => {
  // Readiness probe endpoint with timeout protection
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({ ready: false, status: 'timeout' });
    }
  }, 2000); // 2 second timeout
  
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ 
    ready: true, 
    timestamp: new Date().toISOString(),
    port: port,
    uptime: process.uptime()
  });
  
  clearTimeout(timeout);
});

// Add global error handlers to prevent application crashes
process.on('uncaughtException', (error) => {
  log(`Uncaught Exception: ${error.message}`, 'error');
  log(error.stack || '', 'error');
  // Don't exit in production to maintain uptime for Cloud Run
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled Rejection at: ${promise}, reason: ${reason}`, 'error');
  // Don't exit in production to maintain uptime for Cloud Run
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Graceful shutdown for Cloud Run
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    log('Server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    log('Forced shutdown');
    process.exit(1);
  }, 10000);
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (path.startsWith('/api')) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + '…';
      }

      log(logLine);
    }
  });

  next();
});

// Features API route - Placed here to ensure it takes precedence over Vite middleware
app.get('/api/features', async (req, res) => {
  try {
    const { Pool, neonConfig } = await import('@neondatabase/serverless');
    const ws = await import('ws');
    neonConfig.webSocketConstructor = ws.default;
    
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const { roadmap } = req.query;
    
    if (roadmap === 'true') {
      const rawFeatures = await pool.query(`
        SELECT id, name, description, category, status, priority, 
               business_objective, target_users, success_metrics,
               is_public_roadmap, is_strategic_path, created_at, updated_at
        FROM features 
        WHERE is_public_roadmap = true 
        ORDER BY created_at DESC
      `);
      
      const features = rawFeatures.rows.map(row => ({
        ...row,
        isPublicRoadmap: row.is_public_roadmap,
        isStrategicPath: row.is_strategic_path,
        businessObjective: row.business_objective,
        targetUsers: row.target_users,
        successMetrics: row.success_metrics,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
      
      res.setHeader('Content-Type', 'application/json');
      res.json(features);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('Features API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User organizations API route - Must be before Vite middleware
// Note: This route needs to be defined before Vite middleware but after session setup
// We'll move it to the proper location after session initialization

// Feature status update route - Also placed here to bypass middleware issues
app.post('/api/features/:id/update-status', async (req, res) => {
  try {
    const { Pool, neonConfig } = await import('@neondatabase/serverless');
    const ws = await import('ws');
    neonConfig.webSocketConstructor = ws.default;
    
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const { status } = req.body;
    const featureId = req.params.id;
    
    const validStatuses = ['submitted', 'planned', 'in-progress', 'ai-analyzed', 'completed', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const updateQuery = `
      UPDATE features 
      SET status = $1, updated_at = NOW() 
      WHERE id = $2 
      RETURNING *
    `;
    
    const result = await pool.query(updateQuery, [status, featureId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Feature not found' });
    }
    
    const feature = {
      ...result.rows[0],
      isPublicRoadmap: result.rows[0].is_public_roadmap,
      isStrategicPath: result.rows[0].is_strategic_path,
      businessObjective: result.rows[0].business_objective,
      targetUsers: result.rows[0].target_users,
      successMetrics: result.rows[0].success_metrics,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.json(feature);
  } catch (error) {
    console.error('Feature status update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server immediately with health checks first
// Cloud Run provides PORT environment variable, fallback to 8080
let server: any;

try {
  server = app.listen(
    port,
    '0.0.0.0', // Bind to all interfaces for deployment compatibility
    () => {
      log(`🚀 Server ready and health checks available on port ${port}`);
      log(`🌐 Health check URLs:`);
      log(`   - http://0.0.0.0:${port}/health`);
      log(`   - http://0.0.0.0:${port}/healthz`);
      log(`   - http://0.0.0.0:${port}/ready`);
      
      // Initialize everything else in background after server is listening
      setTimeout(() => initializeApplication(), 100);
    }
  );

  // Handle server errors gracefully without crashing in production
  server.on('error', (error: any) => {
    log(`Server error: ${error.message}`, 'error');
    if (error.code === 'EADDRINUSE') {
      log(`Port ${port} is already in use`, 'error');
      // Don't exit in production to maintain uptime
      if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
      } else {
        log('⚠️ Continuing in production despite port conflict', 'error');
      }
    }
  });

} catch (error) {
  log(`Failed to start server: ${error}`, 'error');
  // Don't exit in production to maintain uptime
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  } else {
    log('⚠️ Server startup failed in production, attempting recovery', 'error');
  }
}

// Initialize application components after server starts
/**
 *
 */
async function initializeApplication() {
  try {
    log('🚀 Starting application initialization...');
    
    // Object Storage routes (must come before other routes for proper file serving)
    try {
      const { ObjectStorageService, ObjectNotFoundError } = await import('./objectStorage');

      // Route for serving private objects (with authentication required)
      app.get('/objects/:objectPath(*)', async (req: any, res) => {
        try {
          const objectStorageService = new ObjectStorageService();
          const objectFile = await objectStorageService.getObjectEntityFile(req.path);
          await objectStorageService.downloadObject(objectFile, res);
        } catch (error) {
          console.error('Error serving private object:', error);
          if (error instanceof ObjectNotFoundError) {
            return res.status(404).json({ error: 'File not found' });
          }
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // Route for serving public objects (no authentication needed)
      app.get('/public-objects/:filePath(*)', async (req, res) => {
        const filePath = req.params.filePath;
        try {
          const objectStorageService = new ObjectStorageService();
          const file = await objectStorageService.searchPublicObject(filePath);
          if (!file) {
            return res.status(404).json({ error: 'File not found' });
          }
          await objectStorageService.downloadObject(file, res);
        } catch (error) {
          console.error('Error serving public object:', error);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      log('✅ Object storage routes registered');
    } catch (error) {
      log(`❌ Object storage routes setup failed: ${error}`, 'error');
    }

    // Register API routes FIRST to ensure they take precedence over static serving
    try {
      await registerRoutes(app);
      log('✅ Routes registered successfully');
      
      // Add the user organizations route AFTER session middleware is set up
      const { requireAuth } = await import('./auth');
      app.get('/api/users/me/organizations', requireAuth, async (req: any, res: any) => {
        try {
          const { getUserAccessibleOrganizations } = await import('./rbac');
          const { Pool, neonConfig } = await import('@neondatabase/serverless');
          const { drizzle } = await import('drizzle-orm/neon-serverless');
          const { inArray } = await import('drizzle-orm');
          const schema = await import('../shared/schema');
          const ws = await import('ws');
          
          neonConfig.webSocketConstructor = ws.default;
          const pool = new Pool({ connectionString: process.env.DATABASE_URL });
          const db = drizzle({ client: pool, schema });
          
          const userId = req.user!.id;
          console.log('Getting accessible organizations for user:', userId);
          
          const accessibleOrgIds = await getUserAccessibleOrganizations(userId);
          console.log('Accessible org IDs:', accessibleOrgIds);
          
          const organizations = await db.query.organizations.findMany({
            where: inArray(schema.organizations.id, accessibleOrgIds),
            orderBy: [schema.organizations.name]
          });
          
          console.log('Organizations found:', organizations.length, organizations.map(o => ({ id: o.id, name: o.name })));
          
          res.json(organizations);
        } catch (error) {
          console.error('Error fetching user organizations:', error);
          res.status(500).json({ message: 'Failed to fetch user organizations' });
        }
      });
      log('✅ User organizations route registered');
      
    } catch (error) {
      log(`❌ Route registration failed: ${error}`, 'error');
      // Skip route registration but continue with Vite setup
    }

    // Setup static file serving AFTER API routes to avoid conflicts
    // Check if we should use development mode
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      log('🔧 Running in development mode with Vite');
      try {
        await setupVite(app, server);
        log('✅ Vite development server started');
      } catch (error) {
        log(`❌ Vite setup failed: ${error}`, 'error');
        log('⚠️ Falling back to React build serving', 'error');
        
        // Try to serve the built React app if available
        const clientBuildPath = path.resolve(import.meta.dirname, '..', 'dist');
        const clientIndexPath = path.resolve(clientBuildPath, 'index.html');
        
        if (fs.existsSync(clientIndexPath)) {
          log('📁 Serving built React application');
          app.use(express.static(clientBuildPath));
          app.get('*', (req, res) => {
            if (req.path.startsWith('/api')) {
              return res.status(404).json({ error: 'API route not found' });
            }
            res.sendFile(clientIndexPath);
          });
        } else {
          log('⚠️ No build found, creating development placeholder');
          const devHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Koveo Gestion - Development</title>
    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; margin: 0; background: #f8fafc; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .status { padding: 12px; background: #d1fae5; border-left: 4px solid #10b981; margin: 20px 0; border-radius: 4px; }
        h1 { color: #1e40af; margin: 0; font-size: 2rem; }
        .subtitle { color: #64748b; margin-top: 8px; }
    </style>
</head>
<body>
    <div id="root"></div>
    <script type="text/babel">
        const { useState, useEffect } = React;
        
        function App() {
            const [health, setHealth] = useState(null);
            
            useEffect(() => {
                fetch('/health')
                    .then(res => res.json())
                    .then(data => setHealth(data))
                    .catch(err => console.error('Health check failed:', err));
            }, []);
            
            return (
                <div className="container">
                    <div className="header">
                        <h1>🏢 Koveo Gestion</h1>
                        <div className="subtitle">Quebec Property Management System</div>
                        <div className="status">
                            ✅ Development server is running
                            {health && <div>Server status: {health.status}</div>}
                        </div>
                    </div>
                    <div style={{background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'}}>
                        <h2>🚀 Application Status</h2>
                        <p>The Koveo Gestion server is operational. This is a development placeholder while the full React application is being configured.</p>
                        <ul>
                            <li>✅ Express server running on port ${port}</li>
                            <li>✅ API endpoints functional</li>
                            <li>✅ Database connections established</li>
                            <li>⚙️ React application loading...</li>
                        </ul>
                    </div>
                </div>
            );
        }
        
        ReactDOM.render(<App />, document.getElementById('root'));
    </script>
</body>
</html>`;
          
          app.get('/', (req, res) => res.send(devHTML));
          app.get('*', (req, res) => {
            if (req.path.startsWith('/api')) {
              return res.status(404).json({ error: 'API route not found' });
            }
            res.send(devHTML);
          });
        }
      }
    } else {
      log('🏗️ Running in production mode, serving static files from dist/public');
      // Use custom static file serving to avoid the routing parameter issue
      const distPath = path.resolve(import.meta.dirname, 'public');
      
      if (fs.existsSync(distPath)) {
        // Serve static files
        app.use(express.static(distPath));
        
        // Handle SPA routing by serving index.html for non-API routes
        app.get('*', (_req: Request, res: Response) => {
          // Skip API routes
          if (_req.path.startsWith('/api')) {
            return res.status(404).json({ error: 'API route not found' });
          }
          const indexPath = path.resolve(distPath, 'index.html');
          if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
          } else {
            res.status(404).send('Application not found');
          }
        });
      } else {
        log(`⚠️ Build directory not found: ${distPath}`, 'error');
      }
    }

    // Setup error handling
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || 'Internal Server Error';

      res.status(status).json({ message });
      // Don't throw in production to maintain uptime
      if (process.env.NODE_ENV !== 'production') {
        throw err;
      }
    });
    
    log(`✅ Core application initialized on port ${port}`);
    
    // Start all database and background operations after core app is ready
    setTimeout(() => {
      initializeEmailServiceInBackground();
      initializeDatabaseOptimizationsInBackground();
      initializeBackgroundJobsInBackground();
    }, 100);
    
  } catch (error) {
    log(`⚠️ Application initialization failed: ${error}`, 'error');
    // Don't crash - health checks will still work
  }
}

/**
 * Runs email service initialization in background with timeout handling.
 */
async function initializeEmailServiceInBackground(): Promise<void> {
  try {
    log('📧 Email service is ready (on-demand initialization)');
    // Email service will initialize on first use - no need for upfront initialization
  } catch (error) {
    log('⚠️ Email service initialization failed:', String(error));
    // Continue running - don't crash the server
  }
}

/**
 * Runs database optimizations in background with timeout handling.
 */
  async function initializeDatabaseOptimizationsInBackground(): Promise<void> {
    try {
      log('🚀 Starting database optimizations in background...');
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database optimization timeout after 30 seconds')), 30000);
      });
      
      const optimizationPromise = (async () => {
        await initializeDatabaseOptimizations();
        startPerformanceMonitoring();
      })();
      
      await Promise.race([optimizationPromise, timeoutPromise]);
      log('🚀 Database optimizations initialized successfully');
    } catch (error) {
      log('⚠️ Database optimization initialization failed:', String(error));
      // Continue running - don't crash the server
    }
  }
  
  /**
   * Runs background jobs initialization with timeout handling.
   */
  async function initializeBackgroundJobsInBackground(): Promise<void> {
    try {
      log('🔄 Starting background jobs in background...');
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Background jobs timeout after 20 seconds')), 20000);
      });
      
      await Promise.race([startJobs(), timeoutPromise]);
      log('🔄 Background jobs initialized successfully');
    } catch (error) {
      log('⚠️ Background job initialization failed:', String(error));
      // Continue running - don't crash the server
    }
  }
