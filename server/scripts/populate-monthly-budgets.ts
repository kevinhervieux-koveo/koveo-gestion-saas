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
  console.log(
    'This will create budget entries for all buildings from construction date to 3 years in the future.'
  );

  try {
    const initialStats = await monthlyBudgetService.getBudgetStatistics();
    console.log(
      `- Date range: ${initialStats.oldestBudgetDate || 'N/A'} to ${initialStats.newestBudgetDate || 'N/A'}`
    );

    const result = await monthlyBudgetService.populateAllMonthlyBudgets();
    console.log('Budgets populated:', result);

    const finalStats = await monthlyBudgetService.getBudgetStatistics();
    console.log(
      `- Date range: ${finalStats.oldestBudgetDate || 'N/A'} to ${finalStats.newestBudgetDate || 'N/A'}`
    );
  } catch (error) {
    console.error('Failed to populate budgets:', error);
    process.exit(1);
  }
  process.exit(0);
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(() => {
    process.exit(1);
  });
}

export { main };
