/**
 * Library module for the cross-residence invoice backfill (Task #811).
 *
 * Mirrors `backfill-cross-residence-demands-lib.ts`, but targets the
 * `invoices` table. An invoice carrying both a `residence_id` and a
 * `building_id` whose linked residence belongs to a different building
 * is the same silent cross-organisation leak addressed by the
 * `invoices_residence_building_check` trigger installed by migration
 * `0012_invoices_residence_building_check.sql`.
 *
 * Kept separate from the runner script so integration tests can import
 * this function without hitting the `import.meta.url` guard or ESM-only
 * dependencies (chalk v5) in the runner.
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

/** One affected row as selected by the pre-update audit query. */
export interface CrossResidenceInvoiceRow extends Record<string, unknown> {
  invoice_id: string;
  invoice_building_id: string;
  invoice_residence_id: string;
  residence_building_id: string;
  residence_org_id: string;
}

/**
 * Optional callback invoked for each affected row *before* the UPDATE is
 * applied. The runner passes a chalk-styled logger; tests may omit it.
 */
export type AuditRowLogger = (row: CrossResidenceInvoiceRow) => void;

/**
 * Nulls `residence_id` on every invoice row whose linked residence
 * belongs to a different building than the invoice's own
 * `building_id`. Invoices with `building_id IS NULL` are intentionally
 * left alone — the cross-org mismatch only materialises when both
 * columns are populated.
 *
 * Runs inside a single transaction and aborts (throwing an error) if
 * the post-condition check finds any remaining cross-org rows after
 * the update.
 *
 * @param logAuditRow  Optional callback called per affected row before the
 *                     update runs. Useful for chalk-styled CLI output.
 * @returns The number of invoice rows that were updated.
 */
export async function backfillCrossResidenceInvoices(
  logAuditRow?: AuditRowLogger,
): Promise<number> {
  console.log('[backfill] Starting cross-residence invoice backfill');

  let affectedCount = 0;

  await db.transaction(async (tx) => {
    const affected = await tx.execute(sql`
      SELECT
        i.id                 AS invoice_id,
        i.building_id        AS invoice_building_id,
        i.residence_id       AS invoice_residence_id,
        r.building_id        AS residence_building_id,
        b.organization_id    AS residence_org_id
      FROM invoices i
      JOIN residences r ON r.id = i.residence_id
      JOIN buildings  b ON b.id = r.building_id
      WHERE i.residence_id IS NOT NULL
        AND i.building_id  IS NOT NULL
        AND r.building_id <> i.building_id
    `);

    const affectedRows = affected.rows as CrossResidenceInvoiceRow[];
    affectedCount = affectedRows.length;

    if (affectedCount === 0) {
      console.log('[backfill] No cross-residence invoice rows found. Nothing to do.');
      return;
    }

    console.log(`[backfill] Found ${affectedCount} cross-residence invoice row(s):`);
    for (const row of affectedRows) {
      if (logAuditRow) {
        logAuditRow(row);
      } else {
        console.log('[backfill]  •', JSON.stringify(row, null, 4));
      }
    }

    console.log('[backfill] Applying fix: setting residence_id = NULL on affected rows…');
    await tx.execute(sql`
      UPDATE invoices
      SET    residence_id = NULL
      WHERE  residence_id IS NOT NULL
        AND  building_id  IS NOT NULL
        AND  building_id <> (
          SELECT r2.building_id
          FROM   residences r2
          WHERE  r2.id = invoices.residence_id
        )
    `);
    console.log(`[backfill] Updated ${affectedCount} row(s)`);

    const check = await tx.execute(sql`
      SELECT count(*)::int AS remaining
      FROM invoices i
      JOIN residences r ON r.id = i.residence_id
      WHERE i.building_id IS NOT NULL
        AND r.building_id <> i.building_id
    `);

    const remaining = (check.rows[0] as { remaining: number }).remaining;
    if (remaining !== 0) {
      const msg = `Post-condition FAILED: ${remaining} cross-residence invoice row(s) still exist after update`;
      console.error(`[backfill] ${msg}`);
      throw new Error(msg);
    }

    console.log('[backfill] Post-condition verified: 0 cross-residence invoice rows remain.');
  });

  return affectedCount;
}
