#!/usr/bin/env python3
"""Brain vault sync: keeps ~/Documents/Vault in step with projects/ in the second brain.

One script for macOS and Windows, standard library only (Python 3.8+ and git).

    python3 brain_sync.py init                 set up the vault, config and a private clone
    python3 brain_sync.py new "My Game"        new project folder from the template
    python3 brain_sync.py run [--dry-run]      sync now (what the daily job runs)
    python3 brain_sync.py status               what a run would do, without touching anything
    python3 brain_sync.py schedule [--time 21:30]   install the daily job (launchd / Task Scheduler)
    python3 brain_sync.py unschedule           remove the daily job

How a run works (full rules in README.md next to this file):
  1. Reset its own clone (~/.brain-sync/second-brain) to origin/main.
  2. Three-way compare every eligible file: vault vs repo vs the last synced hash this
     machine recorded in projects/.sync/<machine>.json.
       changed only in the vault  -> copied into projects/<slug>/
       changed only in the repo   -> copied down into the vault (the other machine's edit)
       changed on both sides      -> repo version kept, this machine's version saved beside
                                     it as <name>.conflict-<machine>-<date>.<ext> (both places)
       deleted in the vault       -> moved to projects/.archive/ in the repo, never hard-deleted
       deleted in the repo        -> moved to <Vault>/.trash/ locally
  3. Rebuild the brain's generated files, make ONE commit, push to main (or a branch with --pr).
Running it twice in a row does nothing the second time.
"""
import argparse
import datetime as dt
import fnmatch
import hashlib
import json
import os
import platform
import re
import shutil
import subprocess
import sys
from pathlib import Path

REPO_URL = "https://github.com/YuvrajxGarg/second-brain.git"
HOME = Path.home()
STATE_DIR = HOME / ".brain-sync"
CONFIG = STATE_DIR / "config.json"
LOG = STATE_DIR / "sync.log"
TASK_NAME = "BrainVaultSync"
LAUNCHD_LABEL = "in.pxlvzn.brain-sync"

TEXT_EXT = {".md", ".markdown", ".txt"}
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
MAX_TEXT = 512 * 1024        # 512 KB per text file
MAX_IMAGE = 2 * 1024 * 1024  # 2 MB per image
IGNORE_NAMES = ["*.env", ".env*", "*secret*", "*credential*", "*password*", "*.pem", "*.key",
                "id_rsa*", "*.p12", "*.pfx", "*.keystore", "Thumbs.db", "desktop.ini"]
SECRET_PATTERNS = [
    r"sk-[A-Za-z0-9_-]{20,}", r"sk_live_[A-Za-z0-9]{16,}", r"gh[pousr]_[A-Za-z0-9]{30,}",
    r"github_pat_[A-Za-z0-9_]{30,}", r"AKIA[0-9A-Z]{16}", r"AIza[0-9A-Za-z_-]{35}",
    r"xox[baprs]-[A-Za-z0-9-]{10,}", r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
    r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}",
    r"(?i)\b(api[_-]?key|secret|token|passw(or)?d|client[_-]?secret)\b\s*[:=]\s*['\"]?[A-Za-z0-9_\-/+=]{16,}",
    r"(?i)postgres(ql)?://[^\s:]+:[^\s@]+@",
]
SHARE_LEVELS = ("full", "summary", "none")

