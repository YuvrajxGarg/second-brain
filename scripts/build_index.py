#!/usr/bin/env python3
"""Regenerate every generated file from entry frontmatter. No dependencies.

Writes:
  INDEX.md            every entry by topic
  TAGS.md             every tag with its entries
  catalog/*.md        entries grouped by `kind` (libraries, style refs, tools...)
  catalog/kit.md      the asset library: notes with a `kit` field, grouped by area
  IDEAS.md            his ideas and to-dos by stage (new/exploring/doing/done/dropped)
  ME.md               only the GENERATED block (stats); the personality read and
                      insights above it are curated by hand (by Claude)
  TASTE.md            only the block between the GENERATED markers; the curated
                      profile above it is written by hand (by Claude) and kept
  llms.txt            entry point for AI tools (llmstxt.org format)
  llms-full.txt       the whole brain in one file, for pasting into any chat
  LINKS.md            link health report, via scripts/link_doctor.py (report only)
"""
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIRS = [ROOT / "topics", ROOT / "inbox"]
PROJECTS = ROOT / "projects"  # synced from his Documents/Vault by tools/vault-sync
SITE = "https://brainy.pxlvzn.in"
RAW = "https://raw.githubusercontent.com/YuvrajxGarg/second-brain/main"
GEN_START = "<!-- GENERATED:START (scripts/build_index.py rewrites this block) -->"
GEN_END = "<!-- GENERATED:END -->"

# kind -> (catalog file, heading). Order matters: it is the catalog order.
CATALOGS = {
    "libraries": ("Libraries, design systems and asset sources",
                  "Code, components and assets Yuvraj wants to build with. Reach for these first.",
                  ["library", "asset-source"]),
    "style-refs": ("Style references",
                   "Visual, website and game references that show Yuvraj's taste. `style` lists what to take from each.",
                   ["style-ref", "website-ref", "game-ref"]),
    "tools": ("Tools and apps", "Apps and services he has saved to use or benchmark against.", ["tool"]),
    "techniques": ("Techniques and advice", "Workflows, how-tos and tips he wants to reuse.", ["technique", "advice"]),
    "ideas": ("Ideas, thoughts and to-dos", "His own ideas, thoughts and open to-dos.", ["idea", "thought", "todo"]),
    "projects": ("His projects and companies",
                 "Things Yuvraj has built himself (games, apps, tools, sites) and the companies he works in. "
                 "Use them as context: his real stack, his shipped looks, and what already exists before suggesting something new.",
                 ["org", "project"]),
}
KINDS = [k for _, _, ks in CATALOGS.values() for k in ks]
# `kit`: where a note goes in his shoot / edit / game-build kit (catalog/kit.md, the
# Asset library view on the site). A note can sit in more than one area.
KIT = {
    "grade": "Colour: LUTs, grading and colour matching",
    "sound": "Sound: SFX, music, stems and foley",
    "vfx": "VFX: effects, overlays, compositing, AI video and upscalers",
    "motion": "Motion: animation, mocap, retargeting and motion-design refs",
    "shoot": "Shoot: camera, lenses, lighting, DIT and card offloads",
    "edit": "Edit: editing workflows and footage tools",
    "3d": "3D: models, shaders, rigs and 3D asset sources",
    "2d": "2D: sprites, pixel art, textures and 2D game art",
}
STAGES = ["doing", "exploring", "new", "done", "dropped"]  # IDEAS.md order; open = first three


def as_list(v):
    return [t.strip().strip("'\"") for t in v.strip().strip("[]").split(",") if t.strip()]


def parse(path):
    text = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    m = re.match(r"^---\n(.*?)\n---\n?", text, re.S)
    meta = {}
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.split(" #")[0].strip().strip("'\"")
    body = text[m.end():] if m else text
    meta["tags"] = as_list(meta.get("tags", ""))
    meta["style"] = as_list(meta.get("style", ""))
    meta["stack"] = as_list(meta.get("stack", ""))
    meta["kit"] = as_list(meta.get("kit", ""))
    meta["title"] = meta.get("title") or path.stem
    meta.setdefault("added", "")
    meta["path"] = path.relative_to(ROOT).as_posix()
    meta["slug"] = path.stem
    meta["body"] = body.strip()
    sm = re.search(r"## Summary\n+(.*?)(\n\n|\n##|$)", body, re.S)
    meta["summary"] = sm.group(1).strip().replace("\n", " ") if sm else ""
    return meta


