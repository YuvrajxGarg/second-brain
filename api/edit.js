// Edit API for the graph site: lets Yuvraj change or delete a note from
// https://brainy.pxlvzn.in and commits the change straight to main through the
// GitHub API (which triggers the normal Vercel production rebuild).
//
// Locked down two ways:
//   EDIT_PASSCODE  only requests carrying this passcode are served
//   GITHUB_TOKEN   fine-grained token, Contents read/write on this repo only;
//                  it never leaves this function
// Optional: GITHUB_REPO (default YuvrajxGarg/second-brain), GITHUB_BRANCH (default main).
//
// POST /api/edit, header `Authorization: Bearer <passcode>`, JSON body:
//   { action: "check" }                          -> { ok: true }
//   { action: "get", path }                      -> { path, content, sha }
//   { action: "save", path, content, sha, newPath?, title? }
//                                                -> { ok, commit, path }
//   { action: "delete", path, sha, title? }      -> { ok, commit, removed: [paths] }
//   { action: "create", path, content, title? }  -> { ok, commit, path }   (new note)
//   { action: "retag", paths, from, to }         -> { ok, commit, changed } (to "" removes)
//   { action: "look", look }                     -> { ok, commit }          (site/look.json)
// Only notes under topics/<topic>/ or inbox/ can be touched. Deleting a note also
// removes its images/videos (files with the same name). One change = one commit.

const crypto = require("node:crypto");

const REPO = process.env.GITHUB_REPO || "YuvrajxGarg/second-brain";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const API = "https://api.github.com";
const NOTE_PATH = /^(topics\/[a-z0-9][a-z0-9-]*|inbox)\/[A-Za-z0-9][A-Za-z0-9._-]*\.md$/;
const MAX_BYTES = 200_000;
const LOOK_PATH = "site/look.json";
const TAG = /^[a-z0-9][a-z0-9-]{0,40}$/;

// Change one tag inside a note's frontmatter `tags: [...]` line.
function retagText(text, from, to) {
  const m = text.match(/^---\n[\s\S]*?\n---\n?/);
  if (!m) return text;
  const fm = m[0].replace(/^tags:[ \t]*\[([^\]\n]*)\][ \t]*$/m, (line, list) => {
    const tags = list.split(",").map((t) => t.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    const next = [...new Set(tags.flatMap((t) => (t.toLowerCase() === from ? (to ? [to] : []) : [t])))];
    return `tags: [${next.join(", ")}]`;
  });
  return fm + text.slice(m[0].length);
}

// Slow down passcode guessing: failed attempts per IP, per warm instance.
const fails = new Map();
const LOCK_AFTER = 8, LOCK_MS = 15 * 60_000;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function sameSecret(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BYTES * 2) throw new Error("body too large");
    chunks.push(c);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

