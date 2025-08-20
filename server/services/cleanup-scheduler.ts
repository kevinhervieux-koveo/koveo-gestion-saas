import cron from 'node-cron';

/**
 * Storage cleanup scheduler that runs automatic cleanup of orphaned files
 */
export class CleanupScheduler {
  private static instance: CleanupScheduler;
  private cleanupJob: cron.ScheduledTask | null = null;

  private constructor() {}

  public static getInstance(): CleanupScheduler {
    if (!CleanupScheduler.instance) {
      CleanupScheduler.instance = new CleanupScheduler();
    }
    return CleanupScheduler.instance;
  }

  /**
   * Start automatic cleanup scheduler
   * Runs every 6 hours to clean up orphaned files
   */
  public startAutoCleanup(): void {
    if (this.cleanupJob) {
      console.log('⚠️  Cleanup scheduler already running');
      return;
    }

    // Run every 6 hours at minute 0 (00:00, 06:00, 12:00, 18:00)
    this.cleanupJob = cron.schedule('0 */6 * * *', async () => {
      try {
        console.log('🧹 Starting automatic storage cleanup...');
        
        // Call the cleanup API
        const response = await fetch('http://localhost:5000/api/admin/cleanup-storage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ Automatic cleanup completed:', result.message);
          
          if (result.details?.deletedOrphaned > 0) {
            console.log(`🗑️  Cleaned up ${result.details.deletedOrphaned} orphaned files`);
          }
        } else {
          console.error('❌ Automatic cleanup failed:', response.statusText);
        }
        
      } catch (error) {
        console.error('❌ Automatic cleanup error:', error);
      }
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    console.log('✅ Storage cleanup scheduler started - runs every 6 hours');
  }

  /**
   * Stop the automatic cleanup scheduler
   */
  public stopAutoCleanup(): void {
    if (this.cleanupJob) {
      this.cleanupJob.stop();
      this.cleanupJob = null;
      console.log('🛑 Storage cleanup scheduler stopped');
    }
  }

  /**
   * Run cleanup immediately (for testing or manual triggers)
   */
  public async runCleanupNow(): Promise<any> {
    try {
      console.log('🧹 Running manual storage cleanup...');
      
      const response = await fetch('http://localhost:5000/api/admin/cleanup-storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Manual cleanup completed:', result.message);
        return result;
      } else {
        throw new Error(`Cleanup failed: ${response.statusText}`);
      }
      
    } catch (error) {
      console.error('❌ Manual cleanup error:', error);
      throw error;
    }
  }
}