/**
 * Library module for the orphan-residence-id backfill on
 * `building_elements` (Task #849).
 *
 * Sibling to `backfill-cross-residence-building-elements-lib.ts`, but
 * targets a different failure mode: rows whose `residence_id` does not
 * point at any existing residence at all (typos or pointers to
 * since-deleted residences). These rows have always been silently
 * tolerated because `building_elements.residence_id` was a plain
 * `text` column with no FK, and the cross-residence trigger added by
 * Task #811 short-circuits when the residence lookup misses.
 *
 * Migration `0012_building_elements_residence_id_fk.sql` performs the
 * exact same cleanup inline before adding the FK constraint, so this
 * standalone script is mainly useful for production operators who want
 * to see (and audit) what the migration is about to NULL out before
 * letting it run, or for re-running the cleanup after the FK is in
 * place if a new orphan ever leaks in (which the FK should now make
 * impossible, but defence in depth is cheap).
 *
 * Kept separate from the runner script so integration tests can import
 * this function without hitting the `import.meta.url` guard or
 * ESM-only dependencies (chalk v5) in the runner.
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

/** One orphan row as selected by the pre-update audit query. */
export interface OrphanBuildingElementRow extends Record<string, unknown> {
  element_id: string;
  element_building_id: string;
  element_residence_id: string;
}

/**
 * Optional callback invoked for each affected row *before* the UPDATE is
 * applied. The runner passes a chalk-styled logger; tests may omit it.
 */
export type AuditRowLogger = (row: OrphanBuildingElementRow) => void;

/**
 * Nulls `residence_id` on every building-element row whose `residence_id`
 * does not match any existing `residences.id`.
 *
 * Runs inside a single transaction and aborts (throwing an error) if
 * the post-condition check finds any remaining orphan rows after the
 * update.
 *
 * @param logAuditRow  Optional callback called per affected row before the
 *                     update runs. Useful for chalk-styled CLI output.
 * @returns The number of building-element rows that were updated.
 */
export async function backfillOrphanBuildingElementResidenceIds(
  logAuditRow?: AuditRowLogger,
): Promise<number> {
  console.log('[backfill] Starting orphan building_elements.residence_id backfill');

  let affectedCount = 0;

  await db.transaction(async (tx) => {
    const affected = await tx.execute(sql`
      SELECT
        be.id           AS element_id,
        be.building_id  AS element_building_id,
        be.residence_id AS element_residence_id
      FROM building_elements be
      WHERE be.residence_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM residences r WHERE r.id = be.residence_id
        )
    `);

    const affectedRows = affected.rows as OrphanBuildingElementRow[];
    affectedCount = affectedRows.length;

    if (affectedCount === 0) {
      console.log('[backfill] No orphan building_element rows found. Nothing to do.');
      return;
    }

    console.log(`[backfill] Found ${affectedCount} orphan building_element row(s):`);
    for (const row of affectedRows) {
      if (logAuditRow) {
        logAuditRow(row);
      } else {
        console.log('[backfill]  •', JSON.stringify(row, null, 4));
      }
    }

    console.log('[backfill] Applying fix: setting residence_id = NULL on affected rows…');
    await tx.execute(sql`
      UPDATE building_elements
      SET    residence_id = NULL
      WHERE  residence_id IS NOT NULL
        AND  NOT EXISTS (
          SELECT 1 FROM residences r WHERE r.id = building_elements.residence_id
        )
    `);
    console.log(`[backfill] Updated ${affectedCount} row(s)`);

    const check = await tx.execute(sql`
      SELECT count(*)::int AS remaining
      FROM building_elements be
      WHERE be.residence_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM residences r WHERE r.id = be.residence_id
        )
    `);

    const remaining = (check.rows[0] as { remaining: number }).remaining;
    if (remaining !== 0) {
      const msg = `Post-condition FAILED: ${remaining} orphan building_element row(s) still exist after update`;
      console.error(`[backfill] ${msg}`);
      throw new Error(msg);
    }

    console.log('[backfill] Post-condition verified: 0 orphan building_element rows remain.');
  });

  return affectedCount;
}
