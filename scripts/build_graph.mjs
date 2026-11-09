#!/usr/bin/env node
// Builds site/data/graph.json (and copies note images) from topics/ and inbox/.
// No dependencies. Vercel runs this on every push; run it locally to preview:
//   node scripts/build_graph.mjs && npx serve site
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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

for (const n of notes) {
  const dir = path.posix.dirname(n.path);
  const related = new Set();
  let body = n.body
    // relative media -> copied media
    .replace(/(\]\()\.\/([^)\s]+)/g, (_, a, f) => `${a}data/media/${dir}/${f}`)
    // [[slug]] -> in-app link
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, s, label) => {
      s = s.trim();
      const target = bySlug.get(s);
      if (target) related.add(s);
      return `[${label || (target ? target.title : s)}](#/n/${encodeURIComponent(s)})`;
    });
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
    body,
    related: [...related],
  });
  addLink(n.id, "t:" + n.topic, "topic");
  for (const t of n.tags) addLink(n.id, "g:" + t, "tag");
  for (const s of related) addLink(n.id, "n:" + s, "wiki");
}

const graph = {
  generated: new Date().toISOString(),
  commit: sha(),
  repo: "https://github.com/YuvrajxGarg/second-brain",
  counts: { notes: notes.length, topics: Object.keys(topicCount).length, tags: Object.keys(tagCount).length, links: links.length },
  nodes,
  links,
};
fs.writeFileSync(path.join(OUT, "graph.json"), JSON.stringify(graph));
console.log(`graph: ${notes.length} notes, ${graph.counts.topics} topics, ${graph.counts.tags} tags, ${links.length} links`);
