#!/usr/bin/env tsx

/**
 * Backfill Cross-Organisation Building-Element Rows – CLI runner
 * (Task #811).
 *
 * Some legacy building-element rows have a `residence_id` that points
 * at a residence belonging to a *different* building than the
 * element's own `building_id`. This is a cross-organisation data leak
 * that surfaces whenever a query joins through `residences`.
 *
 * This script NULLs `residence_id` on every such row inside a single
 * transaction, preserving the element at its building level while
 * severing the invalid cross-org link. It MUST be run before applying
 * `migrations/0013_building_elements_residence_building_check.sql` to
 * any database that may contain pre-existing cross-org elements.
 *
 * Usage: npx tsx server/scripts/backfill-cross-residence-building-elements.ts
 */

import chalk from 'chalk';
import {
  backfillCrossResidenceBuildingElements,
  type CrossResidenceBuildingElementRow,
} from './backfill-cross-residence-building-elements-lib';

function logAuditRow(row: CrossResidenceBuildingElementRow): void {
  console.log(
    chalk.red('  •'),
    JSON.stringify(
      {
        element_id: row.element_id,
        element_building_id: row.element_building_id,
        element_residence_id: row.element_residence_id,
        residence_building_id: row.residence_building_id,
        residence_org_id: row.residence_org_id,
      },
      null,
      4,
    ),
  );
}

async function main() {
  console.log(chalk.blue.bold('🚀 Starting cross-residence building_elements backfill'));
  console.log('====================================================');

  try {
    const fixed = await backfillCrossResidenceBuildingElements(logAuditRow);
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
