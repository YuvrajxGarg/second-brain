#!/usr/bin/env python3
"""Weekly brain health report: one message covering backups, links, deploys, MCP cost
and vault sync on each machine. The Sunday link check runs it (steps in health/README.md).

    python3 scripts/health_report.py                 writes health/latest.md, prints the phone message
    python3 scripts/health_report.py --link-before 88 link health at the start of the run (for "88 -> 91")
    python3 scripts/health_report.py --deploys 9     real production deploy count (from Vercel), else estimated
    python3 scripts/health_report.py --save          also append this week to health/history.jsonl
    python3 scripts/health_report.py --json          print the raw numbers instead

Standard library only; MCP cost needs node (skipped if missing).
"""
import argparse
import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "health"
DAYS = 7
BATCH = 5
STALE_SYNC_HOURS = 48       # a machine that syncs daily should never be older than this
BACKUP_MAX_DAYS = 10        # weekly bundles; allow a few days of the laptop being shut
MCP_TYPICAL_BUDGET = 6000   # tokens for setup + taste + one search + one fetch
MCP_GROWTH_WARN = 0.25      # warn when a typical session grows 25% week over week


def sh(*args, check=False):
    r = subprocess.run(args, cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    return r.stdout.strip() if (r.returncode == 0 or not check) else ""


def now():
    return dt.datetime.now(dt.timezone.utc)


def parse_time(s):
    try:
        t = dt.datetime.fromisoformat(str(s))
        return t if t.tzinfo else t.replace(tzinfo=dt.timezone.utc)
    except Exception:
        return None


def ago(t):
    if not t:
        return "never"
    h = (now() - t).total_seconds() / 3600
    return f"{h:.0f}h ago" if h < 48 else f"{h / 24:.0f}d ago"


# ---------------------------------------------------------------- sections

def links():
    try:
        r = subprocess.run([sys.executable, "scripts/link_doctor.py", "--json"], cwd=ROOT, text=True,
                           stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        d = json.loads(r.stdout)
        return {"health": d["health"], "broken": len(d["broken"]), "orphans": len(d["orphans"]),
                "one_way": len(d["one_way"]), "proposals": len(d["suggestions"])}
    except Exception as e:
        return {"error": str(e)}


def notes():
    since = (now() - dt.timedelta(days=DAYS)).date().isoformat()
    added, unsorted = 0, 0
    for p in (ROOT / "topics").rglob("*.md"):
        m = re.search(r"^added:\s*(\S+)", p.read_text(encoding="utf-8", errors="replace"), re.M)
        if m and m.group(1) >= since:
            added += 1
    for p in (ROOT / "inbox").glob("*.md"):
        if re.search(r"^status:\s*unsorted", p.read_text(encoding="utf-8", errors="replace"), re.M):
            unsorted += 1
    total = sum(1 for _ in (ROOT / "topics").rglob("*.md"))
    r = subprocess.run([sys.executable, "scripts/check_notes.py"], cwd=ROOT, text=True,
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    m = re.search(r"(\d+)\s+error", r.stdout or "")
    errors = int(m.group(1)) if m else (0 if r.returncode == 0 else None)
    return {"total": total, "added": added, "inbox_unsorted": unsorted, "rule_errors": errors}


NOTE_RX = re.compile(r"^topics/.*\.md$")
QUIET_RX = re.compile(r"^(topics|inbox|suggestions|catalog)/|\.md$|^llms(-full)?\.txt$|^projects/\.sync/[^/]+\.health\.json$")


def deploy_decision(prev, sha, msg, pending):
    """Mirrors scripts/vercel_ignore.sh for one commit. Returns (build?, reason, pending)."""
    files = sh("git", "diff", "--name-only", prev, sha).splitlines() if prev else []
    pending |= {f for f in files if NOTE_RX.match(f)}
    if "[deploy]" in msg:
        return True, "[deploy]", pending
    if "(from site)" in msg:
        return True, "site edit", pending
    if any(not QUIET_RX.search(f) for f in files):
        return True, "code/config", pending
    if len(pending) >= BATCH:
        return True, "batch", pending
    if msg.startswith("suggest:") and pending:
        return True, "daily flush", pending
    return False, "", pending


def deploys(real=None):
    since = (now() - dt.timedelta(days=DAYS)).isoformat()
    log = sh("git", "log", "--first-parent", "--reverse", f"--since={since}", "--format=%H%x1f%s", "main")
    commits = [l.split("\x1f", 1) for l in log.splitlines() if "\x1f" in l]
    if not commits:
        return {"commits": 0, "estimated": 0, "real": real, "reasons": {}, "note_only": 0, "ok": True}
    prev = sh("git", "rev-parse", f"{commits[0][0]}^") or None
    pending, reasons, built = set(), {}, 0
    for sha, msg in commits:
        b, why, pending = deploy_decision(prev, sha, msg, pending)
        if b:
            built += 1
            reasons[why] = reasons.get(why, 0) + 1
            pending, prev = set(), sha
    note_only = reasons.get("batch", 0) + reasons.get("daily flush", 0)
    # The rule works if note-only deploys stay near one per batch plus one flush a day.
    notes_changed = len({f for f in sh("git", "diff", "--name-only", f"{commits[0][0]}^", "main").splitlines() if NOTE_RX.match(f)})
    budget = notes_changed // BATCH + DAYS
    return {"commits": len(commits), "estimated": built, "real": real, "reasons": reasons,
            "note_only": note_only, "budget": budget, "ok": note_only <= budget}


def mcp_cost():
    try:
        if subprocess.run(["node", "scripts/build_graph.mjs"], cwd=ROOT, stdout=subprocess.DEVNULL,
                          stderr=subprocess.DEVNULL).returncode != 0:
            return {"error": "build_graph failed"}
        r = subprocess.run(["node", "scripts/mcp_cost.mjs"], cwd=ROOT, text=True, stdout=subprocess.PIPE,
                           stderr=subprocess.PIPE)
        d = json.loads(r.stdout)
    except FileNotFoundError:
        return {"error": "node not installed"}
    except Exception as e:
        return {"error": str(e)[:120]}
    tools = {k: v["tokens"] for k, v in d.items() if k != "typical session"}
    biggest = max(tools.items(), key=lambda kv: kv[1])
    return {"typical": d["typical session"]["tokens"], "biggest": biggest, "tools": tools}


def machines():
    out = []
    sync = ROOT / "projects" / ".sync"
    names = sorted({p.name.split(".")[0] for p in sync.glob("*.json")}) if sync.exists() else []
    for m in names:
        hp = sync / f"{m}.health.json"
        if not hp.exists():
            out.append({"machine": m, "status": "no health data yet (needs a sync with the new brain_sync.py)",
                        "ok": None})
            continue
        h = json.loads(hp.read_text(encoding="utf-8"))
        last = parse_time(h.get("last_ok"))
        fails = h.get("failures") or []
        b = h.get("backup") or {}
        bt = parse_time(b.get("at"))
        stale = not last or (now() - last).total_seconds() > STALE_SYNC_HOURS * 3600
        old_backup = not bt or (now() - bt).days > BACKUP_MAX_DAYS
        out.append({
            "machine": m, "last_ok": h.get("last_ok"), "last_ok_ago": ago(last), "stale": stale,
            "failures": len(fails), "last_error": fails[-1]["error"] if fails else "",
            "backup": b.get("file"), "backup_ago": ago(bt), "backup_kb": (b.get("bytes") or 0) // 1024,
            "old_backup": old_backup, "ok": not stale and not fails and not old_backup,
        })
    return out


def previous():
    hist = OUT / "history.jsonl"
    if not hist.exists():
        return {}
    lines = [l for l in hist.read_text(encoding="utf-8").splitlines() if l.strip()]
    return json.loads(lines[-1]) if lines else {}


# ---------------------------------------------------------------- output

def build(args):
    r = {"date": dt.date.today().isoformat(), "links": links(), "notes": notes(),
         "deploys": deploys(args.deploys), "mcp": mcp_cost(), "machines": machines()}
    prev = previous()
    r["prev"] = {"link_health": (prev.get("links") or {}).get("health"),
                 "mcp_typical": (prev.get("mcp") or {}).get("typical")}
    return r


def flags(r, link_before):
    out = []
    L = r["links"]
    if L.get("broken"):
        out.append(f"{L['broken']} broken links")
    if (r["notes"].get("rule_errors") or 0) > 0:
        out.append(f"{r['notes']['rule_errors']} notes break the filing rules (check_notes.py)")
    if r["notes"]["inbox_unsorted"]:
        out.append(f"{r['notes']['inbox_unsorted']} inbox captures unsorted")
    d = r["deploys"]
    if not d["ok"]:
        out.append(f"{d['note_only']} note-only deploys vs ~{d['budget']} expected: batching isn't holding")
    m = r["mcp"]
    if "typical" in m:
        if m["typical"] > MCP_TYPICAL_BUDGET:
            out.append(f"MCP typical chat {m['typical']} tokens (budget {MCP_TYPICAL_BUDGET})")
        p = r["prev"]["mcp_typical"]
        if p and m["typical"] > p * (1 + MCP_GROWTH_WARN):
            out.append(f"MCP cost up {p} -> {m['typical']} tokens this week")
    for x in r["machines"]:
        if x["ok"] is None:
            out.append(f"{x['machine']}: no sync health yet")
            continue
        if x["stale"]:
            out.append(f"{x['machine']} last synced {x['last_ok_ago']}")
        if x["failures"]:
            out.append(f"{x['machine']}: {x['failures']} sync failures ({x['last_error'][:60]})")
        if x["old_backup"]:
            out.append(f"{x['machine']}: backup {x['backup_ago']}")
    have = [x for x in r["machines"] if x["ok"] is not None]
    if have and all(x["old_backup"] for x in have):
        out.append("no machine has a backup from the last 10 days")
    return out


def message(r, link_before):
    L, d, m = r["links"], r["deploys"], r["mcp"]
    before = link_before if link_before is not None else r["prev"]["link_health"]
    lh = f"{before} -> {L.get('health')}" if before is not None and before != L.get("health") else f"{L.get('health')}"
    dep = f"{d['real']} deploys" if d["real"] is not None else f"~{d['estimated']} deploys"
    dep += f" from {d['commits']} commits"
    mc = f"MCP ~{m['typical']} tok/chat" if "typical" in m else "MCP cost n/a"
    sync = ", ".join(
        f"{x['machine']} {'?' if x['ok'] is None else ('ok ' + x['last_ok_ago'] if x['ok'] else 'CHECK')}"
        for x in r["machines"]) or "no machines"
    fl = flags(r, link_before)
    lines = [
        f"Brain health: {'all good' if not fl else str(len(fl)) + ' to check'}. Links {lh}/100, "
        f"{r['notes']['added']} new notes, {dep}, {mc}.",
        f"Sync + backup: {sync}.",
    ]
    if fl:
        lines.append("Check: " + "; ".join(fl[:3]) + (f" (+{len(fl) - 3} more)" if len(fl) > 3 else ""))
    return "\n".join(lines)


def markdown(r, link_before):
    L, n, d, m = r["links"], r["notes"], r["deploys"], r["mcp"]
    fl = flags(r, link_before)
    out = [
        "# Brain health",
        "",
        f"Generated {r['date']} by `scripts/health_report.py` (the Sunday check). History: `health/history.jsonl`.",
        "",
        "## Needs a look" if fl else "## All good",
        "",
        *([f"- {x}" for x in fl] or ["Nothing to fix this week."]),
        "",
        "## Notes and links",
        "",
        f"- {n['total']} notes, {n['added']} added in the last {DAYS} days, {n['inbox_unsorted']} unsorted in inbox/, "
        f"{n['rule_errors'] if n['rule_errors'] is not None else '?'} filing-rule errors.",
        f"- Link health {L.get('health')}/100: {L.get('broken')} broken, {L.get('one_way')} one-way, "
        f"{L.get('orphans')} orphans, {L.get('proposals')} proposals waiting (LINKS.md).",
        "",
        "## Deploys (batched-deploy rule)",
        "",
        f"- {d['commits']} commits to main this week; "
        + (f"{d['real']} production deploys (Vercel). " if d["real"] is not None else "")
        + f"replaying `vercel_ignore.sh` per commit gives ~{d['estimated']} deploys"
        + (": " + ", ".join(f"{v} {k}" for k, v in sorted(d["reasons"].items())) if d["reasons"] else "") + ".",
        f"- Note-only deploys: {d.get('note_only', 0)} (expected at most ~{d.get('budget', 0)}: one per {BATCH} notes plus the daily flush). "
        + ("Batching is holding." if d["ok"] else "Batching is NOT holding: look for scripts that push one note at a time."),
        "- Vercel judges each push, not each commit, so the real number is usually lower.",
        "",
        "## MCP token cost",
        "",
    ]
    if "typical" in m:
        out += [f"A typical agent chat (setup + taste + one search + one fetch) costs ~{m['typical']} tokens"
                + (f" (last week {r['prev']['mcp_typical']})" if r["prev"]["mcp_typical"] else "") + ".", "",
                "| call | tokens |", "|---|---:|"]
        out += [f"| {k} | {v} |" for k, v in sorted(m["tools"].items(), key=lambda kv: -kv[1])]
    else:
        out.append(f"Not measured: {m.get('error')}")
    out += ["", "## Vault sync and backups", "",
            "| machine | last good sync | failures (14d) | last backup |", "|---|---|---|---|"]
    for x in r["machines"]:
        if x["ok"] is None:
            out.append(f"| {x['machine']} | {x['status']} | | |")
        else:
            out.append(f"| {x['machine']} | {x['last_ok_ago']} | {x['failures']}"
                       f"{' (' + x['last_error'][:80] + ')' if x['failures'] else ''} | "
                       f"{x['backup'] or 'none'} ({x['backup_ago']}, {x['backup_kb']} KB) |")
    out += ["", "Backups are full git bundles that each computer's daily sync writes once a week to "
            "`Documents/Vault/.backups/` (newest 6 kept; they ride along with iCloud or OneDrive if Documents "
            "syncs there). Restore: `git clone second-brain-<date>.bundle second-brain`.", ""]
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--link-before", type=int)
    ap.add_argument("--deploys", type=int, help="real production deploys this week, from Vercel")
    ap.add_argument("--save", action="store_true", help="append to health/history.jsonl")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    r = build(a)
    if a.json:
        print(json.dumps(r, indent=1))
        return
    OUT.mkdir(exist_ok=True)
    (OUT / "latest.md").write_text(markdown(r, a.link_before), encoding="utf-8")
    if a.save:
        slim = {k: r[k] for k in ("date", "links", "notes", "deploys", "machines")}
        slim["mcp"] = {k: v for k, v in r["mcp"].items() if k != "tools"}
        with open(OUT / "history.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps(slim) + "\n")
    print(message(r, a.link_before))


if __name__ == "__main__":
    main()
