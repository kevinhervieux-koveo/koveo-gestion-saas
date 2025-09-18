import express from 'express';
import { z } from 'zod';
import { db } from '../db';
import { budgets, monthlyBudgets, buildings, bills, payments, residences, capitalInvestments, insertCapitalInvestmentSchema } from '@shared/schema';
import { requireAuth } from '../auth';
import { and, eq, gte, lte, sql, desc, asc, sum, count } from 'drizzle-orm';

const router = express.Router();

// Development debug logging
const isDev = process.env.NODE_ENV === 'development';
const debugLog = (endpoint: string, data: any) => {
  if (isDev) {
    console.log(`🏦 [BUDGET API DEBUG] ${endpoint}:`, JSON.stringify(data, null, 2));
  }
};

// Validation schemas
const forecastInputSchema = z.object({
  bankAccountStartAmount: z.coerce.number().optional(),
  bankAccountMinimums: z.coerce.number().optional(),
  generalInflationRate: z.coerce.number().min(0).max(100).optional(),
  revenueInflationRate: z.coerce.number().min(0).max(100).optional(),
  unplannedBillsAmount: z.coerce.number().min(0).optional(),
  lookbackYears: z.coerce.number().min(1).max(10).optional().default(3),
});

const updateUnplannedBillsSchema = z.object({
  unplannedBillsAmount: z.coerce.number().min(0),
  notes: z.string().optional(),
});

/**
 * Get budgets and monthly budgets for a building with date range.
 */
router.get('/:buildingId', requireAuth, async (req, res) => {
  try {
    const { buildingId } = req.params;
    const { startYear, endYear, startMonth, endMonth, groupBy = 'monthly' } = req.query;
    
    debugLog('GET /:buildingId', { buildingId, startYear, endYear, startMonth, endMonth, groupBy });

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const start = startYear ? parseInt(startYear as string) : currentYear - 3;
    const end = endYear ? parseInt(endYear as string) : currentYear + 25;
    const startMo = startMonth ? parseInt(startMonth as string) : 1;
    const endMo = endMonth ? parseInt(endMonth as string) : 12;

    // Validate building access
    const building = await db.query.buildings.findFirst({
      where: eq(buildings.id, buildingId),
      columns: {
        id: true,
        name: true,
      },
    });

    if (!building) {
      return res.status(404).json({ _error: 'Building not found' });
    }

    if (groupBy === 'yearly') {
      // Get yearly budget data
      const yearlyBudgets = await db
        .select({
          year: budgets.year,
          category: budgets.category,
          budgetedAmount: budgets.budgetedAmount,
          actualAmount: budgets.actualAmount,
          variance: budgets.variance,
        })
        .from(budgets)
        .where(
          and(
            eq(budgets.buildingId, buildingId),
            gte(budgets.year, start),
            lte(budgets.year, end),
            eq(budgets.isActive, true)
          )
        )
        .orderBy(asc(budgets.year));

      return res.json({ budgets: yearlyBudgets, type: 'yearly' });
    } else {
      // Get monthly budget data with month filtering
      const whereConditions = [eq(monthlyBudgets.buildingId, buildingId)];

      // Add year and month filtering
      if (groupBy === 'monthly' && (startMonth || endMonth)) {
        // For monthly filtering, handle year-month combinations
        const startYearMonth = start * 100 + startMo; // e.g., 202508
        const endYearMonth = end * 100 + endMo; // e.g., 202512

        whereConditions.push(
          gte(sql`${monthlyBudgets.year} * 100 + ${monthlyBudgets.month}`, startYearMonth),
          lte(sql`${monthlyBudgets.year} * 100 + ${monthlyBudgets.month}`, endYearMonth)
        );
      } else {
        // Standard year-only filtering
        whereConditions.push(gte(monthlyBudgets.year, start), lte(monthlyBudgets.year, end));
      }

      const monthlyBudgetData = await db
        .select({
          year: monthlyBudgets.year,
          month: monthlyBudgets.month,
          incomeTypes: monthlyBudgets.incomeTypes,
          incomes: monthlyBudgets.incomes,
          spendingTypes: monthlyBudgets.spendingTypes,
          spendings: monthlyBudgets.spendings,
          approved: monthlyBudgets.approved,
        })
        .from(monthlyBudgets)
        .where(and(...whereConditions))
        .orderBy(asc(monthlyBudgets.year), asc(monthlyBudgets.month));

      // If no data exists, provide sample data to demonstrate the dashboard
      if (monthlyBudgetData.length === 0) {
        const sampleData = [];

        // Generate sample data for the requested year range
        for (let year = start; year <= Math.min(end, start + 3); year++) {
          // Limit to 4 years of sample data
          // For yearly view, show only January 1st of each year, for monthly show sample months
          const monthsInYear = groupBy === 'yearly' ? [1] : [1, 6, 12];

          monthsInYear.forEach((month) => {
            sampleData.push({
              year: year,
              month: month,
              incomeTypes: ['monthly_fees', 'parking_fees', 'other_income'],
              incomes: ['45000', '3500', '2000'],
              spendingTypes: [
                'maintenance_expense',
                'utilities',
                'insurance',
                'administrative_expense',
              ],
              spendings: ['12000', '8500', '4200', '3800'],
              approved: true,
            });
          });
        }

        return res.json({ budgets: sampleData, type: 'monthly' });
      }

      return res.json({ budgets: monthlyBudgetData, type: 'monthly' });
    }
  } catch (error: any) {
    console.error('❌ Error fetching budgets:', error);
    res.status(500).json({ _error: 'Internal server error' });
  }
});

