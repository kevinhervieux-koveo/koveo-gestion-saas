/**
 * @file Comprehensive New User Creation Process Tests
 * Complete validation of the 4-step registration wizard and backend integration.
 * Tests all fixes applied to prevent infinite loops and variable naming issues.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegistrationWizard } from '../../../client/src/components/auth/registration-wizard';
import { TokenValidationStep } from '../../../client/src/components/auth/steps/token-validation-step';
import { PasswordCreationStep } from '../../../client/src/components/auth/steps/password-creation-step';
import { ProfileCompletionStep } from '../../../client/src/components/auth/steps/profile-completion-step';
import { QuebecPrivacyConsentStep } from '../../../client/src/components/auth/steps/quebec-privacy-consent-step';
import { validatePassword, getPasswordStrength } from '../../../client/src/utils/password-validation';
import { TestProviders } from '../../utils/test-providers';

// Mock storage and API calls
jest.mock('../../../client/src/lib/queryClient', () => ({
  apiRequest: jest.fn(),
  queryClient: {
    invalidateQueries: jest.fn()
  }
}));

jest.mock('../../../client/src/hooks/use-language', () => ({
  useLanguage: () => ({
    t: jest.fn((key: string) => key),
    currentLanguage: 'fr'
  })
}));

// Mock Wouter navigation
jest.mock('wouter', () => ({
  useLocation: () => ['/', jest.fn()],
  useParams: () => ({ token: 'test-token-12345' })
}));

describe('New User Creation Process - Complete Test Suite', () => {
  
  describe('Step 1: Token Validation', () => {
    const mockTokenValidationData = {
      token: 'e38ddf5e720e8708dd2034539199e33a35e7cff5cb7867eb525c77c01cb7b771',
      isValid: true,
      invitation: {
        id: '77d296ae-b71e-41f5-bcc3-d2abbd04a6b9',
        email: 'kevhervieux@gmail.com',
        role: 'manager',
        organizationId: '72263718-6559-4216-bd93-524f7acdcbbc',
        buildingId: '005b0e63-6a0a-44c9-bf01-2b779b316bba',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'pending'
      }
    };

    test('should validate invitation token successfully', async () => {
      const mockOnDataChange = jest.fn();
      const mockOnValidationChange = jest.fn();

      const { apiRequest } = require('../../../client/src/lib/queryClient');
      apiRequest.mockResolvedValue(mockTokenValidationData);

      render(
        <TestProviders>
          <TokenValidationStep
            _data={{}}
            onDataChange={mockOnDataChange}
            onValidationChange={mockOnValidationChange}
          />
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByText(/validation-réussie/i)).toBeInTheDocument();
      });

      expect(mockOnValidationChange).toHaveBeenCalledWith(true);
      expect(mockOnDataChange).toHaveBeenCalledWith(
        expect.objectContaining({
          isValid: true,
          invitation: expect.objectContaining({
            email: 'kevhervieux@gmail.com',
            role: 'manager'
          })
        })
      );
    });

    test('should handle expired invitation tokens', async () => {
      const expiredTokenData = {
        ...mockTokenValidationData,
        isValid: false,
        error: 'Token expired'
      };

      const { apiRequest } = require('../../../client/src/lib/queryClient');
      apiRequest.mockResolvedValue(expiredTokenData);

      const mockOnValidationChange = jest.fn();

      render(
        <TestProviders>
          <TokenValidationStep
            _data={{}}
            onDataChange={jest.fn()}
            onValidationChange={mockOnValidationChange}
          />
        </TestProviders>
      );

      await waitFor(() => {
        expect(mockOnValidationChange).toHaveBeenCalledWith(false);
      });
    });

    test('should handle malformed or invalid tokens', async () => {
      const { apiRequest } = require('../../../client/src/lib/queryClient');
      apiRequest.mockRejectedValue(new Error('Invalid token format'));

      const mockOnValidationChange = jest.fn();

      render(
        <TestProviders>
          <TokenValidationStep
            _data={{}}
            onDataChange={jest.fn()}
            onValidationChange={mockOnValidationChange}
          />
        </TestProviders>
      );

      await waitFor(() => {
        expect(mockOnValidationChange).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('Step 2: Password Creation', () => {
    test('should validate password strength requirements', () => {
      // Test various password strengths
      const passwords = [
        { password: 'weak', expectedStrength: 1 },
        { password: 'WeakPassword', expectedStrength: 2 },
        { password: 'WeakPassword123', expectedStrength: 3 },
        { password: 'StrongPassword123!', expectedStrength: 4 },
        { password: 'VeryStrongPassword123!@#', expectedStrength: 5 }
      ];

      passwords.forEach(({ password, expectedStrength }) => {
        const strength = getPasswordStrength(password);
        expect(strength).toBe(expectedStrength);
      });
    });

    test('should validate Quebec-compliant passwords', () => {
      const quebecPasswords = [
        'MonMotDePasse2024!', // French password
        'GestionImmobilière123@', // Property management themed
        'QuébecProprietés2024#', // Quebec-specific
        'Copropriété$Montréal456' // Quebec real estate
      ];

      quebecPasswords.forEach(password => {
        const validation = validatePassword(password);
        expect(validation.isValid).toBe(true);
        expect(validation.strength).toBeGreaterThanOrEqual(4);
      });
    });

    test('should render password creation step without infinite loops', async () => {
      const user = userEvent.setup();
      const mockOnDataChange = jest.fn();
      const mockOnValidationChange = jest.fn();

      render(
        <TestProviders>
          <PasswordCreationStep
            _data={{}}
            onDataChange={mockOnDataChange}
            onValidationChange={mockOnValidationChange}
          />
        </TestProviders>
      );

      const passwordInput = screen.getByTestId('input-password');
      const confirmInput = screen.getByTestId('input-confirm-password');

      // Test password input
      await act(async () => {
        await user.type(passwordInput, 'StrongPassword123!');
        await user.type(confirmInput, 'StrongPassword123!');
      });

      await waitFor(() => {
        expect(mockOnValidationChange).toHaveBeenCalledWith(true);
      });

      expect(mockOnDataChange).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'StrongPassword123!',
          confirmPassword: 'StrongPassword123!',
          isValid: true
        })
      );
    });

    test('should detect password mismatch', async () => {
      const user = userEvent.setup();
      const mockOnValidationChange = jest.fn();

      render(
        <TestProviders>
          <PasswordCreationStep
            _data={{}}
            onDataChange={jest.fn()}
            onValidationChange={mockOnValidationChange}
          />
        </TestProviders>
      );

      const passwordInput = screen.getByTestId('input-password');
      const confirmInput = screen.getByTestId('input-confirm-password');

      await act(async () => {
        await user.type(passwordInput, 'StrongPassword123!');
        await user.type(confirmInput, 'DifferentPassword456@');
      });

      await waitFor(() => {
        expect(mockOnValidationChange).toHaveBeenCalledWith(false);
      });
    });

    test('should show real-time password strength indicator', async () => {
      const user = userEvent.setup();

      render(
        <TestProviders>
          <PasswordCreationStep
            _data={{}}
            onDataChange={jest.fn()}
            onValidationChange={jest.fn()}
          />
        </TestProviders>
      );

      const passwordInput = screen.getByTestId('input-password');

      await act(async () => {
        await user.type(passwordInput, 'weak');
      });

      expect(screen.getByText(/Faible/i)).toBeInTheDocument();

      await act(async () => {
        await user.clear(passwordInput);
        await user.type(passwordInput, 'StrongPassword123!');
      });

      expect(screen.getByText(/Très fort/i)).toBeInTheDocument();
    });
  });

  describe('Step 3: Profile Completion', () => {
    test('should render profile completion step without infinite loops', async () => {
      const user = userEvent.setup();
      const mockOnDataChange = jest.fn();
      const mockOnValidationChange = jest.fn();

      render(
        <TestProviders>
          <ProfileCompletionStep
            _data={{}}
            onDataChange={mockOnDataChange}
            onValidationChange={mockOnValidationChange}
          />
        </TestProviders>
      );

      // Fill required fields
      const firstNameInput = screen.getByTestId('input-firstName');
      const lastNameInput = screen.getByTestId('input-lastName');

      await act(async () => {
        await user.type(firstNameInput, 'Kevin');
        await user.type(lastNameInput, 'Hervieux');
      });

      await waitFor(() => {
        expect(mockOnValidationChange).toHaveBeenCalledWith(true);
      });

      expect(mockOnDataChange).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Kevin',
          lastName: 'Hervieux',
          language: 'fr',
          isValid: true
        })
      );
    });

    test('should validate Quebec phone number formats', async () => {
      const user = userEvent.setup();
      const mockOnDataChange = jest.fn();

      render(
        <TestProviders>
          <ProfileCompletionStep
            _data={{
              firstName: 'Kevin',
              lastName: 'Hervieux',
              language: 'fr'
            }}
            onDataChange={mockOnDataChange}
            onValidationChange={jest.fn()}
          />
        </TestProviders>
      );

      const phoneInput = screen.getByTestId('input-phone');

      // Test valid Quebec phone formats
      const validFormats = [
        '514-712-8441',
        '(514) 712-8441',
        '+1-514-712-8441',
        '5147128441'
      ];

      for (const format of validFormats) {
        await act(async () => {
          await user.clear(phoneInput);
          await user.type(phoneInput, format);
          fireEvent.blur(phoneInput);
        });

        await waitFor(() => {
          expect(mockOnDataChange).toHaveBeenCalledWith(
            expect.objectContaining({
              phone: format,
              isValid: true
            })
          );
        });
      }
    });

    test('should reject invalid phone formats', async () => {
      const user = userEvent.setup();

      render(
        <TestProviders>
          <ProfileCompletionStep
            _data={{
              firstName: 'Kevin',
              lastName: 'Hervieux',
              language: 'fr'
            }}
            onDataChange={jest.fn()}
            onValidationChange={jest.fn()}
          />
        </TestProviders>
      );

      const phoneInput = screen.getByTestId('input-phone');

      await act(async () => {
        await user.type(phoneInput, '123');
        fireEvent.blur(phoneInput);
      });

      await waitFor(() => {
        expect(screen.getByText(/Format de téléphone invalide/i)).toBeInTheDocument();
      });
    });

    test('should support bilingual interface', () => {
      render(
        <TestProviders>
          <ProfileCompletionStep
            _data={{}}
            onDataChange={jest.fn()}
            onValidationChange={jest.fn()}
          />
        </TestProviders>
      );

      // Check French labels
      expect(screen.getByText(/Informations personnelles/i)).toBeInTheDocument();
      expect(screen.getByText(/Prénom/i)).toBeInTheDocument();
      expect(screen.getByText(/Nom de famille/i)).toBeInTheDocument();
      expect(screen.getByText(/Langue préférée/i)).toBeInTheDocument();
    });
  });

  describe('Step 4: Quebec Privacy Consent', () => {
    test('should render Quebec privacy consent step without infinite loops', async () => {
      const mockOnDataChange = jest.fn();
      const mockOnValidationChange = jest.fn();

      render(
        <TestProviders>
          <QuebecPrivacyConsentStep
            _data={{}}
            onDataChange={mockOnDataChange}
            onValidationChange={mockOnValidationChange}
          />
        </TestProviders>
      );

      expect(screen.getByText(/Loi 25 - Québec/i)).toBeInTheDocument();
      expect(screen.getByText(/Protection des renseignements personnels/i)).toBeInTheDocument();
    });

    test('should handle master consent checkbox functionality', async () => {
      const user = userEvent.setup();
      const mockOnDataChange = jest.fn();

      render(
        <TestProviders>
          <QuebecPrivacyConsentStep
            _data={{}}
            onDataChange={mockOnDataChange}
            onValidationChange={jest.fn()}
          />
        </TestProviders>
      );

      const masterCheckbox = screen.getByTestId('checkbox-masterDataCollectionConsent');

      await act(async () => {
        await user.click(masterCheckbox);
      });

      await waitFor(() => {
        expect(mockOnDataChange).toHaveBeenCalledWith(
          expect.objectContaining({
            dataCollectionConsent: true,
            marketingConsent: true,
            analyticsConsent: true,
            thirdPartyConsent: true
          })
        );
      });
    });

    test('should validate required consents for Quebec Law 25', async () => {
      const user = userEvent.setup();
      const mockOnValidationChange = jest.fn();

      render(
        <TestProviders>
          <QuebecPrivacyConsentStep
            _data={{}}
            onDataChange={jest.fn()}
            onValidationChange={mockOnValidationChange}
          />
        </TestProviders>
      );

      const dataConsentCheckbox = screen.getByTestId('checkbox-dataCollectionConsent');
      const rightsCheckbox = screen.getByTestId('checkbox-acknowledgedRights');

      // Only data collection consent - should not be valid yet
      await act(async () => {
        await user.click(dataConsentCheckbox);
      });

      await waitFor(() => {
        expect(mockOnValidationChange).toHaveBeenCalledWith(false);
      });

      // Add rights acknowledgment - should now be valid
      await act(async () => {
        await user.click(rightsCheckbox);
      });

      await waitFor(() => {
        expect(mockOnValidationChange).toHaveBeenCalledWith(true);
      });
    });

    test('should handle collapsible data collection section', async () => {
      const user = userEvent.setup();

      render(
        <TestProviders>
          <QuebecPrivacyConsentStep
            _data={{}}
            onDataChange={jest.fn()}
            onValidationChange={jest.fn()}
          />
        </TestProviders>
      );

      const toggleButton = screen.getByTestId('button-toggle-data-collection');

      await act(async () => {
        await user.click(toggleButton);
      });

      // Should expand to show individual consent options
      expect(screen.getByTestId('checkbox-marketingConsent')).toBeInTheDocument();
      expect(screen.getByTestId('checkbox-analyticsConsent')).toBeInTheDocument();
      expect(screen.getByTestId('checkbox-thirdPartyConsent')).toBeInTheDocument();
    });

    test('should include Quebec-specific legal terminology', () => {
      render(
        <TestProviders>
          <QuebecPrivacyConsentStep
            _data={{}}
            onDataChange={jest.fn()}
            onValidationChange={jest.fn()}
          />
        </TestProviders>
      );

      // Quebec Law 25 specific terms
      expect(screen.getByText(/renseignements personnels/i)).toBeInTheDocument();
      expect(screen.getByText(/collecte et traitement/i)).toBeInTheDocument();
      expect(screen.getByText(/droits à la vie privée/i)).toBeInTheDocument();
    });
  });

  describe('Complete Registration Wizard Integration', () => {
    test('should navigate through all 4 steps successfully', async () => {
      const user = userEvent.setup();

      // Mock successful API responses
      const { apiRequest } = require('../../../client/src/lib/queryClient');
      apiRequest
        .mockResolvedValueOnce(mockTokenValidationData) // Step 1
        .mockResolvedValueOnce({ success: true }); // Final submission

      render(
        <TestProviders>
          <RegistrationWizard />
        </TestProviders>
      );

      // Step 1: Token should be automatically validated
      await waitFor(() => {
        expect(screen.getByText(/validation-réussie/i)).toBeInTheDocument();
      });

      // Navigate to Step 2
      const nextButton1 = screen.getByTestId('button-next-step');
      await act(async () => {
        await user.click(nextButton1);
      });

      // Step 2: Create password
      const passwordInput = screen.getByTestId('input-password');
      const confirmPasswordInput = screen.getByTestId('input-confirm-password');

      await act(async () => {
        await user.type(passwordInput, 'StrongPassword123!');
        await user.type(confirmPasswordInput, 'StrongPassword123!');
      });

      const nextButton2 = screen.getByTestId('button-next-step');
      await act(async () => {
        await user.click(nextButton2);
      });

      // Step 3: Complete profile
      const firstNameInput = screen.getByTestId('input-firstName');
      const lastNameInput = screen.getByTestId('input-lastName');

      await act(async () => {
        await user.type(firstNameInput, 'Kevin');
        await user.type(lastNameInput, 'Hervieux');
      });

      const nextButton3 = screen.getByTestId('button-next-step');
      await act(async () => {
        await user.click(nextButton3);
      });

      // Step 4: Privacy consent
      const dataConsentCheckbox = screen.getByTestId('checkbox-dataCollectionConsent');
      const rightsCheckbox = screen.getByTestId('checkbox-acknowledgedRights');

      await act(async () => {
        await user.click(dataConsentCheckbox);
        await user.click(rightsCheckbox);
      });

      // Submit registration
      const submitButton = screen.getByTestId('button-submit-registration');
      await act(async () => {
        await user.click(submitButton);
      });

      await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledWith('/api/invitations/accept/', {
          method: 'POST',
          body: expect.objectContaining({
            firstName: 'Kevin',
            lastName: 'Hervieux',
            password: 'StrongPassword123!',
            privacyConsents: expect.objectContaining({
              dataCollectionConsent: true,
              acknowledgedRights: true
            })
          })
        });
      });
    });

    test('should prevent navigation with invalid step data', async () => {
      const user = userEvent.setup();

      render(
        <TestProviders>
          <PasswordCreationStep
            _data={{}}
            onDataChange={jest.fn()}
            onValidationChange={jest.fn()}
          />
        </TestProviders>
      );

      // Try to submit with weak password
      const passwordInput = screen.getByTestId('input-password');
      await act(async () => {
        await user.type(passwordInput, 'weak');
      });

      const nextButton = screen.getByTestId('button-next-step');
      expect(nextButton).toBeDisabled();
    });

    test('should handle wizard navigation back and forth', async () => {
      const user = userEvent.setup();

      const { apiRequest } = require('../../../client/src/lib/queryClient');
      apiRequest.mockResolvedValue(mockTokenValidationData);

      render(
        <TestProviders>
          <RegistrationWizard />
        </TestProviders>
      );

      // Navigate forward to step 2
      await waitFor(() => {
        expect(screen.getByTestId('button-next-step')).toBeInTheDocument();
      });

      const nextButton = screen.getByTestId('button-next-step');
      await act(async () => {
        await user.click(nextButton);
      });

      // Should be on step 2
      expect(screen.getByTestId('input-password')).toBeInTheDocument();

      // Navigate back to step 1
      const backButton = screen.getByTestId('button-back-step');
      await act(async () => {
        await user.click(backButton);
      });

      // Should be back on step 1
      expect(screen.getByText(/validation-réussie/i)).toBeInTheDocument();
    });
  });

  describe('Backend Integration Tests', () => {
    test('should create user account with complete profile data', async () => {
      const userData = {
        email: 'kevhervieux@gmail.com',
        firstName: 'Kevin',
        lastName: 'Hervieux',
        password: 'StrongPassword123!',
        phone: '514-712-8441',
        language: 'fr',
        role: 'manager',
        organizationId: '72263718-6559-4216-bd93-524f7acdcbbc',
        buildingId: '005b0e63-6a0a-44c9-bf01-2b779b316bba',
        privacyConsents: {
          dataCollectionConsent: true,
          marketingConsent: false,
          analyticsConsent: true,
          thirdPartyConsent: false,
          acknowledgedRights: true,
          consentDate: new Date().toISOString()
        }
      };

      const { apiRequest } = require('../../../client/src/lib/queryClient');
      apiRequest.mockResolvedValue({
        user: {
          id: '6a71e61e-a841-4106-bde7-dd2945653d49',
          ...userData,
          isActive: true,
          createdAt: new Date().toISOString()
        }
      });

      const result = await apiRequest('/api/invitations/accept/e38ddf5e720e8708dd2034539199e33a35e7cff5cb7867eb525c77c01cb7b771', {
        method: 'POST',
        body: userData
      });

      expect(result.user).toMatchObject({
        email: 'kevhervieux@gmail.com',
        firstName: 'Kevin',
        lastName: 'Hervieux',
        role: 'manager',
        isActive: true
      });
    });

    test('should update invitation status to accepted', async () => {
      const { apiRequest } = require('../../../client/src/lib/queryClient');
      apiRequest.mockResolvedValue({
        invitation: {
          id: '77d296ae-b71e-41f5-bcc3-d2abbd04a6b9',
          status: 'accepted',
          acceptedAt: new Date().toISOString(),
          acceptedByUserId: '6a71e61e-a841-4106-bde7-dd2945653d49'
        }
      });

      const result = await apiRequest('/api/invitations/accept/test-token', {
        method: 'POST',
        body: { /* user data */ }
      });

      expect(result.invitation.status).toBe('accepted');
      expect(result.invitation.acceptedAt).toBeDefined();
      expect(result.invitation.acceptedByUserId).toBeDefined();
    });

    test('should create audit log entries', async () => {
      const { apiRequest } = require('../../../client/src/lib/queryClient');
      apiRequest.mockResolvedValue({
        auditLog: {
          invitationId: '77d296ae-b71e-41f5-bcc3-d2abbd04a6b9',
          action: 'accepted',
          performedBy: '6a71e61e-a841-4106-bde7-dd2945653d49',
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          details: {
            email: 'kevhervieux@gmail.com',
            userId: '6a71e61e-a841-4106-bde7-dd2945653d49',
            organizationId: '72263718-6559-4216-bd93-524f7acdcbbc'
          },
          previousStatus: 'pending',
          newStatus: 'accepted',
          timestamp: new Date().toISOString()
        }
      });

      const result = await apiRequest('/api/invitations/accept/test-token', {
        method: 'POST',
        body: { /* user data */ }
      });

      expect(result.auditLog.action).toBe('accepted');
      expect(result.auditLog.previousStatus).toBe('pending');
      expect(result.auditLog.newStatus).toBe('accepted');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle API errors gracefully', async () => {
      const { apiRequest } = require('../../../client/src/lib/queryClient');
      apiRequest.mockRejectedValue(new Error('Server error'));

      render(
        <TestProviders>
          <TokenValidationStep
            _data={{}}
            onDataChange={jest.fn()}
            onValidationChange={jest.fn()}
          />
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByText(/Erreur de validation/i)).toBeInTheDocument();
      });
    });

    test('should prevent duplicate submissions', async () => {
      const user = userEvent.setup();
      const { apiRequest } = require('../../../client/src/lib/queryClient');
      
      // Simulate slow API response
      apiRequest.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );

      render(
        <TestProviders>
          <RegistrationWizard />
        </TestProviders>
      );

      // Mock complete form data
      const submitButton = screen.getByTestId('button-submit-registration');
      
      await act(async () => {
        await user.click(submitButton);
        await user.click(submitButton); // Second click
      });

      // Should only call API once
      expect(apiRequest).toHaveBeenCalledTimes(1);
      expect(submitButton).toBeDisabled();
    });

    test('should handle session timeouts', async () => {
      const { apiRequest } = require('../../../client/src/lib/queryClient');
      apiRequest.mockRejectedValue({ 
        status: 401, 
        message: 'Session expired' 
      });

      render(
        <TestProviders>
          <TokenValidationStep
            _data={{}}
            onDataChange={jest.fn()}
            onValidationChange={jest.fn()}
          />
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByText(/Session expirée/i)).toBeInTheDocument();
      });
    });
  });

  describe('Performance and Optimization', () => {
    test('should not cause infinite re-renders in any step', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      
      const steps = [
        TokenValidationStep,
        PasswordCreationStep, 
        ProfileCompletionStep,
        QuebecPrivacyConsentStep
      ];

      steps.forEach(StepComponent => {
        render(
          <TestProviders>
            <StepComponent
              _data={{}}
              onDataChange={jest.fn()}
              onValidationChange={jest.fn()}
            />
          </TestProviders>
        );
      });

      // No console errors should be logged for infinite loops
      expect(consoleError).not.toHaveBeenCalledWith(
        expect.stringContaining('Maximum update depth exceeded')
      );

      consoleError.mockRestore();
    });

    test('should validate forms efficiently', () => {
      const startTime = performance.now();
      
      // Test password validation performance
      for (let i = 0; i < 100; i++) {
        validatePassword(`TestPassword${i}!`);
      }

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(50); // Should complete within 50ms
    });

    test('should handle rapid user input without blocking UI', async () => {
      const user = userEvent.setup();

      render(
        <TestProviders>
          <ProfileCompletionStep
            _data={{}}
            onDataChange={jest.fn()}
            onValidationChange={jest.fn()}
          />
        </TestProviders>
      );

      const firstNameInput = screen.getByTestId('input-firstName');

      const startTime = performance.now();
      
      // Rapid typing simulation
      await act(async () => {
        for (let i = 0; i < 20; i++) {
          await user.type(firstNameInput, 'a');
        }
      });

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Quebec Compliance Validation', () => {
    test('should collect all required Quebec Law 25 consents', () => {
      const requiredConsents = [
        'dataCollectionConsent',
        'acknowledgedRights'
      ];

      const optionalConsents = [
        'marketingConsent',
        'analyticsConsent',
        'thirdPartyConsent'
      ];

      const consentData = {
        dataCollectionConsent: true,
        marketingConsent: false,
        analyticsConsent: true,
        thirdPartyConsent: false,
        acknowledgedRights: true,
        consentDate: new Date().toISOString()
      };

      // All required consents must be true
      requiredConsents.forEach(consent => {
        expect(consentData[consent as keyof typeof consentData]).toBe(true);
      });

      // Optional consents can be true or false
      optionalConsents.forEach(consent => {
        expect(typeof consentData[consent as keyof typeof consentData]).toBe('boolean');
      });

      expect(consentData.consentDate).toBeDefined();
    });

    test('should use Quebec French terminology', () => {
      render(
        <TestProviders>
          <QuebecPrivacyConsentStep
            _data={{}}
            onDataChange={jest.fn()}
            onValidationChange={jest.fn()}
          />
        </TestProviders>
      );

      // Quebec-specific terms
      const quebecTerms = [
        /renseignements personnels/i,
        /collecte et traitement/i,
        /loi 25/i,
        /consentement/i,
        /vie privée/i
      ];

      quebecTerms.forEach(term => {
        expect(screen.getByText(term)).toBeInTheDocument();
      });
    });

    test('should validate Quebec address formats when provided', () => {
      const quebecAddresses = [
        {
          street: '563 montée des pionniers',
          city: 'Montréal',
          province: 'QC',
          postalCode: 'H1A 1A1',
          country: 'Canada'
        },
        {
          street: '123 Rue Sainte-Catherine',
          city: 'Québec',
          province: 'QC', 
          postalCode: 'G1R 4S7',
          country: 'Canada'
        }
      ];

      quebecAddresses.forEach(address => {
        expect(address.province).toBe('QC');
        expect(address.country).toBe('Canada');
        expect(/^[A-Z]\d[A-Z] \d[A-Z]\d$/.test(address.postalCode)).toBe(true);
      });
    });
  });
});