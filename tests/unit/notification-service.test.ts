import { describe, it, expect, jest } from '@jest/globals';
import { NotificationService } from '../../server/services/notification_service';

// Mock the database and dependencies
jest.mock('../../server/db', () => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn().mockResolvedValue([])
      }))
    })),
    insert: jest.fn(() => ({
      values: jest.fn().mockResolvedValue([])
    }))
  }
}));

jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{ statusCode: 202 }])
}));

describe('NotificationService', () => {
  let notificationService: NotificationService;

  beforeEach(() => {
    notificationService = new NotificationService();
    jest.clearAllMocks();
  });

  describe('Basic functionality', () => {
    it('should be instantiable', () => {
      expect(notificationService).toBeInstanceOf(NotificationService);
    });

    it('should handle SSL expiry alerts', async () => {
      const result = await notificationService.sendSSLExpiryAlert(
        'test.com',
        'admin@test.com',
        new Date()
      );
      expect(result).toBeDefined();
    });

    it('should handle SSL renewal failure alerts', async () => {
      const result = await notificationService.sendSSLRenewalFailureAlert(
        'test.com',
        'Test error'
      );
      expect(result).toBeDefined();
    });

    it('should handle SSL renewal success alerts', async () => {
      const result = await notificationService.sendSSLRenewalSuccessAlert(
        'test.com',
        new Date()
      );
      expect(result).toBeDefined();
    });
  });
});