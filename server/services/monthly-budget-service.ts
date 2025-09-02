import { db } from '../db';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import type { InsertMonthlyBudget, Building, MoneyFlow } from '@shared/schema';
import * as schema from '@shared/schema';

const { monthlyBudgets, moneyFlow, buildings, users } = schema;

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
      // Get all active buildings
      const activeBuildings = await db.select().from(buildings).where(eq(buildings.isActive, true));


      for (const building of activeBuildings) {
        try {
          const buildingBudgets = await this.populateBudgetsForBuilding(building);
          budgetsCreated += buildingBudgets;
          buildingsProcessed++;
            `✅ Created ${buildingBudgets} budget entries for building: ${building.name}`
          );
          // Continue with other buildings
        }
      }

        - Buildings processed: ${buildingsProcessed}
        - Budget entries created: ${budgetsCreated}`);

      return {
        budgetsCreated,
        buildingsProcessed,
      };
      throw error;
    }
  }

  /**
   * Populate monthly budget entries for a specific building.
   * @param building
   */
  async populateBudgetsForBuilding(building: Building): Promise<number> {
    // Calculate date range
    const constructionDate = new Date();
    if (building.yearBuilt) {
      constructionDate.setFullYear(building.yearBuilt, 0, 1); // January 1st of construction year
    } else {
      // If no construction year, start from current year
      constructionDate.setFullYear(constructionDate.getFullYear(), 0, 1);
    }

    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + this.YEARS_TO_PROJECT, 11, 31); // December 31st, 25 years from now

      `📅 Processing building ${building.name} from ${constructionDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}`
    );

    // Get distinct income and expense categories for this building
    const { incomeCategories, expenseCategories } = await this.getCategoriesForBuilding(
      building.id
    );

      `📊 Found ${incomeCategories.length} income categories and ${expenseCategories.length} expense categories`
    );

    // Remove existing budget entries for this building to avoid duplicates
    await this.cleanupExistingBudgets(building.id);

    // Generate monthly entries
    const budgetEntries: InsertMonthlyBudget[] = [];
    const systemUser = await this.getSystemUser();

    const currentDate = new Date(constructionDate);

    while (currentDate <= endDate) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1; // 1-12

      // Get aggregated amounts for this month/year
      const { incomes, spendings } = await this.getAggregatedAmountsForMonth(
        building.id,
        year,
        month,
        incomeCategories,
        expenseCategories
      );

      budgetEntries.push({
        buildingId: building.id,
        year,
        month,
        incomeTypes: incomeCategories,
        incomes: incomes.map((amount) => amount.toString()), // Convert to string for decimal array
        spendingTypes: expenseCategories,
        spendings: spendings.map((amount) => amount.toString()), // Convert to string for decimal array
        approved: false,
        approvedBy: undefined,
        originalBudgetId: undefined,
      });

      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);

      // Safety check to avoid infinite loops
      if (budgetEntries.length > 5000) {
        break;
      }
    }

    // Insert entries in batches
    if (budgetEntries.length > 0) {
      await this.insertBudgetEntriesInBatches(budgetEntries);
    }

    return budgetEntries.length;
  }

  /**
   * Get distinct income and expense categories from money_flow for a specific building.
   * @param buildingId
   */
  private async getCategoriesForBuilding(buildingId: string): Promise<{
    incomeCategories: string[];
    expenseCategories: string[];
  }> {
    // Get distinct income categories
    const incomeResult = await db
      .selectDistinct({ category: moneyFlow.category })
      .from(moneyFlow)
      .where(and(eq(moneyFlow.buildingId, buildingId), eq(moneyFlow.type, 'income')));

    // Get distinct expense categories
    const expenseResult = await db
      .selectDistinct({ category: moneyFlow.category })
      .from(moneyFlow)
      .where(and(eq(moneyFlow.buildingId, buildingId), eq(moneyFlow.type, 'expense')));

    const incomeCategories = incomeResult.map((r) => r.category);
    const expenseCategories = expenseResult.map((r) => r.category);

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
    const startDate = new Date(year, month - 1, 1); // First day of month
    const endDate = new Date(year, month, 0); // Last day of month

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Get aggregated incomes by category
    const incomes: number[] = [];
    for (const category of incomeCategories) {
      const result = await db
        .select({
          total: sql<string>`COALESCE(SUM(CAST(${moneyFlow.amount} AS DECIMAL)), 0)`,
        })
        .from(moneyFlow)
        .where(
          and(
            eq(moneyFlow.buildingId, buildingId),
            eq(moneyFlow.type, 'income'),
            eq(moneyFlow.category, category),
            gte(moneyFlow.transactionDate, startDateStr),
            lte(moneyFlow.transactionDate, endDateStr)
          )
        );

      incomes.push(parseFloat(result[0]?.total || '0'));
    }

    // Get aggregated expenses by category
    const spendings: number[] = [];
    for (const category of expenseCategories) {
      const result = await db
        .select({
          total: sql<string>`COALESCE(SUM(CAST(${moneyFlow.amount} AS DECIMAL)), 0)`,
        })
        .from(moneyFlow)
        .where(
          and(
            eq(moneyFlow.buildingId, buildingId),
            eq(moneyFlow.type, 'expense'),
            eq(moneyFlow.category, category),
            gte(moneyFlow.transactionDate, startDateStr),
            lte(moneyFlow.transactionDate, endDateStr)
          )
        );

      spendings.push(parseFloat(result[0]?.total || '0'));
    }

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
        // Try individual inserts for the failed batch
        for (const entry of batch) {
          try {
            await db.insert(monthlyBudgets).values(entry);
          } catch (___individualError) {
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
   * Repopulate budgets for a specific building (useful when money flow data changes).
   * @param buildingId
   */
  async repopulateBudgetsForBuilding(buildingId: string): Promise<number> {

    const building = await db.select().from(buildings).where(eq(buildings.id, buildingId)).limit(1);

    if (building.length === 0) {
      throw new Error(`Building ${buildingId} not found`);
    }

    const budgetsCreated = await this.populateBudgetsForBuilding(building[0]);

      `✅ Repopulated ${budgetsCreated} budget entries for building ${building[0].name}`
    );
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
