import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User, Phone, Globe } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import type { WizardStepProps } from '../registration-wizard';

/**
 * Interface for profile completion step data.
 * Contains user profile information for registration.
 * Note: Address comes from assigned building/residence, not user profile.
 */
interface ProfileCompletionData {
  firstName: string;
  lastName: string;
  phone: string;
  language: string;
  dateOfBirth: string;
  isValid: boolean;
  error?: string;
}

/**
 * Profile Completion Step Component.
 *
 * Collects user profile information required for Quebec property management.
 * Includes address validation and bilingual support.
 * @param root0 - The wizard step props.
 * @param root0.data - Current step data.
 * @param root0.onDataChange - Callback when step data changes.
 * @param root0.onValidationChange - Callback when validation status changes.
 * @returns JSX element for the profile completion step.
 */
/**
 * ProfileCompletionStep function.
 * @param root0
 * @param root0.data
 * @param root0.onDataChange
 * @param root0.onValidationChange
 * @param root0._data
 * @returns Function result.
 */
export function ProfileCompletionStep({
  _data,
  onDataChange,
  onValidationChange,
  submissionError,
}: WizardStepProps) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState<ProfileCompletionData>({
    firstName: '',
    lastName: '',
    phone: '',
    language: 'fr',
    dateOfBirth: '',
    isValid: false,
    ..._data,
  });

  const [touched, setTouched] = useState<{ [_key: string]: boolean }>({});

  // Phone validation function - moved before useEffect to avoid hoisting issues
  const validatePhone = (phone: string) => {
    if (!phone) {
      return false;
    }
    // Quebec phone number format validation
    const phoneRegex = /^(\+1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}$/;
    return phoneRegex.test(phone);
  };

  // Validate form whenever relevant fields change
  useEffect(() => {
    const requiredFields = ['firstName', 'lastName', 'language'];
    const hasRequiredFields = requiredFields.every(
      (field) =>
        formData[field as keyof ProfileCompletionData] &&
        String(formData[field as keyof ProfileCompletionData]).trim().length > 0
    );

    // Phone is optional, but if provided must be valid
    const isValidPhone = !formData.phone || validatePhone(formData.phone);
    const isValid = hasRequiredFields && isValidPhone;

    // Only update if validation state actually changed
    if (formData.isValid !== isValid) {
      const updatedData = { ...formData, isValid };
      onDataChange(updatedData);
      onValidationChange(isValid);
    }
  }, [formData.firstName, formData.lastName, formData.language, formData.phone, formData.isValid]);

  const handleInputChange = (field: keyof ProfileCompletionData, _value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: _value,
      _error: undefined,
    }));
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const getFieldError = (field: keyof ProfileCompletionData, label: string) => {
    // Task #166: a DANGEROUS_INPUT 400 from the sanitization middleware
    // is forwarded here as `submissionError`. It wins over local
    // validation because the server is telling us the value is
    // actually rejected (and the server-supplied French message names
    // the field explicitly).
    if (submissionError && submissionError.fieldPath === field) {
      return submissionError.message;
    }

    if (!touched[field]) {
      return null;
    }

    const value = formData[field];

    if (['firstName', 'lastName', 'language'].includes(field)) {
      if (!value || String(value).trim().length === 0) {
        return `${label} ${t('authFieldIsRequired')}`;
      }
    }

    if (field === 'phone' && value && !validatePhone(String(value))) {
      return t('authInvalidPhoneFormat');
    }

    return null;
  };

  return (
    <div className='space-y-6 max-w-2xl mx-auto'>
      <Alert className='border-blue-200 bg-blue-50'>
        <User className='h-4 w-4 text-blue-600' />
        <AlertDescription className='text-blue-800'>
          <strong>{t('authUserProfileLabel')}</strong> {t('authUserProfileDesc')}
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className='pt-6 space-y-6'>
          {/* Personal Information */}
          <div className='space-y-4'>
            <h3 className='text-lg font-medium text-gray-900 flex items-center'>
              <User className='h-5 w-5 mr-2' />
              {t('authPersonalInformation')}
            </h3>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {/* First Name */}
              <div className='space-y-2'>
                <Label htmlFor='firstName' className='text-sm font-medium text-gray-700'>
                  {t('authFirstNameRequired')}
                </Label>
                <Input
                  id='firstName'
                  type='text'
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  onBlur={() => handleBlur('firstName')}
                  placeholder={t('authYourFirstName')}
                  className={getFieldError('firstName', t('firstName')) ? 'border-red-500' : ''}
                />
                {getFieldError('firstName', t('firstName')) && (
                  <p className='text-sm text-red-600'>
                    {getFieldError('firstName', t('firstName'))}
                  </p>
                )}
              </div>

              {/* Last Name */}
              <div className='space-y-2'>
                <Label htmlFor='lastName' className='text-sm font-medium text-gray-700'>
                  {t('authLastNameRequired')}
                </Label>
                <Input
                  id='lastName'
                  type='text'
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  onBlur={() => handleBlur('lastName')}
                  placeholder={t('authYourLastName')}
                  className={getFieldError('lastName', t('lastName')) ? 'border-red-500' : ''}
                />
                {getFieldError('lastName', t('lastName')) && (
                  <p className='text-sm text-red-600'>
                    {getFieldError('lastName', t('lastName'))}
                  </p>
                )}
              </div>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {/* Phone */}
              <div className='space-y-2'>
                <Label htmlFor='phone' className='text-sm font-medium text-gray-700'>
                  {t('authPhoneOptional')}
                </Label>
                <div className='relative'>
                  <Phone className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4' />
                  <Input
                    id='phone'
                    type='tel'
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    onBlur={() => handleBlur('phone')}
                    placeholder='514-123-4567'
                    className={`pl-10 ${getFieldError('phone', t('phone')) ? 'border-red-500' : ''}`}
                  />
                </div>
                {getFieldError('phone', t('phone')) && (
                  <p className='text-sm text-red-600'>{getFieldError('phone', t('phone'))}</p>
                )}
              </div>

              {/* Language */}
              <div className='space-y-2'>
                <Label htmlFor='language' className='text-sm font-medium text-gray-700'>
                  {t('authPreferredLanguage')}
                </Label>
                <Select
                  value={formData.language}
                  onValueChange={(_value) => handleInputChange('language', _value)}
                >
                  <SelectTrigger className='w-full'>
                    <Globe className='h-4 w-4 mr-2 text-gray-400' />
                    <SelectValue placeholder={t('authChooseLanguage')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='fr'>Français</SelectItem>
                    <SelectItem value='en'>English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
