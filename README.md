# Second Brain

A plain-markdown second brain. Anything worth remembering (links, notes, ideas,
bookmarks, quotes, tools, books) gets dumped in chat, and Claude files it here as
one small markdown file, grouped by topic and tagged so it can be found again.

- **Browse:** [INDEX.md](INDEX.md) by topic, [TAGS.md](TAGS.md) by tag.
- **Rules:** [CLAUDE.md](CLAUDE.md) explains how entries are filed, tagged and searched.
- **Quick capture:** [tools/quick-capture](tools/quick-capture/) is a browser
  extension that saves links, notes, images and videos to `inbox/` in one click.
- **Graph:** [brainy.pxlvzn.in](https://brainy.pxlvzn.in). [site/](site/) is an Obsidian-style graph of every note, tag and topic,
  deployed on Vercel. It rebuilds itself from the markdown on every push to `main`.
- **Entries:** `topics/<topic>/YYYY-MM-DD-<slug>.md`, each with YAML frontmatter
  (`title`, `type`, `topic`, `tags`, `source`, `added`).

Rebuild the index after adding entries:

```sh
python3 scripts/build_index.py
```

Preview the graph locally:

```sh
node scripts/build_graph.mjs && python3 -m http.server -d site 8000
```
