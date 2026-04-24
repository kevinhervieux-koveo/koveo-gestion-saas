#!/usr/bin/env bash
#
# Runs the unit-tier Jest suites for CI ("Fast unit tests" / "Full unit tests").
#
# In addition to the canonical `tests/unit/` tree, this script includes a
# curated subset of `server/tests/ai-*.test.ts` route-level tests so the
# AI route handlers (Task #556) get exercised on every change. Without this
# explicit listing the workflows would invoke jest with `tests/unit/` only,
# which overrides the jest config's `testMatch` and silently excludes
# everything under `server/tests/`.
#
# The three cache-coupled AI tests (`ai-suggestion-cache.test.ts`,
# `ai-suggestion-cache-prune.test.ts`, `ai-document-tag-suggestion.test.ts`)
# are intentionally omitted: they share the real-Postgres
# `ai_suggestion_cache` table and currently flake under parallel workers.
# A separate follow-up ("Stop AI suggestion cache tests from interfering
# with other AI tests") tracks isolating their fixtures so they can be
# wired in safely.
#
# Mode selector (first arg, defaults to `full`):
#   fast - mirrors the previous `npm run test:fast` flags (75% workers,
#          --silent for quieter CI output).
#   full - mirrors the previous `npm run test:unit` flags (50% workers,
#          full reporter output).

set -euo pipefail

MODE="${1:-full}"

UNIT_PATHS=(
  tests/unit/
  server/tests/ai-bill-analyze-route.test.ts
  server/tests/ai-document-analyze.test.ts
  server/tests/ai-document-extra-methods.test.ts
  server/tests/ai-invoice-extract-route.test.ts
  server/tests/ai-suggest-payment-schedule-route.test.ts
  server/tests/document-text-endpoint.test.ts
)

COMMON_FLAGS=(
  --passWithNoTests=false
  --cache
  --forceExit
)

case "$MODE" in
  fast)
    EXTRA_FLAGS=(--maxWorkers=75% --silent)
    ;;
  full)
    EXTRA_FLAGS=(--maxWorkers=50%)
    ;;
  *)
    echo "Usage: $0 [fast|full]" >&2
    exit 2
    ;;
esac

export TEST_TYPE=unit
exec npx jest "${UNIT_PATHS[@]}" "${COMMON_FLAGS[@]}" "${EXTRA_FLAGS[@]}"
