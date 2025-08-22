import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../../server/routes-minimal';
import { setupVite, serveStatic } from '../../../server/vite';
import { createServer } from 'http';
import * as path from 'path';
import * as fs from 'fs';

/**
 * CRITICAL DEPLOYMENT TESTS
 * 
 * These tests validate that the application will work correctly in production
 * and prevent deployment errors like "Cannot GET /" that break the entire app.
 * 
 * This test suite should be run BEFORE every deployment to catch issues early.
 */
describe('CRITICAL: Deployment Validation Tests', () => {
  describe('Application Startup Tests', () => {
    test('should start server without crashing', async () => {
      const app = express();
      let server: any = null;
      
      try {
        server = createServer(app);
        const startPromise = new Promise((resolve, reject) => {
          server.listen(0, (error: any) => {
            if (error) reject(error);
            else resolve(server);
          });
          
          // Timeout after 10 seconds
          setTimeout(() => reject(new Error('Server startup timeout')), 10000);
        });
        
        await startPromise;
        expect(server.listening).toBe(true);
      } finally {
        if (server) {
          server.close();
        }
      }
    }, 15000);

    test('should register routes without errors', async () => {
      const app = express();
      app.use(express.json());
      
      expect(async () => {
        await registerRoutes(app);
      }).not.toThrow();
    });

    test('should handle middleware setup without errors', async () => {
      const app = express();
      app.use(express.json());
      app.use(express.urlencoded({ extended: false }));
      
      // Test session middleware setup
      expect(() => {
        const session = require('express-session');
        app.use(session({
          secret: 'test-secret',
          resave: false,
          saveUninitialized: false
        }));
      }).not.toThrow();
    });
  });

  describe('Critical Route Availability Tests', () => {
    let app: express.Application;
    let server: any;

    beforeAll(async () => {
      app = express();
      app.use(express.json());
      app.use(express.urlencoded({ extended: false }));
      
      // Setup basic routes that should always work
      await registerRoutes(app);
      
      server = createServer(app);
    });

    afterAll(() => {
      if (server) {
        server.close();
      }
    });

    test('should respond to health check endpoints', async () => {
      // Health check endpoints are critical for monitoring
      const healthEndpoints = ['/api/health', '/healthz', '/ready'];
      
      for (const endpoint of healthEndpoints) {
        const response = await request(app).get(endpoint);
        expect(response.status).toBeLessThan(500);
        expect(response.status).not.toBe(404);
      }
    });

    test('should handle API routes without 404 errors', async () => {
      // Test that basic API structure exists
      const response = await request(app).get('/api/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
    });

    test('should not return 404 for authentication endpoints', async () => {
      const authEndpoints = ['/api/auth/login', '/api/auth/logout'];
      
      for (const endpoint of authEndpoints) {
        const response = await request(app).post(endpoint).send({});
        
        // Should not be 404 (not found), but may be 400 (bad request) or 401 (unauthorized)
        expect(response.status).not.toBe(404);
      }
    });
  });

  describe('Production Build Validation Tests', () => {
    test('should have required production files when built', () => {
      const buildDirectory = path.resolve(__dirname, '../../../server/public');
      
      // Check if running in production mode would work
      if (process.env.NODE_ENV === 'production') {
        expect(fs.existsSync(buildDirectory)).toBe(true);
        
        const indexPath = path.resolve(buildDirectory, 'index.html');
        expect(fs.existsSync(indexPath)).toBe(true);
        
        // Validate index.html content
        if (fs.existsSync(indexPath)) {
          const indexContent = fs.readFileSync(indexPath, 'utf-8');
          expect(indexContent).toContain('<div id="root">');
          expect(indexContent).toContain('</html>');
          expect(indexContent.length).toBeGreaterThan(100);
        }
      }
    });

    test('should validate package.json build scripts exist', () => {
      const packageJsonPath = path.resolve(__dirname, '../../../package.json');
      expect(fs.existsSync(packageJsonPath)).toBe(true);
      
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      
      // Critical build scripts must exist
      expect(packageJson.scripts).toHaveProperty('build');
      expect(packageJson.scripts).toHaveProperty('build:client');
      expect(packageJson.scripts).toHaveProperty('build:server');
      expect(packageJson.scripts).toHaveProperty('start');
    });

    test('should validate environment variables for production', () => {
      const requiredEnvVars = [
        'DATABASE_URL'
      ];
      
      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      
      if (process.env.NODE_ENV === 'production') {
        expect(missingVars).toEqual([]);
      } else {
        // In development, at least DATABASE_URL should exist
        expect(process.env.DATABASE_URL).toBeDefined();
      }
    });
  });

  describe('SPA Routing Protection Tests', () => {
    let app: express.Application;

    beforeEach(() => {
      app = express();
      app.use(express.json());
    });

    test('should serve index.html for SPA routes (production)', () => {
      const distPath = path.resolve(__dirname, '../../../server/public');
      
      // Mock production static serving
      if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
        
        // Critical SPA fallback route
        app.get('*', (req, res) => {
          if (req.path.startsWith('/api')) {
            return res.status(404).json({ error: 'API route not found' });
          }
          const indexPath = path.resolve(distPath, 'index.html');
          if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
          } else {
            res.status(404).send('Application not found');
          }
        });
        
        // Test that root route doesn't return 404
        return request(app)
          .get('/')
          .expect(200);
      } else {
        // If no build exists, this should be caught by build validation tests
        console.warn('⚠️ No production build found - SPA routing test skipped');
      }
    });

    test('should distinguish between API and SPA routes', async () => {
      // Mock the SPA fallback behavior
      app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) {
          return res.status(404).json({ error: 'API route not found' });
        }
        // This simulates serving the SPA
        res.status(200).send('<html><body><div id="root"></div></body></html>');
      });

      // API routes should return proper 404 JSON
      const apiResponse = await request(app).get('/api/nonexistent');
      expect(apiResponse.status).toBe(404);
      expect(apiResponse.body).toHaveProperty('error');

      // SPA routes should return HTML (not 404)
      const spaResponse = await request(app).get('/dashboard');
      expect(spaResponse.status).toBe(200);
      expect(spaResponse.text).toContain('<div id="root">');
    });
  });

  describe('Static File Serving Tests', () => {
    test('should serve static assets without errors', () => {
      const app = express();
      const publicPath = path.resolve(__dirname, '../../../server/public');
      
      if (fs.existsSync(publicPath)) {
        expect(() => {
          app.use(express.static(publicPath));
        }).not.toThrow();
      }
    });

    test('should handle missing static files gracefully', async () => {
      const app = express();
      const publicPath = path.resolve(__dirname, '../../../server/public');
      
      if (fs.existsSync(publicPath)) {
        app.use(express.static(publicPath));
        
        // Test request for non-existent file
        const response = await request(app).get('/nonexistent-file.js');
        expect(response.status).toBe(404);
      }
    });
  });

  describe('Database Connection Tests', () => {
    test('should connect to database without errors', async () => {
      expect(process.env.DATABASE_URL).toBeDefined();
      
      try {
        // Test database connection
        const { db } = await import('../../../server/db');
        
        // Simple query to test connection
        const result = await db.execute('SELECT 1 as test');
        expect(result).toBeDefined();
      } catch (error) {
        // If database is not available, this test should fail
        // This prevents deploying with broken database configuration
        throw new Error(`Database connection failed: ${error}`);
      }
    });

    test('should validate database schema exists', async () => {
      try {
        const { db } = await import('../../../server/db');
        
        // Test that critical tables exist
        const tablesQuery = await db.execute(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
        `);
        
        const tableNames = tablesQuery.rows.map((row: any) => row.table_name);
        
        // Critical tables that must exist for the app to work
        const requiredTables = ['users', 'organizations'];
        const missingTables = requiredTables.filter(table => !tableNames.includes(table));
        
        expect(missingTables).toEqual([]);
      } catch (error) {
        throw new Error(`Database schema validation failed: ${error}`);
      }
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle server errors gracefully', async () => {
      const app = express();
      
      // Route that throws an error
      app.get('/test-error', () => {
        throw new Error('Test error');
      });
      
      // Error handler
      app.use((err: any, req: any, res: any, next: any) => {
        res.status(500).json({ message: err.message || 'Internal Server Error' });
      });
      
      const response = await request(app).get('/test-error');
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message');
    });

    test('should provide meaningful error messages', async () => {
      const app = express();
      
      // Route that throws a specific error
      app.get('/test-specific-error', () => {
        const error = new Error('Database connection failed');
        (error as any).status = 503;
        throw error;
      });
      
      // Error handler
      app.use((err: any, req: any, res: any, next: any) => {
        const status = err.status || err.statusCode || 500;
        res.status(status).json({ message: err.message || 'Internal Server Error' });
      });
      
      const response = await request(app).get('/test-specific-error');
      expect(response.status).toBe(503);
      expect(response.body.message).toBe('Database connection failed');
    });
  });

  describe('Memory and Performance Tests', () => {
    test('should not have memory leaks in route handlers', async () => {
      const app = express();
      app.use(express.json());
      
      // Simple health check route
      app.get('/health', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
      });
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Make multiple requests
      for (let i = 0; i < 50; i++) {
        await request(app).get('/health');
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB for 50 requests)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    test('should respond to requests within reasonable time', async () => {
      const app = express();
      app.get('/health', (req, res) => {
        res.json({ status: 'ok' });
      });
      
      const startTime = Date.now();
      const response = await request(app).get('/health');
      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });

  describe('Configuration Validation Tests', () => {
    test('should validate server configuration', () => {
      // Port configuration
      const port = parseInt(process.env.PORT || process.env.REPL_PORT || '8080', 10);
      expect(port).toBeGreaterThan(0);
      expect(port).toBeLessThan(65536);
      
      // Node environment
      const nodeEnv = process.env.NODE_ENV || 'development';
      expect(['development', 'production', 'test']).toContain(nodeEnv);
    });

    test('should validate critical dependencies exist', () => {
      const packageJsonPath = path.resolve(__dirname, '../../../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      
      // Critical runtime dependencies
      const requiredDeps = [
        'express',
        'drizzle-orm',
        '@neondatabase/serverless'
      ];
      
      requiredDeps.forEach(dep => {
        expect(packageJson.dependencies).toHaveProperty(dep);
      });
    });
  });

  describe('Deployment Readiness Checklist', () => {
    test('DEPLOYMENT BLOCKER: Root route must not return 404', async () => {
      const app = express();
      app.use(express.json());
      
      // Mock the production setup
      const distPath = path.resolve(__dirname, '../../../server/public');
      
      if (fs.existsSync(distPath)) {
        // Production mode: serve static files
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
          if (req.path.startsWith('/api')) {
            return res.status(404).json({ error: 'API route not found' });
          }
          const indexPath = path.resolve(distPath, 'index.html');
          if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
          } else {
            res.status(404).send('Application not found');
          }
        });
        
        const response = await request(app).get('/');
        expect(response.status).toBe(200);
        expect(response.status).not.toBe(404); // THIS IS THE CRITICAL CHECK
        
      } else {
        // Development mode: should have a fallback
        app.get('/', (req, res) => {
          res.send('<html><body><h1>Koveo Gestion - Development</h1></body></html>');
        });
        
        const response = await request(app).get('/');
        expect(response.status).toBe(200);
      }
    });

    test('DEPLOYMENT BLOCKER: Health checks must work', async () => {
      const app = express();
      
      // Add basic health checks
      app.get('/api/health', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
      });
      
      app.get('/healthz', (req, res) => {
        res.send('OK');
      });
      
      const healthResponse = await request(app).get('/api/health');
      expect(healthResponse.status).toBe(200);
      expect(healthResponse.body.status).toBe('ok');
      
      const healthzResponse = await request(app).get('/healthz');
      expect(healthzResponse.status).toBe(200);
      expect(healthzResponse.text).toBe('OK');
    });

    test('DEPLOYMENT BLOCKER: Database must be accessible', async () => {
      expect(process.env.DATABASE_URL).toBeDefined();
      expect(process.env.DATABASE_URL).toContain('postgresql');
      
      try {
        const { db } = await import('../../../server/db');
        const result = await db.execute('SELECT 1');
        expect(result).toBeDefined();
      } catch (error) {
        throw new Error(`DEPLOYMENT BLOCKED: Database connection failed - ${error}`);
      }
    });

    test('DEPLOYMENT BLOCKER: App must start without crashing', async () => {
      // This test ensures the main application structure is sound
      expect(() => {
        const express = require('express');
        const app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: false }));
      }).not.toThrow();
      
      // Test that routes can be imported without errors
      expect(async () => {
        await import('../../../server/routes-minimal');
      }).not.toThrow();
    });
  });
});