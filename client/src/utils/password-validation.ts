/**
 * Password validation utilities with strength indicators for secure registration.
 * Implements Quebec-compliant security standards for property management systems.
 */

/**
 *
 */
export interface PasswordStrengthResult {
  score: number; // 0-4 (weak to very strong)
  feedback: string[];
  isValid: boolean;
}

/**
 *
 */
export interface PasswordCriteria {
  minLength: boolean;
  hasUpperCase: boolean;
  hasLowerCase: boolean;
  hasNumbers: boolean;
  hasSymbols: boolean;
  noCommonPatterns: boolean;
}

/**
 * Common weak passwords and patterns to avoid.
 */
const COMMON_PATTERNS = [
  'password',
  '123456',
  'admin',
  'user',
  'test',
  'demo',
  'qwerty',
  'azerty',
  'letmein',
  'welcome',
  'monkey',
  'dragon',
  'master',
  'shadow',
  'superman',
  'batman',
];

/**
 * Validates password strength and provides detailed feedback.
 * @param password
 */
/**
 * ValidatePasswordStrength function.
 * @param password
 * @returns Function result.
 */
export function validatePasswordStrength(
  password: string | undefined | null
): PasswordStrengthResult {
  // Safety guard: handle undefined/null inputs
  if (!password || typeof password !== 'string') {
    return {
      score: 0,
      feedback: ['Veuillez entrer un mot de passe'],
      isValid: false,
    };
  }
  const criteria = getPasswordCriteria(password);
  const feedback: string[] = [];
  let score = 0;

  // Check minimum length (8+ characters)
  if (!criteria.minLength) {
    feedback.push('Mot de passe doit contenir au moins 8 caractères');
  } else {
    score += 1;
  }

  // Check character variety
  if (!criteria.hasUpperCase) {
    feedback.push('Ajouter au moins une lettre majuscule');
  } else {
    score += 0.5;
  }

  if (!criteria.hasLowerCase) {
    feedback.push('Ajouter au moins une lettre minuscule');
  } else {
    score += 0.5;
  }

  if (!criteria.hasNumbers) {
    feedback.push('Ajouter au moins un chiffre');
  } else {
    score += 1;
  }

  if (!criteria.hasSymbols) {
    feedback.push('Ajouter au moins un symbole (@, #, !, etc.)');
  } else {
    score += 1;
  }

  // Check for common patterns
  if (!criteria.noCommonPatterns) {
    feedback.push('Éviter les mots de passe communs');
  } else {
    score += 0.5;
  }

  // Bonus points for length
  if (password.length >= 12) {
    score += 0.5;
  }

  // Ensure score is within bounds
  score = Math.min(4, Math.max(0, score));

  // Determine if password is valid (minimum requirements met)
  const isValid =
    criteria.minLength &&
    criteria.hasUpperCase &&
    criteria.hasLowerCase &&
    (criteria.hasNumbers || criteria.hasSymbols) &&
    criteria.noCommonPatterns;

  return {
    score: Math.round(score),
    feedback: feedback.length > 0 ? feedback : ['Mot de passe sécurisé'],
    isValid,
  };
}

/**
 * Gets detailed password criteria evaluation.
 * @param password
 */
/**
 * GetPasswordCriteria function.
 * @param password
 * @returns Function result.
 */
export function getPasswordCriteria(password: string | undefined | null): PasswordCriteria {
  // Safety guard: handle undefined/null inputs
  if (!password || typeof password !== 'string') {
    return {
      minLength: false,
      hasUpperCase: false,
      hasLowerCase: false,
      hasNumbers: false,
      hasSymbols: false,
      noCommonPatterns: false,
    };
  }
  return {
    minLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumbers: /\d/.test(password),
    hasSymbols: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    noCommonPatterns: !COMMON_PATTERNS.some((pattern) =>
      password.toLowerCase().includes(pattern.toLowerCase())
    ),
  };
}

/**
 * Gets password strength level text with Quebec French labels.
 * @param score
 */
/**
 * GetPasswordStrengthLabel function.
 * @param score
 * @returns Function result.
 */
export function getPasswordStrengthLabel(score: number): string {
  switch (score) {
    case 0:
    case 1:
      return 'Très faible';
    case 2:
      return 'Faible';
    case 3:
      return 'Moyen';
    case 4:
      return 'Fort';
    default:
      return 'Très faible';
  }
}

/**
 * Gets password strength color for UI indicators.
 * @param score
 */
/**
 * GetPasswordStrengthColor function.
 * @param score
 * @returns Function result.
 */
export function getPasswordStrengthColor(score: number): string {
  switch (score) {
    case 0:
    case 1:
      return 'text-red-600';
    case 2:
      return 'text-orange-500';
    case 3:
      return 'text-yellow-500';
    case 4:
      return 'text-green-600';
    default:
      return 'text-red-600';
  }
}

/**
 * Gets progress bar color for password strength visualization.
 * @param score
 */
/**
 * GetPasswordStrengthBarColor function.
 * @param score
 * @returns Function result.
 */
export function getPasswordStrengthBarColor(score: number): string {
  switch (score) {
    case 0:
    case 1:
      return 'bg-red-500';
    case 2:
      return 'bg-orange-500';
    case 3:
      return 'bg-yellow-500';
    case 4:
      return 'bg-green-500';
    default:
      return 'bg-red-500';
  }
}
