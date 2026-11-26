# Vault sync

A `Vault` folder in Documents on the Mac and the Windows PC, one subfolder per
project, synced into the brain once a day. One Python script (`brain_sync.py`,
standard library only) does everything on both machines: setup, new projects, the
sync itself and the daily job.

## The vault

```
Documents/Vault/
  README.md            how it works (written by init)
  _template/           copy of the standard files
  Munde Mode/          one folder per project (any name; it becomes projects/munde-mode/)
    project.md         required: the project's card in the brain (frontmatter below)
    context.md         context for AI tools: stack, conventions, decisions
    todo.md            open tasks
    log.md             dated status, learnings, mistakes, taste (the log-to-brain skill writes here)
    playtests.md       games: one entry per build you played (log-to-brain, playtest mode)
    notes/             anything else: .md, .txt, small images
    _private/          never leaves this computer
```

`project.md` frontmatter is a normal brain note plus two fields:

```yaml
title: Munde Mode
type: game
topic: gamedev
tags: [own-project, browser-game]
kind: project
why: a goofy browser game about Tukaram Munde
state: prototype
stack: [threejs]
repo: private
share: full        # full = every doc, summary = only project.md, none = stays local
note: munde-mode-game   # optional: existing brain note to attach the docs to
added: 2026-11-26
```

If you drop a folder in without a `project.md`, the next run creates the standard
files for you.

## What lands in the brain (without crowding it)

- Files go to `projects/<slug>/` in the repo, never into `topics/`.
- Each project is **one** entry: `project.md` becomes a `kind: project` note (or, with
  `note:`, the docs attach to the existing note so nothing is duplicated). The other
  files are listed under it as "Vault docs" in `catalog/projects.md` and on the
  graph, and their full text goes into `llms-full.txt` and the MCP server's `search`
  and `fetch`. They are not separate nodes.
- Vault notes are read-only on the graph site: edit them in the vault.

## Rules a run follows

| What happened since the last sync | Result |
|---|---|
| changed only in this vault | copied up to `projects/<slug>/` |
| changed only in the repo (other computer) | copied down into this vault |
| changed on both | `log.md` and `playtests.md`: entries from both computers merged, newest first. Other files: repo version kept; yours saved next to it as `name.conflict-<machine>-<date>.md` in both places. Merge, delete the copy |
| deleted in this vault | moved to `projects/.archive/<date>/` in the repo (never hard-deleted) |
| deleted on the other computer | moved to `Vault/.trash/<date>/` here |

- Per-machine state lives in `projects/.sync/<machine>.json` (hash, which machine wrote
  each file, when).
- Synced: `.md`, `.markdown`, `.txt` up to 512 KB, images up to 2 MB. Skipped: dotfiles,
  `.env*`, `*secret*`, `*credential*`, keys and certificates, `_private/`,
  `node_modules/`, and any text file that looks like it holds an API key, token,
  password or database URL (listed in the log so you can fix it).
- **The repo is public.** Use `share: summary` or `none` for confidential projects
  (Revolio Studio, Labs, Ledger...).
- One commit per run, `sync: vault from <machine> (<projects>): N push, N pull`, pushed to
  `main`. Running twice changes nothing. If the push is rejected it redoes the sync on
  top of the latest `main` (3 tries).
- PR instead of main: `init --pr` (always) or `run --pr` (once). It pushes
  `vault-sync/<machine>` and prints the "open a PR" link.
- Logs: `~/.brain-sync/sync.log`.

## Install on the Mac

Needs git (signed in to GitHub, which you already are) and Python 3 (`python3 --version`;
if missing, `xcode-select --install`).

```bash
curl -fsSL https://raw.githubusercontent.com/YuvrajxGarg/second-brain/main/tools/vault-sync/brain_sync.py -o ~/.brain_sync.py
python3 ~/.brain_sync.py init                 # makes ~/Documents/Vault and a private clone in ~/.brain-sync
python3 ~/.brain-sync/second-brain/tools/vault-sync/brain_sync.py schedule --time 21:30
python3 ~/.brain-sync/second-brain/tools/vault-sync/brain_sync.py run      # first sync now
```

The scheduled job uses the copy inside the clone, which updates itself on every run.
macOS blocks background jobs from reading Documents: if `~/.brain-sync/sync.log` says
"no permission", open System Settings > Privacy & Security > Full Disk Access, press +,
and add the Python path that `schedule` printed (Cmd+Shift+G to paste a path).

## Install on Windows

Needs Git for Windows (signed in through Git Credential Manager; a `git clone` of any
private repo once is enough) and Python: `winget install Python.Python.3.12`. In PowerShell:

```powershell
iwr https://raw.githubusercontent.com/YuvrajxGarg/second-brain/main/tools/vault-sync/brain_sync.py -OutFile $HOME\.brain_sync.py
python $HOME\.brain_sync.py init
python $HOME\.brain-sync\second-brain\tools\vault-sync\brain_sync.py schedule --time 22:00
python $HOME\.brain-sync\second-brain\tools\vault-sync\brain_sync.py run
```

The vault goes in your real Documents folder (OneDrive's, if Documents is synced
there). The task is "BrainVaultSync" in Task Scheduler; it runs at the next login if the
PC was off.

## Everyday commands

```
brain_sync.py new "Project Name"   new project folder with the standard files
brain_sync.py status               what the next run would do
brain_sync.py run [--dry-run]      sync now
brain_sync.py unschedule           stop the daily job
```

Use two different times on the two machines (say 21:30 Mac, 22:00 PC) so they don't race.

## Log-to-brain skill

`log-to-brain/SKILL.md` is a Claude skill: say "log this to my brain" in any Claude chat
and it writes the session's status, learnings, mistakes and taste into
`Vault/<Project>/log.md`. It looks for the project first (vault folder, then
`projects/`, then an existing brain note, linking with `note:`) so it never makes a
copy. With no file access it appends to `projects/<slug>/log.md` through GitHub, and
the next sync brings it down into the vault.

**Playtests.** For a game, "log this playtest" (or "playtest notes", "log build v0.4")
writes one entry to `Vault/<Game>/playtests.md` instead: build, who played, what worked,
what broke, how it felt, and a `Fix next` checklist. The newest entry's open fixes show
as the game's next steps on the brain's PROJECTS board, with a playtest count. From a
chat without file access it goes through the MCP `log_playtest` tool; a game that only
has a brain note gets a `projects/<slug>/` folder (with `note:` pointing at that note) so
the sync makes its vault folder.
