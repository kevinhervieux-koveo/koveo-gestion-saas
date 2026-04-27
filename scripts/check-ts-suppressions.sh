#!/usr/bin/env bash
#
# check-ts-suppressions.sh
#
# Detects any `@ts-nocheck` or bare `@ts-ignore` directives in TypeScript
# source files that are NOT already listed in TYPE_CHECK_DEBT.md (the tracked
# debt registry added in task #769).
#
# Rules:
#   @ts-nocheck   — only allowed in .ts/.tsx files explicitly listed in
#                   TYPE_CHECK_DEBT.md.
#   @ts-ignore    — never allowed; use `@ts-expect-error` with a task-reference
#                   comment instead (e.g. `// @ts-expect-error task #1234`).
#   @ts-expect-error — allowed anywhere as a surgical per-line suppression.
#
# Exit codes:
#   0  — no violations found
#   1  — at least one violation found (new suppression not in the debt registry)
#
# Usage:
#   bash scripts/check-ts-suppressions.sh
#

set -euo pipefail

DEBT_FILE="TYPE_CHECK_DEBT.md"
VIOLATIONS=0

# TS/TSX files only — shell scripts cannot carry TypeScript directives.
TS_GLOB=("--include=*.ts" "--include=*.tsx")

# Directories to scan (exclude node_modules, dist, .git)
SCAN_DIRS=(
  "client/src"
  "server"
  "shared"
  "scripts"
  "tests"
  "__mocks__"
)

echo "[ts-suppressions] Scanning for unsanctioned TypeScript suppressions..."

# Split the literal token so this script does not match its own grep patterns.
NOCHECK="@ts-""nocheck"
TSIGNORE="@ts-""ignore"

# ── 1. @ts-nocheck ────────────────────────────────────────────────────────────
# Any .ts/.tsx file containing `// @ts-nocheck` must be listed in the debt file.
while IFS= read -r file; do
  clean="${file#./}"
  if ! grep -qF "$clean" "$DEBT_FILE"; then
    echo "FAIL [new @ts-nocheck] $clean is not listed in $DEBT_FILE" >&2
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done < <(grep -rl "${TS_GLOB[@]}" "// $NOCHECK" "${SCAN_DIRS[@]}" 2>/dev/null || true)

# ── 2. @ts-ignore ─────────────────────────────────────────────────────────────
# `@ts-ignore` is banned outright. Use `@ts-expect-error` with a task ref.
while IFS= read -r match; do
  echo "FAIL [banned @ts-ignore] $match" >&2
  VIOLATIONS=$((VIOLATIONS + 1))
done < <(grep -rn "${TS_GLOB[@]}" "// $TSIGNORE" "${SCAN_DIRS[@]}" 2>/dev/null || true)

# ── Result ────────────────────────────────────────────────────────────────────
if [[ $VIOLATIONS -eq 0 ]]; then
  echo "[ts-suppressions] OK — no unsanctioned suppressions found."
  exit 0
else
  echo ""
  echo "[ts-suppressions] FAILED — $VIOLATIONS unsanctioned suppression(s) found."
  echo "  To fix: remove the suppression, or (for @ts-nocheck on legacy files)"
  echo "  add the file path to TYPE_CHECK_DEBT.md and include a task reference."
  exit 1
fi
