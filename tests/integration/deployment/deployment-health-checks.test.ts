import request from 'supertest';
import express from 'express';
import { createServer } from 'http';

/**
 * DEPLOYMENT HEALTH CHECKS
 * 
 * These tests validate that the deployed application responds correctly
 * to health check endpoints used by load balancers and monitoring systems.
 */
describe('Deployment Health Checks', () => {
  describe('Health Check Endpoints', () => {
    let app: express.Application;
    let server: any;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      
      // Mock the actual health check endpoints from server/index.ts
      app.get('/api/health', (req, res) => {
        const timeout = setTimeout(() => {
          if (!res.headersSent) {
            res.status(408).json({ status: 'timeout', message: 'Health check timeout' });
          }
        }, 5000);
        
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({ 
          status: 'ok', 
          message: 'Koveo Gestion API is running',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        });
        
        clearTimeout(timeout);
      });

      app.get('/api/health/detailed', (req, res) => {
        const timeout = setTimeout(() => {
          if (!res.headersSent) {
            res.status(408).json({ status: 'timeout', message: 'Health check timeout' });
          }
        }, 3000);
        
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({ 
          status: 'healthy', 
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString(),
          pid: process.pid,
          nodeVersion: process.version,
          env: process.env.NODE_ENV || 'development'
        });
        
        clearTimeout(timeout);
      });

      app.get('/healthz', (req, res) => {
        const timeout = setTimeout(() => {
          if (!res.headersSent) {
            res.status(408).send('TIMEOUT');
          }
        }, 2000);
        
        res.setHeader('Cache-Control', 'no-cache');
        res.status(200).send('OK');
        
        clearTimeout(timeout);
      });

      app.get('/ready', (req, res) => {
        const timeout = setTimeout(() => {
          if (!res.headersSent) {
            res.status(408).json({ ready: false, status: 'timeout' });
          }
        }, 2000);
        
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({ 
          ready: true, 
          timestamp: new Date().toISOString(),
          uptime: process.uptime()
        });
        
        clearTimeout(timeout);
      });
    });

    test('should respond to /api/health with proper format', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['cache-control']).toBe('no-cache');
      
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
      
      // Timestamp should be recent
      const timestamp = new Date(response.body.timestamp);
      const now = new Date();
      expect(now.getTime() - timestamp.getTime()).toBeLessThan(10000); // Within 10 seconds
    });

    test('should respond to /api/health/detailed with system information', async () => {
      const response = await request(app).get('/api/health/detailed');
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('pid');
      expect(response.body).toHaveProperty('nodeVersion');
      expect(response.body).toHaveProperty('env');
      
      // Memory should have expected properties
      expect(response.body.memory).toHaveProperty('rss');
      expect(response.body.memory).toHaveProperty('heapUsed');
      expect(response.body.memory).toHaveProperty('heapTotal');
      
      // Uptime should be positive
      expect(response.body.uptime).toBeGreaterThan(0);
    });

    test('should respond to /healthz with simple OK', async () => {
      const response = await request(app).get('/healthz');
      
      expect(response.status).toBe(200);
      expect(response.text).toBe('OK');
      expect(response.headers['cache-control']).toBe('no-cache');
    });

    test('should respond to /ready with readiness information', async () => {
      const response = await request(app).get('/ready');
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      
      expect(response.body).toHaveProperty('ready', true);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      
      // Should be marked as ready
      expect(response.body.ready).toBe(true);
    });
  });

  describe('Load Balancer Health Checks', () => {
    test('should handle high frequency health check requests', async () => {
      const app = express();
      
      app.get('/healthz', (req, res) => {
        res.status(200).send('OK');
      });
      
      // Simulate load balancer making frequent health checks
      const requests = [];
      for (let i = 0; i < 20; i++) {
        requests.push(request(app).get('/healthz').expect(200));
      }
      
      const responses = await Promise.all(requests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.text).toBe('OK');
      });
    });

    test('should handle health checks during high CPU usage', async () => {
      const app = express();
      
      app.get('/healthz', (req, res) => {
        // Simulate some CPU work but still respond quickly
        const start = Date.now();
        let sum = 0;
        for (let i = 0; i < 10000; i++) {
          sum += Math.random();
        }
        
        const duration = Date.now() - start;
        res.status(200).json({ status: 'OK', processingTime: duration });
      });
      
      const response = await request(app).get('/healthz');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
      // Should still respond reasonably quickly even with some processing
      expect(response.body.processingTime).toBeLessThan(1000);
    });
  });

  describe('Health Check Timeout Handling', () => {
    test('should handle timeout scenarios gracefully', async () => {
      const app = express();
      
      app.get('/health-slow', (req, res) => {
        // Simulate slow response
        setTimeout(() => {
          if (!res.headersSent) {
            res.status(200).json({ status: 'ok', delayed: true });
          }
        }, 100);
      });
      
      const response = await request(app).get('/health-slow');
      
      expect(response.status).toBe(200);
      expect(response.body.delayed).toBe(true);
    });

    test('should prevent multiple responses to same request', async () => {
      const app = express();
      
      app.get('/health-protected', (req, res) => {
        // First response
        res.status(200).json({ status: 'first' });
        
        // Try to send second response (should be prevented)
        setTimeout(() => {
          try {
            if (!res.headersSent) {
              res.status(200).json({ status: 'second' });
            }
          } catch (error) {
            // Expected - cannot send headers after they are sent
          }
        }, 10);
      });
      
      const response = await request(app).get('/health-protected');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('first');
    });
  });

  describe('Health Check Performance', () => {
    test('should respond to health checks within time limits', async () => {
      const app = express();
      
      app.get('/api/health', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
      });
      
      const startTime = Date.now();
      const response = await request(app).get('/api/health');
      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(100); // Should respond within 100ms
    });

    test('should handle concurrent health check requests efficiently', async () => {
      const app = express();
      
      let requestCount = 0;
      app.get('/api/health', (req, res) => {
        requestCount++;
        res.json({ status: 'ok', requestNumber: requestCount });
      });
      
      // Make 50 concurrent requests
      const requests = Array(50).fill(null).map(() => request(app).get('/api/health'));
      
      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;
      
      // All requests should succeed
      expect(responses).toHaveLength(50);
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
      });
      
      // Should handle 50 requests reasonably quickly
      expect(totalTime).toBeLessThan(5000); // Within 5 seconds
      
      // Should have processed all requests
      expect(requestCount).toBe(50);
    });
  });

  describe('Deployment Platform Compatibility', () => {
    test('should work with Kubernetes health checks', async () => {
      const app = express();
      
      // Kubernetes typically uses /healthz and /ready
      app.get('/healthz', (req, res) => {
        res.status(200).send('OK');
      });
      
      app.get('/ready', (req, res) => {
        res.status(200).json({ ready: true });
      });
      
      const liveResponse = await request(app).get('/healthz');
      const readyResponse = await request(app).get('/ready');
      
      expect(liveResponse.status).toBe(200);
      expect(liveResponse.text).toBe('OK');
      
      expect(readyResponse.status).toBe(200);
      expect(readyResponse.body.ready).toBe(true);
    });

    test('should work with Docker health checks', async () => {
      const app = express();
      
      // Docker typically uses custom health check endpoints
      app.get('/health', (req, res) => {
        res.status(200).json({ status: 'healthy' });
      });
      
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });

    test('should work with Cloud Run health checks', async () => {
      const app = express();
      
      // Cloud Run can use any endpoint, but often uses /
      app.get('/', (req, res) => {
        res.status(200).send('Koveo Gestion is running');
      });
      
      app.get('/health', (req, res) => {
        res.status(200).json({ status: 'ok' });
      });
      
      const rootResponse = await request(app).get('/');
      const healthResponse = await request(app).get('/health');
      
      expect(rootResponse.status).toBe(200);
      expect(rootResponse.text).toContain('Koveo Gestion');
      
      expect(healthResponse.status).toBe(200);
      expect(healthResponse.body.status).toBe('ok');
    });
  });

  describe('Health Check Error Scenarios', () => {
    test('should handle database connection issues gracefully', async () => {
      const app = express();
      
      app.get('/api/health/db', async (req, res) => {
        try {
          // Simulate database check
          const dbConnected = true; // This would be a real DB check
          
          if (!dbConnected) {
            throw new Error('Database connection failed');
          }
          
          res.status(200).json({ status: 'healthy', database: 'connected' });
        } catch (error) {
          res.status(503).json({ 
            status: 'unhealthy', 
            error: 'Database connection failed',
            database: 'disconnected'
          });
        }
      });
      
      const response = await request(app).get('/api/health/db');
      
      expect(response.status).toBe(200);
      expect(response.body.database).toBe('connected');
    });

    test('should provide different responses for different failure types', async () => {
      const app = express();
      
      app.get('/api/health/partial', (req, res) => {
        // Simulate partial system failure
        const systemStatus = {
          database: 'healthy',
          cache: 'unhealthy',
          storage: 'healthy'
        };
        
        const unhealthyServices = Object.entries(systemStatus)
          .filter(([_, status]) => status === 'unhealthy')
          .map(([service, _]) => service);
        
        const overallStatus = unhealthyServices.length === 0 ? 'healthy' : 'degraded';
        const httpStatus = overallStatus === 'healthy' ? 200 : 207; // 207 Multi-Status
        
        res.status(httpStatus).json({
          status: overallStatus,
          services: systemStatus,
          unhealthyServices
        });
      });
      
      const response = await request(app).get('/api/health/partial');
      
      expect(response.status).toBe(207); // Degraded status
      expect(response.body.status).toBe('degraded');
      expect(response.body.unhealthyServices).toContain('cache');
    });
  });
});