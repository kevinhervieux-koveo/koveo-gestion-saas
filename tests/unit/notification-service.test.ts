import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NotificationService } from '../../server/services/notification_service';
import { db } from '../../server/db';
import { notifications } from '@shared/schema';

// Mock database functions
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockValues = jest.fn();
const mockFrom = jest.fn();
const mockWhere = jest.fn();

// Mock the database module
jest.mock('../../server/db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn()
  }
}));

describe('Notification Service', () => {
  let notificationService: NotificationService;
  let mockDb: typeof db;

  beforeEach(() => {
    notificationService = new NotificationService();
    mockDb = db as typeof db;
    
    // Setup the mock functions
    mockDb.select = mockSelect;
    mockDb.insert = mockInsert;
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('SSL Expiry Alerts', () => {
    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();
      
      // Setup proper Drizzle ORM mock chain
      mockWhere.mockResolvedValue([
        {
          id: 'admin-1',
          email: 'admin1@test.com',
          firstName: 'Admin',
          lastName: 'One',
          role: 'admin'
        },
        {
          id: 'owner-1',
          email: 'owner1@test.com',
          firstName: 'Owner',
          lastName: 'One',
          role: 'owner'
        }
      ]);
      
      mockFrom.mockReturnValue({ where: mockWhere });
      mockSelect.mockReturnValue({ from: mockFrom });
      
      // Mock notification insertion
      mockValues.mockResolvedValue([]);
      mockInsert.mockReturnValue({ values: mockValues });
    });

    it('should send expiry alerts to admin and owner users', async () => {
      const expiryDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
      
      await notificationService.sendSSLExpiryAlert('test.example.com', expiryDate, 5);
      
      expect(mockSelect).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalledWith(notifications);
      expect(mockValues).toHaveBeenCalled();
      
      // Check that values was called with notification data
      const valuesCallArgs = mockValues.mock.calls[0][0];
      expect(Array.isArray(valuesCallArgs)).toBe(true);
      expect(valuesCallArgs).toHaveLength(2); // Two notifications (admin + owner)
      
      expect(valuesCallArgs[0]).toMatchObject({
        userId: 'admin-1',
        type: 'ssl_certificate',
        title: 'SSL Certificate Expiring Soon: test.example.com',
        relatedEntityType: 'ssl_certificate'
      });
      expect(valuesCallArgs[0].message).toContain('expires in 5 days');
    });

    it('should send critical alerts for certificates expiring tomorrow', async () => {
      const expiryDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000); // 1 day from now
      
      await notificationService.sendSSLExpiryAlert('urgent.example.com', expiryDate, 1);
      
      const valuesCallArgs = mockValues.mock.calls[0][0];
      expect(valuesCallArgs[0].message).toContain('CRITICAL');
      expect(valuesCallArgs[0].message).toContain('expires tomorrow');
    });

    it('should send urgent alerts for expired certificates', async () => {
      const expiryDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
      
      await notificationService.sendSSLExpiryAlert('expired.example.com', expiryDate, -1);
      
      const valuesCallArgs = mockValues.mock.calls[0][0];
      expect(valuesCallArgs[0].message).toContain('URGENT');
      expect(valuesCallArgs[0].message).toContain('has expired');
      expect(valuesCallArgs[0].message).toContain('Immediate action required');
    });

    it('should handle case when no administrators found', async () => {
      // Override the mock to return empty array
      mockWhere.mockResolvedValue([]);
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      
      const expiryDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      await notificationService.sendSSLExpiryAlert('test.example.com', expiryDate, 5);
      
      expect(consoleSpy).toHaveBeenCalledWith('No administrators found to send SSL expiry notification');
      expect(mockInsert).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should use Quebec timezone for date formatting', async () => {
      const expiryDate = new Date('2024-03-15T12:00:00Z');
      
      await notificationService.sendSSLExpiryAlert('quebec.example.com', expiryDate, 5);
      
      const valuesCallArgs = mockValues.mock.calls[0][0];
      
      // Should format date according to Quebec/Montreal timezone
      expect(valuesCallArgs[0].message).toContain('March 15, 2024');
    });
  });

  describe('SSL Renewal Failure Alerts', () => {
    beforeEach(() => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            {
              id: 'admin-1',
              email: 'admin1@test.com',
              role: 'admin'
            }
          ])
        })
      });

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockResolvedValue([])
      });
    });

    it('should send failure alerts for failed renewal attempts', async () => {
      await notificationService.sendSSLRenewalFailureAlert(
        'failing.example.com',
        'ACME challenge failed',
        2,
        3
      );
      
      expect(mockDb.insert).toHaveBeenCalledWith(notifications);
      
      const insertCall = mockDb.insert.mock.calls[0];
      const valuesCall = insertCall[0](notifications).values.mock.calls[0][0];
      
      expect(valuesCall[0]).toMatchObject({
        type: 'ssl_certificate',
        title: 'SSL Certificate Renewal Failed: failing.example.com'
      });
      expect(valuesCall[0].message).toContain('attempt 2/3 failed');
      expect(valuesCall[0].message).toContain('ACME challenge failed');
      expect(valuesCall[0].message).toContain('Automatic retry will be attempted');
    });

    it('should send critical alerts when max attempts reached', async () => {
      await notificationService.sendSSLRenewalFailureAlert(
        'maxed.example.com',
        'DNS validation timeout',
        3,
        3
      );
      
      const insertCall = mockDb.insert.mock.calls[0];
      const valuesCall = insertCall[0](notifications).values.mock.calls[0][0];
      
      expect(valuesCall[0].message).toContain('CRITICAL');
      expect(valuesCall[0].message).toContain('failed 3/3 times');
      expect(valuesCall[0].message).toContain('Manual intervention required');
    });
  });

  describe('SSL Renewal Success Alerts', () => {
    beforeEach(() => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            {
              id: 'admin-1',
              email: 'admin1@test.com',
              role: 'admin'
            }
          ])
        })
      });

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockResolvedValue([])
      });
    });

    it('should send success alerts for recovered certificates', async () => {
      const newExpiryDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days from now
      
      await notificationService.sendSSLRenewalSuccessAlert(
        'recovered.example.com',
        newExpiryDate,
        2
      );
      
      expect(mockDb.insert).toHaveBeenCalledWith(notifications);
      
      const insertCall = mockDb.insert.mock.calls[0];
      const valuesCall = insertCall[0](notifications).values.mock.calls[0][0];
      
      expect(valuesCall[0]).toMatchObject({
        type: 'ssl_certificate',
        title: 'SSL Certificate Renewed Successfully: recovered.example.com'
      });
      expect(valuesCall[0].message).toContain('successfully renewed after 2 previous attempts');
    });

    it('should not send success alerts for certificates without previous failures', async () => {
      const newExpiryDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      
      await notificationService.sendSSLRenewalSuccessAlert(
        'normal.example.com',
        newExpiryDate,
        0 // No previous attempts
      );
      
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('Unread Notification Count', () => {
    it('should return count of unread SSL notifications for user', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            { id: '1' },
            { id: '2' },
            { id: '3' }
          ])
        })
      });
      
      const count = await notificationService.getUnreadSSLNotificationCount('user-123');
      
      expect(count).toBe(3);
    });

    it('should return 0 when user has no unread SSL notifications', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([])
        })
      });
      
      const count = await notificationService.getUnreadSSLNotificationCount('user-456');
      
      expect(count).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      mockDb.select.mockImplementation(() => {
        throw new Error('Database error');
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      
      const count = await notificationService.getUnreadSSLNotificationCount('user-789');
      
      expect(count).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get unread SSL notification count:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors in SSL expiry alerts', async () => {
      mockDb.select.mockImplementation(() => {
        throw new Error('Database connection failed');
      });
      
      const expiryDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      
      await expect(
        notificationService.sendSSLExpiryAlert('error.example.com', expiryDate, 5)
      ).rejects.toThrow('Failed to send SSL expiry notification');
    });

    it('should handle insertion errors gracefully', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            { id: 'admin-1', email: 'admin@test.com', role: 'admin' }
          ])
        })
      });

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockRejectedValue(new Error('Insert failed'))
      });
      
      const expiryDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      
      await expect(
        notificationService.sendSSLExpiryAlert('insert-error.example.com', expiryDate, 5)
      ).rejects.toThrow('Failed to send SSL expiry notification');
    });
  });
});