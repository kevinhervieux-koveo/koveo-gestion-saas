import { neon } from '@neondatabase/serverless';
let url = process.env.PRODUCTION_DATABASE_URL || '';
const m1 = url.match(/postgres(?:ql)?:\/\/[^\s'"]+/);
if (m1) url = m1[0];
const sql = neon(url);

const schemas = await sql`SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast') ORDER BY schema_name`;
console.log('schemas:', schemas.map(s=>s.schema_name).join(', '));

const migTables = await sql`SELECT table_schema, table_name FROM information_schema.tables WHERE table_name ILIKE '%migration%' OR table_name ILIKE '%drizzle%'`;
console.log('migration-like tables:'); console.table(migTables);

const enumVals = await sql`SELECT unnest(enum_range(NULL::invitation_status)) AS value`;
console.log('invitation_status enum values:'); console.table(enumVals);

const idx = await sql`SELECT indexname, indexdef FROM pg_indexes WHERE tablename='invitations'`;
console.log('invitations indexes:'); console.table(idx);

const fks = await sql`
  SELECT conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint
  WHERE conrelid='invitation_audit_log'::regclass AND contype='f'`;
console.log('invitation_audit_log FKs:'); console.table(fks);

const tbls = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`;
console.log('public tables count:', tbls.length);
