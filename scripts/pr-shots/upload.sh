#!/usr/bin/env bash
# Uploads .cache/pr-shots/*.png to the chore/pr-assets branch under pr-<N>/ and prints each image's URL.
# Touches no working tree, index or branch of the caller: a temporary index builds the commit.
# The branch never merges, so main stays free of binaries. URLs pin the commit, so later uploads never break them.
# Usage, from the repository root (Git Bash on Windows): scripts/pr-shots/upload.sh <pr-number>
set -euo pipefail

pr=${1:?usage: scripts/pr-shots/upload.sh <pr-number>}
branch=chore/pr-assets
shopt -s nullglob
shots=(.cache/pr-shots/*.png)
[ ${#shots[@]} -gt 0 ] || { echo "no .cache/pr-shots/*.png to upload" >&2; exit 1; }
for f in "${shots[@]}"; do
  [[ $(basename "$f") =~ ^[A-Za-z0-9._-]+$ ]] || { echo "rename $f: letters, digits, dot, dash and underscore only, so the URL needs no escaping" >&2; exit 1; }
done

git fetch -q origin "$branch"
parent=$(git rev-parse FETCH_HEAD)

# One index per run, so two uploads never share one. Git wants it missing, not empty: no mktemp.
export GIT_INDEX_FILE=.cache/pr-assets.$$.index
trap 'rm -f "$GIT_INDEX_FILE"' EXIT
git read-tree "$parent"
for f in "${shots[@]}"; do
  git update-index --add --cacheinfo "100644,$(git hash-object -w "$f"),pr-$pr/$(basename "$f")"
done
commit=$(git commit-tree "$(git write-tree)" -p "$parent" -m "chore: screenshots for #$pr")

git push -q origin "$commit:refs/heads/$branch"
for f in "${shots[@]}"; do
  echo "https://raw.githubusercontent.com/arnorgeir/wow-gear-tracker/$commit/pr-$pr/$(basename "$f")"
done
