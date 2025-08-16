import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SSLRenewalJob } from '../../server/jobs/ssl_renewal_job';
import { notificationService } from '../../server/services/notification_service';

// Mock dependencies
vi.mock('../../server/services/ssl_service', () => ({
  createSSLService: vi.fn(),
  getCertificateStatus: vi.fn()
}));

vi.mock('../../server/services/notification_service', () => ({
  notificationService: {
    sendSSLExpiryAlert: vi.fn(),
    sendSSLRenewalFailureAlert: vi.fn(),
    sendSSLRenewalSuccessAlert: vi.fn()
  }
}));

vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn()
  }
}));

vi.mock('node-cron', () => ({
  schedule: vi.fn(),
  validate: vi.fn().mockReturnValue(true)
}));

describe('SSL Renewal Job', () => {
  let sslRenewalJob: SSLRenewalJob;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Set test environment variables
    process.env.SSL_RENEWAL_ENABLED = 'true';
    process.env.SSL_RENEWAL_SCHEDULE = '0 2 * * *';
    process.env.SSL_RENEWAL_THRESHOLD_DAYS = '30';
    process.env.SSL_MAX_RETRY_ATTEMPTS = '3';
    process.env.SSL_NOTIFICATION_EMAIL = 'admin@test.com';
    process.env.SSL_EXPIRY_NOTIFICATIONS_ENABLED = 'true';
    process.env.SSL_EXPIRY_NOTIFICATION_THRESHOLD_DAYS = '7';
    
    sslRenewalJob = new SSLRenewalJob();
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    
    // Stop job if running
    sslRenewalJob.stop();
  });

  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      const status = sslRenewalJob.getStatus();
      
      expect(status.enabled).toBe(true);
      expect(status.schedule).toBe('0 2 * * *');
      expect(status.config.renewalThresholdDays).toBe(30);
      expect(status.config.maxRetryAttempts).toBe(3);
      expect(status.config.expiryNotificationThresholdDays).toBe(7);
      expect(status.config.enableExpiryNotifications).toBe(true);
    });

    it('should respect environment variable overrides', () => {
      process.env.SSL_RENEWAL_THRESHOLD_DAYS = '14';
      process.env.SSL_EXPIRY_NOTIFICATION_THRESHOLD_DAYS = '3';
      process.env.SSL_MAX_RETRY_ATTEMPTS = '5';
      
      const job = new SSLRenewalJob();
      const status = job.getStatus();
      
      expect(status.config.renewalThresholdDays).toBe(14);
      expect(status.config.expiryNotificationThresholdDays).toBe(3);
      expect(status.config.maxRetryAttempts).toBe(5);
    });

    it('should handle disabled job configuration', () => {
      process.env.SSL_RENEWAL_ENABLED = 'false';
      process.env.SSL_EXPIRY_NOTIFICATIONS_ENABLED = 'false';
      
      const job = new SSLRenewalJob();
      const status = job.getStatus();
      
      expect(status.enabled).toBe(false);
      expect(status.config.enableExpiryNotifications).toBe(false);
    });
  });

  describe('Job Lifecycle', () => {
    it('should start job successfully', async () => {
      await expect(sslRenewalJob.start()).resolves.not.toThrow();
      
      const status = sslRenewalJob.getStatus();
      expect(status.enabled).toBe(true);
    });

    it('should not start when disabled', async () => {
      process.env.SSL_RENEWAL_ENABLED = 'false';
      const job = new SSLRenewalJob();
      
      await job.start();
      
      const status = job.getStatus();
      expect(status.enabled).toBe(false);
    });

    it('should stop job gracefully', () => {
      expect(() => sslRenewalJob.stop()).not.toThrow();
    });

    it('should validate cron schedule', async () => {
      const cronMock = await import('node-cron');
      (cronMock.validate as any).mockReturnValue(false);
      
      await expect(sslRenewalJob.start()).rejects.toThrow('Invalid cron schedule');
    });
  });

  describe('Expiry Notifications', () => {
    beforeEach(() => {
      // Mock database queries for expiring certificates
      const mockDb = require('../../server/db').db;
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 'cert-1',
              domain: 'test.example.com',
              validTo: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
              status: 'active'
            }
          ])
        })
      });
    });

    it('should send expiry notifications for certificates expiring soon', async () => {
      await sslRenewalJob.start();
      
      // Wait for initial job execution
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(notificationService.sendSSLExpiryAlert).toHaveBeenCalledWith(
        'test.example.com',
        expect.any(Date),
        expect.any(Number)
      );
    });

    it('should not send notifications when disabled', async () => {
      process.env.SSL_EXPIRY_NOTIFICATIONS_ENABLED = 'false';
      const job = new SSLRenewalJob();
      
      await job.start();
      
      expect(notificationService.sendSSLExpiryAlert).not.toHaveBeenCalled();
    });

    it('should handle notification errors gracefully', async () => {
      (notificationService.sendSSLExpiryAlert as any).mockRejectedValue(
        new Error('Notification failed')
      );
      
      await expect(sslRenewalJob.start()).resolves.not.toThrow();
    });
  });

  describe('Renewal Logic', () => {
    beforeEach(() => {
      const mockDb = require('../../server/db').db;
      
      // Mock certificates needing renewal
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 'renewal-cert-1',
              domain: 'renewal.example.com',
              validTo: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20 days from now
              status: 'active',
              autoRenew: true,
              renewalAttempts: 0,
              maxRenewalAttempts: 3
            }
          ])
        })
      });
      
      // Mock successful update
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([])
        })
      });
    });

    it('should send failure notifications for failed renewals', async () => {
      // Mock SSL service to throw error
      const mockSSLService = require('../../server/services/ssl_service');
      mockSSLService.createSSLService.mockResolvedValue({
        requestCertificate: vi.fn().mockRejectedValue(new Error('ACME error'))
      });
      
      await sslRenewalJob.start();
      
      // Trigger job execution
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(notificationService.sendSSLRenewalFailureAlert).toHaveBeenCalled();
    });

    it('should send success notifications for recovered renewals', async () => {
      // Mock certificate with previous failures
      const mockDb = require('../../server/db').db;
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 'recovery-cert-1',
              domain: 'recovery.example.com',
              validTo: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
              status: 'active',
              autoRenew: true,
              renewalAttempts: 2, // Had previous failures
              maxRenewalAttempts: 3
            }
          ])
        })
      });
      
      // Mock successful SSL service
      const mockSSLService = require('../../server/services/ssl_service');
      mockSSLService.createSSLService.mockResolvedValue({
        requestCertificate: vi.fn().mockResolvedValue({
          certificate: 'new-cert-data',
          privateKey: 'new-private-key',
          issuer: 'Let\'s Encrypt',
          subject: 'CN=recovery.example.com',
          validFrom: new Date().toISOString(),
          validTo: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          serialNumber: '12345',
          fingerprint: 'AA:BB:CC'
        })
      });
      
      mockSSLService.getCertificateStatus.mockReturnValue({
        isValid: true,
        status: 'valid'
      });
      
      await sslRenewalJob.start();
      
      // Trigger job execution
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(notificationService.sendSSLRenewalSuccessAlert).toHaveBeenCalledWith(
        'recovery.example.com',
        expect.any(Date),
        2
      );
    });
  });

  describe('Batch Processing', () => {
    it('should process certificates in configured batch sizes', () => {
      process.env.SSL_RENEWAL_BATCH_SIZE = '2';
      const job = new SSLRenewalJob();
      
      const status = job.getStatus();
      expect(status.config.batchSize).toBe(2);
    });

    it('should handle empty certificate list', async () => {
      const mockDb = require('../../server/db').db;
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]) // No certificates
        })
      });
      
      await expect(sslRenewalJob.start()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      const mockDb = require('../../server/db').db;
      mockDb.select.mockImplementation(() => {
        throw new Error('Database connection failed');
      });
      
      await expect(sslRenewalJob.start()).resolves.not.toThrow();
    });

    it('should handle SSL service initialization errors', async () => {
      const mockSSLService = require('../../server/services/ssl_service');
      mockSSLService.createSSLService.mockRejectedValue(
        new Error('SSL service initialization failed')
      );
      
      await expect(sslRenewalJob.start()).rejects.toThrow(
        'SSL service initialization failed'
      );
    });
  });
});