import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle, AlertTriangle, Shield, Mail } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import type { WizardStepProps } from '../registration-wizard';

/**
 * Interface for token validation step data.
 * Contains invitation token details and validation status.
 */
interface TokenValidationData {
  token: string;
  email: string;
  role: string;
  organizationName: string;
  inviterName: string;
  expiresAt: string;
  isValid: boolean;
  error?: string;
}

/**
 * Token Validation Step Component.
 * 
 * Validates invitation token and displays invitation details.
 * Handles expired, invalid, and malformed tokens with appropriate feedback.
 * @param root0 - The wizard step props.
 * @param root0.data - Current step data.
 * @param root0.onDataChange - Callback when step data changes.
 * @param root0.onValidationChange - Callback when validation status changes.
 * @returns JSX element for the token validation step.
 */
/**
 * TokenValidationStep function.
 * @param root0
 * @param root0.data
 * @param root0.onDataChange
 * @param root0.onValidationChange
 * @returns Function result.
 */
export function TokenValidationStep({ 
  _data, 
  onDataChange, 
  onValidationChange 
}: WizardStepProps) {
  const { t: _t } = useLanguage();
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<TokenValidationData | null>(_data as unknown as TokenValidationData || null);

  const validateToken = async (token: string) => {
    console.warn('🔍 Starting token validation for:', token.substring(0, 8) + '...');
    setIsValidating(true);
    
    try {
      const response = await fetch('/api/invitations/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token })
      });

      console.warn('📡 API response status:', response.status);
      const result = await response.json();
      console.warn('📄 API response _data:', result);

      if (response.ok && result.isValid) {
        const validationData: TokenValidationData = {
          token,
          email: result.invitation.email,
          role: result.invitation.role,
          organizationName: result.organizationName || 'Koveo Gestion',
          inviterName: result.inviterName || 'Administrateur',
          expiresAt: result.invitation.expiresAt,
          isValid: true
        };

        setValidationResult(validationData);
        onDataChange(validationData as unknown as Record<string, unknown>);
        onValidationChange(true);
      } else {
        const errorData: TokenValidationData = {
          token,
          email: '',
          role: '',
          organizationName: '',
          inviterName: '',
          expiresAt: '',
          isValid: false,
          error: result.message || 'Token invalide'
        };

        setValidationResult(errorData);
        onDataChange(errorData as unknown as Record<string, unknown>);
        onValidationChange(false);
      }
    } catch (_error) {
      const errorData: TokenValidationData = {
        token,
        email: '',
        role: '',
        organizationName: '',
        inviterName: '',
        expiresAt: '',
        isValid: false,
        error: 'Erreur de connexion au serveur'
      };

      setValidationResult(errorData);
      onDataChange(errorData as unknown as Record<string, unknown>);
      onValidationChange(false);
    } finally {
      setIsValidating(false);
    }
  };

  useEffect(() => {
    // Auto-validate if token is provided via URL params
    const urlParams = new window.URLSearchParams(window.location.search);
    const token = urlParams.get('token') || urlParams.get('invitation');
    console.warn('🔍 Checking URL for token:', { 
      token: token ? `${token.substring(0, 8)}...` : 'not found',
      url: window.location.search,
      hasValidationResult: !!validationResult 
    });
    
    if (token) {
      console.warn('✅ Found token, starting validation...');
      validateToken(token);
    } else {
      console.warn('❌ No token found in URL parameters');
    }
  }, []); // Only run once on component mount

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) {return 'Expiré';}
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} heure${hours > 1 ? 's' : ''} restante${hours > 1 ? 's' : ''}`;
    } else {
      return 'Expire bientôt';
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'tenant': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isValidating) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Validation de l'invitation
        </h3>
        <p className="text-gray-600 text-center max-w-md">
          Vérification du token d'invitation et des détails associés...
        </p>
      </div>
    );
  }

  if (!validationResult) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Token d'invitation requis
        </h3>
        <p className="text-gray-600 text-center max-w-md">
          Aucun token d'invitation valide n'a été trouvé. 
          Veuillez utiliser le lien d'invitation reçu par email.
        </p>
      </div>
    );
  }

  if (!validationResult.isValid) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Invitation invalide:</strong> {validationResult.error}
          </AlertDescription>
        </Alert>

        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-red-900 mb-2">
                Impossible de valider l'invitation
              </h3>
              <p className="text-red-700 mb-4">
                Le lien d'invitation peut être expiré, invalide ou déjà utilisé.
              </p>
              <div className="text-sm text-red-600 space-y-1">
                <p>• Vérifiez que vous utilisez le lien complet reçu par email</p>
                <p>• Assurez-vous que l'invitation n'est pas expirée</p>
                <p>• Contactez l'administrateur si le problème persiste</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          <strong>Invitation valide!</strong> Vous pouvez procéder à la création de votre compte.
        </AlertDescription>
      </Alert>

      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="text-center mb-6">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-green-900 mb-2">
              Invitation confirmée
            </h3>
            <p className="text-green-700">
              Vous avez été invité(e) à rejoindre {validationResult.organizationName}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Email */}
            <div className="bg-white p-4 rounded-lg border border-green-200">
              <div className="flex items-center mb-2">
                <Mail className="h-5 w-5 text-gray-500 mr-2" />
                <span className="text-sm font-medium text-gray-600">Email</span>
              </div>
              <p className="text-gray-900 font-medium">
                {validationResult.email}
              </p>
            </div>

            {/* Role */}
            <div className="bg-white p-4 rounded-lg border border-green-200">
              <div className="flex items-center mb-2">
                <Shield className="h-5 w-5 text-gray-500 mr-2" />
                <span className="text-sm font-medium text-gray-600">Rôle</span>
              </div>
              <Badge className={getRoleBadgeColor(validationResult.role)}>
                {validationResult.role === 'admin' && 'Administrateur'}
                {validationResult.role === 'manager' && 'Gestionnaire'}
                {validationResult.role === 'tenant' && 'Locataire'}
                {validationResult.role === 'resident' && 'Résident'}
              </Badge>
            </div>

            {/* Inviter */}
            <div className="bg-white p-4 rounded-lg border border-green-200">
              <div className="flex items-center mb-2">
                <Shield className="h-5 w-5 text-gray-500 mr-2" />
                <span className="text-sm font-medium text-gray-600">Invité par</span>
              </div>
              <p className="text-gray-900">
                {validationResult.inviterName}
              </p>
            </div>

            {/* Expiration */}
            <div className="bg-white p-4 rounded-lg border border-green-200">
              <div className="flex items-center mb-2">
                <Clock className="h-5 w-5 text-gray-500 mr-2" />
                <span className="text-sm font-medium text-gray-600">Validité</span>
              </div>
              <p className="text-gray-900">
                {getTimeRemaining(validationResult.expiresAt)}
              </p>
            </div>
          </div>

          {/* Quebec Law 25 Notice */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">
              🛡️ Protection des données personnelles (Loi 25 - Québec)
            </h4>
            <p className="text-xs text-blue-800">
              En acceptant cette invitation, vous reconnaissez avoir été informé(e) de la collecte 
              et de l'utilisation de vos données personnelles conformément à la Loi 25 du Québec 
              sur la protection des renseignements personnels dans le secteur privé.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}