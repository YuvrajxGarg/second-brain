#!/usr/bin/env python3
"""Link Doctor: audits the [[slug]] links between notes. No dependencies.

  python3 scripts/link_doctor.py          report only: writes LINKS.md + site/data/links.json
  python3 scripts/link_doctor.py --fix    also applies the safe fixes (see below), then reports
  python3 scripts/link_doctor.py --json   print the full audit as JSON (for Claude / scripts)

Every pair of notes gets a score from 0 to 1 built from cheap signals:
  shared tags weighted by rarity (sharing a rare tag counts far more than a common one),
  TF-IDF text similarity over title, summary, why, style and tags,
  a kind-pairing bonus (idea + technique, project + library, style-ref + project...),
  an explicit mention (one note names the other's title), same topic, same source site.

Checks: broken links (and a fix when a note ends with the dateless slug), one-way links,
orphans, weak links, strong missing links, duplicate notes, one-off tags that look like
variants of an existing tag.

--fix only does things that can't lose information:
  - rewrites a broken dateless link to the full slug ([[sprite-stacking-pixel-art]] ->
    [[sprite-stacking-pixel-art]])
  - adds a backlink line to the target's `## Notes` for one-way links that score as
    strong: `- [[source-slug]]: <reason>`
Removing links, adding new links between unlinked notes, and merges are proposals only:
they go in LINKS.md for Yuvraj (or Claude, when he says so) to apply.
"""
import json
import math
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
DIRS = [ROOT / "topics", ROOT / "inbox"]
# Vault projects are graph nodes too ([[<slug>]] = projects/<slug>/), e.g. an idea note
# linking the project it became. They count as valid link targets, nothing more.
VAULT_PROJECTS = {p.parent.name for p in (ROOT / "projects").glob("*/project.md")} if (ROOT / "projects").exists() else set()

KEEP = 0.35      # a link at or above this is healthy
WEAK = 0.15      # a link below this with no reason written next to it is flagged
SUGGEST = 0.55   # an unlinked pair at or above this is proposed (orphans: 0.1 lower)
MAX_SUGGEST = 3  # suggestions per note
MAX_PROPOSE = 25 # new-link proposals listed in LINKS.md
HUB = 6          # a note named by more than this many notes is a hub; naming it means little
MAX_LINKS = 8    # don't push a note past this many links

# kinds that are useful next to each other (order doesn't matter)
PAIRS = {
    frozenset(p) for p in [
        ("idea", "technique"), ("idea", "library"), ("idea", "asset-source"), ("idea", "tool"),
        ("idea", "game-ref"), ("idea", "style-ref"), ("todo", "technique"), ("todo", "tool"),
        ("project", "library"), ("project", "tool"), ("project", "technique"), ("project", "org"),
        ("project", "style-ref"), ("project", "game-ref"), ("project", "asset-source"),
        ("style-ref", "technique"), ("game-ref", "technique"), ("library", "technique"),
        ("idea", "project"),
    ]
}
# "what it's for" tags: shared by many unrelated notes, so they count for little
PURPOSE = {"own-project", "to-try", "to-read", "inspiration", "reference", "open-source", "concept"}
SOCIAL = {"x.com", "twitter.com", "instagram.com", "youtube.com", "youtu.be", "github.com",
          "reddit.com", "tiktok.com", "linkedin.com"}
GENERIC_LAST = {"app", "game", "tool", "site", "website", "engine", "library", "skill", "studio",
                "editor", "plugin", "reel", "film", "video", "idea", "tip", "prompt", "shader",
                "technique", "workflow", "repo", "page", "kit", "mcp", "server", "dataset"}
STOP = set("""a an and are as at be but by for from has have he his i in into is it its just
like me more my of on or so that the their them then there they this to was we what when which
who will with you your can not all also any one out up use used using how get very new make
made yuvraj saved save saves want wants about our only own""".split())

DISMISSED = ROOT / "links" / "dismissed.json"  # pairs Yuvraj said no to: {"pairs": {"a|b": "why"}}


def pair_key(a, b):
    return "|".join(sorted((a, b)))


