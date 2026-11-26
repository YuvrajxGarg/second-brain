#!/usr/bin/env bash
# Vercel "Ignored Build Step". Exit 0 = skip this deploy, exit 1 = build.
# Notes are pushed to main right away (nothing is lost), but the site only
# redeploys once a batch has piled up. See "Batched deploys" in CLAUDE.md.
BATCH=${BRAIN_DEPLOY_BATCH:-5}
MSG="${VERCEL_GIT_COMMIT_MESSAGE:-$(git log -1 --format=%B 2>/dev/null)}"
PREV="$VERCEL_GIT_PREVIOUS_SHA"

build() { echo "deploy: $1"; exit 1; }
skip()  { echo "skip: $1"; exit 0; }

# 1. Explicit request, or an edit made on the graph site (he wants to see it).
case "$MSG" in *"[deploy]"*) build "[deploy] in commit message";; esac
case "$MSG" in *"(from site)"*) build "edit from the graph site";; esac

# 2. No usable last-deploy commit (first deploy, shallow clone): be safe, build.
[ -z "$PREV" ] && build "no previous deployment sha"
git cat-file -e "$PREV^{commit}" 2>/dev/null || build "previous sha not in clone"
[ "$PREV" = "$(git rev-parse HEAD)" ] && build "redeploy of same commit"

# 3. Anything other than notes and generated files (site, api, scripts, config): build.
#    Vault-sync heartbeats (projects/.sync/<machine>.health.json) never deploy on their own.
OTHER=$(git diff --name-only "$PREV" HEAD -- . \
  ':(exclude)topics' ':(exclude)inbox' ':(exclude)suggestions' \
  ':(exclude)catalog' ':(exclude,glob)*.md' ':(exclude)llms.txt' ':(exclude)llms-full.txt' \
  ':(exclude,glob)projects/.sync/*.health.json')
[ -n "$OTHER" ] && build "non-note changes: $(echo $OTHER | head -c 200)"

# 4. Notes added or changed since the last deploy.
N=$(git diff --name-only --diff-filter=AMDR "$PREV" HEAD -- ':(glob)topics/**/*.md' | wc -l | tr -d ' ')
[ "$N" -ge "$BATCH" ] && build "$N notes pending (batch is $BATCH)"

# 5. Daily flush: the ~9 AM suggestions commit ships whatever is pending.
case "$MSG" in suggest:*) [ "$N" -gt 0 ] && build "daily flush of $N pending notes";; esac

skip "$N of $BATCH notes pending, waiting for more"
