#!/usr/bin/env node

/**
 * Replit Environment Monitor
 * Lightweight monitoring script for Replit-specific metrics.
 */

const { execSync } = require('child_process');
// Removed unused imports: fs and path

/**
 * Replit Environment Monitor class for tracking system metrics.
 */
class ReplitMonitor {
  /**
   * Initialize the monitor with default metrics.
   */
  constructor() {
    this.startTime = Date.now();
    this.metrics = {
      requests: 0,
      errors: 0,
      averageResponseTime: 0,
      memoryUsage: 0,
      uptime: 0
    };
  }

  /**
   * Collect system metrics.
   * @returns The collected metrics object.
   */
  collectMetrics() {
    try {
      // Memory usage
      const memUsage = process.memoryUsage();
      this.metrics.memoryUsage = Math.round(memUsage.heapUsed / 1024 / 1024);
      
      // Uptime
      this.metrics.uptime = Math.round((Date.now() - this.startTime) / 1000);
      
      // Disk usage
      if (process.platform !== 'win32') {
        try {
          const diskUsage = execSync('df -h .').toString();
          console.warn('Disk Usage:', diskUsage.split('\n')[1]);
        } catch (__e) {
          // Silent fail for disk usage
        }
      }
      
      return this.metrics;
    } catch (_error) {
      console.error('Error collecting metrics:', error.message);
      return this.metrics;
    }
  }

  /**
   * Start monitoring loop.
   * @returns Void.
   */
  start() {
    console.warn('🔍 Starting Replit Environment Monitor...');
    console.warn('Monitoring started at:', new Date().toISOString());
    
    // Display metrics every 30 seconds
    setInterval(() => {
      const metrics = this.collectMetrics();
      console.warn(`[${new Date().toLocaleTimeString()}] Memory: ${metrics.memoryUsage}MB | Uptime: ${metrics.uptime}s`);
    }, 30000);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.warn('\n🛑 Monitoring stopped');
      process.exit(0);
    });
    
    console.warn('Monitor running... Press Ctrl+C to stop');
  }
}

// Start monitor if run directly
if (require.main === module) {
  const monitor = new ReplitMonitor();
  monitor.start();
}

module.exports = ReplitMonitor;