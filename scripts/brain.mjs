#!/usr/bin/env node
// Use what you've saved, from a shell (the same logic as the MCP tools, api/_brief.js):
//
//   node scripts/brain.mjs brief <project>          briefing before working on a project
//   node scripts/brain.mjs brief --about "<text>"   briefing for new work with no project yet
//   node scripts/brain.mjs pick [--json]            today's resurface pick, matched to active projects
//   node scripts/brain.mjs digest [--write]         weekly digest; --write saves digests/YYYY-MM-DD.md
//   node scripts/brain.mjs start <idea> [--title T] [--type game|app|tool|site|concept]
//                                [--stack a,b] [--share full|summary|none]
//                                                   turn an idea note into projects/<slug>/
//
// It reads site/data/brain.json, rebuilding it first (node scripts/build_graph.mjs) when
// it is missing or older than the newest note. No dependencies.
import fs from "node:fs";
import path from "node:path";
import { execSync, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const B = require("../api/_brief.js");
const BRAIN = path.join(ROOT, "site", "data", "brain.json");

const [cmd, ...rest] = process.argv.slice(2);
const flags = {};
const args = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith("--")) {
    const k = rest[i].slice(2);
    flags[k] = rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[++i] : true;
  } else args.push(rest[i]);
}

function newest(dir) {
  let t = 0;
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith(".md")) t = Math.max(t, fs.statSync(p).mtimeMs);
    }
  };
  walk(dir);
  return t;
}
function loadBrain() {
  const stale = !fs.existsSync(BRAIN) || ["topics", "inbox", "projects"].some((d) => newest(path.join(ROOT, d)) > fs.statSync(BRAIN).mtimeMs) ||
    ["TASTE.md", "CHECKS.md"].some((f) => fs.existsSync(path.join(ROOT, f)) && fs.statSync(path.join(ROOT, f)).mtimeMs > fs.statSync(BRAIN).mtimeMs);
  if (stale) execSync("node scripts/build_graph.mjs", { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
  return JSON.parse(fs.readFileSync(BRAIN, "utf8"));
}
const lastCommit = (p) => {
  try { return execFileSync("git", ["log", "-1", "--format=%cs", "--", p], { cwd: ROOT }).toString().trim() || null; } catch { return null; }
};
const url = (n) => `${B.SITE}/#/n/${encodeURIComponent(n.slug)}`;
// Notes already resurfaced by the daily run (suggestions/*.md `resurfaced:`).
function resurfaced() {
  const dir = path.join(ROOT, "suggestions");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^\d{4}-\d\d-\d\d\.md$/.test(f))
    .map((f) => (fs.readFileSync(path.join(dir, f), "utf8").match(/^resurfaced:\s*(\S+)/m) || [])[1]).filter(Boolean);
}

function brief() {
  const r = B.briefing(loadBrain(), flags.about ? { about: String(flags.about) } : { project: args.join(" ") });
  if (r.error) { console.error(r.error); process.exit(1); }
  console.log(r.text);
}

function pick() {
  const brain = loadBrain();
  const today = B.istToday();
  const picks = B.focusPicks(brain.notes, today, { exclude: resurfaced() });
  if (flags.json) return console.log(JSON.stringify({ active: B.activeProjects(brain.notes, today).map((a) => ({ project: a.n.title, last: a.last })), picks }, null, 1));
  if (!picks.length) return console.log("No unread save fits an active project; pick from the whole pile as before.");
  const p = picks[0];
  console.log(`${p.slug}\t${p.title}\tfits ${p.project}\t${p.why || ""}`);
}

function digest() {
  const brain = loadBrain();
  const notes = brain.notes;
  const today = B.istToday();
  const since = new Date(Date.parse(today) - 7 * 86400000).toISOString().slice(0, 10);
  const own = (n) => !n.vault;
  const saved = notes.filter((n) => own(n) && (n.added || "") > since && !["project", "org"].includes(n.kind));
  const byKind = {};
  for (const n of saved) byKind[n.kind || "other"] = (byKind[n.kind || "other"] || 0) + 1;
  const pile = notes.filter((n) => !B.NOT_PILE.has(n.kind) && (n.status || "unread") === "unread");
  const ideas = notes.filter((n) => ["idea", "todo"].includes(n.kind) && ["new", "exploring", ""].includes(n.stage || ""));
  const stale = ideas.map((n) => ({ n, touched: lastCommit(n.path) || n.added })).filter((x) => B.daysBetween(x.touched, today) >= 21).sort((a, b) => a.touched.localeCompare(b.touched));
  const projects = notes.filter(B.isProject);
  const worked = projects.map((p) => ({ p, logs: B.logEntries(B.doc(p, "log.md")).filter((e) => e.date > since) })).filter((x) => x.logs.length);
  const quiet = B.activeProjects(notes, today, 60).filter((a) => B.daysBetween(a.last, today) >= 14);
  const links = fs.existsSync(path.join(ROOT, "LINKS.md")) ? fs.readFileSync(path.join(ROOT, "LINKS.md"), "utf8") : "";
  const health = (links.match(/health[^0-9]{0,40}(\d{1,3})\s*\/\s*100/i) || [])[1] || "?";
  const focus = B.focusPicks(notes, today, { exclude: resurfaced() }).slice(0, 2);

  const md = [
    "---",
    `date: ${today}`,
    `saved: ${saved.length}`,
    `unread: ${pile.length}`,
    `link_health: ${health}`,
    "---",
    "",
    `# Week to ${today}`,
    "",
    `## Saved this week (${saved.length})`,
    saved.length ? Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(([k, c]) => `${c} ${k}`).join(", ") : "Nothing new.",
    ...saved.slice(0, 8).map((n) => `- [${n.title}](${url(n)}) (${n.kind}, ${n.topic})`),
    "",
    `## Unread pile (${pile.length})`,
    ...(pile.length ? ["Oldest:"] : []),
    ...pile.slice().sort((a, b) => (a.added || "").localeCompare(b.added || "")).slice(0, 3).map((n) => `- [${n.title}](${url(n)}) (${n.added}) ${B.clip(n.why, 80)}`),
    "",
    `## Ideas nobody touched in 3+ weeks (${stale.length} of ${ideas.length} open)`,
    ...(stale.length ? stale.slice(0, 4).map(({ n, touched }) => `- [${n.title}](${url(n)}) (last touched ${touched}) ${B.clip(n.why, 80)}`) : ["- none"]),
    "",
    "## Projects",
    ...(worked.length ? worked.map(({ p, logs }) => `- ${p.title}: ${logs.length} log ${logs.length > 1 ? "entries" : "entry"}, last "${logs[0].head}"`) : ["- no project logs this week"]),
    ...quiet.map(({ n, last }) => `- ${n.title}: quiet since ${last}`),
    "",
    "## For what you're building",
    ...(focus.length ? focus.map((f) => `- [${f.title}](${B.SITE}/#/n/${encodeURIComponent(f.slug)}) fits ${f.project}. ${B.clip(f.why, 80)}`) : ["- no unread save matches an active project"]),
    "",
    `## Link health: ${health}/100`,
    "",
  ].join("\n");

  const line2 = [
    stale.length && `${stale.length} idea${stale.length > 1 ? "s" : ""} untouched 3+ weeks${stale[0] ? ` (oldest: ${stale[0].n.title})` : ""}`,
    worked.length && `worked on ${worked.map((w) => w.p.title).join(", ")}`,
  ].filter(Boolean).join(" · ");
  const msg = [
    `Week: ${saved.length} saved${saved.length ? ` (${Object.entries(byKind).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, c]) => `${c} ${k}`).join(", ")})` : ""}. ${pile.length} unread. Links ${health}/100.`,
    line2,
    focus[0] ? `Read next: ${focus[0].title}, fits ${focus[0].project}` : pile[0] ? `Read next: ${pile[pile.length - 1].title}` : "",
  ].filter(Boolean).join("\n");

  if (flags.write) {
    fs.mkdirSync(path.join(ROOT, "digests"), { recursive: true });
    fs.writeFileSync(path.join(ROOT, "digests", `${today}.md`), md);
    console.error(`wrote digests/${today}.md`);
  } else console.log(md);
  console.log(msg);
}