TEMPLATE_PROJECT = """---
title: {title}
type: app                 # game, app, tool, site or concept
topic: tech               # brain topic: tech, gamedev, ai, design...
tags: [own-project]
kind: project
why: what it is made for, in plain words
state: in progress        # live, prototype, in progress, concept, archived
stack: []
repo: private             # GitHub link, or private
share: full               # full = all docs go to the brain, summary = only this file, none = stays local
note:                     # optional: slug of an existing brain note for this project, e.g. dwn-downloader
added: {today}
---

## Summary
One to three sentences: what this project is.

## Notes
Anything else worth knowing at a glance.
"""
TEMPLATE_CONTEXT = """# {title}: context

Context for AI tools working on this project. Keep it current; it syncs to the brain.

## Stack and setup

## Conventions

## Decisions
"""
TEMPLATE_LOG = """# {title}: log

Dated entries, newest first: status, what was learned, mistakes and fixes, taste notes.
The log-to-brain skill appends here.
"""
TEMPLATE_TODO = """# {title}: to-do

- [ ]
"""
VAULT_README = """# Vault

Project docs that sync into the second brain once a day (projects/<name>/ in the repo).

One folder per project. Each one has:

    project.md    required. Frontmatter = the project's card in the brain (title, type,
                  topic, tags, why, state, stack, repo, share). Made for you if missing.
    context.md    context for AI tools: stack, conventions, decisions.
    todo.md       open tasks.
    log.md        dated status, learnings, mistakes, taste (the log-to-brain skill writes here).
    playtests.md  games only: one entry per build you played (log-to-brain, playtest mode).
    checks.md     mistakes that repeated, each turned into a check (mistakes-to-checks skill).
                  Agents read it before working on the project.
    notes/        anything else (.md, .txt, small images).
    _private/     never leaves this computer.

`share:` in project.md decides what goes up: full (everything), summary (only
project.md) or none (nothing). The brain repo is PUBLIC, so use summary or none for
anything confidential, and never put keys or passwords here (files that look like
they hold secrets are skipped and reported).

Folders starting with _ or . are not projects. New project:
    python3 <repo>/tools/vault-sync/brain_sync.py new "Project Name"
Sync now:
    python3 <repo>/tools/vault-sync/brain_sync.py run
Edits from your other computer come down here on each run. If both computers changed
the same file, you get a <name>.conflict-<machine>-<date> copy next to it: merge by
hand and delete the copy.
"""


# ---------------------------------------------------------------- helpers

def log(msg):
    line = f"{dt.datetime.now():%Y-%m-%d %H:%M:%S}  {msg}"
    print(line)
    try:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


def die(msg):
    log("ERROR: " + msg)
    sys.exit(1)


def slugify(name):
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "project"


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


def documents_dir():
    if os.name == "nt":  # honours OneDrive redirection
        try:
            import ctypes
            buf = ctypes.create_unicode_buffer(260)
            if ctypes.windll.shell32.SHGetFolderPathW(None, 5, None, 0, buf) == 0 and buf.value:
                return Path(buf.value)
        except Exception:
            pass
    return HOME / "Documents"


def git(repo, *args, check=True, capture=True):
    r = subprocess.run(["git", "-C", str(repo), *args], text=True,
                       stdout=subprocess.PIPE if capture else None, stderr=subprocess.STDOUT if capture else None)
    if check and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed:\n{(r.stdout or '').strip()}")
    return (r.stdout or "").strip()


def load_config():
    if not CONFIG.exists():
        die(f"no config at {CONFIG}. Run: python3 {Path(__file__).name} init")
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    cfg["vault"] = Path(cfg["vault"]).expanduser()
    cfg["repo"] = Path(cfg["repo"]).expanduser()
    return cfg


def frontmatter(text):
    m = re.match(r"^---\r?\n(.*?)\r?\n---", text, re.S)
    meta = {}
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.split(" #")[0].strip().strip("'\"")
    return meta


# ---------------------------------------------------------------- scanning

def project_dirs(vault):
    """{slug: Path} for every project folder in the vault."""
    out = {}
    if not vault.exists():
        return out
    for d in sorted(vault.iterdir()):
        if d.is_dir() and not d.name.startswith((".", "_")):
            slug = slugify(d.name)
            if slug in out:
                log(f"warning: '{d.name}' and '{out[slug].name}' both map to projects/{slug}; skipping '{d.name}'")
                continue
            out[slug] = d
    return out


def share_level(proj_dir):
    pm = proj_dir / "project.md"
    if not pm.exists():
        return "full"
    lvl = frontmatter(pm.read_text(encoding="utf-8", errors="replace")).get("share", "full").lower() or "full"
    return lvl if lvl in SHARE_LEVELS else "full"


