import { MailService } from '@sendgrid/mail';

/**
 * Email service for Quebec-compliant transactional emails using SendGrid.
 * Handles password resets, invitations, and other security-related communications.
 */
class EmailService {
  private mailService: MailService;
  private fromEmail: string = 'noreply@koveo-gestion.com';
  private fromName: string = 'Koveo Gestion';

  constructor() {
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error("SENDGRID_API_KEY environment variable must be set");
    }

    this.mailService = new MailService();
    this.mailService.setApiKey(process.env.SENDGRID_API_KEY);
  }

  /**
   * Send password reset email in French or English.
   * Complies with Quebec Law 25 privacy requirements.
   */
  async sendPasswordResetEmail(
    to: string,
    resetToken: string,
    language: 'fr' | 'en' = 'fr'
  ): Promise<boolean> {
    try {
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/auth/reset-password?token=${resetToken}`;
      
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
                
                <p>Bonjour,</p>
                
                <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre compte Koveo Gestion.</p>
                
                <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${resetUrl}" 
                     style="background: #2563eb; color: white; padding: 12px 24px; 
                            text-decoration: none; border-radius: 6px; display: inline-block;">
                    Réinitialiser mon mot de passe
                  </a>
                </div>
                
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

Bonjour,

Vous avez demandé la réinitialisation de votre mot de passe pour votre compte Koveo Gestion.

Cliquez sur ce lien pour créer un nouveau mot de passe :
${resetUrl}

Ce lien expire dans 1 heure pour votre sécurité.

Si vous n'avez pas demandé cette réinitialisation, ignorez ce courriel.

Conforme à la Loi 25 du Québec. Vos données personnelles sont protégées selon les normes de sécurité les plus strictes.

© 2025 Koveo Gestion. Tous droits réservés.`
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
                
                <p>Hello,</p>
                
                <p>You have requested to reset your password for your Koveo Gestion account.</p>
                
                <p>Click the button below to create a new password:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${resetUrl}" 
                     style="background: #2563eb; color: white; padding: 12px 24px; 
                            text-decoration: none; border-radius: 6px; display: inline-block;">
                    Reset My Password
                  </a>
                </div>
                
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

Hello,

You have requested to reset your password for your Koveo Gestion account.

Click this link to create a new password:
${resetUrl}

This link expires in 1 hour for your security.

If you did not request this reset, please ignore this email.

Quebec Law 25 compliant. Your personal data is protected according to the strictest security standards.

© 2025 Koveo Gestion. All rights reserved.`
        }
      };

      const template = templates[language];

      await this.mailService.send({
        to,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject: template.subject,
        text: template.text,
        html: template.html,
      });

      return true;
    } catch (error) {
      console.error('Password reset email error:', error);
      return false;
    }
  }

  /**
   * Send test email to verify SendGrid configuration.
   */
  async sendTestEmail(to: string): Promise<boolean> {
    try {
      await this.mailService.send({
        to,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject: 'Test Email - Koveo Gestion',
        text: 'This is a test email to verify SendGrid configuration.',
        html: '<p>This is a test email to verify SendGrid configuration.</p>',
      });

      return true;
    } catch (error) {
      console.error('Test email error:', error);
      return false;
    }
  }
}

// Create singleton instance
export const emailService = new EmailService();
export { EmailService };