# Weekly digests

One file per Sunday, `digests/YYYY-MM-DD.md`, written by the weekly link check
(`links/README.md`, step 6) with `node scripts/brain.mjs digest --write`. The same run
sends the short version to his phone, so Sunday is one notification, not two.

Each digest has:

- **Saved this week**: count by kind, and the titles.
- **Unread pile**: how many saved refs are still unread, and the oldest three.
- **Ideas nobody touched in 3+ weeks**: open ideas (`stage` new or exploring) whose file
  hasn't changed in 21 days. Pick one up, or set it to `dropped`.
- **Projects**: which projects got `log.md` entries this week, and which went quiet.
- **For what you're building**: unread saves that fit his active projects (the same
  ranking as the daily resurface pick, `api/_brief.js`).
- **Link health** from `LINKS.md`.

These files are not notes (not in INDEX, the graph or the MCP server). Run
`node scripts/brain.mjs digest` any day to see this week's without writing it.
