import { MailService } from '@sendgrid/mail';
import { createHash } from 'crypto';


/**
 * Email template data interface.
 */
interface EmailTemplateData {
  recipientName: string;
  recipientEmail: string;
  invitationToken?: string;
  invitationUrl?: string;
  organizationName?: string;
  inviterName?: string;
  expiryDate?: Date;
  language: 'fr' | 'en';
  unsubscribeToken: string;
  privacyNoticeUrl?: string;
}

/**
 * Email types supported by the system.
 */
export type EmailType = 'invitation' | 'reminder' | 'welcome';

/**
 * Email template structure with HTML and text versions.
 */
interface EmailTemplate {
  subject: {
    fr: string;
    en: string;
  };
  html: {
    fr: string;
    en: string;
  };
  text: {
    fr: string;
    en: string;
  };
}

/**
 * Quebec Law 25 compliant email service for user invitation management.
 * Provides bilingual email templates with accessibility support and privacy compliance.
 */
export class EmailService {
  private mailService: MailService;
  private templates: Map<EmailType, EmailTemplate> = new Map();
  private baseUrl: string;
  private fromAddress: string;
  private isInitialized: boolean = false;

  /**
   *
   */
  constructor() {
    this.mailService = new MailService();
    this.baseUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
    this.fromAddress = process.env.EMAIL_FROM || 'kevin.hervieux@koveo-gestion.com';
    this.initializeTemplates();
    
    // Initialize immediately if API key is available
    if (process.env.SENDGRID_API_KEY) {
      this.initialize().catch(error => {
        console.error('❌ Failed to initialize email service in constructor:', error);
      });
    }
  }

  /**
   * Initializes the SendGrid service with API key.
   */
  async initialize(): Promise<void> {
    const apiKey = process.env.SENDGRID_API_KEY;
    
    if (!apiKey) {
      console.warn('SENDGRID_API_KEY not configured. Email service will not function.');
      this.isInitialized = false;
      return;
    }

    try {
      this.mailService.setApiKey(apiKey);
      this.isInitialized = true;
      console.log('✅ SendGrid email service initialized successfully');
    } catch (_error) {
      console.error('❌ Failed to initialize SendGrid email service:', _error);
      this.isInitialized = false;
    }
  }

  /**
   * Initializes bilingual email templates with Quebec Law 25 compliance.
   */
  private initializeTemplates(): void {
    // Invitation email template
    this.templates.set('invitation', {
      subject: {
        fr: 'Invitation à rejoindre {{organizationName}} - Koveo Gestion',
        en: 'Invitation to join {{organizationName}} - Koveo Gestion',
      },
      html: {
        fr: this.getInvitationTemplateHTML('fr'),
        en: this.getInvitationTemplateHTML('en'),
      },
      text: {
        fr: this.getInvitationTemplateText('fr'),
        en: this.getInvitationTemplateText('en'),
      },
    });

    // Reminder email template
    this.templates.set('reminder', {
      subject: {
        fr: 'Rappel : Invitation à rejoindre {{organizationName}}',
        en: 'Reminder: Invitation to join {{organizationName}}',
      },
      html: {
        fr: this.getReminderTemplateHTML('fr'),
        en: this.getReminderTemplateHTML('en'),
      },
      text: {
        fr: this.getReminderTemplateText('fr'),
        en: this.getReminderTemplateText('en'),
      },
    });

    // Welcome email template
    this.templates.set('welcome', {
      subject: {
        fr: 'Bienvenue dans {{organizationName}} - Koveo Gestion',
        en: 'Welcome to {{organizationName}} - Koveo Gestion',
      },
      html: {
        fr: this.getWelcomeTemplateHTML('fr'),
        en: this.getWelcomeTemplateHTML('en'),
      },
      text: {
        fr: this.getWelcomeTemplateText('fr'),
        en: this.getWelcomeTemplateText('en'),
      },
    });
  }

