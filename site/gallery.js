// Gallery / table view: saved filters over the notes (views/*.json in the repo,
// Obsidian Bases-style). Pick a view, tweak the kind/topic chips, flip between an
// image gallery and a sortable table, and SAVE VIEW to commit it.
(async () => {
  const { esc, $, nav, notes: load, unlock, api, modal, closeModal, toast, colorOf } = window.SB;
  nav("gallery");

  let notes = [], saved = [];
  try {
    notes = (await load()).notes;
    saved = await (await fetch("data/views.json", { cache: "no-cache" })).json();
  } catch { $("title").textContent = "COULD NOT LOAD"; return; }
  const ALL = { id: "all", data: { name: "All notes", about: "Every note in the brain.", layout: "table", filter: {}, sort: "added-desc" } };
  const views = [ALL, ...saved];
  const firstImg = (n) => (/!\[[^\]]*\]\((data\/media\/[^)\s]+\.(?:png|jpe?g|gif|webp))\)/i.exec(n.body || "") || [])[1];
  const host = (u) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return ""; } };

  let cur = null, state = null;
  const kinds = [...new Set(notes.map((n) => n.noteKind).filter(Boolean))].sort();
  const topics = [...new Set(notes.map((n) => n.topic))].sort();

  function pick(id) {
    cur = views.find((v) => v.id === id) || views[1] || ALL;
    const d = cur.data;
    state = { layout: d.layout || "gallery", kind: new Set(d.filter?.kind || []), topic: new Set(d.filter?.topic || []), status: d.filter?.status || [], tags: d.filter?.tags || [], sort: d.sort || "added-desc" };
    $("q").value = d.filter?.q || "";
    history.replaceState(null, "", "#" + cur.id);
    render();
  }

  function list() {
    const q = $("q").value.trim().toLowerCase();
    const [key, dir] = state.sort.split("-");
    return notes.filter((n) =>
      (!state.kind.size || state.kind.has(n.noteKind)) &&
      (!state.topic.size || state.topic.has(n.topic)) &&
      (!state.status.length || state.status.includes(n.status || "unread")) &&
      (!state.tags.length || state.tags.some((t) => (n.tags || []).includes(t))) &&
      (!q || [n.label, n.why, (n.tags || []).join(" "), (n.style || []).join(" ")].join(" ").toLowerCase().includes(q)))
      .sort((a, b) => {
        const va = key === "title" ? a.label : key === "kind" ? a.noteKind || "" : key === "topic" ? a.topic : key === "status" ? a.status || "" : a.added || "";
        const vb = key === "title" ? b.label : key === "kind" ? b.noteKind || "" : key === "topic" ? b.topic : key === "status" ? b.status || "" : b.added || "";
        return (dir === "asc" ? 1 : -1) * String(va).localeCompare(String(vb));
      });
  }

  function render() {
    $("side").innerHTML = `<div class="h">SAVED VIEWS</div>` + views.map((v) => `<button type="button" data-v="${esc(v.id)}" class="${v === cur ? "on" : ""}">${esc(v.data.name || v.id)}</button>`).join("") +
      (cur.data.about ? `<div class="about">${esc(cur.data.about)}</div>` : "");
    document.querySelectorAll("#layout button").forEach((b) => b.classList.toggle("on", b.dataset.l === state.layout));
    $("chips").innerHTML = `<span class="lbl">KIND</span>` + kinds.map((k) => `<button type="button" data-kind="${esc(k)}" class="${state.kind.has(k) ? "on" : ""}">${esc(k)}</button>`).join("") +
      `<span class="lbl">TOPIC</span>` + topics.map((t) => `<button type="button" data-topic="${esc(t)}" class="${state.topic.has(t) ? "on" : ""}"><span class="sq" style="background:${colorOf(t)}"></span>${esc(t)}</button>`).join("");
    const items = list();
    $("title").innerHTML = `${esc((cur.data.name || "").toUpperCase())} · <b>${items.length}</b>${state.status.length ? ` · STATUS ${esc(state.status.join(", ").toUpperCase())}` : ""}`;
    if (state.layout === "gallery") {
      $("out").innerHTML = `<div class="grid">${items.map((n) => {
        const img = firstImg(n);
        return `<a class="gcard" href="./#/n/${encodeURIComponent(n.slug)}" style="--c:${n.color}">
          ${img ? `<div class="im" style="background-image:url('${esc(img)}')"></div>` : `<div class="im none">${esc(n.label)}</div>`}
          <div class="bd"><div class="t">${esc(n.label)}</div><div class="k">${esc([n.noteKind, n.topic, n.added].filter(Boolean).join(" · "))}</div>
          ${(n.style || []).length ? `<div class="st">${n.style.slice(0, 4).map((s) => `<span>${esc(s)}</span>`).join("")}</div>` : n.why ? `<div class="k" style="text-transform:none;letter-spacing:0;font-family:var(--sans);font-size:12px;color:rgba(242,242,242,0.7)">${esc(n.why)}</div>` : ""}</div></a>`;
      }).join("")}</div>`;
    } else {
      const [key, dir] = state.sort.split("-");
      const th = (k, l, cls = "") => `<th data-sort="${k}" class="${cls}${key === k ? " on" : ""}">${l}${key === k ? (dir === "asc" ? " ↑" : " ↓") : ""}</th>`;
      $("out").innerHTML = `<table class="tbl"><thead><tr>${th("title", "TITLE")}${th("kind", "KIND")}${th("topic", "TOPIC", "hide-m")}<th class="hide-m">TAGS</th>${th("status", "STATUS", "hide-m")}${th("added", "ADDED")}<th class="hide-m">SOURCE</th></tr></thead><tbody>` +
        items.map((n) => `<tr><td><a href="./#/n/${encodeURIComponent(n.slug)}"><span class="sq" style="background:${n.color}"></span>${esc(n.label)}</a>${n.why ? `<div class="why">${esc(n.why)}</div>` : ""}</td>
          <td class="m">${esc(n.noteKind || "")}</td><td class="m hide-m">${esc(n.topic)}</td><td class="m hide-m">${esc((n.tags || []).slice(0, 4).join(" "))}</td>
          <td class="m hide-m">${esc(n.status || "")}</td><td class="m">${esc(n.added || "")}</td>
          <td class="m hide-m">${n.source ? `<a href="${esc(n.source)}" target="_blank" rel="noopener">${esc(host(n.source))} ↗</a>` : ""}</td></tr>`).join("") + `</tbody></table>`;
    }
  }

  $("side").addEventListener("click", (e) => { const b = e.target.closest("[data-v]"); if (b) pick(b.dataset.v); });
  $("layout").addEventListener("click", (e) => { const b = e.target.closest("[data-l]"); if (b) { state.layout = b.dataset.l; render(); } });
  $("chips").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const [set, v] = b.dataset.kind ? [state.kind, b.dataset.kind] : [state.topic, b.dataset.topic];
    set.has(v) ? set.delete(v) : set.add(v); render();
  });
  $("out").addEventListener("click", (e) => {
    const th = e.target.closest("[data-sort]"); if (!th) return;
    const [key, dir] = state.sort.split("-");
    state.sort = th.dataset.sort + "-" + (key === th.dataset.sort && dir === "desc" ? "asc" : "desc"); render();
  });
  $("q").addEventListener("input", render);

  $("b-save").onclick = () => modal(`<div class="m-h">SAVE VIEW</div>
    <p class="m-p">Saves these filters as <b>views/&lt;name&gt;.json</b> in the repo, so it shows up here for good.</p>
    <input name="n" value="${esc(cur === ALL ? "" : cur.data.name || "")}" placeholder="name, e.g. pixel art refs" required maxlength="50" />
    <input name="a" value="${esc(cur === ALL ? "" : cur.data.about || "")}" placeholder="one line about it (optional)" maxlength="140" />
    <div class="m-err" hidden></div>
    <div class="m-row"><button type="button" data-cancel>CANCEL</button><button type="submit">SAVE</button></div>`, async (m) => {
    const name = m.querySelector('[name="n"]').value.trim(), about = m.querySelector('[name="a"]').value.trim();
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "view";
    const data = { name, about, layout: state.layout, filter: {}, sort: state.sort };
    if (state.kind.size) data.filter.kind = [...state.kind];
    if (state.topic.size) data.filter.topic = [...state.topic];
    if (state.status.length) data.filter.status = state.status;
    if (state.tags.length) data.filter.tags = state.tags;
    if ($("q").value.trim()) data.filter.q = $("q").value.trim();
    closeModal();
    if (!(await unlock())) return;
    try {
      await api("board", { path: `views/${id}.json`, content: JSON.stringify(data), title: name });
      const ex = views.find((v) => v.id === id);
      if (ex) ex.data = data; else views.push({ id, path: `views/${id}.json`, data });
      pick(id);
      toast(`Saved view <b>${esc(name)}</b> to main.`);
    } catch (err) { toast(`Could not save: ${esc(err.message)}`); }
  });

  pick(decodeURIComponent(location.hash.slice(1)) || "style-refs");
})();
