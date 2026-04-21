import cron from 'node-cron';
import { db } from '../db';
import { emailService } from '../services/email-service';
import { eq, and, isNull, gte, lte, inArray, or, not, isNotNull } from 'drizzle-orm';
import { 
  notificationConfigurations, 
  userNotificationPreferences, 
  notificationDispatchLog
} from '../../shared/schemas/operations';
import { users, organizations } from '../../shared/schemas/core';
import { buildings, userResidences, residences } from '../../shared/schemas/property';

/**
 * Notification automation job scheduler for handling automated notifications
 * based on frequency settings and building-scoped access control.
 */
export class NotificationAutomationJobScheduler {
  private isRunning = false;
  private lastRun: Date | null = null;
  private runCount = 0;
  private emailService: any;

  constructor() {
    this.emailService = emailService;
  }

  /**
   * Initialize the notification automation job scheduler.
   */
  init(): void {
    console.log('🔔 Initializing notification automation job scheduler...');
    
    // Schedule daily job at 5:00 AM Montreal time
    cron.schedule('0 5 * * *', async () => {
      await this.runDailyNotificationCheck();
    }, {
      timezone: 'America/Montreal' // Quebec timezone
    });

    console.log('✅ Notification automation job scheduled');
    console.log('📅 Daily notifications: Every day at 5:00 AM (America/Montreal)');
  }

