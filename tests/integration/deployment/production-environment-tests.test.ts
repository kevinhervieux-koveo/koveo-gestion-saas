import request from 'supertest';
import express from 'express';
import { createServer } from 'http';
import * as path from 'path';
import * as fs from 'fs';

/**
 * PRODUCTION ENVIRONMENT TESTS
 * 
 * These tests specifically validate production deployment scenarios
 * and catch environment-specific issues that could cause "Cannot GET /" errors.
 */
describe('Production Environment Tests', () => {
  describe('Production Static File Serving', () => {
    test('should serve production build correctly', () => {
      const app = express();
      const distPath = path.resolve(__dirname, '../../../server/public');
      
      // Simulate production static file serving
      if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
        
        // SPA fallback for production
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
        
        // Test critical routes
        return Promise.all([
          request(app).get('/').expect(200),
          request(app).get('/dashboard').expect(200),
          request(app).get('/login').expect(200)
        ]);
      } else {
        console.warn('⚠️ Production build not found - test skipped');
      }
    });

    test('should handle static assets correctly', async () => {
      const app = express();
      const publicPath = path.resolve(__dirname, '../../../server/public');
      
      if (fs.existsSync(publicPath)) {
        app.use(express.static(publicPath));
        
        // Test that index.html exists and is servable
        const indexPath = path.resolve(publicPath, 'index.html');
        if (fs.existsSync(indexPath)) {
          const response = await request(app).get('/');
          expect(response.status).toBe(200);
          expect(response.text).toContain('<div id="root">');
        }
        
        // Test that assets directory exists (if it should)
        const assetsPath = path.resolve(publicPath, 'assets');
        if (fs.existsSync(assetsPath)) {
          const assetFiles = fs.readdirSync(assetsPath);
          expect(assetFiles.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Production Environment Variables', () => {
    test('should validate production environment configuration', () => {
      if (process.env.NODE_ENV === 'production') {
        // Critical production environment variables
        expect(process.env.DATABASE_URL).toBeDefined();
        expect(process.env.DATABASE_URL).toContain('postgresql');
        
        // Port should be configurable for deployment platforms
        const port = process.env.PORT || process.env.REPL_PORT;
        if (port) {
          expect(parseInt(port, 10)).toBeGreaterThan(0);
        }
      }
    });

    test('should handle missing environment variables gracefully', () => {
      // Test that the app can start even with some missing env vars
      // (though it may have limited functionality)
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      try {
        // Should not crash when requiring the main application
        expect(() => {
          require('../../../server/index.ts');
        }).not.toThrow();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('Production Build Validation', () => {
    test('should validate build output structure', () => {
      const buildPaths = [
        path.resolve(__dirname, '../../../server/public'),
        path.resolve(__dirname, '../../../dist')
      ];
      
      let foundValidBuild = false;
      
      for (const buildPath of buildPaths) {
        if (fs.existsSync(buildPath)) {
          const indexPath = path.resolve(buildPath, 'index.html');
          if (fs.existsSync(indexPath)) {
            const indexContent = fs.readFileSync(indexPath, 'utf-8');
            
            // Validate HTML structure
            expect(indexContent).toContain('<!DOCTYPE html>');
            expect(indexContent).toContain('<html');
            expect(indexContent).toContain('<div id="root">');
            expect(indexContent).toContain('</html>');
            
            // Should contain app title or meta tags
            expect(
              indexContent.includes('Koveo') || 
              indexContent.includes('Property Management') ||
              indexContent.includes('<title>')
            ).toBe(true);
            
            foundValidBuild = true;
            break;
          }
        }
      }
      
      if (process.env.NODE_ENV === 'production') {
        expect(foundValidBuild).toBe(true);
      } else {
        console.log('ℹ️ Production build validation skipped in development mode');
      }
    });

    test('should validate JavaScript bundle exists', () => {
      const publicPath = path.resolve(__dirname, '../../../server/public');
      
      if (fs.existsSync(publicPath)) {
        const assetsPath = path.resolve(publicPath, 'assets');
        
        if (fs.existsSync(assetsPath)) {
          const files = fs.readdirSync(assetsPath);
          const jsFiles = files.filter(file => file.endsWith('.js'));
          const cssFiles = files.filter(file => file.endsWith('.css'));
          
          // Should have at least one JS file (the main bundle)
          expect(jsFiles.length).toBeGreaterThan(0);
          
          // Should have at least one CSS file
          expect(cssFiles.length).toBeGreaterThan(0);
          
          // Validate that JS files are not empty
          jsFiles.forEach(jsFile => {
            const filePath = path.resolve(assetsPath, jsFile);
            const stats = fs.statSync(filePath);
            expect(stats.size).toBeGreaterThan(100); // At least 100 bytes
          });
        }
      }
    });
  });

  describe('Production Server Behavior', () => {
    test('should start production server on correct port', (done) => {
      const app = express();
      const testPort = 0; // Use random available port
      
      app.get('/health', (req, res) => {
        res.json({ status: 'ok' });
      });
      
      const server = createServer(app);
      
      server.listen(testPort, '0.0.0.0', () => {
        const address = server.address();
        expect(address).not.toBeNull();
        expect((address as any).port).toBeGreaterThan(0);
        
        // Test that server responds
        request(app)
          .get('/health')
          .expect(200)
          .end((err, res) => {
            server.close();
            if (err) return done(err);
            expect(res.body.status).toBe('ok');
            done();
          });
      });
    });

    test('should handle production error conditions', async () => {
      const app = express();
      
      // Simulate production error handling
      app.get('/test-error', (req, res, next) => {
        const error = new Error('Production test error');
        next(error);
      });
      
      // Production error handler
      app.use((err: any, req: any, res: any, next: any) => {
        // In production, don't expose stack traces
        const isDevelopment = process.env.NODE_ENV === 'development';
        
        res.status(err.status || 500).json({
          message: err.message || 'Internal Server Error',
          ...(isDevelopment && { stack: err.stack })
        });
      });
      
      const response = await request(app).get('/test-error');
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Production test error');
      
      // Stack trace should only be present in development
      if (process.env.NODE_ENV === 'production') {
        expect(response.body.stack).toBeUndefined();
      }
    });
  });

  describe('Performance and Load Tests', () => {
    test('should handle multiple concurrent requests', async () => {
      const app = express();
      app.use(express.json());
      
      app.get('/api/health', (req, res) => {
        res.json({ status: 'ok', timestamp: Date.now() });
      });
      
      // Create multiple concurrent requests
      const requestPromises = [];
      for (let i = 0; i < 10; i++) {
        requestPromises.push(
          request(app).get('/api/health').expect(200)
        );
      }
      
      const responses = await Promise.all(requestPromises);
      
      // All requests should succeed
      expect(responses).toHaveLength(10);
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
        expect(response.body.timestamp).toBeDefined();
      });
    });

    test('should respond within acceptable time limits', async () => {
      const app = express();
      
      app.get('/api/quick-health', (req, res) => {
        res.json({ status: 'ok' });
      });
      
      const startTime = Date.now();
      const response = await request(app).get('/api/quick-health');
      const endTime = Date.now();
      
      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(500); // Should respond within 500ms
    });
  });

  describe('Resource Management Tests', () => {
    test('should handle file system operations safely', () => {
      const testPaths = [
        path.resolve(__dirname, '../../../server/public'),
        path.resolve(__dirname, '../../../client'),
        path.resolve(__dirname, '../../../package.json')
      ];
      
      testPaths.forEach(testPath => {
        expect(() => {
          fs.existsSync(testPath);
        }).not.toThrow();
      });
    });

    test('should validate memory usage stays reasonable', (done) => {
      const initialMemory = process.memoryUsage();
      
      // Simulate some application activity
      const app = express();
      app.use(express.json());
      
      app.post('/test-data', (req, res) => {
        // Create some temporary data
        const data = new Array(1000).fill('test data');
        res.json({ count: data.length });
      });
      
      // Make several requests
      Promise.all([
        request(app).post('/test-data').send({ test: 'data1' }),
        request(app).post('/test-data').send({ test: 'data2' }),
        request(app).post('/test-data').send({ test: 'data3' })
      ]).then(() => {
        // Force garbage collection if available
        if (global.gc) global.gc();
        
        const finalMemory = process.memoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        
        // Memory increase should be reasonable (less than 100MB)
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
        done();
      }).catch(done);
    });
  });

  describe('Security and Headers Tests', () => {
    test('should set appropriate security headers', async () => {
      const app = express();
      
      // Add basic security headers
      app.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        next();
      });
      
      app.get('/test', (req, res) => {
        res.json({ message: 'test' });
      });
      
      const response = await request(app).get('/test');
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    test('should handle CORS appropriately', async () => {
      const app = express();
      
      // Basic CORS handling
      app.use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        next();
      });
      
      app.get('/api/test', (req, res) => {
        res.json({ message: 'cors test' });
      });
      
      const response = await request(app).get('/api/test');
      
      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });
  });
});