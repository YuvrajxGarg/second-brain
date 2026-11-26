#!/usr/bin/env node
// Busy tags grow into categories (topics/<name>/). Same logic as the site
// (api/_categories.js), from a shell:
//
//   node scripts/categories.mjs check [--json]       proposals, crowded topics, strays
//   node scripts/categories.mjs promote <name> [--tags a,b] [--keep slug,slug] [--color #hex] [--dry]
//        makes topics/<name>/, moves every note tagged <name> (or its family, e.g.
//        revolio-labs) with its images, sets topic:, drops the <name> tag where 3+ tags
//        stay, rewrites canvas paths, records the colour in categories.json, then runs
//        link_doctor --fix, build_index and check_notes. Run it again later to pull in
//        notes filed elsewhere since (strays). Doesn't commit: the caller does, once.
//   node scripts/categories.mjs dismiss <name> [--why "..."]   never propose it again
//
// Promoting needs Yuvraj's yes unless categories.json has "mode": "auto" (his choice on
// 2026-11-26 was "propose": nothing moves until he says yes).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const C = require("../api/_categories.js");
const CONFIG = path.join(ROOT, "categories.json");

const [cmd, ...rest] = process.argv.slice(2);
const flags = {};
const args = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith("--")) {
    const k = rest[i].slice(2);
    flags[k] = rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[++i] : true;
  } else args.push(rest[i]);
}
const list = (v) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const readConfig = () => (fs.existsSync(CONFIG) ? JSON.parse(fs.readFileSync(CONFIG, "utf8")) : {});
const writeConfig = (c) => fs.writeFileSync(CONFIG, JSON.stringify(c, null, 2) + "\n");
const run = (bin, a, quiet) => execFileSync(bin, a, { cwd: ROOT, stdio: quiet ? ["ignore", "ignore", "inherit"] : "inherit" });

// Notes straight from the files (fresh, no build needed): the frontmatter fields detect() uses.
function loadNotes() {
  const out = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".md") && !e.name.startsWith("README") && !e.name.startsWith(".")) {
        const text = fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
        const fm = (text.match(/^---\n([\s\S]*?)\n---/) || [, ""])[1];
        const field = (k) => ((fm.match(new RegExp(`^${k}:\\s*(.*)$`, "m")) || [, ""])[1].split(" #")[0].trim().replace(/^["']|["']$/g, ""));
        const rel = path.relative(ROOT, p).split(path.sep).join("/");
        out.push({
          slug: path.basename(p, ".md"), path: rel, title: field("title"), kind: field("kind"), type: field("type"),
          topic: field("topic"), tags: field("tags").replace(/^\[|\]$/g, "").split(",").map((t) => t.trim().replace(/^["']|["']$/g, "")).filter(Boolean),
        });
      }
    }
  };
  walk(path.join(ROOT, "topics"));
  walk(path.join(ROOT, "inbox"));
  return out;
}

// git mv keeps history; a file not committed yet (a fresh capture) is just renamed.
function move(from, to) {
  try { execFileSync("git", ["mv", from, to], { cwd: ROOT, stdio: "ignore" }); }
  catch { fs.renameSync(path.join(ROOT, from), path.join(ROOT, to)); }
}

const MEDIA = /\.(png|jpe?g|gif|webp|svg|mp4|webm|mov)$/i;
function attachments(rel) {
  const dir = path.join(ROOT, path.dirname(rel));
  const base = path.basename(rel, ".md");
  return fs.readdirSync(dir).filter((f) => MEDIA.test(f) && f.startsWith(base) && /^(-\d+)?\.[a-z0-9]+$/i.test(f.slice(base.length)))
    .map((f) => path.posix.join(path.dirname(rel), f));
}

if (cmd === "check" || !cmd) {
  const d = C.detect(loadNotes(), readConfig());
  if (flags.json) { console.log(JSON.stringify(d, null, 2)); process.exit(0); }
  console.log(`mode: ${d.mode} · threshold ${d.threshold} notes (${d.entityThreshold} for your own orgs/projects) · split at ${d.splitAt}`);
  if (!d.proposals.length) console.log("No tag is busy enough to become a category.");
  for (const p of d.proposals) {
    console.log(`\n${p.name}${p.tags.length > 1 ? ` (${p.tags.join(" + ")})` : ""}: ${p.reason}`);
    console.log(`  from ${Object.entries(p.from).map(([t, c]) => `${t} ${c}`).join(", ")}${p.split ? ` · splits ${p.split}` : ""}`);
    console.log(`  yes: node scripts/categories.mjs promote ${p.name}   no: node scripts/categories.mjs dismiss ${p.name}`);
  }
  for (const s of d.strays) console.log(`stray: ${s.path} is tagged for ${s.into} (promote ${s.into} again to pull it in)`);
  for (const c of d.crowded.filter((c) => !c.proposed)) console.log(`crowded: ${c.topic} has ${c.count} notes, no clear split yet`);
} else if (cmd === "promote") {
  const name = args[0];
  const cfg = readConfig();
  const p = C.plan(loadNotes(), name, cfg, { tags: list(flags.tags), keep: list(flags.keep), color: flags.color });
  if (p.error) { console.error(p.error); process.exit(1); }
  console.log(`${p.name}: ${p.moves.length} notes from ${Object.entries(p.from).map(([t, c]) => `${t} ${c}`).join(", ")} · tags ${p.tags.join(", ")} · colour ${p.color}`);
  for (const m of p.moves) console.log(`  ${m.from} -> ${m.to}`);
  if (p.kept.length) console.log(`  staying put: ${p.kept.join(", ")}`);
  if (flags.dry) process.exit(0);
  fs.mkdirSync(path.join(ROOT, "topics", p.name), { recursive: true });
  for (const m of p.moves) {
    for (const a of attachments(m.from)) move(a, path.posix.join(`topics/${p.name}`, path.basename(a)));
    move(m.from, m.to);
    const f = path.join(ROOT, m.to);
    fs.writeFileSync(f, C.retopic(fs.readFileSync(f, "utf8"), p.name, p.name));
  }
  const cdir = path.join(ROOT, "canvases");
  for (const f of fs.existsSync(cdir) ? fs.readdirSync(cdir).filter((x) => x.endsWith(".canvas")) : []) {
    const out = C.fixCanvas(fs.readFileSync(path.join(cdir, f), "utf8"), p.moves);
    if (out) { fs.writeFileSync(path.join(cdir, f), out); console.log(`  canvas paths fixed: canvases/${f}`); }
  }
  writeConfig(C.recordCreated(cfg, p, today()));
  run("python3", ["scripts/link_doctor.py", "--fix"], true);
  run("python3", ["scripts/build_index.py"], true);
  run("python3", ["scripts/check_notes.py", ...p.moves.map((m) => m.to)]);
  console.log(`\nDone. Commit once: git add -A && git commit -m "move: ${p.name} becomes a category (${p.moves.length} note${p.moves.length === 1 ? "" : "s"})"`);
} else if (cmd === "dismiss") {
  const name = args[0];
  if (!name) { console.error("Which tag?"); process.exit(1); }
  writeConfig(C.recordDismissed(readConfig(), name, typeof flags.why === "string" ? flags.why : "", today()));
  console.log(`${name} won't be proposed as a category again (categories.json "dismissed").`);
} else {
  console.error("Usage: node scripts/categories.mjs check [--json] | promote <name> [--tags a,b] [--keep s,s] [--color #hex] [--dry] | dismiss <name> [--why text]");
  process.exit(1);
}
