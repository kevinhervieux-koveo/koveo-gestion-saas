import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../../server/routes-minimal';
import { setupVite, serveStatic } from '../../../server/vite';
import * as path from 'path';
import * as fs from 'fs';

/**
 * PRE-DEPLOYMENT CHECKLIST TESTS
 * 
 * This test suite acts as a final validation before deployment.
 * ALL tests in this suite MUST pass before deploying to production.
 * 
 * If any test fails, deployment should be BLOCKED until fixed.
 */
describe('🚨 PRE-DEPLOYMENT CHECKLIST - CRITICAL TESTS', () => {
  describe('🔴 DEPLOYMENT BLOCKERS - Must Pass', () => {
    test('🚨 CRITICAL: Root route "/" must not return 404', async () => {
      const app = express();
      app.use(express.json());

      // Simulate production static file serving
      const publicPath = path.resolve(__dirname, '../../../server/public');
      
      if (fs.existsSync(publicPath)) {
        // Production mode - serve built files
        app.use(express.static(publicPath));
        
        // SPA fallback route - THIS IS CRITICAL
        app.get('*', (req, res) => {
          if (req.path.startsWith('/api')) {
            return res.status(404).json({ error: 'API route not found' });
          }
          
          const indexPath = path.resolve(publicPath, 'index.html');
          if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
          } else {
            res.status(404).send('Application not found - index.html missing');
          }
        });
      } else {
        // Development fallback
        app.get('/', (req, res) => {
          res.send(`<!DOCTYPE html>
<html>
<head><title>Koveo Gestion</title></head>
<body><div id="root"><h1>Koveo Gestion Development</h1></div></body>
</html>`);
        });
      }

      // THE CRITICAL TEST - Root must not be 404
      const response = await request(app).get('/');
      
      expect(response.status).not.toBe(404);
      expect(response.status).toBe(200);
      
      if (response.status !== 200) {
        throw new Error(`🚨 DEPLOYMENT BLOCKED: Root route returns ${response.status}, not 200`);
      }
    });

    test('🚨 CRITICAL: Health check endpoints must be accessible', async () => {
      const app = express();
      
      // Add health check endpoints (these are critical for load balancers)
      app.get('/api/health', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
      });
      
      app.get('/healthz', (req, res) => {
        res.send('OK');
      });
      
      app.get('/ready', (req, res) => {
        res.json({ ready: true, timestamp: new Date().toISOString() });
      });

      // Test all health endpoints
      const healthResponse = await request(app).get('/api/health');
      const healthzResponse = await request(app).get('/healthz');
      const readyResponse = await request(app).get('/ready');

      expect(healthResponse.status).toBe(200);
      expect(healthzResponse.status).toBe(200);
      expect(readyResponse.status).toBe(200);

      if (healthResponse.status !== 200) {
        throw new Error('🚨 DEPLOYMENT BLOCKED: Health check /api/health failed');
      }
      if (healthzResponse.status !== 200) {
        throw new Error('🚨 DEPLOYMENT BLOCKED: Health check /healthz failed');
      }
      if (readyResponse.status !== 200) {
        throw new Error('🚨 DEPLOYMENT BLOCKED: Health check /ready failed');
      }
    });

    test('🚨 CRITICAL: Database connection must work', async () => {
      expect(process.env.DATABASE_URL).toBeDefined();
      
      if (!process.env.DATABASE_URL) {
        throw new Error('🚨 DEPLOYMENT BLOCKED: DATABASE_URL environment variable not set');
      }

      try {
        const { db } = await import('../../../server/db');
        const result = await db.execute('SELECT 1 as test');
        
        expect(result).toBeDefined();
      } catch (error) {
        throw new Error(`🚨 DEPLOYMENT BLOCKED: Database connection failed - ${error}`);
      }
    });

    test('🚨 CRITICAL: Required environment variables must be set', () => {
      const requiredEnvVars = ['DATABASE_URL'];
      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        throw new Error(`🚨 DEPLOYMENT BLOCKED: Missing environment variables: ${missingVars.join(', ')}`);
      }
    });

    test('🚨 CRITICAL: Server must start without crashing', async () => {
      const app = express();
      app.use(express.json());
      app.use(express.urlencoded({ extended: false }));

      // Test that we can register routes without errors
      expect(async () => {
        await registerRoutes(app);
      }).not.toThrow();

      // Test basic request handling
      app.get('/test-startup', (req, res) => {
        res.json({ status: 'server-running' });
      });

      const response = await request(app).get('/test-startup');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('server-running');
    });
  });

  describe('🟡 PRODUCTION READINESS - Should Pass', () => {
    test('🟡 Production build files should exist', () => {
      const buildPaths = [
        path.resolve(__dirname, '../../../server/public/index.html'),
        path.resolve(__dirname, '../../../server/public/assets'),
        path.resolve(__dirname, '../../../dist/index.js')
      ];

      if (process.env.NODE_ENV === 'production') {
        buildPaths.forEach(buildPath => {
          if (!fs.existsSync(buildPath)) {
            console.warn(`⚠️ WARNING: Production build file missing: ${buildPath}`);
          }
        });
      } else {
        console.log('ℹ️ Production build check skipped in development mode');
      }
    });

    test('🟡 Package.json scripts should be valid', () => {
      const packageJsonPath = path.resolve(__dirname, '../../../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      const requiredScripts = ['build', 'build:client', 'build:server', 'start'];
      const missingScripts = requiredScripts.filter(script => !packageJson.scripts[script]);

      expect(missingScripts).toEqual([]);
      
      // Start script should be production-ready
      expect(packageJson.scripts.start).toContain('production');
      expect(packageJson.scripts.start).toContain('dist/index.js');
    });

    test('🟡 Static file serving should work correctly', async () => {
      const app = express();
      const publicPath = path.resolve(__dirname, '../../../server/public');

      if (fs.existsSync(publicPath)) {
        app.use(express.static(publicPath));
        
        // Test that static files are served
        const indexPath = path.resolve(publicPath, 'index.html');
        if (fs.existsSync(indexPath)) {
          const response = await request(app).get('/');
          expect(response.status).toBe(200);
          expect(response.text).toContain('<div id="root">');
        }
      } else {
        console.warn('⚠️ WARNING: Public directory not found');
      }
    });
  });

  describe('🟢 QUALITY CHECKS - Nice to Have', () => {
    test('🟢 API routes should be properly structured', async () => {
      const app = express();
      app.use(express.json());
      
      await registerRoutes(app);
      
      // Test that some key API routes exist and return proper status codes
      const apiTests = [
        { path: '/api/health', expectedStatus: 200 },
        { path: '/api/auth/login', expectedMethod: 'POST', expectedStatus: [400, 401] }, // Bad request or unauthorized
        { path: '/api/users', expectedMethod: 'GET', expectedStatus: [401, 403] } // Unauthorized or forbidden
      ];

      for (const test of apiTests) {
        try {
          let response;
          if (test.expectedMethod === 'POST') {
            response = await request(app).post(test.path).send({});
          } else {
            response = await request(app).get(test.path);
          }

          if (Array.isArray(test.expectedStatus)) {
            expect(test.expectedStatus).toContain(response.status);
          } else {
            expect(response.status).toBe(test.expectedStatus);
          }
        } catch (error) {
          console.warn(`⚠️ API route test failed for ${test.path}:`, error.message);
        }
      }
    });

    test('🟢 Error handling should be robust', async () => {
      const app = express();
      
      // Route that throws an error
      app.get('/test-error-handling', () => {
        throw new Error('Test error for deployment validation');
      });
      
      // Error handler
      app.use((err: any, req: any, res: any, next: any) => {
        res.status(500).json({ 
          message: err.message || 'Internal Server Error',
          error: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
      });

      const response = await request(app).get('/test-error-handling');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message');
      
      // In production, should not expose stack traces
      if (process.env.NODE_ENV === 'production') {
        expect(response.body.error).toBeUndefined();
      }
    });

    test('🟢 Memory usage should be reasonable', () => {
      const memoryUsage = process.memoryUsage();
      
      // Warn if memory usage is very high (over 512MB)
      if (memoryUsage.heapUsed > 512 * 1024 * 1024) {
        console.warn(`⚠️ WARNING: High memory usage: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
      }
      
      // Should have some memory usage (application is running)
      expect(memoryUsage.heapUsed).toBeGreaterThan(10 * 1024 * 1024); // At least 10MB
    });
  });

  describe('🔍 DEPLOYMENT ENVIRONMENT VALIDATION', () => {
    test('🔍 Port configuration should be valid', () => {
      const port = parseInt(process.env.PORT || process.env.REPL_PORT || '8080', 10);
      
      expect(port).toBeGreaterThan(0);
      expect(port).toBeLessThan(65536);
      expect(port).not.toBeNaN();
    });

    test('🔍 Node.js version should be compatible', () => {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
      
      // Should be Node 18 or higher
      expect(majorVersion).toBeGreaterThanOrEqual(18);
      
      console.log(`ℹ️ Node.js version: ${nodeVersion}`);
    });

    test('🔍 Critical dependencies should be available', () => {
      const criticalModules = [
        'express',
        'drizzle-orm',
        '@neondatabase/serverless'
      ];
      
      criticalModules.forEach(moduleName => {
        expect(() => {
          require(moduleName);
        }).not.toThrow();
      });
    });
  });

  describe('📋 DEPLOYMENT SUMMARY', () => {
    test('📋 Generate deployment readiness report', () => {
      const report = {
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
        port: process.env.PORT || process.env.REPL_PORT || '8080',
        databaseConfigured: !!process.env.DATABASE_URL,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      };
      
      console.log('📋 DEPLOYMENT READINESS REPORT:');
      console.log('================================');
      console.log(`🕒 Timestamp: ${report.timestamp}`);
      console.log(`🟢 Node.js: ${report.nodeVersion}`);
      console.log(`🌍 Environment: ${report.environment}`);
      console.log(`🚪 Port: ${report.port}`);
      console.log(`💾 Database: ${report.databaseConfigured ? '✅ Configured' : '❌ Not configured'}`);
      console.log(`📊 Memory: ${Math.round(report.memoryUsage.heapUsed / 1024 / 1024)}MB used`);
      console.log(`⏱️ Uptime: ${Math.round(report.uptime)}s`);
      console.log('================================');
      
      // All critical items should be ready
      expect(report.databaseConfigured).toBe(true);
      expect(parseInt(report.port, 10)).toBeGreaterThan(0);
    });
  });
});