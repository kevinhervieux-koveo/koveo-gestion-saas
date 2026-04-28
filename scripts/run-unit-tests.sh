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
#   fast     - mirrors the previous `npm run test:fast` flags (75% workers,
#              --silent for quieter CI output).
#   full     - mirrors the previous `npm run test:unit` flags (50% workers,
#              full reporter output).
#   affected - per-task gate: resolves a git base ref and runs only Jest
#              tests related to files changed since that commit via
#              `--changedSince=<base>` scoped to UNIT_PATHS. When no TS/JS
#              files changed (doc-only or config-only diff), exits 0
#              immediately without invoking Jest. Falls back to the existing
#              `fast` behaviour when no base ref is available.
#              When the affected suite count exceeds AFFECTED_SUITE_CAP
#              (default: 40, override via env var), falls back to the smoke
#              subset instead of degenerating into the full suite cascade.
#
# Where each mode runs (Task #1118 + Task #1121):
#   affected → "Fast unit tests" workflow (isValidation=true in .replit).
#              This is the per-task validation gate. Kept lightweight so
#              every task iteration stays fast.
#   full     → "Full unit tests" workflow (manual / on-demand) AND the
#              [deployment].build hook in .replit (pre-deploy gate). The
#              workflow is intentionally NOT marked isValidation=true so
#              it does not duplicate "Fast unit tests" on every task. Run
#              it on-demand (e.g. nightly or before clicking Publish) to
#              catch timing-sensitive failures the silent fast sweep can
#              mask. The deployment build runs the same invocation so a
#              regression fails the publish before it reaches users.
#   fast     → no automated workflow; available as a manual local run for
#              developers who want the silent flags without --changedSince
#              scoping (e.g. when the git base ref is unavailable).

set -euo pipefail

SCRIPT_START_TIME=$(date +%s)
MODE="${1:-full}"

# Maximum number of affected suites before falling back to the smoke subset.
# Override via AFFECTED_SUITE_CAP env var (e.g. AFFECTED_SUITE_CAP=20 bash scripts/run-unit-tests.sh affected).
AFFECTED_SUITE_CAP="${AFFECTED_SUITE_CAP:-40}"

UNIT_PATHS=(
  tests/unit/
  server/tests/ai-bill-analyze-route.test.ts
  server/tests/ai-document-analyze.test.ts
  server/tests/ai-document-extra-methods.test.ts
  server/tests/ai-invoice-extract-route.test.ts
  server/tests/ai-suggest-payment-schedule-route.test.ts
  server/tests/bills-available-years-monthly-summary-access.test.ts
  server/tests/document-text-endpoint.test.ts
  server/tests/upload-filename-normalization-secondary-routes.test.ts
  # Task #1473 — impersonation E2E (guards against silent audit-row drops).
  # The test gates itself on _INTEGRATION_DB_URL and skips cleanly without
  # a real Postgres connection, so it is safe to include here — it adds zero
  # runtime cost in environments without the integration DB.
  tests/integration/mcp/assume-user-http-e2e.test.ts
)

# Smoke subset used when the affected cascade would exceed AFFECTED_SUITE_CAP.
# Bounded set of high-signal tests that cover the most critical server paths
# without pulling in the full import graph via --changedSince. Intentionally
# excludes the broad `tests/unit/` directory tree to keep the run bounded.
SMOKE_PATHS=(
  server/tests/ai-bill-analyze-route.test.ts
  server/tests/ai-document-analyze.test.ts
  server/tests/ai-invoice-extract-route.test.ts
  server/tests/ai-suggest-payment-schedule-route.test.ts
  server/tests/bills-available-years-monthly-summary-access.test.ts
  server/tests/document-text-endpoint.test.ts
  server/tests/upload-filename-normalization-secondary-routes.test.ts
  tests/integration/mcp/assume-user-http-e2e.test.ts
)

COMMON_FLAGS=(
  --passWithNoTests=false
  --cache
  --forceExit
)

# Resolve a git base ref for `affected` mode.
# Returns the commit SHA or empty string if none can be determined.
resolve_base_ref() {
  # Honour an explicit override (useful in CI pipelines that know their base).
  if [[ -n "${GIT_BASE_REF:-}" ]]; then
    echo "$GIT_BASE_REF"
    return
  fi

  # GitHub Actions sets GITHUB_BASE_REF for pull-request events.
  if [[ -n "${GITHUB_BASE_REF:-}" ]]; then
    # GITHUB_BASE_REF is a branch name; turn it into a commit SHA.
    git rev-parse "origin/${GITHUB_BASE_REF}" 2>/dev/null || echo ""
    return
  fi

  # Try the merge base against common main-branch names.
  for branch in main master develop; do
    local sha
    sha=$(git merge-base HEAD "origin/${branch}" 2>/dev/null \
       || git merge-base HEAD "${branch}" 2>/dev/null \
       || true)
    if [[ -n "$sha" ]]; then
      echo "$sha"
      return
    fi
  done

  # Last resort: HEAD~1 (at least catches single-commit pushes).
  git rev-parse HEAD~1 2>/dev/null || echo ""
}

# Variables set by the mode block below.
EXTRA_FLAGS=()
# Tracks which path set Jest will actually run against (for summary log).
RUN_PATHS_LABEL="unit_paths"

