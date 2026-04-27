#!/usr/bin/env tsx
/**
 * Custom database migration runner for Koveo Gestion.
 *
 * Why a custom runner (not `drizzle-kit migrate`):
 * - The `migrations/meta/_journal.json` is out of sync with the actual
 *   numbered SQL files in `migrations/` (different tag names, missing
 *   indexes), the result of mixing hand-written migrations with files
 *   generated at different times.
 * - Production has historically been kept in sync via `drizzle-kit push`,
 *   which never wrote anything to a migrations history table, so we need
 *   a runner that can be safely "baselined" against an existing schema.
 *
 * What this runner does:
 * 1. Connects to `DATABASE_URL_KOVEO` if set (production), otherwise
 *    `DATABASE_URL` (development / CI).
 * 2. Ensures a `schema_migrations(filename text primary key, checksum text,
 *    applied_at timestamptz default now())` table exists.
 * 3. On first run against a database that already has application tables
 *    (detected via the `users` table) AND has no rows in
 *    `schema_migrations`, AUTO-BASELINES: marks every numbered migration
 *    file currently in `migrations/` as already applied without executing
 *    it. This prevents the first deploy after this change from trying to
 *    re-create existing tables.
 * 4. Applies every numbered `NNNN_*.sql` file in `migrations/` whose
 *    filename is not yet recorded in `schema_migrations`, in lexical
 *    order, each in its own transaction. Records the filename + sha256.
 * 5. Exits non-zero on any error so the deploy aborts.
 * 6. Prints either "Applied N migration(s): ..." or
 *    "No pending migrations.".
 *
 * Notes:
 * - Only files matching /^\d{4}_.+\.sql$/ are considered. Any ad-hoc
 *   `fix_*.sql` repair scripts that may exist alongside the chain are
 *   intentionally ignored — they are one-off repairs and are not part
 *   of the canonical migration chain.
 * - `--baseline` forces the auto-baseline behaviour even if the
 *   `users`-table heuristic does not match. Useful to bootstrap a
 *   freshly-restored prod snapshot.
 * - `--status` prints the highest applied migration and exits 0 without
 *   applying anything. Used by the server at startup.
 */
import {
  Pool,
  type PoolClient,
  type WebSocketConstructor,
  neonConfig,
} from '@neondatabase/serverless';
import ws from 'ws';
import { createHash } from 'crypto';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

if (!neonConfig.webSocketConstructor) {
  neonConfig.webSocketConstructor = ws as unknown as WebSocketConstructor;
}

// Use a uniquely-named local rather than `__dirname` so this module can
// also be `require()`d from a CommonJS context (e.g. ts-jest under
// `module: CommonJS`), which auto-injects its own `__dirname` and
// would otherwise collide with this declaration.
const RUNNER_DIR = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(RUNNER_DIR, '..', 'migrations');
const NUMBERED_RE = /^\d{4}_.+\.sql$/;

export interface MigrationResult {
  applied: string[];
  baselined: string[];
  highestApplied: string | null;
  pending: string[];
}

/**
 * Result of {@link verifyMigrationsApplied}. Used by the post-deploy
 * verifier endpoint and the one-shot CLI verifier (task #939) to assert
 * that the migration the deployed bundle expects is actually present in
 * the live database.
 */
// Re-export the pure verifier types and formatters from their dedicated
// helper module. Keeping them out of this file lets the unit tests and
// any other Jest CJS consumer load them without touching this file's
// `import.meta.url` usage (which the Jest CJS loader cannot parse).
export {
  classifyDrift,
  describeDrift,
  formatVerification,
  type MigrationDriftKind,
  type MigrationVerification,
} from './run-migrations-verifier-format';
// Aliased imports are intentional: these symbols are re-exported above
// for external callers, and we still need them in scope inside this
// module (the verifier impl uses `_classifyDrift`, the CLI block calls
// `formatVerification`, and the verifier signature references
// `MigrationVerification`).
import {
  classifyDrift as _classifyDrift,
  describeDrift,
  formatVerification,
  type MigrationVerification,
} from './run-migrations-verifier-format';

