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
async function main() {
  console.log('🚀 Starting monthly budget population script...');
  console.log('This will create budget entries for all buildings from construction date to 3 years in the future.');
  
  try {
    // First, show some statistics
    console.log('\n📊 Current budget statistics:');
    const initialStats = await monthlyBudgetService.getBudgetStatistics();
    console.log(`- Total budget entries: ${initialStats.totalBudgetEntries}`);
    console.log(`- Buildings with budgets: ${initialStats.buildingsWithBudgets}`);
    console.log(`- Date range: ${initialStats.oldestBudgetDate || 'N/A'} to ${initialStats.newestBudgetDate || 'N/A'}`);

    // Populate budgets for all buildings
    const result = await monthlyBudgetService.populateAllMonthlyBudgets();
    
    console.log('\n✅ Budget population completed!');
    console.log(`- Buildings processed: ${result.buildingsProcessed}`);
    console.log(`- Budget entries created: ${result.budgetsCreated}`);

    // Show final statistics
    console.log('\n📊 Final budget statistics:');
    const finalStats = await monthlyBudgetService.getBudgetStatistics();
    console.log(`- Total budget entries: ${finalStats.totalBudgetEntries}`);
    console.log(`- Buildings with budgets: ${finalStats.buildingsWithBudgets}`);
    console.log(`- Date range: ${finalStats.oldestBudgetDate || 'N/A'} to ${finalStats.newestBudgetDate || 'N/A'}`);

  } catch (error) {
    console.error('❌ Error during budget population:', error);
    process.exit(1);
  } finally {
    // Close database connection
    process.exit(0);
  }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { main };