/**
 * Get budget summary with income/expense totals.
 */
router.get('/:buildingId/summary', requireAuth, async (req, res) => {
  try {
    const { buildingId } = req.params;
    const { startYear, endYear, startMonth, endMonth } = req.query;

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const start = startYear ? parseInt(startYear as string) : currentYear - 3;
    const end = endYear ? parseInt(endYear as string) : currentYear + 25;
    const startMo = startMonth ? parseInt(startMonth as string) : 1;
    const endMo = endMonth ? parseInt(endMonth as string) : 12;

    // Get monthly budget data with proper structure and month filtering
    const whereConditions = [eq(monthlyBudgets.buildingId, buildingId)];

    // Add year and month filtering if month parameters are provided
    if (startMonth || endMonth) {
      // For monthly filtering, handle year-month combinations
      const startYearMonth = start * 100 + startMo; // e.g., 202508
      const endYearMonth = end * 100 + endMo; // e.g., 202512

      whereConditions.push(
        gte(sql`${monthlyBudgets.year} * 100 + ${monthlyBudgets.month}`, startYearMonth),
        lte(sql`${monthlyBudgets.year} * 100 + ${monthlyBudgets.month}`, endYearMonth)
      );
    } else {
      // Standard year-only filtering
      whereConditions.push(gte(monthlyBudgets.year, start), lte(monthlyBudgets.year, end));
    }

    const summaryData = await db
      .select({
        year: monthlyBudgets.year,
        month: monthlyBudgets.month,
        incomeTypes: monthlyBudgets.incomeTypes,
        incomes: monthlyBudgets.incomes,
        spendingTypes: monthlyBudgets.spendingTypes,
        spendings: monthlyBudgets.spendings,
        approved: monthlyBudgets.approved,
      })
      .from(monthlyBudgets)
      .where(and(...whereConditions))
      .orderBy(asc(monthlyBudgets.year), asc(monthlyBudgets.month));

    // If no data exists, provide sample data to demonstrate the dashboard
    if (summaryData.length === 0) {
      const sampleSummary = [];

      // Generate sample data for the requested year range
      for (let year = start; year <= Math.min(end, start + 3); year++) {
        // Limit to 4 years of sample data
        // For yearly view, show only January 1st of each year, for monthly show sample months
        const monthsInYear = [1]; // Always January 1st for summary data

        monthsInYear.forEach((month) => {
          sampleSummary.push({
            year: year,
            month: month,
            incomeTypes: ['monthly_fees', 'parking_fees', 'other_income'],
            incomes: ['45000', '3500', '2000'],
            spendingTypes: [
              'maintenance_expense',
              'utilities',
              'insurance',
              'administrative_expense',
            ],
            spendings: ['12000', '8500', '4200', '3800'],
            approved: true,
          });
        });
      }

      return res.json({ summary: sampleSummary });
    }

    return res.json({ summary: summaryData });
  } catch (error: any) {
    console.error('❌ Error fetching budget summary:', error);
    res.status(500).json({ _error: 'Internal server error' });
  }
});

/**
 * Update building bank account number with reconciliation note.
 */