function log(msg: string): void {
  console.log(`[migrate] ${msg}`);
}

function err(msg: string): void {
  console.error(`[migrate] ${msg}`);
}

function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => NUMBERED_RE.test(f))
    .sort();
}

function checksum(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

// Re-export the URL helpers from their pure-helper module so existing
// importers of `scripts/run-migrations.ts` (e.g. legacy scripts and
// docs that reference the file path) keep working. The helpers live
// in `run-migrations-url.ts` so the unit test suite can load them
// without dragging in this file's `import.meta.url` usage, which the
// Jest CJS loader cannot parse.
export {
  resolveDatabaseUrl,
  maskDatabaseUrl,
  type ProdUrlSource,
  type DatabaseUrlSource,
  type ResolvedDatabaseUrl,
} from './run-migrations-url';
import {
  resolveDatabaseUrl,
  maskDatabaseUrl,
  type DatabaseUrlSource,
  type ResolvedDatabaseUrl,
} from './run-migrations-url';

// Stable advisory lock key so concurrent runners (e.g. multiple
// Autoscale containers booting at once) serialize on the same lock
// rather than racing each other.
//
// Exported so the boot-time trigger re-application step
// (`ensureTriggerOnlyMigrations()` in server/index.ts) can re-use the
// SAME key. Without that, two concurrent boots can interleave a
// RowExclusiveLock-holding UPDATE (e.g. 0015's cross-org cleanup on
// `demands`) with an AccessExclusiveLock-needing DROP/CREATE TRIGGER
// (0010/0012) on the same table — which is exactly the lock-wait
// failure (SQLSTATE 55P03) Task #1439 instrumented and Task #1443 is
// fixing the root cause of.
export const MIGRATION_LOCK_KEY = '7426891234567890';

async function ensureMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   text PRIMARY KEY,
      checksum   text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function getAppliedFilenames(client: PoolClient): Promise<Set<string>> {
  const { rows } = await client.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations',
  );
  return new Set(rows.map((r) => r.filename));
}

async function tableExists(client: PoolClient, name: string): Promise<boolean> {
  const { rows } = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [name],
  );
  return rows[0]?.exists === true;
}

async function highestAppliedVersion(
  client: PoolClient,
): Promise<string | null> {
  const { rows } = await client.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations ORDER BY filename DESC LIMIT 1',
  );
  return rows[0]?.filename ?? null;
}

async function recordMigration(
  client: PoolClient,
  filename: string,
  sum: string,
): Promise<void> {
  await client.query(
    `INSERT INTO schema_migrations(filename, checksum)
     VALUES ($1, $2)
     ON CONFLICT (filename) DO NOTHING`,
    [filename, sum],
  );
}

