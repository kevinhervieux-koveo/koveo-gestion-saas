import * as cron from 'node-cron';
import { eq, lt, and, isNull, or } from 'drizzle-orm';
import { db } from '../db';
import { sslCertificates } from '@shared/schema';
import { createSSLService, type SSLService, getCertificateStatus } from '../services/ssl_service';
import { notificationService } from '../services/notification_service';

/**
 *
 */
interface SSLRenewalJobConfig {
  schedule: string;
  renewalThresholdDays: number;
  maxRetryAttempts: number;
  notificationEmail: string;
  enabled: boolean;
  batchSize: number;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  expiryNotificationThresholdDays: number;
  enableExpiryNotifications: boolean;
}

/**
 *
 */
class SSLRenewalJob {
  private sslService: SSLService | null = null;
  private config: SSLRenewalJobConfig;
  private jobTask: cron.ScheduledTask | null = null;
  private isRunning = false;

  /**
   *
   */
  constructor() {
    this.config = {
      schedule: process.env.SSL_RENEWAL_SCHEDULE || '0 2 * * *', // Daily at 2 AM by default
      renewalThresholdDays: parseInt(process.env.SSL_RENEWAL_THRESHOLD_DAYS || '30'),
      maxRetryAttempts: parseInt(process.env.SSL_MAX_RETRY_ATTEMPTS || '3'),
      notificationEmail: process.env.SSL_NOTIFICATION_EMAIL || 'admin@koveo-gestion.com',
      enabled: process.env.SSL_RENEWAL_ENABLED !== 'false',
      batchSize: parseInt(process.env.SSL_RENEWAL_BATCH_SIZE || '5'),
      logLevel: (process.env.SSL_RENEWAL_LOG_LEVEL as any) || 'info',
      expiryNotificationThresholdDays: parseInt(process.env.SSL_EXPIRY_NOTIFICATION_THRESHOLD_DAYS || '7'),
      enableExpiryNotifications: process.env.SSL_EXPIRY_NOTIFICATIONS_ENABLED !== 'false'
    };

    this.log('info', 'SSL Renewal Job initialized', { config: this.config });
  }

  /**
   * Start the SSL renewal background job.
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      this.log('info', 'SSL renewal job is disabled');
      return;
    }

    try {
      // Initialize SSL service
      await this.initializeSSLService();

      // Validate cron schedule
      if (!cron.validate(this.config.schedule)) {
        throw new Error(`Invalid cron schedule: ${this.config.schedule}`);
      }

      // Schedule the job
      this.jobTask = cron.schedule(this.config.schedule, async () => {
        await this.executeRenewalJob();
      }, {
        timezone: process.env.TZ || 'UTC'
      });

      this.jobTask.start();
      
      this.log('info', 'SSL renewal job started', {
        schedule: this.config.schedule,
        timezone: process.env.TZ || 'UTC'
      });

      // Run initial check if needed
      if (process.env.SSL_RUN_ON_STARTUP === 'true') {
        this.log('info', 'Running initial SSL renewal check...');
        await this.executeRenewalJob();
      }

      // Also run expiry monitoring check
      if (this.config.enableExpiryNotifications) {
        await this.checkForExpiringCertificates();
      }

    } catch (___error) {
      this.log('error', 'Failed to start SSL renewal job', { error: ___error instanceof Error ? ___error.message : 'Unknown error' });
      throw ___error;
    }
  }

  /**
   * Stop the SSL renewal job.
   */
  stop(): void {
    if (this.jobTask) {
      this.jobTask.stop();
      this.jobTask.destroy();
      this.jobTask = null;
      this.log('info', 'SSL renewal job stopped');
    }
  }