router.put('/:buildingId/bank-account', requireAuth, async (req, res) => {
  try {
    const { buildingId } = req.params;
    debugLog('PUT /:buildingId/bank-account - Request received', { 
      buildingId, 
      body: req.body, 
      timestamp: new Date().toISOString() 
    });
    const {
      bankAccountNumber,
      bankAccountNotes,
      bankAccountStartDate,
      bankAccountStartAmount,
      bankAccountMinimums,
      generalInflationRate,
      revenueInflationRate,
      // Extended configuration fields
      emergencyFundMinimum,
      operatingCashMinimum,
      revenueGrowthRate,
      revenueInflation,
      reserveFundTarget,
      utilityInflationRate,
      maintenanceInflationRate,
      costInflationRate, // Added missing field
      specialInvestmentBudget,
      investmentHorizonYears,
      capitalProjectReserve,
      // Dynamic custom bank fields from frontend
      customBankFields,
    } = req.body;

    // Validate building exists
    const building = await db.query.buildings.findFirst({
      where: eq(buildings.id, buildingId),
      columns: { id: true },
    });

    if (!building) {
      return res.status(404).json({ _error: 'Building not found' });
    }

    // Prepare extended configuration object including custom bank fields
    const extendedConfig = {
      emergencyFundMinimum,
      operatingCashMinimum,
      revenueGrowthRate,
      revenueInflation,
      reserveFundTarget,
      utilityInflationRate,
      maintenanceInflationRate,
      costInflationRate,
      specialInvestmentBudget,
      investmentHorizonYears,
      capitalProjectReserve,
      // Include dynamic custom bank fields for persistence
      customBankFields: customBankFields || {},
    };

    // Update building with bank account info and extended configuration
    await db
      .update(buildings)
      .set({
        bankAccountNumber,
        bankAccountNotes,
        bankAccountStartDate: bankAccountStartDate ? new Date(bankAccountStartDate) : null,
        bankAccountStartAmount,
        bankAccountMinimums,
        generalInflationRate,
        revenueInflationRate,
        amenities: extendedConfig, // Using amenities jsonb field for extended config
        bankAccountUpdatedAt: new Date(),
      })
      .where(eq(buildings.id, buildingId));

    debugLog('PUT /:buildingId/bank-account - Database updated successfully', { 
      buildingId, 
      extendedConfig,
      timestamp: new Date().toISOString() 
    });

    res.json({
      message: 'Bank account updated successfully',
      bankAccountNumber,
      bankAccountNotes,
      bankAccountStartDate: bankAccountStartDate ? new Date(bankAccountStartDate) : null,
      bankAccountStartAmount,
      bankAccountMinimums,
      generalInflationRate,
      revenueInflationRate,
      bankAccountUpdatedAt: new Date(),
      // Extended configuration fields
      ...extendedConfig,
    });
  } catch (error: any) {
    console.error('❌ Error updating bank account:', error);
    res.status(500).json({ _error: 'Internal server error' });
  }
});

/**
 * Update building bank account number with reconciliation note (PATCH method for backwards compatibility).
 */
router.patch('/:buildingId/bank-account', requireAuth, async (req, res) => {
  try {
    // TODO: Enable when bank account columns are added to database
    res.json({ message: 'Bank account update feature coming soon' });
  } catch (error: any) {
    console.error('❌ Error in PATCH bank account:', error);
    res.status(500).json({ _error: 'Internal server error' });
  }
});

/**
 * Get building bank account info.
 */
router.get('/:buildingId/bank-account', requireAuth, async (req, res) => {
  try {
    const { buildingId } = req.params;
    
    debugLog('GET /:buildingId/bank-account', { buildingId });

    // Validate building exists and get bank account info
    const building = await db.query.buildings.findFirst({
      where: eq(buildings.id, buildingId),
      columns: {
        id: true,
        bankAccountNumber: true,
        bankAccountNotes: true,
        bankAccountStartDate: true,
        bankAccountStartAmount: true,
        bankAccountMinimums: true,
        generalInflationRate: true,
        revenueInflationRate: true,
        bankAccountUpdatedAt: true,
        amenities: true, // Contains extended configuration
      },
    });

    if (!building) {
      return res.status(404).json({ _error: 'Building not found' });
    }

    // Extract extended configuration from amenities field
    const extendedConfig = (building.amenities && typeof building.amenities === 'object') ? building.amenities : {};
    
    debugLog('GET /:buildingId/bank-account - Response data', { 
      buildingId, 
      extendedConfig,
      timestamp: new Date().toISOString() 
    });

    res.json({
      bankAccountNumber: building.bankAccountNumber,
      bankAccountNotes: building.bankAccountNotes,
      bankAccountStartDate: building.bankAccountStartDate,
      bankAccountStartAmount: building.bankAccountStartAmount,
      bankAccountMinimums: building.bankAccountMinimums,
      generalInflationRate: building.generalInflationRate,
      revenueInflationRate: building.revenueInflationRate,
      bankAccountUpdatedAt: building.bankAccountUpdatedAt,
      // Extended configuration fields
      ...(extendedConfig as Record<string, any>),
    });
  } catch (error: any) {
    console.error('❌ Error fetching bank account info:', error);
    res.status(500).json({ _error: 'Internal server error' });
  }
});

/**
 * Calculate suggested unplanned bills amount based on historical payment data
 * Uses payments table instead of bills table for accuracy
 */
