import type { Express } from 'express';
import { createServer, type Server } from 'http';
import { sessionConfig, setupAuthRoutes, requireAuth, requireRole, authorize } from './auth';
import { registerPermissionsRoutes } from './api/permissions';
import { registerOrganizationRoutes } from './api/organizations';
import { registerUserRoutes } from './api/users';
import { log } from './vite';

/**
 * Core routes registration with essential functionality.
 * @param app
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // Setup session middleware
  try {
    app.use(sessionConfig);
    log('✅ Session middleware configured');
  } catch (error) {
    log(`❌ Session setup failed: ${error}`, 'error');
  }
  
  // Setup authentication routes
  try {
    setupAuthRoutes(app);
    log('✅ Auth routes registered');
  } catch (error) {
    log(`❌ Auth routes failed: ${error}`, 'error');
  }
  
  // Register permissions API routes
  try {
    registerPermissionsRoutes(app);
    log('✅ Permissions routes registered');
  } catch (error) {
    log(`❌ Permissions routes failed: ${error}`, 'error');
  }
  
  // Register organization API routes
  try {
    registerOrganizationRoutes(app);
    log('✅ Organization routes registered');
  } catch (error) {
    log(`❌ Organization routes failed: ${error}`, 'error');
  }
  
  // Register user API routes
  try {
    registerUserRoutes(app);
    log('✅ User routes registered');
  } catch (error) {
    log(`❌ User routes failed: ${error}`, 'error');
  }
  
  // Test route
  app.get('/test', (req, res) => {
    res.json({ message: 'Application running successfully' });
  });

  // Health check endpoints
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  app.get('/healthz', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/ready', (req, res) => {
    res.json({ status: 'ready' });
  });

  // Create and return HTTP server
  const server = createServer(app);
  return server;
}