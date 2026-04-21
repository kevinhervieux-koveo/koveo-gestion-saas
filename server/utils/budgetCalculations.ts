/**
 * @file Budget Calculation Utilities
 * @description Pure functions for budget forecasting calculations, extracted from API routes
 */

import { getFinancialYearsElapsed } from './inflation';

export interface ForecastMonth {
  year: number;
  month: number;
  revenue: number;
  spending: number;
  netCashFlow: number;
  balance: number;
  status: 'red' | 'yellow' | 'green';
  inflatedIncome: number;
  inflatedExpenses: number;
}

export interface BillData {
  id: string;
  category: string;
  costs: string[];
  schedulePayment: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  yearInterval?: number;
  startDate: Date;
  endDate: Date | null;
}

export interface UniqueBillData {
  startDate: Date;
  totalAmount: string;
  category: string;
}

export interface BaselineBudgetData {
  incomeTypes: string[];
  incomes: string[];
  spendingTypes: string[];
  spendings: string[];
}

/**
 * Convert different payment schedules to averaged monthly amounts (for baseline/summary calculations)
 * Note: For actual monthly forecasts, use calculateRecurringCostsForMonth instead
 * @param bills - Array of recurring bills
 * @returns Total averaged monthly cost
 */
export function calculateMonthlyRecurringCosts(bills: BillData[]): number {
  return bills.reduce((total, bill) => {
    if (bill.costs && bill.costs.length > 0) {
      // Sum all costs in the array (payment plan installments or cost components)
      const totalBillCost = bill.costs.reduce((sum, cost) => sum + parseFloat(cost), 0);
      
      // Convert to monthly based on schedule (averaging for baseline calculations)
      switch (bill.schedulePayment) {
        case 'yearly':
          return total + (totalBillCost / 12);
        case 'quarterly':
          return total + (totalBillCost / 3);
        case 'monthly':
          return total + totalBillCost;
        case 'weekly':
          return total + (totalBillCost * 4.33); // 52 weeks / 12 months
        default:
          return total + totalBillCost; // Assume monthly if unknown
      }
    }
    return total;
  }, 0);
}

/**
 * Calculate recurring bill costs due in a specific month (actual payment timing)
 * @param bills - Array of recurring bills
 * @param targetYear - The year to check
 * @param targetMonth - The month to check (1-12)
 * @returns Total recurring costs actually due in this month
 */
export function calculateRecurringCostsForMonth(
  bills: BillData[], 
  targetYear: number, 
  targetMonth: number
): number {
  const targetDate = new Date(targetYear, targetMonth - 1, 1);
  
  return bills.reduce((total, bill) => {
    const billStartDate = new Date(bill.startDate);
    const billEndDate = bill.endDate ? new Date(bill.endDate) : null;
    
    // Check if bill is active during this month
    if (targetDate < billStartDate || (billEndDate && targetDate > billEndDate)) {
      return total;
    }
    
    if (bill.costs && bill.costs.length > 0) {
      const totalBillCost = bill.costs.reduce((sum, cost) => sum + parseFloat(cost), 0);
      let isPaymentDue = false;
      let monthlyAmount = 0;
      
      switch (bill.schedulePayment) {
        case 'monthly':
          isPaymentDue = true;
          monthlyAmount = totalBillCost;
          break;
        case 'quarterly':
          const monthsSinceStart = (targetYear - billStartDate.getFullYear()) * 12 + 
                                   (targetMonth - 1 - billStartDate.getMonth());
          isPaymentDue = monthsSinceStart >= 0 && monthsSinceStart % 3 === 0;
          monthlyAmount = totalBillCost;
          break;
        case 'yearly':
          const billStartMonth = billStartDate.getMonth() + 1; // 1-12
          const yearsSinceStart = targetYear - billStartDate.getFullYear();
          const yearInterval = bill.yearInterval || 1;
          isPaymentDue = targetMonth === billStartMonth && 
                         yearsSinceStart >= 0 && 
                         yearsSinceStart % yearInterval === 0;
          monthlyAmount = totalBillCost;
          break;
        case 'weekly':
          isPaymentDue = true;
          monthlyAmount = totalBillCost * 4.33; // 52 weeks / 12 months
          break;
        default:
          isPaymentDue = true;
          monthlyAmount = totalBillCost;
          break;
      }
      
      if (isPaymentDue) {
        return total + monthlyAmount;
      }
    }
    return total;
  }, 0);
}

/**
 * Group unique bills by year for unplanned spending calculation
 * @param uniqueBills - Array of unique bills
 * @returns Record of year to total amount
 */
export function groupUniqueBillsByYear(uniqueBills: UniqueBillData[]): Record<number, number> {
  const uniqueBillsByYear: Record<number, number> = {};
  uniqueBills.forEach((bill) => {
    const year = new Date(bill.startDate).getFullYear();
    uniqueBillsByYear[year] = (uniqueBillsByYear[year] || 0) + parseFloat(bill.totalAmount);
  });
  return uniqueBillsByYear;
}

/**
 * Calculate baseline monthly income from budget data
 * @param baselineIncome - Array of baseline income data
 * @returns Monthly baseline income amount
 */
export function calculateBaselineMonthlyIncome(baselineIncome: BaselineBudgetData[]): number {
  let monthlyBaselineIncome = 50000; // Default fallback
  if (baselineIncome.length > 0 && baselineIncome[0].incomes && baselineIncome[0].incomes.length > 0) {
    monthlyBaselineIncome = baselineIncome[0].incomes
      .reduce((sum, income) => sum + parseFloat(income), 0);
  }
  return monthlyBaselineIncome;
}

