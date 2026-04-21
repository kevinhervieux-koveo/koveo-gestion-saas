import cron from 'node-cron';
import { runCleanupStorage } from '../api/cleanup';

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

  public startAutoCleanup(): void {
    if (this.cleanupJob) {
      return;
    }

    this.cleanupJob = cron.schedule(
      '0 */6 * * *',
      async () => {
        try {
          await runCleanupStorage(true);
        } catch (err) {
          console.error('[CleanupScheduler] Scheduled cleanup failed:', (err as Error).message);
        }
      },
      {
        scheduled: true,
        timezone: 'UTC',
      }
    );
  }

  public stopAutoCleanup(): void {
    if (this.cleanupJob) {
      this.cleanupJob.stop();
      this.cleanupJob = null;
    }
  }

  public async runCleanupNow(): Promise<any> {
    return runCleanupStorage(true);
  }
}
