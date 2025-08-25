import express from 'express';
import { z } from 'zod';
import { MailService } from '@sendgrid/mail';

const router = express.Router();

// Initialize SendGrid
if (!process.env.SENDGRID_API_KEY) {
  console.warn('⚠️ SENDGRID_API_KEY not found - trial request emails will not be sent');
}

const mailService = new MailService();
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

// Validation schema for trial request
const trialRequestSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email format'),
  phone: z.string().min(1, 'Phone number is required'),
  company: z.string().min(1, 'Company name is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  numberOfBuildings: z.string().refine((val) => parseInt(val) > 0, 'Must be a positive number'),
  numberOfResidences: z.string().refine((val) => parseInt(val) > 0, 'Must be a positive number'),
  message: z.string().optional(),
});

/**
 *
 */
type TrialRequestData = z.infer<typeof trialRequestSchema>;

/**
 * POST /api/trial-request
 * Sends a trial request email to Koveo Gestion.
 */
router.post('/trial-request', async (req, res) => {
  try {
    // Validate request data
    const validationResult = trialRequestSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Invalid request data',
        errors: validationResult.error.issues,
      });
    }

    const _data: TrialRequestData = validationResult.data;

    // Check if SendGrid is configured
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('Trial request received but SendGrid not configured:', _data);
      return res.status(500).json({
        message: 'Email service not configured',
      });
    }

    // Prepare email content
    const emailSubject = `Nouvelle demande d'essai gratuit - ${data.company}`;

    const emailText = `
Nouvelle demande d'essai gratuit pour Koveo Gestion

INFORMATIONS DU CONTACT:
- Nom: ${data.firstName} ${data.lastName}
- Entreprise: ${data.company}
- Courriel: ${data.email}
- Téléphone: ${data.phone}

ADRESSE:
${data.address ? `- Adresse: ${data.address}` : ''}
${data.city ? `- Ville: ${data.city}` : ''}
${data.province ? `- Province: ${data.province}` : ''}
${data.postalCode ? `- Code postal: ${data.postalCode}` : ''}

INFORMATIONS SUR LES PROPRIÉTÉS:
- Nombre de bâtiments: ${data.numberOfBuildings}
- Nombre de résidences: ${data.numberOfResidences}

${data.message ? `MESSAGE ADDITIONNEL:\n${data.message}` : ''}

---
Cette demande a été soumise via le site web Koveo Gestion.
    `.trim();

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Nouvelle demande d'essai gratuit</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9fafb; }
    .section { margin-bottom: 20px; }
    .section h3 { color: #2563eb; margin-bottom: 10px; }
    .info-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 10px; margin-bottom: 10px; }
    .label { font-weight: bold; }
    .highlight { background-color: #dbeafe; padding: 15px; border-radius: 5px; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Nouvelle demande d'essai gratuit</h1>
      <p>Koveo Gestion</p>
    </div>
    
    <div class="content">
      <div class="section">
        <h3>Informations du contact</h3>
        <div class="info-grid">
          <span class="label">Nom:</span>
          <span>${data.firstName} ${data.lastName}</span>
          <span class="label">Entreprise:</span>
          <span>${data.company}</span>
          <span class="label">Courriel:</span>
          <span><a href="mailto:${data.email}">${data.email}</a></span>
          <span class="label">Téléphone:</span>
          <span><a href="tel:${data.phone}">${data.phone}</a></span>
        </div>
      </div>

      ${
        data.address || data.city || data.province || data.postalCode
          ? `
      <div class="section">
        <h3>Adresse</h3>
        <div class="info-grid">
          ${data.address ? `<span class="label">Adresse:</span><span>${data.address}</span>` : ''}
          ${data.city ? `<span class="label">Ville:</span><span>${data.city}</span>` : ''}
          ${data.province ? `<span class="label">Province:</span><span>${data.province}</span>` : ''}
          ${data.postalCode ? `<span class="label">Code postal:</span><span>${data.postalCode}</span>` : ''}
        </div>
      </div>
      `
          : ''
      }

      <div class="section highlight">
        <h3>Informations sur les propriétés</h3>
        <div class="info-grid">
          <span class="label">Nombre de bâtiments:</span>
          <span><strong>${data.numberOfBuildings}</strong></span>
          <span class="label">Nombre de résidences:</span>
          <span><strong>${data.numberOfResidences}</strong></span>
        </div>
      </div>

      ${
        data.message
          ? `
      <div class="section">
        <h3>Message additionnel</h3>
        <p>${data.message.replace(/\n/g, '<br>')}</p>
      </div>
      `
          : ''
      }
      
      <div class="footer">
        <p>Cette demande a été soumise via le site web Koveo Gestion</p>
        <p>Date: ${new Date().toLocaleDateString('fr-CA', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Toronto',
        })}</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();

    // Send email via SendGrid
    const emailData = {
      to: 'info@koveo-gestion.com',
      from: {
        email: 'noreply@koveo-gestion.com',
        name: "Koveo Gestion - Demandes d'essai",
      },
      replyTo: {
        email: data.email,
        name: `${data.firstName} ${data.lastName}`,
      },
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
      trackingSettings: {
        clickTracking: { enable: false },
        openTracking: { enable: false },
        subscriptionTracking: { enable: false },
      },
      mailSettings: {
        sandboxMode: { enable: false },
      },
    };

    await mailService.send(emailData);

    // Log successful request
    console.warn(`✅ Trial request email sent successfully for ${data.company} (${data.email})`);
    console.warn(`   Buildings: ${data.numberOfBuildings}, Residences: ${data.numberOfResidences}`);

    res.status(200).json({
      message: 'Trial request sent successfully',
      success: true,
    });
  } catch (_error) {
    console.error('❌ Error processing trial request:', _error);

    // Send appropriate error response
    if (error && typeof error === 'object' && 'code' in _error) {
      const sgError = error as { code: number; message: string };
      console.error('SendGrid error details:', sgError);

      return res.status(500).json({
        message: 'Failed to send trial request email',
        _error: 'Email service error',
      });
    }

    res.status(500).json({
      message: 'Internal server error',
      _error: 'Failed to process request',
    });
  }
});

export default router;

// Export registration function for consistency with other modules
/**
 *
 * @param app
 * @returns Function result.
 */
export function registerTrialRequestRoutes(app: express.Application) {
  app.use('/', router);
}
