/**
 * @file Memory Optimization Middleware for Koveo Gestion
 * @description Optimizes memory usage and prevents memory leaks
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Memory monitoring and cleanup middleware
 */
export function memoryOptimization(req: Request, res: Response, next: NextFunction): void {
  // Clean up request-specific data after response
  res.on('finish', () => {
    // Clear request body to free memory
    if (req.body && typeof req.body === 'object') {
      delete req.body;
    }
    
    // Clear large headers if any
    if (req.headers && req.headers['content-length']) {
      const contentLength = parseInt(req.headers['content-length'], 10);
      if (contentLength > 1024 * 1024) { // 1MB
        // Force garbage collection for large requests
        if (global.gc) {
          global.gc();
        }
      }
    }
  });
  
  next();
}

/**
 * Global memory monitoring
 */
export function startMemoryMonitoring(): void {
  const MEMORY_CHECK_INTERVAL = 30000; // 30 seconds
  const MEMORY_THRESHOLD = 150 * 1024 * 1024; // 150MB
  
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const totalMem = memUsage.heapUsed + memUsage.external;
    
    if (totalMem > MEMORY_THRESHOLD) {
      console.warn(`⚠️  High memory usage: ${Math.round(totalMem / 1024 / 1024)}MB`);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        console.log('🧹 Forced garbage collection');
      }
      
      // Log memory breakdown
      console.log('Memory breakdown:', {
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`
      });
    }
  }, MEMORY_CHECK_INTERVAL);
}

export default {
  memoryOptimization,
  startMemoryMonitoring
};