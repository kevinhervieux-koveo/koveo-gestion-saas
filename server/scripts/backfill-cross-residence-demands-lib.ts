/**
 * Library module for the cross-residence demand backfill.
 * Kept separate from the runner script so integration tests can import this
 * function without hitting the `import.meta.url` guard or ESM-only
 * dependencies (chalk v5) in the runner.
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

/** One affected row as selected by the pre-update audit query. */
export interface CrossResidenceDemandRow extends Record<string, unknown> {
  demand_id: string;
  demand_building_id: string;
  demand_residence_id: string;
  residence_building_id: string;
  residence_org_id: string;
}

/**
 * Optional callback invoked for each affected row *before* the UPDATE is
 * applied. The runner passes a chalk-styled logger; tests may omit it.
 */
export type AuditRowLogger = (row: CrossResidenceDemandRow) => void;

/**
 * Nulls `residence_id` on every demand row whose linked residence belongs to a
 * different building than the demand's own `building_id`.
 *
 * Runs inside a single transaction and aborts (throwing an error) if the
 * post-condition check finds any remaining cross-org rows after the update.
 *
 * @param logAuditRow  Optional callback called per affected row before the
 *                     update runs. Useful for chalk-styled CLI output.
 * @returns The number of demand rows that were updated.
 */
export async function backfillCrossResidenceDemands(
  logAuditRow?: AuditRowLogger,
): Promise<number> {
  console.log('[backfill] Starting cross-residence demand backfill');

  let affectedCount = 0;

  await db.transaction(async (tx) => {
    // 1. Select affected rows for audit logging before touching anything
    const affected = await tx.execute(sql`
      SELECT
        d.id                 AS demand_id,
        d.building_id        AS demand_building_id,
        d.residence_id       AS demand_residence_id,
        r.building_id        AS residence_building_id,
        b.organization_id    AS residence_org_id
      FROM demands d
      JOIN residences r ON r.id = d.residence_id
      JOIN buildings  b ON b.id = r.building_id
      WHERE d.residence_id IS NOT NULL
        AND r.building_id <> d.building_id
    `);

    const affectedRows = affected.rows as CrossResidenceDemandRow[];
    affectedCount = affectedRows.length;

    if (affectedCount === 0) {
      console.log('[backfill] No cross-residence demand rows found. Nothing to do.');
      return;
    }

    // 2. Log each affected row for auditability (caller provides chalk styling)
    console.log(`[backfill] Found ${affectedCount} cross-residence demand row(s):`);
    for (const row of affectedRows) {
      if (logAuditRow) {
        logAuditRow(row);
      } else {
        console.log('[backfill]  •', JSON.stringify(row, null, 4));
      }
    }

    // 3. NULL residence_id on all affected demands
    console.log('[backfill] Applying fix: setting residence_id = NULL on affected rows…');
    await tx.execute(sql`
      UPDATE demands
      SET    residence_id = NULL
      WHERE  residence_id IS NOT NULL
        AND  building_id <> (
          SELECT r2.building_id
          FROM   residences r2
          WHERE  r2.id = demands.residence_id
        )
    `);
    console.log(`[backfill] Updated ${affectedCount} row(s)`);

    // 4. Verify post-condition: no cross-org rows must remain
    const check = await tx.execute(sql`
      SELECT count(*)::int AS remaining
      FROM demands d
      JOIN residences r ON r.id = d.residence_id
      WHERE r.building_id <> d.building_id
    `);

    const remaining = (check.rows[0] as { remaining: number }).remaining;
    if (remaining !== 0) {
      const msg = `Post-condition FAILED: ${remaining} cross-residence demand row(s) still exist after update`;
      console.error(`[backfill] ${msg}`);
      throw new Error(msg);
    }

    console.log('[backfill] Post-condition verified: 0 cross-residence demand rows remain.');
  });

  return affectedCount;
}
