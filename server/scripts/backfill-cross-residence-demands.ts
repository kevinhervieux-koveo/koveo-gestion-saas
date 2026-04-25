#!/usr/bin/env tsx

/**
 * Backfill Cross-Organisation Demand Rows – CLI runner.
 *
 * Some legacy demand rows have a `residence_id` that points at a residence
 * belonging to a *different* building than the demand's own `building_id`.
 * This is a cross-organisation data leak that surfaces whenever a query
 * joins through `residences`.
 *
 * This script NULLs `residence_id` on every such row inside a single
 * transaction, preserving the demand at its building level while severing
 * the invalid cross-org link.
 *
 * Usage: npm run backfill:cross-residence-demands
 */

import chalk from 'chalk';
import {
  backfillCrossResidenceDemands,
  type CrossResidenceDemandRow,
} from './backfill-cross-residence-demands-lib';

/**
 * Chalk-styled audit logger — passed into the lib so the detailed per-row
 * output matches the styling convention used in the sibling cleanup scripts.
 */
function logAuditRow(row: CrossResidenceDemandRow): void {
  console.log(
    chalk.red('  •'),
    JSON.stringify(
      {
        demand_id: row.demand_id,
        demand_building_id: row.demand_building_id,
        demand_residence_id: row.demand_residence_id,
        residence_building_id: row.residence_building_id,
        residence_org_id: row.residence_org_id,
      },
      null,
      4,
    ),
  );
}

async function main() {
  console.log(chalk.blue.bold('🚀 Starting cross-residence demand backfill'));
  console.log('====================================================');

  try {
    const fixed = await backfillCrossResidenceDemands(logAuditRow);
    console.log('\n' + chalk.blue(`Total rows fixed: ${fixed}`));
    console.log(chalk.green.bold('🎉 Backfill completed successfully!'));
    process.exit(0);
  } catch (error) {
    console.error(chalk.red('Backfill failed:'), error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
