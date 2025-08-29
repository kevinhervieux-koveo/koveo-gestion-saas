/**
 * Input sanitization and validation utilities for Quebec property management system.
 * Provides security and data consistency functions for user input processing.
 */

/**
 * Sanitizes user input to prevent XSS and injection attacks
 */
export function sanitizeString(input: string): string {
  if (!input) return '';

  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/['";]/g, '') // Remove potential SQL injection characters
    .substring(0, 500); // Limit length to prevent buffer overflow
}

/**
 * Validates and normalizes email addresses
 */
export function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.toLowerCase().trim();
}

/**
 * Validates Quebec postal code format
 */
export function isValidQuebecPostalCode(postalCode: string): boolean {
  if (!postalCode) return true; // Optional field
  const quebecPostalCodeRegex =
    /^[ABCEGHJKLMNPRSTVXY]\d[ABCEGHJKLMNPRSTVWXYZ] ?\d[ABCEGHJKLMNPRSTVWXYZ]\d$/i;
  return quebecPostalCodeRegex.test(postalCode.trim());
}

/**
 * Validates North American phone number format
 */
export function isValidNorthAmericanPhone(phone: string): boolean {
  if (!phone) return true; // Optional field
  const phoneRegex = /^(\+1\s?)?(\([0-9]{3}\)|[0-9]{3})[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}$/;
  return phoneRegex.test(phone.trim());
}

/**
 * Sanitizes and validates user names (first, last)
 */
export function sanitizeName(name: string): string {
  if (!name) return '';

  return name
    .trim()
    .replace(/[^a-zA-ZÀ-ÿ\s'-]/g, '') // Allow accented characters for Quebec names
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .substring(0, 100); // Limit to 100 characters
}

/**
 * Generates a secure, unique username from email
 */
export function generateUsernameFromEmail(email: string): string {
  if (!email) return '';

  return email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric characters
    .substring(0, 30); // Limit username length
}

/**
 * Validates password strength for Quebec compliance
 */
export function validatePasswordStrength(password: string): { isValid: boolean; message?: string } {
  if (!password) {
    return { isValid: false, message: 'Password is required' };
  }

  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' };
  }

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[@$!%*?&]/.test(password);

  if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecialChar) {
    return {
      isValid: false,
      message:
        'Password must contain uppercase, lowercase, number, and special character (@$!%*?&)',
    };
  }

  return { isValid: true };
}

/**
 * Sanitizes and validates address fields for Quebec addresses
 */
export function sanitizeAddress(address: string): string {
  if (!address) return '';

  return address
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML
    .substring(0, 200); // Limit address length
}