def load_dismissed():
    try:
        return set(json.loads(DISMISSED.read_text(encoding="utf-8")).get("pairs", {}))
    except (OSError, ValueError):
        return set()


LINK_RE = re.compile(r"\[\[([^\]|]+)(\|[^\]]*)?\]\]")


# ---------- reading ----------
def as_list(v):
    return [t.strip().strip("'\"") for t in v.strip().strip("[]").split(",") if t.strip()]


def load():
    notes = {}
    for d in DIRS:
        for p in sorted(d.rglob("*.md")):
            text = p.read_text(encoding="utf-8").replace("\r\n", "\n")
            m = re.match(r"^---\n(.*?)\n---\n?", text, re.S)
            meta = {}
            if m:
                for line in m.group(1).splitlines():
                    if ":" in line:
                        k, v = line.split(":", 1)
                        meta[k.strip()] = v.split(" #")[0].strip().strip("'\"")
            body = text[m.end():] if m else text
            sec = lambda name: (re.search(rf"^## {name}\s*\n(.*?)(?=^## |\Z)", body, re.S | re.M) or [None, ""])[1]
            slug = p.stem
            notes[slug] = {
                "slug": slug, "path": p, "text": text, "body": body,
                "title": meta.get("title", slug), "kind": meta.get("kind", ""),
                "topic": meta.get("topic", p.parent.name), "tags": as_list(meta.get("tags", "")),
                "style": as_list(meta.get("style", "")), "why": meta.get("why", ""),
                "source": meta.get("source", ""), "summary": sec("Summary"),
                "raw": sec("Raw"), "notes": sec("Notes"),
            }
    return notes


def resolve(target, slugs):
    """Exact slug, else the one note whose slug ends with -target (dateless link)."""
    target = target.strip()
    if target in slugs:
        return target, False
    undated = re.sub(r"^\d{4}-\d\d-\d\d-", "", target)  # old date-first slugs (renamed 2026-11-26)
    if undated in slugs:
        return undated, True
    hits = [s for s in slugs if s.endswith("-" + target) or s[11:] == target]
    return (hits[0], True) if len(hits) == 1 else (None, False)


def link_lines(n):
    """Each [[link]] in the note with the line it sits on (for 'has a reason' checks)."""
    out = []
    for line in n["body"].splitlines():
        for m in LINK_RE.finditer(line):
            out.append((m.group(1).strip(), line))
    return out


def has_reason(line):
    """A link has a reason if its line says something beyond 'Related:' and other links."""
    rest = LINK_RE.sub("", line)
    rest = re.sub(r"^\s*[-*]\s*", "", rest)
    rest = re.sub(r"(?i)\b(related|see also|see)\b\s*:?", "", rest)
    return len(re.sub(r"[\W_]+", "", rest)) >= 6


# ---------- scoring ----------
def tokens(s):
    return [w for w in re.findall(r"[a-z0-9][a-z0-9\-]+", s.lower()) if w not in STOP and len(w) > 2 and not w.isdigit()]


def host(url):
    try:
        h = urlparse(url).netloc.lower().removeprefix("www.")
    except ValueError:
        return ""
    return "" if h in SOCIAL else h


def mention_names(title):
    """Phrases that count as naming a note: its title, and the title minus a generic last word."""
    t = title.strip()
    names = {t.lower()}
    words = t.split()
    if len(words) >= 3 and words[-1].lower() in GENERIC_LAST:
        short = " ".join(words[:-1])
        if len(short) >= 8:
            names.add(short.lower())
    return [x for x in names if len(x) >= 5]


