import React from 'react';
import { Check, X, Eye, EyeOff } from 'lucide-react';
import { 
  validatePasswordStrength, 
  getPasswordCriteria,
  getPasswordStrengthLabel,
  getPasswordStrengthColor,
  getPasswordStrengthBarColor
} from '@/utils/password-validation';

/**
 * Props for the PasswordStrengthIndicator component.
 * Displays real-time password strength validation and criteria.
 */
interface PasswordStrengthIndicatorProps {
  password: string;
  showPassword: boolean;
  onToggleVisibility: () => void;
  className?: string;
}

/**
 * Password Strength Indicator Component.
 * 
 * Provides real-time password strength feedback with Quebec French labels
 * and visual indicators for security compliance.
 * @param root0 - Component props object.
 * @param root0.password - Current password value to validate.
 * @param root0.showPassword - Whether password is visible.
 * @param root0.onToggleVisibility - Function to toggle password visibility.
 * @param root0.className - Optional CSS class name.
 * @returns JSX element for password strength indicator.
 */
/**
 * PasswordStrengthIndicator function.
 * @param root0
 * @param root0.password
 * @param root0.showPassword
 * @param root0.onToggleVisibility
 * @param root0.className
 * @returns Function result.
 */
export function PasswordStrengthIndicator({ 
  password, 
  showPassword, 
  onToggleVisibility,
  className = ''
}: PasswordStrengthIndicatorProps) {
  const strength = validatePasswordStrength(password);
  const criteria = getPasswordCriteria(password);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Password visibility toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          Force du mot de passe
        </span>
        <button
          type="button"
          onClick={onToggleVisibility}
          className="flex items-center text-sm text-gray-500 hover:text-gray-700"
          aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        >
          {showPassword ? (
            <>
              <EyeOff className="h-4 w-4 mr-1" />
              Masquer
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 mr-1" />
              Afficher
            </>
          )}
        </button>
      </div>

      {/* Strength progress bar */}
      {password.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${getPasswordStrengthColor(strength.score)}`}>
              {getPasswordStrengthLabel(strength.score)}
            </span>
            <span className="text-xs text-gray-500">
              {strength.score}/4
            </span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthBarColor(strength.score)}`}
              style={{ width: `${(strength.score / 4) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Criteria checklist */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Exigences du mot de passe:
        </h4>
        <div className="grid grid-cols-1 gap-1 text-xs">
          <CriteriaItem 
            met={criteria.minLength}
            text="Au moins 8 caractères"
          />
          <CriteriaItem 
            met={criteria.hasUpperCase}
            text="Une lettre majuscule"
          />
          <CriteriaItem 
            met={criteria.hasLowerCase}
            text="Une lettre minuscule"
          />
          <CriteriaItem 
            met={criteria.hasNumbers}
            text="Un chiffre"
          />
          <CriteriaItem 
            met={criteria.hasSymbols}
            text="Un symbole (!@#$%^&*)"
          />
          <CriteriaItem 
            met={criteria.noCommonPatterns}
            text="Éviter les mots de passe communs"
          />
        </div>
      </div>

      {/* Feedback messages */}
      {password.length > 0 && strength.feedback.length > 0 && (
        <div className="space-y-1">
          {strength.feedback.map((message, _index) => (
            <div key={index} className="text-xs text-gray-600 flex items-start">
              <span className="mr-1">•</span>
              <span>{message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Props for the CriteriaItem component.
 * Displays individual password criteria with status indicator.
 */
interface CriteriaItemProps {
  met: boolean;
  text: string;
}

/**
 * Displays an individual password criteria item with check/x icon.
 * Shows whether the criterion is met with appropriate styling.
 * @param root0 - The props object.
 * @param root0.met - Whether the password criterion is satisfied.
 * @param root0.text - The text description of the criterion.
 * @returns JSX element for the criteria item.
 */
/**
 * CriteriaItem function.
 * @param root0
 * @param root0.met
 * @param root0.text
 * @returns Function result.
 */
function CriteriaItem({ met, text }: CriteriaItemProps) {
  return (
    <div className="flex items-center space-x-2">
      {met ? (
        <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
      ) : (
        <X className="h-3 w-3 text-red-500 flex-shrink-0" />
      )}
      <span className={met ? 'text-green-700' : 'text-red-600'}>
        {text}
      </span>
    </div>
  );
}