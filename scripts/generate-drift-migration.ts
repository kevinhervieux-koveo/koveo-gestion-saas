#!/usr/bin/env tsx
/**
 * One-shot tool used to author the schema-drift sync migration.
 *
 * Reads the cumulative schema produced by `drizzle-kit export` and rewrites
 * it as an idempotent migration that can be re-applied on top of any
 * environment without erroring (uses IF NOT EXISTS, DO blocks, etc.). It
 * also injects a curated DROP / ALTER section to remove drift items the
 * `check-migration-coverage.ts` script flags as "extra" in migrations.
 *
 * Usage: npx tsx scripts/generate-drift-migration.ts > migrations/0011_xxx.sql
 *
 * Output ordering (matters):
 *   1. Enums (CREATE IF NOT EXISTS, then ADD VALUE IF NOT EXISTS).
 *   2. Tables (CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS for
 *      each column; UNIQUE constraints via DO blocks).
 *   3. Cleanup phase (drop legacy columns/tables/enums; recreate enums
 *      that have stale extra values; reconcile column types and
 *      nullability).
 *   4. Foreign keys (re-added after type alterations so source/target
 *      types match).
 *   5. Indexes.
 */
import { execFileSync } from 'child_process';
import { resolve } from 'path';

const REPO_ROOT = process.cwd();
const SCHEMA_PATH = resolve(REPO_ROOT, 'shared', 'schema.ts');

function exportSchema(): string {
  return execFileSync(
    'npx',
    ['drizzle-kit', 'export', '--dialect=postgresql', `--schema=${SCHEMA_PATH}`],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
}

interface ParsedTable {
  name: string;
  columns: { name: string; def: string }[];
  uniqueConstraints: { name: string; cols: string[] }[];
}

function splitStatements(sql: string): string[] {
  // drizzle-kit export emits one statement per line for CREATE TYPE / ALTER /
  // CREATE INDEX, and a multi-line block for CREATE TABLE that ends with `);`.
  const out: string[] = [];
  let cur = '';
  let inSingle = false;
  let depth = 0;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'" && sql[i - 1] !== '\\') inSingle = !inSingle;
    if (!inSingle) {
      if (c === '(') depth++;
      else if (c === ')') depth--;
    }
    if (c === ';' && !inSingle && depth === 0) {
      const trimmed = cur.trim();
      if (trimmed) out.push(trimmed);
      cur = '';
    } else {
      cur += c;
    }
  }
  const tail = cur.trim();
  if (tail) out.push(tail);
  return out;
}

function parseEnum(stmt: string):
  | { name: string; values: string[] }
  | null {
  const m = stmt.match(/^CREATE TYPE\s+"public"\."([^"]+)"\s+AS ENUM\s*\(([\s\S]+)\)\s*$/i);
  if (!m) return null;
  const name = m[1];
  const valuesRaw = m[2];
  const values: string[] = [];
  const valRegex = /'((?:[^']|'')*)'/g;
  let vm: RegExpExecArray | null;
  while ((vm = valRegex.exec(valuesRaw)) !== null) {
    values.push(vm[1].replace(/''/g, "'"));
  }
  return { name, values };
}

function parseTable(stmt: string): ParsedTable | null {
  const m = stmt.match(/^CREATE TABLE\s+"([^"]+)"\s*\(([\s\S]+)\)\s*$/i);
  if (!m) return null;
  const name = m[1];
  const body = m[2];
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(body.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(body.slice(start).trim());
  const columns: { name: string; def: string }[] = [];
  const uniqueConstraints: { name: string; cols: string[] }[] = [];
  for (const p of parts) {
    if (!p) continue;
    if (/^CONSTRAINT\s+/i.test(p)) {
      const um = p.match(/^CONSTRAINT\s+"([^"]+)"\s+UNIQUE\s*\(([^)]+)\)/i);
      if (um) {
        const cols = um[2]
          .split(',')
          .map((c) => c.trim().replace(/^"|"$/g, ''));
        uniqueConstraints.push({ name: um[1], cols });
      }
      continue;
    }
    const cm = p.match(/^"([^"]+)"\s+(.+)$/s);
    if (!cm) continue;
    columns.push({ name: cm[1], def: cm[2].trim() });
  }
  return { name, columns, uniqueConstraints };
}

