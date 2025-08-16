import { eq, or, and } from 'drizzle-orm';
import { db } from '../db';
import { notifications, users, type InsertNotification } from '@shared/schema';

/**
 * Notification service for sending system notifications to users.
 * Handles SSL certificate alerts, maintenance notifications, and other system messages.
 */
export class NotificationService {
  /**
   * Send an SSL certificate expiry notification to all administrators.
   * 
   * @param domain - The domain name of the expiring certificate.
   * @param expiryDate - The certificate expiry date.
   * @param daysUntilExpiry - Number of days until certificate expires.
   */
  async sendSSLExpiryAlert(
    domain: string, 
    expiryDate: Date, 
    daysUntilExpiry: number
  ): Promise<void> {
    try {
      // Get all admin users
      const adminUsers = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role
      })
      .from(users)
      .where(
        eq(users.role, 'admin')
      );

      if (adminUsers.length === 0) {
        console.warn('No administrators found to send SSL expiry notification');
        return;
      }

      const formattedExpiryDate = expiryDate.toLocaleDateString('en-CA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/Montreal'
      });

      const title = `SSL Certificate Expiring Soon: ${domain}`;
      const message = daysUntilExpiry <= 0 
        ? `URGENT: SSL certificate for ${domain} has expired on ${formattedExpiryDate}. Immediate action required to maintain security.`
        : daysUntilExpiry === 1
        ? `CRITICAL: SSL certificate for ${domain} expires tomorrow (${formattedExpiryDate}). Please renew immediately.`
        : `SSL certificate for ${domain} expires in ${daysUntilExpiry} days on ${formattedExpiryDate}. Please ensure renewal is scheduled.`;

      // Create notifications for all administrators
      const notificationInserts: InsertNotification[] = adminUsers.map(admin => ({
        userId: admin.id,
        type: 'ssl_certificate',
        title,
        message,
        relatedEntityId: null, // Could be SSL certificate ID if needed
        relatedEntityType: 'ssl_certificate'
      }));

      await db.insert(notifications).values(notificationInserts);

      console.log(`SSL expiry notification sent to ${adminUsers.length} administrators for domain: ${domain}`);
      
    } catch (error) {
      console.error('Failed to send SSL expiry notification:', error);
      throw new Error(`Failed to send SSL expiry notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send SSL certificate renewal failure notification to administrators.
   * 
   * @param domain - The domain name of the failed certificate renewal.
   * @param errorMessage - The error message from the renewal attempt.
   * @param attemptCount - Current number of renewal attempts.
   * @param maxAttempts - Maximum number of renewal attempts allowed.
   */
  async sendSSLRenewalFailureAlert(
    domain: string,
    errorMessage: string,
    attemptCount: number,
    maxAttempts: number
  ): Promise<void> {
    try {
      // Get all admin users
      const adminUsers = await db.select({
        id: users.id,
        email: users.email,
        role: users.role
      })
      .from(users)
      .where(
        eq(users.role, 'admin')
      );

      if (adminUsers.length === 0) {
        console.warn('No administrators found to send SSL renewal failure notification');
        return;
      }

      const title = `SSL Certificate Renewal Failed: ${domain}`;
      const message = attemptCount >= maxAttempts
        ? `CRITICAL: SSL certificate renewal for ${domain} has failed ${attemptCount}/${maxAttempts} times. Manual intervention required. Last error: ${errorMessage}`
        : `SSL certificate renewal attempt ${attemptCount}/${maxAttempts} failed for ${domain}. Error: ${errorMessage}. Automatic retry will be attempted.`;

      const notificationInserts: InsertNotification[] = adminUsers.map(admin => ({
        userId: admin.id,
        type: 'ssl_certificate',
        title,
        message,
        relatedEntityId: null,
        relatedEntityType: 'ssl_certificate'
      }));

      await db.insert(notifications).values(notificationInserts);

      console.log(`SSL renewal failure notification sent to ${adminUsers.length} administrators for domain: ${domain}`);
      
    } catch (error) {
      console.error('Failed to send SSL renewal failure notification:', error);
      throw new Error(`Failed to send SSL renewal failure notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send SSL certificate renewal success notification to administrators.
   * Only sent for certificates that previously had renewal issues.
   * 
   * @param domain - The domain name of the successfully renewed certificate.
   * @param newExpiryDate - The new expiry date of the renewed certificate.
   * @param previousAttempts - Number of previous failed attempts.
   */
  async sendSSLRenewalSuccessAlert(
    domain: string,
    newExpiryDate: Date,
    previousAttempts: number = 0
  ): Promise<void> {
    // Only send success notifications for certificates that had previous failures
    if (previousAttempts === 0) {
      return;
    }

    try {
      const adminUsers = await db.select({
        id: users.id,
        email: users.email,
        role: users.role
      })
      .from(users)
      .where(
        eq(users.role, 'admin')
      );

      if (adminUsers.length === 0) {
        return;
      }

      const formattedExpiryDate = newExpiryDate.toLocaleDateString('en-CA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/Montreal'
      });

      const title = `SSL Certificate Renewed Successfully: ${domain}`;
      const message = `SSL certificate for ${domain} has been successfully renewed after ${previousAttempts} previous attempts. New expiry date: ${formattedExpiryDate}.`;

      const notificationInserts: InsertNotification[] = adminUsers.map(admin => ({
        userId: admin.id,
        type: 'ssl_certificate',
        title,
        message,
        relatedEntityId: null,
        relatedEntityType: 'ssl_certificate'
      }));

      await db.insert(notifications).values(notificationInserts);

      console.log(`SSL renewal success notification sent to ${adminUsers.length} administrators for domain: ${domain}`);
      
    } catch (error) {
      console.error('Failed to send SSL renewal success notification:', error);
      // Don't throw error for success notifications
    }
  }

  /**
   * Get the count of unread SSL notifications for a user.
   * 
   * @param userId - The user ID to check notifications for.
   * @returns Number of unread SSL notifications.
   */
  async getUnreadSSLNotificationCount(userId: string): Promise<number> {
    try {
      const result = await db.select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.type, 'ssl_certificate'),
            eq(notifications.isRead, false)
          )
        );

      return result.length;
    } catch (error) {
      console.error('Failed to get unread SSL notification count:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();