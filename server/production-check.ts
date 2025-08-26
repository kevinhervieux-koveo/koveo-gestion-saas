/**
 * Production deployment diagnostic tool
 * Run this to check if static files are properly configured
 */
import express from 'express';
import fs from 'fs';
import path from 'path';

export function createProductionDiagnostic(app: express.Express) {
  app.get('/api/deployment/status', (req, res) => {
    const distPath = path.resolve(process.cwd(), 'dist', 'public');
    const assetsPath = path.resolve(distPath, 'assets');
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      distExists: fs.existsSync(distPath),
      assetsExists: fs.existsSync(assetsPath),
      distContents: fs.existsSync(distPath) ? fs.readdirSync(distPath) : [],
      assetCount: fs.existsSync(assetsPath) ? fs.readdirSync(assetsPath).length : 0,
      indexHtmlExists: fs.existsSync(path.resolve(distPath, 'index.html')),
      staticMiddlewareActive: !!app._router?.stack?.find((layer: any) => 
        layer.name === 'serveStatic' || 
        (layer.handle && layer.handle.name === 'serveStatic')
      )
    };
    
    res.json(diagnostics);
  });
}