def load_projects(entries):
    """projects/<slug>/project.md is one entry; every other .md/.txt in that folder is a
    doc attached to it (not its own entry, so the brain doesn't flood). If project.md has
    `note: <slug>` pointing at an existing note, the docs attach to that note instead."""
    by_slug = {e["slug"]: e for e in entries}
    out = []
    for pm in sorted(PROJECTS.glob("*/project.md")) if PROJECTS.exists() else []:
        d = pm.parent
        e = parse(pm)
        e["slug"] = d.name
        e["topic"] = e.get("topic") or "tech"
        e.setdefault("kind", "project")
        docs = []
        for f in sorted(d.rglob("*")):
            parts = f.relative_to(d).parts
            if f.is_file() and f != pm and f.suffix.lower() in (".md", ".txt") and not any(x.startswith(".") for x in parts):
                body = f.read_text(encoding="utf-8", errors="replace").replace("\r\n", "\n").strip()
                docs.append({"path": f.relative_to(ROOT).as_posix(), "name": "/".join(parts), "body": body})
        target = by_slug.get(re.sub(r"^\d{4}-\d\d-\d\d-", "", e.get("note") or ""))
        if target:
            target["docs"] = target.get("docs", []) + docs
            target["vault"] = d.relative_to(ROOT).as_posix()
            continue
        e["docs"] = docs
        e["vault"] = d.relative_to(ROOT).as_posix()
        out.append(e)
    return out


def section(text, heading):
    m = re.search(rf"^#+ {heading}[ \t]*\n(.*?)(?=^#+ |\Z)", text, re.S | re.M)
    return m.group(1) if m else ""


def bullets(text):
    """Bullet items in a block, minus ticked checkboxes."""
    out = []
    for line in text.splitlines():
        m = re.match(r"\s*[-*] (\[([ xX])\] )?(.+)", line)
        if m and m.group(2) not in ("x", "X"):
            out.append(m.group(3).strip())
    return out


def latest_entry(text):
    """First '## ' entry of a newest-first log (log.md, playtests.md)."""
    parts = re.split(r"^## ", text, flags=re.M)
    return ("## " + parts[1]) if len(parts) > 1 else ""


def next_steps(e):
    """What's next for a project, first match wins: open items in the vault's todo.md,
    'Fix next' from the latest playtest, 'Next' from the latest log entry, then the
    note's own ## Next section. Same order as scripts/build_graph.mjs."""
    docs = {d["name"]: d["body"] for d in e.get("docs", [])}
    if docs.get("todo.md"):
        items = [m.group(1).strip() for m in re.finditer(r"^\s*[-*] \[ \] (.+)$", docs["todo.md"], re.M)]
        if items:
            return items
    for name, head in (("playtests.md", r"\*\*Fix next\*\*"), ("log.md", r"\*\*Next\*\*")):
        ent = latest_entry(docs.get(name, ""))
        m = re.search(head + r"[ \t]*\n(.*?)(?=\n\*\*|\n## |\Z)", ent, re.S)
        if m and bullets(m.group(1)):
            return bullets(m.group(1))
    return bullets(section(e["body"], "Next"))


def playtest_stats(e):
    docs = {d["name"]: d["body"] for d in e.get("docs", [])}
    text = docs.get("playtests.md", "")
    heads = re.findall(r"^## (\d{4}-\d\d-\d\d)(?: · ([^\n·]+))?", text, re.M)
    if not heads:
        return None
    return {"count": len(heads), "last": heads[0][0], "build": (heads[0][1] or "").strip()}


def group_of(e):
    if e["path"].startswith("inbox/"):
        return "inbox"
    if e["path"].startswith("projects/"):
        return e["topic"]
    return e["path"].split("/")[1]


def link(e):
    return f"[{e['title']}]({e['path']})"


def index_line(e):
    bits = [link(e)]
    if e.get("type"):
        bits.append(f"`{e['type']}`")
    if e["added"]:
        bits.append(e["added"])
    if e["tags"]:
        bits.append(" ".join(f"#{t}" for t in e["tags"]))
    return "- " + " · ".join(bits)


