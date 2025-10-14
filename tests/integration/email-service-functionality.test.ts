/**
 * Email Service Functionality Test
 * Tests REAL email service with mocked SendGrid to verify templates and logic
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Set env var before any imports
process.env.SENDGRID_API_KEY = 'test-api-key';

// Mock @sendgrid/mail module
jest.mock('@sendgrid/mail');

// Import REAL EmailService AFTER mock
import { EmailService } from '../../server/services/email-service';
import { MailService } from '@sendgrid/mail';

describe('Email Service Functionality Test', () => {
  const testEmail = 'kevin.hervieux@koveo-gestion.com';
  let emailService: EmailService;
  let mockSend: jest.Mock;
  let mockSetApiKey: jest.Mock;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup SendGrid mocks
    mockSend = jest.fn().mockResolvedValue([{ statusCode: 202 }]);
    mockSetApiKey = jest.fn();
    
    // Mock MailService implementation
    (MailService as jest.Mock).mockImplementation(() => ({
      setApiKey: mockSetApiKey,
      send: mockSend,
    }));
    
    // Create REAL EmailService instance
    emailService = new EmailService();
  });

  describe('Password Reset Email', () => {
    it('should send password reset email successfully', async () => {
      const resetUrl = 'https://koveo-gestion.com/reset-password?token=test-token-123';
      
      // Call REAL method
      const emailSent = await emailService.sendPasswordResetEmail(
        testEmail,
        'Kevin Hervieux',
        resetUrl
      );

      // Verify success
      expect(emailSent).toBe(true);
      
      // Verify SendGrid was called with correct structure
      expect(mockSend).toHaveBeenCalledTimes(1);
      const sendCall = mockSend.mock.calls[0][0];
      
      expect(sendCall.to).toBe(testEmail);
      expect(sendCall.from.email).toBe('info@koveo-gestion.com');
      expect(sendCall.subject).toContain('Réinitialisation');
      expect(sendCall.html).toContain(resetUrl);
      expect(sendCall.text).toContain(resetUrl);
    });

    it('should handle password reset email with French content', async () => {
      const resetUrl = 'https://koveo-gestion.com/reset-password?token=test-token-fr-456';
      
      // Call REAL method with French language
      const emailSent = await emailService.sendPasswordResetEmail(
        testEmail,
        'Kevin Hervieux',
        resetUrl,
        'fr'
      );

      expect(emailSent).toBe(true);
      
      // Verify French template content
      const sendCall = mockSend.mock.calls[0][0];
      expect(sendCall.subject).toBe('Réinitialisation de votre mot de passe - Koveo Gestion');
      expect(sendCall.html).toContain('Bonjour Kevin Hervieux');
      expect(sendCall.html).toContain('Réinitialiser mon mot de passe');
      expect(sendCall.text).toContain('Bonjour Kevin Hervieux');
    });
    
    it('should handle password reset email with English content', async () => {
      const resetUrl = 'https://koveo-gestion.com/reset-password?token=test-token-en-789';
      
      // Call REAL method with English language
      const emailSent = await emailService.sendPasswordResetEmail(
        testEmail,
        'Kevin Hervieux',
        resetUrl,
        'en'
      );

      expect(emailSent).toBe(true);
      
      // Verify English template content
      const sendCall = mockSend.mock.calls[0][0];
      expect(sendCall.subject).toBe('Password Reset - Koveo Gestion');
      expect(sendCall.html).toContain('Hello Kevin Hervieux');
      expect(sendCall.html).toContain('Reset My Password');
      expect(sendCall.text).toContain('Hello Kevin Hervieux');
    });
  });

  describe('User Invitation Email', () => {
    it('should send user invitation email successfully', async () => {
      const invitationData = {
        email: testEmail,
        inviterName: 'System Administrator',
        invitationUrl: 'https://koveo-gestion.com/invitation/test-token-789',
        organizationName: 'Koveo Gestion Test',
        language: 'fr' as const
      };

      // Call REAL method with correct signature
      const emailSent = await emailService.sendInvitationEmail(
        invitationData.email,
        invitationData.inviterName,
        invitationData.invitationUrl,
        invitationData.organizationName,
        invitationData.language
      );

      expect(emailSent).toBe(true);
      
      // Verify SendGrid was called
      expect(mockSend).toHaveBeenCalledTimes(1);
      const sendCall = mockSend.mock.calls[0][0];
      
      expect(sendCall.to).toBe(testEmail);
      expect(sendCall.subject).toContain('Invitation');
      expect(sendCall.html).toContain(invitationData.organizationName);
      expect(sendCall.html).toContain(invitationData.inviterName);
    });
  });

  describe('Notification Email Functionality', () => {
    it('should send notification email successfully', async () => {
      const title = 'Bienvenue dans Koveo Gestion';
      const message = 'Votre compte administrateur a été configuré avec succès.';

      // Call REAL method
      const emailSent = await emailService.sendNotificationEmail(
        testEmail,
        'Kevin Hervieux',
        title,
        message,
        'announcement'
      );

      expect(emailSent).toBe(true);
      
      // Verify SendGrid was called
      expect(mockSend).toHaveBeenCalledTimes(1);
      const sendCall = mockSend.mock.calls[0][0];
      
      expect(sendCall.to).toBe(testEmail);
      expect(sendCall.subject).toContain('Annonce importante');
      expect(sendCall.html).toContain(title);
      expect(sendCall.html).toContain(message);
    });

    it('should send general test notification', async () => {
      const testNotification = 'Ce message confirme que le service de courriel fonctionne correctement.';

      // Call REAL method
      const emailSent = await emailService.sendNotificationEmail(
        testEmail,
        'Kevin Hervieux',
        'Test Notification',
        testNotification,
        'announcement',
        'fr'
      );

      expect(emailSent).toBe(true);
      
      // Verify real template was used
      const sendCall = mockSend.mock.calls[0][0];
      expect(sendCall.html).toContain(testNotification);
      expect(sendCall.text).toContain(testNotification);
    });
  });
});
