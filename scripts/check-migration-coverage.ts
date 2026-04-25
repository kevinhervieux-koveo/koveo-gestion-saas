#!/usr/bin/env tsx
/**
 * Schema-drift guard for `shared/schema.ts` vs the cumulative SQL
 * migration set in `migrations/`.
 *
 * Why this exists
 * ---------------
 * The codebase has historically had two parallel ways of evolving the
 * database schema: `drizzle-kit push` (in dev) and hand-written numbered
 * SQL migrations (used by the deploy step via `scripts/run-migrations.ts`).
 * When a developer adds a column to `shared/schemas/*.ts` but forgets to
 * write a matching numbered migration, the dev DB stays in sync (because
 * `db:push` rewrites it) but the deployed prod DB silently rots until
 * someone manually notices missing tables/columns. Migration 0009 was a
 * cleanup for exactly this kind of drift.
 *
 * What this script does
 * ---------------------
 * 1. Spins up two ephemeral in-memory Postgres instances (PGlite).
 * 2. Database A: applies every numbered `NNNN_*.sql` file in `migrations/`
 *    in order (the same files `scripts/run-migrations.ts` would apply).
 * 3. Database B: applies the cumulative SQL produced by
 *    `drizzle-kit export --schema=./shared/schema.ts`, which is what
 *    Drizzle would create from the current TypeScript schema against an
 *    empty database.
 * 4. Introspects both via `information_schema` / `pg_catalog` and reports
 *    structural differences (missing/extra tables, columns, enums, enum
 *    values, primary keys, unique constraints).
 *
 * Exit code
 * ---------
 * - 0 if Database A and Database B are structurally equivalent.
 * - 1 if drift was found, with an actionable list of differences printed
 *   to stderr. Run in CI / pre-commit to fail PRs that change
 *   `shared/schema.ts` without a matching migration.
 *
 * What it intentionally does NOT do
 * ---------------------------------
 * - Compare raw SQL strings (those differ trivially between drizzle-kit
 *   output and hand-written migrations even when the resulting schema is
 *   identical).
 * - Touch the real DATABASE_URL. Both comparisons happen in-memory.
 * - Rewrite or generate any migration file. It only reports.
 */
import { PGlite } from '@electric-sql/pglite';
import { execFileSync } from 'child_process';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';

/**
 * Resolve REPO_ROOT without using `import.meta.url`, so this module can
 * also be loaded by Jest's CJS transformer (the unit test imports it).
 * Walk up from the current working directory until we find package.json.
 */
function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const REPO_ROOT = findRepoRoot();
const MIGRATIONS_DIR = join(REPO_ROOT, 'migrations');
const SCHEMA_PATH = join(REPO_ROOT, 'shared', 'schema.ts');
const NUMBERED_RE = /^\d{4}_.+\.sql$/;

export interface SchemaSnapshot {
  tables: Map<string, Map<string, ColumnInfo>>;
  enums: Map<string, string[]>;
  primaryKeys: Map<string, string[]>;
  uniques: Map<string, Set<string>>; // table -> set of "col1,col2,..." sorted
}

interface ColumnInfo {
  dataType: string;
  udtName: string;
  isNullable: boolean;
}

export interface DriftReport {
  missingTables: string[]; // present in schema, absent in migrations
  extraTables: string[]; // present in migrations, absent in schema
  missingColumns: Array<{ table: string; column: string; type: string }>;
  extraColumns: Array<{ table: string; column: string; type: string }>;
  columnTypeMismatches: Array<{
    table: string;
    column: string;
    schemaType: string;
    migrationType: string;
  }>;
  columnNullabilityMismatches: Array<{
    table: string;
    column: string;
    schemaNullable: boolean;
    migrationNullable: boolean;
  }>;
  missingEnums: string[];
  extraEnums: string[];
  enumValueMismatches: Array<{
    enumName: string;
    missingValues: string[];
    extraValues: string[];
  }>;
  primaryKeyMismatches: Array<{
    table: string;
    schemaPk: string[];
    migrationPk: string[];
  }>;
  missingUniques: Array<{ table: string; columns: string }>;
  extraUniques: Array<{ table: string; columns: string }>;
}

