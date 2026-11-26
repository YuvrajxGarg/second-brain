# Second Brain: rules for Claude

This repo is Yuvraj's second brain. He dumps things in chat (links, notes, ideas,
bookmarks, quotes, screenshots described in words, videos, people, tools) and Claude
files them here so they can be found again later. Keep it plain markdown, one file
per entry, so it stays easy to append to and easy to grep.

## Layout

```
CLAUDE.md          these rules
README.md          short human overview
AGENTS.md          entry point for other AIs: what to read, fields, access (hand-written)
TASTE.md           taste profile for agents: curated top part + generated evidence block
CHECKS.md          mistakes agents made, each turned into a check (hand-curated, see below)
HANDOFF.md         guide for a friend to set up this system for themselves (hand-written)
ME.md              Yuvraj's own page: curated personality read + insights, generated stats
IDEAS.md           generated: his ideas and to-dos by stage
catalog/           generated: entries grouped by kind (libraries, style-refs, tools...) + kit.md (asset library)
llms.txt           generated: llmstxt.org index for AI tools
llms-full.txt      generated: every note in one file
INDEX.md           generated: every entry, grouped by topic, newest first
TAGS.md            generated: every tag with its entries
LINKS.md           generated: link health report and link proposals (scripts/link_doctor.py)
api/mcp.js         MCP server served at https://brainy.pxlvzn.in/mcp (read-only; +write tools with ?key=)
api/_write.js      the MCP write tools: capture, update_note, log_project, log_playtest, start_project (CAPTURE_KEY)
api/edit.js        edit API for the graph site (passcode-locked, commits to main)
api/capture.js     plain HTTP capture for iPhone/Mac/Windows (CAPTURE_KEY), writes inbox/
api/sort.js        the site's INBOX button: sorts inbox/ with the Claude API, one commit (EDIT_PASSCODE)
api/_brief.js      shared logic: project briefing, resurface ranking, idea -> project
scripts/brain.mjs  CLI on _brief.js: brief <project> | pick | digest [--write] | start <idea>
digests/           weekly digests from the Sunday run (see its README)
tools/project-briefing/ the skill: brief before building, idea -> project
inbox/             only when a dump is genuinely unclear; sort it later
topics/<topic>/    one folder per group, created on demand
templates/entry.md the frontmatter template
scripts/build_index.py  regenerates INDEX, TAGS, IDEAS, catalog/, llms*.txt, TASTE evidence, LINKS.md
scripts/link_doctor.py  scores and audits [[slug]] links; --fix applies the safe fixes
scripts/check_notes.py  checks notes against the filing rules (CHECKS.md B1-B7)
scripts/brain_search.py offline search over the brain + local Vault (`brain` command on his Mac/PC)
scripts/health_report.py weekly health report: links, deploys, MCP cost, vault sync, backups
scripts/mcp_cost.mjs    measures MCP output size in tokens against the local brain.json
health/                 latest.md + history.jsonl from the Sunday health report (see its README)
tools/mistakes-to-checks/  the skill that turns repeat agent mistakes into checks
tools/capture-to-brain/    the skill that files notes from ANY chat (MCP capture / GitHub / shell)
tools/inbox-sort/       steps for the twice-daily Inbox sort scheduled task
tools/quick-capture/    browser extension that drops captures into inbox/
tools/device-capture/   iPhone Share Sheet + Action Button shortcuts, Mac/Windows hotkeys (to api/capture.js)
tools/social-reader/    source of the Social Reader MCP connector (Instagram/X), shared via HANDOFF.md
tools/vault-sync/       brain_sync.py: syncs Documents/Vault on his Mac + PC into projects/ daily
projects/<slug>/        synced from his vault (one entry per project); edit in the vault, not here
scripts/build_graph.mjs builds site/data/graph.json for the graph site
site/                   the graph website (static, deployed on Vercel)
vercel.json             Vercel build config (runs build_index.py + build_graph.mjs, serves site/)
suggestions/            daily build ideas from the 9 AM scheduled task (see its README)
links/                  Link Doctor: dismissed pairs + the weekly check's steps (see its README)
canvases/               moodboards as JSON Canvas files (site/canvas.html)
views/                  saved gallery/table views as JSON (site/gallery.html)
```

