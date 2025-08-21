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
    const { startYear, endYear, groupBy = 'monthly' } = req.query;
    
    const currentYear = new Date().getFullYear();
    const start = startYear ? parseInt(startYear as string) : currentYear - 3;
    const end = endYear ? parseInt(endYear as string) : currentYear + 25;

    // Validate building access
    const building = await db.query.buildings.findFirst({
      where: eq(buildings.id, buildingId),
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
      // Get monthly budget data
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
        .where(
          and(
            eq(monthlyBudgets.buildingId, buildingId),
            gte(monthlyBudgets.year, start),
            lte(monthlyBudgets.year, end)
          )
        )
        .orderBy(asc(monthlyBudgets.year), asc(monthlyBudgets.month));

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
    const { startYear, endYear } = req.query;
    
    const currentYear = new Date().getFullYear();
    const start = startYear ? parseInt(startYear as string) : currentYear - 3;
    const end = endYear ? parseInt(endYear as string) : currentYear + 25;

    // Calculate monthly totals
    const summaryData = await db
      .select({
        year: monthlyBudgets.year,
        month: monthlyBudgets.month,
        totalIncome: sql<string>`array_length(${monthlyBudgets.incomes}, 1)::integer * 
          (select avg(unnest) from unnest(${monthlyBudgets.incomes}))`,
        totalExpenses: sql<string>`array_length(${monthlyBudgets.spendings}, 1)::integer * 
          (select avg(unnest) from unnest(${monthlyBudgets.spendings}))`,
        incomeTypes: monthlyBudgets.incomeTypes,
        incomes: monthlyBudgets.incomes,
        spendingTypes: monthlyBudgets.spendingTypes,
        spendings: monthlyBudgets.spendings,
      })
      .from(monthlyBudgets)
      .where(
        and(
          eq(monthlyBudgets.buildingId, buildingId),
          gte(monthlyBudgets.year, start),
          lte(monthlyBudgets.year, end)
        )
      )
      .orderBy(asc(monthlyBudgets.year), asc(monthlyBudgets.month));

    return res.json({ summary: summaryData });
  } catch (error) {
    console.error('Error fetching budget summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update building bank account number with reconciliation note
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

    // Validate building exists
    const building = await db.query.buildings.findFirst({
      where: eq(buildings.id, buildingId),
      columns: { id: true },
    });

    if (!building) {
      return res.status(404).json({ error: 'Building not found' });
    }

    // TODO: Return actual bank account data when columns are added
    res.json({
      bankAccountNumber: null,
      bankAccountNotes: null,
      bankAccountUpdatedAt: null,
    });
  } catch (error) {
    console.error('Error fetching bank account info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;