import React, { useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, ArrowLeft, Home } from 'lucide-react';
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
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedUser, setCompletedUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Define the registration wizard steps
  const wizardSteps: WizardStep[] = [
    {
      id: 'token-validation',
      title: 'Validation de l\'invitation',
      description: 'Vérification de votre lien d\'invitation et des détails associés',
      component: TokenValidationStep,
      isComplete: false,
      isValid: false,
    },
    {
      id: 'password-creation',
      title: 'Création du mot de passe',
      description: 'Définissez un mot de passe sécurisé pour votre compte',
      component: PasswordCreationStep,
      isComplete: false,
      isValid: false,
    },
    {
      id: 'profile-completion',
      title: 'Informations personnelles',
      description: 'Complétez votre profil utilisateur',
      component: ProfileCompletionStep,
      isComplete: false,
      isValid: false,
    },
    {
      id: 'quebec-privacy-consent',
      title: 'Consentements et confidentialité',
      description: 'Consentements requis selon la Loi 25 du Québec',
      component: QuebecPrivacyConsentStep,
      isComplete: false,
      isValid: false,
    },
  ];

  // Handle wizard completion - create user account
  const handleWizardComplete = useCallback(async (wizardData: any) => {
    try {
      setError(null);
      
      // Extract data from wizard steps
      const tokenData = wizardData['token-validation'] || {};
      const passwordData = wizardData['password-creation'] || {};
      const profileData = wizardData['profile-completion'] || {};
      const privacyData = wizardData['quebec-privacy-consent'] || {};
      
      if (!tokenData.token) {
        throw new Error('Token manquant');
      }
      
      if (!passwordData.password) {
        throw new Error('Mot de passe requis');
      }
      
      if (!profileData.firstName || !profileData.lastName) {
        throw new Error('Nom et prénom requis');
      }
      
      if (!privacyData.dataCollectionConsent || !privacyData.acknowledgedRights) {
        throw new Error('Consentements obligatoires requis');
      }
      
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
          phone: profileData.phone,
          address: profileData.address,
          city: profileData.city,
          province: profileData.province,
          postalCode: profileData.postalCode,
          language: profileData.language,
          dateOfBirth: profileData.dateOfBirth,
          privacyConsents: {
            dataCollectionConsent: privacyData.dataCollectionConsent,
            marketingConsent: privacyData.marketingConsent,
            analyticsConsent: privacyData.analyticsConsent,
            thirdPartyConsent: privacyData.thirdPartyConsent,
            acknowledgedRights: privacyData.acknowledgedRights,
            consentDate: privacyData.consentDate,
          }
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors de la création du compte');
      }
      
      const result = await response.json();
      setCompletedUser(result.user);
      setIsCompleted(true);
      
    } catch (error: any) {
      console.error('Error completing registration:', error);
      setError(error.message || 'Une erreur est survenue lors de la création de votre compte');
    }
  }, []);

  // Handle wizard cancellation
  const handleCancel = useCallback(() => {
    setLocation('/');
  }, [setLocation]);

  // Handle completion - redirect to login
  const handleGoToLogin = useCallback(() => {
    setLocation('/');
  }, [setLocation]);

  // Success screen after completion
  if (isCompleted && completedUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl shadow-xl border-0">
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
            
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              🎉 Inscription terminée avec succès!
            </h1>
            
            <p className="text-lg text-gray-600 mb-6">
              Bienvenue {completedUser.firstName} {completedUser.lastName}! 
              Votre compte a été créé avec succès.
            </p>
            
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg mb-6">
              <h3 className="text-sm font-medium text-green-900 mb-2">
                ✅ Compte créé avec succès
              </h3>
              <div className="text-sm text-green-800 space-y-1">
                <p>• Email: {completedUser.email}</p>
                <p>• Rôle: {completedUser.role}</p>
                <p>• Langue: {completedUser.language === 'fr' ? 'Français' : 'English'}</p>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6">
              <h4 className="text-sm font-medium text-blue-900 mb-2">
                🛡️ Conformité Québécoise
              </h4>
              <p className="text-xs text-blue-800">
                Vos consentements ont été enregistrés conformément à la Loi 25 du Québec. 
                Vous pouvez exercer vos droits à tout moment en contactant notre équipe.
              </p>
            </div>
            
            <div className="space-y-3">
              <Button onClick={handleGoToLogin} size="lg" className="w-full sm:w-auto min-w-[200px]">
                <Home className="w-4 h-4 mr-2" />
                Accéder à mon compte
              </Button>
              
              <p className="text-sm text-gray-500">
                Vous pouvez maintenant vous connecter avec votre email et mot de passe
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main registration wizard
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <Button
            onClick={handleCancel}
            variant="ghost"
            className="absolute top-4 left-4 text-gray-600"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à l'accueil
          </Button>
          
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Acceptation d'invitation
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Complétez votre inscription pour rejoindre la plateforme Koveo Gestion
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 max-w-4xl mx-auto">
            <Alert variant="destructive">
              <AlertDescription>
                <strong>Erreur:</strong> {error}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Registration Wizard */}
        <RegistrationWizard
          steps={wizardSteps}
          onComplete={handleWizardComplete}
          onCancel={handleCancel}
          title="Création de votre compte"
          className="bg-transparent"
        />

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>
            En vous inscrivant, vous acceptez nos conditions d'utilisation et notre politique de confidentialité 
            conforme à la Loi 25 du Québec.
          </p>
        </div>
      </div>
    </div>
  );
}