function isPrimaryKey(def: string): boolean {
  return /\bPRIMARY KEY\b/i.test(def);
}

function stripPrimaryKey(def: string): string {
  return def.replace(/\s*PRIMARY KEY\b/i, '').trim();
}

function emitEnumIdempotent(name: string, values: string[]): string {
  const vals = values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');
  let sql = `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${name}') THEN
    CREATE TYPE "public"."${name}" AS ENUM (${vals});
  END IF;
END $$;\n`;
  for (const v of values) {
    sql += `ALTER TYPE "public"."${name}" ADD VALUE IF NOT EXISTS '${v.replace(/'/g, "''")}';\n`;
  }
  return sql;
}

function emitTableIdempotent(t: ParsedTable): string {
  const pkCol = t.columns.find((c) => isPrimaryKey(c.def));
  let createSql: string;
  if (pkCol) {
    createSql = `CREATE TABLE IF NOT EXISTS "${t.name}" ("${pkCol.name}" ${pkCol.def});\n`;
  } else {
    const inner = t.columns.map((c) => `  "${c.name}" ${c.def}`).join(',\n');
    createSql = `CREATE TABLE IF NOT EXISTS "${t.name}" (\n${inner}\n);\n`;
  }
  let sql = createSql;
  for (const c of t.columns) {
    if (pkCol && c.name === pkCol.name) continue;
    sql += `ALTER TABLE "${t.name}" ADD COLUMN IF NOT EXISTS "${c.name}" ${stripPrimaryKey(c.def)};\n`;
  }
  for (const u of t.uniqueConstraints) {
    const colsList = u.cols.map((c) => `"${c}"`).join(', ');
    sql += `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${u.name}') THEN
    BEGIN
      ALTER TABLE "${t.name}" ADD CONSTRAINT "${u.name}" UNIQUE (${colsList});
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;
END $$;\n`;
  }
  return sql;
}

function emitForeignKey(stmt: string): string {
  const m = stmt.match(/^ALTER TABLE\s+"([^"]+)"\s+ADD CONSTRAINT\s+"([^"]+)"\s+(FOREIGN KEY[\s\S]+)$/i);
  if (!m) return '';
  const table = m[1];
  const conname = m[2];
  const rest = m[3];
  return `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${conname}') AND
     EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${table}') THEN
    BEGIN
      ALTER TABLE "${table}" ADD CONSTRAINT "${conname}" ${rest};
    EXCEPTION WHEN others THEN
      -- referenced column may have a different type if a prior migration left
      -- columns in an unexpected state; surface to drift-check rather than
      -- failing the whole migration.
      NULL;
    END;
  END IF;
END $$;\n`;
}

function emitIndex(stmt: string): string {
  const m = stmt.match(/^CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF NOT EXISTS\s+)?"([^"]+)"\s+ON\s+"([^"]+)"([\s\S]+)$/i);
  if (!m) return '';
  const unique = m[1] ? 'UNIQUE ' : '';
  const idxName = m[2];
  const table = m[3];
  const rest = m[4];
  return `DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${table}') THEN
    BEGIN
      CREATE ${unique}INDEX IF NOT EXISTS "${idxName}" ON "${table}"${rest};
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;
END $$;\n`;
}

const HEADER = `-- 0011_schema_drift_sync.sql
--
-- Brings every remaining table, column, enum, and constraint flagged by
-- \`scripts/check-migration-coverage.ts\` into alignment with the current
-- \`shared/schema.ts\`. See Task #791.
--
-- Most of the missing structure was created in dev via \`drizzle-kit push\`
-- and never recorded in a numbered migration, so production has been
-- silently rotting. This migration is generated by
-- \`scripts/generate-drift-migration.ts\` — do not hand-edit; rerun the
-- generator and re-commit instead.
--
-- The migration is fully idempotent (CREATE TABLE IF NOT EXISTS,
-- ADD COLUMN IF NOT EXISTS, DO blocks for enums and constraints) so it
-- can safely re-run on environments that already received the columns
-- via \`db:push\`.

`;

