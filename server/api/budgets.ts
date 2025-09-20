import express from 'express';
import { z } from 'zod';
import { db } from '../db';
import { budgets, monthlyBudgets, buildings, bills, payments, residences, capitalInvestments, insertCapitalInvestmentSchema } from '@shared/schema';
import { requireAuth } from '../auth';
import { and, eq, gte, lte, sql, desc, asc, sum, count, ne, inArray, or, isNull } from 'drizzle-orm';
import { applyInflation } from '../utils/budgetCalculations';
import {
  ExtendedBuildingConfig,
  getMonthlyFeesInflationRate,
  safeConvertFinancialYearStart,
  shouldApplyInflation
} from '../utils/inflation';
import { ScenarioEngine, ScenarioInput } from '../utils/scenarios.js';

const router = express.Router();

// ExtendedBuildingConfig interface now imported from ../utils/inflation

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
  // Time window parameters
  viewType: z.enum(['month', 'year']).optional(),
  periodLength: z.coerce.number().positive().optional(),
  startMonth: z.coerce.number().min(1).max(12).optional(),
  startYear: z.coerce.number().optional(),
  unplannedBillsStartDate: z.string().optional(),
  lookbackYears: z.coerce.number().min(1).max(10).optional().default(3),
  capitalInvestmentMode: z.enum(['urgent', 'suggested', 'custom']).optional().default('suggested'),
});

