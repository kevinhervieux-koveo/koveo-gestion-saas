/**
 * Library module for the cross-assignation demand backfill.
 *
 * Mirrors `backfill-cross-residence-demands-lib.ts`, but targets the
 * secondary `assignation_residence_id` / `assignation_building_id`
 * pair on the `demands` table. Some legacy demand rows have an
 * `assignation_residence_id` that points at a residence belonging to
 * a *different* building than the demand's own `assignation_building_id`,
 * which is the same cross-organisation data leak addressed by the primary
 * residence backfill.
 *
 * Kept separate from the runner script so integration tests can import this
 * function without hitting the `import.meta.url` guard or ESM-only
 * dependencies (chalk v5) in the runner.
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

/** One affected row as selected by the pre-update audit query. */
export interface CrossAssignationDemandRow extends Record<string, unknown> {
  demand_id: string;
  demand_assignation_building_id: string;
  demand_assignation_residence_id: string;
  residence_building_id: string;
  residence_org_id: string;
}

/**
 * Optional callback invoked for each affected row *before* the UPDATE is
 * applied. The runner passes a chalk-styled logger; tests may omit it.
 */
export type AuditRowLogger = (row: CrossAssignationDemandRow) => void;

/**
 * Nulls `assignation_residence_id` on every demand row whose linked
 * residence belongs to a different building than the demand's own
 * `assignation_building_id`.
 *
 * Runs inside a single transaction and aborts (throwing an error) if the
 * post-condition check finds any remaining cross-org rows after the update.
 *
 * @param logAuditRow  Optional callback called per affected row before the
 *                     update runs. Useful for chalk-styled CLI output.
 * @returns The number of demand rows that were updated.
 */
export async function backfillCrossAssignationDemands(
  logAuditRow?: AuditRowLogger,
): Promise<number> {
  console.log('[backfill] Starting cross-assignation demand backfill');

  let affectedCount = 0;

  await db.transaction(async (tx) => {
    // 1. Select affected rows for audit logging before touching anything.
    //    A demand is "affected" only when it has BOTH an assignation_residence_id
    //    and an assignation_building_id and they disagree on building. Rows
    //    where assignation_building_id is NULL are intentionally left alone —
    //    nulling the residence pointer would not improve correctness because
    //    the org-scope on the assignation columns isn't asserted at all.
    const affected = await tx.execute(sql`
      SELECT
        d.id                          AS demand_id,
        d.assignation_building_id     AS demand_assignation_building_id,
        d.assignation_residence_id    AS demand_assignation_residence_id,
        r.building_id                 AS residence_building_id,
        b.organization_id             AS residence_org_id
      FROM demands d
      JOIN residences r ON r.id = d.assignation_residence_id
      JOIN buildings  b ON b.id = r.building_id
      WHERE d.assignation_residence_id IS NOT NULL
        AND d.assignation_building_id  IS NOT NULL
        AND r.building_id <> d.assignation_building_id
    `);

    const affectedRows = affected.rows as CrossAssignationDemandRow[];
    affectedCount = affectedRows.length;

    if (affectedCount === 0) {
      console.log('[backfill] No cross-assignation demand rows found. Nothing to do.');
      return;
    }

    // 2. Log each affected row for auditability (caller provides chalk styling)
    console.log(`[backfill] Found ${affectedCount} cross-assignation demand row(s):`);
    for (const row of affectedRows) {
      if (logAuditRow) {
        logAuditRow(row);
      } else {
        console.log('[backfill]  •', JSON.stringify(row, null, 4));
      }
    }

    // 3. NULL assignation_residence_id on all affected demands
    console.log('[backfill] Applying fix: setting assignation_residence_id = NULL on affected rows…');
    await tx.execute(sql`
      UPDATE demands
      SET    assignation_residence_id = NULL
      WHERE  assignation_residence_id IS NOT NULL
        AND  assignation_building_id  IS NOT NULL
        AND  assignation_building_id <> (
          SELECT r2.building_id
          FROM   residences r2
          WHERE  r2.id = demands.assignation_residence_id
        )
    `);
    console.log(`[backfill] Updated ${affectedCount} row(s)`);

    // 4. Verify post-condition: no cross-org rows must remain
    const check = await tx.execute(sql`
      SELECT count(*)::int AS remaining
      FROM demands d
      JOIN residences r ON r.id = d.assignation_residence_id
      WHERE r.building_id <> d.assignation_building_id
    `);

    const remaining = (check.rows[0] as { remaining: number }).remaining;
    if (remaining !== 0) {
      const msg = `Post-condition FAILED: ${remaining} cross-assignation demand row(s) still exist after update`;
      console.error(`[backfill] ${msg}`);
      throw new Error(msg);
    }

    console.log('[backfill] Post-condition verified: 0 cross-assignation demand rows remain.');
  });

  return affectedCount;
}
