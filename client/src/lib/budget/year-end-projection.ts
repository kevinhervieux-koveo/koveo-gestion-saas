/**
 * @file Pure helpers for the budget page's "Year End Projection" card.
 *
 * The projection value displayed on the budget page is the running balance
 * at the END of the fiscal year that contains today's date. This is
 * deliberately independent of the chart window length the user selects
 * with the "Length" filter.
 *
 * These helpers were extracted from `client/src/pages/manager/budget/index.tsx`
 * so the fiscal-year-end derivation can be unit-tested without rendering
 * React components.
 */

export interface FiscalYearEnd {
  /** Calendar month (1-12) of the fiscal-year-end period. */
  fyEndMonth: number;
  /** Calendar year of the fiscal-year-end period. */
  fyEndYear: number;
}

/**
 * Parse a `YYYY-MM-DD` financial-year start string into its month component.
 * Returns `null` when the value is missing or malformed.
 */
function parseFinancialYearStartMonth(
  financialYearStart?: string | null,
): number | null {
  if (!financialYearStart) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(financialYearStart);
  if (!match) return null;
  const month = parseInt(match[2], 10);
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;
  return month;
}

/**
 * Compute the calendar month and year of the END of the CURRENT fiscal year
 * for the given reference date.
 *
 * - When `financialYearStart` is missing or malformed, the fiscal year is
 *   treated as the calendar year (FY-end = December of the reference year).
 * - When the FY starts in January, FY-end is December of the same calendar year.
 * - Otherwise FY-end is the month BEFORE the FY-start month, in the calendar
 *   year AFTER the FY-start year that contains `today`.
 *
 * Examples:
 *  - `today = 2026-04-15`, FY starts on `2025-01-01` → `{ fyEndMonth: 12, fyEndYear: 2026 }`
 *  - `today = 2026-04-15`, FY starts on `2026-07-01` → `{ fyEndMonth: 6, fyEndYear: 2026 }`
 *    (today is still inside the FY that started 2025-07-01)
 *  - `today = 2026-09-15`, FY starts on `2026-07-01` → `{ fyEndMonth: 6, fyEndYear: 2027 }`
 */
export function getFiscalYearEnd(
  today: Date,
  financialYearStart?: string | null,
): FiscalYearEnd {
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;

  const fyStartMonth = parseFinancialYearStartMonth(financialYearStart);

  if (fyStartMonth === null) {
    return { fyEndMonth: 12, fyEndYear: todayYear };
  }

  const fyEndMonth = fyStartMonth === 1 ? 12 : fyStartMonth - 1;

  // Calendar year in which the fiscal year containing `today` started.
  const currentFyStartYear =
    todayMonth < fyStartMonth ? todayYear - 1 : todayYear;

  const fyEndYear =
    fyStartMonth === 1 ? currentFyStartYear : currentFyStartYear + 1;

  return { fyEndMonth, fyEndYear };
}

/**
 * Number of whole months (inclusive of the fiscal-year-end month) remaining
 * from `today` until the fiscal-year-end period. Always >= 0.
 */
export function getMonthsRemainingToFiscalYearEnd(
  today: Date,
  financialYearStart?: string | null,
): number {
  const { fyEndMonth, fyEndYear } = getFiscalYearEnd(today, financialYearStart);
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const diff = (fyEndYear - todayYear) * 12 + (fyEndMonth - todayMonth);
  return Math.max(0, diff);
}
