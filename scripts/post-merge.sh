#!/bin/bash
set -e

# Skip `npm install` when package-lock.json hasn't changed since the last
# successful install. After each install we write the sha256 of package-lock.json
# to node_modules/.package-lock.json.sha256 (a plain sentinel file). On the next
# run we compare: if the hashes match, node_modules is already in sync and we can
# skip the install entirely. This avoids ~30–60 s of redundant network activity on
# every merge when dependencies have not changed.
LOCK_FILE="package-lock.json"
HASH_SENTINEL="node_modules/.package-lock.json.sha256"

if [[ -f "$LOCK_FILE" && -f "$HASH_SENTINEL" ]]; then
  CURRENT_HASH=$(sha256sum "$LOCK_FILE" | awk '{print $1}')
  SAVED_HASH=$(cat "$HASH_SENTINEL" 2>/dev/null || echo "")
  if [[ "$CURRENT_HASH" == "$SAVED_HASH" ]]; then
    echo "[post-merge] lockfile unchanged — skipping npm install"
  else
    echo "[post-merge] lockfile changed — running npm install"
    npm install
    sha256sum "$LOCK_FILE" | awk '{print $1}' > "$HASH_SENTINEL"
  fi
else
  echo "[post-merge] lockfile or sentinel not found — running npm install"
  npm install
  # Write the sentinel so future runs can skip when unchanged.
  if [[ -f "$LOCK_FILE" && -d "node_modules" ]]; then
    sha256sum "$LOCK_FILE" | awk '{print $1}' > "$HASH_SENTINEL"
  fi
fi

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
