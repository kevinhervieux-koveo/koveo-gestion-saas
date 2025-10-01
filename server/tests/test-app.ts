/**
 * Test application setup
 * Creates a minimal Express app for integration testing
 */
import express from 'express';
import { registerRoutes } from '../routes';

export function createTestApp() {
  const app = express();
  
  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Register all routes
  registerRoutes(app);
  
  return app;
}

export const testApp = createTestApp();
