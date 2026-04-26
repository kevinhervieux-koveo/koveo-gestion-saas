#!/bin/bash
set -e
npm install

# Idempotent guard: ensure `ai_suggestion_cache` exists. It lives in
# shared/schemas/infrastructure.ts but does NOT yet have a numbered
# migration of its own — historically it was created via `drizzle-kit
# push` only. Until it is folded into a numbered migration, we create it
# here so post-merge dev databases match the schema. Safe on fresh DBs
# and no-ops on databases that already have it.
PGURL="${DATABASE_URL_KOVEO:-${DATABASE_URL:-}}"
if [ -n "$PGURL" ]; then
  psql "$PGURL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS ai_suggestion_cache (
  cache_key text PRIMARY KEY,
  value json NOT NULL,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_suggestion_cache_expires_idx
  ON ai_suggestion_cache(expires_at);
CREATE INDEX IF NOT EXISTS ai_suggestion_cache_created_idx
  ON ai_suggestion_cache(created_at);
SQL
fi

# Apply the numbered SQL migrations under migrations/ (see
# scripts/run-migrations.ts). Replaces the previous `npm run db:push`
# call as part of Task #815: pushing the Drizzle schema directly let dev
# and prod drift apart because nothing got recorded in the migration
# chain. New schema changes must ship as numbered migrations alongside
# the schema.ts diff — see docs/migrations.md.
RUN_DB_MIGRATIONS=true npm run migrate

# Prune the `subrepl-*` local branches and remotes that Replit sub-agents
# auto-create on every isolated task run. Without this they accumulate in
# `.git/config` / `.git/packed-refs` and slow every git operation down
# (Task #1124). The cleanup script never fails the caller, but we still
# guard with `|| true` so a transient git issue can't break post-merge.
bash scripts/cleanup-subrepl-refs.sh --quiet || true
