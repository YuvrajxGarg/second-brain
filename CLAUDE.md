# Second Brain: rules for Claude

This repo is Yuvraj's second brain. He dumps things in chat (links, notes, ideas,
bookmarks, quotes, screenshots described in words, videos, people, tools) and Claude
files them here so they can be found again later. Keep it plain markdown, one file
per entry, so it stays easy to append to and easy to grep.

## Layout

```
CLAUDE.md          these rules
README.md          short human overview
INDEX.md           generated: every entry, grouped by topic, newest first
TAGS.md            generated: every tag with its entries
inbox/             only when a dump is genuinely unclear; sort it later
topics/<topic>/    one folder per group, created on demand
templates/entry.md the frontmatter template
scripts/build_index.py  regenerates INDEX.md and TAGS.md
```

Starter topics: `ai`, `tech`, `business`, `design`, `productivity`, `health`,
`finance`, `learning`, `life`, `misc`. Create a new topic folder when 3 or more
entries clearly share a theme that no existing topic fits. Prefer an existing
topic over a new one. Topic names are short, lowercase, kebab-case.

## Filing a dump

1. Split the message into separate items. One link or idea = one entry.
2. For each item, pick a **type**: `link`, `note`, `idea`, `bookmark`, `quote`,
   `video`, `tool`, `book`, `person`, `place`, `recipe`, `todo`.
3. Pick **one topic** (the folder) and **3 to 6 tags**.
4. If it's a link, fetch it when possible and write a 1 to 3 sentence summary in
   your own words, plus the page title. If it can't be fetched, say so in the body.
5. Write the file to `topics/<topic>/YYYY-MM-DD-<slug>.md` using the template
   below. `slug` is 3 to 6 kebab-case words from the title.
6. Run `python3 scripts/build_index.py` to refresh `INDEX.md` and `TAGS.md`.
7. Commit with message `add: <short title>` (or `add: N entries` for a batch) and
   push to `main`. No PRs: this repo is a log, commit straight to main.
8. Reply to Yuvraj with one line per entry: title, topic, tags.

Never drop what he sent. Keep his own words verbatim under `## Raw` so nothing is
lost to summarising.

## Entry format

```markdown
---
title: Short human title
type: link
topic: ai
tags: [llm, agents, prompting]
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

## Tags

- Lowercase, kebab-case, singular (`startup`, not `Startups`).
- Reuse existing tags. Check `TAGS.md` before inventing one.
- Mix of what it's **about** (`llm`, `marketing`) and what it's **for**
  (`to-read`, `to-try`, `inspiration`, `reference`).
- Related entries: link with `[[slug]]` in `## Notes`, both ways if it helps.

## Finding things later

When Yuvraj asks "what was that thing about X":

1. `grep -ril "x" topics/` for full text.
2. `grep -rl "tags:.*x" topics/` for a tag.
3. Browse `INDEX.md` by topic, or `TAGS.md` by tag.
4. Answer with the title, the summary, the source link and the file path.
   If several match, list the best 5 with one line each.

## Housekeeping

- If a topic grows past ~50 entries, suggest splitting it (e.g. `ai` into
  `ai-tools` and `ai-research`) and move files with `git mv`.
- Empty `inbox/` whenever you can by moving entries to a topic.
- Never edit `INDEX.md` or `TAGS.md` by hand; regenerate them.
