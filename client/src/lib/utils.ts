import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines class names using clsx and merges conflicting Tailwind classes with tailwind-merge.
 * This utility ensures proper Tailwind CSS class precedence and removes duplicate classes.
 * 
 * Updated: September 09, 2025 for Koveo Gestion Quebec property management platform.
 *
 * @param inputs - Class names to combine (strings, objects, arrays, etc.)
 * @returns Merged and optimized class name string
 * @example
 * ```typescript
 * cn('px-4', 'px-2') // Returns 'px-2' (tailwind-merge removes conflicting px-4)
 * cn('text-red-500', { 'font-bold': true }) // Returns 'text-red-500 font-bold'
 * cn('border', 'border-red-500', isError && 'border-red-600') // Quebec form styling
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely formats a status string by replacing underscores with spaces and capitalizing
 * @param status - The status string to format (can be null/undefined)
 * @param fallback - Fallback text if status is null/undefined
 * @returns Formatted status string or fallback
 */
export function formatStatus(status: string | null | undefined, fallback: string = 'Unknown'): string {
  if (!status || typeof status !== 'string' || status.trim().length === 0) {
    return fallback;
  }
  return status.replace(/_/g, ' ');
}

/**
 * Safely capitalizes the first letter of each word in a string
 * @param text - The text to capitalize (can be null/undefined)
 * @param fallback - Fallback text if input is null/undefined
 * @returns Capitalized text or fallback
 */
export function capitalizeWords(text: string | null | undefined, fallback: string = ''): string {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return fallback;
  }
  return text.split(' ').map(word => {
    if (word.length === 0) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

/**
 * Safely formats a status string with capitalization
 * @param status - The status string to format (can be null/undefined)
 * @param fallback - Fallback text if status is null/undefined
 * @returns Formatted and capitalized status string or fallback
 */
export function formatStatusCapitalized(status: string | null | undefined, fallback: string = 'Unknown'): string {
  const formatted = formatStatus(status, fallback);
  return capitalizeWords(formatted, fallback);
}

/**
 * Safely capitalizes the first letter of a string
 * @param str - The string to capitalize (can be null/undefined)
 * @param fallback - Fallback text if input is null/undefined
 * @returns Capitalized string or fallback
 */
export function safeCapitalize(str: string | null | undefined, fallback: string = ''): string {
  if (!str || typeof str !== 'string' || str.length === 0) {
    return fallback;
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Safely formats a date to ISO date string (YYYY-MM-DD)
 * @param date - The date to format (can be null/undefined)
 * @param fallback - Fallback text if date is null/undefined
 * @returns ISO date string or fallback
 */
export function safeFormatDateISO(date: Date | string | null | undefined, fallback: string = ''): string {
  if (!date) {
    return fallback;
  }
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) {
      return fallback;
    }
    return dateObj.toISOString().split('T')[0];
  } catch {
    return fallback;
  }
}

/**
 * Safely performs string operations with null/undefined checking
 * @param str - The string to operate on
 * @param fallback - Fallback value if string is null/undefined
 * @returns Safe string operations object
 */
export function safeString(str: string | null | undefined, fallback: string = '') {
  const safeStr = str && typeof str === 'string' ? str : fallback;
  
  return {
    toLowerCase: () => safeStr.toLowerCase(),
    toUpperCase: () => safeStr.toUpperCase(),
    includes: (searchString: string) => safeStr.includes(searchString),
    split: (separator: string) => safeStr.split(separator),
    charAt: (index: number) => safeStr.charAt(index),
    slice: (start?: number, end?: number) => safeStr.slice(start, end),
    trim: () => safeStr.trim(),
    length: safeStr.length,
    value: safeStr
  };
}

/**
 * Safely accesses nested object properties with optional fallback
 * @param obj - The object to access properties from
 * @param path - Dot notation path to the property
 * @param fallback - Fallback value if property is null/undefined
 * @returns Property value or fallback
 */
export function safeGet<T>(obj: any, path: string, fallback: T): T {
  if (!obj || typeof obj !== 'object') {
    return fallback;
  }
  
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current == null || typeof current !== 'object' || !(key in current)) {
      return fallback;
    }
    current = current[key];
  }
  
  return current != null ? current : fallback;
}

/**
 * Safely accesses array elements with bounds checking
 * @param arr - The array to access
 * @param index - The index to access
 * @param fallback - Fallback value if index is out of bounds or array is null
 * @returns Array element or fallback
 */
export function safeArrayAccess<T>(arr: T[] | null | undefined, index: number, fallback: T): T {
  if (!arr || !Array.isArray(arr) || index < 0 || index >= arr.length) {
    return fallback;
  }
  
  const element = arr[index];
  return element != null ? element : fallback;
}

/**
 * Safely checks if a value is a valid non-empty string
 * @param value - The value to check
 * @returns true if value is a non-empty string, false otherwise
 */
export function isValidString(value: any): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Safely checks if a value is a valid array with elements
 * @param value - The value to check
 * @returns true if value is a non-empty array, false otherwise
 */
export function isValidArray(value: any): value is any[] {
  return Array.isArray(value) && value.length > 0;
}
