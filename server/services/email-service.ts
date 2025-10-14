import { MailService } from '@sendgrid/mail';
import {
  generateAllCalendarLinks,
  generateCalendarButtonsHTML,
  generateCalendarInstructionsText,
  generateEnhancedICS
} from './outlook-integration';

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
              <title>Réinitialisation de votre mot de passe</title>
            </head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
                <h1 style="color: #2563eb; margin-bottom: 20px;">Koveo Gestion</h1>
                
                <h2 style="color: #374151;">Réinitialisation de votre mot de passe</h2>
                
                <p>Bonjour ${userName},</p>
                
                <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre compte Koveo Gestion.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${resetUrl}" 
                     style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                    Réinitialiser mon mot de passe
                  </a>
                </div>
                
                <p><strong>Sécurité importante :</strong></p>
                <ul>
                  <li>Ce lien expire dans 15 minutes</li>
                  <li>Utilisez ce lien une seule fois</li>
                  <li>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email</li>
                </ul>
                
                <p>Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :</p>
                <p style="word-break: break-all; color: #2563eb;">${resetUrl}</p>
                
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
          text: `
Réinitialisation de votre mot de passe - Koveo Gestion

Bonjour ${userName},

Vous avez demandé la réinitialisation de votre mot de passe pour votre compte Koveo Gestion.

Pour réinitialiser votre mot de passe, cliquez sur le lien suivant :
${resetUrl}

Sécurité importante :
- Ce lien expire dans 15 minutes
- Utilisez ce lien une seule fois
- Si vous n'avez pas demandé cette réinitialisation, ignorez cet email

Conforme à la Loi 25 du Québec.
© 2025 Koveo Gestion
          `,
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
                
                <p>Hello ${userName},</p>
                
                <p>You have requested a password reset for your Koveo Gestion account.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${resetUrl}" 
                     style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                    Reset My Password
                  </a>
                </div>
                
                <p><strong>Important Security:</strong></p>
                <ul>
                  <li>This link expires in 15 minutes</li>
                  <li>Use this link only once</li>
                  <li>If you didn't request this reset, please ignore this email</li>
                </ul>
                
                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #2563eb;">${resetUrl}</p>
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                
                <div style="font-size: 12px; color: #6b7280;">
                  <p><strong>Privacy & Security</strong></p>
                  <p>Quebec Law 25 compliant. Your personal data is protected according to the highest security standards.</p>
                  <p>© 2025 Koveo Gestion. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
          `,
          text: `
Password Reset - Koveo Gestion

Hello ${userName},

You have requested a password reset for your Koveo Gestion account.

To reset your password, click the following link:
${resetUrl}

Important Security:
- This link expires in 15 minutes
- Use this link only once
- If you didn't request this reset, please ignore this email

Quebec Law 25 compliant.
© 2025 Koveo Gestion
          `,
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
        text: template.text.trim(),
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

      // console.log(`✅ Password reset email sent to ${to} in ${language}`);
      return true;
    } catch (error: any) {
      // console.error('❌ Error sending password reset email:', error);
      return false;
    }
  }

  /**
   * Sanitizes HTML content to prevent XSS attacks.
   * Removes potentially dangerous HTML tags and attributes.
   */
  private sanitizeHtmlContent(content: string): string {
    if (!content) return '';
    
    // Remove script tags and their content
    let sanitized = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove potentially dangerous tags
    sanitized = sanitized.replace(/<(iframe|object|embed|form|input|select|textarea|button|link|meta|style)[^>]*>/gi, '');
    
    // Remove event handlers (onclick, onload, etc.)
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
    
    // Remove javascript: protocol
    sanitized = sanitized.replace(/javascript:/gi, '');
    
    return sanitized.trim();
  }

  /**
   * Sends notification emails for automated building-specific notifications.
   * Email includes notification content with proper Quebec compliance settings.
   *
   * @param {string} to - Recipient email address.
   * @param {string} userName - User's display name for personalization.
   * @param {string} title - Notification title.
   * @param {string} message - Notification message content.
   * @param {string} notificationType - Type of notification (announcement, seasonal, etc.).
   * @param {'fr' | 'en'} [language='fr'] - Email language (defaults to French for Quebec).
   * @returns {Promise<boolean>} Promise resolving to true if email sent successfully.
   *
   * @throws {Error} When SendGrid API fails or invalid parameters provided.
   *
   * @example
   * ```typescript
   * const emailService = new EmailService();
   * const success = await emailService.sendNotificationEmail(
   *   'resident@example.com',
   *   'Jean Dupont',
   *   'Rappel de paiement mensuel',
   *   'Votre paiement mensuel est dû le 1er du mois...',
   *   'bill_reminder',
   *   'fr'
   * );
   * ```
   */
  async sendNotificationEmail(
    to: string,
    userName: string,
    title: string,
    message: string,
    notificationType: string,
    language: 'fr' | 'en' = 'fr'
  ): Promise<boolean> {
    try {
      // Sanitize message content to prevent XSS
      const sanitizedMessage = this.sanitizeHtmlContent(message);
      
      const notificationTypeTranslations = {
        fr: {
          bill_reminder: 'Rappel de facturation',
          maintenance_update: 'Mise à jour de maintenance',
          announcement: 'Annonce importante',
          seasonal_reminder: 'Rappel saisonnier',
          upcoming_payment: 'Paiement à venir',
          policy_change: 'Changement de politique',
          meeting_invite: 'Invitation à une réunion',
          default: 'Notification'
        },
        en: {
          bill_reminder: 'Billing Reminder',
          maintenance_update: 'Maintenance Update',
          announcement: 'Important Announcement',
          seasonal_reminder: 'Seasonal Reminder',
          upcoming_payment: 'Upcoming Payment',
          policy_change: 'Policy Change',
          meeting_invite: 'Meeting Invitation',
          default: 'Notification'
        }
      };

      const typeLabel = notificationTypeTranslations[language][notificationType] || 
                       notificationTypeTranslations[language].default;

      const templates = {
        fr: {
          subject: `${typeLabel} - Koveo Gestion`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>${title}</title>
            </head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
                <h1 style="color: #2563eb; margin-bottom: 20px;">Koveo Gestion</h1>
                
                <div style="background: white; padding: 25px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <h2 style="color: #374151; margin-bottom: 15px;">${title}</h2>
                  
                  <p>Bonjour ${userName},</p>
                  
                  <div style="background: #f3f4f6; padding: 20px; border-radius: 4px; margin: 20px 0;">
                    ${sanitizedMessage.replace(/\n/g, '<br>')}
                  </div>
                  
                  <p style="margin-top: 20px;">
                    <small style="color: #6b7280;">
                      Cette notification automatisée a été envoyée dans le cadre de la gestion de votre résidence.
                    </small>
                  </p>
                </div>
                
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
          text: `