  /**
   * Daily notification check - process all active configurations.
   */
  private async runDailyNotificationCheck(): Promise<void> {
    if (this.isRunning) {
      console.log('⏭️ Daily notification job already running, skipping...');
      return;
    }

    try {
      this.isRunning = true;
      this.lastRun = new Date();
      this.runCount++;

      console.log('🔔 Starting daily notification automation job...');
      
      const result = await this.processNotificationConfigurations();
      
      if (result.success) {
        console.log('✅ Daily notification automation completed successfully');
        console.log(`📊 Processed ${result.totalConfigs} configurations, sent ${result.totalSent} notifications`);
      } else {
        console.error('❌ Daily notification automation failed');
        console.error(`💥 ${result.error}`);
      }

      // Log job result
      this.logJobResult('daily', result);

    } catch (error: any) {
      console.error('❌ Critical error in daily notification job:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process all active notification configurations.
   */
  private async processNotificationConfigurations(): Promise<{
    success: boolean;
    totalConfigs: number;
    totalSent: number;
    error?: string;
  }> {
    try {
      const now = new Date();
      
      // Get all active notification configurations
      const configs = await db.select({
        id: notificationConfigurations.id,
        organizationId: notificationConfigurations.organizationId,
        buildingId: notificationConfigurations.buildingId,
        type: notificationConfigurations.type,
        title: notificationConfigurations.title,
        message: notificationConfigurations.message,
        frequency: notificationConfigurations.frequency,
        startDate: notificationConfigurations.startDate,
        endsAt: notificationConfigurations.endsAt,
        timezone: notificationConfigurations.timezone,
      })
      .from(notificationConfigurations)
      .where(
        and(
          eq(notificationConfigurations.isActive, true),
          lte(notificationConfigurations.startDate, now),
          // Include configs that don't have an end date OR have an end date in the future
          or(isNull(notificationConfigurations.endsAt), gte(notificationConfigurations.endsAt, now))
        )
      );

      console.log(`📋 Found ${configs.length} active notification configurations`);

      let totalSent = 0;
      const buildingStats: Record<string, number> = {};

      for (const config of configs) {
        try {
          // Check if this configuration should trigger today
          const shouldTrigger = this.shouldTriggerToday(config, now);
          
          if (shouldTrigger) {
            console.log(`🔔 Processing config ${config.id} for building ${config.buildingId}`);
            
            const recipients = await this.resolveRecipients(config);
            const periodKey = this.generatePeriodKey(config, now);

            console.log(`👥 Found ${recipients.length} potential recipients for ${config.type}`);

            let sentCount = 0;
            for (const recipient of recipients) {
              // Check if we've already sent to this user for this period
              const alreadySent = await this.checkAlreadySent(config.id, recipient.userId, periodKey);
              
              if (!alreadySent) {
                // Check user's personal frequency preferences
                const shouldSendToUser = await this.shouldSendToUser(recipient, config, now);
                
                if (shouldSendToUser) {
                  const success = await this.sendNotificationEmail(config, recipient);
                  
                  if (success) {
                    await this.logDispatch(config.id, recipient.userId, periodKey, 'sent');
                    sentCount++;
                  } else {
                    await this.logDispatch(config.id, recipient.userId, periodKey, 'failed', 'Email sending failed');
                  }
                }
              }
            }

            totalSent += sentCount;
            buildingStats[config.buildingId] = (buildingStats[config.buildingId] || 0) + sentCount;
            
            console.log(`✅ Sent ${sentCount} notifications for config ${config.id}`);
          }
        } catch (configError: any) {
          console.error(`❌ Error processing config ${config.id}:`, configError);
        }
      }

      // Log building statistics
      console.log('📊 Building notification stats:', buildingStats);

      return {
        success: true,
        totalConfigs: configs.length,
        totalSent
      };
      
    } catch (error: any) {
      console.error('❌ Error processing notification configurations:', error);
      return {
        success: false,
        totalConfigs: 0,
        totalSent: 0,
        error: error.message
      };
    }
  }

  /**
   * Check if a notification configuration should trigger today based on frequency.
   */
  private shouldTriggerToday(config: any, now: Date): boolean {
    const startDate = new Date(config.startDate);
    const timezone = config.timezone || 'America/Montreal';
    
    // Convert dates to the appropriate timezone for calculation
    const localNow = this.convertToTimezone(now, timezone);
    const localStart = this.convertToTimezone(startDate, timezone);

    switch (config.frequency) {
      case 'immediate':
        // Only send once on start date
        return this.isSameDay(localNow, localStart);
      
      case 'weekly':
        return this.isWeeklyOccurrence(localStart, localNow);
      
      case 'bi_weekly':
        return this.isBiWeeklyOccurrence(localStart, localNow);
      
      case 'monthly':
        return this.isMonthlyOccurrence(localStart, localNow);
      
      case 'quarterly':
        return this.isQuarterlyOccurrence(localStart, localNow);
      
      case 'bi-annually':
        return this.isBiAnnualOccurrence(localStart, localNow);
      
      case 'annually':
        return this.isAnnualOccurrence(localStart, localNow);
      
      default:
        console.warn(`Unknown frequency: ${config.frequency}`);
        return false;
    }
  }

  /**
   * Weekly occurrence: same weekday and whole weeks since start
   */
  private isWeeklyOccurrence(startDate: Date, currentDate: Date): boolean {
    // Check if it's the same day of the week
    if (startDate.getDay() !== currentDate.getDay()) {
      return false;
    }
    
    // Calculate weeks since start
    const timeDiff = currentDate.getTime() - startDate.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    
    return daysDiff >= 0 && daysDiff % 7 === 0;
  }

  /**
   * Bi-weekly occurrence: weekly and weeksSinceStart % 2 === 0
   */
  private isBiWeeklyOccurrence(startDate: Date, currentDate: Date): boolean {
    if (!this.isWeeklyOccurrence(startDate, currentDate)) {
      return false;
    }
    
    const timeDiff = currentDate.getTime() - startDate.getTime();
    const weeksDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24 * 7));
    
    return weeksDiff % 2 === 0;
  }

  /**
   * Monthly occurrence: same day-of-month (handle month-end edge cases)
   */
  private isMonthlyOccurrence(startDate: Date, currentDate: Date): boolean {
    const startDay = startDate.getDate();
    const currentDay = currentDate.getDate();
    
    // Handle month-end edge cases
    const daysInCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const targetDay = Math.min(startDay, daysInCurrentMonth);
    
    return currentDay === targetDay;
  }

  /**
   * Quarterly occurrence: monthsSinceStart % 3 === 0 with day alignment
   */
  private isQuarterlyOccurrence(startDate: Date, currentDate: Date): boolean {
    if (!this.isMonthlyOccurrence(startDate, currentDate)) {
      return false;
    }
    
    const monthsDiff = this.getMonthsDifference(startDate, currentDate);
    return monthsDiff >= 0 && monthsDiff % 3 === 0;
  }

  /**
   * Bi-annual occurrence: monthsSinceStart % 6 === 0 with day alignment
   */
  private isBiAnnualOccurrence(startDate: Date, currentDate: Date): boolean {
    if (!this.isMonthlyOccurrence(startDate, currentDate)) {
      return false;
    }
    
    const monthsDiff = this.getMonthsDifference(startDate, currentDate);
    return monthsDiff >= 0 && monthsDiff % 6 === 0;
  }

  /**
   * Annual occurrence: same month/day (handle Feb 29 → Feb 28 on non-leap years)
   */
  private isAnnualOccurrence(startDate: Date, currentDate: Date): boolean {
    const startMonth = startDate.getMonth();
    const startDay = startDate.getDate();
    const currentMonth = currentDate.getMonth();
    const currentDay = currentDate.getDate();
    
    if (startMonth !== currentMonth) {
      return false;
    }
    
    // Handle leap year edge case (Feb 29 → Feb 28)
    if (startMonth === 1 && startDay === 29) { // February 29
      const isCurrentYearLeap = this.isLeapYear(currentDate.getFullYear());
      if (!isCurrentYearLeap && currentDay === 28) {
        return true; // Feb 29 becomes Feb 28 in non-leap years
      }
    }
    
    return startDay === currentDay;
  }

  /**
   * Resolve recipients for a notification configuration with building-scoped access control.
   */
  private async resolveRecipients(config: any): Promise<any[]> {
    try {
      // Get all users assigned to this building through residences
      const buildingUsers = await db.selectDistinct({
        userId: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        buildingId: residences.buildingId,
      })
      .from(users)
      .innerJoin(userResidences, eq(users.id, userResidences.userId))
      .innerJoin(residences, eq(userResidences.residenceId, residences.id))
      .where(and(
        eq(residences.buildingId, config.buildingId),
        eq(userResidences.isActive, true),
        eq(users.isActive, true),
        isNotNull(users.email)
      ));

      // Get notification preferences for this notification type
      const recipients = [];
      
      for (const user of buildingUsers) {
        const preferences = await db.select()
          .from(userNotificationPreferences)
          .where(
            and(
              eq(userNotificationPreferences.userId, user.userId),
              eq(userNotificationPreferences.notificationType, config.type),
              eq(userNotificationPreferences.isEnabled, true)
            )
          )
          .limit(1);

        if (preferences.length > 0) {
          recipients.push({
            ...user,
            preference: preferences[0]
          });
        }
      }

      return recipients;
      
    } catch (error: any) {
      console.error('❌ Error resolving recipients:', error);
      return [];
    }
  }

  /**
   * Check if a user should receive the notification based on their personal frequency preferences.
   */
  private async shouldSendToUser(recipient: any, config: any, now: Date): Promise<boolean> {
    try {
      const userPreference = recipient.preference;
      if (!userPreference || !userPreference.isEnabled) {
        return false;
      }

      // If user frequency is more restrictive than config frequency, respect user preference
      const userStartDate = new Date(userPreference.startingDate);
      return this.shouldTriggerBasedOnFrequency(userPreference.frequency, userStartDate, now);
      
    } catch (error: any) {
      console.error('❌ Error checking user send preference:', error);
      return false;
    }
  }

  /**
   * Check if should trigger based on frequency and start date.
   */
  private shouldTriggerBasedOnFrequency(frequency: string, startDate: Date, now: Date): boolean {
    const mockConfig = { frequency, startDate, timezone: 'America/Montreal' };
    return this.shouldTriggerToday(mockConfig, now);
  }

  /**
   * Send notification email to recipient.
   */
  private async sendNotificationEmail(config: any, recipient: any): Promise<boolean> {
    try {
      return await this.emailService.sendNotificationEmail(
        recipient.email,
        recipient.name || `${recipient.firstName} ${recipient.lastName}`.trim(),
        config.title,
        config.message,
        config.type
      );
    } catch (error: any) {
      console.error(`❌ Error sending notification email to ${recipient.email}:`, error);
      return false;
    }
  }

  /**
   * Check if notification was already sent to user for this period.
   */
  private async checkAlreadySent(configId: string, userId: string, periodKey: string): Promise<boolean> {
    try {
      const existing = await db.select()
        .from(notificationDispatchLog)
        .where(
          and(
            eq(notificationDispatchLog.configurationId, configId),
            eq(notificationDispatchLog.userId, userId),
            eq(notificationDispatchLog.periodKey, periodKey)
          )
        )
        .limit(1);

      return existing.length > 0;
    } catch (error: any) {
      console.error('❌ Error checking dispatch log:', error);
      return false; // If we can't check, allow sending to be safe
    }
  }

  /**
   * Log notification dispatch to prevent duplicates.
   */
  private async logDispatch(configId: string, userId: string, periodKey: string, status: 'sent' | 'failed', error?: string): Promise<void> {
    try {
      await db.insert(notificationDispatchLog).values({
        configurationId: configId,
        userId: userId,
        periodKey: periodKey,
        sentAt: new Date(),
      }).onConflictDoNothing();
    } catch (insertError: any) {
      console.error('❌ Error logging dispatch:', insertError);
    }
  }

  /**
   * Generate period key for idempotency.
   */
  private generatePeriodKey(config: any, date: Date): string {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    return `${config.frequency}-${dateStr}`;
  }

  /**
   * Utility methods
   */
  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  private getMonthsDifference(startDate: Date, endDate: Date): number {
    return (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
           (endDate.getMonth() - startDate.getMonth());
  }

  private isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }

  private convertToTimezone(date: Date, timezone: string): Date {
    // Convert date to the specified timezone
    // This properly handles DST transitions
    try {
      return new Date(date.toLocaleString("en-US", { timeZone: timezone }));
    } catch (error) {
      console.warn(`⚠️ Invalid timezone ${timezone}, using original date`);
      return date;
    }
  }

  /**
   * Log job results for monitoring and debugging.
   */
  private logJobResult(jobType: 'daily' | 'manual', result: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      jobType,
      success: result.success,
      totalConfigs: result.totalConfigs,
      totalSent: result.totalSent,
      runCount: this.runCount,
      error: result.error
    };
    
    console.log('📋 Notification Job Log:', JSON.stringify(logEntry, null, 2));
  }