const updateUnplannedBillsSchema = z.object({
  unplannedBillsAmount: z.coerce.number().min(0),
  unplannedBillsStartDate: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * Calculate the total minimum requirement from all minimum fields
 * @param emergencyFundMinimum Emergency fund minimum amount
 * @param operatingCashMinimum Operating cash minimum amount
 * @param customBankFields Object containing custom bank field values
 * @returns Total minimum requirement amount
 */
function calculateMinimumRequirement(
  emergencyFundMinimum?: number,
  operatingCashMinimum?: number,
  customBankFields?: Record<string, number>
): number {
  let totalMinimumRequirement = 0;

  // Add emergency fund minimum
  if (emergencyFundMinimum && Number.isFinite(emergencyFundMinimum) && emergencyFundMinimum > 0) {
    totalMinimumRequirement += emergencyFundMinimum;
  }

  // Add operating cash minimum
  if (operatingCashMinimum && Number.isFinite(operatingCashMinimum) && operatingCashMinimum > 0) {
    totalMinimumRequirement += operatingCashMinimum;
  }

  // Add all custom bank fields
  if (customBankFields && typeof customBankFields === 'object') {
    Object.values(customBankFields).forEach((value) => {
      if (Number.isFinite(value) && value > 0) {
        totalMinimumRequirement += value;
      }
    });
  }

  return totalMinimumRequirement;
}

// getMonthlyFeesInflationRate function now imported from ../utils/inflation

// safeConvertFinancialYearStart function now imported from ../utils/inflation

// shouldApplyInflation function now imported from ../utils/inflation

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
      // Custom revenue lines from frontend
      customRevenueLines,
      // Bills configuration fields
      useGlobalBillsInflation,
      globalBillsInflationRate,
      unplannedBillsAmount,
      categoryInflationRates,
      // Financial year configuration
      financialYearStart,
    } = req.body;

    // Validate building exists
    const building = await db.query.buildings.findFirst({
      where: eq(buildings.id, buildingId),
      columns: { id: true },
    });

    if (!building) {
      return res.status(404).json({ _error: 'Building not found' });
    }

    // Prepare extended configuration object including custom bank fields and revenue lines
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
      // Include custom revenue lines for persistence
      customRevenueLines: customRevenueLines || [],
      // Include bills configuration for persistence
      useGlobalBillsInflation,
      globalBillsInflationRate,
      categoryInflationRates,
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
        unplannedBillsAmount: unplannedBillsAmount?.toString(), // Save unplanned bills amount
        financialYearStart: financialYearStart || null, // Save financial year start
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
        unplannedBillsAmount: true, // Include unplanned bills amount
        financialYearStart: true, // Include financial year start
        amenities: true, // Contains extended configuration
      },
    });

    if (!building) {
      return res.status(404).json({ _error: 'Building not found' });
    }

    // Extract extended configuration from amenities field with proper typing
    const extendedConfig: ExtendedBuildingConfig = (building.amenities && typeof building.amenities === 'object') ? building.amenities as ExtendedBuildingConfig : {};
    
    // Calculate minimum requirement from all minimum fields
    const emergencyFundMinimum = extendedConfig.emergencyFundMinimum;
    const operatingCashMinimum = extendedConfig.operatingCashMinimum;
    const customBankFields = extendedConfig.customBankFields;
    
    const minimumRequirement = calculateMinimumRequirement(
      emergencyFundMinimum,
      operatingCashMinimum,
      customBankFields
    );
    
    // Temporarily disable historical unique bills calculation to fix performance issues
    // const historicalUniqueBills = await calculateUnplannedBillsSuggestion(buildingId, 3);
    const historicalUniqueBills = { amount: 0, confidence: 'disabled', yearsAnalyzed: 0 };
    
    debugLog('GET /:buildingId/bank-account - Response data', { 
      buildingId, 
      extendedConfig,
      minimumRequirement,
      historicalUniqueBills,
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
      unplannedBillsAmount: building.unplannedBillsAmount, // Include unplanned bills amount
      financialYearStart: building.financialYearStart, // Include financial year start
      // Historical unique bills data
      historicalUniqueBillsAmount: historicalUniqueBills.amount,
      historicalUniqueBillsConfidence: historicalUniqueBills.confidence,
      historicalUniqueBillsYearsAnalyzed: historicalUniqueBills.yearsAnalyzed,
      // Separate starting balance and minimum requirement
      startingBalance: building.bankAccountStartAmount,
      minimumRequirement: minimumRequirement,
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
  // Function completely disabled to fix infinite query issues
  debugLog('calculateUnplannedBillsSuggestion called but disabled', { buildingId, lookbackYears });
  return { amount: 0, confidence: 'disabled', yearsAnalyzed: 0 };
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
      capitalInvestmentMode,
      // Time window parameters
      viewType,
      periodLength,
      startMonth,
      startYear
    } = validatedInput;

    // Retrieve building settings including extended configuration
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
        unplannedBillsStartDate: true,
        financialYearStart: true, // Financial year start date for inflation timing
        amenities: true, // Contains extended configuration
      },
    });

    if (!building) {
      return res.status(404).json({ _error: 'Building not found' });
    }

    // Temporarily disable historical unique bills calculation to fix performance issues
    // const unplannedBillsCalculation = await calculateUnplannedBillsSuggestion(buildingId, lookbackYears);
    const unplannedBillsCalculation = { amount: 0, confidence: 'disabled', yearsAnalyzed: 0 };
    
    debugLog('Calculated unplanned bills suggestion (read-only)', { 
      buildingId, 
      calculation: unplannedBillsCalculation
    });

    // Use request overrides or fallback to building defaults with proper number validation
    const startAmount = parseFloat(String(bankAccountStartAmount || building.bankAccountStartAmount || '0'));
    
    // Extract extended configuration from amenities field with proper typing
    const extendedConfig: ExtendedBuildingConfig = (building.amenities && typeof building.amenities === 'object') ? building.amenities as ExtendedBuildingConfig : {};
    
    // Calculate minimum requirement using new logic instead of old bankAccountMinimums
    const minimumRequirement = calculateMinimumRequirement(
      extendedConfig.emergencyFundMinimum,
      extendedConfig.operatingCashMinimum,
      extendedConfig.customBankFields
    );
    
    // For backward compatibility, fall back to old bankAccountMinimums if no minimum requirement is calculated
    const minimums = bankAccountMinimums || building.bankAccountMinimums || '0';
    const parsedMinimumFund = parseFloat(String(minimums));
    const fallbackMinimumFund = Number.isFinite(parsedMinimumFund) ? parsedMinimumFund : 0;
    
    // Use the calculated minimum requirement, or fallback to old logic if no requirement is set
    const minimumFund = minimumRequirement > 0 ? minimumRequirement : fallbackMinimumFund;
    
    // DEFENSIVE CONVERSION: Ensure inflation rates are properly converted from percentage to decimal
    // Input validation expects values 0-100 (percentages), convert to 0-1 (decimals) for calculations
    const rawGeneralInflationRate = parseFloat(String(generalInflationRate || building.generalInflationRate || '2.0'));
    const generalInflation = rawGeneralInflationRate / 100;
    
    // FIX: Handle revenueGrowthRate more carefully - it might already be stored as decimal or percentage
    const storedRevenueGrowthRate = extendedConfig.revenueGrowthRate;
    const requestRevenueInflationRate = parseFloat(String(revenueInflationRate || building.revenueInflationRate || '2.5'));
    
    let revenueInflation: number;
    let revenueInflationSource: string;
    
    if (storedRevenueGrowthRate !== undefined) {
      const storedRate = parseFloat(String(storedRevenueGrowthRate));
      // DEFENSIVE CHECK: If stored rate is > 1, assume it's stored as percentage and convert
      // If stored rate is <= 1, assume it's already a decimal
      if (storedRate > 1) {
        revenueInflation = storedRate / 100;
        revenueInflationSource = 'stored_growth_rate_as_percentage';
      } else {
        revenueInflation = storedRate;
        revenueInflationSource = 'stored_growth_rate_as_decimal';
      }
    } else {
      // Use request/building default (always treat as percentage)
      revenueInflation = requestRevenueInflationRate / 100;
      revenueInflationSource = 'request_or_building_default_as_percentage';
    }
    
    // DEFENSIVE VALIDATION: Warn if rates seem too high (> 100% = 1.0 decimal)
    if (generalInflation > 1.0) {
      console.warn(`⚠️  [BUDGET FORECAST] General inflation rate suspiciously high: ${generalInflation * 100}% (${generalInflation} decimal). Expected 0-1 range.`);
    }
    if (revenueInflation > 1.0) {
      console.warn(`⚠️  [BUDGET FORECAST] Revenue inflation rate suspiciously high: ${revenueInflation * 100}% (${revenueInflation} decimal). Expected 0-1 range.`);
    }
    
    // ENHANCED DEFENSIVE LOGGING: Print effective rates being used in calculations
    debugLog('✅ [BUDGET FORECAST] Final inflation rates after conversion and validation', {
      buildingId,
      inputs: {
        rawGeneralInflationRate: rawGeneralInflationRate,
        requestRevenueInflationRate: requestRevenueInflationRate,
        storedRevenueGrowthRate: storedRevenueGrowthRate
      },
      effectiveRates: {
        generalInflationDecimal: generalInflation,
        generalInflationPercentage: generalInflation * 100,
        revenueInflationDecimal: revenueInflation,
        revenueInflationPercentage: revenueInflation * 100
      },
      revenueInflationSource: revenueInflationSource,
      compoundingFormulas: {
        expenses: `expenses = baseExpenses * (1 + ${generalInflation})^years = baseExpenses * ${(1 + generalInflation).toFixed(4)}^years`,
        revenue: `revenue = baseRevenue * (1 + ${revenueInflation})^years = baseRevenue * ${(1 + revenueInflation).toFixed(4)}^years`
      },
      validation: {
        generalInflationValid: generalInflation <= 1.0,
        revenueInflationValid: revenueInflation <= 1.0,
        expectedRange: '0-1 (decimal) for calculations'
      }
    });
    
    // Use input override, calculated suggestion, or existing building value (in priority order)
    const unplannedBills = unplannedBillsAmount !== undefined
      ? unplannedBillsAmount
      : unplannedBillsCalculation.amount > 0 
        ? unplannedBillsCalculation.amount
        : parseFloat(building.unplannedBillsAmount || '0');

    debugLog('Unplanned bills calculation logic', {
      buildingId,
      unplannedBillsAmountFromInput: unplannedBillsAmount,
      unplannedBillsCalculationAmount: unplannedBillsCalculation.amount,
      buildingUnplannedBillsAmount: building.unplannedBillsAmount,
      finalUnplannedBillsUsed: unplannedBills
    });

    // Use current date for filtering and historical expense queries
    const currentDate = new Date();

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
          inArray(bills.status, ['draft', 'sent', 'paid', 'overdue']), // Include draft, sent, paid, and overdue bills (exclude only cancelled)
          or(isNull(bills.endDate), gte(bills.endDate, currentDate.toISOString().split('T')[0])) // Exclude past-ended recurrent bills
        )
      );

    // Fetch unique bills for Bills Configuration display count
    const uniqueBills = await db
      .select({
        id: bills.id,
        category: bills.category,
        status: bills.status,
      })
      .from(bills)
      .where(
        and(
          eq(bills.buildingId, buildingId),
          eq(bills.paymentType, 'unique'),
          inArray(bills.status, ['draft', 'sent', 'paid', 'overdue'])
        )
      );

    debugLog('Bills counts for configuration display', {
      buildingId,
      recurrentBillsCount: recurrentBills.length,
      uniqueBillsCount: uniqueBills.length,
      uniqueBillsFound: uniqueBills.map(bill => ({
        id: bill.id,
        category: bill.category,
        status: bill.status
      }))
    });

    // REMOVED: Historical expenses query - spending calculations now only use bills data
    // No historical expenses or other data sources are used in spending calculations
    debugLog('Spending calculation sources', {
      buildingId,
      dataSourcesUsed: ['recurrent_bills_only'],
      historicalExpensesUsed: false,
      monthlyBudgetSpendingUsed: false,
      note: 'Only active recurrent bills are used for spending calculations'
    });

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

    // Separate monthly fees from other income sources for different inflation treatment
    const monthlyFeesRevenue = monthlyResidenceRevenue; // Monthly fees from residences (use bills inflation)
    
    // Calculate other income sources from budget data (use revenue inflation)
    let otherMonthlyIncome = 0;
    if (baselineIncome.length > 0 && baselineIncome[0].incomes) {
      otherMonthlyIncome = baselineIncome[0].incomes
        .reduce((sum, income) => sum + parseFloat(income), 0);
    }
    
    // Total baseline income (for backward compatibility and fallback)
    const totalBaselineIncome = monthlyFeesRevenue + otherMonthlyIncome;
    
    // Use fallback only if no residence or budget revenue exists
    const monthlyBaselineIncome = totalBaselineIncome > 0 ? totalBaselineIncome : 50000;

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

    debugLog('Bills data sources for spending calculation', {
      buildingId,
      recurrentBillsFound: recurrentBills.length,
      billsIncluded: recurrentBills.map(bill => ({
        category: bill.category,
        costs: bill.costs,
        schedule: bill.schedulePayment,
        status: 'active'
      })),
      totalMonthlyRecurringCosts: monthlyRecurringCosts,
      note: 'These are the ONLY sources of spending in budget calculations'
    });

    // REMOVED: Historical expenses grouping - not used in spending calculations
    // Spending is calculated purely from recurrent bills data only

    // Fetch user-created capital investments for this building
    const userCapitalInvestments = await db
      .select({
        id: capitalInvestments.id,
        amount: capitalInvestments.amount,
        targetDate: capitalInvestments.targetDate,
        urgency: capitalInvestments.urgency,
        type: capitalInvestments.type
      })
      .from(capitalInvestments)
      .where(eq(capitalInvestments.buildingId, buildingId))
      .orderBy(asc(capitalInvestments.targetDate));

    debugLog('User-created capital investments found', {
      buildingId,
      count: userCapitalInvestments.length,
      investments: userCapitalInvestments
    });

    // Calculate time window for forecast based on user selection
    const effectiveViewType = viewType || 'month';
    const effectivePeriodLength = periodLength || 12; // Default to 12 months
    const effectiveStartYear = startYear || latestYear;
    const effectiveStartMonth = startMonth || 1; // Default to January
    
    // Calculate number of months to process based on view type and period length
    const totalMonthsToCalculate = effectiveViewType === 'year' 
      ? effectivePeriodLength * 12  // Years to months
      : effectivePeriodLength;      // Already in months
      
    debugLog('Time window calculation for forecast', {
      buildingId,
      userSelection: { viewType, periodLength, startMonth, startYear },
      effective: { effectiveViewType, effectivePeriodLength, effectiveStartYear, effectiveStartMonth },
      totalMonthsToCalculate,
      note: 'Only calculating within selected time window instead of 25 years'
    });

    // Generate forecast only for selected time window with proper recurrent bill scheduling  
    const forecastData = [];
    let currentBalance = startAmount;
    const startMonthIndex = effectiveStartMonth - 1; // Convert to 0-based index

    for (let monthIndex = 0; monthIndex < totalMonthsToCalculate; monthIndex++) {
      // Calculate actual year and month considering the start month offset
      const totalMonthsFromStart = startMonthIndex + monthIndex;
      const currentYear = effectiveStartYear + Math.floor(totalMonthsFromStart / 12);
      const currentMonth = (totalMonthsFromStart % 12) + 1;
      const currentDate = new Date(currentYear, currentMonth - 1, 1);
      
      // Apply inflation separately for monthly fees and other income, respecting financial year start date
      const yearsElapsed = Math.floor(monthIndex / 12);
      
      // Check if inflation should be applied based on financial year start date
      const financialYearStartDate = safeConvertFinancialYearStart(building.financialYearStart);
      const shouldInflate = shouldApplyInflation(currentDate, financialYearStartDate);
      
      let inflatedMonthlyFees = monthlyFeesRevenue;
      let inflatedOtherIncome = otherMonthlyIncome;
      
      if (shouldInflate && yearsElapsed > 0) {
        // Get the correct inflation rate for monthly fees based on bills configuration
        const monthlyFeesInflationRate = getMonthlyFeesInflationRate(extendedConfig, revenueInflation, generalInflation);
        
        // Apply bills inflation to monthly fees
        inflatedMonthlyFees = applyInflation(monthlyFeesRevenue, monthlyFeesInflationRate, yearsElapsed);
        
        // Apply revenue inflation to other income sources
        inflatedOtherIncome = applyInflation(otherMonthlyIncome, revenueInflation, yearsElapsed);
      }
      
      // Total inflated income
      const inflatedIncome = inflatedMonthlyFees + inflatedOtherIncome;
      
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

      // Calculate unique bills payments for this month
      let monthlyUniqueBillsPayments = 0;
      
      // Get unique bills payments that are due this month
      const uniqueBillsPayments = await db
        .select({
          amount: payments.amount,
          scheduledDate: payments.scheduledDate,
          status: payments.status,
        })
        .from(payments)
        .innerJoin(bills, eq(payments.billId, bills.id))
        .where(
          and(
            eq(bills.buildingId, buildingId),
            eq(bills.paymentType, 'unique'),
            eq(payments.status, 'paid'),
            // Filter payments for this specific month/year
            sql`EXTRACT(YEAR FROM ${payments.scheduledDate}) = ${currentYear}`,
            sql`EXTRACT(MONTH FROM ${payments.scheduledDate}) = ${currentMonth}`
          )
        );
      
      // Sum up unique bills payments for this month
      monthlyUniqueBillsPayments = uniqueBillsPayments.reduce((total, payment) => {
        return total + parseFloat(payment.amount);
      }, 0);

      // Check if unplanned bills should be applied based on start date
      let appliedUnplannedBills = 0;
      if (validatedInput.unplannedBillsStartDate || building.unplannedBillsStartDate) {
        const startDate = new Date(validatedInput.unplannedBillsStartDate || building.unplannedBillsStartDate);
        const currentForecastDate = new Date(currentYear, currentMonth - 1, 1);
        
        // Only apply unplanned bills if current forecast date is >= start date
        if (currentForecastDate >= startDate) {
          appliedUnplannedBills = unplannedBills * Math.pow(1 + generalInflation, yearsElapsed);
        }
      } else {
        // If no start date is set, apply unplanned bills immediately
        appliedUnplannedBills = unplannedBills * Math.pow(1 + generalInflation, yearsElapsed);
      }

      // Special one-time incomes (special_cotisations) - could be added from monthly_budgets
      let specialIncomes = 0;
      // TODO: Implement special income logic from monthly_budgets if needed

      // Calculate planned investments (user-created) for this month
      let plannedInvestments = 0;
      const currentMonthDate = new Date(currentYear, currentMonth - 1, 1);
      
      // Find any user-created capital investments due this month
      userCapitalInvestments.forEach(investment => {
        const investmentDate = new Date(investment.targetDate);
        if (investmentDate.getFullYear() === currentYear && investmentDate.getMonth() === currentMonth - 1) {
          plannedInvestments += parseFloat(investment.amount);
        }
      });

      // STEP 1: Account start + Revenue + planned investments - spending = Account end without auto-investment
      const totalRevenue = inflatedIncome + specialIncomes;
      const totalSpending = inflatedRecurringExpenses + appliedUnplannedBills + monthlyUniqueBillsPayments;
      const balanceWithoutAutoInvestment = currentBalance + totalRevenue + plannedInvestments - totalSpending;

      // STEP 2: Calculate auto-generated investment based on balance without auto-investment  
      let autoGeneratedInvestment = 0;
      
      // Apply capital investment strategy based on selected mode using balanceWithoutAutoInvestment
      if (capitalInvestmentMode === 'urgent') {
        // Urgent Capital Mode: Only inject capital when balance would go below $0 (emergency injection)
        if (balanceWithoutAutoInvestment < 0) {
          // Calculate required capital investment to bring balance back to 0
          autoGeneratedInvestment = Math.abs(balanceWithoutAutoInvestment);
          
          // Round capital investment to nearest 100 for realistic injection amounts
          autoGeneratedInvestment = Math.ceil(autoGeneratedInvestment / 100) * 100;
        }
      } else if (capitalInvestmentMode === 'suggested') {
        // Suggested Capital Mode: Inject capital for minimum requirements AND special investments
        let suggestedInvestment = 0;
        
        // 1. First ensure minimum requirement is met (only if balance is below minimum)
        const minimumRequired = Math.max(0, minimumFund);
        if (balanceWithoutAutoInvestment < minimumRequired) {
          suggestedInvestment = minimumRequired - balanceWithoutAutoInvestment;
          debugLog('Investment needed to reach minimum requirement', {
            balanceWithoutAutoInvestment,
            minimumRequired,
            suggestedInvestment
          });
        } else {
          debugLog('Balance already above minimum requirement', {
            balanceWithoutAutoInvestment,
            minimumRequired,
            surplus: balanceWithoutAutoInvestment - minimumRequired
          });
        }
        
        // 2. Then consider additional investments from extended config
        if (extendedConfig) {
          const specialBudgetMonthly = (extendedConfig.specialInvestmentBudget || 0) / 12;
          const capitalReserveMonthly = (extendedConfig.capitalProjectReserve || 0) / (12 * (extendedConfig.investmentHorizonYears || 5));
          
          // Suggest investment if we have available capacity above minimum + buffer
          const bufferAmount = minimumFund * 0.1; // 10% buffer above minimum
          const targetWithBuffer = minimumFund + bufferAmount;
          
          if (balanceWithoutAutoInvestment + suggestedInvestment > targetWithBuffer) {
            // Available capacity for special investments
            const availableForInvestment = balanceWithoutAutoInvestment + suggestedInvestment - targetWithBuffer;
            const monthlyInvestmentCapacity = Math.min(specialBudgetMonthly, capitalReserveMonthly, availableForInvestment);
            
            if (monthlyInvestmentCapacity > 0) {
              suggestedInvestment += monthlyInvestmentCapacity;
            }
          }
        }
        
        if (suggestedInvestment > 0) {
          // Round to nearest 100 for realistic amounts
          autoGeneratedInvestment = Math.ceil(suggestedInvestment / 100) * 100;
        }
      } else if (capitalInvestmentMode === 'custom') {
        // Custom Capital Mode: No automatic capital injections - allow negative balances
        // autoGeneratedInvestment remains 0
      }
      
      // Calculate final balance: balance without auto-investment + auto-generated investment
      const finalBalance = balanceWithoutAutoInvestment + autoGeneratedInvestment;
      
      // Update current balance for next period
      currentBalance = finalBalance;

      // Determine status based on final balance
      let status = 'green';
      // Fix: Use proper number comparison to avoid NaN issues
      if (Number.isFinite(minimumFund) && finalBalance < minimumFund) {
        status = 'yellow';
      }
      // Balance should never be red now since we inject capital investment

      // Add to forecast data
      forecastData.push({
        year: currentYear,
        month: currentMonth,
        period: `${currentYear}-${String(currentMonth).padStart(2, '0')}`, // Frontend expects this format
        revenue: Math.round(totalRevenue * 100) / 100,
        spending: Math.round(totalSpending * 100) / 100,
        plannedInvestments: Math.round(plannedInvestments * 100) / 100, // User-created investments
        capitalInvestment: Math.round(autoGeneratedInvestment * 100) / 100, // Auto-generated investments
        autoGeneratedInvestment: Math.round(autoGeneratedInvestment * 100) / 100, // Frontend expects this field name
        balance: Math.round(finalBalance * 100) / 100,
        balanceWithoutAutoInvestment: Math.round(balanceWithoutAutoInvestment * 100) / 100, // For debugging
        balanceBeforeScenario: Math.round(balanceWithoutAutoInvestment * 100) / 100, // Frontend expects this field name
        status,
        inflatedIncome: Math.round(inflatedIncome * 100) / 100,
        inflatedRecurringExpenses: Math.round(inflatedRecurringExpenses * 100) / 100,
        appliedUnplannedBills: Math.round(appliedUnplannedBills * 100) / 100,
        monthlyUniqueBillsPayments: Math.round(monthlyUniqueBillsPayments * 100) / 100,
      });
    }

    res.json({
      buildingId,
      buildingName: building.name,
      forecastPeriod: '25 years',
      // Clearly separate starting balance from minimum requirement
      startingBalance: startAmount,
      minimumRequirement: minimumRequirement,
      minimumFund, // Keep for backward compatibility
      // CORRECTED: Return the properly converted decimal rates as percentages for display
      generalInflationRate: Math.round(generalInflation * 100) / 100, // Round to 2 decimal places
      revenueGrowthRate: Math.round(revenueInflation * 100) / 100,
      revenueInflationRate: Math.round(revenueInflation * 100) / 100, // Keep for backward compatibility
      revenueGrowthRateSource: revenueInflationSource,
      baselineMonthlyIncome: monthlyBaselineIncome,
      baselineMonthlyExpenses: monthlyRecurringCosts,
      recurrentBillsCount: recurrentBills.length,
      uniqueBillsCount: uniqueBills.length,
      // CLARIFICATION: Spending calculations use ONLY bills data
      dataSourcesUsed: {
        recurrentBills: true,
        historicalExpenses: false,
        monthlyBudgets: false,
        note: 'Only active recurrent bills are used for spending calculations'
      },
      // Capital investment scenario information
      capitalInvestmentMode: capitalInvestmentMode,
      // DIAGNOSTIC: Include inflation rate conversion details for debugging
      inflationRatesDiagnostic: {
        inputRatesReceived: {
          generalInflationRate: generalInflationRate || 'undefined (using default)',
          revenueInflationRate: revenueInflationRate || 'undefined (using default)'
        },
        effectiveDecimalRates: {
          generalInflation: generalInflation,
          revenueInflation: revenueInflation
        },
        conversionSource: {
          generalInflation: 'percentage_input_divided_by_100',
          revenueInflation: revenueInflationSource
        },
        formulaUsed: {
          generalInflation: `(1 + ${generalInflation})^years`,
          revenueInflation: `(1 + ${revenueInflation})^years`
        }
      },
      // Include calculated unplanned bills information
      unplannedBillsCalculation: {
        suggestedAmount: unplannedBillsCalculation.amount,
        confidence: unplannedBillsCalculation.confidence,
        yearsAnalyzed: unplannedBillsCalculation.yearsAnalyzed,
        method: unplannedBillsCalculation.amount > 0 ? 'payments_historical' : 'no_data'
      },
      monthlyUnplannedBillsUsed: unplannedBills,
      unplannedBillsStartDate: validatedInput.unplannedBillsStartDate || building.unplannedBillsStartDate || null,
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
    const { unplannedBillsAmount, unplannedBillsStartDate, notes } = validatedInput;

    // Validate building exists
    const building = await db.query.buildings.findFirst({
      where: eq(buildings.id, buildingId),
      columns: { id: true },
    });

    if (!building) {
      return res.status(404).json({ _error: 'Building not found' });
    }

    // Update building with new unplanned bills amount and start date
    await db
      .update(buildings)
      .set({ 
        unplannedBillsAmount: unplannedBillsAmount.toString(),
        unplannedBillsStartDate: unplannedBillsStartDate || null,
        bankAccountNotes: notes || null,
        updatedAt: new Date()
      })
      .where(eq(buildings.id, buildingId));
      
    debugLog('Updated building unplanned bills settings', { 
      buildingId, 
      newAmount: unplannedBillsAmount,
      newStartDate: unplannedBillsStartDate,
      notes 
    });

    res.json({
      message: 'Unplanned bills settings updated successfully',
      buildingId,
      unplannedBillsAmount,
      unplannedBillsStartDate,
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
