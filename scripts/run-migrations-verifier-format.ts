/**
 * Pure formatter / type module for the post-deploy migration verifier
 * (task #939).
 *
 * The actual `verifyMigrationsApplied()` implementation lives in
 * `scripts/run-migrations.ts` because it needs the migration runner's
 * pool wiring, advisory-lock helpers, and `import.meta.url` based
 * resolution of the bundled `migrations/` directory. The Jest CJS test
 * loader cannot parse `import.meta.url`, so the pure pieces that the
 * verifier endpoint and the unit tests both depend on are split out
 * into this file. `run-migrations.ts` re-exports everything here so
 * external importers (boot-time verifier, HTTP probe, CLI verifier)
 * continue to import from a single module.
 *
 * Keep this file free of side effects, top-level `import.meta` usage,
 * and DB / fs imports — its whole purpose is to be loadable from a
 * plain Jest CJS environment.
 */
import type { DatabaseUrlSource } from './run-migrations-url';

/**
 * Discriminator for the kind of drift detected.
 *  - `in-sync`         — live DB matches bundle exactly.
 *  - `behind`          — bundle ships migrations the live DB has not applied.
 *                        This is the dangerous case the verifier exists for:
 *                        a deploy hook silently swallowed a migration failure.
 *  - `ahead`           — live DB has applied a migration whose filename sorts
 *                        STRICTLY ABOVE every file shipped in the bundle on
 *                        disk. Typical cause: a rollback / older-bundle
 *                        redeploy without rolling back the DB. By definition
 *                        also implies `unknownApplied` is non-empty (the
 *                        highest applied row is the unknown one), but we keep
 *                        a distinct kind because the operator remediation
 *                        differs (re-deploy the matching bundle vs. backfill
 *                        the missing migration file).
 *  - `unknown-applied` — live DB has applied row(s) whose filename is not
 *                        present in the bundle on disk, but the highest
 *                        applied row is NOT strictly above the bundle's
 *                        highest expected. This is the "ghost migration"
 *                        case (task #948): a leftover from a parallel
 *                        branch that sorts below the current head sneaks
 *                        past the simple "highest matches highest" check
 *                        and ships invisible enforcement triggers / tables
 *                        the deployed bundle has no record of.
 *  - `verifier-empty`  — bundle ships zero migration files. Almost certainly
 *                        a packaging bug; treated as drift so it gets noticed.
 */
export type MigrationDriftKind =
  | 'in-sync'
  | 'behind'
  | 'ahead'
  | 'unknown-applied'
  | 'verifier-empty';

/**
 * Result of `verifyMigrationsApplied()`. Used by the post-deploy
 * verifier endpoint and the one-shot CLI verifier (task #939) to assert
 * that the migration the deployed bundle expects is actually present in
 * the live database.
 */
export interface MigrationVerification {
  /**
   * True iff every disk migration is recorded, the highest disk filename
   * equals the highest applied filename, AND there are no
   * `schema_migrations` rows for files the bundle does not ship.
   */
  inSync: boolean;
  /** Discriminator that explains the *direction* of drift, so callers can render the correct human message. */
  driftKind: MigrationDriftKind;
  /** Lexically-highest `NNNN_*.sql` shipped with the bundle on disk. */
  highestExpected: string | null;
  /** Lexically-highest filename recorded in `schema_migrations`. */
  highestApplied: string | null;
  /** Files present on disk but not yet recorded in `schema_migrations`. */
  missing: string[];
  /**
   * Filenames recorded in `schema_migrations` that are NOT present in
   * the bundle on disk. Includes both the `ahead` case (a row that
   * sorts above `highestExpected`) and the `unknown-applied` ghost-row
   * case (rows that sort at or below `highestExpected` — task #948).
   * Surfaced so operators can see exactly which leftover rows the live
   * DB is carrying.
   */
  unknownApplied: string[];
  /** Convenience count of `missing.length`. */
  pendingCount: number;
  /** Which env var supplied the database URL (for log/audit clarity). */
  source: DatabaseUrlSource;
  /** Masked `host:port/db` of the database we inspected. */
  maskedDb: string;
}

/**
 * Decide which `MigrationDriftKind` corresponds to a given comparison
 * between the disk-bundled `migrations/NNNN_*.sql` listing and the rows
 * recorded in `schema_migrations`. Lives here (separate from the DB
 * call site) so the unit tests can drive the classifier without
 * standing up a Postgres pool and so a future refactor cannot
 * accidentally diverge the boot-time verifier from the HTTP probe.
 *
 * `unknownApplied` is optional for backward compatibility with callers
 * that pre-date task #948; when omitted it defaults to an empty list
 * (i.e. "no ghost rows detected"), preserving the original behaviour.
 */