  /**
   * Manual trigger for testing and immediate execution.
   */
  async triggerManual(options: {
    configurationId?: string;
    buildingId?: string;
  } = {}): Promise<any> {
    console.log('🔄 Manual trigger requested for notification automation job...');
    
    try {
      // If specific configuration ID is provided, process only that
      if (options.configurationId) {
        // Implementation for specific config trigger
        console.log(`🎯 Processing specific configuration: ${options.configurationId}`);
      }
      
      const result = await this.processNotificationConfigurations();
      
      this.logJobResult('manual', result);
      
      return {
        status: result.success ? 'completed' : 'failed',
        result: result
      };
      
    } catch (error: any) {
      console.error('❌ Error in manual trigger:', error);
      throw error;
    }
  }

  /**
   * Get current job status and statistics.
   */
  async getJobStatus(): Promise<{
    isRunning: boolean;
    lastRun: Date | null;
    runCount: number;
    nextScheduled: string;
  }> {
    // Calculate next scheduled run (tomorrow at 5:00 AM)
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setDate(now.getDate() + 1);
    nextRun.setHours(5, 0, 0, 0);
    
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      runCount: this.runCount,
      nextScheduled: nextRun.toISOString()
    };
  }

  /**
   * Stop all scheduled jobs (for graceful shutdown).
   */
  destroy(): void {
    console.log('🛑 Stopping notification automation job scheduler...');
    cron.getTasks().forEach(task => task.destroy());
    console.log('✅ Notification automation job scheduler stopped');
  }
}

// Export singleton instance
export const notificationJobScheduler = new NotificationAutomationJobScheduler();