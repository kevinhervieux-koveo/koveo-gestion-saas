import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User, Phone, MapPin, Calendar, Globe } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import type { WizardStepProps } from '../registration-wizard';

/**
 *
 */
interface ProfileCompletionData {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
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
 * @param root0
 * @param root0.data
 * @param root0.onDataChange
 * @param root0.onValidationChange
 */
export function ProfileCompletionStep({ 
  data, 
  onDataChange, 
  onValidationChange 
}: WizardStepProps) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState<ProfileCompletionData>({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    city: '',
    province: 'QC',
    postalCode: '',
    language: 'fr',
    dateOfBirth: '',
    isValid: false,
    ...data
  });
  
  const [touched, setTouched] = useState<{[key: string]: boolean}>({});

  // Validate form whenever data changes
  useEffect(() => {
    const isValid = validateForm();
    const updatedData = { ...formData, isValid };
    
    setFormData(updatedData);
    onDataChange(updatedData);
    onValidationChange(isValid);
  }, [formData]);

  const validateForm = () => {
    const requiredFields = ['firstName', 'lastName', 'phone', 'language'];
    const hasRequiredFields = requiredFields.every(field => 
      formData[field as keyof ProfileCompletionData] && 
      String(formData[field as keyof ProfileCompletionData]).trim().length > 0
    );

    const isValidPhone = validatePhone(formData.phone);
    const isValidPostalCode = !formData.postalCode || validatePostalCode(formData.postalCode);

    return hasRequiredFields && isValidPhone && isValidPostalCode;
  };

  const validatePhone = (phone: string) => {
    if (!phone) {return false;}
    // Quebec phone number format validation
    const phoneRegex = /^(\+1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}$/;
    return phoneRegex.test(phone);
  };

  const validatePostalCode = (postalCode: string) => {
    if (!postalCode) {return true;} // Optional field
    // Canadian postal code format (A1A 1A1)
    const postalRegex = /^[A-Za-z]\d[A-Za-z][-\s]?\d[A-Za-z]\d$/;
    return postalRegex.test(postalCode);
  };

  const handleInputChange = (field: keyof ProfileCompletionData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      error: undefined
    }));
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const getFieldError = (field: keyof ProfileCompletionData, label: string) => {
    if (!touched[field]) {return null;}
    
    const value = formData[field];
    
    if (['firstName', 'lastName', 'phone', 'language'].includes(field)) {
      if (!value || String(value).trim().length === 0) {
        return `${label} est requis`;
      }
    }
    
    if (field === 'phone' && value && !validatePhone(String(value))) {
      return 'Format de téléphone invalide (ex: 514-123-4567)';
    }
    
    if (field === 'postalCode' && value && !validatePostalCode(String(value))) {
      return 'Format de code postal invalide (ex: H1A 1A1)';
    }
    
    return null;
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Alert className="border-blue-200 bg-blue-50">
        <User className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>Profil utilisateur:</strong> Complétez votre profil pour finaliser votre inscription 
          et accéder aux services de gestion immobilière.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <User className="h-5 w-5 mr-2" />
              Informations personnelles
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* First Name */}
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">
                  Prénom *
                </Label>
                <Input
                  id="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  onBlur={() => handleBlur('firstName')}
                  placeholder="Votre prénom"
                  className={getFieldError('firstName', 'Prénom') ? 'border-red-500' : ''}
                />
                {getFieldError('firstName', 'Prénom') && (
                  <p className="text-sm text-red-600">{getFieldError('firstName', 'Prénom')}</p>
                )}
              </div>

              {/* Last Name */}
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">
                  Nom de famille *
                </Label>
                <Input
                  id="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  onBlur={() => handleBlur('lastName')}
                  placeholder="Votre nom de famille"
                  className={getFieldError('lastName', 'Nom de famille') ? 'border-red-500' : ''}
                />
                {getFieldError('lastName', 'Nom de famille') && (
                  <p className="text-sm text-red-600">{getFieldError('lastName', 'Nom de famille')}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                  Téléphone *
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    onBlur={() => handleBlur('phone')}
                    placeholder="514-123-4567"
                    className={`pl-10 ${getFieldError('phone', 'Téléphone') ? 'border-red-500' : ''}`}
                  />
                </div>
                {getFieldError('phone', 'Téléphone') && (
                  <p className="text-sm text-red-600">{getFieldError('phone', 'Téléphone')}</p>
                )}
              </div>

              {/* Language */}
              <div className="space-y-2">
                <Label htmlFor="language" className="text-sm font-medium text-gray-700">
                  Langue préférée *
                </Label>
                <Select value={formData.language} onValueChange={(value) => handleInputChange('language', value)}>
                  <SelectTrigger className="w-full">
                    <Globe className="h-4 w-4 mr-2 text-gray-400" />
                    <SelectValue placeholder="Choisir une langue" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <MapPin className="h-5 w-5 mr-2" />
              Adresse (optionnel)
            </h3>
            
            <div className="space-y-4">
              {/* Street Address */}
              <div className="space-y-2">
                <Label htmlFor="address" className="text-sm font-medium text-gray-700">
                  Adresse
                </Label>
                <Input
                  id="address"
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  onBlur={() => handleBlur('address')}
                  placeholder="123 Rue Principale"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* City */}
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-sm font-medium text-gray-700">
                    Ville
                  </Label>
                  <Input
                    id="city"
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    onBlur={() => handleBlur('city')}
                    placeholder="Montréal"
                  />
                </div>

                {/* Province */}
                <div className="space-y-2">
                  <Label htmlFor="province" className="text-sm font-medium text-gray-700">
                    Province
                  </Label>
                  <Select value={formData.province} onValueChange={(value) => handleInputChange('province', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="QC">Québec</SelectItem>
                      <SelectItem value="ON">Ontario</SelectItem>
                      <SelectItem value="BC">Colombie-Britannique</SelectItem>
                      <SelectItem value="AB">Alberta</SelectItem>
                      <SelectItem value="SK">Saskatchewan</SelectItem>
                      <SelectItem value="MB">Manitoba</SelectItem>
                      <SelectItem value="NB">Nouveau-Brunswick</SelectItem>
                      <SelectItem value="NS">Nouvelle-Écosse</SelectItem>
                      <SelectItem value="PE">Île-du-Prince-Édouard</SelectItem>
                      <SelectItem value="NL">Terre-Neuve-et-Labrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Postal Code */}
                <div className="space-y-2">
                  <Label htmlFor="postalCode" className="text-sm font-medium text-gray-700">
                    Code postal
                  </Label>
                  <Input
                    id="postalCode"
                    type="text"
                    value={formData.postalCode}
                    onChange={(e) => handleInputChange('postalCode', e.target.value.toUpperCase())}
                    onBlur={() => handleBlur('postalCode')}
                    placeholder="H1A 1A1"
                    className={getFieldError('postalCode', 'Code postal') ? 'border-red-500' : ''}
                  />
                  {getFieldError('postalCode', 'Code postal') && (
                    <p className="text-sm text-red-600">{getFieldError('postalCode', 'Code postal')}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quebec Compliance Notice */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">
              🛡️ Protection de la vie privée
            </h4>
            <p className="text-xs text-blue-800">
              Vos informations personnelles sont collectées et utilisées uniquement pour 
              les services de gestion immobilière, conformément à la Loi 25 du Québec. 
              Vous pouvez demander l'accès, la correction ou la suppression de vos données 
              à tout moment en contactant l'administrateur.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}