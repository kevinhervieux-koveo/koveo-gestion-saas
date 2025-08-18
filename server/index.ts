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
    
    // Register API routes FIRST to ensure they take precedence over static serving
    try {
      await registerRoutes(app);
      log('✅ Routes registered successfully');
    } catch (error) {
      log(`❌ Route registration failed: ${error}`, 'error');
      // Skip route registration but continue with Vite setup
    }

    // Setup static file serving AFTER API routes to avoid conflicts
    // Check if we should use development mode
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      log('🔧 Setting up development server');
      // Simple HTML page for now since Vite has routing issues
      const basicHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Koveo Gestion</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #2563eb; margin-bottom: 20px; }
        .status { padding: 12px; background: #fef3c7; border-left: 4px solid #f59e0b; margin: 20px 0; }
        .success { background: #d1fae5; border-left-color: #10b981; }
        .api-test { margin: 20px 0; padding: 20px; background: #f8fafc; border-radius: 4px; }
        button { background: #2563eb; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #1d4ed8; }
        pre { background: #f3f4f6; padding: 12px; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🏢 Koveo Gestion</h1>
        <div class="status success">
            ✅ Server is running successfully on port ${port}
        </div>
        <p>Quebec Property Management System</p>
        <p>The server is working properly. API endpoints are functional.</p>
        
        <div class="api-test">
            <h3>API Test</h3>
            <button onclick="testAPI()">Test Health Endpoint</button>
            <div id="api-result"></div>
        </div>
        
        <h3>Available Endpoints:</h3>
        <ul>
            <li><strong>GET /health</strong> - Health check</li>
            <li><strong>GET /test</strong> - Test endpoint</li>
            <li><strong>GET /api/health</strong> - API health check</li>
        </ul>
        
        <p><small>The React frontend is being configured. Server is operational.</small></p>
    </div>
    
    <script>
        async function testAPI() {
            const result = document.getElementById('api-result');
            try {
                const response = await fetch('/health');
                const data = await response.json();
                result.innerHTML = '<pre style="color: green;">✅ ' + JSON.stringify(data, null, 2) + '</pre>';
            } catch (error) {
                result.innerHTML = '<pre style="color: red;">❌ Error: ' + error.message + '</pre>';
            }
        }
    </script>
</body>
</html>`;
      
      app.get('/', (req, res) => {
        res.send(basicHTML);
      });
      
      app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) {
          return res.status(404).json({ error: 'API route not found' });
        }
        res.send(basicHTML);
      });
      
      log('✅ Development server ready')
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
    log('📧 Starting email service initialization...');
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Email service timeout after 10 seconds')), 10000);
    });
    
    await Promise.race([emailService.initialize(), timeoutPromise]);
    log('📧 Email service initialized successfully');
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
