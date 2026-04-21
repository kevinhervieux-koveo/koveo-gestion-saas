/**
 * Financial year utility functions
 */

export interface FinancialYearRange {
  label: string;
  startYear: string;
  start: Date;
  end: Date;
}

/**
 * Calculate the financial year range based on a fiscal year start date and a pivot date.
 * 
 * @param financialYearStart - The fiscal year start date in format "YYYY-MM-DD" (e.g., "2024-04-01" for April 1st start)
 * @param pivotDate - The date to use for calculating which financial year we're in (defaults to current date)
 * @returns An object containing the financial year label, start year, start date, and end date
 * 
 * @example
 * // For a fiscal year starting April 1st, on March 15, 2024:
 * getFinancialYearRange("2024-04-01", new Date(2024, 2, 15))
 * // Returns: { label: "2023-2024", startYear: "2023", start: Date(2023-04-01), end: Date(2024-03-31) }
 * 
 * @example
 * // For calendar year (no fiscal year start):
 * getFinancialYearRange(null, new Date(2024, 5, 15))
 * // Returns: { label: "2024", startYear: "2024", start: Date(2024-01-01), end: Date(2024-12-31) }
 */
export function getFinancialYearRange(
  financialYearStart: string | null,
  pivotDate: Date = new Date()
): FinancialYearRange {
  if (!financialYearStart) {
    const year = pivotDate.getFullYear();
    return {
      label: year.toString(),
      startYear: year.toString(),
      start: new Date(year, 0, 1),
      end: new Date(year, 11, 31),
    };
  }

  const [, startMonth, startDay] = financialYearStart.split('-').map(Number);
  const pivotMonth = pivotDate.getMonth() + 1;
  const pivotDay = pivotDate.getDate();

  const startYear =
    pivotMonth < startMonth || (pivotMonth === startMonth && pivotDay < startDay)
      ? pivotDate.getFullYear() - 1
      : pivotDate.getFullYear();

  const start = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(startYear + 1, startMonth - 1, startDay - 1);

  return {
    label: `${startYear}-${startYear + 1}`,
    startYear: startYear.toString(),
    start,
    end,
  };
}

/**
 * Format financial year display text with month names.
 * 
 * @param start - The start date of the financial year
 * @param end - The end date of the financial year
 * @param t - Translation function
 * @returns Formatted string like "April 1, 2023 - March 31, 2024"
 */
export function formatFinancialYearDisplay(
  start: Date,
  end: Date,
  t: (key: string) => string
): string {
  const monthNames = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ];

  const startMonthName = t(monthNames[start.getMonth()]);
  const endMonthName = t(monthNames[end.getMonth()]);

  return `${startMonthName} ${start.getDate()}, ${start.getFullYear()} - ${endMonthName} ${end.getDate()}, ${end.getFullYear()}`;
}

/**
 * Format financial year start date for display.
 * 
 * @param financialYearStart - The fiscal year start date in format "YYYY-MM-DD"
 * @param t - Translation function
 * @returns Formatted string like "Financial year starts April 1"
 */
export function formatFinancialYearStart(
  financialYearStart: string | null,
  t: (key: string) => string
): string {
  const monthNames = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ];

  if (!financialYearStart) {
    const monthName = t(monthNames[0]);
    return `${t('financialYearStarts')} ${monthName} 1`;
  }

  const [, month, day] = financialYearStart.split('-').map(Number);
  const monthName = t(monthNames[month - 1]);
  return `${t('financialYearStarts')} ${monthName} ${day}`;
}