function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => NUMBERED_RE.test(f))
    .sort();
}

/**
 * Split a SQL file into individual statements while respecting
 * `$$`-quoted blocks (used heavily by hand-written DO blocks).
 * Drizzle-generated files use the explicit `--> statement-breakpoint`
 * marker; we honour that first, then split each chunk by top-level
 * semicolons.
 */
export function splitSqlStatements(sql: string): string[] {
  const stripped = sql.replace(/--> statement-breakpoint/g, ';');
  const out: string[] = [];
  let buf = '';
  let inDollar = false;
  let dollarTag = '';
  let inLineComment = false;
  let inBlockComment = false;
  let inSingle = false;
  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i];
    const next = stripped[i + 1];
    if (inLineComment) {
      buf += ch;
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      buf += ch;
      if (ch === '*' && next === '/') {
        buf += next;
        i++;
        inBlockComment = false;
      }
      continue;
    }
    if (inSingle) {
      buf += ch;
      if (ch === "'" && next === "'") {
        buf += next;
        i++;
      } else if (ch === "'") {
        inSingle = false;
      }
      continue;
    }
    if (inDollar) {
      buf += ch;
      if (ch === '$') {
        const rest = stripped.slice(i);
        if (rest.startsWith(dollarTag)) {
          buf += dollarTag.slice(1);
          i += dollarTag.length - 1;
          inDollar = false;
          dollarTag = '';
        }
      }
      continue;
    }
    if (ch === '-' && next === '-') {
      inLineComment = true;
      buf += ch;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      buf += ch;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      buf += ch;
      continue;
    }
    if (ch === '$') {
      const m = stripped.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (m) {
        dollarTag = m[0];
        inDollar = true;
        buf += dollarTag;
        i += dollarTag.length - 1;
        continue;
      }
    }
    if (ch === ';') {
      const stmt = buf.trim();
      if (stmt.length > 0) out.push(stmt);
      buf = '';
      continue;
    }
    buf += ch;
  }
  const tail = buf.trim();
  if (tail.length > 0) out.push(tail);
  return out;
}

interface MigrationApplyError {
  file: string;
  statementPreview: string;
  error: string;
}

async function applyMigrations(
  db: PGlite,
): Promise<MigrationApplyError[]> {
  // We deliberately do NOT abort on per-statement failures. The whole
  // point of this guard is to detect drift, and the most common drift
  // symptom is exactly an ALTER/INSERT in a later migration referring
  // to a table that was never CREATEd by any migration (because the
  // table was only ever created via `db:push`). Continuing lets us
  // surface that as a "missing table" diff instead of a hard crash.
  const errors: MigrationApplyError[] = [];
  for (const file of listMigrationFiles()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const statements = splitSqlStatements(sql);
    for (const stmt of statements) {
      try {
        await db.exec(stmt);
      } catch (e) {
        errors.push({
          file,
          statementPreview: stmt.replace(/\s+/g, ' ').slice(0, 120),
          error: (e as Error).message,
        });
      }
    }
  }
  return errors;
}

