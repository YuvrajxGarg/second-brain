---
name: log-to-brain
description: Log a project's status, context, learnings, mistakes or taste from the current chat into Yuvraj's Vault (Documents/Vault, one folder per project), reusing the existing project instead of making copies.
---

# Log to brain

Use when Yuvraj says things like "log this", "log this to my brain", "save the status of this build", "note what we learned", or wraps up a work session on one of his projects.

The log goes into his **Vault**, not into the project's code folder. The vault syncs into his second brain (YuvrajxGarg/second-brain, `projects/<slug>/`) once a day via `tools/vault-sync/brain_sync.py`. A copy in the project's own folder is optional.

## 1. Work out which project

From the chat: the repo or folder name, the app or game name, what he called it. If it's genuinely unclear, ask in one line.

## 2. Find it before creating anything (no copies)

Check, in order, and stop at the first match:

1. **Vault folder.** Vault path: `vault` in `~/.brain-sync/config.json` if it exists, else `~/Documents/Vault` (Mac) or `%USERPROFILE%\Documents\Vault` (Windows, may be under OneDrive). List its folders (skip ones starting with `_` or `.`). Match on folder name, slug (lowercase kebab-case) and the `title:` in each `project.md`. Treat "Munde Mode", "munde-mode" and "MundeMode" as the same.
2. **Brain repo `projects/<slug>/`** (synced from the other computer but maybe not pulled yet): Second Brain MCP `search` / `list_notes`, or `https://raw.githubusercontent.com/YuvrajxGarg/second-brain/main/projects/<slug>/project.md`.
3. **Existing brain note for the project** (most of his projects already have one in `topics/`): Second Brain MCP `get_catalog('projects')` or `search`. If found, remember its slug (filename without `.md`, e.g. `2026-11-12-munde-mode-game`).

Then:
- Vault folder exists: use it.
- Only in the repo: create the vault folder with that exact slug as its name, so the next sync links them instead of duplicating.
- Only a brain note exists: create the vault folder and set `note: <that slug>` in its `project.md`, so the docs attach to the existing note.
- Nothing exists: create a new project (step 4).

Never create a second folder or note for a project that already exists. If two candidates look plausible, ask which.

## 3. Write the log entry

Append to `<Vault>/<Project>/log.md`, newest entry at the top (under the file's heading). Create the file if missing:

```markdown
# <Project>: log

Dated entries, newest first: status, what was learned, mistakes and fixes, taste notes.
```

Entry format (leave out empty sections, keep each bullet one line, plain words):

```markdown
## 2026-11-26 · <3-6 word headline>

**Status:** where the build stands now (shipped X, blocked on Y, next is Z).

**Learned**
- ...

**Mistakes and fixes**
- what went wrong -> what fixed it

**Taste**
- looks, feel, libraries or patterns he liked or rejected, in his words where he gave them

**Next**
- ...
```

Also, only when it changed:
- `context.md`: durable facts (stack, conventions, key decisions). Edit the relevant section; don't append a diary there.
- `todo.md`: tick done items, add new ones.
- `project.md` frontmatter: `state` (live, prototype, in progress, concept, archived) and `stack`.

## 4. New project folder

If `brain_sync.py` is available (`~/.brain-sync/second-brain/tools/vault-sync/brain_sync.py`), run `python3 <that> new "<Project Name>"`. Otherwise create the folder with `project.md`, `context.md`, `todo.md`, `log.md`. `project.md`:

```yaml
---
title: <Name + what it is, 2-4 words>
type: app            # game, app, tool, site or concept
topic: tech          # tech, gamedev, ai, design...
tags: [own-project, ...]
kind: project
why: <what it is made for, plain words, never third person>
state: in progress
stack: [...]
repo: private        # or the GitHub link
share: full          # summary for confidential work (the brain repo is PUBLIC)
note:                # existing brain note slug, if any
added: <today>
---

## Summary
<1-3 sentences>
```

## 5. Privacy

The brain repo is public. Never write API keys, tokens, passwords, env vars, emails, client names, prices or internal URLs. For private work (Revolio Studio, Revolio Labs, Ledger and other private repos) keep it product level and make sure `share: summary` is set unless he says otherwise. The sync also skips files that look like they hold secrets, but don't rely on it.

## 6. Optional copy in the project folder

If the chat is inside the project's own codebase and he wants it there too (or a `BRAIN_LOG.md` already exists in its root), append the same entry to `BRAIN_LOG.md`. The vault copy is the one that counts.

## 7. No file access (plain chat)

- With a GitHub connector: append the entry to `projects/<slug>/log.md` in YuvrajxGarg/second-brain on `main` (commit `log: <project> <date>`). The next vault sync copies it down into the vault.
- Otherwise: give him the entry in one block and say which file it goes in (`Documents/Vault/<Project>/log.md`).

## 8. Finish

Reply in one or two lines: which project (and whether it was existing or new), which files changed. Mention it reaches the brain on the next daily sync, or offer to run `brain_sync.py run` now if there's a shell.
