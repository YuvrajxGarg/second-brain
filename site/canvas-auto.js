// AUTO canvases built from the brain's structure, used by canvas.js:
//   links(note)    a note plus its neighbours 1-2 hops out, arrows follow the real [[links]]
//   flow(note)     a technique or process laid out as ordered steps, with the notes it uses
//   clusters(list) groups of densely linked notes, one canvas group per cluster
// Every builder returns plain JSON Canvas data ({ nodes, edges }), so the board saves as a
// normal .canvas file and opens in Obsidian. Edges carry an extra "sb" object
// ({ score, kind: link|weak|suggest|step }) that the site uses to draw strong links
// thicker and weak or suggested links dashed; other apps just ignore it.
window.CanvasAuto = function ({ notes, graph, firstImg, uid }) {
  const MAX_NODES = 30, MAX_HOP1 = 12, MAX_PER_PARENT = 3, MAX_SUGGEST = 5;
  const W = 260, H = 140, HI = 230;
  const bySlug = new Map(notes.map((n) => [n.slug, n]));
  const key = (a, b) => (a < b ? a + "|" + b : b + "|" + a);

  // pair scores and weak flags from Link Doctor (via graph.json wiki links)
  const score = new Map(), weak = new Set();
  for (const l of graph.links || []) {
    if (l.kind !== "wiki") continue;
    const k = key(l.source.slice(2), l.target.slice(2));
    if (l.score != null) score.set(k, l.score);
    if (l.weak) weak.add(k);
  }
  const out = (n) => new Set((n.related || []).filter((s) => bySlug.has(s)));
  const nb = (n) => new Set([...(n.related || []), ...(n.backlinks || [])].filter((s) => bySlug.has(s) && s !== n.slug));
  const sc = (a, b) => score.get(key(a, b)) ?? 0.3;

  const card = (n, x, y, extra = {}) => {
    const img = firstImg(n);
    return { id: uid(), type: "file", file: n.path, x: Math.round(x), y: Math.round(y), width: W, height: img ? HI : H, ...extra };
  };
  const centreOf = (c) => [c.x + c.width / 2, c.y + c.height / 2];

  // every real link between two cards on the board, one edge per pair,
  // arrow in the direction the link was written (both ends when it goes both ways)
  function realEdges(cardOf) {
    const edges = [], seen = new Set();
    for (const [slug, c] of cardOf) {
      const n = bySlug.get(slug);
      for (const t of out(n)) {
        if (!cardOf.has(t)) continue;
        const k = key(slug, t);
        if (seen.has(k)) continue;
        seen.add(k);
        const both = out(bySlug.get(t)).has(slug);
        const s = sc(slug, t), isWeak = weak.has(k);
        edges.push({ id: uid(), fromNode: c.id, toNode: cardOf.get(t).id, ...(both ? { fromEnd: "arrow" } : {}), toEnd: "arrow", sb: { score: +s.toFixed(2), kind: isWeak ? "weak" : "link" } });
      }
    }
    return edges;
  }

  // push overlapping cards apart (groups are left alone)
  function declutter(nodes, pad = 40, rounds = 80) {
    const cards = nodes.filter((n) => n.type !== "group");
    for (let r = 0; r < rounds; r++) {
      let moved = false;
      for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
        const a = cards[i], b = cards[j];
        const [ax, ay] = centreOf(a), [bx, by] = centreOf(b);
        const ox = (a.width + b.width) / 2 + pad - Math.abs(ax - bx);
        const oy = (a.height + b.height) / 2 + pad - Math.abs(ay - by);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        // a pinned card stays put and the other takes the whole push
        const fa = a.pin ? 0 : b.pin ? 1 : 0.5, fb = b.pin ? 0 : a.pin ? 1 : 0.5;
        if (ox < oy) { const dir = ax <= bx ? 1 : -1; a.x -= ox * fa * dir; b.x += ox * fb * dir; }
        else { const dir = ay <= by ? 1 : -1; a.y -= oy * fa * dir; b.y += oy * fb * dir; }
      }
      if (!moved) break;
    }
    for (const c of cards) { c.x = Math.round(c.x); c.y = Math.round(c.y); delete c.pin; }
  }

  const legend = (x, y, text) => ({ id: uid(), type: "text", x, y, width: 300, height: 120, color: "6", text });
  const LEGEND = "**HOW TO READ**\n\nSolid arrows are links you wrote; thicker means Link Doctor scores the pair higher. Dashed lines are weak or suggested links.";

  // ---------- note + neighbours ----------
  function links(centre, { hops = 2, suggested = true } = {}) {
    const nodes = [], cardOf = new Map();
    const c = card(centre, -160, -100, { width: 320, height: firstImg(centre) ? 280 : 170, color: "4", pin: true });
    nodes.push(c); cardOf.set(centre.slug, c);

    let ring1 = [...nb(centre)].sort((a, b) => sc(centre.slug, b) - sc(centre.slug, a)).slice(0, MAX_HOP1).map((s) => ({ slug: s, kind: "link" }));
    const sugg = suggested
      ? (centre.suggest || []).filter(([s]) => bySlug.has(s) && !ring1.some((r) => r.slug === s)).slice(0, MAX_SUGGEST).map(([s, v]) => ({ slug: s, kind: "suggest", score: v }))
      : [];
    ring1 = [...ring1, ...sugg];
    // keep same-topic notes next to each other on the ring
    ring1.sort((a, b) => (bySlug.get(a.slug).topic || "").localeCompare(bySlug.get(b.slug).topic || "") || (a.kind === b.kind ? 0 : a.kind === "link" ? -1 : 1));
    const n1 = ring1.length;
    const r1 = Math.max(460, (n1 * (W + 70)) / (2 * Math.PI));
    ring1.forEach((r, i) => {
      r.angle = -Math.PI / 2 + (i / Math.max(1, n1)) * 2 * Math.PI;
      const n = bySlug.get(r.slug);
      const cd = card(n, Math.cos(r.angle) * r1 - W / 2, Math.sin(r.angle) * r1 - H / 2);
      nodes.push(cd); cardOf.set(r.slug, cd);
    });

    // second hop: each new note hangs off its strongest first-hop parent
    if (hops >= 2) {
      const cand = new Map();
      for (const r of ring1) {
        if (r.kind !== "link") continue;
        for (const s of nb(bySlug.get(r.slug))) {
          if (cardOf.has(s)) continue;
          const v = sc(r.slug, s);
          if (!cand.has(s) || cand.get(s).v < v) cand.set(s, { parent: r, v });
        }
      }
      const perParent = new Map(), picked = [];
      for (const [s, o] of [...cand].sort((a, b) => b[1].v - a[1].v)) {
        if (cardOf.size + picked.length >= MAX_NODES) break;
        const k = perParent.get(o.parent.slug) || 0;
        if (k >= MAX_PER_PARENT) continue;
        perParent.set(o.parent.slug, k + 1);
        picked.push({ slug: s, ...o });
      }
      const r2 = r1 + 420, sector = (2 * Math.PI) / Math.max(n1, 3);
      for (const [pslug, cnt] of perParent) {
        const kids = picked.filter((p) => p.parent.slug === pslug);
        kids.forEach((p, i) => {
          const a = p.parent.angle + (cnt === 1 ? 0 : (i / (cnt - 1) - 0.5) * sector * 0.8);
          const cd = card(bySlug.get(p.slug), Math.cos(a) * r2 - W / 2, Math.sin(a) * r2 - H / 2);
          nodes.push(cd); cardOf.set(p.slug, cd);
        });
      }
    }

    const edges = realEdges(cardOf);
    for (const s of sugg) edges.push({ id: uid(), fromNode: c.id, toNode: cardOf.get(s.slug).id, toEnd: "none", sb: { score: +(s.score || 0).toFixed(2), kind: "suggest" } });
    declutter(nodes);
    const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
    nodes.push(legend(Math.min(...xs) - 340, Math.min(...ys), LEGEND));
    return { nodes, edges, count: cardOf.size, name: centre.slug + " links" };
  }

  // ---------- technique / process as ordered steps ----------
  function steps(n) {
    const body = (n.body || "").split(/\n## Raw\b/)[0].split(/\n## Notes\b/)[0].replace(/!\[[^\]]*\]\([^)]*\)/g, "");
    const lines = body.split("\n");
    const grab = (re) => {
      const got = [];
      let open = false;
      for (const ln of lines) {
        const m = re.exec(ln);
        if (m) { got.push(m[1].trim()); open = true; }
        else if (open && /^\s{2,}\S/.test(ln)) got[got.length - 1] += " " + ln.trim();
        else open = false;
      }
      return got;
    };
    let s = grab(/^\s*\d+[.)]\s+(.+)/);
    if (s.length < 2) {
      s = grab(/^\s*[-*]\s+(.+)/).filter((t) => !/^(\[[^\]]+\]\(#\/n\/|related:)/i.test(t));
      if (s.length < 3) s = [];
    }
    return s.slice(0, 12).map((t) => (t.length > 240 ? t.slice(0, 237) + "..." : t));
  }
  // in-app links (built from [[slug]]) back to slugs, and the step text with titles
  const stepLinks = (t) => [...t.matchAll(/\]\(#\/n\/([^)]+)\)/g)].map((m) => decodeURIComponent(m[1])).filter((s) => bySlug.has(s));
  const stepText = (t) => t.replace(/\[([^\]]+)\]\(#\/n\/[^)]+\)/g, "**$1**");

  // no numbered steps saved: fall back to the summary's sentences, labelled OUTLINE
  function outline(n) {
    const sum = ((n.body || "").match(/## Summary\n+([\s\S]*?)(?=\n## |$)/) || [])[1] || "";
    const prose = sum.split(/\n\s*\n/).filter((p) => !/^\s*(!\[|screenshot|frames?\b|the (thumbnail|frame|image|screenshot))/i.test(p)).join(" ");
    return prose.replace(/\s+/g, " ").split(/(?<=[.!?])\s+(?=[A-Z"(])/).map((t) => t.trim()).filter((t) => t.length >= 25 && !/\b(no images?|text-only|screenshot|thumbnail)\b/i.test(t)).slice(0, 8)
      .map((t) => (t.length > 240 ? t.slice(0, 237) + "..." : t));
  }

  function flow(n) {
    let list = steps(n), what = "STEPS";
    if (!list.length) { list = outline(n); what = "OUTLINE"; }
    if (list.length < 2) return null;
    const nodes = [], edges = [], cardOf = new Map();
    const main = card(n, -360, 0, { width: 300, height: firstImg(n) ? 280 : 170, color: "4" });
    nodes.push(main); cardOf.set(n.slug, main);
    const COLS = 4, SW = 250, GX = 70, GY = 80;
    const hOf = (t) => Math.min(220, Math.max(96, 54 + Math.ceil(t.length / 30) * 19));
    const rows = Math.ceil(list.length / COLS);
    const rowH = [...Array(rows)].map((_, r) => Math.max(...list.slice(r * COLS, r * COLS + COLS).map(hOf)));
    let y = 0;
    const stepCards = list.map((t, i) => {
      const r = Math.floor(i / COLS), col = r % 2 ? COLS - 1 - (i % COLS) : i % COLS; // snake so arrows stay short
      if (i % COLS === 0 && i) y += rowH[r - 1] + GY;
      return { id: uid(), type: "text", x: col * (SW + GX), y, width: SW, height: hOf(t), text: `**${i + 1}**  ${stepText(t)}`, color: i === 0 ? "4" : undefined, _t: t };
    });
    const totalW = Math.min(list.length, COLS) * (SW + GX) - GX, totalH = y + rowH[rows - 1];
    nodes.push({ id: uid(), type: "group", label: what + " · " + (n.label || "").toUpperCase(), x: -30, y: -46, width: totalW + 60, height: totalH + 76, color: "5" });
    for (const s of stepCards) { if (!s.color) delete s.color; nodes.push(s); }
    main.y = Math.round(stepCards[0].y + stepCards[0].height / 2 - main.height / 2);
    edges.push({ id: uid(), fromNode: main.id, fromSide: "right", toNode: stepCards[0].id, toSide: "left", toEnd: "arrow", sb: { score: 0.6, kind: "step" } });
    stepCards.forEach((s, i) => {
      const nx = stepCards[i + 1];
      if (!nx) return;
      const sameRow = Math.floor(i / COLS) === Math.floor((i + 1) / COLS);
      const fwd = nx.x > s.x;
      edges.push({ id: uid(), fromNode: s.id, toNode: nx.id, fromSide: sameRow ? (fwd ? "right" : "left") : "bottom", toSide: sameRow ? (fwd ? "left" : "right") : "top", toEnd: "arrow", sb: { score: 0.6, kind: "step" } });
    });

    // notes the technique uses: ones a step links to hang under that step,
    // the rest of its links sit in a LINKED NOTES row under the steps
    const used = new Map();
    stepCards.forEach((s) => { for (const sl of stepLinks(s._t)) if (sl !== n.slug && !used.has(sl)) used.set(sl, s); });
    for (const s of [...nb(n)].sort((a, b) => sc(n.slug, b) - sc(n.slug, a))) if (!used.has(s)) used.set(s, main);
    let i = 0;
    for (const [sl, from] of used) {
      if (cardOf.size >= MAX_NODES - list.length) break;
      const cd = card(bySlug.get(sl), i * (W + 40), totalH + 120);
      nodes.push(cd); cardOf.set(sl, cd); i++;
      if (from !== main) edges.push({ id: uid(), fromNode: from.id, toNode: cd.id, toEnd: "arrow", label: "uses", sb: { score: 0.8, kind: "link" } });
    }
    if (i) nodes.push({ id: uid(), type: "group", label: "LINKED NOTES", x: -30, y: totalH + 74, width: i * (W + 40) + 20, height: HI + 76 });
    // real links among the linked notes; the main note's own links are implied by the group,
    // so they aren't drawn across the steps
    for (const e of realEdges(cardOf)) if (e.fromNode !== main.id && e.toNode !== main.id) edges.push(e);
    for (const s of stepCards) delete s._t;
    return { nodes, edges, count: list.length, what, name: n.slug + " flow" };
  }
  const flowable = () => notes.filter((n) => n.noteKind === "technique" || (n.tags || []).some((t) => /^(workflow|process|pipeline|technique|tutorial|how-to)$/.test(t)) || steps(n).length >= 3)
    .map((n) => ({ n, k: steps(n).length })).sort((a, b) => (b.k ? 1 : 0) - (a.k ? 1 : 0) || a.n.label.localeCompare(b.n.label));

  // ---------- clusters of densely linked notes ----------
  function clusters(list, { maxNodes = 40, maxGroups = 8 } = {}) {
    const inScope = new Set(list.map((n) => n.slug));
    const adj = new Map(list.map((n) => [n.slug, new Map()]));
    for (const n of list) for (const s of nb(n)) if (inScope.has(s)) { adj.get(n.slug).set(s, sc(n.slug, s)); adj.get(s).set(n.slug, sc(n.slug, s)); }
    // weighted label propagation, deterministic: hubs first, ties to the smaller label
    const label = new Map(list.map((n) => [n.slug, n.slug]));
    const order = list.map((n) => n.slug).filter((s) => adj.get(s).size).sort((a, b) => adj.get(b).size - adj.get(a).size || a.localeCompare(b));
    for (let it = 0; it < 12; it++) {
      let changed = 0;
      for (const s of order) {
        const w = new Map();
        for (const [t, v] of adj.get(s)) w.set(label.get(t), (w.get(label.get(t)) || 0) + v);
        let best = label.get(s), bv = -1;
        for (const [l, v] of w) if (v > bv + 1e-9 || (Math.abs(v - bv) < 1e-9 && l < best)) { best = l; bv = v; }
        if (best !== label.get(s)) { label.set(s, best); changed++; }
      }
      if (!changed) break;
    }
    const groups = new Map();
    for (const s of order) { const l = label.get(s); if (!groups.has(l)) groups.set(l, []); groups.get(l).push(s); }
    const inner = (g) => { let t = 0; for (const a of g) for (const [b, v] of adj.get(a)) if (g.includes(b) && a < b) t += v; return t; };
    let ranked = [...groups.values()].filter((g) => g.length >= 2).sort((a, b) => inner(b) - inner(a) || b.length - a.length);
    const take = [];
    let total = 0;
    for (const g of ranked) {
      if (take.length >= maxGroups || total >= maxNodes) break;
      const sorted = g.sort((a, b) => adj.get(b).size - adj.get(a).size).slice(0, Math.min(10, maxNodes - total));
      if (sorted.length < 2) break;
      take.push(sorted); total += sorted.length;
    }
    const tagUse = new Map();
    for (const n of notes) for (const t of n.tags || []) tagUse.set(t, (tagUse.get(t) || 0) + 1);
    const GENERIC = new Set(["inspiration", "reference", "to-try", "to-read", "tool", "idea", "workflow", "own-project"]);
    const nameOf = (g) => {
      const c = new Map();
      for (const s of g) for (const t of bySlug.get(s).tags || []) if (!GENERIC.has(t)) c.set(t, (c.get(t) || 0) + 1);
      const best = [...c].sort((a, b) => b[1] - a[1] || tagUse.get(a[0]) - tagUse.get(b[0]))[0];
      return best && best[1] >= 2 ? "#" + best[0] : bySlug.get(g[0]).label;
    };

    const nodes = [], cardOf = new Map();
    let gx = 0, gy = 0, rowH = 0;
    const WRAP = 2600;
    for (const g of take) {
      // hub in the middle, the rest on a circle round it
      const local = [];
      const hub = g[0], rest = g.slice(1);
      const rad = rest.length <= 1 ? 0 : Math.max(260, (rest.length * (W + 50)) / (2 * Math.PI));
      local.push({ slug: hub, x: 0, y: 0 });
      if (rest.length === 1) local.push({ slug: rest[0], x: W + 120, y: 0 });
      else rest.forEach((s, i) => { const a = -Math.PI / 2 + (i / rest.length) * 2 * Math.PI; local.push({ slug: s, x: Math.cos(a) * rad, y: Math.sin(a) * rad }); });
      const cards = local.map((p) => card(bySlug.get(p.slug), p.x - W / 2, p.y - H / 2));
      declutter(cards, 30);
      const x0 = Math.min(...cards.map((c) => c.x)), y0 = Math.min(...cards.map((c) => c.y));
      const x1 = Math.max(...cards.map((c) => c.x + c.width)), y1 = Math.max(...cards.map((c) => c.y + c.height));
      const gw = x1 - x0 + 80, gh = y1 - y0 + 100;
      if (gx > 0 && gx + gw > WRAP) { gx = 0; gy += rowH + 120; rowH = 0; }
      nodes.push({ id: uid(), type: "group", label: `${nameOf(g).toUpperCase()} · ${g.length}`, x: gx, y: gy, width: gw, height: gh, color: String((take.indexOf(g) % 6) + 1) });
      for (const c of cards) { c.x += gx + 40 - x0; c.y += gy + 60 - y0; nodes.push(c); }
      local.forEach((p, i) => cardOf.set(p.slug, cards[i]));
      gx += gw + 120; rowH = Math.max(rowH, gh);
    }
    nodes.push(legend(-360, 0, LEGEND + " Each group is a cluster of notes that link to each other."));
    const loose = list.filter((n) => !adj.get(n.slug).size).length;
    return { nodes, edges: realEdges(cardOf), count: cardOf.size, groups: take.length, loose };
  }

  return { links, flow, flowable, steps, outline, clusters, MAX_NODES };
};