def ignored_name(name):
    low = name.lower()
    return name.startswith(".") or any(fnmatch.fnmatch(low, p) for p in IGNORE_NAMES)


def eligible(path, rel_parts):
    """(ok, reason). rel_parts are the parts under the project folder."""
    if any(p.startswith(".") or p in ("_private", "node_modules", "__pycache__") for p in rel_parts[:-1]):
        return False, "private or hidden folder"
    if ignored_name(rel_parts[-1]):
        return False, "ignored name"
    if ".conflict-" in rel_parts[-1]:
        return True, ""
    ext = path.suffix.lower()
    size = path.stat().st_size
    if ext in TEXT_EXT:
        if size > MAX_TEXT:
            return False, f"text file over {MAX_TEXT // 1024} KB"
        text = path.read_text(encoding="utf-8", errors="replace")
        for pat in SECRET_PATTERNS:
            if re.search(pat, text):
                return False, "looks like it contains a secret"
        return True, ""
    if ext in IMAGE_EXT:
        return (size <= MAX_IMAGE), ("" if size <= MAX_IMAGE else f"image over {MAX_IMAGE // 1024 // 1024} MB")
    return False, "file type not synced"


def scan_vault(vault, share_override=None):
    """files: {repo_rel: Path}; present: set of repo_rels that exist locally but are not
    eligible (never overwritten); skipped: [(path, reason)] worth reporting."""
    files, present, skipped = {}, set(), []
    for slug, d in project_dirs(vault).items():
        level = (share_override or {}).get(slug) or share_level(d)
        for p in sorted(d.rglob("*")):
            if not p.is_file():
                continue
            parts = p.relative_to(d).parts
            rel = "/".join(("projects", slug) + parts)
            ok, why = eligible(p, parts)
            if ok and level == "none":
                ok, why = False, "share: none"
            elif ok and level == "summary" and parts != ("project.md",):
                ok, why = False, "share: summary"
            if ok:
                files[rel] = p
            else:
                present.add(rel)
                if why not in ("private or hidden folder", "ignored name", "share: none", "share: summary"):
                    skipped.append((p, why))
    return files, present, skipped


def scan_repo(repo):
    out = {}
    root = repo / "projects"
    if not root.exists():
        return out
    for p in sorted(root.rglob("*")):
        rel = p.relative_to(repo).as_posix()
        parts = rel.split("/")
        if p.is_file() and len(parts) >= 3 and not any(x.startswith(".") for x in parts[1:]):
            out[rel] = p
    return out


# ---------------------------------------------------------------- the sync

def vault_path_for(rel, vault, dirs):
    _, slug, *rest = rel.split("/")
    base = dirs.get(slug) or (vault / slug)
    return base.joinpath(*rest)


def conflict_name(rel, machine, today):
    stem, dot, ext = rel.rpartition(".")
    if not dot or "/" in ext:
        return f"{rel}.conflict-{machine}-{today}"
    return f"{stem}.conflict-{machine}-{today}.{ext}"


