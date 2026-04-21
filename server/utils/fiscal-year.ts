/**
 * Server-side fiscal year utility functions
 * Port of client-side utilities for use in backend services
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
      end: new Date(year, 11, 31, 23, 59, 59),
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
  const end = new Date(startYear + 1, startMonth - 1, startDay - 1, 23, 59, 59);

  return {
    label: `${startYear}-${startYear + 1}`,
    startYear: startYear.toString(),
    start,
    end,
  };
}

/**
 * Group payments by fiscal year
 * @param payments - Array of payment dates
 * @param financialYearStart - The building's fiscal year start date
 * @returns Map of fiscal year label to payment dates in that year
 */
export function groupPaymentsByFiscalYear(
  payments: Date[],
  financialYearStart: string | null
): Map<string, Date[]> {
  const groups = new Map<string, Date[]>();

  for (const payment of payments) {
    const yearRange = getFinancialYearRange(financialYearStart, payment);
    if (!groups.has(yearRange.label)) {
      groups.set(yearRange.label, []);
    }
    groups.get(yearRange.label)!.push(payment);
  }

  return groups;
}

/**
 * Filter dates that fall within a specific financial year range
 * @param dates - Array of dates to filter
 * @param yearRange - The financial year range object
 * @returns Filtered dates within the year range
 */
export function getPaymentsInFinancialYear(
  dates: Date[],
  yearRange: FinancialYearRange
): Date[] {
  return dates.filter(date => date >= yearRange.start && date <= yearRange.end);
}
