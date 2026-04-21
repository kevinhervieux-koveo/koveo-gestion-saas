/**
 * Consolidated Communication Service
 * 
 * Consolidates all communication-related services into a single, optimized service:
 * - System notifications (SSL, maintenance, etc.)
 * - Email sending with SendGrid integration
 * - Email template management and routing
 * - Calendar integration and Outlook compatibility
 * 
 * Replaces:
 * - notification_service.ts
 * - email-service.ts
 * - email-routes.ts
 * - outlook-integration.ts
 */

import { MailService } from '@sendgrid/mail';
import { eq, or, and } from 'drizzle-orm';
import { db } from '../db';
import { BaseService } from './_base/base-service';
import { notifications, users, invitations, invitationAuditLog, type InsertNotification } from '@shared/schema';
import * as schema from '@shared/schema';
import { maskEmail } from '../utils/logger';

// Interfaces for communication operations
interface MeetingData {
  title: string;
  description?: string;
  location: string;
  scheduledDate: Date;
  duration: number; // in minutes
  organizerName: string;
  organizerEmail: string;
  organizationName?: string;
  attendeeEmails?: string[];
}

interface CalendarIntegrationLinks {
  outlookPersonal: string;
  outlookBusiness: string;
  enhancedICS: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  languages: string[];
  variables: string[];
}

export class ConsolidatedCommunicationService extends BaseService {
  private mailService: MailService | null = null;
  private emailEnabled: boolean = false;
  private fromEmail: string = 'info@koveo-gestion.com';
  private fromName: string = 'Koveo Gestion';

  constructor() {
    super('ConsolidatedCommunicationService');

    if (!process.env.SENDGRID_API_KEY) {
      console.warn(
        '⚠️ Email service disabled: SENDGRID_API_KEY environment variable is not set. Email-sending operations will be skipped.'
      );
      return;
    }

    this.mailService = new MailService();
    this.mailService.setApiKey(process.env.SENDGRID_API_KEY);
    this.emailEnabled = true;
  }

  private async sendMail(payload: Parameters<MailService['send']>[0]): Promise<boolean> {
    if (!this.emailEnabled || !this.mailService) {
      console.warn(
        '⚠️ Email service disabled: skipping email send (SENDGRID_API_KEY is not configured).'
      );
      return false;
    }
    await this.mailService.send(payload);
    return true;
  }

  // ====================
  // NOTIFICATION MANAGEMENT
  // ====================