def plan(cfg):
    vault, repo, machine = cfg["vault"], cfg["repo"], cfg["machine"]
    state_file = repo / "projects" / ".sync" / f"{machine}.json"
    state = json.loads(state_file.read_text(encoding="utf-8")) if state_file.exists() else {"files": {}}
    base = state.get("files", {})
    rfiles = scan_repo(repo)
    # If the other machine changed a project's project.md (say, share: full -> summary),
    # judge this vault by the incoming share level, so a privacy downgrade there never
    # looks like "deleted in the repo" here.
    override = {}
    for slug, d in project_dirs(vault).items():
        rel = f"projects/{slug}/project.md"
        lp, rp = d / "project.md", rfiles.get(rel)
        if lp.exists() and rp and sha(lp) == base.get(rel, {}).get("hash") != sha(rp):
            override[slug] = share_level(rp.parent)
    vfiles, present, skipped = scan_vault(vault, override)
    actions = []  # (op, rel, detail)
    for rel in sorted(set(vfiles) | set(rfiles) | set(base)):
        v = sha(vfiles[rel]) if rel in vfiles else None
        r = sha(rfiles[rel]) if rel in rfiles else None
        b = base.get(rel, {}).get("hash")
        if v == r:
            if v and b != v:
                actions.append(("mark", rel, v))
            elif not v and b:
                actions.append(("forget", rel, None))
            continue
        if rel in present and rel not in vfiles:
            # exists locally but is not shared (private, summary-only, secret...)
            if r and b and r == b:
                actions.append(("archive", rel, "no longer shared from " + machine))
            elif r and not b:
                pass  # leave both alone; never overwrite a local file we can't read safely
            continue
        if b is None:
            if v and not r:
                actions.append(("push", rel, v))
            elif r and not v:
                actions.append(("pull", rel, r))
            else:
                actions.append(("conflict", rel, (v, r)))
        elif v == b:  # only the repo side moved
            actions.append(("pull", rel, r) if r else ("trash", rel, None))
        elif r == b:  # only the vault side moved
            actions.append(("push", rel, v) if v else ("archive", rel, "deleted on " + machine))
        elif v is None:  # deleted here, edited elsewhere: the edit wins
            actions.append(("pull", rel, r))
        elif r is None:  # edited here, deleted elsewhere: the edit wins
            actions.append(("push", rel, v))
        else:
            actions.append(("conflict", rel, (v, r)))
    # projects present in the vault without project.md get one
    missing = [(slug, d) for slug, d in project_dirs(vault).items() if not (d / "project.md").exists()]
    return state_file, base, vfiles, rfiles, actions, skipped, missing


def merge_logs(theirs, ours):
    """Union of '## ' entries from two log.md versions, newest date first, no duplicates."""
    def split(text):
        text = text.replace("\r\n", "\n")
        parts = re.split(r"(?m)^(?=## )", text)
        return parts[0], [p.rstrip() + "\n" for p in parts[1:]]
    head, a = split(theirs)
    _, b = split(ours)
    seen, entries = set(), []
    for e in a + b:
        key = re.sub(r"\s+", " ", e).strip()
        if key not in seen:
            seen.add(key)
            entries.append(e)
    entries.sort(key=lambda e: (re.match(r"## (\d{4}-\d\d-\d\d)", e) or [None, ""])[1], reverse=True)  # stable
    return head.rstrip() + "\n\n" + "\n".join(entries)