async function gh(method, url, body) {
  const r = await fetch(url.startsWith("http") ? url : `${API}/repos/${REPO}${url}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "second-brain-edit",
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
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const label = (t, fallback) => String(t || fallback).replace(/[\r\n]+/g, " ").slice(0, 60);

async function getFile(path) {
  const f = await gh("GET", `/contents/${enc(path)}?ref=${BRANCH}`);
  return { path, sha: f.sha, content: Buffer.from(f.content, "base64").toString("utf8") };
}

// One commit that writes and/or removes several files (used for moves and deletes,
// so a note and its images go in a single deploy). Fails if main moved meanwhile.
async function commitTree(message, writes, removes) {
  const ref = await gh("GET", `/git/ref/heads/${BRANCH}`);
  const head = ref.object.sha;
  const commit = await gh("GET", `/git/commits/${head}`);
  const tree = [
    ...writes.map((w) => (w.sha
      ? { path: w.path, mode: "100644", type: "blob", sha: w.sha }
      : { path: w.path, mode: "100644", type: "blob", content: w.content })),
    ...removes.map((p) => ({ path: p, mode: "100644", type: "blob", sha: null })),
  ];
  const newTree = await gh("POST", "/git/trees", { base_tree: commit.tree.sha, tree });
  const next = await gh("POST", "/git/commits", { message, tree: newTree.sha, parents: [head] });
  await gh("PATCH", `/git/refs/heads/${BRANCH}`, { sha: next.sha, force: false });
  return next.sha;
}

// Images/videos saved next to a note share its name: <slug>.png, <slug>-2.jpg ...
const MEDIA = /\.(png|jpe?g|gif|webp|svg|mp4|webm|mov)$/i;
async function attachments(path) {
  const dir = path.slice(0, path.lastIndexOf("/"));
  const base = path.slice(dir.length + 1, -3);
  const list = await gh("GET", `/contents/${enc(dir)}?ref=${BRANCH}`);
  return (Array.isArray(list) ? list : [])
    .filter((f) => f.type === "file" && MEDIA.test(f.name))
    .filter((f) => { const rest = f.name.slice(base.length); return f.name.startsWith(base) && /^(-\d+)?\.[a-z0-9]+$/i.test(rest); })
    .map((f) => ({ path: f.path, sha: f.sha }));
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });

  const pass = process.env.EDIT_PASSCODE;
  const missing = [!pass && "EDIT_PASSCODE", !process.env.GITHUB_TOKEN && "GITHUB_TOKEN"].filter(Boolean);
  if (missing.length) {
    return send(res, 503, { error: `Editing is not set up: ${missing.join(" and ")} missing in this deployment. Add it in Vercel for Production, then redeploy.` });
  }
  if (pass.length < 8) {
    return send(res, 503, { error: `EDIT_PASSCODE is only ${pass.length} characters. Use at least 8 in Vercel, then redeploy.` });
  }

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
  const f = fails.get(ip);
  if (f && f.n >= LOCK_AFTER && Date.now() - f.at < LOCK_MS) {
    return send(res, 429, { error: "Too many wrong passcodes. Try again in 15 minutes." });
  }
  const given = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!given || !sameSecret(given, pass)) {
    fails.set(ip, { n: (f && Date.now() - f.at < LOCK_MS ? f.n : 0) + 1, at: Date.now() });
    await new Promise((r) => setTimeout(r, 600));
    return send(res, 401, { error: "Wrong passcode." });
  }
  fails.delete(ip);

  let body;
  try {
    body = await readBody(req);
  } catch {
    return send(res, 400, { error: "Bad JSON." });
  }
  const { action, path, sha } = body || {};
  if (action === "check") return send(res, 200, { ok: true, repo: REPO, branch: BRANCH });

  try {
    // Site-wide default look for the graph (customise panel), kept in site/look.json.
    if (action === "look") {
      const look = body.look;
      if (!look || typeof look !== "object" || Array.isArray(look)) return send(res, 400, { error: "Bad look." });
      const content = JSON.stringify(look, null, 2) + "\n";
      if (content.length > 20_000) return send(res, 413, { error: "Look is too big." });
      let current = null;
      try { current = await getFile(LOOK_PATH); } catch (e) { if (e.status !== 404) throw e; }
      const r = await gh("PUT", `/contents/${LOOK_PATH}`, { message: "site: graph look (from site)", content: b64(content), sha: current?.sha, branch: BRANCH });
      return send(res, 200, { ok: true, commit: r.commit.sha });
    }

    // Rename a tag (to) or remove it (to empty) across several notes, in one commit.
    if (action === "retag") {
      const from = String(body.from || "").toLowerCase();
      const to = String(body.to || "").toLowerCase();
      const paths = Array.isArray(body.paths) ? [...new Set(body.paths)] : [];
      if (!TAG.test(from) || (to && !TAG.test(to))) return send(res, 400, { error: "Tags are lowercase words joined by dashes." });
      if (!paths.length || paths.length > 120 || paths.some((p) => typeof p !== "string" || !NOTE_PATH.test(p) || p.includes(".."))) {
        return send(res, 400, { error: "Bad list of notes." });
      }
      const writes = [];
      for (const p of paths) {
        const f = await getFile(p);
        const next = retagText(f.content, from, to);
        if (next !== f.content) writes.push({ path: p, content: next });
      }
      if (!writes.length) return send(res, 200, { ok: true, commit: "", changed: 0 });
      const msg = to ? `edit: tag ${from} -> ${to} on ${writes.length} notes (from site)` : `edit: remove tag ${from} from ${writes.length} notes (from site)`;
      const commit = await commitTree(msg, writes, []);
      return send(res, 200, { ok: true, commit, changed: writes.length });
    }
  } catch (e) {
    return send(res, e.status === 422 || e.status === 409 ? 409 : 502, { error: e.status === 422 || e.status === 409 ? "GitHub moved on while saving. Try again." : `GitHub error: ${e.message}` });
  }

  if (typeof path !== "string" || !NOTE_PATH.test(path) || path.includes("..")) {
    return send(res, 400, { error: "That file can't be edited from the site." });
  }

  try {
    if (action === "get") return send(res, 200, await getFile(path));

    if (action === "save") {
      const content = String(body.content || "").replace(/\r\n/g, "\n");
      if (!content.startsWith("---\n")) return send(res, 400, { error: "The note must start with its --- frontmatter." });
      if (Buffer.byteLength(content) > MAX_BYTES) return send(res, 413, { error: "Note is too big." });
      const newPath = body.newPath && body.newPath !== path ? String(body.newPath) : null;
      const msg = `edit: ${label(body.title, path.split("/").pop())} (from site)`;

      if (!newPath) {
        const r = await gh("PUT", `/contents/${enc(path)}`, { message: msg, content: b64(content), sha, branch: BRANCH });
        return send(res, 200, { ok: true, commit: r.commit.sha, path, sha: r.content.sha });
      }
      // Topic changed: move the note (and its images) in one commit.
      if (!NOTE_PATH.test(newPath) || newPath.includes("..")) return send(res, 400, { error: "Bad new location." });
      const current = await getFile(path);
      if (sha && current.sha !== sha) return send(res, 409, { error: "This note changed on GitHub since you opened it. Reload and try again." });
      try {
        await getFile(newPath);
        return send(res, 409, { error: `A note already exists at ${newPath}.` });
      } catch (e) {
        if (e.status !== 404) throw e;
      }
      const media = await attachments(path);
      const newBase = newPath.slice(0, -3), oldBase = path.slice(0, -3);
      const writes = [{ path: newPath, content }, ...media.map((m) => ({ path: newBase + m.path.slice(oldBase.length), sha: m.sha }))];
      const newDir = newPath.slice(0, newPath.lastIndexOf("/"));
      const commit = await commitTree(`${msg}, moved to ${newDir}`, writes, [path, ...media.map((m) => m.path)]);
      return send(res, 200, { ok: true, commit, path: newPath });
    }

    // New note from the site; refuses to overwrite an existing file.
    if (action === "create") {
      const content = String(body.content || "").replace(/\r\n/g, "\n");
      if (!content.startsWith("---\n")) return send(res, 400, { error: "The note must start with its --- frontmatter." });
      if (Buffer.byteLength(content) > MAX_BYTES) return send(res, 413, { error: "Note is too big." });
      try {
        await getFile(path);
        return send(res, 409, { error: "A note with that name already exists today. Pick another title." });
      } catch (e) { if (e.status !== 404) throw e; }
      const r = await gh("PUT", `/contents/${enc(path)}`, { message: `add: ${label(body.title, path.split("/").pop())} (from site)`, content: b64(content), branch: BRANCH });
      return send(res, 200, { ok: true, commit: r.commit.sha, path });
    }

    if (action === "delete") {
      const current = await getFile(path);
      if (sha && current.sha !== sha) return send(res, 409, { error: "This note changed on GitHub since you opened it. Reload and try again." });
      const removed = [path, ...(await attachments(path)).map((m) => m.path)];
      const commit = await commitTree(`delete: ${label(body.title, path.split("/").pop())} (from site)`, [], removed);
      return send(res, 200, { ok: true, commit, removed });
    }

    return send(res, 400, { error: "Unknown action." });
  } catch (e) {
    const status = e.status === 409 || e.status === 422 ? 409 : e.status === 404 ? 404 : 502;
    const msg = status === 409 ? "GitHub moved on while saving (someone else just committed). Try again."
      : status === 404 ? "Note not found on GitHub (maybe already deleted or moved)."
      : `GitHub error: ${e.message}`;
    return send(res, status, { error: msg });
  }
};