  /**
   * Generates a secure unsubscribe token for the recipient.
   * @param email
   */
  private generateUnsubscribeToken(email: string): string {
    const secret = process.env.UNSUBSCRIBE_SECRET || 'koveo-unsubscribe-secret';
    return createHash('sha256').update(`${email}:${secret}`).digest('hex');
  }

  /**
   * Replaces template variables with actual data.
   * @param template
   * @param data
   */
  private processTemplate(template: string, data: EmailTemplateData): string {
    return template
      .replace(/\{\{recipientName\}\}/g, data.recipientName)
      .replace(/\{\{recipientEmail\}\}/g, data.recipientEmail)
      .replace(/\{\{organizationName\}\}/g, data.organizationName || 'Koveo Gestion')
      .replace(/\{\{inviterName\}\}/g, data.inviterName || '')
      .replace(/\{\{invitationUrl\}\}/g, data.invitationUrl || '')
      .replace(/\{\{expiryDate\}\}/g, data.expiryDate?.toLocaleDateString(data.language === 'fr' ? 'fr-CA' : 'en-CA') || '')
      .replace(/\{\{unsubscribeUrl\}\}/g, `${this.baseUrl}/api/email/unsubscribe?token=${data.unsubscribeToken}&email=${encodeURIComponent(data.recipientEmail)}`)
      .replace(/\{\{privacyUrl\}\}/g, data.privacyNoticeUrl || `${this.baseUrl}/privacy`);
  }

