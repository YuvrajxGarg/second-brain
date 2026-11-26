#!/usr/bin/env python3
"""Offline search over the second brain (and your local Vault). No internet, no installs.

Works on any clone of the repo. The vault sync keeps one fresh every day at
~/.brain-sync/second-brain (Mac and Windows), and also reads your Documents/Vault
directly, so project docs you wrote today are found before they sync.

    python3 scripts/brain_search.py pixel art            best matches for the words
    python3 scripts/brain_search.py "sprite stacking"    exact phrase
    python3 scripts/brain_search.py shader kind:technique topic:gamedev tag:godot
    python3 scripts/brain_search.py -n 3                 show result 3 of the last search in full
    python3 scripts/brain_search.py --open 3             open result 3 (file, or its source link with --link)
    python3 scripts/brain_search.py                      interactive: type queries, a number shows that note

Filters: kind:, topic:, tag:, type:, status:, stage:  (several are ANDed).
Ranking: title > tags/kind/why > summary > body; newer notes win ties.
Standard library only (Python 3.8+).
"""
import json
import os
import re
import subprocess
import sys
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATE = Path.home() / ".brain-sync"
LAST = STATE / "last-search.json"
FIELDS = ("kind", "topic", "tag", "type", "status", "stage")
TTY = sys.stdout.isatty() and os.environ.get("NO_COLOR") is None
if os.name == "nt" and TTY:
    os.system("")  # turns on ANSI colours in the Windows console


def c(code, s):
    return f"\033[{code}m{s}\033[0m" if TTY else s


def frontmatter(text):
    m = re.match(r"^---\r?\n(.*?)\r?\n---\r?\n?", text, re.S)
    meta = {}
    if not m:
        return meta, text
    for line in m.group(1).splitlines():
        if ":" in line and not line.startswith((" ", "\t", "#")):
            k, v = line.split(":", 1)
            v = re.sub(r"\s+#.*$", "", v).strip()
            if v.startswith("[") and v.endswith("]"):
                v = [x.strip().strip("'\"") for x in v[1:-1].split(",") if x.strip()]
            else:
                v = v.strip("'\"")
            meta[k.strip()] = v
    return meta, text[m.end():]


def section(body, name):
    m = re.search(rf"^##\s+{name}\s*\n(.*?)(?=^##\s|\Z)", body, re.S | re.M)
    return m.group(1).strip() if m else ""


def vault_dir():
    try:
        cfg = json.loads((STATE / "config.json").read_text(encoding="utf-8"))
        v = Path(cfg["vault"]).expanduser()
        return v if v.exists() else None
    except Exception:
        return None


def load():
    docs = []
    for folder in ("topics", "inbox", "projects"):
        for p in sorted((ROOT / folder).rglob("*.md")):
            if any(part.startswith(".") for part in p.relative_to(ROOT).parts):
                continue
            docs.append(("brain", p))
    seen = {p.parent.name for _, p in docs if "projects" in p.parts}
    v = vault_dir()
    if v:
        for p in sorted(v.rglob("*.md")):
            rel = p.relative_to(v).parts
            if any(x.startswith((".", "_")) for x in rel):  # .trash, _private, _template
                continue
            slug = re.sub(r"[^a-z0-9]+", "-", rel[0].lower()).strip("-") if len(rel) > 1 else ""
            if slug in seen and (ROOT / "projects" / slug / Path(*rel[1:])).exists():
                # synced copy exists; prefer the vault (it may be newer)
                docs = [d for d in docs if d[1] != ROOT / "projects" / slug / Path(*rel[1:])]
            docs.append(("vault", p))
    out = []
    for where, p in docs:
        try:
            text = p.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        meta, body = frontmatter(text)
        title = meta.get("title") or p.stem.replace("-", " ")
        if p.name in ("log.md", "todo.md", "context.md") and p.parent.name:
            title = f"{p.parent.name} / {p.stem}"
        tags = meta.get("tags") if isinstance(meta.get("tags"), list) else []
        out.append({
            "where": where, "path": str(p), "title": str(title), "tags": tags, "meta": meta,
            "summary": section(body, "Summary") or body.strip()[:400], "body": body,
            "added": str(meta.get("added") or ""),
        })
    return out


def parse(q):
    filters, words, phrases = {}, [], []
    for m in re.finditer(r'"([^"]+)"|(\S+)', q):
        if m.group(1):
            phrases.append(m.group(1).lower())
            continue
        tok = m.group(2)
        k, _, v = tok.partition(":")
        if v and k.lower() in FIELDS:
            filters.setdefault(k.lower(), []).append(v.lower())
        else:
            words.append(tok.lower())
    return filters, words, phrases


def matches_filters(d, filters):
    for k, vals in filters.items():
        if k == "tag":
            have = {t.lower() for t in d["tags"]}
            if not all(any(h == v or h.startswith(v) for h in have) for v in vals):
                return False
        else:
            if str(d["meta"].get(k, "")).lower() not in vals:
                return False
    return True


