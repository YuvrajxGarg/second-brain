// Canvas view: moodboards made of notes, text cards, links and groups, saved as
// JSON Canvas files (canvases/<id>.canvas, the open format Obsidian uses), so a
// board opens in Obsidian too. Unsaved edits are kept in this browser as drafts.
(async () => {
  const { esc, $, nav, notes: load, unlock, api, modal, closeModal, toast } = window.SB;
  nav("canvas");

  const COLORS = { 1: "#ff5f6d", 2: "#ff8a3d", 3: "#ffe14d", 4: "#39ff6a", 5: "#22e4ff", 6: "#a77bff" };
  const colorOf = (c) => (c ? COLORS[c] || c : null);
  const DRAFT_KEY = "sb-canvas-drafts";
  const drafts = (() => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}"); } catch { return {}; } })();
  const saveDrafts = () => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts)); } catch {} };
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "board";

  let notes = [], boards = [];
  try {
    notes = (await load()).notes;
    boards = await (await fetch("data/canvases.json", { cache: "no-cache" })).json();
  } catch { $("title").textContent = "COULD NOT LOAD"; }
  const byPath = new Map(notes.map((n) => [n.path, n]));
  const firstImg = (n) => (/!\[[^\]]*\]\((data\/media\/[^)\s]+\.(?:png|jpe?g|gif|webp))\)/i.exec(n?.body || "") || [])[1];
  for (const id of Object.keys(drafts)) if (!boards.some((b) => b.id === id)) boards.push({ id, path: `canvases/${id}.canvas`, data: drafts[id], local: true });

  const cv = $("cv"), world = $("world"), svg = $("edges");
  let board = null, data = { nodes: [], edges: [] };
  let view = { x: 0, y: 0, k: 1 };
  let sel = new Set(), selEdge = null, editing = null;

  // ---------- layout ----------
  function place() {
    const top = $("hint").getBoundingClientRect().bottom + 10;
    cv.style.top = top + "px";
  }
  addEventListener("resize", place);
  function applyView() { world.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.k})`; }

  // ---------- boards ----------
  function fillSelect() {
    $("boards").innerHTML = boards.map((b) => `<option value="${esc(b.id)}"${b === board ? " selected" : ""}>${esc(b.id.replace(/-/g, " ").toUpperCase())}${drafts[b.id] ? " ·" : ""}</option>`).join("");
  }
  function open(id) {
    board = boards.find((b) => b.id === id) || boards[0];
    if (!board) { board = { id: "my-moodboard", path: "canvases/my-moodboard.canvas", data: { nodes: [], edges: [] }, local: true }; boards.push(board); }
    data = JSON.parse(JSON.stringify(drafts[board.id] || board.data || { nodes: [], edges: [] }));
    data.nodes ||= []; data.edges ||= [];
    sel.clear(); selEdge = null; editing = null;
    history.replaceState(null, "", "#" + board.id);
    $("title").innerHTML = `MOODBOARDS · <b>${esc(board.id.replace(/-/g, " ").toUpperCase())}</b> · ${data.nodes.filter((n) => n.type !== "group").length} CARDS`;
    fillSelect(); render(); fit(); dirty(!!drafts[board.id]);
  }
  function dirty(on = true) {
    document.documentElement.classList.toggle("cv-dirty", on);
    if (on) { drafts[board.id] = data; saveDrafts(); }
    else { delete drafts[board.id]; saveDrafts(); }
    fillSelect();
  }
  $("boards").addEventListener("change", (e) => open(e.target.value));

  // ---------- render ----------
  const N = (id) => data.nodes.find((n) => n.id === id);
  function nodeHtml(n) {
    const c = colorOf(n.color);
    const style = `left:${n.x}px;top:${n.y}px;width:${n.width}px;height:${n.height}px;${c ? `--c:${c};` : ""}`;
    const cls = `cv-node ${n.type}${sel.has(n.id) ? " sel" : ""}`;
    let inner = "";
    if (n.type === "group") inner = `<div class="cv-glabel">${esc(n.label || "GROUP")}</div>`;
    else if (n.type === "text") inner = editing === n.id
      ? `<textarea class="cv-edit">${esc(n.text || "")}</textarea>`
      : `<div class="cv-md">${DOMPurify.sanitize(marked.parse(n.text || "_empty, double-click to write_"))}</div>`;
    else if (n.type === "link") {
      let host = n.url; try { host = new URL(n.url).host.replace(/^www\./, ""); } catch {}
      inner = `<div class="cv-link"><div class="cv-k">LINK · ${esc(host)}</div><a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.url)}</a></div>`;
    } else if (n.type === "file") {
      const note = byPath.get(n.file);
      if (note) {
        const img = firstImg(note);
        inner = `${img ? `<img class="cv-img" src="${esc(img)}" alt="" draggable="false" />` : ""}
          <div class="cv-body" style="${img ? "" : "flex:1"}"><div class="cv-k">${esc([note.noteKind, note.topic].filter(Boolean).join(" · "))}</div>
          <div class="cv-t">${esc(note.label)}</div>${note.why && !img ? `<div class="cv-w">${esc(note.why)}</div>` : ""}
          <a class="cv-open" href="./#/n/${encodeURIComponent(note.slug)}">OPEN ↗</a></div>`;
        return `<div class="${cls}" data-id="${esc(n.id)}" style="${style}--c:${c || note.color}">${inner}<div class="cv-port"></div><div class="cv-size"></div></div>`;
      }
      inner = /\.(png|jpe?g|gif|webp)$/i.test(n.file || "")
        ? `<img class="cv-img" src="data/media/${esc(n.file)}" alt="" draggable="false" />`
        : `<div class="cv-link"><div class="cv-k">FILE</div>${esc(n.file || "")}</div>`;
    }
    return `<div class="${cls}" data-id="${esc(n.id)}" style="${style}">${inner}<div class="cv-port"></div><div class="cv-size"></div></div>`;
  }
  function render() {
    world.querySelectorAll(".cv-edit").forEach((t) => (t.onblur = null));
    world.querySelectorAll(".cv-node").forEach((el) => el.remove());
    const groups = data.nodes.filter((n) => n.type === "group"), rest = data.nodes.filter((n) => n.type !== "group");
    world.insertAdjacentHTML("beforeend", [...groups, ...rest].map(nodeHtml).join(""));
    const ed = world.querySelector(".cv-edit");
    if (ed) {
      ed.focus();
      ed.addEventListener("input", () => { N(editing).text = ed.value; dirty(); });
      ed.onblur = () => { editing = null; render(); };
    }
    renderEdges();
  }
  function anchor(n, side) {
    return side === "top" ? [n.x + n.width / 2, n.y] : side === "bottom" ? [n.x + n.width / 2, n.y + n.height]
      : side === "left" ? [n.x, n.y + n.height / 2] : [n.x + n.width, n.y + n.height / 2];
  }
  function autoSides(a, b) {
    const dx = (b.x + b.width / 2) - (a.x + a.width / 2), dy = (b.y + b.height / 2) - (a.y + a.height / 2);
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? ["right", "left"] : ["left", "right"]) : (dy > 0 ? ["bottom", "top"] : ["top", "bottom"]);
  }
  const NORMAL = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };
  function curve(p, ps, q, qs) {
    const d = Math.max(40, Math.hypot(q[0] - p[0], q[1] - p[1]) * 0.4);
    const [a, b] = NORMAL[ps], [c, e] = NORMAL[qs];
    return `M${p[0]},${p[1]} C${p[0] + a * d},${p[1] + b * d} ${q[0] + c * d},${q[1] + e * d} ${q[0]},${q[1]}`;
  }
  function renderEdges(temp) {
    let h = "";
    for (const e of data.edges) {
      const a = N(e.fromNode), b = N(e.toNode);
      if (!a || !b) continue;
      const [fs, ts] = e.fromSide && e.toSide ? [e.fromSide, e.toSide] : autoSides(a, b);
      const p = anchor(a, fs), q = anchor(b, ts), d = curve(p, fs, q, ts);
      const col = colorOf(e.color);
      h += `<path d="${d}" class="${selEdge === e.id ? "sel" : ""}" ${col ? `style="stroke:${col}"` : ""} marker-end="url(#arr)"/><path d="${d}" class="hit" data-edge="${esc(e.id)}"/>`;
      if (e.label) h += `<text x="${(p[0] + q[0]) / 2 + 6}" y="${(p[1] + q[1]) / 2 - 6}">${esc(e.label)}</text>`;
    }
    if (temp) h += `<path class="temp" d="${temp}"/>`;
    svg.innerHTML = `<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="rgba(242,242,242,0.6)" stroke="none"/></marker></defs>` + h;
  }

  // ---------- camera ----------
  const toWorld = (cx, cy) => { const r = cv.getBoundingClientRect(); return [(cx - r.left - view.x) / view.k, (cy - r.top - view.y) / view.k]; };
  function fit() {
    const ns = data.nodes;
    const r = cv.getBoundingClientRect();
    if (!ns.length) { view = { x: r.width / 2, y: r.height / 2, k: 1 }; applyView(); return; }
    const x0 = Math.min(...ns.map((n) => n.x)) - 40, y0 = Math.min(...ns.map((n) => n.y)) - 50;
    const x1 = Math.max(...ns.map((n) => n.x + n.width)) + 40, y1 = Math.max(...ns.map((n) => n.y + n.height)) + 40;
    const k = Math.min(1.2, r.width / (x1 - x0), r.height / (y1 - y0));
    view = { k, x: (r.width - (x1 - x0) * k) / 2 - x0 * k, y: (r.height - (y1 - y0) * k) / 2 - y0 * k };
    applyView();
  }
  cv.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      const k = Math.max(0.15, Math.min(3, view.k * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))));
      view.x = mx - (mx - view.x) * (k / view.k); view.y = my - (my - view.y) * (k / view.k); view.k = k;
    } else { view.x -= e.deltaX; }
    applyView();
  }, { passive: false });

  // ---------- pointer ----------
  let drag = null;
  cv.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest(".cv-edit, a")) return;
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    const edge = e.target.closest("[data-edge]");
    if (edge) { selEdge = edge.dataset.edge; sel.clear(); render(); return; }
    const el = e.target.closest(".cv-node");
    if (!el) {
      if (!e.shiftKey) { sel.clear(); selEdge = null; render(); }
      drag = { mode: "pan", sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
      cv.classList.add("panning");
    } else {
      const id = el.dataset.id, n = N(id);
      if (e.target.classList.contains("cv-port")) drag = { mode: "link", from: n };
      else if (e.target.classList.contains("cv-size")) drag = { mode: "size", n, sx: wx, sy: wy, w: n.width, h: n.height };
      else {
        if (!sel.has(id)) { if (!e.shiftKey) sel.clear(); sel.add(id); selEdge = null; render(); }
        // moving a group carries the cards inside it
        const moving = new Set(sel);
        for (const sid of sel) {
          const g = N(sid);
          if (g?.type === "group") for (const m of data.nodes) if (m.x >= g.x && m.y >= g.y && m.x + m.width <= g.x + g.width && m.y + m.height <= g.y + g.height) moving.add(m.id);
        }
        drag = { mode: "move", sx: wx, sy: wy, items: [...moving].map((i) => ({ n: N(i), x: N(i).x, y: N(i).y })), moved: false };
      }
    }
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    if (drag.mode === "pan") { view.x = drag.vx + e.clientX - drag.sx; view.y = drag.vy + e.clientY - drag.sy; applyView(); }
    else if (drag.mode === "move") {
      const dx = wx - drag.sx, dy = wy - drag.sy;
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
      for (const it of drag.items) {
        it.n.x = Math.round(it.x + dx); it.n.y = Math.round(it.y + dy);
        const el = world.querySelector(`.cv-node[data-id="${CSS.escape(it.n.id)}"]`);
        if (el) { el.style.left = it.n.x + "px"; el.style.top = it.n.y + "px"; }
      }
      renderEdges();
    } else if (drag.mode === "size") {
      const n = drag.n;
      n.width = Math.max(120, Math.round(drag.w + wx - drag.sx)); n.height = Math.max(60, Math.round(drag.h + wy - drag.sy));
      const el = world.querySelector(`.cv-node[data-id="${CSS.escape(n.id)}"]`);
      if (el) { el.style.width = n.width + "px"; el.style.height = n.height + "px"; }
      renderEdges();
    } else if (drag.mode === "link") {
      const p = anchor(drag.from, "right");
      renderEdges(`M${p[0]},${p[1]} L${wx},${wy}`);
    }
  });
  cv.addEventListener("pointerup", (e) => {
    if (!drag) return;
    const d = drag; drag = null; cv.classList.remove("panning");
    if (d.mode === "move" && d.moved) dirty();
    if (d.mode === "size") dirty();
    if (d.mode === "link") {
      const t = document.elementFromPoint(e.clientX, e.clientY)?.closest(".cv-node");
      const to = t && N(t.dataset.id);
      if (to && to !== d.from && to.type !== "group" && !data.edges.some((x) => x.fromNode === d.from.id && x.toNode === to.id)) {
        const [fs, ts] = autoSides(d.from, to);
        data.edges.push({ id: uid(), fromNode: d.from.id, fromSide: fs, toNode: to.id, toSide: ts });
        dirty();
      }
      renderEdges();
    }
  });
  cv.addEventListener("dblclick", (e) => {
    const el = e.target.closest(".cv-node");
    if (el) {
      const n = N(el.dataset.id);
      if (n.type === "text") { editing = n.id; render(); }
      else if (n.type === "group") rename(n);
      return;
    }
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    addText(wx - 130, wy - 60);
  });

  // ---------- adding ----------
  function centre() { const r = cv.getBoundingClientRect(); return toWorld(r.left + r.width / 2, r.top + r.height / 2); }
  function addNode(n) { data.nodes.push(n); sel = new Set([n.id]); dirty(); render(); return n; }
  function addText(x, y) { const n = addNode({ id: uid(), type: "text", text: "", x: Math.round(x), y: Math.round(y), width: 260, height: 140 }); editing = n.id; render(); }
  function addNote(note, x, y) {
    const img = firstImg(note);
    return addNode({ id: uid(), type: "file", file: note.path, x: Math.round(x), y: Math.round(y), width: 280, height: img ? 260 : 150 });
  }
  function rename(g) {
    modal(`<div class="m-h">GROUP LABEL</div><input name="l" value="${esc(g.label || "")}" maxlength="60" />
      <div class="m-row"><button type="button" data-cancel>CANCEL</button><button type="submit">OK</button></div>`, (m) => {
      g.label = m.querySelector("input").value.trim().toUpperCase(); closeModal(); dirty(); render();
    });
  }
  function pickNote() {
    document.querySelector(".cv-pick")?.remove();
    const box = document.createElement("div");
    box.className = "cv-pick";
    box.innerHTML = `<input placeholder="add a note: type to search" autocomplete="off" spellcheck="false" /><ul></ul>`;
    document.body.appendChild(box);
    const input = box.querySelector("input"), ul = box.querySelector("ul");
    let hits = [], on = 0;
    const show = () => {
      const q = input.value.trim().toLowerCase();
      hits = notes.filter((n) => !q || [n.label, n.why, (n.tags || []).join(" "), (n.style || []).join(" ")].join(" ").toLowerCase().includes(q)).slice(0, 30);
      on = Math.min(on, hits.length - 1);
      ul.innerHTML = hits.map((n, i) => `<li data-i="${i}" class="${i === on ? "on" : ""}"><span class="sq" style="background:${n.color}"></span>${esc(n.label)}<span class="k">${esc(n.noteKind || "")}</span></li>`).join("");
    };
    const take = (i) => { const n = hits[i]; if (!n) return; const [x, y] = centre(); addNote(n, x - 140 + (Math.random() - 0.5) * 80, y - 120 + (Math.random() - 0.5) * 80); box.remove(); };
    input.addEventListener("input", () => { on = 0; show(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { on = Math.min(hits.length - 1, on + 1); show(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { on = Math.max(0, on - 1); show(); e.preventDefault(); }
      else if (e.key === "Enter") take(on);
      else if (e.key === "Escape") box.remove();
    });
    ul.addEventListener("click", (e) => { const li = e.target.closest("li"); if (li) take(+li.dataset.i); });
    setTimeout(() => addEventListener("pointerdown", function off(ev) { if (!ev.target.closest(".cv-pick")) { box.remove(); removeEventListener("pointerdown", off); } }), 0);
    show(); input.focus();
  }
  $("b-note").onclick = pickNote;
  $("b-text").onclick = () => { const [x, y] = centre(); addText(x - 130, y - 70); };
  $("b-group").onclick = () => { const [x, y] = centre(); const g = addNode({ id: uid(), type: "group", label: "GROUP", x: Math.round(x - 300), y: Math.round(y - 200), width: 600, height: 400 }); rename(g); };
  $("b-fit").onclick = fit;

  function newBoard(id, d) {
    let base = slugify(id), n = 2;
    while (boards.some((b) => b.id === base)) base = slugify(id) + "-" + n++;
    const b = { id: base, path: `canvases/${base}.canvas`, data: d || { nodes: [], edges: [] }, local: true };
    boards.push(b); drafts[b.id] = b.data; saveDrafts(); open(b.id);
  }
  $("b-new").onclick = () => modal(`<div class="m-h">NEW MOODBOARD</div><input name="n" placeholder="name, e.g. sixer art bible" required maxlength="50" />
    <div class="m-row"><button type="button" data-cancel>CANCEL</button><button type="submit">CREATE</button></div>`, (m) => { const v = m.querySelector("input").value; closeModal(); newBoard(v); });

  // AUTO: lay out every note with a tag or kind as a moodboard grid, images first
  $("b-auto").onclick = () => {
    const tagCount = new Map();
    for (const n of notes) for (const t of n.tags || []) tagCount.set(t, (tagCount.get(t) || 0) + 1);
    const tags = [...tagCount].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]);
    const kinds = [...new Set(notes.map((n) => n.noteKind).filter(Boolean))].sort();
    modal(`<div class="m-h">AUTO MOODBOARD</div><p class="m-p">Lays out every note with this tag or kind, images first. You can rearrange it after.</p>
      <select name="s" class="vsearch" style="width:100%">${kinds.map((k) => `<option value="k:${esc(k)}">kind: ${esc(k)}</option>`).join("")}${tags.map(([t, c]) => `<option value="t:${esc(t)}">#${esc(t)} (${c})</option>`).join("")}</select>
      <div class="m-row"><button type="button" data-cancel>CANCEL</button><button type="submit">BUILD</button></div>`, (m) => {
      const v = m.querySelector("select").value, key = v.slice(2), isKind = v[0] === "k";
      closeModal();
      const list = notes.filter((n) => (isKind ? n.noteKind === key : (n.tags || []).includes(key)))
        .sort((a, b) => (firstImg(b) ? 1 : 0) - (firstImg(a) ? 1 : 0) || (b.added || "").localeCompare(a.added || "")).slice(0, 36);
      const cols = Math.ceil(Math.sqrt(list.length * 1.4)), W = 280, H = 260, G = 30;
      const nodes = list.map((n, i) => ({ id: uid(), type: "file", file: n.path, x: (i % cols) * (W + G), y: Math.floor(i / cols) * (H + G), width: W, height: firstImg(n) ? H : 150 }));
      const rows = Math.ceil(list.length / cols);
      nodes.unshift({ id: uid(), type: "group", label: (isKind ? key : "#" + key).toUpperCase(), x: -30, y: -40, width: cols * (W + G) + 30, height: rows * (H + G) + 40, color: "4" });
      newBoard((isKind ? "" : "") + key + " board", { nodes, edges: [] });
      toast(`Built a board from ${list.length} notes. SAVE to keep it in the repo.`);
    });
  };

  // ---------- keys, save, download ----------
  function removeSelected() {
    if (selEdge) { data.edges = data.edges.filter((e) => e.id !== selEdge); selEdge = null; dirty(); render(); return; }
    if (!sel.size) return;
    data.nodes = data.nodes.filter((n) => !sel.has(n.id));
    data.edges = data.edges.filter((e) => !sel.has(e.fromNode) && !sel.has(e.toNode));
    sel.clear(); dirty(); render();
  }
  addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); return; }
    if (e.target.closest("input, textarea, select") || e.metaKey || e.ctrlKey) return;
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeSelected(); }
    else if (e.key === "Escape") { sel.clear(); selEdge = null; render(); }
    else if (e.key === "n" || e.key === "N") { e.preventDefault(); pickNote(); }
    else if (e.key === "t" || e.key === "T") $("b-text").click();
    else if (e.key === "g" || e.key === "G") $("b-group").click();
    else if (e.key === "f" || e.key === "F") fit();
  });
  async function save() {
    if (!(await unlock())) return;
    const b = $("b-save"); b.disabled = true; b.textContent = "SAVING";
    try {
      await api("board", { path: board.path, content: JSON.stringify(data), title: board.id });
      board.data = JSON.parse(JSON.stringify(data)); board.local = false; dirty(false);
      toast(`Saved <b>${esc(board.path)}</b> to main. Opens in Obsidian too.`);
    } catch (err) { toast(`Could not save: ${esc(err.message)}`); }
    b.disabled = false; b.textContent = "SAVE";
  }
  $("b-save").onclick = save;
  $("b-dl").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = board.id + ".canvas"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  place();
  open(decodeURIComponent(location.hash.slice(1)) || "pixel-art-look");
})();
