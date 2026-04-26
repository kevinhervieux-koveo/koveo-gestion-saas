/* eslint-env node */
/**
 * Task #1155: Stop stale orphan rows from blocking integration test setup.
 *
 * Drizzle's `drizzle-kit push --force` will fail when an existing FK
 * constraint cannot be created/strengthened because the target table
 * already contains rows whose FK column points at a row that no longer
 * exists in the referenced table. The original failure (16 rows in
 * `client_document_fingerprints` referencing deleted organizations)
 * blocked the integration test suite for everyone until those rows were
 * removed by hand.
 *
 * This script generalises the fix: it introspects every Drizzle-modeled
 * FK in `@shared/schema`, queries the database for orphan rows, and
 * either auto-cleans them (matching the FK's declared `onDelete`
 * semantics) or — when the FK is `restrict` / `no action` / `set
 * default` and we cannot safely guess intent — prints a clear,
 * actionable error pointing at the offending table/column/row IDs and
 * exits non-zero so CI fails loudly rather than mysteriously.
 *
 * Designed to run before `drizzle-kit push` in `jest.global-setup.cjs`.
 *
 * Safety:
 * - Refuses to run against a URL that looks like production unless
 *   `ALLOW_DB_PUSH_IN_TESTS=1` is set (mirrors the global-setup gate).
 * - All cleanup statements run inside a single transaction per FK so
 *   any unexpected failure leaves the table untouched.
 * - Honours `SKIP_ORPHAN_FK_CLEANUP=1` (same env that gates the call
 *   inside `jest.global-setup.cjs`) so direct script invocations during
 *   debugging behave identically to the global-setup wrapper.
 *
 * Manual usage:
 *   DATABASE_URL=postgres://... npx tsx scripts/clean-orphan-fk-rows.ts
 *   DATABASE_URL=... npx tsx scripts/clean-orphan-fk-rows.ts --report-only
 *
 * Task #1164 also exports the building blocks below so an integration
 * test can drive the cleanup against scoped fixture FKs without
 * spawning a child process.
 */

import pg from 'pg';
const { Client } = pg;
type PgClient = pg.Client;
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { is } from 'drizzle-orm';
import * as schema from '../shared/schema';

export type OnDelete = 'cascade' | 'restrict' | 'no action' | 'set null' | 'set default' | undefined;

export interface FkInfo {
  childTable: string;
  childColumns: string[];
  parentTable: string;
  parentColumns: string[];
  onDelete: OnDelete;
}

export interface OrphanReport {
  fk: FkInfo;
  orphanCount: number;
  sampleIds: string[];
}

function maskDbUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.username ? '***@' : ''}${u.host}${u.pathname}`;
  } catch {
    return '<invalid url>';
  }
}

function looksLikeProductionUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    const haystack = `${u.hostname} ${u.pathname}`.toLowerCase();
    return /(^|[._-])(prod|production|live)([._-]|$)/.test(haystack);
  } catch {
    return false;
  }
}

function quoteIdent(name: string): string {
  return '"' + name.replace(/"/g, '""') + '"';
}

export function collectForeignKeys(): FkInfo[] {
  const out: FkInfo[] = [];
  for (const value of Object.values(schema as Record<string, unknown>)) {
    if (!value || !is(value as object, PgTable)) continue;
    const table = value as PgTable;
    let cfg;
    try {
      cfg = getTableConfig(table);
    } catch {
      continue;
    }
    for (const fk of cfg.foreignKeys) {
      const ref = fk.reference();
      const childCols = ref.columns.map((c) => c.name);
      const parentCols = ref.foreignColumns.map((c) => c.name);
      const parentTableName = (() => {
        try {
          return getTableConfig(ref.foreignTable).name;
        } catch {
          return '<unknown>';
        }
      })();
      if (childCols.length === 0 || parentCols.length === 0) continue;
      if (childCols.length !== parentCols.length) continue;
      out.push({
        childTable: cfg.name,
        childColumns: childCols,
        parentTable: parentTableName,
        parentColumns: parentCols,
        onDelete: fk.onDelete as OnDelete,
      });
    }
  }
  // De-duplicate identical FKs (Drizzle can list both column-level and
  // table-level definitions for the same constraint in some configs).
  const seen = new Set<string>();
  return out.filter((fk) => {
    const key = [
      fk.childTable,
      fk.childColumns.join(','),
      fk.parentTable,
      fk.parentColumns.join(','),
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function tableExists(client: PgClient, tableName: string): Promise<boolean> {
  const r = await client.query(
    `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
       LIMIT 1`,
    [tableName],
  );
  return r.rowCount > 0;
}

export async function findOrphans(client: PgClient, fk: FkInfo): Promise<OrphanReport | null> {
  // Skip if either table is missing (first-ever push to an empty DB).
  if (!(await tableExists(client, fk.childTable))) return null;
  if (!(await tableExists(client, fk.parentTable))) return null;

  const childCols = fk.childColumns.map(quoteIdent);
  const parentCols = fk.parentColumns.map(quoteIdent);
  const child = quoteIdent(fk.childTable);
  const parent = quoteIdent(fk.parentTable);

  // Treat NULL FK columns as legal (FK never enforces NULL). Composite
  // FKs are orphaned only when every column is non-NULL and no parent
  // row matches.
  const notNullClauses = childCols.map((c) => `c.${c} IS NOT NULL`).join(' AND ');
  const joinClauses = childCols.map((c, i) => `c.${c} = p.${parentCols[i]}`).join(' AND ');

  const sql = `
    SELECT c.ctid::text AS ctid
      FROM ${child} c
      LEFT JOIN ${parent} p ON ${joinClauses}
     WHERE ${notNullClauses}
       AND p.${parentCols[0]} IS NULL
     LIMIT 10
  `;
  let r: pg.QueryResult<{ ctid: string }>;
  try {
    r = await client.query<{ ctid: string }>(sql);
  } catch (err: unknown) {
    // A column might be defined in the schema but not yet present in the
    // DB (drizzle-kit push hasn't run yet). Treat as "no orphans we can
    // see" — the push itself will surface a clearer error if needed.
    const code = (err as { code?: string } | null)?.code;
    if (code === '42703' || code === '42P01') return null;
    throw err;
  }
  if (r.rowCount === 0) return null;

  const countRes = await client.query<{ n: number }>(`
    SELECT count(*)::int AS n
      FROM ${child} c
      LEFT JOIN ${parent} p ON ${joinClauses}
     WHERE ${notNullClauses}
       AND p.${parentCols[0]} IS NULL
  `);
  const orphanCount = countRes.rows[0]?.n ?? r.rowCount;

  // Sample IDs: prefer a column literally named `id` if present, else
  // emit ctid for diagnostics.
  let sampleIds: string[];
  try {
    const idRes = await client.query<{ id: string }>(`
      SELECT c.id::text AS id
        FROM ${child} c
        LEFT JOIN ${parent} p ON ${joinClauses}
       WHERE ${notNullClauses}
         AND p.${parentCols[0]} IS NULL
       LIMIT 10
    `);
    sampleIds = idRes.rows.map((row) => String(row.id));
  } catch {
    sampleIds = r.rows.map((row) => `ctid=${row.ctid}`);
  }

  return { fk, orphanCount, sampleIds };
}

export async function cleanOrphans(
  client: PgClient,
  report: OrphanReport,
  reportOnly: boolean,
): Promise<{ action: 'deleted' | 'nulled' | 'reported'; rows: number }> {
  const { fk, orphanCount } = report;
  const childCols = fk.childColumns.map(quoteIdent);
  const parentCols = fk.parentColumns.map(quoteIdent);
  const child = quoteIdent(fk.childTable);
  const parent = quoteIdent(fk.parentTable);
  const notNullClauses = childCols.map((c) => `c.${c} IS NOT NULL`).join(' AND ');
  const joinClauses = childCols.map((c, i) => `c.${c} = p.${parentCols[i]}`).join(' AND ');
  const orphanSelect = `
    SELECT c.ctid AS ctid
      FROM ${child} c
      LEFT JOIN ${parent} p ON ${joinClauses}
     WHERE ${notNullClauses}
       AND p.${parentCols[0]} IS NULL
  `;

  if (reportOnly) {
    return { action: 'reported', rows: orphanCount };
  }

  if (fk.onDelete === 'cascade') {
    // Cascade FKs are *supposed* to never have orphans (the constraint
    // itself would have removed them on parent delete). Their existence
    // means the constraint wasn't in place when the parent was deleted,
    // so deleting the orphans is the only outcome consistent with the
    // declared semantics.
    await client.query('BEGIN');
    try {
      const r = await client.query(
        `DELETE FROM ${child} WHERE ctid IN (${orphanSelect})`,
      );
      await client.query('COMMIT');
      return { action: 'deleted', rows: r.rowCount ?? 0 };
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    }
  }

  if (fk.onDelete === 'set null') {
    const setClause = childCols.map((c) => `${c} = NULL`).join(', ');
    await client.query('BEGIN');
    try {
      const r = await client.query(
        `UPDATE ${child} SET ${setClause} WHERE ctid IN (${orphanSelect})`,
      );
      await client.query('COMMIT');
      return { action: 'nulled', rows: r.rowCount ?? 0 };
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    }
  }

  // restrict / no action / set default / undefined: don't guess. Caller
  // converts this into a fatal error.
  return { action: 'reported', rows: orphanCount };
}

export function formatFk(fk: FkInfo): string {
  return `${fk.childTable}(${fk.childColumns.join(',')}) -> ${fk.parentTable}(${fk.parentColumns.join(',')})`;
}

export interface RunCleanupOptions {
  /**
   * Caller-supplied client. The function does NOT open or close it,
   * so the test harness can keep the connection across calls.
   */
  client: PgClient;
  /** FK list to scan. Defaults to every FK declared in `@shared/schema`. */
  fks?: FkInfo[];
  /** When true, never write — just count what would be cleaned. */
  reportOnly?: boolean;
  /** Override logging (defaults to `console.log`). */
  log?: (message: string) => void;
}

export interface RunCleanupResult {
  cleanedTotal: number;
  fatalReports: OrphanReport[];
  perFk: Array<{ fk: FkInfo; action: 'deleted' | 'nulled' | 'reported'; rows: number }>;
}

/**
 * Core cleanup loop, factored out of `main()` so integration tests can
 * exercise it directly against scoped fixture FKs without spawning a
 * child process. `main()` itself is just a CLI wrapper around this.
 */
export async function runCleanup(opts: RunCleanupOptions): Promise<RunCleanupResult> {
  const { client, reportOnly = false } = opts;
  const log = opts.log ?? ((m: string) => console.log(m));
  const fks = opts.fks ?? collectForeignKeys();

  const fatalReports: OrphanReport[] = [];
  const perFk: RunCleanupResult['perFk'] = [];
  let cleanedTotal = 0;

  for (const fk of fks) {
    const report = await findOrphans(client, fk);
    if (!report) continue;
    const result = await cleanOrphans(client, report, reportOnly);
    perFk.push({ fk, action: result.action, rows: result.rows });
    if (result.action === 'deleted' || result.action === 'nulled') {
      cleanedTotal += result.rows;
      log(
        `[clean-orphan-fk-rows] ${result.action} ${result.rows} orphan row(s) for ` +
          `${formatFk(fk)} (onDelete=${fk.onDelete})`,
      );
    } else if (fk.onDelete === 'cascade' || fk.onDelete === 'set null') {
      // Report-only mode for an auto-cleanable FK.
      log(
        `[clean-orphan-fk-rows] would clean ${result.rows} orphan row(s) for ` +
          `${formatFk(fk)} (onDelete=${fk.onDelete})`,
      );
    } else {
      fatalReports.push(report);
    }
  }

  return { cleanedTotal, fatalReports, perFk };
}

/**
 * Build the human-readable error message for FKs whose orphans we
 * refuse to auto-clean. Exported so tests can assert that the failure
 * surfaces the offending table, columns, and at least one sample row
 * id without depending on whether `main()` was called.
 */
export function buildFatalMessage(reports: OrphanReport[]): string {
  const lines = reports.map((r) => {
    const ids = r.sampleIds.length > 0 ? ` sample ids: ${r.sampleIds.join(', ')}` : '';
    return (
      `  - ${formatFk(r.fk)} (onDelete=${r.fk.onDelete ?? 'no action'}): ` +
      `${r.orphanCount} orphan row(s).${ids}`
    );
  });
  return (
    `[clean-orphan-fk-rows] Refusing to auto-clean orphan rows for FKs without a safe ` +
    `cascade/set-null policy. Resolve manually before re-running drizzle-kit push:\n` +
    lines.join('\n') +
    `\n\nSee docs/INTEGRATION_DB_ORPHAN_CLEANUP.md for the recommended procedure.`
  );
}

export interface MainOptions {
  /**
   * Override the FK list normally collected from `@shared/schema`.
   * Lets integration tests drive the CLI entrypoint against scoped
   * fixture FKs without mutating the application schema.
   */
  fks?: FkInfo[];
  /**
   * Inject a pre-connected `pg.Client`. When provided, `main()` will
   * NOT open or close the connection — the caller owns its lifecycle.
   * Used by tests so they can keep the same connection that planted
   * the fixture rows. When omitted, `main()` connects to
   * `_INTEGRATION_DB_URL`/`DATABASE_URL` itself, the way the CLI does.
   */
  client?: PgClient;
}

export async function main(opts: MainOptions = {}): Promise<void> {
  // Honour the same opt-out the global-setup uses. Keeps direct
  // `npx tsx scripts/clean-orphan-fk-rows.ts` invocations consistent
  // with the env you'd flip to triage the cleanup itself.
  if (process.env.SKIP_ORPHAN_FK_CLEANUP === '1') {
    console.log('[clean-orphan-fk-rows] skip: SKIP_ORPHAN_FK_CLEANUP=1');
    return;
  }

  const databaseUrl = process.env._INTEGRATION_DB_URL || process.env.DATABASE_URL;
  if (!databaseUrl && !opts.client) {
    console.log('[clean-orphan-fk-rows] skip: no DATABASE_URL/_INTEGRATION_DB_URL configured');
    return;
  }

  if (databaseUrl && looksLikeProductionUrl(databaseUrl) && process.env.ALLOW_DB_PUSH_IN_TESTS !== '1') {
    throw new Error(
      `[clean-orphan-fk-rows] Refusing to clean orphans against a production-shaped URL ` +
        `(${maskDbUrl(databaseUrl)}). Set ALLOW_DB_PUSH_IN_TESTS=1 to override.`,
    );
  }

  const reportOnly =
    process.argv.includes('--report-only') || process.env.ORPHAN_CLEANUP_REPORT_ONLY === '1';

  const fks = opts.fks ?? collectForeignKeys();
  const target = databaseUrl ? maskDbUrl(databaseUrl) : '<injected client>';
  console.log(
    `[clean-orphan-fk-rows] scanning ${fks.length} FK constraint(s) on ${target}` +
      (reportOnly ? ' (report-only)' : ''),
  );

  const ownsClient = !opts.client;
  const client = opts.client ?? new Client({ connectionString: databaseUrl! });
  if (ownsClient) await client.connect();

  let result: RunCleanupResult;
  try {
    result = await runCleanup({ client, fks, reportOnly });
  } finally {
    if (ownsClient) await client.end().catch(() => undefined);
  }

  if (result.fatalReports.length > 0) {
    // Throwing here is what drives the non-zero CLI exit (the
    // `isCliEntry()` block below catches and calls `process.exit(1)`).
    // Tests assert on `.rejects.toThrow(...)` to lock that contract in.
    throw new Error(buildFatalMessage(result.fatalReports));
  }

  if (result.cleanedTotal === 0) {
    console.log('[clean-orphan-fk-rows] no orphan rows found');
  } else {
    console.log(`[clean-orphan-fk-rows] cleaned ${result.cleanedTotal} orphan row(s) total`);
  }
}

/**
 * CLI entrypoint guard. Only auto-run `main()` when this file was
 * invoked directly (e.g. `npx tsx scripts/clean-orphan-fk-rows.ts`),
 * never when imported by a test or other module.
 */
function isCliEntry(): boolean {
  const entry = process.argv[1] ?? '';
  return /clean-orphan-fk-rows\.(ts|js|mjs|cjs)$/.test(entry);
}

if (isCliEntry()) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
