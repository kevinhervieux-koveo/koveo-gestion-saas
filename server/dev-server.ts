/**
 * Fast Development Server for Koveo Gestion
 * Opens port immediately, then loads features in background
 */
import express from 'express';

const app = express();
const port = parseInt(process.env.PORT || '5000', 10);

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy
app.set('trust proxy', true);

// Immediate health endpoints - no dependencies
app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/healthz', (req, res) => res.status(200).send('OK'));
app.get('/ready', (req, res) => res.status(200).send('OK'));
app.get('/ping', (req, res) => res.status(200).send('pong'));

// Basic API status
app.get('/api', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Koveo Gestion API is running',
    version: '1.0.0',
  });
});

// Simple frontend serving for development
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Koveo Gestion - Loading...</title></head>
      <body>
        <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: Arial;">
          <div style="text-align: center;">
            <h1>🏢 Koveo Gestion</h1>
            <p>Development server is starting up...</p>
            <div style="margin: 20px;">⏳ Loading full application features...</div>
          </div>
        </div>
      </body>
    </html>
  `);
});

// Start server IMMEDIATELY
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Development server listening on http://0.0.0.0:${port}`);
  console.log(`🌐 Server ready - loading full features in background...`);

  // Load full application features AFTER port is open
  setTimeout(() => {
    loadFullApplication().catch(console.error);
  }, 100);
});

// Error handling
server.on('error', (error: any) => {
  console.error(`Server error: ${error?.message || error}`);
  if (error?.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use`);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

/**
 * Load full application features in background
 */
async function loadFullApplication(): Promise<void> {
  try {
    console.log('🔄 Loading full application features in background...');

    // Setup Vite for frontend development
    const { setupVite } = await import('./vite.js');
    await setupVite(app, server);
    console.log('✅ Vite development server configured');

    // Load API routes
    const { registerRoutes } = await import('./routes-minimal.js');
    await registerRoutes(app);
    console.log('✅ Full application routes loaded');

    console.log('🎉 Development server fully ready!');
  } catch (error: any) {
    console.error(`⚠️ Failed to load full application: ${error.message}`);
    // Continue - basic server still works
  }
}

export { app, server };
