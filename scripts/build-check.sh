#!/usr/bin/env bash
#
# Lightweight build smoke-check for the per-task validation gate.
#
# Runs only the cheap parts of the full production build:
#   1. Server bundle — esbuild compiles server/index.ts. Catches missing
#      imports and TypeScript-level errors in the server entry point quickly
#      (~400 ms vs ~35 s for the full vite build). This check is always
#      deterministic regardless of workspace state.
#   2. Asset references — scripts/check-assets.mjs scans dist/public for
#      broken asset URLs. This check REQUIRES a previously built dist/public
#      directory; it is skipped on a clean workspace and a note is printed.
#      This is a known trade-off: the check verifies built artifact integrity
#      when available, but cannot reconstruct the frontend bundle itself
#      (that requires the full `npm run build`). Run `npm run build` first
#      if you need a deterministic asset-reference check from scratch.
#
# The full production build (`npm run build` / `npm run build:production`)
# is unchanged and continues to run the complete vite client bundle for
# actual deployments. This script is intentionally NOT a replacement for
# that path.
#
# Usage: bash scripts/build-check.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "[build-check] Bundling server entry point..."
npx esbuild server/index.ts \
  --platform=node \
  --packages=external \
  --bundle \
  --format=esm \
  --outdir=dist

echo "[build-check] Server bundle OK."

DIST_PUBLIC="$ROOT/dist/public"
if [[ -d "$DIST_PUBLIC" ]]; then
  echo "[build-check] Checking static asset references in $DIST_PUBLIC..."
  node scripts/check-assets.mjs
else
  echo "[build-check] Skipping asset check (dist/public not present — run 'npm run build' first)."
fi

echo "[build-check] Done."
