// Plain HTTP capture endpoint: https://brainy.pxlvzn.in/api/capture
//
// For the iPhone Share Sheet / Action Button shortcuts and the Mac / Windows hotkey
// scripts in tools/device-capture/. The MCP server (api/mcp.js) speaks JSON-RPC, which
// Shortcuts and curl can't easily do, so this takes one simple POST and drops the capture
// into inbox/ (status: unsorted), the same way the browser extension does. The next
// Claude thread (or "sort my inbox") files it properly with topic, tags and summary.
//
// Auth: the same CAPTURE_KEY as the MCP write tools, as `Authorization: Bearer <key>`
// (or ?key=). Wrong keys are rate-limited per IP by api/_write.js.
//
// POST body, JSON (Content-Type: application/json):
//   text      what was shared: a link, some text, a dictated voice note (any of these)
//   note      optional: his own words about it ("why I saved this")
//   url       optional: the link, if sent separately (otherwise the first URL in text)
//   image     optional: base64 png/jpg/gif/webp (a data: URL is fine), up to ~3 MB
//   via       optional: where it came from, e.g. "iPhone share sheet", "Mac hotkey"
//   text_b64, note_b64: the same as text/note, base64 UTF-8 (lets shell scripts skip
//             JSON escaping)
// A text/plain body is treated as `text`.
//
// Reply: one plain-text line for a notification ("Saved to inbox: ..."), status 201.
// Same link already in the brain (filed or pending): nothing new is filed; his note, if
// any, is added to that note's ## Raw instead, status 200.
// GET with the key: "Key OK" (a quick test from any device).

const W = require("./_write.js");

const SITE = "https://brainy.pxlvzn.in";
const MAX_IMAGE = 4_000_000;
const MAX_TEXT = 20_000;

let cache = { at: 0, brain: null };
async function loadBrain(req) {
  if (cache.brain && Date.now() - cache.at < 60_000) return cache.brain;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  for (const u of [host && `https://${host}/data/brain.json`, `${SITE}/data/brain.json`].filter(Boolean)) {
    try {
      const r = await fetch(u, { headers: { accept: "application/json" } });
      if (r.ok) return (cache = { at: Date.now(), brain: await r.json() }).brain;
    } catch {}
  }
  return { notes: [] };
}

async function readBody(req) {
  let b = req.body;
  if (b === undefined || b === null || b === "") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    b = Buffer.concat(chunks);
  }
  if (Buffer.isBuffer(b)) b = b.toString("utf8");
  if (typeof b === "string") {
    const s = b.trim();
    if (!s) return {};
    if (s.startsWith("{")) return JSON.parse(s);
    return { text: s };
  }
  return b || {};
}

const b64text = (s) => (s ? Buffer.from(String(s).replace(/\s+/g, ""), "base64").toString("utf8") : "");
const str = (v) => (Array.isArray(v) ? v.join("\n") : v == null ? "" : String(v));

// Shortcuts sometimes hands over a filename ("IMG_1234.PNG") as the text of an image.
const FILENAME = /^[\w .()-]+\.(png|jpe?g|heic|heif|gif|webp|tiff?|mov|mp4)$/i;

function sniff(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.slice(0, 3).toString("latin1") === "GIF") return "gif";
  if (buf.slice(0, 4).toString("latin1") === "RIFF" && buf.slice(8, 12).toString("latin1") === "WEBP") return "webp";
  if (/^ftyp(heic|heix|mif1|hevc)/.test(buf.slice(4, 12).toString("latin1"))) return "heic";
  return null;
}

