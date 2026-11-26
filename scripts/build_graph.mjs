#!/usr/bin/env node
// Builds site/data/graph.json (and copies note images) from topics/ and inbox/.
// No dependencies. Vercel runs this on every push; run it locally to preview:
//   node scripts/build_graph.mjs && npx serve site
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const BR = createRequire(import.meta.url)("../api/_brief.js");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "site", "data");
const MEDIA_EXT = /\.(png|jpe?g|gif|webp|svg|mp4|webm|mov)$/i;

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });
}

function parse(file) {
  const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  const meta = {};
  if (m) {
    for (const line of m[1].split("\n")) {
      const i = line.indexOf(":");
      if (i < 0) continue;
      const k = line.slice(0, i).trim();
      let v = line.slice(i + 1).split(" #")[0].trim();
      meta[k] = v;
    }
  }
  const unq = (s) => (s || "").trim().replace(/^["']|["']$/g, "");
  const tags = unq(meta.tags)
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((t) => unq(t).toLowerCase())
    .filter(Boolean);
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const parts = rel.split("/");
  const topic = parts[0] === "inbox" ? "inbox" : parts[1];
  const slug = path.basename(file, ".md");
  return {
    id: "n:" + slug,
    slug,
    path: rel,
    title: unq(meta.title) || slug,
    type: unq(meta.type) || "note",
    topic,
    tags: [...new Set(tags)],
    source: unq(meta.source) || null,
    added: unq(meta.added) || slug.slice(0, 10),
    status: unq(meta.status) || null,
    kind: unq(meta.kind) || null,
    why: unq(meta.why) || null,
    stage: unq(meta.stage) || null,
    state: unq(meta.state) || null,
    stack: unq(meta.stack).replace(/^\[|\]$/g, "").split(",").map((t) => unq(t)).filter(Boolean),
    style: unq(meta.style).replace(/^\[|\]$/g, "").split(",").map((t) => unq(t)).filter(Boolean),
    kit: unq(meta.kit).replace(/^\[|\]$/g, "").split(",").map((t) => unq(t).toLowerCase()).filter(Boolean),
    body: m ? text.slice(m[0].length) : text,
  };
}

function sha() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
  } catch {
    return null;
  }
}

const files = ["topics", "inbox"].flatMap((d) => walk(path.join(ROOT, d)));
const notes = files.filter((f) => f.endsWith(".md")).map(parse);
const bySlug = new Map(notes.map((n) => [n.slug, n]));