async function calculateUnplannedBillsSuggestion(
  buildingId: string, 
  lookbackYears: number = 3
): Promise<{amount: number, confidence: string, yearsAnalyzed: number}> {
  try {
    const currentDate = new Date();
    const startDate = new Date(currentDate);
    startDate.setFullYear(currentDate.getFullYear() - lookbackYears);
    
    debugLog('Calculating unplanned bills suggestion', { buildingId, lookbackYears, startDate });
    
    // Use single grouped SQL query for better performance
    // Get payments for unique bills only, filter by paid status and paidDate
    const historicalPayments = await db
      .select({
        year: sql<number>`EXTRACT(YEAR FROM ${payments.paidDate})`.
          mapWith(Number),
        month: sql<number>`EXTRACT(MONTH FROM ${payments.paidDate})`.
          mapWith(Number),
        totalAmount: sum(payments.amount).mapWith(Number),
        paymentCount: count(payments.id).mapWith(Number),
      })
      .from(payments)
      .innerJoin(bills, eq(payments.billId, bills.id))
      .where(
        and(
          eq(bills.buildingId, buildingId),
          eq(bills.paymentType, 'unique'),
          eq(payments.status, 'paid'),
          gte(payments.paidDate, startDate.toISOString().split('T')[0]),
          lte(payments.paidDate, currentDate.toISOString().split('T')[0])
        )
      )
      .groupBy(
        sql`EXTRACT(YEAR FROM ${payments.paidDate})`,
        sql`EXTRACT(MONTH FROM ${payments.paidDate})`
      )
      .orderBy(
        sql`EXTRACT(YEAR FROM ${payments.paidDate})`,
        sql`EXTRACT(MONTH FROM ${payments.paidDate})`
      );

    debugLog('Historical payments fetched', { count: historicalPayments.length });

    if (historicalPayments.length === 0) {
      debugLog('No historical payment data found', { fallback: 0 });
      return { amount: 0, confidence: 'no_data', yearsAnalyzed: 0 };
    }

    // Group by year for analysis
    const paymentsByYear: Record<number, number> = {};
    const monthsWithData = new Set<string>();
    
    historicalPayments.forEach((payment) => {
      paymentsByYear[payment.year] = (paymentsByYear[payment.year] || 0) + payment.totalAmount;
      monthsWithData.add(`${payment.year}-${payment.month}`);
    });

    debugLog('Payments grouped by year', { paymentsByYear, monthsWithData: monthsWithData.size });

    // Handle edge cases: partial years, outliers
    const years = Object.keys(paymentsByYear).map(Number);
    if (years.length === 0) {
      return { amount: 0, confidence: 'no_data', yearsAnalyzed: 0 };
    }

    // Remove outliers (values that are more than 2 standard deviations from mean)
    const yearlyAmounts = Object.values(paymentsByYear);
    const mean = yearlyAmounts.reduce((sum, amount) => sum + amount, 0) / yearlyAmounts.length;
    const variance = yearlyAmounts.reduce((sum, amount) => sum + Math.pow(amount - mean, 2), 0) / yearlyAmounts.length;
    const stdDev = Math.sqrt(variance);
    
    const filteredAmounts = yearlyAmounts.filter(amount => 
      Math.abs(amount - mean) <= 2 * stdDev
    );
    
    if (filteredAmounts.length === 0) {
      return { amount: 0, confidence: 'outliers_removed', yearsAnalyzed: years.length };
    }

    // Calculate average yearly amount (excluding outliers)
    const averageYearlyAmount = filteredAmounts.reduce((sum, amount) => sum + amount, 0) / filteredAmounts.length;
    
    // Convert to monthly average
    const monthlyAverageAmount = averageYearlyAmount / 12;
    
    // Determine confidence level
    let confidence = 'low';
    if (years.length >= 3 && monthsWithData.size >= 24) {
      confidence = 'high';
    } else if (years.length >= 2 && monthsWithData.size >= 12) {
      confidence = 'medium';
    }
    
    debugLog('Calculated unplanned bills suggestion', { 
      averageYearlyAmount,
      monthlyAverageAmount,
      yearsAnalyzed: years.length,
      monthsWithData: monthsWithData.size,
      outliersRemoved: yearlyAmounts.length - filteredAmounts.length,
      confidence
    });

    // Round to 2 decimal places
    return {
      amount: Math.round(monthlyAverageAmount * 100) / 100,
      confidence,
      yearsAnalyzed: years.length
    };
  } catch (error) {
    console.error('❌ Error calculating unplanned bills suggestion:', error);
    return { amount: 0, confidence: 'error', yearsAnalyzed: 0 };
  }
}

