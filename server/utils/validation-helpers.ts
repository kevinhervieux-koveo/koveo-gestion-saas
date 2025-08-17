/**
 * Common validation helper functions.
 */
import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const emailSchema = z.string().email();
export const phoneSchema = z.string().regex(/^\+?[\d\s\-\(\)]+$/);

/**
 *
 * @param value
 */
export function isValidUUID(value: string): boolean {
  try {
    uuidSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 *
 * @param value
 */
export function isValidEmail(value: string): boolean {
  try {
    emailSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}