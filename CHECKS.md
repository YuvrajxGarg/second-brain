# CHECKS.md: mistakes turned into checks

Read this before working for Yuvraj. Every line here is a mistake an agent made that
he had to correct (new lines need two sightings), plus the strongest fix that stops
it happening again. The
`mistakes-to-checks` skill keeps it (rules: [tools/mistakes-to-checks/SKILL.md](tools/mistakes-to-checks/SKILL.md)).

**Fix ladder**, strongest first. Take the first one that works:

1. **Impossible**: a type, schema, config or script makes the mistake impossible.
2. **Caught**: a lint rule, CI or build check flags it automatically.
3. **Proved**: a test or command the agent must run before saying "done".
4. **Rule**: a scoped written rule with its reason, only when code can't check it.
5. **Human**: a judgment call; ask Yuvraj.

If code can check it, code does it, and the prose rule it replaces gets shorter.

**Where checks live**

- Here: checks for every agent (how to work with him, and this brain repo itself).
- One project only: `checks.md` in that project's Vault folder
  (`Documents/Vault/<Project>/checks.md`), synced to `projects/<slug>/checks.md`.
  MCP: `get_checks` with the project's slug returns both.
- The evidence (each time it went wrong) stays in the project's `log.md` under
  "Mistakes and fixes". Checks cite those entries by date, they don't copy them.

## Every agent

| id | mistake | seen | fix | enforced by |
|---|---|---|---|---|
| G1 | Pushing branches or previews to his Vercel projects, which eat the deploy limit | 2026-11-12 | impossible | `git.deploymentEnabled` in each `vercel.json`: only `main` deploys |

## This brain repo

Run `python3 scripts/check_notes.py --changed` before every commit that adds or edits notes;
fix every error. `python3 scripts/check_notes.py` checks the whole brain.

| id | mistake | seen | fix | enforced by |
|---|---|---|---|---|
| B1 | Long note titles with subtitles, cut off as graph labels | 2026-11-09 | caught | `check_notes.py` [short-title] |
| B2 | Notes missing `kind`, `why`, or `stage` on ideas | 2026-11-12 | caught | `check_notes.py` [ai-fields] [stage] |
| B3 | His own projects filed as `type: note` | 2026-11-12 | caught | `check_notes.py` [project-type] |
| B4 | Date-first slugs after the rename to name-first | 2026-11-26 | caught | `check_notes.py` [slug] |
| B5 | `why` written about him in the third person ("his own project") | 2026-11-12 | caught (warning) | `check_notes.py` [why-voice] |
| B6 | Tags in the wrong shape (capitals, plurals of existing tags) | 2026-11-09 | caught | `check_notes.py` [tags] for shape; reuse from `TAGS.md` is a rule |
| B7 | His words dropped while summarising | 2026-11-09 | caught | `check_notes.py` [raw] |
| B8 | Tagging by words in a name or URL instead of what the thing is | 2026-11-09 | human | Unreadable link and unclear type: ask him in one line, park it in `inbox/` |
| B9 | Push rejected after edits from the graph site | 2026-11-12 | rule | `git pull --rebase` before every push |