class Scorer:
    def __init__(self, notes):
        self.notes = notes
        n = len(notes)
        df = Counter(t for x in notes.values() for t in set(x["tags"]))
        self.tag_idf = {t: math.log((n + 1) / c) * (0.3 if t in PURPOSE else 1) for t, c in df.items()}
        docs = {}
        for s, x in notes.items():
            text = " ".join([x["title"]] * 2 + [x["summary"], x["why"], " ".join(x["style"]), " ".join(x["tags"]) * 2])
            docs[s] = Counter(tokens(text))
        wdf = Counter(w for c in docs.values() for w in c)
        self.vec = {}
        for s, c in docs.items():
            v = {w: (1 + math.log(k)) * math.log((n + 1) / wdf[w]) for w, k in c.items()}
            norm = math.sqrt(sum(x * x for x in v.values())) or 1
            self.vec[s] = {w: x / norm for w, x in v.items()}
        self.names = {s: mention_names(x["title"]) for s, x in notes.items()}
        # his words and Claude's summary, without link markup or ## Raw (import boilerplate
        # there names half the brain), for mention checks
        self.plain = {s: LINK_RE.sub(" ", " ".join([x["summary"], x["notes"], x["why"]])).lower()
                      for s, x in notes.items()}
        self.cache = {}
        self.hubs = set()
        named = Counter(b for a in notes for b in notes if a != b and self._names(a, b))
        self.hubs = {b for b, c in named.items() if c > HUB}

    def _names(self, a, b):
        txt = self.plain[a]
        return any(re.search(r"(?<![a-z0-9])" + re.escape(nm) + r"(?![a-z0-9])", txt) for nm in self.names[b])

    def mentions(self, a, b):
        """Does note a's text name note b? (hub notes never count)"""
        return b not in self.hubs and self._names(a, b)

    def parts(self, a, b):
        key = (a, b) if a < b else (b, a)
        if key in self.cache:
            return self.cache[key]
        A, B = self.notes[a], self.notes[b]
        shared = sorted(set(A["tags"]) & set(B["tags"]), key=lambda t: -self.tag_idf[t])
        small = min(sum(self.tag_idf[t] for t in A["tags"]), sum(self.tag_idf[t] for t in B["tags"])) or 1
        tag = min(1.0, sum(self.tag_idf[t] for t in shared) / small * 1.6)
        va, vb = self.vec[a], self.vec[b]
        if len(va) > len(vb):
            va, vb = vb, va
        text = sum(x * vb.get(w, 0) for w, x in va.items())
        pair = frozenset((A["kind"], B["kind"])) in PAIRS
        mention = self.mentions(a, b) or self.mentions(b, a)
        same_topic = A["topic"] == B["topic"]
        ha, hb = host(A["source"]), host(B["source"])
        same_site = bool(ha) and ha == hb
        score = 0.45 * tag + 0.55 * min(1.0, text * 1.8) + (0.1 if pair else 0) + (0.3 if mention else 0) \
            + (0.05 if same_topic else 0) + (0.1 if same_site else 0)
        res = {"score": round(min(1.0, score), 3), "shared": shared, "text": round(text, 3),
               "pair": pair, "mention": mention, "same_topic": same_topic, "same_site": same_site}
        self.cache[key] = res
        return res

    def score(self, a, b):
        return self.parts(a, b)["score"]

    def reason(self, a, b):
        """A short plain reason for linking a to b, from the signals."""
        p, A, B = self.parts(a, b), self.notes[a], self.notes[b]
        bits = []
        if B["kind"] == "org" and A["kind"] == "project":
            bits.append(f"made under {B['title']}")
        elif A["kind"] == "org" and B["kind"] == "project":
            bits.append("one of its projects")
        elif self.mentions(a, b):
            bits.append("named here")
        elif self.mentions(b, a):
            bits.append("names this note")
        tags = [t for t in p["shared"] if t not in PURPOSE]
        if tags:
            bits.append("both " + ", ".join(tags[:3]))
        if p["same_site"]:
            bits.append("same site")
        if not bits:
            bits.append(f"related {B['kind'] or 'note'}")
        return "; ".join(bits)


