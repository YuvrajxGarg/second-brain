# Link Doctor

`scripts/link_doctor.py` audits the `[[slug]]` links between notes and writes
`LINKS.md` (repo root) plus `site/data/links.json` for the graph site. See the
"Links between notes" section of `CLAUDE.md` for the scoring and the rules.

- `dismissed.json`: pairs Yuvraj (or the weekly check) said no to, as
  `"<slug-a>|<slug-b>": "why"` with the two slugs sorted. The Doctor never proposes
  them again and never flags them as weak. NO and KEEP on the site write here.
- On the graph site: **LINK DOCTOR** (bottom left, or press D) lists suggested links,
  weak links, tag merges and orphans with LINK / NO, UNLINK / KEEP buttons (edit
  passcode needed). **QUALITY** (or Q) colours links green / amber / red by score and
  rings orphans.

## How the weekly check works

A scheduled Claude task runs every Sunday morning (9:42 AM IST) and follows these
steps. It also sends the weekly brain health report (backups, deploys, MCP cost, vault
sync per computer: see `health/README.md`) and the weekly digest (what he saved, unread
pile, untouched ideas: see `digests/README.md`) in the same message, so there is one
Sunday notification, not three. Edit them here to change its behaviour.

1. `git pull` on `main`.
2. `python3 scripts/link_doctor.py --fix`: relinks old date-first or partial links and adds
   backlinks for strong one-way links. These are lossless, so they need no approval.
3. Rewrite machine reasons into plain words. Every link line the Doctor added has a
   reason like `both pixel-art, sprites` or `made under Revolio Labs`. Read both notes and
   replace the reason with a short human one (`same pixel-art-in-3D look`, `the
   studio's internal tool`). Keep it under 10 words. Never touch `## Raw`.
4. Judge the proposals in `LINKS.md` ("Add these links"). For each one, read both
   notes' summaries and decide if a link would help him find or build something.
   - Clear no (they only share a generic tag like `claude` or `website`): add the pair
     to `dismissed.json` with `"judge: <why>"`. This only stops the proposal.
   - Yes or unsure: leave it for Yuvraj to answer on the site.
   Do not add or remove links between notes yourself. Only he says yes to those.
4b. Categories (busy tags that could be their own topic, see CLAUDE.md "Categories grow
   from busy tags"): `node scripts/categories.mjs check`.
   - Strays (notes tagged for a category that already exists, filed elsewhere):
     `node scripts/categories.mjs promote <name>` for each such category. Already
     approved, so no need to ask.
   - New proposals: `categories.json` `"mode": "propose"` (his choice) = don't promote.
     Put the top 3 in the message (step 9). A clear no (the tag is a format or a vibe,
     not a thing he'd browse as a folder): `node scripts/categories.mjs dismiss <name>
     --why "judge: <why>"`. `"mode": "auto"`: promote each one and say so in the message.
5. `python3 scripts/build_index.py` (refreshes LINKS.md and the rest).
6. Health report (see `health/README.md`): if the Vercel connector is available, count
   this week's production deploys of project `second-brain` (team `revolio`) with
   `list_deployments` and pass it as `--deploys N`; otherwise skip that flag and the
   script estimates. Run
   `python3 scripts/health_report.py --save --link-before <health from step 1>`.
   It writes `health/latest.md`, appends `health/history.jsonl` and prints three lines.
7. Weekly digest (Yuvraj's ask 2026-11-26): `node scripts/brain.mjs digest --write`. It
   writes `digests/YYYY-MM-DD.md` (saved this week, unread pile, ideas untouched for 3+
   weeks, project activity, unread saves that fit what he's building, link health) and
   prints a 2-3 line summary. See `digests/README.md`.
8. Commit `links: weekly check` (links, notes, generated files, `health/` and `digests/`)
   and push to `main` (one deploy). Retry the push up to 4 times.
9. End with one short message (it becomes the phone notification), no headers:
   the digest's summary lines, then the three lines the health report printed, then
   `<N> backlinks added, <N> reasons rewritten, <N> proposals waiting. Best: <Note> <-> <Note> (<why>)`,
   then, when step 4b found any, `Could be its own category: revolio (16 notes), pxlvzn (12). Say "promote revolio", or MAKE CATEGORY in LINK DOCTOR.`
   and `Review: brainy.pxlvzn.in (LINK DOCTOR, or press D) · report: health/latest.md · digest: digests/<date>.md`.
   If the report flagged something you can fix inside these rules (an unsorted inbox
   capture is not one: leave filing to Yuvraj's threads), say what, don't fix it.