def score(d, words, phrases):
    title = d["title"].lower()
    meta = " ".join([" ".join(d["tags"]), str(d["meta"].get("kind", "")), str(d["meta"].get("why", "")),
                     str(d["meta"].get("style", "")), str(d["meta"].get("source", ""))]).lower()
    summ = d["summary"].lower()
    body = d["body"].lower()
    s = 0.0
    for ph in phrases:
        if ph not in title + " " + meta + " " + body:
            return 0
        s += 6 if ph in title else 3
    for w in words:
        hit = 0
        if re.search(rf"\b{re.escape(w)}", title):
            hit += 8
        if w in meta:
            hit += 4
        if w in summ:
            hit += 2
        n = body.count(w)
        if n:
            hit += 1 + min(n, 5) * 0.3
        if not hit:
            return 0  # every word must appear somewhere
        s += hit
    return s


def snippet(d, words, phrases, width=150):
    text = re.sub(r"\s+", " ", d["summary"] or d["body"])
    keys = phrases + words
    low = text.lower()
    pos = min([low.find(k) for k in keys if low.find(k) >= 0] or [0])
    start = max(0, pos - 40)
    s = ("…" if start else "") + text[start:start + width] + ("…" if start + width < len(text) else "")
    for k in sorted(set(keys), key=len, reverse=True):
        s = re.sub(re.escape(k), lambda m: c("1;33", m.group(0)), s, flags=re.I) if k else s
    return s


def search(docs, q, limit=10):
    filters, words, phrases = parse(q)
    res = []
    for d in docs:
        if not matches_filters(d, filters):
            continue
        s = score(d, words, phrases) if (words or phrases) else 1
        if s:
            res.append((s, d["added"], d))
    res.sort(key=lambda r: (r[0], r[1]), reverse=True)
    return [d for _, _, d in res[:limit]], words, phrases


def show_list(results, words, phrases):
    if not results:
        print("no matches. Try fewer words, or a filter like kind:tool")
        return
    for i, d in enumerate(results, 1):
        m = d["meta"]
        bits = " · ".join(x for x in [str(m.get("kind") or ""), str(m.get("topic") or ""),
                                      ", ".join(d["tags"][:4]), d["added"]] if x)
        where = c("35", " [vault]") if d["where"] == "vault" else ""
        print(f"{c('1;36', str(i).rjust(2))}  {c('1', d['title'])}{where}  {c('2', bits)}")
        print(f"    {snippet(d, words, phrases)}")
        src = m.get("source")
        if src and src != "None":
            print(f"    {c('34', src)}")
    print(c("2", f"\n-n <number> shows a note in full · --open <number> opens it"))


def show_full(d):
    print(c("1", d["title"]) + c("2", f"   {d['path']}"))
    for k in ("kind", "topic", "source", "added", "status", "why"):
        if d["meta"].get(k):
            print(c("2", f"{k}: ") + str(d["meta"][k]))
    if d["tags"]:
        print(c("2", "tags: ") + ", ".join(d["tags"]))
    print()
    print(d["body"].strip())


def remember(results):
    try:
        STATE.mkdir(parents=True, exist_ok=True)
        LAST.write_text(json.dumps([d["path"] for d in results]), encoding="utf-8")
    except OSError:
        pass


def recall(n):
    try:
        paths = json.loads(LAST.read_text(encoding="utf-8"))
        return paths[n - 1]
    except Exception:
        return None


def open_path(path, link=False):
    if link:
        meta, _ = frontmatter(Path(path).read_text(encoding="utf-8", errors="replace"))
        if meta.get("source") and meta["source"] != "None":
            webbrowser.open(meta["source"])
            return
    if sys.platform == "darwin":
        subprocess.run(["open", path])
    elif os.name == "nt":
        os.startfile(path)  # noqa
    else:
        subprocess.run(["xdg-open", path])


def main(argv):
    if argv and argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    if argv and argv[0] in ("-n", "--show", "--open"):
        if len(argv) < 2 or not argv[1].isdigit():
            print("give a result number, e.g. -n 2")
            return 1
        p = recall(int(argv[1]))
        if not p or not Path(p).exists():
            print("no such result; search again first")
            return 1
        if argv[0] == "--open":
            open_path(p, link="--link" in argv)
            return 0
        d = next((x for x in load() if x["path"] == p), None)
        show_full(d) if d else print(Path(p).read_text(encoding="utf-8", errors="replace"))
        return 0
    docs = load()
    if argv:
        res, w, ph = search(docs, " ".join(argv))
        remember(res)
        show_list(res, w, ph)
        return 0
    v = vault_dir()
    print(c("2", f"{len(docs)} notes{' + vault ' + str(v) if v else ''}. Type a search, a number to read, "
                 "o<number> to open, q to quit."))
    res = []
    while True:
        try:
            q = input(c("1;32", "brain> ")).strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return 0
        if q in ("q", "quit", "exit"):
            return 0
        if q.isdigit() and res and 0 < int(q) <= len(res):
            show_full(res[int(q) - 1])
            continue
        if re.fullmatch(r"o\d+", q) and res and 0 < int(q[1:]) <= len(res):
            open_path(res[int(q[1:]) - 1]["path"])
            continue
        if q:
            res, w, ph = search(docs, q)
            remember(res)
            show_list(res, w, ph)


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except BrokenPipeError:  # piped into head/less and closed early
        sys.exit(0)
