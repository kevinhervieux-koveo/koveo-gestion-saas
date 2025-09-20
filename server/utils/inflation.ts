/**
 * @file Inflation Calculation Utilities
 * @description Helper functions for handling inflation calculations in budget forecasts
 */

// TypeScript interface for building amenities/extended configuration
export interface ExtendedBuildingConfig {
  emergencyFundMinimum?: number;
  operatingCashMinimum?: number;
  revenueGrowthRate?: number;
  revenueInflation?: number;
  reserveFundTarget?: number;
  utilityInflationRate?: number;
  maintenanceInflationRate?: number;
  costInflationRate?: number;
  specialInvestmentBudget?: number;
  investmentHorizonYears?: number;
  capitalProjectReserve?: number;
  customBankFields?: Record<string, number>;
  customRevenueLines?: Array<{
    id: string;
    description: string;
    monthlyAmount: number;
  }>;
  // Bills inflation configuration properties
  useGlobalBillsInflation?: boolean;
  globalBillsInflationRate?: number;
  categoryInflationRates?: Record<string, number>;
  [key: string]: any; // Allow additional properties
}

/**
 * Determine the correct inflation rate for monthly fees based on bills configuration
 * @param extendedConfig Extended configuration containing bills inflation settings
 * @param revenueInflation Revenue inflation rate (as decimal) - primary fallback for backward compatibility
 * @param generalInflation General inflation rate (as decimal) - final fallback
 * @returns Inflation rate to apply to monthly fees (as decimal)
 */
export function getMonthlyFeesInflationRate(
  extendedConfig: ExtendedBuildingConfig,
  revenueInflation: number,
  generalInflation: number
): number {
  // Check for category-specific rates for monthly fees (highest priority)
  if (extendedConfig.categoryInflationRates && typeof extendedConfig.categoryInflationRates === 'object') {
    const categoryRates = extendedConfig.categoryInflationRates as Record<string, number>;
    
    // Try different possible category names for monthly fees
    const possibleCategories = ['monthly_fees', 'maintenance', 'monthly', 'fees'];
    for (const category of possibleCategories) {
      if (categoryRates[category] !== undefined) {
        const categoryRate = parseFloat(String(categoryRates[category]));
        // Convert from percentage to decimal if needed
        return categoryRate > 1 ? categoryRate / 100 : categoryRate;
      }
    }
    
    // If no specific category found, try 'general' or 'other' as fallback within category rates
    if (categoryRates['general'] !== undefined) {
      const generalRate = parseFloat(String(categoryRates['general']));
      return generalRate > 1 ? generalRate / 100 : generalRate;
    }
    if (categoryRates['other'] !== undefined) {
      const otherRate = parseFloat(String(categoryRates['other']));
      return otherRate > 1 ? otherRate / 100 : otherRate;
    }
  }

  // Check if global bills inflation should be used (second priority)
  if (extendedConfig.useGlobalBillsInflation && extendedConfig.globalBillsInflationRate !== undefined) {
    const globalRate = parseFloat(String(extendedConfig.globalBillsInflationRate));
    // Convert from percentage to decimal if needed
    return globalRate > 1 ? globalRate / 100 : globalRate;
  }

  // BACKWARD COMPATIBILITY: Fall back to revenueInflation first (third priority)
  // This maintains backward compatibility where monthly fees used revenueInflation before bills config existed
  if (revenueInflation !== undefined && Number.isFinite(revenueInflation)) {
    return revenueInflation;
  }

  // Final fallback to general inflation rate
  return generalInflation;
}

/**
 * Safely convert financialYearStart from database to Date object with validation
 * @param financialYearStart Raw value from database (string, Date, or null/undefined)
 * @returns Valid Date object or null
 */
export function safeConvertFinancialYearStart(financialYearStart: string | Date | null | undefined): Date | null {
  if (!financialYearStart) {
    return null;
  }

  let dateValue: Date;
  
  try {
    if (financialYearStart instanceof Date) {
      dateValue = financialYearStart;
    } else if (typeof financialYearStart === 'string') {
      dateValue = new Date(financialYearStart);
    } else {
      return null;
    }

    // Validate that the date is valid
    if (isNaN(dateValue.getTime())) {
      console.warn(`⚠️ [BUDGET CALCULATIONS] Invalid financialYearStart date: ${financialYearStart}`);
      return null;
    }

    return dateValue;
  } catch (error) {
    console.warn(`⚠️ [BUDGET CALCULATIONS] Error converting financialYearStart: ${financialYearStart}`, error);
    return null;
  }
}

/**
 * Determine if inflation should be applied based on financial year start date
 * @param currentDate Current forecast date
 * @param financialYearStart Financial year start date (can be null/undefined)
 * @returns True if inflation should be applied, false otherwise
 */
export function shouldApplyInflation(currentDate: Date, financialYearStart: Date | null | undefined): boolean {
  // If no financial year start date is set, apply inflation from the beginning
  if (!financialYearStart) {
    return true;
  }
  
  // Validate that both dates are valid
  if (!currentDate || isNaN(currentDate.getTime()) || !financialYearStart || isNaN(financialYearStart.getTime())) {
    console.warn(`⚠️ [BUDGET CALCULATIONS] Invalid dates for inflation check: currentDate=${currentDate}, financialYearStart=${financialYearStart}`);
    return true; // Default to applying inflation if dates are invalid
  }
  
  // Apply inflation only if current date is after financial year start
  return currentDate >= financialYearStart;
}

/**
 * Calculate the financial year for a given date
 * @param currentDate Date to calculate financial year for
 * @param fyStartMonth Financial year start month (1-12)
 * @returns Financial year (e.g., if FY starts May 2027, April 2028 returns 2027)
 */
export function getFinancialYear(currentDate: Date, fyStartMonth: number): number {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // getMonth() returns 0-11, we need 1-12
  
  // If current month is before FY start month, we're in the previous financial year
  if (month < fyStartMonth) {
    return year - 1;
  } else {
    return year;
  }
}

/**
 * Calculate years elapsed between two financial years
 * @param currentDate Current forecast date
 * @param anchorDate Anchor date (typically the start of forecasting)
 * @param fyStartMonth Financial year start month (1-12)
 * @returns Number of full financial years elapsed
 */
export function getFinancialYearsElapsed(currentDate: Date, anchorDate: Date, fyStartMonth: number): number {
  const currentFY = getFinancialYear(currentDate, fyStartMonth);
  const anchorFY = getFinancialYear(anchorDate, fyStartMonth);
  
  return Math.max(0, currentFY - anchorFY);
}