Starter topics: `ai`, `tech`, `business`, `design`, `productivity`, `health`,
`finance`, `learning`, `life`, `misc`, plus `gamedev` (game building, assets). Create a new topic folder when 3 or more
entries clearly share a theme that no existing topic fits. Prefer an existing
topic over a new one. Topic names are short, lowercase, kebab-case.

## "Log this to my brain" = project log, not a dump (Yuvraj's rule, 2026-11-26)

When he says "log this", "log this to my brain", "save where this is at" or similar at
the end of a work session (a build, an edit job, a client project), it's a **project
log**, not a dump. Use the `log-to-brain` skill if it's loaded; if not, follow
`tools/vault-sync/log-to-brain/SKILL.md` yourself:

- Find the project first (vault folder, then `projects/<slug>/`, then an existing note) and
  add a dated entry to its `log.md`. Never make a new `topics/` note for the session.
- With access to his `Documents/Vault`, write there. Without it, write
  `projects/<slug>/log.md` (plus `project.md` if the project is new) in this repo and
  push; the nightly sync copies it into both vaults.
- Reusable how-tos that came out of the session can also become one `kind: technique`
  note, linked with `note:` in the project's `project.md`. One note, not one per session.
- **Playtests** (Yuvraj's ask 2026-11-26): "log this playtest", "playtest notes", "log
  build v0.4" for a game = one entry in `projects/<slug>/playtests.md` (vault
  `<Game>/playtests.md`), newest first: `## YYYY-MM-DD · <build> · <headline>`, then
  `**Build:**`, `**Played by:**`, and `**Worked**`, `**Broke**`, `**Felt**`, `**Fix next**`
  (open `- [ ]` checkboxes) lists. The newest entry's open fixes become the game's next
  steps on the board. From another chat: MCP `log_playtest`. A game with only a
  `topics/` note gets `projects/<slug>/project.md` with `note: <note-slug>` (no copy).

## Using what's saved (Yuvraj's ask 2026-11-26)

All four run on `api/_brief.js` (pure functions over brain.json notes), so the MCP
server, the site API and `scripts/brain.mjs` give the same answers:

- **Project briefing**: MCP `get_briefing` (`project` or `about`), or `node
  scripts/brain.mjs brief <project>`. Before working on one of his projects, read it and
  treat its mistakes and checks as rules. The `project-briefing` skill does this in any chat.
- **Idea -> project**: MCP `start_project` (write key), site START AS PROJECT
  (`api/edit.js` action `project`), or `node scripts/brain.mjs start <idea>`. Writes
  `projects/<slug>/` (project.md with related notes pre-linked, context.md, todo.md,
  log.md) and sets the idea to `stage: doing` with a link to the project. This is the one
  sanctioned way a thread creates a `projects/` folder besides log_project's new_project;
  refuses ideas that already became a project.
- **Context-aware resurfacing**: projects with a `log.md` entry in the last 30 days (or
  in progress and added lately) are "active"; unread saved refs are ranked by fit with
  them. `build_graph.mjs` puts the ranking in `graph.json` (`focus`) for the site's FROM
  YOUR PILE card; the morning run uses `node scripts/brain.mjs pick`.
- **Weekly digest**: step 6 of `links/README.md` (Sunday run), `digests/YYYY-MM-DD.md`.
  Scheduled tasks: "Daily build ideas" and "Weekly link check and digest" (recreated
  2026-11-26; fresh-session tasks can only be changed by delete + recreate).

## Filing a dump

1. Split the message into separate items. One link or idea = one entry.
1b. `git pull` first, then check it isn't already saved: `grep -ril "<domain/path or name>" topics/ inbox/`.
   Other chats file notes straight to `main` (capture-to-brain, `captured: ... via brain MCP`),
   so the same link may already be there. If it is, add to that note (his new words under
   `## Raw`, a dated line under `## Notes`) instead of filing a copy.
2. For each item, pick a **type**: `link`, `note`, `idea`, `bookmark`, `quote`,
   `video`, `tool`, `book`, `person`, `place`, `recipe`, `todo`. For things he made
   himself (kind `project`) use what it is: `game`, `app`, `tool`, `site` or
   `concept`; for a company (kind `org`) use `company`. Never `note` for these: on the
   graph a note means a thought he wrote, not something he built.
