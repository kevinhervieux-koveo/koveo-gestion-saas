#!/usr/bin/env tsx

/**
 * Cross-Organisation Assignment Integrity Check
 *
 * A recurring diagnostic tool that scans tables which carry assignment links
 * (demands, documents, invoices, invitations) for rows where a `residence_id`
 * points at a residence that does NOT belong to the same building referenced
 * by the row's own `building_id` column.  This is the same class of drift
 * addressed by the one-shot backfill scripts
 * (`backfill-cross-assignation-demands*`, `backfill-cross-residence-*`).
 *
 * Run this script periodically (e.g. via a cron job or post-migration hook)
 * to surface any new drift before it causes cross-org data leaks.
 *
 * Usage:
 *   npx tsx server/scripts/check-cross-org-assignment-integrity.ts
 *   npx tsx server/scripts/check-cross-org-assignment-integrity.ts --fix
 *
 * With --fix the script NULLs out the offending residence_id values (same
 * strategy used by the one-shot backfill scripts).  Without --fix it exits
 * with a non-zero status code if any drift is found so CI can catch it.
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

const FIX_MODE = process.argv.includes('--fix');

interface DriftRow extends Record<string, unknown> {
  table_name: string;
  row_id: string;
  building_id: string;
  residence_id: string;
  residence_building_id: string;
}

interface TableCheck {
  tableName: string;
  buildingIdCol: string;
  residenceIdCol: string;
}

const TABLES_TO_CHECK: TableCheck[] = [
  {
    tableName: 'demands',
    buildingIdCol: 'assignation_building_id',
    residenceIdCol: 'assignation_residence_id',
  },
  {
    tableName: 'demands',
    buildingIdCol: 'building_id',
    residenceIdCol: 'residence_id',
  },
  {
    tableName: 'documents',
    buildingIdCol: 'building_id',
    residenceIdCol: 'residence_id',
  },
  {
    tableName: 'invoices',
    buildingIdCol: 'building_id',
    residenceIdCol: 'residence_id',
  },
  {
    tableName: 'invitations',
    buildingIdCol: 'building_id',
    residenceIdCol: 'residence_id',
  },
];

async function checkTable(check: TableCheck): Promise<DriftRow[]> {
  const result = await db.execute(sql`
    SELECT
      ${sql.raw(`'${check.tableName}'`)}          AS table_name,
      t.id                                         AS row_id,
      t.${sql.raw(check.buildingIdCol)}            AS building_id,
      t.${sql.raw(check.residenceIdCol)}           AS residence_id,
      r.building_id                                AS residence_building_id
    FROM ${sql.raw(check.tableName)} t
    JOIN residences r ON r.id = t.${sql.raw(check.residenceIdCol)}
    WHERE t.${sql.raw(check.residenceIdCol)} IS NOT NULL
      AND t.${sql.raw(check.buildingIdCol)}  IS NOT NULL
      AND r.building_id <> t.${sql.raw(check.buildingIdCol)}
  `);

  return result.rows as DriftRow[];
}

async function fixTable(check: TableCheck, driftRows: DriftRow[]): Promise<number> {
  if (driftRows.length === 0) return 0;

  await db.execute(sql`
    UPDATE ${sql.raw(check.tableName)}
    SET    ${sql.raw(check.residenceIdCol)} = NULL
    WHERE  ${sql.raw(check.residenceIdCol)} IS NOT NULL
      AND  ${sql.raw(check.buildingIdCol)}  IS NOT NULL
      AND  ${sql.raw(check.buildingIdCol)} <> (
        SELECT r2.building_id
        FROM   residences r2
        WHERE  r2.id = ${sql.raw(check.tableName)}.${sql.raw(check.residenceIdCol)}
      )
  `);

  return driftRows.length;
}

async function main(): Promise<void> {
  console.log('[integrity-check] Cross-org assignment integrity scan starting…');

  const allDrift: { check: TableCheck; rows: DriftRow[] }[] = [];

  for (const check of TABLES_TO_CHECK) {
    let rows: DriftRow[];
    try {
      rows = await checkTable(check);
    } catch (err: any) {
      // Some tables may not have all expected columns (e.g. invitations may
      // lack residence_id in some migrations). Skip gracefully.
      if (err?.message?.includes('column') && err?.message?.includes('does not exist')) {
        console.warn(`[integrity-check] Skipping ${check.tableName}.${check.residenceIdCol} — column not found`);
        continue;
      }
      throw err;
    }

    if (rows.length > 0) {
      allDrift.push({ check, rows });
    }
  }

  if (allDrift.length === 0) {
    console.log('[integrity-check] ✅ No cross-org assignment drift found. Database is clean.');
    process.exit(0);
  }

  console.error(`[integrity-check] ❌ Found ${allDrift.reduce((s, d) => s + d.rows.length, 0)} cross-org drift row(s) across ${allDrift.length} table/column pair(s):`);

  for (const { check, rows } of allDrift) {
    console.error(`\n  Table: ${check.tableName}  (${check.buildingIdCol} / ${check.residenceIdCol})`);
    for (const row of rows) {
      console.error(`    row_id=${row.row_id}  building_id=${row.building_id}  residence_id=${row.residence_id}  residence.building_id=${row.residence_building_id}`);
    }
  }

  if (FIX_MODE) {
    console.log('\n[integrity-check] --fix flag detected. Nulling out offending residence_id values…');
    let totalFixed = 0;
    for (const { check, rows } of allDrift) {
      const fixed = await fixTable(check, rows);
      console.log(`[integrity-check]   Fixed ${fixed} row(s) in ${check.tableName}.${check.residenceIdCol}`);
      totalFixed += fixed;
    }
    console.log(`[integrity-check] ✅ Fixed ${totalFixed} row(s) total. Re-run without --fix to verify.`);
    process.exit(0);
  } else {
    console.error('\n[integrity-check] Run with --fix to null out the offending residence_id values.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[integrity-check] Fatal error:', err);
  process.exit(2);
});
