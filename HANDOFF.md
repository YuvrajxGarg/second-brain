# Build your own second brain (hand-off guide)

This is a recipe for copying the system behind this repo so you can run your own
second brain with Claude. It covers what the system is, how the pieces fit, and how
to set each piece up. You get the **engine** (rules, scripts, graph site, capture
extension, MCP server, daily ideas routine), not anyone's notes.

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

**G. Morning ideas (optional, 2 min)**

21. In your Claude project, send: *"Set up a scheduled task that runs every
    morning at 9 AM my time, follows suggestions/README.md, and sends me the
    ideas as a notification."*

**That's it.** From now on, just paste anything into your Claude project: links,
thoughts, reels, screenshots. Claude files it, and it shows up on your graph a
minute later. Ask "what was that thing about X" to find it again.

The rest of this guide explains the same steps in more detail, for when you're
curious how it works or something breaks.

---

## 1. What it is

You dump anything in a chat with Claude: links, thoughts, ideas, quotes, tools,
screenshots, Instagram reels, X threads. Claude reads it (fetching links and social
posts), then files each item as **one small markdown file** in a GitHub repo,
grouped by topic, tagged, and summarised. Your exact words are always kept.

On top of the notes, the system builds:

- **A graph website**: an Obsidian-style map of every note, tag and topic, rebuilt
  on every push. You can also edit notes from it.
- **AI context files**: a taste profile, catalogs by kind, an ideas list and an
  MCP server, so any other AI (Claude, Cursor, ChatGPT...) can learn your taste,
  libraries and ideas instead of giving generic answers.
- **A self page** (`ME.md`): a personality read, stats and nudges built from what
  you save.
- **A browser extension** that saves a page, text, image or video in one click
  into an `inbox/` folder for Claude to sort later.
- **A daily ideas routine**: every morning Claude reads the brain and sends you 1
  to 3 things you could build, each combining notes you saved.

Why it works: saving costs nothing (just paste), every note is plain text in git
(greppable, portable, never locked in), and the AI does the boring part (titles,
tags, summaries, indexes).

---

## 2. Architecture

```
 you ──paste──▶ Claude project chat ──files──┐
 you ──click──▶ quick-capture extension ──commits──▶ inbox/ ──Claude sorts──┐
                                              ▼                              ▼
                              GitHub repo  topics/<topic>/YYYY-MM-DD-<slug>.md
                                              │
               python3 scripts/build_index.py │ (Claude runs it on every filing)
                                              ▼
     INDEX.md  TAGS.md  IDEAS.md  catalog/*.md  llms.txt  llms-full.txt
     TASTE.md + ME.md (generated blocks)
                                              │ push to main
                                              ▼
            Vercel build: build_index.py + scripts/build_graph.mjs
                                              ▼
     <site-domain>          graph site (site/), me.html
     <site-domain>/mcp      read-only MCP server (api/mcp.js)
     <site-domain>/api/edit passcode-locked edit API (api/edit.js)
     <site-domain>/llms.txt, /TASTE.md, /IDEAS.md, /data/brain.json

 scheduled Claude task (every morning) ──reads brain──▶ suggestions/YYYY-MM-DD.md + phone ping
```

### Repo layout

```
CLAUDE.md          the rules Claude follows (the heart of the system)
README.md          short human overview
AGENTS.md          entry point for other AIs: what to read, the fields, how to connect
TASTE.md           taste profile: curated top part + generated evidence block
ME.md              your own page: curated read + generated stats
IDEAS.md           generated: your ideas and to-dos by stage
catalog/           generated: notes grouped by kind (libraries, style-refs, tools...)
llms.txt           generated: llmstxt.org index for AI tools
llms-full.txt      generated: every note in one file
INDEX.md           generated: every note by topic, newest first
TAGS.md            generated: every tag with its notes
inbox/             unsorted captures from the extension
topics/<topic>/    one folder per topic, one file per note
templates/entry.md the frontmatter template
scripts/build_index.py   regenerates everything marked "generated" above
scripts/build_graph.mjs  builds site/data/graph.json + brain.json for the site and MCP
site/              the static graph website (canvas + vendored d3, marked, DOMPurify)
api/mcp.js         MCP server (Vercel function, no dependencies)
api/edit.js        edit API for the site (Vercel function)
tools/quick-capture/     the browser extension
tools/social-reader/     the Instagram/X link reader (MCP connector, deploys on its own)
suggestions/       daily build ideas, one file per day, plus the routine's README
vercel.json        build command, MCP rewrite, production-only deploys
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
rm -rf .git topics inbox catalog site/look.json
rm -f suggestions/2*.md
for t in ai tech business design productivity health finance learning life misc; do
  mkdir -p topics/$t && touch topics/$t/.gitkeep
done
mkdir inbox && touch inbox/.gitkeep
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
   don't get eaten by branches, and the `ignoreCommand` skips deploys for commits
   that only touch `suggestions/`. Keep both.

Every push to `main` now rebuilds the site with the new notes. Nothing to do when
filing.

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
  ideas, projects).
- `IDEAS.md`: your ideas and to-dos by stage (`new`, `exploring`, `doing`, `done`,
  `dropped`).
- `llms.txt`, `llms-full.txt`: the whole brain in plain text for any chat.
- **MCP server** at `https://<site-domain>/mcp`: read-only, no auth, tools
  `get_taste_profile`, `search`, `fetch`, `list_notes`, `get_catalog`,
  `recall_ideas`. Add it as a custom connector in Claude (or any MCP client:
  Cursor, Claude Code, etc.) and every AI you use can pull your taste and notes.

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

