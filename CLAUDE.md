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
ME.md              Yuvraj's own page: curated personality read + insights, generated stats
IDEAS.md           generated: his ideas and to-dos by stage
catalog/           generated: entries grouped by kind (libraries, style-refs, tools...)
llms.txt           generated: llmstxt.org index for AI tools
llms-full.txt      generated: every note in one file
INDEX.md           generated: every entry, grouped by topic, newest first
TAGS.md            generated: every tag with its entries
api/mcp.js         MCP server (read-only) served at https://brainy.pxlvzn.in/mcp
inbox/             only when a dump is genuinely unclear; sort it later
topics/<topic>/    one folder per group, created on demand
templates/entry.md the frontmatter template
scripts/build_index.py  regenerates INDEX, TAGS, IDEAS, catalog/, llms*.txt, TASTE evidence
tools/quick-capture/    browser extension that drops captures into inbox/
scripts/build_graph.mjs builds site/data/graph.json for the graph site
site/                   the graph website (static, deployed on Vercel)
vercel.json             Vercel build config (runs build_graph.mjs, serves site/)
```

Starter topics: `ai`, `tech`, `business`, `design`, `productivity`, `health`,
`finance`, `learning`, `life`, `misc`, plus `gamedev` (game building, assets). Create a new topic folder when 3 or more
entries clearly share a theme that no existing topic fits. Prefer an existing
topic over a new one. Topic names are short, lowercase, kebab-case.

## Filing a dump

1. Split the message into separate items. One link or idea = one entry.
2. For each item, pick a **type**: `link`, `note`, `idea`, `bookmark`, `quote`,
   `video`, `tool`, `book`, `person`, `place`, `recipe`, `todo`.
3. Pick **one topic** (the folder) and **3 to 6 tags**.
3b. Fill the AI-facing fields (see "AI-readable fields" below): `kind` always,
   `why` always, `style` for anything visual, `stage: new` for ideas and to-dos.
4. If it's a link, fetch it when possible and write a 1 to 3 sentence summary in
   your own words, plus the page title. If it can't be fetched, say so in the body.
5. Write the file to `topics/<topic>/YYYY-MM-DD-<slug>.md` using the template
   below. `slug` is 3 to 6 kebab-case words from the title.
6. If the entry adds something new to his taste (a new look, a new game type, a new
   library he'll build with), update the curated part of `TASTE.md` (above the
   GENERATED marker) and its "Last curated" line. Then run
   `python3 scripts/build_index.py`; it refreshes every generated file.
7. Commit with message `add: <short title>` (or `add: N entries` for a batch) and
   push to `main` right away. See "Auto-merge" below.
8. Reply to Yuvraj with one line per entry: title, topic, tags.

Screenshots and images: save them next to the entry with the same name
(`topics/<topic>/YYYY-MM-DD-<slug>.png`), embed with `![screenshot](./<file>)`
in `## Summary`, and describe what's in the image in words so it's searchable.
### X/Twitter and Instagram links (Yuvraj's standing rule, 2026-11-11)

Every X/Twitter post or thread link and every Instagram post or reel link is read
with the **Social Reader** connector (`read_social_link`, load it via ToolSearch
"social reader"). It returns the post text, the author's full thread and video
frames. Save one useful frame or photo next to the entry and describe it. Only
fall back to asking for a screenshot if the connector fails.

Never drop what he sent. Keep his own words verbatim under `## Raw` so nothing is
lost to summarising.

## Quick-capture inbox

Yuvraj also captures from a browser extension (`tools/quick-capture/`), which
commits straight to `inbox/` as `inbox/YYYY-MM-DD-HHMMSS-<slug>.md` (plus any
images/videos with the same name), with `status: unsorted`. These never show up
in chat, so:

- At the start of every thread in this project, `git pull` and check `inbox/`
  for `status: unsorted` files. Also do it whenever Yuvraj says "sort my inbox".
- File each one like a normal dump: pick topic, type, tags, write the summary
  (fetch the link if there is one), keep `## Raw` exactly as captured, keep the
  `captured:` line, and set `status: unread`.
- `git mv` the `.md` and its attachments to `topics/<topic>/YYYY-MM-DD-<slug>.md`
  (drop the time part, fix the image embeds to the new names).
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
  `thought`, `todo`. This drives `catalog/`.
- `why` (required): his reason for saving it, **in his words** when he gave one
  ("cool visual design"), otherwise a short plain reason. Never drop his comment.
- `style` (visual things only): 2 to 5 short descriptors of what to take from it,
  e.g. `chunky flat pixel art`, `textured pastel brushwork`, `minimal hud`. Look
  at the image or video frames; describe what's actually there. No commas inside
  one descriptor.
- `stage` (kind `idea` or `todo` only): `new`, `exploring`, `doing`, `done`,
  `dropped`. When he says he started, finished or dropped an idea, update it.
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

## Finding things later

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

## Access for other AIs

- MCP server: `api/mcp.js`, a dependency-free, read-only Streamable HTTP server at
  `https://brainy.pxlvzn.in/mcp` (tools: get_taste_profile, search, fetch,
  list_notes, get_catalog, recall_ideas). It reads `/data/brain.json`, which
  `scripts/build_graph.mjs` writes on every deploy, so new notes show up on their own.
- The build also copies `llms.txt`, `llms-full.txt`, `AGENTS.md`, `TASTE.md`,
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
push other branches expecting a preview, and batch filings into one push where you can.
Add a colour for a new topic in `PALETTE` at the top of `site/app.js` (unknown
topics get a fallback colour automatically).

## Housekeeping

- If a topic grows past ~50 entries, suggest splitting it (e.g. `ai` into
  `ai-tools` and `ai-research`) and move files with `git mv`.
- Empty `inbox/` whenever you can by moving entries to a topic.
- Never edit `INDEX.md`, `TAGS.md`, `IDEAS.md`, `catalog/`, `llms*.txt` or the
  generated blocks of `TASTE.md` and `ME.md` by hand; regenerate them.
