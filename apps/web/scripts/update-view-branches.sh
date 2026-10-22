#!/usr/bin/env bash
# Builds the view/* branches: each is one of our branches plus the demo-data layer (the juan-preview branch), so that
# branch can be opened live on made-up data without a database. The source branches stay clean; a view branch is
# regenerated from scratch every time, so it is force-pushed. Run it after merging Juan into the other branches.
#
#   scripts/update-view-branches.sh            all four
#   scripts/update-view-branches.sh admin      just one (juan, admin, demo1 or demo2)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git fetch -q origin

pairs="juan:juan-preview admin:Juan-Admin demo1:Juan-Demo1 demo2:Juan-Demo2"
only="${1:-}"
for p in $pairs; do
  name="${p%%:*}"; source="${p##*:}"
  [ -z "$only" ] || [ "$only" = "$name" ] || continue
  tmp="$(mktemp -d)"
  echo "view/$name  <-  $source (+ demo data)"
  git worktree add -q -B "view/$name" "$tmp" "origin/$source"
  ( cd "$tmp"
    [ "$source" = "juan-preview" ] || git merge -q --no-edit -m "view/$name: $source plus the demo-data layer" origin/juan-preview
    git push -q -f origin "view/$name" )
  git worktree remove --force "$tmp"
  git branch -D "view/$name" -q
done
echo "Done. Each view branch builds on the mentorful-branches Vercel project."
