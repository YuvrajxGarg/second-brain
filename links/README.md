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
steps. Edit them here to change its behaviour.

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
5. `python3 scripts/build_index.py` (refreshes LINKS.md and the rest), commit
   `links: weekly check` and push to `main` (one deploy). Retry the push up to 4 times.
6. End with a short message (it becomes the phone notification):
   `Link health <old> -> <new>/100. <N> backlinks added, <N> reasons rewritten,
   <N> proposals waiting: brainy.pxlvzn.in (LINK DOCTOR)`, plus the single best
   proposal in one line.
