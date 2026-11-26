# AGENTS.md: how to use Yuvraj's second brain

This repo is Yuvraj Garg's second brain: every link, design reference, library,
tool, technique and idea he saves, one markdown note each. He is a video editor who
also builds games. If you are an AI helping him (chat, coding agent, design tool),
use this repo as context so your answers match **his** taste and stack instead of
generic defaults.

## Read in this order

1. **[TASTE.md](TASTE.md)**: his taste profile. Visual styles he likes, games he
   likes, the stack he builds with, and how to apply it. Short; read it whole.
2. **[catalog/](catalog/)**: one file per kind of thing, each entry with his
   reason for saving it and a summary.
   - [libraries.md](catalog/libraries.md): UI libraries, design systems, code and asset sources
   - [style-refs.md](catalog/style-refs.md): art, design, motion, website and game references
   - [tools.md](catalog/tools.md): apps and services
   - [techniques.md](catalog/techniques.md): workflows, how-tos, advice
   - [ideas.md](catalog/ideas.md): his own ideas, thoughts, to-dos
   - [projects.md](catalog/projects.md): what he has built himself (games, apps, tools,
     sites) and the companies he works in, with status, stack, links, next steps and
     playtest counts. Build ideas he is tracking sit here too, as `state: concept`
   - [kit.md](catalog/kit.md): his **asset library** for shoots, edits and game builds,
     grouped by area (`grade`, `sound`, `vfx`, `motion`, `shoot`, `edit`, `3d`, `2d`)
3. **[IDEAS.md](IDEAS.md)**: his own ideas and to-dos by stage. Call these back
   when they're relevant ("you had an idea for X on Nov 10, want to pick it up?").
4. **Project docs** in `projects/<slug>/`: `project.md` plus his working docs for that
   project (context.md, todo.md, log.md with dated status, learnings and mistakes,
   checks.md, and for games playtests.md: one entry per build played, with open
   "Fix next" checkboxes), synced from his own vault. Read these before working on one of his projects.
   **Checks first:** [CHECKS.md](CHECKS.md) lists mistakes agents already made for him and
   the check that stops each one; a project's `checks.md` adds its own. MCP:
   `get_checks` with the project slug. Run every `proved` check before saying "done".
   **Starting work on a project?** `get_briefing` with the project slug (or `about` for
   new work) gives all of this in one lean call: where it's at, past mistakes, checks, the
   taste that applies and the saved notes that fit.
5. **Notes** in `topics/<topic>/<slug>.md` for full detail. Images sit
   next to their note with the same name and are described in words.
6. **Moodboards** in `canvases/*.canvas` (JSON Canvas: cards point at note paths, with
   his own text cards and arrows) and **saved views** in `views/*.json` (filters he uses
   to slice the brain). A moodboard is the clearest picture of a look he is going for.

Other entry points: [llms.txt](llms.txt) (index in llmstxt.org format),
`llms-full.txt` (everything in one file, generated), [INDEX.md](INDEX.md) by
topic, [TAGS.md](TAGS.md) by tag.

## Access

| How | Where |
|---|---|
| MCP server (Streamable HTTP, no auth, read-only) | `https://brainy.pxlvzn.in/mcp` |
| Plain text for any chat | `https://brainy.pxlvzn.in/llms.txt`, `/llms-full.txt`, `/TASTE.md`, `/IDEAS.md`, `/CHECKS.md` |
| Raw files | `https://raw.githubusercontent.com/YuvrajxGarg/second-brain/main/<path>` |
| JSON of everything | `https://brainy.pxlvzn.in/data/brain.json` |
| Graph website | `https://brainy.pxlvzn.in` |

MCP tools: `get_taste_profile`, `search`, `fetch`, `list_notes`, `get_catalog`
(including `kit`, the asset library, with an optional `area`), `recall_ideas` (also
returns build ideas tracked as concept projects), `get_briefing` (one lean brief before working on a project), `get_checks`.

