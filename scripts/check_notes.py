#!/usr/bin/env python3
"""Checks that turn repeat filing mistakes into code (see CHECKS.md).

Every rule here was a CLAUDE.md line that agents kept breaking. If code can check it,
code does it. No dependencies.

  python3 scripts/check_notes.py            report every note, exit 1 on errors
  python3 scripts/check_notes.py FILE...    check only these notes (use before a commit)
  python3 scripts/check_notes.py --changed  check notes changed vs origin/main + untracked

Errors break a rule outright. Warnings are worth a look but can be right.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_index import KINDS, KIT, STAGES, as_list  # noqa: E402

TYPES = {"link", "note", "idea", "bookmark", "quote", "video", "tool", "book", "person", "place",
         "recipe", "todo", "game", "app", "site", "concept", "company"}
KEBAB = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
DATE_SLUG = re.compile(r"^\d{4}-\d{2}-\d{2}")
THIRD_PERSON = re.compile(r"\b(his own|yuvraj'?s|added as context)\b", re.I)


def front(text):
    m = re.match(r"^---\n(.*?)\n---\n?", text, re.S)
    meta = {}
    if m:
        for line in m.group(1).splitlines():
            if ":" in line and not line.startswith((" ", "\t", "#")):
                k, v = line.split(":", 1)
                meta[k.strip()] = re.sub(r"\s+#.*$", "", v).strip()
    return meta, bool(m)


def check(path):
    """Return a list of (level, rule, message) for one note."""
    text = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    meta, has_front = front(text)
    out = []
    err = lambda rule, msg: out.append(("error", rule, msg))
    warn = lambda rule, msg: out.append(("warn", rule, msg))
    if not has_front:
        return [("error", "frontmatter", "no frontmatter block")]

    title = meta.get("title", "").strip("'\"")
    words = len(title.split())
    if not title:
        err("short-title", "missing title")
    elif re.search(r"[:,;]| - | — ", title):
        err("short-title", f"title has a subtitle or punctuation: {title!r}")
    elif not 2 <= words <= 4:
        (err if words > 5 else warn)("short-title", f"title is {words} words, keep 2-4: {title!r}")

    typ, kind = meta.get("type", ""), meta.get("kind", "")
    if typ not in TYPES:
        err("type", f"unknown type {typ!r}")
    if kind not in KINDS:
        err("ai-fields", f"kind {kind!r} is missing or unknown")
    if kind in ("project", "org") and typ == "note":
        err("project-type", "kind project/org must use game/app/tool/site/concept/company, never note")
    why = meta.get("why", "").strip("'\"")
    if not why:
        err("ai-fields", "missing why")
    elif THIRD_PERSON.search(why):
        warn("why-voice", f"why talks about him in the third person: {why!r}")
    stage = meta.get("stage", "")
    if kind in ("idea", "todo") and stage not in STAGES:
        err("stage", f"kind {kind} needs stage ({'/'.join(STAGES)}), has {stage!r}")
    if stage and kind not in ("idea", "todo"):
        warn("stage", f"stage is only for idea/todo, this is kind {kind!r}")

    kit = as_list(meta.get("kit", ""))
    unknown = [k for k in kit if k not in KIT]
    if unknown:
        err("kit", f"unknown kit area {unknown}, use: {', '.join(KIT)}")

    tags = as_list(meta.get("tags", ""))
    bad = [t for t in tags if not KEBAB.match(t)]
    if bad:
        err("tags", f"tags must be lowercase kebab-case: {bad}")
    if not 3 <= len(tags) <= 6 and path.parts[-3:-2] != ("projects",):
        warn("tags", f"{len(tags)} tags, aim for 3-6")

    if not meta.get("added"):
        err("added", "missing added date")
    if "/topics/" in str(path):
        folder = path.parent.name
        if meta.get("topic") != folder:
            err("topic", f"topic {meta.get('topic')!r} does not match folder {folder!r}")
        if DATE_SLUG.match(path.stem):
            err("slug", "slug starts with a date; the date lives in added:")
        if "## Raw" not in text:
            err("raw", "no ## Raw section: his own words must be kept")
    return out


def changed_files():
    run = lambda *a: subprocess.run(a, cwd=ROOT, capture_output=True, text=True).stdout.split()
    files = run("git", "diff", "--name-only", "origin/main", "--") + run("git", "ls-files", "--others", "--exclude-standard")
    return [ROOT / f for f in files if f.startswith(("topics/", "inbox/")) and f.endswith(".md") and (ROOT / f).exists()]


def main(argv):
    if "--changed" in argv:
        files = changed_files()
    elif argv:
        files = [Path(a).resolve() for a in argv]
    else:
        files = sorted(p for d in ("topics", "inbox") for p in (ROOT / d).rglob("*.md"))
    errors = warns = 0
    for f in files:
        if f.name.startswith(("README", ".")):
            continue
        for level, rule, msg in check(f):
            errors += level == "error"
            warns += level == "warn"
            print(f"{level:5}  {f.relative_to(ROOT)}  [{rule}] {msg}")
    print(f"check_notes: {len(files)} notes, {errors} errors, {warns} warnings")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