  /**
   * Execute the SSL renewal job manually.
   */
  async executeRenewalJob(): Promise<void> {
    if (this.isRunning) {
      this.log('warn', 'SSL renewal job is already running, skipping execution');
      return;
    }

    this.isRunning = true;
    const startTime = new Date();
    this.log('info', 'Starting SSL renewal job execution');

    try {
      // First, check for certificates that need expiry notifications
      if (this.config.enableExpiryNotifications) {
        await this.checkForExpiringCertificates();
      }

      const expiringCertificates = await this.getExpiringCertificates();
      
      if (expiringCertificates.length === 0) {
        this.log('info', 'No certificates need renewal');
        return;
      }

      this.log('info', `Found ${expiringCertificates.length} certificates that need renewal`);

      // Process certificates in batches
      const batches = this.chunkArray(expiringCertificates, this.config.batchSize);
      let successCount = 0;
      let failureCount = 0;

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        this.log('info', `Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} certificates`);

        for (const certificate of batch) {
          try {
            await this.renewCertificate(certificate);
            successCount++;
            
            // Small delay between renewals to avoid rate limiting
            await this.sleep(2000);
          } catch (___error) {
            failureCount++;
            this.log('error', `Failed to renew certificate for ${certificate.domain}`, {
              domain: certificate.domain,
              error: ___error instanceof Error ? ___error.message : 'Unknown error'
            });

            await this.handleRenewalFailure(certificate, ___error instanceof Error ? ___error.message : 'Unknown error');
            
            // Send failure notification if configured
            if (this.config.enableExpiryNotifications) {
              const newAttempts = (certificate.renewalAttempts || 0) + 1;
              await notificationService.sendSSLRenewalFailureAlert(
                certificate.domain,
                ___error instanceof Error ? ___error.message : 'Unknown error',
                newAttempts,
                certificate.maxRenewalAttempts || this.config.maxRetryAttempts
              );
            }
          }
        }

        // Delay between batches
        if (batchIndex < batches.length - 1) {
          await this.sleep(5000);
        }
      }

      const duration = new Date().getTime() - startTime.getTime();
      this.log('info', 'SSL renewal job completed', {
        duration: `${Math.round(duration / 1000)}s`,
        successCount,
        failureCount,
        totalProcessed: successCount + failureCount
      });

      // Send notification if there were failures
      if (failureCount > 0) {
        await this.sendFailureNotification(failureCount, successCount);
      }

    } catch (___error) {
      this.log('error', 'SSL renewal job failed', { error: ___error instanceof Error ? ___error.message : 'Unknown error' });
      throw ___error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check for certificates that are expiring soon and send notifications.
   * This is separate from renewal logic to catch certificates that need attention
   * even if auto-renewal is disabled.
   */
  private async checkForExpiringCertificates(): Promise<void> {
    if (!this.config.enableExpiryNotifications) {
      return;
    }

    try {
      const notificationThresholdDate = new Date();
      notificationThresholdDate.setDate(
        notificationThresholdDate.getDate() + this.config.expiryNotificationThresholdDays
      );

      // Get all certificates that are expiring within the notification threshold
      // This includes both auto-renewal enabled and disabled certificates
      const expiringCertificates = await db.select()
        .from(sslCertificates)
        .where(
          and(
            or(
              eq(sslCertificates.status, 'active'),
              eq(sslCertificates.status, 'expiring')
            ),
            lt(sslCertificates.validTo, notificationThresholdDate)
          )
        );

      if (expiringCertificates.length === 0) {
        this.log('debug', 'No certificates require expiry notifications');
        return;
      }

      this.log('info', `Found ${expiringCertificates.length} certificates expiring within ${this.config.expiryNotificationThresholdDays} days`);

      // Send notifications for each expiring certificate
      for (const certificate of expiringCertificates) {
        try {
          const expiryDate = new Date(certificate.validTo);
          const now = new Date();
          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          // Only send notification if we haven't sent one recently
          // This prevents spam notifications for the same certificate
          const shouldSendNotification = await this.shouldSendExpiryNotification(
            certificate.domain,
            daysUntilExpiry
          );

          if (shouldSendNotification) {
            await notificationService.sendSSLExpiryAlert(
              certificate.domain,
              expiryDate,
              daysUntilExpiry
            );

            // Update the certificate status to 'expiring' if it's currently 'active'
            if (certificate.status === 'active') {
              await db.update(sslCertificates)
                .set({
                  status: 'expiring',
                  updatedAt: new Date()
                })
                .where(eq(sslCertificates.id, certificate.id));
            }

            this.log('info', `Sent expiry notification for ${certificate.domain} (expires in ${daysUntilExpiry} days)`);
          }
        } catch (___error) {
          this.log('error', `Failed to send expiry notification for ${certificate.domain}`, {
            error: ___error instanceof Error ? ___error.message : 'Unknown error'
          });
        }
      }

    } catch (___error) {
      this.log('error', 'Failed to check for expiring certificates', {
        error: ___error instanceof Error ? ___error.message : 'Unknown error'
      });
    }
  }

  /**
   * Determine if we should send an expiry notification for a certificate.
   * This helps prevent spam notifications by implementing smart notification logic.
   * @param domain
   * @param daysUntilExpiry
   */
  private async shouldSendExpiryNotification(domain: string, daysUntilExpiry: number): Promise<boolean> {
    // Always notify for expired certificates (daysUntilExpiry <= 0)
    if (daysUntilExpiry <= 0) {
      return true;
    }

    // Notify daily for certificates expiring within 3 days
    if (daysUntilExpiry <= 3) {
      return true;
    }

    // Notify when certificate first enters the notification threshold
    // and then weekly thereafter until it enters the 3-day window
    if (daysUntilExpiry <= this.config.expiryNotificationThresholdDays) {
      // For certificates with more than 3 days, notify weekly
      // This is a simplified logic - in a production environment,
      // you might want to track the last notification date
      const dayOfWeek = new Date().getDay();
      return dayOfWeek === 1; // Monday notifications
    }

    return false;
  }

  /**
   * Get certificates that are expiring and need renewal.
   */
  private async getExpiringCertificates() {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + this.config.renewalThresholdDays);

    return await db.select()
      .from(sslCertificates)
      .where(
        and(
          or(
            eq(sslCertificates.status, 'active'),
            eq(sslCertificates.status, 'expiring'),
            eq(sslCertificates.status, 'renewal_failed')
          ),
          eq(sslCertificates.autoRenew, true),
          lt(sslCertificates.validTo, thresholdDate),
          or(
            isNull(sslCertificates.renewalAttempts),
            lt(sslCertificates.renewalAttempts, sslCertificates.maxRenewalAttempts)
          )
        )
      );
  }

