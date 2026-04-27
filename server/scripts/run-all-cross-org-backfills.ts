#!/usr/bin/env tsx

/**
 * One-shot launcher: run all cross-org backfill scripts in sequence.
 *
 * This script is the single entry point that:
 *   1. Runs the cross-residence backfill for `documents`.
 *   2. Runs the cross-residence backfill for `invoices`.
 *   3. Runs the cross-residence backfill for `building_elements`.
 *   4. Runs the cross-residence backfill for `invitations`.
 *   5. Runs the cross-assignation backfill for `demands`.
 *   6. Runs the cross-residence backfill for `demands`.
 *
 * Each backfill NULLs `residence_id` (or `assignation_residence_id`)
 * on every row where the linked residence belongs to a different
 * building than the row's own `building_id`. Rows are preserved at
 * their building level — only the dangling cross-org residence pointer
 * is severed.
 *
 * Run this BEFORE installing the cross-org trigger migrations
 * (0030/0031/0032) on any database that may contain legacy cross-org
 * rows. The trigger migrations are idempotent and safe to re-run, but
 * they will fail to install if existing data violates the invariant.
 *
 * Usage:
 *   npx tsx server/scripts/run-all-cross-org-backfills.ts
 *
 * Exit codes:
 *   0 — all backfills succeeded (zero or more rows were fixed)
 *   1 — at least one backfill threw an error
 */

import { backfillCrossResidenceDocuments } from './backfill-cross-residence-documents-lib';
import { backfillCrossResidenceInvoices } from './backfill-cross-residence-invoices-lib';
import { backfillCrossResidenceBuildingElements } from './backfill-cross-residence-building-elements-lib';
import { backfillCrossResidenceInvitations } from './backfill-cross-residence-invitations-lib';
import { backfillCrossResidenceDemands } from './backfill-cross-residence-demands-lib';
import { backfillCrossAssignationDemands } from './backfill-cross-assignation-demands-lib';

interface BackfillStep {
  name: string;
  run: () => Promise<number>;
}

const STEPS: BackfillStep[] = [
  {
    name: 'cross-residence documents',
    run: () => backfillCrossResidenceDocuments(),
  },
  {
    name: 'cross-residence invoices',
    run: () => backfillCrossResidenceInvoices(),
  },
  {
    name: 'cross-residence building_elements',
    run: () => backfillCrossResidenceBuildingElements(),
  },
  {
    name: 'cross-residence invitations',
    run: () => backfillCrossResidenceInvitations(),
  },
  {
    name: 'cross-assignation demands',
    run: () => backfillCrossAssignationDemands(),
  },
  {
    name: 'cross-residence demands',
    run: () => backfillCrossResidenceDemands(),
  },
];

async function main(): Promise<void> {
  console.log('🚀 Starting full cross-org backfill pass');
  console.log('='.repeat(60));

  let totalFixed = 0;
  let hasError = false;

  for (const step of STEPS) {
    process.stdout.write(`  • ${step.name} … `);
    try {
      const fixed = await step.run();
      totalFixed += fixed;
      console.log(`${fixed} row(s) fixed`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`ERROR: ${msg}`);
      console.error(`    Full error for "${step.name}":`, err);
      hasError = true;
    }
  }

  console.log('='.repeat(60));
  console.log(`Total rows fixed across all tables: ${totalFixed}`);

  if (hasError) {
    console.error('❌ One or more backfill steps failed — review the errors above.');
    process.exit(1);
  } else {
    console.log('✅ All cross-org backfills completed successfully.');
    process.exit(0);
  }
}

main();
