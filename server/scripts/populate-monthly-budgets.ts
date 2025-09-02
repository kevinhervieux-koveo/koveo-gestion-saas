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
    'This will create budget entries for all buildings from construction date to 3 years in the future.'
  );

  try {
    // First, show some statistics
    const initialStats = await monthlyBudgetService.getBudgetStatistics();
      `- Date range: ${initialStats.oldestBudgetDate || 'N/A'} to ${initialStats.newestBudgetDate || 'N/A'}`
    );

    // Populate budgets for all buildings
    const result = await monthlyBudgetService.populateAllMonthlyBudgets();


    // Show final statistics
    const finalStats = await monthlyBudgetService.getBudgetStatistics();
      `- Date range: ${finalStats.oldestBudgetDate || 'N/A'} to ${finalStats.newestBudgetDate || 'N/A'}`
    );
    process.exit(1);
  } finally {
    // Close database connection
    process.exit(0);
  }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    process.exit(1);
  });
}

export { main };
