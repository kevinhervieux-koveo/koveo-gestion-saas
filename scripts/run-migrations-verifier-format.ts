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
 *  - `in-sync`       — live DB matches bundle exactly.
 *  - `behind`        — bundle ships migrations the live DB has not applied.
 *                      This is the dangerous case the verifier exists for:
 *                      a deploy hook silently swallowed a migration failure.
 *  - `ahead`         — live DB has applied a migration that does not exist
 *                      in the bundle on disk. Typical cause: a rollback /
 *                      older-bundle redeploy without rolling back the DB,
 *                      or a hand-applied migration that was never committed.
 *  - `verifier-empty`— bundle ships zero migration files. Almost certainly
 *                      a packaging bug; treated as drift so it gets noticed.
 */
export type MigrationDriftKind = 'in-sync' | 'behind' | 'ahead' | 'verifier-empty';

/**
 * Result of `verifyMigrationsApplied()`. Used by the post-deploy
 * verifier endpoint and the one-shot CLI verifier (task #939) to assert
 * that the migration the deployed bundle expects is actually present in
 * the live database.
 */
export interface MigrationVerification {
  /** True iff every disk migration is recorded AND the highest disk filename equals the highest applied filename. */
  inSync: boolean;
  /** Discriminator that explains the *direction* of drift, so callers can render the correct human message. */
  driftKind: MigrationDriftKind;
  /** Lexically-highest `NNNN_*.sql` shipped with the bundle on disk. */
  highestExpected: string | null;
  /** Lexically-highest filename recorded in `schema_migrations`. */
  highestApplied: string | null;
  /** Files present on disk but not yet recorded in `schema_migrations`. */
  missing: string[];
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
 */
export function classifyDrift(input: {
  highestExpected: string | null;
  highestApplied: string | null;
  missing: string[];
}): { inSync: boolean; driftKind: MigrationDriftKind } {
  const { highestExpected, highestApplied, missing } = input;
  // Bundle ships zero `migrations/NNNN_*.sql`. Even if the live DB also
  // has nothing applied (so the listings technically "match"), this is
  // almost certainly a packaging bug — the build is missing the
  // `migrations/` directory. Surface it as drift so the operator sees
  // it, instead of silently reporting in-sync on a broken bundle.
  if (highestExpected === null) {
    return { inSync: false, driftKind: 'verifier-empty' };
  }
  const inSync = missing.length === 0 && highestExpected === highestApplied;
  if (inSync) {
    return { inSync, driftKind: 'in-sync' };
  }
  if (missing.length > 0) {
    return { inSync, driftKind: 'behind' };
  }
  if (highestApplied !== null && highestApplied > highestExpected) {
    return { inSync, driftKind: 'ahead' };
  }
  // Defensive fallback: highestApplied !== highestExpected but
  // missing is empty and applied isn't strictly greater. Treat as
  // "behind" so the operator still gets a loud signal.
  return { inSync, driftKind: 'behind' };
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
  const missingPreview =
    v.missing.length === 0
      ? '<none>'
      : v.missing.slice(0, 5).join(', ') +
        (v.missing.length > 5 ? `, ... (+${v.missing.length - 5} more)` : '');
  return (
    `migration verifier DRIFT [${v.driftKind}] — ${head}, ` +
    `expected=${v.highestExpected ?? '<none>'}, ` +
    `applied=${v.highestApplied ?? '<none>'}, ` +
    `pending=${v.pendingCount}, missing=[${missingPreview}]`
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
    case 'verifier-empty':
      return (
        'Deployed bundle ships zero `migrations/NNNN_*.sql` files. ' +
        'This is almost certainly a packaging bug — verify the build ' +
        'is including the `migrations/` directory.'
      );
  }
}