**Writing** (only when Yuvraj's connector URL carries `?key=`; otherwise these aren't
listed): `capture` files one note, `update_note` adds to an existing one (his words,
a follow-up line, links, an idea's stage), `log_project` adds a dated entry to a
project's `log.md`, `log_playtest` adds one entry per build played to a game's
`playtests.md` (build, who played, worked, broke, felt, fix next). `start_project` turns an idea note into a project folder (related notes pre-linked,
idea set to doing). Search first and extend a match instead of making a copy. The
server enforces the filing rules and refuses a link that's already saved. How to fill
the fields: [tools/capture-to-brain/SKILL.md](tools/capture-to-brain/SKILL.md).

They return compact results to save tokens: `get_taste_profile` gives the curated
profile only (pass `evidence` for the generated block), lists and catalogs are one
line per note, and `fetch` returns a full note by id. Fetch only what you will use.

## Note format

```yaml
---
title: Polyfork 3D assets       # 2-4 words: name + what it is
type: tool                      # format: link, bookmark, video, tool, note, idea, quote, todo...
topic: gamedev                  # folder: ai, tech, business, design, gamedev, life..., or a category grown from a busy tag (revolio)
tags: [game-assets, low-poly, threejs]
kind: library                   # what it's useful as (see below)
why: open-source three.js asset library agents can use over MCP
style: [low-poly, shared kit palettes]   # only on visual things: what to take from it
stage: new                      # only on kind idea/todo
source: https://polyfork.dev
added: 2026-11-10
status: unread                  # unread | read | done | archived
---
## Summary   what it is, in plain words (plus image descriptions)
## Raw       exactly what Yuvraj sent: his own words, the strongest taste signal
## Notes     follow-ups, [[slug]] links to related notes
```

**`kind`** values:

| kind | means | use it for |
|---|---|---|
| `style-ref` | art, design or motion he likes the look of | matching his visual taste |
| `website-ref` | a site whose design or UX he likes | web layouts, landing pages |
| `game-ref` | a game he likes (play or look) | game ideas, mechanics, art style |
| `library` | code he wants to build with (UI kits, design systems, packages) | picking dependencies |
| `asset-source` | sprites, 3D models, art files | sourcing assets |
| `tool` | an app or service | recommending tools |
| `technique` | a workflow or how-to | how to do something his way |
| `advice` | a tip, playbook or opinion he saved | strategy and decisions |
| `idea` | his own idea | calling ideas back |
| `thought` | a note or mental model | understanding how he thinks |
| `todo` | a task he wants done | reminders, planning |
| `project` | something he has built (game, app, tool, site) | knowing what he has made and can reuse |
| `org` | a company or label he works in (Revolio Media, Revolio Labs, PXLVZN) | context on who he builds for |

**`why`** is his reason for saving it, in his words when he gave one ("cool
visual design"). Treat it as the most direct statement of his preference.

**`stage`** (ideas and to-dos): `new`, `exploring`, `doing`, `done`, `dropped`.

**`kit`** (optional, any kind): where the thing goes in his working kit for shoots,
edits and game builds, one or more of `grade` (LUTs, colour), `sound` (SFX, music,
stems), `vfx` (effects, compositing, AI video, upscalers), `motion` (animation, mocap,
motion-design refs), `shoot` (camera, lenses, lighting, DIT), `edit` (edit workflows,
footage tools), `3d`, `2d`. Notes with a `kit` make up `catalog/kit.md` and the Asset
library view on the site. When he asks for a LUT, a sound, an effect or an asset,
look here first, and use `style` to match the look.

**Project fields** (kind `project` and `org`): `type` says what it is (`game`,
`app`, `tool`, `site`, `concept`, `company`) and `why` says what it's made for.
`state` is where it stands in his
words (`live`, `live (internal)`, `prototype`, `in progress`, `concept`,
`archived`...), `stack` lists what it is built with, `source` is the live link and
`repo` is the GitHub link or `private`. Private repos are described at product level
only; never ask for or guess their code. A project's **next steps** come from, in
order: open `- [ ]` items in its vault `todo.md`, the newest playtest's "Fix next",
the newest log entry's "Next", then a `## Next` section in the note. They show on the
PROJECTS board and in `get_catalog('projects')`.

## How to use it well

- Designing something: read TASTE.md, then pull 2-3 matching `style-ref`s and say
  which ones you drew from.
- Building UI, a site or a game: check `catalog/libraries.md` first and prefer what
  he saved over new dependencies.
- He asks "what was that thing about X": `search` (or grep `topics/`), answer with
  title, summary, source link and file path.
- Brainstorming: `recall_ideas` and mention relevant past ideas.
- Edits and shoots: `get_catalog('kit')` (or `catalog/kit.md`) before suggesting a
  new LUT, plugin, sound source or asset pack; he may already have one he likes.
- Working on one of his games: read its `playtests.md` (latest entry first) for what
  players hit and what he planned to fix.
- Suggesting what to build: check `catalog/projects.md` (or `get_catalog('projects')`)
  first. He has shipped a lot; build on or remix his own projects before
  proposing something from scratch, and match the stack he already uses.
- This repo is public and contains nothing sensitive. Only Claude in his "Second
  Brain" project writes to it, following [CLAUDE.md](CLAUDE.md); other agents
  should treat it as read-only.
