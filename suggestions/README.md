# Daily build ideas

Every morning around 9 AM IST a scheduled Claude task reads the brain and suggests
1 to 3 things Yuvraj could actually build, each one combining 2 or 3 saved notes
(a library + a style ref + a tool, an idea + a technique...) or one fresh idea
grounded in them. It sends the ideas to his phone and saves them here as
`suggestions/YYYY-MM-DD.md`, so they are never repeated.

This folder is not part of the brain's notes (not in INDEX, the graph or the MCP
server). Commits that only touch `suggestions/` skip the Vercel deploy
(`ignoreCommand` in `vercel.json`).

If he likes a suggestion and says so, file it as a normal `kind: idea` note
(`stage: new`) and mark it `picked` in the day's file.

## How the daily run works

The scheduled task follows these steps. Edit them here to change its behaviour.

1. `git pull` on `main`.
2. Read `TASTE.md`, `IDEAS.md`, every file in `catalog/`, and skim the notes in
   `topics/` (frontmatter plus `## Summary`). Lean on the newest notes, but use
   anything.
3. Read every earlier file in `suggestions/`. Never repeat an idea, and never
   reuse the exact same combination of source notes. Rotate across notes so the
   whole brain gets used over time.
4. Come up with 1 to 3 ideas. Each one must be:
   - **Buildable by him**: a small browser game, a motion/VFX piece, a tool or
     agent, a Revolio Labs feature, content he can post. Scoped to a weekend or
     less, with a concrete first step he can do today.
   - **Grounded**: combine 2 or 3 saved notes, or build on one of his own ideas,
     and name the notes by title with their paths.
   - **On taste**: match TASTE.md (look, stack, the games he likes).
   Quality over count: one great idea beats three padded ones.
5. Write `suggestions/YYYY-MM-DD.md` in the format below, commit
   `suggest: N build ideas for YYYY-MM-DD` and push to `main`.
6. Finish with a short message (it becomes the phone notification): one line per
   idea, `Name: what to build, from <note> + <note>`.

## Day file format

```markdown
---
date: 2026-11-12
ideas: 2
---

## 1. Short idea name

**Build:** what it is, in two or three sentences.
**From:** [Note title](../topics/<topic>/<file>.md) + [Note title](...)
**Why it fits:** one line tying it to his taste or goals.
**First step today:** one concrete action.
**Status:** suggested
```
