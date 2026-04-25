#!/usr/bin/env tsx

/**
 * Backfill Cross-Organisation Demand Rows (assignation columns) – CLI runner.
 *
 * Sibling of `backfill-cross-residence-demands.ts`. Targets the secondary
 * `assignation_residence_id` / `assignation_building_id` pair on `demands`,
 * which can carry the same cross-organisation data leak as the primary
 * residence/building pair.
 *
 * NULLs `assignation_residence_id` on every demand row whose linked
 * residence belongs to a different building than the demand's own
 * `assignation_building_id`, inside a single transaction.
 *
 * Usage: npm run backfill:cross-assignation-demands
 */

import chalk from 'chalk';
import {
  backfillCrossAssignationDemands,
  type CrossAssignationDemandRow,
} from './backfill-cross-assignation-demands-lib';

/**
 * Chalk-styled audit logger — passed into the lib so the detailed per-row
 * output matches the styling convention used in the sibling backfill scripts.
 */
function logAuditRow(row: CrossAssignationDemandRow): void {
  console.log(
    chalk.red('  •'),
    JSON.stringify(
      {
        demand_id: row.demand_id,
        demand_assignation_building_id: row.demand_assignation_building_id,
        demand_assignation_residence_id: row.demand_assignation_residence_id,
        residence_building_id: row.residence_building_id,
        residence_org_id: row.residence_org_id,
      },
      null,
      4,
    ),
  );
}

async function main() {
  console.log(chalk.blue.bold('🚀 Starting cross-assignation demand backfill'));
  console.log('====================================================');

  try {
    const fixed = await backfillCrossAssignationDemands(logAuditRow);
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
