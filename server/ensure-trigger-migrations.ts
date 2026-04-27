/**
 * Best-effort idempotent re-application of trigger-only migrations.
 *
 * CONTRACT:
 * - This step is best-effort drift repair, NOT a gate on serving traffic.
 *   Real schema drift is detected by the numbered migration runner
 *   (`runMigrations`) and the post-deploy verifier (`verifyMigrationsApplied` /
 *   `/api/admin/migration-status`). Failures here are logged loudly but do NOT
 *   block the frontend from starting.
 * - Each SQL file executes inside its own transaction with a bounded
 *   `lock_timeout` (default 5 s) and `statement_timeout` (default 15 s),
 *   overridable via the env vars `TRIGGER_REAPPLY_LOCK_TIMEOUT_MS` and
 *   `TRIGGER_REAPPLY_STATEMENT_TIMEOUT_MS`. A timeout triggers a "lock
 *   contention" log entry that is easy to grep.
 * - On failure the log line includes the real Postgres error fields
 *   (`code`/SQLSTATE, `message`, `detail`, `hint`, `where`, `schema`, `table`,
 *   `constraint`) — not the SQL file body. The SQL body is only emitted at
 *   debug level when `TRIGGER_REAPPLY_DEBUG_SQL=true`.
 * - This function NEVER throws. It logs a summary and returns a result object
 *   so the caller can decide whether to surface a warning.
 *
 * CROSS-CONTAINER SERIALIZATION (Task #1443):
 * - When `opts.advisoryLockKey` is supplied, the entire pass runs while
 *   holding `pg_advisory_lock(key)` on a dedicated session. The migration
 *   runner already uses the same key, so re-using it serializes BOTH
 *   phases of boot-time DDL across concurrent containers. Without this,
 *   two boots can interleave a RowExclusiveLock-holding UPDATE (e.g.
 *   0015's cross-org cleanup on `demands`) with an AccessExclusiveLock-
 *   needing DROP/CREATE TRIGGER (0010/0012) on the same table and
 *   trigger the 5:11 AM-style 55P03 lock-wait failure.
 * - The advisory-lock acquire is bounded by `statement_timeout` (default
 *   30 s, override via `TRIGGER_REAPPLY_ADVISORY_LOCK_TIMEOUT_MS`). If
 *   the lock cannot be acquired in that window, the function logs a
 *   structured warning, returns an empty result, and does NOT throw —
 *   the peer container holding the lock will install the triggers
 *   anyway, so skipping is safe and consistent with the non-fatal
 *   contract above.
 */

import type { Pool } from '@neondatabase/serverless';
import { join } from 'path';
import { readFileSync } from 'fs';

const DEFAULT_LOCK_TIMEOUT_MS = 5_000;
const DEFAULT_STATEMENT_TIMEOUT_MS = 15_000;
const DEFAULT_ADVISORY_LOCK_TIMEOUT_MS = 30_000;