3. Pick **one topic** (the folder) and **3 to 6 tags**.
3b. Fill the AI-facing fields (see "AI-readable fields" below): `kind` always,
   `why` always, `style` for anything visual, `stage: new` for ideas and to-dos,
   `kit` for anything he'd use on a shoot, in an edit or in a game build.
4. If it's a link, fetch it when possible and write a 1 to 3 sentence summary in
   your own words, plus the page title. If it can't be fetched, say so in the body.
5. Write the file to `topics/<topic>/<slug>.md` using the template below. `slug` is
   3 to 6 kebab-case words from the title, name first, no date (the date lives in
   `added:`; Yuvraj's rule 2026-11-26). If the slug is taken, add `-2`.
5b. Link it: add the 2 or 3 notes it really relates to under `## Notes`, one per line,
   each with a short reason: `- [[sprite-stacking-pixel-art]]: same pixel-art-in-3D look`.
   Always the exact slug (file name without `.md`). The "Might relate" list in `LINKS.md` / `python3
   scripts/link_doctor.py --json` (`suggestions`) is a good place to look; skip a suggestion
   that only shares a generic tag. See "Links between notes".
6. If the entry adds something new to his taste (a new look, a new game type, a new
   library he'll build with), update the curated part of `TASTE.md` (above the
   GENERATED marker) and its "Last curated" line. Then run
   `python3 scripts/link_doctor.py --fix` (adds backlinks, fixes old or partial links) and
   `python3 scripts/build_index.py`; it refreshes every generated file.
6b. Run `python3 scripts/check_notes.py --changed` and fix every error before committing.
7. Commit with message `add: <short title>` (or `add: N entries` for a batch) and
   push to `main` right away. See "Auto-merge" below (deploys are batched).
8. Reply to Yuvraj with one line per entry: title, topic, tags.

Screenshots and images: save them next to the entry with the same name
(`topics/<topic>/<slug>.png`), embed with `![screenshot](./<file>)`
in `## Summary`, and describe what's in the image in words so it's searchable.
### X/Twitter and Instagram links (Yuvraj's standing rule, 2026-11-11)

Every X/Twitter post or thread link and every Instagram post or reel link is read
with the **Social Reader** connector (`read_social_link`, load it via ToolSearch
"social reader"). It returns the post text, the author's full thread and video
frames. Save one useful frame or photo next to the entry and describe it. Only
fall back to asking for a screenshot if the connector fails.

Never drop what he sent. Keep his own words verbatim under `## Raw` so nothing is
lost to summarising.

## Capture from any chat (Yuvraj's ask, 2026-11-26)

He can say "save / add / remember this to my brain" in **any** Claude chat, not only this
project. The `capture-to-brain` skill (`tools/capture-to-brain/SKILL.md`) routes it:
project work goes to log-to-brain, everything else becomes a note, filed with the same
rules as here. It writes through, in order: the MCP `capture` tool, a shell with the repo,
the GitHub connector, or (nothing can write) a markdown block for him to paste here.

- MCP write tools (`api/_write.js`): `capture`, `update_note`, `log_project`, `log_playtest`. Listed only
  when the connector URL has `?key=<CAPTURE_KEY>` (Vercel env, production). Add-only, one
  commit each (`add: <title> (from chat)`, `edit: ... (from chat)`, `log: <slug> <date> (from chat)`),
  so a bad one is a `git revert`. `capture` enforces the check_notes.py rules, refuses a link or
  title already saved (including notes pending deploy, via GitHub compare against the
  deployed commit) and adds backlinks to the related notes. `log_project` refuses
  `share: summary/none` projects (their logs stay in the vault).
- These commits are notes like any other: batched deploys apply, and the generated files
  (INDEX, TAGS...) catch up on the next rebuild here or on Vercel's build.
- Notes it files carry `captured: <time> via brain MCP`. Topic `inbox` gets `status:
  unsorted`, so the inbox sort below picks it up.
- If `CAPTURE_KEY` leaks, change it in Vercel (any 16+ characters), redeploy, and update
  the connector URL.

## Quick-capture inbox

Yuvraj also captures from a browser extension (`tools/quick-capture/`) and from his
iPhone, Mac and Windows PC (`tools/device-capture/`: Share Sheet, Action Button voice
notes, hotkeys, all through `api/capture.js`). Both commit straight to `inbox/` as
`inbox/YYYY-MM-DD-HHMMSS-<slug>.md` (plus any image with the same name), with
`status: unsorted`; the `captured:` line says where it came from (`via iPhone voice`,
`via Mac screenshot`...). Voice notes are his own thoughts, usually `kind: idea` or
`thought`. A `Note:` line under `## Raw` is his reason for saving it: use it for `why`.
These never show up in chat, so:

- A scheduled task "Inbox sort" (~8:50 AM and ~5:50 PM IST) does this on its own,
  following `tools/inbox-sort/README.md` (silent unless an item needs him).
- The site's **INBOX** button (`api/sort.js`, Yuvraj's ask 2026-11-26) does the same on
  demand: Claude API (`ANTHROPIC_API_KEY`, model `claude-opus-5-5`) picks the fields, code
  writes the notes, backlinks and removals in one `file: N inbox captures (from site)`
  commit (deploys at once). Same `needs:` convention: unreadable items stay with a
  question, and his answer from the site lands in `## Raw` as a `Note:` line. Its rules
  prompt is `rulesPrompt()` in `api/sort.js`: when you change the filing rules here,
  change it too.