# ---------- audit ----------
def audit(notes):
    slugs = set(notes)
    dismissed = load_dismissed()
    sc = Scorer(notes)
    out_links = defaultdict(dict)  # a -> {b: line}
    broken = []
    for s, n in notes.items():
        for target, line in link_lines(n):
            full, fixable = resolve(target, slugs)
            if full is None and target.strip() in VAULT_PROJECTS:
                continue  # a vault project (projects/<slug>/): valid, but not scored here
            if full is None:
                broken.append({"note": s, "link": target, "fix": None})
            elif fixable:
                broken.append({"note": s, "link": target, "fix": full})
                out_links[s][full] = line
            elif full != s:
                out_links[s][full] = line
    in_links = defaultdict(set)
    for a, d in out_links.items():
        for b in d:
            in_links[b].add(a)

    links, one_way, weak = [], [], []
    for a, d in out_links.items():
        for b, line in d.items():
            p = sc.parts(a, b)
            reasoned = has_reason(line)
            item = {"from": a, "to": b, "score": p["score"], "shared": p["shared"], "reason": reasoned}
            links.append(item)
            if a not in out_links.get(b, {}):
                one_way.append({**item, "backlink": sc.reason(b, a)})
            if p["score"] < WEAK and not reasoned and pair_key(a, b) not in dismissed:
                weak.append(item)

    degree = {s: len(set(out_links.get(s, {})) | in_links.get(s, set())) for s in notes}
    linked_pairs = {frozenset((a, b)) for a, d in out_links.items() for b in d}
    suggest = defaultdict(list)
    ordered = sorted(notes)
    for i, a in enumerate(ordered):
        for b in ordered[i + 1:]:
            if frozenset((a, b)) in linked_pairs or pair_key(a, b) in dismissed:
                continue
            sco = sc.score(a, b)
            floor = SUGGEST if degree[a] and degree[b] else SUGGEST - 0.1  # orphans get a lower bar
            if sco >= floor:
                suggest[a].append((sco, b))
                suggest[b].append((sco, a))
    suggestions = {}
    for s, lst in suggest.items():
        room = max(0, MAX_LINKS - degree[s])
        top = sorted(lst, reverse=True)[:min(MAX_SUGGEST, room)]
        if top:
            suggestions[s] = [{"to": b, "score": round(x, 3), "reason": sc.reason(s, b)} for x, b in top]
    # each pair once, strongest first
    seen, missing = set(), []
    for s, lst in suggestions.items():
        for it in lst:
            k = frozenset((s, it["to"]))
            if k not in seen:
                seen.add(k)
                missing.append({"a": s, "b": it["to"], "score": it["score"], "reason": it["reason"]})
    missing.sort(key=lambda x: -x["score"])

    orphans = [{"note": s, "suggest": suggestions.get(s, [])} for s in sorted(notes) if degree[s] == 0]

    # unlinked mentions: a names b in its text but doesn't link it
    mentions = defaultdict(list)
    for a in notes:
        for b in notes:
            if a != b and b not in out_links.get(a, {}) and sc.mentions(a, b):
                mentions[b].append(a)

    # duplicates: same source url, or near-identical text
    dupes, by_src = [], defaultdict(list)
    for s, n in notes.items():
        if n["source"]:
            by_src[n["source"].split("?")[0].rstrip("/")].append(s)
    for src, lst in by_src.items():
        lst = sorted(lst)
        for i, a in enumerate(lst):
            for b in lst[i + 1:]:
                if sc.parts(a, b)["text"] > 0.5:
                    dupes.append({"notes": [a, b], "why": "same source, similar text"})
    for i, a in enumerate(ordered):
        for b in ordered[i + 1:]:
            if sc.parts(a, b)["text"] > 0.8 and not any(set(d["notes"]) == {a, b} for d in dupes):
                dupes.append({"notes": [a, b], "why": "near-identical text"})

    # tag variants: a one-off tag that is a plural / spelling variant of another tag
    tag_count = Counter(t for n in notes.values() for t in n["tags"])
    norm = lambda t: re.sub(r"[-_ ]", "", t).removesuffix("es").removesuffix("s")
    groups = defaultdict(list)
    for t in tag_count:
        groups[norm(t)].append(t)
    tag_merges = []
    for lst in groups.values():
        if len(lst) > 1:
            keep = max(lst, key=lambda t: (tag_count[t], -len(t)))
            for t in lst:
                if t != keep:
                    tag_merges.append({"tag": t, "into": keep, "uses": tag_count[t]})

    total = len(links) + len(broken)
    connected = sum(1 for s in notes if degree[s])
    mutual = len(links) - len(one_way)
    health = round(100 * (
        0.4 * (connected / max(1, len(notes))) +
        0.3 * (1 - len(broken) / max(1, total)) +
        0.2 * (mutual / max(1, len(links))) +
        0.1 * (1 - len(weak) / max(1, len(links)))))

    return {
        "health": health,
        "counts": {"notes": len(notes), "links": len(links), "broken": len(broken),
                   "fixable": sum(1 for b in broken if b["fix"]), "one_way": len(one_way),
                   "orphans": len(orphans), "weak": len(weak), "missing": len(missing),
                   "connected": connected, "dupes": len(dupes), "tag_merges": len(tag_merges)},
        "broken": broken, "one_way": sorted(one_way, key=lambda x: -x["score"]),
        "weak": sorted(weak, key=lambda x: x["score"]), "orphans": orphans, "missing": missing,
        "mentions": {b: sorted(a) for b, a in mentions.items()}, "dupes": dupes,
        "tag_merges": tag_merges, "links": links, "suggestions": suggestions,
        "dismissed": len(dismissed),
    }


