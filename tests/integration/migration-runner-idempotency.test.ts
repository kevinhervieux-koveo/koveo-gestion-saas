/**
 * @jest-environment node
 *
 * Task #410 — Verify that `scripts/run-migrations.ts` is idempotent and
 * baselines safely. The runner sits on the critical path for every
 * production deploy (it runs at server startup before routes register),
 * so the three behaviours we care about must not regress:
 *
 *   (a) `--baseline` (or the auto-baseline heuristic) records every
 *       numbered file as already applied WITHOUT executing any
 *       migration SQL when the database already has an application
 *       schema and an empty `schema_migrations` history.
 *   (b) On a database whose `schema_migrations` history is partial,
 *       only the missing numbered files are applied.
 *   (c) The runner is a true no-op on a second invocation against an
 *       up-to-date database.
 *
 * We invoke the runner exactly the way production does (spawn
 * `tsx scripts/run-migrations.ts`) against a freshly created throwaway
 * Neon database, then assert against the resulting database state and
 * the runner's structured stdout. Spawning the script (rather than
 * `require`-ing it) keeps this test honest about the real entry-point
 * and sidesteps the ESM `import.meta.url` the script uses for path
 * resolution.
 *
 * Background — why we cannot just "apply every numbered file from
 * scratch": the numbered chain in `migrations/` is intentionally NOT a
 * complete from-zero schema (see the leading comment in the runner).
 * 0000_sparkling_korg.sql does not create every table later migrations
 * touch (e.g. `demands`, `invitation_audit_log`), because production
 * has historically been bootstrapped via `drizzle-kit push` and the
 * runner exists to layer incremental changes on top of that baseline.
 * The tests below therefore exercise the realistic deploy path: a
 * pre-existing schema (created via `drizzle-kit push --force`) plus
 * the runner.
 *
 * Skipped automatically when no real Postgres is configured
 * (`_INTEGRATION_DB_URL` / `DATABASE_URL`), mirroring every other
 * real-DB integration test in this directory.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
// `child_process` is globally mocked in jest.config.cjs. We need the real
// implementation here because the test spawns the migration runner.
// Using the `node:` specifier sidesteps the moduleNameMapper entry that
// matches the bare `child_process` import.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { spawn } = require('node:child_process') as typeof import('child_process');
import { randomBytes } from 'crypto';
import { readdirSync } from 'fs';
import { join } from 'path';
import {
  Pool,
  neonConfig,
  type WebSocketConstructor,
} from '@neondatabase/serverless';
import ws from 'ws';

if (!neonConfig.webSocketConstructor) {
  neonConfig.webSocketConstructor = ws as unknown as WebSocketConstructor;
}

const ADMIN_URL =
  process.env._INTEGRATION_DB_URL || process.env.DATABASE_URL || '';

/**
 * Refuse to spin up throwaway databases against a URL that looks like
 * production unless explicitly allowed. Mirrors the same foot-gun guard
 * used in `jest.global-setup.cjs`. This suite issues `CREATE DATABASE`
 * and `DROP DATABASE` against the admin URL — exactly the operations
 * that must never be attempted against a production cluster from a
 * test run.
 */
function looksLikeProductionUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    const haystack = `${u.hostname} ${u.pathname}`.toLowerCase();
    return /(^|[._-])(prod|production|live)([._-]|$)/.test(haystack);
  } catch {
    return false;
  }
}

const isProdShaped =
  !!ADMIN_URL &&
  looksLikeProductionUrl(ADMIN_URL) &&
  process.env.ALLOW_DB_PUSH_IN_TESTS !== '1';

const describeIfDb = ADMIN_URL && !isProdShaped ? describe : describe.skip;

const REPO_ROOT = join(__dirname, '..', '..');
const RUNNER_PATH = join(REPO_ROOT, 'scripts', 'run-migrations.ts');
const MIGRATIONS_DIR = join(REPO_ROOT, 'migrations');
const NUMBERED_RE = /^\d{4}_.+\.sql$/;
const MIGRATION_FILES = readdirSync(MIGRATIONS_DIR)
  .filter((f) => NUMBERED_RE.test(f))
  .sort();

interface RunnerResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  appliedFromStdout: string[];
}

function urlForDb(adminUrl: string, dbName: string): string {
  const u = new URL(adminUrl);
  u.pathname = '/' + dbName;
  return u.toString();
}

function runRunner(databaseUrl: string, args: string[]): Promise<RunnerResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['tsx', RUNNER_PATH, ...args], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        // Force the runner to target our throwaway DB. NODE_ENV stays
        // out of 'production' so `resolveDatabaseUrl()` picks
        // DATABASE_URL rather than DATABASE_URL_KOVEO.
        DATABASE_URL: databaseUrl,
        DATABASE_URL_KOVEO: '',
        NODE_ENV: 'test',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on('data', (c: Buffer) => out.push(c));
    child.stderr.on('data', (c: Buffer) => err.push(c));
    child.on('error', reject);
    child.on('exit', (code: number | null) => {
      const stdout = Buffer.concat(out).toString('utf8');
      const stderr = Buffer.concat(err).toString('utf8');
      const appliedFromStdout = Array.from(
        stdout.matchAll(/\[migrate]\s+->\s+(\S+)/g),
      ).map((m) => m[1]);
      resolve({
        exitCode: code ?? -1,
        stdout,
        stderr,
        appliedFromStdout,
      });
    });
  });
}