async function applyMigration(
  pool: Pool,
  filename: string,
  sql: string,
  sum: string,
): Promise<void> {
  // Each migration runs in its own dedicated connection/transaction so
  // a long-running migration does not affect the advisory-lock session.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query(
      `INSERT INTO schema_migrations(filename, checksum) VALUES ($1, $2)`,
      [filename, sum],
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Print a startup banner that makes it unmistakable which database the
 * runner is about to touch. In production the banner names the env var
 * that supplied the URL and the masked `host/db`; if both prod aliases
 * were set, it also notes which alias was ignored (and warns loudly if
 * the two pointed at different databases).
 */
function logStartupBanner(
  resolved: ResolvedDatabaseUrl,
  opts: { statusOnly?: boolean },
): void {
  const masked = maskDatabaseUrl(resolved.url);
  const action = opts.statusOnly ? 'inspect' : 'migrate';
  if (resolved.isProd) {
    // First production log line names the env var AND the masked target
    // — the task spec ("very first log line clearly states which env
    // var supplied the URL and shows the masked host/database") relies
    // on this ordering for grep-friendly post-deploy checks.
    log(
      `PRODUCTION migration runner — env var ${resolved.source} → ${masked} (about to ${action})`,
    );
    log('================================================================');
    if (resolved.ignoredSource) {
      if (resolved.ignoredSourceDiffers) {
        err(
          `WARNING: ${resolved.ignoredSource} is also set but points at a ` +
            `DIFFERENT database than ${resolved.source}. Ignoring ` +
            `${resolved.ignoredSource}. Set both to the same value or unset one.`,
        );
      } else {
        log(
          `Note: ${resolved.ignoredSource} is also set (same value) and was ignored.`,
        );
      }
    }
    log('================================================================');
  } else {
    log(`Using ${resolved.source} (${masked}) — NODE_ENV is not production.`);
  }
}

export async function runMigrations(opts: {
  baseline?: boolean;
  statusOnly?: boolean;
}): Promise<MigrationResult> {
  const resolved = resolveDatabaseUrl();
  logStartupBanner(resolved, opts);
  const pool = new Pool({ connectionString: resolved.url });
  const result: MigrationResult = {
    applied: [],
    baselined: [],
    highestApplied: null,
    pending: [],
  };

  // Use a single dedicated client for table creation, advisory lock,
  // and history reads/writes. The advisory lock is session-scoped, so
  // it must be acquired and released on the same connection.
  const lockClient = await pool.connect();
  let lockHeld = false;
  try {
    await ensureMigrationsTable(lockClient);

    if (!opts.statusOnly) {
      await lockClient.query('SELECT pg_advisory_lock($1)', [
        MIGRATION_LOCK_KEY,
      ]);
      lockHeld = true;
    }

    const files = listMigrationFiles();
    const applied = await getAppliedFilenames(lockClient);

    if (opts.statusOnly) {
      result.highestApplied = await highestAppliedVersion(lockClient);
      result.pending = files.filter((f) => !applied.has(f));
      log(
        `Status: ${applied.size} applied, ${result.pending.length} pending. ` +
          `Highest: ${result.highestApplied ?? '<none>'}.`,
      );
      if (result.pending.length > 0) {
        log(`Pending: ${result.pending.join(', ')}`);
      }
      return result;
    }

    // Auto-baseline: if the migration table is empty but the database
    // already has application tables, mark every existing migration as
    // already applied. This handles the transition from `db:push` based
    // schema management to the migration runner.
    const isEmptyHistory = applied.size === 0;
    const hasUsersTable = await tableExists(lockClient, 'users');
    const shouldBaseline =
      isEmptyHistory && (opts.baseline || hasUsersTable);
    if (shouldBaseline) {
      log(
        `Empty schema_migrations + existing schema detected — baselining ${files.length} file(s) as already applied.`,
      );
      for (const f of files) {
        const content = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
        await recordMigration(lockClient, f, checksum(content));
        result.baselined.push(f);
        applied.add(f);
      }
    }

    const pending = files.filter((f) => !applied.has(f));
    if (pending.length === 0) {
      log('No pending migrations.');
    } else {
      log(`Applying ${pending.length} pending migration(s)...`);
      for (const f of pending) {
        const content = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
        const sum = checksum(content);
        log(`  -> ${f}`);
        try {
          await applyMigration(pool, f, content, sum);
        } catch (e) {
          err(`FAILED applying ${f}: ${(e as Error).message}`);
          throw e;
        }
        result.applied.push(f);
      }
      log(`Applied ${result.applied.length} migration(s).`);
    }

    result.highestApplied = await highestAppliedVersion(lockClient);
    if (result.highestApplied) {
      log(`Highest applied migration: ${result.highestApplied}`);
    }
    return result;
  } finally {
    if (lockHeld) {
      await lockClient
        .query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY])
        .catch(() => undefined);
    }
    lockClient.release();
    await pool.end().catch(() => undefined);
  }
}

