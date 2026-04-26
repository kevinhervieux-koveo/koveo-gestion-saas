#!/usr/bin/env bash
# cleanup-subrepl-refs.sh
#
# Prunes the `subrepl-*` local branches and remotes that Replit sub-agents
# auto-create on every isolated task run. Without this, `.git/config` and
# `.git/packed-refs` accumulate hundreds of stale refs over time and slow
# every git operation down (Task #1124).
#
# Safe to run at any time:
#   - Skips the currently-checked-out branch
#   - Tolerates a missing `.git` directory (no-op outside a repo)
#   - Never fails the caller: every git invocation is guarded
#
# Flags:
#   -n, --dry-run   List what would be removed, but don't change anything
#   -q, --quiet     Suppress the per-ref output; only print the summary
#   -h, --help      Show usage

set -u

DRY_RUN=0
QUIET=0

usage() {
  sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    -n|--dry-run) DRY_RUN=1 ;;
    -q|--quiet)   QUIET=1 ;;
    -h|--help)    usage; exit 0 ;;
    *) echo "Unknown flag: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

log() { [ "$QUIET" -eq 1 ] || echo "$@"; }

# Bail out quietly if we're not inside a git work tree.
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  log "cleanup-subrepl-refs: not a git repository, nothing to do"
  exit 0
fi

CURRENT_BRANCH="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"

branches_removed=0
branches_skipped=0
remotes_removed=0

# --- Local branches: subrepl-* ------------------------------------------------
while IFS= read -r branch; do
  [ -z "$branch" ] && continue
  if [ "$branch" = "$CURRENT_BRANCH" ]; then
    log "  skip (checked out): $branch"
    branches_skipped=$((branches_skipped + 1))
    continue
  fi
  if [ "$DRY_RUN" -eq 1 ]; then
    log "  would delete branch: $branch"
    branches_removed=$((branches_removed + 1))
  else
    if git branch -D "$branch" >/dev/null 2>&1; then
      log "  deleted branch: $branch"
      branches_removed=$((branches_removed + 1))
    else
      log "  failed to delete branch: $branch"
    fi
  fi
done < <(git for-each-ref --format='%(refname:short)' 'refs/heads/subrepl-*' 2>/dev/null)

# --- Remotes: subrepl-* -------------------------------------------------------
while IFS= read -r remote; do
  [ -z "$remote" ] && continue
  case "$remote" in
    subrepl-*) ;;
    *) continue ;;
  esac
  if [ "$DRY_RUN" -eq 1 ]; then
    log "  would remove remote: $remote"
    remotes_removed=$((remotes_removed + 1))
  else
    if git remote remove "$remote" >/dev/null 2>&1; then
      log "  removed remote: $remote"
      remotes_removed=$((remotes_removed + 1))
    else
      log "  failed to remove remote: $remote"
    fi
  fi
done < <(git remote 2>/dev/null)

# --- Summary ------------------------------------------------------------------
if [ "$DRY_RUN" -eq 1 ]; then
  echo "cleanup-subrepl-refs: would remove $branches_removed branch(es) and $remotes_removed remote(s); skipped $branches_skipped (dry run)"
else
  echo "cleanup-subrepl-refs: removed $branches_removed branch(es) and $remotes_removed remote(s); skipped $branches_skipped"
fi

exit 0
