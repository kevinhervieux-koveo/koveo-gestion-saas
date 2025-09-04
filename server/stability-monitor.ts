/**
 * Server Stability Monitor
 * Monitors memory usage and prevents application shutdowns
 */

interface MemoryStats {
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
}

class StabilityMonitor {
  private memoryWarningThreshold = 500 * 1024 * 1024; // 500MB
  private memoryErrorThreshold = 800 * 1024 * 1024; // 800MB
  private isMonitoring = false;
  private intervalId: NodeJS.Timeout | null = null;

  start() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('🔍 Starting stability monitor...');

    // Monitor memory usage every 30 seconds in development
    if (process.env.NODE_ENV === 'development') {
      this.intervalId = setInterval(() => {
        this.checkMemoryUsage();
      }, 30000);
    }

    // Set up listeners for stability issues
    this.setupEventListeners();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isMonitoring = false;
    console.log('🛑 Stability monitor stopped');
  }

  private checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const rssMB = Math.round(memUsage.rss / 1024 / 1024);

    // Log memory usage periodically
    if (heapUsedMB > 100) {
      console.log(`🧠 Memory usage: Heap ${heapUsedMB}MB, RSS ${rssMB}MB`);
    }

    // Warning threshold
    if (memUsage.heapUsed > this.memoryWarningThreshold) {
      console.warn(`⚠️ High memory usage detected: ${heapUsedMB}MB heap used`);
      this.suggestGarbageCollection();
    }

    // Error threshold - force garbage collection
    if (memUsage.heapUsed > this.memoryErrorThreshold) {
      console.error(`🚨 Critical memory usage: ${heapUsedMB}MB heap used - forcing garbage collection`);
      if (global.gc) {
        global.gc();
        console.log('✅ Garbage collection completed');
      } else {
        console.warn('⚠️ Garbage collection not available (run with --expose-gc)');
      }
    }
  }

  private suggestGarbageCollection() {
    if (global.gc) {
      global.gc();
      console.log('♻️ Garbage collection triggered');
    }
  }

  private setupEventListeners() {
    // Monitor for file descriptor leaks
    process.on('warning', (warning) => {
      if (warning.name === 'MaxListenersExceededWarning') {
        console.warn('⚠️ Event listener leak detected:', warning.message);
      }
    });

    // Monitor for database connection issues
    process.on('beforeExit', (code) => {
      console.log('⚠️ Process is about to exit with code:', code);
    });
  }

  getMemoryStats(): MemoryStats {
    return process.memoryUsage();
  }

  isHealthy(): boolean {
    const memUsage = process.memoryUsage();
    return memUsage.heapUsed < this.memoryErrorThreshold;
  }
}

export const stabilityMonitor = new StabilityMonitor();