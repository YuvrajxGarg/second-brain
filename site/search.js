// Phone-first search over data/brain.json. Works offline once the page has been opened
// online (sw.js keeps the last copy of the notes). Same query syntax as the desktop
// scripts/brain_search.py: words, "exact phrase", kind:, topic:, tag:, status:, stage:.
(() => {
  const PALETTE = {
    gamedev: "#39ff6a", design: "#ff4fd8", ai: "#4d6bff", tech: "#ff6a1a", business: "#ffe14d",
    productivity: "#22e4ff", health: "#ff3b5c", finance: "#c4ff3b", learning: "#a77bff", life: "#ffa94d",
    misc: "#a0a4ab", inbox: "#ffffff",
  };
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const arr = (v) => (Array.isArray(v) ? v : String(v || "").replace(/^\[|\]$/g, "").split(",").map((x) => x.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean));
  const val = (v) => (v === null || v === undefined || v === "None" ? "" : String(v));
  const FIELDS = ["kind", "topic", "tag", "type", "status", "stage"];
  let notes = [];
  let chip = "";

  const state = (online, when) => {
    const el = $("state");
    el.className = online ? "" : "off";
    el.textContent = `${notes.length} notes · ${online ? "online" : "offline copy"}${when ? " · " + when : ""}`;
  };

  async function load() {
    let online = navigator.onLine;
    let data;
    try {
      data = await (await fetch("data/brain.json", { cache: "no-cache" })).json();
    } catch {
      online = false;
    }
    if (!data) {
      $("state").textContent = "offline, and no saved copy yet: open this page once online";
      return;
    }
    notes = data.notes.map((n) => {
      const tags = arr(n.tags);
      return {
        ...n, tags,
        hay: {
          title: n.title.toLowerCase(),
          meta: [tags.join(" "), val(n.kind), val(n.why), arr(n.style).join(" "), val(n.source)].join(" ").toLowerCase(),
          summary: val(n.summary).toLowerCase(),
          body: val(n.body).toLowerCase(),
        },
      };
    });
    const when = data.generated ? new Date(data.generated).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";
    state(online, when);
    const kinds = [...new Set(notes.map((n) => val(n.kind)).filter(Boolean))].sort();
    $("chips").innerHTML = ["", ...kinds].map((k) => `<button class="chip${k === chip ? " on" : ""}" data-k="${esc(k)}">${k || "all"}</button>`).join("");
    route();
  }

  function parse(q) {
    const filters = {}, words = [], phrases = [];
    for (const m of q.matchAll(/"([^"]+)"|(\S+)/g)) {
      if (m[1]) { phrases.push(m[1].toLowerCase()); continue; }
      const [k, ...rest] = m[2].split(":");
      const v = rest.join(":").toLowerCase();
      if (v && FIELDS.includes(k.toLowerCase())) (filters[k.toLowerCase()] ||= []).push(v);
      else words.push(m[2].toLowerCase());
    }
    return { filters, words, phrases };
  }

  function score(n, { words, phrases }) {
    const h = n.hay;
    let s = 0;
    for (const p of phrases) {
      if (!(h.title + h.meta + h.body).includes(p)) return 0;
      s += h.title.includes(p) ? 6 : 3;
    }
    for (const w of words) {
      let hit = 0;
      if (new RegExp("\\b" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(h.title)) hit += 8;
      if (h.meta.includes(w)) hit += 4;
      if (h.summary.includes(w)) hit += 2;
      if (h.body.includes(w)) hit += 1;
      if (!hit) return 0;
      s += hit;
    }
    return s || 1;
  }

  const passes = (n, filters) => Object.entries(filters).every(([k, vals]) =>
    k === "tag" ? vals.every((v) => n.tags.some((t) => t.toLowerCase().startsWith(v))) : vals.includes(val(n[k]).toLowerCase()));

  function mark(text, keys) {
    let s = esc(text);
    for (const k of keys.filter(Boolean).sort((a, b) => b.length - a.length)) {
      s = s.replace(new RegExp(esc(k).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (m) => `<mark>${m}</mark>`);
    }
    return s;
  }

  function render() {
    const q = $("q").value.trim();
    const p = parse(q + (chip ? ` kind:${chip}` : ""));
    const hits = notes
      .filter((n) => passes(n, p.filters))
      .map((n) => [score(n, p), n])
      .filter(([s]) => s)
      .sort((a, b) => b[0] - a[0] || String(b[1].added).localeCompare(String(a[1].added)))
      .slice(0, 60);
    $("count").textContent = q || chip ? `${hits.length}${hits.length === 60 ? "+" : ""} matches` : "newest first";
    const keys = [...p.words, ...p.phrases];
    $("list").innerHTML = hits.map(([, n]) => `
      <li data-slug="${esc(n.slug)}">
        <div class="t"><span class="sq" style="background:${PALETTE[n.topic] || "#a0a4ab"}"></span><span>${mark(n.title, keys)}</span></div>
        <div class="m">${esc([val(n.kind), n.topic, n.tags.slice(0, 3).join(", "), val(n.added)].filter(Boolean).join(" · "))}</div>
        <div class="s">${mark(val(n.summary) || val(n.why), keys)}</div>
      </li>`).join("");
  }

  function show(slug) {
    const n = notes.find((x) => x.slug === slug);
    if (!n) return;
    const dir = n.path.split("/").slice(0, -1).join("/");
    const body = val(n.body)
      .replace(/(\]\()\.\/([^)\s]+)/g, (_, a, f) => `${a}data/media/${dir}/${f}`)
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, s, label) => `[${label || s}](#n/${s.trim().replace(/^\d{4}-\d\d-\d\d-/, "")})`);
    const src = val(n.source);
    $("note").innerHTML = `
      <h1>${esc(n.title)}</h1>
      <div class="meta">${esc([val(n.kind), n.topic, val(n.added), val(n.status)].filter(Boolean).join(" · "))}<br>
        ${n.tags.map((t) => `#${esc(t)}`).join(" ")}${val(n.why) ? `<br>why: ${esc(n.why)}` : ""}
        ${src ? `<br><a href="${esc(src)}" target="_blank" rel="noopener">${esc(src)}</a>` : ""}</div>
      <div class="body">${DOMPurify.sanitize(marked.parse(body))}</div>
      <a class="open" href="./#/n/${esc(n.slug)}">open in graph →</a>`;
    document.body.classList.add("reading");
    $("back").hidden = false;
    window.scrollTo(0, 0);
  }

  function route() {
    const m = location.hash.match(/^#n\/(.+)$/);
    if (m) return show(decodeURIComponent(m[1]));
    document.body.classList.remove("reading");
    $("back").hidden = true;
    render();
  }

  $("q").addEventListener("input", () => { if (location.hash) history.replaceState(null, "", location.pathname); render(); });
  $("chips").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    chip = b.dataset.k;
    document.querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", x === b));
    render();
  });
  $("list").addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (li) location.hash = "n/" + encodeURIComponent(li.dataset.slug);
  });
  $("back").addEventListener("click", () => history.length > 1 ? history.back() : (location.hash = ""));
  window.addEventListener("hashchange", route);
  window.addEventListener("online", () => state(true));
  window.addEventListener("offline", () => state(false));
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  load();
})();
