import type { Express } from 'express';
import { createServer, type Server } from 'http';
import { sessionConfig, setupAuthRoutes, requireAuth, requireRole, authorize } from './auth';
import { registerPermissionsRoutes } from './api/permissions';

/**
 * Core routes registration with essential functionality.
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // Setup session middleware
  app.use(sessionConfig);
  
  // Setup authentication routes
  setupAuthRoutes(app);
  
  // Register permissions API routes
  registerPermissionsRoutes(app);
  
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