def catalog_entry(e, rel="../"):
    out = [f"### [{e['title']}]({rel}{e['path']})", ""]
    facts = [f"`{e.get('kind', '?')}`", e.get("topic") or e["path"].split("/")[1]]
    if e.get("state"):
        facts.append(f"**{e['state']}**")
    if e.get("source"):
        facts.append(f"<{e['source']}>")
    out.append(" · ".join(facts))
    out.append("")
    if e.get("why"):
        label = {'project': 'Made for', 'org': 'What it is'}.get(e.get('kind'), 'Why saved')
        out.append(f"- **{label}:** {e['why']}")
    if e.get("stack"):
        out.append(f"- **Stack:** {', '.join(e['stack'])}")
    if e.get("repo"):
        out.append(f"- **Repo:** {e['repo']}")
    if e["style"]:
        out.append(f"- **Style:** {', '.join(e['style'])}")
    if e["kit"]:
        out.append(f"- **Kit:** {', '.join(e['kit'])}")
    if e.get("kind") == "project":
        nx = next_steps(e)
        if nx:
            out.append(f"- **Next:** {'; '.join(nx[:3])}")
        pt = playtest_stats(e)
        if pt:
            out.append(f"- **Playtests:** {pt['count']}, last {pt['last']}" + (f" ({pt['build']})" if pt["build"] else ""))
    if e.get("docs"):
        out.append("- **Vault docs:** " + ", ".join(f"[{d['name']}]({rel}{d['path']})" for d in e["docs"]))
    if e["tags"]:
        out.append(f"- **Tags:** {' '.join('#' + t for t in e['tags'])}")
    if e["summary"]:
        out += ["", e["summary"]]
    return out + [""]


def write(path, lines):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def platform(e):
    src = e.get("source") or ""
    if not src:
        return "own words"
    if re.search(r"//(www\.)?(x|twitter)\.com", src):
        return "x"
    if "instagram.com" in src:
        return "instagram"
    if "github.com" in src:
        return "github"
    return "web"


def commented(e):
    """True when his ## Raw holds his own words, not just a link or a screenshot note."""
    m = re.search(r"## Raw\n(.*?)(\n## |$)", e["body"], re.S)
    if not m:
        return False
    for line in m.group(1).splitlines():
        line = re.sub(r"https?://\S+", "", line).strip()
        if line and not line.startswith("(") and len(line) > 2:
            return True
    return False


def streaks(days):
    from datetime import date, timedelta
    ds = sorted({date.fromisoformat(d) for d in days if re.match(r"\d{4}-\d\d-\d\d$", d)})
    if not ds:
        return 0, 0
    longest = run = 1
    for a, b in zip(ds, ds[1:]):
        run = run + 1 if b - a == timedelta(days=1) else 1
        longest = max(longest, run)
    cur = 1
    for a, b in zip(reversed(ds[:-1]), reversed(ds[1:])):
        if b - a != timedelta(days=1):
            break
        cur += 1
    return cur, longest


def bar(n, total, width=20):
    return "█" * max(1, round(width * n / max(total, 1))) if n else ""