/**
 * POST /api/budgets/:buildingId/forecast - Generate 25-year budget forecast (READ-ONLY)
 * No side effects - does not update database
 */
router.post('/:buildingId/forecast', requireAuth, async (req, res) => {
  try {
    const { buildingId } = req.params;
    
    debugLog('POST /:buildingId/forecast - Request received', { 
      buildingId, 
      body: req.body,
      timestamp: new Date().toISOString() 
    });
    
    // Validate input data
    const validatedInput = forecastInputSchema.parse(req.body);
    const {
      bankAccountStartAmount,
      bankAccountMinimums,
      generalInflationRate,
      revenueInflationRate,
      unplannedBillsAmount,
      lookbackYears,
    } = validatedInput;

    // Retrieve building settings
    const building = await db.query.buildings.findFirst({
      where: eq(buildings.id, buildingId),
      columns: {
        id: true,
        name: true,
        bankAccountStartAmount: true,
        bankAccountMinimums: true,
        generalInflationRate: true,
        revenueInflationRate: true,
        unplannedBillsAmount: true,
      },
    });

    if (!building) {
      return res.status(404).json({ _error: 'Building not found' });
    }

    // Calculate suggested unplanned bills amount based on historical data (READ-ONLY)
    const unplannedBillsCalculation = await calculateUnplannedBillsSuggestion(buildingId, lookbackYears);
    
    debugLog('Calculated unplanned bills suggestion (read-only)', { 
      buildingId, 
      calculation: unplannedBillsCalculation
    });

    // Use request overrides or fallback to building defaults with proper number validation
    const startAmount = parseFloat(bankAccountStartAmount || building.bankAccountStartAmount || '0');
    const minimums = bankAccountMinimums || building.bankAccountMinimums || '0';
    
    // Fix: Ensure minimumFund is a valid number to prevent NaN in Math.max operations
    const parsedMinimumFund = parseFloat(minimums);
    const minimumFund = Number.isFinite(parsedMinimumFund) ? parsedMinimumFund : 0;
    const generalInflation = parseFloat(generalInflationRate || building.generalInflationRate || '2.0') / 100;
    const revenueInflation = parseFloat(revenueInflationRate || building.revenueInflationRate || '2.0') / 100;
    
    // Use input override, calculated suggestion, or existing building value (in priority order)
    const unplannedBills = unplannedBillsAmount !== undefined
      ? unplannedBillsAmount
      : unplannedBillsCalculation.amount > 0 
        ? unplannedBillsCalculation.amount
        : parseFloat(building.unplannedBillsAmount || '0');

    // Fetch recurrent bills with future payment synthesis capability
    const recurrentBills = await db
      .select({
        id: bills.id,
        category: bills.category,
        costs: bills.costs,
        schedulePayment: bills.schedulePayment,
        startDate: bills.startDate,
        endDate: bills.endDate,
      })
      .from(bills)
      .where(
        and(
          eq(bills.buildingId, buildingId),
          eq(bills.paymentType, 'recurrent'),
          eq(bills.status, 'sent') // Only active bills
        )
      );

    // Use optimized grouped query for historical expenses from payments table
    const currentDate = new Date();
    const historicalExpensesByCategory = await db
      .select({
        category: bills.category,
        year: sql<number>`EXTRACT(YEAR FROM ${payments.paidDate})`.mapWith(Number),
        month: sql<number>`EXTRACT(MONTH FROM ${payments.paidDate})`.mapWith(Number),
        totalPaid: sum(payments.amount).mapWith(Number),
        paymentCount: count(payments.id).mapWith(Number),
      })
      .from(payments)
      .innerJoin(bills, eq(payments.billId, bills.id))
      .where(
        and(
          eq(bills.buildingId, buildingId),
          eq(payments.status, 'paid'),
          gte(payments.paidDate, new Date(currentDate.getFullYear() - 2, 0, 1).toISOString().split('T')[0])
        )
      )
      .groupBy(
        bills.category,
        sql`EXTRACT(YEAR FROM ${payments.paidDate})`,
        sql`EXTRACT(MONTH FROM ${payments.paidDate})`
      )
      .orderBy(
        bills.category,
        sql`EXTRACT(YEAR FROM ${payments.paidDate})`,
        sql`EXTRACT(MONTH FROM ${payments.paidDate})`
      );

    // Fetch residence data for revenue calculation
    const residenceData = await db.query.residences.findMany({
      where: eq(residences.buildingId, buildingId),
      columns: {
        id: true,
        monthlyFees: true,
        isActive: true,
      },
    });

    // Fetch latest monthly budgets for baseline income data
    const latestYear = new Date().getFullYear();
    const baselineIncome = await db
      .select({
        incomeTypes: monthlyBudgets.incomeTypes,
        incomes: monthlyBudgets.incomes,
        spendingTypes: monthlyBudgets.spendingTypes,
        spendings: monthlyBudgets.spendings,
      })
      .from(monthlyBudgets)
      .where(
        and(
          eq(monthlyBudgets.buildingId, buildingId),
          eq(monthlyBudgets.year, latestYear)
        )
      )
      .limit(1);

    // Calculate monthly revenue from residences
    let monthlyResidenceRevenue = 0;
    if (residenceData && residenceData.length > 0) {
      monthlyResidenceRevenue = residenceData
        .filter((residence) => {
          // Only include active residences
          return residence?.isActive !== false; // Default to true if undefined
        })
        .reduce((total, residence) => {
          // Handle null/undefined residence
          if (!residence || !residence.monthlyFees) return total;
          
          // Parse monthlyFees with robust validation
          const feesString = String(residence.monthlyFees).replace(/[^0-9.-]/g, ''); // Remove currency symbols
          const monthlyFees = parseFloat(feesString);
          
          // Only add valid positive numbers
          if (!isNaN(monthlyFees) && monthlyFees >= 0) {
            return total + monthlyFees;
          }
          
          return total;
        }, 0);
    }

    // Initialize baseline monthly income from residence revenue + budget data
    let monthlyBaselineIncome = monthlyResidenceRevenue;
    if (baselineIncome.length > 0 && baselineIncome[0].incomes) {
      const customIncomes = baselineIncome[0].incomes
        .reduce((sum, income) => sum + parseFloat(income), 0);
      monthlyBaselineIncome += customIncomes;
    }
    
    // Use fallback only if no residence or budget revenue exists
    if (monthlyBaselineIncome === 0) {
      monthlyBaselineIncome = 50000; // Default fallback
    }

    // Calculate monthly recurring costs using optimized approach
    const monthlyRecurringCosts = recurrentBills.reduce((total, bill) => {
      if (bill.costs && bill.costs.length > 0) {
        const billCost = bill.costs.reduce((sum, cost) => sum + parseFloat(cost), 0);
        
        // Convert to monthly based on schedule with proper calculations
        switch (bill.schedulePayment) {
          case 'yearly':
            return total + (billCost / 12);
          case 'quarterly':
            return total + (billCost / 3); // Quarterly = every 3 months
          case 'monthly':
            return total + billCost;
          case 'weekly':
            return total + (billCost * 52 / 12); // 52 weeks / 12 months = 4.33
          default:
            return total + billCost; // Assume monthly if unknown
        }
      }
      return total;
    }, 0);

    // Group historical expenses by category for trend analysis
    const expensesByCategory: Record<string, number[]> = {};
    historicalExpensesByCategory.forEach((expense) => {
      if (!expensesByCategory[expense.category]) {
        expensesByCategory[expense.category] = [];
      }
      expensesByCategory[expense.category].push(expense.totalPaid);
    });

    // Generate 25-year forecast (300 months) with proper recurrent bill scheduling
    const forecastData = [];
    let currentBalance = startAmount;
    const startYear = latestYear;

    for (let monthIndex = 0; monthIndex < 300; monthIndex++) {
      const currentYear = startYear + Math.floor(monthIndex / 12);
      const currentMonth = (monthIndex % 12) + 1;
      const currentDate = new Date(currentYear, currentMonth - 1, 1);
      
      // Apply annual inflation for both revenue and expenses
      const yearsElapsed = Math.floor(monthIndex / 12);
      const inflatedIncome = monthlyBaselineIncome * Math.pow(1 + revenueInflation, yearsElapsed);
      
      // Calculate expenses from actual recurrent bill schedules for this specific month
      let monthlyRecurringExpenses = 0;
      
      recurrentBills.forEach((bill) => {
        const billStartDate = new Date(bill.startDate);
        const billEndDate = bill.endDate ? new Date(bill.endDate) : null;
        
        // Check if bill is active during this forecast month
        if (currentDate >= billStartDate && (!billEndDate || currentDate <= billEndDate)) {
          const totalBillCost = bill.costs ? bill.costs.reduce((sum, cost) => sum + parseFloat(cost), 0) : 0;
          
          // Calculate if payment is due this month based on schedule
          let isPaymentDue = false;
          
          switch (bill.schedulePayment) {
            case 'monthly':
              isPaymentDue = true; // Every month
              break;
            case 'quarterly':
              // Every 3 months from start date
              const monthsSinceStart = (currentYear - billStartDate.getFullYear()) * 12 + (currentMonth - 1 - billStartDate.getMonth());
              isPaymentDue = monthsSinceStart >= 0 && monthsSinceStart % 3 === 0;
              break;
            case 'yearly':
              // Same month as start date each year
              isPaymentDue = currentMonth === billStartDate.getMonth() + 1;
              break;
            case 'weekly':
              // Approximate weekly as 4.33 times per month
              isPaymentDue = true;
              monthlyRecurringExpenses += totalBillCost * 4.33; // 52 weeks / 12 months
              break;
            default:
              // Assume monthly if schedule is unclear
              isPaymentDue = true;
              break;
          }
          
          if (isPaymentDue && bill.schedulePayment !== 'weekly') {
            monthlyRecurringExpenses += totalBillCost;
          }
        }
      });
      
      // Apply inflation to recurring expenses
      const inflatedRecurringExpenses = monthlyRecurringExpenses * Math.pow(1 + generalInflation, yearsElapsed);

      // Apply inflation to unplanned bills
      const inflatedUnplannedBills = unplannedBills * Math.pow(1 + generalInflation, yearsElapsed);

      // Special one-time incomes (special_cotisations) - could be added from monthly_budgets
      let specialIncomes = 0;
      // TODO: Implement special income logic from monthly_budgets if needed

      // Calculate monthly net cash flow with proper recurrent bill scheduling
      const totalRevenue = inflatedIncome + specialIncomes;
      const totalSpending = inflatedRecurringExpenses + inflatedUnplannedBills;
      const netCashFlow = totalRevenue - totalSpending;

      // Implement proper bank account balance management with automatic capital investments
      // Bank account balance = revenue + capital investment - expenses + previous period's bank account balance
      let capitalInvestment = 0;
      let newBalance = currentBalance + netCashFlow;
      
      // If balance would go negative or below minimum threshold, inject capital investment
      if (newBalance < Math.max(0, minimumFund)) {
        // Calculate required capital investment to maintain minimum balance (or 0 if no minimum set)
        const targetBalance = Math.max(0, minimumFund);
        capitalInvestment = targetBalance - newBalance;
        
        // Round capital investment to nearest 100 for realistic injection amounts
        capitalInvestment = Math.ceil(capitalInvestment / 100) * 100;
        
        // Update balance with capital investment
        newBalance += capitalInvestment;
      }
      
      // Update current balance for next period
      currentBalance = newBalance;

      // Determine status based on final balance
      let status = 'green';
      // Fix: Use proper number comparison to avoid NaN issues
      if (Number.isFinite(minimumFund) && currentBalance < minimumFund) {
        status = 'yellow';
      }
      // Balance should never be red now since we inject capital investment

      // Add to forecast data
      forecastData.push({
        year: currentYear,
        month: currentMonth,
        revenue: Math.round(totalRevenue * 100) / 100,
        spending: Math.round(totalSpending * 100) / 100,
        netCashFlow: Math.round(netCashFlow * 100) / 100,
        balance: Math.round(currentBalance * 100) / 100,
        capitalInvestment: Math.round(capitalInvestment * 100) / 100,
        status,
        inflatedIncome: Math.round(inflatedIncome * 100) / 100,
        inflatedRecurringExpenses: Math.round(inflatedRecurringExpenses * 100) / 100,
        inflatedUnplannedBills: Math.round(inflatedUnplannedBills * 100) / 100,
      });
    }

    res.json({
      buildingId,
      buildingName: building.name,
      forecastPeriod: '25 years',
      startingBalance: startAmount,
      minimumFund,
      generalInflationRate: generalInflation * 100,
      revenueInflationRate: revenueInflation * 100,
      baselineMonthlyIncome: monthlyBaselineIncome,
      baselineMonthlyExpenses: monthlyRecurringCosts,
      recurrentBillsCount: recurrentBills.length,
      historicalExpensesCount: historicalExpensesByCategory.length,
      expensesCategoriesAnalyzed: Object.keys(expensesByCategory).length,
      // Include calculated unplanned bills information
      unplannedBillsCalculation: {
        suggestedAmount: unplannedBillsCalculation.amount,
        confidence: unplannedBillsCalculation.confidence,
        yearsAnalyzed: unplannedBillsCalculation.yearsAnalyzed,
        method: unplannedBillsCalculation.amount > 0 ? 'payments_historical' : 'no_data'
      },
      monthlyUnplannedBillsUsed: unplannedBills,
      unplannedBillsSource: unplannedBillsAmount !== undefined 
        ? 'user_input' 
        : unplannedBillsCalculation.amount > 0 
          ? 'calculated_suggestion' 
          : 'building_default',
      forecast: forecastData,
    });

  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ _error: 'Invalid input data', details: error.errors });
    }
    console.error('❌ Error generating budget forecast:', error);
    res.status(500).json({ 
      _error: 'Internal server error',
      message: 'Failed to generate budget forecast'
    });
  }
});

