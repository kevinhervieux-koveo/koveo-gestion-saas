#!/usr/bin/env tsx

/**
 * Backfill Orphan Building-Element Residence Pointers – CLI runner
 * (Task #849).
 *
 * Some legacy building-element rows have a `residence_id` that doesn't
 * point at any actual residence (typo, since-deleted residence, ad-hoc
 * SQL, etc). Until Task #849 the column was a plain `text` field with
 * no FK, so these orphan pointers slipped through and became invisible
 * to the UI (which joins through `residences`).
 *
 * This script NULLs `residence_id` on every such row inside a single
 * transaction, preserving the element at its building level while
 * severing the dangling pointer. Migration
 * `migrations/0012_building_elements_residence_id_fk.sql` performs the
 * exact same cleanup inline before installing the FK; this CLI is
 * provided so production operators can preview and audit what will be
 * NULLed before letting the migration run.
 *
 * Usage: npx tsx server/scripts/backfill-orphan-building-element-residence-ids.ts
 */

import chalk from 'chalk';
import {
  backfillOrphanBuildingElementResidenceIds,
  type OrphanBuildingElementRow,
} from './backfill-orphan-building-element-residence-ids-lib';

function logAuditRow(row: OrphanBuildingElementRow): void {
  console.log(
    chalk.red('  •'),
    JSON.stringify(
      {
        element_id: row.element_id,
        element_building_id: row.element_building_id,
        element_residence_id: row.element_residence_id,
      },
      null,
      4,
    ),
  );
}

async function main() {
  console.log(chalk.blue.bold('🚀 Starting orphan building_elements.residence_id backfill'));
  console.log('====================================================');

  try {
    const fixed = await backfillOrphanBuildingElementResidenceIds(logAuditRow);
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