def apply(cfg, dry_run=False):
    vault, repo, machine = cfg["vault"], cfg["repo"], cfg["machine"]
    today = dt.date.today().isoformat()
    for slug, d in plan(cfg)[6]:
        if dry_run:
            log(f"would create {d / 'project.md'}")
        else:
            write_template(d, d.name)
            log(f"created {d / 'project.md'} (fill in its frontmatter)")
    state_file, base, vfiles, rfiles, actions, skipped, _ = plan(cfg)
    dirs = project_dirs(vault)
    for p, why in skipped:
        log(f"skipped {p}: {why}")
    counts = {}
    projects = set()
    for op, rel, detail in actions:
        counts[op] = counts.get(op, 0) + 1
        if op not in ("mark", "forget"):
            projects.add(rel.split("/")[1])
            log(f"{op:8} {rel}")
        if dry_run:
            continue
        dest_repo = repo / rel
        dest_vault = vault_path_for(rel, vault, dirs)
        if op == "push":
            dest_repo.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(vfiles[rel], dest_repo)
            base[rel] = {"hash": detail, "from": machine, "at": today}
        elif op == "pull":
            dest_vault.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(rfiles[rel], dest_vault)
            base[rel] = {"hash": detail, "from": base.get(rel, {}).get("from", "repo"), "at": today}
        elif op == "mark":
            base[rel] = {"hash": detail, "from": base.get(rel, {}).get("from", machine), "at": today}
        elif op == "forget":
            base.pop(rel, None)
        elif op == "archive":
            arch = repo / "projects" / ".archive" / today / Path(rel).relative_to("projects")
            arch.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(dest_repo), str(arch))
            base.pop(rel, None)
        elif op == "trash":
            trash = vault / ".trash" / today / Path(rel).relative_to("projects")
            trash.parent.mkdir(parents=True, exist_ok=True)
            if dest_vault.exists():
                shutil.move(str(dest_vault), str(trash))
            base.pop(rel, None)
        elif op == "conflict" and rel.endswith(("/log.md", "/playtests.md")) and detail[0] and detail[1]:
            # logs and playtests are append-only dated entries: merge both sides, no conflict copy
            merged = merge_logs(rfiles[rel].read_text(encoding="utf-8"), vfiles[rel].read_text(encoding="utf-8"))
            for dest in (dest_repo, dest_vault):
                dest.write_text(merged, encoding="utf-8", newline="")
            base[rel] = {"hash": sha(dest_repo), "from": machine, "at": today}
            log(f"merged   {rel} (entries from both computers kept)")
        elif op == "conflict":
            v, r = detail
            crel = conflict_name(rel, machine, today)
            if v:  # keep ours beside theirs, in both places
                shutil.copy2(vfiles[rel], repo / crel)
                shutil.copy2(vfiles[rel], vault_path_for(crel, vault, dirs))
            if r:
                shutil.copy2(rfiles[rel], dest_vault)
                base[rel] = {"hash": r, "from": base.get(rel, {}).get("from", "repo"), "at": today}
            else:  # theirs is gone: ours goes up under its own name
                dest_repo.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(vfiles[rel], dest_repo)
                base[rel] = {"hash": v, "from": machine, "at": today}
            if v:
                base[conflict_name(rel, machine, today)] = {"hash": v, "from": machine, "at": today}
            log(f"CONFLICT {rel}: kept the repo version, yours is in {crel.split('/')[-1]}")
    if not dry_run and actions:
        state_file.parent.mkdir(parents=True, exist_ok=True)
        state_file.write_text(json.dumps({"machine": machine, "files": dict(sorted(base.items()))}, indent=1) + "\n",
                              encoding="utf-8")
    return counts, sorted(projects)


# ---------------------------------------------------------------- git round trip

def fresh_clone(cfg):
    repo = cfg["repo"]
    if not (repo / ".git").exists():
        repo.parent.mkdir(parents=True, exist_ok=True)
        log(f"cloning {cfg['repo_url']} into {repo}")
        r = subprocess.run(["git", "clone", "--quiet", cfg["repo_url"], str(repo)])
        if r.returncode != 0:
            die("git clone failed (is git installed and signed in to GitHub?)")
    git(repo, "config", "core.autocrlf", "false")  # byte-for-byte files, so hashes match on Windows
    git(repo, "fetch", "--quiet", "origin", "main")
    git(repo, "checkout", "--quiet", "-B", "main", "origin/main")
    git(repo, "reset", "--quiet", "--hard", "origin/main")
    git(repo, "clean", "-fdq")