def write_me(entries, by_topic, by_tag, by_kind, by_stage):
    path = ROOT / "ME.md"
    cur = path.read_text(encoding="utf-8") if path.exists() else "# Me\n\n"
    if GEN_START in cur:
        cur = cur[:cur.index(GEN_START)] + cur[cur.index(GEN_END) + len(GEN_END):].lstrip("\n")
    n = len(entries)
    per_day = Counter(e["added"] for e in entries if e["added"])
    cur_streak, long_streak = streaks(per_day)
    plats = Counter(platform(e) for e in entries)
    status = Counter(e.get("status") or "none" for e in entries)
    own = sum(1 for e in entries if commented(e))
    to_try = len(by_tag.get("to-try", []))
    g = [GEN_START, "", "## Stats (generated)", "",
         f"_Rebuilt on every filing from {n} notes._", "",
         "| | |", "|---|---|",
         f"| Notes saved | {n} |",
         f"| Active days | {len(per_day)} ({min(per_day) if per_day else '-'} to {max(per_day) if per_day else '-'}) |",
         f"| Average per active day | {n / max(len(per_day), 1):.1f} |",
         f"| Current streak | {cur_streak} day{'s' if cur_streak != 1 else ''} |",
         f"| Longest streak | {long_streak} day{'s' if long_streak != 1 else ''} |",
         f"| Notes with his own comment | {own} ({100 * own // max(n, 1)}%) |",
         f"| Open ideas and to-dos | {sum(len(by_stage[s]) for s in STAGES[:3])} |",
         f"| Tagged to-try | {to_try} |",
         f"| Marked read or done | {status.get('read', 0) + status.get('done', 0)} of {n} |", "",
         "### Saves per day", "", "```"]
    top = max(per_day.values()) if per_day else 1
    g += [f"{d}  {bar(c, top)} {c}" for d, c in sorted(per_day.items())]
    g += ["```", "", "### By topic", "", "```"]
    g += [f"{t:<13} {bar(len(v), n)} {len(v)}" for t, v in sorted(by_topic.items(), key=lambda kv: -len(kv[1]))]
    g += ["```", "", "### By kind", "", "```"]
    g += [f"{k:<13} {bar(len(by_kind[k]), n)} {len(by_kind[k])}" for k in KINDS if by_kind.get(k)]
    g += ["```", "", "### Where it comes from", "", "```"]
    g += [f"{p:<13} {bar(c, n)} {c}" for p, c in plats.most_common()]
    g += ["```", "", "### Ideas by stage", ""]
    g += [f"- {st}: {len(by_stage.get(st, []))}" for st in STAGES]
    empty = [t for t in ("ai", "tech", "business", "design", "productivity", "health", "finance", "learning", "life", "gamedev") if t not in by_topic]
    if empty:
        g += ["", f"Topics with nothing saved yet: {', '.join(empty)}."]
    g += ["", GEN_END]
    path.write_text(cur.rstrip() + "\n\n" + "\n".join(g) + "\n", encoding="utf-8")


