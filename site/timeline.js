// Timeline view: every note as a clip on its `added` day, one track per topic, with a
// playhead you scrub like an NLE (J/K/L, drag the ruler). Notes after the playhead fade,
// so scrubbing replays how the brain grew.
(async () => {
  const { esc, $, nav, notes: load } = window.SB;
  nav("timeline");

  let notes = [];
  try { notes = (await load()).notes; } catch { $("tc").textContent = "COULD NOT LOAD"; return; }
  notes = notes.filter((n) => /^\d{4}-\d{2}-\d{2}/.test(n.added || "")).sort((a, b) => a.added.localeCompare(b.added) || a.label.localeCompare(b.label));
  if (!notes.length) return;

  const DAY = 86400000;
  const toDay = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const today = new Date();
  const start = toDay(notes[0].added) - DAY;
  const end = Math.max(toDay(notes[notes.length - 1].added), Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const days = Math.round((end - start) / DAY) + 1;
  const dayOf = (n) => Math.round((toDay(n.added) - start) / DAY);
  const fmt = (d) => new Date(start + d * DAY).toISOString().slice(0, 10);
  const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  // tracks: topics by size, each note on the first sub-row free on its day
  const topics = [...new Set(notes.map((n) => n.topic))].sort((a, b) => notes.filter((n) => n.topic === b).length - notes.filter((n) => n.topic === a).length);
  const CLIP_H = 22, GAP = 4, PAD = 6;
  const lanes = topics.map((t) => {
    const items = notes.filter((n) => n.topic === t);
    const perDay = new Map();
    for (const n of items) { const d = dayOf(n); n.row = perDay.get(d) || 0; perDay.set(d, n.row + 1); }
    const rows = Math.max(1, ...perDay.values());
    return { topic: t, items, rows, color: items[0].color, h: PAD * 2 + rows * CLIP_H + (rows - 1) * GAP };
  });

  let px = 0, head = days - 1, playing = null, sel = null;
  const scroll = $("scroll"), inner = $("inner");
  const fitPx = () => Math.max(26, Math.floor((scroll.clientWidth - 20) / days));

  $("heads").innerHTML = lanes.map((l) => `<div class="th" style="height:${l.h}px"><span class="sq" style="background:${l.color}"></span>${esc(l.topic.toUpperCase())}<span class="n">${l.items.length}</span></div>`).join("");

  function layout() {
    inner.style.width = days * px + "px";
    let r = "";
    for (let d = 0; d < days; d++) {
      const dt = new Date(start + d * DAY), wk = dt.getUTCDay() === 1;
      if (px < 40 && !wk && d % 2) continue;
      r += `<div class="tick${wk ? " wk" : ""}" style="left:${d * px}px">${MON[dt.getUTCMonth()]} ${String(dt.getUTCDate()).padStart(2, "0")}<i>D${String(d).padStart(2, "0")}</i></div>`;
    }
    $("ruler").innerHTML = r;
    $("lanes").innerHTML = lanes.map((l) => `<div class="lane" style="height:${l.h}px">${l.items.map((n) =>
      `<div class="clip" data-slug="${esc(n.slug)}" title="${esc(n.label)} · ${esc(n.added)}" style="--c:${n.color};left:${dayOf(n) * px + 1}px;top:${PAD + n.row * (CLIP_H + GAP)}px;width:${Math.max(18, px - 2)}px">${px >= 60 ? esc(n.label) : ""}</div>`).join("")}</div>`).join("");
    paint();
  }

  function paint() {
    const q = $("q").value.trim().toLowerCase();
    let count = 0;
    document.querySelectorAll(".clip").forEach((el) => {
      const n = bySlug.get(el.dataset.slug);
      const future = dayOf(n) > head;
      if (!future) count++;
      const hit = q && [n.label, n.why, (n.tags || []).join(" ")].join(" ").toLowerCase().includes(q);
      el.classList.toggle("future", future);
      el.classList.toggle("hit", !!hit && !future);
      el.classList.toggle("dim", !!q && !hit && !future);
      el.classList.toggle("sel", sel === n.slug);
    });
    $("ph").style.left = head * px + px / 2 + "px";
    const added = notes.filter((n) => dayOf(n) === head).length;
    $("tc").innerHTML = `${fmt(head)} · D${String(head).padStart(2, "0")} · <b>${count}</b> NOTES${added ? ` · +${added}` : ""}`;
    document.querySelector('[data-t="play"]').textContent = playing ? "❚❚" : "▶";
  }
  const bySlug = new Map(notes.map((n) => [n.slug, n]));

  function setHead(d, follow = true) {
    head = Math.max(0, Math.min(days - 1, d));
    paint();
    if (follow) {
      const x = head * px, w = scroll.clientWidth;
      if (x < scroll.scrollLeft + 40 || x > scroll.scrollLeft + w - 40) scroll.scrollLeft = x - w / 2;
    }
  }
  function togglePlay() {
    if (playing) { clearInterval(playing); playing = null; paint(); return; }
    if (head >= days - 1) setHead(0);
    playing = setInterval(() => { if (head >= days - 1) togglePlay(); else setHead(head + 1); }, 550);
    paint();
  }
  function zoom(z) {
    const centreDay = (scroll.scrollLeft + scroll.clientWidth / 2) / px;
    px = z === 0 ? fitPx() : Math.max(18, Math.min(240, Math.round(px * (z > 0 ? 1.5 : 1 / 1.5))));
    layout();
    scroll.scrollLeft = centreDay * px - scroll.clientWidth / 2;
  }

  // scrub on the ruler
  const ruler = $("ruler");
  const dayAt = (e) => Math.floor((e.clientX - ruler.getBoundingClientRect().left) / px);
  ruler.addEventListener("pointerdown", (e) => {
    ruler.setPointerCapture(e.pointerId); setHead(dayAt(e), false);
    const mv = (ev) => setHead(dayAt(ev), false);
    ruler.addEventListener("pointermove", mv);
    ruler.addEventListener("pointerup", () => ruler.removeEventListener("pointermove", mv), { once: true });
  });

  $("transport").addEventListener("click", (e) => {
    const t = e.target.closest("[data-t]")?.dataset.t;
    if (t === "start") setHead(0); else if (t === "end") setHead(days - 1);
    else if (t === "back") setHead(head - 1); else if (t === "fwd") setHead(head + 1); else if (t === "play") togglePlay();
  });
  $("zoom").addEventListener("click", (e) => { const z = e.target.closest("[data-z]"); if (z) zoom(+z.dataset.z); });
  $("q").addEventListener("input", paint);

  // inspector
  $("lanes").addEventListener("click", (e) => {
    const c = e.target.closest(".clip"); if (!c) return;
    const n = bySlug.get(c.dataset.slug); sel = n.slug; paint();
    const insp = $("insp");
    insp.style.setProperty("--c", n.color);
    insp.innerHTML = `<button class="x" type="button" aria-label="Close">✕</button>
      <div class="k">${esc([n.noteKind, n.topic, n.added].filter(Boolean).join(" · "))}</div>
      <h3>${esc(n.label)}</h3>
      ${n.why ? `<p>${esc(n.why)}</p>` : ""}
      ${(n.tags || []).length ? `<div class="k">#${n.tags.map(esc).join("  #")}</div>` : ""}
      <div class="row"><a href="./#/n/${encodeURIComponent(n.slug)}">OPEN IN GRAPH ↗</a>${n.source ? `<a href="${esc(n.source)}" target="_blank" rel="noopener">SOURCE ↗</a>` : ""}</div>`;
    insp.hidden = false;
    insp.querySelector(".x").onclick = () => { insp.hidden = true; sel = null; paint(); };
  });

  addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea")) return;
    const k = e.key.toLowerCase();
    if (k === "j" || e.key === "ArrowLeft") setHead(head - 1);
    else if (k === "l" || e.key === "ArrowRight") setHead(head + 1);
    else if (k === "k" || e.key === " ") { e.preventDefault(); togglePlay(); }
    else if (e.key === "Home") setHead(0);
    else if (e.key === "End") setHead(days - 1);
    else if (e.key === "+" || e.key === "=") zoom(1);
    else if (e.key === "-") zoom(-1);
    else if (e.key === "0") zoom(0);
    else if (e.key === "Escape") { $("insp").hidden = true; sel = null; paint(); }
    else if (e.key === "/") { e.preventDefault(); $("q").focus(); }
  });
  addEventListener("resize", () => { if (px < fitPx()) zoom(0); });

  px = Math.max(fitPx(), 70);
  layout();
  scroll.scrollLeft = inner.scrollWidth;
})();
