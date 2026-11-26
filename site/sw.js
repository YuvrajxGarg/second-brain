// Offline copy of the brain site (iPhone home-screen app, or any browser).
// Network first for pages, scripts and data, so a fresh deploy shows at once; the last
// good copy is served when offline. Fonts, vendor libs and note images: cache first.
// Never touches /api or /mcp. Bump VERSION to drop old caches.
const VERSION = "brain-v2";
const SHELL = [
  "./", "index.html", "search.html", "board.html", "timeline.html", "canvas.html", "gallery.html", "me.html",
  "base.css", "style.css", "views.css", "timeline.css", "canvas.css", "gallery.css",
  "app.js", "views.js", "search.js", "board.js", "timeline.js", "canvas.js", "canvas-auto.js", "gallery.js",
  "vendor/d3.min.js", "vendor/marked.min.js", "vendor/purify.min.js",
  "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png",
  "data/brain.json", "data/graph.json", "data/views.json", "data/canvases.json", "data/links.json",
  "ME.md", "IDEAS.md",
];
const TIMEOUT = 4000;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const cacheFirst = (u) => /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u.href) || /\/(vendor|data\/media)\//.test(u.pathname) || /\.png$/.test(u.pathname);

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  const key = req.mode === "navigate" ? new URL(req.url).pathname : req;
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), TIMEOUT)),
    ]);
    if (res.ok) cache.put(key, res.clone());
    return res;
  } catch (err) {
    const hit = (await cache.match(key, { ignoreSearch: true })) || (req.mode === "navigate" && (await cache.match("search.html")));
    if (hit) return hit;
    throw err;
  }
}

async function fromCacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (u.origin === self.location.origin) {
    if (/^\/(api|mcp)(\/|$)/.test(u.pathname)) return;
    e.respondWith(cacheFirst(u) ? fromCacheFirst(req) : networkFirst(req));
  } else if (cacheFirst(u)) {
    e.respondWith(fromCacheFirst(req));
  }
});
