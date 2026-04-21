import { type Request, type Response, type NextFunction } from 'express';

// Track whether frontend is fully loaded
let frontendReady = false;

export function setFrontendReady(ready: boolean) {
  frontendReady = ready;
}

export function isFrontendReady(): boolean {
  return frontendReady;
}

/**
 * Startup middleware that handles ALL routes during initialization
 * This prevents 503 errors for any route while the server is starting up
 */
export function createStartupMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // If frontend is ready, pass through to normal handlers
    if (frontendReady) {
      return next();
    }

    // Check if this is a health check endpoint - always pass through
    // Note: '/' is NOT included here - we want to show loading page for browser visits
    // Platform health checks use user-agent detection below
    const healthPaths = ['/health', '/healthz', '/ready', '/ping', '/status', '/api/health'];
    if (healthPaths.includes(req.path)) {
      return next();
    }

    // Check user agent for health check bots
    const userAgent = req.get('User-Agent') || '';
    const isHealthCheckBot =
      userAgent.includes('GoogleHC') ||
      userAgent.includes('Cloud-Run-Health-Check') ||
      userAgent.includes('kube-probe') ||
      userAgent.includes('ELB-HealthChecker') ||
      userAgent.includes('AWS-HealthChecker') ||
      userAgent.includes('Pingdom') ||
      userAgent.includes('StatusCake') ||
      userAgent.includes('deployment-health') ||
      req.headers['x-health-check'] === 'true' ||
      req.headers['x-deployment-check'] === 'true';

    if (isHealthCheckBot) {
      return next();
    }

    // For API requests during startup, return 200 with a "starting" status
    // This prevents frontend error handling from showing errors during startup
    if (req.path.startsWith('/api/')) {
      res.set({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      });
      return res.status(200).json({
        status: 'starting',
        message: 'Le serveur est en cours d\'initialisation. Veuillez patienter.',
        retryAfter: 2,
        ready: false
      });
    }

    // Check if this is a static asset request
    const isStaticAsset = req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json|map)$/);
    
    // For static assets during startup, return 503 with no-store to prevent caching
    // The loading page is self-contained and will auto-refresh
    if (isStaticAsset) {
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Retry-After': '2',
      });
      return res.status(503).end();
    }

    // For all other requests (browser navigation), show the loading page
    // This includes all HTML requests and direct URL navigations
    res.set({
      'Content-Type': 'text/html',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    return res.status(200).send(getLoadingPage());
  };
}

/**
 * Generate the loading page HTML
 */
function getLoadingPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="2">
  <title>Koveo Gestion - Chargement...</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #fff;
    }
    .loader {
      text-align: center;
    }
    .spinner {
      width: 50px;
      height: 50px;
      border: 3px solid rgba(255,255,255,0.1);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h1 { font-size: 1.5rem; margin: 0 0 10px; font-weight: 500; }
    p { margin: 0; opacity: 0.7; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <h1>Chargement de l'application...</h1>
    <p>Veuillez patienter un instant</p>
  </div>
</body>
</html>`;
}

/**
 * Ultra-fast health check handler optimized for deployment platforms
 * Responds immediately with minimal processing to prevent timeouts
 */
export function createFastHealthCheck() {
  return (req: Request, res: Response) => {
    // Set immediate timeout to prevent any hanging
    req.setTimeout(200, () => {
      if (!res.headersSent) {
        res.status(200).json({ status: 'ok', uptime: process.uptime() });
      }
    });

    // Set ultra-fast response headers
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Connection: 'close',
      'Content-Type': 'application/json',
      'X-Health-Check': 'OK',
      'X-Response-Time': Date.now().toString(),
    });

    // Send immediate response - no async operations
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
  };
}

/**
 * Fast JSON health status for monitoring
 */
export function createStatusCheck() {
  return (req: Request, res: Response) => {
    // Set immediate timeout
    req.setTimeout(200, () => {
      if (!res.headersSent) {
        res.status(200).json({ status: 'ok' });
      }
    });

    // Set headers for fast response
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Connection: 'close',
      'Content-Type': 'application/json',
    });

    // Send immediate JSON response with minimal data
    res.status(200).json({
      status: 'ok',
      timestamp: Date.now(),
    });
  };
}

/**
 * Root endpoint handler that prioritizes health checks
 * Startup logic is now handled by createStartupMiddleware
 */
export function createRootHandler() {
  return (req: Request, res: Response, next: Function) => {
    // Set ultra-short timeout for health checks
    req.setTimeout(100, () => {
      if (!res.headersSent) {
        res.status(200).send('OK');
      }
    });

    const userAgent = req.get('User-Agent') || '';
    const isHealthCheck =
      userAgent.includes('GoogleHC') ||
      userAgent.includes('Cloud-Run-Health-Check') ||
      userAgent.includes('kube-probe') ||
      userAgent.includes('ELB-HealthChecker') ||
      userAgent.includes('AWS-HealthChecker') ||
      userAgent.includes('Pingdom') ||
      userAgent.includes('StatusCake') ||
      userAgent.includes('deployment-health') ||
      req.headers['x-health-check'] === 'true' ||
      req.query.health === 'true' ||
      req.headers['x-deployment-check'] === 'true' ||
      (userAgent.startsWith('curl') && req.headers['accept'] === '*/*');

    // For deployment platforms and health checks, respond immediately with OK
    if (isHealthCheck) {
      res.set({
        Connection: 'close',
        'Content-Type': 'text/plain',
      });
      res.status(200).send('OK');
      return;
    }

    // For all other requests, pass to next handler (Vite/static files)
    // Startup handling is done by createStartupMiddleware
    return next();
  };
}