function istStamp(d = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(d).map((x) => [x.type, x.value])
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}${p.minute}${p.second}` };
}

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", nbsp: " " };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
  if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return ENT[e.toLowerCase()] ?? m;
});

// Page title for a nicer inbox name. Best effort, 4 s max; X and Instagram need the
// Social Reader connector anyway, so they get a plain label.
async function pageTitle(url) {
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
  if (/(^|\.)(x|twitter)\.com$/.test(host)) return "X post";
  if (/(^|\.)instagram\.com$/.test(host)) return "Instagram post";
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (second-brain capture)", Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(4000) });
    if (!r.ok || !/html/i.test(r.headers.get("content-type") || "")) return "";
    const html = (await r.text()).slice(0, 300_000);
    const og = /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)/i.exec(html) || /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title/i.exec(html);
    const t = og ? og[1] : (/<title[^>]*>([^<]{1,300})<\/title>/i.exec(html) || [, ""])[1];
    return decode(t).replace(/\s+/g, " ").trim().slice(0, 120);
  } catch {
    return "";
  }
}

const reply = (res, code, msg) => res.status(code).setHeader("Content-Type", "text/plain; charset=utf-8").send(msg);

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const who = W.access(req);
  if (req.method === "GET") {
    if (who === "ok") return reply(res, 200, "Key OK. Brain capture is ready.");
    return reply(res, who === "bad" ? 403 : 401, who === "bad" ? "Wrong key (or too many tries, wait 15 minutes)." : "Brain capture endpoint. POST with Authorization: Bearer <capture key>.");
  }
  if (req.method !== "POST") return reply(res, 405, "Use POST.");
  if (who !== "ok") return reply(res, who === "bad" ? 403 : 401, who === "bad" ? "Not saved: wrong key." : "Not saved: missing key.");

  let a;
  try {
    a = await readBody(req);
  } catch {
    return reply(res, 400, "Not saved: the body isn't valid JSON.");
  }

  let text = (str(a.text) || b64text(a.text_b64)).replace(/\r\n/g, "\n").trim().slice(0, MAX_TEXT);
  const note = (str(a.note) || b64text(a.note_b64)).replace(/\r\n/g, "\n").trim().slice(0, MAX_TEXT);
  const via = W.oneLine(a.via || "capture endpoint").slice(0, 40);

  let img = null;
  const imgB64 = str(a.image).replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
  if (imgB64) {
    const buf = Buffer.from(imgB64, "base64");
    const ext = sniff(buf);
    if (!ext) return reply(res, 400, "Not saved: the image isn't a png, jpg, gif or webp.");
    if (ext === "heic") return reply(res, 400, "Not saved: HEIC photo. Convert it to JPEG first (the shortcut's Convert Image step).");
    if (buf.length > MAX_IMAGE) return reply(res, 413, "Not saved: image over 4 MB. Resize it first.");
    img = { buf, ext };
    if (FILENAME.test(text)) text = "";
  }

  let url = W.oneLine(a.url);
  if (!url) {
    const m = /https?:\/\/[^\s<>"']+/.exec(text);
    if (m) url = m[0].replace(/[).,;!?]+$/, "");
  }
  if (url && !/^https?:\/\//.test(url)) url = "";
  if (url && text === url) text = "";
  if (!text && !note && !url && !img) return reply(res, 400, "Not saved: nothing to save (no link, text or image).");

  try {
    const { paths } = await W.tree();

    // Same link already saved (deployed, or filed since the last deploy): add to it.
    if (url) {
      const brain = await loadBrain(req);
      const pending = await W.pendingNotes(brain);
      const want = W.normUrl(url);
      const dup = [...pending, ...(brain.notes || [])].find((n) => n.source && W.normUrl(n.source) === want && paths.includes(n.path));
      if (dup) {
        const extra = [text, note].filter(Boolean).join("\n\n");
        if (!extra) return reply(res, 200, `Already saved: ${dup.title || dup.slug}`);
        const t = await W.getFile(dup.path);
        const next = W.appendToSection(t, "Raw", `(${W.today()}, ${via}) ${extra}`);
        await W.commit(`edit: ${(dup.title || dup.slug).slice(0, 60)} (from ${via})`, [{ path: dup.path, content: next }]);
        return reply(res, 200, `Already saved: ${dup.title || dup.slug}. Added your note to it.`);
      }
    }

    const firstLine = (text.split("\n").find((l) => l.trim()) || note.split("\n").find((l) => l.trim()) || "").trim();
    const fromPage = url ? await pageTitle(url) : "";
    const isVoice = /voice|dictat/i.test(via);
    const title = (fromPage || firstLine.split(/\s+/).slice(0, 10).join(" ") || (img ? "Screenshot" : "") || url || "Quick capture").slice(0, 100);

    const { date, time } = istStamp();
    const slugBase = W.slugify(fromPage || firstLine || (url && url.replace(/^https?:\/\/(www\.)?/, "")) || (img ? "screenshot" : "capture"), 5) || "capture";
    let base = `${date}-${time}-${slugBase}`;
    for (let i = 2; paths.includes(`inbox/${base}.md`); i++) base = `${date}-${time}-${slugBase}-${i}`;

    const writes = [];
    let embed = "";
    if (img) {
      // Upload the image as a blob first so the commit carries only its sha.
      const blob = await W.gh("POST", "/git/blobs", { content: img.buf.toString("base64"), encoding: "base64" });
      writes.push({ path: `inbox/${base}.${img.ext}`, sha: blob.sha });
      embed = `\n\n![screenshot](./${base}.${img.ext})`;
    }

    const tags = ["unsorted", img && "screenshot", isVoice && "voice-note"].filter(Boolean);
    const fm = [
      "---",
      `title: ${JSON.stringify(W.oneLine(title))}`,
      `type: ${url ? "link" : "note"}`,
      "topic: inbox",
      `tags: [${tags.join(", ")}]`,
      url && `source: ${url}`,
      `added: ${date}`,
      "status: unsorted",
      `captured: ${new Date().toISOString()} via ${via}`,
      "---",
    ].filter(Boolean);
    const raw = [url && text.includes(url) ? "" : url, text, note && (text || url || img ? `Note: ${note}` : note)].filter(Boolean).join("\n\n");
    const body = [
      "",
      "## Summary",
      "Quick capture, not filed yet. Claude: file this per CLAUDE.md (pick topic, tags, summary) and move it out of inbox/." + embed,
      "",
      "## Raw",
      raw || "(image only)",
      "",
    ];
    writes.unshift({ path: `inbox/${base}.md`, content: [...fm, ...body].join("\n") });
    await W.commit(`capture: ${W.oneLine(title).slice(0, 60)} (from ${via})`, writes);
    return reply(res, 201, `Saved to inbox: ${W.oneLine(title).slice(0, 80)}`);
  } catch (e) {
    return reply(res, 502, `Not saved (GitHub error: ${e.message}). Try again.`);
  }
};
