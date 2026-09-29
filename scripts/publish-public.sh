#!/usr/bin/env bash
# Publishes a clean snapshot of the current commit to the public repository.
#
# The snapshot is the tracked tree of HEAD minus every path in .publicignore, committed with a neutral
# author and no history from this repository. The first run creates the public branch from scratch;
# later runs add one commit on top of the public branch, so the public history stays linear and
# contributors' clones keep working. Before pushing, every file is checked against the patterns in
# .publicdeny and the run aborts on a match.
#
# Usage:
#   scripts/publish-public.sh --dry-run                    build the snapshot locally and report
#   scripts/publish-public.sh <remote-url> [branch]        build and push (branch defaults to main)
#   PUBLIC_MESSAGE="..." scripts/publish-public.sh ...     commit message (default: "Sync from private repository")
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
REMOTE="${1:-}"
BRANCH="${2:-main}"
if [ -z "$REMOTE" ]; then
  echo "usage: $0 <remote-url|--dry-run> [branch]" >&2
  exit 1
fi
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "commit or stash your changes first; the snapshot is taken from HEAD" >&2
  exit 1
fi

AUTHOR_NAME="${PUBLIC_AUTHOR_NAME:-Verdex}"
AUTHOR_EMAIL="${PUBLIC_AUTHOR_EMAIL:-noreply@useverdex.xyz}"
MESSAGE="${PUBLIC_MESSAGE:-Sync from private repository}"

EXPORT="$(mktemp -d)"
trap 'rm -rf "$EXPORT"' EXIT
git archive --format=tar HEAD | tar -x -C "$EXPORT"

# Drop the excluded paths.
if [ -f .publicignore ]; then
  while IFS= read -r line; do
    p="${line%%#*}"; p="${p## }"; p="${p%% }"
    [ -z "$p" ] && continue
    rm -rf "${EXPORT:?}/$p"
  done < .publicignore
fi

# Refuse to publish anything that matches a denied pattern.
if [ -f .publicdeny ]; then
  PATTERNS="$(grep -v -E '^\s*(#|$)' .publicdeny || true)"
  if [ -n "$PATTERNS" ]; then
    HITS="$(cd "$EXPORT" && grep -rIl -i -E -f <(printf '%s\n' "$PATTERNS") . || true)"
    if [ -n "$HITS" ]; then
      echo "aborting: denied strings found in the snapshot:" >&2
      printf '  %s\n' $HITS >&2
      exit 2
    fi
  fi
fi

FILES="$(cd "$EXPORT" && find . -type f | wc -l | tr -d ' ')"
SIZE="$(du -sh "$EXPORT" | cut -f1)"

cd "$EXPORT"
git init -q -b "$BRANCH"
git config user.name "$AUTHOR_NAME"
git config user.email "$AUTHOR_EMAIL"
PARENT=""
if [ "$REMOTE" != "--dry-run" ]; then
  git remote add public "$REMOTE"
  if git fetch -q public "$BRANCH" 2>/dev/null; then
    PARENT="$(git rev-parse FETCH_HEAD)"
    git reset -q --soft FETCH_HEAD
  fi
fi
git add -A
if [ -n "$PARENT" ] && git diff --cached --quiet; then
  echo "public branch already matches HEAD; nothing to publish"
  exit 0
fi
git -c commit.gpgsign=false commit -q -m "$MESSAGE"
echo "snapshot: $FILES files, $SIZE, commit $(git rev-parse --short HEAD)${PARENT:+ on top of ${PARENT:0:7}}"

if [ "$REMOTE" = "--dry-run" ]; then
  trap - EXIT
  echo "dry run: nothing pushed. Snapshot kept at $EXPORT. Tree:"
  git ls-files | sed 's|/.*||' | sort | uniq -c | sort -rn
  exit 0
fi
git push -q public "$BRANCH"
echo "pushed $BRANCH to $REMOTE"
