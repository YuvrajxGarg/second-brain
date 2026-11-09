// Shared logic: settings, building inbox entries, and committing them to GitHub
// in a single commit via the Git Data API.

export const DEFAULTS = { owner: "YuvrajxGarg", repo: "second-brain", branch: "main", token: "" };
export const MAX_FILE_MB = 25; // bigger files bloat the repo; save a link instead

export async function getSettings() {
  const s = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...s };
}

export async function saveSettings(s) {
  await chrome.storage.local.set(s);
}

// ---------- helpers ----------

const pad = (n) => String(n).padStart(2, "0");

export function stamp(d = new Date()) {
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return { date, time, iso: d.toISOString() };
}

export function slugify(s, words = 6) {
  const slug = (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/https?:\/\/(www\.)?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, words)
    .join("-");
  return slug || "capture";
}

const yamlStr = (s) => JSON.stringify(String(s ?? "").replace(/\s+/g, " ").trim());

function extOf(file) {
  const fromName = /\.([a-z0-9]{1,5})$/i.exec(file.name || "");
  if (fromName) return fromName[1].toLowerCase();
  const fromType = (file.type || "").split("/")[1] || "bin";
  return fromType.replace("jpeg", "jpg").replace("quicktime", "mov").replace(/[^a-z0-9]/g, "");
}

// Works in the popup and in the service worker (no FileReader there).
function bytesToBase64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function blobToBase64(blob) {
  return bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
}

function utf8ToBase64(str) {
  return bytesToBase64(new TextEncoder().encode(str));
}

// ---------- entry building ----------

/**
 * capture = { text, url, pageTitle, files: [File|Blob with .name], via }
 * Returns { files: [{path, base64}], title, mdPath }
 */
export async function buildEntry(capture, now = new Date()) {
  const text = (capture.text || "").trim();
  const url = (capture.url || "").trim();
  const files = capture.files || [];
  if (!text && !url && !files.length) throw new Error("Nothing to save: add a link, some text or a file.");

  for (const f of files) {
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      throw new Error(`"${f.name}" is ${(f.size / 1048576).toFixed(1)} MB. Limit is ${MAX_FILE_MB} MB; upload it somewhere and save the link instead.`);
    }
  }

  const firstLine = text.split("\n").find((l) => l.trim()) || "";
  const title =
    (capture.pageTitle || "").trim() ||
    firstLine.slice(0, 80) ||
    (files[0] && files[0].name) ||
    url ||
    "Quick capture";

  const hasVideo = files.some((f) => (f.type || "").startsWith("video/"));
  const hasImage = files.some((f) => (f.type || "").startsWith("image/"));
  const type = hasVideo ? "video" : url ? "link" : "note";

  const { date, time, iso } = stamp(now);
  const base = `${date}-${time}-${slugify(firstLine || capture.pageTitle || url || (files[0] && files[0].name), 5)}`;

  const out = [];
  const embeds = [];
  files.forEach((f, i) => {
    const name = `${base}${i ? `-${i + 1}` : ""}.${extOf(f)}`;
    out.push({ path: `inbox/${name}`, blob: f });
    const isImg = (f.type || "").startsWith("image/");
    embeds.push(isImg ? `![image](./${name})` : `[${f.name || name}](./${name})`);
  });

  const fm = [
    "---",
    `title: ${yamlStr(title)}`,
    `type: ${type}`,
    "topic: inbox",
    `tags: [unsorted${hasImage ? ", screenshot" : ""}]`,
    url ? `source: ${url}` : null,
    `added: ${date}`,
    "status: unsorted",
    `captured: ${iso} via ${capture.via || "quick-capture popup"}`,
    "---",
  ].filter((l) => l !== null);

  const body = [
    "",
    "## Summary",
    "Quick capture, not filed yet. Claude: file this per CLAUDE.md (pick topic, tags, summary) and move it out of inbox/.",
    ...(embeds.length ? ["", ...embeds] : []),
    "",
    "## Raw",
    [url, text].filter(Boolean).join("\n\n") || "(attachment only)",
    "",
  ];

  const mdPath = `inbox/${base}.md`;
  out.unshift({ path: mdPath, text: [...fm, ...body].join("\n") });
  return { files: out, title, mdPath };
}

// ---------- GitHub ----------

async function gh(cfg, path, opts = {}) {
  const res = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}${path}`, {
    ...opts,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${cfg.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!res.ok) {
    let msg = "";
    try { msg = (await res.json()).message; } catch {}
    const err = new Error(`GitHub ${res.status}: ${msg || res.statusText}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

export async function testConnection(cfg) {
  if (!cfg.token) throw new Error("Add a GitHub token first.");
  const repo = await gh(cfg, "");
  if (repo.permissions && !repo.permissions.push) throw new Error("Token can read the repo but can't write to it.");
  return repo.full_name;
}

/** Commit all files in one commit. files = [{path, text}|{path, blob}] */
export async function commitFiles(cfg, files, message, onProgress = () => {}) {
  if (!cfg.token) throw new Error("Open settings (gear icon) and add a GitHub token first.");
  const branch = encodeURIComponent(cfg.branch || "main");

  onProgress("Uploading…");
  const tree = [];
  for (const f of files) {
    const content = f.blob ? await blobToBase64(f.blob) : utf8ToBase64(f.text);
    const blob = await gh(cfg, "/git/blobs", { method: "POST", body: JSON.stringify({ content, encoding: "base64" }) });
    tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  // Retry if someone (Claude) pushed in between.
  for (let attempt = 0; attempt < 3; attempt++) {
    onProgress("Committing…");
    const ref = await gh(cfg, `/git/ref/heads/${branch}`);
    const parent = await gh(cfg, `/git/commits/${ref.object.sha}`);
    const newTree = await gh(cfg, "/git/trees", { method: "POST", body: JSON.stringify({ base_tree: parent.tree.sha, tree }) });
    const commit = await gh(cfg, "/git/commits", {
      method: "POST",
      body: JSON.stringify({ message, tree: newTree.sha, parents: [ref.object.sha] }),
    });
    try {
      await gh(cfg, `/git/refs/heads/${branch}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
      return commit;
    } catch (e) {
      if (e.status !== 422 || attempt === 2) throw e;
    }
  }
}

export async function capture(captureData, onProgress) {
  const cfg = await getSettings();
  const entry = await buildEntry(captureData);
  const commit = await commitFiles(cfg, entry.files, `capture: ${entry.title.slice(0, 60)}`, onProgress);
  return {
    ...entry,
    commitUrl: commit.html_url || `https://github.com/${cfg.owner}/${cfg.repo}/commit/${commit.sha}`,
    fileUrl: `https://github.com/${cfg.owner}/${cfg.repo}/blob/${cfg.branch}/${entry.mdPath}`,
  };
}
