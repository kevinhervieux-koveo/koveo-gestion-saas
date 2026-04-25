#!/usr/bin/env tsx

/**
 * Backfill Cross-Organisation Invoice Rows – CLI runner (Task #811).
 *
 * Some legacy invoice rows have a `residence_id` that points at a
 * residence belonging to a *different* building than the invoice's own
 * `building_id`. This is a cross-organisation data leak that surfaces
 * whenever a query joins through `residences` or filters by
 * `building_id`.
 *
 * This script NULLs `residence_id` on every such row inside a single
 * transaction, preserving the invoice at its building level while
 * severing the invalid cross-org link. It MUST be run before applying
 * `migrations/0012_invoices_residence_building_check.sql` to any
 * database that may contain pre-existing cross-org invoices.
 *
 * Usage: npx tsx server/scripts/backfill-cross-residence-invoices.ts
 */

import chalk from 'chalk';
import {
  backfillCrossResidenceInvoices,
  type CrossResidenceInvoiceRow,
} from './backfill-cross-residence-invoices-lib';

function logAuditRow(row: CrossResidenceInvoiceRow): void {
  console.log(
    chalk.red('  •'),
    JSON.stringify(
      {
        invoice_id: row.invoice_id,
        invoice_building_id: row.invoice_building_id,
        invoice_residence_id: row.invoice_residence_id,
        residence_building_id: row.residence_building_id,
        residence_org_id: row.residence_org_id,
      },
      null,
      4,
    ),
  );
}

async function main() {
  console.log(chalk.blue.bold('🚀 Starting cross-residence invoice backfill'));
  console.log('====================================================');

  try {
    const fixed = await backfillCrossResidenceInvoices(logAuditRow);
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