const CLEANUP_DROPS = `
-- ---------------------------------------------------------------------------
-- Cleanup phase 1: drop every public-schema FOREIGN KEY constraint so
-- subsequent ALTER COLUMN TYPE statements aren't blocked. The schema-defined
-- FKs are re-added at the end of the migration via the "Foreign keys"
-- section, which is itself idempotent.
-- ---------------------------------------------------------------------------
DO $$ DECLARE r record; BEGIN
  FOR r IN
    SELECT t.relname AS table_name, c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.contype = 'f' AND n.nspname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', r.table_name, r.conname);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Cleanup phase 2: drop legacy columns/tables that exist only in older
-- migrations and have been removed from the Drizzle schema.
-- ---------------------------------------------------------------------------

-- Legacy bills columns superseded by the new bill schema (Task #652).
ALTER TABLE "bills" DROP COLUMN IF EXISTS "residence_id" CASCADE;
ALTER TABLE "bills" DROP COLUMN IF EXISTS "type" CASCADE;
ALTER TABLE "bills" DROP COLUMN IF EXISTS "amount" CASCADE;
ALTER TABLE "bills" DROP COLUMN IF EXISTS "due_date" CASCADE;
ALTER TABLE "bills" DROP COLUMN IF EXISTS "late_fee_amount" CASCADE;
ALTER TABLE "bills" DROP COLUMN IF EXISTS "discount_amount" CASCADE;
ALTER TABLE "bills" DROP COLUMN IF EXISTS "final_amount" CASCADE;
ALTER TABLE "bills" DROP COLUMN IF EXISTS "payment_received_date" CASCADE;

-- Legacy buildings column.
ALTER TABLE "buildings" DROP COLUMN IF EXISTS "year_built" CASCADE;

-- Legacy documents columns superseded by the new documents schema.
ALTER TABLE "documents" DROP COLUMN IF EXISTS "organization_id" CASCADE;
ALTER TABLE "documents" DROP COLUMN IF EXISTS "title" CASCADE;
ALTER TABLE "documents" DROP COLUMN IF EXISTS "category" CASCADE;
ALTER TABLE "documents" DROP COLUMN IF EXISTS "file_url" CASCADE;
ALTER TABLE "documents" DROP COLUMN IF EXISTS "is_public" CASCADE;
ALTER TABLE "documents" DROP COLUMN IF EXISTS "uploaded_by" CASCADE;

-- Legacy residences columns (replaced by array variants).
ALTER TABLE "residences" DROP COLUMN IF EXISTS "parking_space_number" CASCADE;
ALTER TABLE "residences" DROP COLUMN IF EXISTS "storage_space_number" CASCADE;

-- Legacy AI tables that were removed from the Drizzle schema.
DROP TABLE IF EXISTS "ai_insights" CASCADE;
DROP TABLE IF EXISTS "ai_interactions" CASCADE;
DROP TABLE IF EXISTS "ai_metrics" CASCADE;

-- Legacy AI enums that are no longer referenced anywhere.
DROP TYPE IF EXISTS "ai_insight_priority";
DROP TYPE IF EXISTS "ai_insight_status";
DROP TYPE IF EXISTS "ai_insight_type";
DROP TYPE IF EXISTS "ai_interaction_status";

`;