  /**
   * Renew a specific certificate.
   * @param certificate
   */
  private async renewCertificate(certificate: unknown): Promise<void> {
    this.log('info', `Starting renewal for certificate: ${certificate.domain}`);

    try {
      // Update status to pending renewal
      await db.update(sslCertificates)
        .set({
          status: 'pending_renewal',
          lastRenewalAttempt: new Date(),
          renewalAttempts: (certificate.renewalAttempts || 0) + 1,
          renewalError: null,
          updatedAt: new Date()
        })
        .where(eq(sslCertificates.id, certificate.id));

      // Request new certificate
      const newCertificate = await this.sslService!.requestCertificate(certificate.domain);

      // Validate new certificate
      const certStatus = getCertificateStatus(newCertificate);
      if (!certStatus.isValid) {
        throw new Error(`Renewed certificate is not valid: ${certStatus.status}`);
      }

      // Update database with new certificate data
      await db.update(sslCertificates)
        .set({
          certificateData: newCertificate.certificate,
          privateKey: newCertificate.privateKey,
          issuer: newCertificate.issuer,
          subject: newCertificate.subject,
          serialNumber: newCertificate.serialNumber,
          fingerprint: newCertificate.fingerprint,
          validFrom: newCertificate.validFrom,
          validTo: newCertificate.validTo,
          status: 'active',
          renewalAttempts: 0,
          renewalError: null,
          updatedAt: new Date()
        })
        .where(eq(sslCertificates.id, certificate.id));

      this.log('info', `Successfully renewed certificate for ${certificate.domain}`, {
        domain: certificate.domain,
        validTo: newCertificate.validTo,
        issuer: newCertificate.issuer
      });

      // Send success notification if configured
      await this.sendSuccessNotification(certificate.domain, newCertificate);
      
      // Send notification service success alert
      if (this.config.enableExpiryNotifications && (certificate.renewalAttempts || 0) > 0) {
        await notificationService.sendSSLRenewalSuccessAlert(
          certificate.domain,
          new Date(newCertificate.validTo),
          certificate.renewalAttempts || 0
        );
      }

    } catch (__error) {
      throw new Error(`Certificate renewal failed for ${certificate.domain}: ${__error instanceof Error ? __error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle renewal failure.
   * @param certificate
   * @param errorMessage
   */
  private async handleRenewalFailure(certificate: any, errorMessage: string): Promise<void> {
    const newAttempts = (certificate.renewalAttempts || 0) + 1;
    const maxAttempts = certificate.maxRenewalAttempts || this.config.maxRetryAttempts;
    const status = newAttempts >= maxAttempts ? 'renewal_failed' : 'expiring';

    await db.update(sslCertificates)
      .set({
        status,
        renewalAttempts: newAttempts,
        renewalError: errorMessage,
        lastRenewalAttempt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(sslCertificates.id, certificate.id));

    this.log('error', `Certificate renewal failed for ${certificate.domain}`, {
      domain: certificate.domain,
      attempts: newAttempts,
      maxAttempts,
      finalStatus: status,
      error: errorMessage
    });
  }

  /**
   * Initialize SSL service.
   */
  private async initializeSSLService(): Promise<void> {
    if (this.sslService) {
      return;
    }

    const sslOptions = {
      email: this.config.notificationEmail,
      staging: process.env.SSL_STAGING === 'true',
      keySize: parseInt(process.env.SSL_KEY_SIZE || '2048'),
      storageDir: process.env.SSL_STORAGE_DIR || './ssl-certificates'
    };

    this.sslService = await createSSLService(sslOptions);
    this.log('info', 'SSL service initialized', { staging: sslOptions.staging });
  }

  /**
   * Send failure notification.
   * @param failureCount
   * @param successCount
   */
  private async sendFailureNotification(failureCount: number, successCount: number): Promise<void> {
    // This could be extended to send email notifications
    this.log('error', 'SSL renewal job completed with failures', {
      failureCount,
      successCount,
      notificationEmail: this.config.notificationEmail
    });

    // TODO: Integrate with email service or notification system
    // await emailService.send({
    //   to: this.config.notificationEmail,
    //   subject: `SSL Certificate Renewal Failures - ${failureCount} failures`,
    //   body: `SSL renewal job completed with ${failureCount} failures and ${successCount} successes.`
    // });
  }

  /**
   * Send success notification for critical domains.
   * @param domain
   * @param certificate
   */
  private async sendSuccessNotification(domain: string, certificate: unknown): Promise<void> {
    this.log('info', `Certificate renewed successfully for ${domain}`, {
      domain,
      validUntil: certificate.validTo
    });
    
    // TODO: Send notification for important domains
  }

  /**
   * Utility method to chunk array into smaller batches.
   * @param array
   * @param size
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
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
  private log(level: 'error' | 'warn' | 'info' | 'debug', message: string, data?: unknown): void {
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    const configLevel = levels[this.config.logLevel];
    const messageLevel = levels[level];

    if (messageLevel <= configLevel) {
      const timestamp = new Date().toISOString();
      const logData = data ? ` ${JSON.stringify(data)}` : '';
      console.log(`[${timestamp}] [SSL-RENEWAL] [${level.toUpperCase()}] ${message}${logData}`);
    }
  }

  /**
   * Get current job status.
   */
  getStatus(): {
    enabled: boolean;
    running: boolean;
    schedule: string;
    nextRun: Date | null;
    config: SSLRenewalJobConfig;
  } {
    return {
      enabled: this.config.enabled,
      running: this.isRunning,
      schedule: this.config.schedule,
      nextRun: null, // Note: nextDates() method not available in this node-cron version
      config: this.config
    };
  }
}

// Export singleton instance
export const sslRenewalJob = new SSLRenewalJob();

// Export for manual testing
export { SSLRenewalJob };