/**
 * PUT /api/budgets/:buildingId/unplanned-bills - Update unplanned bills amount
 * Separate endpoint for database mutations
 */
router.put('/:buildingId/unplanned-bills', requireAuth, async (req, res) => {
  try {
    const { buildingId } = req.params;
    
    debugLog('PUT /:buildingId/unplanned-bills - Request received', { 
      buildingId, 
      body: req.body,
      timestamp: new Date().toISOString() 
    });
    
    // Validate input data
    const validatedInput = updateUnplannedBillsSchema.parse(req.body);
    const { unplannedBillsAmount, notes } = validatedInput;

    // Validate building exists
    const building = await db.query.buildings.findFirst({
      where: eq(buildings.id, buildingId),
      columns: { id: true },
    });

    if (!building) {
      return res.status(404).json({ _error: 'Building not found' });
    }

    // Update building with new unplanned bills amount
    await db
      .update(buildings)
      .set({ 
        unplannedBillsAmount: unplannedBillsAmount.toString(),
        bankAccountNotes: notes || null,
        updatedAt: new Date()
      })
      .where(eq(buildings.id, buildingId));
      
    debugLog('Updated building unplannedBillsAmount', { 
      buildingId, 
      newAmount: unplannedBillsAmount,
      notes 
    });

    res.json({
      message: 'Unplanned bills amount updated successfully',
      buildingId,
      unplannedBillsAmount,
      notes,
      updatedAt: new Date(),
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ _error: 'Invalid input data', details: error.errors });
    }
    console.error('❌ Error updating unplanned bills amount:', error);
    res.status(500).json({ _error: 'Internal server error' });
  }
});