/**
 * Apply annual inflation to a base amount
 * @param baseAmount - Original amount
 * @param inflationRate - Annual inflation rate (as decimal, e.g., 0.02 for 2%)
 * @param yearsElapsed - Number of years elapsed
 * @returns Inflated amount
 */
export function applyInflation(baseAmount: number, inflationRate: number, yearsElapsed: number): number {
  // DEFENSIVE VALIDATION: Warn if inflation rate seems too high (likely a percentage instead of decimal)
  if (inflationRate >= 1.0) {
    console.warn(`⚠️  [BUDGET CALCULATIONS] applyInflation received suspiciously high rate: ${inflationRate} (${inflationRate * 100}%). Expected decimal 0-1 range. This may indicate a percentage-to-decimal conversion bug.`);
    console.warn(`⚠️  [BUDGET CALCULATIONS] Formula will use: ${baseAmount} * (1 + ${inflationRate})^${yearsElapsed} = ${baseAmount} * ${(1 + inflationRate).toFixed(4)}^${yearsElapsed}`);
  }
  
  // DEFENSIVE VALIDATION: Warn about extreme inflation scenarios
  const inflationFactor = Math.pow(1 + inflationRate, yearsElapsed);
  if (inflationFactor > 10) {
    console.warn(`⚠️  [BUDGET CALCULATIONS] Extreme inflation detected: ${(inflationRate * 100).toFixed(2)}% over ${yearsElapsed} years results in ${inflationFactor.toFixed(2)}x multiplier`);
  }
  
  return baseAmount * inflationFactor;
}

/**
 * Determine status based on balance and minimum fund requirement
 * @param balance - Current balance
 * @param minimumFund - Minimum fund requirement
 * @returns Status color
 */
export function determineBalanceStatus(balance: number, minimumFund: number): 'red' | 'yellow' | 'green' {
  if (balance <= 0) {
    return 'red';
  } else if (balance < minimumFund) {
    return 'yellow';
  }
  return 'green';
}

/**
 * Round number to 2 decimal places for currency display
 * @param value - Number to round
 * @returns Rounded number
 */
export function roundToCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Generate 25-year budget forecast with pure calculation logic
 * @param params - Forecast parameters
 * @returns Array of forecast months
 */
export function generateBudgetForecast(params: {
  startAmount: number;
  minimumFund: number;
  generalInflation: number;
  revenueInflation: number;
  monthlyBaselineIncome: number;
  monthlyRecurringCosts: number;
  uniqueBillsByYear: Record<number, number>;
  startYear: number;
  startMonth?: number;
  financialYearStartMonth?: number;
}): ForecastMonth[] {
  const {
    startAmount,
    minimumFund,
    generalInflation,
    revenueInflation,
    monthlyBaselineIncome,
    monthlyRecurringCosts,
    uniqueBillsByYear,
    startYear,
    startMonth = 1,
    financialYearStartMonth = 1,
  } = params;

  const forecastData: ForecastMonth[] = [];
  let currentBalance = startAmount;

  for (let monthIndex = 0; monthIndex < 300; monthIndex++) {
    const currentYear = startYear + Math.floor(monthIndex / 12);
    const currentMonth = (monthIndex % 12) + 1;
    const currentDate = new Date(currentYear, currentMonth - 1, 1);
    
    // Create anchor date for financial year calculations
    const anchorDate = new Date(startYear, startMonth - 1, 1);
    
    // Apply annual inflation based on financial year boundaries
    const yearsElapsed = getFinancialYearsElapsed(currentDate, anchorDate, financialYearStartMonth);
    
    // Debug logging for the first few months to verify inflation logic
    if (monthIndex < 3 || (monthIndex < 60 && monthIndex % 12 === 0)) {
    }
    
    const inflatedIncome = applyInflation(monthlyBaselineIncome, revenueInflation, yearsElapsed);
    const inflatedExpenses = applyInflation(monthlyRecurringCosts, generalInflation, yearsElapsed);
    
    // Additional debug logging for inflation application
    if (monthIndex < 3 || (monthIndex < 60 && monthIndex % 12 === 0)) {
    }

    // Add unplanned spending from unique bills (distributed monthly for the year)
    const yearlyUnplannedSpending = uniqueBillsByYear[currentYear] || 0;
    const monthlyUnplannedSpending = yearlyUnplannedSpending / 12;

    // Special one-time incomes (could be added later)
    const specialIncomes = 0;

    // Calculate monthly net cash flow
    const totalRevenue = inflatedIncome + specialIncomes;
    const totalSpending = inflatedExpenses + monthlyUnplannedSpending;
    const netCashFlow = totalRevenue - totalSpending;

    // Update bank balance
    currentBalance += netCashFlow;

    // Determine status based on balance
    const status = determineBalanceStatus(currentBalance, minimumFund);

    // Add to forecast data
    forecastData.push({
      year: currentYear,
      month: currentMonth,
      revenue: roundToCurrency(totalRevenue),
      spending: roundToCurrency(totalSpending),
      netCashFlow: roundToCurrency(netCashFlow),
      balance: roundToCurrency(currentBalance),
      status,
      inflatedIncome: roundToCurrency(inflatedIncome),
      inflatedExpenses: roundToCurrency(inflatedExpenses),
    });
  }

  return forecastData;
}