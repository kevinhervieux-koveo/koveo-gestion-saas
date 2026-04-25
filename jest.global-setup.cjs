/* eslint-env node */
// Task #278: sync the Drizzle schema to the integration DB once before
// any test runs, so real-Postgres tests never execute against a stale
// schema (this is the regression that surfaced in Task #273 — the
// missing `bills.source` column from migration 0008).
//
// Trigger is deterministic: any Jest invocation where
// `_INTEGRATION_DB_URL`/`DATABASE_URL` is set runs schema sync.
// Opt-out: `TEST_TYPE=unit` (used by `test:unit`/`test:fast`) or
// `SKIP_INTEGRATION_DB_SYNC=1`.

const { spawn } = require('child_process');

const PUSH_TIMEOUT_MS = 120_000;

function maskDbUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.username ? '***@' : ''}${u.host}${u.pathname}`;
  } catch {
    return '<invalid url>';
  }
}

function runDrizzleKitPush(databaseUrl) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['drizzle-kit', 'push', '--force'], {
      cwd: __dirname,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const out = [];
    const err = [];
    child.stdout.on('data', (c) => out.push(c));
    child.stderr.on('data', (c) => err.push(c));

    // `--force` doesn't auto-confirm a non-destructive prompt for
    // adding a UNIQUE constraint to a populated table. Press Enter
    // periodically to accept the highlighted safe default.
    const tick = setInterval(() => {
      if (!child.stdin.destroyed) child.stdin.write('\r');
    }, 1500);

    const killTimer = setTimeout(() => {
      clearInterval(tick);
      child.kill('SIGKILL');
      reject(new Error(`drizzle-kit push timed out after ${PUSH_TIMEOUT_MS}ms`));
    }, PUSH_TIMEOUT_MS);

    child.on('error', (e) => {
      clearInterval(tick);
      clearTimeout(killTimer);
      reject(e);
    });

    child.on('exit', (code) => {
      clearInterval(tick);
      clearTimeout(killTimer);
      child.stdin.end();
      const stdout = Buffer.concat(out).toString('utf8');
      const stderr = Buffer.concat(err).toString('utf8');
      // drizzle-kit push exits 0 even when a SQL statement errors
      // mid-run, so also fail on a captured pg `error: ` line. Task
      // #521: when the test database has already been migrated, the
      // push reports Postgres SQLSTATE 42710 (`duplicate_object`) /
      // 42P07 (`duplicate_table`) as "already exists" lines. Those
      // are no-ops for an idempotent re-sync, so filter them out and
      // only fail on the remaining (genuine) errors.
      const combined = `${stdout}\n${stderr}`;
      const errorLines = combined
        .split('\n')
        .filter((line) => /^error:\s/i.test(line));
      const benignErrorLines = errorLines.filter((line) => /already exists/i.test(line));
      const fatalErrorLines = errorLines.filter((line) => !/already exists/i.test(line));
      if (code !== 0 || fatalErrorLines.length > 0) {
        reject(new Error(
          `drizzle-kit push failed (exit ${code})\n${stdout}\n${stderr}`,
        ));
      } else {
        if (benignErrorLines.length > 0) {
          console.log(
            `[jest.global-setup] ignored ${benignErrorLines.length} ` +
            `benign "already exists" error(s) from drizzle-kit push`,
          );
        }
        resolve();
      }
    });
  });
}

// Trigger condition mirrors the real-DB gate that integration tests
// themselves use (`_INTEGRATION_DB_URL`/`DATABASE_URL`). Any Jest
// invocation where a real DB is reachable runs schema sync, so a
// broad `jest` run in CI cannot accidentally execute integration
// tests against a stale schema. Opt-out: `TEST_TYPE=unit` (set by the
// `test:unit`/`test:fast` npm scripts) or `SKIP_INTEGRATION_DB_SYNC=1`.

module.exports = async function globalSetup() {
  if (process.env.TEST_TYPE === 'unit') {
    console.log('[jest.global-setup] skip: TEST_TYPE=unit');
    return;
  }
  if (process.env.SKIP_INTEGRATION_DB_SYNC === '1') {
    console.log('[jest.global-setup] skip: SKIP_INTEGRATION_DB_SYNC=1');
    return;
  }

  const databaseUrl = process.env._INTEGRATION_DB_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    if (process.env.REQUIRE_INTEGRATION_DB_URL === '1') {
      throw new Error(
        '[jest.global-setup] REQUIRE_INTEGRATION_DB_URL=1 but no DATABASE_URL configured.',
      );
    }
    console.log('[jest.global-setup] skip: no DATABASE_URL/_INTEGRATION_DB_URL configured');
    return;
  }

  // Refuse to push against a URL that looks like production unless
  // explicitly allowed. Catches the "wrong DATABASE_URL" foot-gun.
  if (looksLikeProductionUrl(databaseUrl) && process.env.ALLOW_DB_PUSH_IN_TESTS !== '1') {
    throw new Error(
      `[jest.global-setup] Refusing drizzle-kit push against a production-shaped URL ` +
      `(${maskDbUrl(databaseUrl)}). Set ALLOW_DB_PUSH_IN_TESTS=1 to override.`,
    );
  }

  console.log(
    `[jest.global-setup] drizzle-kit push --force → ${maskDbUrl(databaseUrl)}`,
  );
  await runDrizzleKitPush(databaseUrl);

  // `drizzle-kit push` only syncs Drizzle-modeled schema (tables, columns,
  // indexes). It does NOT create custom DB objects that exist solely in
  // the numbered SQL migrations — most importantly the trigger added in
  // `migrations/0010_demands_residence_building_check.sql`, which enforces
  // the cross-organisation invariant on `demands.residence_id`. The
  // numbered migration runner cannot help us here either: after a fresh
  // `drizzle-kit push`, `users` exists but `schema_migrations` is empty,
  // which causes `scripts/run-migrations.ts` to auto-baseline (i.e. mark
  // every migration as already applied, without executing it). To
  // guarantee the trigger is present for tests that rely on it (and for
  // the backfill test that disables/re-enables it), apply the SQL of any
  // such "schema-orthogonal" migrations directly. They are written to be
  // idempotent (`CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS`).
  await applyTriggerOnlyMigrations(databaseUrl, [
    '0010_demands_residence_building_check.sql',
  ]);
};

async function applyTriggerOnlyMigrations(databaseUrl, filenames) {
  // Lazy-require so unit-test runs that early-return above never need to
  // resolve the pg client. Use `pg` (already a transitive dep) over
  // `@neondatabase/serverless` so this works against both Neon and a
  // plain local Postgres without WebSocket plumbing.
  const path = require('path');
  const fs = require('fs');
  const { Client } = require('pg');

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    for (const filename of filenames) {
      const sqlPath = path.join(__dirname, 'migrations', filename);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      console.log(
        `[jest.global-setup] applying ${filename} idempotently → ${maskDbUrl(databaseUrl)}`,
      );
      await client.query(sql);
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

function looksLikeProductionUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const haystack = `${u.hostname} ${u.pathname}`.toLowerCase();
    return /(^|[._-])(prod|production|live)([._-]|$)/.test(haystack);
  } catch {
    return false;
  }
}