case "$MODE" in
  fast)
    EXTRA_FLAGS=(--maxWorkers=75% --silent)
    ;;
  full)
    EXTRA_FLAGS=(--maxWorkers=50%)
    ;;
  affected)
    BASE_REF=$(resolve_base_ref)

    if [[ -z "$BASE_REF" ]]; then
      echo "[run-unit-tests] affected: no base ref found, falling back to fast mode"
      EXTRA_FLAGS=(--maxWorkers=75% --silent)
    else
      echo "[run-unit-tests] affected: running tests changed since ${BASE_REF}"

      # Collect changed TS/JS files from the diff so we can short-circuit
      # immediately if nothing changed (no Jest invocation).
      CHANGED_FILES=()
      while IFS= read -r f; do
        [[ "$f" =~ \.(ts|tsx|js|jsx|cjs|mjs)$ ]] && CHANGED_FILES+=("$f")
      done < <(git diff --name-only "$BASE_REF" 2>/dev/null)
      if [[ ${#CHANGED_FILES[@]} -eq 0 ]]; then
        echo "[run-unit-tests] affected: no TS/JS files changed — skipping Jest"
        ELAPSED=$(( $(date +%s) - SCRIPT_START_TIME ))
        echo "[run-unit-tests] summary: mode=affected suites=0 tests=0 elapsed=${ELAPSED}s"
        echo "[run-unit-tests] OK (no-op)"
        # Exit cleanly WITHOUT invoking Jest. Relying on --changedSince or
        # --passWithNoTests still launches the Jest runner, which can pick up
        # uncommitted working-tree changes or run a surprisingly large suite.
        # A hard short-circuit is the only reliable way to make a doc-only
        # change finish in well under a minute.
        exit 0
      else
        echo "[run-unit-tests] affected: ${#CHANGED_FILES[@]} changed TS/JS file(s) → counting affected suites..."

        # Count how many suites --changedSince would pull in. If the cascade
        # exceeds AFFECTED_SUITE_CAP suites, fall back to the bounded smoke
        # subset so a change to a deeply shared module (e.g. server/db.ts,
        # shared/schema.ts) does not degenerate into the full 300+ suite run.
        AFFECTED_SUITE_COUNT=$(TEST_TYPE=unit npx jest "${UNIT_PATHS[@]}" \
          --listTests --changedSince="$BASE_REF" \
          --cache --forceExit 2>/dev/null | grep -c '\.test\.' || true)

        echo "[run-unit-tests] affected: ${AFFECTED_SUITE_COUNT} suite(s) selected by --changedSince (cap=${AFFECTED_SUITE_CAP})"

        if [[ "$AFFECTED_SUITE_COUNT" -gt "$AFFECTED_SUITE_CAP" ]]; then
          echo "[run-unit-tests] affected: suite count ${AFFECTED_SUITE_COUNT} exceeds cap ${AFFECTED_SUITE_CAP} — falling back to smoke subset"
          # Run the bounded smoke subset without --changedSince so the result
          # is deterministic and immune to import-graph cascades.
          EXTRA_FLAGS=(--maxWorkers=75% --silent --passWithNoTests)
          COMMON_FLAGS=(--cache --forceExit)
          # Replace UNIT_PATHS with SMOKE_PATHS for the jest invocation below.
          UNIT_PATHS=("${SMOKE_PATHS[@]}")
          RUN_PATHS_LABEL="smoke_subset"
        else
          echo "[run-unit-tests] affected: suite count within cap → --changedSince scoped to unit tests"
          # Use --changedSince=<base> with UNIT_PATHS so Jest runs only the
          # tests within the unit allowlist that relate to the diff.
          # Note: --findRelatedTests is intentionally NOT combined here because
          # it overrides the positional UNIT_PATHS filter, causing integration
          # tests outside the allowlist to be pulled in.
          EXTRA_FLAGS=(--maxWorkers=75% --silent --passWithNoTests --changedSince="$BASE_REF")
          COMMON_FLAGS=(--cache --forceExit)
          RUN_PATHS_LABEL="affected(${AFFECTED_SUITE_COUNT})"
        fi
      fi
    fi
    ;;
  *)
    echo "Usage: $0 [fast|full|affected]" >&2
    exit 2
    ;;
esac

export TEST_TYPE=unit

JEST_OUTPUT_FILE=$(mktemp)
npx jest "${UNIT_PATHS[@]}" "${COMMON_FLAGS[@]}" "${EXTRA_FLAGS[@]}" 2>&1 | tee "$JEST_OUTPUT_FILE"
JEST_EXIT=${PIPESTATUS[0]}

ELAPSED=$(( $(date +%s) - SCRIPT_START_TIME ))

# Extract suite and test counts from Jest's final summary line, e.g.:
#   "Test Suites: 12 passed, 12 total"  "Tests: 240 passed, 240 total"
SUITE_COUNT=$(grep -oP 'Test Suites:.*?\K[0-9]+(?= total)' "$JEST_OUTPUT_FILE" | tail -1 || echo "?")
TEST_COUNT=$(grep -oP 'Tests:.*?\K[0-9]+(?= total)' "$JEST_OUTPUT_FILE" | tail -1 || echo "?")
rm -f "$JEST_OUTPUT_FILE"

echo "[run-unit-tests] summary: mode=${MODE}(${RUN_PATHS_LABEL}) suites=${SUITE_COUNT} tests=${TEST_COUNT} elapsed=${ELAPSED}s"

if [[ "$JEST_EXIT" -ne 0 ]]; then
  exit "$JEST_EXIT"
fi

echo "[run-unit-tests] OK (jest)"