# ---------- fixes ----------
def add_note_line(text, line):
    """Append a bullet to ## Notes (creating the section at the end if needed)."""
    m = re.search(r"^## Notes[ \t]*\n", text, re.M)
    if not m:
        return text.rstrip("\n") + "\n\n## Notes\n" + line + "\n"
    nxt = re.search(r"^## ", text[m.end():], re.M)
    end = m.end() + nxt.start() if nxt else len(text)
    sec = text[m.end():end].rstrip("\n")
    sep = "\n" if sec.strip() else ""
    return text[:m.end()] + (sec + sep if sec.strip() else "") + line + "\n" + ("\n" + text[end:] if nxt else "")


def fix(notes, rep):
    changed = set()
    texts = {s: n["text"] for s, n in notes.items()}
    for b in rep["broken"]:
        if b["fix"]:
            s = b["note"]
            texts[s] = re.sub(r"\[\[" + re.escape(b["link"]) + r"(\|[^\]]*)?\]\]",
                              lambda m: "[[" + b["fix"] + (m.group(1) or "") + "]]", texts[s])
            changed.add(s)
    added = 0
    for o in rep["one_way"]:
        if o["score"] < KEEP:
            continue
        a, b = o["from"], o["to"]
        if re.search(r"\[\[" + re.escape(a) + r"(\|[^\]]*)?\]\]", texts[b]):
            continue
        texts[b] = add_note_line(texts[b], f"- [[{a}]]: {o['backlink']}")
        changed.add(b)
        added += 1
    for s in changed:
        notes[s]["path"].write_text(texts[s], encoding="utf-8")
    return {"files": len(changed), "relinked": sum(1 for b in rep["broken"] if b["fix"]), "backlinks": added}


