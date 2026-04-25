#!/usr/bin/env tsx

/**
 * One-shot maintenance script that normalizes already-stored unsafe
 * filenames in `documents.fileName` and `element_documents.fileName`
 * (Task #394).
 *
 * Tasks #378 and #380 stop new uploads from persisting tricky filenames,
 * but historical rows uploaded before those fixes can still contain
 * accents, control characters, or other bytes that break naive
 * Content-Disposition emitters. This script walks both tables, runs each
 * stored `fileName` through the shared `normalizeFilename` helper from
 * `server/utils/filenameNormalization.ts`, and updates rows whose
 * normalized value differs from what is currently stored.
 *
 * The script is idempotent: a second run after a successful pass is a
 * no-op because every row already matches its normalized form.
 *
 * Usage:
 *   npx tsx scripts/normalize-stored-filenames.ts            # apply changes
 *   npx tsx scripts/normalize-stored-filenames.ts --dry-run  # log only
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, isNotNull } from 'drizzle-orm';
import { documents } from '../shared/schemas/documents';
import { elementDocuments } from '../shared/schemas/maintenance';
import { normalizeFilename } from '../server/utils/filenameNormalization';
import { resolveDatabaseUrl } from './run-migrations-url';

const DRY_RUN = process.argv.includes('--dry-run');
const IS_MAIN_MODULE =
  typeof require !== 'undefined' && require.main === module;

interface TableStats {
  scanned: number;
  needsUpdate: number;
  updated: number;
  failed: number;
}

function emptyStats(): TableStats {
  return { scanned: 0, needsUpdate: 0, updated: 0, failed: 0 };
}

async function normalizeDocumentsTable(
  db: ReturnType<typeof drizzle>,
): Promise<TableStats> {
  const stats = emptyStats();
  const rows = await db
    .select({ id: documents.id, fileName: documents.fileName })
    .from(documents)
    .where(isNotNull(documents.fileName));

  for (const row of rows) {
    stats.scanned += 1;
    const current = row.fileName;
    if (!current) continue;

    let normalized: string;
    try {
      normalized = normalizeFilename(current);
    } catch (err) {
      stats.failed += 1;
      console.warn(
        `[normalize-stored-filenames] documents ${row.id}: cannot normalize ${JSON.stringify(
          current,
        )} (${err instanceof Error ? err.message : String(err)})`,
      );
      continue;
    }

    if (normalized === current) continue;
    stats.needsUpdate += 1;

    console.log(
      `[normalize-stored-filenames] documents ${row.id}: ${JSON.stringify(
        current,
      )} -> ${JSON.stringify(normalized)}`,
    );

    if (DRY_RUN) continue;

    try {
      await db
        .update(documents)
        .set({ fileName: normalized })
        .where(eq(documents.id, row.id));
      stats.updated += 1;
    } catch (err) {
      stats.failed += 1;
      console.warn(
        `[normalize-stored-filenames] documents ${row.id}: update failed (${
          err instanceof Error ? err.message : String(err)
        })`,
      );
    }
  }

  return stats;
}

async function normalizeElementDocumentsTable(
  db: ReturnType<typeof drizzle>,
): Promise<TableStats> {
  const stats = emptyStats();
  const rows = await db
    .select({ id: elementDocuments.id, fileName: elementDocuments.fileName })
    .from(elementDocuments);

  for (const row of rows) {
    stats.scanned += 1;
    const current = row.fileName;
    if (!current) continue;

    let normalized: string;
    try {
      normalized = normalizeFilename(current);
    } catch (err) {
      stats.failed += 1;
      console.warn(
        `[normalize-stored-filenames] element_documents ${row.id}: cannot normalize ${JSON.stringify(
          current,
        )} (${err instanceof Error ? err.message : String(err)})`,
      );
      continue;
    }

    if (normalized === current) continue;
    stats.needsUpdate += 1;

    console.log(
      `[normalize-stored-filenames] element_documents ${row.id}: ${JSON.stringify(
        current,
      )} -> ${JSON.stringify(normalized)}`,
    );

    if (DRY_RUN) continue;

    try {
      await db
        .update(elementDocuments)
        .set({ fileName: normalized })
        .where(eq(elementDocuments.id, row.id));
      stats.updated += 1;
    } catch (err) {
      stats.failed += 1;
      console.warn(
        `[normalize-stored-filenames] element_documents ${row.id}: update failed (${
          err instanceof Error ? err.message : String(err)
        })`,
      );
    }
  }

  return stats;
}

export async function main(): Promise<void> {
  // Route through the same alias-aware helper the runtime uses (Task #940)
  // so the script accepts DATABASE_URL_KOVEO or PRODUCTION_DATABASE_URL in
  // production rather than silently falling back to the dev DATABASE_URL.
  const resolved = resolveDatabaseUrl();
  const sql = neon(resolved.url);
  const db = drizzle(sql);

  console.log(
    `[normalize-stored-filenames] starting${DRY_RUN ? ' (dry-run, no writes)' : ''}`,
  );

  const docsStats = await normalizeDocumentsTable(db);
  console.log(
    `[normalize-stored-filenames] documents: scanned=${docsStats.scanned} ` +
      `needsUpdate=${docsStats.needsUpdate} updated=${docsStats.updated} failed=${docsStats.failed}`,
  );

  const elementStats = await normalizeElementDocumentsTable(db);
  console.log(
    `[normalize-stored-filenames] element_documents: scanned=${elementStats.scanned} ` +
      `needsUpdate=${elementStats.needsUpdate} updated=${elementStats.updated} failed=${elementStats.failed}`,
  );

  const totals = {
    scanned: docsStats.scanned + elementStats.scanned,
    needsUpdate: docsStats.needsUpdate + elementStats.needsUpdate,
    updated: docsStats.updated + elementStats.updated,
    failed: docsStats.failed + elementStats.failed,
  };

  console.log(
    `[normalize-stored-filenames] totals scanned=${totals.scanned} ` +
      `needsUpdate=${totals.needsUpdate} updated=${totals.updated} failed=${totals.failed}` +
      `${DRY_RUN ? ' (dry-run, no writes)' : ''}`,
  );
}

if (IS_MAIN_MODULE) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[normalize-stored-filenames] failed:', err);
      process.exit(1);
    });
}