export function classifyDrift(input: {
  highestExpected: string | null;
  highestApplied: string | null;
  missing: string[];
  unknownApplied?: string[];
}): { inSync: boolean; driftKind: MigrationDriftKind } {
  const { highestExpected, highestApplied, missing } = input;
  const unknownApplied = input.unknownApplied ?? [];
  // Bundle ships zero `migrations/NNNN_*.sql`. Even if the live DB also
  // has nothing applied (so the listings technically "match"), this is
  // almost certainly a packaging bug — the build is missing the
  // `migrations/` directory. Surface it as drift so the operator sees
  // it, instead of silently reporting in-sync on a broken bundle.
  if (highestExpected === null) {
    return { inSync: false, driftKind: 'verifier-empty' };
  }
  const inSync =
    missing.length === 0 &&
    unknownApplied.length === 0 &&
    highestExpected === highestApplied;
  if (inSync) {
    return { inSync, driftKind: 'in-sync' };
  }
  // `behind` wins over the unknown-row cases: the bundle expects a
  // higher migration than the live DB has applied, which is the most
  // dangerous direction (a deploy hook silently swallowed a failure).
  if (missing.length > 0) {
    return { inSync, driftKind: 'behind' };
  }
  // `ahead` is a special case of unknown-applied where the unknown row
  // sorts strictly above every file in the bundle. Reported as its own
  // kind because the operator remediation differs (redeploy a matching
  // bundle, vs. backfill the missing file into source).
  if (highestApplied !== null && highestApplied > highestExpected) {
    return { inSync, driftKind: 'ahead' };
  }
  // Task #948: there are `schema_migrations` rows for files the bundle
  // does not ship, but the highest applied row is NOT above the
  // bundle's head. The pre-#948 classifier missed this entirely
  // (highestApplied === highestExpected and missing was empty looked
  // in-sync) and that is exactly how a leftover row from a parallel
  // branch can ship enforcement triggers the deployed code does not
  // know about. Flag it loudly.
  if (unknownApplied.length > 0) {
    return { inSync, driftKind: 'unknown-applied' };
  }
  // Defensive fallback: highestApplied !== highestExpected but
  // missing is empty and applied isn't strictly greater. Treat as
  // "behind" so the operator still gets a loud signal.
  return { inSync, driftKind: 'behind' };
}

function previewList(items: string[]): string {
  if (items.length === 0) {
    return '<none>';
  }
  return (
    items.slice(0, 5).join(', ') +
    (items.length > 5 ? `, ... (+${items.length - 5} more)` : '')
  );
}

/**
 * Format a verification result for human-readable logs. Used by the
 * boot-time verifier banner and by the CLI verifier so both surfaces
 * print the same thing.
 */
export function formatVerification(v: MigrationVerification): string {
  const head = `db=${v.maskedDb} (via ${v.source})`;
  if (v.inSync) {
    return (
      `migration verifier OK — ${head}, highest=${v.highestApplied ?? '<none>'}`
    );
  }
  return (
    `migration verifier DRIFT [${v.driftKind}] — ${head}, ` +
    `expected=${v.highestExpected ?? '<none>'}, ` +
    `applied=${v.highestApplied ?? '<none>'}, ` +
    `pending=${v.pendingCount}, missing=[${previewList(v.missing)}], ` +
    `unknown=[${previewList(v.unknownApplied)}]`
  );
}

/**
 * Stable, operator-facing one-liner explaining what the drift means and
 * what to do about it. Returned by the HTTP probe in the `message` field
 * and printed by the CLI verifier alongside the structured DRIFT line so
 * the response and the logs both tell the same story.
 *
 * Returns `null` for the in-sync case (the caller already knows there's
 * nothing to do).
 */
export function describeDrift(v: MigrationVerification): string | null {
  switch (v.driftKind) {
    case 'in-sync':
      return null;
    case 'behind':
      return (
        'Deployed bundle expects a higher migration than the live ' +
        'database has applied. Re-run `npm run migrate` against the ' +
        'production database.'
      );
    case 'ahead':
      return (
        'Live database has applied a migration that does not exist in ' +
        'the deployed bundle. The running code is older than the ' +
        'database — usually a rollback that did not roll back the DB, ' +
        'or a hand-applied migration that was never committed. ' +
        'Redeploy the matching bundle (or commit the missing migration ' +
        'file) before treating this as resolved.'
      );
    case 'unknown-applied':
      return (
        'Live database has `schema_migrations` row(s) for migration ' +
        'files the deployed bundle does not contain. The highest ' +
        'applied filename happens to match the bundle, so the simple ' +
        '"highest matches highest" check looked green, but the ghost ' +
        'rows mean the live DB is carrying schema changes (tables, ' +
        'triggers, constraints) the running code has no record of — ' +
        'usually a leftover from a parallel branch whose migration ' +
        'numbered below the current head. Either commit the missing ' +
        'migration file(s) into the bundle or remove the stale ' +
        '`schema_migrations` row(s) after confirming the underlying ' +
        'schema change has been reverted.'
      );
    case 'verifier-empty':
      return (
        'Deployed bundle ships zero `migrations/NNNN_*.sql` files. ' +
        'This is almost certainly a packaging bug — verify the build ' +
        'is including the `migrations/` directory.'
      );
  }
}
