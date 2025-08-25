/**
 * Common validation helper functions.
 */
import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const emailSchema = z.string().email();
export const phoneSchema = z.string().regex(/^\+?[\d\s\-\(\)]+$/);

/**
 * Validates if a string is a properly formatted UUID v4.
 * Uses Zod schema validation for consistent error handling.
 *
 * @param {string} value - String to validate as UUID.
 * @returns {boolean} True if value is a valid UUID, false otherwise.
 *
 * @example
 * ```typescript
 * isValidUUID('123e4567-e89b-12d3-a456-426614174000'); // true
 * isValidUUID('invalid-uuid'); // false
 * ```
 */
/**
 * IsValidUUID function.
 * @param value
 * @param _value
 * @returns Function result.
 */
export function isValidUUID(_value: string): boolean {
  try {
    uuidSchema.parse(_value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates if a string is a properly formatted email address.
 * Uses Zod schema validation with RFC-compliant email regex.
 *
 * @param {string} value - String to validate as email address.
 * @returns {boolean} True if value is a valid email, false otherwise.
 *
 * @example
 * ```typescript
 * isValidEmail('user@example.com'); // true
 * isValidEmail('invalid-email'); // false
 * ```
 */
/**
 * IsValidEmail function.
 * @param value
 * @param _value
 * @returns Function result.
 */
export function isValidEmail(_value: string): boolean {
  try {
    emailSchema.parse(_value);
    return true;
  } catch {
    return false;
  }
}