- At the start of every thread in this project, `git pull` and check `inbox/`
  for `status: unsorted` files. Also do it whenever Yuvraj says "sort my inbox".
- File each one like a normal dump: pick topic, type, tags, write the summary
  (fetch the link if there is one), keep `## Raw` exactly as captured, keep the
  `captured:` line, and set `status: unread`.
- `git mv` the `.md` and its attachments to `topics/<topic>/<slug>.md`
  (drop the date and time part, fix the image embeds to the new names).
- Rebuild the index, commit `file: N inbox captures`, push to `main`, and reply
  with one line per entry as usual.

## Entry format

```markdown
---
title: Name plus what it is, 2-4 words
type: link
topic: ai
tags: [llm, agents, prompting]
kind: library                           # see AI-readable fields
why: his reason for saving it
style: [chunky pixel art, orange and blue palette]   # visual things only
stage: new                              # kind idea/todo only
source: https://example.com/post        # omit if none
added: 2026-11-09
status: unread                          # unread | read | done | archived (optional)
---

## Summary
One to three sentences in plain words: what it is and why it was saved.

## Raw
Exactly what Yuvraj sent.

## Notes
Optional: follow-ups, related entries as [[slug]] links.
```

## AI-readable fields (Yuvraj's rule, 2026-11-12)

The brain is also context for his other AI tools (taste, libraries, ideas), so
every note carries these, and `AGENTS.md` explains them to outside agents:

- `kind` (required), what it is useful as: `style-ref` (art/design/motion he likes
  the look of), `website-ref`, `game-ref`, `library` (UI kits, design systems,
  packages), `asset-source`, `tool`, `technique`, `advice`, `idea` (his own),
  `thought`, `todo`, `project` (something he built himself), `org` (a company or
  label he works in). This drives `catalog/`.
- `state`, `stack`, `repo` (kind `project`/`org` only): where it stands (`live`,
  `prototype`, `in progress`, `concept`, `archived`...), what it's built with, and the
  GitHub link or `private`. Private repos (Revolio Studio, Labs, Ledger...) stay at
  product level: never copy code, prompts, providers, model names, costs, env vars,
  emails or business IDs into this public repo. When he ships or changes a project,
  update its note.
