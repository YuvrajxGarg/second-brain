/* Second Brain graph. Canvas renderer on top of d3-force. */
(() => {
  "use strict";

  // ---------- constants ----------
  const PALETTE = {
    gamedev: "#39ff6a", design: "#ff4fd8", ai: "#4d6bff", tech: "#ff6a1a",
    business: "#ffe14d", productivity: "#22e4ff", health: "#ff3b5c",
    finance: "#c4ff3b", learning: "#a77bff", life: "#ffa94d", misc: "#a0a4ab", inbox: "#ffffff",
  };
  const EXTRA = ["#ff8a3d", "#3dffd0", "#ff3df2", "#7dff3d", "#3d8bff", "#ffd23d", "#ff5f7a", "#5fffe1"];
  const TYPE_CODE = {
    link: "LNK", note: "NOTE", idea: "IDEA", bookmark: "BKMK", quote: "QUOT", video: "VID",
    tool: "TOOL", book: "BOOK", person: "PRSN", place: "PLCE", recipe: "RCPE", todo: "TODO",
    game: "GAME", app: "APP", site: "SITE", company: "CO", concept: "CNCP",
  };
  // what a note is, in words: things he made, places he works, his own thoughts, or saves
  const OWN_KINDS = new Set(["idea", "thought", "todo"]);
  const GROUPS = [
    { id: "made", label: "MADE BY ME", test: (n) => n.noteKind === "project" || n.noteKind === "org" },
    { id: "mine", label: "MY IDEAS + THOUGHTS", test: (n) => OWN_KINDS.has(n.noteKind) },
    { id: "saved", label: "SAVED REFS", test: () => true },
  ];
  const groupOf = (n) => GROUPS.find((g) => g.test(n)).id;
  const typeLabel = (n) =>
    n.noteKind === "project" ? `${n.type} · made by me` :
    n.noteKind === "org" ? (n.type === "company" ? "company" : n.type) :
    OWN_KINDS.has(n.noteKind) ? (n.type === "note" ? "my note" : `my ${n.type}`) :
    `saved ${n.type}`;
  const GLYPHS = "!<>-_\\/[]{}=+*^?#01ABCDEFXYZ";
  const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = () => innerWidth <= 720;
  const PANEL_W = 460;

  const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  const colorOf = (topic) => {
    if (look.colors[topic]) return look.colors[topic];
    const pr = PRESETS[look.preset] || PRESETS.signal;
    const i = TOPIC_ORDER.indexOf(topic);
    return i >= 0 ? pr.colors[i] : pr.colors[(hash(topic || "") % (pr.colors.length - 1))];
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const pad = (n, w = 3) => String(n).padStart(w, "0");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hexA = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  };

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const canvas = $("stage");
  const ctx = canvas.getContext("2d");
  const tip = $("tip");
  const panel = $("panel");
  const panelInner = $("panel-inner");
  const q = $("q");
  const results = $("results");
  const intro = $("intro");

  // ---------- state ----------
  let W = 0, H = 0, DPR = 1;
  let transform = d3.zoomIdentity;
  let nodes = [], links = [], byId = new Map(), adj = new Map();
  let hoverId = null, selectedId = null;
  let searchSet = null;
  const hiddenTopics = new Set();
  const hiddenGroups = new Set();
  // remembered UI choices (collapsed panels, toggles); per browser
  const UI_KEY = "sb-ui";
  const ui = (() => {
    const def = { collapsed: { topics: isMobile(), filters: true, controls: isMobile() }, signals: !reduceMotion, labels: true, hud: true };
    try { const v = JSON.parse(localStorage.getItem(UI_KEY) || "null"); return v ? { ...def, ...v, collapsed: { ...def.collapsed, ...(v.collapsed || {}) } } : def; } catch { return def; }
  })();
  const saveUi = () => { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch {} };

  // ---------- look (customise panel) ----------
  // Site default comes from site/look.json (saved from edit mode); this browser's
  // own tweaks sit on top in localStorage.
  const TOPIC_ORDER = ["gamedev", "design", "ai", "tech", "business", "productivity", "health", "finance", "learning", "life", "misc", "inbox"];
  const PRESETS = {
    signal: { name: "SIGNAL", colors: TOPIC_ORDER.map((t) => PALETTE[t]) },
    neon: { name: "NEON", colors: ["#00ff9c", "#ff00e6", "#5b6bff", "#ff7b00", "#fff200", "#00e5ff", "#ff1744", "#b2ff00", "#b388ff", "#ffab40", "#9e9e9e", "#ffffff"] },
    pastel: { name: "PASTEL", colors: ["#9be7b0", "#f5a3d9", "#a3b5ff", "#ffb38a", "#fff1a3", "#a3f0ff", "#ff9fae", "#d8f5a3", "#c9b3ff", "#ffd1a3", "#c4c6cc", "#ffffff"] },
    sunset: { name: "SUNSET", colors: ["#ff6b35", "#ff2e63", "#ffb400", "#ff8fab", "#f9c74f", "#f3722c", "#d00000", "#ffd166", "#c77dff", "#ff9e00", "#b5838d", "#fff3e0"] },
    ocean: { name: "OCEAN", colors: ["#00f5d4", "#4cc9f0", "#4361ee", "#00bbf9", "#90e0ef", "#48cae4", "#7209b7", "#06d6a0", "#3a86ff", "#80ffdb", "#8d99ae", "#e0fbfc"] },
    mono: { name: "MONO", colors: ["#ffffff", "#e6e6e6", "#cccccc", "#b3b3b3", "#f2f2f2", "#d9d9d9", "#bfbfbf", "#a6a6a6", "#ededed", "#c7c7c7", "#8c8c8c", "#ffffff"] },
  };
  const LOOK_DEFAULT = {
    preset: "signal", colors: {}, bg: "#050505",
    shape: "square", nodeSize: 1, glow: 1, labelSize: 1, wobble: true,
    lines: "arc", curve: 1, lineWidth: 1, lineAlpha: 1, lineColor: "mono", dash: "wiki",
    spread: 1, gravity: 1, signalRate: 1,
    dust: true, grid: true, grain: true, vignette: true,
    sound: true, volume: 0.5, pack: "soft",
  };
  const LOOK_KEY = "sb-look";
  let siteLook = {};
  let look = (() => { try { return { ...LOOK_DEFAULT, ...JSON.parse(localStorage.getItem(LOOK_KEY) || "{}") }; } catch { return { ...LOOK_DEFAULT }; } })();
  const saveLook = () => { try { localStorage.setItem(LOOK_KEY, JSON.stringify(diffLook())); } catch {} };
  // only what differs from the site default is kept per browser
  function diffLook() {
    const base = { ...LOOK_DEFAULT, ...siteLook }, out = {};
    for (const k of Object.keys(LOOK_DEFAULT)) if (JSON.stringify(look[k]) !== JSON.stringify(base[k])) out[k] = look[k];
    return out;
  }
  let showSignals = ui.signals, showLabels = ui.labels;
  let introStart = 0;
  let mouse = { x: -1, y: -1, inside: false };
  const signals = [];
  const dust = [];
  let sim, zoom, graph;

  // ---------- glow sprites ----------
  const glowCache = new Map();
  function glow(color) {
    if (glowCache.has(color)) return glowCache.get(color);
    const s = 64, c = document.createElement("canvas");
    c.width = c.height = s;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, hexA(color, 0.55));
    grd.addColorStop(0.25, hexA(color, 0.18));
    grd.addColorStop(1, hexA(color, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    glowCache.set(color, c);
    return c;
  }

  // ---------- sizing ----------
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    if (!dust.length) {
      for (let i = 0; i < 90; i++) dust.push({ x: Math.random(), y: Math.random(), z: 0.2 + Math.random() * 0.8, p: Math.random() * 6.28 });
    }
  }

  const radius = (n) => look.nodeSize * (
    n.kind === "topic" ? 6 + Math.sqrt(n.count) * 1.6 :
    n.kind === "note" ? 3.6 + Math.min(4, Math.sqrt(n.deg) * 0.55) :
    1.7 + Math.sqrt(n.count) * 0.9);

  // ---------- data ----------
  async function load() {
    setBar(0.15);
    await loadSiteLook();
    applyBg(); applyBodyFx(); syncSoundBtn();
    setBar(0.25);
    const res = await fetch("data/graph.json", { cache: "no-cache" });
    graph = await res.json();
    setBar(0.7);

    nodes = graph.nodes.map((n) => ({ ...n }));
    links = graph.links.map((l) => ({ ...l }));
    byId = new Map(nodes.map((n) => [n.id, n]));
    adj = new Map(nodes.map((n) => [n.id, new Set()]));
    for (const l of links) { adj.get(l.source).add(l.target); adj.get(l.target).add(l.source); }

    const topics = nodes.filter((n) => n.kind === "topic").sort((a, b) => b.count - a.count);
    const R = 120 + nodes.length * 4.5;
    topics.forEach((t, i) => {
      const a = (i / topics.length) * Math.PI * 2 - Math.PI / 2;
      t.x = Math.cos(a) * R * 0.7; t.y = Math.sin(a) * R * 0.7;
    });
    for (const n of nodes) {
      n.deg = adj.get(n.id).size;
      n.color = n.kind === "tag" ? "#f2f2f2" : colorOf(n.topic);
      n.r = radius(n);
      n.phase = (hash(n.id) % 1000) / 159;
      n.a = 0; n.h = 0;
      n.delay = 0;
      n.code = n.kind === "note" ? (TYPE_CODE[n.type] || n.type.slice(0, 4).toUpperCase()) :
        n.kind === "tag" ? "#" : pad(n.count, 2);
      if (n.kind !== "topic") {
        const anchor = n.kind === "note" ? byId.get("t:" + n.topic) : byId.get([...adj.get(n.id)][0]);
        const ax = anchor?.x ?? 0, ay = anchor?.y ?? 0;
        n.x = ax + (Math.random() - 0.5) * 60; n.y = ay + (Math.random() - 0.5) * 60;
      }
      n.search = [n.label, n.kind === "note" ? n.tags.join(" ") + " " + n.topic + " " + n.type + " " + (n.noteKind || "") + " " + (n.why || "") + " " + (n.style || []).join(" ") + " " + (n.body || "") : ""].join(" ").toLowerCase();
    }
    // stagger the bloom from the centre outwards
    const maxD = Math.max(1, ...nodes.map((n) => Math.hypot(n.x, n.y)));
    for (const n of nodes) n.delay = (Math.hypot(n.x, n.y) / maxD) * 700 + (n.kind === "topic" ? 0 : 120) + Math.random() * 200;
    links.forEach((l, i) => { l.seed = (hash(l.source + l.target) % 1000) / 1000; l.i = i; });

    // related notes by shared tags
    for (const n of nodes) {
      if (n.kind !== "note") continue;
      const score = new Map();
      for (const t of n.tags) for (const m of adj.get("g:" + t)) if (m !== n.id) score.set(m, (score.get(m) || 0) + 1);
      for (const s of n.related || []) score.set("n:" + s, (score.get("n:" + s) || 0) + 3);
      n.near = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    }

    setupSim();
    setupHud();
    setBar(1);
  }

  function setupSim() {
    sim = d3.forceSimulation(nodes)
      .alphaDecay(0.018)
      .velocityDecay(0.38)
      .force("link", d3.forceLink(links).id((d) => d.id)
        .strength((l) => (l.kind === "tag" ? 0.35 : l.kind === "wiki" ? 0.2 : 0.28)))
      .force("charge", d3.forceManyBody().distanceMax(1100))
      .force("collide", d3.forceCollide().strength(0.9))
      .force("x", d3.forceX(0))
      .force("y", d3.forceY(0))
      .stop();
    applyForces(false);
    applyPins();
    // warm up off-screen so the bloom lands on a settled layout
    for (let i = 0; i < 260; i++) sim.tick();
    sim.alpha(0.12).restart();
  }

  function applyForces(kick = true) {
    if (!sim) return;
    const sp = look.spread;
    sim.force("link").distance((l) => (l.kind === "topic" ? 180 : l.kind === "wiki" ? 130 : 100) * sp);
    sim.force("charge").strength((d) => (d.kind === "topic" ? -1200 : d.kind === "note" ? -460 : -200) * sp * sp).distanceMax(1100 * sp);
    sim.force("collide").radius((d) => d.r + (d.kind === "tag" ? 10 : 18));
    sim.force("x").strength(0.022 * look.gravity);
    sim.force("y").strength(0.022 * look.gravity);
    if (kick) sim.alpha(0.5).restart();
  }

  // ---------- geometry ----------
  // Each link is a quadratic arc; the bend side and depth come from a stable seed.
  function arc(l) {
    const s = l.source, t = l.target;
    const x1 = s.dx, y1 = s.dy, x2 = t.dx, y2 = t.dy;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1;
    const bend = look.lines === "straight" ? 0 :
      (l.seed > 0.5 ? 1 : -1) * (0.18 + (l.seed % 0.5) * 0.5) * (l.kind === "wiki" ? 1.4 : 1) * look.curve;
    return { x1, y1, x2, y2, cx: mx - dy * bend, cy: my + dx * bend };
  }
  const qpt = (g, t) => {
    const u = 1 - t;
    return [u * u * g.x1 + 2 * u * t * g.cx + t * t * g.x2, u * u * g.y1 + 2 * u * t * g.cy + t * t * g.y2];
  };

  // point at t (0..1) along a link, for every line style
  function lpt(l, g, t) {
    if (look.lines === "elbow") {
      const hFirst = l.seed > 0.5;
      const d1 = hFirst ? Math.abs(g.x2 - g.x1) : Math.abs(g.y2 - g.y1);
      const d2 = hFirst ? Math.abs(g.y2 - g.y1) : Math.abs(g.x2 - g.x1);
      const s = t * (d1 + d2 || 1), sx = Math.sign(g.x2 - g.x1), sy = Math.sign(g.y2 - g.y1);
      if (hFirst) return s <= d1 ? [g.x1 + sx * s, g.y1] : [g.x2, g.y1 + sy * (s - d1)];
      return s <= d1 ? [g.x1, g.y1 + sy * s] : [g.x1 + sx * (s - d1), g.y2];
    }
    if (look.lines === "wave") {
      const dx = g.x2 - g.x1, dy = g.y2 - g.y1, len = Math.hypot(dx, dy) || 1;
      const waves = Math.max(1, Math.round(len / 70));
      const amp = Math.min(16, len * 0.07) * look.curve * (l.seed > 0.5 ? 1 : -1);
      const w = Math.sin(t * Math.PI * 2 * waves + l.seed * 6) * amp * Math.sin(Math.PI * t);
      return [g.x1 + dx * t - (dy / len) * w, g.y1 + dy * t + (dx / len) * w];
    }
    return qpt(g, t);
  }
  function traceLink(l, g, lp) {
    ctx.beginPath();
    ctx.moveTo(g.x1, g.y1);
    if (look.lines === "arc" || look.lines === "straight") {
      if (lp >= 1) ctx.quadraticCurveTo(g.cx, g.cy, g.x2, g.y2);
      else {
        // partial quadratic via de Casteljau
        const cx = g.x1 + (g.cx - g.x1) * lp, cy = g.y1 + (g.cy - g.y1) * lp;
        const [ex, ey] = qpt(g, lp);
        ctx.quadraticCurveTo(cx, cy, ex, ey);
      }
    } else if (look.lines === "elbow" && lp >= 1) {
      if (l.seed > 0.5) ctx.lineTo(g.x2, g.y1); else ctx.lineTo(g.x1, g.y2);
      ctx.lineTo(g.x2, g.y2);
    } else {
      const N = look.lines === "elbow" ? 40 : 22;
      for (let i = 1; i <= N; i++) { const [x, y] = lpt(l, g, (lp * i) / N); ctx.lineTo(x, y); }
    }
  }
  function shapePath(x, y, r, shape) {
    ctx.beginPath();
    if (shape === "circle") ctx.arc(x, y, r * 1.1, 0, 6.2832);
    else if (shape === "diamond") { const d = r * 1.35; ctx.moveTo(x, y - d); ctx.lineTo(x + d, y); ctx.lineTo(x, y + d); ctx.lineTo(x - d, y); ctx.closePath(); }
    else if (shape === "hex") { for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; ctx[i ? "lineTo" : "moveTo"](x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 1.2); } ctx.closePath(); }
    else if (shape === "triangle") { const d = r * 1.45; ctx.moveTo(x, y - d); ctx.lineTo(x + d * 0.87, y + d * 0.5); ctx.lineTo(x - d * 0.87, y + d * 0.5); ctx.closePath(); }
    else ctx.rect(x - r, y - r, r * 2, r * 2);
  }

  // ---------- focus / visibility ----------
  function focusSet() {
    const id = hoverId || selectedId;
    if (!id) return null;
    const s = new Set([id, ...adj.get(id)]);
    // a note's focus also lights its topic siblings faintly via tags: keep it tight, 1 hop
    return s;
  }
  function visible(n) {
    if (n.deleted) return false;
    if (n.kind === "note") return !hiddenTopics.has(n.topic) && !hiddenGroups.has(groupOf(n));
    if (n.kind === "topic") return !hiddenTopics.has(n.topic);
    for (const m of adj.get(n.id)) { const x = byId.get(m); if (x.kind === "note" && visible(x)) return true; }
    return false;
  }

  // ---------- render ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(50, now - last); last = now;
    const tIntro = now - introStart;
    const F = focusSet();
    const k = transform.k;

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = look.bg;
    ctx.fillRect(0, 0, W, H);
    drawBackdrop(now);

    // per-node animated state
    for (const n of nodes) {
      const vis = visible(n);
      let target = n.deleted ? 0 : vis ? 1 : 0.035;
      if (vis && F) target = F.has(n.id) ? 1 : 0.1;
      if (vis && searchSet) target = searchSet.has(n.id) ? 1 : Math.min(target, 0.12);
      n.a += (target - n.a) * Math.min(1, dt * 0.012);
      const hot = n.id === hoverId || n.id === selectedId || (searchSet && searchSet.has(n.id)) ? 1 : F && F.has(n.id) ? 0.45 : 0;
      n.h += (hot - n.h) * Math.min(1, dt * 0.012);
      const p = reduceMotion ? 1 : easeOutExpo(clamp((tIntro - n.delay) / 1300, 0, 1));
      n.p = p;
      const br = reduceMotion || !look.wobble ? 0 : 1.4;
      n.dx = n.x * p + Math.sin(now * 0.0007 + n.phase) * br;
      n.dy = n.y * p + Math.cos(now * 0.0006 + n.phase * 1.3) * br;
    }

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(k, k);

    // links
    const hair = (0.75 / k) * look.lineWidth;
    if (look.lines !== "none") for (const l of links) {
      const s = l.source, t = l.target;
      const lp = reduceMotion ? 1 : easeInOut(clamp((tIntro - Math.max(s.delay, t.delay) - 250) / 1100, 0, 1));
      if (lp <= 0) continue;
      const g = arc(l);
      const focus = F && F.has(s.id) && F.has(t.id) && (s.id === (hoverId || selectedId) || t.id === (hoverId || selectedId));
      const base = (l.kind === "topic" ? 0.2 : l.kind === "wiki" ? 0.42 : 0.17) * look.lineAlpha;
      let a = Math.min(1, base) * Math.min(s.a, t.a);
      if (focus) a = 0.9;
      if (a < 0.01) continue;
      const note = s.kind === "note" ? s : t.kind === "note" ? t : null;
      ctx.strokeStyle =
        look.lineColor === "rainbow" ? `hsla(${(l.seed * 360) | 0},90%,65%,${Math.min(1, a * 1.6)})` :
        (focus || look.lineColor === "topic") && note ? hexA(note.color, look.lineColor === "topic" ? Math.min(1, a * 1.6) : a) :
        `rgba(242,242,242,${a})`;
      ctx.lineWidth = focus ? hair * 1.6 : l.kind === "wiki" ? hair * 1.3 : hair;
      const dashed = look.dash === "all" || (look.dash === "wiki" && l.kind === "wiki");
      ctx.setLineDash(dashed && !focus ? [3 / k, 4 / k] : []);
      traceLink(l, g, lp);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // signals travelling along arcs
    if (showSignals) stepSignals(dt, tIntro, k);

    // nodes
    ctx.globalCompositeOperation = "lighter";
    for (const n of nodes) {
      if (n.p <= 0 || n.a < 0.02 || n.kind === "tag") continue;
      if (!look.glow) break;
      const gs = (n.r * (n.kind === "topic" ? 9 : 6)) * (1 + n.h * 0.8) * look.glow;
      ctx.globalAlpha = n.a * (0.55 + 0.25 * Math.sin(now * 0.002 + n.phase)) * n.p;
      ctx.drawImage(glow(n.color), n.dx - gs / 2, n.dy - gs / 2, gs, gs);
    }
    ctx.globalCompositeOperation = "source-over";
    for (const n of nodes) {
      if (n.p <= 0 || n.a < 0.02) continue;
      const r = n.r * (0.4 + 0.6 * n.p) * (1 + n.h * 0.35);
      ctx.globalAlpha = n.a;
      if (n.kind === "tag") {
        ctx.fillStyle = n.h > 0.3 ? "#ffffff" : "rgba(220,220,220,0.85)";
        ctx.beginPath(); ctx.arc(n.dx, n.dy, r, 0, 6.2832); ctx.fill();
      } else {
        ctx.fillStyle = n.color;
        shapePath(n.dx, n.dy, r, look.shape);
        ctx.fill();
        if (n.kind === "topic") {
          const o = r + 4 + Math.sin(now * 0.0025 + n.phase) * 1.2;
          ctx.strokeStyle = hexA(n.color, 0.7);
          ctx.lineWidth = 1 / k;
          shapePath(n.dx, n.dy, o, look.shape);
          ctx.stroke();
        }
        if (n.fx != null && !n.dragging) {
          // pinned: a small cross above the node
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 1 / k;
          const py = n.dy - r - 5 / Math.sqrt(k) - 2, d = 2.2 / Math.sqrt(k) + 1;
          ctx.beginPath(); ctx.moveTo(n.dx - d, py); ctx.lineTo(n.dx + d, py); ctx.moveTo(n.dx, py - d); ctx.lineTo(n.dx, py + d); ctx.stroke();
        }
      }
      if (n.id === selectedId) {
        // rotating crosshair brackets
        const o = r + 7 / Math.sqrt(k) + 2, L = 4 / Math.sqrt(k) + 1.5, rot = now * 0.0012;
        ctx.save();
        ctx.translate(n.dx, n.dy); ctx.rotate(rot);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.2 / k; ctx.globalAlpha = 1;
        for (let i = 0; i < 4; i++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath(); ctx.moveTo(-o, -o + L); ctx.lineTo(-o, -o); ctx.lineTo(-o + L, -o); ctx.stroke();
        }
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (showLabels) drawLabels(now, F);
    requestAnimationFrame(frame);
  }

  function drawBackdrop(now) {
    // drifting dust with parallax
    if (look.dust) for (const d of dust) {
      const px = ((d.x * W + transform.x * d.z * 0.15) % W + W) % W;
      const py = ((d.y * H + transform.y * d.z * 0.15 + now * 0.004 * d.z) % H + H) % H;
      ctx.fillStyle = `rgba(242,242,242,${0.05 + 0.08 * d.z * (0.5 + 0.5 * Math.sin(now * 0.001 + d.p))})`;
      ctx.fillRect(px, py, d.z * 1.4, d.z * 1.4);
    }
    // world-space dot grid
    const k = transform.k, step = 64 * k;
    if (step < 18 || !look.grid) return;
    const ox = transform.x % step, oy = transform.y % step;
    ctx.fillStyle = `rgba(242,242,242,${clamp((step - 18) / 120, 0, 0.07)})`;
    for (let x = ox; x < W; x += step) for (let y = oy; y < H; y += step) ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
  }

  // ---------- signals ----------
  let spawnAcc = 0;
  function spawnSignal(l, fromId, burst = false) {
    if (signals.length > 260) return;
    signals.push({
      l, t: 0, dir: fromId ? (l.source.id === fromId ? 1 : -1) : Math.random() < 0.5 ? 1 : -1,
      v: (burst ? 0.0011 : 0.00045) + Math.random() * 0.0005,
      burst,
    });
  }
  function stepSignals(dt, tIntro, k) {
    if (tIntro > 1800 && links.length) {
      spawnAcc += dt * Math.min(0.02, 0.002 + links.length * 0.00012) * look.signalRate;
      while (spawnAcc > 1) {
        spawnAcc -= 1;
        const l = links[(Math.random() * links.length) | 0];
        if (Math.min(l.source.a, l.target.a) > 0.5) spawnSignal(l);
      }
    }
    ctx.globalCompositeOperation = "lighter";
    for (let i = signals.length - 1; i >= 0; i--) {
      const s = signals[i];
      s.t += s.v * dt;
      if (s.t >= 1) { signals.splice(i, 1); continue; }
      const l = s.l, g = arc(l);
      const vis = Math.min(l.source.a, l.target.a);
      const note = l.source.kind === "note" ? l.source : l.target.kind === "note" ? l.target : null;
      const col = note ? note.color : "#ffffff";
      const fade = Math.sin(Math.PI * s.t);
      for (let j = 0; j < 7; j++) {
        const tt = s.t - j * 0.018;
        if (tt < 0) break;
        const [x, y] = lpt(l, g, s.dir > 0 ? tt : 1 - tt);
        const sz = ((s.burst ? 3.2 : 2.4) - j * 0.3) / k;
        ctx.globalAlpha = vis * fade * (1 - j / 7) * (s.burst ? 1 : 0.85);
        ctx.fillStyle = j === 0 ? "#ffffff" : col;
        ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  function burstFrom(id) {
    if (!showSignals) return;
    for (const l of links) if (l.source.id === id || l.target.id === id) spawnSignal(l, id, true);
  }

  // ---------- labels ----------
  const scrambles = new Map();
  function scrambled(id, text, now) {
    const st = scrambles.get(id);
    if (!st) return text;
    const p = (now - st) / 420;
    if (p >= 1) { scrambles.delete(id); return text; }
    let out = "";
    for (let i = 0; i < text.length; i++) {
      out += i < text.length * p || text[i] === " " ? text[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    return out;
  }
  const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

  function drawLabels(now, F) {
    const k = transform.k;
    const placed = [];
    const order = [...nodes].sort((a, b) => b.h - a.h || rank(a) - rank(b));
    function rank(n) { return n.kind === "topic" ? 0 : n.kind === "note" ? 1 : 2; }

    // node bodies are obstacles too, so labels don't sit on top of dots
    for (const n of nodes) {
      if (n.p < 0.6 || n.a < 0.05) continue;
      const rr = n.r * k + 2;
      placed.push({ x: n.dx * k + transform.x - rr, y: n.dy * k + transform.y - rr, w: rr * 2, h: rr * 2, node: n.id, dot: n.kind === "tag" });
    }
    const primary = hoverId || selectedId;
    ctx.textBaseline = "middle";
    for (const n of order) {
      if (n.p < 0.6 || n.a < 0.05) continue;
      const focused = n.h > 0.2;
      const show =
        focused || n.kind === "topic" ||
        (n.kind === "note" && k > 1.1) ||
        (n.kind === "tag" && k > 2.6);
      if (!show) continue;
      const sx = n.dx * k + transform.x, sy = n.dy * k + transform.y;
      if (sx < -200 || sx > W + 50 || sy < -20 || sy > H + 20) continue;

      const big = n.kind === "topic";
      const fs = (big ? 11 : n.kind === "note" ? 10.5 : 9.5) * look.labelSize;
      const kick = n.kind === "topic" ? n.label.toUpperCase() : n.code;
      const main = n.kind === "topic" ? pad(n.count, 2) : n.kind === "tag" ? n.label : trunc(n.label, isMobile() ? (focused ? 28 : 18) : focused ? 60 : 34);
      ctx.font = `${big ? 500 : 400} ${fs}px ${MONO}`;
      const kw = ctx.measureText(kick).width;
      const mw = ctx.measureText(main).width;
      const gap = n.kind === "tag" ? 1 : 7;
      const off = n.r * k * (1 + n.h * 0.35) + 8, y = sy, tw = kw + gap + mw;
      // note and topic labels only dodge other labels and squares, not tag dots
      const blocks = (r) => placed.some((p) => p.node !== n.id && !(p.dot && n.kind !== "tag") && !(p.node && n.kind === "topic") &&
        r.x < p.x + p.w && r.x + r.w > p.x && r.y < p.y + p.h && r.y + r.h > p.y);
      let x = sx + off;
      let rect = { x: x - 2, y: y - fs * 0.7, w: tw + 4, h: fs * 1.4 };
      if (n.id !== primary && blocks(rect)) {
        // try the left side before giving up
        x = sx - off - tw;
        rect = { x: x - 2, y: y - fs * 0.7, w: tw + 4, h: fs * 1.4 };
        if (blocks(rect)) continue;
      }
      placed.push(rect);

      const alpha = n.a * clamp((n.p - 0.6) / 0.4, 0, 1) * (n.kind === "tag" && !focused ? 0.62 : 1);
      // dark plate behind the text so arcs don't run through the letters
      ctx.globalAlpha = alpha * 0.82;
      ctx.fillStyle = look.bg;
      ctx.fillRect(x - 3, y - fs * 0.72, kw + gap + mw + 6, fs * 1.44);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = n.kind === "topic" ? n.color : "rgba(242,242,242,0.5)";
      ctx.fillText(scrambled(n.id + ":k", kick, now), x, y);
      ctx.fillStyle = n.kind === "topic" ? "rgba(242,242,242,0.55)" : "#f2f2f2";
      ctx.fillText(scrambled(n.id, main, now), x + kw + gap, y);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- interaction ----------
  function worldAt(px, py) { return transform.invert([px, py]); }
  function nodeAt(px, py) {
    const [x, y] = worldAt(px, py);
    let best = null, bd = Infinity;
    for (const n of nodes) {
      if (n.a < 0.3) continue;
      const d = Math.hypot(n.dx - x, n.dy - y);
      const hit = n.r + 6 / transform.k;
      if (d < hit && d < bd) { best = n; bd = d; }
    }
    return best;
  }

  function setHover(n) {
    const id = n ? n.id : null;
    if (id === hoverId) return;
    hoverId = id;
    canvas.classList.toggle("hovering", !!n);
    if (n) {
      sfx.play("hover", n);
      scrambles.set(n.id, performance.now());
      scrambles.set(n.id + ":k", performance.now());
      burstFrom(n.id);
    }
  }

  function showTip(n, px, py) {
    if (!n) { tip.hidden = true; return; }
    let html;
    if (n.kind === "note") html = `<span class="t-k">${esc(typeLabel(n).toUpperCase())}</span>${esc(n.topic.toUpperCase())} · ${esc(n.added)}`;
    else if (n.kind === "tag") html = `<span class="t-k">TAG</span>${n.count} NOTE${n.count === 1 ? "" : "S"}`;
    else html = `<span class="t-k">TOPIC</span>${n.count} NOTE${n.count === 1 ? "" : "S"}`;
    tip.innerHTML = html;
    tip.hidden = false;
    tip.style.left = px + "px";
    tip.style.top = py + "px";
  }

  function setupInteraction() {
    zoom = d3.zoom()
      .scaleExtent([0.12, 6])
      .on("zoom", (e) => { transform = e.transform; updateCoords(); });

    const drag = d3.drag()
      .subject((e) => {
        const n = nodeAt(e.x, e.y);
        return n ? { n, x: e.x, y: e.y } : null;
      })
      .on("start", (e) => { e.subject.moved = false; })
      .on("drag", (e) => {
        const s = e.subject;
        if (!s.moved) {
          if (Math.hypot(e.x - s.x, e.y - s.y) < 4) return;
          s.moved = true;
          s.n.dragging = true;
          sfx.play("grab", s.n);
          canvas.classList.add("dragging");
          sim.alphaTarget(0.25).restart();
        }
        const [x, y] = worldAt(e.x, e.y);
        s.n.fx = x; s.n.fy = y;
      })
      .on("end", (e) => {
        if (!e.subject.moved) return;
        canvas.classList.remove("dragging");
        sim.alphaTarget(0);
        const n = e.subject.n;
        n.dragging = false;
        if (pins[n.id] || e.sourceEvent?.shiftKey) setPin(n, true);
        else { n.fx = null; n.fy = null; }
        sfx.play("drop", n);
      });

    d3.select(canvas).call(drag).call(zoom).on("dblclick.zoom", null);

    canvas.addEventListener("pointermove", (e) => {
      mouse = { x: e.clientX, y: e.clientY, inside: true };
      const n = nodeAt(e.clientX, e.clientY);
      setHover(n);
      showTip(e.pointerType === "mouse" ? n : null, e.clientX, e.clientY);
      updateCoords();
    });
    canvas.addEventListener("pointerleave", () => { setHover(null); showTip(null); mouse.inside = false; });
    canvas.addEventListener("click", (e) => {
      const n = nodeAt(e.clientX, e.clientY);
      if (n) go(n);
      else if (selectedId) go(null);
    });
    canvas.addEventListener("dblclick", (e) => {
      const n = nodeAt(e.clientX, e.clientY);
      if (!n) fit();
    });

    $("panel-close").addEventListener("click", () => go(null));
    $("b-reset").addEventListener("click", () => { go(null); fit(); });
    $("b-signals").addEventListener("click", toggleSignals);
    $("b-labels").addEventListener("click", toggleLabels);
    $("b-random").addEventListener("click", randomNote);
    $("b-tour").addEventListener("click", () => toggleTour());
    $("b-sound").addEventListener("click", () => { look.sound = !look.sound; saveLook(); syncSoundBtn(); if (look.sound) { sfx.unlock(); sfx.play("toggle", true); } });
    $("b-help").addEventListener("click", showHelp);
    $("b-hud").addEventListener("click", () => toggleHud(true));

    addEventListener("keydown", (e) => {
      const typing = document.activeElement === q;
      if (e.target.closest && e.target.closest("input, textarea, select, .modal")) {
        if (e.key === "Escape" && editor.modal) closeModal();
        return;
      }
      if (e.key === "Escape") {
        if (typing) { q.value = ""; onSearch(); q.blur(); } else go(null);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") { e.preventDefault(); q.focus(); }
      else if (e.key === "r" || e.key === "R") { go(null); fit(); }
      else if (e.key === "s" || e.key === "S") toggleSignals();
      else if (e.key === "l" || e.key === "L") toggleLabels();
      else if (e.key === "n" || e.key === "N") randomNote();
      else if (e.key === "h" || e.key === "H") toggleHud();
      else if (e.key === "t" || e.key === "T") toggleDock("topics");
      else if (e.key === "?") showHelp();
    });

    addEventListener("resize", () => { resize(); });
    addEventListener("hashchange", route);
  }

  function toggleSignals() { showSignals = !showSignals; ui.signals = showSignals; saveUi(); syncToggles(); sfx.play("toggle", showSignals); if (!showSignals) signals.length = 0; }
  function toggleLabels() { showLabels = !showLabels; ui.labels = showLabels; saveUi(); syncToggles(); sfx.play("toggle", showLabels); }
  function syncToggles() { $("b-signals").classList.toggle("on", showSignals); $("b-labels").classList.toggle("on", showLabels); }

  function randomNote() {
    const pool = nodes.filter((n) => n.kind === "note" && visible(n) && n.id !== selectedId);
    if (pool.length) { sfx.play("dice"); go(pool[(Math.random() * pool.length) | 0]); }
  }
  function toggleHud(force) {
    ui.hud = typeof force === "boolean" ? force : !ui.hud;
    saveUi();
    document.body.classList.toggle("hud-hidden", !ui.hud);
    $("b-hud").hidden = ui.hud;
    if (!ui.hud) toast("Panels hidden. Press H or use SHOW PANELS to bring them back.", 3500);
  }
  function showHelp() {
    const rows = [
      ["/", "Search notes, tags and topics"], ["Esc", "Close the note or clear search"], ["N", "Open a random note"],
      ["R", "Reset the view"], ["T", "Collapse or expand topics"], ["H", "Hide or show all panels"],
      ["S", "Signals on or off"], ["L", "Labels on or off"], ["E", "Edit mode"],
      ["C", "Customise the look"], ["X", "Shake the graph"], ["P", "Tour: hop between random notes"],
      ["I", "Save the view as an image"], ["M", "Sound on or off"],
      ["Right-click", "Menu for any node or empty space (long-press on phone)"],
      ["Shift+drag", "Pin a node where you drop it"],
      ["Click", "Open a node · drag to move it"], ["Topic", "Click to hide · double-click to show only it"],
    ];
    openModal(`<div class="m-h">SHORTCUTS</div><dl class="help-grid">${rows.map(([k, d]) => `<dt><kbd>${esc(k)}</kbd></dt><dd>${esc(d)}</dd>`).join("")}</dl>
      <div class="m-row"><button type="submit">GOT IT</button></div>`, () => closeModal());
  }

  function updateCoords() {
    const [x, y] = mouse.inside ? worldAt(mouse.x, mouse.y) : [0, 0];
    const f = (v) => (v < 0 ? "-" : " ") + Math.abs(v).toFixed(2).padStart(6, "0");
    $("coords").textContent = `X${f(x)} · Y${f(y)} · Z ${transform.k.toFixed(2)}`;
  }

  // ---------- camera ----------
  function bounds(list) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of list) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y); }
    return { x0, y0, x1, y1 };
  }
  function viewport() {
    const panelOpen = panel.classList.contains("open");
    if (panelOpen && !isMobile()) return { w: W - PANEL_W, h: H, ox: 0, oy: 0 };
    if (panelOpen && isMobile()) return { w: W, h: H * 0.38 - 110, ox: 0, oy: 110 };
    return { w: W, h: H, ox: 0, oy: 0 };
  }
  function fit(duration = 1100) {
    const list = nodes.filter((n) => visible(n));
    if (!list.length) return;
    const b = bounds(list);
    const vp = viewport();
    const padX = isMobile() ? 150 : 260, padY = isMobile() ? 220 : 200;
    const k = clamp(Math.min((vp.w - padX) / Math.max(1, b.x1 - b.x0), (vp.h - padY) / Math.max(1, b.y1 - b.y0)), 0.15, 1.8);
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const t = d3.zoomIdentity.translate(vp.w / 2 - cx * k - (isMobile() ? 30 : 60), vp.oy + vp.h / 2 - cy * k + (isMobile() ? 20 : 0)).scale(k);
    d3.select(canvas).transition().duration(duration).ease(d3.easeCubicInOut).call(zoom.transform, t);
  }
  function flyTo(n) {
    const vp = viewport();
    const k = clamp(Math.max(transform.k, n.kind === "tag" ? 1.5 : 1.3), 0.6, 2.4);
    const t = d3.zoomIdentity.translate(vp.w / 2 - n.x * k, vp.oy + vp.h / 2 - n.y * k).scale(k);
    d3.select(canvas).transition().duration(1000).ease(d3.easeCubicInOut).call(zoom.transform, t);
  }

  // ---------- routing / selection ----------
  const keyOf = (n) => (n.kind === "note" ? "n/" + encodeURIComponent(n.slug) : n.kind === "tag" ? "g/" + encodeURIComponent(n.label) : "t/" + encodeURIComponent(n.label));
  function go(n) {
    const h = n ? "#/" + keyOf(n) : "#/";
    if (location.hash === h) route(); else location.hash = h;
  }
  function route() {
    const m = location.hash.match(/^#\/(n|g|t)\/(.+)$/);
    if (!m) { select(null); return; }
    const id = (m[1] === "n" ? "n:" : m[1] === "g" ? "g:" : "t:") + decodeURIComponent(m[2]);
    const n = byId.get(id);
    if (!n || n.deleted) {
      toast(`Couldn't find <b>${esc(decodeURIComponent(m[2]))}</b>. It may have been renamed or deleted.`, 5000);
      history.replaceState(null, "", "#/");
      select(null);
      return;
    }
    select(n);
  }
  function select(n) {
    if (!n) {
      selectedId = null;
      closePanel();
      return;
    }
    if (n.topic && hiddenTopics.has(n.topic)) { hiddenTopics.delete(n.topic); renderLegend(); }
    if (n.kind === "note" && hiddenGroups.has(groupOf(n))) { hiddenGroups.delete(groupOf(n)); renderGroups(); }
    if (selectedId !== n.id) sfx.play("open", n);
    selectedId = n.id;
    scrambles.set(n.id, performance.now());
    burstFrom(n.id);
    openPanel(n);
    flyTo(n);
  }

  // ---------- panel ----------
  function closePanel() {
    editor.node = null; editor.file = null;
    if (!panel.classList.contains("open")) return;
    sfx.play("close");
    panel.classList.remove("open");
    document.body.classList.remove("panel-open");
    panel.setAttribute("aria-hidden", "true");
  }
  function noteRow(id, extra) {
    const n = byId.get(id);
    if (!n) return "";
    return `<li data-go="${esc(n.id)}"><span class="sq" style="background:${n.color}"></span><span class="l-t">${esc(n.label)}</span><span class="l-k">${esc(extra || n.code)}</span></li>`;
  }
  function openPanel(n) {
    editor.node = null; editor.file = null;
    panel.style.setProperty("--panel-accent", n.kind === "tag" ? "#f2f2f2" : n.color);
    let html = "";
    if (n.kind === "note") {
      const host = n.source ? (() => { try { return new URL(n.source).host.replace(/^www\./, ""); } catch { return n.source; } })() : null;
      const raw = DOMPurify.sanitize(marked.parse(n.body || ""), { ADD_ATTR: ["target"] });
      html += `<div class="p-kicker"><span class="sq" style="background:${n.color}"></span>${esc(n.topic)} · ${esc(typeLabel(n))}</div>`;
      html += `<h1 class="p-title" data-title>${esc(n.label)}</h1>`;
      html += `<div class="p-edit mono${editor.pass ? "" : " locked"}"><button data-edit="edit">EDIT NOTE</button><button data-edit="delete" class="danger">DELETE</button></div>`;
      html += `<dl class="p-meta">
        ${n.why ? `<dt>${n.noteKind === "project" ? "MADE FOR" : n.noteKind === "org" ? "WHAT" : "WHY"}</dt><dd class="wrap">${esc(n.why)}</dd>` : ""}
        ${n.state ? `<dt>STATE</dt><dd>${esc(n.state)}</dd>` : ""}
        ${n.stack && n.stack.length ? `<dt>STACK</dt><dd>${esc(n.stack.join(", "))}</dd>` : ""}
        ${n.noteKind ? `<dt>KIND</dt><dd>${esc(n.noteKind)}${n.stage ? " · " + esc(n.stage) : ""}</dd>` : ""}
        ${n.style && n.style.length ? `<dt>STYLE</dt><dd>${esc(n.style.join(", "))}</dd>` : ""}
        <dt>ADDED</dt><dd>${esc(n.added)}</dd>
        ${n.status ? `<dt>STATUS</dt><dd>${esc(n.status)}</dd>` : ""}
        ${n.source ? `<dt>SOURCE</dt><dd><a href="${esc(n.source)}" target="_blank" rel="noopener">${esc(host)} ↗</a></dd>` : ""}
        <dt>FILE</dt><dd><a href="${esc(graph.repo)}/blob/main/${esc(n.path)}" target="_blank" rel="noopener">${esc(n.path)}</a></dd>
      </dl>`;
      html += `<div class="chips">${n.tags.map((t) => `<button class="chip" data-go="g:${esc(t)}"><span class="c">#</span>${esc(t)}</button>`).join("")}</div>`;
      html += `<article class="md">${raw}</article>`;
      if (n.near && n.near.length) {
        html += `<div class="md"><h2>Connected</h2></div><ul class="list">${n.near.map(([id, s]) => noteRow(id, s >= 3 ? "LINKED" : `${s} SHARED`)).join("")}</ul>`;
      }
    } else {
      const notes = [...adj.get(n.id)].map((id) => byId.get(id)).filter((m) => m.kind === "note").sort((a, b) => (b.added || "").localeCompare(a.added || ""));
      const kicker = n.kind === "tag" ? "TAG" : "TOPIC";
      html += `<div class="p-kicker"><span class="sq ${n.kind === "tag" ? "ring" : ""}" style="background:${n.color}"></span>${kicker} · ${pad(notes.length, 2)} NOTES</div>`;
      html += `<h1 class="p-title" data-title>${n.kind === "tag" ? "#" : ""}${esc(n.label)}</h1>`;
      // co-occurring tags
      const co = new Map();
      for (const m of notes) for (const t of m.tags) if (!(n.kind === "tag" && t === n.label)) co.set(t, (co.get(t) || 0) + 1);
      const top = [...co.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
      if (top.length) html += `<div class="chips">${top.map(([t, c]) => `<button class="chip" data-go="g:${esc(t)}"><span class="c">#</span>${esc(t)}<span class="c">${c}</span></button>`).join("")}</div>`;
      html += `<ul class="list">${notes.map((m) => noteRow(m.id, m.added)).join("")}</ul>`;
    }
    panelInner.innerHTML = html;
    panelInner.scrollTop = 0;
    panelInner.querySelectorAll(".md a[href]").forEach((a) => {
      if (!a.getAttribute("href").startsWith("#")) { a.target = "_blank"; a.rel = "noopener"; }
    });
    // restart entrance animation
    panel.classList.remove("open");
    void panel.offsetWidth;
    panel.classList.add("open");
    document.body.classList.add("panel-open");
    panel.setAttribute("aria-hidden", "false");
    scrambleEl(panelInner.querySelector("[data-title]"), 520);
  }
  panelInner.addEventListener("click", (e) => {
    const ed = e.target.closest("[data-edit]");
    if (ed) { onEditAction(ed.dataset.edit, ed); return; }
    const el = e.target.closest("[data-go]");
    if (el) go(byId.get(el.dataset.go));
  });
  panelInner.addEventListener("mouseover", (e) => {
    const el = e.target.closest("[data-go]");
    setHover(el ? byId.get(el.dataset.go) : null);
  });
  panelInner.addEventListener("mouseleave", () => setHover(null));

  // ---------- edit mode ----------
  // Unlock with the passcode (EDIT button, or press E). Saves go to /api/edit, which
  // commits to GitHub; Vercel then rebuilds the graph in about a minute.
  const KINDS = ["style-ref", "website-ref", "game-ref", "library", "asset-source", "tool", "technique", "advice", "idea", "thought", "todo", "project", "org"];
  const STAGES = ["", "new", "exploring", "doing", "done", "dropped"];
  const STATUSES = ["", "unread", "read", "done", "archived"];
  const PASS_KEY = "sb-edit-pass";
  const store = {
    get() { try { return localStorage.getItem(PASS_KEY) || ""; } catch { return ""; } },
    set(v) { try { v ? localStorage.setItem(PASS_KEY, v) : localStorage.removeItem(PASS_KEY); } catch {} },
  };
  const editor = { pass: store.get(), modal: null, file: null, node: null, busy: false };

  async function api(action, payload = {}, pass = editor.pass) {
    const r = await fetch("/api/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${pass}` },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) { editor.pass = ""; store.set(""); syncEditButton(); }
    if (!r.ok) throw new Error(data.error || `Error ${r.status}`);
    return data;
  }

  function syncEditButton() {
    const b = $("b-edit");
    b.classList.toggle("on", !!editor.pass);
    b.textContent = editor.pass ? "EDITING" : "EDIT";
    b.title = editor.pass ? "Edit mode is on. Click to lock (E)" : "Unlock edit mode (E)";
    const sel = selectedId && byId.get(selectedId);
    if (sel && panel.classList.contains("open") && !editor.node) openPanel(sel);
  }

  function toast(html, ms = 6000) {
    const t = $("toast");
    t.innerHTML = html;
    t.hidden = false;
    t.classList.remove("show"); void t.offsetWidth; t.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.classList.remove("show"); setTimeout(() => (t.hidden = true), 400); }, ms);
  }

  function openModal(html, onSubmit) {
    closeModal();
    const m = document.createElement("div");
    m.className = "modal";
    m.innerHTML = `<form class="modal-card mono">${html}</form>`;
    document.body.appendChild(m);
    editor.modal = m;
    m.addEventListener("click", (e) => { if (e.target === m || e.target.closest("[data-cancel]")) closeModal(); });
    m.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); onSubmit(m); });
    setTimeout(() => m.querySelector("input, button[type=submit]")?.focus(), 30);
    return m;
  }
  function closeModal() { editor.modal?.remove(); editor.modal = null; }

  function toggleEdit(then) {
    if (editor.pass) {
      openModal(`<div class="m-h">LOCK EDIT MODE?</div><p class="m-p">This browser will forget the passcode.</p>
        <div class="m-row"><button type="button" data-cancel>CANCEL</button><button type="submit">LOCK</button></div>`, () => {
        editor.pass = ""; store.set(""); closeModal(); closeEditor(); syncEditButton(); toast("Edit mode locked.");
      });
      return;
    }
    openModal(`<div class="m-h">UNLOCK EDIT MODE</div>
      <p class="m-p">Changes are committed straight to GitHub and the site rebuilds in about a minute.</p>
      <input type="password" name="pass" placeholder="passcode" autocomplete="current-password" required />
      <div class="m-err" hidden></div>
      <div class="m-row"><button type="button" data-cancel>CANCEL</button><button type="submit">UNLOCK</button></div>`, async (m) => {
      const pass = m.querySelector("[name=pass]").value.trim();
      const err = m.querySelector(".m-err");
      try {
        await api("check", {}, pass);
        editor.pass = pass; store.set(pass); closeModal(); syncEditButton();
        if (typeof then === "function") then();
        else toast("Edit mode on. Open any note and use EDIT NOTE or DELETE.");
      } catch (e) { err.hidden = false; err.textContent = e.message; }
    });
  }

  // --- frontmatter helpers (keep key order and any keys the form doesn't know) ---
  function splitNote(text) {
    const m = text.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!m) return { lines: [], body: text };
    return { lines: m[1].split("\n"), body: m[2] };
  }
  const keyOfLine = (l) => { const i = l.indexOf(":"); return i > 0 && !/^\s/.test(l) ? l.slice(0, i).trim() : null; };
  const unq = (v) => v.trim().replace(/^["']|["']$/g, "");
  function fmGet(lines, key) {
    const l = lines.find((x) => keyOfLine(x) === key);
    return l ? l.slice(l.indexOf(":") + 1).split(" #")[0].trim() : "";
  }
  const listOf = (v) => unq(v).replace(/^\[|\]$/g, "").split(",").map(unq).filter(Boolean);
  function yamlScalar(v) {
    v = String(v).replace(/[\r\n]+/g, " ").replace(/ #/g, " ").trim();
    if (!v) return "";
    return /: |^[\[\]{}&*!|>'"%@`#,?:-]|^(true|false|null|yes|no)$/i.test(v) ? `"${v.replace(/"/g, "'")}"` : v;
  }
  function fmSet(lines, key, value, afterKey) {
    const i = lines.findIndex((x) => keyOfLine(x) === key);
    if (value === "" || value == null) { if (i >= 0) lines.splice(i, 1); return; }
    const line = `${key}: ${value}`;
    if (i >= 0) { lines[i] = line; return; }
    let j = afterKey ? lines.findIndex((x) => keyOfLine(x) === afterKey) : -1;
    if (j < 0) j = Math.max(0, lines.findIndex((x) => keyOfLine(x) === "added") - 1);
    lines.splice(j + 1, 0, line);
  }
  const kebab = (s) => s.toLowerCase().trim().replace(/^#/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const opts = (list, cur) => [...new Set([...list, cur].filter((x) => x != null))].map((o) => `<option value="${esc(o)}" ${o === cur ? "selected" : ""}>${esc(o || "—")}</option>`).join("");

  function onEditAction(what, btn) {
    const n = selectedId && byId.get(selectedId);
    if (!n || n.kind !== "note") return;
    if (!editor.pass && what !== "cancel") return toggleEdit(() => onEditAction(what));
    if (what === "edit") return openEditor(n);
    if (what === "delete") return confirmDelete(n);
    if (what === "cancel") return closeEditor(true);
  }

  async function openEditor(n) {
    if (editor.busy) return;
    editor.busy = true;
    const bar = panelInner.querySelector(".p-edit");
    if (bar) bar.innerHTML = `<span class="dim">LOADING FROM GITHUB…</span>`;
    try {
      editor.file = await api("get", { path: n.path });
      editor.node = n;
      renderEditor();
    } catch (e) {
      toast(`Couldn't open the note: ${esc(e.message)}`);
      openPanel(n);
    } finally { editor.busy = false; }
  }

  function renderEditor() {
    const n = editor.node, { lines, body } = splitNote(editor.file.content);
    const g = (k) => unq(fmGet(lines, k));
    const topics = [...new Set([...nodes.filter((x) => x.kind === "topic").map((x) => x.label), "ai", "tech", "business", "design", "productivity", "health", "finance", "learning", "life", "misc", "gamedev", "inbox"])].sort();
    const kind = g("kind");
    const field = (label, name, val, hint = "") =>
      `<label class="f"><span>${label}${hint ? ` <i>${hint}</i>` : ""}</span><input name="${name}" value="${esc(val)}" autocomplete="off" spellcheck="false" /></label>`;
    panelInner.innerHTML = `
      <div class="p-kicker"><span class="sq" style="background:${n.color}"></span>EDITING · ${esc(editor.file.path)}</div>
      <form class="editor mono" id="editor" autocomplete="off">
        ${field("TITLE", "title", g("title"), "2 to 4 words")}
        <label class="f"><span>${kind === "project" ? "MADE FOR" : "WHY"}</span><textarea name="why" rows="2">${esc(g("why"))}</textarea></label>
        ${field("TAGS", "tags", listOf(fmGet(lines, "tags")).join(", "), "comma separated")}
        <div class="f-row">
          <label class="f"><span>TOPIC</span><select name="topic">${opts(topics, n.topic)}</select></label>
          <label class="f"><span>KIND</span><select name="kind">${opts(["", ...KINDS], kind)}</select></label>
        </div>
        <div class="f-row">
          ${field("TYPE", "type", g("type"))}
          <label class="f"><span>STATUS</span><select name="status">${opts(STATUSES, g("status"))}</select></label>
          <label class="f"><span>STAGE</span><select name="stage">${opts(STAGES, g("stage"))}</select></label>
        </div>
        ${field("STYLE", "style", listOf(fmGet(lines, "style")).join(", "), "visual notes, comma separated")}
        ${kind === "project" || kind === "org" || g("state") ? `<div class="f-row">${field("STATE", "state", g("state"))}${field("STACK", "stack", listOf(fmGet(lines, "stack")).join(", "))}</div>` : ""}
        ${field("SOURCE", "source", g("source"), "link")}
        <label class="f"><span>NOTE TEXT <i>markdown: summary, raw, notes</i></span><textarea name="body" rows="16">${esc(body.replace(/^\n+/, ""))}</textarea></label>
        <div class="m-err" hidden></div>
        <div class="p-edit"><button type="button" data-edit="cancel">CANCEL</button><button type="submit" class="primary">SAVE TO GITHUB</button></div>
      </form>`;
    panelInner.scrollTop = 0;
    $("editor").addEventListener("submit", (e) => { e.preventDefault(); saveEditor(); });
    setTimeout(() => $("editor").querySelector("[name=title]").focus(), 30);
  }

  function closeEditor(reopen) {
    const n = editor.node;
    editor.node = null; editor.file = null;
    if (reopen && n && !n.deleted) openPanel(n);
  }

  async function saveEditor() {
    if (editor.busy || !editor.node) return;
    const form = $("editor"), n = editor.node, file = editor.file;
    const v = (k) => (form.elements[k] ? form.elements[k].value.trim() : null);
    const err = form.querySelector(".m-err");
    const title = v("title");
    if (!title) { err.hidden = false; err.textContent = "Title can't be empty."; return; }
    const { lines, body } = splitNote(file.content);
    const list = (s, fn = (x) => x) => { const a = s.split(",").map((x) => fn(x.trim())).filter(Boolean); return a.length ? `[${[...new Set(a)].join(", ")}]` : ""; };
    const topic = v("topic");
    fmSet(lines, "title", yamlScalar(title));
    if (v("type") != null) fmSet(lines, "type", yamlScalar(v("type")), "title");
    fmSet(lines, "topic", yamlScalar(topic), "type");
    fmSet(lines, "tags", list(v("tags"), kebab), "topic");
    fmSet(lines, "kind", yamlScalar(v("kind")), "tags");
    fmSet(lines, "why", yamlScalar(v("why")), "kind");
    fmSet(lines, "style", list(v("style"), (x) => x.replace(/[\[\]]/g, "")), "why");
    fmSet(lines, "stage", yamlScalar(v("stage")), "style");
    if (v("state") != null) fmSet(lines, "state", yamlScalar(v("state")), "why");
    if (v("stack") != null) fmSet(lines, "stack", list(v("stack")), "state");
    fmSet(lines, "source", yamlScalar(v("source")), "stage");
    fmSet(lines, "status", yamlScalar(v("status")), "added");
    const newBody = "\n" + form.elements.body.value.replace(/\r\n/g, "\n").replace(/^\n+/, "").replace(/\s*$/, "\n");
    const content = `---\n${lines.join("\n")}\n---\n${newBody}`;
    const fileName = file.path.split("/").pop();
    const newPath = topic === "inbox" ? `inbox/${fileName}` : `topics/${topic}/${fileName}`;
    if (content === file.content && newPath === file.path) { closeEditor(true); return; }

    editor.busy = true;
    const btn = form.querySelector("[type=submit]");
    btn.textContent = "SAVING…"; btn.disabled = true; err.hidden = true;
    try {
      const r = await api("save", { path: file.path, sha: file.sha, content, title, newPath: newPath !== file.path ? newPath : undefined });
      applyLocal(n, content, r.path);
      sfx.play("save");
      closeEditor(true);
      toast(`Saved to GitHub · <a href="${esc(graph.repo)}/commit/${esc(r.commit)}" target="_blank" rel="noopener">${esc(r.commit.slice(0, 7))}</a>. The graph rebuilds in about a minute.`, 8000);
    } catch (e) {
      err.hidden = false; err.textContent = e.message;
      btn.textContent = "SAVE TO GITHUB"; btn.disabled = false;
    } finally { editor.busy = false; }
  }

  // Show the edit right away; links and counts catch up after the rebuild.
  function applyLocal(n, content, newPath) {
    const { lines, body } = splitNote(content);
    const g = (k) => unq(fmGet(lines, k));
    n.label = g("title") || n.label;
    n.type = g("type") || n.type;
    n.tags = listOf(fmGet(lines, "tags")).map((t) => t.toLowerCase());
    n.noteKind = g("kind") || null;
    n.why = g("why") || null;
    n.stage = g("stage") || null;
    n.state = g("state") || null;
    n.status = g("status") || null;
    n.source = g("source") || null;
    n.style = listOf(fmGet(lines, "style"));
    n.stack = listOf(fmGet(lines, "stack"));
    // media stays at its old build path until the site rebuilds
    const dir = n.path.slice(0, n.path.lastIndexOf("/"));
    n.path = newPath;
    const topic = g("topic");
    if (topic && topic !== n.topic) { n.topic = topic; n.color = colorOf(topic); }
    n.code = TYPE_CODE[n.type] || n.type.slice(0, 4).toUpperCase();
    n.body = body
      .replace(/(\]\()\.\/([^)\s]+)/g, (_, a, f) => `${a}data/media/${dir}/${f}`)
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, s, label) => {
        const t = byId.get("n:" + s.trim());
        return `[${label || (t ? t.label : s)}](#/n/${encodeURIComponent(s.trim())})`;
      });
    n.search = [n.label, n.tags.join(" "), n.topic, n.type, n.noteKind || "", n.why || "", n.style.join(" "), n.body].join(" ").toLowerCase();
    scrambles.set(n.id, performance.now());
    renderGroups();
  }

  function confirmDelete(n) {
    openModal(`<div class="m-h">DELETE “${esc(n.label)}”?</div>
      <p class="m-p">Removes <b>${esc(n.path)}</b> and any images saved with it from GitHub. You can still bring it back from the repo's history.</p>
      <div class="m-err" hidden></div>
      <div class="m-row"><button type="button" data-cancel>CANCEL</button><button type="submit" class="danger">DELETE</button></div>`, async (m) => {
      const btn = m.querySelector("[type=submit]"), err = m.querySelector(".m-err");
      btn.textContent = "DELETING…"; btn.disabled = true;
      try {
        const file = await api("get", { path: n.path });
        const r = await api("delete", { path: n.path, sha: file.sha, title: n.label });
        closeModal();
        n.deleted = true;
        sfx.play("delete");
        editor.node = null;
        renderGroups();
        go(null);
        toast(`Deleted · <a href="${esc(graph.repo)}/commit/${esc(r.commit)}" target="_blank" rel="noopener">${esc(r.commit.slice(0, 7))}</a>. The graph rebuilds in about a minute.`, 8000);
      } catch (e) {
        err.hidden = false; err.textContent = e.message;
        btn.textContent = "DELETE"; btn.disabled = false;
      }
    });
  }

  $("b-edit").addEventListener("click", () => toggleEdit());
  addEventListener("keydown", (e) => {
    // works after clicking any button too (it used to need focus on the page body)
    if ((e.key === "e" || e.key === "E") && !e.metaKey && !e.ctrlKey && !e.altKey && !editor.modal &&
      !(e.target.closest && e.target.closest("input, textarea, select, [contenteditable]"))) toggleEdit();
  });
  syncEditButton();

  // ---------- pins (drag with Shift, or right-click → Pin) ----------
  const PIN_KEY = "sb-pins";
  const pins = (() => { try { return JSON.parse(localStorage.getItem(PIN_KEY) || "{}"); } catch { return {}; } })();
  const savePins = () => { try { localStorage.setItem(PIN_KEY, JSON.stringify(pins)); } catch {} };
  function applyPins() {
    for (const n of nodes) {
      const p = pins[n.id];
      if (p) { n.x = n.fx = p[0]; n.y = n.fy = p[1]; }
    }
  }
  function setPin(n, on) {
    if (on) { n.fx = n.x; n.fy = n.y; pins[n.id] = [Math.round(n.x), Math.round(n.y)]; }
    else { n.fx = null; n.fy = null; delete pins[n.id]; sim.alpha(0.2).restart(); }
    savePins();
  }
  function unpinAll() {
    for (const n of nodes) if (pins[n.id]) { n.fx = null; n.fy = null; }
    for (const k of Object.keys(pins)) delete pins[k];
    savePins(); sim.alpha(0.4).restart();
  }

  // ---------- sound (synthesised, no files) ----------
  const sfx = (() => {
    let ac = null, master = null, unlocked = false, lastHover = 0;
    const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
    const hz = (semi, base = 220) => base * Math.pow(2, semi / 12);
    const pitchOf = (n, base) => hz(PENTA[hash(n?.id || "x") % PENTA.length], base);
    function ensure() {
      if (!unlocked) return null;
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ac = new AC(); master = ac.createGain(); master.connect(ac.destination);
      }
      if (ac.state === "suspended") ac.resume();
      master.gain.value = look.volume * 0.6;
      return ac;
    }
    // one voice, coloured by the chosen pack
    function tone(freq, dur, { gain = 0.2, delay = 0, slide = 0, type } = {}) {
      const a = ensure(); if (!a) return;
      const t0 = a.currentTime + delay, pack = look.pack;
      const wave = type || (pack === "8bit" ? "square" : pack === "glass" ? "sine" : "triangle");
      const o = a.createOscillator(), g = a.createGain();
      o.type = wave; o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
      const len = pack === "glass" ? dur * 2.2 : dur, vol = gain * (wave === "square" ? 0.35 : 1);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + len + 0.05);
      if (pack === "glass") { // bell partial
        const o2 = a.createOscillator(), g2 = a.createGain();
        o2.type = "sine"; o2.frequency.setValueAtTime(freq * 2.76, t0);
        g2.gain.setValueAtTime(0.0001, t0); g2.gain.exponentialRampToValueAtTime(vol * 0.35, t0 + 0.004);
        g2.gain.exponentialRampToValueAtTime(0.0001, t0 + len * 0.6);
        o2.connect(g2); g2.connect(master); o2.start(t0); o2.stop(t0 + len);
      }
    }
    function noise(dur, { gain = 0.15, freq = 800, q = 1, delay = 0, sweep = 0 } = {}) {
      const a = ensure(); if (!a) return;
      const t0 = a.currentTime + delay;
      const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
      src.buffer = buf; f.type = "bandpass"; f.Q.value = q; f.frequency.setValueAtTime(freq, t0);
      if (sweep) f.frequency.exponentialRampToValueAtTime(freq * sweep, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(master); src.start(t0);
    }
    const SOUNDS = {
      hover: (n) => { const t = performance.now(); if (t - lastHover < 70) return; lastHover = t; tone(pitchOf(n, 880), 0.05, { gain: 0.035 }); },
      open: (n) => {
        const base = n?.kind === "topic" ? 110 : n?.kind === "tag" ? 440 : 220;
        tone(pitchOf(n, base), 0.18, { gain: 0.16 }); tone(pitchOf(n, base) * 1.5, 0.22, { gain: 0.08, delay: 0.05 });
        noise(0.25, { gain: 0.03, freq: 2400, sweep: 0.3 });
      },
      close: () => { tone(330, 0.12, { gain: 0.07, slide: 0.6 }); },
      menu: () => { tone(660, 0.06, { gain: 0.08 }); tone(990, 0.07, { gain: 0.05, delay: 0.03 }); },
      tick: () => tone(1320, 0.03, { gain: 0.03 }),
      toggle: (on) => tone(on ? 880 : 520, 0.06, { gain: 0.08 }),
      grab: (n) => tone(pitchOf(n, 330), 0.08, { gain: 0.07, slide: 1.4 }),
      drop: (n) => { tone(pitchOf(n, 165), 0.12, { gain: 0.1, slide: 0.7 }); noise(0.08, { gain: 0.04, freq: 300 }); },
      save: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { gain: 0.09, delay: i * 0.07 })),
      delete: () => { tone(440, 0.4, { gain: 0.12, slide: 0.25 }); noise(0.35, { gain: 0.06, freq: 1200, sweep: 0.2 }); },
      error: () => { tone(160, 0.14, { gain: 0.12, type: "square" }); tone(150, 0.14, { gain: 0.12, type: "square", delay: 0.16 }); },
      dice: () => [0, 4, 7, 12, 16].forEach((s, i) => tone(hz(s, 440), 0.08, { gain: 0.06, delay: i * 0.045 })),
      shake: () => { noise(0.9, { gain: 0.22, freq: 120, q: 0.7, sweep: 3 }); tone(80, 0.8, { gain: 0.2, slide: 0.5, type: "sine" }); },
      snap: () => { noise(0.06, { gain: 0.2, freq: 3000 }); tone(1800, 0.05, { gain: 0.05, delay: 0.05 }); },
      whoosh: () => noise(0.35, { gain: 0.06, freq: 500, sweep: 4 }),
    };
    return {
      play(name, arg) { if (!look.sound || !unlocked) return; try { SOUNDS[name]?.(arg); } catch {} },
      unlock() { unlocked = true; },
    };
  })();
  ["pointerdown", "keydown"].forEach((ev) => addEventListener(ev, () => sfx.unlock(), { once: true, capture: true }));

  // ---------- right-click menu (long-press on touch) ----------
  const menu = document.createElement("div");
  menu.className = "ctx mono";
  menu.hidden = true;
  document.body.appendChild(menu);
  let menuItems = [];
  function openMenu(x, y, n) {
    const items = menuFor(n, x, y);
    menuItems = items.filter((i) => i && !i.sep);
    menu.innerHTML =
      `<div class="ctx-h">${n ? `<span class="sq ${n.kind === "tag" ? "ring" : ""}" style="background:${n.color}"></span>${esc(trunc(n.kind === "tag" ? "#" + n.label : n.label, 30))}` : "GRAPH"}</div>` +
      items.filter(Boolean).map((i) => i.sep ? `<div class="ctx-sep"></div>` :
        `<button type="button" data-i="${menuItems.indexOf(i)}" class="${i.danger ? "danger" : ""}" ${i.disabled ? "disabled" : ""}><span>${esc(i.label)}</span>${i.key ? `<kbd>${esc(i.key)}</kbd>` : ""}</button>`).join("");
    menu.hidden = false;
    const r = menu.getBoundingClientRect();
    menu.style.left = clamp(x, 8, innerWidth - r.width - 8) + "px";
    menu.style.top = clamp(y, 8, innerHeight - r.height - 8) + "px";
    menu.classList.remove("show"); void menu.offsetWidth; menu.classList.add("show");
    menu.openedAt = performance.now();
    showTip(null);
    sfx.play("menu");
  }
  function closeMenu() { menu.hidden = true; }
  menu.addEventListener("click", (e) => {
    const b = e.target.closest("[data-i]");
    if (!b || performance.now() - menu.openedAt < 380) return; // the finger lifting after a long-press
    const item = menuItems[+b.dataset.i];
    closeMenu();
    sfx.play("tick");
    item?.run();
  });
  menu.addEventListener("mouseover", (e) => { if (e.target.closest("[data-i]:not(:disabled)")) sfx.play("tick"); });
  menu.addEventListener("contextmenu", (e) => e.preventDefault());
  addEventListener("pointerdown", (e) => { if (!menu.hidden && !menu.contains(e.target)) closeMenu(); }, true);
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) { closeMenu(); e.stopImmediatePropagation(); } }, true);
  addEventListener("blur", closeMenu);

  const copy = (text, what) => navigator.clipboard?.writeText(text).then(() => toast(`${what} copied.`, 2500), () => toast(text, 6000));
  const linkTo = (n) => `${location.origin}${location.pathname}#/${keyOf(n)}`;
  const needEdit = (fn) => () => (editor.pass ? fn() : toggleEdit(fn));

  function menuFor(n, x, y) {
    if (!n) {
      const [wx, wy] = worldAt(x, y);
      return [
        { label: "New note here", key: "", run: needEdit(() => newNote(wx, wy)) },
        { sep: true },
        { label: "Random note", key: "N", run: randomNote },
        { label: "Reset view", key: "R", run: () => { go(null); fit(); } },
        { label: "Shake the graph", key: "X", run: shake },
        { label: tour.on ? "Stop tour" : "Start tour", key: "P", run: toggleTour },
        { sep: true },
        { label: "Customise look…", key: "C", run: () => toggleStudio(true) },
        { label: "Surprise me (random look)", run: surprise },
        { label: "Save as image", key: "I", run: snapshot },
        Object.keys(pins).length ? { label: `Unpin all (${Object.keys(pins).length})`, run: unpinAll } : null,
      ];
    }
    const pinned = pins[n.id];
    const pin = { label: pinned ? "Unpin" : "Pin here", run: () => { setPin(n, !pinned); sfx.play("drop", n); } };
    if (n.kind === "note") return [
      { label: "Open", run: () => go(n) },
      { label: "Edit note", key: "E", run: needEdit(() => { go(n); setTimeout(() => openEditor(n), 60); }) },
      { label: "Rename", run: needEdit(() => renameNote(n)) },
      { label: "Show only its links", run: () => focusOn(n) },
      pin,
      { sep: true },
      { label: "Copy link", run: () => copy(linkTo(n), "Link") },
      n.source ? { label: "Open source ↗", run: () => open(n.source, "_blank", "noopener") } : null,
      { label: "Open on GitHub ↗", run: () => open(`${graph.repo}/blob/main/${n.path}`, "_blank", "noopener") },
      { sep: true },
      { label: "Delete note", danger: true, run: needEdit(() => { go(n); setTimeout(() => confirmDelete(n), 60); }) },
    ];
    if (n.kind === "tag") return [
      { label: `Open #${n.label}`, run: () => go(n) },
      { label: "Rename tag everywhere", run: needEdit(() => retag(n, true)) },
      { label: "Show only its notes", run: () => focusOn(n) },
      pin,
      { label: "Copy link", run: () => copy(linkTo(n), "Link") },
      { sep: true },
      { label: "Remove tag from all notes", danger: true, run: needEdit(() => retag(n, false)) },
    ];
    return [
      { label: `Open ${n.label}`, run: () => go(n) },
      { label: "Change colour…", run: () => pickColour(n.label) },
      look.colors[n.label] ? { label: "Reset colour", run: () => { delete look.colors[n.label]; lookChanged("colors"); } } : null,
      { label: "Hide this topic", run: () => { hiddenTopics.add(n.label); afterFilter(); } },
      { label: "Show only this topic", run: () => { hiddenTopics.clear(); for (const t of topicNames()) if (t !== n.label) hiddenTopics.add(t); afterFilter(); } },
      { label: "New note in this topic", run: needEdit(() => newNote(n.x + 40, n.y + 40, n.label)) },
      pin,
      { label: "Copy link", run: () => copy(linkTo(n), "Link") },
    ];
  }

  // right-click / long-press wiring (canvas)
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    openMenu(e.clientX, e.clientY, nodeAt(e.clientX, e.clientY));
  });
  let press = null, swallowClick = false;
  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch") return;
    clearTimeout(press?.t);
    press = { x: e.clientX, y: e.clientY, t: setTimeout(() => { swallowClick = true; navigator.vibrate?.(12); openMenu(press.x, press.y, nodeAt(press.x, press.y)); }, 520) };
  });
  canvas.addEventListener("pointermove", (e) => { if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 9) { clearTimeout(press.t); press = null; } });
  ["pointerup", "pointercancel"].forEach((ev) => canvas.addEventListener(ev, () => { clearTimeout(press?.t); press = null; }));
  canvas.addEventListener("click", (e) => { if (swallowClick) { swallowClick = false; e.stopImmediatePropagation(); } }, true);

  // "show only its links": hide topics that none of its neighbours are in
  function focusOn(n) {
    const near = new Set([n.id, ...adj.get(n.id)]);
    const keep = new Set([...near].map((id) => byId.get(id)?.topic).filter(Boolean));
    hiddenTopics.clear();
    for (const t of topicNames()) if (!keep.has(t)) hiddenTopics.add(t);
    afterFilter();
    go(n);
  }

  // ---------- quick edits from the menu ----------
  function renameNote(n) {
    openModal(`<div class="m-h">RENAME NOTE</div>
      <input name="title" value="${esc(n.label)}" autocomplete="off" spellcheck="false" />
      <p class="m-p">2 to 4 words: the name plus what it is.</p>
      <div class="m-err" hidden></div>
      <div class="m-row"><button type="button" data-cancel>CANCEL</button><button type="submit">RENAME</button></div>`, async (m) => {
      const title = m.querySelector("[name=title]").value.trim(), err = m.querySelector(".m-err"), btn = m.querySelector("[type=submit]");
      if (!title || title === n.label) { closeModal(); return; }
      btn.disabled = true; btn.textContent = "SAVING…";
      try {
        const file = await api("get", { path: n.path });
        const { lines, body } = splitNote(file.content);
        fmSet(lines, "title", yamlScalar(title));
        const content = `---\n${lines.join("\n")}\n---\n${body}`;
        const r = await api("save", { path: n.path, sha: file.sha, content, title });
        applyLocal(n, content, r.path);
        closeModal(); sfx.play("save");
        if (selectedId === n.id) openPanel(n);
        toast(`Renamed to “${esc(title)}” · <a href="${esc(graph.repo)}/commit/${esc(r.commit)}" target="_blank" rel="noopener">${esc(r.commit.slice(0, 7))}</a>`);
      } catch (e) { sfx.play("error"); err.hidden = false; err.textContent = e.message; btn.disabled = false; btn.textContent = "RENAME"; }
    });
    setTimeout(() => editor.modal?.querySelector("[name=title]")?.select(), 40);
  }

  function retag(tagNode, rename) {
    const notes = [...adj.get(tagNode.id)].map((id) => byId.get(id)).filter((m) => m.kind === "note" && !m.deleted);
    const from = tagNode.label;
    openModal(rename ? `<div class="m-h">RENAME #${esc(from)}</div>
        <input name="to" value="${esc(from)}" autocomplete="off" spellcheck="false" />
        <p class="m-p">Changes the tag on ${notes.length} note${notes.length === 1 ? "" : "s"} in one commit. Use an existing tag name to merge them.</p>
        <div class="m-err" hidden></div>
        <div class="m-row"><button type="button" data-cancel>CANCEL</button><button type="submit">RENAME</button></div>`
      : `<div class="m-h">REMOVE #${esc(from)}?</div>
        <p class="m-p">Takes the tag off ${notes.length} note${notes.length === 1 ? "" : "s"}. The notes stay.</p>
        <div class="m-err" hidden></div>
        <div class="m-row"><button type="button" data-cancel>CANCEL</button><button type="submit" class="danger">REMOVE</button></div>`, async (m) => {
      const to = rename ? kebab(m.querySelector("[name=to]").value) : "";
      const err = m.querySelector(".m-err"), btn = m.querySelector("[type=submit]");
      if (rename && (!to || to === from)) { closeModal(); return; }
      btn.disabled = true; btn.textContent = "SAVING…";
      try {
        const r = await api("retag", { paths: notes.map((x) => x.path), from, to });
        closeModal();
        for (const x of notes) x.tags = [...new Set(x.tags.flatMap((t) => (t === from ? (to ? [to] : []) : [t])))];
        if (to) { tagNode.label = to; scrambles.set(tagNode.id, performance.now()); }
        else { tagNode.deleted = true; if (selectedId === tagNode.id) go(null); }
        sfx.play(to ? "save" : "delete");
        toast(`${to ? `#${esc(from)} → #${esc(to)}` : `Removed #${esc(from)}`} on ${r.changed} note${r.changed === 1 ? "" : "s"} · <a href="${esc(graph.repo)}/commit/${esc(r.commit)}" target="_blank" rel="noopener">${esc(r.commit.slice(0, 7))}</a>`);
      } catch (e) { sfx.play("error"); err.hidden = false; err.textContent = e.message; btn.disabled = false; btn.textContent = rename ? "RENAME" : "REMOVE"; }
    });
  }

  function newNote(wx, wy, topicPreset) {
    const topics = [...new Set([...topicNames(), ...TOPIC_ORDER])].filter((t) => t !== "inbox").sort();
    const near = nodes.filter((n) => n.kind === "topic").sort((a, b) => Math.hypot(a.x - wx, a.y - wy) - Math.hypot(b.x - wx, b.y - wy))[0];
    const topic = topicPreset || near?.label || "misc";
    openModal(`<div class="m-h">NEW NOTE</div>
      <input name="title" placeholder="title, 2 to 4 words" autocomplete="off" spellcheck="false" required />
      <div class="f-row">
        <select name="topic">${topics.map((t) => `<option ${t === topic ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
        <select name="kind">${["idea", "thought", "todo", "style-ref", "website-ref", "game-ref", "library", "asset-source", "tool", "technique", "advice", "project"].map((k) => `<option>${k}</option>`).join("")}</select>
      </div>
      <input name="tags" placeholder="tags, comma separated" autocomplete="off" spellcheck="false" />
      <input name="source" placeholder="link (optional)" autocomplete="off" spellcheck="false" />
      <textarea name="text" rows="5" placeholder="what is it, why keep it"></textarea>
      <div class="m-err" hidden></div>
      <div class="m-row"><button type="button" data-cancel>CANCEL</button><button type="submit">ADD TO BRAIN</button></div>`, async (m) => {
      const v = (k) => m.querySelector(`[name=${k}]`).value.trim();
      const title = v("title"), err = m.querySelector(".m-err"), btn = m.querySelector("[type=submit]");
      if (!title) return;
      const topic = v("topic"), kind = v("kind"), text = v("text"), source = v("source");
      const tags = [...new Set(v("tags").split(",").map(kebab).filter(Boolean))];
      const today = new Date().toISOString().slice(0, 10);
      const slug = `${today}-${kebab(title).split("-").slice(0, 6).join("-") || "note"}`;
      const type = kind === "idea" ? "idea" : kind === "todo" ? "todo" : kind === "thought" ? "note" : source ? "link" : "note";
      const fm = [
        `title: ${yamlScalar(title)}`, `type: ${type}`, `topic: ${topic}`, `tags: [${tags.join(", ")}]`, `kind: ${kind}`,
        `why: ${yamlScalar(text.split("\n")[0].slice(0, 120) || "added from the graph site")}`,
        ...(kind === "idea" || kind === "todo" ? ["stage: new"] : []),
        ...(source ? [`source: ${source}`] : []), `added: ${today}`, "status: unread",
      ];
      const content = `---\n${fm.join("\n")}\n---\n\n## Summary\n${text || title}\n\n## Raw\n${text || title}\n`;
      btn.disabled = true; btn.textContent = "ADDING…";
      try {
        const r = await api("create", { path: `topics/${topic}/${slug}.md`, content, title });
        closeModal();
        const n = addLocalNote({ slug, path: r.path, title, type, topic, tags, kind, why: fm[5].slice(5), source, added: today, body: content.split("---\n").slice(2).join("---\n") }, wx, wy);
        sfx.play("save");
        go(n);
        toast(`Added “${esc(title)}” · <a href="${esc(graph.repo)}/commit/${esc(r.commit)}" target="_blank" rel="noopener">${esc(r.commit.slice(0, 7))}</a>. Links settle after the rebuild.`);
      } catch (e) { sfx.play("error"); err.hidden = false; err.textContent = e.message; btn.disabled = false; btn.textContent = "ADD TO BRAIN"; }
    });
  }
  // put a fresh note on the graph right away; the rebuild makes it permanent
  function addLocalNote(d, x, y) {
    const n = {
      id: "n:" + d.slug, kind: "note", label: d.title, slug: d.slug, path: d.path, type: d.type, topic: d.topic, tags: d.tags,
      source: d.source || null, added: d.added, status: "unread", noteKind: d.kind, why: d.why, stage: null, style: [], stack: [],
      body: d.body, related: [], near: [], x, y, a: 0, h: 1, p: 1, delay: 0, phase: Math.random() * 6,
    };
    n.color = colorOf(n.topic); n.code = TYPE_CODE[n.type] || "NOTE";
    nodes.push(n); byId.set(n.id, n); adj.set(n.id, new Set());
    const link = (target, kind) => {
      if (!byId.has(target)) return;
      const l = { source: n, target: byId.get(target), kind, seed: Math.random(), i: links.length };
      links.push(l); adj.get(n.id).add(target); adj.get(target).add(n.id);
    };
    link("t:" + n.topic, "topic");
    for (const t of n.tags) link("g:" + t, "tag");
    n.deg = adj.get(n.id).size; n.r = radius(n);
    n.search = [n.label, n.tags.join(" "), n.topic, n.type, n.noteKind, n.why, n.body].join(" ").toLowerCase();
    sim.nodes(nodes); sim.force("link").links(links); sim.alpha(0.3).restart();
    return n;
  }

  // ---------- fun ----------
  function shake() {
    for (const n of nodes) if (n.fx == null) { n.vx = (Math.random() - 0.5) * 60; n.vy = (Math.random() - 0.5) * 60; }
    sim.alpha(1).restart();
    sfx.play("shake");
    if (showSignals) for (let i = 0; i < 80; i++) spawnSignal(links[(Math.random() * links.length) | 0], null, true);
    document.body.classList.remove("quake"); void document.body.offsetWidth; document.body.classList.add("quake");
  }
  const tour = { on: false, t: null };
  function toggleTour(force) {
    tour.on = typeof force === "boolean" ? force : !tour.on;
    clearInterval(tour.t);
    $("b-tour")?.classList.toggle("on", tour.on);
    if (tour.on) {
      toast("Tour on: a new note every 6 seconds. Click anywhere or press P to stop.", 4000);
      randomNote(); tour.t = setInterval(randomNote, 6000);
    }
  }
  ["pointerdown", "wheel"].forEach((ev) => canvas.addEventListener(ev, () => { if (tour.on) toggleTour(false); }, { passive: true }));
  function snapshot() {
    sfx.play("snap");
    document.body.classList.remove("flash"); void document.body.offsetWidth; document.body.classList.add("flash");
    canvas.toBlob((b) => {
      if (!b) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = `second-brain-${new Date().toISOString().slice(0, 10)}.png`;
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
  }
  const pickOne = (a) => a[(Math.random() * a.length) | 0];
  function surprise() {
    Object.assign(look, {
      preset: pickOne(Object.keys(PRESETS)), colors: {},
      shape: pickOne(["square", "circle", "diamond", "hex", "triangle"]),
      lines: pickOne(["arc", "straight", "elbow", "wave", "arc", "none"]),
      lineColor: pickOne(["mono", "topic", "rainbow"]), dash: pickOne(["wiki", "all", "none"]),
      curve: +(0.4 + Math.random() * 1.8).toFixed(1), lineWidth: +(0.6 + Math.random() * 1.6).toFixed(1),
      glow: +(Math.random() * 2).toFixed(1), spread: +(0.7 + Math.random() * 0.9).toFixed(2),
      bg: pickOne(BGS.map((b) => b[0])),
    });
    sfx.play("dice");
    lookChanged("all");
  }

  // ---------- customise drawer ----------
  const BGS = [["#050505", "VOID"], ["#0a0f1f", "NAVY"], ["#120a1c", "PLUM"], ["#06140f", "MOSS"], ["#16100a", "EMBER"]];
  const LAYOUT_BTNS = [["SHAKE", () => shake()], ["UNPIN ALL", () => unpinAll()], ["RE-FIT", () => fit()]];
  const SECTIONS = [
    ["THEME", [
      { k: "preset", t: "chips", label: "PALETTE", opts: Object.entries(PRESETS).map(([v, p]) => [v, p.name]) },
      { k: "colors", t: "topics", label: "TOPIC COLOURS" },
      { k: "bg", t: "swatches", label: "BACKGROUND", opts: BGS },
    ]],
    ["NODES", [
      { k: "shape", t: "chips", label: "SHAPE", opts: [["square", "■"], ["circle", "●"], ["diamond", "◆"], ["hex", "⬢"], ["triangle", "▲"]] },
      { k: "nodeSize", t: "range", label: "SIZE", min: 0.5, max: 2.5, step: 0.05 },
      { k: "glow", t: "range", label: "GLOW", min: 0, max: 2.5, step: 0.05 },
      { k: "labelSize", t: "range", label: "LABEL SIZE", min: 0.7, max: 1.6, step: 0.05 },
      { k: "wobble", t: "toggle", label: "BREATHING DRIFT" },
    ]],
    ["LINES", [
      { k: "lines", t: "chips", label: "STYLE", opts: [["arc", "ARC"], ["straight", "STRAIGHT"], ["elbow", "CIRCUIT"], ["wave", "WAVE"], ["none", "NONE"]] },
      { k: "curve", t: "range", label: "CURVE", min: 0, max: 3, step: 0.05 },
      { k: "lineWidth", t: "range", label: "THICKNESS", min: 0.3, max: 4, step: 0.05 },
      { k: "lineAlpha", t: "range", label: "BRIGHTNESS", min: 0.2, max: 4, step: 0.05 },
      { k: "lineColor", t: "chips", label: "COLOUR", opts: [["mono", "WHITE"], ["topic", "TOPIC"], ["rainbow", "RAINBOW"]] },
      { k: "dash", t: "chips", label: "DASHED", opts: [["wiki", "LINKS ONLY"], ["all", "ALL"], ["none", "NONE"]] },
    ]],
    ["LAYOUT", [
      { k: "spread", t: "range", label: "SPREAD", min: 0.4, max: 2.5, step: 0.05 },
      { k: "gravity", t: "range", label: "PULL TO CENTRE", min: 0, max: 4, step: 0.05 },
      { k: "signalRate", t: "range", label: "SIGNALS", min: 0, max: 5, step: 0.1 },
      { t: "buttons", items: LAYOUT_BTNS },
    ]],
    ["BACKDROP", [
      { k: "dust", t: "toggle", label: "DUST" }, { k: "grid", t: "toggle", label: "DOT GRID" },
      { k: "grain", t: "toggle", label: "FILM GRAIN" }, { k: "vignette", t: "toggle", label: "VIGNETTE" },
    ]],
    ["SOUND", [
      { k: "sound", t: "toggle", label: "SOUND EFFECTS" },
      { k: "volume", t: "range", label: "VOLUME", min: 0, max: 1, step: 0.05 },
      { k: "pack", t: "chips", label: "PACK", opts: [["soft", "SOFT"], ["8bit", "8-BIT"], ["glass", "GLASS"]] },
    ]],
  ];
  const studio = document.createElement("aside");
  studio.className = "studio mono"; studio.id = "studio"; studio.setAttribute("aria-hidden", "true");
  document.body.appendChild(studio);
  const studioTab = $("b-studio");
  ui.studioOpen ??= {};

  function renderStudio() {
    const fmt = (v) => (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, "") || "0";
    const ctl = (c) => {
      const v = look[c.k];
      if (c.t === "range") return `<label class="st-row"><span>${c.label}<b>${fmt(v)}${c.k === "volume" ? "" : "×"}</b></span><input type="range" data-k="${c.k}" min="${c.min}" max="${c.max}" step="${c.step}" value="${v}" /></label>`;
      if (c.t === "toggle") return `<button type="button" class="st-toggle ${v ? "on" : ""}" data-k="${c.k}" data-t="toggle">${c.label}<i></i></button>`;
      if (c.t === "chips") return `<div class="st-row"><span>${c.label}</span><div class="st-chips">${c.opts.map(([o, l]) => `<button type="button" data-k="${c.k}" data-v="${o}" class="${v === o ? "on" : ""}">${l}</button>`).join("")}</div></div>`;
      if (c.t === "swatches") return `<div class="st-row"><span>${c.label}</span><div class="st-chips">${c.opts.map(([o, l]) => `<button type="button" data-k="${c.k}" data-v="${o}" class="sw ${v === o ? "on" : ""}" title="${l}" style="background:${o}"></button>`).join("")}</div></div>`;
      if (c.t === "topics") return `<div class="st-row"><span>${c.label}</span><div class="st-topics">${topicNames().map((t) => `<label class="st-col" title="${esc(t)}"><input type="color" data-topic="${esc(t)}" value="${colorOf(t)}" /><span>${esc(t)}</span></label>`).join("")}</div></div>`;
      if (c.t === "buttons") return `<div class="st-btns">${c.items.map(([l], i) => `<button type="button" data-btn="${i}">${l}</button>`).join("")}</div>`;
      return "";
    };
    studio.innerHTML = `
      <div class="st-head"><span>CUSTOMISE</span><button type="button" class="st-x" data-close title="Close (C)">✕</button></div>
      <div class="st-body">
        ${SECTIONS.map(([name, ctls]) => `<section class="st-sec ${ui.studioOpen[name] === false ? "collapsed" : ""}" data-sec="${name}">
          <button type="button" class="st-sec-h"><span class="caret"></span>${name}</button>
          <div class="st-sec-b">${ctls.map(ctl).join("")}</div></section>`).join("")}
        <div class="st-foot">
          <button type="button" data-act="surprise">SURPRISE ME</button>
          <button type="button" data-act="reset">RESET LOOK</button>
          <button type="button" data-act="default" title="Save this look as the default for the site (needs edit mode)">SAVE AS SITE DEFAULT</button>
        </div>
        <p class="st-note">Changes save in this browser. SAVE AS SITE DEFAULT commits it so every device starts with this look.</p>
      </div>`;
  }
  function toggleStudio(force) {
    const open = typeof force === "boolean" ? force : !studio.classList.contains("open");
    if (open) renderStudio();
    studio.classList.toggle("open", open);
    document.body.classList.toggle("studio-open", open);
    studio.setAttribute("aria-hidden", String(!open));
    sfx.play(open ? "whoosh" : "close");
  }
  studioTab.addEventListener("click", () => toggleStudio());
  studio.addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset.topic) { look.colors[el.dataset.topic] = el.value; lookChanged("colors", false); return; }
    if (el.type === "range") {
      look[el.dataset.k] = +el.value;
      el.previousElementSibling.querySelector("b").textContent = (Math.round(+el.value * 100) / 100) + (el.dataset.k === "volume" ? "" : "×");
      lookChanged(el.dataset.k, false);
    }
  });
  studio.addEventListener("change", (e) => { if (e.target.type === "range" || e.target.dataset.topic) sfx.play("tick"); });
  studio.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.close != null) return toggleStudio(false);
    if (b.classList.contains("st-sec-h")) {
      const sec = b.parentElement, name = sec.dataset.sec;
      sec.classList.toggle("collapsed");
      ui.studioOpen[name] = !sec.classList.contains("collapsed"); saveUi(); sfx.play("tick");
      return;
    }
    if (b.dataset.btn != null) { LAYOUT_BTNS[+b.dataset.btn][1](); return; }
    if (b.dataset.act === "surprise") return surprise();
    if (b.dataset.act === "reset") { look = { ...LOOK_DEFAULT, ...siteLook, colors: { ...(siteLook.colors || {}) } }; sfx.play("close"); return lookChanged("all"); }
    if (b.dataset.act === "default") return needEdit(saveSiteLook)();
    const k = b.dataset.k;
    if (!k) return;
    if (b.dataset.t === "toggle") look[k] = !look[k];
    else if (b.dataset.v != null) { look[k] = b.dataset.v; if (k === "preset") look.colors = {}; }
    sfx.play("toggle", !!look[k]);
    lookChanged(k);
  });

  // apply a changed setting everywhere it matters
  function lookChanged(k, rerender = true) {
    saveLook();
    if (k === "all" || k === "preset" || k === "colors") {
      for (const n of nodes) if (n.kind !== "tag") n.color = colorOf(n.topic);
      renderLegend();
      if (selectedId && panel.classList.contains("open") && !editor.node) panel.style.setProperty("--panel-accent", byId.get(selectedId)?.color || "");
    }
    if (k === "all" || k === "nodeSize") { for (const n of nodes) n.r = radius(n); applyForces(true); }
    if (k === "all" || k === "spread" || k === "gravity") applyForces(true);
    if (k === "all" || k === "bg") applyBg();
    applyBodyFx();
    if (rerender && studio.classList.contains("open")) {
      const y = studio.querySelector(".st-body")?.scrollTop || 0;
      renderStudio();
      studio.querySelector(".st-body").scrollTop = y;
    }
  }
  function applyBg() {
    document.documentElement.style.setProperty("--bg", look.bg);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", look.bg);
  }
  function applyBodyFx() {
    document.body.classList.toggle("no-grain", !look.grain);
    document.body.classList.toggle("no-vignette", !look.vignette);
  }
  function pickColour(topic) {
    const i = document.createElement("input");
    i.type = "color"; i.value = colorOf(topic);
    i.style.cssText = "position:fixed;left:-99px;opacity:0";
    document.body.appendChild(i);
    i.addEventListener("input", () => { look.colors[topic] = i.value; lookChanged("colors", false); });
    i.addEventListener("change", () => { i.remove(); sfx.play("save"); lookChanged("colors"); });
    i.click();
  }
  async function saveSiteLook() {
    try {
      const { sound, volume, ...rest } = look; // sound stays a personal choice
      const r = await api("look", { look: rest });
      siteLook = rest;
      saveLook();
      sfx.play("save");
      toast(`Saved as the site look · <a href="${esc(graph.repo)}/commit/${esc(r.commit)}" target="_blank" rel="noopener">${esc(r.commit.slice(0, 7))}</a>. Live after the rebuild.`);
    } catch (e) { sfx.play("error"); toast(`Couldn't save: ${esc(e.message)}`); }
  }
  // site default look (site/look.json), then this browser's tweaks on top
  async function loadSiteLook() {
    try {
      const r = await fetch("look.json", { cache: "no-cache" });
      if (!r.ok) return;
      siteLook = await r.json();
      let mine = {};
      try { mine = JSON.parse(localStorage.getItem(LOOK_KEY) || "{}"); } catch {}
      look = { ...LOOK_DEFAULT, ...siteLook, ...mine, colors: { ...(siteLook.colors || {}), ...(mine.colors || {}) } };
    } catch {}
  }
  applyBg(); applyBodyFx();

  addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || editor.modal) return;
    if (e.target.closest && e.target.closest("input, textarea, select")) return;
    const k = e.key.toLowerCase();
    if (k === "c") toggleStudio();
    else if (k === "x") shake();
    else if (k === "p") toggleTour();
    else if (k === "i") snapshot();
    else if (k === "m") { look.sound = !look.sound; saveLook(); syncSoundBtn(); if (look.sound) { sfx.unlock(); sfx.play("toggle", true); } toast(look.sound ? "Sound on." : "Sound off.", 1800); }
  });
  function syncSoundBtn() { const b = $("b-sound"); if (b) { b.classList.toggle("on", look.sound); } }

  // ---------- search ----------
  let activeIdx = 0, hitsList = [], hitsTotal = 0;
  function onSearch() {
    const s = q.value.trim().toLowerCase();
    if (!s) { searchSet = null; results.hidden = true; return; }
    const terms = s.split(/\s+/);
    const all = nodes
      .filter((n) => !n.deleted && terms.every((t) => n.search.includes(t)))
      .map((n) => ({ n, score: (n.label.toLowerCase().startsWith(s) ? 4 : 0) + (n.label.toLowerCase().includes(s) ? 2 : 0) + (n.kind === "note" ? 1 : 0) + (visible(n) ? 0.5 : 0) }))
      .sort((a, b) => b.score - a.score);
    hitsTotal = all.length;
    hitsList = all.slice(0, 12).map((h) => h.n);
    searchSet = new Set(hitsList.map((n) => n.id));
    activeIdx = 0;
    renderResults();
  }
  function renderResults() {
    results.hidden = false;
    if (!hitsList.length) { results.innerHTML = `<li class="empty">NO MATCHES</li>`; return; }
    results.innerHTML = `<li class="count">${hitsTotal} MATCH${hitsTotal === 1 ? "" : "ES"}${hitsTotal > hitsList.length ? ` · TOP ${hitsList.length}` : ""} · ↑↓ ENTER</li>` + hitsList.map((n, i) =>
      `<li data-i="${i}" class="${i === activeIdx ? "active" : ""}"><span class="sq ${n.kind === "tag" ? "ring" : ""}" style="background:${n.color}"></span>${n.kind === "tag" ? "#" : ""}${esc(trunc(n.label, 38))}<span class="k">${n.kind === "note" ? esc(n.topic.toUpperCase()) : n.kind.toUpperCase()}</span></li>`
    ).join("");
  }
  function pick(i) {
    const n = hitsList[i];
    if (!n) return;
    q.value = ""; searchSet = null; results.hidden = true; q.blur();
    go(n);
  }
  q.addEventListener("input", onSearch);
  q.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); activeIdx = Math.min(hitsList.length - 1, activeIdx + 1); renderResults(); results.querySelector(".active")?.scrollIntoView({ block: "nearest" }); }
    else if (e.key === "ArrowUp") { e.preventDefault(); activeIdx = Math.max(0, activeIdx - 1); renderResults(); results.querySelector(".active")?.scrollIntoView({ block: "nearest" }); }
    else if (e.key === "Enter") pick(activeIdx);
  });
  results.addEventListener("mousedown", (e) => {
    const li = e.target.closest("[data-i]");
    if (li) { e.preventDefault(); pick(+li.dataset.i); }
  });
  q.addEventListener("blur", () => setTimeout(() => { if (!q.value) results.hidden = true; }, 120));
  q.addEventListener("focus", () => { if (q.value.trim()) onSearch(); });

  // ---------- HUD ----------
  const topicNames = () => nodes.filter((n) => n.kind === "topic").map((n) => n.label);
  function renderLegend() {
    const topics = nodes.filter((n) => n.kind === "topic").sort((a, b) => b.count - a.count);
    $("legend").innerHTML = topics.map((t) =>
      `<li data-topic="${esc(t.label)}" class="${hiddenTopics.has(t.label) ? "off" : ""}" style="color:${t.color}" title="Click to hide · double-click to show only ${esc(t.label)}"><span class="sq" style="background:${t.color}"></span><span style="color:var(--fg)">${esc(t.label.toUpperCase())}</span><span class="n">${pad(t.count, 2)}</span></li>`
    ).join("");
    const shown = topics.length - hiddenTopics.size;
    $("topics-n").textContent = hiddenTopics.size ? `${shown}/${topics.length}` : String(topics.length);
    $("b-all").hidden = !hiddenTopics.size;
  }
  function renderGroups() {
    const notes = nodes.filter((n) => n.kind === "note" && !n.deleted);
    $("groups").innerHTML = GROUPS.map((g) => {
      const c = notes.filter((n) => groupOf(n) === g.id).length;
      return `<li data-group="${g.id}" class="${hiddenGroups.has(g.id) ? "off" : ""}" title="Click to hide · double-click to show only these"><span class="sq ${g.id === "saved" ? "ring" : ""}" style="background:${g.id === "made" ? "var(--accent)" : g.id === "mine" ? "#f2f2f2" : "transparent"}"></span><span>${g.label}</span><span class="n">${pad(c, 2)}</span></li>`;
    }).join("");
    $("filters-n").textContent = hiddenGroups.size ? `${GROUPS.length - hiddenGroups.size}/${GROUPS.length}` : "ALL";
  }
  function afterFilter() {
    renderLegend(); renderGroups();
    const sel = selectedId && byId.get(selectedId);
    if (sel && !visible(sel)) go(null);
    if (q.value.trim()) onSearch();
    clearTimeout(afterFilter.t);
    afterFilter.t = setTimeout(() => fit(900), 250);
  }
  // click = hide/show one; double-click = show only that one (again = show all)
  function filterClick(set, all, key, e) {
    if (e.detail >= 2) {
      const soloed = set.size === all.length - 1 && !set.has(key);
      set.clear();
      if (!soloed) for (const x of all) if (x !== key) set.add(x);
    } else if (set.has(key)) set.delete(key);
    else {
      set.add(key);
      if (set.size === all.length) set.delete(key); // never hide everything
    }
    afterFilter();
  }
  $("legend").addEventListener("click", (e) => {
    const li = e.target.closest("[data-topic]");
    if (li) filterClick(hiddenTopics, topicNames(), li.dataset.topic, e);
  });
  $("groups").addEventListener("click", (e) => {
    const li = e.target.closest("[data-group]");
    if (li) filterClick(hiddenGroups, GROUPS.map((g) => g.id), li.dataset.group, e);
  });
  $("b-all").addEventListener("click", () => { hiddenTopics.clear(); afterFilter(); });
  $("legend").addEventListener("mouseover", (e) => {
    const li = e.target.closest("[data-topic]");
    setHover(li ? byId.get("t:" + li.dataset.topic) : null);
  });
  $("legend").addEventListener("mouseleave", () => setHover(null));

  // collapsible panels, remembered per browser
  function syncDocks() {
    document.querySelectorAll("[data-dock]").forEach((d) => {
      const c = !!ui.collapsed[d.dataset.dock];
      d.classList.toggle("collapsed", c);
      d.querySelector(".dock-h").setAttribute("aria-expanded", String(!c));
    });
  }
  function toggleDock(name) { ui.collapsed[name] = !ui.collapsed[name]; saveUi(); syncDocks(); }
  document.querySelectorAll("[data-dock] > .dock-h").forEach((b) => b.addEventListener("click", () => toggleDock(b.parentElement.dataset.dock)));
  syncDocks();
  syncToggles();
  if (!ui.hud) { document.body.classList.add("hud-hidden"); $("b-hud").hidden = false; }

  function countUp(el, to) {
    const t0 = performance.now();
    const tick = (now) => {
      const p = easeOutExpo(clamp((now - t0) / 1400, 0, 1));
      el.textContent = pad(Math.round(to * p));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  function scrambleEl(el, dur = 700) {
    if (!el || reduceMotion) return;
    const text = el.textContent, t0 = performance.now();
    const tick = (now) => {
      const p = clamp((now - t0) / dur, 0, 1);
      let out = "";
      for (let i = 0; i < text.length; i++) out += i < text.length * p || text[i] === " " ? text[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      el.textContent = out;
      if (p < 1) requestAnimationFrame(tick); else el.textContent = text;
    };
    requestAnimationFrame(tick);
  }
  function setupHud() {
    renderLegend();
    renderGroups();
    const c = graph.counts;
    countUp($("s-notes"), c.notes);
    countUp($("s-tags"), c.tags);
    countUp($("s-links"), c.links);
    const d = new Date(graph.generated);
    $("build").innerHTML = `BUILD ${d.toISOString().slice(0, 16).replace("T", " ")} UTC${graph.commit ? ` · <a href="${esc(graph.repo)}/commit/${esc(graph.commit)}" target="_blank" rel="noopener">${esc(graph.commit)}</a>` : ""}`;
    document.querySelectorAll(".hud [data-scramble]").forEach((el) => scrambleEl(el, 900));
  }
  function setBar(p) { intro.querySelector(".intro-bar span").style.width = p * 100 + "%"; }

  // ---------- boot ----------
  async function boot() {
    resize();
    scrambleEl(intro.querySelector("[data-scramble]"), 800);
    try {
      await load();
    } catch (err) {
      intro.querySelector(".intro-line").textContent = "COULD NOT LOAD GRAPH.JSON";
      console.error(err);
      return;
    }
    setupInteraction();
    // start the camera on the settled layout, slightly pulled back, then glide in
    const b = bounds(nodes);
    const k0 = clamp(Math.min((W - 220) / Math.max(1, b.x1 - b.x0), (H - 200) / Math.max(1, b.y1 - b.y0)), 0.15, 1.8);
    d3.select(canvas).call(zoom.transform, d3.zoomIdentity.translate(W / 2, H / 2).scale(k0 * 0.7));
    await new Promise((r) => setTimeout(r, reduceMotion ? 0 : 450));
    intro.classList.add("done");
    document.body.classList.add("ready");
    introStart = performance.now();
    requestAnimationFrame(frame);
    fit(reduceMotion ? 0 : 2200);
    if (location.hash.length > 2) setTimeout(route, reduceMotion ? 0 : 1600);
  }
  boot();
})();