/**
 * Run `drizzle-kit push --force` against `databaseUrl` so the throwaway
 * DB has the same schema shape production has had since the project
 * switched off `db:push`. Mirrors the technique in
 * `jest.global-setup.cjs` (including the periodic Enter to dismiss the
 * non-destructive UNIQUE-constraint prompt that `--force` does not
 * auto-confirm).
 */
function drizzleKitPush(databaseUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['drizzle-kit', 'push', '--force'], {
      cwd: REPO_ROOT,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on('data', (c: Buffer) => out.push(c));
    child.stderr.on('data', (c: Buffer) => err.push(c));
    const tick = setInterval(() => {
      if (child.stdin && !child.stdin.destroyed) child.stdin.write('\r');
    }, 1500);
    const killTimer = setTimeout(() => {
      clearInterval(tick);
      child.kill('SIGKILL');
      reject(new Error('drizzle-kit push timed out'));
    }, 120_000);
    child.on('error', (e) => {
      clearInterval(tick);
      clearTimeout(killTimer);
      reject(e);
    });
    child.on('exit', (code) => {
      clearInterval(tick);
      clearTimeout(killTimer);
      if (child.stdin && !child.stdin.destroyed) child.stdin.end();
      const stdout = Buffer.concat(out).toString('utf8');
      const stderr = Buffer.concat(err).toString('utf8');
      // `drizzle-kit push` exits 0 even if a SQL statement errored
      // mid-run, so also fail on a captured `error: ` line.
      if (code !== 0 || /(^|\n)error:\s/i.test(`${stdout}\n${stderr}`)) {
        reject(
          new Error(
            `drizzle-kit push failed (exit ${code})\n${stdout}\n${stderr}`,
          ),
        );
      } else {
        resolve();
      }
    });
  });
}

async function freshDb(adminPool: Pool, created: string[]): Promise<string> {
  // Lower-case + alpha-numeric only keeps Neon's database-name validator
  // happy across all regions.
  const name = 'mig_test_' + randomBytes(6).toString('hex');
  await adminPool.query(`CREATE DATABASE "${name}"`);
  created.push(name);
  return urlForDb(ADMIN_URL, name);
}

