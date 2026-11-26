# Inbox sort (twice a day)

Captures from the browser extension, the iPhone Share Sheet / voice notes, the
Mac/Windows hotkeys and MCP `capture` with topic `inbox` land in `inbox/` with
`status: unsorted`. They never show up in chat, so a scheduled Claude task
("Inbox sort", ~8:50 AM and ~5:50 PM IST, Yuvraj's ask 2026-11-26) files them.
Edit the steps here to change its behaviour; the task just follows this file.

## How a run works

1. `git checkout main && git pull --rebase`. List `inbox/*.md` with
   `status: unsorted`. **None: stop.** No commit, no push, no message.
2. Skip any capture that already has `needs:` in its frontmatter unless its
   `## Raw` changed since (it is waiting on Yuvraj, see step 6).
3. Read each capture and anything it points to:
   - X/Twitter and Instagram links: the Social Reader connector (`read_social_link`,
     load with ToolSearch "social"). Save one useful frame or photo next to the note
     and describe it.
   - Other links: fetch the page (WebFetch, or the web-fetch agent) for title + summary.
   - Images saved with the capture: look at them and describe what is there.
4. File it exactly like a normal dump (CLAUDE.md "Filing a dump" and "Quick-capture
   inbox"):
   - Search first: `grep -ril "<domain/path or name>" topics/`. Already saved: add his
     new words under that note's `## Raw` and a dated line under `## Notes`, then
     `git rm` the capture. Don't file a copy.
   - Short 2-4 word title, the right `type` and `kind`, one topic, 3-6 accurate tags
     reused from `TAGS.md`, `why` (his `Note:` line when there is one), `style` for
     visual things, `stage: new` for ideas/to-dos, `kit` when it fits.
   - Keep `## Raw` exactly as captured and the `captured:` line; set `status: unread`.
   - `git mv` the `.md` and its attachments to `topics/<topic>/<slug>.md` (drop the
     date/time prefix, fix image embeds).
   - Link 2-3 really related notes under `## Notes` with short reasons.
5. `python3 scripts/link_doctor.py --fix`, `python3 scripts/build_index.py`, then
   `python3 scripts/check_notes.py --changed` and fix every error.
6. **Can't read it, or the type/topic isn't obvious** (dead link, JS-only page,
   connector failed): don't guess. Leave it in `inbox/` (still `unsorted`) and add one
   frontmatter line `needs: <one-line question for Yuvraj>`. Only these need him.
7. Commit `file: N inbox captures` and push straight to `main` (standing auto-merge
   rule; no branches or PRs). `git pull --rebase` and retry up to 4 times if the push
   is rejected or the network drops. Don't add `[deploy]`: `scripts/vercel_ignore.sh`
   batches deploys (5+ notes, or the next morning's `suggest:` flush).
8. Reply style is silent. Only when step 6 added a new `needs:` line, call
   PushNotification (ToolSearch "PushNotification") with one line per question, and
   end with the same lines. Otherwise end with one plain line (`Filed N: <titles>`)
   and send nothing.

Touch only `inbox/`, `topics/` and generated files. Never edit `projects/`, never
remove a link he wrote in `## Raw`, never ask questions in chat.
