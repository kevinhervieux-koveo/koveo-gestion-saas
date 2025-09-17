import express from 'express';
import { z } from 'zod';
import { db } from '../db';
import { budgets, monthlyBudgets, buildings, bills } from '@shared/schema';
import { requireAuth } from '../auth';
import { and, eq, gte, lte, sql, desc, asc } from 'drizzle-orm';

const router = express.Router();

// Development debug logging
const isDev = process.env.NODE_ENV === 'development';
const debugLog = (endpoint: string, data: any) => {
  if (isDev) {
    console.log(`🏦 [BUDGET API DEBUG] ${endpoint}:`, JSON.stringify(data, null, 2));
  }
};

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
    const {
      bankAccountNumber,
      bankAccountNotes,
      bankAccountStartDate,
      bankAccountStartAmount,
      bankAccountMinimums,
      generalInflationRate,
      revenueInflationRate,
    } = req.body;

    // Validate building exists
    const building = await db.query.buildings.findFirst({
      where: eq(buildings.id, buildingId),
      columns: { id: true },
    });

    if (!building) {
      return res.status(404).json({ _error: 'Building not found' });
    }

    // Update building with bank account info and inflation rates
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
        bankAccountUpdatedAt: new Date(),
      })
      .where(eq(buildings.id, buildingId));

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
      },
    });

    if (!building) {
      return res.status(404).json({ _error: 'Building not found' });
    }

    res.json({
      bankAccountNumber: building.bankAccountNumber,
      bankAccountNotes: building.bankAccountNotes,
      bankAccountStartDate: building.bankAccountStartDate,
      bankAccountStartAmount: building.bankAccountStartAmount,
      bankAccountMinimums: building.bankAccountMinimums,
      generalInflationRate: building.generalInflationRate,
      revenueInflationRate: building.revenueInflationRate,
      bankAccountUpdatedAt: building.bankAccountUpdatedAt,
    });
  } catch (error: any) {
    console.error('❌ Error fetching bank account info:', error);
    res.status(500).json({ _error: 'Internal server error' });
  }
});

/**
 * POST /api/budgets/:buildingId/forecast - Generate 25-year budget forecast
 * Replaces sample data generation with actual financial forecasting logic
 */
router.post('/:buildingId/forecast', requireAuth, async (req, res) => {
  try {
    const { buildingId } = req.params;
    
    debugLog('POST /:buildingId/forecast - Request received', { 
      buildingId, 
      body: req.body,
      timestamp: new Date().toISOString() 
    });
    
    const {
      bankAccountStartAmount,
      bankAccountMinimums,
      generalInflationRate,
      revenueInflationRate,
    } = req.body;

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
      },
    });

    if (!building) {
      return res.status(404).json({ _error: 'Building not found' });
    }

    // Use request overrides or fallback to building defaults
    const startAmount = parseFloat(bankAccountStartAmount || building.bankAccountStartAmount || '0');
    const minimums = bankAccountMinimums || building.bankAccountMinimums || '0';
    const minimumFund = parseFloat(minimums);
    const generalInflation = parseFloat(generalInflationRate || building.generalInflationRate || '2.0') / 100;
    const revenueInflation = parseFloat(revenueInflationRate || building.revenueInflationRate || '2.0') / 100;

    // Fetch recurrent bills for ongoing monthly expenses
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
          eq(bills.paymentType, 'recurrent')
        )
      );

    // Fetch unique bills for one-time expenses, grouped by year
    const uniqueBills = await db
      .select({
        startDate: bills.startDate,
        totalAmount: bills.totalAmount,
        category: bills.category,
      })
      .from(bills)
      .where(
        and(
          eq(bills.buildingId, buildingId),
          eq(bills.paymentType, 'unique')
        )
      );

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

    // Initialize baseline monthly income (if no data, use default)
    let monthlyBaselineIncome = 50000; // Default fallback
    if (baselineIncome.length > 0 && baselineIncome[0].incomes) {
      monthlyBaselineIncome = baselineIncome[0].incomes
        .reduce((sum, income) => sum + parseFloat(income), 0);
    }

    // Group unique bills by year for unplanned spending calculation
    const uniqueBillsByYear: Record<number, number> = {};
    uniqueBills.forEach((bill) => {
      const year = new Date(bill.startDate).getFullYear();
      uniqueBillsByYear[year] = (uniqueBillsByYear[year] || 0) + parseFloat(bill.totalAmount);
    });

    // Calculate monthly recurring bill costs
    const monthlyRecurringCosts = recurrentBills.reduce((total, bill) => {
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

    // Generate 25-year forecast (300 months)
    const forecastData = [];
    let currentBalance = startAmount;
    const startYear = latestYear;

    for (let monthIndex = 0; monthIndex < 300; monthIndex++) {
      const currentYear = startYear + Math.floor(monthIndex / 12);
      const currentMonth = (monthIndex % 12) + 1;
      
      // Apply annual inflation for both revenue and expenses
      const yearsElapsed = Math.floor(monthIndex / 12);
      const inflatedIncome = monthlyBaselineIncome * Math.pow(1 + revenueInflation, yearsElapsed);
      const inflatedExpenses = monthlyRecurringCosts * Math.pow(1 + generalInflation, yearsElapsed);

      // Add unplanned spending from unique bills (distributed monthly for the year)
      const yearlyUnplannedSpending = uniqueBillsByYear[currentYear] || 0;
      const monthlyUnplannedSpending = yearlyUnplannedSpending / 12;

      // Special one-time incomes (special_cotisations) - could be added from monthly_budgets
      let specialIncomes = 0;
      // TODO: Implement special income logic from monthly_budgets if needed

      // Calculate monthly net cash flow
      const totalRevenue = inflatedIncome + specialIncomes;
      const totalSpending = inflatedExpenses + monthlyUnplannedSpending;
      const netCashFlow = totalRevenue - totalSpending;

      // Update bank balance
      currentBalance += netCashFlow;

      // Determine status based on balance
      let status = 'green';
      if (currentBalance < 0) {
        status = 'red';
      } else if (currentBalance < minimumFund) {
        status = 'yellow';
      }

      // Add to forecast data
      forecastData.push({
        year: currentYear,
        month: currentMonth,
        revenue: Math.round(totalRevenue * 100) / 100,
        spending: Math.round(totalSpending * 100) / 100,
        netCashFlow: Math.round(netCashFlow * 100) / 100,
        balance: Math.round(currentBalance * 100) / 100,
        status,
        inflatedIncome: Math.round(inflatedIncome * 100) / 100,
        inflatedExpenses: Math.round(inflatedExpenses * 100) / 100,
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
      uniqueBillsCount: uniqueBills.length,
      forecast: forecastData,
    });

  } catch (error: any) {
    console.error('❌ Error generating budget forecast:', error);
    res.status(500).json({ 
      _error: 'Internal server error',
      message: 'Failed to generate budget forecast'
    });
  }
});

export default router;