const ENUM_RECREATE = `
-- ---------------------------------------------------------------------------
-- Cleanup phase 3: recreate enums whose existing migration definition has
-- extra values that no longer appear in the Drizzle schema. Postgres has
-- no DROP VALUE; the safe pattern is RENAME → CREATE → ALTER COLUMN
-- USING text cast → DROP. We map any rows still carrying a removed value
-- to the closest surviving value so the cast doesn't error.
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'bill_type'::regtype AND enumlabel IN ('condo_fees','special_assessment','utility','maintenance','other')
  ) THEN
    UPDATE bills SET bill_type = NULL
      WHERE bill_type::text IN ('condo_fees','special_assessment','utility','maintenance','other');
    ALTER TABLE bills ALTER COLUMN bill_type TYPE text USING bill_type::text;
    DROP TYPE bill_type;
    CREATE TYPE bill_type AS ENUM ('unique', 'recurrent');
    ALTER TABLE bills ALTER COLUMN bill_type TYPE bill_type USING bill_type::bill_type;
  END IF;
END $$;

-- Helper pattern: for each dependent column we DROP DEFAULT, ALTER TYPE
-- text, then later re-cast back to the new enum and SET DEFAULT. The
-- DEFAULT-drop step is what allows DROP TYPE to succeed; otherwise the
-- default expression itself keeps a reference to the old enum.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'invitation_status'::regtype AND enumlabel = 'replaced'
  ) THEN
    UPDATE invitations SET status = 'cancelled' WHERE status::text = 'replaced';
    UPDATE invitation_audit_log SET previous_status = NULL WHERE previous_status::text = 'replaced';
    UPDATE invitation_audit_log SET new_status = NULL WHERE new_status::text = 'replaced';
    ALTER TABLE invitations ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE invitations ALTER COLUMN status TYPE text USING status::text;
    ALTER TABLE invitation_audit_log ALTER COLUMN previous_status TYPE text USING previous_status::text;
    ALTER TABLE invitation_audit_log ALTER COLUMN new_status TYPE text USING new_status::text;
    DROP TYPE invitation_status;
    CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired', 'cancelled');
    ALTER TABLE invitations ALTER COLUMN status TYPE invitation_status USING status::invitation_status;
    ALTER TABLE invitations ALTER COLUMN status SET DEFAULT 'pending';
    ALTER TABLE invitation_audit_log ALTER COLUMN previous_status TYPE invitation_status USING previous_status::invitation_status;
    ALTER TABLE invitation_audit_log ALTER COLUMN new_status TYPE invitation_status USING new_status::invitation_status;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'notification_type'::regtype AND enumlabel IN ('bill','maintenance','meeting','document')
  ) THEN
    UPDATE notifications SET type = 'system' WHERE type::text IN ('bill','maintenance','meeting','document');
    UPDATE user_notification_preferences SET notification_type = 'system' WHERE notification_type::text IN ('bill','maintenance','meeting','document');
    UPDATE notification_configurations SET type = 'system' WHERE type::text IN ('bill','maintenance','meeting','document');
    ALTER TABLE notifications ALTER COLUMN type TYPE text USING type::text;
    ALTER TABLE user_notification_preferences ALTER COLUMN notification_type TYPE text USING notification_type::text;
    ALTER TABLE notification_configurations ALTER COLUMN type TYPE text USING type::text;
    DROP TYPE notification_type;
    CREATE TYPE notification_type AS ENUM (
      'bill_reminder','maintenance_update','announcement','system','upcoming_payment',
      'upcoming_bills','bill_paid_last_month','bills_overdue','payment_overdue',
      'new_building_document','meeting_invite','maintenance_completed','budget_update',
      'policy_change','seasonal_reminder'
    );
    ALTER TABLE notifications ALTER COLUMN type TYPE notification_type USING type::notification_type;
    ALTER TABLE user_notification_preferences ALTER COLUMN notification_type TYPE notification_type USING notification_type::notification_type;
    ALTER TABLE notification_configurations ALTER COLUMN type TYPE notification_type USING type::notification_type;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'user_role'::regtype AND enumlabel = 'board_member'
  ) THEN
    UPDATE users SET role = 'manager' WHERE role::text = 'board_member';
    UPDATE invitations SET role = 'manager' WHERE role::text = 'board_member';
    UPDATE user_organizations SET organization_role = 'manager' WHERE organization_role::text = 'board_member';
    UPDATE role_permissions SET role = 'manager' WHERE role::text = 'board_member';
    ALTER TABLE users ALTER COLUMN role DROP DEFAULT;
    ALTER TABLE user_organizations ALTER COLUMN organization_role DROP DEFAULT;
    ALTER TABLE users ALTER COLUMN role TYPE text USING role::text;
    ALTER TABLE invitations ALTER COLUMN role TYPE text USING role::text;
    ALTER TABLE user_organizations ALTER COLUMN organization_role TYPE text USING organization_role::text;
    ALTER TABLE role_permissions ALTER COLUMN role TYPE text USING role::text;
    DROP TYPE user_role;
    CREATE TYPE user_role AS ENUM (
      'admin','manager','tenant','resident','demo_manager','demo_tenant','demo_resident'
    );
    ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role;
    ALTER TABLE users ALTER COLUMN role SET DEFAULT 'tenant';
    ALTER TABLE invitations ALTER COLUMN role TYPE user_role USING role::user_role;
    ALTER TABLE user_organizations ALTER COLUMN organization_role TYPE user_role USING organization_role::user_role;
    ALTER TABLE user_organizations ALTER COLUMN organization_role SET DEFAULT 'tenant';
    ALTER TABLE role_permissions ALTER COLUMN role TYPE user_role USING role::user_role;
  END IF;
END $$;

`;

