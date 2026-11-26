// Write tools for the brain's MCP server (api/mcp.js): file a note, add to a note, log a
// project, from ANY chat that has the connector with the capture key. The `_` prefix keeps
// Vercel from serving this file as its own function.
//
// Locked by CAPTURE_KEY (Vercel env, 16+ chars). claude.ai connectors can only send a URL,
// so the key rides in it: https://brainy.pxlvzn.in/mcp?key=<CAPTURE_KEY> (a Bearer header
// works too). Without the key these tools are not even listed, and the public URL stays
// read-only. Commits go to main through GITHUB_TOKEN (same token as api/edit.js).
//
// Every write is add-only (no deletes, no overwrites of his words) and each one is one
// commit, so anything wrong is a `git revert`. The filing rules from CLAUDE.md that code
// can check are enforced here (CHECKS.md B1-B7), so a chat can't file a bad note.

const crypto = require("node:crypto");
const BR = require("./_brief.js");

const REPO = process.env.GITHUB_REPO || "YuvrajxGarg/second-brain";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const API = "https://api.github.com";

const TYPES = ["link", "note", "idea", "bookmark", "quote", "video", "tool", "book", "person", "place", "recipe", "todo", "game", "app", "site", "concept", "company"];
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const KIT = ["grade", "sound", "vfx", "motion", "shoot", "edit", "3d", "2d"]; // mirrors KIT in scripts/build_index.py
const THIRD_PERSON = /\b(his own|yuvraj'?s|added as context)\b/i;
const MAX_IMAGE = 4_500_000;

// ---------- auth ----------

function keyOf(req) {
  const q = req.query && req.query.key;
  if (q) return String(Array.isArray(q) ? q[0] : q);
  try {
    const u = new URL(req.url || "/", "http://x");
    if (u.searchParams.get("key")) return u.searchParams.get("key");
  } catch {}
  return String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
}

function sameSecret(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

const fails = new Map();
// "ok" (key valid), "none" (no key given: read-only), "bad" (wrong key, or locked out).
function access(req) {
  if (req._brainAccess) return req._brainAccess;
  return (req._brainAccess = checkAccess(req));
}
function checkAccess(req) {
  const want = process.env.CAPTURE_KEY;
  const given = keyOf(req);
  if (!given) return "none";
  if (!want || want.length < 16 || !process.env.GITHUB_TOKEN) return "none";
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
  const f = fails.get(ip);
  if (f && f.n >= 8 && Date.now() - f.at < 15 * 60_000) return "bad";
  if (sameSecret(given, want)) return "ok";
  fails.set(ip, { n: (f && Date.now() - f.at < 15 * 60_000 ? f.n : 0) + 1, at: Date.now() });
  return "bad";
}

// ---------- GitHub ----------

async function gh(method, url, body) {
  const r = await fetch(url.startsWith("http") ? url : `${API}/repos/${REPO}${url}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "second-brain-capture",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error((data && data.message) || `GitHub ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return data;
}

const enc = (p) => p.split("/").map(encodeURIComponent).join("/");
async function getFile(path) {
  const f = await gh("GET", `/contents/${enc(path)}?ref=${BRANCH}`);
  return Buffer.from(f.content, "base64").toString("utf8");
}

// Every path on main, one call. Used for slugs, topics, related notes and projects.
async function tree() {
  const ref = await gh("GET", `/git/ref/heads/${BRANCH}`);
  const t = await gh("GET", `/git/trees/${ref.object.sha}?recursive=1`);
  return { head: ref.object.sha, paths: t.tree.filter((x) => x.type === "blob").map((x) => x.path) };
}

// One commit for the note, its image and any backlinks. Retries once if main moved.
async function commit(message, writes) {
  for (let attempt = 0; ; attempt++) {
    try {
      const ref = await gh("GET", `/git/ref/heads/${BRANCH}`);
      const head = ref.object.sha;
      const c = await gh("GET", `/git/commits/${head}`);
      const items = writes.map((w) => (w.sha ? { path: w.path, mode: "100644", type: "blob", sha: w.sha } : { path: w.path, mode: "100644", type: "blob", content: w.content }));
      const t = await gh("POST", "/git/trees", { base_tree: c.tree.sha, tree: items });
      const next = await gh("POST", "/git/commits", { message, tree: t.sha, parents: [head] });
      await gh("PATCH", `/git/refs/heads/${BRANCH}`, { sha: next.sha, force: false });
      return next.sha;
    } catch (e) {
      if (attempt || (e.status !== 409 && e.status !== 422)) throw e;
    }
  }
}

// ---------- helpers ----------

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const oneLine = (s) => String(s || "").replace(/[\r\n]+/g, " ").trim();
const yamlStr = (s) => {
  s = oneLine(s);
  return /^[\w(][^:#]*$/.test(s) && !/^(true|false|yes|no|null)$/i.test(s) ? s : JSON.stringify(s);
};
const list = (v) => (Array.isArray(v) ? v : String(v || "").split(",")).map((x) => oneLine(x)).filter(Boolean);
const slugify = (s, max = 6) =>
  String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "")
    .split(/[^a-z0-9]+/).filter(Boolean).slice(0, max).join("-");
const slugOf = (p) => p.slice(p.lastIndexOf("/") + 1, -3);
const isNotePath = (p) => /^(topics\/[a-z0-9-]+|inbox)\/[^/]+\.md$/.test(p) && !/\/(README|\.)/.test(p);

// Same link, different tracking junk: x.com/a/status/1?s=20 == twitter.com/a/status/1
function normUrl(u) {
  try {
    const x = new URL(String(u).trim());
    let host = x.hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
    if (host === "twitter.com") host = "x.com";
    if (host === "youtu.be") return `youtube.com/watch?v=${x.pathname.slice(1)}`;
    const keep = host === "youtube.com" ? ["v"] : host === "x.com" || host === "instagram.com" ? [] : null;
    const params = [...x.searchParams].filter(([k]) => (keep ? keep.includes(k) : !/^(utm_|igsh|si$|s$|t$|ref|fbclid|gclid)/i.test(k)));
    const q = params.length ? "?" + params.map(([k, v]) => `${k}=${v}`).join("&") : "";
    return host + x.pathname.replace(/\/+$/, "") + q;
  } catch {
    return String(u || "").trim().toLowerCase();
  }
}

const field = (text, k) => ((text.match(new RegExp(`^${k}:[ \\t]*(.*)$`, "m")) || [, ""])[1].replace(/\s+#.*$/, "").trim().replace(/^["']|["']$/g, ""));

function notesSection(text) {
  const m = /^## Notes[ \t]*\n/m.exec(text);
  if (!m) return null;
  const start = m.index + m[0].length;
  const nx = text.slice(start).search(/^## /m);
  return { start, end: nx < 0 ? text.length : start + nx };
}
function addNoteLine(text, line) {
  const sec = notesSection(text);
  if (!sec) return text.replace(/\n*$/, "") + "\n\n## Notes\n" + line + "\n";
  const body = text.slice(sec.start, sec.end).replace(/\n+$/, "");
  const tail = text.slice(sec.end);
  return text.slice(0, sec.start) + (body ? body + "\n" : "") + line + "\n" + (tail ? "\n" + tail : "");
}
function appendToSection(text, heading, add) {
  const m = new RegExp(`^## ${heading}[ \\t]*\\n`, "m").exec(text);
  if (!m) return text.replace(/\n*$/, "") + `\n\n## ${heading}\n${add}\n`;
  const start = m.index + m[0].length;
  const nx = text.slice(start).search(/^## /m);
  const end = nx < 0 ? text.length : start + nx;
  const body = text.slice(start, end).replace(/\n+$/, "");
  return text.slice(0, start) + body + "\n\n" + add + "\n" + (nx < 0 ? "" : "\n" + text.slice(end));
}
function setField(text, k, v) {
  const m = text.match(/^---\n[\s\S]*?\n---/);
  if (!m) return text;
  let fm = m[0];
  const re = new RegExp(`^${k}:.*$`, "m");
  fm = re.test(fm) ? fm.replace(re, `${k}: ${v}`) : fm.replace(/\n---$/, `\n${k}: ${v}\n---`);
  return fm + text.slice(m[0].length);
}

// Notes on main that the deployed brain.json doesn't have yet (batched deploys), so
// duplicate checks also see what other chats filed since the last deploy.
async function pendingNotes(brain) {
  if (!brain.commit) return [];
  try {
    const cmp = await gh("GET", `/compare/${brain.commit}...${BRANCH}`);
    const files = (cmp.files || []).filter((f) => f.status !== "removed" && isNotePath(f.filename)).slice(0, 20);
    return Promise.all(files.map(async (f) => {
      const t = await getFile(f.filename).catch(() => "");
      return { slug: slugOf(f.filename), path: f.filename, title: field(t, "title"), source: field(t, "source") || null, kind: field(t, "kind") };
    }));
  } catch {
    return [];
  }
}

function findNote(id, brain, paths) {
  const want = String(id || "").trim().replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "");
  const p = paths.find((x) => isNotePath(x) && slugOf(x).replace(/^\d{4}-\d{2}-\d{2}-/, "") === want);
  if (p) return p;
  const n = brain.notes.find((x) => x.title.toLowerCase() === want.toLowerCase());
  return n && paths.includes(n.path) ? n.path : null;
}

const MEDIA_EXT = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };
async function imageBlob(url) {
  const r = await fetch(url, { headers: { "User-Agent": "second-brain-capture" } });
  if (!r.ok) throw new Error(`image fetch ${r.status}`);
  const type = (r.headers.get("content-type") || "").split(";")[0].trim();
  if (!MEDIA_EXT[type]) throw new Error(`not a png/jpg/gif/webp image (${type || "unknown type"})`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX_IMAGE) throw new Error("image over 4.5 MB");
  const blob = await gh("POST", "/git/blobs", { content: buf.toString("base64"), encoding: "base64" });
  return { sha: blob.sha, ext: MEDIA_EXT[type] };
}

// ---------- the checks (same as scripts/check_notes.py, CHECKS.md B1-B7) ----------

function problems(a, kinds, stages, topics) {
  const out = [];
  const title = oneLine(a.title);
  const words = title.split(/\s+/).filter(Boolean).length;
  if (!title) out.push("title is missing");
  else if (/[:,;]| - | — /.test(title)) out.push(`title has a subtitle or punctuation: "${title}". Use 2-4 words, name + what it is`);
  else if (words < 2 || words > 4) out.push(`title is ${words} words: "${title}". Use 2-4 words, name + what it is`);
  if (!TYPES.includes(a.type)) out.push(`type must be one of ${TYPES.join(", ")}`);
  if (!kinds.includes(a.kind)) out.push(`kind must be one of ${kinds.join(", ")}`);
  if ((a.kind === "project" || a.kind === "org") && a.type === "note") out.push("kind project/org needs type game/app/tool/site/concept/company, never note");
  if (!oneLine(a.why)) out.push("why is missing: his reason in his words, or a short plain reason");
  else if (THIRD_PERSON.test(a.why)) out.push("why talks about him in the third person; write it the way he would");
  if (["idea", "todo"].includes(a.kind) && !stages.includes(a.stage)) out.push(`kind ${a.kind} needs stage (${stages.join("/")})`);
  const tags = list(a.tags);
  const bad = tags.filter((t) => !KEBAB.test(t));
  if (bad.length) out.push(`tags must be lowercase kebab-case, singular: ${bad.join(", ")}`);
  if (tags.length < 1 || tags.length > 6) out.push(`${tags.length} tags; use 3-6 (fewer accurate beats padded)`);
  if (a.topic !== "inbox" && !topics.includes(a.topic)) out.push(`topic must be an existing folder: ${topics.join(", ")} (or inbox if unsure)`);
  if (!oneLine(a.summary)) out.push("summary is missing: 1-3 sentences in your words");
  if (!String(a.raw || "").trim()) out.push("raw is missing: exactly what he sent, never dropped");
  if (a.source && !/^https?:\/\//.test(String(a.source))) out.push("source must be a full http(s) URL");
  const badKit = list(a.kit).filter((k) => !KIT.includes(k));
  if (badKit.length) out.push(`kit areas must be from ${KIT.join(", ")}: got ${badKit.join(", ")}`);
  return out;
}

// ---------- tools ----------

const CAPTURE = {
  name: "capture",
  title: "File a note into the brain",
  description:
    "File ONE thing Yuvraj wants to keep (a link, thought, idea, quote, tool, screenshot described in words) as a note in his second brain, committed to GitHub. Follow the capture-to-brain skill, or AGENTS.md 'Writing'. Search first: if a note already covers it, use update_note instead. The server checks the filing rules (2-4 word title, kebab tags, required fields) and refuses duplicates of the same link, including ones filed since the last deploy. Unsure of the topic or what it is? Ask him in one line, or use topic 'inbox' so it gets sorted later. Project work (a build, an edit job) is not a note: use log_project.",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string", description: "2-4 words: the name plus what it is, e.g. 'Godot waterfall shader'. No colons, commas or subtitles." },
      type: { type: "string", enum: TYPES },
      topic: { type: "string", description: "Existing topic folder (ai, tech, business, design, productivity, health, finance, learning, life, misc, gamedev...) or 'inbox' if unsure. Games, game tools, assets and game-dev techniques go in gamedev." },
      tags: { type: "array", items: { type: "string" }, description: "3-6 lowercase kebab-case singular tags for what it IS and what it's for (to-try, reference, inspiration). Never from words that just happen to be in a name or URL. Reuse existing tags." },
      kind: { type: "string", description: "What it is useful as: style-ref, website-ref, game-ref, library, asset-source, tool, technique, advice, idea, thought, todo, project, org." },
      why: { type: "string", description: "His reason for saving it, in his words when he gave one. Never third person." },
      style: { type: "array", items: { type: "string" }, description: "Visual things only: 2-5 short descriptors of the look, no commas inside one." },
      kit: { type: "array", items: { type: "string", enum: KIT }, description: "Only for things he'd use on a shoot, in an edit or in a game build (LUTs, SFX packs, effects, plugins, asset packs, footage tools, shoot guides): grade, sound, vfx, motion, shoot, edit, 3d, 2d. Puts it in his asset library." },
      stage: { type: "string", description: "kind idea/todo only: new, exploring, doing, done, dropped. Usually new." },
      source: { type: "string", description: "The link, if there is one." },
      summary: { type: "string", description: "1-3 sentences in your own words: what it is and why it was saved. For a link, from actually reading it; if it couldn't be read, say so. For an image, describe what's in it so it's searchable." },
      raw: { type: "string", description: "Exactly what he sent, verbatim." },
      related: {
        type: "array",
        maxItems: 4,
        items: { type: "object", properties: { id: { type: "string" }, reason: { type: "string" } }, required: ["id", "reason"], additionalProperties: false },
        description: "2-3 notes it really relates to (ids from search), each with a short plain reason. Backlinks are added to them.",
      },
      image_url: { type: "string", description: "Optional: a public png/jpg/gif/webp URL (e.g. the post photo or a frame) to save next to the note." },
    },
    required: ["title", "type", "topic", "tags", "kind", "why", "summary", "raw"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
};

const UPDATE = {
  name: "update_note",
  title: "Add to an existing note",
  description:
    "Add to a note that already exists instead of making a copy: append his new words under ## Raw (dated), add a line or related links under ## Notes, or move an idea's stage / a note's status. Never rewrites what is there.",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Note id (slug) from search or capture." },
      raw: { type: "string", description: "His new words, verbatim; appended to ## Raw with today's date." },
      note: { type: "string", description: "One line to add under ## Notes (a follow-up, a correction, a new finding)." },
      related: { type: "array", maxItems: 4, items: { type: "object", properties: { id: { type: "string" }, reason: { type: "string" } }, required: ["id", "reason"], additionalProperties: false } },
      stage: { type: "string", description: "idea/todo only: new, exploring, doing, done, dropped (when he says he started, finished or dropped it)." },
      status: { type: "string", enum: ["unread", "read", "done", "archived"] },
    },
    required: ["id"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
};

const LOG = {
  name: "log_project",
  title: "Log project work",
  description:
    "For 'log this' at the end of work on one of his projects (a build, an edit job, a client project): adds a dated entry, newest first, to projects/<slug>/log.md; the daily vault sync copies it into Documents/Vault/<Project>/log.md. Follow the log-to-brain skill for what goes in the entry. Finds the project by slug or name; if none matches it returns candidates instead of guessing. Refuses projects marked share: summary/none (private: their log stays in the vault only).",
  inputSchema: {
    type: "object",
    properties: {
      project: { type: "string", description: "Project slug or name, e.g. 'munde-mode'." },
      headline: { type: "string", description: "3-6 words for the entry heading." },
      entry: { type: "string", description: "Markdown body: **Status:** line, then optional **Learned**, **Mistakes and fixes**, **Taste**, **Next** bullet lists, one line each. No secrets, client names, prices or internal URLs (the repo is public)." },
      new_project: {
        type: "object",
        description: "Only when he confirms it's a new project: creates projects/<slug>/project.md (share: full) and log.md. Set note to the slug of an existing brain note about it, if any.",
        properties: {
          title: { type: "string" },
          type: { type: "string", enum: ["game", "app", "tool", "site", "concept"] },
          topic: { type: "string" },
          why: { type: "string" },
          state: { type: "string" },
          stack: { type: "array", items: { type: "string" } },
          note: { type: "string" },
        },
        required: ["title", "type", "topic", "why"],
        additionalProperties: false,
      },
    },
    required: ["project", "headline", "entry"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
};

const PLAYTEST = {
  name: "log_playtest",
  title: "Log a game playtest",
  description:
    "For 'log this playtest' / 'playtest notes' on one of his games: adds one dated entry for a build he (or friends) played, newest first, to projects/<slug>/playtests.md; the daily vault sync copies it into Documents/Vault/<Game>/playtests.md. The newest entry's open 'Fix next' items become the game's next steps on the PROJECTS board. Finds the game by slug or name. A game that only has a brain note (no vault folder yet) gets projects/<slug>/project.md pointing at that note, so nothing is duplicated. Use his words; one line per bullet.",
  inputSchema: {
    type: "object",
    properties: {
      project: { type: "string", description: "Game slug or name, e.g. 'munde-mode' or 'Peakd'." },
      build: { type: "string", description: "Build or version played, e.g. 'v0.4', 'web build 26 Nov', a commit or a branch." },
      headline: { type: "string", description: "3-6 words: what this build was about, e.g. 'first full raid loop'." },
      played_by: { type: "string", description: "Who played: 'me', 'me + 2 friends', 'Discord testers'. First names only, never contact details." },
      platform: { type: "string", description: "Optional: web, Mac, Windows, iPhone..." },
      worked: { type: "array", items: { type: "string" }, description: "What landed: fun moments, things that worked." },
      broke: { type: "array", items: { type: "string" }, description: "Bugs and things that broke." },
      felt: { type: "array", items: { type: "string" }, description: "Feel, pacing, difficulty, confusion; his words." },
      fix_next: { type: "array", items: { type: "string" }, description: "What to fix or try in the next build (become open checkboxes)." },
      link: { type: "string", description: "Optional: build URL, recording or clip (public links only)." },
    },
    required: ["project", "build", "headline"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
};

const START = {
  name: "start_project",
  title: "Turn an idea into a project",
  description:
    "When he says he's starting to build one of his idea notes ('let's build X', 'start this as a project'): creates projects/<slug>/ with project.md, context.md (the saved notes to start from, pre-linked), todo.md (the idea's steps) and log.md, sets the idea's stage to doing and links it to the project. One commit; the daily vault sync creates Documents/Vault/<slug>/ on his Mac and PC. Refuses if the idea already became a project (log to that one). Then call get_briefing with the new project.",
  inputSchema: {
    type: "object",
    properties: {
      idea: { type: "string", description: "Id of the idea or to-do note (from recall_ideas or search)." },
      title: { type: "string", description: "Project name if it differs from the idea's title, 2-4 words." },
      type: { type: "string", enum: ["game", "app", "tool", "site", "concept"] },
      stack: { type: "array", items: { type: "string" } },
      share: { type: "string", enum: ["full", "summary", "none"], default: "full", description: "summary for confidential work (the repo is public)." },
    },
    required: ["idea"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
};

const WRITE_TOOLS = [CAPTURE, UPDATE, LOG, PLAYTEST, START];
const ok = (t) => ({ content: [{ type: "text", text: t }] });
const no = (t) => ({ content: [{ type: "text", text: t }], isError: true });

async function relatedWrites(related, newSlug, paths, brain, skipPath) {
  const lines = [], writes = [], warn = [];
  for (const r of (related || []).slice(0, 4)) {
    const p = findNote(r.id, brain, paths);
    if (!p || p === skipPath) { warn.push(`related '${r.id}' not found, skipped`); continue; }
    const s = slugOf(p);
    const reason = oneLine(r.reason).replace(/[\[\]]/g, "").slice(0, 160);
    lines.push(`- [[${s}]]${reason ? ": " + reason : ""}`);
    const t = await getFile(p);
    if (!t.includes(`[[${newSlug}]]`)) writes.push({ path: p, content: addNoteLine(t, `- [[${newSlug}]]${reason ? ": " + reason : ""}`) });
  }
  return { lines, writes, warn };
}

async function doCapture(a, brain, kinds, stages) {
  const { head, paths } = await tree();
  const topics = [...new Set(paths.filter((p) => p.startsWith("topics/")).map((p) => p.split("/")[1]))].sort();
  const errs = problems(a, kinds, stages, topics);
  if (errs.length) return no("Not filed. Fix these and call capture again:\n- " + errs.join("\n- "));

  // Duplicates: same link (deployed or pending), or the same title.
  const pending = await pendingNotes(brain);
  const all = [...brain.notes.map((n) => ({ slug: n.slug, path: n.path, title: n.title, source: n.source })), ...pending];
  const src = a.source ? normUrl(a.source) : null;
  const dup = all.find((n) => (src && n.source && normUrl(n.source) === src) || n.title.toLowerCase() === oneLine(a.title).toLowerCase());
  if (dup && paths.includes(dup.path)) {
    return ok(`Already in the brain, not filed again: ${dup.slug} ("${dup.title}", ${dup.path}). If he added something new, call update_note with id "${dup.slug}". If it's genuinely a different thing, give it a different title.`);
  }

  const base = slugify(a.title).replace(/^\d{4}-\d{2}-\d{2}-?/, "") || "note";
  const taken = new Set(paths.filter(isNotePath).map(slugOf));
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  const dir = a.topic === "inbox" ? "inbox" : `topics/${a.topic}`;
  const path = `${dir}/${slug}.md`;

  const warn = [];
  const writes = [];
  let embed = "";
  if (a.image_url) {
    try {
      const img = await imageBlob(a.image_url);
      writes.push({ path: `${dir}/${slug}.${img.ext}`, sha: img.sha });
      embed = `\n\n![screenshot](./${slug}.${img.ext})`;
    } catch (e) {
      warn.push(`image not saved (${e.message})`);
    }
  }
  const rel = await relatedWrites(a.related, slug, paths, brain);
  warn.push(...rel.warn);

  const tags = [...new Set(list(a.tags))];
  const style = list(a.style).map((s) => s.replace(/,/g, ""));
  const idea = ["idea", "todo"].includes(a.kind);
  const status = a.topic === "inbox" ? "unsorted" : idea || ["thought", "project", "org"].includes(a.kind) ? "" : "unread";
  const fm = [
    "---",
    `title: ${yamlStr(a.title)}`,
    `type: ${a.type}`,
    `topic: ${a.topic}`,
    `tags: [${tags.join(", ")}]`,
    `kind: ${a.kind}`,
    `why: ${yamlStr(a.why)}`,
    style.length && `style: [${style.join(", ")}]`,
    list(a.kit).length && `kit: [${[...new Set(list(a.kit))].join(", ")}]`,
    idea && `stage: ${a.stage}`,
    a.source && `source: ${oneLine(a.source)}`,
    `added: ${today()}`,
    status && `status: ${status}`,
    `captured: ${new Date().toISOString()} via brain MCP`,
    "---",
  ].filter(Boolean);
  const body = [
    "",
    "## Summary",
    String(a.summary).trim() + embed,
    "",
    "## Raw",
    String(a.raw).trim(),
    ...(rel.lines.length ? ["", "## Notes", ...rel.lines] : []),
    "",
  ];
  writes.unshift({ path, content: [...fm, ...body].join("\n") });
  writes.push(...rel.writes);

  const sha = await commit(`add: ${oneLine(a.title).slice(0, 60)} (from chat)\n\nFiled through the brain MCP capture tool.`, writes);
  void head;
  return ok(
    `Filed: ${a.title} | ${a.topic} | ${tags.join(", ")}\nid: ${slug}\nfile: ${path}\ncommit: ${sha.slice(0, 7)}\n` +
      (rel.lines.length ? `linked: ${rel.lines.length} note(s), backlinks added\n` : "") +
      (warn.length ? `warnings: ${warn.join("; ")}\n` : "") +
      "On GitHub now; the site and MCP search pick it up with the next batched deploy (5 notes or the morning run). Tell him in one line: title, topic, tags."
  );
}

async function doUpdate(a, brain, stages) {
  const { paths } = await tree();
  const path = findNote(a.id, brain, paths);
  if (!path) return no(`No note '${a.id}'. Use search to find its id.`);
  let t = await getFile(path);
  const title = field(t, "title") || slugOf(path);
  const kind = field(t, "kind");
  const done = [];
  if (a.raw && String(a.raw).trim()) {
    t = appendToSection(t, "Raw", `(${today()}) ${String(a.raw).trim()}`);
    done.push("raw added");
  }
  if (a.note && oneLine(a.note)) {
    t = addNoteLine(t, `- ${today()}: ${oneLine(a.note)}`);
    done.push("note line added");
  }
  if (a.stage) {
    if (!["idea", "todo"].includes(kind)) return no(`stage is only for idea/todo notes; '${title}' is kind ${kind || "?"}.`);
    if (!stages.includes(a.stage)) return no(`stage must be one of ${stages.join(", ")}.`);
    t = setField(t, "stage", a.stage);
    done.push(`stage ${a.stage}`);
  }
  if (a.status) {
    t = setField(t, "status", a.status);
    done.push(`status ${a.status}`);
  }
  const slug = slugOf(path);
  const rel = await relatedWrites(a.related, slug, paths, brain, path);
  for (const line of rel.lines) if (!t.includes(line.slice(0, line.indexOf("]]") + 2))) t = addNoteLine(t, line);
  if (rel.lines.length) done.push(`${rel.lines.length} link(s)`);
  if (!done.length) return no("Nothing to change: pass raw, note, related, stage or status.");
  const sha = await commit(`edit: ${title.slice(0, 60)} (from chat)`, [{ path, content: t }, ...rel.writes]);
  return ok(`Updated ${title} (${path}): ${done.join(", ")}${rel.warn.length ? `; ${rel.warn.join("; ")}` : ""}. commit ${sha.slice(0, 7)}`);
}

// projects/<dir>/ for a slug or name, or null. Matches folder names, project.md titles
// and note: links (a project note in topics/ that has a vault folder).
function projectDir(project, brain, paths) {
  const dirs = [...new Set(paths.filter((p) => /^projects\/[^./][^/]*\/project\.md$/.test(p)).map((p) => p.split("/")[1]))];
  const want = slugify(project, 12);
  let dir = dirs.find((d) => d === want || slugify(d, 12) === want);
  if (!dir) {
    const vault = brain.notes.filter((n) => n.vault || n.vaultDir);
    const hit = vault.find((n) => slugify(n.title, 12) === want || n.slug.replace(/^\d{4}-\d{2}-\d{2}-/, "") === want || (n.vaultDir && slugify(n.vaultDir, 12) === want));
    dir = hit && (hit.vaultDir || hit.slug);
    if (dir && !dirs.includes(dir)) dir = null;
  }
  return { dir, dirs, want };
}

// Prepend a dated entry to a newest-first doc (log.md, playtests.md).
function prependEntry(doc, entry) {
  const first = doc.search(/^## /m);
  return (first < 0 ? doc.replace(/\n*$/, "\n\n") + entry : doc.slice(0, first) + entry + doc.slice(first)).replace(/\n{3,}/g, "\n\n");
}

async function doPlaytest(a, brain) {
  const { paths } = await tree();
  let { dir, dirs, want } = projectDir(a.project, brain, paths);
  const writes = [];
  let created = false, title = dir;
  if (!dir) {
    // A game with only a brain note: give it a vault folder attached to that note.
    const games = brain.notes.filter((n) => n.kind === "project" && !n.vault);
    const n = games.find((x) => x.slug === want || slugify(x.title, 12) === want || slugify(x.title.replace(/\b(game|concept)\b/gi, ""), 12) === want);
    if (!n) {
      const near = games.filter((x) => want.split("-").some((w) => w.length > 2 && (x.slug.includes(w) || x.title.toLowerCase().includes(w)))).slice(0, 6).map((x) => `${x.slug} (${x.title})`);
      return no(`No game matches '${a.project}'. ${near.length ? `Close: ${near.join("; ")}. ` : ""}Call again with the right slug; if it's a new game, log_project with new_project first.`);
    }
    dir = n.slug.replace(/-(game|concept)$/, "");
    title = oneLine(n.title);
    if (dirs.includes(dir)) return no(`projects/${dir}/ exists but isn't linked to ${n.slug}; call again with project "${dir}".`);
    writes.push({
      path: `projects/${dir}/project.md`,
      content: ["---", `title: ${yamlStr(n.title)}`, `type: ${n.type || "game"}`, `topic: ${n.topic}`, "tags: [own-project]", "kind: project",
        `why: ${yamlStr(n.why || n.title)}`, `state: ${oneLine(n.state) || "in progress"}`, `stack: [${list(n.stack).join(", ")}]`, "repo: private",
        "share: full               # summary for confidential work (this repo is public)", `note: ${n.slug}`, `added: ${today()}`, "---", "",
        "## Summary", `Vault folder for ${oneLine(n.title)}; the card is the brain note ${n.slug}.`, ""].join("\n"),
    });
    created = true;
  } else {
    const pm = await getFile(`projects/${dir}/project.md`);
    const share = (field(pm, "share") || "full").toLowerCase();
    title = field(pm, "title") || dir;
    if (share !== "full") return no(`${title} is share: ${share} (private), so its playtests stay in the vault. Give him the entry to paste into Documents/Vault/<Game>/playtests.md.`);
  }
  const path = `projects/${dir}/playtests.md`;
  let doc = paths.includes(path) ? await getFile(path)
    : `# ${title}: playtests\n\nOne entry per build played, newest first: what worked, what broke, how it felt, what to fix next.\n`;
  const bl = (h, xs, box) => (list(xs).length ? `**${h}**\n${list(xs).map((x) => `- ${box ? "[ ] " : ""}${x}`).join("\n")}\n` : "");
  const meta = [`**Build:** ${oneLine(a.build)}`, a.platform && `**Platform:** ${oneLine(a.platform)}`, a.played_by && `**Played by:** ${oneLine(a.played_by)}`, a.link && `**Link:** ${oneLine(a.link)}`].filter(Boolean).join("  \n");
  const entry = `## ${today()} · ${oneLine(a.build)} · ${oneLine(a.headline)}\n\n${meta}\n\n` +
    [bl("Worked", a.worked), bl("Broke", a.broke), bl("Felt", a.felt), bl("Fix next", a.fix_next, true)].filter(Boolean).join("\n") + "\n";
  doc = prependEntry(doc, entry);
  writes.push({ path, content: doc });
  const sha = await commit(`playtest: ${dir} ${oneLine(a.build)} (from chat)`, writes);
  return ok(`Logged playtest ${oneLine(a.build)} to ${path} (commit ${sha.slice(0, 7)})${created ? `; made projects/${dir}/project.md attached to the brain note` : ""}. It reaches Documents/Vault/${dir}/playtests.md on the next daily sync; open fixes show as next steps on the PROJECTS board after the next deploy.`);
}

async function doLog(a, brain) {
  const { paths } = await tree();
  let { dir, dirs, want } = projectDir(a.project, brain, paths);
  if (!dir && a.new_project) {
    const np = a.new_project;
    dir = slugify(np.title, 6);
    if (dirs.includes(dir)) return no(`projects/${dir}/ already exists; log to it with project "${dir}".`);
    const fm = [
      "---",
      `title: ${yamlStr(np.title)}`,
      `type: ${np.type}`,
      `topic: ${np.topic}`,
      "tags: [own-project]",
      "kind: project",
      `why: ${yamlStr(np.why)}`,
      `state: ${oneLine(np.state) || "in progress"}`,
      `stack: [${list(np.stack).join(", ")}]`,
      "repo: private",
      "share: full               # summary for confidential work (this repo is public)",
      `note: ${np.note ? slugify(np.note, 12) : ""}`,
      `added: ${today()}`,
      "---",
      "",
      "## Summary",
      oneLine(np.why),
      "",
    ];
    const log = `# ${oneLine(np.title)}: log\n\nDated entries, newest first: status, what was learned, mistakes and fixes, taste notes.\n\n## ${today()} · ${oneLine(a.headline)}\n\n${String(a.entry).trim()}\n`;
    const sha = await commit(`log: ${oneLine(np.title)} ${today()} (from chat)\n\nNew project from the brain MCP; the vault sync creates Documents/Vault/${dir}/.`, [
      { path: `projects/${dir}/project.md`, content: fm.join("\n") },
      { path: `projects/${dir}/log.md`, content: log },
    ]);
    return ok(`New project ${np.title}: projects/${dir}/project.md + log.md (commit ${sha.slice(0, 7)}). The next daily vault sync creates Documents/Vault/${dir}/.`);
  }
  if (!dir) {
    const near = brain.notes
      .filter((n) => n.kind === "project")
      .filter((n) => want.split("-").some((w) => w.length > 2 && (n.slug.includes(w) || n.title.toLowerCase().includes(w))))
      .slice(0, 6)
      .map((n) => `${n.vaultDir || n.slug} (${n.title}${n.vault || n.vaultDir ? ", has vault folder" : ", brain note only"})`);
    return no(
      `No project folder matches '${a.project}'. ` +
        (near.length ? `Close: ${near.join("; ")}. ` : "") +
        "Call again with the right slug, or, if he confirms it's new, with new_project (set its note to the brain note's id when one exists)."
    );
  }
  const pm = await getFile(`projects/${dir}/project.md`);
  const share = (field(pm, "share") || "full").toLowerCase();
  if (share !== "full") {
    return no(`${field(pm, "title") || dir} is share: ${share} (private), so its log stays out of the public repo. Give him the entry to paste into Documents/Vault/<Project>/log.md, or log from a chat with vault access.`);
  }
  const logPath = `projects/${dir}/log.md`;
  let log = paths.includes(logPath) ? await getFile(logPath) : `# ${field(pm, "title") || dir}: log\n\nDated entries, newest first: status, what was learned, mistakes and fixes, taste notes.\n`;
  const entry = `## ${today()} · ${oneLine(a.headline)}\n\n${String(a.entry).trim()}\n\n`;
  const first = log.search(/^## /m);
  log = first < 0 ? log.replace(/\n*$/, "\n\n") + entry : log.slice(0, first) + entry + log.slice(first);
  const sha = await commit(`log: ${dir} ${today()} (from chat)`, [{ path: logPath, content: log.replace(/\n{3,}/g, "\n\n") }]);
  return ok(`Logged to ${logPath} (commit ${sha.slice(0, 7)}). It reaches Documents/Vault/${dir}/log.md on the next daily sync.`);
}

async function doStart(a, brain) {
  const { paths } = await tree();
  const path = findNote(a.idea, brain, paths);
  if (!path) return no(`No note '${a.idea}'. Use recall_ideas to find its id.`);
  const slug = slugOf(path);
  const idea = brain.notes.find((n) => n.slug === slug);
  // A note filed since the last deploy isn't in brain.json yet: read it from GitHub.
  const text = await getFile(path);
  const note = idea || { slug, path, title: field(text, "title") || slug, kind: field(text, "kind"), topic: path.split("/")[1], tags: list(String(field(text, "tags") || "").replace(/^\[|\]$/g, "")), why: field(text, "why"), body: text.replace(/^---\n[\s\S]*?\n---\n?/, "") };
  const taken = [...new Set(paths.filter((p) => /^projects\/[^./][^/]*\/project\.md$/.test(p)).map((p) => p.split("/")[1]))];
  const r = BR.ideaToProject(note, brain.notes, { title: a.title, type: a.type, stack: a.stack, share: a.share, takenDirs: taken, today: today() });
  if (r.error) return no(r.error);
  const sha = await commit(`add: project ${oneLine(r.title).slice(0, 50)} from idea (from chat)\n\nStarted with the brain MCP start_project tool; the vault sync creates Documents/Vault/${r.dir}/.`, [
    ...r.files,
    { path, content: BR.markIdeaStarted(text, r.dir, today()) },
  ]);
  return ok(`Started ${r.title}: projects/${r.dir}/ (project.md, context.md, todo.md, log.md), ${r.refs.length} notes pre-linked, idea set to doing (commit ${sha.slice(0, 7)}). The next daily vault sync creates Documents/Vault/${r.dir}/. Next: get_briefing with project "${r.dir}".`);
}

async function callWriteTool(name, a, brain, kinds, stages) {
  try {
    if (name === "capture") return await doCapture(a, brain, kinds, stages);
    if (name === "update_note") return await doUpdate(a, brain, stages);
    if (name === "log_project") return await doLog(a, brain);
    if (name === "log_playtest") return await doPlaytest(a, brain);
    if (name === "start_project") return await doStart(a, brain);
  } catch (e) {
    return no(`GitHub error, nothing was written: ${e.message}. Try once more; if it fails again, give him the note as text.`);
  }
  return null;
}

// Shared with api/capture.js (the plain HTTP capture endpoint for phone and desktop).
module.exports = {
  WRITE_TOOLS, access, callWriteTool, normUrl, problems, slugify,
  gh, tree, getFile, commit, pendingNotes, findNote, appendToSection, today, oneLine, slugOf, isNotePath, field,
};
