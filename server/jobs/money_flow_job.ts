import * as cron from 'node-cron';
import { moneyFlowAutomationService } from '../services/money-flow-automation';

/**
 * Configuration for the money flow automation job.
 */
interface MoneyFlowJobConfig {
  schedule: string;
  enabled: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  retryAttempts: number;
  retryDelay: number;
}

/**
 * Money Flow automation job that runs daily to maintain money_flow entries
 * for bills and residence monthly fees up to 25 years in the future.
 */
class MoneyFlowJob {
  private config: MoneyFlowJobConfig;
  private jobTask: cron.ScheduledTask | null = null;
  private isRunning = false;

  /**
   *
   */
  constructor() {
    this.config = {
      // Run daily at 3 AM by default
      schedule: process.env.MONEY_FLOW_SCHEDULE || '0 3 * * *',
      enabled: process.env.MONEY_FLOW_ENABLED !== 'false',
      logLevel: (process.env.MONEY_FLOW_LOG_LEVEL as any) || 'info',
      retryAttempts: parseInt(process.env.MONEY_FLOW_RETRY_ATTEMPTS || '3'),
      retryDelay: parseInt(process.env.MONEY_FLOW_RETRY_DELAY || '5000')
    };

    this.log('info', 'Money Flow Job initialized', { config: this.config });
  }

  /**
   * Start the money flow automation background job.
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      this.log('info', 'Money flow job is disabled');
      return;
    }

    try {
      // Validate cron schedule
      if (!cron.validate(this.config.schedule)) {
        throw new Error(`Invalid cron schedule: ${this.config.schedule}`);
      }

      // Schedule the job
      this.jobTask = cron.schedule(this.config.schedule, async () => {
        await this.executeMoneyFlowJob();
      }, {
        timezone: process.env.TZ || 'UTC'
      });

      this.jobTask.start();
      
      this.log('info', 'Money flow job started', {
        schedule: this.config.schedule,
        timezone: process.env.TZ || 'UTC'
      });

      // Run initial generation if needed
      if (process.env.MONEY_FLOW_RUN_ON_STARTUP === 'true') {
        this.log('info', 'Running initial money flow generation...');
        await this.executeMoneyFlowJob();
      }

    } catch (error) {
      this.log('error', 'Failed to start money flow job', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Stop the money flow job.
   */
  stop(): void {
    if (this.jobTask) {
      this.jobTask.stop();
      this.jobTask.destroy();
      this.jobTask = null;
      this.log('info', 'Money flow job stopped');
    }
  }

  /**
   * Execute the money flow job manually.
   */
  async executeMoneyFlowJob(): Promise<void> {
    if (this.isRunning) {
      this.log('warn', 'Money flow job is already running, skipping execution');
      return;
    }

    this.isRunning = true;
    const startTime = new Date();
    this.log('info', 'Starting money flow job execution');

    let attempt = 0;
    let success = false;

    while (attempt < this.config.retryAttempts && !success) {
      try {
        attempt++;
        this.log('info', `Money flow job attempt ${attempt}/${this.config.retryAttempts}`);

        // Generate future money flow entries
        const result = await moneyFlowAutomationService.generateFutureMoneyFlowEntries();

        // Get statistics about the current state
        const stats = await moneyFlowAutomationService.getMoneyFlowStatistics();

        const duration = new Date().getTime() - startTime.getTime();
        this.log('info', 'Money flow job completed successfully', {
          duration: `${Math.round(duration / 1000)}s`,
          attempt,
          result,
          stats
        });

        success = true;

      } catch (error) {
        this.log('error', `Money flow job attempt ${attempt} failed`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          attempt,
          maxAttempts: this.config.retryAttempts
        });

        if (attempt < this.config.retryAttempts) {
          this.log('info', `Retrying in ${this.config.retryDelay}ms...`);
          await this.sleep(this.config.retryDelay);
        }
      }
    }

    if (!success) {
      const totalDuration = new Date().getTime() - startTime.getTime();
      this.log('error', 'Money flow job failed after all retry attempts', {
        attempts: this.config.retryAttempts,
        totalDuration: `${Math.round(totalDuration / 1000)}s`
      });
      
      // Send alert about the failure
      await this.sendFailureAlert();
    }

    this.isRunning = false;
  }

  /**
   * Run money flow generation for a specific bill.
   * Used when bills are created or updated.
   * @param billId
   */
  async generateForBill(billId: string): Promise<number> {
    this.log('info', `Triggering money flow generation for bill ${billId}`);
    
    try {
      const entriesCreated = await moneyFlowAutomationService.generateForBill(billId);
      this.log('info', `Money flow generation completed for bill ${billId}`, {
        billId,
        entriesCreated
      });
      return entriesCreated;
    } catch (error) {
      this.log('error', `Failed to generate money flow for bill ${billId}`, {
        billId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Run money flow generation for a specific residence.
   * Used when residence monthly fees are updated.
   * @param residenceId
   */
  async generateForResidence(residenceId: string): Promise<number> {
    this.log('info', `Triggering money flow generation for residence ${residenceId}`);
    
    try {
      const entriesCreated = await moneyFlowAutomationService.generateForResidence(residenceId);
      this.log('info', `Money flow generation completed for residence ${residenceId}`, {
        residenceId,
        entriesCreated
      });
      return entriesCreated;
    } catch (error) {
      this.log('error', `Failed to generate money flow for residence ${residenceId}`, {
        residenceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get current money flow statistics.
   */
  async getStatistics(): Promise<any> {
    try {
      return await moneyFlowAutomationService.getMoneyFlowStatistics();
    } catch (error) {
      this.log('error', 'Failed to get money flow statistics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Send failure alert when the job fails.
   * This can be extended to integrate with notification systems.
   */
  private async sendFailureAlert(): Promise<void> {
    // Log the failure for now
    this.log('error', 'Money flow job failed - manual intervention may be required', {
      timestamp: new Date().toISOString(),
      retryAttempts: this.config.retryAttempts
    });

    // TODO: Integrate with notification service when available
    // await notificationService.sendMoneyFlowJobFailureAlert();
  }

  /**
   * Utility method for delays.
   * @param ms
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Logging method with configurable levels.
   * @param level
   * @param message
   * @param data
   */
  private log(level: 'error' | 'warn' | 'info' | 'debug', message: string, data?: any): void {
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    const configLevel = levels[this.config.logLevel];
    const messageLevel = levels[level];

    if (messageLevel <= configLevel) {
      const timestamp = new Date().toISOString();
      const logData = data ? ` ${JSON.stringify(data, null, 2)}` : '';
      console.log(`[${timestamp}] [MONEY-FLOW] [${level.toUpperCase()}] ${message}${logData}`);
    }
  }

  /**
   * Get current job status.
   */
  getStatus(): {
    enabled: boolean;
    running: boolean;
    schedule: string;
    config: MoneyFlowJobConfig;
  } {
    return {
      enabled: this.config.enabled,
      running: this.isRunning,
      schedule: this.config.schedule,
      config: this.config
    };
  }

  /**
   * Manually trigger a full regeneration.
   * Useful for maintenance or when there are data changes.
   */
  async triggerFullRegeneration(): Promise<any> {
    this.log('info', 'Manually triggering full money flow regeneration');
    
    if (this.isRunning) {
      throw new Error('Job is already running, please wait for completion');
    }

    return await this.executeMoneyFlowJob();
  }
}

// Export singleton instance
export const moneyFlowJob = new MoneyFlowJob();

// Export for manual testing
export { MoneyFlowJob };