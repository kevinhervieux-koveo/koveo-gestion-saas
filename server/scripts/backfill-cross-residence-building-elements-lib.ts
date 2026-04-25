/**
 * Library module for the cross-residence building-element backfill
 * (Task #811).
 *
 * Mirrors `backfill-cross-residence-demands-lib.ts`, but targets the
 * `building_elements` table. A building element carrying a
 * `residence_id` whose linked residence belongs to a different building
 * than the element's own `building_id` is the same silent
 * cross-organisation leak addressed by the
 * `building_elements_residence_building_check` trigger installed by
 * migration `0013_building_elements_residence_building_check.sql`.
 *
 * Kept separate from the runner script so integration tests can import
 * this function without hitting the `import.meta.url` guard or ESM-only
 * dependencies (chalk v5) in the runner.
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

/** One affected row as selected by the pre-update audit query. */
export interface CrossResidenceBuildingElementRow extends Record<string, unknown> {
  element_id: string;
  element_building_id: string;
  element_residence_id: string;
  residence_building_id: string;
  residence_org_id: string;
}

/**
 * Optional callback invoked for each affected row *before* the UPDATE is
 * applied. The runner passes a chalk-styled logger; tests may omit it.
 */
export type AuditRowLogger = (row: CrossResidenceBuildingElementRow) => void;

/**
 * Nulls `residence_id` on every building-element row whose linked
 * residence belongs to a different building than the element's own
 * `building_id`.
 *
 * Note: `building_elements.residence_id` does not declare an FK, so
 * orphan residence ids are silently ignored (mirroring the trigger
 * behaviour). Only rows where the residence exists and disagrees on
 * `building_id` are touched.
 *
 * Runs inside a single transaction and aborts (throwing an error) if
 * the post-condition check finds any remaining cross-org rows after
 * the update.
 *
 * @param logAuditRow  Optional callback called per affected row before the
 *                     update runs. Useful for chalk-styled CLI output.
 * @returns The number of building-element rows that were updated.
 */
export async function backfillCrossResidenceBuildingElements(
  logAuditRow?: AuditRowLogger,
): Promise<number> {
  console.log('[backfill] Starting cross-residence building_elements backfill');

  let affectedCount = 0;

  await db.transaction(async (tx) => {
    const affected = await tx.execute(sql`
      SELECT
        be.id                AS element_id,
        be.building_id       AS element_building_id,
        be.residence_id      AS element_residence_id,
        r.building_id        AS residence_building_id,
        b.organization_id    AS residence_org_id
      FROM building_elements be
      JOIN residences r ON r.id = be.residence_id
      JOIN buildings  b ON b.id = r.building_id
      WHERE be.residence_id IS NOT NULL
        AND r.building_id <> be.building_id
    `);

    const affectedRows = affected.rows as CrossResidenceBuildingElementRow[];
    affectedCount = affectedRows.length;

    if (affectedCount === 0) {
      console.log('[backfill] No cross-residence building_element rows found. Nothing to do.');
      return;
    }

    console.log(`[backfill] Found ${affectedCount} cross-residence building_element row(s):`);
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
        AND  building_id <> (
          SELECT r2.building_id
          FROM   residences r2
          WHERE  r2.id = building_elements.residence_id
        )
    `);
    console.log(`[backfill] Updated ${affectedCount} row(s)`);

    const check = await tx.execute(sql`
      SELECT count(*)::int AS remaining
      FROM building_elements be
      JOIN residences r ON r.id = be.residence_id
      WHERE r.building_id <> be.building_id
    `);

    const remaining = (check.rows[0] as { remaining: number }).remaining;
    if (remaining !== 0) {
      const msg = `Post-condition FAILED: ${remaining} cross-residence building_element row(s) still exist after update`;
      console.error(`[backfill] ${msg}`);
      throw new Error(msg);
    }

    console.log('[backfill] Post-condition verified: 0 cross-residence building_element rows remain.');
  });

  return affectedCount;
}