${title} - Koveo Gestion

Bonjour ${userName},

${sanitizedMessage}

Cette notification automatisée a été envoyée dans le cadre de la gestion de votre résidence.

Conforme à la Loi 25 du Québec.
© 2025 Koveo Gestion
          `,
        },
        en: {
          subject: `${typeLabel} - Koveo Gestion`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>${title}</title>
            </head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
                <h1 style="color: #2563eb; margin-bottom: 20px;">Koveo Gestion</h1>
                
                <div style="background: white; padding: 25px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <h2 style="color: #374151; margin-bottom: 15px;">${title}</h2>
                  
                  <p>Hello ${userName},</p>
                  
                  <div style="background: #f3f4f6; padding: 20px; border-radius: 4px; margin: 20px 0;">
                    ${sanitizedMessage.replace(/\n/g, '<br>')}
                  </div>
                  
                  <p style="margin-top: 20px;">
                    <small style="color: #6b7280;">
                      This automated notification was sent as part of your residence management.
                    </small>
                  </p>
                </div>
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                
                <div style="font-size: 12px; color: #6b7280;">
                  <p><strong>Privacy & Security</strong></p>
                  <p>Quebec Law 25 compliant. Your personal data is protected according to the highest security standards.</p>
                  <p>© 2025 Koveo Gestion. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
          `,
          text: `
${title} - Koveo Gestion

Hello ${userName},

${sanitizedMessage}

This automated notification was sent as part of your residence management.

Quebec Law 25 compliant.
© 2025 Koveo Gestion
          `,
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
        text: template.text.trim(),
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

      // console.log(`✅ Notification email sent to ${to} (${notificationType}) in ${language}`);
      return true;
    } catch (error: any) {
      // console.error('❌ Error sending notification email:', error);
      return false;
    }
  }

  /**
   * Sends an invitation email to a new user with Quebec Law 25 compliance.
   * Email includes registration link and privacy notice.
   *
   * @param {string} to - Recipient email address.
   * @param {string} inviterName - Name of the person sending the invitation.
   * @param {string} invitationUrl - Complete invitation URL with token.
   * @param {string} organizationName - Name of the organization.
   * @param {'fr' | 'en'} [language='fr'] - Email language (defaults to French for Quebec).
   * @returns {Promise<boolean>} Promise resolving to true if email sent successfully.
   *
   * @throws {Error} When SendGrid API fails or invalid parameters provided.
   *
   * @example
   * ```typescript
   * const emailService = new EmailService();
   * const success = await emailService.sendInvitationEmail(
   *   'newuser@example.com',
   *   'Marie Dubois',
   *   'https://app.koveo.com/register?token=xyz789',
   *   'Résidences Mont-Royal',
   *   'fr'
   * );
   * ```
   */
  async sendInvitationEmail(
    to: string,
    inviterName: string,
    invitationUrl: string,
    organizationName: string,
    language: 'fr' | 'en' = 'fr'
  ): Promise<boolean> {
    try {
      const templates = {
        fr: {
          subject: `Invitation à rejoindre ${organizationName} - Koveo Gestion`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>Invitation à rejoindre ${organizationName}</title>
            </head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
                <h1 style="color: #2563eb; margin-bottom: 20px;">Koveo Gestion</h1>
                
                <h2 style="color: #374151;">Vous êtes invité(e) à rejoindre ${organizationName}</h2>
                
                <p>Bonjour,</p>
                
                <p>${inviterName} vous invite à rejoindre ${organizationName} sur la plateforme Koveo Gestion.</p>
                
                <p><strong>Koveo Gestion</strong> est une plateforme de gestion immobilière conçue spécialement pour les copropriétés du Québec, offrant :</p>
                <ul>
                  <li>Gestion des documents et communications</li>
                  <li>Suivi des demandes de maintenance</li>
                  <li>Planification financière et budgétaire</li>
                  <li>Conformité à la Loi 25 du Québec</li>
                </ul>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${invitationUrl}" 
                     style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                    Accepter l'invitation
                  </a>
                </div>
                
                <p><strong>Informations importantes :</strong></p>
                <ul>
                  <li>Cette invitation expire dans 7 jours</li>
                  <li>Vous devrez créer un mot de passe sécurisé lors de l'inscription</li>
                  <li>Vos données personnelles seront protégées selon la Loi 25</li>
                </ul>
                
                <p>Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :</p>
                <p style="word-break: break-all; color: #2563eb;">${invitationUrl}</p>
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                
                <div style="font-size: 12px; color: #6b7280;">
                  <p><strong>Confidentialité & Sécurité - Loi 25 du Québec</strong></p>
                  <p>En acceptant cette invitation, vous consentez à ce que vos informations personnelles soient collectées et utilisées par Koveo Gestion dans le cadre de la gestion de votre copropriété. Vous pourrez consulter notre politique de confidentialité et exercer vos droits lors de votre inscription.</p>
                  <p>© 2025 Koveo Gestion. Tous droits réservés.</p>
                </div>
              </div>
            </body>
            </html>
          `,
          text: `
Invitation à rejoindre ${organizationName} - Koveo Gestion

Bonjour,

${inviterName} vous invite à rejoindre ${organizationName} sur la plateforme Koveo Gestion.

Koveo Gestion est une plateforme de gestion immobilière conçue spécialement pour les copropriétés du Québec, offrant :
- Gestion des documents et communications
- Suivi des demandes de maintenance
- Planification financière et budgétaire
- Conformité à la Loi 25 du Québec

Pour accepter l'invitation, cliquez sur le lien suivant :
${invitationUrl}

Informations importantes :
- Cette invitation expire dans 7 jours
- Vous devrez créer un mot de passe sécurisé lors de l'inscription
- Vos données personnelles seront protégées selon la Loi 25

Conforme à la Loi 25 du Québec.
© 2025 Koveo Gestion
          `,
        },
        en: {
          subject: `Invitation to join ${organizationName} - Koveo Gestion`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>Invitation to join ${organizationName}</title>
            </head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
                <h1 style="color: #2563eb; margin-bottom: 20px;">Koveo Gestion</h1>
                
                <h2 style="color: #374151;">You're invited to join ${organizationName}</h2>
                
                <p>Hello,</p>
                
                <p>${inviterName} has invited you to join ${organizationName} on the Koveo Gestion platform.</p>
                
                <p><strong>Koveo Gestion</strong> is a property management platform designed specifically for Quebec condominiums, offering:</p>
                <ul>
                  <li>Document and communication management</li>
                  <li>Maintenance request tracking</li>
                  <li>Financial and budget planning</li>
                  <li>Quebec Law 25 compliance</li>
                </ul>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${invitationUrl}" 
                     style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                    Accept Invitation
                  </a>
                </div>
                
                <p><strong>Important Information:</strong></p>
                <ul>
                  <li>This invitation expires in 7 days</li>
                  <li>You'll need to create a secure password during registration</li>
                  <li>Your personal data will be protected under Law 25</li>
                </ul>
                
                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #2563eb;">${invitationUrl}</p>
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                
                <div style="font-size: 12px; color: #6b7280;">
                  <p><strong>Privacy & Security - Quebec Law 25</strong></p>
                  <p>By accepting this invitation, you consent to having your personal information collected and used by Koveo Gestion for the management of your condominium. You can review our privacy policy and exercise your rights during registration.</p>
                  <p>© 2025 Koveo Gestion. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
          `,
          text: `
Invitation to join ${organizationName} - Koveo Gestion

Hello,

${inviterName} has invited you to join ${organizationName} on the Koveo Gestion platform.

Koveo Gestion is a property management platform designed specifically for Quebec condominiums, offering:
- Document and communication management
- Maintenance request tracking
- Financial and budget planning
- Quebec Law 25 compliance

To accept the invitation, click the following link:
${invitationUrl}

Important Information:
- This invitation expires in 7 days
- You'll need to create a secure password during registration
- Your personal data will be protected under Law 25

Quebec Law 25 compliant.
© 2025 Koveo Gestion
          `,
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
        text: template.text.trim(),
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

      // console.log(`✅ Invitation email sent to ${to} for ${organizationName} in ${language}`);
      return true;
    } catch (error: any) {
      // console.error('❌ Error sending invitation email:', error);
      return false;
    }
  }

  /**
   * Sends a meeting invitation email with Outlook integration.
   * 
   * @param {Object} meetingData - Meeting information object.
   * @param {string} meetingData.title - Meeting title.
   * @param {string} meetingData.description - Meeting description.
   * @param {Date} meetingData.startTime - Meeting start time.
   * @param {Date} meetingData.endTime - Meeting end time.
   * @param {string} meetingData.location - Meeting location.
   * @param {string} meetingData.organizerName - Organizer's name.
   * @param {string} meetingData.organizerEmail - Organizer's email.
   * @param {string} meetingData.organizationName - Organization name.
   * @param {Array<string>} recipients - Array of recipient email addresses.
   * @param {'fr' | 'en'} [language='fr'] - Email language.
   * @returns {Promise<boolean>} Promise resolving to true if email sent successfully.
   */
  async sendMeetingInvitation(
    meetingData: {
      title: string;
      description: string;
      startTime: Date;
      endTime: Date;
      location: string;
      organizerName: string;
      organizerEmail: string;
      organizationName: string;
    },
    recipients: string[],
    language: 'fr' | 'en' = 'fr'
  ): Promise<boolean> {
    try {
      const isFrench = language === 'fr';
      
      // Generate calendar attachments
      // Transform meetingData to match MeetingData interface
      const meetingDataForCalendar = {
        title: meetingData.title,
        description: meetingData.description,
        location: meetingData.location,
        scheduledDate: meetingData.startTime,
        duration: Math.round((meetingData.endTime.getTime() - meetingData.startTime.getTime()) / 60000), // in minutes
        organizationName: meetingData.organizationName
      };
      const icsContent = generateEnhancedICS(meetingDataForCalendar, language);
      const calendarLinks = generateAllCalendarLinks(meetingDataForCalendar, language);
      const calendarButtonsHTML = generateCalendarButtonsHTML(calendarLinks, language);
      const calendarInstructions = generateCalendarInstructionsText(calendarLinks, language);

      const formatDate = (date: Date) => {
        return date.toLocaleDateString(language === 'fr' ? 'fr-CA' : 'en-CA', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      };

      const formatTime = (date: Date) => {
        return date.toLocaleTimeString(language === 'fr' ? 'fr-CA' : 'en-CA', {
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short',
        });
      };

      const subject = `${isFrench ? 'Invitation' : 'Invitation'}: ${meetingData.title} - ${meetingData.organizationName}`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>${meetingData.title}</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
            <h1 style="color: #2563eb; margin-bottom: 20px;">Koveo Gestion</h1>
            
            <h2 style="color: #374151;">${meetingData.title}</h2>
            
            <p>${isFrench ? 'Bonjour,' : 'Hello,'}</p>
            
            <p>${isFrench 
              ? `Vous êtes invité(e) à participer à la réunion suivante :`
              : `You are invited to attend the following meeting:`}
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #2563eb;">
              <h3 style="margin-top: 0; color: #374151;">${meetingData.title}</h3>
              <p style="margin: 10px 0;"><strong>${isFrench ? 'Description :' : 'Description:'}</strong> ${meetingData.description}</p>
              <p style="margin: 10px 0;"><strong>${isFrench ? 'Date :' : 'Date:'}</strong> ${formatDate(meetingData.startTime)}</p>
              <p style="margin: 10px 0;"><strong>${isFrench ? 'Heure :' : 'Time:'}</strong> ${formatTime(meetingData.startTime)} - ${formatTime(meetingData.endTime)}</p>
              <p style="margin: 10px 0;"><strong>${isFrench ? 'Lieu :' : 'Location:'}</strong> ${meetingData.location}</p>
              <p style="margin: 10px 0 0 0;"><strong>${isFrench ? 'Organisateur :' : 'Organizer:'}</strong> ${meetingData.organizerName}</p>
            </div>
            
            <div style="margin: 20px 0;">
              <h3 style="color: #374151;">${isFrench ? 'Ajouter à votre calendrier' : 'Add to your calendar'}</h3>
              ${calendarButtonsHTML}
            </div>
            
            <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #6b7280;">
                <strong>${isFrench ? 'Organisation :' : 'Organization:'}</strong> ${meetingData.organizationName}
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <div style="font-size: 12px; color: #6b7280;">
              <p><strong>${isFrench ? 'Confidentialité & Sécurité' : 'Privacy & Security'}</strong></p>
              <p>
                ${isFrench 
                  ? 'Conforme à la Loi 25 du Québec. Vos données personnelles sont protégées selon les normes de sécurité les plus strictes.' 
                  : 'Quebec Law 25 compliant. Your personal data is protected according to the highest security standards.'}
              </p>
              <p>© 2025 Koveo Gestion. ${isFrench ? 'Tous droits réservés.' : 'All rights reserved.'}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const textContent = `
${meetingData.title} - Koveo Gestion

${isFrench ? 'Bonjour,' : 'Hello,'}

${isFrench 
  ? `Vous êtes invité(e) à participer à la réunion suivante :`
  : `You are invited to attend the following meeting:`}

${meetingData.title}

${isFrench ? 'Description :' : 'Description:'} ${meetingData.description}
${isFrench ? 'Date :' : 'Date:'} ${formatDate(meetingData.startTime)}
${isFrench ? 'Heure :' : 'Time:'} ${formatTime(meetingData.startTime)} - ${formatTime(meetingData.endTime)}
${isFrench ? 'Lieu :' : 'Location:'} ${meetingData.location}
${isFrench ? 'Organisateur :' : 'Organizer:'} ${meetingData.organizerName}

${calendarInstructions}

${isFrench ? 'Organisation :' : 'Organization:'} ${meetingData.organizationName}

${isFrench ? 'Conforme à la Loi 25 du Québec.' : 'Quebec Law 25 compliant.'}
© 2025 Koveo Gestion
      `;

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
            filename: 'meeting.ics',
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

      // console.log(`📅 Sent meeting invitation "${meetingData.title}" to ${recipients.length} recipients with calendar attachment`);
      return true;
    } catch (error: any) {
      // console.error('❌ Error sending meeting invitation:', error);
      return false;
    }
  }

  /**
   * Sends multiple combined notifications in a single email.
   * Groups recipients by building and language, combines multiple notification types
   * into one consolidated email per recipient.
   *
   * @param {Array} notificationsData - Array of notification objects to combine.
   * @param {string} notificationsData[].type - Notification type for tracking.
   * @param {string} notificationsData[].title - Notification title.
   * @param {string} notificationsData[].message - Notification message content.
   * @param {string} organizationName - Organization name for context.
   * @param {Array} recipients - Array of recipient objects.
   * @param {string} recipients[].email - Recipient email address.
   * @param {string} recipients[].name - Recipient full name.
   * @param {'fr' | 'en'} recipients[].language - Recipient language preference.
   * @param {string} [recipients[].buildingName] - Building name for splitting notifications.
   * @param {boolean} [isTestEmail=false] - Whether this is a test email.
   * @returns {Promise<boolean>} Promise resolving to true if combined email sent successfully.
   */
  async sendCombinedNotifications(
    notificationsData: Array<{
      type: string;
      title: string;
      message: string;
    }>,
    organizationName: string,
    recipients: Array<{
      email: string;
      name: string;
      language: 'fr' | 'en';
      buildingName?: string;
    }>,
    isTestEmail: boolean = false
  ): Promise<boolean> {
    try {
      // Filter out empty notifications (except for test emails)
      const validNotifications = isTestEmail 
        ? notificationsData 
        : notificationsData.filter(notification => 
            notification.message && notification.message.trim() !== ''
          );

      if (validNotifications.length === 0) {
        // console.log('📧 No valid notifications to send');
        return true;
      }

      if (recipients.length === 0) {
        // console.log('📧 No recipients for combined notifications');
        return true;
      }

      // Group recipients by building first, then by language
      const recipientsByBuilding = recipients.reduce((acc, recipient) => {
        const building = recipient.buildingName || 'General';
        if (!acc[building]) acc[building] = [];
        acc[building].push(recipient);
        return acc;
      }, {} as Record<string, typeof recipients>);

      // console.log(`📧 Sending combined notifications to ${Object.keys(recipientsByBuilding).length} building(s)`);

      // Smart environment detection for URLs
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
      const demandCenterUrl = `${baseUrl}/residents/demands`;
      const notificationSettingsUrl = `${baseUrl}/dashboard/communication`;

      // Process each building separately
      for (const [buildingName, buildingRecipients] of Object.entries(recipientsByBuilding)) {
        // console.log(`📧 Processing building: ${buildingName} (${buildingRecipients.length} recipients)`);

        // Group building recipients by language
        const recipientsByLanguage = buildingRecipients.reduce((acc, recipient) => {
          const lang = recipient.language || 'fr';
          if (!acc[lang]) acc[lang] = [];
          acc[lang].push(recipient);
          return acc;
        }, {} as Record<string, typeof buildingRecipients>);

        // Send combined notifications for each language group within this building
        for (const [language, langRecipients] of Object.entries(recipientsByLanguage)) {
          const isFrench = language === 'fr';
          
          // Create combined subject
          const subjectPrefix = isFrench ? 'Notifications' : 'Notifications';
          let subject = `${subjectPrefix} - ${organizationName}`;
          if (Object.keys(recipientsByBuilding).length > 1 && buildingName !== 'General') {
            subject = `${subjectPrefix} - ${buildingName} - ${organizationName}`;
          }

          // Create combined message content
          const combinedMessage = validNotifications.map((notification, index) => 
            `<div style="background: white; padding: 20px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #2563eb;">
              <h3 style="margin: 0 0 10px 0; color: #374151; font-size: 16px;">${notification.title}</h3>
              <p style="margin: 0; line-height: 1.6;">${notification.message}</p>
            </div>`
          ).join('');

          const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>${subject}</title>
            </head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
                <h1 style="color: #2563eb; margin-bottom: 20px;">Koveo Gestion</h1>
                
                <h2 style="color: #374151;">${isFrench ? 'Notifications du jour' : 'Daily Notifications'}</h2>
                
                <p>${isFrench ? 'Bonjour,' : 'Hello,'}</p>
                
                <p>${isFrench 
                  ? `Voici vos notifications pour aujourd'hui concernant ${organizationName}:` 
                  : `Here are your notifications for today regarding ${organizationName}:`}</p>
                
                ${combinedMessage}
                
                <p>
                  <strong>${isFrench ? 'Organisation :' : 'Organization:'}</strong> ${organizationName}
                </p>
                ${buildingName !== 'General' ? `
                <p>
                  <strong>${isFrench ? 'Bâtiment :' : 'Building:'}</strong> ${buildingName}
                </p>
                ` : ''}
                
                <div style="margin: 20px 0; padding: 15px; background: #f3f4f6; border-radius: 6px;">
                  <p style="margin: 0; font-size: 14px; color: #6b7280;">
                    <strong>${isFrench ? 'Centre de demandes:' : 'Demand Center:'}</strong>
                    <a href="${demandCenterUrl}" style="color: #2563eb; text-decoration: none; margin-left: 5px;">
                      ${isFrench ? 'Voir les demandes' : 'View Demands'}
                    </a>
                  </p>
                  <p style="margin: 10px 0 0 0; font-size: 14px; color: #6b7280;">
                    <strong>${isFrench ? 'Paramètres de notification:' : 'Notification Settings:'}</strong>
                    <a href="${notificationSettingsUrl}" style="color: #2563eb; text-decoration: none; margin-left: 5px;">
                      ${isFrench ? 'Gérer les préférences' : 'Manage Preferences'}
                    </a>
                  </p>
                </div>
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                
                <div style="font-size: 12px; color: #6b7280;">
                  <p><strong>${isFrench ? 'Confidentialité & Sécurité' : 'Privacy & Security'}</strong></p>
                  <p>${isFrench 
                    ? 'Conforme à la Loi 25 du Québec. Vos données personnelles sont protégées selon les normes de sécurité les plus strictes.' 
                    : 'Compliant with Quebec Law 25. Your personal data is protected according to the strictest security standards.'}</p>
                  <p>© 2025 Koveo Gestion. ${isFrench ? 'Tous droits réservés.' : 'All rights reserved.'}</p>
                </div>
              </div>
            </body>
            </html>
          `;

          // Create text version
          const textContent = `
${isFrench ? 'Notifications du jour' : 'Daily Notifications'} - Koveo Gestion

${isFrench ? 'Bonjour,' : 'Hello,'}

${isFrench 
  ? `Voici vos notifications pour aujourd'hui concernant ${organizationName}:` 
  : `Here are your notifications for today regarding ${organizationName}:`}

${validNotifications.map(notification => `
${notification.title}
${notification.message}
`).join('\n---\n')}

${isFrench ? 'Organisation :' : 'Organization:'} ${organizationName}
${buildingName !== 'General' ? `${isFrench ? 'Bâtiment :' : 'Building:'} ${buildingName}` : ''}

${isFrench ? 'Centre de demandes:' : 'Demand Center:'} ${demandCenterUrl}
${isFrench ? 'Paramètres de notification:' : 'Notification Settings:'} ${notificationSettingsUrl}

---
${isFrench ? 'Confidentialité & Sécurité' : 'Privacy & Security'}
${isFrench 
  ? 'Conforme à la Loi 25 du Québec. Vos données personnelles sont protégées selon les normes de sécurité les plus strictes.' 
  : 'Compliant with Quebec Law 25. Your personal data is protected according to the strictest security standards.'}
© 2025 Koveo Gestion. ${isFrench ? 'Tous droits réservés.' : 'All rights reserved.'}
          `;

          // Send to all recipients in this language group
          const emailPromises = langRecipients.map(recipient => {
            const msg = {
              to: recipient.email,
              from: {
                email: this.fromEmail,
                name: this.fromName,
              },
              subject,
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
            };

            return this.mailService.send(msg);
          });

          // Wait for all emails in this group to be sent
          await Promise.all(emailPromises);
          // console.log(`📧 Combined notifications sent to ${langRecipients.length} recipients in ${language} for building ${buildingName}`);
        }
      }

      // console.log('📧 All combined notifications sent successfully');
      return true;
    } catch (error) {
      // console.error('❌ Error sending combined notifications:', error);
      return false;
    }
  }

  /**
   * Sends scheduled notifications with building-specific splitting and empty notification filtering.
   * Groups recipients by building and language for efficient delivery.
   * Includes Quebec Law 25 compliance footer and unsubscribe functionality.
   * Skips empty notifications except for test emails.
   *
   * @param {Object} notificationData - Notification content and metadata.
   * @param {string} notificationData.type - Notification type for tracking.
   * @param {string} notificationData.title - Email subject line.
   * @param {string} notificationData.message - Email message content.
   * @param {string} notificationData.organizationName - Organization name for context.
   * @param {Array} recipients - Array of recipient objects.
   * @param {string} recipients[].email - Recipient email address.
   * @param {string} recipients[].name - Recipient full name.
   * @param {'fr' | 'en'} recipients[].language - Recipient language preference.
   * @param {string} recipients[].frequency - Notification frequency preference.
   * @param {boolean} recipients[].isEnabled - Whether notifications are enabled.
   * @param {string} [recipients[].buildingName] - Building name for splitting notifications.
   * @param {boolean} [isTestEmail=false] - Whether this is a test email (bypasses empty check).
   * @returns {Promise<boolean>} Promise resolving to true if notifications sent successfully.
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
      buildingName?: string;
    }>,
    isTestEmail: boolean = false
  ): Promise<boolean> {
    try {
      // Check if notification is empty and skip sending (except for test emails)
      if (!isTestEmail && (!notificationData.message || notificationData.message.trim() === '')) {
        // console.log(`📧 Skipping empty notification for type: ${notificationData.type}`);
        return true;
      }

      // Filter recipients who have notifications enabled for this type
      const enabledRecipients = recipients.filter(recipient => recipient.isEnabled);
      
      if (enabledRecipients.length === 0) {
        // console.log(`📧 No enabled recipients for notification type: ${notificationData.type}`);
        return true;
      }

      // Group recipients by building first, then by language for building-specific notifications
      const recipientsByBuilding = enabledRecipients.reduce((acc, recipient) => {
        const building = recipient.buildingName || 'General';
        if (!acc[building]) acc[building] = [];
        acc[building].push(recipient);
        return acc;
      }, {} as Record<string, typeof enabledRecipients>);

      // console.log(`📧 Sending notifications to ${Object.keys(recipientsByBuilding).length} building(s)`);

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
      const demandCenterUrl = `${baseUrl}/residents/demands`;
      const notificationSettingsUrl = `${baseUrl}/dashboard/communication`;

      // Process each building separately
      for (const [buildingName, buildingRecipients] of Object.entries(recipientsByBuilding)) {
        // console.log(`📧 Processing building: ${buildingName} (${buildingRecipients.length} recipients)`);

        // Group building recipients by language for efficient batch sending
        const recipientsByLanguage = buildingRecipients.reduce((acc, recipient) => {
          const lang = recipient.language || 'fr';
          if (!acc[lang]) acc[lang] = [];
          acc[lang].push(recipient);
          return acc;
        }, {} as Record<string, typeof buildingRecipients>);

        // Send notifications for each language group within this building
        for (const [language, langRecipients] of Object.entries(recipientsByLanguage)) {
          const isFrench = language === 'fr';
          
          // Include building name in subject if multiple buildings and not "General"
          let subject = `${notificationData.title} - ${notificationData.organizationName}`;
          if (Object.keys(recipientsByBuilding).length > 1 && buildingName !== 'General') {
            subject = `${notificationData.title} - ${buildingName} - ${notificationData.organizationName}`;
          }

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
                ${buildingName !== 'General' ? `
                <p>
                  <strong>${isFrench ? 'Bâtiment :' : 'Building:'}</strong> ${buildingName}
                </p>
                ` : ''}
                
                <div style="margin: 20px 0; padding: 15px; background: #f3f4f6; border-radius: 6px;">
                  <p style="margin: 0; font-size: 14px; color: #6b7280;">
                    <strong>${isFrench ? 'Centre de demandes:' : 'Demand Center:'}</strong>
                    <a href="${demandCenterUrl}" style="color: #2563eb; text-decoration: none; margin-left: 5px;">
                      ${isFrench ? 'Voir les demandes' : 'View Demands'}
                    </a>
                  </p>
                  <p style="margin: 10px 0 0 0; font-size: 14px; color: #6b7280;">
                    <strong>${isFrench ? 'Paramètres de notification:' : 'Notification Settings:'}</strong>
                    <a href="${notificationSettingsUrl}" style="color: #2563eb; text-decoration: none; margin-left: 5px;">
                      ${isFrench ? 'Gérer les préférences' : 'Manage Preferences'}
                    </a>
                  </p>
                </div>
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                
                <div style="font-size: 12px; color: #6b7280;">
                  <p><strong>${isFrench ? 'Confidentialité & Sécurité' : 'Privacy & Security'}</strong></p>
                  <p>
                    ${isFrench 
                      ? 'Conforme à la Loi 25 du Québec. Vos données personnelles sont protégées selon les normes de sécurité les plus strictes.' 
                      : 'Quebec Law 25 compliant. Your personal data is protected according to the highest security standards.'}
                  </p>
                  <p>© 2025 Koveo Gestion. ${isFrench ? 'Tous droits réservés.' : 'All rights reserved.'}</p>
                </div>
              </div>
            </body>
            </html>
          `;

          const textContent = `
${notificationData.title} - Koveo Gestion

${isFrench ? 'Bonjour,' : 'Hello,'}

${notificationData.message}

${isFrench ? 'Organisation :' : 'Organization:'} ${notificationData.organizationName}
${buildingName !== 'General' ? `${isFrench ? 'Bâtiment :' : 'Building:'} ${buildingName}` : ''}

${isFrench ? 'Centre de demandes:' : 'Demand Center:'} ${demandCenterUrl}
${isFrench ? 'Paramètres de notification:' : 'Notification Settings:'} ${notificationSettingsUrl}

${isFrench ? 'Conforme à la Loi 25 du Québec.' : 'Quebec Law 25 compliant.'}
© 2025 Koveo Gestion
          `;

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

          // console.log(`📧 Sent notification "${notificationData.title}" to ${emailAddresses.length} recipients in ${language} for building: ${buildingName}`);
        }
      }

      // console.log(`✅ Sent scheduled notifications for type "${notificationData.type}" to ${enabledRecipients.length} total recipients across ${Object.keys(recipientsByBuilding).length} building(s)`);
      return true;
    } catch (error: any) {
      // console.error('❌ Error sending scheduled notifications:', error);
      return false;
    }
  }

  /**
   * Sends a test notification email to preview how emails will look.
   * 
   * @param {string} to - Recipient email address.
   * @param {string} userName - User's display name for personalization.
   * @param {string} subject - Email subject line.
   * @param {string} message - Email message content.
   * @param {string} notificationType - Type of notification for context.
   * @param {'fr' | 'en'} [language='fr'] - Email language.
   * @returns {Promise<boolean>} Promise resolving to true if email sent successfully.
   */
  async sendTestNotificationEmail(
    to: string,
    userName: string,
    subject: string,
    message: string,
    notificationType: string,
    language: 'fr' | 'en' = 'fr'
  ): Promise<boolean> {
    try {
      // Sanitize message content to prevent XSS
      const sanitizedMessage = this.sanitizeHtmlContent(message);
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>${subject}</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
            <h1 style="color: #2563eb; margin-bottom: 20px;">Koveo Gestion</h1>
            
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 20px;">
              <strong style="color: #856404;">📧 ${language === 'fr' ? 'Email de test' : 'Test Email'}</strong>
              <p style="margin: 5px 0 0 0; color: #856404; font-size: 14px;">
                ${language === 'fr' 
                  ? 'Ceci est un aperçu de votre notification. Aucune action n\'est requise.' 
                  : 'This is a preview of your notification. No action is required.'}
              </p>
            </div>
            
            <h2 style="color: #374151;">${subject}</h2>
            
            <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #e5e7eb;">
              <p style="line-height: 1.6;">${sanitizedMessage}</p>
            </div>
            
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <div style="font-size: 12px; color: #6b7280;">
              <p><strong>${language === 'fr' ? 'Confidentialité & Sécurité' : 'Privacy & Security'}</strong></p>
              <p>
                ${language === 'fr' 
                  ? 'Conforme à la Loi 25 du Québec. Vos données personnelles sont protégées selon les normes de sécurité les plus strictes.' 
                  : 'Quebec Law 25 compliant. Your personal data is protected according to the highest security standards.'}
              </p>
              <p>© 2025 Koveo Gestion. ${language === 'fr' ? 'Tous droits réservés.' : 'All rights reserved.'}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const textContent = `
${language === 'fr' ? 'EMAIL DE TEST' : 'TEST EMAIL'} - Koveo Gestion

${language === 'fr' ? 'Ceci est un aperçu de votre notification. Aucune action n\'est requise.' : 'This is a preview of your notification. No action is required.'}

${subject}

${sanitizedMessage}

${language === 'fr' ? 'Conforme à la Loi 25 du Québec.' : 'Quebec Law 25 compliant.'}
© 2025 Koveo Gestion
      `;

      await this.mailService.send({
        to,
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        subject: `[${language === 'fr' ? 'TEST' : 'TEST'}] ${subject}`,
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

      // console.log(`✅ Test notification email sent to ${to}`);
      return true;
    } catch (error: any) {
      // console.error('❌ Error sending test notification email:', error);
      return false;
    }
  }
}

// Export the class for testing
export { EmailService };

// Export singleton instance for production use
export const emailService = new EmailService();