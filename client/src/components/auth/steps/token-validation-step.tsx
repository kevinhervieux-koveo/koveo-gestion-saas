import React, { useEffect, useState, useRef } from 'react';
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
 * @param root0._data
 * @returns Function result.
 */
export function TokenValidationStep({ _data, onDataChange, onValidationChange }: WizardStepProps) {
  const { t } = useLanguage();
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<TokenValidationData | null>(
    (_data as unknown as TokenValidationData) || null
  );
  const [validatedToken, setValidatedToken] = useState<string | null>(() => {
    // Initialize from sessionStorage to persist across component re-renders
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('koveo-validated-token');
    }
    return null;
  }); // Track which token was validated

  const hasValidatedRef = useRef<Set<string>>(new Set()); // Prevent duplicate validations completely

  const validateToken = async (token: string) => {

    // Triple-check: state, sessionStorage, and ref guard
    const sessionValidatedToken = sessionStorage.getItem('koveo-validated-token');

    // Skip if already validating this token OR if already validated
    if (
      validatedToken === token ||
      sessionValidatedToken === token ||
      hasValidatedRef.current.has(token) ||
      isValidating
    ) {
      // Token validation skipped
      return;
    }

    // Mark this token as being validated in state, sessionStorage, AND ref
    setValidatedToken(token);
    sessionStorage.setItem('koveo-validated-token', token);
    hasValidatedRef.current.add(token);
    setIsValidating(true);

    try {
      const response = await fetch('/api/invitations/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const result = await response.json();

      if (response.ok && result.isValid) {
        const validationData: TokenValidationData = {
          token,
          email: result.invitation.email,
          role: result.invitation.role,
          organizationName: result.organizationName || 'Koveo Gestion',
          inviterName: result.inviterName || t('admin'),
          expiresAt: result.invitation.expiresAt,
          isValid: true,
        };


        // Store successful validation in sessionStorage
        sessionStorage.setItem('koveo-validation-result', JSON.stringify(validationData));

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
          error: result.message || t('authInvalidToken'),
        };

        setValidationResult(errorData);
        onDataChange(errorData as unknown as Record<string, unknown>);
        onValidationChange(false);
      }
    } catch (error: any) {
      // Error validating token
      const errorData: TokenValidationData = {
        token,
        email: '',
        role: '',
        organizationName: '',
        inviterName: '',
        expiresAt: '',
        isValid: false,
        error: t('authServerConnectionError'),
      };

      setValidationResult(errorData);
      onDataChange(errorData as unknown as Record<string, unknown>);
      onValidationChange(false);
    } finally {
      setIsValidating(false);
    }
  };

  // Track if initial effect has run to prevent multiple executions
  const initialEffectRan = useRef(false);

  useEffect(() => {
    // Prevent running multiple times
    if (initialEffectRan.current) return;
    initialEffectRan.current = true;

    // Auto-validate if token is provided via URL params
    const urlParams = new window.URLSearchParams(window.location.search);
    const token = urlParams.get('token') || urlParams.get('invitation');
    // Token auto-validation check

    if (token && validatedToken !== token && !hasValidatedRef.current.has(token) && !isValidating) {
      validateToken(token);
    }
  }, []); // Only run once on component mount

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();

    if (diff <= 0) {
      return t('authExpired');
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return `${days} ${days > 1 ? t('authDaysRemaining') : t('authDayRemaining')}`;
    } else if (hours > 0) {
      return `${hours} ${hours > 1 ? t('authHoursRemaining') : t('authHourRemaining')}`;
    } else {
      return t('authExpiringSoon');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'manager':
        return 'bg-blue-100 text-blue-800';
      case 'tenant':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isValidating) {
    return (
      <div className='flex flex-col items-center justify-center py-12'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4' />
        <h3 className='text-lg font-medium text-gray-900 mb-2'>{t('authValidatingInvitation')}</h3>
        <p className='text-gray-600 text-center max-w-md'>
          {t('authValidatingInvitationDesc')}
        </p>
      </div>
    );
  }

  if (!validationResult) {
    return (
      <div className='flex flex-col items-center justify-center py-12'>
        <AlertTriangle className='h-12 w-12 text-yellow-500 mb-4' />
        <h3 className='text-lg font-medium text-gray-900 mb-2'>
          {t('authInvitationTokenRequired')}
        </h3>
        <p className='text-gray-600 text-center max-w-md'>
          {t('authInvitationTokenRequiredDesc')}
        </p>
      </div>
    );
  }

  if (!validationResult.isValid) {
    return (
      <div className='space-y-4'>
        <Alert variant='destructive'>
          <XCircle className='h-4 w-4' />
          <AlertDescription>
            <strong>{t('authInvitationInvalid')}</strong> {validationResult.error}
          </AlertDescription>
        </Alert>

        <Card className='border-red-200 bg-red-50'>
          <CardContent className='pt-6'>
            <div className='text-center'>
              <XCircle className='h-12 w-12 text-red-500 mx-auto mb-4' />
              <h3 className='text-lg font-medium text-red-900 mb-2'>
                {t('authUnableToValidate')}
              </h3>
              <p className='text-red-700 mb-4'>{t('authInvitationLinkExpired')}</p>
              <div className='text-sm text-red-600 space-y-1'>
                <p>• {t('authInvitationCheckLink')}</p>
                <p>• {t('authInvitationNotExpired')}</p>
                <p>• {t('authInvitationContactAdmin')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <Alert className='border-green-200 bg-green-50'>
        <CheckCircle className='h-4 w-4 text-green-600' />
        <AlertDescription className='text-green-800'>
          <strong>{t('authInvitationValid')}</strong> {t('authInvitationValidDesc')}
        </AlertDescription>
      </Alert>

      <Card className='border-green-200 bg-green-50'>
        <CardContent className='pt-6'>
          <div className='text-center mb-6'>
            <CheckCircle className='h-12 w-12 text-green-500 mx-auto mb-4' />
            <h3 className='text-lg font-medium text-green-900 mb-2'>
              {t('authInvitationConfirmed')}
            </h3>
            <p className='text-green-700'>
              {t('authInvitedToJoin')} {validationResult.organizationName}
            </p>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {/* Email */}
            <div className='bg-white p-4 rounded-lg border border-green-200'>
              <div className='flex items-center mb-2'>
                <Mail className='h-5 w-5 text-gray-500 mr-2' />
                <span className='text-sm font-medium text-gray-600'>{t('email')}</span>
              </div>
              <p className='text-gray-900 font-medium'>{validationResult.email}</p>
            </div>

            {/* Role */}
            <div className='bg-white p-4 rounded-lg border border-green-200'>
              <div className='flex items-center mb-2'>
                <Shield className='h-5 w-5 text-gray-500 mr-2' />
                <span className='text-sm font-medium text-gray-600'>{t('role')}</span>
              </div>
              <Badge className={getRoleBadgeColor(validationResult.role)}>
                {validationResult.role === 'admin' && t('admin')}
                {validationResult.role === 'manager' && t('manager')}
                {validationResult.role === 'tenant' && t('tenant')}
                {validationResult.role === 'resident' && t('resident')}
              </Badge>
            </div>

            {/* Inviter */}
            <div className='bg-white p-4 rounded-lg border border-green-200'>
              <div className='flex items-center mb-2'>
                <Shield className='h-5 w-5 text-gray-500 mr-2' />
                <span className='text-sm font-medium text-gray-600'>{t('authInvitedBy')}</span>
              </div>
              <p className='text-gray-900'>{validationResult.inviterName}</p>
            </div>

            {/* Expiration */}
            <div className='bg-white p-4 rounded-lg border border-green-200'>
              <div className='flex items-center mb-2'>
                <Clock className='h-5 w-5 text-gray-500 mr-2' />
                <span className='text-sm font-medium text-gray-600'>{t('authValidity')}</span>
              </div>
              <p className='text-gray-900'>{getTimeRemaining(validationResult.expiresAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
