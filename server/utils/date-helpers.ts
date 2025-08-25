/**
 * Date manipulation utilities for Quebec timezone.
 */

export const QUEBEC_TIMEZONE = 'America/Montreal';

/**
 *
 * @param date
 */
/**
 * FormatDateForQuebec function.
 * @param date
 * @returns Function result.
 */
export function formatDateForQuebec(date: Date): string {
  return date.toLocaleDateString('en-CA', {
    timeZone: QUEBEC_TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 *
 * @param date
 */
/**
 * GetQuebecTime function.
 * @param date
 * @returns Function result.
 */
export function getQuebecTime(date?: Date): Date {
  const targetDate = date || new Date();
  const quebecTime = new Date(targetDate.toLocaleString('en-US', { timeZone: QUEBEC_TIMEZONE }));
  return quebecTime;
}
