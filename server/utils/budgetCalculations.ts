/**
 * @file Budget Calculation Utilities
 * @description Pure functions for budget forecasting calculations, extracted from API routes
 */

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
 * Convert different payment schedules to monthly amounts
 * @param bills - Array of recurring bills
 * @returns Total monthly cost
 */
export function calculateMonthlyRecurringCosts(bills: BillData[]): number {
  return bills.reduce((total, bill) => {
    if (bill.costs && bill.costs.length > 0) {
      const billCost = bill.costs.reduce((sum, cost) => sum + parseFloat(cost), 0);
      
      // Convert to monthly based on schedule
      switch (bill.schedulePayment) {
        case 'yearly':
          return total + (billCost / 12);
        case 'quarterly':
          return total + (billCost / 3);
        case 'monthly':
          return total + billCost;
        case 'weekly':
          return total + (billCost * 4.33); // 52 weeks / 12 months
        default:
          return total + billCost; // Assume monthly if unknown
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
  if (baselineIncome.length > 0 && baselineIncome[0].incomes) {
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
  return baseAmount * Math.pow(1 + inflationRate, yearsElapsed);
}

/**
 * Determine status based on balance and minimum fund requirement
 * @param balance - Current balance
 * @param minimumFund - Minimum fund requirement
 * @returns Status color
 */
export function determineBalanceStatus(balance: number, minimumFund: number): 'red' | 'yellow' | 'green' {
  if (balance < 0) {
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
  } = params;

  const forecastData: ForecastMonth[] = [];
  let currentBalance = startAmount;

  for (let monthIndex = 0; monthIndex < 300; monthIndex++) {
    const currentYear = startYear + Math.floor(monthIndex / 12);
    const currentMonth = (monthIndex % 12) + 1;
    
    // Apply annual inflation for both revenue and expenses
    const yearsElapsed = Math.floor(monthIndex / 12);
    const inflatedIncome = applyInflation(monthlyBaselineIncome, revenueInflation, yearsElapsed);
    const inflatedExpenses = applyInflation(monthlyRecurringCosts, generalInflation, yearsElapsed);

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