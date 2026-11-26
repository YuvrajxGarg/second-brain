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
  ];
  function nav(active) {
    const el = document.createElement("nav");
    el.className = "vnav mono";
    el.setAttribute("aria-label", "Views");
    el.innerHTML = VIEWS.map(([id, label, href]) => `<a href="${href}"${id === active ? ' class="on" aria-current="page"' : ""}>${label}</a>`).join("");
    document.body.appendChild(el);
  }

  async function notes() {
    const g = await (await fetch("data/graph.json", { cache: "no-cache" })).json();
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

  window.SB = { PALETTE, colorOf, esc, $, nav, notes, api, unlock, modal, closeModal, toast, saveField, store };
})();