- `why` (required): his reason for saving it, **in his words** when he gave one
  ("cool visual design"), otherwise a short plain reason. Never drop his comment.
  For his own projects, `why` is what the thing is made for, in plain words, e.g.
  `to grab videos from any site in edit-ready formats`. It's his own brain, so never
  write about him in the third person there ("his own project", "added as context
  for agents").
- `style` (visual things only): 2 to 5 short descriptors of what to take from it,
  e.g. `chunky flat pixel art`, `textured pastel brushwork`, `minimal hud`. Look
  at the image or video frames; describe what's actually there. No commas inside
  one descriptor.
- `stage` (kind `idea` or `todo` only): `new`, `exploring`, `doing`, `done`,
  `dropped`. When he says he started, finished or dropped an idea, update it.
- `kit` (Yuvraj's ask 2026-11-26, optional): his **asset library** for shoots, edits
  and game builds. One or more of `grade` (LUTs, colour grading and matching), `sound`
  (SFX, music, stems), `vfx` (effects, overlays, compositing, AI video, upscalers),
  `motion` (animation, mocap, retargeting, motion-design refs), `shoot` (camera, lenses,
  lighting, DIT), `edit` (edit workflows, footage tools), `3d` (models, shaders, rigs),
  `2d` (sprites, pixel art, textures). Only when he'd actually reach for it in that work;
  a LUT pack, SFX library, plugin, preset, asset source or shoot guide always gets one.
  Feeds `catalog/kit.md`, the Asset library view (`site/gallery.html#asset-library`,
  filter by KIT area and LOOK words from `style`) and MCP `get_catalog('kit')`.
  `check_notes.py` rejects unknown areas; the list is `KIT` in `scripts/build_index.py`
  (mirrored in `api/mcp.js`, `api/_write.js`, `site/gallery.js`).
- **Next steps on projects:** a project's next steps show on the PROJECTS board and in
  `get_catalog('projects')`. They come from, first match wins: open `- [ ]` items in its
  vault `todo.md`, the newest playtest's **Fix next**, the newest `log.md` entry's
  **Next**, then a `## Next` bullet list in the note itself. For a project with no vault
  folder, keep a short `## Next` in the note.
- **Build ideas he wants tracked** (2026-11-26): an idea he means to build (an app, a
  game, a tool) can become `kind: project`, `type: app|game|tool|site`, `state: concept`
  (drop `stage`), with a `## Next` list. It moves from the IDEAS board to PROJECTS >
  CONCEPT, and still shows in `IDEAS.md` ("Ideas being tracked as projects") and MCP
  `recall_ideas`. Thoughts, jokes and feature to-dos stay `kind: idea/todo`.
- `TASTE.md`: keep the curated profile honest and short. Only claim a taste
  that at least one saved note shows; link the evidence by title.
- `ME.md` is for **him**, not agents: a personality read, insights and nudges
  (curated, above the GENERATED marker) and stats (generated). Refresh the curated
  part when the picture shifts (roughly every 15-20 new notes, or when he asks),
  update its "Last curated" line, and keep it honest and specific, never
  flattering filler. Rendered with charts at https://brainy.pxlvzn.in/me.html.
- When he asks "what ideas did I have" or "what's on my list", answer from
  `IDEAS.md` (open = new, exploring, doing).

## Tags

- Lowercase, kebab-case, singular (`startup`, not `Startups`).
- Reuse existing tags. Check `TAGS.md` before inventing one.
- Mix of what it's **about** (`llm`, `marketing`) and what it's **for**
  (`to-read`, `to-try`, `inspiration`, `reference`).
- Related entries: link with `[[slug]]` in `## Notes`, both ways if it helps.

### Short titles (Yuvraj's rule, 2026-11-09)

- `title` is a short label of **2 to 4 words**: the name plus what it is.
  Examples: `500-0 game`, `Cricle game`, `Pixel sprite search`,
  `Godot waterfall shader`, `Goalkeeper editor joke`.
- No subtitles, commas, colons or descriptions in the title. The detail goes in
  `## Summary`. Titles show as labels on the graph site, so long ones get cut off.

### Accuracy first (Yuvraj's feedback, 2026-11-09)

- Tag and file by **what the thing actually is**, never by words that happen to
  be in its name or URL. (A game called "MyCountryMogsYours" is a browser game,
  not a `country` entry.)
- If the content can't be read (JS-only site, X post without a screenshot) and
  the type or topic isn't obvious, **ask Yuvraj in one line** before guessing.
  File it in `inbox/` meanwhile, then move it once he answers.
- Games, game tools, game assets and game-dev techniques all go in `gamedev`.
  Never park something in `misc` when a real topic fits.
- Fewer, accurate tags beat six padded ones. 3 tags is fine.

## Links between notes (Link Doctor, Yuvraj's ask 2026-11-26)

`scripts/link_doctor.py` scores every pair of notes from 0 to 1 (shared tags weighted by
rarity, TF-IDF text similarity, kinds that pair well, one note naming the other, same topic
or site) and writes `LINKS.md`: health score, broken links, one-way links, orphans, weak
links, proposed new links, tag merges and possible duplicates. The build runs it in
report-only mode, so the live site's "Links / Unlinked mentions / Might relate" lists in
each note panel stay fresh.

- `--fix` applies only lossless fixes, run it when filing: rewrites old date-first or partial links to the
  current slug and adds a backlink (`- [[slug]]: reason`) for one-way links scoring 0.35+.
- Removing a link, linking two unlinked notes, merging tags or notes are **proposals**:
  numbered in `LINKS.md`. Apply them only when Yuvraj says so ("apply links 1, 3").
- Never remove a link he wrote in `## Raw`. A link with a written reason is never "weak".
- Machine reasons ("both pixel-art") are a floor; when you touch a note, feel free to
  rewrite its link reasons in plain words.
- Review on the site: LINK DOCTOR (bottom left, key D) answers proposals with one commit
  each (`api/edit.js` actions `link`, `unlink`, `dismiss`); QUALITY (key Q) colours links
  by score. Pairs he says no to live in `links/dismissed.json` and are never proposed again.
- A weekly scheduled task (Sundays ~9:42 AM IST) runs the fixes, rewrites machine reasons,
  prunes junk proposals, writes the weekly digest (`digests/`) and pings him. Its steps live in `links/README.md`. The same run
  sends the weekly **health report** (`scripts/health_report.py`, see `health/README.md`):
  link health, deploys vs the batch rule, MCP token cost, vault sync per machine, backups.
  One Sunday message; don't add a separate health or digest notification.

## Mistakes to checks (Yuvraj's ask 2026-11-26)

When an agent repeats a mistake, the fix is a **check**, not another line here: if code
can check it, code does it (from the note [[agent-mistakes-to-checks]]). The
`mistakes-to-checks` skill (`tools/mistakes-to-checks/SKILL.md`) does it:

- Evidence stays in project logs ("Mistakes and fixes" in `log.md`, written by log-to-brain).
- A mistake seen twice becomes a row in `CHECKS.md` (every agent, and this repo) or in the
  project's vault `checks.md` (synced to `projects/<slug>/checks.md`), with the strongest
  fix: impossible, caught (lint/CI), proved (test before "done"), rule, human.
- Agents load checks before working: MCP `get_checks` (pass `project`), or the files.
- The brain's own filing rules are enforced by `scripts/check_notes.py` (step 6b above).
  When you add a rule to this file that code could check, add it to `check_notes.py` and
  a row to `CHECKS.md` instead.
- "Turn my mistakes into checks" for a project = the skill's review mode: show a table and
  diffs, change nothing until he says yes.

## Finding things later

Offline (Yuvraj's ask 2026-11-26): on his Mac/PC the `brain <words>` command
(`scripts/brain_search.py`, from the vault-sync clone) searches notes + his Vault with no
internet; on the iPhone, `brainy.pxlvzn.in/search.html` added to the home screen works
offline (`site/sw.js` keeps the last copy). Same query syntax: words, "phrase", `kind:`,
`topic:`, `tag:`. If you change note fields, keep both search tools in step.

When Yuvraj asks "what was that thing about X":

1. `grep -ril "x" topics/` for full text.
2. `grep -rl "tags:.*x" topics/` for a tag.
3. Browse `INDEX.md` by topic, or `TAGS.md` by tag.
4. Answer with the title, the summary, the source link and the file path.
   If several match, list the best 5 with one line each.

## Auto-merge (standing rule from Yuvraj, 2026-11-09)

Nothing in this repo is sensitive. Every change (new entries, edits, moves,
index rebuilds, rule tweaks) is committed and pushed straight to `main` as soon
as it's done. No branches, no PRs, no asking for confirmation first.

### Batched deploys (Yuvraj's rule, 2026-11-26)

Every push to `main` used to be a production deploy. Now notes are still pushed
to `main` right away (so nothing is ever lost), but Vercel only rebuilds the site
when a batch is ready. `scripts/vercel_ignore.sh` (the `ignoreCommand` in
`vercel.json`) decides, comparing against the last deployed commit:

- **Deploys** when 5 or more notes under `topics/` changed since the last deploy,
  when anything other than notes and generated files changed (site, api, scripts,
  config, tools), when the commit message has `[deploy]`, or for edits made on the
  graph site (`(from site)`).
- **Daily flush**: the ~9 AM `suggest:` commit deploys whatever notes are pending.
- Vault-sync heartbeats (`projects/.sync/*.health.json` only) never deploy.
- Otherwise it skips, so a single dump waits at most until the next morning.

When filing: commit and push as usual (one commit per dump, or one per batch when
several arrive together) and confirm it's filed. Say "filed, goes live with the
next batch" only if he asks why it isn't on the site yet. If he says "deploy now",
run `git commit --allow-empty -m "chore: deploy pending notes [deploy]"` and push. The batch size is `BRAIN_DEPLOY_BATCH`
(Vercel env var, default 5). The MCP server and llms files also update only on
deploy, so they lag by the same batch.

## Access for other AIs

- MCP server: `api/mcp.js`, a dependency-free Streamable HTTP server at
  `https://brainy.pxlvzn.in/mcp` (tools: get_taste_profile, search, fetch,
  list_notes, get_catalog, recall_ideas, get_checks; plus capture, update_note,
  log_project, start_project with `?key=`, see "Capture from any chat"; get_briefing, see
  "Using what's saved"). It reads `/data/brain.json`, which
  `scripts/build_graph.mjs` writes on every deploy, so new notes show up on their own.
- MCP outputs stay lean (Yuvraj's ask 2026-11-26, a chat spent ~12% of its tokens on
  one taste read): `get_taste_profile` returns only the curated part of TASTE.md unless
  `evidence` is passed, `get_catalog` is one line per note unless `detail: "full"`, lists
  use short ids and clipped text, and `fetch` has the full note. Keep it that way, and
  keep the curated part of TASTE.md short since every agent reads it first.
- The build also copies `llms.txt`, `llms-full.txt`, `AGENTS.md`, `TASTE.md`, `CHECKS.md`,
  `IDEAS.md` and `ME.md` to the site root. `site/me.html` renders ME.md with charts.
- If you add a new `kind`, add it to `CATALOGS` in `scripts/build_index.py`,
  `KINDS` in `api/mcp.js`, and the table in `AGENTS.md`.

## Graph site

`site/` is a static, Obsidian-style graph of the whole brain (notes, tags and
topics as nodes; links from tags, topics and `[[slug]]` references). Vercel runs
`node scripts/build_graph.mjs` on every push to `main`, so new entries appear on
their own; nothing to do when filing. `site/data/` is generated and gitignored.
Only `main` deploys: preview builds are off (`git.deploymentEnabled` in
`vercel.json`, Yuvraj's rule 2026-11-12) because they eat the deploy limit. Never
push other branches expecting a preview. Note-only pushes are batched; see "Batched deploys".
Add a colour for a new topic in `PALETTE` at the top of `site/app.js` (unknown
topics get a fallback colour automatically).

## Views (Yuvraj's ask 2026-11-26)

Besides the graph, the site has views that read the same `data/graph.json`, switched
from the GRAPH / BOARD / TIMELINE tabs at the top (`site/views.js` + `views.css` are shared):

- `site/board.html`: Kanban boards. IDEAS by `stage`, PROJECTS by `state` (concept /
  building / live / archived, each card with its next steps and playtest count),
  READING (saved refs) by `status`. Dragging a card (or its ⋯
  menu) rewrites that one field via `/api/edit` `save`, so keep those fields tidy.
- `site/timeline.html`: every note on its `added` day, one track per topic, with an
  NLE-style playhead (J/K/L, drag the ruler) that replays how the brain grew.

- `site/canvas.html`: moodboards in `canvases/<id>.canvas` (JSON Canvas, the open format
  Obsidian uses, so they open there too). Cards are notes (`type: file` with the note's
  repo path), text, links and groups. Edits stay as a browser draft until SAVE commits
  (`/api/edit` action `board`). AUTO (`site/canvas-auto.js`) builds a board four ways: TAG / KIND
  (grid), LINKS (a note plus 1-2 hops of links and backlinks, arrows follow the real links,
  thicker = higher Link Doctor score, dashed = weak or suggested), FLOW (a technique or process:
  its numbered steps as a snaking flow, or an outline from the summary, with its linked notes)
  and CLUSTERS (densely linked notes grouped). Capped at ~30-40 cards. A note's panel has OPEN AS
  CANVAS (and STEPS AS A FLOW for techniques); deep links `canvas.html#auto=links|flow:<slug>`,
  `#auto=clusters:all`. Edges carry an extra `sb` object ({score, kind}) Obsidian ignores. To get
  a clean FLOW, save a technique's steps as a numbered list in its Summary.
- `site/gallery.html`: saved views in `views/<id>.json` (`name`, `about`, `layout`
  gallery|table, `filter` {kind, topic, status, tags, q, kit, hasKit, look}, `sort`),
  Obsidian Bases-style. `views/asset-library.json` (`hasKit: true`) is the asset library:
  KIT chips narrow by area and LOOK chips (words from `style`) search by look.
  SAVE VIEW commits a new one. Agents can read these files to see how he slices the brain.

New views go in the `VIEWS` list in `site/views.js` and the nav in `site/index.html`.
`build_graph.mjs` copies `canvases/` and `views/` to `site/data/canvases.json` and `views.json`.

## Editing from the site

Yuvraj can edit or delete notes on the graph site (EDIT button, or EDIT NOTE in a
note's panel, after entering his passcode). `api/edit.js` commits each change
straight to `main` as `edit: <title> (from site)` or `delete: <title> (from site)`;
changing the topic moves the file and its images. The right-click menu can also
rename notes, add a new note (`add: <title> (from site)`), rename or remove a tag
across notes in one commit, and the CUSTOMISE drawer can save the graph's look to
`site/look.json` (colours, shapes, line style, spread; per-browser tweaks stay in
localStorage). Notes added from the site have a short summary, so tidy them
(fields, `## Raw`) the next time you touch them. It needs two Vercel env vars:
`EDIT_PASSCODE` and `GITHUB_TOKEN` (fine-grained, Contents read/write on this repo
only). Because of these commits, always `git pull --rebase` before you push. The
Vercel build also runs `build_index.py`, so the served llms/TASTE/IDEAS files stay
fresh after site edits; the committed copies catch up the next time you rebuild.

## Project vault (Yuvraj's rule, 2026-11-26)

Project docs (context, to-dos, logs) live in `Documents/Vault/<Project>/` on his Mac
and Windows PC. `tools/vault-sync/brain_sync.py` (scheduled daily on each machine,
rules in its README) syncs them both ways with `projects/<slug>/` and pushes one
commit to `main`. To keep the brain uncluttered:

- Each project is ONE entry: `projects/<slug>/project.md` (kind `project`). Its other
  files are "vault docs" attached to it (catalog, graph panel, llms-full, MCP), never
  separate notes. `note: <slug>` in project.md attaches them to an existing note instead.
- Don't file vault docs into `topics/`, and don't hand-edit `projects/` from a thread:
  the vault is the source of truth. A thread with no vault access may append to
  `projects/<slug>/log.md`; the next sync copies it down into the vault.
- `share:` in project.md: `full`, `summary` (only project.md) or `none`. The repo is
  public, so private projects stay `summary`.
- When a new vault project duplicates an existing project note, set `note:` in its
  project.md rather than keeping two entries.

## Daily build ideas

A scheduled task runs every morning (~9 AM IST), follows `suggestions/README.md`,
sends Yuvraj 1 to 3 build ideas combining his saved notes, and logs them in
`suggestions/YYYY-MM-DD.md` so nothing repeats. Its `suggest:` commit skips the
Vercel deploy unless notes are pending, in which case it ships them (daily flush). If he says he likes one, file it as a
`kind: idea` note and set its `**Status:**` to `picked` in the day file.

## Housekeeping

- If a topic grows past ~50 entries, suggest splitting it (e.g. `ai` into
  `ai-tools` and `ai-research`) and move files with `git mv`.
- Empty `inbox/` whenever you can by moving entries to a topic.
- Never edit `INDEX.md`, `TAGS.md`, `IDEAS.md`, `catalog/`, `llms*.txt` or the
  generated blocks of `TASTE.md` and `ME.md` by hand; regenerate them.
