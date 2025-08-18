import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Lock, AlertTriangle } from 'lucide-react';
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
export function PasswordCreationStep({ 
  data, 
  onDataChange, 
  onValidationChange 
}: WizardStepProps) {
  const { t: _t } = useLanguage();
  const [formData, setFormData] = useState<PasswordCreationData>({
    password: '',
    confirmPassword: '',
    isValid: false,
    ...data
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState({
    password: false,
    confirmPassword: false
  });

  // Validate form whenever password fields change
  useEffect(() => {
    const passwordStrength = validatePasswordStrength(formData.password);
    const passwordsMatch = formData.password === formData.confirmPassword;
    const hasPassword = formData.password.length > 0;
    const hasConfirmPassword = formData.confirmPassword.length > 0;
    const isValid = passwordStrength.isValid && passwordsMatch && hasPassword && hasConfirmPassword;
    
    const updatedData = { ...formData, isValid };
    onDataChange(updatedData);
    onValidationChange(isValid);
  }, [formData.password, formData.confirmPassword]);



  const handlePasswordChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      password: value,
      error: undefined
    }));
  };

  const handleConfirmPasswordChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      confirmPassword: value,
      error: undefined
    }));
  };

  const handleBlur = (field: 'password' | 'confirmPassword') => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const getPasswordMatchError = () => {
    if (!touched.confirmPassword || !formData.confirmPassword) {return null;}
    
    if (formData.password !== formData.confirmPassword) {
      return 'Les mots de passe ne correspondent pas';
    }
    return null;
  };

  const passwordStrength = validatePasswordStrength(formData.password);
  const passwordMatchError = getPasswordMatchError();
  const hasPasswordError = touched.password && !passwordStrength.isValid && formData.password.length > 0;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Security Notice */}
      <Alert className="border-blue-200 bg-blue-50">
        <Shield className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>Sécurité renforcée:</strong> Créez un mot de passe sécurisé pour protéger votre compte 
          et respecter les standards de sécurité québécois.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-gray-700">
              Mot de passe *
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                onBlur={() => handleBlur('password')}
                placeholder="Entrez votre mot de passe"
                className={`pl-10 ${hasPasswordError ? 'border-red-500 focus:border-red-500' : ''}`}
                aria-describedby="password-requirements"
              />
            </div>
            
            {/* Password Strength Indicator */}
            <PasswordStrengthIndicator
              password={formData.password}
              showPassword={showPassword}
              onToggleVisibility={() => setShowPassword(!showPassword)}
              className="mt-3"
            />

            {hasPasswordError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Le mot de passe ne respecte pas les exigences de sécurité.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
              Confirmer le mot de passe *
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                onBlur={() => handleBlur('confirmPassword')}
                placeholder="Confirmez votre mot de passe"
                className={`pl-10 ${passwordMatchError ? 'border-red-500 focus:border-red-500' : ''}`}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center text-sm text-gray-600">
                {formData.confirmPassword && formData.password === formData.confirmPassword && (
                  <span className="text-green-600 flex items-center">
                    <Shield className="h-4 w-4 mr-1" />
                    Les mots de passe correspondent
                  </span>
                )}
              </div>
              
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                {showConfirmPassword ? 'Masquer' : 'Afficher'}
              </button>
            </div>

            {passwordMatchError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {passwordMatchError}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Security Guidelines */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              💡 Conseils de sécurité
            </h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Utilisez une combinaison unique de lettres, chiffres et symboles</li>
              <li>• Évitez les informations personnelles (nom, date de naissance)</li>
              <li>• Ne réutilisez pas un mot de passe d'un autre compte</li>
              <li>• Considérez l'utilisation d'un gestionnaire de mots de passe</li>
            </ul>
          </div>

          {/* Quebec Compliance Notice */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">
              🛡️ Conformité Québécoise - Sécurité des données
            </h4>
            <p className="text-xs text-blue-800">
              Votre mot de passe est chiffré selon les standards de l'industrie et stocké 
              de manière sécurisée conformément à la Loi 25 du Québec. Nous ne pouvons 
              pas voir votre mot de passe une fois qu'il est enregistré.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}