/**
 * GET /api/budgets/:buildingId/investments - Get capital investments for a building
 */
router.get('/:buildingId/investments', requireAuth, async (req, res) => {
  try {
    const { buildingId } = req.params;
    
    debugLog('GET /:buildingId/investments', { buildingId });

    // Validate building access
    const building = await db.query.buildings.findFirst({
      where: eq(buildings.id, buildingId),
      columns: { id: true },
    });

    if (!building) {
      return res.status(404).json({ _error: 'Building not found' });
    }

    // Get capital investments for the building
    const investments = await db
      .select()
      .from(capitalInvestments)
      .where(eq(capitalInvestments.buildingId, buildingId))
      .orderBy(asc(capitalInvestments.targetDate));

    debugLog('GET /:buildingId/investments - Response', { 
      buildingId, 
      count: investments.length,
      timestamp: new Date().toISOString() 
    });

    res.json(investments);
  } catch (error: any) {
    console.error('❌ Error fetching capital investments:', error);
    res.status(500).json({ _error: 'Internal server error' });
  }
});

/**
 * PUT /api/budgets/:buildingId/investments - Save capital investments for a building
 */
router.put('/:buildingId/investments', requireAuth, async (req, res) => {
  try {
    const { buildingId } = req.params;
    const { investments } = req.body;
    
    debugLog('PUT /:buildingId/investments', { 
      buildingId, 
      count: investments?.length || 0,
      timestamp: new Date().toISOString() 
    });

    // Validate building access
    const building = await db.query.buildings.findFirst({
      where: eq(buildings.id, buildingId),
      columns: { id: true },
    });

    if (!building) {
      return res.status(404).json({ _error: 'Building not found' });
    }

    // Validate investments array
    if (!Array.isArray(investments)) {
      return res.status(400).json({ _error: 'Investments must be an array' });
    }

    // Delete existing custom investments for this building (keep auto-generated)
    await db
      .delete(capitalInvestments)
      .where(
        and(
          eq(capitalInvestments.buildingId, buildingId),
          eq(capitalInvestments.type, 'custom')
        )
      );

    // Insert new custom investments
    if (investments.length > 0) {
      const validatedInvestments = investments.map((investment: any) => {
        const validated = insertCapitalInvestmentSchema.parse({
          ...investment,
          buildingId,
        });
        // Convert fields to proper database types
        return {
          ...validated,
          amount: validated.amount.toString(),
          targetDate: validated.targetDate.toISOString().split('T')[0], // Convert Date to YYYY-MM-DD string
        };
      });

      await db.insert(capitalInvestments).values(validatedInvestments);
    }

    debugLog('PUT /:buildingId/investments - Success', { 
      buildingId, 
      savedCount: investments.length,
      timestamp: new Date().toISOString() 
    });

    res.json({
      message: 'Capital investments saved successfully',
      count: investments.length,
      buildingId,
    });
  } catch (error: any) {
    console.error('❌ Error saving capital investments:', error);
    res.status(500).json({ 
      _error: 'Internal server error',
      message: 'Failed to save capital investments'
    });
  }
});

export default router;
