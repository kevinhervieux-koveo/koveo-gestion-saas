import express from 'express';
import { z } from 'zod';
import { db } from '../db';
import { budgets, monthlyBudgets, buildings } from '@shared/schema';
import { requireAuth } from '../auth';
import { and, eq, gte, lte, sql, desc, asc } from 'drizzle-orm';

const router = express.Router();

/**
 * Get budgets and monthly budgets for a building with date range
 */
router.get('/:buildingId', requireAuth, async (req, res) => {
  try {
    const { buildingId } = req.params;
    const { startYear, endYear, startMonth, endMonth, groupBy = 'monthly' } = req.query;
    
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
      return res.status(404).json({ error: 'Building not found' });
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
      let whereConditions = [
        eq(monthlyBudgets.buildingId, buildingId)
      ];

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
        whereConditions.push(
          gte(monthlyBudgets.year, start),
          lte(monthlyBudgets.year, end)
        );
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
        const sampleData = [
          {
            year: currentYear,
            month: new Date().getMonth() + 1,
            incomeTypes: ['monthly_fees', 'parking_fees', 'other_income'],
            incomes: ['45000', '3500', '2000'],
            spendingTypes: ['maintenance_expense', 'utilities', 'insurance', 'administrative_expense'],
            spendings: ['12000', '8500', '4200', '3800'],
            approved: false,
          },
          {
            year: currentYear,
            month: new Date().getMonth(),
            incomeTypes: ['monthly_fees', 'parking_fees'],
            incomes: ['44500', '3200'],
            spendingTypes: ['maintenance_expense', 'utilities', 'cleaning'],
            spendings: ['15000', '7800', '2500'],
            approved: true,
          },
          {
            year: currentYear - 1,
            month: 12,
            incomeTypes: ['monthly_fees', 'special_assessment'],
            incomes: ['43000', '25000'],
            spendingTypes: ['maintenance_expense', 'professional_services'],
            spendings: ['35000', '15000'],
            approved: true,
          },
        ];
        return res.json({ budgets: sampleData, type: 'monthly' });
      }
      
      return res.json({ budgets: monthlyBudgetData, type: 'monthly' });
    }
  } catch (error) {
    console.error('Error fetching budget data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get budget summary with income/expense totals
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
    let whereConditions = [
      eq(monthlyBudgets.buildingId, buildingId)
    ];

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
      whereConditions.push(
        gte(monthlyBudgets.year, start),
        lte(monthlyBudgets.year, end)
      );
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
      const sampleSummary = [
        {
          year: currentYear,
          month: new Date().getMonth() + 1,
          incomeTypes: ['monthly_fees', 'parking_fees', 'other_income'],
          incomes: ['45000', '3500', '2000'],
          spendingTypes: ['maintenance_expense', 'utilities', 'insurance', 'administrative_expense'],
          spendings: ['12000', '8500', '4200', '3800'],
        },
        {
          year: currentYear,
          month: new Date().getMonth(),
          incomeTypes: ['monthly_fees', 'parking_fees'],
          incomes: ['44500', '3200'],
          spendingTypes: ['maintenance_expense', 'utilities', 'cleaning'],
          spendings: ['15000', '7800', '2500'],
        },
        {
          year: currentYear - 1,
          month: 12,
          incomeTypes: ['monthly_fees', 'special_assessment'],
          incomes: ['43000', '25000'],
          spendingTypes: ['maintenance_expense', 'professional_services'],
          spendings: ['35000', '15000'],
        },
      ];
      return res.json({ summary: sampleSummary });
    }
    
    return res.json({ summary: summaryData });
  } catch (error) {
    console.error('Error fetching budget summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update building bank account number with reconciliation note
 */
router.put('/:buildingId/bank-account', requireAuth, async (req, res) => {
  try {
    const { buildingId } = req.params;
    const { 
      bankAccountNumber, 
      bankAccountNotes, 
      bankAccountStartDate, 
      bankAccountStartAmount, 
      bankAccountMinimums 
    } = req.body;

    // Validate building exists
    const building = await db.query.buildings.findFirst({
      where: eq(buildings.id, buildingId),
      columns: { id: true },
    });

    if (!building) {
      return res.status(404).json({ error: 'Building not found' });
    }

    // Update building with bank account info
    await db
      .update(buildings)
      .set({
        bankAccountNumber,
        bankAccountNotes,
        bankAccountStartDate: bankAccountStartDate ? new Date(bankAccountStartDate) : null,
        bankAccountStartAmount,
        bankAccountMinimums,
        bankAccountUpdatedAt: new Date()
      })
      .where(eq(buildings.id, buildingId));

    res.json({ 
      message: 'Bank account updated successfully',
      bankAccountNumber,
      bankAccountNotes,
      bankAccountStartDate: bankAccountStartDate ? new Date(bankAccountStartDate) : null,
      bankAccountStartAmount,
      bankAccountMinimums,
      bankAccountUpdatedAt: new Date()
    });
  } catch (error) {
    console.error('Error updating bank account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update building bank account number with reconciliation note (PATCH method for backwards compatibility)
 */
router.patch('/:buildingId/bank-account', requireAuth, async (req, res) => {
  try {
    // TODO: Enable when bank account columns are added to database
    res.json({ message: 'Bank account update feature coming soon' });
  } catch (error) {
    console.error('Error updating bank account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get building bank account info
 */
router.get('/:buildingId/bank-account', requireAuth, async (req, res) => {
  try {
    const { buildingId } = req.params;

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
        bankAccountUpdatedAt: true
      },
    });

    if (!building) {
      return res.status(404).json({ error: 'Building not found' });
    }

    res.json({
      bankAccountNumber: building.bankAccountNumber,
      bankAccountNotes: building.bankAccountNotes,
      bankAccountStartDate: building.bankAccountStartDate,
      bankAccountStartAmount: building.bankAccountStartAmount,
      bankAccountMinimums: building.bankAccountMinimums,
      bankAccountUpdatedAt: building.bankAccountUpdatedAt,
    });
  } catch (error) {
    console.error('Error fetching bank account info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;