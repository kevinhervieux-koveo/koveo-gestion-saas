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
    npm install --prefer-offline --no-audit --no-fund
    sha256sum "$LOCK_FILE" | awk '{print $1}' > "$HASH_SENTINEL"
  fi
else
  echo "[post-merge] lockfile or sentinel not found — running npm install"
  npm install --prefer-offline --no-audit --no-fund
  # Write the sentinel so future runs can skip when unchanged.
  if [[ -f "$LOCK_FILE" && -d "node_modules" ]]; then
    sha256sum "$LOCK_FILE" | awk '{print $1}' > "$HASH_SENTINEL"
  fi
fi

# Skip `npm run migrate` when no numbered migration files have changed since the
# last successful run. We compute a combined sha256 over the sorted list of
# NNNN_*.sql filenames + their contents and compare to a sentinel stored at
# node_modules/.migrations.sha256. If the hashes match, migrations are already
# up to date. If they differ (or the sentinel is missing), we run the migration
# runner and write the new sentinel only after a successful exit, so a failure
# never poisons future runs. Using node_modules/ as the sentinel location means
# it is automatically wiped whenever node_modules is rebuilt.
MIGRATIONS_DIR="migrations"
MIGRATIONS_SENTINEL="node_modules/.migrations.sha256"

compute_migrations_hash() {
  # Only consider numbered migration files matching NNNN_*.sql (same regex as
  # the runner). Hash filenames + contents so renames also trigger a rerun.
  find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' \
    | grep -E '/[0-9]{4}_.+\.sql$' \
    | sort \
    | xargs -I{} sh -c 'echo "{}"; sha256sum "{}"' \
    | sha256sum \
    | awk '{print $1}'
}

if [[ -d "$MIGRATIONS_DIR" && -f "$MIGRATIONS_SENTINEL" ]]; then
  CURRENT_MIG_HASH=$(compute_migrations_hash)
  SAVED_MIG_HASH=$(cat "$MIGRATIONS_SENTINEL" 2>/dev/null || echo "")
  if [[ "$CURRENT_MIG_HASH" == "$SAVED_MIG_HASH" ]]; then
    echo "[post-merge] migrations unchanged — skipping migrate"
  else
    echo "[post-merge] migrations changed — running migrate"
    RUN_DB_MIGRATIONS=true npm run migrate
    echo "$CURRENT_MIG_HASH" > "$MIGRATIONS_SENTINEL"
  fi
else
  echo "[post-merge] migrations sentinel not found — running migrate"
  # Apply the numbered SQL migrations under migrations/ (see
  # scripts/run-migrations.ts). Replaces the previous `npm run db:push`
  # call as part of Task #815: pushing the Drizzle schema directly let dev
  # and prod drift apart because nothing got recorded in the migration
  # chain. New schema changes must ship as numbered migrations alongside
  # the schema.ts diff — see docs/migrations.md.
  RUN_DB_MIGRATIONS=true npm run migrate
  if [[ -d "$MIGRATIONS_DIR" && -d "node_modules" ]]; then
    compute_migrations_hash > "$MIGRATIONS_SENTINEL"
  fi
fi

# Prune the `subrepl-*` local branches and remotes that Replit sub-agents
# auto-create on every isolated task run. Without this they accumulate in
# `.git/config` / `.git/packed-refs` and slow every git operation down
# (Task #1124). The cleanup script never fails the caller, but we still
# guard with `|| true` so a transient git issue can't break post-merge.
#
# We wrap the call in `timeout` so a pathological git state (e.g. hundreds
# of stale `.lock` files in `.git/refs/heads/` left behind by interrupted
# git ops) can never hang past the post-merge window. The cleanup is
# best-effort hygiene — if it doesn't finish in 60 s the next merge will
# pick up where this one left off, and the lock-file pruning at the top
# of the cleanup script keeps the backlog from growing unbounded.
timeout --signal=TERM --kill-after=10s 60s \
  bash scripts/cleanup-subrepl-refs.sh --quiet \
  || echo "[post-merge] cleanup-subrepl-refs skipped/aborted (exit=$?)"
