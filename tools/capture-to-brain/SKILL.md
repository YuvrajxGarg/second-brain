---
name: capture-to-brain
description: Use when Yuvraj, in any chat, says save, add, dump, remember or capture this to my brain (or second brain) about a link, thought, idea, quote, tool, screenshot or anything that is not a project log. Files it as a note in his second brain without a copy.
---

# Capture to brain

Files one thing (or a few) from the current chat into his second brain,
YuvrajxGarg/second-brain, the same way the project's capture thread does. The full
rules are in the repo's `CLAUDE.md`; this is the short version that every chat can follow.

## 0. Route it first

- **Project work** ("log this", "save where this is at", the status, learnings or
  mistakes of a build, an edit job, a client project): use the `log-to-brain` skill
  instead (if it isn't loaded: `tools/vault-sync/log-to-brain/SKILL.md` in the repo). With
  only the brain connector, it's the `log_project` tool.
- **Everything else** (a link, a thought, an idea, a to-do, a quote, a tool, a game, a
  person, a screenshot): a note. Carry on below.
- Both in one message (he logs a session and also wants a link he found kept): do both,
  the log with log-to-brain, the link as a note.

## 1. Split and understand

One link or idea = one note. For a link, actually read it:
- X/Twitter or Instagram: the Social Reader connector (`read_social_link`, ToolSearch
  "social"). It returns the text, thread and frames. If it's missing or fails, ask him
  for a screenshot or what it is.
- Other links: fetch the page. If it can't be read and what it is isn't obvious, **ask
  him in one line** rather than guess from the name or URL (a game called
  "MyCountryMogsYours" is a browser game, not about countries). If he's gone, file it
  with topic `inbox`.
- An image: describe what's in it in words, so it's searchable.

## 2. Look for it first (no copies)

Brain MCP `search` with 2-4 key words (and the link's domain or name). If a note already
covers it, **add to that note** (`update_note`: his new words, a follow-up line, or an
idea's stage) instead of making a second one. Keep the 2-3 notes it really relates to
for linking. Don't read more than the search results; `fetch` only a note you'll extend.

## 3. Fill the fields

- `title`: 2-4 words, name + what it is (`Godot waterfall shader`). No colons, commas or subtitles.
- `type`: link, note, idea, bookmark, quote, video, tool, book, person, place, recipe, todo.
- `topic`: one of ai, tech, business, design, productivity, health, finance, learning,
  life, misc, gamedev. Games, game tools, assets and game-dev techniques: `gamedev`. Never
  `misc` when a real topic fits. Unsure: `inbox`.
- `tags`: 3-6, lowercase kebab-case, singular, for what it **is** and what it's **for**
  (`to-try`, `reference`, `inspiration`). Fewer, accurate tags beat padded ones.
- `kind`: style-ref, website-ref, game-ref, library, asset-source, tool, technique,
  advice, idea, thought, todo (project/org only for things he built or works in).
- `why`: his reason in **his words** if he gave one ("cool visual design"), else a short
  plain reason. Never about him in the third person.
- `style`: visual things only, 2-5 descriptors of what's actually there.
- `stage: new` for ideas and to-dos.
- `kit`: only for things he'd use on a shoot, in an edit or in a game build (a LUT pack,
  SFX library, plugin, preset, effect, asset source, shoot guide): one or more of `grade`,
  `sound`, `vfx`, `motion`, `shoot`, `edit`, `3d`, `2d`. It puts the note in his asset library.
- `summary`: 1-3 sentences in your words. `raw`: exactly what he sent.
- `related`: the 2-3 notes from step 2, each with a short plain reason.

## 4. Write it (pick the first that works)

1. **Brain connector with writing on** (the `capture` tool is listed; the connector URL
   ends in `?key=...`): call `capture`. It checks the rules, refuses a duplicate link
   (also ones filed since the last deploy) and adds backlinks. If it lists problems, fix
   them and call it once more. A public image URL (post photo, frame) can go in `image_url`.
2. **A shell with the repo** (Claude Code, a cloud session): follow `CLAUDE.md`
   "Filing a dump" (write `topics/<topic>/<slug>.md`, `link_doctor.py --fix`,
   `build_index.py`, `check_notes.py --changed`, commit `add: <title>`, `git pull --rebase`,
   push to `main`). Screenshots go next to the note with the same name.
3. **GitHub connector only**: create `topics/<topic>/<slug>.md` on `main` with the
   template in `templates/entry.md` (slug = 3-6 kebab words of the title, no date; add
   `-2` if taken), commit `add: <title>`. The site build regenerates the indexes.
4. **Nothing that can write**: give him the note in one markdown block and say to paste
   it in the Second Brain project chat, or to turn writing on (HANDOFF.md, "Capture from
   any chat").

Never commit secrets, client names, prices, emails or private repo details: the repo is public.

## 5. Reply

One line per note: title, topic, tags. Nothing else unless something needs him (an ask,
a duplicate you extended instead). Notes are on GitHub at once; the site and MCP search
show them after the next batched deploy (5 notes, or the ~9 AM run). Only say that if he
asks why it isn't on the site yet.

## Keep it cheap

No `get_taste_profile`, catalogs, `llms-full.txt` or whole-repo reads for a capture. One
search per item, one write per item.