  /**
   * Send SSL certificate expiry notification to all administrators
   */
  async sendSSLExpiryAlert(
    domain: string,
    expiryDate: Date,
    daysUntilExpiry: number
  ): Promise<void> {
    return this.executeWithErrorHandling('sendSSLExpiryAlert', async () => {
      const adminUsers = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
        })
        .from(users)
        .where(eq(users.role, 'admin'));

      if (adminUsers.length === 0) {
        // console.log('⚠️ No admin users found for SSL expiry notification');
        return;
      }

      const formattedExpiryDate = this.formatQuebecDate(expiryDate);

      const title = `SSL Certificate Expiring Soon: ${domain}`;
      const message =
        daysUntilExpiry <= 0
          ? `URGENT: SSL certificate for ${domain} has expired on ${formattedExpiryDate}. Immediate action required to maintain security.`
          : daysUntilExpiry === 1
            ? `CRITICAL: SSL certificate for ${domain} expires tomorrow (${formattedExpiryDate}). Please renew immediately.`
            : `SSL certificate for ${domain} expires in ${daysUntilExpiry} days on ${formattedExpiryDate}. Please ensure renewal is scheduled.`;

      const notificationInserts: InsertNotification[] = adminUsers.map((admin) => ({
        userId: admin.id,
        type: 'system' as const,
        title,
        message,
        relatedEntityId: null,
        relatedEntityType: 'system',
      }));

      await db.insert(notifications).values(notificationInserts);

      // console.log(`SSL expiry notification sent to ${adminUsers.length} administrators for domain: ${domain}`);
    });
  }

  /**
   * Send SSL certificate renewal failure notification
   */
  async sendSSLRenewalFailureAlert(
    domain: string,
    errorMessage: string,
    attemptCount: number,
    maxAttempts: number
  ): Promise<void> {
    return this.executeWithErrorHandling('sendSSLRenewalFailureAlert', async () => {
      const adminUsers = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.role, 'admin'));

      if (adminUsers.length === 0) {
        return;
      }

      const title = `SSL Certificate Renewal Failed: ${domain}`;
      const message = `SSL certificate renewal failed for ${domain} (Attempt ${attemptCount}/${maxAttempts}). Error: ${errorMessage}. ${
        attemptCount >= maxAttempts ? 'All automatic attempts exhausted. Manual intervention required.' : 'Automatic retry will be attempted.'
      }`;

      const notificationInserts: InsertNotification[] = adminUsers.map((admin) => ({
        userId: admin.id,
        type: 'system' as const,
        title,
        message,
        relatedEntityId: null,
        relatedEntityType: 'ssl_certificate',
      }));

      await db.insert(notifications).values(notificationInserts);

      // console.log(`SSL renewal failure notification sent to ${adminUsers.length} administrators for domain: ${domain}`);
    });
  }

  /**
   * Send system notification to specific users
   */
  async sendSystemNotification(
    userIds: string[],
    title: string,
    message: string,
    relatedEntityId?: string,
    relatedEntityType?: string
  ): Promise<void> {
    return this.executeWithErrorHandling('sendSystemNotification', async () => {
      const notificationInserts: InsertNotification[] = userIds.map((userId) => ({
        userId,
        type: 'system' as const,
        title,
        message,
        relatedEntityId: relatedEntityId || null,
        relatedEntityType: relatedEntityType || 'system',
      }));

      await db.insert(notifications).values(notificationInserts);

      // console.log(`System notification sent to ${userIds.length} users: ${title}`);
    });
  }

  // ====================
  // EMAIL SERVICES
  // ====================

  /**
   * Send password reset email with Quebec Law 25 compliance
   */
  async sendPasswordResetEmail(
    to: string,
    userName: string,
    resetUrl: string,
    language: 'fr' | 'en' = 'fr'
  ): Promise<boolean> {
    return this.executeWithErrorHandling('sendPasswordResetEmail', async () => {
      const templates = this.getPasswordResetTemplates();
      const template = templates[language];

      const htmlContent = template.html
        .replace(/\{userName\}/g, userName)
        .replace(/\{resetUrl\}/g, resetUrl);

      const textContent = template.text
        .replace(/\{userName\}/g, userName)
        .replace(/\{resetUrl\}/g, resetUrl);

      try {
        await this.sendMail({
          to,
          from: {
            email: this.fromEmail,
            name: this.fromName,
          },
          subject: template.subject,
          html: htmlContent,
          text: textContent,
          trackingSettings: {
            clickTracking: {
              enable: false,
            },
            openTracking: {
              enable: false,
            },
          },
          mailSettings: {
            bypassListManagement: {
              enable: false,
            },
          },
        });

        // console.log(`✅ Password reset email sent successfully to ${to} (${language})`);
        return true;
      } catch (error: any) {
        // console.error(`❌ Failed to send password reset email to ${to}:`, error);
        return false;
      }
    });
  }

  /**
   * Send invitation email to new users
   */
  async sendInvitationEmail(
    to: string,
    recipientName: string,
    organizationName: string,
    inviterName: string,
    invitationToken: string,
    expiryDate: Date,
    language: 'fr' | 'en' = 'fr'
  ): Promise<boolean> {
    return this.executeWithErrorHandling('sendInvitationEmail', async () => {
      const invitationUrl = `${process.env.FRONTEND_URL || 'https://app.koveo.com'}/invitation/${invitationToken}`;
      const unsubscribeToken = this.generateUnsubscribeToken(to);
      const unsubscribeUrl = `${process.env.FRONTEND_URL || 'https://app.koveo.com'}/api/email/unsubscribe?token=${unsubscribeToken}&email=${encodeURIComponent(to)}`;

      const templates = this.getInvitationTemplates();
      const template = templates[language];

      const htmlContent = template.html
        .replace(/\{recipientName\}/g, recipientName)
        .replace(/\{organizationName\}/g, organizationName)
        .replace(/\{inviterName\}/g, inviterName)
        .replace(/\{invitationUrl\}/g, invitationUrl)
        .replace(/\{expiryDate\}/g, this.formatQuebecDate(expiryDate))
        .replace(/\{unsubscribeUrl\}/g, unsubscribeUrl);

      const textContent = template.text
        .replace(/\{recipientName\}/g, recipientName)
        .replace(/\{organizationName\}/g, organizationName)
        .replace(/\{inviterName\}/g, inviterName)
        .replace(/\{invitationUrl\}/g, invitationUrl)
        .replace(/\{expiryDate\}/g, this.formatQuebecDate(expiryDate))
        .replace(/\{unsubscribeUrl\}/g, unsubscribeUrl);

      try {
        await this.sendMail({
          to,
          from: {
            email: this.fromEmail,
            name: this.fromName,
          },
          subject: template.subject,
          html: htmlContent,
          text: textContent,
          trackingSettings: {
            clickTracking: {
              enable: false,
            },
            openTracking: {
              enable: false,
            },
          },
        });

        // console.log(`✅ Invitation email sent successfully to ${to} (${language})`);
        return true;
      } catch (error: any) {
        // console.error(`❌ Failed to send invitation email to ${to}:`, error);
        return false;
      }
    });
  }

  /**
   * Send reminder email for pending invitations
   */
  async sendReminderEmail(
    to: string,
    recipientName: string,
    invitationToken: string,
    organizationName: string,
    expiryDate: Date,
    language: 'fr' | 'en' = 'fr'
  ): Promise<boolean> {
    return this.executeWithErrorHandling('sendReminderEmail', async () => {
      const invitationUrl = `${process.env.FRONTEND_URL || 'https://app.koveo.com'}/invitation/${invitationToken}`;
      const unsubscribeToken = this.generateUnsubscribeToken(to);
      const unsubscribeUrl = `${process.env.FRONTEND_URL || 'https://app.koveo.com'}/api/email/unsubscribe?token=${unsubscribeToken}&email=${encodeURIComponent(to)}`;

      const templates = this.getReminderTemplates();
      const template = templates[language];

      const htmlContent = template.html
        .replace(/\{recipientName\}/g, recipientName)
        .replace(/\{organizationName\}/g, organizationName)
        .replace(/\{invitationUrl\}/g, invitationUrl)
        .replace(/\{expiryDate\}/g, this.formatQuebecDate(expiryDate))
        .replace(/\{unsubscribeUrl\}/g, unsubscribeUrl);

      const textContent = template.text
        .replace(/\{recipientName\}/g, recipientName)
        .replace(/\{organizationName\}/g, organizationName)
        .replace(/\{invitationUrl\}/g, invitationUrl)
        .replace(/\{expiryDate\}/g, this.formatQuebecDate(expiryDate))
        .replace(/\{unsubscribeUrl\}/g, unsubscribeUrl);

      try {
        await this.sendMail({
          to,
          from: {
            email: this.fromEmail,
            name: this.fromName,
          },
          subject: template.subject,
          html: htmlContent,
          text: textContent,
          trackingSettings: {
            clickTracking: {
              enable: false,
            },
            openTracking: {
              enable: false,
            },
          },
        });

        // console.log(`✅ Reminder email sent successfully to ${to} (${language})`);
        return true;
      } catch (error: any) {
        // console.error(`❌ Failed to send reminder email to ${to}:`, error);
        return false;
      }
    });
  }

  /**
   * Send meeting invitation with calendar integration
   */
  async sendMeetingInvitation(
    attendeeEmails: string[],
    meetingData: MeetingData,
    language: 'fr' | 'en' = 'fr'
  ): Promise<boolean> {
    return this.executeWithErrorHandling('sendMeetingInvitation', async () => {
      const calendarLinks = this.generateAllCalendarLinks(meetingData, language);
      const icsContent = this.generateEnhancedICS(meetingData, language);

      const templates = this.getMeetingTemplates();
      const template = templates[language];

      const calendarButtonsHTML = this.generateCalendarButtonsHTML(calendarLinks, language);
      const calendarInstructionsText = this.generateCalendarInstructionsText(calendarLinks, language);

      for (const email of attendeeEmails) {
        const htmlContent = template.html
          .replace(/\{meetingTitle\}/g, meetingData.title)
          .replace(/\{meetingDescription\}/g, meetingData.description || '')
          .replace(/\{meetingLocation\}/g, meetingData.location)
          .replace(/\{meetingDate\}/g, this.formatQuebecDate(meetingData.scheduledDate))
          .replace(/\{organizationName\}/g, meetingData.organizationName || 'Koveo Gestion')
          .replace(/\{calendarButtons\}/g, calendarButtonsHTML);

        const textContent = template.text
          .replace(/\{meetingTitle\}/g, meetingData.title)
          .replace(/\{meetingDescription\}/g, meetingData.description || '')
          .replace(/\{meetingLocation\}/g, meetingData.location)
          .replace(/\{meetingDate\}/g, this.formatQuebecDate(meetingData.scheduledDate))
          .replace(/\{organizationName\}/g, meetingData.organizationName || 'Koveo Gestion')
          .replace(/\{calendarInstructions\}/g, calendarInstructionsText);

        try {
          await this.sendMail({
            to: email,
            from: {
              email: this.fromEmail,
              name: this.fromName,
            },
            subject: template.subject.replace(/\{meetingTitle\}/g, meetingData.title),
            html: htmlContent,
            text: textContent,
            attachments: [
              {
                content: Buffer.from(icsContent).toString('base64'),
                filename: 'meeting.ics',
                type: 'text/calendar',
                disposition: 'attachment',
              },
            ],
            trackingSettings: {
              clickTracking: {
                enable: false,
              },
              openTracking: {
                enable: false,
              },
            },
          });

          // console.log(`✅ Meeting invitation sent successfully to ${email}`);
        } catch (error: any) {
          // console.error(`❌ Failed to send meeting invitation to ${email}:`, error);
        }
      }

      return true;
    });
  }

  /**
   * Send combined test email with multiple notification examples
   */
  async sendCombinedTestEmail(
    notificationsData: Array<{ type: string; title: string; message: string }>,
    organizationName: string,
    recipients: Array<{ email: string; name: string; language: 'fr' | 'en' }>
  ): Promise<boolean> {
    return this.executeWithErrorHandling('sendCombinedTestEmail', async () => {
      let allSuccess = true;

      for (const recipient of recipients) {
        const templates = this.getCombinedTestEmailTemplates();
        const template = templates[recipient.language];

        const notificationsHTML = notificationsData
          .map((notification) => {
            return `
              <div style="background: white; padding: 20px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #2563eb;">
                <h3 style="color: #374151; margin: 0 0 10px 0; font-size: 16px;">${notification.title}</h3>
                <p style="color: #6b7280; margin: 0; font-size: 14px;">${notification.message}</p>
              </div>
            `;
          })
          .join('');

        const notificationsText = notificationsData
          .map((notification) => {
            return `${notification.title}\n${notification.message}\n`;
          })
          .join('\n---\n\n');

        const htmlContent = template.html
          .replace(/\{recipientName\}/g, recipient.name)
          .replace(/\{organizationName\}/g, organizationName)
          .replace(/\{notifications\}/g, notificationsHTML)
          .replace(/\{notificationCount\}/g, notificationsData.length.toString());

        const textContent = template.text
          .replace(/\{recipientName\}/g, recipient.name)
          .replace(/\{organizationName\}/g, organizationName)
          .replace(/\{notifications\}/g, notificationsText)
          .replace(/\{notificationCount\}/g, notificationsData.length.toString());

        try {
          await this.sendMail({
            to: recipient.email,
            from: {
              email: this.fromEmail,
              name: this.fromName,
            },
            subject: template.subject.replace(/\{organizationName\}/g, organizationName),
            html: htmlContent,
            text: textContent,
            trackingSettings: {
              clickTracking: {
                enable: false,
              },
              openTracking: {
                enable: false,
              },
            },
          });

          console.log(`✅ Combined test email sent successfully to ${maskEmail(recipient.email)}`);
        } catch (error: any) {
          console.error(`❌ Failed to send combined test email to ${maskEmail(recipient.email)}:`, error);
          console.error(`❌ Error details:`, error.response?.body || error.message);
          allSuccess = false;
        }
      }

      return allSuccess;
    });
  }

  // ====================
  // CALENDAR INTEGRATION
  // ====================

  /**
   * Generate Outlook web calendar links for one-click calendar addition
   */
  generateOutlookWebLink(
    meetingData: MeetingData,
    accountType: 'personal' | 'business' = 'personal'
  ): string {
    const baseUrls = {
      personal: 'https://outlook.live.com/calendar/deeplink/compose',
      business: 'https://outlook.office.com/calendar/deeplink/compose'
    };

    const startDate = new Date(meetingData.scheduledDate);
    const endDate = new Date(startDate.getTime() + (meetingData.duration * 60000));

    const formatDate = (date: Date): string => {
      return date.toISOString();
    };

    let description = meetingData.description || '';
    if (meetingData.organizationName) {
      const orgInfo = `Meeting organized by ${meetingData.organizationName} via Koveo Gestion`;
      description = description ? `${description}\n\n${orgInfo}` : orgInfo;
    }

    const params = new URLSearchParams({
      path: '/calendar/action/compose',
      rru: 'addevent',
      startdt: formatDate(startDate),
      enddt: formatDate(endDate),
      subject: meetingData.title,
      location: meetingData.location,
      allday: 'false'
    });

    if (description) {
      params.append('body', description);
    }

    const fullUrl = `${baseUrls[accountType]}?${params.toString()}`;
    
    // console.log(`📅 Generated ${accountType} Outlook web link for: ${meetingData.title}`);
    return fullUrl;
  }

  /**
   * Generate enhanced .ics content with Outlook-specific optimizations
   */
  generateEnhancedICS(meetingData: MeetingData, language: 'fr' | 'en' = 'fr'): string {
    const uid = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@koveo-gestion.com`;
    
    const startDate = new Date(meetingData.scheduledDate);
    const endDate = new Date(startDate.getTime() + (meetingData.duration * 60000));

    const formatICSDate = (date: Date): string => {
      return date.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}Z/, 'Z');
    };

    const escapeICSText = (text: string): string => {
      return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
    };

    let description = meetingData.description || '';
    if (meetingData.organizationName) {
      const orgInfo = language === 'fr' 
        ? `Réunion organisée par ${meetingData.organizationName} via Koveo Gestion`
        : `Meeting organized by ${meetingData.organizationName} via Koveo Gestion`;
      description = description ? `${description}\n\n${orgInfo}` : orgInfo;
    }

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Koveo Gestion//Meeting Invitation//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VTIMEZONE',
      'TZID:America/Montreal',
      'BEGIN:STANDARD',
      'DTSTART:20071104T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
      'TZNAME:EST',
      'TZOFFSETFROM:-0400',
      'TZOFFSETTO:-0500',
      'END:STANDARD',
      'BEGIN:DAYLIGHT',
      'DTSTART:20070311T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
      'TZNAME:EDT',
      'TZOFFSETFROM:-0500',
      'TZOFFSETTO:-0400',
      'END:DAYLIGHT',
      'END:VTIMEZONE',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART:${formatICSDate(startDate)}`,
      `DTEND:${formatICSDate(endDate)}`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `SUMMARY:${escapeICSText(meetingData.title)}`,
      `DESCRIPTION:${escapeICSText(description)}`,
      `LOCATION:${escapeICSText(meetingData.location)}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'SEQUENCE:0',
      'X-MICROSOFT-CDO-BUSYSTATUS:BUSY',
      'X-MICROSOFT-CDO-IMPORTANCE:1',
      'X-MICROSOFT-DISALLOW-COUNTER:FALSE',
      'CLASS:PUBLIC',
      'PRIORITY:5',
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${language === 'fr' ? 'Rappel: ' : 'Reminder: '}${escapeICSText(meetingData.title)}`,
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    // console.log(`📅 Generated enhanced .ics with Outlook optimizations for: ${meetingData.title}`);
    return icsContent;
  }

  /**
   * Generate all calendar integration options for a meeting
   */
  generateAllCalendarLinks(
    meetingData: MeetingData,
    language: 'fr' | 'en' = 'fr'
  ): CalendarIntegrationLinks {
    return {
      outlookPersonal: this.generateOutlookWebLink(meetingData, 'personal'),
      outlookBusiness: this.generateOutlookWebLink(meetingData, 'business'),
      enhancedICS: this.generateEnhancedICS(meetingData, language)
    };
  }

  /**
   * Generate HTML calendar integration buttons for email templates
   */
  generateCalendarButtonsHTML(
    links: CalendarIntegrationLinks,
    language: 'fr' | 'en' = 'fr'
  ): string {
    const isFrench = language === 'fr';

    return `
    <div style="text-align: center; margin: 30px 0;">
      <h3 style="color: #374151; margin-bottom: 20px;">
        ${isFrench ? 'Ajouter à votre calendrier' : 'Add to Your Calendar'}
      </h3>
      
      <div style="margin: 20px 0;">
        <a href="${links.outlookPersonal}" 
           style="display: inline-block; background-color: #0078d4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 5px; font-weight: 500;">
          📅 ${isFrench ? 'Outlook Personnel' : 'Personal Outlook'}
        </a>
        
        <a href="${links.outlookBusiness}" 
           style="display: inline-block; background-color: #0078d4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 5px; font-weight: 500;">
          🏢 ${isFrench ? 'Outlook Professionnel' : 'Business Outlook'}
        </a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; margin-top: 15px;">
        ${isFrench 
          ? 'Un fichier de calendrier (.ics) est également joint pour une compatibilité maximale avec tous les systèmes de calendrier.'
          : 'A calendar file (.ics) is also attached for maximum compatibility with all calendar systems.'}
      </p>
    </div>
  `;
  }

  /**
   * Generate plain text calendar integration instructions
   */
  generateCalendarInstructionsText(
    links: CalendarIntegrationLinks,
    language: 'fr' | 'en' = 'fr'
  ): string {
    const isFrench = language === 'fr';

    return `
${isFrench ? 'AJOUTER À VOTRE CALENDRIER' : 'ADD TO YOUR CALENDAR'}
${isFrench ? '=========================' : '======================='}

${isFrench ? 'Outlook Personnel:' : 'Personal Outlook:'}
${links.outlookPersonal}

${isFrench ? 'Outlook Professionnel:' : 'Business Outlook:'}
${links.outlookBusiness}

${isFrench 
  ? 'Un fichier de calendrier (.ics) est également joint pour une compatibilité maximale avec tous les systèmes de calendrier.'
  : 'A calendar file (.ics) is also attached for maximum compatibility with all calendar systems.'}
  `;
  }

  // ====================
  // EMAIL AUDIT & MANAGEMENT
  // ====================

  /**
   * Create audit log entry for invitation-related email events
   */
  async createInvitationAuditLog(
    invitationId: string,
    action: string,
    userId: string,
    ipAddress: string,
    userAgent: string,
    previousValue?: string,
    currentValue?: string,
    metadata?: any
  ): Promise<void> {
    try {
      await db.insert(invitationAuditLog).values({
        invitationId,
        action,
        performedBy: userId,
        timestamp: new Date(),
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
        previousValue,
        currentValue,
        metadata: metadata ? JSON.stringify(metadata) : null,
      });
    } catch (error: any) {
      // console.error('❌ Error creating invitation audit log:', error);
    }
  }

  /**
   * Generate and verify unsubscribe tokens
   */
  generateUnsubscribeToken(email: string): string {
    const crypto = require('crypto');
    const secret = process.env.UNSUBSCRIBE_SECRET;
    if (!secret) {
      throw new Error('UNSUBSCRIBE_SECRET environment variable is required for secure token generation');
    }
    return crypto.createHmac('sha256', secret).update(email).digest('hex');
  }

  verifyUnsubscribeToken(email: string, token: string): boolean {
    const expectedToken = this.generateUnsubscribeToken(email);
    return token === expectedToken;
  }

  /**
   * Get available email templates
   */
  getEmailTemplates(): EmailTemplate[] {
    return [
      {
        id: 'invitation',
        name: 'Invitation Email',
        description: 'Email sent when a user is invited to join an organization',
        languages: ['fr', 'en'],
        variables: [
          'recipientName',
          'organizationName',
          'inviterName',
          'invitationUrl',
          'expiryDate',
        ],
      },
      {
        id: 'reminder',
        name: 'Reminder Email',
        description: 'Reminder email for pending invitations',
        languages: ['fr', 'en'],
        variables: ['recipientName', 'organizationName', 'invitationUrl', 'expiryDate'],
      },
      {
        id: 'meeting',
        name: 'Meeting Invitation',
        description: 'Meeting invitation with calendar integration',
        languages: ['fr', 'en'],
        variables: ['meetingTitle', 'meetingDate', 'meetingLocation', 'organizationName'],
      },
      {
        id: 'welcome',
        name: 'Welcome Email',
        description: 'Welcome email sent after successful registration',
        languages: ['fr', 'en'],
        variables: ['recipientName', 'organizationName'],
      },
    ];
  }

  // ====================
  // PRIVATE TEMPLATE METHODS
  // ====================

  private getPasswordResetTemplates() {
    return {
      fr: {
        subject: 'Réinitialisation de votre mot de passe - Koveo Gestion',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Réinitialisation de votre mot de passe</title>
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
              <h1 style="color: #2563eb; margin-bottom: 20px;">Koveo Gestion</h1>
              
              <h2 style="color: #374151;">Réinitialisation de votre mot de passe</h2>
              
              <p>Bonjour {userName},</p>
              
              <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre compte Koveo Gestion.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="{resetUrl}" style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
                  Réinitialiser mon mot de passe
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px;">
                Ce lien expire dans 24 heures pour votre sécurité. Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.
              </p>
              
              <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px; color: #6b7280; font-size: 12px;">
                <p><strong>Koveo Gestion</strong> - Conforme à la Loi 25 du Québec</p>
                <p>Cet email ne fait pas l'objet de suivi pour protéger votre vie privée.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
          Réinitialisation de votre mot de passe - Koveo Gestion
          
          Bonjour {userName},
          
          Vous avez demandé la réinitialisation de votre mot de passe pour votre compte Koveo Gestion.
          
          Cliquez sur le lien suivant pour réinitialiser votre mot de passe :
          {resetUrl}
          
          Ce lien expire dans 24 heures pour votre sécurité. Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.
          
          Koveo Gestion - Conforme à la Loi 25 du Québec
          Cet email ne fait pas l'objet de suivi pour protéger votre vie privée.
        `
      },
      en: {
        subject: 'Password Reset - Koveo Gestion',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Password Reset</title>
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
              <h1 style="color: #2563eb; margin-bottom: 20px;">Koveo Gestion</h1>
              
              <h2 style="color: #374151;">Password Reset</h2>
              
              <p>Hello {userName},</p>
              
              <p>You have requested a password reset for your Koveo Gestion account.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="{resetUrl}" style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
                  Reset My Password
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px;">
                This link expires in 24 hours for your security. If you did not request this reset, you can ignore this email.
              </p>
              
              <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px; color: #6b7280; font-size: 12px;">
                <p><strong>Koveo Gestion</strong> - Quebec Law 25 Compliant</p>
                <p>This email is not tracked to protect your privacy.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
          Password Reset - Koveo Gestion
          
          Hello {userName},
          
          You have requested a password reset for your Koveo Gestion account.
          
          Click the following link to reset your password:
          {resetUrl}
          
          This link expires in 24 hours for your security. If you did not request this reset, you can ignore this email.
          
          Koveo Gestion - Quebec Law 25 Compliant
          This email is not tracked to protect your privacy.
        `
      }
    };
  }

  private getInvitationTemplates() {
    return {
      fr: {
        subject: 'Invitation à rejoindre {organizationName} - Koveo Gestion',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Invitation - Koveo Gestion</title>
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
              <h1 style="color: #2563eb; margin-bottom: 20px;">Koveo Gestion</h1>
              
              <h2 style="color: #374151;">Vous êtes invité à rejoindre {organizationName}</h2>
              
              <p>Bonjour {recipientName},</p>
              
              <p>{inviterName} vous invite à rejoindre {organizationName} sur la plateforme Koveo Gestion.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="{invitationUrl}" style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
                  Accepter l'invitation
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px;">
                Cette invitation expire le {expiryDate}. Si vous ne souhaitez plus recevoir ces emails, <a href="{unsubscribeUrl}">cliquez ici pour vous désabonner</a>.
              </p>
              
              <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px; color: #6b7280; font-size: 12px;">
                <p><strong>Koveo Gestion</strong> - Conforme à la Loi 25 du Québec</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
          Invitation à rejoindre {organizationName} - Koveo Gestion
          
          Bonjour {recipientName},
          
          {inviterName} vous invite à rejoindre {organizationName} sur la plateforme Koveo Gestion.
          
          Cliquez sur le lien suivant pour accepter l'invitation :
          {invitationUrl}
          
          Cette invitation expire le {expiryDate}.
          
          Si vous ne souhaitez plus recevoir ces emails, visitez : {unsubscribeUrl}
          
          Koveo Gestion - Conforme à la Loi 25 du Québec
        `
      },
      en: {
        subject: 'Invitation to join {organizationName} - Koveo Gestion',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Invitation - Koveo Gestion</title>
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
              <h1 style="color: #2563eb; margin-bottom: 20px;">Koveo Gestion</h1>
              
              <h2 style="color: #374151;">You're invited to join {organizationName}</h2>
              
              <p>Hello {recipientName},</p>
              
              <p>{inviterName} has invited you to join {organizationName} on the Koveo Gestion platform.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="{invitationUrl}" style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
                  Accept Invitation
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px;">
                This invitation expires on {expiryDate}. If you no longer wish to receive these emails, <a href="{unsubscribeUrl}">click here to unsubscribe</a>.
              </p>
              
              <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px; color: #6b7280; font-size: 12px;">
                <p><strong>Koveo Gestion</strong> - Quebec Law 25 Compliant</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
          Invitation to join {organizationName} - Koveo Gestion
          
          Hello {recipientName},
          
          {inviterName} has invited you to join {organizationName} on the Koveo Gestion platform.
          
          Click the following link to accept the invitation:
          {invitationUrl}
          
          This invitation expires on {expiryDate}.
          
          If you no longer wish to receive these emails, visit: {unsubscribeUrl}
          
          Koveo Gestion - Quebec Law 25 Compliant
        `
      }
    };
  }

  private getReminderTemplates() {
    return {
      fr: {
        subject: 'Rappel: Invitation en attente - {organizationName}',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Rappel d'invitation</title>
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
              <h1 style="color: #2563eb; margin-bottom: 20px;">Koveo Gestion</h1>
              
              <h2 style="color: #374151;">Rappel: Invitation en attente</h2>
              
              <p>Bonjour {recipientName},</p>
              
              <p>Vous avez une invitation en attente pour rejoindre {organizationName} sur Koveo Gestion.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="{invitationUrl}" style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
                  Accepter l'invitation
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px;">
                Cette invitation expire le {expiryDate}. <a href="{unsubscribeUrl}">Se désabonner</a>.
              </p>
              
              <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px; color: #6b7280; font-size: 12px;">
                <p><strong>Koveo Gestion</strong> - Conforme à la Loi 25 du Québec</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
          Rappel: Invitation en attente - {organizationName}
          
          Bonjour {recipientName},
          
          Vous avez une invitation en attente pour rejoindre {organizationName} sur Koveo Gestion.
          
          Accepter l'invitation: {invitationUrl}
          
          Cette invitation expire le {expiryDate}.
          Se désabonner: {unsubscribeUrl}
          
          Koveo Gestion - Conforme à la Loi 25 du Québec
        `
      },
      en: {
        subject: 'Reminder: Pending Invitation - {organizationName}',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Invitation Reminder</title>
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
              <h1 style="color: #2563eb; margin-bottom: 20px;">Koveo Gestion</h1>
              
              <h2 style="color: #374151;">Reminder: Pending Invitation</h2>
              
              <p>Hello {recipientName},</p>
              
              <p>You have a pending invitation to join {organizationName} on Koveo Gestion.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="{invitationUrl}" style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
                  Accept Invitation
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px;">
                This invitation expires on {expiryDate}. <a href="{unsubscribeUrl}">Unsubscribe</a>.
              </p>
              
              <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px; color: #6b7280; font-size: 12px;">
                <p><strong>Koveo Gestion</strong> - Quebec Law 25 Compliant</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
          Reminder: Pending Invitation - {organizationName}
          
          Hello {recipientName},
          
          You have a pending invitation to join {organizationName} on Koveo Gestion.
          
          Accept invitation: {invitationUrl}
          
          This invitation expires on {expiryDate}.
          Unsubscribe: {unsubscribeUrl}
          
          Koveo Gestion - Quebec Law 25 Compliant
        `
      }
    };
  }

  private getMeetingTemplates() {
    return {
      fr: {
        subject: 'Invitation: {meetingTitle}',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Invitation à une réunion</title>
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
              <h1 style="color: #2563eb; margin-bottom: 20px;">Koveo Gestion</h1>
              
              <h2 style="color: #374151;">Invitation à une réunion</h2>
              
              <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0;">
                <h3>{meetingTitle}</h3>
                <p><strong>Date:</strong> {meetingDate}</p>
                <p><strong>Lieu:</strong> {meetingLocation}</p>
                <p><strong>Description:</strong> {meetingDescription}</p>
              </div>
              
              {calendarButtons}
              
              <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px; color: #6b7280; font-size: 12px;">
                <p><strong>{organizationName}</strong> via Koveo Gestion</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
          Invitation à une réunion - {meetingTitle}
          
          Date: {meetingDate}
          Lieu: {meetingLocation}
          Description: {meetingDescription}
          
          {calendarInstructions}
          
          {organizationName} via Koveo Gestion
        `
      },
      en: {
        subject: 'Meeting Invitation: {meetingTitle}',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Meeting Invitation</title>
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
              <h1 style="color: #2563eb; margin-bottom: 20px;">Koveo Gestion</h1>
              
              <h2 style="color: #374151;">Meeting Invitation</h2>
              
              <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0;">
                <h3>{meetingTitle}</h3>
                <p><strong>Date:</strong> {meetingDate}</p>
                <p><strong>Location:</strong> {meetingLocation}</p>
                <p><strong>Description:</strong> {meetingDescription}</p>
              </div>
              
              {calendarButtons}
              
              <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px; color: #6b7280; font-size: 12px;">
                <p><strong>{organizationName}</strong> via Koveo Gestion</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
          Meeting Invitation: {meetingTitle}
          
          Date: {meetingDate}
          Location: {meetingLocation}
          Description: {meetingDescription}
          
          {calendarInstructions}
          
          {organizationName} via Koveo Gestion
        `
      }
    };
  }

  private getCombinedTestEmailTemplates() {
    return {
      fr: {
        subject: 'Aperçu des notifications - {organizationName}',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Aperçu des notifications</title>
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
              <h1 style="color: #2563eb; margin-bottom: 20px;">Koveo Gestion</h1>
              
              <h2 style="color: #374151;">Aperçu des notifications</h2>
              
              <p>Bonjour {recipientName},</p>
              
              <p>Voici un aperçu de vos {notificationCount} types de notifications activés pour {organizationName}:</p>
              
              {notifications}
              
              <div style="background: #eff6ff; padding: 15px; border-radius: 6px; margin-top: 20px;">
                <p style="color: #1e40af; margin: 0; font-size: 14px;">
                  <strong>Note:</strong> Ceci est un email de test. Les notifications réelles contiendront des informations spécifiques à votre organisation.
                </p>
              </div>
              
              <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px; color: #6b7280; font-size: 12px;">
                <p><strong>{organizationName}</strong> via Koveo Gestion</p>
                <p>Conforme à la Loi 25 du Québec - Cet email ne fait pas l'objet de suivi pour protéger votre vie privée.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
          Aperçu des notifications - {organizationName}
          
          Bonjour {recipientName},
          
          Voici un aperçu de vos {notificationCount} types de notifications activés pour {organizationName}:
          
          {notifications}
          
          Note: Ceci est un email de test. Les notifications réelles contiendront des informations spécifiques à votre organisation.
          
          {organizationName} via Koveo Gestion
          Conforme à la Loi 25 du Québec - Cet email ne fait pas l'objet de suivi pour protéger votre vie privée.
        `
      },
      en: {
        subject: 'Notification Preview - {organizationName}',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Notification Preview</title>
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
              <h1 style="color: #2563eb; margin-bottom: 20px;">Koveo Gestion</h1>
              
              <h2 style="color: #374151;">Notification Preview</h2>
              
              <p>Hello {recipientName},</p>
              
              <p>Here's a preview of your {notificationCount} enabled notification types for {organizationName}:</p>
              
              {notifications}
              
              <div style="background: #eff6ff; padding: 15px; border-radius: 6px; margin-top: 20px;">
                <p style="color: #1e40af; margin: 0; font-size: 14px;">
                  <strong>Note:</strong> This is a test email. Real notifications will contain information specific to your organization.
                </p>
              </div>
              
              <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px; color: #6b7280; font-size: 12px;">
                <p><strong>{organizationName}</strong> via Koveo Gestion</p>
                <p>Quebec Law 25 Compliant - This email is not tracked to protect your privacy.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
          Notification Preview - {organizationName}
          
          Hello {recipientName},
          
          Here's a preview of your {notificationCount} enabled notification types for {organizationName}:
          
          {notifications}
          
          Note: This is a test email. Real notifications will contain information specific to your organization.
          
          {organizationName} via Koveo Gestion
          Quebec Law 25 Compliant - This email is not tracked to protect your privacy.
        `
      }
    };
  }
}

// Export singleton instance
export const communicationService = new ConsolidatedCommunicationService();

// Export backward compatibility aliases
export const notificationService = communicationService;
export const emailService = communicationService;
export const outlookIntegration = communicationService;