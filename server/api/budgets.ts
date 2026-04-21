import express from 'express';
import { z } from 'zod';
import { db } from '../db';
import { budgets, monthlyBudgets, buildings, bills, payments, residences, capitalInvestments, insertCapitalInvestmentSchema, maintenanceProjects } from '@shared/schema';
import { requireAuth } from '../auth';
import { and, eq, gte, lte, lt, sql, desc, asc, sum, count, ne, inArray, or, isNull } from 'drizzle-orm';
import { applyInflation } from '../utils/budgetCalculations';
import {
  ExtendedBuildingConfig,
  getMonthlyFeesInflationRate,
  safeConvertFinancialYearStart,
  shouldApplyInflation,
  getFinancialYearsElapsed
} from '../utils/inflation';
import { ScenarioEngine, ScenarioInput } from '../utils/scenarios.js';
import { forecastInputSchema } from './forecast-input-schema';

const router = express.Router();

// ExtendedBuildingConfig interface now imported from ../utils/inflation

const isDev = process.env.NODE_ENV !== 'production';
const debugLog = (endpoint: string, data: any) => {
  if (isDev) {
    console.log(`[BUDGETS API] ${endpoint}:`, JSON.stringify(data, null, 2));
  }
};

// Validation schemas
// `forecastInputSchema` is now defined in ./forecast-input-schema so that
// tests can import it without pulling in the rest of this route file.

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
export function calculateMinimumRequirement(
  emergencyFundMinimum?: number,
  operatingCashMinimum?: number,
  customBankFields?: Record<string, number>
): number {
  let totalMinimumRequirement = 0;

  // Add emergency fund minimum (allow zero as valid override)
  if (emergencyFundMinimum !== undefined && Number.isFinite(emergencyFundMinimum) && emergencyFundMinimum >= 0) {
    totalMinimumRequirement += emergencyFundMinimum;
  }

  // Add operating cash minimum (allow zero as valid override)
  if (operatingCashMinimum !== undefined && Number.isFinite(operatingCashMinimum) && operatingCashMinimum >= 0) {
    totalMinimumRequirement += operatingCashMinimum;
  }

  // Add all custom bank fields (allow zero as valid override)
  if (customBankFields && typeof customBankFields === 'object') {
    Object.values(customBankFields).forEach((value) => {
      if (Number.isFinite(value) && value >= 0) {
        totalMinimumRequirement += value;
      }
    });
  }

  return totalMinimumRequirement;
}

/**
 * Get the earliest bill date for a building (excluding draft and cancelled bills)
 */
async function getEarliestBillDate(buildingId: string): Promise<string | null> {
  try {
    const firstBill = await db
      .select({
        startDate: bills.startDate,
      })
      .from(bills)
      .where(
        and(
          eq(bills.buildingId, buildingId),
          inArray(bills.status, ['sent', 'paid', 'overdue'])
        )
      )
      .orderBy(asc(bills.startDate))
      .limit(1);

    if (firstBill.length === 0) {
      return null;
    }

    return firstBill[0].startDate;
  } catch (error) {
    console.error('Error getting earliest bill date:', error);
    return null;
  }
}

/**
 * Calculate which financial year a date belongs to based on the financial year start
 * @param dateStr Bill date in ISO format (YYYY-MM-DD)
 * @param financialYearStart Financial year start date in ISO format (YYYY-MM-DD) or null
 * @returns The financial year number
 */
