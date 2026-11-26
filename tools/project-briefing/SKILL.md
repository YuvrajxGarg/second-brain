---
name: project-briefing
description: Use when Yuvraj starts or resumes building something (a game, app, tool, edit job), or says start/build one of his ideas. Pulls a lean brief from his second brain, or turns the idea into a Vault project.
---

# Project briefing

Two moments where his saved notes should do the work:

- **Starting or resuming a build** ("let's work on Munde Mode", "continuing the ferry
  app", "new game: pixel racer in three.js"): get the brief before writing code.
- **An idea becomes a project** ("let's build the DIT checker idea", "start this idea as
  a project"): make the project folder from the idea note, then get the brief.

Saving a link or thought is `capture-to-brain`; logging a session is `log-to-brain`.

## 1. Get the brief (one call, ~1k tokens)

Pick the first that works:

1. **Second Brain connector**: `get_briefing` with `project` (slug or name;
   `get_catalog('projects')` lists them) or, for new work with no project yet, `about`
   (a few words on what is being built).
2. **Shell with the repo** (`YuvrajxGarg/second-brain`, usually cloned at
   `~/.brain-sync/second-brain` on his machines): `node scripts/brain.mjs brief <project>`
   or `node scripts/brain.mjs brief --about "<what>"`.
3. Neither: fetch `https://brainy.pxlvzn.in/TASTE.md` and `/CHECKS.md` and go on.

The brief has: where the project is at (last log entry, next steps, open to-dos),
mistakes made on it before, its checks plus the global ones, the taste lines that apply,
and the saved notes that fit (how-tos, looks, libraries and tools, ideas, past projects),
each as an id.

Then:
- Treat the **mistakes and checks** as rules for this session. Run every "proved"
  check before saying the work is done.
- `fetch` only the 1-3 notes you will actually use (a technique you'll follow, the style
  ref you're matching). Don't fetch every id.
- When you lean on a saved note, say which one ("going with the Sharma Sweets look").
- Don't paste the brief back to him; use it.

## 2. Idea -> project

When he says to start building one of his idea notes:

1. Find the idea: `recall_ideas` with a word from it (or `search`). Ask in one line only if
   two ideas fit.
2. Make the project, first that works:
   - Connector with writing on: `start_project` with `idea` (plus `title`, `type`,
     `stack` if he said them; `share: summary` for confidential work, the repo is public).
   - Shell with the repo: `node scripts/brain.mjs start <idea-id> [--title T] [--type game]
     [--stack threejs,vite]`, then commit `add: project <title> from idea` and push to `main`.
   - On the graph site he can do it himself: the idea's panel, START AS PROJECT.
   It creates `projects/<slug>/` (project.md with the related notes pre-linked,
   context.md listing the saved notes to start from, todo.md from the idea's steps,
   log.md with a first entry) and sets the idea to `stage: doing`. The daily vault sync
   copies the folder into `Documents/Vault/<slug>/` on his Mac and PC.
3. If it says the idea already became a project, use that project (no copies).
4. Then do step 1 with the new project's slug.

## 3. Finish

One line: which project, brief read (and which notes you're using), or the new project
folder made. Logging the session afterwards is `log-to-brain`.
