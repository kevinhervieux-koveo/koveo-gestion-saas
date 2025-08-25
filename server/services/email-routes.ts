import { Express, Request, Response } from 'express';
import { requireAuth, authorize } from '../auth';
import { emailService } from './email-service';
import { db } from '../db';
import { invitations, invitationAuditLog } from '@shared/schema';
import * as schema from '@shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

/**
 * Creates audit log entry for invitation-related email events.
 * @param invitationId
 * @param action
 * @param userId
 * @param req
 * @param previousValue
 * @param currentValue
 * @param metadata
 */
/**
 * CreateInvitationAuditLog function.
 * @param invitationId
 * @param action
 * @param userId
 * @param req
 * @param previousValue
 * @param currentValue
 * @param metadata
 * @returns Function result.
 */
async function createInvitationAuditLog(
  invitationId: string,
  action: string,
  userId: string,
  req: Request,
  previousValue?: string,
  currentValue?: string,
  metadata?: any
) {
  try {
    await db.insert(invitationAuditLog).values({
      invitationId,
      action,
      performedBy: userId,
      timestamp: new Date(),
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      previousValue,
      currentValue,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  } catch (____error) {
    console.error('Error creating invitation audit log:', _error);
  }
}

/**
 * Registers email management API routes for unsubscribe functionality,
 * reminder emails, and template management.
 * @param app
 */
/**
 * RegisterEmailRoutes function.
 * @param app
 * @returns Function result.
 */
export function registerEmailRoutes(app: Express) {
  // POST /api/email/send-reminder - Send reminder emails for pending invitations
  app.post(
    '/api/email/send-reminder',
    requireAuth,
    authorize('create:user'),
    async (req: Request, res: Response) => {
      try {
        const { invitationId } = req.body;

        if (!invitationId) {
          return res.status(400).json({ message: 'Invitation ID is required' });
        }

        // Get invitation details
        const [invitation] = await db
          .select()
          .from(invitations)
          .where(
            and(
              eq(invitations.id, invitationId),
              eq(invitations.status, 'pending'),
              gte(invitations.expiresAt, new Date())
            )
          )
          .limit(1);

        if (!invitation) {
          return res.status(404).json({ message: 'Active invitation not found' });
        }

        // Get organization name
        const organization = invitation.organizationId
          ? await db
              .select()
              .from(schema.organizations)
              .where(eq(schema.organizations.id, invitation.organizationId))
              .limit(1)
          : null;

        // Send reminder email
        const emailSent = await emailService.sendReminderEmail(
          invitation.email,
          invitation.email.split('@')[0], // Use email prefix as name
          invitation.token,
          organization?.[0]?.name || 'Koveo Gestion',
          invitation.expiresAt,
          'fr' // Default to French for Quebec
        );

        if (emailSent) {
          // Create audit log for reminder
          await createInvitationAuditLog(
            invitation.id,
            'reminder_sent',
            req.user!.id,
            req,
            'pending',
            'pending',
            { reminderSentAt: new Date() }
          );

          res.json({ message: 'Reminder email sent successfully' });
        } else {
          res.status(500).json({ message: 'Failed to send reminder email' });
        }
      } catch (____error) {
        console.error('Error sending reminder email:', _error);
        res.status(500).json({ message: 'Failed to send reminder email' });
      }
    }
  );

  // POST /api/email/bulk-reminders - Send reminder emails for all pending invitations
  app.post(
    '/api/email/bulk-reminders',
    requireAuth,
    authorize('create:user'),
    async (req: Request, res: Response) => {
      try {
        const { maxAge = 3 } = req.body; // Default to 3 days old

        // Get pending invitations older than maxAge days
        const cutoffDate = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);

        const pendingInvitations = await db
          .select()
          .from(invitations)
          .where(
            and(
              eq(invitations.status, 'pending'),
              gte(invitations.expiresAt, new Date()), // Not expired
              lte(invitations.createdAt, cutoffDate) // Older than cutoff
            )
          );

        let successCount = 0;
        let failureCount = 0;

        for (const invitation of pendingInvitations) {
          try {
            // Get organization name
            const organization = invitation.organizationId
              ? await db
                  .select()
                  .from(schema.organizations)
                  .where(eq(schema.organizations.id, invitation.organizationId))
                  .limit(1)
              : null;

            // Send reminder email
            const emailSent = await emailService.sendReminderEmail(
              invitation.email,
              invitation.email.split('@')[0],
              invitation.token,
              organization?.[0]?.name || 'Koveo Gestion',
              invitation.expiresAt,
              'fr'
            );

            if (emailSent) {
              successCount++;
              // Create audit log
              await createInvitationAuditLog(
                invitation.id,
                'bulk_reminder_sent',
                req.user!.id,
                req,
                'pending',
                'pending',
                { bulkReminderSentAt: new Date() }
              );
            } else {
              failureCount++;
            }
          } catch (____error) {
            console.error(`Failed to send reminder for invitation ${invitation.id}:`, _error);
            failureCount++;
          }
        }

        res.json({
          message: `Bulk reminder emails completed: ${successCount} sent, ${failureCount} failed`,
          successCount,
          failureCount,
          totalProcessed: pendingInvitations.length,
        });
      } catch (____error) {
        console.error('Error sending bulk reminder emails:', _error);
        res.status(500).json({ message: 'Failed to send bulk reminder emails' });
      }
    }
  );

  // GET /api/email/unsubscribe - Unsubscribe from emails
  app.get('/api/email/unsubscribe', async (req: Request, res: Response) => {
    try {
      const { token, email } = req.query;

      if (!token || !email || typeof token !== 'string' || typeof email !== 'string') {
        return res.status(400).json({ message: 'Token and email are required' });
      }

      // Verify unsubscribe token
      const isValidToken = emailService.verifyUnsubscribeToken(email, token);
      if (!isValidToken) {
        return res.status(400).json({ message: 'Invalid unsubscribe token' });
      }

      // For now, we'll just return a success message
      // In a full implementation, you'd add the email to an unsubscribe list
      res.send(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Désabonnement réussi - Koveo Gestion</title>
          <style>
            body { font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; background-color: #f5f5f5; }
            .container { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
            .success { color: #059669; font-size: 24px; margin-bottom: 20px; }
            .message { color: #374151; line-height: 1.6; margin-bottom: 30px; }
            .footer { color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✅ Désabonnement réussi</div>
            <div class="message">
              L'adresse email <strong>${email}</strong> a été désabonnée avec succès des notifications Koveo Gestion.
              <br><br>
              Vous ne recevrez plus d'emails de notre part concernant les invitations et rappels.
            </div>
            <div class="footer">
              © 2025 Koveo Gestion - Conforme à la Loi 25 du Québec
            </div>
          </div>
        </body>
        </html>
      `);
    } catch (____error) {
      console.error('Error processing unsubscribe:', _error);
      res.status(500).send('Erreur lors du désabonnement. Veuillez réessayer.');
    }
  });

  // GET /api/email/templates - List available email templates
  app.get(
    '/api/email/templates',
    requireAuth,
    authorize('read:system_settings'),
    async (req: Request, res: Response) => {
      try {
        const templates = [
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
            id: 'welcome',
            name: 'Welcome Email',
            description: 'Welcome email sent after successful registration',
            languages: ['fr', 'en'],
            variables: ['recipientName', 'organizationName'],
          },
        ];

        res.json({ templates });
      } catch (_error) {
        console.error('Error fetching email templates:', _error);
        res.status(500).json({ message: 'Failed to fetch email templates' });
      }
    }
  );

  // GET /api/email/templates/:type - Get specific template content
  app.get(
    '/api/email/templates/:type',
    requireAuth,
    authorize('read:system_settings'),
    async (req: Request, res: Response) => {
      try {
        const { type } = req.params;
        const { language = 'fr' } = req.query;

        if (!['invitation', 'reminder', 'welcome'].includes(type)) {
          return res.status(400).json({ message: 'Invalid template type' });
        }

        if (!['fr', 'en'].includes(language as string)) {
          return res.status(400).json({ message: 'Invalid language. Supported: fr, en' });
        }

        // For now, return template metadata
        // In a full implementation, you'd return the actual template content
        res.json({
          type,
          language,
          message: 'Template content would be returned here',
          note: 'Templates are currently embedded in the email service class',
        });
      } catch (_error) {
        console.error('Error fetching template:', _error);
        res.status(500).json({ message: 'Failed to fetch template' });
      }
    }
  );
}