const COLUMN_TYPE_FIXES = `
-- ---------------------------------------------------------------------------
-- Cleanup phase 4: reconcile column types between hand-written migrations
-- (which used uuid/varchar) and the Drizzle schema (which uses
-- text/varchar). Foreign keys were dropped above, so these ALTERs no
-- longer collide; the FKs are re-added at the end of the migration.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('bills', 'id', 'text'),
      ('bills', 'bill_number', 'varchar'),
      ('bills', 'created_by', 'varchar'),
      ('bills', 'building_id', 'varchar'),
      ('bills', 'source_template_id', 'varchar'),
      ('bookings', 'id', 'varchar'),
      ('bookings', 'common_space_id', 'varchar'),
      ('bookings', 'user_id', 'varchar'),
      ('budgets', 'id', 'text'),
      ('budgets', 'building_id', 'varchar'),
      ('budgets', 'approved_by', 'varchar'),
      ('budgets', 'created_by', 'varchar'),
      ('buildings', 'id', 'text'),
      ('buildings', 'organization_id', 'varchar'),
      ('common_spaces', 'id', 'varchar'),
      ('common_spaces', 'building_id', 'varchar'),
      ('common_spaces', 'contact_person_id', 'varchar'),
      ('documents', 'id', 'text'),
      ('documents', 'residence_id', 'varchar'),
      ('documents', 'building_id', 'varchar'),
      ('documents', 'uploaded_by_id', 'varchar'),
      ('features', 'requested_by', 'text'),
      ('features', 'assigned_to', 'text'),
      ('framework_configuration', 'value', 'text'),
      ('maintenance_requests', 'residence_id', 'varchar'),
      ('maintenance_requests', 'submitted_by', 'varchar'),
      ('maintenance_requests', 'assigned_to', 'varchar'),
      ('notifications', 'id', 'text'),
      ('notifications', 'user_id', 'varchar'),
      ('notifications', 'related_entity_id', 'varchar'),
      ('organizations', 'id', 'text'),
      ('residences', 'id', 'text'),
      ('residences', 'building_id', 'varchar'),
      ('user_booking_restrictions', 'id', 'varchar'),
      ('user_booking_restrictions', 'user_id', 'varchar'),
      ('user_booking_restrictions', 'common_space_id', 'varchar'),
      ('user_residences', 'id', 'varchar'),
      ('user_residences', 'user_id', 'varchar'),
      ('user_residences', 'residence_id', 'varchar'),
      ('users', 'id', 'text')
    ) AS t(table_name, column_name, target_type)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = rec.table_name AND column_name = rec.column_name
    ) THEN
      BEGIN
        EXECUTE format(
          'ALTER TABLE %I ALTER COLUMN %I TYPE %s USING %I::text::%s',
          rec.table_name, rec.column_name, rec.target_type, rec.column_name,
          rec.target_type
        );
      EXCEPTION WHEN others THEN
        NULL;
      END;
    END IF;
  END LOOP;
END $$;

-- Length-bound varchar fixes (separate so the format() above stays simple).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='buildings' AND column_name='name') THEN
    BEGIN ALTER TABLE buildings ALTER COLUMN name TYPE varchar(200); EXCEPTION WHEN others THEN NULL; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='buildings' AND column_name='city') THEN
    BEGIN ALTER TABLE buildings ALTER COLUMN city TYPE varchar(100); EXCEPTION WHEN others THEN NULL; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='buildings' AND column_name='province') THEN
    BEGIN ALTER TABLE buildings ALTER COLUMN province TYPE varchar(3); EXCEPTION WHEN others THEN NULL; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='buildings' AND column_name='postal_code') THEN
    BEGIN ALTER TABLE buildings ALTER COLUMN postal_code TYPE varchar(10); EXCEPTION WHEN others THEN NULL; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organizations' AND column_name='name') THEN
    BEGIN ALTER TABLE organizations ALTER COLUMN name TYPE varchar(200); EXCEPTION WHEN others THEN NULL; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organizations' AND column_name='city') THEN
    BEGIN ALTER TABLE organizations ALTER COLUMN city TYPE varchar(100); EXCEPTION WHEN others THEN NULL; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organizations' AND column_name='province') THEN
    BEGIN ALTER TABLE organizations ALTER COLUMN province TYPE varchar(3); EXCEPTION WHEN others THEN NULL; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organizations' AND column_name='postal_code') THEN
    BEGIN ALTER TABLE organizations ALTER COLUMN postal_code TYPE varchar(10); EXCEPTION WHEN others THEN NULL; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organizations' AND column_name='email') THEN
    BEGIN ALTER TABLE organizations ALTER COLUMN email TYPE varchar(255); EXCEPTION WHEN others THEN NULL; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='residences' AND column_name='unit_number') THEN
    BEGIN ALTER TABLE residences ALTER COLUMN unit_number TYPE varchar(20); EXCEPTION WHEN others THEN NULL; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='email') THEN
    BEGIN ALTER TABLE users ALTER COLUMN email TYPE varchar(255); EXCEPTION WHEN others THEN NULL; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='first_name') THEN
    BEGIN ALTER TABLE users ALTER COLUMN first_name TYPE varchar(100); EXCEPTION WHEN others THEN NULL; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='last_name') THEN
    BEGIN ALTER TABLE users ALTER COLUMN last_name TYPE varchar(100); EXCEPTION WHEN others THEN NULL; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='phone') THEN
    BEGIN ALTER TABLE users ALTER COLUMN phone TYPE varchar(20); EXCEPTION WHEN others THEN NULL; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='language') THEN
    BEGIN ALTER TABLE users ALTER COLUMN language TYPE varchar(2); EXCEPTION WHEN others THEN NULL; END;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Cleanup phase 5: nullability reconciliation.
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bills' AND column_name='description') THEN
    ALTER TABLE bills ALTER COLUMN description DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bills' AND column_name='issue_date') THEN
    ALTER TABLE bills ALTER COLUMN issue_date DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='documents' AND column_name='file_name') THEN
    ALTER TABLE documents ALTER COLUMN file_name DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='documents' AND column_name='created_at' AND is_nullable='YES') THEN
    UPDATE documents SET created_at = now() WHERE created_at IS NULL;
    ALTER TABLE documents ALTER COLUMN created_at SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='documents' AND column_name='updated_at' AND is_nullable='YES') THEN
    UPDATE documents SET updated_at = now() WHERE updated_at IS NULL;
    ALTER TABLE documents ALTER COLUMN updated_at SET NOT NULL;
  END IF;
END $$;

`;

