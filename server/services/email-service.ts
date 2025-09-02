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
}

// Create singleton instance
export const emailService = new EmailService();
export { EmailService };
