import React, { useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, ArrowLeft, Home, Linkedin } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { RegistrationWizard, type WizardStep } from '@/components/auth/registration-wizard';
import { TokenValidationStep } from '@/components/auth/steps/token-validation-step';
import { PasswordCreationStep } from '@/components/auth/steps/password-creation-step';
import { ProfileCompletionStep } from '@/components/auth/steps/profile-completion-step';
import { QuebecPrivacyConsentStep } from '@/components/auth/steps/quebec-privacy-consent-step';

/**
 * Invitation Acceptance Page.
 *
 * Multi-step registration flow for users accepting invitations.
 * Implements Quebec Law 25 compliance and secure password creation.
 */
export default function InvitationAcceptancePage() {
  const { t, language } = useLanguage();
  const [, setLocation] = useLocation();
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedUser, setCompletedUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  // Task #166: field-scoped submission error (DANGEROUS_INPUT) routed
  // to the wizard so the offending step re-opens with an inline,
  // field-level error under the exact input that was rejected.
  const [submissionError, setSubmissionError] = useState<
    { stepId?: string; fieldPath: string; message: string } | null
  >(null);

  // Map the server's flat fieldPath to the wizard step that owns it.
  // Keys mirror the top-level request-body keys posted by
  // `handleWizardComplete` below.
  const FIELD_PATH_TO_STEP: Record<string, string> = {
    firstName: 'profile-completion',
    lastName: 'profile-completion',
    phone: 'profile-completion',
    language: 'profile-completion',
    password: 'password-creation',
    dataCollectionConsent: 'quebec-privacy-consent',
    marketingConsent: 'quebec-privacy-consent',
    analyticsConsent: 'quebec-privacy-consent',
    thirdPartyConsent: 'quebec-privacy-consent',
    acknowledgedRights: 'quebec-privacy-consent',
  };

  // Define the registration wizard steps
  const wizardSteps: WizardStep[] = [
    {
      id: 'token-validation',
      title: t('authValidationStepTitle'),
      description: t('authValidationStepDesc'),
      component: TokenValidationStep,
      isComplete: false,
      isValid: false,
    },
    {
      id: 'password-creation',
      title: t('authPasswordStepTitle'),
      description: t('authPasswordStepDesc'),
      component: PasswordCreationStep,
      isComplete: false,
      isValid: false,
    },
    {
      id: 'profile-completion',
      title: t('authProfileStepTitle'),
      description: t('authProfileStepDesc'),
      component: ProfileCompletionStep,
      isComplete: false,
      isValid: false,
    },
    {
      id: 'quebec-privacy-consent',
      title: t('authConsentStepTitle'),
      description: t('authConsentStepDesc'),
      component: QuebecPrivacyConsentStep,
      isComplete: false,
      isValid: false,
    },
  ];

  // Handle wizard completion - create user account
  const handleWizardComplete = useCallback(async (wizardData: unknown) => {
    try {
      setError(null);
      setSubmissionError(null);

      // Extract data from wizard steps
      const tokenData = wizardData['token-validation'] || {};
      const passwordData = wizardData['password-creation'] || {};
      const profileData = wizardData['profile-completion'] || {};
      const privacyData = wizardData['quebec-privacy-consent'] || {};

      if (!tokenData.token) {
        throw new Error(t('authTokenMissing'));
      }

      if (!passwordData.password) {
        throw new Error(t('authPasswordRequiredError'));
      }

      if (!profileData.firstName || !profileData.lastName) {
        throw new Error(t('authNamesRequiredError'));
      }

      if (!privacyData.dataCollectionConsent || !privacyData.acknowledgedRights) {
        throw new Error(t('authConsentsRequiredError'));
      }

      // Starting token validation

      // Accept the invitation with all collected data
      const response = await fetch(`/api/invitations/accept/${tokenData.token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          password: passwordData.password,
          phone: profileData.phone || '',
          language: profileData.language || 'fr',
          // Only send privacy consents as flat properties (matching server expectations)
          dataCollectionConsent: privacyData.dataCollectionConsent,
          marketingConsent: privacyData.marketingConsent,
          analyticsConsent: privacyData.analyticsConsent,
          thirdPartyConsent: privacyData.thirdPartyConsent,
          acknowledgedRights: privacyData.acknowledgedRights,
        }),
      });

      // API response received

      if (!response.ok) {
        const errorData = (await response.json()) as {
          message?: string;
          code?: string;
          fieldPath?: string;
          fieldLabel?: string;
        };
        // Task #166: for DANGEROUS_INPUT, route the error back to the
        // step that owns the offending field so the wizard navigates
        // there and the step renders a red-underlined, French,
        // field-named error under the exact input the user must fix.
        if (
          errorData.code === 'DANGEROUS_INPUT' &&
          errorData.fieldPath &&
          errorData.message
        ) {
          const topLevel = errorData.fieldPath.split('.')[0].replace(/\[\d+\]$/, '');
          setSubmissionError({
            stepId: FIELD_PATH_TO_STEP[topLevel],
            fieldPath: topLevel,
            message: errorData.message,
          });
        }
        const message =
          errorData.code === 'DANGEROUS_INPUT' && errorData.message
            ? errorData.message
            : errorData.message || t('authAccountCreationError');
        throw new Error(message);
      }

      const result = await response.json();
      // Token validation successful
      setCompletedUser(result.user);
      setIsCompleted(true);
    } catch (_error: unknown) {
      setError(
        (_error as Error).message || t('authAccountCreationGenericError')
      );
      // Re-throw the error so the wizard can handle it properly
      throw _error;
    }
  }, [t]);

  // Handle wizard cancellation
  const handleCancel = useCallback(() => {
    setLocation('/');
  }, [setLocation]);

  // Handle completion - redirect to login
  const handleGoToLogin = useCallback(() => {
    setLocation('/auth/login');
  }, [setLocation]);

  // Success screen after completion
  if (isCompleted && completedUser) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4'>
        <Card className='w-full max-w-2xl shadow-xl border-0'>
          <CardContent className='p-8 text-center'>
            <CheckCircle className='h-16 w-16 text-green-500 mx-auto mb-6' />

            <h1 className='text-3xl font-bold text-gray-900 mb-4'>
              {t('authRegistrationCompleteTitle')}
            </h1>

            <p className='text-lg text-gray-600 mb-6'>
              {t('authWelcomeUser')} {completedUser.firstName} {completedUser.lastName}! {t('authAccountCreatedMessage')}
            </p>

            <div className='bg-green-50 border border-green-200 p-4 rounded-lg mb-6'>
              <h3 className='text-sm font-medium text-green-900 mb-2'>
                {t('authAccountCreatedTitle')}
              </h3>
              <div className='text-sm text-green-800 space-y-1'>
                <p>• Email: {completedUser.email}</p>
                <p>• {t('role')}: {completedUser.role}</p>
                <p>• {t('language')}: {completedUser.language === 'fr' ? 'Français' : 'English'}</p>
              </div>
            </div>

            <div className='bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6'>
              <h4 className='text-sm font-medium text-blue-900 mb-2'>{t('authQuebecComplianceTitle')}</h4>
              <p className='text-xs text-blue-800'>
                {t('authQuebecComplianceDesc')}
              </p>
            </div>

            <div className='space-y-3'>
              <Button
                onClick={handleGoToLogin}
                size='lg'
                className='w-full sm:w-auto min-w-[200px]'
              >
                <Home className='w-4 h-4 mr-2' />
                {t('authAccessMyAccount')}
              </Button>

              <p className='text-sm text-gray-500'>
                {t('authLoginWithEmailPassword')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main registration wizard
  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4'>
      <div className='w-full max-w-6xl'>
        {/* Header */}
        <div className='text-center mb-8'>
          <Button
            onClick={handleCancel}
            variant='ghost'
            className='absolute top-4 left-4 text-gray-600'
          >
            <ArrowLeft className='w-4 h-4 mr-2' />
            {t('authBackToHome')}
          </Button>

          <h1 className='text-4xl font-bold text-gray-900 mb-4'>{t('authInvitationAcceptanceTitle')}</h1>
          <p className='text-lg text-gray-600 max-w-2xl mx-auto'>
            {t('authInvitationAcceptanceDesc')}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className='mb-6 max-w-4xl mx-auto'>
            <Alert variant='destructive'>
              <AlertDescription>
                <strong>{t('authErrorPrefix')}</strong> {error}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Registration Wizard */}
        <RegistrationWizard
          steps={wizardSteps}
          onComplete={handleWizardComplete}
          onCancel={handleCancel}
          title={t('authCreatingYourAccount')}
          className='bg-transparent'
          submissionError={submissionError}
        />

        {/* Follow Us */}
        <div className='text-center mt-8'>
          <p className='text-sm text-gray-500 mb-2'>
            {language === 'fr' ? 'Suivez-nous' : 'Follow Us'}
          </p>
          <a
            href='https://www.linkedin.com/company/koveo-gestion-inc/'
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center justify-center gap-2 bg-[#0A66C2] hover:bg-[#004182] text-white px-4 py-2 rounded-lg transition-colors text-sm'
          >
            <Linkedin className='h-4 w-4' />
            <span>LinkedIn</span>
          </a>
        </div>

        {/* Footer */}
        <div className='text-center mt-4 text-sm text-gray-500'>
          <p>
            {t('authRegistrationFooter')}
          </p>
        </div>
      </div>
    </div>
  );
}