def main():
    entries = [parse(p) for d in DIRS if d.exists() for p in d.rglob("*.md")]
    entries += load_projects(entries)
    entries.sort(key=lambda e: (e["added"], e["title"]), reverse=True)
    for e in entries:
        e.setdefault("topic", "inbox" if e["path"].startswith("inbox/") else e["path"].split("/")[1])

    by_topic, by_tag, by_kind = defaultdict(list), defaultdict(list), defaultdict(list)
    for e in entries:
        group = group_of(e)
        by_topic[group].append(e)
        for t in e["tags"]:
            by_tag[t].append(e)
        by_kind[e.get("kind") or "unsorted"].append(e)

    # INDEX.md / TAGS.md
    out = ["# Index", "", f"_{len(entries)} entries. Generated by `scripts/build_index.py`; do not edit by hand._", ""]
    for topic in sorted(by_topic):
        out += [f"## {topic} ({len(by_topic[topic])})", ""] + [index_line(e) for e in by_topic[topic]] + [""]
    write(ROOT / "INDEX.md", out)

    out = ["# Tags", "", f"_{len(by_tag)} tags. Generated by `scripts/build_index.py`; do not edit by hand._", ""]
    for tag in sorted(by_tag):
        out += [f"## #{tag} ({len(by_tag[tag])})", ""] + [index_line(e) for e in by_tag[tag]] + [""]
    write(ROOT / "TAGS.md", out)

    # catalog/*.md
    cat_dir = ROOT / "catalog"
    for name, (heading, blurb, kinds) in CATALOGS.items():
        items = [e for k in kinds for e in by_kind.get(k, [])]
        out = [f"# {heading}", "", blurb, "",
               f"_{len(items)} entries. Generated by `scripts/build_index.py` from each note's `kind`; do not edit by hand._", ""]
        for k in kinds:
            group = by_kind.get(k, [])
            if not group:
                continue
            out += [f"## {k} ({len(group)})", ""]
            for e in group:
                out += catalog_entry(e)
        write(cat_dir / f"{name}.md", out)
    # catalog/kit.md: the asset library for shoots, edits and game builds, by area
    kit_items = [e for e in entries if e["kit"]]
    out = ["# Asset library", "",
           "What Yuvraj reaches for on a shoot, in an edit or in a game build: LUTs and grading, sound, VFX, "
           "motion, shoot gear and DIT, edit tools, 3D and 2D assets. Grouped by each note's `kit` field; "
           "`style` says what the look is. A note can sit in more than one area.", "",
           f"_{len(kit_items)} entries. Generated by `scripts/build_index.py` from each note's `kit`; do not edit by hand. "
           f"Browse it by look on the site: {SITE}/gallery.html#asset-library_", ""]
    for area, label in KIT.items():
        group = [e for e in kit_items if area in e["kit"]]
        if not group:
            continue
        out += [f"## {area} ({len(group)})", "", f"_{label}_", ""]
        for e in group:
            out += catalog_entry(e)
    write(cat_dir / "kit.md", out)
    bad_kit = sorted({k for e in kit_items for k in e["kit"] if k not in KIT})
    if bad_kit:
        print("Unknown kit values:", ", ".join(bad_kit))

    unsorted = by_kind.get("unsorted", []) + [e for k, v in by_kind.items() if k not in KINDS and k != "unsorted" for e in v]

    # IDEAS.md: idea and todo notes by stage
    ideas = [e for e in entries if e.get("kind") in ("idea", "todo")]
    by_stage = defaultdict(list)
    for e in ideas:
        by_stage[e.get("stage") or "new"].append(e)
    open_n = sum(len(by_stage[s]) for s in STAGES[:3])
    out = ["# Ideas and to-dos", "",
           "Yuvraj's own ideas and open to-dos, so any AI can call them back. Each note's `stage` is one of "
           "`new`, `exploring`, `doing`, `done`, `dropped`; change it in the note and rebuild.", "",
           f"_{open_n} open, {len(ideas)} total. Generated by `scripts/build_index.py`; do not edit by hand._", ""]
    for st in STAGES + sorted(k for k in by_stage if k not in STAGES):
        if not by_stage.get(st):
            continue
        out += [f"## {st} ({len(by_stage[st])})", ""]
        for e in by_stage[st]:
            out.append(f"- {link(e)} · `{e['kind']}` · {e['topic']} · {e['added']}: {e.get('why') or e['summary'][:140]}")
        out.append("")
    concepts = [e for e in entries if e.get("kind") == "project" and re.search(r"concept|idea", e.get("state") or "", re.I)]
    if concepts:
        out += [f"## Ideas being tracked as projects ({len(concepts)})", "",
                "Build ideas promoted to `kind: project` with `state: concept`, so they sit on the PROJECTS board "
                "with their next steps. Still ideas: nothing is built yet.", ""]
        for e in concepts:
            nx = next_steps(e)
            out.append(f"- {link(e)} · `{e.get('type', 'project')}` · {e['topic']} · {e['added']}: {e.get('why') or e['summary'][:140]}"
                       + (f" · next: {nx[0]}" if nx else ""))
        out.append("")
    write(ROOT / "IDEAS.md", out)

    # ME.md generated block: stats for Yuvraj himself
    write_me(entries, by_topic, by_tag, by_kind, by_stage)

    # TASTE.md generated block
    style_refs = [e for e in entries if e["style"]]
    style_counts = Counter(s for e in style_refs for s in e["style"])
    gen = [GEN_START, "",
           "## Evidence (generated)", "",
           f"_From {len(entries)} entries, {len(style_refs)} with style notes. Rebuilt on every filing._", "",
           "### What he saves, by kind", ""]
    gen += [f"- `{k}`: {len(by_kind[k])}" for k in KINDS if by_kind.get(k)]
    gen += ["", "### Top tags", "", ", ".join(f"#{t} ({len(v)})" for t, v in sorted(by_tag.items(), key=lambda kv: (-len(kv[1]), kv[0]))[:20]), ""]
    gen += ["### Style notes and where they come from", ""]
    for s, n in sorted(style_counts.items(), key=lambda kv: (-kv[1], kv[0])):
        srcs = [e for e in style_refs if s in e["style"]]
        gen.append(f"- **{s}**" + (f" ×{n}" if n > 1 else "") + ": " + ", ".join(link(e) for e in srcs))
    gen += ["", "### Every reference with his reason", ""]
    for e in entries:
        if e.get("kind") in ("style-ref", "website-ref", "game-ref", "library", "asset-source", "tool"):
            gen.append(f"- {link(e)} (`{e['kind']}`): {e.get('why', '')}")
    gen += ["", GEN_END]
    taste = ROOT / "TASTE.md"
    cur = taste.read_text(encoding="utf-8") if taste.exists() else "# Taste profile\n\n"
    if GEN_START in cur:
        cur = cur[:cur.index(GEN_START)] + cur[cur.index(GEN_END) + len(GEN_END):].lstrip("\n")
    taste.write_text(cur.rstrip() + "\n\n" + "\n".join(gen) + "\n", encoding="utf-8")

    # llms.txt
    out = ["# Yuvraj's second brain", "",
           "> Personal knowledge base and taste profile of Yuvraj Garg, a video editor and builder at Revolio Media (Mumbai) who makes games, desktop apps and AI tools, many of them shipped (see catalog/projects.md). "
           "Every link, reference, library, tool and idea he saves is one markdown note with YAML frontmatter. "
           "Use it to personalise your answers: match his visual taste, prefer the libraries and tools he has saved, "
           "and build on his own ideas.", "",
           f"Read TASTE.md first for the gist, then the catalog for what you need. Live graph: {SITE}. "
           f"MCP server (get_taste_profile, search, fetch, list_notes, get_catalog, recall_ideas, get_checks): {SITE}/mcp", "",
           "## Start here", "",
           f"- [AGENTS.md]({RAW}/AGENTS.md): how the repo is laid out, what each field means, how to use it",
           f"- [TASTE.md]({RAW}/TASTE.md): his taste profile (visual style, games, stack) with evidence",
           f"- [CHECKS.md]({RAW}/CHECKS.md): mistakes agents made for him, each with the check that stops it. Read before working",
           f"- [IDEAS.md]({RAW}/IDEAS.md): his own ideas and to-dos by stage, to call back",
           f"- [llms-full.txt]({SITE}/llms-full.txt): every note in one file", "",
           "## Catalogs", ""]
    for name, (heading, blurb, kinds) in CATALOGS.items():
        out.append(f"- [{heading}]({RAW}/catalog/{name}.md): {blurb}")
    out.append(f"- [Asset library]({RAW}/catalog/kit.md): what he uses on shoots, edits and game builds (LUTs, sound, VFX, motion, 3D, 2D), by area")
    out += ["", "## Notes", ""]
    for e in entries:
        desc = e.get("why") or e["summary"][:120]
        out.append(f"- [{e['title']}]({RAW}/{e['path']}): `{e.get('kind', '?')}` · {e['topic']} · {desc}")
    write(ROOT / "llms.txt", out)

    # llms-full.txt
    out = [f"# Yuvraj's second brain: full dump ({len(entries)} notes)", "",
           "Generated by scripts/build_index.py. Each note: frontmatter fields, then its body.", ""]
    taste_txt = taste.read_text(encoding="utf-8")
    out += ["=" * 60, "TASTE.md (curated part)", "=" * 60, "", taste_txt[:taste_txt.index(GEN_START)].strip(), ""]
    for e in entries:
        out += ["=" * 60, f"{e['title']}  ({e['path']})", "=" * 60]
        for k in ("kind", "stage", "type", "topic", "added", "source", "status", "why"):
            if e.get(k):
                out.append(f"{k}: {e[k]}")
        if e["tags"]:
            out.append("tags: " + ", ".join(e["tags"]))
        if e["style"]:
            out.append("style: " + ", ".join(e["style"]))
        if e["kit"]:
            out.append("kit: " + ", ".join(e["kit"]))
        out += ["", e["body"], ""]
        if e.get("docs"):  # listed, not inlined, so this file doesn't grow with every log entry
            out += ["vault docs (full text via MCP fetch or " + RAW + "/<path>): " + ", ".join(d["path"] for d in e["docs"]), ""]
    write(ROOT / "llms-full.txt", out)

    print(f"Indexed {len(entries)} entries, {len(by_tag)} tags, {len(style_counts)} style notes.")
    if unsorted:
        print("Missing or unknown kind:", ", ".join(e["path"] for e in unsorted))


if __name__ == "__main__":
    main()
    # link health report (LINKS.md + site/data/links.json); report only, never edits notes
    try:
        import link_doctor
        link_doctor.main()
    except Exception as err:  # never block a build on the report
        print("link doctor skipped:", err)
