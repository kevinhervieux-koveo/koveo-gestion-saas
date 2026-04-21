/**
 * Utility functions for handling numeric inputs across the application
 */

/**
 * Strips leading zeros from numeric string inputs
 * Examples: "0123" -> "123", "00.45" -> "0.45", "000" -> "0"
 */
export function stripLeadingZeros(value: string): string {
  if (!value || typeof value !== 'string') return value || '';
  
  // Handle empty or whitespace-only strings
  if (value.trim() === '') return '';
  
  // Handle strings that are just zeros
  if (/^0+$/.test(value)) return '0';
  
  // Handle decimal numbers (preserve one zero before decimal point if needed)
  if (value.includes('.')) {
    const [integer, decimal] = value.split('.');
    const strippedInteger = integer.replace(/^0+/, '') || '0';
    return `${strippedInteger}.${decimal}`;
  }
  
  // Handle integer numbers (remove all leading zeros except the last one if all zeros)
  return value.replace(/^0+/, '') || '0';
}

/**
 * Normalizes money input strings by stripping leading zeros and ensuring proper decimal formatting
 * Examples: "0123.45" -> "123.45", "000.00" -> "0.00"
 */
export function normalizeMoney(value: string): string {
  if (!value || typeof value !== 'string') return value || '';
  
  const stripped = stripLeadingZeros(value);
  
  // Ensure we don't have multiple decimal points
  const parts = stripped.split('.');
  if (parts.length > 2) {
    return `${parts[0]}.${parts.slice(1).join('')}`;
  }
  
  return stripped;
}

/**
 * Normalizes percentage input strings
 * Examples: "0003.50" -> "3.50", "025.0" -> "25.0"
 */
export function normalizePercentage(value: string): string {
  return stripLeadingZeros(value);
}

/**
 * Formats a numeric value for display, removing unnecessary trailing zeros
 * Examples: 123.00 -> "123", 123.45 -> "123.45"
 */
export function formatDisplayNumber(value: number): string {
  if (value === 0) return '0';
  return value.toString().replace(/\.0+$/, '');
}