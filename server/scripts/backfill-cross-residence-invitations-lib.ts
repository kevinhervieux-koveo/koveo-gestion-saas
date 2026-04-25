/**
 * Library module for the cross-residence invitation backfill (Task #811).
 *
 * Mirrors `backfill-cross-residence-building-elements-lib.ts`, but
 * targets the `invitations` table. An invitation carrying both a
 * `building_id` and a `residence_id` whose linked residence belongs to
 * a different building is the same silent cross-organisation leak
 * addressed by the `invitations_residence_building_check` trigger
 * installed by migration
 * `0014_invitations_residence_building_check.sql`. In the invitations
 * case the leak doubles as a privilege-escalation vector — accepting
 * the invitation would attach the user to a foreign-org residence.
 *
 * Kept separate from the runner script so integration tests can import
 * this function without hitting the `import.meta.url` guard or ESM-only
 * dependencies (chalk v5) in the runner.
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

/** One affected row as selected by the pre-update audit query. */
export interface CrossResidenceInvitationRow extends Record<string, unknown> {
  invitation_id: string;
  invitation_building_id: string;
  invitation_residence_id: string;
  residence_building_id: string;
  residence_org_id: string;
}

/**
 * Optional callback invoked for each affected row *before* the UPDATE is
 * applied. The runner passes a chalk-styled logger; tests may omit it.
 */
export type AuditRowLogger = (row: CrossResidenceInvitationRow) => void;

/**
 * Nulls `residence_id` on every invitation row whose linked residence
 * belongs to a different building than the invitation's own
 * `building_id`. Invitations with `building_id IS NULL` are
 * intentionally left alone — the cross-org mismatch only materialises
 * when both columns are populated.
 *
 * Note: `invitations.residence_id` does not declare an FK, so orphan
 * residence ids are silently ignored (mirroring the trigger
 * behaviour). Only rows where the residence exists and disagrees on
 * `building_id` are touched.
 *
 * Runs inside a single transaction and aborts (throwing an error) if
 * the post-condition check finds any remaining cross-org rows after
 * the update.
 *
 * @param logAuditRow  Optional callback called per affected row before the
 *                     update runs. Useful for chalk-styled CLI output.
 * @returns The number of invitation rows that were updated.
 */
export async function backfillCrossResidenceInvitations(
  logAuditRow?: AuditRowLogger,
): Promise<number> {
  console.log('[backfill] Starting cross-residence invitations backfill');

  let affectedCount = 0;

  await db.transaction(async (tx) => {
    const affected = await tx.execute(sql`
      SELECT
        i.id                 AS invitation_id,
        i.building_id        AS invitation_building_id,
        i.residence_id       AS invitation_residence_id,
        r.building_id        AS residence_building_id,
        b.organization_id    AS residence_org_id
      FROM invitations i
      JOIN residences r ON r.id = i.residence_id
      JOIN buildings  b ON b.id = r.building_id
      WHERE i.residence_id IS NOT NULL
        AND i.building_id  IS NOT NULL
        AND r.building_id <> i.building_id
    `);

    const affectedRows = affected.rows as CrossResidenceInvitationRow[];
    affectedCount = affectedRows.length;

    if (affectedCount === 0) {
      console.log('[backfill] No cross-residence invitation rows found. Nothing to do.');
      return;
    }

    console.log(`[backfill] Found ${affectedCount} cross-residence invitation row(s):`);
    for (const row of affectedRows) {
      if (logAuditRow) {
        logAuditRow(row);
      } else {
        console.log('[backfill]  •', JSON.stringify(row, null, 4));
      }
    }

    console.log('[backfill] Applying fix: setting residence_id = NULL on affected rows…');
    await tx.execute(sql`
      UPDATE invitations
      SET    residence_id = NULL
      WHERE  residence_id IS NOT NULL
        AND  building_id  IS NOT NULL
        AND  building_id <> (
          SELECT r2.building_id
          FROM   residences r2
          WHERE  r2.id = invitations.residence_id
        )
    `);
    console.log(`[backfill] Updated ${affectedCount} row(s)`);

    const check = await tx.execute(sql`
      SELECT count(*)::int AS remaining
      FROM invitations i
      JOIN residences r ON r.id = i.residence_id
      WHERE i.building_id IS NOT NULL
        AND r.building_id <> i.building_id
    `);

    const remaining = (check.rows[0] as { remaining: number }).remaining;
    if (remaining !== 0) {
      const msg = `Post-condition FAILED: ${remaining} cross-residence invitation row(s) still exist after update`;
      console.error(`[backfill] ${msg}`);
      throw new Error(msg);
    }

    console.log('[backfill] Post-condition verified: 0 cross-residence invitation rows remain.');
  });

  return affectedCount;
}