describeIfDb('scripts/run-migrations.ts — idempotency + baseline (Task #410)', () => {
  let adminPool: Pool;
  const createdDbs: string[] = [];

  beforeAll(() => {
    adminPool = new Pool({ connectionString: ADMIN_URL });
  });

  afterAll(async () => {
    for (const name of createdDbs) {
      await adminPool
        .query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
        .catch(async () => {
          await adminPool
            .query(`DROP DATABASE IF EXISTS "${name}"`)
            .catch(() => undefined);
        });
    }
    await adminPool.end().catch(() => undefined);
  }, 60_000);

  it('discovers at least one numbered migration to exercise', () => {
    expect(MIGRATION_FILES.length).toBeGreaterThan(0);
    for (const f of MIGRATION_FILES) {
      expect(f).toMatch(NUMBERED_RE);
    }
  });

  it('--baseline records every migration as applied without running its SQL', async () => {
    const url = await freshDb(adminPool, createdDbs);
    const r = await runRunner(url, ['--baseline']);
    expect(r.stderr).toBe('');
    expect(r.exitCode).toBe(0);
    // Baselining never executes per-file SQL, so the "  -> file" lines
    // (only emitted from the apply loop) must not appear.
    expect(r.appliedFromStdout).toEqual([]);
    expect(r.stdout).toMatch(/baselining \d+ file\(s\)/);

    const probe = new Pool({ connectionString: url });
    try {
      const { rows } = await probe.query<{ filename: string }>(
        'SELECT filename FROM schema_migrations ORDER BY filename',
      );
      expect(rows.map((row) => row.filename)).toEqual(MIGRATION_FILES);

      // Every file is recorded exactly once.
      const dup = await probe.query(
        `SELECT filename
           FROM schema_migrations
          GROUP BY filename
         HAVING COUNT(*) > 1`,
      );
      expect(dup.rows).toEqual([]);

      // Strong proof that no migration SQL ran: tables and types
      // created by 0000_sparkling_korg.sql must NOT exist.
      const tbl = await probe.query<{ x: string | null }>(
        `SELECT to_regclass('public.actionable_items')::text AS x`,
      );
      expect(tbl.rows[0].x).toBeNull();
      const typ = await probe.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM pg_type
           WHERE typname = 'actionable_item_status'
         ) AS exists`,
      );
      expect(typ.rows[0].exists).toBe(false);
    } finally {
      await probe.end();
    }
  }, 90_000);

  it('auto-baselines via the users-table heuristic, then a second run is a no-op', async () => {
    // Simulate a "production-shaped" DB: the application schema is
    // already present (so `tableExists('users')` is true) but no
    // `schema_migrations` row has ever been written. This is the exact
    // state the very first deploy of the runner sees.
    const url = await freshDb(adminPool, createdDbs);
    const seed = new Pool({ connectionString: url });
    try {
      // The runner only consults the presence of `public.users` to
      // decide whether to auto-baseline; we do not need the rest of
      // the schema for this branch.
      await seed.query('CREATE TABLE users (id text PRIMARY KEY)');
    } finally {
      await seed.end();
    }

    const first = await runRunner(url, []);
    expect(first.stderr).toBe('');
    expect(first.exitCode).toBe(0);
    expect(first.stdout).toMatch(
      new RegExp(`baselining ${MIGRATION_FILES.length} file\\(s\\)`),
    );
    // Auto-baseline path: no per-file apply lines, ever.
    expect(first.appliedFromStdout).toEqual([]);
    expect(first.stdout).toMatch(/No pending migrations\./);

    const probe = new Pool({ connectionString: url });
    try {
      // schema_migrations has exactly one row per numbered file.
      const { rows } = await probe.query<{ filename: string; n: string }>(
        `SELECT filename, COUNT(*)::text AS n
           FROM schema_migrations
          GROUP BY filename
          ORDER BY filename`,
      );
      expect(rows.map((r) => r.filename)).toEqual(MIGRATION_FILES);
      for (const r of rows) expect(r.n).toBe('1');

      // No migration SQL executed: a table from 0000 still doesn't exist.
      const tbl = await probe.query<{ x: string | null }>(
        `SELECT to_regclass('public.actionable_items')::text AS x`,
      );
      expect(tbl.rows[0].x).toBeNull();
    } finally {
      await probe.end();
    }

    const second = await runRunner(url, []);
    expect(second.stderr).toBe('');
    expect(second.exitCode).toBe(0);
    expect(second.appliedFromStdout).toEqual([]);
    expect(second.stdout).not.toMatch(/baselining/);
    expect(second.stdout).toMatch(/No pending migrations\./);

    // The history table did not grow on the second invocation.
    const probe2 = new Pool({ connectionString: url });
    try {
      const { rows } = await probe2.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM schema_migrations',
      );
      expect(rows[0].count).toBe(String(MIGRATION_FILES.length));
    } finally {
      await probe2.end();
    }
  }, 120_000);

  it('with a partial schema_migrations history, only the missing files are applied', async () => {
    // Need at least 2 migrations to meaningfully exercise "partial".
    expect(MIGRATION_FILES.length).toBeGreaterThanOrEqual(2);

    // Stand up a real production-shaped schema via drizzle-kit push so
    // the trailing migrations (which `ALTER` real tables) can actually
    // execute. The trailing migrations in this repo are written
    // idempotently (`IF NOT EXISTS`, `duplicate_object` guards), so
    // re-applying them against the pushed schema is safe — exactly
    // the property we want to assert about a partial replay.
    const url = await freshDb(adminPool, createdDbs);
    await drizzleKitPush(url);

    // First run should auto-baseline (users exists, history empty).
    const baseline = await runRunner(url, []);
    expect(baseline.stderr).toBe('');
    expect(baseline.exitCode).toBe(0);
    expect(baseline.stdout).toMatch(/baselining/);
    expect(baseline.appliedFromStdout).toEqual([]);

    // Seed a partial history by deleting the last few rows.
    const missing = MIGRATION_FILES.slice(-2);
    const seed = new Pool({ connectionString: url });
    try {
      await seed.query(
        'DELETE FROM schema_migrations WHERE filename = ANY($1::text[])',
        [missing],
      );
      const { rows } = await seed.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM schema_migrations',
      );
      expect(rows[0].count).toBe(
        String(MIGRATION_FILES.length - missing.length),
      );
    } finally {
      await seed.end();
    }

    const partial = await runRunner(url, []);
    expect(partial.stderr).toBe('');
    expect(partial.exitCode).toBe(0);
    // Auto-baseline must NOT trigger here: history is non-empty, so
    // the runner must take the apply path for just the missing files.
    expect(partial.stdout).not.toMatch(/baselining/);
    expect(partial.appliedFromStdout).toEqual(missing);
    expect(partial.stdout).toMatch(
      new RegExp(`Applied ${missing.length} migration\\(s\\)`),
    );

    const probe = new Pool({ connectionString: url });
    try {
      // After the partial replay, the history is whole again and every
      // file is recorded exactly once.
      const { rows } = await probe.query<{ filename: string; n: string }>(
        `SELECT filename, COUNT(*)::text AS n
           FROM schema_migrations
          GROUP BY filename
          ORDER BY filename`,
      );
      expect(rows.map((r) => r.filename)).toEqual(MIGRATION_FILES);
      for (const r of rows) expect(r.n).toBe('1');
    } finally {
      await probe.end();
    }
  }, 240_000);
});