  /**
   * Sends an email using the configured transporter.
   * @param type
   * @param to
   * @param data
   */
  async sendEmail(
    type: EmailType,
    to: string,
    data: EmailTemplateData
  ): Promise<boolean> {
    console.log(`📬 Attempting to send ${type} email to ${to}`);
    console.log(`📧 Using sender address: ${this.fromAddress}`);
    console.log(`🔧 Service initialized: ${this.isInitialized}`);
    
    if (!this.isInitialized) {
      console.error('SendGrid email service not initialized');
      return false;
    }

    const template = this.templates.get(type);
    if (!template) {
      console.error(`Template not found for type: ${type}`);
      return false;
    }

    const language = data.language;
    data.unsubscribeToken = this.generateUnsubscribeToken(to);

    try {
      const subject = this.processTemplate(template.subject[language], data);
      const html = this.processTemplate(template.html[language], data);
      const text = this.processTemplate(template.text[language], data);

      await this.mailService.send({
        from: {
          name: language === 'fr' ? 'Koveo Gestion' : 'Koveo Management',
          email: this.fromAddress,
        },
        to,
        subject,
        html,
        text,
        replyTo: {
          name: 'Kevin Hervieux',
          email: 'kevin.hervieux@koveo-gestion.com',
        },
        headers: {
          'List-Unsubscribe': `<${this.baseUrl}/api/email/unsubscribe?token=${data.unsubscribeToken}&email=${encodeURIComponent(to)}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          'X-Mailer': 'Koveo Gestion Platform',
          'X-Priority': '3',
        },
        categories: ['invitation', 'user-management'],
        customArgs: {
          'invitation_type': type,
          'organization': data.organizationName || 'unknown'
        }
      });

      console.log(`✅ ${type} email sent successfully to ${to}`);
      console.log(`📧 Email details: From: ${this.fromAddress}, Subject: ${subject}`);
      return true;
    } catch (_error) {
      console.error(`❌ Failed to send ${type} email to ${to}:`, _error);
      console.error('❌ SendGrid Error Details:', {
        message: _error?.message,
        code: _error?.code,
        response: _error?.response?.body
      });
      return false;
    }
  }

  /**
   * Sends invitation email with secure token.
   * @param recipientEmail
   * @param recipientName
   * @param invitationToken
   * @param organizationName
   * @param inviterName
   * @param expiryDate
   * @param language
   */
  async sendInvitationEmail(
    recipientEmail: string,
    recipientName: string,
    invitationToken: string,
    organizationName: string,
    inviterName: string,
    expiryDate: Date,
    language: 'fr' | 'en' = 'fr'
  ): Promise<boolean> {
    // Direct link to user registration with the invitation token
    const invitationUrl = `https://koveo-gestion.com/register?invitation=${invitationToken}`;
    
    return this.sendEmail('invitation', recipientEmail, {
      recipientName,
      recipientEmail,
      invitationToken,
      invitationUrl,
      organizationName,
      inviterName,
      expiryDate,
      language,
      unsubscribeToken: '', // Will be generated in sendEmail
    });
  }

  /**
   * Sends reminder email for pending invitations.
   * @param recipientEmail
   * @param recipientName
   * @param invitationToken
   * @param organizationName
   * @param expiryDate
   * @param language
   */
  async sendReminderEmail(
    recipientEmail: string,
    recipientName: string,
    invitationToken: string,
    organizationName: string,
    expiryDate: Date,
    language: 'fr' | 'en' = 'fr'
  ): Promise<boolean> {
    const invitationUrl = `${this.baseUrl}/accept-invitation?token=${invitationToken}`;
    
    return this.sendEmail('reminder', recipientEmail, {
      recipientName,
      recipientEmail,
      invitationToken,
      invitationUrl,
      organizationName,
      expiryDate,
      language,
      unsubscribeToken: '', // Will be generated in sendEmail
    });
  }

  /**
   * Sends welcome email for completed registrations.
   * @param recipientEmail
   * @param recipientName
   * @param organizationName
   * @param language
   */
  async sendWelcomeEmail(
    recipientEmail: string,
    recipientName: string,
    organizationName: string,
    language: 'fr' | 'en' = 'fr'
  ): Promise<boolean> {
    return this.sendEmail('welcome', recipientEmail, {
      recipientName,
      recipientEmail,
      organizationName,
      language,
      unsubscribeToken: '', // Will be generated in sendEmail
    });
  }

  /**
   * Verifies unsubscribe token and marks user as unsubscribed.
   * @param email
   * @param token
   */
  verifyUnsubscribeToken(email: string, token: string): boolean {
    const expectedToken = this.generateUnsubscribeToken(email);
    return token === expectedToken;
  }

  // Template methods (HTML versions)
  /**
   *
   * @param language
   */
  private getInvitationTemplateHTML(language: 'fr' | 'en'): string {
    if (language === 'fr') {
      return `
<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invitation - Koveo Gestion</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 10px; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
        .button:hover { background: #1d4ed8; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
        .privacy-notice { background: #f8f9fa; padding: 15px; margin: 20px 0; border-left: 4px solid #2563eb; border-radius: 4px; }
        .expiry-warning { background: #fef3c7; padding: 10px; border-radius: 4px; margin: 15px 0; color: #92400e; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Koveo Gestion</div>
            <h1>Invitation à rejoindre {{organizationName}}</h1>
        </div>
        
        <p>Bonjour {{recipientName}},</p>
        
        <p>Vous avez été invité(e) par <strong>{{inviterName}}</strong> à rejoindre <strong>{{organizationName}}</strong> sur la plateforme Koveo Gestion.</p>
        
        <p>Koveo Gestion est une plateforme de gestion immobilière conçue spécifiquement pour les communautés résidentielles du Québec, offrant des outils complets pour la documentation, le suivi de la maintenance et la gestion financière.</p>
        
        <div class="expiry-warning">
            <strong>⏰ Important :</strong> Cette invitation expire le {{expiryDate}}
        </div>
        
        <div style="text-align: center;">
            <a href="{{invitationUrl}}" class="button">Accepter l'invitation</a>
        </div>
        
        <p>Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :</p>
        <p style="background: #f8f9fa; padding: 10px; word-break: break-all; border-radius: 4px;">{{invitationUrl}}</p>
        
        <div class="privacy-notice">
            <h3>🔒 Confidentialité et Loi 25</h3>
            <p>Vos données personnelles sont protégées conformément à la Loi 25 du Québec sur la protection des renseignements personnels. En acceptant cette invitation, vous consentez à ce que vos informations soient utilisées uniquement pour la gestion de votre propriété et la communication avec votre organisation.</p>
            <p><a href="{{privacyUrl}}">Consulter notre politique de confidentialité</a></p>
        </div>
        
        <div class="footer">
            <p>Si vous ne souhaitez plus recevoir ces emails, <a href="{{unsubscribeUrl}}">cliquez ici pour vous désabonner</a>.</p>
            <p>© 2025 Koveo Gestion. Tous droits réservés.</p>
            <p>Conforme à la Loi 25 du Québec sur la protection des renseignements personnels.</p>
        </div>
    </div>
</body>
</html>`;
    } else {
      return `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invitation - Koveo Management</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 10px; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
        .button:hover { background: #1d4ed8; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
        .privacy-notice { background: #f8f9fa; padding: 15px; margin: 20px 0; border-left: 4px solid #2563eb; border-radius: 4px; }
        .expiry-warning { background: #fef3c7; padding: 10px; border-radius: 4px; margin: 15px 0; color: #92400e; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Koveo Management</div>
            <h1>Invitation to join {{organizationName}}</h1>
        </div>
        
        <p>Hello {{recipientName}},</p>
        
        <p>You have been invited by <strong>{{inviterName}}</strong> to join <strong>{{organizationName}}</strong> on the Koveo Management platform.</p>
        
        <p>Koveo Management is a property management platform designed specifically for Quebec's residential communities, offering comprehensive tools for documentation, maintenance tracking, and financial management.</p>
        
        <div class="expiry-warning">
            <strong>⏰ Important:</strong> This invitation expires on {{expiryDate}}
        </div>
        
        <div style="text-align: center;">
            <a href="{{invitationUrl}}" class="button">Accept Invitation</a>
        </div>
        
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="background: #f8f9fa; padding: 10px; word-break: break-all; border-radius: 4px;">{{invitationUrl}}</p>
        
        <div class="privacy-notice">
            <h3>🔒 Privacy and Quebec Law 25</h3>
            <p>Your personal data is protected in compliance with Quebec Law 25 on the protection of personal information. By accepting this invitation, you consent to your information being used solely for property management and communication with your organization.</p>
            <p><a href="{{privacyUrl}}">View our privacy policy</a></p>
        </div>
        
        <div class="footer">
            <p>If you no longer wish to receive these emails, <a href="{{unsubscribeUrl}}">click here to unsubscribe</a>.</p>
            <p>© 2025 Koveo Management. All rights reserved.</p>
            <p>Compliant with Quebec Law 25 on the protection of personal information.</p>
        </div>
    </div>
</body>
</html>`;
    }
  }

  // Template methods (Text versions for accessibility)
  /**
   *
   * @param language
   */
  private getInvitationTemplateText(language: 'fr' | 'en'): string {
    if (language === 'fr') {
      return `
KOVEO GESTION - INVITATION

Invitation à rejoindre {{organizationName}}

Bonjour {{recipientName}},

Vous avez été invité(e) par {{inviterName}} à rejoindre {{organizationName}} sur la plateforme Koveo Gestion.

Koveo Gestion est une plateforme de gestion immobilière conçue spécifiquement pour les communautés résidentielles du Québec, offrant des outils complets pour la documentation, le suivi de la maintenance et la gestion financière.

IMPORTANT : Cette invitation expire le {{expiryDate}}

Pour accepter l'invitation, visitez ce lien :
{{invitationUrl}}

CONFIDENTIALITÉ ET LOI 25
Vos données personnelles sont protégées conformément à la Loi 25 du Québec sur la protection des renseignements personnels. En acceptant cette invitation, vous consentez à ce que vos informations soient utilisées uniquement pour la gestion de votre propriété et la communication avec votre organisation.

Politique de confidentialité : {{privacyUrl}}

Pour vous désabonner de ces emails : {{unsubscribeUrl}}

© 2025 Koveo Gestion. Tous droits réservés.
Conforme à la Loi 25 du Québec sur la protection des renseignements personnels.`;
    } else {
      return `
KOVEO MANAGEMENT - INVITATION

Invitation to join {{organizationName}}

Hello {{recipientName}},

You have been invited by {{inviterName}} to join {{organizationName}} on the Koveo Management platform.

Koveo Management is a property management platform designed specifically for Quebec's residential communities, offering comprehensive tools for documentation, maintenance tracking, and financial management.

IMPORTANT: This invitation expires on {{expiryDate}}

To accept the invitation, visit this link:
{{invitationUrl}}

PRIVACY AND QUEBEC LAW 25
Your personal data is protected in compliance with Quebec Law 25 on the protection of personal information. By accepting this invitation, you consent to your information being used solely for property management and communication with your organization.

Privacy policy: {{privacyUrl}}

To unsubscribe from these emails: {{unsubscribeUrl}}

© 2025 Koveo Management. All rights reserved.
Compliant with Quebec Law 25 on the protection of personal information.`;
    }
  }

  // Additional template methods for reminder and welcome emails...
  /**
   *
   * @param language
   */
  private getReminderTemplateHTML(language: 'fr' | 'en'): string {
    if (language === 'fr') {
      return `
<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rappel d'invitation - Koveo Gestion</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 10px; }
        .button { display: inline-block; background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
        .button:hover { background: #b91c1c; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
        .urgent-notice { background: #fef2f2; padding: 15px; margin: 20px 0; border-left: 4px solid #dc2626; border-radius: 4px; color: #991b1b; }
        .expiry-warning { background: #fef3c7; padding: 10px; border-radius: 4px; margin: 15px 0; color: #92400e; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Koveo Gestion</div>
            <h1>🔔 Rappel : Invitation en attente</h1>
        </div>
        
        <p>Bonjour {{recipientName}},</p>
        
        <div class="urgent-notice">
            <h3>⚠️ Invitation expira bientôt</h3>
            <p>Nous vous rappelons que votre invitation à rejoindre <strong>{{organizationName}}</strong> expire le <strong>{{expiryDate}}</strong>.</p>
        </div>
        
        <p>N'oubliez pas d'accepter votre invitation pour accéder à votre espace de gestion immobilière sur Koveo Gestion.</p>
        
        <div style="text-align: center;">
            <a href="{{invitationUrl}}" class="button">Accepter l'invitation maintenant</a>
        </div>
        
        <p>Lien direct : {{invitationUrl}}</p>
        
        <div class="footer">
            <p>Si vous ne souhaitez plus recevoir ces rappels, <a href="{{unsubscribeUrl}}">cliquez ici pour vous désabonner</a>.</p>
            <p>© 2025 Koveo Gestion. Conforme à la Loi 25.</p>
        </div>
    </div>
</body>
</html>`;
    } else {
      return `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invitation Reminder - Koveo Management</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 10px; }
        .button { display: inline-block; background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
        .button:hover { background: #b91c1c; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
        .urgent-notice { background: #fef2f2; padding: 15px; margin: 20px 0; border-left: 4px solid #dc2626; border-radius: 4px; color: #991b1b; }
        .expiry-warning { background: #fef3c7; padding: 10px; border-radius: 4px; margin: 15px 0; color: #92400e; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Koveo Management</div>
            <h1>🔔 Reminder: Pending Invitation</h1>
        </div>
        
        <p>Hello {{recipientName}},</p>
        
        <div class="urgent-notice">
            <h3>⚠️ Invitation Expiring Soon</h3>
            <p>This is a reminder that your invitation to join <strong>{{organizationName}}</strong> expires on <strong>{{expiryDate}}</strong>.</p>
        </div>
        
        <p>Don't forget to accept your invitation to access your property management space on Koveo Management.</p>
        
        <div style="text-align: center;">
            <a href="{{invitationUrl}}" class="button">Accept Invitation Now</a>
        </div>
        
        <p>Direct link: {{invitationUrl}}</p>
        
        <div class="footer">
            <p>If you no longer wish to receive these reminders, <a href="{{unsubscribeUrl}}">click here to unsubscribe</a>.</p>
            <p>© 2025 Koveo Management. Quebec Law 25 compliant.</p>
        </div>
    </div>
</body>
</html>`;
    }
  }

  /**
   *
   * @param language
   */
  private getReminderTemplateText(language: 'fr' | 'en'): string {
    if (language === 'fr') {
      return `
KOVEO GESTION - RAPPEL D'INVITATION

🔔 Rappel : Invitation en attente

Bonjour {{recipientName}},

⚠️ INVITATION EXPIRA BIENTÔT

Nous vous rappelons que votre invitation à rejoindre {{organizationName}} expire le {{expiryDate}}.

N'oubliez pas d'accepter votre invitation pour accéder à votre espace de gestion immobilière sur Koveo Gestion.

Accepter l'invitation : {{invitationUrl}}

Pour vous désabonner : {{unsubscribeUrl}}

© 2025 Koveo Gestion. Conforme à la Loi 25.`;
    } else {
      return `
KOVEO MANAGEMENT - INVITATION REMINDER

🔔 Reminder: Pending Invitation

Hello {{recipientName}},

⚠️ INVITATION EXPIRING SOON

This is a reminder that your invitation to join {{organizationName}} expires on {{expiryDate}}.

Don't forget to accept your invitation to access your property management space on Koveo Management.

Accept invitation: {{invitationUrl}}

To unsubscribe: {{unsubscribeUrl}}

© 2025 Koveo Management. Quebec Law 25 compliant.`;
    }
  }

  /**
   *
   * @param language
   */
  private getWelcomeTemplateHTML(language: 'fr' | 'en'): string {
    if (language === 'fr') {
      return `
<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bienvenue - Koveo Gestion</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 10px; }
        .button { display: inline-block; background: #059669; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
        .button:hover { background: #047857; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
        .welcome-notice { background: #f0fdf4; padding: 15px; margin: 20px 0; border-left: 4px solid #059669; border-radius: 4px; }
        .features-list { background: #f8fafc; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .features-list ul { margin: 0; padding-left: 20px; }
        .features-list li { margin: 8px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Koveo Gestion</div>
            <h1>🎉 Bienvenue dans {{organizationName}} !</h1>
        </div>
        
        <p>Cher(ère) {{recipientName}},</p>
        
        <div class="welcome-notice">
            <h3>✅ Inscription réussie</h3>
            <p>Félicitations ! Votre compte a été créé avec succès sur Koveo Gestion. Vous pouvez maintenant accéder à tous les outils de gestion immobilière de votre organisation.</p>
        </div>
        
        <div class="features-list">
            <h3>🏠 Fonctionnalités disponibles :</h3>
            <ul>
                <li>Gestion des documents immobiliers</li>
                <li>Suivi des demandes de maintenance</li>
                <li>Consultation des états financiers</li>
                <li>Communication avec votre syndic</li>
                <li>Accès aux assemblées et procès-verbaux</li>
                <li>Plateforme entièrement bilingue (français/anglais)</li>
            </ul>
        </div>
        
        <div style="text-align: center;">
            <a href="{{invitationUrl}}" class="button">Accéder à votre espace</a>
        </div>
        
        <p><strong>Conformité Loi 25 :</strong> Vos données personnelles sont protégées selon les plus hauts standards de sécurité et de confidentialité, en conformité avec la réglementation québécoise.</p>
        
        <div class="footer">
            <p>Pour toute question ou assistance, contactez le support technique.</p>
            <p>Si vous ne souhaitez plus recevoir ces emails, <a href="{{unsubscribeUrl}}">cliquez ici pour vous désabonner</a>.</p>
            <p>© 2025 Koveo Gestion. Tous droits réservés.</p>
        </div>
    </div>
</body>
</html>`;
    } else {
      return `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome - Koveo Management</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 10px; }
        .button { display: inline-block; background: #059669; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
        .button:hover { background: #047857; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
        .welcome-notice { background: #f0fdf4; padding: 15px; margin: 20px 0; border-left: 4px solid #059669; border-radius: 4px; }
        .features-list { background: #f8fafc; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .features-list ul { margin: 0; padding-left: 20px; }
        .features-list li { margin: 8px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Koveo Management</div>
            <h1>🎉 Welcome to {{organizationName}}!</h1>
        </div>
        
        <p>Dear {{recipientName}},</p>
        
        <div class="welcome-notice">
            <h3>✅ Registration Successful</h3>
            <p>Congratulations! Your account has been successfully created on Koveo Management. You now have access to all your organization's property management tools.</p>
        </div>
        
        <div class="features-list">
            <h3>🏠 Available Features:</h3>
            <ul>
                <li>Property document management</li>
                <li>Maintenance request tracking</li>
                <li>Financial statement access</li>
                <li>Communication with your property manager</li>
                <li>Access to meetings and minutes</li>
                <li>Fully bilingual platform (French/English)</li>
            </ul>
        </div>
        
        <div style="text-align: center;">
            <a href="{{invitationUrl}}" class="button">Access Your Dashboard</a>
        </div>
        
        <p><strong>Law 25 Compliance:</strong> Your personal data is protected according to the highest security and privacy standards, in compliance with Quebec regulations.</p>
        
        <div class="footer">
            <p>For any questions or assistance, contact technical support.</p>
            <p>If you no longer wish to receive these emails, <a href="{{unsubscribeUrl}}">click here to unsubscribe</a>.</p>
            <p>© 2025 Koveo Management. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
    }
  }

  /**
   *
   * @param language
   */
  private getWelcomeTemplateText(language: 'fr' | 'en'): string {
    if (language === 'fr') {
      return `
KOVEO GESTION - BIENVENUE

🎉 Bienvenue dans {{organizationName}} !

Cher(ère) {{recipientName}},

✅ INSCRIPTION RÉUSSIE

Félicitations ! Votre compte a été créé avec succès sur Koveo Gestion. Vous pouvez maintenant accéder à tous les outils de gestion immobilière de votre organisation.

🏠 FONCTIONNALITÉS DISPONIBLES :
• Gestion des documents immobiliers
• Suivi des demandes de maintenance
• Consultation des états financiers
• Communication avec votre syndic
• Accès aux assemblées et procès-verbaux
• Plateforme entièrement bilingue (français/anglais)

Accéder à votre espace : {{invitationUrl}}

CONFORMITÉ LOI 25 : Vos données personnelles sont protégées selon les plus hauts standards de sécurité et de confidentialité, en conformité avec la réglementation québécoise.

Pour toute question ou assistance, contactez le support technique.

Pour vous désabonner : {{unsubscribeUrl}}

© 2025 Koveo Gestion. Tous droits réservés.`;
    } else {
      return `
KOVEO MANAGEMENT - WELCOME

🎉 Welcome to {{organizationName}}!

Dear {{recipientName}},

✅ REGISTRATION SUCCESSFUL

Congratulations! Your account has been successfully created on Koveo Management. You now have access to all your organization's property management tools.

🏠 AVAILABLE FEATURES:
• Property document management
• Maintenance request tracking
• Financial statement access
• Communication with your property manager
• Access to meetings and minutes
• Fully bilingual platform (French/English)

Access your dashboard: {{invitationUrl}}

LAW 25 COMPLIANCE: Your personal data is protected according to the highest security and privacy standards, in compliance with Quebec regulations.

For any questions or assistance, contact technical support.

To unsubscribe: {{unsubscribeUrl}}

© 2025 Koveo Management. All rights reserved.`;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();