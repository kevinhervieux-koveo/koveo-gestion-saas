import express from 'express';
import { z } from 'zod';
import { emailService } from '../services/email-service';
import { maskEmail } from '../utils/logger';

const router = express.Router();

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
  language: z.enum(['fr', 'en']).optional().default('fr'),
});

type TrialRequestData = z.infer<typeof trialRequestSchema>;

/**
 * POST /api/trial-requests
 * Sends a trial request email to Koveo Gestion.
 * Sends both admin notification and user confirmation emails.
 */
router.post('/trial-requests', async (req, res) => {
  try {
    // Validate request data
    const validationResult = trialRequestSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Invalid request data',
        errors: validationResult.error.issues,
      });
    }

    const data: TrialRequestData = validationResult.data;
    const language = data.language || 'fr';

    // Track email sending results
    let adminEmailSent = false;
    let confirmationEmailSent = false;
    const errors: string[] = [];

    // Attempt to send admin notification email
    try {
      console.log(`📧 Sending admin notification for trial request from ${data.company} (${maskEmail(data.email)})`);
      adminEmailSent = await emailService.sendTrialRequestAdminNotification({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        company: data.company,
        address: data.address,
        city: data.city,
        province: data.province,
        postalCode: data.postalCode,
        numberOfBuildings: data.numberOfBuildings,
        numberOfResidences: data.numberOfResidences,
        message: data.message,
      });

      if (!adminEmailSent) {
        const errorMsg = 'Failed to send admin notification email';
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    } catch (adminError: any) {
      const errorMsg = `Admin email error: ${adminError.message || 'Unknown error'}`;
      console.error('❌ Error sending admin notification:', adminError);
      
      // Log detailed SendGrid error information
      if (adminError.response) {
        console.error('SendGrid API response:', {
          statusCode: adminError.response?.statusCode,
          body: adminError.response?.body,
          headers: adminError.response?.headers,
        });
      }
      
      errors.push(errorMsg);
    }

    // Attempt to send user confirmation email
    try {
      console.log(`📧 Sending confirmation email to ${maskEmail(data.email)} in ${language}`);
      confirmationEmailSent = await emailService.sendTrialRequestConfirmation(
        {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          company: data.company,
          numberOfBuildings: data.numberOfBuildings,
          numberOfResidences: data.numberOfResidences,
        },
        language
      );

      if (!confirmationEmailSent) {
        const errorMsg = 'Failed to send confirmation email to requester';
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    } catch (confirmError: any) {
      const errorMsg = `Confirmation email error: ${confirmError.message || 'Unknown error'}`;
      console.error('❌ Error sending confirmation email:', confirmError);
      
      // Log detailed SendGrid error information
      if (confirmError.response) {
        console.error('SendGrid API response:', {
          statusCode: confirmError.response?.statusCode,
          body: confirmError.response?.body,
          headers: confirmError.response?.headers,
        });
      }
      
      errors.push(errorMsg);
    }

    // Determine overall success status
    if (!adminEmailSent && !confirmationEmailSent) {
      // Both emails failed
      console.error(`❌ Both trial request emails failed for ${data.company} (${maskEmail(data.email)})`);
      return res.status(500).json({
        message: 'Failed to send trial request emails',
        success: false,
        errors,
      });
    } else if (!adminEmailSent) {
      // Only admin email failed
      console.warn(`⚠️ Admin notification failed but confirmation sent for ${data.company} (${maskEmail(data.email)})`);
      return res.status(207).json({
        message: 'Trial request partially processed - admin notification failed',
        success: true,
        partial: true,
        adminEmailSent: false,
        confirmationEmailSent: true,
        errors,
      });
    } else if (!confirmationEmailSent) {
      // Only confirmation email failed
      console.warn(`⚠️ Confirmation email failed but admin notified for ${data.company} (${maskEmail(data.email)})`);
      return res.status(207).json({
        message: 'Trial request partially processed - confirmation email failed',
        success: true,
        partial: true,
        adminEmailSent: true,
        confirmationEmailSent: false,
        errors,
      });
    } else {
      // Both emails succeeded
      console.log(`✅ Trial request processed successfully for ${data.company} (${maskEmail(data.email)})`);
      return res.status(200).json({
        message: 'Trial request sent successfully',
        success: true,
        adminEmailSent: true,
        confirmationEmailSent: true,
      });
    }

  } catch (error: any) {
    console.error('❌ Error processing trial request:', error);

    // Log detailed error information
    if (error.response) {
      console.error('SendGrid API error details:', {
        statusCode: error.response?.statusCode,
        body: error.response?.body,
        headers: error.response?.headers,
      });
    } else if (error.code) {
      console.error('Error code:', error.code);
    }

    return res.status(500).json({
      message: 'Internal server error while processing trial request',
      error: error.message || 'Failed to process request',
      success: false,
    });
  }
});

export default router;

// Export registration function for consistency with other modules
export function registerTrialRequestRoutes(app: express.Application) {
  app.use('/api', router);
}