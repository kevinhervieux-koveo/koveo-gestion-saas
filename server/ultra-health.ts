/**
 * Ultra-minimal health check server for deployment platforms
 * This ensures the fastest possible response for health checks
 */
import express from 'express';

export function createUltraHealthEndpoints(app: express.Application) {
  // Ultra-fast deployment health check (no middleware, no processing)
  app.get('/_deploy_health', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      Connection: 'close',
      'Cache-Control': 'no-cache',
    });
    res.end('OK');
  });

  // Root endpoint optimized for deployment health checks
  app.get('/_status', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      Connection: 'close',
      'Cache-Control': 'no-cache',
    });
    res.end('{"status":"ok","ready":true}');
  });

  // Additional endpoint for load balancer health checks
  app.get('/_ping', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      Connection: 'close',
    });
    res.end('pong');
  });
}