def rebuild(repo):
    script = repo / "scripts" / "build_index.py"
    if script.exists():
        r = subprocess.run([sys.executable, str(script)], cwd=str(repo), text=True,
                           stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        out = (r.stdout or "").strip().splitlines()
        log("rebuilt index: " + (out[0] if out else f"exit {r.returncode}"))


def summary_line(counts, projects, machine):
    bits = [f"{counts[k]} {k}" for k in ("push", "pull", "conflict", "archive", "trash") if counts.get(k)]
    names = ", ".join(projects[:4]) + (f" +{len(projects) - 4}" if len(projects) > 4 else "")
    return f"sync: vault from {machine} ({names}): {', '.join(bits) or 'state only'}"


def cmd_run(args):
    cfg = load_config()
    if not cfg["vault"].exists():
        die(f"vault folder {cfg['vault']} is missing. Run init again or fix config.json")
    try:
        list(cfg["vault"].iterdir())
    except PermissionError:
        die(f"no permission to read {cfg['vault']}. On a Mac, give Full Disk Access to "
            f"{os.path.realpath(sys.executable)} (System Settings > Privacy & Security).")
    pr_mode = args.pr or cfg.get("mode") == "pr"
    for attempt in range(1, 4):
        fresh_clone(cfg)
        counts, projects = apply(cfg, dry_run=args.dry_run)
        if args.dry_run:
            log("dry run, nothing written" if counts else "dry run: nothing to sync")
            return
        if not git(cfg["repo"], "status", "--porcelain", "--", "projects"):
            log("nothing to sync")
            return
        rebuild(cfg["repo"])
        git(cfg["repo"], "add", "-A")
        msg = summary_line(counts, projects, cfg["machine"])
        ident = []
        if not git(cfg["repo"], "config", "user.email", check=False):
            ident = ["-c", "user.name=brain-sync", "-c", "user.email=brain-sync@users.noreply.github.com"]
        git(cfg["repo"], *ident, "commit", "--quiet", "-m", msg + "\n\nAutomated by tools/vault-sync/brain_sync.py")
        if pr_mode:
            branch = f"vault-sync/{cfg['machine']}"
            git(cfg["repo"], "push", "--quiet", "--force", "origin", f"HEAD:refs/heads/{branch}")
            log(f"{msg}\npushed to branch {branch}. Open the PR: "
                f"https://github.com/YuvrajxGarg/second-brain/compare/main...{branch}?expand=1")
            return
        try:
            git(cfg["repo"], "push", "--quiet", "origin", "HEAD:main")
            log(msg + " -> pushed to main")
            return
        except RuntimeError as e:
            log(f"push rejected (attempt {attempt}/3), redoing the sync on top of the latest main: {e}")
    die("could not push after 3 attempts; your vault is untouched apart from pulled files. Try again later.")


def cmd_status(args):
    cfg = load_config()
    fresh_clone(cfg)
    *_, actions, skipped, missing = plan(cfg)
    for slug, d in missing:
        print(f"needs project.md  {d}")
    for p, why in skipped:
        print(f"skipped           {p}: {why}")
    real = [a for a in actions if a[0] not in ("mark", "forget")]
    for op, rel, _ in real:
        print(f"{op:17} {rel}")
    if not (real or missing):
        print("in sync")


# ---------------------------------------------------------------- setup

def write_template(d, title):
    d.mkdir(parents=True, exist_ok=True)
    today = dt.date.today().isoformat()
    for name, tpl in (("project.md", TEMPLATE_PROJECT), ("context.md", TEMPLATE_CONTEXT), ("todo.md", TEMPLATE_TODO),
                      ("log.md", TEMPLATE_LOG)):
        f = d / name
        if not f.exists():
            f.write_text(tpl.format(title=title, today=today), encoding="utf-8")


def cmd_init(args):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    cfg = json.loads(CONFIG.read_text(encoding="utf-8")) if CONFIG.exists() else {}
    default_machine = {"Darwin": "mac", "Windows": "windows"}.get(platform.system(), slugify(platform.node()))
    cfg["machine"] = slugify(args.machine or cfg.get("machine") or default_machine)
    cfg["vault"] = str(Path(args.vault).expanduser() if args.vault else Path(cfg.get("vault") or documents_dir() / "Vault"))
    cfg["repo"] = cfg.get("repo") or str(STATE_DIR / "second-brain")
    cfg["repo_url"] = cfg.get("repo_url") or REPO_URL
    cfg.setdefault("mode", "main")
    if args.pr:
        cfg["mode"] = "pr"
    vault = Path(cfg["vault"])
    vault.mkdir(parents=True, exist_ok=True)
    (vault / "README.md").write_text(VAULT_README, encoding="utf-8")
    tpl = vault / "_template"
    write_template(tpl, "Project name")
    CONFIG.write_text(json.dumps(cfg, indent=2) + "\n", encoding="utf-8")
    log(f"vault ready at {vault} (machine '{cfg['machine']}', mode {cfg['mode']}); config at {CONFIG}")
    fresh_clone(load_config())
    log("clone ready. Next: add projects, then run `schedule` to turn on the daily sync.")


def cmd_new(args):
    cfg = load_config()
    slug = slugify(args.name)
    if slug in project_dirs(cfg["vault"]):
        die(f"a project mapping to '{slug}' already exists")
    d = cfg["vault"] / args.name
    write_template(d, args.name)
    log(f"created {d}. Fill in project.md, then drop docs in.")


def cmd_schedule(args):
    hh, mm = (int(x) for x in args.time.split(":"))
    py = os.path.realpath(sys.executable)
    script = os.path.realpath(__file__)
    sysname = platform.system()
    if sysname == "Darwin":
        plist = HOME / "Library" / "LaunchAgents" / f"{LAUNCHD_LABEL}.plist"
        plist.parent.mkdir(parents=True, exist_ok=True)
        plist.write_text(f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>{LAUNCHD_LABEL}</string>
  <key>ProgramArguments</key><array><string>{py}</string><string>{script}</string><string>run</string></array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>{hh}</integer><key>Minute</key><integer>{mm}</integer></dict>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>StandardOutPath</key><string>{STATE_DIR / 'launchd.log'}</string>
  <key>StandardErrorPath</key><string>{STATE_DIR / 'launchd.log'}</string>
</dict></plist>
""", encoding="utf-8")
        subprocess.run(["launchctl", "unload", str(plist)], capture_output=True)
        subprocess.run(["launchctl", "load", "-w", str(plist)], check=True)
        log(f"daily sync scheduled at {args.time} via launchd ({plist}). Missed runs (asleep) happen on wake.")
        log(f"If runs log 'no permission', add {py} under System Settings > Privacy & Security > Full Disk Access.")
    elif sysname == "Windows":
        pyw = Path(py).with_name("pythonw.exe")
        exe = str(pyw if pyw.exists() else py)
        ps = (f"$a = New-ScheduledTaskAction -Execute '{exe}' -Argument '\"{script}\" run'; "
              f"$t = New-ScheduledTaskTrigger -Daily -At '{hh:02d}:{mm:02d}'; "
              "$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable "
              "-ExecutionTimeLimit (New-TimeSpan -Minutes 30); "
              f"Register-ScheduledTask -TaskName '{TASK_NAME}' -Action $a -Trigger $t -Settings $s "
              "-Description 'Sync Documents\\Vault into the second brain' -Force | Out-Null")
        subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], check=True)
        log(f"daily sync scheduled at {args.time} in Task Scheduler as '{TASK_NAME}'. Missed runs happen at next login.")
    else:
        log(f"no scheduler helper for {sysname}; add this to crontab -e:\n{mm} {hh} * * * {py} {script} run")


def cmd_unschedule(args):
    if platform.system() == "Darwin":
        plist = HOME / "Library" / "LaunchAgents" / f"{LAUNCHD_LABEL}.plist"
        subprocess.run(["launchctl", "unload", "-w", str(plist)], capture_output=True)
        if plist.exists():
            plist.unlink()
    elif platform.system() == "Windows":
        subprocess.run(["schtasks", "/Delete", "/TN", TASK_NAME, "/F"])
    log("daily sync removed")


def main():
    ap = argparse.ArgumentParser(description="Sync ~/Documents/Vault into the second brain.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("init")
    p.add_argument("--machine", help="short name for this computer (default: mac / windows)")
    p.add_argument("--vault", help="vault folder (default: Documents/Vault)")
    p.add_argument("--pr", action="store_true", help="push to a vault-sync/<machine> branch instead of main")
    p.set_defaults(fn=cmd_init)
    p = sub.add_parser("new")
    p.add_argument("name")
    p.set_defaults(fn=cmd_new)
    p = sub.add_parser("run")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--pr", action="store_true", help="this run only: push to a branch for a PR")
    p.set_defaults(fn=cmd_run)
    sub.add_parser("status").set_defaults(fn=cmd_status)
    p = sub.add_parser("schedule")
    p.add_argument("--time", default="21:30", help="daily time, 24h HH:MM (default 21:30)")
    p.set_defaults(fn=cmd_schedule)
    sub.add_parser("unschedule").set_defaults(fn=cmd_unschedule)
    args = ap.parse_args()
    try:
        args.fn(args)
    except RuntimeError as e:
        die(str(e))


if __name__ == "__main__":
    main()