function calculateFinancialYear(dateStr: string, financialYearStart: string | null): number {
  const billDate = new Date(dateStr);
  const billYear = billDate.getFullYear();
  const billMonth = billDate.getMonth() + 1; // 1-12

  // Default to January if no financial year start is set
  let fyStartMonth = 1;
  if (financialYearStart) {
    // financialYearStart is in format "YYYY-MM-DD", extract month
    const parts = financialYearStart.split('-');
    if (parts.length >= 2) {
      fyStartMonth = parseInt(parts[1], 10);
    }
  }

  // If the bill month is before the FY start month, it belongs to the previous financial year
  if (billMonth < fyStartMonth) {
    return billYear - 1;
  }

  return billYear;
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
          sql`(${monthlyBudgets.year} * 100 + ${monthlyBudgets.month}) >= ${startYearMonth}`,
          sql`(${monthlyBudgets.year} * 100 + ${monthlyBudgets.month}) <= ${endYearMonth}`
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
      // Punctual revenue growth from frontend
      punctualRevenueGrowth,
      // Bills configuration fields
      useGlobalBillsInflation,
      globalBillsInflationRate,
      unplannedBillsAmount,
      unplannedBillsStartDate,
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
      // Include punctual revenue growth for persistence
      punctualRevenueGrowth: punctualRevenueGrowth || [],
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
        unplannedBillsStartDate: unplannedBillsStartDate || null, // Save unplanned bills start date
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
        unplannedBillsStartDate: true, // Include unplanned bills start date
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
    
    // Calculate historical unique bills suggestion based on past data
    const historicalUniqueBills = await calculateUnplannedBillsSuggestion(buildingId, 3);
    
    // Get earliest bill date and calculate earliest financial year
    const earliestBillDate = await getEarliestBillDate(buildingId);
    const earliestFinancialYear = earliestBillDate 
      ? calculateFinancialYear(earliestBillDate, building.financialYearStart)
      : null;
    
    debugLog('GET /:buildingId/bank-account - Response data', { 
      buildingId, 
      extendedConfig,
      minimumRequirement,
      historicalUniqueBills,
      earliestBillDate,
      earliestFinancialYear,
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
      unplannedBillsStartDate: building.unplannedBillsStartDate, // Include unplanned bills start date
      financialYearStart: building.financialYearStart, // Include financial year start
      // Historical unique bills data
      historicalUniqueBillsAmount: historicalUniqueBills.amount,
      historicalUniqueBillsConfidence: historicalUniqueBills.confidence,
      historicalUniqueBillsYearsAnalyzed: historicalUniqueBills.yearsAnalyzed,
      // Earliest bill data
      earliestBillDate: earliestBillDate,
      earliestFinancialYear: earliestFinancialYear,
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
  try {
    debugLog('calculateUnplannedBillsSuggestion called', { buildingId, lookbackYears });
    
    const currentDate = new Date();
    
    // Get ALL unique (one-time) bills for this building that are not draft or cancelled
    // User requirement: sum of all unique costs before today
    const uniqueBills = await db
      .select({
        totalAmount: bills.totalAmount,
        startDate: bills.startDate,
        createdAt: bills.createdAt,
      })
      .from(bills)
      .where(
        and(
          eq(bills.buildingId, buildingId),
          // Use billType (preferred) or fallback to paymentType for backward compatibility
          or(
            eq(bills.billType, 'unique'),
            and(isNull(bills.billType), eq(bills.paymentType, 'unique'))
          ),
          inArray(bills.status, ['sent', 'paid', 'overdue']), // Exclude draft and cancelled bills
          lt(bills.startDate, currentDate.toISOString().split('T')[0]) // Only bills before today
        )
      );

    // Get the very first bill (of ANY type) for this building to determine starting point
    const firstBill = await db
      .select({
        startDate: bills.startDate,
      })
      .from(bills)
      .where(
        and(
          eq(bills.buildingId, buildingId),
          inArray(bills.status, ['sent', 'paid', 'overdue']) // Exclude draft and cancelled bills
        )
      )
      .orderBy(asc(bills.startDate))
      .limit(1);

    if (uniqueBills.length === 0 || firstBill.length === 0) {
      return { amount: 0, confidence: 'no_data', yearsAnalyzed: 0 };
    }

    // Calculate total amount of all unique bills
    const totalAmount = uniqueBills.reduce((sum, bill) => {
      const amount = parseFloat(bill.totalAmount || '0');
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);

    // Calculate months from the FIRST bill start date (any type) to today
    const earliestBillDate = new Date(firstBill[0].startDate);
    const monthsDifference = Math.max(1, Math.floor((currentDate.getTime() - earliestBillDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000)));
    
    const monthlyAverage = totalAmount / monthsDifference;

    // Determine confidence based on number of bills and time span
    let confidence = 'low';
    const yearsDifference = monthsDifference / 12;
    if (uniqueBills.length >= 10 && yearsDifference >= 2) {
      confidence = 'high';
    } else if (uniqueBills.length >= 5 && yearsDifference >= 1) {
      confidence = 'medium';
    }

    debugLog('Historical unique bills calculation completed', {
      buildingId,
      uniqueBillsCount: uniqueBills.length,
      totalAmount,
      firstBillStartDate: earliestBillDate.toISOString().split('T')[0],
      monthsDifference,
      monthlyAverage,
      confidence,
      yearsAnalyzed: Math.round(yearsDifference * 10) / 10
    });

    return {
      amount: Math.round(monthlyAverage * 100) / 100, // Round to 2 decimal places
      confidence,
      yearsAnalyzed: Math.round(yearsDifference * 10) / 10
    };
  } catch (error) {
    console.error('Error calculating unplanned bills suggestion:', error);
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
      capitalInvestmentMode,
      projectIds,
      // Time window parameters
      viewType,
      periodLength,
      startMonth,
      startYear
    } = validatedInput;

    // Retrieve building settings including extended configuration
    let building;
    try {
      building = await db.query.buildings.findFirst({
        where: eq(buildings.id, buildingId),
        columns: {
          id: true,
          name: true,
          bankAccountStartDate: true,
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
    } catch (dbError: any) {
      console.error('❌ Database error fetching building:', buildingId, dbError);
      console.error('Stack trace:', dbError.stack);
      return res.status(500).json({ 
        _error: 'Failed to fetch building data',
        message: isDev ? dbError.message : 'Database query failed'
      });
    }

    if (!building) {
      return res.status(404).json({ _error: 'Building not found' });
    }
    
    // Log building data for debugging (especially amenities field)
    debugLog('Building data retrieved', {
      buildingId,
      hasAmenities: !!building.amenities,
      amenitiesType: typeof building.amenities,
      amenitiesKeys: building.amenities && typeof building.amenities === 'object' ? Object.keys(building.amenities) : []
    });

    // Calculate unplanned bills suggestion based on historical data
    const unplannedBillsCalculation = await calculateUnplannedBillsSuggestion(buildingId, lookbackYears);
    
    debugLog('Calculated unplanned bills suggestion (read-only)', { 
      buildingId, 
      calculation: unplannedBillsCalculation
    });

    // Use request overrides or fallback to building defaults with proper number validation
    // Use ?? instead of || to allow zero values (0 is a valid input)
    const startAmount = parseFloat(String(bankAccountStartAmount ?? building.bankAccountStartAmount ?? '0'));
    
    // Extract extended configuration from amenities field with proper typing and defensive checks
    let extendedConfig: ExtendedBuildingConfig = {};
    try {
      extendedConfig = (building.amenities && typeof building.amenities === 'object') 
        ? building.amenities as ExtendedBuildingConfig 
        : {};
      
      // Ensure nested objects exist to prevent undefined errors
      if (!extendedConfig.customBankFields) extendedConfig.customBankFields = {};
      if (!extendedConfig.customRevenueLines) extendedConfig.customRevenueLines = [];
      if (!extendedConfig.punctualRevenueGrowth) extendedConfig.punctualRevenueGrowth = [];
      
      debugLog('Extended config parsed successfully', {
        buildingId,
        hasEmergencyFund: !!extendedConfig.emergencyFundMinimum,
        hasOperatingCash: !!extendedConfig.operatingCashMinimum,
        customBankFieldsCount: Object.keys(extendedConfig.customBankFields || {}).length,
        customRevenueCount: (extendedConfig.customRevenueLines || []).length
      });
    } catch (configError: any) {
      console.error('❌ Error parsing extended config from amenities:', buildingId, configError);
      // Continue with empty config rather than failing
      extendedConfig = {
        customBankFields: {},
        customRevenueLines: [],
        punctualRevenueGrowth: []
      };
    }
    
    // Calculate minimum requirement using new logic instead of old bankAccountMinimums
    const minimumRequirement = calculateMinimumRequirement(
      extendedConfig.emergencyFundMinimum,
      extendedConfig.operatingCashMinimum,
      extendedConfig.customBankFields
    );
    
    // For backward compatibility, fall back to old bankAccountMinimums if no minimum requirement is calculated
    // Use ?? instead of || to allow zero values (0 is a valid input)
    const minimums = bankAccountMinimums ?? building.bankAccountMinimums ?? '0';
    const parsedMinimumFund = parseFloat(String(minimums));
    const fallbackMinimumFund = Number.isFinite(parsedMinimumFund) ? parsedMinimumFund : 0;
    
    // Check if any minimum requirement fields are explicitly defined (even if they're 0)
    // If any are defined, use the calculated minimumRequirement (even if it's 0)
    // If none are defined, use the fallback to old bankAccountMinimums
    const hasExplicitMinimumFields = 
      extendedConfig.emergencyFundMinimum !== undefined ||
      extendedConfig.operatingCashMinimum !== undefined ||
      (extendedConfig.customBankFields && Object.keys(extendedConfig.customBankFields).length > 0);
    
    const minimumFund = hasExplicitMinimumFields ? minimumRequirement : fallbackMinimumFund;
    
    // DEFENSIVE CONVERSION: Ensure inflation rates are properly converted from percentage to decimal
    // Input validation expects values 0-100 (percentages), convert to 0-1 (decimals) for calculations
    // Use ?? instead of || to allow zero values (0 is a valid input)
    const rawGeneralInflationRate = parseFloat(String(generalInflationRate ?? building.generalInflationRate ?? '2.0'));
    const generalInflation = rawGeneralInflationRate / 100;
    
    // FIX: Handle revenueGrowthRate more carefully - it might already be stored as decimal or percentage
    const storedRevenueGrowthRate = extendedConfig.revenueGrowthRate;
    // Use ?? instead of || to allow zero values (0 is a valid input)
    const requestRevenueInflationRate = parseFloat(String(revenueInflationRate ?? building.revenueInflationRate ?? '2.5'));
    
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
    let recurrentBills;
    try {
      recurrentBills = await db
        .select({
          id: bills.id,
          category: bills.category,
          costs: bills.costs,
          schedulePayment: bills.schedulePayment,
          scheduleCustom: bills.scheduleCustom,
          paymentStructure: bills.paymentStructure,
          yearInterval: bills.yearInterval,
          startDate: bills.startDate,
          endDate: bills.endDate,
        })
        .from(bills)
        .where(
          and(
            eq(bills.buildingId, buildingId),
            // Use billType (preferred) or fallback to paymentType for backward compatibility
            or(
              eq(bills.billType, 'recurrent'),
              and(isNull(bills.billType), eq(bills.paymentType, 'recurrent'))
            ),
            inArray(bills.status, ['sent', 'paid', 'overdue']), // Include sent, paid, and overdue bills (exclude draft and cancelled)
            or(isNull(bills.endDate), gte(bills.endDate, currentDate.toISOString().split('T')[0])) // Exclude past-ended recurrent bills
            // Note: Parent bills are now included to provide context for fiscal year splits
          )
        );
    } catch (dbError: any) {
      console.error('❌ Database error fetching recurrent bills:', buildingId, dbError);
      console.error('Stack trace:', dbError.stack);
      return res.status(500).json({ 
        _error: 'Failed to fetch recurrent bills',
        message: isDev ? dbError.message : 'Database query failed'
      });
    }

    // Fetch unique bills for Bills Configuration display count and forecast calculations
    // Include schedulePayment and paymentStructure to identify bills with custom payment plans
    let uniqueBills;
    try {
      uniqueBills = await db
        .select({
          id: bills.id,
          category: bills.category,
          status: bills.status,
          startDate: bills.startDate,
          totalAmount: bills.totalAmount,
          schedulePayment: bills.schedulePayment,
          paymentStructure: bills.paymentStructure,
          costs: bills.costs,
          scheduleCustom: bills.scheduleCustom,
        })
        .from(bills)
        .where(
          and(
            eq(bills.buildingId, buildingId),
            // Use billType (preferred) or fallback to paymentType for backward compatibility
            or(
              eq(bills.billType, 'unique'),
              and(isNull(bills.billType), eq(bills.paymentType, 'unique'))
            ),
            inArray(bills.status, ['sent', 'paid', 'overdue']) // Include sent, paid, and overdue bills (exclude draft and cancelled)
          )
        );
    } catch (dbError: any) {
      console.error('❌ Database error fetching unique bills:', buildingId, dbError);
      console.error('Stack trace:', dbError.stack);
      return res.status(500).json({ 
        _error: 'Failed to fetch unique bills',
        message: isDev ? dbError.message : 'Database query failed'
      });
    }

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
    let residenceData;
    try {
      residenceData = await db.query.residences.findMany({
        where: eq(residences.buildingId, buildingId),
        columns: {
          id: true,
          monthlyFees: true,
          isActive: true,
        },
      });
    } catch (dbError: any) {
      console.error('❌ Database error fetching residences:', buildingId, dbError);
      console.error('Stack trace:', dbError.stack);
      return res.status(500).json({ 
        _error: 'Failed to fetch residences',
        message: isDev ? dbError.message : 'Database query failed'
      });
    }

    // Fetch latest monthly budgets for baseline income data
    const latestYear = new Date().getFullYear();
    let baselineIncome;
    try {
      baselineIncome = await db
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
    } catch (dbError: any) {
      console.error('❌ Database error fetching monthly budgets:', buildingId, dbError);
      console.error('Stack trace:', dbError.stack);
      return res.status(500).json({ 
        _error: 'Failed to fetch monthly budgets',
        message: isDev ? dbError.message : 'Database query failed'
      });
    }

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
    
    // Calculate other income sources from custom revenue lines only
    // Note: monthly_budgets income is NOT included - only residence fees + custom revenue lines
    // are used as revenue sources, ensuring the forecast matches what users see in Revenue Configuration
    let otherMonthlyIncome = 0;
    
    // Add custom revenue lines to other monthly income
    if (extendedConfig.customRevenueLines && Array.isArray(extendedConfig.customRevenueLines)) {
      const customMonthlyRevenue = extendedConfig.customRevenueLines
        .reduce((total, line) => {
          if (line.monthlyAmount && typeof line.monthlyAmount === 'number') {
            return total + line.monthlyAmount;
          }
          // Handle string amounts
          if (line.monthlyAmount && typeof line.monthlyAmount === 'string') {
            const parsedAmount = parseFloat(line.monthlyAmount);
            return total + (isNaN(parsedAmount) ? 0 : parsedAmount);
          }
          return total;
        }, 0);
      otherMonthlyIncome += customMonthlyRevenue;
      
      debugLog('Custom revenue lines included in forecast', {
        customRevenueLines: extendedConfig.customRevenueLines,
        customMonthlyRevenue,
        totalOtherMonthlyIncome: otherMonthlyIncome
      });
    }
    
    // Total baseline income (for backward compatibility and fallback)
    const totalBaselineIncome = monthlyFeesRevenue + otherMonthlyIncome;
    
    // Apply fallback to otherMonthlyIncome if no revenue exists (for forecast calculations)
    if (totalBaselineIncome === 0) {
      otherMonthlyIncome = 50000; // Default monthly income when no data exists
    }
    
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
          case 'custom':
            // For custom schedules, average the total cost over 12 months
            return total + (billCost / 12);
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

    // Fetch maintenance projects for this building (filtered by projectIds if provided)
    // projectIds === undefined: No filter, include all projects
    // projectIds === []: Explicitly exclude all projects
    // projectIds === ['id1', 'id2']: Include only specified projects
    let includedProjects;
    
    if (projectIds === undefined) {
      // No filter specified - include all projects
      includedProjects = await db
        .select({
          id: maintenanceProjects.id,
          totalBudget: maintenanceProjects.totalBudget,
          estimatedCost: maintenanceProjects.estimatedCost,
          plannedStartDate: maintenanceProjects.plannedStartDate,
          financialYear: maintenanceProjects.financialYear,
          status: maintenanceProjects.status,
        })
        .from(maintenanceProjects)
        .where(eq(maintenanceProjects.buildingId, buildingId));
    } else if (projectIds.length === 0) {
      // Empty array - explicitly exclude all projects
      includedProjects = [];
    } else {
      // Include only specified projects
      includedProjects = await db
        .select({
          id: maintenanceProjects.id,
          totalBudget: maintenanceProjects.totalBudget,
          estimatedCost: maintenanceProjects.estimatedCost,
          plannedStartDate: maintenanceProjects.plannedStartDate,
          financialYear: maintenanceProjects.financialYear,
          status: maintenanceProjects.status,
        })
        .from(maintenanceProjects)
        .where(
          and(
            eq(maintenanceProjects.buildingId, buildingId),
            inArray(maintenanceProjects.id, projectIds)
          )
        );
    }

    debugLog('Maintenance projects fetched for forecast', {
      buildingId,
      projectIdsFilter: projectIds,
      count: includedProjects.length,
      projects: includedProjects
    });

    // Calculate time window for forecast based on user selection.
    // The window only controls what we SLICE and return — we always compute
    // the full forecast from the anchor through 25 years past today so that
    // every month's balance includes all prior projects, unique bills and
    // recurring expenses, regardless of where the window starts.
    const effectiveViewType = viewType || 'year';
    const effectivePeriodLength = periodLength || 25; // Default to 25 years
    let effectiveStartYear = startYear || latestYear;
    let effectiveStartMonth = startMonth || 1; // Default to January

    // Establish the chart's effective start anchor:
    // - If bankAccountStartDate is set on the building, use it (year/month/day)
    // - Otherwise, anchor to today (current year/month/day)
    // The chart cannot show any period before this anchor.
    const todayForAnchor = new Date();
    const bankStartDateObj = building.bankAccountStartDate
      ? new Date(building.bankAccountStartDate)
      : null;
    const anchorYear = bankStartDateObj
      ? bankStartDateObj.getFullYear()
      : todayForAnchor.getFullYear();
    const anchorMonth = bankStartDateObj
      ? bankStartDateObj.getMonth() + 1
      : todayForAnchor.getMonth() + 1;
    const anchorDay = bankStartDateObj
      ? bankStartDateObj.getDate()
      : todayForAnchor.getDate();

    // Snap requested start to anchor if user requested a period earlier than anchor
    const requestedStartIndex = effectiveStartYear * 12 + (effectiveStartMonth - 1);
    const anchorIndex = anchorYear * 12 + (anchorMonth - 1);
    if (requestedStartIndex < anchorIndex) {
      effectiveStartYear = anchorYear;
      effectiveStartMonth = anchorMonth;
    }

    // Window length the user requested — used only to slice the full forecast.
    const windowMonthsRequested = effectiveViewType === 'year'
      ? effectivePeriodLength * 12
      : effectivePeriodLength;

    // Full forecast horizon: from anchor through 25 years past today (inclusive).
    // This guarantees the displayed window is always a slice of one consistent
    // running-balance computation that started at the anchor.
    const fullEndYear = todayForAnchor.getFullYear() + 25;
    const fullEndMonth = todayForAnchor.getMonth() + 1; // 1-12
    const fullEndIndex = fullEndYear * 12 + (fullEndMonth - 1);
    const totalMonthsForFullForecast = Math.max(
      // Always include at least the requested window past the anchor, even if
      // the anchor itself is in the future relative to today.
      windowMonthsRequested,
      fullEndIndex - anchorIndex + 1
    );

    // Date range covering the entire full forecast (used for batched queries).
    const forecastStartDate = new Date(anchorYear, anchorMonth - 1, 1);
    const forecastEndDate = new Date(
      anchorYear,
      anchorMonth - 1 + totalMonthsForFullForecast,
      0
    );

    // Payments query covers the entire forecast horizon.
    const paymentsQueryStartDate = forecastStartDate.toISOString().split('T')[0];
    
    // OPTIMIZATION: Batch fetch ALL bill payments for the entire period (including carry-forward)
    // This includes: unique bills AND recurrent bills with custom payment plans
    // This replaces individual queries with a single batched query
    const allUniqueBillsPayments = await db
      .select({
        amount: payments.amount,
        scheduledDate: payments.scheduledDate,
        status: payments.status,
        billId: payments.billId,
        billType: bills.billType,
        paymentType: bills.paymentType,
        schedulePayment: bills.schedulePayment,
        paymentStructure: bills.paymentStructure,
      })
      .from(payments)
      .innerJoin(bills, eq(payments.billId, bills.id))
      .where(
        and(
          eq(bills.buildingId, buildingId),
          // Include payments from:
          // 1. Unique bills (as before)
          // 2. Recurrent bills with custom payment schedules (installments)
          or(
            // Unique bills
            eq(bills.billType, 'unique'),
            and(isNull(bills.billType), eq(bills.paymentType, 'unique')),
            // Recurrent bills with custom payment plans (schedule_payment = 'custom' OR payment_structure = 'installment')
            eq(bills.schedulePayment, 'custom'),
            eq(bills.paymentStructure, 'installment')
          ),
          // Include pending and paid payments (sent/overdue are bill statuses, not payment statuses)
          inArray(payments.status, ['pending', 'paid']),
          // Filter payments for entire period (carry-forward + forecast)
          gte(payments.scheduledDate, paymentsQueryStartDate),
          lte(payments.scheduledDate, forecastEndDate.toISOString().split('T')[0])
        )
      );
    
    debugLog('Batched bill payments query (unique + custom installment)', {
      buildingId,
      forecastStart: forecastStartDate.toISOString().split('T')[0],
      forecastEnd: forecastEndDate.toISOString().split('T')[0],
      totalMonthsForFullForecast,
      paymentsFound: allUniqueBillsPayments.length,
      paymentStatuses: ['pending', 'paid'],
      billTypeCheck: 'unique bills OR custom payment/installment bills',
      payments: allUniqueBillsPayments.map(p => ({
        amount: p.amount,
        scheduledDate: p.scheduledDate,
        status: p.status,
        billType: p.billType,
        paymentType: p.paymentType,
        schedulePayment: p.schedulePayment,
        paymentStructure: p.paymentStructure,
      })),
      note: 'Includes unique bills and recurrent bills with custom installment plans'
    });
      
    debugLog('Time window calculation for forecast', {
      buildingId,
      userSelection: { viewType, periodLength, startMonth, startYear },
      effective: { effectiveViewType, effectivePeriodLength, effectiveStartYear, effectiveStartMonth },
      totalMonthsForFullForecast,
      note: 'Computing full forecast from anchor; window is sliced from result before returning'
    });

    // Always compute the full forecast from the anchor month forward, then
    // slice the requested window before returning. This way the running
    // balance for any month is always identical regardless of which window
    // the user picked — no separate carry-forward step needed.
    const forecastData = [];
    let currentBalance = startAmount;
    const anchorMonthIndex = anchorMonth - 1; // 0-based

    console.log(`\n🔧 [CAPITAL INVESTMENT MODE] = "${capitalInvestmentMode}" | Minimum Fund = $${minimumFund} | Start Balance = $${Math.round(currentBalance * 100) / 100}\n`);

    for (let monthIndex = 0; monthIndex < totalMonthsForFullForecast; monthIndex++) {
      // Calculate actual year and month from the anchor (not the window start)
      const totalMonthsFromStart = anchorMonthIndex + monthIndex;
      const currentYear = anchorYear + Math.floor(totalMonthsFromStart / 12);
      const currentMonth = (totalMonthsFromStart % 12) + 1;
      const currentDate = new Date(currentYear, currentMonth - 1, 1);
      
      // Apply inflation separately for monthly fees and other income, respecting financial year start date
      const financialYearStartDate = safeConvertFinancialYearStart(building.financialYearStart);
      const shouldInflate = shouldApplyInflation(currentDate, financialYearStartDate);
      
      // Calculate years elapsed based on financial year boundaries (not continuous months)
      let yearsElapsed = 0;
      if (shouldInflate && financialYearStartDate) {
        // Get financial year start month for boundary calculations
        const fyStartMonth = financialYearStartDate.getMonth() + 1; // Convert to 1-12
        
        // FIX: Use financial year start date as anchor for CONSISTENT inflation across all views
        // Previously used forecast start date which caused different inflation for same calendar month
        // depending on which page was viewing (overview vs budget)
        const anchorDate = new Date(financialYearStartDate.getFullYear(), fyStartMonth - 1, 1);
        
        // Calculate financial years elapsed from the FIRST financial year start to current date
        // This ensures the same calendar month shows the same inflation regardless of forecast start
        yearsElapsed = getFinancialYearsElapsed(currentDate, anchorDate, fyStartMonth);
      } else {
        // Fallback to forecast-based calculation if no financial year start date
        yearsElapsed = Math.floor(monthIndex / 12);
      }
      
      // Debug logging for revenue inflation (first few months and financial year boundaries)
      if (monthIndex < 3 || (monthIndex < 60 && monthIndex % 12 === 0)) {
        debugLog('Revenue inflation debug', {
          monthIndex,
          currentDate: currentDate.toISOString().slice(0, 7),
          shouldInflate,
          yearsElapsed,
          revenueInflationRate: Math.round(revenueInflation * 100 * 100) / 100, // Show as percentage with 2 decimals
          monthlyFeesRevenue: Math.round(monthlyFeesRevenue * 100) / 100,
          otherMonthlyIncome: Math.round(otherMonthlyIncome * 100) / 100,
        });
      }
      
      let inflatedMonthlyFees = monthlyFeesRevenue;
      let inflatedOtherIncome = otherMonthlyIncome;
      
      if (shouldInflate) {
        // UNIFIED REVENUE INFLATION: Apply the same revenue inflation rate to ALL revenue sources
        // This ensures consistent 4.8% (or whatever the user sets) across residence fees AND custom revenue
        
        // Handle punctual revenue growth entries
        const punctualGrowthEntries = extendedConfig.punctualRevenueGrowth || [];
        
        // Calculate cumulative punctual growth up to current year
        let cumulativePunctualGrowth = 1.0;
        const yearsWithInflationIncludedSet = new Set<number>();
        
        for (const entry of punctualGrowthEntries) {
          const growthYear = entry.year;
          const growthMonth = entry.month || 1;
          const entryApplies = growthYear < currentYear || (growthYear === currentYear && growthMonth <= currentMonth);
          if (entryApplies) {
            const growthRate = parseFloat(String(entry.percentage)) / 100;
            cumulativePunctualGrowth *= (1 + growthRate);
            
            // Track unique years where inflation is included in the punctual growth
            // Using Set ensures each year is only counted once even if multiple entries exist
            if (entry.inflationIncluded) {
              yearsWithInflationIncludedSet.add(growthYear);
            }
          }
        }
        
        // Calculate effective years for regular inflation (exclude years with inflation included in punctual growth)
        let effectiveYearsElapsed = yearsElapsed;
        if (yearsWithInflationIncludedSet.size > 0) {
          // Reduce years elapsed by the number of UNIQUE years where inflation was included in punctual growth
          effectiveYearsElapsed = Math.max(0, yearsElapsed - yearsWithInflationIncludedSet.size);
        }
        
        // Apply revenue inflation to monthly fees (residence fees)
        inflatedMonthlyFees = applyInflation(monthlyFeesRevenue, revenueInflation, effectiveYearsElapsed);
        
        // Apply revenue inflation to other income sources (custom revenue)
        inflatedOtherIncome = applyInflation(otherMonthlyIncome, revenueInflation, effectiveYearsElapsed);
        
        // Apply cumulative punctual growth
        inflatedMonthlyFees = inflatedMonthlyFees * cumulativePunctualGrowth;
        inflatedOtherIncome = inflatedOtherIncome * cumulativePunctualGrowth;
        
        // Debug logging for applied inflation (first few months and financial year boundaries)
        if (monthIndex < 3 || (monthIndex < 60 && monthIndex % 12 === 0)) {
          debugLog('Applied revenue inflation', {
            monthIndex,
            baseValues: {
              monthlyFeesRevenue: Math.round(monthlyFeesRevenue * 100) / 100,
              otherMonthlyIncome: Math.round(otherMonthlyIncome * 100) / 100,
            },
            inflatedValues: {
              inflatedMonthlyFees: Math.round(inflatedMonthlyFees * 100) / 100,
              inflatedOtherIncome: Math.round(inflatedOtherIncome * 100) / 100,
            },
            rates: {
              unifiedRevenueInflation: Math.round(revenueInflation * 100 * 100) / 100, // Same rate for all revenue
              appliedToResidenceFees: Math.round(revenueInflation * 100 * 100) / 100,
              appliedToCustomRevenue: Math.round(revenueInflation * 100 * 100) / 100,
            },
            inflationMultiplier: Math.round(Math.pow(1 + revenueInflation, yearsElapsed) * 1000) / 1000,
          });
        }
      }
      
      // Total inflated income
      const inflatedIncome = inflatedMonthlyFees + inflatedOtherIncome;
      
      // Calculate expenses from actual recurrent bill schedules for this specific month
      let monthlyRecurringExpenses = 0;
      const appliedBillsThisMonth = [];
      
      recurrentBills.forEach((bill) => {
        // Skip recurrent bills with installment payment structure - these are handled via payments table
        // This prevents double-counting for bills that have custom installment plans
        if (bill.paymentStructure === 'installment') {
          return; // Skip - payments table will handle this bill
        }
        
        const billStartDate = new Date(bill.startDate);
        const billEndDate = bill.endDate ? new Date(bill.endDate) : null;
        
        // Check if bill is active during this forecast month
        // Compare by year/month to handle bills starting mid-month (e.g., Oct 2nd should count for Oct)
        const billStartYearMonth = billStartDate.getFullYear() * 12 + billStartDate.getMonth();
        const billEndYearMonth = billEndDate ? billEndDate.getFullYear() * 12 + billEndDate.getMonth() : null;
        const currentYearMonth = currentYear * 12 + (currentMonth - 1);
        
        if (currentYearMonth >= billStartYearMonth && (!billEndYearMonth || currentYearMonth <= billEndYearMonth)) {
          const totalBillCost = bill.costs ? bill.costs.reduce((sum, cost) => sum + parseFloat(cost), 0) : 0;
          
          // Calculate if payment is due this month based on schedule
          let isPaymentDue = false;
          
          // For recurrent bills with single payment and yearInterval but no schedulePayment, treat as yearly
          const effectiveSchedule = bill.schedulePayment || (bill.yearInterval ? 'yearly' : 'monthly');
          
          switch (effectiveSchedule) {
            case 'monthly':
              isPaymentDue = true; // Every month
              break;
            case 'quarterly':
              // Every 3 months from start date
              const monthsSinceStart = (currentYear - billStartDate.getFullYear()) * 12 + (currentMonth - 1 - billStartDate.getMonth());
              isPaymentDue = monthsSinceStart >= 0 && monthsSinceStart % 3 === 0;
              break;
            case 'yearly':
              // Only due in the same month as start date, respecting yearInterval
              const billStartMonth = billStartDate.getMonth() + 1; // 1-12
              const yearsSinceStart = currentYear - billStartDate.getFullYear();
              const yearInterval = bill.yearInterval || 1;
              isPaymentDue = currentMonth === billStartMonth && 
                             yearsSinceStart >= 0 && 
                             yearsSinceStart % yearInterval === 0;
              break;
            case 'weekly':
              // Approximate weekly as 4.33 times per month
              isPaymentDue = true;
              monthlyRecurringExpenses += totalBillCost * 4.33; // 52 weeks / 12 months
              break;
            case 'custom':
              // NOTE: If we reach here, the bill is 'custom' schedule but NOT 'installment' payment structure
              // This handles legacy custom schedules that don't use the payments table
              // Check if any custom schedule dates match this month
              if (bill.scheduleCustom && bill.scheduleCustom.length > 0) {
                bill.scheduleCustom.forEach((customDate, idx) => {
                  const paymentDate = new Date(customDate);
                  if (paymentDate.getFullYear() === currentYear && 
                      paymentDate.getMonth() + 1 === currentMonth) {
                    // Use corresponding cost from costs array, or divide total evenly
                    const paymentAmount = bill.costs && bill.costs[idx] 
                      ? parseFloat(bill.costs[idx]) 
                      : totalBillCost / bill.scheduleCustom.length;
                    monthlyRecurringExpenses += paymentAmount;
                    appliedBillsThisMonth.push({
                      category: bill.category,
                      schedule: effectiveSchedule,
                      cost: paymentAmount,
                      startDate: bill.startDate
                    });
                  }
                });
              }
              break;
            default:
              // Assume monthly if schedule is unclear
              isPaymentDue = true;
              break;
          }
          
          // Add payment for non-custom, non-weekly schedules when payment is due
          if (isPaymentDue && effectiveSchedule !== 'weekly' && effectiveSchedule !== 'custom') {
            // Show full amount in the payment month (not spread across months for yearly bills)
            // Custom schedule already added payment amounts directly
            monthlyRecurringExpenses += totalBillCost;
            appliedBillsThisMonth.push({
              category: bill.category,
              schedule: effectiveSchedule,
              cost: totalBillCost,
              startDate: bill.startDate
            });
          }
        }
      });
      
      // Apply inflation to recurring expenses
      const inflatedRecurringExpenses = monthlyRecurringExpenses * Math.pow(1 + generalInflation, yearsElapsed);

      // Calculate unique bills for this month
      let monthlyUniqueBillsPayments = 0;
      
      // Helper to safely parse JSON arrays (Drizzle may return as string or array)
      const safeParseArray = (value: unknown): unknown[] => {
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        }
        return [];
      };
      
      // Helper to check if a bill has custom installment payments
      // These bills should use the payments table instead of startDate/totalAmount
      const hasCustomInstallments = (bill: typeof uniqueBills[0]): boolean => {
        // Check for custom schedule - this is the primary indicator
        if (bill.schedulePayment === 'custom') return true;
        // Check for installment payment structure - ANY installment bill uses payments table
        if (bill.paymentStructure === 'installment') {
          return true;
        }
        // Also check for custom dates even if paymentStructure isn't set
        const scheduleCustom = safeParseArray(bill.scheduleCustom);
        if (scheduleCustom.length > 0) {
          return true;
        }
        return false;
      };
      
      // Build a set of bill IDs that actually have payment entries in the payments table
      // This is the ground truth - if payments exist, use them
      const billIdsWithPayments = new Set<string>();
      allUniqueBillsPayments.forEach(payment => {
        billIdsWithPayments.add(payment.billId);
      });
      
      // Track which bills have custom installments so we can process them via payments table
      // A bill should use the payments table if:
      // 1. It matches the hasCustomInstallments() criteria, OR
      // 2. It actually HAS payments in the payments table (ground truth)
      const billsWithCustomInstallments = new Set<string>();
      uniqueBills.forEach((uniqueBill) => {
        // If this bill has actual payment entries, use them (highest priority)
        if (billIdsWithPayments.has(uniqueBill.id)) {
          billsWithCustomInstallments.add(uniqueBill.id);
        } else if (hasCustomInstallments(uniqueBill)) {
          // Fallback to detection logic (for debugging - bill should have payments but doesn't)
          billsWithCustomInstallments.add(uniqueBill.id);
          console.log(`⚠️ [FORECAST] Bill ${uniqueBill.id} detected as custom installment but has no payment entries`);
        }
      });
      
      // For SIMPLE unique bills (no custom installments), add amount on startDate
      // Bills with custom installments will be handled via the payments table below
      uniqueBills.forEach((uniqueBill) => {
        // Skip bills with custom installments - they use the payments table
        if (billsWithCustomInstallments.has(uniqueBill.id)) {
          return;
        }
        
        // Use UTC-safe date parsing to avoid timezone issues in production
        const billDateStr = typeof uniqueBill.startDate === 'string' 
          ? uniqueBill.startDate 
          : (uniqueBill.startDate as Date).toISOString().split('T')[0];
        const [billYear, billMonth] = billDateStr.split('-').map(Number);
        
        if (billYear === currentYear && billMonth === currentMonth) {
          const billAmount = parseFloat(uniqueBill.totalAmount || '0');
          if (Number.isFinite(billAmount)) {
            monthlyUniqueBillsPayments += billAmount;
          }
        }
      });
      
      // OPTIMIZATION: Filter batched unique bills payments for this month in-memory
      // This replaces the per-month database query with in-memory filtering
      const monthStartDate = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0];
      const monthEndDate = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];
      
      // FIX: Normalize scheduledDate to string before comparing (production compatibility)
      // In production with Neon, scheduledDate may be returned as a Date object
      const uniqueBillsPayments = allUniqueBillsPayments.filter(payment => {
        const scheduledDateStr = typeof payment.scheduledDate === 'string' 
          ? payment.scheduledDate 
          : (payment.scheduledDate as Date).toISOString().split('T')[0];
        return scheduledDateStr >= monthStartDate && scheduledDateStr <= monthEndDate;
      });
      
      // Add payments from payments table for bills WITH custom installments
      // These payments have the correct scheduledDate for each installment
      const paymentsAmount = uniqueBillsPayments.reduce((total, payment) => {
        // Only add if this payment is for a bill with custom installments
        // OR if no simple bill amount was added (fallback for legacy bills)
        if (billsWithCustomInstallments.has(payment.billId)) {
          return total + parseFloat(payment.amount);
        }
        return total;
      }, 0);
      
      // Add custom installment payments to the total
      monthlyUniqueBillsPayments += paymentsAmount;

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
      // This would query monthly_budgets table for income_types containing 'special_cotisations'
      // and sum those values for this specific month. Currently set to 0 as most buildings
      // don't use special income categories in their forecasts.
      let specialIncomes = 0;

      // Calculate planned investments (user-created) for this month
      let userCapitalInvestmentAmount = 0;
      let projectCostsAmount = 0;
      const currentMonthDate = new Date(currentYear, currentMonth - 1, 1);
      
      // Find any user-created capital investments due this month
      userCapitalInvestments.forEach(investment => {
        const investmentDate = new Date(investment.targetDate);
        if (investmentDate.getFullYear() === currentYear && investmentDate.getMonth() === currentMonth - 1) {
          userCapitalInvestmentAmount += parseFloat(investment.amount);
        }
      });

      // Add maintenance project costs scheduled for this month
      includedProjects.forEach(project => {
        // Use plannedStartDate if available, otherwise fall back to financialYear
        if (project.plannedStartDate) {
          const projectStartDate = new Date(project.plannedStartDate);
          if (projectStartDate.getFullYear() === currentYear && projectStartDate.getMonth() === currentMonth - 1) {
            const projectCost = project.totalBudget || project.estimatedCost || 0;
            projectCostsAmount += parseFloat(String(projectCost));
          }
        } else if (project.financialYear) {
          // If project has financial year but no specific start date, apply in January of that year
          if (currentYear === project.financialYear && currentMonth === 1) {
            const projectCost = project.totalBudget || project.estimatedCost || 0;
            projectCostsAmount += parseFloat(String(projectCost));
          }
        }
      });

      const plannedInvestments = userCapitalInvestmentAmount + projectCostsAmount;

      // STEP 1: Track starting balance for this period (before any transactions)
      const periodStartingBalance = currentBalance;
      
      // Calculate total revenue and spending for this period
      const totalRevenue = inflatedIncome + specialIncomes;
      const totalSpending = inflatedRecurringExpenses + appliedUnplannedBills + monthlyUniqueBillsPayments + plannedInvestments;
      
      // Calculate balance after transactions but without auto-investment
      const balanceWithoutAutoInvestment = periodStartingBalance + totalRevenue - totalSpending;

      // Debug log for balance calculation, especially important for the first period
      if (monthIndex === 0) {
        debugLog('First period balance calculation', {
          monthIndex,
          period: `${currentYear}-${String(currentMonth).padStart(2, '0')}`,
          periodStartingBalance,
          totalRevenue,
          totalSpending,
          plannedInvestments,
          balanceWithoutAutoInvestment,
          note: 'Starting balance should remain unchanged from user configuration'
        });
        
        debugLog('First period spending breakdown', {
          inflatedRecurringExpenses: Math.round(inflatedRecurringExpenses * 100) / 100,
          appliedUnplannedBills: Math.round(appliedUnplannedBills * 100) / 100,
          monthlyUniqueBillsPayments: Math.round(monthlyUniqueBillsPayments * 100) / 100,
          appliedBillsThisMonth,
          rawMonthlyRecurringExpenses: Math.round(monthlyRecurringExpenses * 100) / 100,
          note: 'Breakdown of what contributes to total spending'
        });
      }

      // STEP 2: Calculate auto-generated investment based on balance without auto-investment  
      let autoGeneratedInvestment = 0;
      
      // Only generate auto-investments for future periods (not in the past)
      const now = new Date();
      const currentRealYear = now.getFullYear();
      const currentRealMonth = now.getMonth() + 1; // JavaScript months are 0-indexed
      const isPastPeriod = (currentYear < currentRealYear) || 
                           (currentYear === currentRealYear && currentMonth < currentRealMonth);
      
      // Apply capital investment strategy based on selected mode using balanceWithoutAutoInvestment
      // Only apply to future periods - scenarios shouldn't suggest investments in the past
      if (!isPastPeriod && capitalInvestmentMode === 'urgent') {
        // Urgent Capital Mode: Only inject capital when balance would go below $0 (emergency injection)
        const needsInvestment = balanceWithoutAutoInvestment < 0;
        if (needsInvestment) {
          // Calculate required capital investment to bring balance back to 0
          autoGeneratedInvestment = Math.abs(balanceWithoutAutoInvestment);
          
          // Round capital investment to nearest 100 for realistic injection amounts
          autoGeneratedInvestment = Math.ceil(autoGeneratedInvestment / 100) * 100;
          
          console.log(`🚨 [URGENT MODE] Period ${currentYear}-${String(currentMonth).padStart(2, '0')}: Balance $${balanceWithoutAutoInvestment.toFixed(2)} < $0 → Injecting $${autoGeneratedInvestment}`);
        } else if (monthIndex < 5 || balanceWithoutAutoInvestment < 10000) {
          console.log(`✅ [URGENT MODE] Period ${currentYear}-${String(currentMonth).padStart(2, '0')}: Balance $${balanceWithoutAutoInvestment.toFixed(2)} >= $0 → No injection needed`);
        }
      } else if (!isPastPeriod && capitalInvestmentMode === 'suggested') {
        // Suggested Capital Mode: Inject capital for minimum requirements AND special investments
        let suggestedInvestment = 0;
        
        // 1. First ensure minimum requirement is met (only if balance is below minimum)
        const minimumRequired = Math.max(0, minimumFund);
        const needsInvestment = balanceWithoutAutoInvestment < minimumRequired;
        if (needsInvestment) {
          suggestedInvestment = minimumRequired - balanceWithoutAutoInvestment;
          debugLog('Investment needed to reach minimum requirement', {
            balanceWithoutAutoInvestment,
            minimumRequired,
            suggestedInvestment
          });
        } else if (monthIndex < 5 || balanceWithoutAutoInvestment < minimumRequired + 5000) {
          console.log(`✅ [SUGGESTED MODE] Period ${currentYear}-${String(currentMonth).padStart(2, '0')}: Balance $${balanceWithoutAutoInvestment.toFixed(2)} >= $${minimumRequired} (min) → No injection needed`);
        }
        
        // Note: Additional investment logic for capital reserves removed
        // Only suggest investments when balance is below minimum requirement
        // User can manually add capital investments through the UI when needed
        
        if (suggestedInvestment > 0) {
          // Round to nearest 100 for realistic amounts
          autoGeneratedInvestment = Math.ceil(suggestedInvestment / 100) * 100;
          console.log(`💡 [SUGGESTED MODE] Period ${currentYear}-${String(currentMonth).padStart(2, '0')}: Balance $${balanceWithoutAutoInvestment.toFixed(2)} < $${minimumRequired} (min) → Injecting $${autoGeneratedInvestment}`);
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
      // For the first month, also check if we started with negative balance
      if (monthIndex === 0 && periodStartingBalance < 0) {
        status = 'red';
      }
      // Check for negative balance (red status)
      else if (finalBalance < 0) {
        status = 'red';
      }
      // Then check if below minimum fund (yellow status)
      else if (Number.isFinite(minimumFund) && finalBalance < minimumFund) {
        status = 'yellow';
      }

      // Add to forecast data
      forecastData.push({
        year: currentYear,
        month: currentMonth,
        period: `${currentYear}-${String(currentMonth).padStart(2, '0')}`, // Frontend expects this format
        revenue: Math.round(totalRevenue * 100) / 100,
        spending: Math.round(totalSpending * 100) / 100,
        netCashFlow: Math.round((totalRevenue - totalSpending) * 100) / 100, // Net cash flow for the period
        plannedInvestments: Math.round(plannedInvestments * 100) / 100, // User-created investments
        capitalInvestment: Math.round((autoGeneratedInvestment + plannedInvestments) * 100) / 100, // Auto-generated + planned investments
        autoGeneratedInvestment: Math.round(autoGeneratedInvestment * 100) / 100, // Frontend expects this field name
        balance: Math.round(finalBalance * 100) / 100, // End of period balance
        balanceWithoutAutoInvestment: Math.round(balanceWithoutAutoInvestment * 100) / 100, // For debugging
        balanceBeforeScenario: Math.round(balanceWithoutAutoInvestment * 100) / 100, // Frontend expects this field name
        startingBalance: Math.round(periodStartingBalance * 100) / 100, // Balance at start of period
        status,
        inflatedIncome: Math.round(inflatedIncome * 100) / 100,
        inflatedExpenses: Math.round(inflatedRecurringExpenses * 100) / 100, // Alias for backward compatibility
        inflatedRecurringExpenses: Math.round(inflatedRecurringExpenses * 100) / 100,
        appliedUnplannedBills: Math.round(appliedUnplannedBills * 100) / 100,
        monthlyUniqueBillsPayments: Math.round(monthlyUniqueBillsPayments * 100) / 100,
        uniqueBillsAmount: monthlyUniqueBillsPayments > 0 ? Math.round(monthlyUniqueBillsPayments * 100) / 100 : undefined, // Flag unique bills for frontend visualization
        projectCosts: Math.round(projectCostsAmount * 100) / 100,
      });
    }

    // Slice the full forecast down to the requested window. Because the full
    // forecast was computed from the anchor with a single running balance,
    // the same calendar month produces the same balance regardless of the
    // window the user selects.
    const sliceStartIndex = Math.max(
      0,
      (effectiveStartYear * 12 + (effectiveStartMonth - 1)) - anchorIndex
    );
    const sliceEndIndex = Math.min(
      forecastData.length,
      sliceStartIndex + windowMonthsRequested
    );
    const windowForecast = forecastData.slice(sliceStartIndex, sliceEndIndex);

    res.json({
      buildingId,
      buildingName: building.name,
      forecastPeriod: '25 years',
      // Clearly separate starting balance from minimum requirement
      startingBalance: startAmount,
      // Effective start anchor for the chart (consumed by frontend selectors)
      // - If bankAccountStartDate is set, anchor is that date with bankAccountStartAmount
      // - Otherwise, anchor is Jan 1 of the current calendar year with $0
      // Period selectors must not allow selecting before this anchor
      effectiveStartYear: anchorYear,
      effectiveStartMonth: anchorMonth,
      effectiveStartDay: anchorDay,
      effectiveStartDate: `${anchorYear}-${String(anchorMonth).padStart(2, '0')}-${String(anchorDay).padStart(2, '0')}`,
      effectiveStartingBalance: startAmount,
      hasBankAccountStartDate: !!bankStartDateObj,
      minimumRequirement: minimumRequirement,
      minimumFund, // Keep for backward compatibility
      // CORRECTED: Return the original percentage values (not converted decimals)
      generalInflationRate: rawGeneralInflationRate, // Return as percentage (e.g., 3.5)
      revenueGrowthRate: requestRevenueInflationRate, // Return as percentage (e.g., 2.8)
      revenueInflationRate: requestRevenueInflationRate, // Keep for backward compatibility
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
      forecast: windowForecast,
    });

  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ _error: 'Invalid input data', details: error.errors });
    }
    
    // Enhanced error logging with stack trace for production debugging
    console.error('❌ Error generating budget forecast for building:', req.params.buildingId);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    res.status(500).json({ 
      _error: 'Internal server error',
      message: 'Failed to generate budget forecast',
      // Include error details in development mode for debugging
      ...(isDev && { 
        errorName: error.name,
        errorMessage: error.message,
        buildingId: req.params.buildingId
      })
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
          type: 'custom', // Ensure type is set for custom investments
        });
        // Convert fields to proper database types - explicitly construct to satisfy TypeScript
        return {
          type: 'custom' as const,
          buildingId: validated.buildingId,
          title: validated.title,
          urgency: validated.urgency,
          ownershipType: validated.ownershipType,
          amount: validated.amount.toString(),
          targetDate: validated.targetDate.toISOString().split('T')[0],
          description: validated.description,
          category: validated.category,
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
