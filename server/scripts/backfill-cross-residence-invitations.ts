#!/usr/bin/env tsx

/**
 * Backfill Cross-Organisation Invitation Rows – CLI runner
 * (Task #811).
 *
 * Some legacy invitation rows have a `residence_id` that points at a
 * residence belonging to a *different* building than the invitation's
 * own `building_id`. Accepting such an invitation would attach the
 * invitee to a residence in a foreign organisation — a
 * cross-organisation data leak with a privilege-escalation flavour.
 *
 * This script NULLs `residence_id` on every such row inside a single
 * transaction, preserving the invitation at its building level while
 * severing the invalid cross-org link. It MUST be run before applying
 * `migrations/0014_invitations_residence_building_check.sql` to any
 * database that may contain pre-existing cross-org invitations.
 *
 * Usage: npx tsx server/scripts/backfill-cross-residence-invitations.ts
 */

import chalk from 'chalk';
import {
  backfillCrossResidenceInvitations,
  type CrossResidenceInvitationRow,
} from './backfill-cross-residence-invitations-lib';

function logAuditRow(row: CrossResidenceInvitationRow): void {
  console.log(
    chalk.red('  •'),
    JSON.stringify(
      {
        invitation_id: row.invitation_id,
        invitation_building_id: row.invitation_building_id,
        invitation_residence_id: row.invitation_residence_id,
        residence_building_id: row.residence_building_id,
        residence_org_id: row.residence_org_id,
      },
      null,
      4,
    ),
  );
}

async function main() {
  console.log(chalk.blue.bold('🚀 Starting cross-residence invitations backfill'));
  console.log('====================================================');

  try {
    const fixed = await backfillCrossResidenceInvitations(logAuditRow);
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
