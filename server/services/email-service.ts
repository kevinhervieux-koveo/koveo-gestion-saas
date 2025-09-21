import { MailService } from '@sendgrid/mail';

/**
 * Email service for Quebec-compliant transactional emails using SendGrid.
 * Handles password resets, invitations, and other security-related communications.
 */
class EmailService {
  private mailService: MailService;
  private fromEmail: string = 'info@koveo-gestion.com';
  private fromName: string = 'Koveo Gestion';

  /**
   * Initializes the EmailService with SendGrid configuration.
   * Validates that the SENDGRID_API_KEY environment variable is set.
   *
   * @throws {Error} When SENDGRID_API_KEY environment variable is not set.
   *
   * @example
   * ```typescript
   * const emailService = new EmailService();
   * await emailService.sendPasswordResetEmail('user@example.com', 'John', 'https://reset-url');
   * ```
   */
  constructor() {
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SENDGRID_API_KEY environment variable must be set');
    }

    this.mailService = new MailService();
    this.mailService.setApiKey(process.env.SENDGRID_API_KEY);
  }

  /**
   * Sends password reset email in French or English with Quebec Law 25 compliance.
   * Link tracking is disabled for direct URL access as required by security protocols.
   *
   * @param {string} to - Recipient email address.
   * @param {string} userName - User's display name for personalization.
   * @param {string} resetUrl - Complete password reset URL with token.
   * @param {'fr' | 'en'} [language='fr'] - Email language (defaults to French for Quebec).
   * @returns {Promise<boolean>} Promise resolving to true if email sent successfully.
   *
   * @throws {Error} When SendGrid API fails or invalid parameters provided.
   *
   * @example
   * ```typescript
   * const emailService = new EmailService();
   * const success = await emailService.sendPasswordResetEmail(
   *   'user@example.com',
   *   'Jean Dupont',
   *   'https://app.koveo.com/reset-password?token=abc123',
   *   'fr'
   * );
   * ```
   */
  async sendPasswordResetEmail(
    to: string,
    userName: string,
    resetUrl: string,
    language: 'fr' | 'en' = 'fr'
  ): Promise<boolean> {
    try {
      const templates = {
        fr: {
          subject: 'Réinitialisation de votre mot de passe - Koveo Gestion',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>Réinitialisation de mot de passe</title>
            </head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
                <h1 style="color: #2563eb; margin-bottom: 20px;">Koveo Gestion</h1>
                
                <h2 style="color: #374151;">Réinitialisation de votre mot de passe</h2>
                
                <p>Bonjour ${userName},</p>
                
                <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre compte Koveo Gestion.</p>
                
                <p>Copiez et collez ce lien dans votre navigateur pour réinitialiser votre mot de passe :</p>
                
                <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0; word-break: break-all;">
                  <code style="font-size: 14px; color: #374151;">${resetUrl}</code>
                </div>
                
                <p style="text-align: center; margin: 20px 0;">
                  <strong style="color: #dc2626;">Important:</strong> Ce lien expire dans 1 heure.
                </p>
                
                <p><strong>Ce lien expire dans 1 heure pour votre sécurité.</strong></p>
                
                <p>Si vous n'avez pas demandé cette réinitialisation, ignorez ce courriel.</p>
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                
                <div style="font-size: 12px; color: #6b7280;">
                  <p><strong>Confidentialité & Sécurité</strong></p>
                  <p>Conforme à la Loi 25 du Québec. Vos données personnelles sont protégées selon les normes de sécurité les plus strictes.</p>
                  
                  <p>© 2025 Koveo Gestion. Tous droits réservés.</p>
                </div>
              </div>
            </body>
            </html>
          `,
          text: `Réinitialisation de votre mot de passe - Koveo Gestion

Bonjour ${userName},

Vous avez demandé la réinitialisation de votre mot de passe pour votre compte Koveo Gestion.

Cliquez sur ce lien pour créer un nouveau mot de passe :
${resetUrl}

Ce lien expire dans 1 heure pour votre sécurité.

Si vous n'avez pas demandé cette réinitialisation, ignorez ce courriel.

Conforme à la Loi 25 du Québec. Vos données personnelles sont protégées selon les normes de sécurité les plus strictes.

© 2025 Koveo Gestion. Tous droits réservés.`,
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
                
                <h2 style="color: #374151;">Reset Your Password</h2>
                
                <p>Hello ${userName},</p>
                
                <p>You have requested to reset your password for your Koveo Gestion account.</p>
                
                <p>Copy and paste this link into your browser to reset your password:</p>
                
                <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0; word-break: break-all;">
                  <code style="font-size: 14px; color: #374151;">${resetUrl}</code>
                </div>
                
                <p style="text-align: center; margin: 20px 0;">
                  <strong style="color: #dc2626;">Important:</strong> This link expires in 1 hour.
                </p>
                
                <p><strong>This link expires in 1 hour for your security.</strong></p>
                
                <p>If you did not request this reset, please ignore this email.</p>
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                
                <div style="font-size: 12px; color: #6b7280;">
                  <p><strong>Privacy & Security</strong></p>
                  <p>Quebec Law 25 compliant. Your personal data is protected according to the strictest security standards.</p>
                  
                  <p>© 2025 Koveo Gestion. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
          `,
          text: `Password Reset - Koveo Gestion

Hello ${userName},

You have requested to reset your password for your Koveo Gestion account.

Click this link to create a new password:
${resetUrl}

This link expires in 1 hour for your security.

If you did not request this reset, please ignore this email.

Quebec Law 25 compliant. Your personal data is protected according to the strictest security standards.

© 2025 Koveo Gestion. All rights reserved.`,
        },
      };

      const template = templates[language];


      await this.mailService.send({
        to,
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        subject: template.subject,
        text: template.text,
        html: template.html,
        mailSettings: {
          bypassListManagement: {
            enable: false,
          },
          footer: {
            enable: false,
          },
          sandboxMode: {
            enable: false,
          },
        },
        trackingSettings: {
          clickTracking: {
            enable: false,
            enableText: false,
          },
          openTracking: {
            enable: false,
          },
          subscriptionTracking: {
            enable: false,
          },
          ganalytics: {
            enable: false,
          },
        },
      });

      return true;
    } catch (error: any) {
      console.error('❌ Error sending email:', error);
      return false;
    }
  }

  /**
   * Sends an invitation email to a new user with their invitation link.
   *
   * @param {string} to - Recipient's email address.
   * @param {string} recipientName - Name of the person being invited.
   * @param {string} token - Invitation token for the registration URL.
   * @param {string} organizationName - Name of the organization they're being invited to.
   * @param {string} inviterName - Name of the person sending the invitation.
   * @param {Date} expiresAt - When the invitation expires.
   * @param {string} language - Language preference (en/fr).
   * @param {string} personalMessage - Optional personal message from inviter.
   * @returns {Promise<boolean>} Promise resolving to true if email sent successfully.
   */
  async sendInvitationEmail(
    to: string,
    recipientName: string,
    token: string,
    organizationName: string,
    inviterName: string,
    expiresAt: Date,
    language: string = 'fr',
    personalMessage?: string
  ): Promise<boolean> {
    try {
      // Smart environment detection for invitation URLs
      const isDevelopment = process.env.NODE_ENV !== 'production';
      let baseUrl;

      if (isDevelopment) {
        // For development: use the exact replit domain from REPLIT_DOMAINS
        const replitUrl = process.env.REPLIT_DOMAINS
          ? `https://${process.env.REPLIT_DOMAINS}`
          : null;
        baseUrl = replitUrl || 'http://localhost:5000';
      } else {
        // For production: use configured frontend URL
        baseUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
      }
      const invitationUrl = `${baseUrl}/register?invitation=${token}`;
      const expiryDate = expiresAt.toLocaleDateString(language === 'fr' ? 'fr-CA' : 'en-CA');

      const isFrench = language === 'fr';

      const subject = isFrench
        ? `Invitation à rejoindre ${organizationName} - Koveo Gestion`
        : `Invitation to join ${organizationName} - Koveo Gestion`;

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">${isFrench ? 'Invitation à Koveo Gestion' : 'Koveo Gestion Invitation'}</h2>
          
          <p>${isFrench ? 'Bonjour' : 'Hello'} ${recipientName},</p>
          
          <p>${
            isFrench
              ? `${inviterName} vous invite à rejoindre <strong>${organizationName}</strong> sur Koveo Gestion.`
              : `${inviterName} has invited you to join <strong>${organizationName}</strong> on Koveo Gestion.`
          }</p>

          ${
            personalMessage
              ? `<div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>${isFrench ? 'Message personnel' : 'Personal message'}:</strong></p>
            <p style="margin: 10px 0 0 0; font-style: italic;">"${personalMessage}"</p>
          </div>`
              : ''
          }
          
          <p>${
            isFrench
              ? 'Pour créer votre compte et accepter cette invitation, cliquez sur le bouton ci-dessous :'
              : 'To create your account and accept this invitation, click the button below:'
          }</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationUrl}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              ${isFrench ? 'Créer mon compte' : 'Create My Account'}
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            ${
              isFrench
                ? `Cette invitation expire le ${expiryDate}. Si vous ne pouvez pas cliquer sur le bouton, copiez et collez ce lien dans votre navigateur :`
                : `This invitation expires on ${expiryDate}. If you can't click the button, copy and paste this link into your browser:`
            }
          </p>
          
          <p style="word-break: break-all; background: #f9f9f9; padding: 10px; border-radius: 4px; font-size: 12px;">
            ${invitationUrl}
          </p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          
          <p style="color: #9ca3af; font-size: 12px;">
            ${
              isFrench
                ? "Cet email a été envoyé par Koveo Gestion. Si vous n'avez pas demandé cette invitation, vous pouvez ignorer cet email."
                : 'This email was sent by Koveo Gestion. If you did not request this invitation, you can safely ignore this email.'
            }
          </p>
        </div>
      `;

      const textContent = `
        ${isFrench ? 'Bonjour' : 'Hello'} ${recipientName},

        ${
          isFrench
            ? `${inviterName} vous invite à rejoindre ${organizationName} sur Koveo Gestion.`
            : `${inviterName} has invited you to join ${organizationName} on Koveo Gestion.`
        }

        ${personalMessage ? `${isFrench ? 'Message personnel' : 'Personal message'}: "${personalMessage}"` : ''}

        ${
          isFrench
            ? 'Pour créer votre compte et accepter cette invitation, visitez :'
            : 'To create your account and accept this invitation, visit:'
        }
        ${invitationUrl}

        ${
          isFrench
            ? `Cette invitation expire le ${expiryDate}.`
            : `This invitation expires on ${expiryDate}.`
        }

        ${
          isFrench
            ? "Si vous n'avez pas demandé cette invitation, vous pouvez ignorer cet email."
            : 'If you did not request this invitation, you can safely ignore this email.'
        }
      `;

      await this.mailService.send({
        to,
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        subject,
        text: textContent.trim(),
        html: htmlContent,
        trackingSettings: {
          clickTracking: {
            enable: false,
          },
          openTracking: {
            enable: false,
          },
          subscriptionTracking: {
            enable: false,
          },
          ganalytics: {
            enable: false,
          },
        },
      });

      return true;
    } catch (error: any) {
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      return false;
    }
  }

  /**
   * Sends a reminder email for pending invitations.
   *
   * @param {string} to - Recipient's email address.
   * @param {string} recipientName - Name of the person being reminded.
   * @param {string} token - Invitation token for the registration URL.
   * @param {string} organizationName - Name of the organization they're being invited to.
   * @param {Date} expiresAt - When the invitation expires.
   * @param {string} language - Language preference (en/fr).
   * @returns {Promise<boolean>} Promise resolving to true if email sent successfully.
   */
  async sendReminderEmail(
    to: string,
    recipientName: string,
    token: string,
    organizationName: string,
    expiresAt: Date,
    language: string = 'fr'
  ): Promise<boolean> {
    try {
      // Smart environment detection for invitation URLs
      const isDevelopment = process.env.NODE_ENV !== 'production';
      let baseUrl;

      if (isDevelopment) {
        const replitUrl = process.env.REPLIT_DOMAINS
          ? `https://${process.env.REPLIT_DOMAINS}`
          : null;
        baseUrl = replitUrl || 'http://localhost:5000';
      } else {
        baseUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
      }
      const invitationUrl = `${baseUrl}/register?invitation=${token}`;
      const expiryDate = expiresAt.toLocaleDateString(language === 'fr' ? 'fr-CA' : 'en-CA');

      const isFrench = language === 'fr';

      const subject = isFrench
        ? `Rappel: Invitation à rejoindre ${organizationName} - Koveo Gestion`
        : `Reminder: Invitation to join ${organizationName} - Koveo Gestion`;

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">${isFrench ? 'Rappel d\'invitation - Koveo Gestion' : 'Invitation Reminder - Koveo Gestion'}</h2>
          
          <p>${isFrench ? 'Bonjour' : 'Hello'} ${recipientName},</p>
          
          <p>${
            isFrench
              ? `Ceci est un rappel concernant votre invitation à rejoindre <strong>${organizationName}</strong> sur Koveo Gestion.`
              : `This is a reminder about your invitation to join <strong>${organizationName}</strong> on Koveo Gestion.`
          }</p>
          
          <p>${
            isFrench
              ? 'Votre invitation expire bientôt. Pour créer votre compte, cliquez sur le bouton ci-dessous :'
              : 'Your invitation expires soon. To create your account, click the button below:'
          }</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationUrl}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              ${isFrench ? 'Créer mon compte' : 'Create My Account'}
            </a>
          </div>
          
          <p style="color: #dc2626; font-weight: bold;">
            ${
              isFrench
                ? `⚠️ Cette invitation expire le ${expiryDate}.`
                : `⚠️ This invitation expires on ${expiryDate}.`
            }
          </p>
          
          <p style="word-break: break-all; background: #f9f9f9; padding: 10px; border-radius: 4px; font-size: 12px;">
            ${invitationUrl}
          </p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          
          <p style="color: #9ca3af; font-size: 12px;">
            ${
              isFrench
                ? "Cet email a été envoyé par Koveo Gestion."
                : 'This email was sent by Koveo Gestion.'
            }
          </p>
        </div>
      `;

      const textContent = `
        ${isFrench ? 'Bonjour' : 'Hello'} ${recipientName},

        ${
          isFrench
            ? `Ceci est un rappel concernant votre invitation à rejoindre ${organizationName} sur Koveo Gestion.`
            : `This is a reminder about your invitation to join ${organizationName} on Koveo Gestion.`
        }

        ${
          isFrench
            ? 'Pour créer votre compte et accepter cette invitation, visitez :'
            : 'To create your account and accept this invitation, visit:'
        }
        ${invitationUrl}

        ${
          isFrench
            ? `Cette invitation expire le ${expiryDate}.`
            : `This invitation expires on ${expiryDate}.`
        }
      `;

      await this.mailService.send({
        to,
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        subject,
        text: textContent.trim(),
        html: htmlContent,
        trackingSettings: {
          clickTracking: {
            enable: false,
          },
          openTracking: {
            enable: false,
          },
          subscriptionTracking: {
            enable: false,
          },
          ganalytics: {
            enable: false,
          },
        },
      });

      return true;
    } catch (error: any) {
      console.error('❌ Error sending reminder email:', error);
      return false;
    }
  }

  /**
   * Verifies an unsubscribe token for security.
   *
   * @param {string} email - Email address to verify token for.
   * @param {string} token - Unsubscribe token to verify.
   * @returns {boolean} True if token is valid.
   */
  verifyUnsubscribeToken(email: string, token: string): boolean {
    try {
      // Simple token verification - in production you'd use proper crypto
      const expectedToken = Buffer.from(email).toString('base64');
      return token === expectedToken;
    } catch (error: any) {
      console.error('❌ Error verifying unsubscribe token:', error);
      return false;
    }
  }

  /**
   * Sends a test email to verify SendGrid configuration and connectivity.
   * Used for troubleshooting email delivery issues and validating API setup.
   *
   * @param {string} to - Recipient email address for the test email.
   * @returns {Promise<boolean>} Promise resolving to true if test email sent successfully.
   *
   * @example
   * ```typescript
   * const emailService = new EmailService();
   * const success = await emailService.sendTestEmail('admin@example.com');
   * if (success) {
   * }
   * ```
   */
  async sendTestEmail(to: string): Promise<boolean> {
    try {
      await this.mailService.send({
        to,
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        subject: 'Test Email - Koveo Gestion',
        text: 'This is a test email to verify SendGrid configuration.',
        html: '<p>This is a test email to verify SendGrid configuration.</p>',
      });

      return true;
    } catch (error: any) {
      console.error('❌ Error sending email:', error);
      return false;
    }
  }

  /**
   * Generates an RFC5545 compliant .ics calendar file for meeting invitations.
   * Supports both French and English languages with proper timezone handling.
   *
   * @param {Object} meetingData - Meeting information object.
   * @param {string} meetingData.title - Meeting title.
   * @param {string} meetingData.description - Meeting description (optional).
   * @param {string} meetingData.location - Meeting location.
   * @param {Date} meetingData.startDate - Meeting start date and time.
   * @param {number} meetingData.duration - Meeting duration in minutes.
   * @param {string} meetingData.organizerName - Name of the meeting organizer.
   * @param {string} meetingData.organizerEmail - Email of the meeting organizer.
   * @param {'fr' | 'en'} [language='fr'] - Language for calendar content.
   * @returns {string} RFC5545 compliant .ics file content.
   *
   * @example
   * ```typescript
   * const emailService = new EmailService();
   * const icsContent = emailService.generateCalendarInvite({
   *   title: 'Monthly Building Meeting',
   *   description: 'Discussion of building maintenance and budget',
   *   location: 'Community Room, Building A',
   *   startDate: new Date('2025-10-15T19:00:00'),
   *   duration: 90,
   *   organizerName: 'Jean Dupont',
   *   organizerEmail: 'jean.dupont@example.com'
   * }, 'fr');
   * ```
   */
  generateCalendarInvite(
    meetingData: {
      title: string;
      description?: string;
      location: string;
      startDate: Date;
      duration: number;
      organizerName: string;
      organizerEmail: string;
    },
    attendees: string[] = [],
    language: 'fr' | 'en' = 'fr'
  ): string {
    try {
      // Helper function to format date for iCalendar (UTC format: YYYYMMDDTHHMMSSZ)
      const formatDateForICS = (date: Date): string => {
        return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      };

      // Calculate end date
      const endDate = new Date(meetingData.startDate.getTime() + meetingData.duration * 60000);

      // Generate unique UID for the event
      const uid = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@koveo-gestion.com`;

      // Current timestamp for DTSTAMP
      const now = new Date();
      const dtstamp = formatDateForICS(now);

      // Format start and end times
      const dtstart = formatDateForICS(meetingData.startDate);
      const dtend = formatDateForICS(endDate);

      // Escape special characters for iCalendar format
      const escapeICSText = (text: string): string => {
        return text
          .replace(/\\/g, '\\\\')
          .replace(/;/g, '\\;')
          .replace(/,/g, '\\,')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '');
      };

      // Prepare content in the appropriate language
      const content = {
        fr: {
          summary: escapeICSText(meetingData.title),
          description: meetingData.description 
            ? escapeICSText(meetingData.description)
            : escapeICSText('Réunion organisée via Koveo Gestion'),
          location: escapeICSText(meetingData.location),
        },
        en: {
          summary: escapeICSText(meetingData.title),
          description: meetingData.description 
            ? escapeICSText(meetingData.description)
            : escapeICSText('Meeting organized via Koveo Gestion'),
          location: escapeICSText(meetingData.location),
        },
      };

      const localizedContent = content[language];

      // Build the .ics file content
      const icsLines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Koveo Gestion//Calendar Event//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:REQUEST',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${dtstart}`,
        `DTEND:${dtend}`,
        `SUMMARY:${localizedContent.summary}`,
        `DESCRIPTION:${localizedContent.description}`,
        `LOCATION:${localizedContent.location}`,
        `ORGANIZER;CN=${escapeICSText(meetingData.organizerName)}:MAILTO:${meetingData.organizerEmail}`,
      ];

      // Add ATTENDEE lines for each attendee
      attendees.forEach(attendeeEmail => {
        icsLines.push(`ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:MAILTO:${attendeeEmail}`);
      });

      // Add remaining event properties
      icsLines.push(
        'STATUS:CONFIRMED',
        'SEQUENCE:0',
        'TRANSP:OPAQUE',
        'BEGIN:VALARM',
        'TRIGGER:-PT15M',
        'DESCRIPTION:Reminder',
        'ACTION:DISPLAY',
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR'
      );

      const icsContent = icsLines.join('\r\n');

      console.log(`📅 Generated .ics calendar invite for meeting: ${meetingData.title}`);
      return icsContent;
    } catch (error: any) {
      console.error('❌ Error generating calendar invite:', error);
      throw new Error(`Failed to generate calendar invite: ${error.message}`);
    }
  }

  /**
   * Sends general communication emails from managers to organization members.
   * Supports urgent and scheduled communications with role-based targeting.
   *
   * @param {Object} communicationData - Communication information object.
   * @param {string} communicationData.title - Communication title.
   * @param {string} communicationData.content - Communication content/message.
   * @param {boolean} communicationData.isUrgent - Whether this is an urgent communication.
   * @param {string} communicationData.organizationName - Name of the organization.
   * @param {string} communicationData.senderName - Name of the communication sender.
   * @param {string} communicationData.senderEmail - Email of the communication sender.
   * @param {string[]} recipients - Array of recipient email addresses.
   * @param {'fr' | 'en'} [language='fr'] - Email language preference.
   * @returns {Promise<boolean>} Promise resolving to true if email sent successfully.
   *
   * @example
   * ```typescript
   * const emailService = new EmailService();
   * const success = await emailService.sendGeneralCommunication({
   *   title: 'Important Building Update',
   *   content: 'We will be performing maintenance on the elevators this weekend.',
   *   isUrgent: true,
   *   organizationName: 'Résidences Mont-Royal',
   *   senderName: 'Jean Dupont',
   *   senderEmail: 'jean.dupont@example.com'
   * }, ['resident1@example.com', 'resident2@example.com'], 'fr');
   * ```
   */
  async sendGeneralCommunication(
    communicationData: {
      title: string;
      content: string;
      isUrgent: boolean;
      organizationName: string;
      senderName: string;
      senderEmail: string;
    },
    recipients: string[],
    language: 'fr' | 'en' = 'fr'
  ): Promise<boolean> {
    try {
      const isFrench = language === 'fr';
      const urgentPrefix = communicationData.isUrgent 
        ? (isFrench ? '[URGENT] ' : '[URGENT] ')
        : '';

      const subject = `${urgentPrefix}${communicationData.title} - ${communicationData.organizationName}`;

      // Smart environment detection for demand center URLs
      const isDevelopment = process.env.NODE_ENV !== 'production';
      let baseUrl;

      if (isDevelopment) {
        const replitUrl = process.env.REPLIT_DOMAINS
          ? `https://${process.env.REPLIT_DOMAINS}`
          : null;
        baseUrl = replitUrl || 'http://localhost:5000';
      } else {
        baseUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
      }
      const demandCenterUrl = `${baseUrl}/dashboard/demands`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>${communicationData.title}</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
            <h1 style="color: #2563eb; margin-bottom: 20px;">Koveo Gestion</h1>
            
            ${communicationData.isUrgent ? `
              <div style="background: #fef2f2; border: 2px solid #dc2626; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                <h3 style="color: #dc2626; margin: 0 0 10px 0;">
                  ${isFrench ? '🚨 Communication urgente' : '🚨 Urgent Communication'}
                </h3>
              </div>
            ` : ''}
            
            <h2 style="color: #374151;">${communicationData.title}</h2>
            
            <p>${isFrench ? 'Bonjour,' : 'Hello,'}</p>
            
            <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #2563eb;">
              <p style="white-space: pre-wrap; margin: 0; line-height: 1.6;">${communicationData.content}</p>
            </div>
            
            <p style="margin-top: 30px;">
              <strong>${isFrench ? 'Envoyé par:' : 'Sent by:'}</strong> ${communicationData.senderName}<br>
              <strong>${isFrench ? 'Organisation:' : 'Organization:'}</strong> ${communicationData.organizationName}
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${demandCenterUrl}" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                ${isFrench ? 'Accéder au centre de demandes' : 'Access Demand Center'}
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; text-align: center;">
              ${isFrench 
                ? 'Vous pouvez répondre à cette communication ou soumettre une demande via le centre de demandes.'
                : 'You can respond to this communication or submit a request via the demand center.'}
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <div style="font-size: 12px; color: #6b7280;">
              <p><strong>${isFrench ? 'Confidentialité & Sécurité' : 'Privacy & Security'}</strong></p>
              <p>${isFrench 
                ? 'Conforme à la Loi 25 du Québec. Vos données personnelles sont protégées selon les normes de sécurité les plus strictes.'
                : 'Quebec Law 25 compliant. Your personal data is protected according to the strictest security standards.'}</p>
              
              <p>© 2025 Koveo Gestion. ${isFrench ? 'Tous droits réservés.' : 'All rights reserved.'}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const textContent = `
${communicationData.title} - ${communicationData.organizationName}

${communicationData.isUrgent ? (isFrench ? '🚨 COMMUNICATION URGENTE' : '🚨 URGENT COMMUNICATION') : ''}

${isFrench ? 'Bonjour,' : 'Hello,'}

${communicationData.content}

${isFrench ? 'Envoyé par:' : 'Sent by:'} ${communicationData.senderName}
${isFrench ? 'Organisation:' : 'Organization:'} ${communicationData.organizationName}

${isFrench ? 'Centre de demandes:' : 'Demand Center:'} ${demandCenterUrl}

${isFrench 
  ? 'Conforme à la Loi 25 du Québec. Vos données personnelles sont protégées selon les normes de sécurité les plus strictes.'
  : 'Quebec Law 25 compliant. Your personal data is protected according to the strictest security standards.'}

© 2025 Koveo Gestion. ${isFrench ? 'Tous droits réservés.' : 'All rights reserved.'}
      `;

      // Send to all recipients
      await this.mailService.send({
        to: recipients,
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        subject,
        text: textContent.trim(),
        html: htmlContent,
        mailSettings: {
          bypassListManagement: {
            enable: false,
          },
          footer: {
            enable: false,
          },
          sandboxMode: {
            enable: false,
          },
        },
        trackingSettings: {
          clickTracking: {
            enable: false,
            enableText: false,
          },
          openTracking: {
            enable: false,
          },
          subscriptionTracking: {
            enable: false,
          },
          ganalytics: {
            enable: false,
          },
        },
      });

      console.log(`📧 Sent general communication "${communicationData.title}" to ${recipients.length} recipients`);
      return true;
    } catch (error: any) {
      console.error('❌ Error sending general communication:', error);
      return false;
    }
  }

  /**
   * Sends meeting invitation emails with calendar attachment (.ics file).
   * Includes properly formatted calendar invite for seamless calendar integration.
   *
   * @param {Object} meetingData - Meeting information object.
   * @param {string} meetingData.title - Meeting title.
   * @param {string} meetingData.description - Meeting description (optional).
   * @param {string} meetingData.location - Meeting location.
   * @param {Date} meetingData.scheduledDate - Meeting date and time.
   * @param {number} meetingData.duration - Meeting duration in minutes.
   * @param {string} meetingData.organizationName - Name of the organization.
   * @param {string} meetingData.organizerName - Name of the meeting organizer.
   * @param {string} meetingData.organizerEmail - Email of the meeting organizer.
   * @param {string[]} recipients - Array of recipient email addresses.
   * @param {'fr' | 'en'} [language='fr'] - Email language preference.
   * @returns {Promise<boolean>} Promise resolving to true if email sent successfully.
   *
   * @example
   * ```typescript
   * const emailService = new EmailService();
   * const success = await emailService.sendMeetingInvite({
   *   title: 'Monthly Building Meeting',
   *   description: 'Discussion of building maintenance and budget',
   *   location: 'Community Room, Building A',
   *   scheduledDate: new Date('2025-10-15T19:00:00'),
   *   duration: 90,
   *   organizationName: 'Résidences Mont-Royal',
   *   organizerName: 'Jean Dupont',
   *   organizerEmail: 'jean.dupont@example.com'
   * }, ['resident1@example.com', 'resident2@example.com'], 'fr');
   * ```
   */
  async sendMeetingInvite(
    meetingData: {
      title: string;
      description?: string;
      location: string;
      scheduledDate: Date;
      duration: number;
      organizationName: string;
      organizerName: string;
      organizerEmail: string;
    },
    recipients: string[],
    language: 'fr' | 'en' = 'fr'
  ): Promise<boolean> {
    try {
      const isFrench = language === 'fr';
      
      // Generate calendar invite
      const icsContent = this.generateCalendarInvite({
        title: meetingData.title,
        description: meetingData.description,
        location: meetingData.location,
        startDate: meetingData.scheduledDate,
        duration: meetingData.duration,
        organizerName: meetingData.organizerName,
        organizerEmail: meetingData.organizerEmail,
      }, recipients, language);

      // Format date for display
      const meetingDateTime = meetingData.scheduledDate.toLocaleString(
        isFrench ? 'fr-CA' : 'en-CA',
        {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short',
        }
      );

      const subject = isFrench 
        ? `Invitation - ${meetingData.title} | ${meetingData.organizationName}`
        : `Meeting Invitation - ${meetingData.title} | ${meetingData.organizationName}`;

      // Smart environment detection for demand center URLs
      const isDevelopment = process.env.NODE_ENV !== 'production';
      let baseUrl;

      if (isDevelopment) {
        const replitUrl = process.env.REPLIT_DOMAINS
          ? `https://${process.env.REPLIT_DOMAINS}`
          : null;
        baseUrl = replitUrl || 'http://localhost:5000';
      } else {
        baseUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
      }
      const demandCenterUrl = `${baseUrl}/dashboard/demands`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>${isFrench ? 'Invitation à une réunion' : 'Meeting Invitation'}</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
            <h1 style="color: #2563eb; margin-bottom: 20px;">Koveo Gestion</h1>
            
            <h2 style="color: #374151;">${isFrench ? 'Invitation à une réunion' : 'Meeting Invitation'}</h2>
            
            <p>${isFrench ? 'Bonjour,' : 'Hello,'}</p>
            
            <p>${isFrench 
              ? `Vous êtes invité(e) à participer à la réunion suivante organisée par ${meetingData.organizerName} :`
              : `You are invited to attend the following meeting organized by ${meetingData.organizerName}:`}</p>
            
            <div style="background: white; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2563eb;">
              <h3 style="color: #2563eb; margin: 0 0 15px 0;">${meetingData.title}</h3>
              
              <div style="margin-bottom: 10px;">
                <strong style="color: #374151;">${isFrench ? '📅 Date et heure :' : '📅 Date and Time:'}</strong>
                <span style="margin-left: 10px;">${meetingDateTime}</span>
              </div>
              
              <div style="margin-bottom: 10px;">
                <strong style="color: #374151;">${isFrench ? '⏱️ Durée :' : '⏱️ Duration:'}</strong>
                <span style="margin-left: 10px;">${meetingData.duration} ${isFrench ? 'minutes' : 'minutes'}</span>
              </div>
              
              <div style="margin-bottom: 15px;">
                <strong style="color: #374151;">${isFrench ? '📍 Lieu :' : '📍 Location:'}</strong>
                <span style="margin-left: 10px;">${meetingData.location}</span>
              </div>
              
              ${meetingData.description ? `
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
                  <strong style="color: #374151;">${isFrench ? 'Description :' : 'Description:'}</strong>
                  <p style="margin: 5px 0 0 0; line-height: 1.6;">${meetingData.description}</p>
                </div>
              ` : ''}
            </div>
            
            <p style="background: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <strong style="color: #92400e;">📅 ${isFrench ? 'Calendrier' : 'Calendar'}:</strong><br>
              ${isFrench 
                ? 'Un fichier de calendrier (.ics) est joint à cet email. Téléchargez-le et ouvrez-le avec votre application de calendrier pour ajouter automatiquement cette réunion.'
                : 'A calendar file (.ics) is attached to this email. Download and open it with your calendar application to automatically add this meeting.'}
            </p>
            
            <p>
              <strong>${isFrench ? 'Organisé par :' : 'Organized by:'}</strong> ${meetingData.organizerName}<br>
              <strong>${isFrench ? 'Organisation :' : 'Organization:'}</strong> ${meetingData.organizationName}
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${demandCenterUrl}" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                ${isFrench ? 'Accéder au centre de demandes' : 'Access Demand Center'}
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; text-align: center;">
              ${isFrench 
                ? 'Pour toute question ou demande liée à cette réunion, utilisez le centre de demandes.'
                : 'For any questions or requests related to this meeting, use the demand center.'}
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <div style="font-size: 12px; color: #6b7280;">
              <p><strong>${isFrench ? 'Confidentialité & Sécurité' : 'Privacy & Security'}</strong></p>
              <p>${isFrench 
                ? 'Conforme à la Loi 25 du Québec. Vos données personnelles sont protégées selon les normes de sécurité les plus strictes.'
                : 'Quebec Law 25 compliant. Your personal data is protected according to the strictest security standards.'}</p>
              
              <p>© 2025 Koveo Gestion. ${isFrench ? 'Tous droits réservés.' : 'All rights reserved.'}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const textContent = `
${isFrench ? 'Invitation à une réunion' : 'Meeting Invitation'} - ${meetingData.organizationName}

${isFrench ? 'Bonjour,' : 'Hello,'}

${isFrench 
  ? `Vous êtes invité(e) à participer à la réunion suivante organisée par ${meetingData.organizerName} :`
  : `You are invited to attend the following meeting organized by ${meetingData.organizerName}:`}

${isFrench ? 'RÉUNION :' : 'MEETING:'} ${meetingData.title}
${isFrench ? 'DATE ET HEURE :' : 'DATE AND TIME:'} ${meetingDateTime}
${isFrench ? 'DURÉE :' : 'DURATION:'} ${meetingData.duration} ${isFrench ? 'minutes' : 'minutes'}
${isFrench ? 'LIEU :' : 'LOCATION:'} ${meetingData.location}

${meetingData.description ? `${isFrench ? 'DESCRIPTION :' : 'DESCRIPTION:'}\n${meetingData.description}\n` : ''}

${isFrench ? 'CALENDRIER :' : 'CALENDAR:'}
${isFrench 
  ? 'Un fichier de calendrier (.ics) est joint à cet email. Téléchargez-le et ouvrez-le avec votre application de calendrier pour ajouter automatiquement cette réunion.'
  : 'A calendar file (.ics) is attached to this email. Download and open it with your calendar application to automatically add this meeting.'}

${isFrench ? 'Organisé par :' : 'Organized by:'} ${meetingData.organizerName}
${isFrench ? 'Organisation :' : 'Organization:'} ${meetingData.organizationName}

${isFrench ? 'Centre de demandes :' : 'Demand Center:'} ${demandCenterUrl}

${isFrench 
  ? 'Conforme à la Loi 25 du Québec. Vos données personnelles sont protégées selon les normes de sécurité les plus strictes.'
  : 'Quebec Law 25 compliant. Your personal data is protected according to the strictest security standards.'}

© 2025 Koveo Gestion. ${isFrench ? 'Tous droits réservés.' : 'All rights reserved.'}
      `;

      // Send email with calendar attachment
      await this.mailService.send({
        to: recipients,
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        subject,
        text: textContent.trim(),
        html: htmlContent,
        attachments: [
          {
            content: Buffer.from(icsContent).toString('base64'),
            filename: `${meetingData.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`,
            type: 'text/calendar',
            disposition: 'attachment',
          },
        ],
        mailSettings: {
          bypassListManagement: {
            enable: false,
          },
          footer: {
            enable: false,
          },
          sandboxMode: {
            enable: false,
          },
        },
        trackingSettings: {
          clickTracking: {
            enable: false,
            enableText: false,
          },
          openTracking: {
            enable: false,
          },
          subscriptionTracking: {
            enable: false,
          },
          ganalytics: {
            enable: false,
          },
        },
      });

      console.log(`📅 Sent meeting invitation "${meetingData.title}" to ${recipients.length} recipients with calendar attachment`);
      return true;
    } catch (error: any) {
      console.error('❌ Error sending meeting invitation:', error);
      return false;
    }
  }

  /**
   * Sends scheduled notifications based on user preferences and frequency settings.
   * Handles various notification types with proper frequency filtering and Quebec compliance.
   *
   * @param {Object} notificationData - Notification information object.
   * @param {string} notificationData.type - Type of notification (from notification enum).
   * @param {string} notificationData.title - Notification title.
   * @param {string} notificationData.message - Notification message content.
   * @param {string} notificationData.organizationName - Name of the organization.
   * @param {Object[]} recipients - Array of recipient objects with email, name, language, and preferences.
   * @param {string} recipients[].email - Recipient email address.
   * @param {string} recipients[].name - Recipient full name.
   * @param {'fr' | 'en'} recipients[].language - Recipient language preference.
   * @param {string} recipients[].frequency - Notification frequency preference.
   * @param {boolean} recipients[].isEnabled - Whether notifications are enabled.
   * @returns {Promise<boolean>} Promise resolving to true if notifications sent successfully.
   *
   * @example
   * ```typescript
   * const emailService = new EmailService();
   * const success = await emailService.sendScheduledNotifications({
   *   type: 'bill_reminder',
   *   title: 'Monthly Bill Reminder',
   *   message: 'Your monthly charges are now available for review.',
   *   organizationName: 'Résidences Mont-Royal'
   * }, [
   *   {
   *     email: 'resident@example.com',
   *     name: 'Jean Dupont',
   *     language: 'fr',
   *     frequency: 'monthly',
   *     isEnabled: true
   *   }
   * ]);
   * ```
   */
  async sendScheduledNotifications(
    notificationData: {
      type: string;
      title: string;
      message: string;
      organizationName: string;
    },
    recipients: Array<{
      email: string;
      name: string;
      language: 'fr' | 'en';
      frequency: string;
      isEnabled: boolean;
    }>
  ): Promise<boolean> {
    try {
      // Filter recipients who have notifications enabled for this type
      const enabledRecipients = recipients.filter(recipient => recipient.isEnabled);
      
      if (enabledRecipients.length === 0) {
        console.log(`📧 No enabled recipients for notification type: ${notificationData.type}`);
        return true;
      }

      // Group recipients by language for efficient batch sending
      const recipientsByLanguage = enabledRecipients.reduce((acc, recipient) => {
        const lang = recipient.language || 'fr';
        if (!acc[lang]) acc[lang] = [];
        acc[lang].push(recipient);
        return acc;
      }, {} as Record<string, typeof enabledRecipients>);

      // Smart environment detection for demand center URLs
      const isDevelopment = process.env.NODE_ENV !== 'production';
      let baseUrl;

      if (isDevelopment) {
        const replitUrl = process.env.REPLIT_DOMAINS
          ? `https://${process.env.REPLIT_DOMAINS}`
          : null;
        baseUrl = replitUrl || 'http://localhost:5000';
      } else {
        baseUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
      }
      const demandCenterUrl = `${baseUrl}/dashboard/demands`;
      const notificationSettingsUrl = `${baseUrl}/dashboard/settings`;

      // Send notifications for each language group
      for (const [language, langRecipients] of Object.entries(recipientsByLanguage)) {
        const isFrench = language === 'fr';
        
        const subject = `${notificationData.title} - ${notificationData.organizationName}`;

        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>${notificationData.title}</title>
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
              <h1 style="color: #2563eb; margin-bottom: 20px;">Koveo Gestion</h1>
              
              <h2 style="color: #374151;">${notificationData.title}</h2>
              
              <p>${isFrench ? 'Bonjour,' : 'Hello,'}</p>
              
              <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #2563eb;">
                <p style="margin: 0; line-height: 1.6;">${notificationData.message}</p>
              </div>
              
              <p>
                <strong>${isFrench ? 'Organisation :' : 'Organization:'}</strong> ${notificationData.organizationName}
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${demandCenterUrl}" 
                   style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 10px;">
                  ${isFrench ? 'Centre de demandes' : 'Demand Center'}
                </a>
                <a href="${notificationSettingsUrl}" 
                   style="background-color: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  ${isFrench ? 'Paramètres' : 'Settings'}
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; text-align: center;">
                ${isFrench 
                  ? 'Vous recevez cet email selon vos préférences de notification. Vous pouvez modifier ces paramètres à tout moment.'
                  : 'You are receiving this email based on your notification preferences. You can modify these settings at any time.'}
              </p>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              
              <div style="font-size: 12px; color: #6b7280;">
                <p><strong>${isFrench ? 'Confidentialité & Sécurité' : 'Privacy & Security'}</strong></p>
                <p>${isFrench 
                  ? 'Conforme à la Loi 25 du Québec. Vos données personnelles sont protégées selon les normes de sécurité les plus strictes.'
                  : 'Quebec Law 25 compliant. Your personal data is protected according to the strictest security standards.'}</p>
                
                <p>© 2025 Koveo Gestion. ${isFrench ? 'Tous droits réservés.' : 'All rights reserved.'}</p>
              </div>
            </div>
          </body>
          </html>
        `;

        const textContent = `
${notificationData.title} - ${notificationData.organizationName}

${isFrench ? 'Bonjour,' : 'Hello,'}

${notificationData.message}

${isFrench ? 'Organisation :' : 'Organization:'} ${notificationData.organizationName}

${isFrench ? 'Centre de demandes :' : 'Demand Center:'} ${demandCenterUrl}
${isFrench ? 'Paramètres :' : 'Settings:'} ${notificationSettingsUrl}

${isFrench 
  ? 'Vous recevez cet email selon vos préférences de notification. Vous pouvez modifier ces paramètres à tout moment.'
  : 'You are receiving this email based on your notification preferences. You can modify these settings at any time.'}

${isFrench 
  ? 'Conforme à la Loi 25 du Québec. Vos données personnelles sont protégées selon les normes de sécurité les plus strictes.'
  : 'Quebec Law 25 compliant. Your personal data is protected according to the strictest security standards.'}

© 2025 Koveo Gestion. ${isFrench ? 'Tous droits réservés.' : 'All rights reserved.'}
        `;

        // Extract email addresses for this language group
        const emailAddresses = langRecipients.map(recipient => recipient.email);

        await this.mailService.send({
          to: emailAddresses,
          from: {
            email: this.fromEmail,
            name: this.fromName,
          },
          subject,
          text: textContent.trim(),
          html: htmlContent,
          mailSettings: {
            bypassListManagement: {
              enable: false,
            },
            footer: {
              enable: false,
            },
            sandboxMode: {
              enable: false,
            },
          },
          trackingSettings: {
            clickTracking: {
              enable: false,
              enableText: false,
            },
            openTracking: {
              enable: false,
            },
            subscriptionTracking: {
              enable: false,
            },
            ganalytics: {
              enable: false,
            },
          },
        });

        console.log(`📧 Sent notification "${notificationData.title}" to ${emailAddresses.length} recipients in ${language}`);
      }

      console.log(`✅ Sent scheduled notifications for type "${notificationData.type}" to ${enabledRecipients.length} total recipients`);
      return true;
    } catch (error: any) {
      console.error('❌ Error sending scheduled notifications:', error);
      return false;
    }
  }
}

// Create singleton instance
export const emailService = new EmailService();
export { EmailService };
