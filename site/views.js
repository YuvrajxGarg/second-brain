// Shared bits for the extra views (board.html, timeline.html, ...): data, colours,
// the view switcher, the edit passcode and saving a frontmatter field to GitHub.
// Same passcode as the graph's EDIT mode (stored in this browser as sb-edit-pass).
(() => {
  const PALETTE = {
    gamedev: "#39ff6a", design: "#ff4fd8", ai: "#4d6bff", tech: "#ff6a1a",
    business: "#ffe14d", productivity: "#22e4ff", health: "#ff3b5c",
    finance: "#c4ff3b", learning: "#a77bff", life: "#ffa94d", misc: "#a0a4ab", inbox: "#ffffff",
  };
  const EXTRA = ["#ff8a3d", "#3dffd0", "#ff3df2", "#7dff3d", "#3d8bff", "#ffd23d", "#ff5f7a", "#5fffe1"];
  const extra = new Map();
  const colorOf = (t) => PALETTE[t] || extra.get(t) || (extra.set(t, EXTRA[extra.size % EXTRA.length]), extra.get(t));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (id) => document.getElementById(id);

  const VIEWS = [
    ["graph", "GRAPH", "./"], ["board", "BOARD", "board.html"], ["timeline", "TIMELINE", "timeline.html"],
    ["canvas", "CANVAS", "canvas.html"], ["gallery", "GALLERY", "gallery.html"], ["search", "SEARCH", "search.html"],
  ];
  // Offline copy (sw.js): add the site to the iPhone home screen and it opens without internet.
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  function nav(active) {
    const el = document.createElement("nav");
    el.className = "vnav mono";
    el.setAttribute("aria-label", "Views");
    el.innerHTML = VIEWS.map(([id, label, href]) => `<a href="${href}"${id === active ? ' class="on" aria-current="page"' : ""}>${label}</a>`).join("");
    document.body.appendChild(el);
  }

  async function notes() {
    const g = await (await fetch("data/graph.json", { cache: "no-cache" })).json();
    Object.assign(PALETTE, g.topicColors || {}); // categories made from busy tags (categories.json)
    const list = g.nodes.filter((n) => n.kind === "note");
    for (const n of list) n.color = colorOf(n.topic);
    return { graph: g, notes: list };
  }

  // ---------- passcode + edit API ----------
  const PASS_KEY = "sb-edit-pass";
  const store = {
    get() { try { return localStorage.getItem(PASS_KEY) || ""; } catch { return ""; } },
    set(v) { try { v ? localStorage.setItem(PASS_KEY, v) : localStorage.removeItem(PASS_KEY); } catch {} },
  };
  async function api(action, payload = {}) {
    const pass = store.get();
    const r = await fetch("/api/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${pass}` },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) store.set("");
    if (!r.ok) throw new Error(data.error || `Error ${r.status}`);
    return data;
  }

  let modalEl = null;
  function closeModal() { modalEl?.remove(); modalEl = null; }
  function modal(html, onSubmit) {
    closeModal();
    const m = document.createElement("div");
    m.className = "modal";
    m.innerHTML = `<form class="modal-card mono">${html}</form>`;
    document.body.appendChild(m);
    modalEl = m;
    m.addEventListener("click", (e) => { if (e.target === m || e.target.closest("[data-cancel]")) closeModal(); });
    m.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); onSubmit(m); });
    setTimeout(() => m.querySelector("input, button[type=submit]")?.focus(), 30);
    return m;
  }
  // Resolves true once a passcode is stored (asks for one if needed).
  function unlock() {
    if (store.get()) return Promise.resolve(true);
    return new Promise((resolve) => {
      const m = modal(`<div class="m-h">UNLOCK EDIT MODE</div>
        <p class="m-p">Changes are committed straight to GitHub and the site rebuilds in about a minute.</p>
        <input type="password" name="pass" placeholder="passcode" autocomplete="current-password" required />
        <div class="m-err" hidden></div>
        <div class="m-row"><button type="button" data-cancel>CANCEL</button><button type="submit">UNLOCK</button></div>`, async (mm) => {
        const pass = mm.querySelector("input").value.trim();
        store.set(pass);
        try { await api("check"); closeModal(); resolve(true); }
        catch (err) { store.set(""); const e = mm.querySelector(".m-err"); e.hidden = false; e.textContent = err.message; }
      });
      m.addEventListener("click", (e) => { if (e.target === m || e.target.closest("[data-cancel]")) resolve(false); });
    });
  }

  function toast(html, ms = 5000) {
    let t = $("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast mono"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.innerHTML = html; t.hidden = false;
    t.classList.remove("show"); void t.offsetWidth; t.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.classList.remove("show"); setTimeout(() => (t.hidden = true), 400); }, ms);
  }

  // Set (or clear, value "") one frontmatter field of a note and commit it.
  function setFrontmatter(text, key, value) {
    const m = text.match(/^---\n([\s\S]*?)\n---/);
    if (!m) throw new Error("Note has no frontmatter.");
    let fm = m[1];
    const re = new RegExp(`^${key}:.*$`, "m");
    if (re.test(fm)) fm = value ? fm.replace(re, `${key}: ${value}`) : fm.replace(new RegExp(`^${key}:.*\\n?`, "m"), "");
    else if (value) fm = fm.replace(/^(added:.*)$/m, `${key}: ${value}\n$1`) === fm ? `${fm}\n${key}: ${value}` : fm.replace(/^(added:.*)$/m, `${key}: ${value}\n$1`);
    return `---\n${fm}\n---` + text.slice(m[0].length);
  }
  async function saveField(note, key, value) {
    if (!(await unlock())) return false;
    const f = await api("get", { path: note.path });
    const content = setFrontmatter(f.content, key, value);
    if (content === f.content) return true;
    await api("save", { path: note.path, sha: f.sha, content, title: `${note.label}: ${key} ${value || "cleared"}` });
    return true;
  }

  // ---------- command palette (Ctrl/Cmd+K on every page) ----------
  // Jump to any note, tag, topic, view, moodboard or saved view, or run an action.
  let pal = null, palItems = null;
  async function paletteItems() {
    if (palItems) return palItems;
    const [g, cv, vw] = await Promise.all([
      fetch("data/graph.json", { cache: "no-cache" }).then((r) => r.json()),
      fetch("data/canvases.json", { cache: "no-cache" }).then((r) => r.json()).catch(() => []),
      fetch("data/views.json", { cache: "no-cache" }).then((r) => r.json()).catch(() => []),
    ]);
    const notesL = g.nodes.filter((n) => n.kind === "note");
    const unread = notesL.filter((n) => (n.status || "unread") === "unread" && !["project", "org", "idea", "todo", "thought"].includes(n.noteKind));
    const rnd = (l) => l[(Math.random() * l.length) | 0];
    palItems = [
      ...VIEWS.map(([id, label, href]) => ({ k: "VIEW", t: label.charAt(0) + label.slice(1).toLowerCase(), href, c: "#f2f2f2" })),
      { k: "VIEW", t: "Ideas board", href: "board.html#ideas" }, { k: "VIEW", t: "Projects board", href: "board.html#projects" },
      { k: "VIEW", t: "Reading board", href: "board.html#reading" }, { k: "VIEW", t: "Me: stats and personality", href: "me.html" },
      { k: "ACTION", t: "Link Doctor: review links", href: "./#/doctor" },
      { k: "ACTION", t: "Random note", run: () => (location.href = "./#/n/" + encodeURIComponent(rnd(notesL).slug)) },
      { k: "ACTION", t: "Resurface something unread", run: () => (location.href = "./#/n/" + encodeURIComponent(rnd(unread).slug)) },
      ...cv.map((b) => ({ k: "CANVAS", t: b.id.replace(/-/g, " "), href: "canvas.html#" + b.id })),
      ...vw.map((v) => ({ k: "SAVED VIEW", t: v.data.name || v.id, href: "gallery.html#" + v.id })),
      ...notesL.map((n) => ({ k: (n.noteKind || "note").toUpperCase(), t: n.label, sub: n.why, href: "./#/n/" + encodeURIComponent(n.slug), c: colorOf(n.topic) })),
      ...g.nodes.filter((n) => n.kind === "topic").map((n) => ({ k: "TOPIC", t: n.label, href: "./#/t/" + encodeURIComponent(n.label), c: colorOf(n.label) })),
      ...g.nodes.filter((n) => n.kind === "tag").map((n) => ({ k: "TAG", t: "#" + n.label, href: "./#/g/" + encodeURIComponent(n.label) })),
    ];
    return palItems;
  }
  function score(q, t) {
    t = t.toLowerCase();
    const i = t.indexOf(q);
    if (i >= 0) return 100 - i - t.length * 0.05 + (i === 0 ? 20 : 0);
    let j = 0, gaps = 0, last = -1;
    for (let k = 0; k < t.length && j < q.length; k++) if (t[k] === q[j]) { if (last >= 0) gaps += k - last - 1; last = k; j++; }
    return j === q.length ? 40 - gaps - t.length * 0.05 : -1;
  }
  async function openPalette() {
    if (pal) { pal.remove(); pal = null; return; }
    pal = document.createElement("div");
    pal.className = "pal-wrap";
    pal.innerHTML = `<div class="pal mono" role="dialog" aria-label="Command palette"><input placeholder="jump to a note, tag, view or action" autocomplete="off" spellcheck="false" /><ul></ul><div class="pal-f">↑↓ MOVE · ENTER OPEN · ESC CLOSE</div></div>`;
    document.body.appendChild(pal);
    const input = pal.querySelector("input"), ul = pal.querySelector("ul");
    input.focus();
    const items = await paletteItems();
    let hits = [], on = 0;
    const show = () => {
      const q = input.value.trim().toLowerCase();
      hits = q ? items.map((it) => [score(q, it.t), it]).filter(([s]) => s >= 0).sort((a, b) => b[0] - a[0]).slice(0, 40).map(([, it]) => it)
        : items.filter((it) => it.k === "VIEW" || it.k === "ACTION");
      on = Math.max(0, Math.min(on, hits.length - 1));
      ul.innerHTML = hits.map((it, i) => `<li data-i="${i}" class="${i === on ? "on" : ""}"><span class="sq" style="background:${it.c || "transparent"};${it.c ? "" : "border:1px solid var(--dim)"}"></span><span class="t">${esc(it.t)}</span><span class="k">${esc(it.k)}</span></li>`).join("") || `<li class="none">Nothing found</li>`;
      ul.querySelector(".on")?.scrollIntoView({ block: "nearest" });
    };
    const go = (it) => { if (!it) return; pal.remove(); pal = null; if (it.run) it.run(); else location.href = it.href; };
    input.addEventListener("input", () => { on = 0; show(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { on++; show(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { on--; show(); e.preventDefault(); }
      else if (e.key === "Enter") go(hits[on]);
      else if (e.key === "Escape") { pal.remove(); pal = null; }
      e.stopPropagation();
    });
    ul.addEventListener("click", (e) => { const li = e.target.closest("[data-i]"); if (li) go(hits[+li.dataset.i]); });
    pal.addEventListener("click", (e) => { if (e.target === pal) { pal.remove(); pal = null; } });
    show();
  }
  addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); e.stopPropagation(); openPalette(); }
  }, true);

  window.SB = { PALETTE, colorOf, esc, $, nav, notes, api, unlock, modal, closeModal, toast, saveField, store, openPalette };
})();