function getLockTimeoutMs(): number {
  const v = parseInt(process.env.TRIGGER_REAPPLY_LOCK_TIMEOUT_MS ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_LOCK_TIMEOUT_MS;
}

function getStatementTimeoutMs(): number {
  const v = parseInt(process.env.TRIGGER_REAPPLY_STATEMENT_TIMEOUT_MS ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_STATEMENT_TIMEOUT_MS;
}

function getAdvisoryLockTimeoutMs(): number {
  const v = parseInt(process.env.TRIGGER_REAPPLY_ADVISORY_LOCK_TIMEOUT_MS ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_ADVISORY_LOCK_TIMEOUT_MS;
}

export interface TriggerMigrationResult {
  ok: string[];
  failed: string[];
}

export type TriggerMigrationLogger = (msg: string, level?: 'info' | 'error') => void;

function defaultLogger(msg: string, level?: 'info' | 'error'): void {
  if (level === 'error') {
    console.error(`[trigger-migrations] ${msg}`);
  } else {
    console.log(`[trigger-migrations] ${msg}`);
  }
}

/**
 * Resolves the default migrations directory relative to the process working
 * directory (always the project root in both production and tests). This avoids
 * `import.meta.url` at the module level so Jest's CommonJS transform can import
 * the module without issue. The injected `opts.migrationsDir` takes precedence
 * in tests anyway.
 */
function getDefaultMigrationsDir(): string {
  return join(process.cwd(), 'migrations');
}

export async function ensureTriggerOnlyMigrations(
  filenames: string[],
  opts?: {
    pool?: Pool;
    readFile?: (path: string) => string;
    migrationsDir?: string;
    logger?: TriggerMigrationLogger;
    /**
     * Postgres advisory-lock key (bigint as string) to hold for the
     * duration of the pass. Pass the SAME key the numbered migration
     * runner uses (`MIGRATION_LOCK_KEY` from scripts/run-migrations.ts)
     * so concurrent containers can't race each other's boot-time DDL
     * on the same tables. When omitted, behaves as before — no
     * cross-container serialization.
     */
    advisoryLockKey?: string;
  },
): Promise<TriggerMigrationResult> {
  const logger = opts?.logger ?? defaultLogger;
  const readFile = opts?.readFile ?? ((p: string) => readFileSync(p, 'utf8'));
  const migrationsDir = opts?.migrationsDir ?? getDefaultMigrationsDir();

  let pool: Pool;
  if (opts?.pool) {
    pool = opts.pool;
  } else {
    const { pool: defaultPool } = await import('./db');
    pool = defaultPool;
  }

  const lockTimeoutMs = getLockTimeoutMs();
  const statementTimeoutMs = getStatementTimeoutMs();

  const ok: string[] = [];
  const failed: string[] = [];

  // Cross-container serialization: hold the migration runner's
  // advisory lock for the full pass when a key is supplied. If the
  // lock can't be acquired in the bounded window, log a warning and
  // skip the pass — the peer container holding the lock will install
  // the triggers anyway.
  let lockClient:
    | { query: (sql: string, params?: unknown[]) => Promise<unknown>; release: () => void }
    | undefined;
  let lockHeld = false;
  if (opts?.advisoryLockKey) {
    const advisoryLockTimeoutMs = getAdvisoryLockTimeoutMs();
    try {
      lockClient = (await pool.connect()) as typeof lockClient;
      // statement_timeout DOES interrupt pg_advisory_lock's wait. We
      // set it at session level (not LOCAL) because the lock survives
      // across transactions/statements on the same session, and we
      // want to reset it cleanly to 0 once acquired.
      await lockClient!.query(
        `SET statement_timeout = '${advisoryLockTimeoutMs}ms'`,
      );
      await lockClient!.query('SELECT pg_advisory_lock($1)', [
        opts.advisoryLockKey,
      ]);
      await lockClient!.query(`SET statement_timeout = '0'`);
      lockHeld = true;
      logger(
        `acquired advisory lock key=${opts.advisoryLockKey} (cross-container serialization)`,
      );
    } catch (lockErr: any) {
      const code = lockErr?.code ?? lockErr?.cause?.code ?? '<no code>';
      const msg = lockErr?.message ?? String(lockErr);
      logger(
        `SKIPPED (advisory lock unavailable): key=${opts.advisoryLockKey} code=${code} ` +
          `message=${JSON.stringify(String(msg).slice(0, 400))}. ` +
          `Another container is most likely holding the migration lock; it will apply these files.`,
        'error',
      );
      try {
        lockClient?.release();
      } catch {
        // ignore
      }
      return { ok, failed };
    }
  }

  try {
  for (const filename of filenames) {
    const sqlPath = join(migrationsDir, filename);
    let ddl: string;
    try {
      ddl = readFile(sqlPath);
    } catch (readErr: any) {
      logger(
        `could not read ${filename}: ${readErr?.message ?? String(readErr)}`,
        'error',
      );
      failed.push(filename);
      continue;
    }

    logger(`🔧 Ensuring trigger-only migration applied: ${filename}`);

    let client: { query: (sql: string) => Promise<unknown>; release: () => void } | undefined;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      await client.query(`SET LOCAL lock_timeout = '${lockTimeoutMs}ms'`);
      await client.query(`SET LOCAL statement_timeout = '${statementTimeoutMs}ms'`);
      await client.query(ddl);
      await client.query('COMMIT');
      ok.push(filename);
    } catch (rawErr: any) {
      if (client) {
        await client.query('ROLLBACK').catch(() => undefined);
      }

      const pgErr: any = rawErr?.cause ?? rawErr;

      const isLockContention =
        pgErr?.code === '55P03' || pgErr?.code === '57014' ||
        rawErr?.code === '55P03' || rawErr?.code === '57014';
      const failureKind = isLockContention ? 'lock contention' : 'execution error';

      const pgCode = pgErr?.code ?? rawErr?.code ?? '<no code>';

      const hasPgFields = pgErr?.routine != null || rawErr?.routine != null;
      const severity = pgErr?.severity ?? rawErr?.severity ?? 'ERROR';
      const rawMsg = pgErr?.message ?? rawErr?.message ?? '<no message>';
      const pgMsg = hasPgFields
        ? `${severity}: ${rawMsg}`
        : String(rawMsg).slice(0, 400);

      const extras: string[] = [];
      for (const field of [
        'detail',
        'hint',
        'where',
        'schema',
        'table',
        'constraint',
      ] as const) {
        const val = pgErr?.[field] ?? rawErr?.[field];
        if (val) {
          extras.push(`${field}=${JSON.stringify(val)}`);
        }
      }
      const extrasStr = extras.length > 0 ? ` ${extras.join(' ')}` : '';

      logger(
        `FAILED (${failureKind}): file=${filename} code=${pgCode} message=${JSON.stringify(pgMsg)}${extrasStr}`,
        'error',
      );

      if (process.env.TRIGGER_REAPPLY_DEBUG_SQL === 'true') {
        logger(`DEBUG SQL for ${filename}:\n${ddl}`, 'error');
      }

      failed.push(filename);
    } finally {
      client?.release();
    }
  }

  const summary = `trigger-only re-application: ${ok.length} ok, ${failed.length} failed${
    failed.length > 0 ? `: [${failed.join(', ')}]` : ''
  }`;
  if (failed.length > 0) {
    logger(`⚠️  ${summary}`, 'error');
  } else {
    logger(`✅ ${summary}`);
  }

  return { ok, failed };
  } finally {
    if (lockHeld && lockClient) {
      try {
        await lockClient.query('SELECT pg_advisory_unlock($1)', [
          opts!.advisoryLockKey!,
        ]);
      } catch (unlockErr: any) {
        // Best-effort: the session ending will release the lock
        // anyway. Log so log scrapers can spot a stuck unlock pattern.
        logger(
          `advisory unlock failed (non-fatal): key=${opts!.advisoryLockKey!} ` +
            `message=${JSON.stringify(String(unlockErr?.message ?? unlockErr).slice(0, 200))}`,
          'error',
        );
      }
    }
    try {
      lockClient?.release();
    } catch {
      // ignore — releasing twice or on a dead client is harmless here.
    }
  }
}
