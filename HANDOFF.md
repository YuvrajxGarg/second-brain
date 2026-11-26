# Build your own second brain (hand-off guide)

This is a recipe for copying the system behind this repo so you can run your own
second brain with Claude. It covers what the system is, how the pieces fit, and how
to set each piece up. You get the **engine** (rules, scripts, graph site and its
views, Link Doctor, capture extension, MCP server, daily ideas routine, project
vault sync), not anyone's notes.

_Last updated 2026-11-26: Link Doctor, Board / Timeline / Canvas / Gallery views,
command palette, project vault sync and the log-to-brain skill, batched deploys,
name-first file names, leaner MCP outputs, phone and desktop capture (iPhone Share
Sheet and Action Button, Mac and Windows hotkeys), offline search (desktop + phone),
weekly health report and backups._

Placeholders used below:

| Placeholder | Replace with |
|---|---|
| `<you>` | your first name |
| `<github-user>` | your GitHub username |
| `<repo>` | your repo name, e.g. `second-brain` |
| `<site-domain>` | where the graph site will live, e.g. `brain.example.com` or `my-brain.vercel.app` |
| `<tz>` | your time zone, e.g. `Asia/Kolkata` |

---

## 0. The simple version (no coding needed)

If you only read one section, read this one. You need about an hour, a laptop, and
free accounts on **GitHub**, **Vercel** and **Claude** (a paid Claude plan, since
you'll use Projects and connectors). Wherever you see `<something>`, put in your own
name or link.

**A. Copy the system (5 min)**

1. Sign in to GitHub. Go to **github.com/new/import**.
2. In "Your old repository's clone URL" paste
   `https://github.com/YuvrajxGarg/second-brain`.
3. Name it `second-brain`, pick **Public** (easiest) or Private, click
   **Begin import**. Wait for it to finish. It copies everything, including the
   original owner's notes; Claude deletes those for you in step C.

**B. Set up Claude (10 min)**

4. On claude.ai, click **Projects → New project**, call it "Second Brain".
5. In the project, connect GitHub when asked and add your new `second-brain` repo.
6. Open the project's settings and paste the **project instructions** from
   section 5a into the instructions box (change `<you>` and the repo name).

**C. Let Claude make it yours (10 min)**

7. Start a thread in the project and send the **first message** from section 5b
   (fill in the bits in `<...>` and a few lines about yourself).
8. Claude clears out the old notes, puts your name in, answers a few questions
   with you and saves your first notes. You don't touch any code.

**D. Put the graph website online (10 min)**

9. Sign in to vercel.com with GitHub. Click **Add New → Project**, pick your
   `second-brain` repo, leave every setting as it is, click **Deploy**.
10. When it's done you get a link like `second-brain-xyz.vercel.app`. That's your
    brain as a graph. Tell Claude the link so it can use it in your files.

**E. Let Claude read Instagram and X links (15 min)**

**Easy way (2 min):** if the person who sent you this guide gave you a ready-made
Social Reader link, just do this and skip steps 11 to 14:

- On claude.ai go to **Settings → Connectors → Add custom connector**, name it
  `Social Reader`, paste the link, click **Add**.
- Start a **new** thread in your project and paste an Instagram reel link to test.

**Your own copy (15 min),** if you'd rather not depend on anyone else's:

11. Make up a long random password (a password manager can make one). Call it
    your **reader password**.
12. On Vercel again: **Add New → Project**, pick the same `second-brain` repo.
    Change the project name to `social-reader`, click **Edit** next to **Root
    Directory** and choose `tools/social-reader`.
13. Open **Environment Variables**, add the name `MCP_TOKEN` with your reader
    password as the value, then click **Deploy**.
14. Your reader link is
    `https://<your-social-reader-project>.vercel.app/mcp/<your reader password>`.
15. On claude.ai go to **Settings → Connectors → Add custom connector**, name it
    `Social Reader`, paste that link, click **Add**.
16. Start a **new** thread in your project (connectors only show up in new
    threads). Paste an Instagram reel link to test it.

**F. One-click saving from your browser (optional, 10 min)**

17. On GitHub, open your repo, click **Code → Download ZIP**, unzip it, and move
    the `tools/quick-capture` folder somewhere you won't delete it.
18. In Chrome go to `chrome://extensions`, turn on **Developer mode** (top right),
    click **Load unpacked**, pick that `quick-capture` folder. Pin it.
19. Make a GitHub token at **github.com/settings/personal-access-tokens/new**:
    give it access to only your `second-brain` repo, and under Permissions set
    **Contents** to **Read and write**. Copy the token.
20. Click the extension icon, paste the token, type your GitHub username as
    **Owner** and `second-brain` as **Repo**, click **Test connection**, then
    **Save**.

**G. Morning ideas and a weekly link check (optional, 4 min)**

21. In your Claude project, send: *"Set up a scheduled task that runs every
    morning at 9 AM my time, follows suggestions/README.md, and sends me the
    ideas as a notification."* Each morning you also get one old unread save
    back ("From your pile").
22. Then send: *"Set up a weekly scheduled task for Sunday mornings that follows
    the steps in links/README.md."* It tidies the links between your notes.

**H. Project folders on your computer (optional, 15 min)**

23. If you work on projects (apps, games, client jobs) and want their notes, to-dos
    and logs in the brain, follow section 3.9. You get a `Documents/Vault` folder
    that syncs into the brain every night, and a "log this to my brain" command for
    any Claude chat.

**That's it.** From now on, just paste anything into your Claude project: links,
thoughts, reels, screenshots. Claude files it and pushes it right away. The website
rebuilds once 5 notes have piled up (or the next morning), so a new note can take
a few hours to show on the graph; say "deploy now" if you want it sooner. Ask
"what was that thing about X" to find it again.

The rest of this guide explains the same steps in more detail, for when you're
curious how it works or something breaks.

---

## 1. What it is

You dump anything in a chat with Claude: links, thoughts, ideas, quotes, tools,
screenshots, Instagram reels, X threads. Claude reads it (fetching links and social
posts), then files each item as **one small markdown file** in a GitHub repo,
grouped by topic, tagged, and summarised. Your exact words are always kept.

On top of the notes, the system builds:

- **A graph website**: an Obsidian-style map of every note, tag and topic. You can
  edit notes from it. Next to the graph it has **Board** (Kanban of ideas, projects
  and reading, drag a card to change its stage), **Timeline** (every note on the day
  it was saved, with a playhead that replays how the brain grew), **Canvas**
  (moodboards) and **Gallery / Table** (saved filtered views). **Ctrl/Cmd+K** opens a
  command palette on every page, and the graph shows one old unread save per day.
- **Link Doctor**: scores every pair of notes, fixes broken and one-way `[[links]]`,
  and proposes new links for you to accept or reject on the site. A weekly task
  keeps it tidy.
- **AI context files**: a taste profile, catalogs by kind, an ideas list and an
  MCP server, so any other AI (Claude, Cursor, ChatGPT...) can learn your taste,
  libraries and ideas instead of giving generic answers.
- **A self page** (`ME.md`): a personality read, stats and nudges built from what
  you save.
- **A browser extension** that saves a page, text, image or video in one click
  into an `inbox/` folder for Claude to sort later.
- **A daily ideas routine**: every morning Claude reads the brain and sends you 1
  to 3 things you could build, each combining notes you saved, plus one unread
  save from your pile.
- **A project vault** (optional): a `Documents/Vault` folder on your computers, one
  subfolder per project, synced nightly into `projects/` in the brain. Saying "log
  this to my brain" at the end of a work session writes a dated entry into that
  project's `log.md`.

Why it works: saving costs nothing (just paste), every note is plain text in git
(greppable, portable, never locked in), and the AI does the boring part (titles,
tags, summaries, links, indexes).

---

## 2. Architecture

```
 you ──paste──▶ Claude project chat ──files──┐
 you ──click──▶ quick-capture extension ──commits──▶ inbox/ ──Claude sorts──┐
 you ──share / hotkey / voice──▶ /api/capture ──commits──▶ inbox/ ───────────┤
                                              ▼                              ▼
                              GitHub repo  topics/<topic>/<slug>.md
 Documents/Vault (Mac, PC) ──brain_sync.py nightly──▶ projects/<slug>/
                                              │
          python3 scripts/link_doctor.py --fix│ (adds backlinks, fixes old links)
               python3 scripts/build_index.py │ (Claude runs both on every filing)
                                              ▼
     INDEX.md  TAGS.md  IDEAS.md  LINKS.md  catalog/*.md  llms.txt  llms-full.txt
     TASTE.md + ME.md (generated blocks)
                                              │ push to main (every filing)
                                              ▼
            scripts/vercel_ignore.sh: deploy only when 5+ notes are pending,
            code changed, "[deploy]" is in the message, or the morning run
                                              ▼
            Vercel build: build_index.py + scripts/build_graph.mjs
                                              ▼
     <site-domain>          graph site (site/), me.html
     <site-domain>/mcp      read-only MCP server (api/mcp.js)
     <site-domain>/api/edit passcode-locked edit API (api/edit.js)
     <site-domain>/llms.txt, /TASTE.md, /IDEAS.md, /data/brain.json

 scheduled Claude task (every morning) ──reads brain──▶ suggestions/YYYY-MM-DD.md + phone ping
 scheduled Claude task (Sundays) ──link_doctor --fix, judges proposals──▶ links: weekly check
```

### Repo layout

```
CLAUDE.md          the rules Claude follows (the heart of the system)
README.md          short human overview
AGENTS.md          entry point for other AIs: what to read, the fields, how to connect
TASTE.md           taste profile: curated top part + generated evidence block
CHECKS.md          mistakes agents made, each turned into a check
ME.md              your own page: curated read + generated stats
IDEAS.md           generated: your ideas and to-dos by stage
catalog/           generated: notes grouped by kind (libraries, style-refs, tools...)
llms.txt           generated: llmstxt.org index for AI tools
llms-full.txt      generated: every note in one file
INDEX.md           generated: every note by topic, newest first
TAGS.md            generated: every tag with its notes
LINKS.md           generated: link health, broken/one-way links, proposed links
inbox/             unsorted captures from the extension
topics/<topic>/    one folder per topic, one file per note
projects/<slug>/   synced from your Documents/Vault: one project.md + its docs each
canvases/          moodboards as JSON Canvas files (open in Obsidian too)
views/             saved gallery/table views as JSON
links/             Link Doctor: dismissed.json + the weekly check's steps (README)
health/            weekly health report: latest.md, history.jsonl, README
templates/entry.md the frontmatter template
scripts/build_index.py   regenerates everything marked "generated" above
scripts/link_doctor.py   scores and audits [[slug]] links; --fix applies safe fixes
scripts/build_graph.mjs  builds site/data/graph.json + brain.json for the site and MCP
scripts/vercel_ignore.sh decides whether a push deploys (batched deploys)
scripts/brain_search.py  offline search (terminal) over notes + your local vault
scripts/health_report.py weekly health report; scripts/mcp_cost.mjs measures MCP tokens
site/              the static site: graph (index.html), board, timeline, canvas,
                   gallery, search, me.html; shared views.js (nav, palette, passcode);
                   sw.js + manifest.webmanifest make it an offline home-screen app
api/mcp.js         MCP server (Vercel function, no dependencies)
api/edit.js        edit API for the site (Vercel function)
api/capture.js     plain HTTP capture endpoint for phone and desktop (CAPTURE_KEY)
tools/quick-capture/     the browser extension
tools/device-capture/    iPhone shortcuts (build steps), Mac and Windows hotkey scripts
tools/social-reader/     the Instagram/X link reader (MCP connector, deploys on its own)
tools/vault-sync/        brain_sync.py (vault sync) + the log-to-brain skill
suggestions/       daily build ideas, one file per day, plus the routine's README
vercel.json        build command, MCP rewrite, ignoreCommand, production-only deploys
```

Everything is dependency-free: Python 3 standard library, plain Node, and static
files. Nothing to `npm install`.

---

## 3. Setup, step by step

Rough time: 30 to 45 minutes for everything, 10 minutes for just the core (steps
3.1 to 3.3).

### 3.1 Make your repo (copy the engine, not the notes)

No terminal? Use GitHub's importer as in section 0 (step A) and let Claude delete
the old notes in its first session. With a terminal:

```sh
git clone --depth 1 https://github.com/YuvrajxGarg/second-brain.git <repo>
cd <repo>
rm -rf .git topics inbox catalog projects site/look.json
rm -f suggestions/2*.md canvases/*.canvas views/*.json LINKS.md
echo '{ "pairs": {} }' > links/dismissed.json
for t in ai tech business design productivity health finance learning life misc; do
  mkdir -p topics/$t && touch topics/$t/.gitkeep
done
mkdir inbox && touch inbox/.gitkeep
mkdir -p canvases views && touch canvases/.gitkeep views/.gitkeep
git init -b main
```

Then create an empty repo on GitHub named `<repo>` (public or private, see the note
below), and push:

```sh
git add -A && git commit -m "start: second brain engine"
git remote add origin https://github.com/<github-user>/<repo>.git
git push -u origin main
```

The copied `CLAUDE.md`, `AGENTS.md`, `TASTE.md`, `ME.md`, `README.md` and a few
strings in the code still describe the original owner. **Don't edit them by hand**:
the starter prompt in section 5 tells your Claude to make them yours in its first
session (it's a find-and-replace plus a rewrite of the curated parts).

Public or private? Public is simpler: the MCP server and `llms.txt` can be read by
any AI with no auth, and raw GitHub links work. Private works too (Vercel can deploy
private repos), but then don't link raw GitHub files from `AGENTS.md`. Either way,
**never save passwords, keys or anything you wouldn't want leaked**.

### 3.2 Create the Claude project

1. In Claude (claude.ai or the app), create a **project** named "Second Brain".
2. Connect GitHub and add `<github-user>/<repo>` as the project's repository, so
   every thread gets a fresh clone and can push.
3. Paste the **project instructions** from section 5 into the project settings.
4. Optional but useful connectors:
   - **A social link reader** (see 3.3). Strongly recommended.
   - **Vercel** connector, so Claude can check deploys and set up the site.
   - **GitHub** is required (done above).

How you use it: drop things in the project chat. Claude files them, rebuilds the
index, commits and pushes to `main`. Ask "what was that thing about X" and it
searches.

### 3.3 Social Reader: a link reader for Instagram and X

Claude can fetch most web pages, but Instagram reels and X posts are behind logins
and JavaScript, so a plain fetch gets nothing. **Social Reader** fixes that. Its
full source is in this repo at [`tools/social-reader/`](tools/social-reader/), so
your copy already has it. It's a small MCP connector with one tool,
`read_social_link(url)`, that returns:

- the post text (for X, the author's whole thread, plus quoted posts and stats),
- the caption, author and counts for Instagram posts and reels, carousels included,
- the photos, and a few frames sampled from any video, as images Claude can see.

It's free: it uses the public FxTwitter API and Instagram's public embed page, so
there are no API keys or accounts. Limits: private, deleted and age-restricted
posts can't be read, Instagram comments aren't included, and audio isn't
transcribed.

**Host it (for claude.ai, web and mobile, and Projects):**

1. Pick a long random secret. This is your `MCP_TOKEN`; the connector URL contains
   it, so anyone without it gets a 404.
2. Vercel: **Add New → Project**, import your brain repo again, name the project
   `social-reader`, set **Root Directory** to `tools/social-reader`. Its own
   `vercel.json` sets up the Python function, the `/mcp/<token>` route, and skips
   rebuilding when only other parts of the repo change.
3. Add the environment variable `MCP_TOKEN` = your secret, then **Deploy**.
4. Connector URL: `https://<social-reader-project>.vercel.app/mcp/<MCP_TOKEN>`.
5. claude.ai: **Settings → Connectors → Add custom connector**, name it
   `Social Reader`, paste the URL, **Add**. No OAuth.
6. Connectors only attach to threads started **after** you add them, so start a
   new thread to use it.

To change the secret later: change `MCP_TOKEN` in the Vercel project settings,
redeploy, and update the URL in claude.ai.

**Run it locally instead** (Claude Code or Claude Desktop): see
[`tools/social-reader/README.md`](tools/social-reader/README.md). It needs `uv`
and `ffmpeg`, and there's a Claude Code plugin with a skill that triggers it
automatically on any X or Instagram link.

The project instructions in section 5 tell Claude to always use it for social
links and only fall back to asking for a screenshot if it fails.

### 3.4 Graph site on Vercel

1. On vercel.com, **Add New Project**, import `<github-user>/<repo>`.
2. Framework preset: **Other**. Leave build settings empty: `vercel.json` already
   sets the build command (`build_index.py` then `build_graph.mjs`), the output
   directory (`site`) and the `/mcp` rewrite.
3. Deploy. You get `<repo>.vercel.app`. Optionally add a custom domain
   (`<site-domain>`) under Project Settings, Domains, and add the CNAME it asks
   for at your DNS provider.
4. `vercel.json` turns **preview builds off** (only `main` deploys), so deploys
   don't get eaten by branches. Keep that.

**Batched deploys.** Claude pushes every note to `main` straight away (nothing is
ever lost), but the site doesn't rebuild on every note. `vercel.json`'s
`ignoreCommand` runs `scripts/vercel_ignore.sh`, which compares against the last
deployed commit and only deploys when:

- 5 or more notes under `topics/` changed since the last deploy,
- anything other than notes and generated files changed (site, api, scripts, config),
- the commit message contains `[deploy]`, or the edit came from the graph site,
- or it's the morning ideas commit (`suggest:`) and any notes are pending (daily flush).

So a single note waits at most until the next morning. Say **"deploy now"** and
Claude pushes an empty `[deploy]` commit. Change the batch size with a Vercel env
var `BRAIN_DEPLOY_BATCH` (default 5). The MCP server and `llms.txt` update on deploy
too, so they lag by the same batch. If you deploy rarely anyway, you can delete the
`ignoreCommand` line to deploy on every push.

**Edit from the site** (optional): add two environment variables in Vercel
(Project Settings, Environment Variables), then redeploy:

| Variable | Value |
|---|---|
| `EDIT_PASSCODE` | a passcode you pick, 8+ characters |
| `GITHUB_TOKEN` | a fine-grained GitHub token, **only this repo**, Contents: read and write |
| `GITHUB_REPO` | `<github-user>/<repo>` |

The EDIT button then lets you rename, retag, move, delete and add notes; each
change is a commit to `main`. Because of that, Claude must `git pull --rebase`
before pushing (the rules already say so).

New topic colours live in `PALETTE` at the top of `site/app.js`; unknown topics get
a fallback colour.

**The views** (tabs at the top of the site, all reading the same `data/graph.json`):

| Page | What it does |
|---|---|
| Graph (`/`) | the map. Note panels show Links, Unlinked mentions and Might relate. **D** opens Link Doctor, **Q** colours links by quality. A card brings back one unread save a day |
| Board (`/board.html`) | Kanban: IDEAS by `stage`, PROJECTS by `state`, READING by `status`. Dragging a card rewrites that one field (passcode needed) |
| Timeline (`/timeline.html`) | every note on its `added` day, one track per topic, NLE-style playhead (J/K/L, drag the ruler) |
| Canvas (`/canvas.html`) | moodboards saved as `canvases/<id>.canvas` (JSON Canvas, opens in Obsidian too). AUTO builds one from a tag or kind; SAVE commits it |
| Gallery (`/gallery.html`) | saved views in `views/<id>.json` (filter by kind, topic, status, tags, text; gallery or table). SAVE VIEW commits a new one |

**Ctrl/Cmd+K** on any page opens a palette to jump to a note, tag, view or action.
Board drags, canvas saves and saved views all commit through `api/edit.js`, so they
need the same `EDIT_PASSCODE` setup above.

### 3.5 Quick-capture browser extension

1. In your repo folder, `tools/quick-capture/` is the extension. Keep a copy
   somewhere permanent.
2. `chrome://extensions` (or `arc://`, `brave://`, `edge://`), turn on
   **Developer mode**, **Load unpacked**, pick the folder. Pin it.
3. Make a fine-grained GitHub token: only `<repo>`, Contents read and write.
4. Click the icon, it opens on settings. Paste the token, set **Owner** to
   `<github-user>` and **Repo** to `<repo>`, **Test connection**, **Save**.

Shortcut: ⌘⇧Y on Mac, Alt+Shift+S elsewhere, or right-click any page, link, image
or selection. Each capture lands in `inbox/` as `status: unsorted`; Claude files
them at the start of every thread or when you say "sort my inbox".

### 3.6 AI-context files and the MCP server

These come for free once the site is deployed:

- `TASTE.md`: your taste profile for other AIs. Claude curates the top part as you
  save visual references, libraries and games; the evidence block is generated.
- `catalog/`: notes grouped by `kind` (libraries, style refs, tools, techniques,
  ideas, projects), plus `kit.md`: an asset library for your own work (LUTs, sound,
  VFX, motion, shoot, edit, 3D, 2D) from the optional `kit` field. Rename the areas in
  `KIT` (`scripts/build_index.py` and its mirrors) to fit your craft.
- `IDEAS.md`: your ideas and to-dos by stage (`new`, `exploring`, `doing`, `done`,
  `dropped`).
- `llms.txt`, `llms-full.txt`: the whole brain in plain text for any chat.
- **MCP server** at `https://<site-domain>/mcp`: read-only, no auth, tools
  `get_taste_profile`, `search`, `fetch`, `list_notes`, `get_catalog`,
  `recall_ideas`, `get_checks`. Add it as a custom connector in Claude (or any MCP client:
  Cursor, Claude Code, etc.) and every AI you use can pull your taste and notes.
- The MCP outputs are kept **lean** so a chat doesn't burn its context on your
  brain: `get_taste_profile` returns only the curated part of `TASTE.md` (pass
  `evidence` for the generated block), `get_catalog` and the lists are one short
  line per note (`detail: "full"` for more), and `fetch` returns one full note. Keep
  the curated part of `TASTE.md` short, since every agent reads it first.

**The links you give other AIs** (all served by the same Vercel site):

| What | Link |
|---|---|
| MCP server, add as a custom connector | `https://<site-domain>/mcp` |
| How to use the brain (agents read this first) | `https://<site-domain>/AGENTS.md` |
| Index in llmstxt.org format | `https://<site-domain>/llms.txt` |
| Every note in one file | `https://<site-domain>/llms-full.txt` |
| Taste profile, ideas | `https://<site-domain>/TASTE.md`, `/IDEAS.md` |
| Everything as JSON | `https://<site-domain>/data/brain.json` |

For a chat that can't add connectors, paste the `llms.txt` or `AGENTS.md` link.

Claude Code example:

```sh
claude mcp add --transport http my-brain https://<site-domain>/mcp
```

`ME.md` is for you, not for agents: Claude refreshes the personality read and
insights every 15 to 20 new notes (or when you ask). It renders with charts at
`https://<site-domain>/me.html`.

### 3.7 Daily ideas routine

1. In the Claude project, ask: *"Set up a scheduled task that runs every morning
   at 9 AM `<tz>`, follows `suggestions/README.md`, and sends me the ideas as a
   push notification."* (Claude creates it as a scheduled task / routine.)
2. Each run reads `TASTE.md`, `IDEAS.md`, `catalog/` and recent notes, writes
   `suggestions/YYYY-MM-DD.md` with 1 to 3 build ideas (each citing 2 or 3 of your
   notes and a first step), never repeats one, and pushes.
3. Say "I like idea 2" and Claude files it as a `kind: idea` note and marks it
   `picked`.
4. To change what it suggests, edit `suggestions/README.md` (the step list there is
   the routine's prompt). Make it about what *you* build: games, essays, videos,
   business ideas, recipes.

Step 6 of `suggestions/README.md` also resurfaces one unread save at least 5 days
old as a "From your pile" line, and never repeats one. The morning `suggest:` commit
doubles as the daily deploy flush (3.4).

Tip: if notifications don't buzz your phone, check notification permissions for
the Claude app on your phone.

### 3.8 Link Doctor and the weekly link check

Every note lists 2 or 3 related notes under `## Notes` as `- [[slug]]: reason`.
`scripts/link_doctor.py` keeps those links healthy:

- It scores every pair of notes from 0 to 1 (shared tags weighted by rarity, text
  similarity, kinds that pair well, one note naming the other, same topic or site)
  and writes `LINKS.md`: a health score, broken links, one-way links, orphans, weak
  links, proposed new links, tag merges and possible duplicates.
- `python3 scripts/link_doctor.py --fix` applies only lossless fixes: it rewrites old
  or partial links to the current slug and adds a backlink for strong one-way links.
  Claude runs it on every filing; the build runs it report-only.
- Anything else (adding a link between two unlinked notes, removing one, merging
  tags) is only a **proposal**. Answer them on the site: **LINK DOCTOR** (bottom left,
  key D) has LINK / NO and UNLINK / KEEP buttons, one commit each. Or tell Claude
  "apply links 1, 3". Pairs you say no to go in `links/dismissed.json` and are never
  proposed again.

Set up the weekly check by asking Claude in your project: *"Set up a weekly
scheduled task, Sundays around 9:45 AM `<tz>`, that follows links/README.md."* It
runs the fixes, rewrites machine-written link reasons into plain words, dismisses
obvious junk proposals, commits `links: weekly check` and pings you with the health
score and the best proposal. Edit `links/README.md` to change what it does.

**Weekly health report (same run).** Step 6 of `links/README.md` runs
`scripts/health_report.py`, so the Sunday ping also says: link health, notes added,
deploys vs the batch rule (estimated from git, or the real count if the task has the
Vercel connector), MCP token cost for a typical agent chat (`scripts/mcp_cost.mjs` runs
the real server offline), and each computer's last good vault sync, failures and last
backup. It lists anything that needs a look and keeps `health/history.jsonl` so it can
spot growth week over week. Thresholds sit at the top of the script. Fold it into the
link check rather than adding a second notification.

### 3.9 Project vault and "log this to my brain" (optional)

For your own projects, the working docs (context, to-dos, logs) live in a normal
folder on your computer, and the brain gets one entry per project. Full details are
in [`tools/vault-sync/README.md`](tools/vault-sync/README.md); the short version:

```
Documents/Vault/
  <Project Name>/
    project.md   the project's card in the brain (kind: project, share: full|summary|none)
    context.md   stack, conventions, decisions (for AI tools)
    todo.md      open tasks
    log.md       dated status, learnings, mistakes (log-to-brain writes here)
    playtests.md games: one entry per build played (log-to-brain, playtest mode)
    checks.md    repeat mistakes turned into checks (mistakes-to-checks writes here)
    notes/       anything else
    _private/    never leaves the computer
```

1. In your copy, change `REPO_URL` near the top of `tools/vault-sync/brain_sync.py`
   to your repo (the 5b first message does this for you).
2. Install on each computer. It needs git (signed in to GitHub) and Python 3.

   Mac:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/<github-user>/<repo>/main/tools/vault-sync/brain_sync.py -o ~/.brain_sync.py
   python3 ~/.brain_sync.py init
   python3 ~/.brain-sync/<repo>/tools/vault-sync/brain_sync.py schedule --time 21:30
   python3 ~/.brain-sync/<repo>/tools/vault-sync/brain_sync.py run
   ```
   If the log says "no permission", give the printed Python path Full Disk Access
   (System Settings > Privacy & Security).

   Windows (PowerShell):
   ```powershell
   iwr https://raw.githubusercontent.com/<github-user>/<repo>/main/tools/vault-sync/brain_sync.py -OutFile $HOME\.brain_sync.py
   python $HOME\.brain_sync.py init
   python $HOME\.brain-sync\<repo>\tools\vault-sync\brain_sync.py schedule --time 22:00
   python $HOME\.brain-sync\<repo>\tools\vault-sync\brain_sync.py run
   ```
   Use different times on different machines (e.g. Mac 9:30 PM, PC 10 PM) so they
   don't race. `brain_sync.py new "Project Name"` makes a project folder with the
   standard files; `status` shows what the next run would do.
3. Each run syncs both ways with `projects/<slug>/`, merges `log.md` entries from both
   computers, archives deletions instead of losing them, skips secrets and
   `_private/`, and pushes one `sync:` commit to `main`.
4. In the brain, each project is **one** entry (`project.md`); its other files show
   as "Vault docs" under it on the graph, in `catalog/projects.md` and through the MCP
   server, never as separate notes. If a project already has a note in `topics/`, set
   `note: <slug>` in `project.md` so the docs attach to it instead of making a copy.
5. **If your repo is public**, set `share: summary` (only `project.md` goes up) or
   `none` for anything confidential.

**Offline search and backups (comes with the sync).** After the first run, do
`brain_sync.py shortcut` on each computer: it adds a `brain` command that searches every
note and your local vault with no internet (`brain pixel art`, `brain shader
kind:technique`, `brain -n 2` to read a result). Each run also writes
`projects/.sync/<machine>.health.json` for the weekly health report (pushed at most every
2 days when nothing else changed, never deploys), and once a week a full git bundle to
`Documents/Vault/.backups/` (newest 6 kept). Restore with
`git clone <file>.bundle <repo>`. On a phone, open `<site-domain>/search.html` once and
add it to the home screen: the site's service worker keeps an offline copy.

**The log-to-brain skill.** `tools/vault-sync/log-to-brain/SKILL.md` is a Claude
skill. Add it to Claude as a skill (zip the `log-to-brain` folder and upload it in
Claude's skills settings) and say "log this to my brain" at the end of any work session. It finds the
project first (vault folder, then `projects/`, then an existing note) so it never
makes a duplicate, then appends a dated entry with status, learnings, mistakes and
taste to that project's `log.md`. Without file access it writes
`projects/<slug>/log.md` through GitHub and the next sync brings it down into the
vault. Inside the brain project itself, "log this" means the same thing: a project
log entry, not a new note.

**Playtests (if you make games).** "Log this playtest" (or "playtest notes", "log build
v0.4") makes the same skill write one entry to the game's `playtests.md` instead: build,
who played, what worked, what broke, how it felt, and a `Fix next` checklist. The newest
entry's open fixes become the game's next steps on the Board's PROJECTS tab, with a
playtest count. From other chats the MCP tool `log_playtest` does it (3.11).

**Next steps on the Board.** Each project card on the PROJECTS board shows what's next:
open `- [ ]` items in its vault `todo.md`, else the newest playtest's fixes, else the
newest log entry's "Next", else a `## Next` list in the note. A build idea you want to
track can become `kind: project` with `state: concept` and a `## Next` list; it then
sits in the CONCEPT column and still shows in `IDEAS.md`.

### 3.10 Mistakes to checks (optional)

When an AI keeps making the same mistake, adding another line to its rules file rarely
sticks. This turns each repeat into a **check** instead: the strongest fix that stops
it, from a fix ladder (make it impossible with a type or config, catch it with a lint
or CI check, make the agent prove it with a test, and only then a written rule).

- `tools/mistakes-to-checks/SKILL.md` is a Claude skill. Add it like log-to-brain.
  When you say "you did that again" or "turn my mistakes into checks", it looks up the
  mistake in the project's `log.md`, and on the second sighting adds a check: a row in
  the project's vault `checks.md` (or in `CHECKS.md` for checks every agent needs),
  plus the actual lint rule or test when it's working in the code.
- Review mode ("turn my mistakes into checks" for a whole project) reads the log's
  "Mistakes and fixes", reverts and fix commits, groups repeats, and shows a table and
  diffs. Nothing changes until you say yes.
- Agents load the checks before working: the MCP tool `get_checks` (with a project
  slug) or the files. `AGENTS.md` tells them to.
- The brain checks itself too: `scripts/check_notes.py` enforces the filing rules
  (short titles, required fields, tags, slugs, `## Raw`), and the filing steps run it
  before each commit. Start your copy's `CHECKS.md` with only its intro and empty
  tables; rows come from your own mistakes.

### 3.11 Capture from any chat (optional)

Save things into the brain from **any** Claude chat (another project, a plain chat, your
phone), not only the brain project: "save this to my brain", "add this link to my brain".

1. **Turn on writing in the MCP server.** In Vercel, add `CAPTURE_KEY` (Production, any
   random 16+ characters, e.g. `python3 -c "import secrets;print(secrets.token_urlsafe(24))"`).
   It needs `GITHUB_TOKEN` from site editing (3.4). Redeploy.
2. **Use the keyed URL as your connector.** In Claude, Settings > Connectors, edit your
   brain connector (or add one) with `https://<site-domain>/mcp?key=<CAPTURE_KEY>`. The
   tools `capture`, `update_note`, `log_project` and `log_playtest` appear next to the read tools. Keep
   the plain `/mcp` URL for anything you share: without the key it's read-only. Treat the
   keyed URL like a password.
3. **Add the skill.** Zip `tools/capture-to-brain/` and upload it in Claude's skills
   settings (like log-to-brain). It routes project work to log-to-brain and everything
   else to a note, reads X/Instagram links with Social Reader, searches before it files
   so nothing is saved twice, and fills the fields the same way the brain project does.

The server checks every note before committing it (short title, tags, required
fields), refuses a link that's already saved (also ones not deployed yet), and only
ever adds: no deletes, one commit each, so anything wrong is one `git revert`.
Notes it files carry `captured: ... via brain MCP`, and the brain project's filing
steps check for an existing note first, so dumping the same link in both places
doesn't make a copy.

### 3.12 Phone and desktop capture (optional)

The same `CAPTURE_KEY` also unlocks `https://<site-domain>/api/capture`, a plain POST
endpoint that Apple Shortcuts and shell scripts can call (MCP needs a real client). It
drops each capture into `inbox/` like the browser extension; a link that's already
saved gets your note appended instead of a copy. `tools/device-capture/README.md` has
copy-paste setup for:

- **iPhone:** a *Save to Brain* Share Sheet shortcut (links, text, screenshots) and a
  *Brain voice note* shortcut for the Action Button (dictate, transcribe, save). Built
  in the free Shortcuts app; no developer account.
- **Mac:** `install.sh` plus two Shortcuts-app hotkeys (clipboard, screenshot).
- **Windows:** `install.ps1` makes Ctrl+Alt+B / Ctrl+Alt+Shift+B hotkeys and a tray icon.

Replace `brainy.pxlvzn.in` and `YuvrajxGarg/second-brain` in that folder with your own
site and repo. The key lives only on your devices (inside the shortcut, or a file in
your home folder).

---

## 4. The conventions (what makes it stay tidy)

All of this is in `CLAUDE.md`, so Claude follows it automatically. Summary:

**One item, one file.** `topics/<topic>/<slug>.md`, slug is 3 to 6
kebab-case words from the title, **name first, no date** (`godot-waterfall-shader.md`;
the date lives in `added:`). Images and video frames sit next to the note with the
same name and are described in words so they're searchable.

**Frontmatter:**

```yaml
---
title: Godot waterfall shader     # 2-4 words: name + what it is. No colons or subtitles.
type: link                        # link, note, idea, bookmark, quote, video, tool, book,
                                  # person, place, recipe, todo; own work: game, app, tool,
                                  # site, concept; companies: company
topic: gamedev                    # one folder
tags: [shader, godot, to-try]     # 3-6, lowercase, kebab-case, singular, reuse existing
kind: technique                   # what it's useful as (drives catalog/)
why: looks great for my platformer   # YOUR reason, in your words when you gave one
style: [pixel water, soft glow]   # visual things only: what to take from it
stage: new                        # ideas and to-dos only
source: https://...
added: 2026-11-16
status: unread                    # unread | read | done | archived
---

## Summary
One to three sentences in plain words.

## Raw
Exactly what you sent. Never lost to summarising.

## Notes
- [[sprite-stacking-pixel-art]]: same pixel-art-in-3D look
```

Every note links 2 or 3 notes it really relates to, one per line with a short
reason, using the exact slug. Link Doctor's "Might relate" list is a good place to
look; skip ones that only share a generic tag.

**`kind` values:** `style-ref`, `website-ref`, `game-ref`, `library`,
`asset-source`, `tool`, `technique`, `advice`, `idea`, `thought`, `todo`,
`project` (something you built), `org` (a company you work in). Projects also get
`state`, `stack` and `repo`. Add or drop kinds to fit you, but keep `CATALOGS` in
`scripts/build_index.py`, `KINDS` in `api/mcp.js` and the table in `AGENTS.md` in
sync.

**Rules that matter most** (each one came from a real mistake):

- **Short titles.** 2 to 4 words, name plus what it is. Long titles get cut off on
  the graph.
- **Tag what it actually is**, not words in its name or URL. A game called
  "MyCountryX" is a game, not a geography note.
- **If Claude can't read something** and the type isn't obvious, it asks you in
  one line and parks it in `inbox/` meanwhile, instead of guessing.
- **Fewer accurate tags** beat six padded ones. Reuse tags from `TAGS.md`.
- **Topics:** start with the 10 defaults, add your own (e.g. `gamedev`, `cooking`)
  only when 3+ notes share a theme nothing fits.
- **Your `why` is sacred.** Your own comment is the strongest taste signal; never
  drop or paraphrase it away.
- **Auto-merge.** Every change goes straight to `main`. No branches, no PRs, no
  confirmation. One commit per dump (or per batch); the site deploys in batches
  (3.4).
- **"Log this" is a project log**, not a dump: it goes into the project's
  `log.md`, never a new note (3.9).
- **Never edit generated files by hand**; run `python3 scripts/build_index.py`.

**Finding things:** ask Claude "what was that thing about X". It greps `topics/`,
checks `TAGS.md` and `INDEX.md`, and answers with title, summary, link and path.

**Chat habits that work well:**

- One thread per day for dumps ("Capture everything for Nov 16"), so the chat stays
  findable. Start a new one each day.
- Claude reacts 👀 when it gets a dump and ✅ when it's filed, and only writes
  replies for questions. Less noise.

---

## 5. Ready-to-paste text

### 5a. Project instructions (paste into the Claude project settings)

```text
This project is <you>'s second brain, stored in the GitHub repo <github-user>/<repo>.
Follow CLAUDE.md in that repo for every filing, search and edit.

- Anything I send without another ask (link, note, idea, quote, screenshot, video,
  tool, person) is a dump: file it per CLAUDE.md, rebuild the index, commit and push
  straight to main. No PRs, no asking first.
- At the start of every thread, git pull and file any inbox/ captures marked
  status: unsorted.
- Whenever I send an Instagram reel/post link or an X/Twitter post or thread link,
  always read it with the social link reader connector (full post, thread and video
  frames) before filing. Only ask me for a screenshot if the connector fails.
- If you can't read something and can't tell what it is, ask me in one line; don't
  guess from the name.
- For dumps, react 👀 when you get it and ✅ when it's filed. Only write replies when
  I ask a question.
- When I ask "what was that thing about X", search the brain and answer with title,
  summary, link and file path.
- When I say "log this" at the end of a work session, it's a project log: add a
  dated entry to that project's log.md (see the log-to-brain skill), not a new note.
- When I say "deploy now", push an empty commit with [deploy] in the message.
```

### 5b. First message to Claude (does the one-time setup)

Send this in the first thread of the project:

```text
This repo is a copy of someone else's second-brain engine with their notes removed.
Make it mine. My name is <you>, my GitHub repo is <github-user>/<repo>, my site is (or
will be) at https://<site-domain>, and my time zone is <tz>.

0. If the old notes are still here (topics/*/ files other than .gitkeep, inbox/
   captures, catalog/, projects/, canvases/*.canvas, views/*.json, LINKS.md,
   suggestions/YYYY-MM-DD.md day files, site/look.json), delete them, and reset
   links/dismissed.json to { "pairs": {} }. Keep the empty topic folders with a
   .gitkeep in each.
1. Replace the previous owner's name, repo, site URL and company/personal details
   everywhere: CLAUDE.md, README.md, AGENTS.md, HANDOFF.md links, scripts/build_index.py
   (SITE, RAW and the description strings), scripts/build_graph.mjs, api/mcp.js
   (SITE, tool descriptions, serverInfo), api/edit.js (default GITHUB_REPO and
   comments), site/*.html, site/views.js, site/me.html, tools/quick-capture/lib.js
   (DEFAULTS), tools/device-capture/ (site and repo in the scripts and README), tools/vault-sync/brain_sync.py (REPO_URL and the compare link),
   tools/vault-sync/README.md, tools/vault-sync/log-to-brain/SKILL.md,
   suggestions/README.md and links/README.md.
   grep for the old name and domain afterwards to make sure nothing is left.
2. Reset TASTE.md and ME.md: keep the intro and the GENERATED:START / GENERATED:END
   markers, replace the curated part above the marker with short empty sections
   ("Who I am", "Visual taste", "Stack", ...) and a "Last curated" line for today.
   Do the same for the "Who he is" style text in AGENTS.md: describe me only with what
   I tell you below, nothing invented.
3. In CLAUDE.md, remove dated rules that only applied to the previous owner (named
   private projects, their connectors' names, their memory notes) but keep every
   general rule (short titles, name-first slugs, accuracy first, AI-readable fields,
   links between notes, auto-merge, batched deploys, inbox, graph site and views,
   daily ideas, project vault). Change the starter topics if I list different ones.
4. Run python3 scripts/link_doctor.py, python3 scripts/build_index.py and
   node scripts/build_graph.mjs to check they
   work on an empty brain, then commit "setup: make it mine" and push to main.
5. Then interview me in 5 short questions (what I do, what I want to save, what I
   build or make, what looks I like, which tools I use) and write the first notes
   and the curated part of TASTE.md and ME.md from my answers.

About me: <one paragraph about yourself>
```

---

## 6. Checklist

- [ ] Repo created from the engine and pushed to `main` (3.1)
- [ ] Claude project with the repo, project instructions pasted (3.2, 5a)
- [ ] First message sent; Claude made the repo yours (5b)
- [ ] Social Reader deployed on Vercel and added as a connector (3.3)
- [ ] Vercel project deployed; custom domain if you want one (3.4)
- [ ] Optional: `EDIT_PASSCODE`, `GITHUB_TOKEN`, `GITHUB_REPO` set for site editing
- [ ] Quick-capture extension loaded with your token, owner and repo (3.5)
- [ ] MCP server added to your other AI tools (3.6)
- [ ] Daily ideas scheduled task created (3.7)
- [ ] Weekly link check scheduled task created (3.8)
- [ ] Optional: vault sync installed on each computer, log-to-brain skill added (3.9)
- [ ] Optional: `CAPTURE_KEY` set, keyed connector URL, capture-to-brain skill added (3.11)
- [ ] Optional: iPhone shortcuts, Mac and Windows hotkeys set up (3.12)
- [ ] First dump filed (on the graph after the next batch or the next morning)

## 7. Troubleshooting

- **Claude can't push:** connect GitHub in Claude and make sure the Claude GitHub
  app is installed on the repo.
- **Push rejected:** someone (the site editor or the extension) committed first.
  `git pull --rebase` then push.
- **Site didn't update:** probably on purpose. Note-only pushes wait until 5 notes
  are pending or the next morning's ideas run (the Vercel deploy shows "skip: N of 5
  notes pending"). Say "deploy now" to force it. Branches other than `main` never
  deploy.
- **Vault sync did nothing:** read `~/.brain-sync/sync.log`. On a Mac, "no permission"
  means the scheduled Python needs Full Disk Access. A `name.conflict-<machine>-<date>.md`
  file means the same doc changed on both sides: merge it and delete the copy.
- **A connector isn't available in a thread:** connectors attach when a thread
  starts. Start a new thread after adding or reconnecting one.
- **Social Reader returns 404:** the token at the end of the connector URL doesn't
  match `MCP_TOKEN` in Vercel. **Connector won't add:** make sure the URL ends in
  `/mcp/<token>`.
- **No `capture` tool in a chat:** the connector URL is missing `?key=`, the key doesn't
  match `CAPTURE_KEY`, or the deploy after adding it hasn't run. Connectors attach when a
  chat starts, so open a new chat after changing it.
- **Extension says 401/403:** the token expired or lacks Contents read/write on
  this repo.
- **Build fails on Vercel:** run `python3 scripts/build_index.py && node
  scripts/build_graph.mjs` locally; the error is usually a broken frontmatter line
  in a note.