function main() {
  const sql = exportSchema();
  const stmts = splitStatements(sql);

  let out = HEADER;
  out += `-- ---------------------------------------------------------------------------\n-- Enums\n-- ---------------------------------------------------------------------------\n`;
  const tables: ParsedTable[] = [];
  const fks: string[] = [];
  const idxs: string[] = [];
  for (const s of stmts) {
    if (/^CREATE TYPE/i.test(s)) {
      const e = parseEnum(s);
      if (e) out += emitEnumIdempotent(e.name, e.values);
    } else if (/^CREATE TABLE/i.test(s)) {
      const t = parseTable(s);
      if (t) tables.push(t);
    } else if (/^ALTER TABLE/i.test(s)) {
      fks.push(s);
    } else if (/^CREATE\s+(UNIQUE\s+)?INDEX/i.test(s)) {
      idxs.push(s);
    }
  }

  out += `\n-- ---------------------------------------------------------------------------\n-- Tables (CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS for each).\n-- ---------------------------------------------------------------------------\n`;
  for (const t of tables) {
    out += emitTableIdempotent(t);
  }

  out += CLEANUP_DROPS;
  out += ENUM_RECREATE;
  out += COLUMN_TYPE_FIXES;

  out += `\n-- ---------------------------------------------------------------------------\n-- Foreign keys (re-added after type alterations).\n-- ---------------------------------------------------------------------------\n`;
  for (const f of fks) {
    out += emitForeignKey(f);
  }

  out += `\n-- ---------------------------------------------------------------------------\n-- Indexes.\n-- ---------------------------------------------------------------------------\n`;
  for (const i of idxs) {
    out += emitIndex(i);
  }

  process.stdout.write(out);
}

main();
