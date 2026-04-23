#!/usr/bin/env tsx
/**
 * Generates `migrations/0010_schema_baseline_catchup.sql` from the cumulative
 * SQL produced by `drizzle-kit export --schema=./shared/schema.ts`, plus a
 * cleanup prelude that brings a database that was built only by migrations
 * 0000-0008 (or the legacy `drizzle-kit push` shape) into structural parity
 * with `shared/schema.ts`.
 *
 * The generated migration is fully idempotent:
 *   - Existing tables/columns/indexes/types are skipped via IF NOT EXISTS or
 *     wrapping DO/EXCEPTION blocks.
 *   - "Extra" tables/columns/enum values that exist only in the historic
 *     migration chain are dropped IF EXISTS.
 *   - Column type and nullability fixes are written so that re-applying them
 *     against a database that already matches `shared/schema.ts` is a no-op.
 *
 * This file is the source-of-truth generator for migration 0010. Re-run it
 * if `shared/schema.ts` changes meaningfully (and pair it with a follow-up
 * migration if the changes need to land in production).
 */
import { execFileSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = process.cwd();
const OUTPUT = join(REPO_ROOT, 'migrations', '0010_schema_baseline_catchup.sql');

function exportSchemaSql(): string {
  return execFileSync(
    'npx',
    ['drizzle-kit', 'export', '--dialect=postgresql', '--schema=./shared/schema.ts'],
    { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
}

interface Stmt { kind: string; sql: string; }

/** Split drizzle-kit export into top-level statements (each ends in ';'). */
function splitStatements(sql: string): Stmt[] {
  const out: Stmt[] = [];
  const lines = sql.split('\n');
  let buf = '';
  for (const line of lines) {
    if (!line.trim() && !buf) continue;
    buf += (buf ? '\n' : '') + line;
    if (line.trimEnd().endsWith(';')) {
      const trimmed = buf.trim();
      const head = trimmed.split(/\s+/, 2).join(' ').toUpperCase();
      let kind = 'OTHER';
      if (head.startsWith('CREATE TYPE')) kind = 'CREATE_TYPE';
      else if (head.startsWith('CREATE TABLE')) kind = 'CREATE_TABLE';
      else if (head.startsWith('ALTER TABLE')) kind = 'ALTER_TABLE';
      else if (head.startsWith('CREATE UNIQUE')) kind = 'CREATE_UNIQUE_INDEX';
      else if (head.startsWith('CREATE INDEX')) kind = 'CREATE_INDEX';
      out.push({ kind, sql: trimmed });
      buf = '';
    }
  }
  if (buf.trim()) out.push({ kind: 'OTHER', sql: buf.trim() });
  return out;
}

/** Strip the trailing semicolon for embedding inside a DO block. */
function stripSemi(s: string): string {
  return s.replace(/;\s*$/, '');
}

/** Wrap a single statement in a DO block that swallows duplicate_object. */
function idempotentDo(inner: string, extraExceptions = ''): string {
  const exc = extraExceptions
    ? `WHEN duplicate_object THEN null;\n  ${extraExceptions}`
    : 'WHEN duplicate_object THEN null;';
  return `DO $$ BEGIN\n  ${stripSemi(inner)};\nEXCEPTION\n  ${exc}\nEND $$;`;
}

/**
 * Parse a CREATE TABLE statement into table name and the lines between the
 * outermost parentheses. Returns null if it does not look like a CREATE TABLE.
 */
function parseCreateTable(stmt: string): {
  name: string;
  innerLines: string[];
  body: string;
} | null {
  const m = stmt.match(/^CREATE TABLE\s+"?([^"\s(]+)"?\s*\(([\s\S]*)\)\s*;?\s*$/);
  if (!m) return null;
  const name = m[1];
  const body = m[2];
  // Split top-level commas (not inside parens). Each line is one column or
  // one inline constraint.
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return { name, innerLines: parts, body };
}

/**
 * From a single column definition like `"id" uuid PRIMARY KEY DEFAULT
 * gen_random_uuid() NOT NULL`, extract `column_name` and the `rest` (the
 * type + modifiers without inline PRIMARY KEY/UNIQUE — those are added
 * separately via DO/EXCEPTION blocks if needed).
 */
function parseColumn(line: string): {
  colName: string;
  defForAdd: string;
} | null {
  const m = line.match(/^"([^"]+)"\s+(.+)$/s);
  if (!m) return null;
  const colName = m[1];
  let rest = m[2];
  // Strip inline PRIMARY KEY (we recreate via the table itself; if the table
  // already exists with a different PK, we cannot fix it here).
  rest = rest.replace(/\bPRIMARY\s+KEY\b/i, '').trim();
  // Strip inline UNIQUE (handled separately). Drizzle doesn't usually emit
  // inline UNIQUE for columns, but defensive.
  rest = rest.replace(/\bUNIQUE\b/i, '').trim();
  return { colName, defForAdd: rest };
}

function isInlineConstraint(line: string): boolean {
  return /^CONSTRAINT\s+/i.test(line.trim());
}

const HEADER = `-- 0010_schema_baseline_catchup.sql
--
-- Catch-up migration that brings a database whose schema was built only by
-- numbered migrations (or by the historical \`drizzle-kit push\` flow) into
-- structural parity with \`shared/schema.ts\`. Generated by
-- \`scripts/generate-baseline-migration.ts\`.
--
-- The migration is idempotent: every CREATE uses IF NOT EXISTS or a guarded
-- DO block, every DROP uses IF EXISTS, and the type/nullability fixes apply
-- the target shape (which is a no-op when the column already has it). It is
-- safe to apply against the existing production database (whose schema was
-- maintained by \`drizzle-kit push\` and therefore already matches
-- \`shared/schema.ts\`) as well as against a fresh empty database.
--
-- Background: see scripts/check-migration-coverage.ts and task #423.

`;

// Map of schema-side declared types to the data_type value PostgreSQL
// reports in information_schema.columns. Used to gate ALTER COLUMN TYPE
// on the column not already being in the target shape.
const PG_DATA_TYPE: Record<string, string> = {
  text: 'text',
  varchar: 'character varying',
  jsonb: 'jsonb',
  uuid: 'uuid',
};

/**
 * Build the SQL predicate that returns true when ANY of the columns in
 * `typeFixes` are not already at their target type. We use it to gate both
 * PHASE 0 (drop FKs) and PHASE 4 (run ALTERs) so a database that already
 * matches `shared/schema.ts` (production) is a complete no-op.
 */
function typeMismatchPredicate(typeFixes: Array<[string, string, string]>): string {
  const conds = typeFixes.map(([t, c, ty]) => {
    const pgType = PG_DATA_TYPE[ty];
    if (!pgType) throw new Error(`Unknown PG data_type mapping for ${ty}`);
    return `(table_name = '${t}' AND column_name = '${c}' AND data_type <> '${pgType}')`;
  });
  return `EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND (
        ${conds.join('\n        OR ')}
      )
    )`;
}

function buildMigration(): string {
  const exportSql = exportSchemaSql();
  const stmts = splitStatements(exportSql);

  const out: string[] = [HEADER];

  // typeFixes is shared by PHASE 0 (FK drop gating) and PHASE 4.
  const typeFixes: Array<[string, string, string]> = [
    ['bills', 'id', 'text'],
    ['bills', 'bill_number', 'varchar'],
    ['bills', 'created_by', 'varchar'],
    ['bookings', 'id', 'varchar'],
    ['bookings', 'common_space_id', 'varchar'],
    ['bookings', 'user_id', 'varchar'],
    ['budgets', 'id', 'text'],
    ['budgets', 'building_id', 'varchar'],
    ['budgets', 'approved_by', 'varchar'],
    ['budgets', 'created_by', 'varchar'],
    ['buildings', 'id', 'text'],
    ['buildings', 'organization_id', 'varchar'],
    ['buildings', 'name', 'varchar'],
    ['buildings', 'city', 'varchar'],
    ['buildings', 'province', 'varchar'],
    ['buildings', 'postal_code', 'varchar'],
    ['common_spaces', 'id', 'varchar'],
    ['common_spaces', 'building_id', 'varchar'],
    ['common_spaces', 'contact_person_id', 'varchar'],
    ['documents', 'id', 'text'],
    ['documents', 'residence_id', 'varchar'],
    ['documents', 'building_id', 'varchar'],
    ['features', 'requested_by', 'text'],
    ['features', 'assigned_to', 'text'],
    ['framework_configuration', 'value', 'text'],
    ['maintenance_requests', 'residence_id', 'varchar'],
    ['maintenance_requests', 'submitted_by', 'varchar'],
    ['maintenance_requests', 'assigned_to', 'varchar'],
    ['notifications', 'id', 'text'],
    ['notifications', 'user_id', 'varchar'],
    ['notifications', 'related_entity_id', 'varchar'],
    ['organizations', 'id', 'text'],
    ['organizations', 'name', 'varchar'],
    ['organizations', 'city', 'varchar'],
    ['organizations', 'province', 'varchar'],
    ['organizations', 'postal_code', 'varchar'],
    ['organizations', 'email', 'varchar'],
    ['residences', 'id', 'text'],
    ['residences', 'building_id', 'varchar'],
    ['residences', 'unit_number', 'varchar'],
    ['user_booking_restrictions', 'id', 'varchar'],
    ['user_booking_restrictions', 'user_id', 'varchar'],
    ['user_booking_restrictions', 'common_space_id', 'varchar'],
    ['user_residences', 'id', 'varchar'],
    ['user_residences', 'user_id', 'varchar'],
    ['user_residences', 'residence_id', 'varchar'],
    ['users', 'id', 'text'],
    ['users', 'email', 'varchar'],
    ['users', 'first_name', 'varchar'],
    ['users', 'last_name', 'varchar'],
    ['users', 'phone', 'varchar'],
    ['users', 'language', 'varchar'],
  ];
  const mismatchPred = typeMismatchPredicate(typeFixes);

  // ---------------------------------------------------------------------------
  // PHASE 0: Conditionally drop foreign keys, only if the catch-up actually
  // needs to alter column types. In production (where shared/schema.ts and
  // the live DB already match because of historic drizzle-kit push), this
  // entire block is a no-op — no FKs are touched, no ACCESS EXCLUSIVE locks
  // are taken. PHASE 6 re-adds any FKs that were dropped, idempotently.
  // ---------------------------------------------------------------------------
  out.push(`-- PHASE 0: Drop FKs only if PHASE 4 has any column-type changes to apply.
DO $$
DECLARE
  r record;
BEGIN
  IF NOT (${mismatchPred}) THEN
    RETURN;
  END IF;
  FOR r IN
    SELECT conname, conrelid::regclass::text AS tbl
    FROM pg_constraint
    WHERE contype = 'f'
      AND connamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;
`);

  // ---------------------------------------------------------------------------
  // PHASE 1: Drop tables that exist only in historic migrations (ai_*).
  // ---------------------------------------------------------------------------
  out.push(`-- PHASE 1: Drop tables and enums present only in historic migrations.
DROP TABLE IF EXISTS "ai_insights" CASCADE;
DROP TABLE IF EXISTS "ai_interactions" CASCADE;
DROP TABLE IF EXISTS "ai_metrics" CASCADE;
DROP TYPE  IF EXISTS "ai_insight_priority"  CASCADE;
DROP TYPE  IF EXISTS "ai_insight_status"    CASCADE;
DROP TYPE  IF EXISTS "ai_insight_type"      CASCADE;
DROP TYPE  IF EXISTS "ai_interaction_status" CASCADE;
`);

  // ---------------------------------------------------------------------------
  // PHASE 2: Drop columns that exist only in historic migrations.
  // ---------------------------------------------------------------------------
  const extraColumns: Array<[string, string]> = [
    ['bills', 'residence_id'],
    ['bills', 'type'],
    ['bills', 'amount'],
    ['bills', 'due_date'],
    ['bills', 'late_fee_amount'],
    ['bills', 'discount_amount'],
    ['bills', 'final_amount'],
    ['bills', 'payment_received_date'],
    ['buildings', 'year_built'],
    ['documents', 'organization_id'],
    ['documents', 'title'],
    ['documents', 'category'],
    ['documents', 'file_url'],
    ['documents', 'is_public'],
    ['documents', 'uploaded_by'],
    ['residences', 'parking_space_number'],
    ['residences', 'storage_space_number'],
  ];
  out.push('-- PHASE 2: Drop columns present only in historic migrations.');
  for (const [t, c] of extraColumns) {
    out.push(`ALTER TABLE "${t}" DROP COLUMN IF EXISTS "${c}";`);
  }
  out.push('');

  // ---------------------------------------------------------------------------
  // PHASE 3: Recreate enums whose historic value list does not match the
  // schema. We only drop+recreate when the historic-only values are present
  // (so prod, where the enum already matches schema, is a no-op). After
  // dropping with CASCADE, PHASE 6 re-creates the enum and any column that
  // referenced it (we have already dropped all FKs in PHASE 0; columns of
  // dropped enum types vanish via CASCADE and are re-added by PHASE 7).
  // ---------------------------------------------------------------------------
  // Enums and the historic-only values whose presence triggers the rebuild:
  const enumRebuilds: Array<[string, string[], string[]]> = [
    [
      'bill_type',
      ['condo_fees', 'special_assessment', 'utility', 'maintenance', 'other'],
      ['unique', 'recurrent'],
    ],
    [
      'building_type',
      [], // historic 'condo','rental' are still valid; just missing apartment/appartement
      ['apartment', 'appartement', 'condo', 'rental'],
    ],
    [
      'notification_type',
      ['bill', 'maintenance', 'meeting', 'document'],
      [
        'bill_reminder',
        'maintenance_update',
        'announcement',
        'system',
        'upcoming_payment',
        'upcoming_bills',
        'bill_paid_last_month',
        'bills_overdue',
        'payment_overdue',
        'new_building_document',
        'meeting_invite',
        'maintenance_completed',
        'budget_update',
        'policy_change',
        'seasonal_reminder',
      ],
    ],
    [
      'suggestion_category',
      [], // only missing 'Replit App'
      [
        'Code Quality',
        'Security',
        'Testing',
        'Documentation',
        'Performance',
        'Continuous Improvement',
        'Replit AI Agent Monitoring',
        'Replit App',
      ],
    ],
    [
      'user_role',
      ['board_member'],
      ['admin', 'manager', 'tenant', 'resident', 'demo_manager', 'demo_tenant', 'demo_resident'],
    ],
  ];
  out.push('-- PHASE 3: Rebuild enums whose historic value lists differ.');
  for (const [name, badValues, goodValues] of enumRebuilds) {
    if (badValues.length > 0) {
      const arr = badValues.map((v) => `'${v}'`).join(',');
      out.push(`DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = '${name}' AND e.enumlabel IN (${arr})
  ) THEN
    DROP TYPE "${name}" CASCADE;
  END IF;
END $$;`);
    }
    // For enums that are merely missing values (no extras to remove), use
    // ALTER TYPE ... ADD VALUE IF NOT EXISTS for each desired value.
    for (const v of goodValues) {
      out.push(`DO $$ BEGIN
  ALTER TYPE "${name}" ADD VALUE IF NOT EXISTS '${v.replace(/'/g, "''")}';
EXCEPTION
  WHEN undefined_object THEN null;
END $$;`);
    }
  }
  out.push('');

  // The historic invitation_status enum has an extra 'replaced' value vs
  // schema. The schema is missing it; do nothing destructive (PG can't
  // drop enum values without rebuild, and the value is harmless).
  // -> NOTE: drift report flagged this, so we drop+recreate.
  out.push(`-- PHASE 3b: Drop 'replaced' from invitation_status if present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'invitation_status' AND e.enumlabel = 'replaced'
  ) THEN
    -- Repoint columns to text temporarily so we can drop+recreate.
    ALTER TABLE IF EXISTS "invitations"
      ALTER COLUMN "status" DROP DEFAULT,
      ALTER COLUMN "status" TYPE text USING "status"::text;
    ALTER TABLE IF EXISTS "invitation_audit_log"
      ALTER COLUMN "previous_status" TYPE text USING "previous_status"::text,
      ALTER COLUMN "new_status" TYPE text USING "new_status"::text;
    DROP TYPE "invitation_status";
    CREATE TYPE "invitation_status" AS ENUM('pending','accepted','expired','cancelled');
    ALTER TABLE IF EXISTS "invitations"
      ALTER COLUMN "status" TYPE "invitation_status" USING "status"::"invitation_status",
      ALTER COLUMN "status" SET DEFAULT 'pending';
    ALTER TABLE IF EXISTS "invitation_audit_log"
      ALTER COLUMN "previous_status" TYPE "invitation_status" USING "previous_status"::"invitation_status",
      ALTER COLUMN "new_status" TYPE "invitation_status" USING "new_status"::"invitation_status";
  END IF;
END $$;
`);

  // ---------------------------------------------------------------------------
  // PHASE 4: Fix column type mismatches. Each ALTER is gated on the current
  // column type *not* already matching the target, so production (where the
  // column already matches) skips the ALTER entirely — no table rewrite, no
  // ACCESS EXCLUSIVE lock. Cast through text so any underlying
  // representation works on databases that actually need the change.
  // ---------------------------------------------------------------------------
  out.push(
    '-- PHASE 4: Convert column types to match shared/schema.ts (skipped when already matching).',
  );
  for (const [t, c, ty] of typeFixes) {
    const pgType = PG_DATA_TYPE[ty];
    out.push(`DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = '${t}'
      AND column_name = '${c}'
      AND data_type <> '${pgType}'
  ) THEN
    ALTER TABLE "${t}" ALTER COLUMN "${c}" TYPE ${ty} USING "${c}"::text::${ty};
  END IF;
EXCEPTION
  WHEN undefined_table THEN null;
  WHEN undefined_column THEN null;
END $$;`);
  }
  out.push('');

  // ---------------------------------------------------------------------------
  // PHASE 5: Fix nullability mismatches.
  // ---------------------------------------------------------------------------
  const nullFixes: Array<[string, string, boolean]> = [
    ['bills', 'description', true], // schema nullable=true
    ['bills', 'issue_date', true],
    ['documents', 'file_name', true],
    ['documents', 'created_at', false], // schema NOT NULL
    ['documents', 'updated_at', false],
  ];
  out.push('-- PHASE 5: Fix nullability mismatches.');
  for (const [t, c, nullable] of nullFixes) {
    const op = nullable ? 'DROP NOT NULL' : 'SET NOT NULL';
    out.push(`DO $$ BEGIN
  ALTER TABLE "${t}" ALTER COLUMN "${c}" ${op};
EXCEPTION
  WHEN undefined_table THEN null;
  WHEN undefined_column THEN null;
END $$;`);
  }
  out.push('');

  // ---------------------------------------------------------------------------
  // PHASE 6: Apply drizzle-kit export idempotently.
  // ---------------------------------------------------------------------------
  out.push('-- PHASE 6: Apply drizzle-kit export idempotently.');

  for (const stmt of stmts) {
    if (stmt.kind === 'CREATE_TYPE') {
      out.push(idempotentDo(stmt.sql));
      continue;
    }
    if (stmt.kind === 'CREATE_TABLE') {
      const parsed = parseCreateTable(stmt.sql);
      if (!parsed) {
        out.push(stmt.sql);
        continue;
      }
      // Emit CREATE TABLE IF NOT EXISTS with the original body.
      out.push(
        stmt.sql.replace(/^CREATE TABLE\s+/, 'CREATE TABLE IF NOT EXISTS '),
      );
      // For each column line, emit ADD COLUMN IF NOT EXISTS so existing
      // tables get the missing columns too. Inline UNIQUE constraints get
      // re-asserted via guarded ALTER TABLE ADD CONSTRAINT.
      for (const line of parsed.innerLines) {
        if (isInlineConstraint(line)) {
          const m = line.match(/^CONSTRAINT\s+"([^"]+)"\s+UNIQUE\s*\(([^)]+)\)/i);
          if (m) {
            const conName = m[1];
            const cols = m[2];
            out.push(`DO $$ BEGIN
  ALTER TABLE "${parsed.name}" ADD CONSTRAINT "${conName}" UNIQUE (${cols});
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN duplicate_table THEN null;
  WHEN unique_violation THEN null;
END $$;`);
          }
          continue;
        }
        const col = parseColumn(line);
        if (!col) continue;
        out.push(
          `ALTER TABLE "${parsed.name}" ADD COLUMN IF NOT EXISTS "${col.colName}" ${col.defForAdd};`,
        );
      }
      continue;
    }
    if (stmt.kind === 'ALTER_TABLE') {
      // ALTER TABLE x ADD CONSTRAINT y FOREIGN KEY ... — wrap in DO block.
      out.push(
        `DO $$ BEGIN
  ${stripSemi(stmt.sql)};
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN invalid_foreign_key THEN null;
  WHEN datatype_mismatch THEN null;
  WHEN undefined_table THEN null;
  WHEN undefined_column THEN null;
END $$;`,
      );
      continue;
    }
    if (stmt.kind === 'CREATE_INDEX') {
      out.push(stmt.sql.replace(/^CREATE INDEX\s+/, 'CREATE INDEX IF NOT EXISTS '));
      continue;
    }
    if (stmt.kind === 'CREATE_UNIQUE_INDEX') {
      out.push(
        stmt.sql.replace(
          /^CREATE UNIQUE INDEX\s+/,
          'CREATE UNIQUE INDEX IF NOT EXISTS ',
        ),
      );
      continue;
    }
    out.push(stmt.sql);
  }

  return out.join('\n') + '\n';
}

const content = buildMigration();
writeFileSync(OUTPUT, content);
console.log(`Wrote ${OUTPUT} (${content.length} bytes, ${content.split('\n').length} lines)`);