function exportSchemaSql(): string {
  // drizzle-kit prints some progress lines to stderr; capture stdout only.
  const out = execFileSync(
    'npx',
    [
      'drizzle-kit',
      'export',
      '--dialect=postgresql',
      `--schema=${SCHEMA_PATH}`,
    ],
    { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return out;
}

async function applySchema(db: PGlite, sql: string): Promise<void> {
  try {
    await db.exec(sql);
  } catch (e) {
    throw new Error(
      `[drift-check] Failed to apply drizzle-kit export to ephemeral DB: ${(e as Error).message}`,
    );
  }
}

export async function snapshot(db: PGlite): Promise<SchemaSnapshot> {
  const tables = new Map<string, Map<string, ColumnInfo>>();
  const cols = await db.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    udt_name: string;
    is_nullable: string;
  }>(
    `SELECT table_name, column_name, data_type, udt_name, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public'
     ORDER BY table_name, ordinal_position`,
  );
  for (const row of cols.rows) {
    let cmap = tables.get(row.table_name);
    if (!cmap) {
      cmap = new Map();
      tables.set(row.table_name, cmap);
    }
    cmap.set(row.column_name, {
      dataType: normalizeType(row.data_type, row.udt_name),
      udtName: row.udt_name,
      isNullable: row.is_nullable === 'YES',
    });
  }

  const enums = new Map<string, string[]>();
  const enumRows = await db.query<{ enum_name: string; enum_value: string }>(
    `SELECT t.typname AS enum_name, e.enumlabel AS enum_value
     FROM pg_type t
     JOIN pg_enum e ON e.enumtypid = t.oid
     JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public'
     ORDER BY t.typname, e.enumsortorder`,
  );
  for (const r of enumRows.rows) {
    const arr = enums.get(r.enum_name) ?? [];
    arr.push(r.enum_value);
    enums.set(r.enum_name, arr);
  }

  const primaryKeys = new Map<string, string[]>();
  const uniques = new Map<string, Set<string>>();
  const conRows = await db.query<{
    table_name: string;
    constraint_type: string;
    column_name: string;
    constraint_name: string;
    ordinal_position: number;
  }>(
    `SELECT tc.table_name, tc.constraint_type, kcu.column_name,
            tc.constraint_name, kcu.ordinal_position
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
     WHERE tc.table_schema = 'public'
       AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
     ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position`,
  );
  const grouped = new Map<
    string,
    { table: string; type: string; cols: string[] }
  >();
  for (const r of conRows.rows) {
    const key = `${r.table_name}::${r.constraint_name}`;
    let g = grouped.get(key);
    if (!g) {
      g = { table: r.table_name, type: r.constraint_type, cols: [] };
      grouped.set(key, g);
    }
    g.cols.push(r.column_name);
  }
  for (const g of grouped.values()) {
    if (g.type === 'PRIMARY KEY') {
      primaryKeys.set(g.table, g.cols);
    } else {
      const sorted = [...g.cols].sort().join(',');
      const set = uniques.get(g.table) ?? new Set<string>();
      set.add(sorted);
      uniques.set(g.table, set);
    }
  }

  return { tables, enums, primaryKeys, uniques };
}

function normalizeType(dataType: string, udtName: string): string {
  // information_schema.data_type returns 'USER-DEFINED' for enums and
  // 'ARRAY' for array columns. udt_name carries the precise underlying
  // type, prefixed with `_` for arrays. Normalise so equivalent
  // declarations from drizzle and hand-written SQL compare equal.
  if (dataType === 'USER-DEFINED') return udtName;
  if (dataType === 'ARRAY') return `${udtName.replace(/^_/, '')}[]`;
  if (dataType === 'character varying') return 'varchar';
  if (dataType === 'timestamp without time zone') return 'timestamp';
  if (dataType === 'timestamp with time zone') return 'timestamptz';
  if (dataType === 'double precision') return 'float8';
  return dataType;
}

export function diff(
  fromSchema: SchemaSnapshot,
  fromMigrations: SchemaSnapshot,
): DriftReport {
  const report: DriftReport = {
    missingTables: [],
    extraTables: [],
    missingColumns: [],
    extraColumns: [],
    columnTypeMismatches: [],
    columnNullabilityMismatches: [],
    missingEnums: [],
    extraEnums: [],
    enumValueMismatches: [],
    primaryKeyMismatches: [],
    missingUniques: [],
    extraUniques: [],
  };

  const schemaTables = new Set(fromSchema.tables.keys());
  const migrationTables = new Set(fromMigrations.tables.keys());
  for (const t of schemaTables) {
    if (!migrationTables.has(t)) report.missingTables.push(t);
  }
  for (const t of migrationTables) {
    if (!schemaTables.has(t)) report.extraTables.push(t);
  }

  for (const t of schemaTables) {
    const sCols = fromSchema.tables.get(t)!;
    const mCols = fromMigrations.tables.get(t);
    if (!mCols) continue;
    for (const [col, sInfo] of sCols) {
      const mInfo = mCols.get(col);
      if (!mInfo) {
        report.missingColumns.push({
          table: t,
          column: col,
          type: sInfo.dataType,
        });
        continue;
      }
      if (sInfo.dataType !== mInfo.dataType) {
        report.columnTypeMismatches.push({
          table: t,
          column: col,
          schemaType: sInfo.dataType,
          migrationType: mInfo.dataType,
        });
      }
      if (sInfo.isNullable !== mInfo.isNullable) {
        report.columnNullabilityMismatches.push({
          table: t,
          column: col,
          schemaNullable: sInfo.isNullable,
          migrationNullable: mInfo.isNullable,
        });
      }
    }
    for (const [col, mInfo] of mCols) {
      if (!sCols.has(col)) {
        report.extraColumns.push({
          table: t,
          column: col,
          type: mInfo.dataType,
        });
      }
    }
  }

  const schemaEnums = new Set(fromSchema.enums.keys());
  const migrationEnums = new Set(fromMigrations.enums.keys());
  for (const e of schemaEnums) {
    if (!migrationEnums.has(e)) report.missingEnums.push(e);
  }
  for (const e of migrationEnums) {
    if (!schemaEnums.has(e)) report.extraEnums.push(e);
  }
  for (const e of schemaEnums) {
    if (!migrationEnums.has(e)) continue;
    const sVals = new Set(fromSchema.enums.get(e)!);
    const mVals = new Set(fromMigrations.enums.get(e)!);
    const missing = [...sVals].filter((v) => !mVals.has(v));
    const extra = [...mVals].filter((v) => !sVals.has(v));
    if (missing.length || extra.length) {
      report.enumValueMismatches.push({
        enumName: e,
        missingValues: missing,
        extraValues: extra,
      });
    }
  }

  for (const t of schemaTables) {
    if (!migrationTables.has(t)) continue;
    const sPk = fromSchema.primaryKeys.get(t) ?? [];
    const mPk = fromMigrations.primaryKeys.get(t) ?? [];
    if (sPk.join(',') !== mPk.join(',')) {
      report.primaryKeyMismatches.push({
        table: t,
        schemaPk: sPk,
        migrationPk: mPk,
      });
    }
    const sU = fromSchema.uniques.get(t) ?? new Set<string>();
    const mU = fromMigrations.uniques.get(t) ?? new Set<string>();
    for (const u of sU) {
      if (!mU.has(u)) report.missingUniques.push({ table: t, columns: u });
    }
    for (const u of mU) {
      if (!sU.has(u)) report.extraUniques.push({ table: t, columns: u });
    }
  }

  return report;
}

export function hasDrift(r: DriftReport): boolean {
  return (
    r.missingTables.length > 0 ||
    r.extraTables.length > 0 ||
    r.missingColumns.length > 0 ||
    r.extraColumns.length > 0 ||
    r.columnTypeMismatches.length > 0 ||
    r.columnNullabilityMismatches.length > 0 ||
    r.missingEnums.length > 0 ||
    r.extraEnums.length > 0 ||
    r.enumValueMismatches.length > 0 ||
    r.primaryKeyMismatches.length > 0 ||
    r.missingUniques.length > 0 ||
    r.extraUniques.length > 0
  );
}

export function formatReport(r: DriftReport): string {
  const lines: string[] = [];
  const push = (label: string, items: string[]) => {
    if (items.length === 0) return;
    lines.push(`  ${label}:`);
    for (const i of items) lines.push(`    - ${i}`);
  };
  push(
    'Tables in shared/schema.ts but missing from migrations',
    r.missingTables,
  );
  push(
    'Tables in migrations but missing from shared/schema.ts',
    r.extraTables,
  );
  push(
    'Columns in shared/schema.ts but missing from migrations',
    r.missingColumns.map((c) => `${c.table}.${c.column} (${c.type})`),
  );
  push(
    'Columns in migrations but missing from shared/schema.ts',
    r.extraColumns.map((c) => `${c.table}.${c.column} (${c.type})`),
  );
  push(
    'Column type mismatches',
    r.columnTypeMismatches.map(
      (c) =>
        `${c.table}.${c.column}: schema=${c.schemaType}, migrations=${c.migrationType}`,
    ),
  );
  push(
    'Column nullability mismatches',
    r.columnNullabilityMismatches.map(
      (c) =>
        `${c.table}.${c.column}: schema nullable=${c.schemaNullable}, migrations nullable=${c.migrationNullable}`,
    ),
  );
  push('Enums missing from migrations', r.missingEnums);
  push('Enums missing from shared/schema.ts', r.extraEnums);
  push(
    'Enum value differences',
    r.enumValueMismatches.map(
      (e) =>
        `${e.enumName}: missing=[${e.missingValues.join(',')}], extra=[${e.extraValues.join(',')}]`,
    ),
  );
  push(
    'Primary key mismatches',
    r.primaryKeyMismatches.map(
      (p) =>
        `${p.table}: schema=[${p.schemaPk.join(',')}], migrations=[${p.migrationPk.join(',')}]`,
    ),
  );
  push(
    'Unique constraints missing from migrations',
    r.missingUniques.map((u) => `${u.table}(${u.columns})`),
  );
  push(
    'Unique constraints missing from shared/schema.ts',
    r.extraUniques.map((u) => `${u.table}(${u.columns})`),
  );
  return lines.join('\n');
}

export interface CheckResult {
  report: DriftReport;
  migrationErrors: MigrationApplyError[];
}

export async function checkDrift(): Promise<CheckResult> {
  const migrationsDb = new PGlite();
  const schemaDb = new PGlite();
  try {
    const migrationErrors = await applyMigrations(migrationsDb);
    const exportSql = exportSchemaSql();
    await applySchema(schemaDb, exportSql);
    const schemaSnap = await snapshot(schemaDb);
    const migrationsSnap = await snapshot(migrationsDb);
    return { report: diff(schemaSnap, migrationsSnap), migrationErrors };
  } finally {
    await migrationsDb.close().catch(() => undefined);
    await schemaDb.close().catch(() => undefined);
  }
}

async function main(): Promise<void> {
  console.log(
    '[drift-check] Comparing shared/schema.ts against cumulative migrations...',
  );
  const { report, migrationErrors } = await checkDrift();
  if (migrationErrors.length > 0) {
    console.error(
      `[drift-check] ${migrationErrors.length} statement(s) in migrations/ failed against an empty database (likely missing prerequisite tables):`,
    );
    for (const e of migrationErrors.slice(0, 20)) {
      console.error(`    - ${e.file}: ${e.error}`);
      console.error(`        SQL: ${e.statementPreview}`);
    }
    if (migrationErrors.length > 20) {
      console.error(`    ... and ${migrationErrors.length - 20} more.`);
    }
  }
  if (!hasDrift(report) && migrationErrors.length === 0) {
    console.log(
      '[drift-check] OK - shared/schema.ts is fully covered by migrations.',
    );
    return;
  }
  if (hasDrift(report)) {
    console.error('[drift-check] Schema drift detected:');
    console.error(formatReport(report));
  }
  console.error('');
  console.error(
    '[drift-check] Add a numbered migration in migrations/ to bring the deployed schema in line with shared/schema.ts.',
  );
  console.error(
    '[drift-check] See docs/migrations.md for the supported workflow (drizzle-kit generate + npm run migrate).',
  );
  process.exitCode = 1;
}

const invokedDirectly =
  typeof process.argv[1] === 'string' &&
  /check-migration-coverage(\.ts|\.js)?$/.test(process.argv[1]);
if (invokedDirectly) {
  main().catch((e) => {
    console.error('[drift-check] FATAL:', e);
    process.exit(2);
  });
}