// Vault projects (tools/vault-sync): projects/<slug>/project.md is ONE node; the other
// docs in that folder hang off it instead of becoming nodes. `note: <slug>` in project.md
// attaches the docs to an existing note instead.
const GH = "https://github.com/YuvrajxGarg/second-brain/blob/main/";
const PROJ = path.join(ROOT, "projects");
const projectFiles = walk(PROJ).filter((f) => !path.relative(PROJ, f).split(path.sep).some((p) => p.startsWith(".")));
for (const pm of projectFiles.filter((f) => path.basename(f) === "project.md" && path.dirname(path.dirname(f)) === PROJ)) {
  const dir = path.dirname(pm);
  const p = parse(pm);
  const meta = (fs.readFileSync(pm, "utf8").replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---/) || [, ""])[1];
  const field = (k) => ((meta.match(new RegExp(`^${k}:\\s*(.*)$`, "m")) || [, ""])[1].split(" #")[0].trim().replace(/^["']|["']$/g, ""));
  const docs = projectFiles
    .filter((f) => f !== pm && f.startsWith(dir + path.sep) && /\.(md|txt)$/i.test(f))
    .map((f) => ({
      path: path.relative(ROOT, f).split(path.sep).join("/"),
      name: path.relative(dir, f).split(path.sep).join("/"),
      body: fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n").trim(),
    }));
  const target = bySlug.get(field("note").replace(/^\d{4}-\d\d-\d\d-/, ""));
  if (target) {
    target.docs = [...(target.docs || []), ...docs];
    target.vaultDir = path.basename(dir);
    continue;
  }
  p.slug = path.basename(dir);
  p.id = "n:" + p.slug;
  p.topic = field("topic") || "tech";
  p.kind = p.kind || "project";
  p.added = field("added") || p.added;
  p.docs = docs;
  p.vault = true;
  notes.push(p);
  bySlug.set(p.slug, p);
}
for (const f of projectFiles.filter((f) => MEDIA_EXT.test(f))) files.push(f);

// Next steps and playtests for projects (Board cards, MCP catalog). First match wins:
// open items in the vault's todo.md, "Fix next" in the latest playtest, "Next" in the
// latest log entry, then the note's own ## Next. Same order as next_steps() in build_index.py.
const bulletsOf = (t) => (t || "").split("\n").map((l) => /^\s*[-*] (\[([ xX])\] )?(.+)/.exec(l)).filter((m) => m && !/[xX]/.test(m[2] || "")).map((m) => m[3].trim());
const latestEntry = (t) => { const parts = (t || "").split(/^## /m); return parts.length > 1 ? "## " + parts[1] : ""; };
function nextSteps(n) {
  const doc = (name) => (n.docs || []).find((d) => d.name === name)?.body || "";
  const todo = [...doc("todo.md").matchAll(/^\s*[-*] \[ \] (.+)$/gm)].map((m) => m[1].trim());
  if (todo.length) return todo;
  for (const [name, head] of [["playtests.md", "\\*\\*Fix next\\*\\*"], ["log.md", "\\*\\*Next\\*\\*"]]) {
    const m = new RegExp(head + "[ \\t]*\\n([\\s\\S]*?)(?=\\n\\*\\*|\\n## |$)").exec(latestEntry(doc(name)));
    if (m && bulletsOf(m[1]).length) return bulletsOf(m[1]);
  }
  const sec = /^#+ Next[ \t]*\n([\s\S]*?)(?=^#+ |(?![\s\S]))/m.exec(n.body || "");
  return sec ? bulletsOf(sec[1]) : [];
}
function playtestStats(n) {
  const t = (n.docs || []).find((d) => d.name === "playtests.md")?.body || "";
  const heads = [...t.matchAll(/^## (\d{4}-\d\d-\d\d)(?: · ([^\n·]+))?/gm)];
  return heads.length ? { count: heads.length, last: heads[0][1], build: (heads[0][2] || "").trim() } : null;
}
for (const n of notes) {
  if (n.kind !== "project") continue;
  const nx = nextSteps(n);
  if (nx.length) n.next = nx.slice(0, 5);
  const pt = playtestStats(n);
  if (pt) n.playtests = pt;
}

// keep links.json (written by scripts/link_doctor.py just before this) across the wipe
let linksJson = null;
try { linksJson = fs.readFileSync(path.join(OUT, "links.json"), "utf8"); } catch {}
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// Copy media next to its note, and point embeds at the copied files.
for (const f of files.filter((f) => MEDIA_EXT.test(f))) {
  const rel = path.relative(ROOT, f);
  const dest = path.join(OUT, "media", rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(f, dest);
}

const nodes = [];
const links = [];
const linkKeys = new Set();
const addLink = (source, target, kind) => {
  const key = [source, target].sort().join("|") + "|" + kind;
  if (source === target || linkKeys.has(key)) return;
  linkKeys.add(key);
  links.push({ source, target, kind });
};

const topicCount = {};
const tagCount = {};
for (const n of notes) {
  topicCount[n.topic] = (topicCount[n.topic] || 0) + 1;
  for (const t of n.tags) tagCount[t] = (tagCount[t] || 0) + 1;
}

for (const [t, c] of Object.entries(topicCount)) nodes.push({ id: "t:" + t, kind: "topic", label: t, topic: t, count: c });
for (const [t, c] of Object.entries(tagCount)) nodes.push({ id: "g:" + t, kind: "tag", label: t, count: c });

// link health from scripts/link_doctor.py (run by build_index.py just before this)
let doctor = { scores: {}, weak: [], suggest: {}, mentions: {}, health: null, counts: null };
try { if (linksJson) { doctor = { ...doctor, ...JSON.parse(linksJson) }; fs.writeFileSync(path.join(OUT, "links.json"), linksJson); } } catch {}
const weakSet = new Set(doctor.weak);
const backlinks = new Map();

for (const n of notes) {
  const dir = path.posix.dirname(n.path);
  const related = new Set();
  let body = n.body
    // relative media -> copied media
    .replace(/(\]\()\.\/([^)\s]+)/g, (_, a, f) => `${a}data/media/${dir}/${f}`)
    // [[slug]] -> in-app link
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, s, label) => {
      s = s.trim();
      if (!bySlug.has(s)) s = s.replace(/^\d{4}-\d\d-\d\d-/, ""); // old date-first slug
      const target = bySlug.get(s);
      if (target) related.add(s);
      return `[${label || (target ? target.title : s)}](#/n/${encodeURIComponent(s)})`;
    });
  if (n.docs?.length) {
    body += "\n\n## Vault docs\n\n" + n.docs.map((d) => `- [${d.name}](${GH}${d.path})`).join("\n") + "\n";
  }
  nodes.push({
    id: n.id,
    kind: "note",
    label: n.title,
    slug: n.slug,
    path: n.path,
    type: n.type,
    topic: n.topic,
    tags: n.tags,
    source: n.source,
    added: n.added,
    status: n.status,
    noteKind: n.kind, // "kind" is taken by the node kind (note|tag|topic)
    why: n.why,
    stage: n.stage,
    style: n.style,
    state: n.state,
    stack: n.stack,
    kit: n.kit,
    next: n.next || null,
    playtests: n.playtests || null,
    body,
    related: [...related],
    suggest: (doctor.suggest[n.slug] || []).filter((x) => bySlug.has(x.to)).map((x) => [x.to, x.score, x.reason]),
    mentions: (doctor.mentions[n.slug] || []).filter((s) => bySlug.has(s)),
    vault: !!n.vault,
  });
  for (const s of related) {
    if (!backlinks.has(s)) backlinks.set(s, []);
    backlinks.get(s).push(n.slug);
  }
  addLink(n.id, "t:" + n.topic, "topic");
  for (const t of n.tags) addLink(n.id, "g:" + t, "tag");
  for (const s of related) addLink(n.id, "n:" + s, "wiki");
}
for (const node of nodes) if (node.kind === "note") node.backlinks = backlinks.get(node.slug) || [];
for (const l of links) {
  if (l.kind !== "wiki") continue;
  const a = l.source.slice(2), b = l.target.slice(2);
  const sc = doctor.scores[a + "|" + b] ?? doctor.scores[b + "|" + a];
  if (sc != null) l.score = sc;
  if (weakSet.has(a + "|" + b) || weakSet.has(b + "|" + a)) l.weak = true;
}

// Notes as the MCP server and api/_brief.js see them (vault docs folded into the body).
const summaryOf = (body) => ((body.match(/## Summary\n+([\s\S]*?)(\n\n|\n##|$)/) || [])[1] || "").trim().replace(/\n/g, " ");
const brainNotes = notes
  .map(({ body, docs, ...n }) => ({
    ...n,
    summary: summaryOf(body),
    // vault docs ride along in the body so MCP search and fetch see them
    body: (body.trim() + (docs || []).map((d) => `\n\n## Vault doc: ${d.name}\n\n${d.body.slice(0, 20000)}`).join("")).trim(),
  }))
  .sort((a, b) => (b.added || "").localeCompare(a.added || ""));
// Context-aware resurfacing: unread saves that fit what he is building now (projects with
// recent log entries). The site's FROM YOUR PILE card shows these first.
const focus = BR.focusPicks(brainNotes).map(({ slug, project, projectSlug, score }) => ({ slug, project, projectSlug, score }));

const graph = {
  generated: new Date().toISOString(),
  commit: sha(),
  repo: "https://github.com/YuvrajxGarg/second-brain",
  counts: { notes: notes.length, topics: Object.keys(topicCount).length, tags: Object.keys(tagCount).length, links: links.length },
  linkHealth: doctor.health,
  focus,
  nodes,
  links,
};
fs.writeFileSync(path.join(OUT, "graph.json"), JSON.stringify(graph));

// Canvas moodboards (canvases/*.canvas, JSON Canvas format) and saved views (views/*.json)
// for site/canvas.html and site/gallery.html. Bad JSON is skipped, never fatal.
const readJsonDir = (dir, ext) => walk(path.join(ROOT, dir)).filter((f) => f.endsWith(ext)).sort().flatMap((f) => {
  try { return [{ id: path.basename(f, ext), path: path.relative(ROOT, f).split(path.sep).join("/"), data: JSON.parse(fs.readFileSync(f, "utf8")) }]; }
  catch { console.warn("skipped bad JSON:", f); return []; }
});
const canvases = readJsonDir("canvases", ".canvas");
fs.writeFileSync(path.join(OUT, "canvases.json"), JSON.stringify(canvases));
const savedViews = readJsonDir("views", ".json");
fs.writeFileSync(path.join(OUT, "views.json"), JSON.stringify(savedViews));
console.log(`canvases: ${canvases.length}, saved views: ${savedViews.length}`);
console.log(`focus: ${focus.length} unread saves fit active projects`);
console.log(`graph: ${notes.length} notes, ${graph.counts.topics} topics, ${graph.counts.tags} tags, ${links.length} links`);

// ---------- AI-facing files ----------
// brain.json feeds the MCP server (api/mcp.js); the text files are served at the
// site root so any agent can fetch /llms.txt, /AGENTS.md, /TASTE.md.
const readRoot = (f) => (fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f), "utf8") : "");
const catalogs = {};
for (const f of fs.existsSync(path.join(ROOT, "catalog")) ? fs.readdirSync(path.join(ROOT, "catalog")) : []) {
  if (f.endsWith(".md")) catalogs[f.replace(/\.md$/, "")] = readRoot(path.join("catalog", f));
}
const brain = {
  generated: graph.generated,
  commit: graph.commit,
  site: "https://brainy.pxlvzn.in",
  repo: graph.repo,
  agents: readRoot("AGENTS.md"),
  taste: readRoot("TASTE.md"),
  checks: readRoot("CHECKS.md"),
  ideas: readRoot("IDEAS.md"),
  catalogs,
  notes: brainNotes,
};
fs.writeFileSync(path.join(OUT, "brain.json"), JSON.stringify(brain));
for (const f of ["llms.txt", "llms-full.txt", "AGENTS.md", "TASTE.md", "IDEAS.md", "ME.md", "CHECKS.md"]) {
  if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(ROOT, "site", f));
}
console.log(`brain: ${brain.notes.length} notes, ${Object.keys(catalogs).length} catalogs`);
