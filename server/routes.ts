// Main routes file that loads route definitions
import express from 'express';

export async function registerRoutes(app: express.Application) {
  // Basic API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  app.post('/api/test', (req, res) => {
    res.json({ message: 'API working', body: req.body });
  });
  
  // Add more routes as needed
}