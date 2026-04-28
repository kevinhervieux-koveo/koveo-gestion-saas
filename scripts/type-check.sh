#!/usr/bin/env bash
#
# scripts/type-check.sh
#
# Wrapper around `npx tsc --noEmit` that primes the TypeScript incremental
# build cache before the compile and writes it back to a committed seed
# afterwards.
#
# Why this exists (Task #1613):
#   tsconfig.json points `tsBuildInfoFile` at /tmp/.tsbuildinfo (Task #1611)
#   so that re-runs inside the SAME Replit session are incremental. But
#   /tmp does not survive across isolated task environments, so every new
#   task started cold and paid the full ~30–60 s of a from-scratch type
#   check.
#
#   Anything checked into the git working tree DOES survive task
#   isolation (the platform commits at end-of-task and a new task gets
#   the latest tree). So we keep a committed copy of the build info at
#   `.tscache/tsbuildinfo` and restore it into /tmp before invoking tsc.
#   After tsc finishes we copy the freshly-updated /tmp file back over
#   the seed so the next isolated environment also starts warm.
#
# Layout:
#   /tmp/.tsbuildinfo      – live working file (configured in tsconfig.json)
#   .tscache/tsbuildinfo   – committed seed used to warm-start /tmp
#
# This script is intentionally idempotent and safe to run when either
# file is missing — it just degrades to a cold start in that case.

set -uo pipefail

SEED=".tscache/tsbuildinfo"
WORK="/tmp/.tsbuildinfo"

if [[ -f "$WORK" ]]; then
  echo "[type-check] /tmp build cache already present — same-session warm start"
elif [[ -f "$SEED" ]]; then
  echo "[type-check] restoring TypeScript build cache from $SEED (cross-task warm start)"
  cp "$SEED" "$WORK"
else
  echo "[type-check] no build cache found — cold start (this run will be slow)"
fi

npx tsc --noEmit
status=$?

if [[ -f "$WORK" ]]; then
  mkdir -p "$(dirname "$SEED")"
  # Only copy if the working file is newer or the seed is missing/different.
  # This keeps `git status` quiet when type check is a no-op.
  if [[ ! -f "$SEED" ]] || ! cmp -s "$WORK" "$SEED"; then
    cp "$WORK" "$SEED"
    echo "[type-check] updated $SEED with refreshed build info"
  fi
fi

exit $status