Tip: if notifications don't buzz your phone, check notification permissions for
the Claude app on your phone.

---

## 4. The conventions (what makes it stay tidy)

All of this is in `CLAUDE.md`, so Claude follows it automatically. Summary:

**One item, one file.** `topics/<topic>/YYYY-MM-DD-<slug>.md`, slug is 3 to 6
kebab-case words. Images and video frames sit next to the note with the same name
and are described in words so they're searchable.

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
Follow-ups, related notes as [[slug]] links.
```

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
  confirmation. Batch filings into one push where possible.
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
```

### 5b. First message to Claude (does the one-time setup)

Send this in the first thread of the project:

```text
This repo is a copy of someone else's second-brain engine with their notes removed.
Make it mine. My name is <you>, my GitHub repo is <github-user>/<repo>, my site is (or
will be) at https://<site-domain>, and my time zone is <tz>.

0. If the old notes are still here (topics/*/ files other than .gitkeep, inbox/
   captures, catalog/, suggestions/YYYY-MM-DD.md day files, site/look.json),
   delete them. Keep the empty topic folders with a .gitkeep in each.
1. Replace the previous owner's name, repo, site URL and company/personal details
   everywhere: CLAUDE.md, README.md, AGENTS.md, HANDOFF.md links, scripts/build_index.py
   (SITE, RAW and the description strings), scripts/build_graph.mjs, api/mcp.js
   (SITE, tool descriptions, serverInfo), api/edit.js (default GITHUB_REPO and
   comments), site/index.html, site/me.html, tools/quick-capture/lib.js (DEFAULTS).
   grep for the old name and domain afterwards to make sure nothing is left.
2. Reset TASTE.md and ME.md: keep the intro and the GENERATED:START / GENERATED:END
   markers, replace the curated part above the marker with short empty sections
   ("Who I am", "Visual taste", "Stack", ...) and a "Last curated" line for today.
   Do the same for the "Who he is" style text in AGENTS.md: describe me only with what
   I tell you below, nothing invented.
3. In CLAUDE.md, remove dated rules that only applied to the previous owner (named
   private projects, their connectors' names, their memory notes) but keep every
   general rule (short titles, accuracy first, AI-readable fields, auto-merge,
   inbox, graph site, daily ideas). Change the starter topics if I list different ones.
4. Run python3 scripts/build_index.py and node scripts/build_graph.mjs to check they
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
- [ ] First dump filed and visible on the graph

## 7. Troubleshooting

- **Claude can't push:** connect GitHub in Claude and make sure the Claude GitHub
  app is installed on the repo.
- **Push rejected:** someone (the site editor or the extension) committed first.
  `git pull --rebase` then push.
- **Site didn't update:** check the Vercel deploy log. Commits that only touch
  `suggestions/` are skipped on purpose; branches other than `main` never deploy.
- **A connector isn't available in a thread:** connectors attach when a thread
  starts. Start a new thread after adding or reconnecting one.
- **Social Reader returns 404:** the token at the end of the connector URL doesn't
  match `MCP_TOKEN` in Vercel. **Connector won't add:** make sure the URL ends in
  `/mcp/<token>`.
- **Extension says 401/403:** the token expired or lacks Contents read/write on
  this repo.
- **Build fails on Vercel:** run `python3 scripts/build_index.py && node
  scripts/build_graph.mjs` locally; the error is usually a broken frontmatter line
  in a note.
