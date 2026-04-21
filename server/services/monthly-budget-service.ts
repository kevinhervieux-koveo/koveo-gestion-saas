import { db } from '../db';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import type { InsertMonthlyBudget, Building } from '@shared/schema';
import * as schema from '@shared/schema';

const { monthlyBudgets, buildings, users } = schema;

/**
 * Service for populating and managing monthly budget entries.
 * Creates budget entries for each building from construction date to 3 years in the future.
 * Populates with aggregated income and expense data from money_flow table.
 */
export class MonthlyBudgetService {
  private readonly YEARS_TO_PROJECT = 3;

  /**
   * Populate monthly budget entries for all buildings.
   * Creates entries from construction date to 3 years in the future.
   */
  async populateAllMonthlyBudgets(): Promise<{
    budgetsCreated: number;
    buildingsProcessed: number;
  }> {

    let budgetsCreated = 0;
    let buildingsProcessed = 0;

    try {
      const activeBuildings = await db.select().from(buildings).where(eq(buildings.isActive, true));

      const batchSize = 3;
      for (let i = 0; i < activeBuildings.length; i += batchSize) {
        const batch = activeBuildings.slice(i, i + batchSize);
        
        const batchResults = await Promise.allSettled(
          batch.map(async (building) => {
            const buildingBudgets = await this.populateBudgetsForBuilding(building);
            return { buildingBudgets, buildingName: building.name };
          })
        );
        
        // Aggregate results from successful operations
        batchResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            budgetsCreated += result.value.buildingBudgets;
            buildingsProcessed++;
          }
        });
      }


      return {
        budgetsCreated,
        buildingsProcessed,
      };
    } catch (error) {
      console.error('Failed to populate monthly budgets:', error);
      throw error;
    }
  }

  /**
   * Populate monthly budget entries for a specific building.
   * @param building
   */
  async populateBudgetsForBuilding(building: Building): Promise<number> {
    // Calculate date range
    let constructionDate: Date;
    if (building.constructionDate) {
      constructionDate = new Date(building.constructionDate);
    } else {
      // If no construction date, start from current year
      constructionDate = new Date();
      constructionDate.setFullYear(constructionDate.getFullYear(), 0, 1);
    }

    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + this.YEARS_TO_PROJECT, 11, 31); // December 31st, 25 years from now


    // Get distinct income and expense categories for this building
    const { incomeCategories, expenseCategories } = await this.getCategoriesForBuilding(
      building.id
    );


    // Remove existing budget entries for this building to avoid duplicates
    await this.cleanupExistingBudgets(building.id);

    // Generate monthly entries
    const budgetEntries: InsertMonthlyBudget[] = [];
    const systemUser = await this.getSystemUser();

    const currentDate = new Date(constructionDate);

    // OPTIMIZATION: Generate budget entries more efficiently
    const monthsToGenerate = this.calculateMonthsInRange(constructionDate, endDate);
    const maxMonths = Math.min(monthsToGenerate.length, 5000); // Safety limit
    
    // Pre-generate base budget entry template to avoid object recreation
    const baseBudgetEntry = {
      buildingId: building.id,
      incomeTypes: incomeCategories,
      spendingTypes: expenseCategories,
      approved: false,
      approvedBy: undefined,
      originalBudgetId: undefined,
    };

    // Generate all budget entries in batches to reduce memory pressure
    for (let i = 0; i < maxMonths; i++) {
      const { year, month } = monthsToGenerate[i];
      
      // Get aggregated amounts for this month/year
      const { incomes, spendings } = await this.getAggregatedAmountsForMonth(
        building.id,
        year,
        month,
        incomeCategories,
        expenseCategories
      );

      budgetEntries.push({
        ...baseBudgetEntry,
        year,
        month,
        incomes,
        spendings,
      });
    }

    // Insert entries in batches
    if (budgetEntries.length > 0) {
      await this.insertBudgetEntriesInBatches(budgetEntries);
    }

    return budgetEntries.length;
  }

  /**
   * Get distinct income and expense categories for a specific building.
   * Since moneyFlow table was deleted, we use default categories.
   * @param buildingId
   */
  private async getCategoriesForBuilding(buildingId: string): Promise<{
    incomeCategories: string[];
    expenseCategories: string[];
  }> {
    // Since moneyFlow table no longer exists, we use default categories
    // In the future, this could be enhanced to derive categories from bills or other sources
    const incomeCategories: string[] = [];
    const expenseCategories: string[] = [];

    // If no categories exist, provide defaults based on the enum definitions
    const defaultIncomeCategories = [
      'monthly_fees',
      'special_assessment',
      'late_fees',
      'parking_fees',
      'utility_reimbursement',
      'insurance_claim',
      'other_income',
    ];

    const defaultExpenseCategories = [
      'bill_payment',
      'maintenance_expense',
      'administrative_expense',
      'professional_services',
      'other_expense',
    ];

    return {
      incomeCategories: incomeCategories.length > 0 ? incomeCategories : defaultIncomeCategories,
      expenseCategories:
        expenseCategories.length > 0 ? expenseCategories : defaultExpenseCategories,
    };
  }

  /**
   * Get aggregated income and expense amounts for a specific month/year.
   * Since moneyFlow table was deleted, this returns zero values.
   * 
   * NOTE: The moneyFlow table was removed during a data model refactoring. Budget data population
   * now returns zero values as a placeholder. To restore budget data aggregation, consider:
   * 
   * OPTION 1 - Bills/Payments Integration:
   *   - Query bills table for expenses by category and date range
   *   - Query payments/transactions table for actual income/expense flows
   *   - Aggregate by month and category to populate budget entries
   * 
   * OPTION 2 - Manual Budget Entry:
   *   - Remove automatic population entirely
   *   - Let managers manually enter budget projections through the UI
   *   - Use historical data as suggestions rather than auto-population
   * 
   * OPTION 3 - Historical Analysis:
   *   - Restore moneyFlow table or equivalent transaction log
   *   - Implement comprehensive financial tracking system
   *   - Use machine learning for budget forecasting based on historical patterns
   * 
   * Current implementation maintains the data structure for future integration while avoiding
   * database errors. Budget entries are created with zero values that can be manually updated.
   * 
   * @param buildingId
   * @param year
   * @param month
   * @param incomeCategories
   * @param expenseCategories
   */
  private async getAggregatedAmountsForMonth(
    buildingId: string,
    year: number,
    month: number,
    incomeCategories: string[],
    expenseCategories: string[]
  ): Promise<{
    incomes: number[];
    spendings: number[];
  }> {
    // Since moneyFlow table no longer exists, return zero arrays
    // This maintains the expected structure while avoiding database errors
    const incomes: number[] = incomeCategories.map(() => 0);
    const spendings: number[] = expenseCategories.map(() => 0);

    return { incomes, spendings };
  }

  /**
   * Clean up existing budget entries for a building to avoid duplicates.
   * @param buildingId
   */
  private async cleanupExistingBudgets(buildingId: string): Promise<void> {
    await db.delete(monthlyBudgets).where(eq(monthlyBudgets.buildingId, buildingId));

  }

  /**
   * Insert budget entries in batches to avoid database constraints.
   * @param entries
   * @param batchSize
   */
  private async insertBudgetEntriesInBatches(
    entries: InsertMonthlyBudget[],
    batchSize = 100
  ): Promise<void> {
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      try {
        await db.insert(monthlyBudgets).values(batch);
      } catch (error: any) {
        console.error(`❌ Error inserting batch at index ${i}:`, error);
        // Try individual inserts for the failed batch
        for (const entry of batch) {
          try {
            await db.insert(monthlyBudgets).values(entry);
          } catch (individualError: any) {
            console.error(`❌ Error inserting individual budget entry:`, individualError);
            // Skip this entry and continue
          }
        }
      }
    }
  }

  /**
   * Get or create a system user for automated entries.
   */
  private async getSystemUser(): Promise<{ id: string }> {
    // Try to find an existing system user
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, 'system@koveo-gestion.com'))
      .limit(1);

    if (existingUser.length > 0) {
      return existingUser[0];
    }

    // If no system user exists, use the first admin user
    const adminUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'admin'))
      .limit(1);

    if (adminUser.length > 0) {
      return adminUser[0];
    }

    // Fallback: use any active user
    const anyUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.isActive, true))
      .limit(1);

    if (anyUser.length > 0) {
      return anyUser[0];
    }

    throw new Error('No active users found for system operations');
  }

  /**
   * OPTIMIZATION: Helper function to calculate months in date range more efficiently
   */
  private calculateMonthsInRange(startDate: Date, endDate: Date): Array<{ year: number; month: number }> {
    const months: Array<{ year: number; month: number }> = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate && months.length < 5000) {
      months.push({
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1
      });
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    return months;
  }

  /**
   * Repopulate budgets for a specific building (useful when money flow data changes).
   * @param buildingId
   */
  async repopulateBudgetsForBuilding(buildingId: string): Promise<number> {

    const building = await db.select().from(buildings).where(eq(buildings.id, buildingId)).limit(1);

    if (building.length === 0) {
      throw new Error(`Building ${buildingId} not found`);
    }

    const budgetsCreated = await this.populateBudgetsForBuilding(building[0]);

    return budgetsCreated;
  }

  /**
   * Get budget statistics.
   */
  async getBudgetStatistics(): Promise<{
    totalBudgetEntries: number;
    buildingsWithBudgets: number;
    oldestBudgetDate: string | null;
    newestBudgetDate: string | null;
  }> {
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(monthlyBudgets);

    const [buildingsResult] = await db
      .select({ count: sql<number>`count(DISTINCT ${monthlyBudgets.buildingId})::int` })
      .from(monthlyBudgets);

    const [oldestResult] = await db
      .select({
        year: monthlyBudgets.year,
        month: monthlyBudgets.month,
      })
      .from(monthlyBudgets)
      .orderBy(monthlyBudgets.year, monthlyBudgets.month)
      .limit(1);

    const [newestResult] = await db
      .select({
        year: monthlyBudgets.year,
        month: monthlyBudgets.month,
      })
      .from(monthlyBudgets)
      .orderBy(sql`${monthlyBudgets.year} DESC, ${monthlyBudgets.month} DESC`)
      .limit(1);

    const oldestDate = oldestResult
      ? `${oldestResult.year}-${String(oldestResult.month).padStart(2, '0')}`
      : null;
    const newestDate = newestResult
      ? `${newestResult.year}-${String(newestResult.month).padStart(2, '0')}`
      : null;

    return {
      totalBudgetEntries: totalResult.count,
      buildingsWithBudgets: buildingsResult.count,
      oldestBudgetDate: oldestDate,
      newestBudgetDate: newestDate,
    };
  }
}

// Export singleton instance
export const monthlyBudgetService = new MonthlyBudgetService();
