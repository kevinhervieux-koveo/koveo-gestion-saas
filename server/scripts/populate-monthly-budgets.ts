#!/usr/bin/env tsx

/**
 * Script to populate monthly budget entries for all buildings.
 * Run this script to initialize the monthly_budgets table with data.
 *
 * Usage: tsx server/scripts/populate-monthly-budgets.ts.
 */

import { monthlyBudgetService } from '../services/monthly-budget-service';
import { db } from '../db';

/**
 *
 */
/**
 * Main function.
 * @returns Function result.
 */
async function main() {
  console.warn('🚀 Starting monthly budget population script...');
  console.warn(
    'This will create budget entries for all buildings from construction date to 3 years in the future.'
  );

  try {
    // First, show some statistics
    console.warn('\n📊 Current budget statistics:');
    const initialStats = await monthlyBudgetService.getBudgetStatistics();
    console.warn(`- Total budget entries: ${initialStats.totalBudgetEntries}`);
    console.warn(`- Buildings with budgets: ${initialStats.buildingsWithBudgets}`);
    console.warn(
      `- Date range: ${initialStats.oldestBudgetDate || 'N/A'} to ${initialStats.newestBudgetDate || 'N/A'}`
    );

    // Populate budgets for all buildings
    const result = await monthlyBudgetService.populateAllMonthlyBudgets();

    console.warn('\n✅ Budget population completed!');
    console.warn(`- Buildings processed: ${result.buildingsProcessed}`);
    console.warn(`- Budget entries created: ${result.budgetsCreated}`);

    // Show final statistics
    console.warn('\n📊 Final budget statistics:');
    const finalStats = await monthlyBudgetService.getBudgetStatistics();
    console.warn(`- Total budget entries: ${finalStats.totalBudgetEntries}`);
    console.warn(`- Buildings with budgets: ${finalStats.buildingsWithBudgets}`);
    console.warn(
      `- Date range: ${finalStats.oldestBudgetDate || 'N/A'} to ${finalStats.newestBudgetDate || 'N/A'}`
    );
  } catch (_error) {
    console.error('❌ Error during budget population:', _error);
    process.exit(1);
  } finally {
    // Close database connection
    process.exit(0);
  }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((_error) => {
    console.error('❌ Fatal _error:', _error);
    process.exit(1);
  });
}

export { main };