function start() {
  const brain = loadBrain();
  const id = args.join(" ").trim();
  const idea = brain.notes.find((n) => n.slug === id || B.shortId(n) === id || n.title.toLowerCase() === id.toLowerCase());
  if (!idea) { console.error(`No note '${id}'.`); process.exit(1); }
  const taken = fs.existsSync(path.join(ROOT, "projects")) ? fs.readdirSync(path.join(ROOT, "projects")).filter((d) => !d.startsWith(".")) : [];
  const r = B.ideaToProject(idea, brain.notes, { title: flags.title, type: flags.type, stack: flags.stack, share: flags.share, takenDirs: taken });
  if (r.error) { console.error(r.error); process.exit(1); }
  for (const f of r.files) {
    fs.mkdirSync(path.dirname(path.join(ROOT, f.path)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, f.path), f.content);
  }
  const ip = path.join(ROOT, idea.path);
  fs.writeFileSync(ip, B.markIdeaStarted(fs.readFileSync(ip, "utf8").replace(/\r\n/g, "\n"), r.dir));
  console.log(`Created projects/${r.dir}/ (project.md, context.md, todo.md, log.md), linked ${r.refs.length} notes; ${idea.path} is now stage doing.`);
  console.log(`Commit: git add projects/${r.dir} ${idea.path} && git commit -m "add: project ${r.title} from idea"`);
}

const CMDS = { brief, pick, digest, start };
if (!CMDS[cmd]) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 12).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  process.exit(cmd ? 1 : 0);
}
CMDS[cmd]();
