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
  const colorOf = (topic) => PALETTE[topic] || EXTRA[hash(topic || "") % EXTRA.length];
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
  let showSignals = !reduceMotion, showLabels = true;
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

  const radius = (n) =>
    n.kind === "topic" ? 6 + Math.sqrt(n.count) * 1.6 :
    n.kind === "note" ? 3.6 + Math.min(4, Math.sqrt(n.deg) * 0.55) :
    1.7 + Math.sqrt(n.count) * 0.9;

  // ---------- data ----------
  async function load() {
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
        .distance((l) => (l.kind === "topic" ? 180 : l.kind === "wiki" ? 130 : 100))
        .strength((l) => (l.kind === "tag" ? 0.35 : l.kind === "wiki" ? 0.2 : 0.28)))
      .force("charge", d3.forceManyBody().strength((d) => (d.kind === "topic" ? -1200 : d.kind === "note" ? -460 : -200)).distanceMax(1100))
      .force("collide", d3.forceCollide((d) => d.r + (d.kind === "tag" ? 10 : 18)).strength(0.9))
      .force("x", d3.forceX(0).strength(0.022))
      .force("y", d3.forceY(0).strength(0.022))
      .stop();
    // warm up off-screen so the bloom lands on a settled layout
    for (let i = 0; i < 260; i++) sim.tick();
    sim.alpha(0.12).restart();
  }

  // ---------- geometry ----------
  // Each link is a quadratic arc; the bend side and depth come from a stable seed.
  function arc(l) {
    const s = l.source, t = l.target;
    const x1 = s.dx, y1 = s.dy, x2 = t.dx, y2 = t.dy;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1;
    const bend = (l.seed > 0.5 ? 1 : -1) * (0.18 + (l.seed % 0.5) * 0.5) * (l.kind === "wiki" ? 1.4 : 1);
    return { x1, y1, x2, y2, cx: mx - dy * bend, cy: my + dx * bend };
  }
  const qpt = (g, t) => {
    const u = 1 - t;
    return [u * u * g.x1 + 2 * u * t * g.cx + t * t * g.x2, u * u * g.y1 + 2 * u * t * g.cy + t * t * g.y2];
  };

  // ---------- focus / visibility ----------
  function focusSet() {
    const id = hoverId || selectedId;
    if (!id) return null;
    const s = new Set([id, ...adj.get(id)]);
    // a note's focus also lights its topic siblings faintly via tags: keep it tight, 1 hop
    return s;
  }
  function visible(n) {
    if (n.kind === "note") return !hiddenTopics.has(n.topic);
    if (n.kind === "topic") return !hiddenTopics.has(n.topic);
    for (const m of adj.get(n.id)) if (!hiddenTopics.has(byId.get(m).topic)) return true;
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
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, W, H);
    drawBackdrop(now);

    // per-node animated state
    for (const n of nodes) {
      const vis = visible(n);
      let target = vis ? 1 : 0.035;
      if (vis && F) target = F.has(n.id) ? 1 : 0.1;
      if (vis && searchSet) target = searchSet.has(n.id) ? 1 : Math.min(target, 0.12);
      n.a += (target - n.a) * Math.min(1, dt * 0.012);
      const hot = n.id === hoverId || n.id === selectedId || (searchSet && searchSet.has(n.id)) ? 1 : F && F.has(n.id) ? 0.45 : 0;
      n.h += (hot - n.h) * Math.min(1, dt * 0.012);
      const p = reduceMotion ? 1 : easeOutExpo(clamp((tIntro - n.delay) / 1300, 0, 1));
      n.p = p;
      const br = reduceMotion ? 0 : 1.4;
      n.dx = n.x * p + Math.sin(now * 0.0007 + n.phase) * br;
      n.dy = n.y * p + Math.cos(now * 0.0006 + n.phase * 1.3) * br;
    }

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(k, k);

    // links
    const hair = 0.75 / k;
    for (const l of links) {
      const s = l.source, t = l.target;
      const lp = reduceMotion ? 1 : easeInOut(clamp((tIntro - Math.max(s.delay, t.delay) - 250) / 1100, 0, 1));
      if (lp <= 0) continue;
      const g = arc(l);
      const focus = F && F.has(s.id) && F.has(t.id) && (s.id === (hoverId || selectedId) || t.id === (hoverId || selectedId));
      const base = l.kind === "topic" ? 0.2 : l.kind === "wiki" ? 0.42 : 0.17;
      let a = base * Math.min(s.a, t.a);
      if (focus) a = 0.9;
      if (a < 0.01) continue;
      const note = s.kind === "note" ? s : t.kind === "note" ? t : null;
      ctx.strokeStyle = focus && note ? hexA(note.color, a) : `rgba(242,242,242,${a})`;
      ctx.lineWidth = focus ? hair * 1.6 : l.kind === "wiki" ? hair * 1.3 : hair;
      ctx.setLineDash(l.kind === "wiki" && !focus ? [3 / k, 4 / k] : []);
      ctx.beginPath();
      ctx.moveTo(g.x1, g.y1);
      if (lp >= 1) ctx.quadraticCurveTo(g.cx, g.cy, g.x2, g.y2);
      else {
        // partial quadratic via de Casteljau
        const cx = g.x1 + (g.cx - g.x1) * lp, cy = g.y1 + (g.cy - g.y1) * lp;
        const [ex, ey] = qpt(g, lp);
        ctx.quadraticCurveTo(cx, cy, ex, ey);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // signals travelling along arcs
    if (showSignals) stepSignals(dt, tIntro, k);

    // nodes
    ctx.globalCompositeOperation = "lighter";
    for (const n of nodes) {
      if (n.p <= 0 || n.a < 0.02 || n.kind === "tag") continue;
      const gs = (n.r * (n.kind === "topic" ? 9 : 6)) * (1 + n.h * 0.8);
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
        ctx.fillRect(n.dx - r, n.dy - r, r * 2, r * 2);
        if (n.kind === "topic") {
          const o = r + 4 + Math.sin(now * 0.0025 + n.phase) * 1.2;
          ctx.strokeStyle = hexA(n.color, 0.7);
          ctx.lineWidth = 1 / k;
          ctx.strokeRect(n.dx - o, n.dy - o, o * 2, o * 2);
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
    for (const d of dust) {
      const px = ((d.x * W + transform.x * d.z * 0.15) % W + W) % W;
      const py = ((d.y * H + transform.y * d.z * 0.15 + now * 0.004 * d.z) % H + H) % H;
      ctx.fillStyle = `rgba(242,242,242,${0.05 + 0.08 * d.z * (0.5 + 0.5 * Math.sin(now * 0.001 + d.p))})`;
      ctx.fillRect(px, py, d.z * 1.4, d.z * 1.4);
    }
    // world-space dot grid
    const k = transform.k, step = 64 * k;
    if (step < 18) return;
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
      spawnAcc += dt * Math.min(0.02, 0.002 + links.length * 0.00012);
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
        const [x, y] = qpt(g, s.dir > 0 ? tt : 1 - tt);
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
        (n.kind === "note" && k > 2.6) ||
        (n.kind === "tag" && k > 3.4);
      if (!show) continue;
      const sx = n.dx * k + transform.x, sy = n.dy * k + transform.y;
      if (sx < -200 || sx > W + 50 || sy < -20 || sy > H + 20) continue;

      const big = n.kind === "topic";
      const fs = big ? 11 : n.kind === "note" ? 10.5 : 9.5;
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
      ctx.fillStyle = "#050505";
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
      .on("start", (e) => {
        canvas.classList.add("dragging");
        sim.alphaTarget(0.25).restart();
        e.subject.n.fx = e.subject.n.x; e.subject.n.fy = e.subject.n.y;
      })
      .on("drag", (e) => {
        const [x, y] = worldAt(e.x, e.y);
        e.subject.n.fx = x; e.subject.n.fy = y;
      })
      .on("end", (e) => {
        canvas.classList.remove("dragging");
        sim.alphaTarget(0);
        e.subject.n.fx = null; e.subject.n.fy = null;
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

    addEventListener("keydown", (e) => {
      const typing = document.activeElement === q;
      if (e.key === "Escape") {
        if (typing) { q.value = ""; onSearch(); q.blur(); } else go(null);
        return;
      }
      if (typing) return;
      if (e.key === "/") { e.preventDefault(); q.focus(); }
      else if (e.key === "r" || e.key === "R") { go(null); fit(); }
      else if (e.key === "s" || e.key === "S") toggleSignals();
      else if (e.key === "l" || e.key === "L") toggleLabels();
    });

    addEventListener("resize", () => { resize(); });
    addEventListener("hashchange", route);
  }

  function toggleSignals() { showSignals = !showSignals; $("b-signals").classList.toggle("on", showSignals); if (!showSignals) signals.length = 0; }
  function toggleLabels() { showLabels = !showLabels; $("b-labels").classList.toggle("on", showLabels); }

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
    select(byId.get(id) || null);
  }
  function select(n) {
    if (!n) {
      selectedId = null;
      closePanel();
      return;
    }
    if (n.topic && hiddenTopics.has(n.topic)) { hiddenTopics.delete(n.topic); renderLegend(); }
    selectedId = n.id;
    scrambles.set(n.id, performance.now());
    burstFrom(n.id);
    openPanel(n);
    flyTo(n);
  }

  // ---------- panel ----------
  function closePanel() {
    if (!panel.classList.contains("open")) return;
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
    panel.style.setProperty("--panel-accent", n.kind === "tag" ? "#f2f2f2" : n.color);
    let html = "";
    if (n.kind === "note") {
      const host = n.source ? (() => { try { return new URL(n.source).host.replace(/^www\./, ""); } catch { return n.source; } })() : null;
      const raw = DOMPurify.sanitize(marked.parse(n.body || ""), { ADD_ATTR: ["target"] });
      html += `<div class="p-kicker"><span class="sq" style="background:${n.color}"></span>${esc(n.topic)} · ${esc(typeLabel(n))}</div>`;
      html += `<h1 class="p-title" data-title>${esc(n.label)}</h1>`;
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
    const el = e.target.closest("[data-go]");
    if (el) go(byId.get(el.dataset.go));
  });
  panelInner.addEventListener("mouseover", (e) => {
    const el = e.target.closest("[data-go]");
    setHover(el ? byId.get(el.dataset.go) : null);
  });
  panelInner.addEventListener("mouseleave", () => setHover(null));

  // ---------- search ----------
  let activeIdx = 0, hitsList = [];
  function onSearch() {
    const s = q.value.trim().toLowerCase();
    if (!s) { searchSet = null; results.hidden = true; return; }
    const terms = s.split(/\s+/);
    hitsList = nodes
      .filter((n) => visible(n) && terms.every((t) => n.search.includes(t)))
      .map((n) => ({ n, score: (n.label.toLowerCase().startsWith(s) ? 4 : 0) + (n.label.toLowerCase().includes(s) ? 2 : 0) + (n.kind === "note" ? 1 : 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((h) => h.n);
    searchSet = new Set(hitsList.map((n) => n.id));
    activeIdx = 0;
    renderResults();
  }
  function renderResults() {
    results.hidden = false;
    if (!hitsList.length) { results.innerHTML = `<li class="empty">NO MATCHES</li>`; return; }
    results.innerHTML = hitsList.map((n, i) =>
      `<li data-i="${i}" class="${i === activeIdx ? "active" : ""}"><span class="sq ${n.kind === "tag" ? "ring" : ""}" style="background:${n.color}"></span>${n.kind === "tag" ? "#" : ""}${esc(trunc(n.label, 38))}<span class="k">${n.kind.toUpperCase()}</span></li>`
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
    if (e.key === "ArrowDown") { e.preventDefault(); activeIdx = Math.min(hitsList.length - 1, activeIdx + 1); renderResults(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); activeIdx = Math.max(0, activeIdx - 1); renderResults(); }
    else if (e.key === "Enter") pick(activeIdx);
  });
  results.addEventListener("mousedown", (e) => {
    const li = e.target.closest("[data-i]");
    if (li) { e.preventDefault(); pick(+li.dataset.i); }
  });
  q.addEventListener("blur", () => setTimeout(() => { if (!q.value) results.hidden = true; }, 120));

  // ---------- HUD ----------
  function renderLegend() {
    const topics = nodes.filter((n) => n.kind === "topic").sort((a, b) => b.count - a.count);
    $("legend").innerHTML = topics.map((t) =>
      `<li data-topic="${esc(t.label)}" class="${hiddenTopics.has(t.label) ? "off" : ""}" style="color:${t.color}"><span class="sq" style="background:${t.color}"></span><span style="color:var(--fg)">${esc(t.label.toUpperCase())}</span><span class="n">${pad(t.count, 2)}</span></li>`
    ).join("");
  }
  $("legend").addEventListener("click", (e) => {
    const li = e.target.closest("[data-topic]");
    if (!li) return;
    const t = li.dataset.topic;
    const topics = nodes.filter((n) => n.kind === "topic").map((n) => n.label);
    // click = solo that topic; click it again (or the only visible one) = show all
    const soloed = hiddenTopics.size === topics.length - 1 && !hiddenTopics.has(t);
    hiddenTopics.clear();
    if (!soloed) for (const x of topics) if (x !== t) hiddenTopics.add(x);
    renderLegend();
    const sel = selectedId && byId.get(selectedId);
    if (sel && !visible(sel)) go(null);
    setTimeout(() => fit(900), 60);
  });
  $("legend").addEventListener("mouseover", (e) => {
    const li = e.target.closest("[data-topic]");
    setHover(li ? byId.get("t:" + li.dataset.topic) : null);
  });
  $("legend").addEventListener("mouseleave", () => setHover(null));

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
