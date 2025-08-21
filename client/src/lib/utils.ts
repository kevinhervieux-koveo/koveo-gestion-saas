import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines class names using clsx and merges conflicting Tailwind classes with tailwind-merge.
 * This utility ensures proper Tailwind CSS class precedence and removes duplicate classes.
 *
 * @param {...ClassValue} inputs - Class names to combine (strings, objects, arrays, etc.).
 * @returns {string} Merged and optimized class name string.
 * @example
 * ```typescript
 * cn('px-4', 'px-2') // Returns 'px-2' (tailwind-merge removes conflicting px-4)
 * cn('text-red-500', { 'font-bold': true }) // Returns 'text-red-500 font-bold'
 * ```
 */
/**
 * Cn function.
 * @param {...any} inputs
 * @returns Function result.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