/**
 * Post-deploy verifier (task #939).
 *
 * Connects to the same production database the runner targets, reads
 * the `schema_migrations` table, lists the numbered SQL files shipped
 * with the deployed bundle on disk, and reports whether the highest
 * applied migration matches the highest expected one.
 *
 * This exists because the runner already runs at boot, but a deploy
 * pipeline can still drift — e.g. the runner exited non-zero and the
 * platform swallowed it, or `SKIP_DB_MIGRATIONS=true` was left on, or
 * the previous container crashed mid-apply. Calling this from the new
 * `/api/admin/migration-status` endpoint (or the
 * `verify-migration-deployed.ts` CLI) catches that the same day rather
 * than weeks later when a runtime error trips on a missing column.
 *
 * NOTE: this is a read-only probe. It does NOT acquire the migration
 * advisory lock and never applies anything.
 */
export async function verifyMigrationsApplied(): Promise<MigrationVerification> {
  const resolved = resolveDatabaseUrl();
  const maskedDb = maskDatabaseUrl(resolved.url);
  const pool = new Pool({ connectionString: resolved.url });
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const files = listMigrationFiles();
    const diskSet = new Set(files);
    const highestExpected = files.length > 0 ? files[files.length - 1] : null;
    const applied = await getAppliedFilenames(client);
    const highestApplied = await highestAppliedVersion(client);
    const missing = files.filter((f) => !applied.has(f));
    // Task #948: any `schema_migrations` row whose filename is not in
    // the bundle on disk is a ghost. We surface ALL of them (sorted for
    // stable output) regardless of where they sort relative to
    // `highestExpected` so the simple "highest matches highest" check
    // can no longer hide a leftover row from a parallel branch.
    const unknownApplied = Array.from(applied)
      .filter((f) => !diskSet.has(f))
      .sort();
    const { inSync, driftKind } = _classifyDrift({
      highestExpected,
      highestApplied,
      missing,
      unknownApplied,
    });
    return {
      inSync,
      driftKind,
      highestExpected,
      highestApplied,
      missing,
      unknownApplied,
      pendingCount: missing.length,
      source: resolved.source,
      maskedDb,
    };
  } finally {
    client.release();
    await pool.end().catch(() => undefined);
  }
}

const isMain = (() => {
  try {
    // Only treat this module as the entry point when the executed script
    // path actually points at run-migrations(.ts|.js|.mjs). Without the
    // filename guard, esbuild bundling this file into dist/index.js would
    // make both `import.meta.url` and `process.argv[1]` resolve to the
    // same dist entry and the migration runner would auto-execute on
    // every production boot, calling process.exit(0) and tearing down
    // the live server (causing a deploy loop / 503s).
    const argv1 = process.argv[1];
    if (typeof argv1 !== 'string' || argv1.length === 0) {
      return false;
    }
    if (!/run-migrations(\.[cm]?[jt]s)?$/.test(argv1)) {
      return false;
    }
    return import.meta.url === `file://${argv1}`;
  } catch {
    return false;
  }
})();

if (isMain) {
  const args = new Set(process.argv.slice(2));
  if (args.has('--verify')) {
    // Read-only post-deploy verifier (task #939). Exits 0 if the live DB
    // matches the bundle on disk, exits non-zero with a loud line if it
    // does not. Safe to run any number of times — never writes anything.
    verifyMigrationsApplied()
      .then((v) => {
        if (v.inSync) {
          log(formatVerification(v));
          process.exit(0);
        } else {
          err(formatVerification(v));
          const remediation = describeDrift(v);
          if (remediation) {
            err(`POST-DEPLOY VERIFIER FAILED — ${remediation}`);
          } else {
            err(
              'POST-DEPLOY VERIFIER FAILED — production schema does not ' +
                'match deployed bundle.',
            );
          }
          process.exit(2);
        }
      })
      .catch((e) => {
        err(`Verifier crashed: ${(e as Error).stack || (e as Error).message}`);
        process.exit(1);
      });
  } else {
    runMigrations({
      baseline: args.has('--baseline'),
      statusOnly: args.has('--status'),
    })
      .then(() => process.exit(0))
      .catch((e) => {
        err(`Migration run failed: ${(e as Error).stack || (e as Error).message}`);
        process.exit(1);
      });
  }
}
