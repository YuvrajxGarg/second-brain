# Second Brain Quick Capture

A browser extension for Chrome, Arc, Brave, Edge or any Chromium browser. Click the
icon (or press **⌘⇧Y** on Mac, **Alt+Shift+S** elsewhere) and a small window pops up
where you can save:

- **a link** (the current page is filled in for you),
- **text** (a note, a quote, why you're saving it),
- **images and videos** (drop them in, pick them, or paste a screenshot with ⌘V; 25 MB max each).

Press **Save** (or ⌘↵). It's committed straight to `inbox/` in this repo, and Claude
files it into the right topic with tags the next time it runs.

You can also **right-click** anything on a page: *Save page / link / image / selection
to Second Brain*. The icon shows ✓ when it's saved.

## Install (2 minutes)

1. Download this folder: on GitHub, **Code → Download ZIP**, unzip, and keep
   `tools/quick-capture/` somewhere permanent (e.g. `~/Apps/quick-capture`).
2. Open `chrome://extensions` (Arc: `arc://extensions`), turn on **Developer mode**
   (top right), click **Load unpacked** and pick the `quick-capture` folder.
3. Pin the extension (puzzle-piece icon → pin).
4. Make a GitHub token: [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
   - Repository access: **Only select repositories → second-brain**
   - Permissions → Repository → **Contents: Read and write**
   - Pick a long expiry (or none).
5. Click the extension icon; it opens on settings the first time. Paste the token,
   click **Test connection**, then **Save settings**.

To change the keyboard shortcut, go to `chrome://extensions/shortcuts`.

## How a capture is stored

One commit per capture, e.g.

```
inbox/2026-11-09-183015-cool-shader-idea.md
inbox/2026-11-09-183015-cool-shader-idea.png
```

The markdown file uses the normal entry format with `topic: inbox`,
`status: unsorted` and a `captured:` line, and keeps everything you typed under
`## Raw`. Claude moves it to `topics/<topic>/` and writes the summary and tags.

## Notes

- The repo is public, so anything you capture is public too.
- The token lives only in the extension's local storage on your computer.
- Videos over 25 MB are refused: upload them somewhere (YouTube, Drive) and save the link.
