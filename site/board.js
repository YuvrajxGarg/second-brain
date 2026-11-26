// Board view: ideas by stage, projects by state, saved refs by reading status.
// Drag a card (or use its ⋯ menu on touch) to move it; that rewrites one frontmatter
// field through /api/edit and commits to main.
(async () => {
  const { esc, $, nav, notes: load, saveField, toast } = window.SB;
  nav("board");

  const OWN = new Set(["idea", "todo", "thought"]);
  const BOARDS = {
    ideas: {
      label: "IDEAS", field: "stage",
      blurb: "Your ideas and to-dos by stage",
      test: (n) => n.noteKind === "idea" || n.noteKind === "todo",
      cols: [["new", "NEW", "#f2f2f2"], ["exploring", "EXPLORING", "#22e4ff"], ["doing", "DOING", "#39ff6a"], ["done", "DONE", "#a77bff"], ["dropped", "DROPPED", "#6b6b6b"]],
      colOf: (n) => n.stage || "new",
    },
    projects: {
      label: "PROJECTS", field: "state",
      blurb: "What you have built, by where it stands",
      test: (n) => n.noteKind === "project",
      cols: [["concept", "CONCEPT", "#f2f2f2"], ["in progress", "BUILDING", "#ffe14d"], ["live", "LIVE", "#39ff6a"], ["archived", "ARCHIVED", "#6b6b6b"]],
      colOf: (n) => {
        const s = (n.state || "").toLowerCase();
        if (/concept|idea/.test(s)) return "concept";
        if (/prototype|progress|building|wip/.test(s)) return "in progress";
        if (/archiv|replaced|dropped|dead/.test(s)) return "archived";
        return "live";
      },
    },
    reading: {
      label: "READING", field: "status",
      blurb: "Everything you saved, by whether you have looked at it again",
      test: (n) => !OWN.has(n.noteKind) && n.noteKind !== "project" && n.noteKind !== "org",
      cols: [["unread", "UNREAD", "#ff6a1a"], ["read", "READ", "#22e4ff"], ["done", "USED IT", "#39ff6a"], ["archived", "ARCHIVED", "#6b6b6b"]],
      colOf: (n) => n.status || "unread",
    },
  };

  let mode = (location.hash.slice(1) in BOARDS) ? location.hash.slice(1) : "ideas";
  let all = [];
  try { all = (await load()).notes; } catch { $("title").textContent = "COULD NOT LOAD THE BRAIN"; return; }

  const firstImg = (n) => (/!\[[^\]]*\]\((data\/media\/[^)\s]+\.(?:png|jpe?g|gif|webp))\)/i.exec(n.body || "") || [])[1];

  $("tabs").innerHTML = Object.entries(BOARDS).map(([k, b]) => `<button type="button" role="tab" data-mode="${k}">${b.label}</button>`).join("");
  $("tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-mode]"); if (b) { mode = b.dataset.mode; history.replaceState(null, "", "#" + mode); render(); } });
  $("q").addEventListener("input", render);
  addEventListener("hashchange", () => { if (location.hash.slice(1) in BOARDS) { mode = location.hash.slice(1); render(); } });

  function card(n, B) {
    const img = mode === "reading" ? firstImg(n) : null;
    const sub = [n.noteKind, n.topic, mode === "projects" && n.state ? n.state : null, n.added].filter(Boolean).join(" · ");
    return `<a class="card" draggable="true" data-slug="${esc(n.slug)}" href="./#/n/${encodeURIComponent(n.slug)}" style="--c:${n.color}">
      ${img ? `<img class="card-img" src="${esc(img)}" alt="" loading="lazy" />` : ""}
      <div class="card-t">${esc(n.label)}</div>
      <div class="card-k">${esc(sub)}</div>
      ${n.why ? `<div class="card-w">${esc(n.why)}</div>` : ""}
      <button class="card-mv" type="button" title="Move to…" aria-label="Move ${esc(n.label)}">⋯</button>
    </a>`;
  }

  function render() {
    const B = BOARDS[mode];
    document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.mode === mode));
    const q = $("q").value.trim().toLowerCase();
    const list = all.filter(B.test).filter((n) => !q || [n.label, n.why, n.topic, (n.tags || []).join(" ")].join(" ").toLowerCase().includes(q))
      .sort((a, b) => (b.added || "").localeCompare(a.added || ""));
    $("title").innerHTML = `${esc(B.blurb.toUpperCase())} · <b>${list.length}</b>`;
    $("hint").textContent = "Drag a card to another column (or use ⋯). It commits to main and needs your edit passcode. Click a card to open it in the graph.";
    $("board").innerHTML = B.cols.map(([key, label, color]) => {
      const items = list.filter((n) => B.colOf(n) === key);
      return `<section class="col" data-col="${esc(key)}"><div class="col-h"><span><span class="dot" style="background:${color}"></span>${label}</span><span class="n">${items.length}</span></div>
        <div class="cards">${items.map((n) => card(n, B)).join("") || `<div class="empty">EMPTY</div>`}</div></section>`;
    }).join("");
  }

  async function move(slug, to) {
    const B = BOARDS[mode];
    const n = all.find((x) => x.slug === slug);
    if (!n || B.colOf(n) === to) return;
    const field = B.field, before = n[field];
    n[field] = to;
    render();
    const el = document.querySelector(`.card[data-slug="${CSS.escape(slug)}"]`);
    el?.classList.add("saving");
    try {
      const ok = await saveField(n, field, to);
      if (!ok) throw new Error("cancelled");
      toast(`${esc(n.label)} → ${esc(to.toUpperCase())} · committed, the site updates in about a minute`);
    } catch (err) {
      n[field] = before;
      if (err.message !== "cancelled") toast(`Could not move it: ${esc(err.message)}`);
    }
    render();
  }

  // drag and drop
  let dragSlug = null;
  const board = $("board");
  board.addEventListener("dragstart", (e) => {
    const c = e.target.closest(".card"); if (!c) return;
    dragSlug = c.dataset.slug; c.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragSlug);
  });
  board.addEventListener("dragend", (e) => { e.target.closest(".card")?.classList.remove("dragging"); document.querySelectorAll(".col.over").forEach((c) => c.classList.remove("over")); });
  board.addEventListener("dragover", (e) => {
    const col = e.target.closest(".col"); if (!col || !dragSlug) return;
    e.preventDefault();
    document.querySelectorAll(".col.over").forEach((c) => c !== col && c.classList.remove("over"));
    col.classList.add("over");
  });
  board.addEventListener("drop", (e) => {
    const col = e.target.closest(".col"); if (!col || !dragSlug) return;
    e.preventDefault(); col.classList.remove("over");
    const s = dragSlug; dragSlug = null;
    move(s, col.dataset.col);
  });

  // ⋯ menu (touch-friendly move)
  let menu = null;
  const closeMenu = () => { menu?.remove(); menu = null; };
  board.addEventListener("click", (e) => {
    const b = e.target.closest(".card-mv"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    closeMenu();
    const slug = b.closest(".card").dataset.slug, B = BOARDS[mode], cur = B.colOf(all.find((x) => x.slug === slug));
    menu = document.createElement("div");
    menu.className = "menu-mv";
    menu.innerHTML = B.cols.map(([k, l]) => `<button type="button" data-to="${esc(k)}"${k === cur ? ' class="cur"' : ""}>${k === cur ? "● " : ""}${l}</button>`).join("");
    document.body.appendChild(menu);
    const r = b.getBoundingClientRect();
    menu.style.left = Math.min(innerWidth - 170, r.left - 120) + "px";
    menu.style.top = Math.min(innerHeight - menu.offsetHeight - 8, r.bottom + 4) + "px";
    menu.addEventListener("click", (ev) => { const t = ev.target.closest("[data-to]"); if (t) { closeMenu(); move(slug, t.dataset.to); } });
  });
  addEventListener("click", (e) => { if (menu && !e.target.closest(".menu-mv")) closeMenu(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

  render();
})();
