# Second Brain

A plain-markdown second brain. Anything worth remembering (links, notes, ideas,
bookmarks, quotes, tools, books) gets dumped in chat, and Claude files it here as
one small markdown file, grouped by topic and tagged so it can be found again.

**Links for AI agents** (give any AI one of these):

| What | Link |
|---|---|
| MCP server (connect it as a custom connector, no auth, read-only) | `https://brainy.pxlvzn.in/mcp` |
| Same server with writing on (Yuvraj only, secret key) | `https://brainy.pxlvzn.in/mcp?key=<CAPTURE_KEY>` |
| Start here, how to use the brain | https://brainy.pxlvzn.in/AGENTS.md |
| Index of everything (llmstxt.org) | https://brainy.pxlvzn.in/llms.txt |
| Every note in one file | https://brainy.pxlvzn.in/llms-full.txt |
| Taste profile / ideas | https://brainy.pxlvzn.in/TASTE.md, https://brainy.pxlvzn.in/IDEAS.md |
| Checks for agents | https://brainy.pxlvzn.in/CHECKS.md (mistakes agents made, each turned into a check) |
| JSON of everything | https://brainy.pxlvzn.in/data/brain.json |

- **Browse:** [INDEX.md](INDEX.md) by topic, [TAGS.md](TAGS.md) by tag.
- **Site:** [brainy.pxlvzn.in](https://brainy.pxlvzn.in), built from [site/](site/) on Vercel.
  The **Graph** is an Obsidian-style map of every note, tag and topic. **Board** is a
  Kanban of ideas, projects and reading (drag a card to change its stage; project cards
  show their next steps and playtests), **Timeline**
  replays every note on the day it was saved, **Canvas** holds moodboards
  ([canvases/](canvases/), JSON Canvas) and **Gallery** shows saved views
  ([views/](views/)), including the **Asset library**: everything tagged with a `kit`
  area (LUTs and grading, sound, VFX, motion, shoot and DIT, edit tools, 3D, 2D),
  searchable by look. Ctrl/Cmd+K opens a command palette on every page, and the graph
  brings back one unread save a day. Notes can be edited on the site (passcode).
- **Links:** every note links 2 or 3 related notes under `## Notes`.
  [LINKS.md](LINKS.md) is the Link Doctor report (health score, broken and one-way
  links, proposed links), made by `scripts/link_doctor.py`. Proposals are answered on
  the site (LINK DOCTOR, key D), and a weekly check runs every Sunday
  ([links/](links/)).
- **Projects:** [projects/](projects/) holds one folder per project of his, synced each
  night from `Documents/Vault` on his Mac (9:30 PM) and PC (10 PM) by
  [tools/vault-sync](tools/vault-sync/). Saying "log this to my brain" adds a dated
  entry to that project's `log.md`; "log this playtest" adds one entry per build played
  to a game's `playtests.md` (what worked, broke, felt, and what to fix next).
- **For AI tools:** start at [AGENTS.md](AGENTS.md). [TASTE.md](TASTE.md) is the
  taste profile, [catalog/](catalog/) groups notes by kind ([kit.md](catalog/kit.md) is
  the asset library), [IDEAS.md](IDEAS.md)
  lists ideas and to-dos, and `https://brainy.pxlvzn.in/mcp` is an MCP server any
  AI app can connect to (compact answers: taste summary first, fetch for detail).
- **Me:** [ME.md](ME.md), a personality read, stats and insights for Yuvraj himself
  (with charts at [brainy.pxlvzn.in/me.html](https://brainy.pxlvzn.in/me.html)).
- **Daily ideas:** [suggestions/](suggestions/) holds the build ideas a scheduled
  task sends Yuvraj every morning, made from combinations of his saved notes, plus one
  unread save from his pile.
- **Build your own:** [HANDOFF.md](HANDOFF.md) explains how to set up this whole system
  for yourself (engine only, no notes).
- **Rules:** [CLAUDE.md](CLAUDE.md) explains how entries are filed, tagged, linked and searched.
- **Capture from any chat:** say "save this to my brain" in any Claude chat. The
  [capture-to-brain](tools/capture-to-brain/SKILL.md) skill files it as a note through
  the MCP server's `capture` tool (writing is on when the connector URL carries the
  key), the GitHub connector, or a shell. Project work goes to log-to-brain instead.
- **Quick capture:** [tools/quick-capture](tools/quick-capture/) is a browser
  extension that saves links, notes, images and videos to `inbox/` in one click.
- **Phone and desktop capture:** [tools/device-capture](tools/device-capture/) has an
  iPhone Share Sheet shortcut, an Action Button voice note, and clipboard/screenshot
  hotkeys for Mac and Windows. They post to `https://brainy.pxlvzn.in/api/capture`
  (locked by the capture key), which drops each capture into `inbox/` to be filed.
- **Entries:** `topics/<topic>/<slug>.md`, named by what the thing is (no date; the
  date is in `added:`), each with YAML frontmatter (`title`, `type`, `topic`, `tags`,
  `kind`, `why`, `style`, `kit`, `source`, `added`).
- **Deploys:** every note is pushed to `main` right away, but the site rebuilds in
  batches: once 5 notes are pending, when code changes, on the morning ideas run, or
  on a `[deploy]` commit ([scripts/vercel_ignore.sh](scripts/vercel_ignore.sh)).

Fix links and rebuild the index after adding entries:

```sh
python3 scripts/link_doctor.py --fix
python3 scripts/build_index.py
```

Preview the graph locally:

```sh
node scripts/build_graph.mjs && python3 -m http.server -d site 8000
```
