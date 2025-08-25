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
}: WizardStepProps) {
  const { t: _t } = useLanguage();
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

    const updatedData = { ...formData, isValid };
    onDataChange(updatedData);
    onValidationChange(isValid);
  }, [formData]); // Remove callbacks from dependency array to prevent infinite loop

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
    if (!touched[field]) {
      return null;
    }

    const value = formData[field];

    if (['firstName', 'lastName', 'language'].includes(field)) {
      if (!value || String(value).trim().length === 0) {
        return `${label} est requis`;
      }
    }

    if (field === 'phone' && value && !validatePhone(String(value))) {
      return 'Format de téléphone invalide (ex: 514-123-4567)';
    }

    return null;
  };

  return (
    <div className='space-y-6 max-w-2xl mx-auto'>
      <Alert className='border-blue-200 bg-blue-50'>
        <User className='h-4 w-4 text-blue-600' />
        <AlertDescription className='text-blue-800'>
          <strong>Profil utilisateur:</strong> Complétez votre profil pour finaliser votre
          inscription et accéder aux services de gestion immobilière.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className='pt-6 space-y-6'>
          {/* Personal Information */}
          <div className='space-y-4'>
            <h3 className='text-lg font-medium text-gray-900 flex items-center'>
              <User className='h-5 w-5 mr-2' />
              Informations personnelles
            </h3>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {/* First Name */}
              <div className='space-y-2'>
                <Label htmlFor='firstName' className='text-sm font-medium text-gray-700'>
                  Prénom *
                </Label>
                <Input
                  id='firstName'
                  type='text'
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  onBlur={() => handleBlur('firstName')}
                  placeholder='Votre prénom'
                  className={getFieldError('firstName', 'Prénom') ? 'border-red-500' : ''}
                />
                {getFieldError('firstName', 'Prénom') && (
                  <p className='text-sm text-red-600'>{getFieldError('firstName', 'Prénom')}</p>
                )}
              </div>

              {/* Last Name */}
              <div className='space-y-2'>
                <Label htmlFor='lastName' className='text-sm font-medium text-gray-700'>
                  Nom de famille *
                </Label>
                <Input
                  id='lastName'
                  type='text'
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  onBlur={() => handleBlur('lastName')}
                  placeholder='Votre nom de famille'
                  className={getFieldError('lastName', 'Nom de famille') ? 'border-red-500' : ''}
                />
                {getFieldError('lastName', 'Nom de famille') && (
                  <p className='text-sm text-red-600'>
                    {getFieldError('lastName', 'Nom de famille')}
                  </p>
                )}
              </div>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {/* Phone */}
              <div className='space-y-2'>
                <Label htmlFor='phone' className='text-sm font-medium text-gray-700'>
                  Téléphone (optionnel)
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
                    className={`pl-10 ${getFieldError('phone', 'Téléphone') ? 'border-red-500' : ''}`}
                  />
                </div>
                {getFieldError('phone', 'Téléphone') && (
                  <p className='text-sm text-red-600'>{getFieldError('phone', 'Téléphone')}</p>
                )}
              </div>

              {/* Language */}
              <div className='space-y-2'>
                <Label htmlFor='language' className='text-sm font-medium text-gray-700'>
                  Langue préférée *
                </Label>
                <Select
                  value={formData.language}
                  onValueChange={(_value) => handleInputChange('language', _value)}
                >
                  <SelectTrigger className='w-full'>
                    <Globe className='h-4 w-4 mr-2 text-gray-400' />
                    <SelectValue placeholder='Choisir une langue' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='fr'>Français</SelectItem>
                    <SelectItem value='en'>English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Quebec Compliance Notice */}
          <div className='bg-blue-50 border border-blue-200 p-4 rounded-lg'>
            <h4 className='text-sm font-medium text-blue-900 mb-2'>
              🛡️ Protection de la vie privée
            </h4>
            <p className='text-xs text-blue-800'>
              Vos informations personnelles sont collectées et utilisées uniquement pour les
              services de gestion immobilière, conformément à la Loi 25 du Québec. Vous pouvez
              demander l'accès, la correction ou la suppression de vos données à tout moment en
              contactant l'administrateur.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
