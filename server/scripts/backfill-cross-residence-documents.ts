#!/usr/bin/env tsx

/**
 * Backfill Cross-Organisation Document Rows – CLI runner (Task #811).
 *
 * Some legacy document rows have a `residence_id` that points at a
 * residence belonging to a *different* building than the document's own
 * `building_id`. This is a cross-organisation data leak that surfaces
 * whenever a query joins through `residences` or filters by
 * `building_id`.
 *
 * This script NULLs `residence_id` on every such row inside a single
 * transaction, preserving the document at its building level while
 * severing the invalid cross-org link. It MUST be run before applying
 * `migrations/0011_documents_residence_building_check.sql` to any
 * database that may contain pre-existing cross-org documents.
 *
 * Usage: npx tsx server/scripts/backfill-cross-residence-documents.ts
 */

import chalk from 'chalk';
import {
  backfillCrossResidenceDocuments,
  type CrossResidenceDocumentRow,
} from './backfill-cross-residence-documents-lib';

function logAuditRow(row: CrossResidenceDocumentRow): void {
  console.log(
    chalk.red('  •'),
    JSON.stringify(
      {
        document_id: row.document_id,
        document_building_id: row.document_building_id,
        document_residence_id: row.document_residence_id,
        residence_building_id: row.residence_building_id,
        residence_org_id: row.residence_org_id,
      },
      null,
      4,
    ),
  );
}

async function main() {
  console.log(chalk.blue.bold('🚀 Starting cross-residence document backfill'));
  console.log('====================================================');

  try {
    const fixed = await backfillCrossResidenceDocuments(logAuditRow);
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
