import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Lock, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { PasswordStrengthIndicator } from '../password-strength-indicator';
import { validatePasswordStrength } from '@/utils/password-validation';
import type { WizardStepProps } from '../registration-wizard';

/**
 * Interface for password creation step data.
 * Contains password validation and confirmation fields.
 */
interface PasswordCreationData {
  password: string;
  confirmPassword: string;
  isValid: boolean;
  error?: string;
}

/**
 * Password Creation Step Component.
 *
 * Secure password creation with strength validation and confirmation.
 * Implements Quebec-compliant security standards for property management.
 * @param root0 - The wizard step props.
 * @param root0.data - Current step data.
 * @param root0.onDataChange - Callback when step data changes.
 * @param root0.onValidationChange - Callback when validation status changes.
 * @returns JSX element for the password creation step.
 */
/**
 * PasswordCreationStep function.
 * @param root0
 * @param root0.data
 * @param root0.onDataChange
 * @param root0.onValidationChange
 * @param root0._data
 * @returns Function result.
 */
export function PasswordCreationStep({ _data, onDataChange, onValidationChange }: WizardStepProps) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState<PasswordCreationData>({
    password: '',
    confirmPassword: '',
    isValid: false,
    ..._data,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState({
    password: false,
    confirmPassword: false,
  });

  // Validate form whenever password fields change
  useEffect(() => {
    const passwordStrength = validatePasswordStrength(formData.password);
    const passwordsMatch = formData.password === formData.confirmPassword;
    const hasPassword = formData.password.length > 0;
    const hasConfirmPassword = formData.confirmPassword.length > 0;
    const isValid = passwordStrength.isValid && passwordsMatch && hasPassword && hasConfirmPassword;

    // Only update if validation state actually changed
    if (formData.isValid !== isValid) {
      const updatedData = { ...formData, isValid };
      onDataChange(updatedData);
      onValidationChange(isValid);
    }
  }, [formData.password, formData.confirmPassword, formData.isValid]);

  const handlePasswordChange = (_value: string) => {
    setFormData((prev) => ({
      ...prev,
      password: _value,
      _error: undefined,
    }));
  };

  const handleConfirmPasswordChange = (_value: string) => {
    setFormData((prev) => ({
      ...prev,
      confirmPassword: _value,
      _error: undefined,
    }));
  };

  const handleBlur = (field: 'password' | 'confirmPassword') => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const getPasswordMatchError = () => {
    if (!touched.confirmPassword || !formData.confirmPassword) {
      return null;
    }

    if (formData.password !== formData.confirmPassword) {
      return t('authPasswordsDoNotMatch');
    }
    return null;
  };

  const passwordStrength = validatePasswordStrength(formData.password);
  const passwordMatchError = getPasswordMatchError();
  const hasPasswordError =
    touched.password && !passwordStrength.isValid && formData.password.length > 0;

  return (
    <div className='space-y-6 max-w-2xl mx-auto'>
      <Card>
        <CardContent className='pt-6 space-y-6'>
          {/* Password Field */}
          <div className='space-y-2'>
            <Label htmlFor='password' className='text-sm font-medium text-gray-700'>
              {t('authPasswordRequiredLabel')}
            </Label>
            <div className='relative'>
              <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4' />
              <Input
                id='password'
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                onBlur={() => handleBlur('password')}
                placeholder={t('authEnterYourPassword')}
                className={`pl-10 pr-10 ${hasPasswordError ? 'border-red-500 focus:border-red-500' : ''}`}
                aria-describedby='password-requirements'
                data-testid='input-password'
              />
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                onClick={() => setShowPassword(!showPassword)}
                data-testid='button-toggle-password'
              >
                {showPassword ? (
                  <EyeOff className='h-4 w-4 text-gray-400' />
                ) : (
                  <Eye className='h-4 w-4 text-gray-400' />
                )}
                <span className='sr-only'>
                  {showPassword ? t('authHidePassword') : t('authShowPassword')}
                </span>
              </Button>
            </div>

            {/* Password Strength Indicator */}
            <PasswordStrengthIndicator
              password={formData.password}
              showPassword={showPassword}
              onToggleVisibility={() => setShowPassword(!showPassword)}
              className='mt-3'
            />

            {hasPasswordError && (
              <Alert variant='destructive'>
                <AlertTriangle className='h-4 w-4' />
                <AlertDescription>{t('authPasswordDoesNotMeetRequirements')}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Confirm Password Field */}
          <div className='space-y-2'>
            <Label htmlFor='confirmPassword' className='text-sm font-medium text-gray-700'>
              {t('authConfirmPasswordRequired')}
            </Label>
            <div className='relative'>
              <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4' />
              <Input
                id='confirmPassword'
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                onBlur={() => handleBlur('confirmPassword')}
                placeholder={t('authConfirmYourPassword')}
                className={`pl-10 pr-10 ${passwordMatchError ? 'border-red-500 focus:border-red-500' : ''}`}
                data-testid='input-confirm-password'
              />
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                data-testid='button-toggle-confirm-password'
              >
                {showConfirmPassword ? (
                  <EyeOff className='h-4 w-4 text-gray-400' />
                ) : (
                  <Eye className='h-4 w-4 text-gray-400' />
                )}
                <span className='sr-only'>
                  {showConfirmPassword ? t('authHidePassword') : t('authShowPassword')}
                </span>
              </Button>
            </div>

            {formData.confirmPassword && formData.password === formData.confirmPassword && (
              <div className='flex items-center text-sm text-green-600'>
                <Shield className='h-4 w-4 mr-1' />
                {t('authPasswordsMatch')}
              </div>
            )}

            {passwordMatchError && (
              <Alert variant='destructive'>
                <AlertTriangle className='h-4 w-4' />
                <AlertDescription>{passwordMatchError}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Security Guidelines */}
          <div className='bg-gray-50 p-4 rounded-lg'>
            <h4 className='text-sm font-medium text-gray-900 mb-2'>{t('authSecurityTipsTitle')}</h4>
            <ul className='text-xs text-gray-600 space-y-1'>
              <li>• {t('authSecurityTip1')}</li>
              <li>• {t('authSecurityTip2')}</li>
              <li>• {t('authSecurityTip3')}</li>
              <li>• {t('authSecurityTip4')}</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
