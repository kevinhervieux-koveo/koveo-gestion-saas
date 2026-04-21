import { getFinancialYearRange, FinancialYearRange } from '@/utils/financial-year';

/**
 * Payment object with at minimum a scheduled date
 */
export interface PaymentWithDate {
  scheduledDate: string;
  [key: string]: any;
}

/**
 * Payment object with scheduled date and amount
 */
export interface PaymentWithAmount extends PaymentWithDate {
  amount: string | number;
}

/**
 * Filters payments that fall within a specific financial year
 * @param payments - Array of payment objects with scheduledDate
 * @param financialYearRange - The financial year range object with start and end dates
 * @returns Payments that fall within the financial year
 * 
 * @example
 * const payments = [
 *   { scheduledDate: "2024-03-15", amount: 100 },
 *   { scheduledDate: "2024-05-20", amount: 200 }
 * ];
 * const yearRange = { start: new Date(2024, 0, 1), end: new Date(2024, 11, 31) };
 * const filtered = getPaymentsInFinancialYear(payments, yearRange);
 * // Returns both payments as they're both in 2024
 */
export function getPaymentsInFinancialYear<T extends PaymentWithDate>(
  payments: T[],
  financialYearRange: { start: Date; end: Date }
): T[] {
  if (!payments || payments.length === 0) {
    return [];
  }

  return payments.filter((payment) => {
    const paymentDate = new Date(payment.scheduledDate);
    return paymentDate >= financialYearRange.start && paymentDate <= financialYearRange.end;
  });
}

/**
 * Calculates how many payments fall in each financial year
 * @param payments - Array of payment objects
 * @param financialYearStart - The building's fiscal year start date (format: "YYYY-MM-DD")
 * @returns Object mapping year labels to payment counts: { "2024": 2, "2025": 3, "2026": 1 }
 * 
 * @example
 * const payments = [
 *   { scheduledDate: "2024-03-15" },
 *   { scheduledDate: "2024-05-20" },
 *   { scheduledDate: "2025-02-10" }
 * ];
 * const distribution = getPaymentDistributionAcrossYears(payments, null);
 * // Returns: { "2024": 2, "2025": 1 }
 * 
 * @example
 * // With fiscal year starting April 1st
 * const distribution = getPaymentDistributionAcrossYears(payments, "2024-04-01");
 * // Returns: { "2023-2024": 1, "2024-2025": 2 }
 */
export function getPaymentDistributionAcrossYears(
  payments: PaymentWithDate[],
  financialYearStart: string | null
): Record<string, number> {
  if (!payments || payments.length === 0) {
    return {};
  }

  const distribution: Record<string, number> = {};

  payments.forEach((payment) => {
    const paymentDate = new Date(payment.scheduledDate);
    const yearRange = getFinancialYearRange(financialYearStart, paymentDate);
    
    if (!distribution[yearRange.label]) {
      distribution[yearRange.label] = 0;
    }
    distribution[yearRange.label]++;
  });

  return distribution;
}

/**
 * Generates a label for bills spanning multiple financial years
 * @param payments - Array of payment objects
 * @param currentFinancialYear - The current financial year object
 * @param financialYearStart - The building's fiscal year start date
 * @param t - Translation function
 * @returns Label like "2024 portion (1/3)" or null if bill is only in current year
 * 
 * @example
 * // Bill with 2 payments in 2024 and 4 payments in other years
 * const label = getBillFinancialYearLabel(
 *   payments,
 *   { label: "2024", startYear: "2024", start: new Date(2024, 0, 1), end: new Date(2024, 11, 31) },
 *   null,
 *   (key) => key
 * );
 * // Returns: "2024 portion (2/6)"
 * 
 * @example
 * // Bill with all payments in current year
 * const label = getBillFinancialYearLabel(allIn2024Payments, currentYear, null, t);
 * // Returns: null
 */
export function getBillFinancialYearLabel(
  payments: PaymentWithDate[],
  currentFinancialYear: { label: string; startYear: string; start: Date; end: Date },
  financialYearStart: string | null,
  t: (key: string) => string
): string | null {
  if (!payments || payments.length === 0) {
    return null;
  }

  const distribution = getPaymentDistributionAcrossYears(payments, financialYearStart);
  const yearLabels = Object.keys(distribution);

  // If all payments are in a single year and it's the current year, return null
  if (yearLabels.length === 1 && yearLabels[0] === currentFinancialYear.label) {
    return null;
  }

  // Get count of payments in the current financial year
  const currentYearCount = distribution[currentFinancialYear.label] || 0;
  const totalCount = payments.length;

  // If there are no payments in the current year, return null
  if (currentYearCount === 0) {
    return null;
  }

  // Return the label in format "{currentYear} portion ({currentCount}/{totalCount})"
  return `${currentFinancialYear.label} ${t('portion')} (${currentYearCount}/${totalCount})`;
}

/**
 * Calculates the total amount of payments in a specific financial year
 * @param payments - Array of payment objects with amount and scheduledDate
 * @param financialYearRange - The financial year range
 * @returns Total amount for that financial year
 * 
 * @example
 * const payments = [
 *   { scheduledDate: "2024-03-15", amount: 100 },
 *   { scheduledDate: "2024-05-20", amount: "200.50" },
 *   { scheduledDate: "2025-02-10", amount: 300 }
 * ];
 * const yearRange = { start: new Date(2024, 0, 1), end: new Date(2024, 11, 31) };
 * const total = getTotalAmountForFinancialYear(payments, yearRange);
 * // Returns: 300.50 (100 + 200.50)
 */
export function getTotalAmountForFinancialYear(
  payments: PaymentWithAmount[],
  financialYearRange: { start: Date; end: Date }
): number {
  if (!payments || payments.length === 0) {
    return 0;
  }

  const paymentsInYear = getPaymentsInFinancialYear(payments, financialYearRange);

  return paymentsInYear.reduce((total, payment) => {
    const amount = typeof payment.amount === 'string' ? parseFloat(payment.amount) : payment.amount;
    return total + (isNaN(amount) ? 0 : amount);
  }, 0);
}
