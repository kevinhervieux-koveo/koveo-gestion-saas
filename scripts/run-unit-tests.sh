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
# Both phases (Jest + vitest) always run in `fast` and `full` modes regardless
# of which fails first, and the script exits non-zero if either phase failed.
# This guarantees that a regression in `fixLatin1MisdecodeFilename` or in any
# of the patched upload routes is surfaced even when an unrelated Jest suite
# is flaky on the same run.
#
# In `affected` mode the vitest phase runs ONLY when relevant upload/filename
# source files appear in the diff — the test requires a real Postgres DB so
# it should not run unconditionally on every small change. The vitest phase
# still runs in full/fast modes so those workflows are unaffected.
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
#              `fast` behaviour (including vitest) when no base ref is
#              available. In affected mode with a base ref, vitest is run
#              only when relevant upload/filename source files are in the diff.
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

# Vitest-only files that must run alongside the Jest allowlist in fast/full.
# Keep this list explicit (no globs): adding a new vitest file should be
# a deliberate decision so the unit-test runtime stays predictable.
VITEST_PATHS=(
  server/tests/upload-filename-normalization-integration.test.ts
)

# Source files that, when changed, should trigger the vitest phase in
# `affected` mode. Keep in sync with VITEST_PATHS above.
VITEST_TRIGGER_PATTERNS=(
  "server/utils/filenameNormalization"
  "server/api/documents"
  "server/api/bills"
  "server/api/maintenance"
  "upload-filename-normalization"
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
RUN_VITEST=true
EXTRA_FLAGS=()
VITEST_REPORTER_FLAGS=()

case "$MODE" in
  fast)
    EXTRA_FLAGS=(--maxWorkers=75% --silent)
    VITEST_REPORTER_FLAGS=(--reporter=dot)
    ;;
  full)
    EXTRA_FLAGS=(--maxWorkers=50%)
    VITEST_REPORTER_FLAGS=()
    ;;
  affected)
    BASE_REF=$(resolve_base_ref)

    if [[ -z "$BASE_REF" ]]; then
      echo "[run-unit-tests] affected: no base ref found, falling back to fast mode"
      EXTRA_FLAGS=(--maxWorkers=75% --silent)
      VITEST_REPORTER_FLAGS=(--reporter=dot)
      # RUN_VITEST remains true (same as fast mode)
    else
      echo "[run-unit-tests] affected: running tests changed since ${BASE_REF}"

      # Collect changed TS/JS files from the diff so we can:
      #   - short-circuit immediately if nothing changed (no Jest invocation)
      #   - check VITEST_TRIGGER_PATTERNS to decide whether the vitest phase runs
      CHANGED_FILES=()
      while IFS= read -r f; do
        [[ "$f" =~ \.(ts|tsx|js|jsx|cjs|mjs)$ ]] && CHANGED_FILES+=("$f")
      done < <(git diff --name-only "$BASE_REF" 2>/dev/null)
      if [[ ${#CHANGED_FILES[@]} -eq 0 ]]; then
        echo "[run-unit-tests] affected: no TS/JS files changed — skipping Jest and vitest"
        echo "[run-unit-tests] OK (no-op)"
        # Exit cleanly WITHOUT invoking Jest. Relying on --changedSince or
        # --passWithNoTests still launches the Jest runner, which can pick up
        # uncommitted working-tree changes or run a surprisingly large suite.
        # A hard short-circuit is the only reliable way to make a doc-only
        # change finish in well under a minute.
        exit 0
      else
        echo "[run-unit-tests] affected: ${#CHANGED_FILES[@]} changed TS/JS file(s) → --changedSince scoped to unit tests"
        # Use --changedSince=<base> with UNIT_PATHS so Jest runs only the
        # tests within the unit allowlist that relate to the diff.
        # Note: --findRelatedTests is intentionally NOT combined here because
        # it overrides the positional UNIT_PATHS filter, causing integration
        # tests outside the allowlist to be pulled in.
        EXTRA_FLAGS=(--maxWorkers=75% --silent --passWithNoTests --changedSince="$BASE_REF")
        COMMON_FLAGS=(--cache --forceExit)

        # Run vitest only if relevant upload/filename source files changed.
        RUN_VITEST=false
        for pattern in "${VITEST_TRIGGER_PATTERNS[@]}"; do
          for f in "${CHANGED_FILES[@]}"; do
            if [[ "$f" == *"$pattern"* ]]; then
              RUN_VITEST=true
              echo "[run-unit-tests] affected: vitest triggered by changed file: $f"
              break 2
            fi
          done
        done

        if [[ "$RUN_VITEST" == "false" ]]; then
          echo "[run-unit-tests] affected: skipping vitest (no relevant files in diff)"
        fi
      fi

      VITEST_REPORTER_FLAGS=(--reporter=dot)
    fi
    ;;
  *)
    echo "Usage: $0 [fast|full|affected]" >&2
    exit 2
    ;;
esac

export TEST_TYPE=unit

JEST_STATUS=0
npx jest "${UNIT_PATHS[@]}" "${COMMON_FLAGS[@]}" "${EXTRA_FLAGS[@]}" || JEST_STATUS=$?

if [[ "$RUN_VITEST" == "true" ]]; then
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
else
  if [[ "$JEST_STATUS" -ne 0 ]]; then
    echo
    echo "[run-unit-tests] FAILED (jest=${JEST_STATUS})" >&2
    exit "$JEST_STATUS"
  fi

  echo "[run-unit-tests] OK (jest)"
fi
