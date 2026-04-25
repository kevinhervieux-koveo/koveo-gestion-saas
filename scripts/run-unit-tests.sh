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
# After Jest finishes we additionally run a curated set of vitest-only
# integration tests via `npx vitest run <path>`. Those files import from
# `vitest` directly (custom message arg on `expect`, etc.) so they cannot
# be picked up by the Jest allowlist above without an invasive port. Wiring
# them in here ensures a regression in the upload-filename Latin-1
# round-trip suite (Task #869, extended in Task #892) fails the standard
# Fast/Full unit-test workflows instead of only being caught by manual
# vitest runs.
#
# Both phases (Jest + vitest) always run regardless of which fails first,
# and the script exits non-zero if either phase failed. This guarantees
# that a regression in `fixLatin1MisdecodeFilename` or in any of the
# patched upload routes is surfaced even when an unrelated Jest suite is
# flaky on the same run.
#
# Mode selector (first arg, defaults to `full`):
#   fast - mirrors the previous `npm run test:fast` flags (75% workers,
#          --silent for quieter CI output).
#   full - mirrors the previous `npm run test:unit` flags (50% workers,
#          full reporter output).

# NOTE: `set -e` is intentionally disabled (only `-uo pipefail` is on)
# so that both the Jest and vitest phases below always run regardless of
# which fails first. Any future command added to this script that should
# abort on failure MUST capture and check its own exit status (see the
# `JEST_STATUS=0; ... || JEST_STATUS=$?` pattern at the bottom). Don't
# add bare commands here and assume `set -e` will catch them.
set -uo pipefail

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

# Vitest-only files that must run alongside the Jest allowlist above.
# Keep this list explicit (no globs): adding a new vitest file should be
# a deliberate decision so the unit-test runtime stays predictable.
VITEST_PATHS=(
  server/tests/upload-filename-normalization-integration.test.ts
)

COMMON_FLAGS=(
  --passWithNoTests=false
  --cache
  --forceExit
)

case "$MODE" in
  fast)
    EXTRA_FLAGS=(--maxWorkers=75% --silent)
    VITEST_REPORTER_FLAGS=(--reporter=dot)
    ;;
  full)
    EXTRA_FLAGS=(--maxWorkers=50%)
    VITEST_REPORTER_FLAGS=()
    ;;
  *)
    echo "Usage: $0 [fast|full]" >&2
    exit 2
    ;;
esac

export TEST_TYPE=unit

JEST_STATUS=0
npx jest "${UNIT_PATHS[@]}" "${COMMON_FLAGS[@]}" "${EXTRA_FLAGS[@]}" || JEST_STATUS=$?

echo
echo "[run-unit-tests] Running curated vitest suite (${#VITEST_PATHS[@]} file(s))..."
VITEST_STATUS=0
npx vitest run "${VITEST_PATHS[@]}" "${VITEST_REPORTER_FLAGS[@]}" || VITEST_STATUS=$?

if [[ "$JEST_STATUS" -ne 0 || "$VITEST_STATUS" -ne 0 ]]; then
  echo
  echo "[run-unit-tests] FAILED (jest=${JEST_STATUS}, vitest=${VITEST_STATUS})" >&2
  # Prefer surfacing the jest exit code when both failed — the jest output
  # is the larger signal in CI logs and matches the previous behaviour.
  if [[ "$JEST_STATUS" -ne 0 ]]; then
    exit "$JEST_STATUS"
  fi
  exit "$VITEST_STATUS"
fi

echo "[run-unit-tests] OK (jest + vitest)"
