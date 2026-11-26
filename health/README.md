# Brain health

One weekly message about the brain's plumbing, sent by the Sunday link check (9:42 AM
IST, steps in `links/README.md`). `scripts/health_report.py` builds it:

| Check | Where it comes from | Flags when |
|---|---|---|
| Notes | `topics/`, `inbox/`, `scripts/check_notes.py` | filing-rule errors, unsorted inbox captures |
| Link health | `scripts/link_doctor.py --json` | broken links |
| Deploys | replays `scripts/vercel_ignore.sh` over the week's commits (or the real count from Vercel with `--deploys N`) | note-only deploys go past one per 5 notes plus one daily flush |
| MCP token cost | `scripts/mcp_cost.mjs` runs the real `api/mcp.js` on the local `brain.json` | a typical agent chat (setup + taste + one search + one fetch) passes 6,000 tokens or grows 25% in a week |
| Vault sync | `projects/.sync/<machine>.health.json`, written by `brain_sync.py` on each computer | a machine's last good sync is over 48 h old, or it logged failures |
| Backups | same health files (weekly git bundle per computer) | no computer has a bundle from the last 10 days |

Files here:

- `latest.md`: the full report from the last run (tables per section).
- `history.jsonl`: one line per week, so the report can say "MCP cost up 4,100 -> 5,300".

Run it yourself any time: `python3 scripts/health_report.py` (prints the message, writes
`latest.md`; add `--json` for raw numbers).

## Backups

GitHub is the main copy. On top of that, each computer's daily vault sync writes a full
`git bundle` of the brain once a week to `Documents/Vault/.backups/second-brain-<date>.bundle`
and keeps the newest 6. If Documents syncs to iCloud or OneDrive, the bundles ride along.
Force one now with `brain_sync.py backup`. Restore anywhere with git:

```
git clone ~/Documents/Vault/.backups/second-brain-2026-11-29.bundle second-brain
```

(Weekly GitHub tags were the other idea, but Claude's cloud sessions can't push tags, so
the bundles on your own computers are the backup.)

## Vault sync heartbeat

`brain_sync.py run` (the daily job on the Mac and the PC) records `last_ok`, the last 14
days of failures and the last backup in `projects/.sync/<machine>.health.json`. When
nothing else changed it only pushes that file every 2 days (`sync: heartbeat from mac`),
and `vercel_ignore.sh` never deploys for it. A failed run can't push, so its error waits in
`~/.brain-sync/health.json` and goes up with the next good run; a machine that keeps
failing shows up as "last synced 3d ago".
