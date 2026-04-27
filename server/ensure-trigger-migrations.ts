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
 */

import type { Pool } from '@neondatabase/serverless';
import { join } from 'path';
import { readFileSync } from 'fs';

const DEFAULT_LOCK_TIMEOUT_MS = 5_000;
const DEFAULT_STATEMENT_TIMEOUT_MS = 15_000;

function getLockTimeoutMs(): number {
  const v = parseInt(process.env.TRIGGER_REAPPLY_LOCK_TIMEOUT_MS ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_LOCK_TIMEOUT_MS;
}

function getStatementTimeoutMs(): number {
  const v = parseInt(process.env.TRIGGER_REAPPLY_STATEMENT_TIMEOUT_MS ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_STATEMENT_TIMEOUT_MS;
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
}