# ---------- report ----------
def write_report(notes, rep):
    t = lambda s: notes[s]["title"] if s in notes else s
    c = rep["counts"]
    out = ["# Link health", "",
           "_Generated by `scripts/link_doctor.py` on every build; do not edit by hand. "
           "Run `python3 scripts/link_doctor.py --fix` to apply the safe fixes (broken dateless links, "
           "backlinks for strong one-way links). Everything under Proposals needs a yes first._", "",
           f"**Health: {rep['health']}/100** · {c['notes']} notes · {c['links']} links · "
           f"{c['connected']} notes linked · {c['broken']} broken · {c['one_way']} one-way · "
           f"{c['orphans']} orphans · {c['weak']} weak · {rep['dismissed']} pairs dismissed "
           f"(`links/dismissed.json`)", "",
           f"Scores run 0 to 1: keep at {KEEP}+, weak under {WEAK} with no reason written, "
           f"suggest new links at {SUGGEST}+ ({SUGGEST - 0.1}+ for orphans).", ""]

    out += ["## Broken links", ""]
    if not rep["broken"]:
        out.append("None.")
    for b in rep["broken"]:
        fx = f"fix: `[[{b['fix']}]]` (auto)" if b["fix"] else "no matching note, fix by hand"
        out.append(f"- {t(b['note'])}: `[[{b['link']}]]`, {fx}")
    out += ["", "## One-way links", "",
            f"Strong ones (score {KEEP}+) get a backlink automatically with `--fix`.", ""]
    for o in rep["one_way"][:60]:
        auto = " (auto)" if o["score"] >= KEEP else ""
        out.append(f"- {t(o['from'])} -> {t(o['to'])} · {o['score']}{auto}")
    if not rep["one_way"]:
        out.append("None.")

    out += ["", "## Proposals", "", "Review them on the graph site (LINK DOCTOR, bottom left) or say "
            "\"apply links 1, 3\" / \"apply all links\" in chat.", ""]
    i = 0
    out += ["### Add these links", ""]
    for m in rep["missing"][:MAX_PROPOSE]:
        i += 1
        out.append(f"{i}. [ ] {t(m['a'])} <-> {t(m['b'])} · {m['score']} · {m['reason']}  "
                   f"`{m['a']}` `{m['b']}`")
    if not rep["missing"]:
        out.append("None.")
    out += ["", "### Remove or explain these weak links", "",
            "Low score and no reason written next to the link. Either say why they belong or drop them.", ""]
    for w in rep["weak"]:
        i += 1
        out.append(f"{i}. [ ] {t(w['from'])} -> {t(w['to'])} · {w['score']}  `{w['from']}` `{w['to']}`")
    if not rep["weak"]:
        out.append("None.")
    out += ["", "### Merge tags", ""]
    for m in rep["tag_merges"]:
        i += 1
        out.append(f"{i}. [ ] `#{m['tag']}` ({m['uses']}) into `#{m['into']}`")
    if not rep["tag_merges"]:
        out.append("None.")
    out += ["", "### Possible duplicates", ""]
    for d in rep["dupes"]:
        i += 1
        out.append(f"{i}. [ ] {' + '.join(t(s) for s in d['notes'])} ({d['why']})")
    if not rep["dupes"]:
        out.append("None.")

    out += ["", "## Orphans", "", "Notes with no links in or out, with their best matches.", ""]
    for o in rep["orphans"]:
        sug = ", ".join(f"{t(x['to'])} ({x['score']})" for x in o["suggest"]) or "nothing close yet"
        out.append(f"- {t(o['note'])}: {sug}")
    if not rep["orphans"]:
        out.append("None.")
    out += ["", "## Unlinked mentions", "", "A note names another note's title without linking it.", ""]
    for b, lst in sorted(rep["mentions"].items()):
        out.append(f"- {t(b)}: named in {', '.join(t(a) for a in lst)}")
    if not rep["mentions"]:
        out.append("None.")
    (ROOT / "LINKS.md").write_text("\n".join(out).rstrip() + "\n", encoding="utf-8")

    data = ROOT / "site" / "data"
    data.mkdir(parents=True, exist_ok=True)
    site = {"health": rep["health"], "counts": rep["counts"],
            "scores": {f"{l['from']}|{l['to']}": l["score"] for l in rep["links"]},
            "weak": [f"{w['from']}|{w['to']}" for w in rep["weak"]],
            "suggest": rep["suggestions"], "mentions": rep["mentions"],
            "review": {"missing": rep["missing"][:MAX_PROPOSE], "weak": rep["weak"],
                       "tag_merges": rep["tag_merges"], "dupes": rep["dupes"],
                       "orphans": [o["note"] for o in rep["orphans"]]}}
    (data / "links.json").write_text(json.dumps(site), encoding="utf-8")


def main(argv=()):
    notes = load()
    rep = audit(notes)
    if "--fix" in argv:
        res = fix(notes, rep)
        print(f"link doctor fix: {res['relinked']} broken links relinked, {res['backlinks']} backlinks added, "
              f"{res['files']} files changed")
        notes = load()
        rep = audit(notes)
    if "--json" in argv:
        rep2 = {k: v for k, v in rep.items() if k != "links"}
        print(json.dumps(rep2, indent=1))
        return rep
    write_report(notes, rep)
    c = rep["counts"]
    print(f"link health {rep['health']}/100: {c['links']} links, {c['broken']} broken, {c['one_way']} one-way, "
          f"{c['orphans']} orphans, {c['weak']} weak, {c['missing']} suggested")
    return rep


if __name__ == "__main__":
    main(sys.argv[1:])
